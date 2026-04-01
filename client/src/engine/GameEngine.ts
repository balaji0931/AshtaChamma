// ============================================================================
// Asta Chamma — Game Engine (State Machine)
// ============================================================================
//
// Central game controller managing the full game lifecycle.
// Uses MoveExecutor for state transitions and shared/rules for validation.
//

import {
  type GameState,
  type GameConfig,
  type MoveAction,
  type DiceResult,
  type Player,
  type Pawn,
  PlayerPosition,
  PawnState,
  GamePhase,
  DiceMode,
} from '@shared/types';

import {
  PAWNS_PER_PLAYER,
  ENTRY_CELLS,
  DEFAULT_POSITIONS,
} from '@shared/constants';

import { rollDice } from './DiceEngine';
import { executeMove, applyDiceRoll, skipTurn } from './MoveExecutor';
import { computeFairnessWeights } from './DiceFairness';
import { FairnessLogger, type FairnessReason } from './FairnessLogger';

// ---------------------------------------------------------------------------
// Game State Factory
// ---------------------------------------------------------------------------

/** Create initial pawn set for a player */
function createPawns(position: PlayerPosition): Pawn[] {
  return Array.from({ length: PAWNS_PER_PLAYER }, (_, i) => ({
    id: `${position}-${i}`,
    playerId: position,
    state: PawnState.OUTSIDE,
    pathIndex: -1,
    completedOuterLoop: false,
    isPaired: false,
  }));
}

/** Create initial player state */
function createPlayer(position: PlayerPosition, name: string): Player {
  return {
    position,
    name,
    pawns: createPawns(position),
    hasKilled: false,
    badRollStreak: 0,
    lastRolls: [],
    isFinished: false,
    finishRank: 0,
    isConnected: true,
  };
}

/** Create a fresh game state from config */
export function createGameState(
  config: GameConfig,
  playerNames: Record<string, string>,
): GameState {
  const players = new Map<PlayerPosition, Player>();

  for (const pos of config.activePositions) {
    const name = playerNames[pos] || `Player ${pos}`;
    players.set(pos, createPlayer(pos, name));
  }

  return {
    config,
    players,
    currentTurn: config.activePositions[0],
    phase: GamePhase.WAITING_FOR_ROLL,
    lastDiceResult: null,
    extraTurnCount: 0,
    validMoves: [],
    turnNumber: 1,
    winner: null,
    rankings: [],
  };
}

/** Create a default game config */
export function createDefaultConfig(
  playerCount: 2 | 3 | 4 = 4,
): GameConfig {
  return {
    playerCount,
    gameMode: 'CLASSIC' as GameConfig['gameMode'],
    playStyle: 'NORMAL' as GameConfig['playStyle'],
    entryMode: 'LOCKED' as GameConfig['entryMode'],
    innerPathMode: 'ROTATION' as GameConfig['innerPathMode'],
    activePositions: DEFAULT_POSITIONS[playerCount],
    diceConfig: {
      baseWeights: { 1: 20, 2: 20, 3: 20, 4: 25, 8: 15 },
      maxBoostPerNumber: 15,
      maxTotalAdjustment: 25,
    },
    diceMode: DiceMode.FAIR,
    startingPawnsOnBoard: 0,
    extraSafeCells: false,
  };
}

// ---------------------------------------------------------------------------
// Game Engine Class
// ---------------------------------------------------------------------------

export type GameEventType =
  | 'stateChange'
  | 'diceRolled'
  | 'moveExecuted'
  | 'turnChanged'
  | 'gameOver'
  | 'pawnKilled'
  | 'pawnEnteredBoard'
  | 'pawnReachedHome'
  | 'pawnEnteredInner'
  | 'noValidMoves';

export interface GameEvent {
  type: GameEventType;
  data?: unknown;
}

type GameEventListener = (event: GameEvent) => void;

export class GameEngine {
  private state: GameState;
  private listeners: Map<GameEventType, Set<GameEventListener>> = new Map();
  private skipTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(config: GameConfig, playerNames: Record<string, string>) {
    this.state = createGameState(config, playerNames);
  }

  // -------------------------------------------------------------------------
  // State Access
  // -------------------------------------------------------------------------

  getState(): Readonly<GameState> {
    return this.state;
  }

  getCurrentPlayer(): Player {
    return this.state.players.get(this.state.currentTurn)!;
  }

  getPhase(): GamePhase {
    return this.state.phase;
  }

  isGameOver(): boolean {
    return this.state.phase === GamePhase.GAME_OVER;
  }

  // -------------------------------------------------------------------------
  // Event System
  // -------------------------------------------------------------------------

  on(event: GameEventType, listener: GameEventListener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  private emit(type: GameEventType, data?: unknown): void {
    const event: GameEvent = { type, data };
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }

  // -------------------------------------------------------------------------
  // Game Actions
  // -------------------------------------------------------------------------

  roll(): DiceResult | null {
    if (this.state.phase !== GamePhase.WAITING_FOR_ROLL) {
      return null;
    }

    this.cancelSkipTimeout();

    const player = this.getCurrentPlayer();
    let weights: Record<number, number>;
    let reasons: FairnessReason[] = [];

    if (this.state.config.diceMode === DiceMode.RANDOM) {
      // Pure random — equal probability for all values, no fairness computation
      weights = { 1: 20, 2: 20, 3: 20, 4: 25, 8: 15 };
    } else {
      // Fair mode — use fairness-adjusted weights
      const fairness = computeFairnessWeights(player, this.state);
      weights = fairness.weights;
      reasons = fairness.reasons;
    }

    const result = rollDice(weights);

    // Log fairness data
    FairnessLogger.logRoll({
      playerId: player.position,
      originalWeights: this.state.config.diceConfig.baseWeights,
      adjustedWeights: weights,
      reasons,
      result: result.value
    });

    const previousTurn = this.state.currentTurn;
    this.state = applyDiceRoll(this.state, result);

    this.emit('diceRolled', result);
    this.emit('stateChange', this.state);

    // Turn advancement is now handled either immediately (if moves exist)
    // or after a delay (if no moves exist)
    if (this.state.phase === GamePhase.WAITING_FOR_MOVE && this.state.validMoves.length === 0) {
      this.emit('noValidMoves', { player: previousTurn, diceValue: result.value });
      this.handleNoMovesSkip();
    } else if (this.state.currentTurn !== previousTurn) {
      // This case handles any immediate turn changes (though applyDiceRoll was updated to pause)
      this.emit('turnChanged', this.state.currentTurn);
    }

    return result;
  }

  /**
   * Apply a dice result (for server-authoritative games).
   */
  applyRoll(diceResult: DiceResult): void {
    if (this.state.phase !== GamePhase.WAITING_FOR_ROLL) return;

    this.cancelSkipTimeout();
    const previousTurn = this.state.currentTurn;
    this.state = applyDiceRoll(this.state, diceResult);

    this.emit('diceRolled', diceResult);
    this.emit('stateChange', this.state);

    if (this.state.phase === GamePhase.WAITING_FOR_MOVE && this.state.validMoves.length === 0) {
      this.emit('noValidMoves', { player: previousTurn, diceValue: diceResult.value });
      this.handleNoMovesSkip();
    } else if (this.state.currentTurn !== previousTurn) {
      this.emit('turnChanged', this.state.currentTurn);
    }
  }

  /**
   * Handle the 1.5-second pause when no moves are available.
   */
  private handleNoMovesSkip(): void {
    this.cancelSkipTimeout();
    this.skipTimeout = setTimeout(() => {
      this.finalizeSkip();
    }, 1500);
  }

  /**
   * Forcefully finish a skip after the delay.
   */
  private finalizeSkip(): void {
    const previousTurn = this.state.currentTurn;
    const lastRoll = this.state.lastDiceResult?.value ?? 0;

    // Track telemetry
    FairnessLogger.trackEffect(previousTurn, lastRoll, 'BLOCKED');

    this.state = skipTurn(this.state);

    if (this.state.currentTurn !== previousTurn) {
      this.emit('turnChanged', this.state.currentTurn);
    }
    this.emit('stateChange', this.state);
    this.skipTimeout = null;
  }

  /**
   * Cancel any pending skip timeout.
   */
  private cancelSkipTimeout(): void {
    if (this.skipTimeout) {
      clearTimeout(this.skipTimeout);
      this.skipTimeout = null;
    }
  }

  /**
   * Execute a selected move.
   * @returns true if the move was executed successfully
   */
  selectMove(move: MoveAction): boolean {
    if (this.state.phase !== GamePhase.WAITING_FOR_MOVE) {
      return false;
    }

    this.cancelSkipTimeout();

    // Verify the move is in the valid moves list
    const isValid = this.state.validMoves.some(
      (m) => m.pawnId === move.pawnId && m.targetPathIndex === move.targetPathIndex,
    );

    if (!isValid) {
      return false;
    }

    const previousState = this.state;
    const previousTurn = this.state.currentTurn;
    const lastRoll = previousState.lastDiceResult?.value ?? 0;

    // Track telemetry
    const effect = move.willKill ? 'KILL' : 'PROGRESS';
    FairnessLogger.trackEffect(previousTurn, lastRoll, effect);

    // Track events before executing
    const movingPawn = this.findPawn(move.pawnId);
    const wasOutside = movingPawn?.state === PawnState.OUTSIDE;
    const wasOuter = movingPawn?.state === PawnState.ACTIVE_OUTER;

    this.state = executeMove(this.state, move);

    // Emit events
    this.emit('moveExecuted', move);

    if (move.isEntry) {
      this.emit('pawnEnteredBoard', { pawnId: move.pawnId });
    }

    if (move.willKill) {
      this.emit('pawnKilled', {
        killerId: move.pawnId,
        killedIds: move.killTargets,
      });
    }

    // Check if pawn entered inner path
    if (wasOuter && move.targetPathIndex >= 16) {
      this.emit('pawnEnteredInner', { pawnId: move.pawnId });
    }

    // Check if pawn reached home
    if (move.targetPathIndex === 24) {
      this.emit('pawnReachedHome', { pawnId: move.pawnId });
    }

    if (this.state.phase === GamePhase.GAME_OVER) {
      this.emit('gameOver', { winner: this.state.winner });
    } else if (this.state.currentTurn !== previousTurn) {
      this.emit('turnChanged', this.state.currentTurn);
    }

    this.emit('stateChange', this.state);

    return true;
  }

  /**
   * Directly set the game state (for syncing with server).
   */
  setState(state: GameState): void {
    this.state = state;
    this.emit('stateChange', this.state);
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  private findPawn(pawnId: string): Pawn | undefined {
    for (const player of this.state.players.values()) {
      const pawn = player.pawns.find((p) => p.id === pawnId);
      if (pawn) return pawn;
    }
    return undefined;
  }

  /** Get a summary of the current game state for debugging */
  getDebugSummary(): string {
    const s = this.state;
    const lines: string[] = [
      `Turn ${s.turnNumber} | ${s.currentTurn}'s turn | Phase: ${s.phase}`,
      `Extra turns: ${s.extraTurnCount} | Dice: ${s.lastDiceResult?.value ?? 'none'}`,
    ];

    for (const [pos, player] of s.players) {
      const outside = player.pawns.filter((p) => p.state === PawnState.OUTSIDE).length;
      const outer = player.pawns.filter((p) => p.state === PawnState.ACTIVE_OUTER).length;
      const inner = player.pawns.filter((p) => p.state === PawnState.ACTIVE_INNER).length;
      const home = player.pawns.filter((p) => p.state === PawnState.HOME).length;
      const killed = player.hasKilled ? '🔓' : '🔒';
      lines.push(`  ${pos} (${player.name}): OUT=${outside} OUTER=${outer} INNER=${inner} HOME=${home} ${killed}`);
    }

    return lines.join('\n');
  }
}
