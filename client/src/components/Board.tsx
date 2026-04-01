// ============================================================================
// Board Component — Themed outside pawns + animated pawn positions
// ============================================================================

import { useMemo } from 'react';
import {
  type Pawn as PawnType,
  PawnState,
  PlayerPosition,
} from '@shared/types';
import {
  BOARD_SIZE,
  HOME_CELL,
  gridToCell,
} from '@shared/constants';
import { getCellAtIndex } from '@shared/rules';
import { Cell } from './Cell';
import { useGame } from '../contexts/UnifiedGameContext';
import { useTheme, type PawnStyle } from '../contexts/ThemeContext';

// Board background images
const BOARD_IMAGES: Record<string, string> = {
  paper: '/assets/board/paper.png',
  wood: '/assets/board/wood.png',
  marble: '/assets/board/marble.png',
  slate: '/assets/board/slate.png',
};

// Per-theme padding to align invisible grid with the board image cells
const BOARD_PADDING: Record<string, string> = {
  paper: '4%',
  wood: '5%',
  marble: '5%',
  slate: '1.5%',
};

// Image paths for each pawn style and player
const PAWN_IMAGES: Record<PawnStyle, Record<PlayerPosition, string>> = {
  ludo: {
    [PlayerPosition.A]: '/assets/pawns/ludo_red.png',
    [PlayerPosition.B]: '/assets/pawns/ludo_green.png',
    [PlayerPosition.C]: '/assets/pawns/ludo_yellow.png',
    [PlayerPosition.D]: '/assets/pawns/ludo_blue.png',
  },
  checkers: {
    [PlayerPosition.A]: '/assets/pawns/checker_red.png',
    [PlayerPosition.B]: '/assets/pawns/checker_green.png',
    [PlayerPosition.C]: '/assets/pawns/checker_yellow.png',
    [PlayerPosition.D]: '/assets/pawns/checker_blue.png',
  },
  rural: {
    [PlayerPosition.A]: '/assets/pawns/rural_stone.png',
    [PlayerPosition.B]: '/assets/pawns/rural_stick.png',
    [PlayerPosition.C]: '/assets/pawns/rural_seed.png',
    [PlayerPosition.D]: '/assets/pawns/rural_nut.png',
  },
};

/** Outside pawns — uses same themed images as board pawns */
export function OutsidePawns({
  position,
  direction,
}: {
  position: PlayerPosition;
  direction: 'row' | 'col';
}) {
  const { state, selectMove, isAnimating, isRolling, isMyTurn, perspectiveRotation = 0 } = useGame();
  const { pawnStyle } = useTheme();
  const player = state.players.get(position);
  if (!player) return null;

  const outsideCount = player.pawns.filter((p) => p.state === PawnState.OUTSIDE).length;
  const isTurn = state.currentTurn === position;
  const imgSrc = PAWN_IMAGES[pawnStyle][position];

  const entryMoves = !isAnimating && !isRolling && state.phase === 'WAITING_FOR_MOVE'
    ? state.validMoves.filter((m) => m.isEntry && player.pawns.some((p) => p.id === m.pawnId))
    : [];

  const canEnter = entryMoves.length > 0;

  const handleEntryClick = () => {
    if (!isMyTurn) return;
    if (canEnter) {
      // Prioritize double entry moves if available
      const doubleEntry = entryMoves.find(m => m.isDoubleEntry);
      selectMove(doubleEntry || entryMoves[0]);
    }
  };

  const PLAYER_COLORS: Record<PlayerPosition, string> = {
    [PlayerPosition.A]: '#ef4444',
    [PlayerPosition.B]: '#10b981',
    [PlayerPosition.C]: '#f59e0b',
    [PlayerPosition.D]: '#3b82f6',
  };

  return (
    <div 
      className={`flex ${direction === 'col' ? 'flex-col' : ''} gap-1 items-center justify-center`}
      style={{ transform: `rotate(${-perspectiveRotation}deg)` }}
    >
      <span
        className={`text-[10px] font-semibold text-stone-600 truncate max-w-[60px] ${isTurn ? 'text-stone-800' : 'opacity-50'}`}
        style={direction === 'col' ? { writingMode: 'vertical-rl', textOrientation: 'mixed' } : undefined}
      >
        {player.name}
      </span>
      <div
        className={`flex ${direction === 'col' ? 'flex-col' : ''} gap-0.5 items-center ${canEnter && isMyTurn ? 'cursor-pointer' : ''}`}
        onClick={handleEntryClick}
        role={canEnter && isMyTurn ? 'button' : undefined}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={`
              relative flex items-center justify-center
              ${i < outsideCount ? '' : 'opacity-0 pointer-events-none'}
              ${i < outsideCount && canEnter && isMyTurn ? 'animate-[pawn-bounce_0.8s_ease-in-out_infinite]' : ''}
            `}
          >
            {/* Rotating Entry Circular Indicator — Alternating White/Black dashes */}
            {i < outsideCount && canEnter && isMyTurn && (
              <div className="absolute inset-0 scale-125 animate-rotate-fast flex items-center justify-center pointer-events-none z-0">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="black"
                    strokeWidth="8"
                    strokeDasharray="10 10"
                    strokeOpacity="0.7"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="white"
                    strokeWidth="8"
                    strokeDasharray="10 10"
                    strokeDashoffset="10"
                    strokeOpacity="0.8"
                  />
                </svg>
              </div>
            )}
            <img
              src={imgSrc}
              alt={`${position} outside pawn`}
              className="relative z-10 drop-shadow-sm"
              style={{ width: 'clamp(16px, 3vw, 26px)', height: 'clamp(16px, 3vw, 26px)', objectFit: 'contain' }}
              draggable={false}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Board() {
  const { state, perspectiveRotation = 0, animatingPawn, killedAnimatingPawn } = useGame();
  const { boardTheme } = useTheme();

  // Build pawn-to-cell map, with animating/killed pawns at their animated positions
  const pawnsPerCell = useMemo(() => {
    const map = new Map<number, PawnType[]>();
    for (const player of state.players.values()) {
      for (const pawn of player.pawns) {
        if (animatingPawn && animatingPawn.pawnIds.includes(pawn.id)) {
          const cellId = animatingPawn.currentCellId;
          if (!map.has(cellId)) map.set(cellId, []);
          map.get(cellId)!.push(pawn);
          continue;
        }

        if (killedAnimatingPawn && killedAnimatingPawn.pawnIds.includes(pawn.id)) {
          const cellId = killedAnimatingPawn.currentCellId;
          if (!map.has(cellId)) map.set(cellId, []);
          map.get(cellId)!.push(pawn);
          continue;
        }

        if (pawn.state === PawnState.OUTSIDE) continue;

        if (pawn.state === PawnState.HOME) {
          if (!map.has(HOME_CELL)) map.set(HOME_CELL, []);
          map.get(HOME_CELL)!.push(pawn);
          continue;
        }

        const cellId = getCellAtIndex(pawn.playerId, pawn.pathIndex);
        if (!map.has(cellId)) map.set(cellId, []);
        map.get(cellId)!.push(pawn);
      }
    }
    return map;
  }, [state.players, animatingPawn, killedAnimatingPawn]);

  const cells = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const cellId = gridToCell(row, col);
      cells.push(
        <Cell
          key={cellId}
          cellId={cellId}
          pawnsOnCell={pawnsPerCell.get(cellId) || []}
        />,
      );
    }
  }

  const hasA = state.players.has(PlayerPosition.A);
  const hasB = state.players.has(PlayerPosition.B);
  const hasC = state.players.has(PlayerPosition.C);
  const hasD = state.players.has(PlayerPosition.D);

  return (
    <div 
      className="relative w-full h-full transition-transform duration-700 ease-in-out"
      style={{ transform: `rotate(${perspectiveRotation}deg)` }}
    >
      <div className="hidden md:block">
        {hasA && (
          <div className="absolute left-1/2 -translate-x-1/2 -top-6 sm:-top-7">
            <OutsidePawns position={PlayerPosition.A} direction="row" />
          </div>
        )}
        {hasB && (
          <div className="absolute top-1/2 -translate-y-1/2 -left-6 sm:-left-7">
            <OutsidePawns position={PlayerPosition.B} direction="col" />
          </div>
        )}
        {hasC && (
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-6 sm:-bottom-7">
            <OutsidePawns position={PlayerPosition.C} direction="row" />
          </div>
        )}
        {hasD && (
          <div className="absolute top-1/2 -translate-y-1/2 -right-6 sm:-right-7">
            <OutsidePawns position={PlayerPosition.D} direction="col" />
          </div>
        )}
      </div>

      <div className="relative aspect-square w-full">
        {boardTheme !== 'css' && BOARD_IMAGES[boardTheme] && (
          <img
            src={BOARD_IMAGES[boardTheme]}
            alt="board"
            className="absolute inset-0 w-full h-full object-cover rounded-sm"
            draggable={false}
          />
        )}

        <div
          className={`absolute inset-0 grid grid-cols-5 grid-rows-5 ${boardTheme === 'css' ? 'border-2 border-stone-800 bg-white' : ''
            }`}
          style={
            boardTheme !== 'css' && BOARD_PADDING[boardTheme]
              ? { padding: BOARD_PADDING[boardTheme] }
              : undefined
          }
        >
          {cells}
        </div>
      </div>
    </div>
  );
}
