// Server-side DiceEngine — identical logic to client, different imports.

import type { DiceResult } from '../../shared/types.js';
import { DICE_VALUES, EXTRA_TURN_WHITES } from '../../shared/constants.js';
import { selectWeightedValue } from './DiceFairness.js';

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

function findWhitesForValue(value: number): number {
  for (let w = 0; w <= 4; w++) {
    if (DICE_VALUES[w] === value) return w;
  }
  return 1;
}

export function createDiceResult(whites: number): DiceResult {
  if (whites < 0 || whites > 4) {
    throw new Error(`Invalid white count: ${whites}. Must be 0–4.`);
  }

  const patterns: Record<number, boolean[]> = {
    0: [false, false, false, false],
    1: [true, false, false, false],
    2: [true, true, false, false],
    3: [true, true, true, false],
    4: [true, true, true, true],
  };

  const seeds = patterns[whites] as [boolean, boolean, boolean, boolean];
  const value = DICE_VALUES[whites];
  const grantsExtraTurn = EXTRA_TURN_WHITES.has(whites);

  return { seeds, whites, value, grantsExtraTurn, timestamp: Date.now() };
}
