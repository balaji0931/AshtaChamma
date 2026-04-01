// Server-side DiceFairness — identical logic, server imports.

import {
  type Player,
  type GameState,
} from '../../shared/types.js';

import {
  getPlayerContext,
} from '../../shared/rules.js';

import { type FairnessReason } from './FairnessLogger.js';

export function selectWeightedValue(weights: Record<number, number>): number {
  const r = Math.random() * 100;
  let sum = 0;
  const values = Object.keys(weights).map(Number).sort((a, b) => a - b);

  for (const val of values) {
    sum += weights[val];
    if (r <= sum) return val;
  }
  return values[values.length - 1];
}

function getValidNeighbors(value: number): number[] {
  const all = [1, 2, 3, 4, 8];
  const idx = all.indexOf(value);
  const neighbors: number[] = [];
  if (idx > 0) neighbors.push(all[idx - 1]);
  if (idx < all.length - 1) neighbors.push(all[idx + 1]);
  return neighbors;
}

export function computeFairnessWeights(
  player: Player,
  state: GameState,
): { weights: Record<number, number>; reasons: FairnessReason[] } {
  const config = state.config.diceConfig;
  const context = getPlayerContext(player, state);
  const reasons: FairnessReason[] = ['BASE'];

  const weights: Record<number, number> = { ...config.baseWeights };

  // Entry boost: only a small nudge when player has few pawns on board
  if (context.activePawnCount < 2) {
    weights[4] += 1;
    weights[8] += 0.5;
    reasons.push('ENTRY_BOOST');
  }

  // Reduce spawn values slightly when player already has many pawns
  if (context.activePawnCount >= 3) {
    weights[4] -= 1;
    weights[8] -= 0.5;
    reasons.push('SPAWN_LIMIT');
  }

  // Kill opportunity: slight boost toward the exact number needed
  if (context.canKill) {
    for (const killNum of context.killNumbers) {
      weights[killNum] += 2;
    }
    reasons.push('KILL_OPPORTUNITY');
  }

  // Anti-frustration: gentle boost after 3+ bad rolls (not dramatic)
  if (player.badRollStreak >= 3) {
    weights[4] += 2;
    weights[8] += 1;
    reasons.push('ANTI_FRUSTRATION');
  }

  // Comeback: tiny nudge for players behind
  if (context.isBehind) {
    weights[4] += 1;
    weights[8] += 0.5;
    reasons.push('COMEBACK_BOOST');
  }

  // Near home: small boost for exact finish roll
  if (context.nearHomeIndices.length > 0) {
    for (const idx of context.nearHomeIndices) {
      const dist = 24 - idx;
      const rollValue = dist;
      if (weights[rollValue] !== undefined) {
        weights[rollValue] += 3;
      }
    }
    reasons.push('NEAR_HOME_BOOST');
  }

  // Random noise: small jitter to prevent predictability
  for (const n of [1, 2, 3, 4, 8]) {
    weights[n] += (Math.random() * 2 - 1);
  }
  reasons.push('NOISE');

  // Anti-pattern: reduce probability of rolling the same number 3x in a row
  if (player.lastRolls.length >= 2) {
    const lastResult = player.lastRolls[player.lastRolls.length - 1];
    const secondLast = player.lastRolls[player.lastRolls.length - 2];
    if (lastResult === secondLast) {
      weights[lastResult] -= 4;
      reasons.push('ANTI_PATTERN');
    }
  }

  const isCappingHome = context.nearHomeIndices.some(idx => (24 - idx) <= 2);
  const clutchReduction = isCappingHome ? 0.5 : 1.0;
  if (isCappingHome) reasons.push('STRATEGY_ENABLER');

  let totalAdjustment = 0;
  for (const n of [1, 2, 3, 4, 8]) {
    const delta = Math.abs(weights[n] - config.baseWeights[n]);
    totalAdjustment += delta;
  }

  const budgetScale = totalAdjustment > config.maxTotalAdjustment
    ? (config.maxTotalAdjustment / totalAdjustment)
    : 1.0;

  const finalScale = budgetScale * clutchReduction;

  for (const n of [1, 2, 3, 4, 8]) {
    const base = config.baseWeights[n];
    const originalDelta = weights[n] - base;
    const finalDelta = originalDelta * finalScale;
    weights[n] = base + finalDelta;
    weights[n] = Math.max(base - config.maxBoostPerNumber, Math.min(base + config.maxBoostPerNumber, weights[n]));
  }

  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  for (const n of [1, 2, 3, 4, 8]) {
    weights[n] = (weights[n] / sum) * 100;
  }

  return { weights, reasons };
}
