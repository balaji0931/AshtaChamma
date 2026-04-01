// ============================================================================
// Online Game — Same UI as LocalGame, powered by OnlineGameContext
// ============================================================================

import { useState } from 'react';
import {
  type PlayerPosition,
  type SerializableGameState,
  GamePhase,
  PawnState,
  PlayerPosition as PP,
} from '@shared/types';
import { useOnlineGame, OnlineGameProvider } from '../contexts/OnlineGameContext';
import { useGame } from '../contexts/UnifiedGameContext';
import { useSocket } from '../contexts/SocketContext';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { TimerBar } from '../components/TimerBar';
import { Board } from '../components/Board';
import { Dice } from '../components/Dice';
import { useTheme, type PawnStyle } from '../contexts/ThemeContext';
import { Trophy, X, AlertTriangle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Reuse exact same pawn images, colors, components as LocalGame
// ---------------------------------------------------------------------------

const PAWN_IMAGES: Record<PawnStyle, Record<PlayerPosition, string>> = {
  ludo: {
    [PP.A]: '/assets/pawns/ludo_red.png',
    [PP.B]: '/assets/pawns/ludo_green.png',
    [PP.C]: '/assets/pawns/ludo_yellow.png',
    [PP.D]: '/assets/pawns/ludo_blue.png',
  },
  checkers: {
    [PP.A]: '/assets/pawns/checker_red.png',
    [PP.B]: '/assets/pawns/checker_green.png',
    [PP.C]: '/assets/pawns/checker_yellow.png',
    [PP.D]: '/assets/pawns/checker_blue.png',
  },
  rural: {
    [PP.A]: '/assets/pawns/rural_stone.png',
    [PP.B]: '/assets/pawns/rural_stick.png',
    [PP.C]: '/assets/pawns/rural_seed.png',
    [PP.D]: '/assets/pawns/rural_nut.png',
  },
};

const PLAYER_BORDER: Record<PlayerPosition, string> = {
  [PP.A]: 'border-red-400',
  [PP.B]: 'border-emerald-400',
  [PP.C]: 'border-yellow-400',
  [PP.D]: 'border-blue-400',
};

const ARROW_COLORS: Record<PlayerPosition, string> = {
  [PP.A]: '#dc2626',
  [PP.B]: '#059669',
  [PP.C]: '#ca8a04',
  [PP.D]: '#2563eb',
};

const PLAYER_NAME_COLOR: Record<PlayerPosition, string> = {
  [PP.A]: 'text-red-600',
  [PP.B]: 'text-emerald-600',
  [PP.C]: 'text-yellow-600',
  [PP.D]: 'text-blue-600',
};

/** Map visual slots (Top, Left, Bottom, Right) to player positions based on viewer position */
function getPositionAtSlot(slot: 'top' | 'bottom' | 'left' | 'right', myPos: PlayerPosition): PlayerPosition {
  const players: PlayerPosition[] = [PP.A, PP.D, PP.C, PP.B]; // Clockwise from Top
  const myIdx = players.indexOf(myPos);
  if (myIdx === -1) return myPos;

  switch (slot) {
    case 'bottom': return myPos;
    case 'top': return players[(myIdx + 2) % 4];
    case 'left': return players[(myIdx + 3) % 4];
    case 'right': return players[(myIdx + 1) % 4];
    default: return myPos;
  }
}

/** Animated arrow between two players */
function TurnArrow({ currentTurn, leftPlayer, rightPlayer, hasLeft, hasRight }: {
  currentTurn: PlayerPosition;
  leftPlayer: PlayerPosition;
  rightPlayer: PlayerPosition;
  hasLeft: boolean;
  hasRight: boolean;
}) {
  const isLeftTurn = currentTurn === leftPlayer && hasLeft;
  const isRightTurn = currentTurn === rightPlayer && hasRight;
  if (!isLeftTurn && !isRightTurn) return <div className="flex-1" />;
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

/** Full PlayerDice — same as LocalGame but with optional (You) badge */
function PlayerDice({ position, diceOnLeft = false, isBottom = false, isMe = false }: {
  position: PlayerPosition;
  diceOnLeft?: boolean;
  isBottom?: boolean;
  isMe?: boolean;
}) {
  const { state, selectMove, isAnimating, isMyTurn } = useGame();
  const { pawnStyle } = useTheme();
  const player = state.players.get(position);
  if (!player) return null;

  const isTurn = state.currentTurn === position;
  const pawnImg = PAWN_IMAGES[pawnStyle][position];
  const diceBorder = isTurn ? PLAYER_BORDER[position] : 'border-stone-200';
  const outsidePawns = player.pawns.filter(p => p.state === PawnState.OUTSIDE);

  const entryMoves = !isAnimating && state.phase === 'WAITING_FOR_MOVE'
    ? state.validMoves.filter((m) => m.isEntry && player.pawns.some((p) => p.id === m.pawnId))
    : [];
  const canEnter = entryMoves.length > 0;

  const handleEntryClick = () => {
    if (isMe && isMyTurn && canEnter) {
      const doubleEntry = entryMoves.find(m => m.isDoubleEntry);
      selectMove(doubleEntry || entryMoves[0]);
    }
  };

  const pawnBox = (
    <div className="rounded-md border-2 border-stone-300 bg-white flex items-center justify-center shrink-0 w-[42px] h-[42px] md:w-[52px] md:h-[52px]">
      <img src={pawnImg} alt={position} className="w-7 h-7 md:w-9 md:h-9" style={{ objectFit: 'contain' }} draggable={false} />
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
      {isMe && <span className="ml-1 text-[8px] opacity-60">(You)</span>}
      {!player.isConnected && <AlertTriangle size={10} className="text-red-400 ml-1 inline" />}
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
      role={canEnter && isMe && isMyTurn ? 'button' : undefined}
      style={{ cursor: canEnter && isMe && isMyTurn ? 'pointer' : 'default' }}
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={`relative flex items-center justify-center ${i < outsidePawns.length ? '' : 'opacity-0 pointer-events-none'} ${i < outsidePawns.length && canEnter && isMe && isMyTurn ? 'animate-[pawn-bounce_0.8s_ease-in-out_infinite]' : ''}`}
        >
          {/* Rotating Entry Circular Indicator */}
          {i < outsidePawns.length && canEnter && isMe && isMyTurn && (
            <div
              className="absolute inset-0 scale-150 animate-rotate-slow rounded-full border-2 border-dashed opacity-40 pointer-events-none"
              style={{ borderColor: ARROW_COLORS[position] }}
            />
          )}
          <img
            src={pawnImg}
            alt={`${position} outside pawn`}
            className="relative z-10 drop-shadow-sm"
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

// ---------------------------------------------------------------------------
// Online Game Inner — Same layout as LocalGame + Connection/Timer
// ---------------------------------------------------------------------------

function OnlineGameInner({ onExit }: { onExit: () => void }) {
  const { state, timer, myPosition, isMyTurn } = useOnlineGame();
  const isGameOver = state.phase === GamePhase.GAME_OVER;
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const hasA = state.players.has(PP.A);
  const hasB = state.players.has(PP.B);
  const hasC = state.players.has(PP.C);
  const hasD = state.players.has(PP.D);

  const playerColors: Record<string, string> = {
    [PP.A]: '#e74c3c',
    [PP.B]: '#2ecc71',
    [PP.C]: '#f1c40f',
    [PP.D]: '#3498db',
  };

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
                const medalColors = ['#fbbf24', '#94a3b8', '#fb923c', '#cbd5e1'];
                const medalColor = medalColors[Math.min(idx, 3)];
                const bgColors = [
                  'bg-gradient-to-r from-amber-100 to-amber-50 border-amber-300',
                  'bg-gradient-to-r from-slate-100 to-slate-50 border-slate-300',
                  'bg-gradient-to-r from-orange-100 to-orange-50 border-orange-300',
                  'bg-stone-50 border-stone-200',
                ];
                const rankLabels = ['1st', '2nd', '3rd', '4th'];
                const pColor = playerColors[pos] || '#94a3b8';
                return (
                  <div
                    key={`${pos}-${idx}`}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${bgColors[Math.min(idx, 3)] || 'bg-stone-50 border-stone-200'} transition-all`}
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
                      style={{ backgroundColor: pColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-stone-800 text-sm truncate">{player.name}</p>
                    </div>
                    <span className={`text-xs font-black uppercase tracking-wider ${rank === 1 ? 'text-amber-600' : 'text-stone-400'}`}>
                      {rankLabels[Math.min(idx, 3)] || `${rank}th`}
                    </span>
                  </div>
                );
              })}
            </div>
            <button
              className="mt-5 w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-95"
              onClick={onExit}
            >
              Back to Menu
            </button>
          </div>
        </div>
      )}

      {/* Leave Confirmation */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-5 w-[min(85vw,320px)] shadow-2xl border border-stone-200 animate-[win-appear_0.2s_ease-out]">
            <h3 className="text-lg font-black text-stone-800 text-center mb-1">Leave Game?</h3>
            <p className="text-sm text-stone-400 text-center mb-5">You'll be disconnected from this room.</p>
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

      {/* Connection + Exit */}
      <div className="absolute top-2 left-3 z-10">
        <ConnectionStatus />
      </div>
      <button
        className="absolute top-2 right-3 z-10 text-stone-300 hover:text-stone-500 active:scale-90 transition-all p-2"
        onClick={() => isGameOver ? onExit() : setShowLeaveConfirm(true)}
      >
        <X size={20} />
      </button>

      {/* Timer */}
      <div className="absolute top-8 left-0 right-0 z-10">
        <TimerBar timer={timer} isMyTurn={isMyTurn} />
      </div>

      {/* ============ MOBILE (< md) ============ */}
      <div className="flex flex-col w-full h-full md:hidden items-center justify-center gap-1 px-1 pt-10">
        {/* Top players: Opposite (left) — arrow — Right (right) */}
        {(() => {
          const oppositePos = getPositionAtSlot('top', myPosition);
          const rightPos = getPositionAtSlot('right', myPosition);
          const leftPos = getPositionAtSlot('left', myPosition);
          const myPos = myPosition;

          return (
            <>
              <div className="flex items-center w-full px-1 shrink-0">
                {state.players.has(leftPos) ? <PlayerDice position={leftPos} diceOnLeft isMe={myPosition === leftPos} /> : <div className="flex-1" />}
                <TurnArrow currentTurn={state.currentTurn} leftPlayer={leftPos} rightPlayer={oppositePos} hasLeft={state.players.has(leftPos)} hasRight={state.players.has(oppositePos)} />
                {state.players.has(oppositePos) ? <PlayerDice position={oppositePos} isMe={myPosition === oppositePos} /> : <div className="flex-1" />}
              </div>

              {/* Board */}
              <div className="w-full aspect-square shrink-0 p-1">
                <Board />
              </div>

              {/* Bottom players: Viewer (left) — arrow — Right (right) */}
              <div className="flex items-center w-full px-1 shrink-0">
                {state.players.has(myPos) ? <PlayerDice position={myPos} diceOnLeft isBottom isMe={true} /> : <div className="flex-1" />}
                <TurnArrow currentTurn={state.currentTurn} leftPlayer={myPos} rightPlayer={rightPos} hasLeft={state.players.has(myPos)} hasRight={state.players.has(rightPos)} />
                {state.players.has(rightPos) ? <PlayerDice position={rightPos} isBottom isMe={myPosition === rightPos} /> : <div className="flex-1" />}
              </div>
            </>
          );
        })()}
      </div>

      {/* ============ DESKTOP (>= md) ============ */}
      <div className="hidden md:flex items-center justify-center w-full h-full pt-10">
        {(() => {
          const myPos = myPosition;
          const leftPos = getPositionAtSlot('left', myPosition);
          const oppositePos = getPositionAtSlot('top', myPosition);
          const rightPos = getPositionAtSlot('right', myPosition);

          return (
            <div className="flex items-center gap-6">
              <div className="flex items-center shrink-0" style={{ minWidth: state.players.has(leftPos) ? undefined : 0 }}>
                {state.players.has(leftPos) && <PlayerDice position={leftPos} diceOnLeft isMe={myPosition === leftPos} />}
              </div>

              <div className="flex flex-col items-center gap-6">
                <div className="h-12 flex items-center justify-center">
                  {state.players.has(oppositePos) && <PlayerDice position={oppositePos} isMe={myPosition === oppositePos} />}
                </div>
                <div className="p-8">
                  <div style={{ width: 'min(60vw, 60vh)', height: 'min(60vw, 60vh)' }}>
                    <Board />
                  </div>
                </div>
                <div className="h-12 flex items-center justify-center">
                  {state.players.has(myPos) && <PlayerDice position={myPos} isMe={true} />}
                </div>
              </div>

              <div className="flex items-center shrink-0" style={{ minWidth: state.players.has(rightPos) ? undefined : 0 }}>
                {state.players.has(rightPos) && <PlayerDice position={rightPos} isMe={myPosition === rightPos} />}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wrapper that provides OnlineGameContext
// ---------------------------------------------------------------------------

interface OnlineGameProps {
  initialState: SerializableGameState;
  myPosition: PlayerPosition;
  onExit: () => void;
}

export function OnlineGame({ initialState, myPosition, onExit }: OnlineGameProps) {
  return (
    <OnlineGameProvider initialState={initialState} myPosition={myPosition}>
      <OnlineGameInner onExit={onExit} />
    </OnlineGameProvider>
  );
}
