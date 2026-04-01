// ============================================================================
// Asta Chamma — Fairness Logger (Production)
// ============================================================================
// Silent in production. No console output to prevent
// users from seeing dice weight internals in DevTools.

import type { PlayerPosition } from '@shared/types';

export type FairnessReason =
  | 'BASE'
  | 'ENTRY_BOOST'
  | 'SPAWN_LIMIT'
  | 'KILL_OPPORTUNITY'
  | 'ANTI_FRUSTRATION'
  | 'COMEBACK_BOOST'
  | 'NEAR_HOME_BOOST'
  | 'STRATEGY_ENABLER'
  | 'ANTI_PATTERN'
  | 'NOISE'
  | 'CLUSTERED_SPREAD';

interface LogEntry {
  playerId: PlayerPosition;
  originalWeights: Record<number, number>;
  adjustedWeights: Record<number, number>;
  reasons: FairnessReason[];
  result: number;
}

export const FairnessLogger = {
  logRoll(_entry: LogEntry): void {
    // No-op in production — prevents users from seeing dice weights in DevTools
  },

  trackEffect(
    _playerId: PlayerPosition,
    _roll: number,
    _effect: 'PROGRESS' | 'KILL' | 'BLOCKED' | 'OFFBOARD',
  ): void {
    // No-op in production
  },
};
