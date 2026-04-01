// Production FairnessLogger — No-op (silent)
// All diagnostic logging is disabled in production.
// The interface is preserved so engine code compiles without changes.

import type { PlayerPosition } from '../../shared/types.js';

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

export const FairnessLogger = {
  logRoll(_entry: {
    playerId: PlayerPosition;
    originalWeights: Record<number, number>;
    adjustedWeights: Record<number, number>;
    reasons: FairnessReason[];
    result: number;
  }): void {
    // No-op in production
  },

  trackEffect(
    _playerId: PlayerPosition,
    _roll: number,
    _effect: 'PROGRESS' | 'KILL' | 'BLOCKED' | 'OFFBOARD',
  ): void {
    // No-op in production
  },
};
