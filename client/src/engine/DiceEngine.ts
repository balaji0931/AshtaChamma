// ============================================================================
// Asta Chamma — Dice Engine
// ============================================================================
//
// Simulates rolling 4 tamarind seeds, each with a white and black side.
//

import type { DiceResult } from '@shared/types';
import { DICE_VALUES, EXTRA_TURN_WHITES } from '@shared/constants';
import { selectWeightedValue } from './DiceFairness';

/**
 * Roll 4 tamarind seeds and compute the dice result.
 * If weights are provided, picks the value first.
 */
export function rollDice(weights?: Record<number, number>): DiceResult {
  if (weights) {
    const value = selectWeightedValue(weights);
    const res = createDiceResult(findWhitesForValue(value));
    res.timestamp = Date.now();
    return res;
  }

  const seeds: [boolean, boolean, boolean, boolean] = [
    Math.random() < 0.5,
    Math.random() < 0.5,
    Math.random() < 0.5,
    Math.random() < 0.5,
  ];

  const whites = seeds.filter(Boolean).length;
  const value = DICE_VALUES[whites];
  const grantsExtraTurn = EXTRA_TURN_WHITES.has(whites);

  return { seeds, whites, value, grantsExtraTurn, timestamp: Date.now() };
}

/**
 * Determine how many white faces are needed to get a specific dice value.
 */
function findWhitesForValue(value: number): number {
  for (let w = 0; w <= 4; w++) {
    if (DICE_VALUES[w] === value) return w;
  }
  return 1; // Fallback
}

/**
 * Create a DiceResult from a predetermined white count.
 * Uses a deterministic seed pattern for visual consistency.
 */
export function createDiceResult(whites: number): DiceResult {
  if (whites < 0 || whites > 4) {
    throw new Error(`Invalid white count: ${whites}. Must be 0–4.`);
  }

  // Deterministic seed mapping for visual consistency
  const patterns: Record<number, boolean[]> = {
    0: [false, false, false, false], // Value 8 (0 white)
    1: [true, false, false, false],  // Value 1 (1 white)
    2: [true, true, false, false],   // Value 2 (2 white)
    3: [true, true, true, false],    // Value 3 (3 white)
    4: [true, true, true, true],     // Value 4 (4 white)
  };

  const seeds = patterns[whites] as [boolean, boolean, boolean, boolean];
  const value = DICE_VALUES[whites];
  const grantsExtraTurn = EXTRA_TURN_WHITES.has(whites);

  return { seeds, whites, value, grantsExtraTurn, timestamp: Date.now() };
}
