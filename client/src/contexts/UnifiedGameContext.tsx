// ============================================================================
// Unified Game Hook — Works with both Local and Online game contexts
// ============================================================================
// This adapter allows Board, Cell, Pawn, and Dice components to work
// unchanged in both local and online modes.

import { createContext, useContext, type ReactNode } from 'react';
import type { GameState, MoveAction, DiceResult, PlayerPosition } from '@shared/types';

// ---------------------------------------------------------------------------
// Animation types (shared between both contexts)
// ---------------------------------------------------------------------------

export interface AnimatingPawn {
  pawnIds: string[];
  playerId: PlayerPosition;
  currentCellId: number;
}

export interface UnifiedGameContextValue {
  state: GameState;
  roll: () => DiceResult | null | void;
  selectMove: (move: MoveAction) => void;
  animatingPawn: AnimatingPawn | null;
  killedAnimatingPawn: AnimatingPawn | null;
  isAnimating: boolean;
  /** The position of the local player (online mode) */
  myPosition?: PlayerPosition;
  /** Whether it is currently the local player's turn to act */
  isMyTurn?: boolean;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export const UnifiedGameContext = createContext<UnifiedGameContextValue | null>(null);

export function useGame(): UnifiedGameContextValue {
  const ctx = useContext(UnifiedGameContext);
  if (!ctx) throw new Error('useGame must be used within a GameProvider or OnlineGameProvider');
  return ctx;
}

// Provider wrapper (used by both GameProvider and OnlineGameProvider)
export function UnifiedGameProvider({
  value,
  children,
}: {
  value: UnifiedGameContextValue;
  children: ReactNode;
}) {
  return (
    <UnifiedGameContext.Provider value={value}>
      {children}
    </UnifiedGameContext.Provider>
  );
}
