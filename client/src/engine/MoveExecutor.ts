// ============================================================================
// Asta Chamma — Move Executor
// ============================================================================
//
// Applies moves to game state (immutable — returns new state).
// All validation should be done via shared/rules.ts BEFORE calling these.
//

import {
  type GameState,
  type MoveAction,
  type Player,
  type Pawn,
  type DiceResult,
  PlayerPosition,
  PawnState,
  GameMode,
  GamePhase,
} from '@shared/types';

import {
  TRANSITION_INDEX,
  INNER_START_INDEX,
  HOME_INDEX,
  ENTRY_CELLS,
  SAFE_CELLS,
  EXTRA_SAFE_CELLS,
  MAX_EXTRA_TURNS,
} from '@shared/constants';

import {
  getValidMoves,
  checkWinCondition,
  getNextPlayer,
  getControlledPlayer,
  grantsExtraTurn,
  isPlayerFinished,
  getCellAtIndex,
  isPawnPaired,
  isMoveMeaningful,
} from '@shared/rules';

// ---------------------------------------------------------------------------
// Helpers — Immutable State Updates
// ---------------------------------------------------------------------------

function clonePlayer(player: Player): Player {
  return {
    ...player,
    pawns: player.pawns.map((p) => ({ ...p })),
  };
}

function clonePlayers(players: Map<PlayerPosition, Player>): Map<PlayerPosition, Player> {
  const cloned = new Map<PlayerPosition, Player>();
  for (const [pos, player] of players) {
    cloned.set(pos, clonePlayer(player));
  }
  return cloned;
}

function updatePawnInPlayer(player: Player, pawnId: string, updates: Partial<Pawn>): Player {
  return {
    ...player,
    pawns: player.pawns.map((p) =>
      p.id === pawnId ? { ...p, ...updates } : { ...p },
    ),
  };
}

// ---------------------------------------------------------------------------
// Entry Move
// ---------------------------------------------------------------------------

function executeEntryMove(
  state: GameState,
  move: MoveAction,
  controlledPosition: PlayerPosition,
): GameState {
  const players = clonePlayers(state.players);
  const player = players.get(controlledPosition)!;

  const pIds = move.pawnIds && move.pawnIds.length > 0 ? move.pawnIds : [move.pawnId];
  let updatedPlayer = player;

  for (const id of pIds) {
    updatedPlayer = updatePawnInPlayer(updatedPlayer, id, {
      state: PawnState.ACTIVE_OUTER,
      pathIndex: move.targetPathIndex,
      completedOuterLoop: false,
      isPaired: move.isDoubleEntry ?? false,
    });
  }

  players.set(controlledPosition, updatedPlayer);

  return { ...state, players };
}

// ---------------------------------------------------------------------------
// Regular Move
// ---------------------------------------------------------------------------

function executeRegularMove(
  state: GameState,
  move: MoveAction,
  controlledPosition: PlayerPosition,
): GameState {
  const players = clonePlayers(state.players);
  const player = players.get(controlledPosition)!;
  const pawn = player.pawns.find((p) => p.id === move.pawnId)!;

  // Determine new pawn state
  let newState = pawn.state;
  let completedLoop = pawn.completedOuterLoop;

  if (move.targetPathIndex === HOME_INDEX) {
    newState = PawnState.HOME;
  } else if (move.targetPathIndex >= INNER_START_INDEX) {
    newState = PawnState.ACTIVE_INNER;
  } else {
    newState = PawnState.ACTIVE_OUTER;

    // Check if pawn completed a full outer loop or entered inner path
    // A loop is considered complete when the pawn reaches the transition cell (15) 
    // or enters the inner path (16+).
    if (move.targetPathIndex >= TRANSITION_INDEX) {
      completedLoop = true;
    }
    // Also handle wrapping if the above doesn't catch it (though it should)
    if (pawn.pathIndex > move.targetPathIndex && pawn.pathIndex <= TRANSITION_INDEX) {
      completedLoop = true;
    }
  }

  // Update the moving pawn(s)
  const movingPawnIds = move.isPairMove && move.pawnIds ? move.pawnIds : [move.pawnId];
  let updatedPlayer = player;

  for (const pid of movingPawnIds) {
    updatedPlayer = updatePawnInPlayer(updatedPlayer, pid, {
      state: newState,
      pathIndex: move.targetPathIndex,
      completedOuterLoop: completedLoop,
      // Pair status: true if this is an explicit pair move, false if going HOME
      // For single moves, preserve whatever the pawn's current paired status is
      // (it will be dissolved by recalculatePairStatus if landing on safe cell)
      isPaired: newState === PawnState.HOME ? false : (move.isPairMove ?? false),
    });
  }

  players.set(controlledPosition, updatedPlayer);

  // --- Handle kills ---
  if (move.willKill && move.killTargets.length > 0) {
    for (const killTargetId of move.killTargets) {
      // Find which player owns this pawn
      for (const [pos, p] of players) {
        const targetPawn = p.pawns.find((pw) => pw.id === killTargetId);
        if (targetPawn) {
          const updatedOwner = updatePawnInPlayer(p, killTargetId, {
            state: PawnState.OUTSIDE,
            pathIndex: -1,
            completedOuterLoop: false,
            isPaired: false,
          });
          players.set(pos, updatedOwner);
          break;
        }
      }
    }

    // Mark the player who made the move as having killed
    const killingPlayer = players.get(controlledPosition)!;
    players.set(controlledPosition, { ...killingPlayer, hasKilled: true });
  }

  // --- Check for pair formation/dissolution (Pairs mode) ---
  if (state.config.gameMode === GameMode.PAIRS && newState !== PawnState.HOME) {
    recalculatePairStatus(players, state.config.extraSafeCells);
  }

  // --- Update finished status ---
  for (const [pos, p] of players) {
    if (isPlayerFinished(p) && !p.isFinished) {
      players.set(pos, { ...p, isFinished: true });
    }
  }

  return { ...state, players };
}

// ---------------------------------------------------------------------------
// Pair Status Recalculation
// ---------------------------------------------------------------------------

/**
 * Dissolve pairs on safe cells. Never creates pairs — pairing is
 * an explicit player choice made on safe cells.
 */
function recalculatePairStatus(players: Map<PlayerPosition, Player>, extraSafeCells?: boolean): void {
  for (const [pos, player] of players) {
    let changed = false;
    const updatedPawns = player.pawns.map((pawn) => {
      if (!pawn.isPaired) return pawn;
      if (pawn.state === PawnState.OUTSIDE || pawn.state === PawnState.HOME) {
        changed = true;
        return { ...pawn, isPaired: false };
      }
      const cellId = getCellAtIndex(pawn.playerId, pawn.pathIndex);
      // Pairs dissolve on safe cells (including extra safe cells if enabled)
      if (SAFE_CELLS.has(cellId) || (extraSafeCells && EXTRA_SAFE_CELLS.has(cellId))) {
        changed = true;
        return { ...pawn, isPaired: false };
      }
      return pawn; // Stay paired
    });

    if (changed) {
      players.set(pos, { ...player, pawns: updatedPawns });
    }
  }
}

// ---------------------------------------------------------------------------
// Full Move Execution Pipeline
// ---------------------------------------------------------------------------

/**
 * Execute a move and advance game state.
 * Returns the new GameState after the move, including turn advancement.
 */
export function executeMove(
  state: GameState,
  move: MoveAction,
): GameState {
  const controlledPosition = getControlledPlayer(
    state.currentTurn,
    state.players,
    state.config.playStyle,
  );

  const player = state.players.get(controlledPosition)!;
  const movingPawn = player.pawns.find(p => p.id === move.pawnId)!;
  const wasMeaningful = isMoveMeaningful(move, movingPawn, player, state.players);

  // Update history & streak
  const updatedPlayerStore = clonePlayers(state.players);
  const pRecord = updatedPlayerStore.get(controlledPosition)!;
  
  if (wasMeaningful) {
    pRecord.badRollStreak = 0;
  }
  
  if (state.lastDiceResult) {
    pRecord.lastRolls = [...pRecord.lastRolls, state.lastDiceResult.value].slice(-5);
  }
  
  // Apply the move (cloning players again inside executeEntryMove/executeRegularMove is redundant 
  // but we'll stick to the existing structure for safety)
  let newState = move.isEntry
    ? executeEntryMove(state, move, controlledPosition)
    : executeRegularMove(state, move, controlledPosition);
    
  // Merge our updated fairness fields back into the result of the move
  const posPlayer = newState.players.get(controlledPosition)!;
  newState.players.set(controlledPosition, {
    ...posPlayer,
    badRollStreak: pRecord.badRollStreak,
    lastRolls: pRecord.lastRolls
  });

  // Check if current player just finished (all pawns HOME)
  const rankings = [...(state.rankings || [])];
  const controlledPlayerState = newState.players.get(controlledPosition)!;
  
  if (isPlayerFinished(controlledPlayerState) && !controlledPlayerState.isFinished) {
    // This player just finished — assign rank
    const rank = rankings.length + 1;
    rankings.push(controlledPosition);
    const updatedP = { ...controlledPlayerState, isFinished: true, finishRank: rank };
    newState.players.set(controlledPosition, updatedP);
  }

  // Also check the turn player (for team mode)
  if (state.currentTurn !== controlledPosition) {
    const turnPlayerState = newState.players.get(state.currentTurn)!;
    if (isPlayerFinished(turnPlayerState) && !turnPlayerState.isFinished) {
      const rank = rankings.length + 1;
      rankings.push(state.currentTurn);
      const updatedTP = { ...turnPlayerState, isFinished: true, finishRank: rank };
      newState.players.set(state.currentTurn, updatedTP);
    }
  }

  // Count how many players are still playing
  const activePlayers = state.config.activePositions.filter(pos => {
    const p = newState.players.get(pos);
    return p && !p.isFinished;
  });

  // Game ends when only 1 (or 0) players remain
  if (activePlayers.length <= 1) {
    // Assign last place to remaining player
    if (activePlayers.length === 1) {
      const lastPos = activePlayers[0];
      const lastPlayer = newState.players.get(lastPos)!;
      const lastRank = rankings.length + 1;
      rankings.push(lastPos);
      newState.players.set(lastPos, { ...lastPlayer, finishRank: lastRank });
    }
    
    return {
      ...newState,
      phase: GamePhase.GAME_OVER,
      winner: rankings[0], // 1st place
      rankings,
      validMoves: [],
    };
  }

  // Determine if player gets an extra turn
  const diceGrantsExtra = state.lastDiceResult
    ? grantsExtraTurn(state.lastDiceResult.value)
    : false;
  const killGrantsExtra = move.willKill;
  // Don't grant extra turns to players who just finished
  const playerJustFinished = newState.players.get(controlledPosition)!.isFinished;
  const getsExtraTurn = (diceGrantsExtra || killGrantsExtra)
    && newState.extraTurnCount < MAX_EXTRA_TURNS
    && !playerJustFinished;

  if (getsExtraTurn) {
    // Extra turn — same player rolls again
    newState = {
      ...newState,
      rankings,
      phase: GamePhase.WAITING_FOR_ROLL,
      extraTurnCount: newState.extraTurnCount + 1,
      validMoves: [],
      turnNumber: newState.turnNumber + 1,
    };
  } else {
    // Advance to next player
    const nextPlayer = getNextPlayer(
      state.currentTurn,
      state.config.activePositions,
      newState.players,
      state.config.playStyle,
    );

    newState = {
      ...newState,
      rankings,
      phase: GamePhase.WAITING_FOR_ROLL,
      currentTurn: nextPlayer,
      extraTurnCount: 0,
      validMoves: [],
      lastDiceResult: null,
      turnNumber: newState.turnNumber + 1,
    };
  }

  // Final recalculation of pair status for all pawns on the board
  recalculatePairStatus(newState.players, newState.config.extraSafeCells);

  return newState;
}

/**
 * Advance the turn when a player has no valid moves or skips.
 * Handles extra turn logic (if rolled 4 or 8).
 */
export function skipTurn(state: GameState): GameState {
  if (!state.lastDiceResult) return state;

  const diceResult = state.lastDiceResult;
  const diceGrantsExtra = grantsExtraTurn(diceResult.value);
  const getsExtraTurn = diceGrantsExtra && state.extraTurnCount < MAX_EXTRA_TURNS;

  if (getsExtraTurn) {
    // Skipped move but still gets extra turn (rolled 4/8)
    return {
      ...state,
      phase: GamePhase.WAITING_FOR_ROLL,
      extraTurnCount: state.extraTurnCount + 1,
      validMoves: [],
    };
  }

  // No extra turn — pass to next player
  const nextPlayer = getNextPlayer(
    state.currentTurn,
    state.config.activePositions,
    state.players,
    state.config.playStyle,
  );

  const players = clonePlayers(state.players);
  const pRecord = players.get(state.currentTurn)!;
  pRecord.badRollStreak += 1;
  pRecord.lastRolls = [...pRecord.lastRolls, diceResult.value].slice(-5);

  return {
    ...state,
    players,
    phase: GamePhase.WAITING_FOR_ROLL,
    currentTurn: nextPlayer,
    lastDiceResult: null,
    extraTurnCount: 0,
    validMoves: [],
    turnNumber: state.turnNumber + 1,
  };
}

/**
 * Apply a dice roll to the game state.
 * Computes valid moves and transitions to WAITING_FOR_MOVE or handles no-move skip.
 */
export function applyDiceRoll(
  state: GameState,
  diceResult: DiceResult,
): GameState {
  const controlledPosition = getControlledPlayer(
    state.currentTurn,
    state.players,
    state.config.playStyle,
  );

  const controlledPlayer = state.players.get(controlledPosition)!;

  const validMoves = getValidMoves(
    controlledPlayer,
    diceResult.value,
    state.config,
    state.players,
  );

  if (validMoves.length === 0) {
    // No valid moves — stay in move phase but with empty moves list
    // This allows the UI to show the dice result before auto-skipping (handled by engine)
    return {
      ...state,
      phase: GamePhase.WAITING_FOR_MOVE,
      lastDiceResult: diceResult,
      validMoves: [],
    };
  }

  // Valid moves available — wait for player to choose
  return {
    ...state,
    phase: GamePhase.WAITING_FOR_MOVE,
    lastDiceResult: diceResult,
    validMoves,
  };
}
