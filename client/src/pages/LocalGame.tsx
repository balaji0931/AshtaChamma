// ============================================================================
// Local Game — Fixed-size dice area with pawn ID, arrow indicator
// ============================================================================

import { useState } from 'react';
import { PlayerPosition, GamePhase, PawnState } from '@shared/types';
import { Board } from '../components/Board';
import { Dice } from '../components/Dice';
import { useGame } from '../contexts/UnifiedGameContext';
import { useTheme, type PawnStyle } from '../contexts/ThemeContext';
import { Trophy, X, AlertTriangle } from 'lucide-react';

interface LocalGameProps {
  onExit: () => void;
}

// Pawn images for identification box
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

const PLAYER_BORDER: Record<PlayerPosition, string> = {
  [PlayerPosition.A]: 'border-red-400',
  [PlayerPosition.B]: 'border-emerald-400',
  [PlayerPosition.C]: 'border-yellow-400',
  [PlayerPosition.D]: 'border-blue-400',
};

const ARROW_COLORS: Record<PlayerPosition, string> = {
  [PlayerPosition.A]: '#dc2626',
  [PlayerPosition.B]: '#059669',
  [PlayerPosition.C]: '#ca8a04',
  [PlayerPosition.D]: '#2563eb',
};

/** Animated arrow between two players, pointing toward whoever's turn it is */
function TurnArrow({ currentTurn, leftPlayer, rightPlayer, hasLeft, hasRight }: {
  currentTurn: PlayerPosition;
  leftPlayer: PlayerPosition;
  rightPlayer: PlayerPosition;
  hasLeft: boolean;
  hasRight: boolean;
}) {
  const isLeftTurn = currentTurn === leftPlayer && hasLeft;
  const isRightTurn = currentTurn === rightPlayer && hasRight;

  if (!isLeftTurn && !isRightTurn) {
    return <div className="flex-1" />;
  }

  return (
    <div className="flex-1 flex items-center justify-center">
      <span
        className="text-2xl font-black animate-[arrow-bounce_1s_ease-in-out_infinite] leading-none select-none"
        style={{ color: ARROW_COLORS[currentTurn] }}
      >
        {isLeftTurn ? '←' : '→'}
      </span>
    </div>
  );
}

/** Dice area — includes name, dice, identifier, and outside pawns on mobile. */
function PlayerDice({ position, diceOnLeft = false, isBottom = false }: { position: PlayerPosition; diceOnLeft?: boolean; isBottom?: boolean }) {
  const { state, selectMove, isAnimating } = useGame();
  const { pawnStyle } = useTheme();
  const player = state.players.get(position);
  if (!player) return null;

  const isTurn = state.currentTurn === position;
  const pawnImg = PAWN_IMAGES[pawnStyle][position];
  const diceBorder = isTurn ? PLAYER_BORDER[position] : 'border-stone-200';
  const outsidePawns = player.pawns.filter(p => p.state === PawnState.OUTSIDE);

  // Entry moves for clicking outside pawns
  const entryMoves = !isAnimating && state.phase === 'WAITING_FOR_MOVE'
    ? state.validMoves.filter((m) => m.isEntry && player.pawns.some((p) => p.id === m.pawnId))
    : [];
  const canEnter = entryMoves.length > 0;

  const handleEntryClick = () => {
    if (canEnter) {
      const doubleEntry = entryMoves.find(m => m.isDoubleEntry);
      selectMove(doubleEntry || entryMoves[0]);
    }
  };

  const PLAYER_NAME_COLOR: Record<PlayerPosition, string> = {
    [PlayerPosition.A]: 'text-red-600',
    [PlayerPosition.B]: 'text-emerald-600',
    [PlayerPosition.C]: 'text-yellow-600',
    [PlayerPosition.D]: 'text-blue-600',
  };

  const pawnBox = (
    <div className="rounded-md border-2 border-stone-300 bg-white flex items-center justify-center shrink-0 w-[42px] h-[42px] md:w-[52px] md:h-[52px]">
      <img
        src={pawnImg}
        alt={position}
        className="w-7 h-7 md:w-9 md:h-9"
        style={{ objectFit: 'contain' }}
        draggable={false}
      />
    </div>
  );

  const diceBox = (
    <div className={`rounded-md border-2 ${diceBorder} flex items-center justify-center shrink-0 w-[52px] h-[52px] md:w-[64px] md:h-[64px] transition-all`}>
      {isTurn ? (
        <div className="scale-100 md:scale-110 transition-transform">
          <Dice position={position} />
        </div>
      ) : (
        <div className="w-[42px] h-[42px] md:w-[54px] md:h-[54px] rounded border border-dashed border-stone-200" />
      )}
    </div>
  );

  const nameEl = (
    <span className={`text-[10px] md:text-[11px] font-bold truncate max-w-[90px] ${isTurn ? PLAYER_NAME_COLOR[position] : 'text-stone-400'}`}>
      {player.name}
    </span>
  );

  const diceRow = (
    <div className="flex items-center gap-1" style={{ height: 'clamp(52px, 6vw, 64px)' }}>
      {diceOnLeft ? <>{diceBox}{pawnBox}</> : <>{pawnBox}{diceBox}</>}
    </div>
  );

  const outsideEl = (
    <div className="flex gap-1 items-center justify-center md:hidden min-h-[22px]"
      onClick={handleEntryClick}
      role={canEnter ? 'button' : undefined}
      style={{ cursor: canEnter ? 'pointer' : 'default' }}
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={`${i < outsidePawns.length ? '' : 'opacity-0 pointer-events-none'} ${i < outsidePawns.length && canEnter ? 'animate-[pawn-bounce_0.8s_ease-in-out_infinite]' : ''}`}
        >
          <img
            src={pawnImg}
            alt={`${position} outside pawn`}
            className="drop-shadow-sm"
            style={{ width: '20px', height: '20px', objectFit: 'contain' }}
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
  return (
    <div className="flex flex-col items-center gap-0.5">
      {isBottom ? outsideEl : nameEl}
      {diceRow}
      {isBottom ? nameEl : outsideEl}
    </div>
  );
}

export function LocalGame({ onExit }: LocalGameProps) {
  const { state } = useGame();
  const isGameOver = state.phase === GamePhase.GAME_OVER;
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const hasA = state.players.has(PlayerPosition.A);
  const hasB = state.players.has(PlayerPosition.B);
  const hasC = state.players.has(PlayerPosition.C);
  const hasD = state.players.has(PlayerPosition.D);

  return (
    <div className="fixed inset-0 bg-[#faf7f2] flex items-center justify-center overflow-hidden">
      {/* Game Over */}
      {isGameOver && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 w-[min(90vw,360px)] shadow-2xl border border-amber-200 animate-[win-appear_0.4s_ease-out]">
            <h2 className="text-2xl font-black text-center mb-1 text-stone-800 tracking-tight flex items-center justify-center gap-2">
              <Trophy className="text-amber-500" size={24} />
              Game Over!
            </h2>
            <p className="text-sm text-stone-400 text-center mb-5">Final Standings</p>

            <div className="space-y-2.5">
              {(state.rankings || []).map((pos, idx) => {
                const player = state.players.get(pos);
                if (!player) return null;
                const rank = idx + 1;
                const medalColors = ['#fbbf24', '#94a3b8', '#fb923c', 'transparent'];
                const medalColor = medalColors[Math.min(idx, 3)];
                const bgColors = [
                  'bg-gradient-to-r from-amber-100 to-amber-50 border-amber-300',
                  'bg-gradient-to-r from-slate-100 to-slate-50 border-slate-300',
                  'bg-gradient-to-r from-orange-100 to-orange-50 border-orange-300',
                  'bg-stone-50 border-stone-200',
                ];
                const playerColors: Record<string, string> = {
                  [PlayerPosition.A]: '#e74c3c',
                  [PlayerPosition.B]: '#2ecc71',
                  [PlayerPosition.C]: '#f1c40f',
                  [PlayerPosition.D]: '#3498db',
                };
                const rankLabels = ['1st', '2nd', '3rd', '4th'];

                return (
                  <div
                    key={pos}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${bgColors[Math.min(idx, 3)]} transition-all`}
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    <div className="w-8 flex justify-center">
                      {idx < 3 ? (
                        <Trophy size={20} style={{ color: medalColor }} className="drop-shadow-sm" />
                      ) : (
                        <span className="text-sm font-bold text-stone-400">{rank}</span>
                      )}
                    </div>
                    <div
                      className="w-5 h-5 rounded-full shrink-0 shadow-inner"
                      style={{ backgroundColor: playerColors[pos] }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-stone-800 text-sm truncate">{player.name}</p>
                    </div>
                    <span className={`text-xs font-black uppercase tracking-wider ${rank === 1 ? 'text-amber-600' : 'text-stone-400'}`}>
                      {rankLabels[Math.min(idx, 3)]}
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              className="mt-5 w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-95"
              onClick={onExit}
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* Leave Confirmation */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-5 w-[min(85vw,320px)] shadow-2xl border border-stone-200 animate-[win-appear_0.2s_ease-out]">
            <h3 className="text-lg font-black text-stone-800 text-center mb-1">Leave Game?</h3>
            <p className="text-sm text-stone-400 text-center mb-5">Your progress will be lost.</p>
            <div className="flex gap-3">
              <button
                className="flex-1 py-2.5 bg-stone-100 text-stone-600 rounded-xl font-bold text-sm hover:bg-stone-200 active:scale-95 transition-all"
                onClick={() => setShowLeaveConfirm(false)}
              >
                Continue
              </button>
              <button
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600 active:scale-95 transition-all"
                onClick={onExit}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exit */}
      <button
        className="absolute top-2 right-3 z-10 text-stone-300 hover:text-stone-500 active:scale-90 transition-all p-2"
        onClick={() => isGameOver ? onExit() : setShowLeaveConfirm(true)}
      >
        <X size={20} />
      </button>

      {/* ============ MOBILE (< md) ============ */}
      <div className="flex flex-col w-full h-full md:hidden items-center justify-center gap-1 px-1">
        {/* Top players: A (left) — arrow — D (right) */}
        <div className="flex items-center w-full px-1 shrink-0">
          {hasA ? <PlayerDice position={PlayerPosition.A} diceOnLeft /> : <div className="flex-1" />}
          <TurnArrow currentTurn={state.currentTurn} leftPlayer={PlayerPosition.A} rightPlayer={PlayerPosition.D} hasLeft={hasA} hasRight={hasD} />
          {hasD ? <PlayerDice position={PlayerPosition.D} /> : <div className="flex-1" />}
        </div>

        {/* Board — maximized, minimal padding */}
        <div className="w-full aspect-square shrink-0 p-1">
          <Board />
        </div>

        {/* Bottom players: B (left) — arrow — C (right) — mirrored layout */}
        <div className="flex items-center w-full px-1 shrink-0">
          {hasB ? <PlayerDice position={PlayerPosition.B} diceOnLeft isBottom /> : <div className="flex-1" />}
          <TurnArrow currentTurn={state.currentTurn} leftPlayer={PlayerPosition.B} rightPlayer={PlayerPosition.C} hasLeft={hasB} hasRight={hasC} />
          {hasC ? <PlayerDice position={PlayerPosition.C} isBottom /> : <div className="flex-1" />}
        </div>
      </div>

      {/* ============ DESKTOP (>= md) ============ */}
      <div className="hidden md:flex items-center justify-center w-full h-full">
        <div className="flex items-center gap-6">
          <div className="flex items-center shrink-0" style={{ minWidth: hasB ? undefined : 0 }}>
            {hasB && <PlayerDice position={PlayerPosition.B} diceOnLeft />}
          </div>

          <div className="flex flex-col items-center gap-6">
            <div className="h-12 flex items-center justify-center">
              {hasA && <PlayerDice position={PlayerPosition.A} />}
            </div>

            <div className="p-8">
              <div style={{ width: 'min(60vw, 60vh)', height: 'min(60vw, 60vh)' }}>
                <Board />
              </div>
            </div>

            <div className="h-12 flex items-center justify-center">
              {hasC && <PlayerDice position={PlayerPosition.C} />}
            </div>
          </div>

          <div className="flex items-center shrink-0" style={{ minWidth: hasD ? undefined : 0 }}>
            {hasD && <PlayerDice position={PlayerPosition.D} />}
          </div>
        </div>
      </div>
    </div>
  );
}
