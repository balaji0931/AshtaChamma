// ============================================================================
// Asta Chamma — Game Rule Validation (Pure Functions)
// ============================================================================
//
// All functions are pure — no side effects, no mutations.
// Used by both client engine and server-side validation.
//

import {
  type CellId,
  type PathIndex,
  type Pawn,
  type Player,
  type MoveAction,
  type GameConfig,
  type GameState,
  PlayerPosition,
  PawnState,
  GameMode,
  PlayStyle,
  EntryMode,
  InnerPathMode,
} from './types';

import {
  SAFE_CELLS,
  EXTRA_SAFE_CELLS,
  PLAYER_PATHS,
  ENTRY_CELLS,
  TRANSITION_INDEX,
  INNER_START_INDEX,
  HOME_INDEX,
  INNER_LOOP_LENGTH,
  ENTRY_VALUES,
  PAIR_HOP_VALUES,
  EVEN_DICE_VALUES,
  TEAMMATES,
  PAWNS_PER_PLAYER,
  MAX_EXTRA_TURNS,
} from './constants';

// ---------------------------------------------------------------------------
// Cell Queries
// ---------------------------------------------------------------------------

/** Check if a cell is a safe zone (entry point + optional inner diagonals) */
export function isSafeCell(cellId: CellId, extraSafeCells?: boolean): boolean {
  if (SAFE_CELLS.has(cellId)) return true;
  if (extraSafeCells && EXTRA_SAFE_CELLS.has(cellId)) return true;
  return false;
}

/** Get the board cell ID for a player's path index */
export function getCellAtIndex(player: PlayerPosition, index: PathIndex): CellId {
  return PLAYER_PATHS[player][index];
}

/** Check if a path index is on the outer path */
export function isOuterPath(index: PathIndex): boolean {
  return index >= 0 && index <= TRANSITION_INDEX;
}

/** Check if a path index is on the inner path (not HOME) */
export function isInnerPath(index: PathIndex): boolean {
  return index >= INNER_START_INDEX && index < HOME_INDEX;
}

// ---------------------------------------------------------------------------
// Dice Queries
// ---------------------------------------------------------------------------

/** Check if a dice value allows entering a new pawn on the board */
export function canEnterBoard(diceValue: number): boolean {
  return ENTRY_VALUES.has(diceValue);
}

/** Check if a dice roll grants an extra turn */
export function grantsExtraTurn(diceValue: number): boolean {
  return diceValue === 4 || diceValue === 8;
}

/** Check if a kill occurred (also grants an extra turn) */
export function killGrantsExtraTurn(): boolean {
  return true;
}

// ---------------------------------------------------------------------------
// Player Queries
// ---------------------------------------------------------------------------

/** Check if two players are on the same team */
export function areTeammates(
  a: PlayerPosition,
  b: PlayerPosition,
  playStyle: PlayStyle,
): boolean {
  if (playStyle !== PlayStyle.TEAM) return false;
  return TEAMMATES[a] === b;
}

/** Check if a player has all pawns HOME */
export function isPlayerFinished(player: Player): boolean {
  return player.pawns.every((p) => p.state === PawnState.HOME);
}

/** Check if the inner path is unlocked for a player */
export function isInnerPathUnlocked(
  player: Player,
  entryMode: EntryMode,
): boolean {
  if (entryMode === EntryMode.FREE) return true;
  return player.hasKilled;
}

// ---------------------------------------------------------------------------
// Pawn Queries on Board
// ---------------------------------------------------------------------------

/** Find all pawns (from any player) occupying a given cell on the board */
export function getPawnsAtCell(
  allPlayers: Map<PlayerPosition, Player> | Record<string, Player>,
  cellId: CellId,
): Pawn[] {
  const result: Pawn[] = [];
  const players = allPlayers instanceof Map
    ? Array.from(allPlayers.values())
    : Object.values(allPlayers);

  for (const player of players) {
    for (const pawn of player.pawns) {
      if (pawn.state === PawnState.OUTSIDE || pawn.state === PawnState.HOME) continue;
      const pawnCell = getCellAtIndex(pawn.playerId, pawn.pathIndex);
      if (pawnCell === cellId) {
        result.push(pawn);
      }
    }
  }
  return result;
}

/** Get opponent pawns at a specific cell (excluding own and teammates) */
export function getOpponentPawnsAtCell(
  allPlayers: Map<PlayerPosition, Player> | Record<string, Player>,
  cellId: CellId,
  playerId: PlayerPosition,
  playStyle: PlayStyle,
): Pawn[] {
  return getPawnsAtCell(allPlayers, cellId).filter((pawn) => {
    if (pawn.playerId === playerId) return false;
    if (areTeammates(pawn.playerId, playerId, playStyle)) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Pair Queries
// ---------------------------------------------------------------------------

/** Check if a pawn is part of a pair at its current cell */
export function isPawnPaired(
  pawn: Pawn,
  allPlayers: Map<PlayerPosition, Player> | Record<string, Player>,
): boolean {
  if (pawn.state === PawnState.OUTSIDE || pawn.state === PawnState.HOME) return false;
  const cellId = getCellAtIndex(pawn.playerId, pawn.pathIndex);

  // Pairs dissolve on safe cells
  if (isSafeCell(cellId)) return false;

  // Use the pawn's own isPaired flag (set by recalculatePairStatus in groups of 2)
  // This correctly handles 3+ pawns: only the first 2 are paired, the 3rd is single
  return pawn.isPaired;
}

/** Check if there is an opponent pair blocking a given cell */
export function isBlockedByPair(
  cellId: CellId,
  movingPlayerId: PlayerPosition,
  allPlayers: Map<PlayerPosition, Player> | Record<string, Player>,
  playStyle: PlayStyle,
): boolean {
  // No blocking on safe cells
  if (isSafeCell(cellId)) return false;

  const opponentPawns = getOpponentPawnsAtCell(
    allPlayers, cellId, movingPlayerId, playStyle,
  );

  // A blocking pair exists only if there are 2+ EXPLICITLY paired opponent pawns
  return opponentPawns.filter(p => p.isPaired).length >= 2;
}

// ---------------------------------------------------------------------------
// Move Validation
// ---------------------------------------------------------------------------

/**
 * Compute the target path index for a pawn given a dice value.
 * Returns -1 if the move is invalid (overshoots home, blocked, etc.)
 */
export function computeTargetIndex(
  pawn: Pawn,
  diceValue: number,
  player: Player,
  config: GameConfig,
  allPlayers: Map<PlayerPosition, Player> | Record<string, Player>,
): PathIndex {
  // --- Entry move ---
  if (pawn.state === PawnState.OUTSIDE) {
    if (canEnterBoard(diceValue)) {
      return 0; // Place at entry cell
    }
    return -1;
  }

  // --- Pair movement: halve the value ---
  const isPaired = config.gameMode === GameMode.PAIRS && isPawnPaired(pawn, allPlayers);
  let moveSteps = diceValue;

  if (isPaired) {
    if (!EVEN_DICE_VALUES.has(diceValue)) return -1; // Pairs can only move on even rolls
    moveSteps = Math.floor(diceValue / 2);
  }

  const currentIndex = pawn.pathIndex;

  // --- Inner path movement ---
  if (currentIndex >= INNER_START_INDEX) {
    const targetIndex = currentIndex + moveSteps;

    if (targetIndex === HOME_INDEX) {
      return HOME_INDEX; // Exact roll to home
    }

    if (targetIndex > HOME_INDEX) {
      if (config.innerPathMode === InnerPathMode.ROTATION) {
        // Continuous loop within inner cells (indices 16–23)
        // Skip index 24 (Home) unless it's an exact roll
        const newIndex = 16 + ((currentIndex - 16 + moveSteps) % INNER_LOOP_LENGTH);
        return newIndex;
      }
      // No-rotation: invalid move (overshoots home)
      return -1;
    }

    return targetIndex;
  }

  // --- Outer path movement ---
  let targetIndex = currentIndex + moveSteps;

  // Check if pawn crosses the transition point
  if (currentIndex <= TRANSITION_INDEX && targetIndex > TRANSITION_INDEX) {
    // Can we enter inner path?
    // Transition happens if:
    // 1. We have a kill (EntryMode.LOCKED) or it's Free Entry
    // 2. AND we have either already completed a lap OR this move is what completes the lap (targetIndex > 15)
    const canEnterInner = isInnerPathUnlocked(player, config.entryMode)
      && (pawn.completedOuterLoop || targetIndex > TRANSITION_INDEX);

    if (canEnterInner) {
      // Enter inner path: target goes past transition into inner indices
      return targetIndex; // Index naturally flows from outer (0–15) into inner (16–24)
    }

    // Not unlocked: loop back to start of outer path
    // Transition is at index 15, next cell is entry at index 0
    const outerLength = TRANSITION_INDEX + 1; // 16 cells
    targetIndex = targetIndex % outerLength;

    // Mark that pawn has completed at least one outer loop
    // (The actual state mutation happens in MoveExecutor, but we track it here for validation)
  }

  // Wrap around outer path if we've gone past transition without entering inner
  if (targetIndex > TRANSITION_INDEX && currentIndex <= TRANSITION_INDEX) {
    // Already handled above
  }

  return targetIndex;
}

/**
 * Check if a specific path has any blocking pairs the pawn must pass through.
 * Returns true if the move is blocked.
 */
export function isPathBlocked(
  pawn: Pawn,
  targetIndex: PathIndex,
  diceValue: number,
  config: GameConfig,
  allPlayers: Map<PlayerPosition, Player> | Record<string, Player>,
): boolean {
  if (config.gameMode !== GameMode.PAIRS) return false;
  if (pawn.state === PawnState.OUTSIDE) return false;

  // Pairs are NEVER blocked — they can pass through anything
  const movingIsPaired = isPawnPaired(pawn, allPlayers);
  if (movingIsPaired) return false;

  const canHop = PAIR_HOP_VALUES.has(diceValue);

  // 1. Check if pawn is currently STUCK on a cell with an opponent pair
  const currentCellId = PLAYER_PATHS[pawn.playerId][pawn.pathIndex];
  if (currentCellId !== undefined && !isSafeCell(currentCellId, config.extraSafeCells)) {
    if (isBlockedByPair(currentCellId, pawn.playerId, allPlayers, config.playStyle)) {
      // Stuck behind/with a pair — can only move with 4 or 8
      if (!canHop) return true;
    }
  }

  // 2. Check intermediate cells (NOT including target — can land on pair cell)
  const currentIndex = pawn.pathIndex;
  const playerPath = PLAYER_PATHS[pawn.playerId];
  const start = currentIndex + 1;
  const end = targetIndex - 1; // EXCLUDE target — landing on pair is allowed

  for (let i = start; i <= end; i++) {
    const idx = i <= HOME_INDEX ? i : INNER_START_INDEX + ((i - INNER_START_INDEX) % INNER_LOOP_LENGTH);
    if (idx >= 0 && idx < playerPath.length) {
      const cellId = playerPath[idx];
      if (isBlockedByPair(cellId, pawn.playerId, allPlayers, config.playStyle)) {
        if (!canHop) return true;
      }
    }
  }

  return false;
}

/**
 * Determine what happens when a pawn lands on a cell (kills, etc.)
 */
export function getKillTargets(
  landingCellId: CellId,
  movingPlayerId: PlayerPosition,
  movingPawnIsPaired: boolean,
  allPlayers: Map<PlayerPosition, Player> | Record<string, Player>,
  playStyle: PlayStyle,
  extraSafeCells?: boolean,
): string[] {
  // No kills on safe cells
  if (isSafeCell(landingCellId, extraSafeCells)) return [];

  const opponentPawns = getOpponentPawnsAtCell(
    allPlayers, landingCellId, movingPlayerId, playStyle,
  );
  if (opponentPawns.length === 0) return [];

  const killTargets: string[] = [];

  // Group by player, then separate paired vs unpaired within each group
  const byPlayer: Record<string, Pawn[]> = {};
  for (const p of opponentPawns) {
    if (!byPlayer[p.playerId]) byPlayer[p.playerId] = [];
    byPlayer[p.playerId].push(p);
  }

  for (const [, pawns] of Object.entries(byPlayer)) {
    const pairedPawns = pawns.filter(p => p.isPaired);
    const singlePawns = pawns.filter(p => !p.isPaired);

    if (movingPawnIsPaired) {
      // Pair kills only paired opponents (exactly the paired ones)
      if (pairedPawns.length >= 2) {
        // Kill one pair (first 2 paired pawns)
        killTargets.push(pairedPawns[0].id, pairedPawns[1].id);
      }
    } else {
      // Single kills only unpaired (single) opponents
      if (singlePawns.length > 0) {
        killTargets.push(...singlePawns.map(p => p.id));
      }
    }
  }

  return killTargets;
}

// ---------------------------------------------------------------------------
// Get All Valid Moves
// ---------------------------------------------------------------------------

/**
 * Compute all valid moves for a player given a dice result.
 * Returns an array of MoveAction objects.
 */
export function getValidMoves(
  player: Player,
  diceValue: number,
  config: GameConfig,
  allPlayers: Map<PlayerPosition, Player> | Record<string, Player>,
): MoveAction[] {
  const moves: MoveAction[] = [];

  for (const pawn of player.pawns) {
    if (pawn.state === PawnState.HOME) continue;

    // --- Entry move ---
    if (pawn.state === PawnState.OUTSIDE) {
      if (canEnterBoard(diceValue)) {
        // Special Rule: Dice roll of 8 (Ashta) 
        if (diceValue === 8) {
          const outsidePawns = player.pawns.filter(p => p.state === PawnState.OUTSIDE);
          
          // Case 1: 2+ pawns outside -> Double Entry at index 0
          if (outsidePawns.length >= 2) {
            // Only add this move ONCE for the first valid outside pawn encountered
            if (pawn.id === outsidePawns[0].id) {
              const entryCellId = ENTRY_CELLS[player.position];
              // Simplified: ignore pair blocking for double entry as it creates a pair itself 
              // (usually allowed in Ashta Chamma to break a single block)
              moves.push({
                pawnId: pawn.id,
                pawnIds: [outsidePawns[0].id, outsidePawns[1].id],
                targetPathIndex: 0,
                isEntry: true,
                isDoubleEntry: true,
                willKill: false,
                killTargets: [],
              });
            }
          } 
          // Case 2: Only 1 pawn outside -> Single Entry and move 4 cells (target index 4)
          else if (outsidePawns.length === 1) {
            moves.push({
              pawnId: pawn.id,
              targetPathIndex: 4, // 0 + 4 bonus
              isEntry: true,
              willKill: false,
              killTargets: [],
            });
          }
        } else {
          // Regular entry move for 4 (or other entry values if changed)
          const entryCellId = ENTRY_CELLS[player.position];
          if (config.gameMode === GameMode.PAIRS) {
            if (isBlockedByPair(entryCellId, player.position, allPlayers, config.playStyle)) {
              continue; // Entry is blocked
            }
          }

          moves.push({
            pawnId: pawn.id,
            targetPathIndex: 0,
            isEntry: true,
            willKill: false, // Safe cell — no kills
            killTargets: [],
          });
        }
      }
      continue;
    }

    // --- Regular move ---
    const isPaired = config.gameMode === GameMode.PAIRS && isPawnPaired(pawn, allPlayers);
    const cellId = getCellAtIndex(pawn.playerId, pawn.pathIndex);
    const pawnsAtCell = getPawnsAtCell(allPlayers, cellId).filter(p => p.playerId === pawn.playerId);
    
    // Check if we have multiple pawns on a safe cell (Pairing Choice)
    const isEvenRoll = diceValue % 2 === 0;
    const isChoosingOnSafeCell = config.gameMode === GameMode.PAIRS && isSafeCell(cellId, config.extraSafeCells) && pawnsAtCell.length >= 2 && isEvenRoll;

    // 1. If currently paired (not on safe cell), you MUST move as a pair
    if (isPaired) {
      if (isEvenRoll) {
        // computeTargetIndex already halves the dice for paired pawns,
        // so we pass the FULL diceValue here — no manual halving!
        const targetIndex = computeTargetIndex(pawn, diceValue, player, config, allPlayers);
        if (targetIndex !== -1 && targetIndex !== pawn.pathIndex) {
          if (!isPathBlocked(pawn, targetIndex, diceValue, config, allPlayers)) {
            const targetCellId = targetIndex === HOME_INDEX ? -1 : getCellAtIndex(pawn.playerId, targetIndex);
            let killTargets: string[] = [];
            if (targetIndex !== HOME_INDEX && targetCellId !== -1) {
              killTargets = getKillTargets(targetCellId, player.position, true, allPlayers, config.playStyle, config.extraSafeCells);
            }
            
            // Only add the pair move once (for first pawn in group)
            // A pair is exactly 2 pawns, not all pawns at the cell
            if (pawn.id === pawnsAtCell[0].id) {
              moves.push({
                pawnId: pawn.id,
                pawnIds: [pawnsAtCell[0].id, pawnsAtCell[1].id],
                targetPathIndex: targetIndex,
                isEntry: false,
                isPairMove: true,
                willKill: killTargets.length > 0,
                killTargets,
              });
            }
          }
        }
      }
      continue; // Paired pawns cannot move individually outside safe cells
    }

    // 2. Individual Move (Always allowed except for paired pawns above)
    const targetIndex = computeTargetIndex(pawn, diceValue, player, config, allPlayers);
    if (targetIndex !== -1 && targetIndex !== pawn.pathIndex) {
      if (!isPathBlocked(pawn, targetIndex, diceValue, config, allPlayers)) {
        const targetCellId = targetIndex === HOME_INDEX ? -1 : getCellAtIndex(pawn.playerId, targetIndex);
        let killTargets: string[] = [];
        if (targetIndex !== HOME_INDEX && targetCellId !== -1) {
          killTargets = getKillTargets(targetCellId, player.position, false, allPlayers, config.playStyle, config.extraSafeCells);
        }
        
        moves.push({
          pawnId: pawn.id,
          targetPathIndex: targetIndex,
          isEntry: false,
          willKill: killTargets.length > 0,
          killTargets,
        });
      }
    }

    // 3. Optional Pair Move (On safe cell — only generate ONE pair move per cell)
    if (isChoosingOnSafeCell && pawn.id === pawnsAtCell[0].id) {
      // Manually halve because isPawnPaired returns false on safe cells,
      // so computeTargetIndex won't halve for us.
      const pairMoveSteps = Math.floor(diceValue / 2);
      const pairTargetIndex = computeTargetIndex(pawn, pairMoveSteps, player, config, allPlayers);
      
      if (pairTargetIndex !== -1 && pairTargetIndex !== pawn.pathIndex) {
        if (!isPathBlocked(pawn, pairTargetIndex, diceValue, config, allPlayers)) {
          const targetCellId = pairTargetIndex === HOME_INDEX ? -1 : getCellAtIndex(pawn.playerId, pairTargetIndex);
          let killTargets: string[] = [];
          if (pairTargetIndex !== HOME_INDEX && targetCellId !== -1) {
            killTargets = getKillTargets(targetCellId, player.position, true, allPlayers, config.playStyle, config.extraSafeCells);
          }
          
          // A pair is exactly 2 pawns
          moves.push({
            pawnId: pawn.id,
            pawnIds: [pawnsAtCell[0].id, pawnsAtCell[1].id],
            targetPathIndex: pairTargetIndex,
            isEntry: false,
            isPairMove: true,
            willKill: killTargets.length > 0,
            killTargets,
          });
        }
      }
    }
  }

  return moves;
}

// ---------------------------------------------------------------------------
// Win Condition
// ---------------------------------------------------------------------------

/** Check if a player (or their team) has won */
export function checkWinCondition(
  playerId: PlayerPosition,
  allPlayers: Map<PlayerPosition, Player> | Record<string, Player>,
  playStyle: PlayStyle,
): boolean {
  const getPlayer = (pos: PlayerPosition): Player | undefined => {
    return allPlayers instanceof Map
      ? allPlayers.get(pos)
      : allPlayers[pos];
  };

  const player = getPlayer(playerId);
  if (!player) return false;

  if (playStyle === PlayStyle.NORMAL) {
    return isPlayerFinished(player);
  }

  // Team mode: both teammates must finish
  const teammate = getPlayer(TEAMMATES[playerId]);
  if (!teammate) return false;
  return isPlayerFinished(player) && isPlayerFinished(teammate);
}

// ---------------------------------------------------------------------------
// Turn Advancement
// ---------------------------------------------------------------------------

/** Get the next player in turn order */
export function getNextPlayer(
  currentPlayer: PlayerPosition,
  activePositions: PlayerPosition[],
  allPlayers: Map<PlayerPosition, Player> | Record<string, Player>,
  playStyle: PlayStyle,
): PlayerPosition {
  const getPlayer = (pos: PlayerPosition): Player | undefined => {
    return allPlayers instanceof Map
      ? allPlayers.get(pos)
      : allPlayers[pos];
  };

  const currentIdx = activePositions.indexOf(currentPlayer);
  const total = activePositions.length;

  for (let offset = 1; offset <= total; offset++) {
    const nextPos = activePositions[(currentIdx + offset) % total];
    const nextPlayer = getPlayer(nextPos);
    if (!nextPlayer) continue;

    // Skip finished players in normal mode (they're done)
    // In team mode, finished players still play for teammates
    if (playStyle === PlayStyle.NORMAL && isPlayerFinished(nextPlayer)) {
      continue;
    }

    // In team mode, skip if the finished player's teammate is also finished
    if (playStyle === PlayStyle.TEAM && isPlayerFinished(nextPlayer)) {
      const teammate = getPlayer(TEAMMATES[nextPos]);
      if (teammate && isPlayerFinished(teammate)) {
        continue; // Both finished — skip entirely
      }
    }

    return nextPos;
  }

  // Shouldn't reach here during normal gameplay
  return currentPlayer;
}

/** Determines whose pawns the current player controls */
export function getControlledPlayer(
  currentPlayer: PlayerPosition,
  allPlayers: Map<PlayerPosition, Player> | Record<string, Player>,
  playStyle: PlayStyle,
): PlayerPosition {
  const getPlayer = (pos: PlayerPosition): Player | undefined => {
    return allPlayers instanceof Map
      ? allPlayers.get(pos)
      : allPlayers[pos];
  };

  const player = getPlayer(currentPlayer);
  if (!player) return currentPlayer;

  // If player is finished and in team mode, control teammate's pawns
  if (playStyle === PlayStyle.TEAM && isPlayerFinished(player)) {
    const teammatePos = TEAMMATES[currentPlayer];
    const teammate = getPlayer(teammatePos);
    if (teammate && !isPlayerFinished(teammate)) {
      return teammatePos;
    }
  }

  return currentPlayer;
}

// ---------------------------------------------------------------------------
// Fairness Engine Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate a player's performance score for the 'isBehind' check.
 * Formula: (home * 100) + (totalPathProgress * 5) + (activePawns * 10)
 */
export function calculatePlayerScore(player: Player): number {
  const homeCount = player.pawns.filter(p => p.state === PawnState.HOME).length;
  const activeCount = player.pawns.filter(p => p.state !== PawnState.OUTSIDE && p.state !== PawnState.HOME).length;

  const totalProgress = player.pawns.reduce((sum, p) => {
    // Only count progress for on-board pawns
    if (p.state === PawnState.OUTSIDE || p.state === PawnState.HOME) return sum;
    return sum + p.pathIndex;
  }, 0);

  return (homeCount * 100) + (totalProgress * 5) + (activeCount * 10);
}

/**
 * Extra context for the Dice Fairness Engine.
 */
export interface PlayerContext {
  canKill: boolean;
  killNumbers: number[];
  hasMeaningfulMoves: boolean;
  nearHomeIndices: number[]; // Path indices of pawns near home (distance <= 3)
  isBehind: boolean;
  activePawnCount: number;
  isClustered: boolean;
}

/**
 * Determine if a move is 'meaningful' (v1.2 spec).
 * Meaningful = progress toward home, creates kill, or escapes danger.
 */
export function isMoveMeaningful(
  move: MoveAction,
  pawn: Pawn,
  player: Player,
  allPlayers: Map<PlayerPosition, Player> | Record<string, Player>,
): boolean {
  // 1. Entry is always meaningful
  if (move.isEntry) return true;

  // 2. Kill is always meaningful
  if (move.willKill) return true;

  // 3. Progressing toward home (reaching inner path or home)
  if (move.targetPathIndex === HOME_INDEX) return true;
  if (pawn.state === PawnState.ACTIVE_OUTER && move.targetPathIndex >= INNER_START_INDEX) return true;

  // 4. Escaping danger (from unsafe to safe, or further from enemy)
  const currentCellId = getCellAtIndex(player.position, pawn.pathIndex);
  const targetCellId = getCellAtIndex(player.position, move.targetPathIndex);
  const wasSafe = isSafeCell(currentCellId);
  const isSafeNow = isSafeCell(targetCellId);
  if (!wasSafe && isSafeNow) return true;

  // 5. General progress (moving at least 4 cells)
  if (move.targetPathIndex > pawn.pathIndex + 3) return true;

  return false;
}

/**
 * Extract context for the fairness engine.
 */
export function getPlayerContext(
  player: Player,
  gameState: GameState,
): PlayerContext {
  const { players, config } = gameState;
  const gamePlayers = players;

  const killNumbers: Set<number> = new Set();
  const nearHomeIndices: number[] = [];
  let hasMeaningfulMoves = false;

  // Analyze every possible dice outcome (1, 2, 3, 4, 8)
  const outcomes = [1, 2, 3, 4, 8];
  for (const val of outcomes) {
    const validMoves = getValidMoves(player, val, config, gamePlayers);
    for (const move of validMoves) {
      const pawn = player.pawns.find(p => p.id === move.pawnId)!;
      if (isMoveMeaningful(move, pawn, player, gamePlayers)) {
        hasMeaningfulMoves = true;
      }
      if (move.willKill) {
        killNumbers.add(val);
      }
    }
  }

  // Active pieces & Near Home check
  for (const pawn of player.pawns) {
    if (pawn.state === PawnState.ACTIVE_INNER) {
      const dist = HOME_INDEX - pawn.pathIndex;
      if (dist > 0 && dist <= 3) {
        nearHomeIndices.push(pawn.pathIndex);
      }
    }
  }

  // Score comparison
  const gamePlayersList = Array.from(gamePlayers.values()) as Player[];
  const scores = gamePlayersList.map(p => calculatePlayerScore(p));
  const myScore = calculatePlayerScore(player);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  // Behind if score is 20% lower than average or at least 40 points behind
  const isBehind = myScore < avgScore * 0.8 || myScore < avgScore - 40;

  // Clustering check
  const activePathIndices = player.pawns
    .filter(p => p.state === PawnState.ACTIVE_OUTER || p.state === PawnState.ACTIVE_INNER)
    .map(p => p.pathIndex);

  let isClustered = false;
  if (activePathIndices.length >= 2) {
    for (let i = 0; i < activePathIndices.length; i++) {
      for (let j = i + 1; j < activePathIndices.length; j++) {
        if (Math.abs(activePathIndices[i] - activePathIndices[j]) <= 2) {
          isClustered = true;
          break;
        }
      }
    }
  }

  return {
    canKill: killNumbers.size > 0,
    killNumbers: Array.from(killNumbers),
    hasMeaningfulMoves,
    nearHomeIndices,
    isBehind,
    activePawnCount: player.pawns.filter(p => p.state !== PawnState.OUTSIDE && p.state !== PawnState.HOME).length,
    isClustered,
  };
}
