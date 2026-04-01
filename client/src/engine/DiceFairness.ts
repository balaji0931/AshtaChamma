// ============================================================================
// Asta Chamma — Fairness Engine
// ============================================================================
// Gentle anti-frustration system. Provides small probability nudges to reduce
// bad-luck streaks and keep games fun, without making outcomes predictable.
//
// Design principles:
// - Boosts are SMALL (2–4% per factor), not decisive
// - Total adjustment is budget-capped at maxTotalAdjustment (default 25%)
// - Each individual value capped at ±maxBoostPerNumber (default 15%)
// - Random noise added to prevent predictability
// - Near-winning players get REDUCED help (clutch reduction)

import {
  type Player,
  type GameState,
} from '@shared/types';

import {
  getPlayerContext,
} from '@shared/rules';

import { type FairnessReason } from './FairnessLogger';

/**
 * Weighted Random Selection — picks a value based on probability weights
 */
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

/**
 * The Core Fairness Engine: Adjusts weights based on game context.
 *
 * Base weights: { 1: 20, 2: 20, 3: 20, 4: 25, 8: 15 }
 * These already slightly favor 4 (entry/extra turn) over 8.
 *
 * Each boost below is intentionally small (2–4 points on a 100-point scale).
 * Multiple boosts can stack but are budget-capped.
 */
export function computeFairnessWeights(
  player: Player,
  state: GameState
): { weights: Record<number, number>; reasons: FairnessReason[] } {
  const config = state.config.diceConfig;
  const context = getPlayerContext(player, state);
  const reasons: FairnessReason[] = ['BASE'];

  // Start with base weights (copy)
  const weights: Record<number, number> = { ...config.baseWeights };

  // ── 1. ENTRY BOOST ──
  // When player has <2 pawns on board, gently favor entry values (4, 8)
  // Impact: +3% on value 4, +2% on value 8
  if (context.activePawnCount < 2) {
    weights[4] += 3;
    weights[8] += 2;
    reasons.push('ENTRY_BOOST');
  }

  // ── 2. SPAWN LIMITER ──
  // When player has 3+ pawns, slightly reduce entry values
  // Impact: -2% on value 4, -1% on value 8
  if (context.activePawnCount >= 3) {
    weights[4] -= 2;
    weights[8] -= 1;
    reasons.push('SPAWN_LIMIT');
  }

  // ── 3. KILL OPPORTUNITY ──
  // If a kill is possible, gentle boost toward the needed number
  // Impact: +3% on the exact kill number
  if (context.canKill) {
    for (const killNum of context.killNumbers) {
      weights[killNum] += 3;
    }
    reasons.push('KILL_OPPORTUNITY');
  }

  // ── 4. ANTI-FRUSTRATION ──
  // After 3+ "bad" rolls (no useful moves), boost entry/extra-turn values
  // Impact: +4% on value 4, +2% on value 8
  if (player.badRollStreak >= 3) {
    weights[4] += 4;
    weights[8] += 2;
    reasons.push('ANTI_FRUSTRATION');
  }

  // ── 5. COMEBACK BOOST ──
  // If player is behind (fewer pawns home), tiny nudge
  // Impact: +2% on value 4, +1% on value 8
  if (context.isBehind) {
    weights[4] += 2;
    weights[8] += 1;
    reasons.push('COMEBACK_BOOST');
  }

  // ── 6. NEAR HOME BOOST ──
  // When a pawn is 1–3 steps from home, boost the exact finishing number
  // Impact: +3% on the exact roll needed
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

  // ── 7. RANDOM NOISE ──
  // Small jitter (±1%) to prevent predictability
  for (const n of [1, 2, 3, 4, 8]) {
    weights[n] += (Math.random() * 2 - 1);
  }
  reasons.push('NOISE');

  // ── 8. ANTI-PATTERN ──
  // Reduce probability of rolling the same value 3x in a row
  // Impact: -4% on the repeated value
  if (player.lastRolls.length >= 2) {
    const lastResult = player.lastRolls[player.lastRolls.length - 1];
    const secondLast = player.lastRolls[player.lastRolls.length - 2];
    if (lastResult === secondLast) {
      weights[lastResult] -= 4;
      reasons.push('ANTI_PATTERN');
    }
  }

  // ── 9. CLUTCH REDUCTION ──
  // When very close to winning (1–2 steps from home), reduce ALL boosts by 50%
  // This keeps end-game tense and skill-dependent
  const isCappingHome = context.nearHomeIndices.some(idx => (24 - idx) <= 2);
  const clutchReduction = isCappingHome ? 0.5 : 1.0;
  if (isCappingHome) reasons.push('STRATEGY_ENABLER');

  // ── 10. BUDGET CAP & NORMALIZE ──
  // Ensure total adjustments don't exceed the budget
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
    // Hard clamp per-value
    weights[n] = Math.max(base - config.maxBoostPerNumber, Math.min(base + config.maxBoostPerNumber, weights[n]));
  }

  // Normalize to sum to 100
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  for (const n of [1, 2, 3, 4, 8]) {
    weights[n] = (weights[n] / sum) * 100;
  }

  return { weights, reasons };
}
