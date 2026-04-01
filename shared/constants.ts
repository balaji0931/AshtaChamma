// ============================================================================
// Asta Chamma — Board Constants & Player Paths
// ============================================================================

import { PlayerPosition, type CellId, type PathIndex } from './types';

// ---------------------------------------------------------------------------
// Board Dimensions
// ---------------------------------------------------------------------------

export const BOARD_SIZE = 5;
export const TOTAL_CELLS = 25;
export const HOME_CELL: CellId = 12; // Center cell (2,2)
export const PAWNS_PER_PLAYER = 4;
export const MAX_EXTRA_TURNS = 3;

// ---------------------------------------------------------------------------
// Safe Cells (Entry Points)
// ---------------------------------------------------------------------------

/** Entry/safe cell for each player position */
export const ENTRY_CELLS: Record<PlayerPosition, CellId> = {
  [PlayerPosition.A]: 2,  // (0,2) Top
  [PlayerPosition.B]: 10, // (2,0) Left
  [PlayerPosition.C]: 22, // (4,2) Bottom
  [PlayerPosition.D]: 14, // (2,4) Right
};

/** Set of all safe cell IDs for O(1) lookup */
export const SAFE_CELLS: ReadonlySet<CellId> = new Set([2, 10, 14, 22]);

/** Extra safe cells on inner diagonals: (1,1), (1,3), (3,1), (3,3) in 0-based */
export const EXTRA_SAFE_CELLS: ReadonlySet<CellId> = new Set([6, 8, 16, 18]);

// ---------------------------------------------------------------------------
// Cell Grid Mapping: CellId → (row, col) and (row, col) → CellId
// ---------------------------------------------------------------------------

export function cellToGrid(cellId: CellId): [number, number] {
  return [Math.floor(cellId / BOARD_SIZE), cellId % BOARD_SIZE];
}

export function gridToCell(row: number, col: number): CellId {
  return row * BOARD_SIZE + col;
}

// ---------------------------------------------------------------------------
// Player Paths (25 positions each: 0=entry, 15=transition, 24=HOME)
// ---------------------------------------------------------------------------
// Each array maps PathIndex (0–24) → CellId on the board.
// Indices 0–15: outer path (16 cells, perimeter)
// Indices 16–23: inner path (8 cells, spiral)
// Index 24: HOME (center, cell 12)

export const PLAYER_PATHS: Record<PlayerPosition, readonly CellId[]> = {
  [PlayerPosition.A]: [
    // Outer path (0–15)
     2,  1,  0,  5, 10, 15, 20, 21, 22, 23, 24, 19, 14,  9,  4,  3,
    // Inner spiral (16–23) + HOME (24)
     8, 13, 18, 17, 16, 11,  6,  7, 12,
  ],
  [PlayerPosition.B]: [
    // Outer path (0–15)
    10, 15, 20, 21, 22, 23, 24, 19, 14,  9,  4,  3,  2,  1,  0,  5,
    // Inner spiral (16–23) + HOME (24)
     6,  7,  8, 13, 18, 17, 16, 11, 12,
  ],
  [PlayerPosition.C]: [
    // Outer path (0–15)
    22, 23, 24, 19, 14,  9,  4,  3,  2,  1,  0,  5, 10, 15, 20, 21,
    // Inner spiral (16–23) + HOME (24)
    16, 11,  6,  7,  8, 13, 18, 17, 12,
  ],
  [PlayerPosition.D]: [
    // Outer path (0–15)
    14,  9,  4,  3,  2,  1,  0,  5, 10, 15, 20, 21, 22, 23, 24, 19,
    // Inner spiral (16–23) + HOME (24)
    18, 17, 16, 11,  6,  7,  8, 13, 12,
  ],
};

/** Index of the last outer path cell (transition point to inner) */
export const TRANSITION_INDEX: PathIndex = 15;

/** First inner path index */
export const INNER_START_INDEX: PathIndex = 16;

/** HOME index (last position on path) */
export const HOME_INDEX: PathIndex = 24;

/** Number of cells in the inner rotation loop (indices 16–23) */
export const INNER_LOOP_LENGTH = 8;

// ---------------------------------------------------------------------------
// Dice Constants
// ---------------------------------------------------------------------------

/** Maps white-side count (0–4) to movement value */
export const DICE_VALUES: Record<number, number> = {
  0: 8,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
};

/** White counts that grant an extra turn */
export const EXTRA_TURN_WHITES: ReadonlySet<number> = new Set([0, 4]);

/** Dice values that allow board entry */
export const ENTRY_VALUES: ReadonlySet<number> = new Set([4, 8]);

/** Dice values that allow hopping over a pair block */
export const PAIR_HOP_VALUES: ReadonlySet<number> = new Set([4, 8]);

/** Even dice values (valid for pair movement) */
export const EVEN_DICE_VALUES: ReadonlySet<number> = new Set([2, 4, 8]);

// ---------------------------------------------------------------------------
// Team Mappings
// ---------------------------------------------------------------------------

/** In team mode, maps a player to their teammate */
export const TEAMMATES: Record<PlayerPosition, PlayerPosition> = {
  [PlayerPosition.A]: PlayerPosition.C,
  [PlayerPosition.B]: PlayerPosition.D,
  [PlayerPosition.C]: PlayerPosition.A,
  [PlayerPosition.D]: PlayerPosition.B,
};

// ---------------------------------------------------------------------------
// Default Active Positions By Player Count
// ---------------------------------------------------------------------------

export const DEFAULT_POSITIONS: Record<2 | 3 | 4, PlayerPosition[]> = {
  2: [PlayerPosition.A, PlayerPosition.C], // Opposite sides
  3: [PlayerPosition.A, PlayerPosition.B, PlayerPosition.C],
  4: [PlayerPosition.A, PlayerPosition.B, PlayerPosition.C, PlayerPosition.D],
};
