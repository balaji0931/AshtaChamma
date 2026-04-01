// ============================================================================
// Online Game Context — Socket-based game provider
// ============================================================================
// Same context shape as GameContext so Board, Dice, Pawn all work identically.
// Instead of running a local engine, it sends events to the server.

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

import {
  type GameState,
  type MoveAction,
  type DiceResult,
  type Pawn,
  type SerializableGameState,
  type TimerSync,
  type PlayerPosition,
  GamePhase,
  PawnState,
} from '@shared/types';

import { PLAYER_PATHS, HOME_INDEX, TRANSITION_INDEX, INNER_START_INDEX } from '@shared/constants';
import { useSocket } from './SocketContext';
import { UnifiedGameProvider } from './UnifiedGameContext';
import { playMoveSound, playEntrySound, playKillSound, playHomeSound } from '../audio/SoundEngine';

// ---------------------------------------------------------------------------
// Animation types (same as local GameContext)
// ---------------------------------------------------------------------------

interface AnimatingPawn {
  pawnIds: string[];
  playerId: PlayerPosition;
  currentCellId: number;
}

interface OnlineGameContextValue {
  state: GameState;
  roll: () => void;
  selectMove: (move: MoveAction) => void;
  animatingPawn: AnimatingPawn | null;
  killedAnimatingPawn: AnimatingPawn | null;
  isAnimating: boolean;
  timer: TimerSync | null;
  myPosition: PlayerPosition;
  isMyTurn: boolean;
}

const OnlineGameContext = createContext<OnlineGameContextValue | null>(null);

export function useOnlineGame(): OnlineGameContextValue {
  const ctx = useContext(OnlineGameContext);
  if (!ctx) throw new Error('useOnlineGame must be inside OnlineGameProvider');
  return ctx;
}

// ---------------------------------------------------------------------------
// State deserialization (Record → Map)
// ---------------------------------------------------------------------------

function deserializeState(data: SerializableGameState): GameState {
  const players = new Map<PlayerPosition, typeof data.players[string]>();
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
// Animation helpers (reused from GameContext)
// ---------------------------------------------------------------------------

function getPathCellsForward(
  playerId: PlayerPosition,
  fromIndex: number,
  toIndex: number,
): number[] {
  const path = PLAYER_PATHS[playerId];
  const cells: number[] = [];

  if (fromIndex < 0) {
    for (let i = 0; i <= toIndex && i < path.length; i++) {
      cells.push(path[i]);
    }
    return cells;
  }

  if (toIndex < fromIndex && fromIndex <= TRANSITION_INDEX && toIndex <= TRANSITION_INDEX) {
    for (let i = fromIndex + 1; i <= TRANSITION_INDEX; i++) cells.push(path[i]);
    for (let i = 0; i <= toIndex; i++) cells.push(path[i]);
    return cells;
  }

  if (toIndex < fromIndex && fromIndex >= INNER_START_INDEX && toIndex >= INNER_START_INDEX) {
    for (let i = fromIndex + 1; i < HOME_INDEX; i++) cells.push(path[i]);
    for (let i = INNER_START_INDEX; i <= toIndex; i++) cells.push(path[i]);
    return cells;
  }

  for (let i = fromIndex + 1; i <= toIndex && i < path.length; i++) {
    cells.push(path[i]);
  }

  return cells;
}

function getPathCellsReverse(playerId: PlayerPosition, fromIndex: number): number[] {
  const path = PLAYER_PATHS[playerId];
  const cells: number[] = [];
  for (let i = fromIndex - 1; i >= 0; i--) {
    cells.push(path[i]);
  }
  return cells;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface OnlineGameProviderProps {
  initialState: SerializableGameState;
  myPosition: PlayerPosition;
  children: ReactNode;
}

export function OnlineGameProvider({ initialState, myPosition, children }: OnlineGameProviderProps) {
  const { socket } = useSocket();
  const [gameState, setGameState] = useState<GameState>(() => deserializeState(initialState));
  const [animatingPawn, setAnimatingPawn] = useState<AnimatingPawn | null>(null);
  const [killedAnimatingPawn, setKilledAnimatingPawn] = useState<AnimatingPawn | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [timer, setTimer] = useState<TimerSync | null>(null);

  const prevStateRef = useRef<GameState>(gameState);
  const isAnimatingRef = useRef(false);
  const pendingStateRef = useRef<GameState | null>(null);
  const gameStateRef = useRef<GameState>(gameState);

  // Keep gameStateRef in sync for use in socket listeners (avoids stale closures)
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    if (!socket) return;

    const onStateUpdate = (data: SerializableGameState) => {
      const newState = deserializeState(data);
      if (isAnimatingRef.current) {
        pendingStateRef.current = newState;
      } else {
        setGameState(newState);
        prevStateRef.current = newState;
      }
    };

    const onTimerSync = (data: TimerSync) => {
      setTimer(data);
    };

    socket.on('game:state-update', onStateUpdate);
    socket.on('game:started', (data: SerializableGameState) => {
      const s = deserializeState(data);
      setGameState(s);
      prevStateRef.current = s;
    });
    socket.on('timer:sync', onTimerSync);

    const onMoveExecuted = (data: { move: MoveAction; position: PlayerPosition }) => {
      // Only animate if it's NOT our move (we animate ours immediately for responsiveness)
      if (data.position !== myPosition) {
        runMovementAnimation(data.move);
      }
    };

    socket.on('game:move-executed', onMoveExecuted);

    return () => {
      socket.off('game:state-update', onStateUpdate);
      socket.off('game:started');
      socket.off('timer:sync', onTimerSync);
      socket.off('game:move-executed', onMoveExecuted);
    };
  }, [socket, myPosition]);

  const finishAnimation = useCallback(() => {
    setAnimatingPawn(null);
    setKilledAnimatingPawn(null);
    setIsAnimating(false);
    isAnimatingRef.current = false;

    if (pendingStateRef.current) {
      setGameState(pendingStateRef.current);
      prevStateRef.current = pendingStateRef.current;
      pendingStateRef.current = null;
    }
  }, []);

  const runMovementAnimation = useCallback((move: MoveAction) => {
    let movingPawn: Pawn | undefined;
    // IMPORTANT: Animation must start from where the pawn is CURRENTLY visible
    // Use Ref to avoid stale closure in the socket listener
    const currentState = gameStateRef.current;

    for (const player of currentState.players.values()) {
      movingPawn = player.pawns.find((p) => p.id === move.pawnId);
      if (movingPawn) break;
    }
    if (!movingPawn) return;

    const playerId = movingPawn.playerId;
    const fromIndex = movingPawn.state === PawnState.OUTSIDE ? -1 : movingPawn.pathIndex;
    const toIndex = move.targetPathIndex;
    const forwardCells = getPathCellsForward(playerId, fromIndex, toIndex);

    let killedPawn: Pawn | undefined;
    if (move.willKill && move.killTargets.length > 0) {
      for (const player of currentState.players.values()) {
        for (const p of player.pawns) {
          if (move.killTargets.includes(p.id)) {
            killedPawn = p;
            break;
          }
        }
        if (killedPawn) break;
      }
    }

    const FORWARD_STEP_MS = 250;
    const KILL_STEP_MS = 50;

    // Even for single step, we want to see the animation/sound
    if (forwardCells.length === 0 && !killedPawn && !move.isEntry) {
      if (toIndex === HOME_INDEX) playHomeSound();
      else playMoveSound();
      return;
    }

    if (move.isEntry) playEntrySound();
    setIsAnimating(true);
    isAnimatingRef.current = true;

    const movingPawnIds = move.isPairMove && move.pawnIds && move.pawnIds.length > 0
      ? move.pawnIds
      : [movingPawn.id];

    let step = 0;
    if (forwardCells.length > 0) {
      setAnimatingPawn({
        pawnIds: movingPawnIds,
        playerId,
        currentCellId: forwardCells[0],
      });
    }

    const forwardInterval = setInterval(() => {
      step++;
      // Only play movement tap if it's NOT the very first cell of an entry (since playEntrySound already played)
      const isFirstEntryStep = move.isEntry && step === 1;
      if (!isFirstEntryStep) {
        playMoveSound();
      }

      if (step >= forwardCells.length) {
        clearInterval(forwardInterval);
        if (toIndex === HOME_INDEX) playHomeSound();
        setAnimatingPawn(null);

        if (killedPawn) {
          const reverseCells = getPathCellsReverse(killedPawn.playerId, killedPawn.pathIndex);
          playKillSound();
          if (reverseCells.length === 0) {
            finishAnimation();
            return;
          }
          let killStep = 0;
          setKilledAnimatingPawn({
            pawnIds: [killedPawn.id],
            playerId: killedPawn.playerId,
            currentCellId: reverseCells[0],
          });
          const reverseInterval = setInterval(() => {
            killStep++;
            if (killStep >= reverseCells.length) {
              clearInterval(reverseInterval);
              finishAnimation();
            } else {
              setKilledAnimatingPawn({
                pawnIds: [killedPawn!.id],
                playerId: killedPawn!.playerId,
                currentCellId: reverseCells[killStep],
              });
            }
          }, KILL_STEP_MS);
        } else {
          finishAnimation();
        }
      } else {
        setAnimatingPawn({
          pawnIds: movingPawnIds,
          playerId,
          currentCellId: forwardCells[step],
        });
      }
    }, FORWARD_STEP_MS);
  }, [gameState, finishAnimation]);

  const selectMove = useCallback((move: MoveAction) => {
    if (isAnimating || !socket) return;
    const moveIndex = gameState.validMoves.findIndex(
      (m) => m.pawnId === move.pawnId && m.targetPathIndex === move.targetPathIndex,
    );
    if (moveIndex === -1) return;

    socket.emit('game:select-move', { moveIndex });
    runMovementAnimation(move);
  }, [socket, gameState, isAnimating, runMovementAnimation]);

  const isMyTurn = gameState.currentTurn === myPosition;

  const roll = useCallback(() => {
    if (isAnimating || !socket || !isMyTurn) return;
    socket.emit('game:roll-dice');
  }, [socket, isAnimating, isMyTurn]);

  const [isRolling, setIsRolling] = useState(false);

  // Auto-move: single valid move
  useEffect(() => {
    if (isAnimating || isRolling) return;
    if (gameState.phase !== GamePhase.WAITING_FOR_MOVE) return;
    if (gameState.validMoves.length === 0) return;
    if (gameState.currentTurn !== myPosition) return;

    const moves = gameState.validMoves;
    if (moves.length === 1) {
      const t = setTimeout(() => selectMove(moves[0]), 3500);
      return () => clearTimeout(t);
    }

    const allSamePawnAndTarget = moves.every(
      (m) => m.pawnId === moves[0].pawnId && m.targetPathIndex === moves[0].targetPathIndex,
    );
    if (allSamePawnAndTarget && moves.length > 0) {
      const t = setTimeout(() => selectMove(moves[0]), 3500);
      return () => clearTimeout(t);
    }
  }, [gameState.phase, gameState.validMoves, isAnimating, isRolling, selectMove, myPosition, gameState.currentTurn]);

  // Perspective: rotate the board so myPosition is at the Bottom (180deg)
  // Mapping: A:0, B:270, C:180, D:90 (Standard map: A=Top, B=Left, C=Bottom, D=Right)
  const perspectiveRotation = useMemo(() => {
    if (myPosition === 'A') return 180; // Flip A to bottom
    if (myPosition === 'B') return 90;  // Rotate B from left to bottom
    if (myPosition === 'C') return 0;   // C is already at bottom
    if (myPosition === 'D') return 270; // Rotate D from right to bottom
    return 0;
  }, [myPosition]);

  const value = {
    state: gameState,
    roll,
    selectMove,
    animatingPawn,
    killedAnimatingPawn,
    isAnimating,
    isRolling,
    setIsRolling,
    perspectiveRotation,
    timer,
    myPosition,
    isMyTurn,
  };

  return (
    <OnlineGameContext.Provider value={value}>
      <UnifiedGameProvider value={value}>
        {children}
      </UnifiedGameProvider>
    </OnlineGameContext.Provider>
  );
}
