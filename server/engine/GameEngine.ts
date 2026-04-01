// ============================================================================
// Server-side Game Engine — Authoritative State Machine
// ============================================================================
// Cleaned for production: no debug methods, no console output.
// Includes per-room action queue for sequential execution.

import {
  type GameState,
  type GameConfig,
  type MoveAction,
  type DiceResult,
  type Player,
  type Pawn,
  type SerializableGameState,
  PlayerPosition,
  PawnState,
  GamePhase,
  DiceMode,
} from '../../shared/types.js';

import {
  PAWNS_PER_PLAYER,
  DEFAULT_POSITIONS,
} from '../../shared/constants.js';

import { rollDice } from './DiceEngine.js';
import { executeMove, applyDiceRoll, skipTurn } from './MoveExecutor.js';
import { computeFairnessWeights } from './DiceFairness.js';
import { FairnessLogger } from './FairnessLogger.js';

// ---------------------------------------------------------------------------
// Game State Factory
// ---------------------------------------------------------------------------

function createPawns(position: PlayerPosition, startingOnBoard: number): Pawn[] {
  return Array.from({ length: PAWNS_PER_PLAYER }, (_, i) => ({
    id: `${position}-${i}`,
    playerId: position,
    state: i < startingOnBoard ? PawnState.ACTIVE_OUTER : PawnState.OUTSIDE,
    pathIndex: i < startingOnBoard ? 0 : -1,
    completedOuterLoop: false,
    isPaired: false,
  }));
}

function createPlayer(position: PlayerPosition, name: string, startingOnBoard: number): Player {
  return {
    position,
    name,
    pawns: createPawns(position, startingOnBoard),
    hasKilled: false,
    badRollStreak: 0,
    lastRolls: [],
    isFinished: false,
    finishRank: 0,
    isConnected: true,
  };
}

export function createGameState(
  config: GameConfig,
  playerNames: Record<string, string>,
): GameState {
  const players = new Map<PlayerPosition, Player>();
  const startingOnBoard = config.startingPawnsOnBoard ?? 0;

  for (const pos of config.activePositions) {
    const name = playerNames[pos] || `Player ${pos}`;
    players.set(pos, createPlayer(pos, name, startingOnBoard));
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

export function createDefaultConfig(playerCount: 2 | 3 | 4 = 4): GameConfig {
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
// Serialization (Map ↔ Record for network transport)
// ---------------------------------------------------------------------------

export function serializeState(state: GameState): SerializableGameState {
  const players: Record<string, Player> = {};
  for (const [pos, player] of state.players) {
    players[pos] = player;
  }
  return {
    config: state.config,
    players,
    currentTurn: state.currentTurn,
    phase: state.phase,
    lastDiceResult: state.lastDiceResult,
    extraTurnCount: state.extraTurnCount,
    validMoves: state.validMoves,
    turnNumber: state.turnNumber,
    winner: state.winner,
    rankings: state.rankings,
  };
}

export function deserializeState(data: SerializableGameState): GameState {
  const players = new Map<PlayerPosition, Player>();
  for (const [pos, player] of Object.entries(data.players)) {
    players.set(pos as PlayerPosition, player);
  }
  return {
    config: data.config,
    players,
    currentTurn: data.currentTurn,
    phase: data.phase,
    lastDiceResult: data.lastDiceResult,
    extraTurnCount: data.extraTurnCount,
    validMoves: data.validMoves,
    turnNumber: data.turnNumber,
    winner: data.winner,
    rankings: data.rankings,
  };
}

// ---------------------------------------------------------------------------
// Event Types
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

// ---------------------------------------------------------------------------
// Game Engine
// ---------------------------------------------------------------------------

export class GameEngine {
  private state: GameState;
  private listeners: Map<GameEventType, Set<GameEventListener>> = new Map();
  private skipTimeout: ReturnType<typeof setTimeout> | null = null;
  private actionQueue: Promise<void> = Promise.resolve();

  constructor(config: GameConfig, playerNames: Record<string, string>) {
    this.state = createGameState(config, playerNames);
  }

  // --- State Access ---

  getState(): Readonly<GameState> {
    return this.state;
  }

  getSerializableState(): SerializableGameState {
    return serializeState(this.state);
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

  // --- Event System ---

  on(event: GameEventType, listener: GameEventListener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  private emit(type: GameEventType, data?: unknown): void {
    const event: GameEvent = { type, data };
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }

  // --- Action Queue (prevents race conditions) ---

  enqueue(action: () => void): void {
    this.actionQueue = this.actionQueue.then(() => {
      try {
        action();
      } catch (err) {
        // Swallow — errors are handled within each action
      }
    });
  }

  // --- Game Actions ---

  roll(): DiceResult | null {
    if (this.state.phase !== GamePhase.WAITING_FOR_ROLL) {
      return null; // Idempotency: ignore duplicate rolls
    }

    this.cancelSkipTimeout();

    const player = this.getCurrentPlayer();
    let weights: Record<number, number>;

    if (this.state.config.diceMode === DiceMode.RANDOM) {
      // Pure random — equal probability for all values
      weights = { 1: 20, 2: 20, 3: 20, 4: 20, 8: 20 };
    } else {
      // Fair mode — use fairness-adjusted weights
      const fairness = computeFairnessWeights(player, this.state);
      weights = fairness.weights;
    }

    const result = rollDice(weights);

    FairnessLogger.logRoll({
      playerId: player.position,
      originalWeights: this.state.config.diceConfig.baseWeights,
      adjustedWeights: weights,
      reasons: [],
      result: result.value,
    });

    const previousTurn = this.state.currentTurn;
    this.state = applyDiceRoll(this.state, result);

    this.emit('diceRolled', result);
    this.emit('stateChange', this.state);

    if (this.state.phase === GamePhase.WAITING_FOR_MOVE && this.state.validMoves.length === 0) {
      this.emit('noValidMoves', { player: previousTurn, diceValue: result.value });
      this.handleNoMovesSkip();
    } else if (this.state.currentTurn !== previousTurn) {
      this.emit('turnChanged', this.state.currentTurn);
    }

    return result;
  }

  private handleNoMovesSkip(): void {
    this.cancelSkipTimeout();
    this.skipTimeout = setTimeout(() => {
      this.finalizeSkip();
    }, 4000);
  }

  private finalizeSkip(): void {
    const previousTurn = this.state.currentTurn;
    const lastRoll = this.state.lastDiceResult?.value ?? 0;
    FairnessLogger.trackEffect(previousTurn, lastRoll, 'BLOCKED');

    this.state = skipTurn(this.state);

    if (this.state.currentTurn !== previousTurn) {
      this.emit('turnChanged', this.state.currentTurn);
    }
    this.emit('stateChange', this.state);
    this.skipTimeout = null;
  }

  private cancelSkipTimeout(): void {
    if (this.skipTimeout) {
      clearTimeout(this.skipTimeout);
      this.skipTimeout = null;
    }
  }

  selectMove(move: MoveAction): boolean {
    if (this.state.phase !== GamePhase.WAITING_FOR_MOVE) {
      return false; // Idempotency: ignore moves when not expected
    }

    this.cancelSkipTimeout();

    const isValid = this.state.validMoves.some(
      (m) => m.pawnId === move.pawnId && m.targetPathIndex === move.targetPathIndex,
    );

    if (!isValid) {
      return false;
    }

    const previousTurn = this.state.currentTurn;
    const lastRoll = this.state.lastDiceResult?.value ?? 0;

    const effect = move.willKill ? 'KILL' : 'PROGRESS';
    FairnessLogger.trackEffect(previousTurn, lastRoll, effect);

    const movingPawn = this.findPawn(move.pawnId);
    const wasOuter = movingPawn?.state === PawnState.ACTIVE_OUTER;

    this.state = executeMove(this.state, move);

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

    if (wasOuter && move.targetPathIndex >= 16) {
      this.emit('pawnEnteredInner', { pawnId: move.pawnId });
    }

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

  /** Select move by index (used by server socket handler) */
  selectMoveByIndex(index: number): boolean {
    if (index < 0 || index >= this.state.validMoves.length) {
      return false;
    }
    return this.selectMove(this.state.validMoves[index]);
  }

  /** Select a random valid move (for auto-move on timeout) */
  selectRandomMove(): boolean {
    if (this.state.validMoves.length === 0) return false;
    const randomIndex = Math.floor(Math.random() * this.state.validMoves.length);
    return this.selectMove(this.state.validMoves[randomIndex]);
  }

  /** Set player connection status */
  setPlayerConnected(position: PlayerPosition, connected: boolean): void {
    const player = this.state.players.get(position);
    if (player) {
      this.state.players.set(position, { ...player, isConnected: connected });
      this.emit('stateChange', this.state);
    }
  }

  /** Remove a player (abandon) — set all pawns to OUTSIDE, mark finished */
  removePlayer(position: PlayerPosition): void {
    const player = this.state.players.get(position);
    if (!player || player.isFinished) return;

    const updatedPawns = player.pawns.map((p) => ({
      ...p,
      state: PawnState.OUTSIDE,
      pathIndex: -1,
      completedOuterLoop: false,
      isPaired: false,
    }));

    this.state.players.set(position, {
      ...player,
      pawns: updatedPawns as typeof player.pawns,
      isFinished: true,
      isConnected: false,
    });

    // If it was this player's turn, skip
    if (this.state.currentTurn === position) {
      this.state = skipTurn(this.state);
    }

    this.emit('stateChange', this.state);
  }

  setState(state: GameState): void {
    this.state = state;
    this.emit('stateChange', this.state);
  }

  // --- Utilities ---

  private findPawn(pawnId: string): Pawn | undefined {
    for (const player of this.state.players.values()) {
      const pawn = player.pawns.find((p) => p.id === pawnId);
      if (pawn) return pawn;
    }
    return undefined;
  }

  destroy(): void {
    this.cancelSkipTimeout();
    this.listeners.clear();
  }
}
