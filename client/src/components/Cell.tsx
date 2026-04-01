// ============================================================================
// Cell Component — Background arrows for start/transition, click pawn to move
// ============================================================================

import { useState } from 'react';
import { type CellId, type MoveAction, PlayerPosition, PawnState } from '@shared/types';
import { SAFE_CELLS, EXTRA_SAFE_CELLS, ENTRY_CELLS, HOME_CELL, PLAYER_PATHS } from '@shared/constants';
import { getCellAtIndex } from '@shared/rules';
import { Pawn } from './Pawn';
import { useGame } from '../contexts/UnifiedGameContext';
import { useTheme } from '../contexts/ThemeContext';
import type { Pawn as PawnType } from '@shared/types';

interface CellProps {
  cellId: CellId;
  pawnsOnCell: PawnType[];
}

/** Map entry cell → player color for background */
const ENTRY_BG: Record<number, string> = {
  [ENTRY_CELLS[PlayerPosition.A]]: 'bg-red-200',
  [ENTRY_CELLS[PlayerPosition.B]]: 'bg-emerald-200',
  [ENTRY_CELLS[PlayerPosition.C]]: 'bg-yellow-200',
  [ENTRY_CELLS[PlayerPosition.D]]: 'bg-blue-200',
};

const ENTRY_LINE: Record<number, string> = {
  [ENTRY_CELLS[PlayerPosition.A]]: '#b91c1c',
  [ENTRY_CELLS[PlayerPosition.B]]: '#047857',
  [ENTRY_CELLS[PlayerPosition.C]]: '#a16207',
  [ENTRY_CELLS[PlayerPosition.D]]: '#1d4ed8',
};

// Darker player colors for arrows
const DARK_COLORS: Record<PlayerPosition, string> = {
  [PlayerPosition.A]: '#991b1b', // dark red
  [PlayerPosition.B]: '#065f46', // dark green
  [PlayerPosition.C]: '#854d0e', // dark yellow/gold
  [PlayerPosition.D]: '#1e3a8a', // dark blue
};

// START arrows: placed on path[1] (first cell AFTER entry)
// These show the direction of movement from entry cell
const START_ARROWS: Record<number, { color: string; rotation: number }> = {
  [PLAYER_PATHS[PlayerPosition.A][1]]: { color: DARK_COLORS[PlayerPosition.A], rotation: 180 },  // ←
  [PLAYER_PATHS[PlayerPosition.B][1]]: { color: DARK_COLORS[PlayerPosition.B], rotation: 90 },   // ↓
  [PLAYER_PATHS[PlayerPosition.C][1]]: { color: DARK_COLORS[PlayerPosition.C], rotation: 0 },    // →
  [PLAYER_PATHS[PlayerPosition.D][1]]: { color: DARK_COLORS[PlayerPosition.D], rotation: 270 },  // ↑
};

// TRANSITION arrows: last outer path cell (index 15) → points toward inner path
const TRANSITION_ARROWS: Record<number, { color: string; rotation: number }> = {
  [PLAYER_PATHS[PlayerPosition.A][15]]: { color: DARK_COLORS[PlayerPosition.A], rotation: 90 },   // ↓
  [PLAYER_PATHS[PlayerPosition.B][15]]: { color: DARK_COLORS[PlayerPosition.B], rotation: 0 },    // →
  [PLAYER_PATHS[PlayerPosition.C][15]]: { color: DARK_COLORS[PlayerPosition.C], rotation: 270 },  // ↑
  [PLAYER_PATHS[PlayerPosition.D][15]]: { color: DARK_COLORS[PlayerPosition.D], rotation: 180 },  // ←
};

/** Background arrow — rendered behind pawns as part of cell background */
function BgArrow({ color, rotation }: { color: string; rotation: number }) {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      style={{ opacity: 0.35 }}
    >
      <g transform={`rotate(${rotation}, 50, 50)`}>
        {/* Arrow pointing right → */}
        <line x1="25" y1="50" x2="72" y2="50" stroke={color} strokeWidth="6" strokeLinecap="round" />
        <polyline points="60,35 75,50 60,65" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** Map 1st inner cell (PathIndex 16) → player color for background/icons */
const INNER_ENTRY_CELLS: Record<number, PlayerPosition> = {
  [PLAYER_PATHS[PlayerPosition.A][16]]: PlayerPosition.A,
  [PLAYER_PATHS[PlayerPosition.B][16]]: PlayerPosition.B,
  [PLAYER_PATHS[PlayerPosition.C][16]]: PlayerPosition.C,
  [PLAYER_PATHS[PlayerPosition.D][16]]: PlayerPosition.D,
};

/** Custom BAN SVG for 'Kill to Unlock' status */
function BanIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  );
}

export function Cell({ cellId, pawnsOnCell }: CellProps) {
  const { state, selectMove, isAnimating, isMyTurn } = useGame();
  const { boardTheme } = useTheme();
  const isCssBoard = boardTheme === 'css';

  const isSafe = SAFE_CELLS.has(cellId) || (state.config.extraSafeCells && EXTRA_SAFE_CELLS.has(cellId));
  const isHome = cellId === HOME_CELL;
  const currentTurn = state.currentTurn;

  // Kill-to-Unlock: Find which player's inner entry this is
  const ownerPos = INNER_ENTRY_CELLS[cellId];
  const ownerPlayer = ownerPos ? state.players.get(ownerPos) : undefined;
  const isLocked = state.config.entryMode === 'LOCKED' && ownerPlayer && !ownerPlayer.hasKilled;

  // Check if this is the current player's entry cell and they have outside pawns (CSS board only)
  const isActiveEntry = isCssBoard
    && isSafe
    && ENTRY_CELLS[currentTurn] === cellId
    && state.phase === 'WAITING_FOR_ROLL'
    && state.players.get(currentTurn)?.pawns.some((p) => p.state === 'OUTSIDE');

  const [selectionMoves, setSelectionMoves] = useState<MoveAction[] | null>(null);

  // Build list of moves relevant to pawns on this cell
  const pawnIdsOnCell = new Set(pawnsOnCell.map(p => p.id));
  const cellMoves = state.phase === 'WAITING_FOR_MOVE' && !isAnimating
    ? state.validMoves.filter(m => {
      // Direct match: move's pawnId is on this cell
      const directPawn = state.players.get(state.currentTurn)?.pawns.find(pw => pw.id === m.pawnId);
      if (directPawn && directPawn.state !== PawnState.OUTSIDE && directPawn.state !== PawnState.HOME) {
        if (getCellAtIndex(directPawn.playerId, directPawn.pathIndex) === cellId) return true;
      }
      // Pair match: any pawnId in pawnIds is on this cell
      if (m.isPairMove && m.pawnIds) {
        return m.pawnIds.some(id => pawnIdsOnCell.has(id));
      }
      return false;
    })
    : [];

  const handlePawnClick = (pawnId: string) => {
    if (!isMyTurn) return;

    // Find direct moves for this pawn
    let movesForThisPawn = cellMoves.filter(m => m.pawnId === pawnId);

    // Also find pair moves where this pawn is part of pawnIds (but pawnId is a different pawn)
    const pairMovesIncludingMe = cellMoves.filter(
      m => m.isPairMove && m.pawnIds?.includes(pawnId) && m.pawnId !== pawnId
    );
    movesForThisPawn = [...movesForThisPawn, ...pairMovesIncludingMe];

    // If we have both Single AND Pair options, show selector
    const hasSingle = movesForThisPawn.some(m => !m.isPairMove);
    const hasPair = movesForThisPawn.some(m => m.isPairMove);

    if (hasSingle && hasPair) {
      // Show one single + one pair option
      const singleMove = movesForThisPawn.find(m => !m.isPairMove)!;
      const pairMove = movesForThisPawn.find(m => m.isPairMove)!;
      setSelectionMoves([singleMove, pairMove]);
      return;
    }

    // Only one type of move available — execute directly
    if (movesForThisPawn.length > 0) {
      selectMove(movesForThisPawn[0]);
    }
  };

  const handleSelectChoice = (move: MoveAction) => {
    setSelectionMoves(null);
    selectMove(move);
  };

  const startArrow = START_ARROWS[cellId];
  const transArrow = TRANSITION_ARROWS[cellId];

  // Player colors for icons/vignettes
  const PLAYER_COLORS: Record<PlayerPosition, string> = {
    [PlayerPosition.A]: '#e74c3c',
    [PlayerPosition.B]: '#2ecc71',
    [PlayerPosition.C]: '#f1c40f',
    [PlayerPosition.D]: '#3498db',
  };

  // Home cell — 4 colored triangles with pawns in their respective zones
  if (isHome) {
    const pawnsByPlayer = {
      [PlayerPosition.A]: pawnsOnCell.filter(p => p.playerId === PlayerPosition.A),
      [PlayerPosition.B]: pawnsOnCell.filter(p => p.playerId === PlayerPosition.B),
      [PlayerPosition.C]: pawnsOnCell.filter(p => p.playerId === PlayerPosition.C),
      [PlayerPosition.D]: pawnsOnCell.filter(p => p.playerId === PlayerPosition.D),
    };

    return (
      <div className={`relative flex items-center justify-center aspect-square overflow-hidden ${isCssBoard ? 'border border-stone-800' : ''}`}>
        {isCssBoard && (
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polygon points="0,0 100,0 50,50" fill={PLAYER_COLORS[PlayerPosition.A]} />
            <polygon points="100,0 100,100 50,50" fill={PLAYER_COLORS[PlayerPosition.D]} />
            <polygon points="100,100 0,100 50,50" fill={PLAYER_COLORS[PlayerPosition.C]} />
            <polygon points="0,100 0,0 50,50" fill={PLAYER_COLORS[PlayerPosition.B]} />
            <line x1="0" y1="0" x2="100" y2="100" stroke="#555" strokeWidth="1" />
            <line x1="100" y1="0" x2="0" y2="100" stroke="#555" strokeWidth="1" />
          </svg>
        )}

        {/* Top: Player A */}
        <div className="absolute top-0 inset-x-0 h-1/2 flex items-start justify-center pt-1.5 z-10">
          <div className="flex flex-wrap gap-0 justify-center">
            {pawnsByPlayer[PlayerPosition.A].map(p => (
              <Pawn key={p.id} pawn={p} isMovable={false} scale={0.6} onClick={() => { }} />
            ))}
          </div>
        </div>

        {/* Left: Player B */}
        <div className="absolute left-0 inset-y-0 w-1/2 flex items-center justify-start pl-1.5 z-10">
          <div className="flex flex-col flex-wrap gap-0 justify-center">
            {pawnsByPlayer[PlayerPosition.B].map(p => (
              <Pawn key={p.id} pawn={p} isMovable={false} scale={0.6} onClick={() => { }} />
            ))}
          </div>
        </div>

        {/* Bottom: Player C */}
        <div className="absolute bottom-0 inset-x-0 h-1/2 flex items-end justify-center pb-1.5 z-10">
          <div className="flex flex-wrap gap-0 justify-center">
            {pawnsByPlayer[PlayerPosition.C].map(p => (
              <Pawn key={p.id} pawn={p} isMovable={false} scale={0.6} onClick={() => { }} />
            ))}
          </div>
        </div>

        {/* Right: Player D */}
        <div className="absolute right-0 inset-y-0 w-1/2 flex items-center justify-end pr-1.5 z-10">
          <div className="flex flex-col flex-wrap gap-0 justify-center">
            {pawnsByPlayer[PlayerPosition.D].map(p => (
              <Pawn key={p.id} pawn={p} isMovable={false} scale={0.6} onClick={() => { }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Regular + safe cells
  const bgClass = isCssBoard ? (isSafe ? (ENTRY_BG[cellId] || 'bg-cyan-200') : 'bg-white') : '';
  const lineColor = isSafe ? (ENTRY_LINE[cellId] || '#1a7a8a') : '';
  const movablePawnIds = new Set<string>();
  for (const m of cellMoves) {
    movablePawnIds.add(m.pawnId);
    if (m.pawnIds) m.pawnIds.forEach(id => movablePawnIds.add(id));
  }

  return (
    <div className={`relative flex items-center justify-center aspect-square ${isCssBoard ? 'border border-stone-800' : ''} ${bgClass} ${isActiveEntry ? 'animate-[entry-blink_1.2s_ease-in-out_infinite]' : ''}`}
      style={isActiveEntry ? { color: ENTRY_LINE[cellId] || '#1a7a8a' } : undefined}
    >
      {/* Selection Pop-up Choice UI */}
      {selectionMoves && (
        <div className="absolute -top-16 inset-x-0 flex justify-center z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-white/90 backdrop-blur-md p-1.5 rounded-xl shadow-xl flex gap-2 border border-amber-200">
            {selectionMoves.map((m, i) => {
              const myPawns = pawnsOnCell.filter(p => p.playerId === state.currentTurn);
              return (
                <button
                  key={i}
                  className="w-14 h-14 flex items-center justify-center bg-white border border-stone-100 rounded-lg transition-all hover:border-amber-400 hover:scale-110 active:scale-95 shadow-sm overflow-hidden p-1"
                  onClick={() => handleSelectChoice(m)}
                >
                  <div className="flex items-center justify-center">
                    <Pawn pawn={myPawns[0]} isMovable={false} scale={m.isPairMove ? 1 : 0.8} onClick={() => { }} />
                    {m.isPairMove && (
                      <Pawn pawn={myPawns[1] || myPawns[0]} isMovable={false} scale={1} stackIndex={1} isCombined={true} onClick={() => { }} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {/* Triangle Pointer */}
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45 border-b border-r border-amber-200" />
        </div>
      )}

      {/* Safe cell diagonal lines (CSS only) */}
      {isCssBoard && isSafe && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1="0" y1="0" x2="100" y2="100" stroke={lineColor} strokeWidth="1.5" />
          <line x1="100" y1="0" x2="0" y2="100" stroke={lineColor} strokeWidth="1.5" />
        </svg>
      )}

      {/* Arrows */}
      {startArrow && (
        <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
          <BgArrow color={startArrow.color} rotation={startArrow.rotation} />
        </div>
      )}
      {transArrow && (
        <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
          <BgArrow color={transArrow.color} rotation={transArrow.rotation} />
        </div>
      )}

      {/* Ban Icon for "Kill to Unlock" mode */}
      {isLocked && ownerPos && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-50">
          <BanIcon size={20} color={PLAYER_COLORS[ownerPos]} />
        </div>
      )}

      {/* PAWNS RENDERING */}
      <div className="relative z-10 flex flex-wrap items-center justify-center gap-0">
        {(() => {
          // Group pawns by player for stacking
          const groups: Record<string, typeof pawnsOnCell> = {};
          for (const p of pawnsOnCell) {
            if (!groups[p.playerId]) groups[p.playerId] = [];
            groups[p.playerId].push(p);
          }
          const totalPawns = pawnsOnCell.length;
          const scale = totalPawns > 4 ? 0.5
            : totalPawns > 2 ? 0.65
              : totalPawns > 1 ? 0.75
                : 1.0;
          // Stack same-player pawns when >4 total in cell, or when paired
          const shouldStack = totalPawns > 4;

          return Object.entries(groups).map(([playerId, playerPawns]) => {
            // Sort: paired first, then singles, so overlap is visually clean
            const sorted = [...playerPawns].sort((a, b) => (b.isPaired ? 1 : 0) - (a.isPaired ? 1 : 0));
            let pairedIdx = 0;

            return (
              <div key={playerId} className="flex items-center justify-center">
                {sorted.map((pawn) => {
                  const isMovable = movablePawnIds.has(pawn.id);
                  const isCombined = shouldStack || pawn.isPaired;
                  // stackIndex only increments for combined (paired/stacked) pawns
                  const si = isCombined ? pairedIdx++ : 0;
                  return (
                    <Pawn
                      key={pawn.id}
                      pawn={pawn}
                      isMovable={isMovable}
                      scale={scale}
                      stackIndex={si}
                      isCombined={isCombined}
                      onClick={() => handlePawnClick(pawn.id)}
                    />
                  );
                })}
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}
