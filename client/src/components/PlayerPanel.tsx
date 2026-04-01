// ============================================================================
// Player Panel — Compact, positioned on each side of the board
// ============================================================================

import { type Player, PawnState, PlayerPosition } from '@shared/types';
import { useGame } from '../contexts/UnifiedGameContext';

interface PlayerPanelProps {
  player: Player;
  side: 'top' | 'bottom' | 'left' | 'right';
}

const DOT_BG: Record<PlayerPosition, string> = {
  [PlayerPosition.A]: 'bg-[var(--color-player-a)]',
  [PlayerPosition.B]: 'bg-[var(--color-player-b)]',
  [PlayerPosition.C]: 'bg-[var(--color-player-c)]',
  [PlayerPosition.D]: 'bg-[var(--color-player-d)]',
};

const BORDER: Record<PlayerPosition, string> = {
  [PlayerPosition.A]: 'border-[var(--color-player-a)]',
  [PlayerPosition.B]: 'border-[var(--color-player-b)]',
  [PlayerPosition.C]: 'border-[var(--color-player-c)]',
  [PlayerPosition.D]: 'border-[var(--color-player-d)]',
};

export function PlayerPanel({ player, side }: PlayerPanelProps) {
  const { state } = useGame();
  const isTurn = state.currentTurn === player.position;

  const homeCount = player.pawns.filter((p) => p.state === PawnState.HOME).length;

  // Layout direction based on side
  const isVertical = side === 'left' || side === 'right';

  return (
    <div
      className={`
        flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-200
        bg-white/80 backdrop-blur-sm shadow-sm
        ${isTurn ? `border-2 ${BORDER[player.position]} shadow-md` : 'border border-stone-200 opacity-60'}
        ${isVertical ? 'flex-col text-center' : ''}
      `}
    >
      {/* Color dot */}
      <div className={`w-3 h-3 rounded-full shrink-0 ${DOT_BG[player.position]} ${isTurn ? 'ring-2 ring-offset-1 ring-stone-300' : ''}`} />

      {/* Name */}
      <span className={`font-semibold text-xs text-stone-700 truncate ${isVertical ? 'max-w-[50px]' : 'max-w-[70px]'}`}>
        {player.name}
      </span>

      {/* Pawn dots */}
      <div className={`flex gap-0.5 ${isVertical ? '' : 'ml-auto'}`}>
        {player.pawns.map((pawn) => (
          <div
            key={pawn.id}
            className={`
              w-2.5 h-2.5 rounded-full
              ${DOT_BG[player.position]}
              ${pawn.state === PawnState.OUTSIDE ? 'opacity-20' : ''}
              ${pawn.state === PawnState.HOME ? 'ring-1 ring-stone-400' : ''}
            `}
          />
        ))}
      </div>

      {/* Lock status */}
      <span className="text-[10px]">{player.hasKilled ? '🔓' : '🔒'}</span>

      {/* Home count */}
      {homeCount > 0 && (
        <span className="text-[10px] font-bold text-stone-500">{homeCount}/4</span>
      )}
    </div>
  );
}
