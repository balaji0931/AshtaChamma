// ============================================================================
// Checkers Pawn — Uses PNG images
// ============================================================================

import { type Pawn as PawnType, PlayerPosition } from '@shared/types';
import { useTheme } from '../../contexts/ThemeContext';

const IMAGES: Record<PlayerPosition, string> = {
  [PlayerPosition.A]: '/assets/pawns/checker_red.png',
  [PlayerPosition.B]: '/assets/pawns/checker_green.png',
  [PlayerPosition.C]: '/assets/pawns/checker_yellow.png',
  [PlayerPosition.D]: '/assets/pawns/checker_blue.png',
};

interface CheckersPawnProps {
  pawn: PawnType;
  isMovable: boolean;
  scale?: number;
  onClick: () => void;
}

export function CheckersPawn({ pawn, isMovable, scale = 1, onClick }: CheckersPawnProps) {
  const { boardTheme } = useTheme();
  const showGlow = boardTheme === 'slate' || boardTheme === 'wood';

  return (
    <div
      className={`relative ${isMovable ? 'cursor-pointer' : ''} transition-transform`}
      style={{ transform: scale !== 1 ? `scale(${scale})` : undefined }}
      onClick={isMovable ? onClick : undefined}
      role={isMovable ? 'button' : undefined}
      tabIndex={isMovable ? 0 : undefined}
    >
      {showGlow && (
        <div className="absolute inset-x-0 top-0.5 bottom-0.5 bg-white/40 blur-md rounded-full pointer-events-none" />
      )}

      {/* Movable Rotating Indicator — Alternating White/Black dashes */}
      {isMovable && (
        <div className="absolute inset-x-0 bottom-[-2px] flex items-end justify-center pointer-events-none z-0 h-full">
          <div className="w-[115%] aspect-square animate-rotate-fast flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              {/* Black segments */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="black"
                strokeWidth="10"
                strokeDasharray="8 8"
                strokeOpacity="0.8"
              />
              {/* White segments (offset) */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="white"
                strokeWidth="10"
                strokeDasharray="8 8"
                strokeDashoffset="8"
                strokeOpacity="0.9"
              />
            </svg>
          </div>
        </div>
      )}

      <img
        src={IMAGES[pawn.playerId]}
        alt={`${pawn.playerId} checker`}
        className={`relative z-10 drop-shadow-md ${isMovable ? 'hover:scale-110' : ''} transition-transform`}
        style={{ width: 'clamp(28px, 5.5vw, 50px)', height: 'clamp(24px, 5vw, 44px)', objectFit: 'contain' }}
        draggable={false}
      />
    </div>
  );
}
