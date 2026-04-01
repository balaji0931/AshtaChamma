// ============================================================================
// Pawn Wrapper — Selects pawn style based on theme
// ============================================================================

import { type Pawn as PawnType, PawnState } from '@shared/types';
import { useTheme } from '../contexts/ThemeContext';
import { LudoPawn } from './pawns/LudoPawn';
import { CheckersPawn } from './pawns/CheckersPawn';
import { RuralPawn } from './pawns/RuralPawn';

interface PawnProps {
  pawn: PawnType;
  isMovable: boolean;
  scale?: number;
  stackIndex?: number;
  isCombined?: boolean;
  onClick: () => void;
}

export function Pawn({ pawn, isMovable, scale = 1, stackIndex = 0, isCombined = false, onClick }: PawnProps) {
  // Note: Board.tsx handles filtering OUTSIDE pawns. If a pawn reaches here,
  // it's either active, HOME (in center), or being animated during entry.

  const { pawnStyle } = useTheme();

  // When combined (stacked), overlap each subsequent pawn by 50% of its own width
  // transform: translateX is relative to the element itself, so this works at any size
  const wrapperStyle: React.CSSProperties = isCombined && stackIndex > 0
    ? { transform: `translateX(${-50 * stackIndex}%)`, zIndex: stackIndex }
    : {};

  const inner = (() => {
    switch (pawnStyle) {
      case 'ludo':
        return <LudoPawn pawn={pawn} isMovable={isMovable} scale={scale} onClick={onClick} />;
      case 'checkers':
        return <CheckersPawn pawn={pawn} isMovable={isMovable} scale={scale} onClick={onClick} />;
      case 'rural':
      default:
        return <RuralPawn pawn={pawn} isMovable={isMovable} scale={scale} onClick={onClick} />;
    }
  })();

  return <div style={wrapperStyle}>{inner}</div>;
}
