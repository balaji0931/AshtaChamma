// ============================================================================
// Asta Chamma — Shared Type Definitions
// ============================================================================

/** Board position on the 5×5 grid (0–24), or -1 for OUTSIDE */
export type CellId = number;

/** Index along a player's personal path (0–24) */
export type PathIndex = number;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum PlayerPosition {
  A = 'A', // Top
  B = 'B', // Left
  C = 'C', // Bottom
  D = 'D', // Right
}

export enum PawnState {
  OUTSIDE = 'OUTSIDE',
  ACTIVE_OUTER = 'ACTIVE_OUTER',
  ACTIVE_INNER = 'ACTIVE_INNER',
  HOME = 'HOME',
}

export enum GameMode {
  CLASSIC = 'CLASSIC',
  PAIRS = 'PAIRS',
}

export enum PlayStyle {
  NORMAL = 'NORMAL',
  TEAM = 'TEAM',
}

export enum EntryMode {
  LOCKED = 'LOCKED',
  FREE = 'FREE',
}

export enum InnerPathMode {
  ROTATION = 'ROTATION',
  NO_ROTATION = 'NO_ROTATION',
}

export enum GamePhase {
  WAITING_FOR_PLAYERS = 'WAITING_FOR_PLAYERS',
  WAITING_FOR_ROLL = 'WAITING_FOR_ROLL',
  ROLLING = 'ROLLING',
  WAITING_FOR_MOVE = 'WAITING_FOR_MOVE',
  MOVING = 'MOVING',
  GAME_OVER = 'GAME_OVER',
}

// ---------------------------------------------------------------------------
// Data Structures
// ---------------------------------------------------------------------------

export interface DiceResult {
  /** Individual seed outcomes (true = white, false = black) */
  seeds: [boolean, boolean, boolean, boolean];
  /** Number of white faces (0–4) */
  whites: number;
  /** Movement value: 1, 2, 3, 4, or 8 */
  value: number;
  /** Whether this roll grants an extra turn */
  grantsExtraTurn: boolean;
  /** Optional: timestamp to help client identify new rolls */
  timestamp?: number;
}

export interface Pawn {
  id: string;
  playerId: PlayerPosition;
  state: PawnState;
  /** Current index on this player's path (0–24), or -1 if OUTSIDE */
  pathIndex: PathIndex;
  /** Whether this pawn has completed at least one full outer loop */
  completedOuterLoop: boolean;
  /** Whether this pawn is part of a pair */
  isPaired: boolean;
}

export interface Player {
  position: PlayerPosition;
  name: string;
  pawns: Pawn[];
  /** Whether this player has killed at least one opponent (unlocks inner path) */
  hasKilled: boolean;
  /** Anti-frustration: Counts consecutive turns with no meaningful moves */
  badRollStreak: number;
  /** History: Last few dice values rolled by this player (anti-pattern detection) */
  lastRolls: number[];
  /** Whether all pawns are HOME */
  isFinished: boolean;
  /** Finish rank: 0 = not finished, 1 = 1st place, 2 = 2nd, etc. */
  finishRank: number;
  /** Whether this player is actively connected (online mode) */
  isConnected: boolean;
}

export interface DiceConfig {
  /** Baseline probabilities: { 1: 20, 2: 20, 3: 20, 4: 25, 8: 15 } */
  baseWeights: Record<number, number>;
  /** Max boost per number (e.g. 15%) */
  maxBoostPerNumber: number;
  /** Max total weight adjustment (e.g. 20%) */
  maxTotalAdjustment: number;
}

export enum DiceMode {
  FAIR = 'FAIR',
  RANDOM = 'RANDOM',
}

export interface GameConfig {
  playerCount: 2 | 3 | 4;
  gameMode: GameMode;
  playStyle: PlayStyle;
  entryMode: EntryMode;
  innerPathMode: InnerPathMode;
  /** Positions that are active in this game */
  activePositions: PlayerPosition[];
  /** Fairness system configuration */
  diceConfig: DiceConfig;
  /** Dice mode: FAIR (balanced) or RANDOM (pure random) */
  diceMode: DiceMode;
  /** Number of pawns that start on the board (0-4). Default 0. */
  startingPawnsOnBoard: number;
  /** Enable extra safe cells on inner diagonals (CSS board only) */
  extraSafeCells: boolean;
}

export interface MoveAction {
  pawnId: string;
  /** Optional: Multiple pawns involved (e.g. Double Entry on 8) */
  pawnIds?: string[];
  /** Target path index after move */
  targetPathIndex: PathIndex;
  /** Whether this move enters a new pawn on the board */
  isEntry: boolean;
  /** Whether this is a special double entry (on 8) */
  isDoubleEntry?: boolean;
  /** Whether this move will kill an opponent */
  willKill: boolean;
  /** Whether this move involves a pair of pawns */
  isPairMove?: boolean;
  /** ID(s) of pawns that will be killed */
  killTargets: string[];
}

export interface GameState {
  config: GameConfig;
  players: Map<PlayerPosition, Player>;
  currentTurn: PlayerPosition;
  phase: GamePhase;
  lastDiceResult: DiceResult | null;
  extraTurnCount: number;
  validMoves: MoveAction[];
  /** Turn history for replay/undo if needed */
  turnNumber: number;
  winner: PlayerPosition | PlayerPosition[] | null;
  /** Ordered list of players who finished (1st, 2nd, 3rd...) */
  rankings: PlayerPosition[];
}

// ---------------------------------------------------------------------------
// Serializable version of GameState (for network transport)
// ---------------------------------------------------------------------------

export interface SerializableGameState {
  config: GameConfig;
  players: Record<string, Player>;
  currentTurn: PlayerPosition;
  phase: GamePhase;
  lastDiceResult: DiceResult | null;
  extraTurnCount: number;
  validMoves: MoveAction[];
  turnNumber: number;
  winner: PlayerPosition | PlayerPosition[] | null;
  rankings: PlayerPosition[];
}

// ---------------------------------------------------------------------------
// Room & Lobby Types
// ---------------------------------------------------------------------------

export enum RoomStatus {
  WAITING = 'WAITING',
  STARTING = 'STARTING',
  IN_PROGRESS = 'IN_PROGRESS',
  FINISHED = 'FINISHED',
}

export interface LobbyPlayer {
  sessionToken: string;    // last 4 chars only (for display)
  displayName: string;
  position: PlayerPosition | null;
  isReady: boolean;
  isConnected: boolean;
  isHost: boolean;
}

export interface RoomInfo {
  roomCode: string;
  hostToken: string;       // last 4 chars only
  config: GameConfig;
  status: RoomStatus | string;
  players: LobbyPlayer[];
  isPrivate: boolean;
}

export interface TimerSync {
  type: 'roll' | 'move';
  remainingMs: number;
  forPosition: PlayerPosition;
}

// ---------------------------------------------------------------------------
// Socket Events
// ---------------------------------------------------------------------------

export interface ServerToClientEvents {
  // Room events
  'room:created':             (data: { room: RoomInfo; shareLink: string }) => void;
  'room:joined':              (data: { room: RoomInfo; yourPosition: PlayerPosition }) => void;
  'room:info':                (data: { exists: boolean; isPrivate: boolean; status?: string; playerCount: number; maxPlayers: number }) => void;
  'room:player-joined':       (player: LobbyPlayer) => void;
  'room:player-left':         (position: PlayerPosition) => void;
  'room:players-updated':     (players: LobbyPlayer[]) => void;
  'room:player-kicked':       (position: PlayerPosition) => void;
  'room:you-were-kicked':     () => void;
  'room:config-updated':      (config: GameConfig) => void;
  'room:player-disconnected': (position: PlayerPosition) => void;
  'room:player-reconnected':  (position: PlayerPosition) => void;

  // Game events
  'game:started':          (state: SerializableGameState) => void;
  'game:state-update':     (state: SerializableGameState) => void;
  'game:dice-rolled':      (data: { result: DiceResult; position: PlayerPosition }) => void;
  'game:move-executed':    (data: { move: MoveAction; position: PlayerPosition }) => void;
  'game:player-abandoned': (data: { position: PlayerPosition; reason: string }) => void;
  'game:over':             (data: { rankings: PlayerPosition[] }) => void;
  'game:auto-action':      (data: { type: 'roll' | 'move'; position: PlayerPosition }) => void;

  // Timer
  'timer:sync':            (data: TimerSync) => void;

  // Errors
  'error':                 (data: { code: string; message: string }) => void;
}

export interface ClientToServerEvents {
  // Room
  'room:create':       (data: { config: GameConfig; name: string; isPrivate: boolean; passcode?: string }) => void;
  'room:join':         (data: { code: string; name: string; passcode?: string }) => void;
  'room:check':        (data: { code: string }) => void;
  'room:leave':        () => void;
  'room:toggle-ready': () => void;
  'room:kick':         (data: { position: PlayerPosition }) => void;
  'room:update-config':(data: { config: GameConfig }) => void;
  'room:start-game':   () => void;

  // Game
  'game:roll-dice':    () => void;
  'game:select-move':  (data: { moveIndex: number }) => void;
  'game:reconnect':    (data: { roomCode: string }) => void;
}
