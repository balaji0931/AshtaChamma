// ============================================================================
// Asta Chamma — Game Context with Cell-by-Cell Animation + Kill Animation
// ============================================================================

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';

import {
  type GameState,
  type GameConfig,
  type MoveAction,
  type DiceResult,
  type Pawn,
  GamePhase,
  PlayerPosition,
  PawnState,
} from '@shared/types';

import { PLAYER_PATHS, HOME_INDEX, TRANSITION_INDEX, INNER_START_INDEX } from '@shared/constants';
import { GameEngine } from '../engine/GameEngine';
import { playMoveSound, playEntrySound, playKillSound, playHomeSound } from '../audio/SoundEngine';
import { UnifiedGameProvider } from './UnifiedGameContext';

// ---------------------------------------------------------------------------
// Animation types
// ---------------------------------------------------------------------------

interface AnimatingPawn {
  pawnIds: string[];
  playerId: PlayerPosition;
  currentCellId: number;
}

interface GameContextValue {
  state: GameState;
  roll: () => DiceResult | null;
  selectMove: (move: MoveAction) => void;
  animatingPawn: AnimatingPawn | null;
  /** Killed pawn being animated back to home */
  killedAnimatingPawn: AnimatingPawn | null;
  isAnimating: boolean;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const GameContext = createContext<GameContextValue | null>(null);

// Re-export useGame from UnifiedGameContext for backward compatibility
export { useGame } from './UnifiedGameContext';

// ---------------------------------------------------------------------------
// Helper: compute forward path cells
// ---------------------------------------------------------------------------

function getPathCellsForward(
  playerId: PlayerPosition,
  fromIndex: number,
  toIndex: number,
): number[] {
  const path = PLAYER_PATHS[playerId];
  const cells: number[] = [];

  if (fromIndex < 0) {
    // Entry: walk from entry cell (0) to target
    for (let i = 0; i <= toIndex && i < path.length; i++) {
      cells.push(path[i]);
    }
    return cells;
  }

  // Handle outer path wrap-around
  if (toIndex < fromIndex && fromIndex <= TRANSITION_INDEX && toIndex <= TRANSITION_INDEX) {
    for (let i = fromIndex + 1; i <= TRANSITION_INDEX; i++) cells.push(path[i]);
    for (let i = 0; i <= toIndex; i++) cells.push(path[i]);
    return cells;
  }

  // Handle inner path rotation wrap-around (overshoot home → rotate)
  // Don't include HOME_INDEX — the pawn rotates past it, not through it
  if (toIndex < fromIndex && fromIndex >= INNER_START_INDEX && toIndex >= INNER_START_INDEX) {
    // Walk forward from current to last inner cell BEFORE home (HOME_INDEX - 1)
    for (let i = fromIndex + 1; i < HOME_INDEX; i++) cells.push(path[i]);
    // Wrap from inner start to target
    for (let i = INNER_START_INDEX; i <= toIndex; i++) cells.push(path[i]);
    return cells;
  }

  for (let i = fromIndex + 1; i <= toIndex && i < path.length; i++) {
    cells.push(path[i]);
  }

  return cells;
}

// ---------------------------------------------------------------------------
// Helper: compute reverse path cells (for killed pawn going back)
// ---------------------------------------------------------------------------

function getPathCellsReverse(
  playerId: PlayerPosition,
  fromIndex: number,
): number[] {
  const path = PLAYER_PATHS[playerId];
  const cells: number[] = [];

  // Walk backwards from current position to entry (index 0)
  for (let i = fromIndex - 1; i >= 0; i--) {
    cells.push(path[i]);
  }

  return cells;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface GameProviderProps {
  config: GameConfig;
  playerNames: Record<string, string>;
  children: ReactNode;
}

export function GameProvider({ config, playerNames, children }: GameProviderProps) {
  const engineRef = useRef<GameEngine | null>(null);

  if (!engineRef.current) {
    engineRef.current = new GameEngine(config, playerNames);
  }
  const engine = engineRef.current;

  const [gameState, setGameState] = useState<GameState>(engine.getState() as GameState);
  const [animatingPawn, setAnimatingPawn] = useState<AnimatingPawn | null>(null);
  const [killedAnimatingPawn, setKilledAnimatingPawn] = useState<AnimatingPawn | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const unsub = engine.on('stateChange', (event) => {
      setGameState(event.data as GameState);
    });
    return unsub;
  }, [engine]);

  const roll = useCallback(() => {
    if (isAnimating) return null;
    return engine.roll();
  }, [engine, isAnimating]);

  // Helper: for dice value 8, auto-enter a second outside pawn
  const autoEnterSecondPawn = useCallback((firstPawnId: string) => {
    // After the first entry move executes, the engine state has advanced.
    // Check if the new state has WAITING_FOR_MOVE with another entry move available.
    const newState = engine.getState();
    if (newState.phase === GamePhase.WAITING_FOR_MOVE) {
      const secondEntry = newState.validMoves.find(
        (m) => m.isEntry && m.pawnId !== firstPawnId,
      );
      if (secondEntry) {
        playEntrySound();
        engine.selectMove(secondEntry);
      }
    }
  }, [engine]);

  const selectMove = useCallback((move: MoveAction) => {
    if (isAnimating) return;

    // Find the moving pawn
    let movingPawn: Pawn | undefined;
    for (const player of gameState.players.values()) {
      movingPawn = player.pawns.find((p) => p.id === move.pawnId);
      if (movingPawn) break;
    }
    if (!movingPawn) return;

    const playerId = movingPawn.playerId;
    const fromIndex = movingPawn.state === PawnState.OUTSIDE ? -1 : movingPawn.pathIndex;
    const toIndex = move.targetPathIndex;
    const forwardCells = getPathCellsForward(playerId, fromIndex, toIndex);

    // Find killed pawn info (before engine state changes)
    let killedPawn: Pawn | undefined;
    if (move.willKill && move.killTargets.length > 0) {
      for (const player of gameState.players.values()) {
        for (const p of player.pawns) {
          if (move.killTargets.includes(p.id)) {
            killedPawn = p;
            break;
          }
        }
        if (killedPawn) break;
      }
    }

    const FORWARD_STEP_MS = 250; // Slower forward movement
    const KILL_STEP_MS = 50;     // Fast reverse animation for kills

    // If no animation needed (single step, non-entry), just execute
    if (forwardCells.length <= 1 && !killedPawn && !move.isEntry) {
      if (toIndex === HOME_INDEX) playHomeSound();
      else playMoveSound();
      engine.selectMove(move);
      return;
    }

    // Play entry sound for board entry
    if (move.isEntry) playEntrySound();

    setIsAnimating(true);

    const movingPawnIds = move.isPairMove && move.pawnIds && move.pawnIds.length > 0
      ? move.pawnIds
      : [movingPawn.id];

    // Phase 1: animate moving pawn(s) forward
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
      playMoveSound(); // tap sound per step
      if (step >= forwardCells.length) {
        clearInterval(forwardInterval);
        if (toIndex === HOME_INDEX) playHomeSound();
        setAnimatingPawn(null);

        // Phase 2: if there's a killed pawn, animate it backwards
        if (killedPawn) {
          const reverseCells = getPathCellsReverse(killedPawn.playerId, killedPawn.pathIndex);

          playKillSound();

          if (reverseCells.length === 0) {
            // Already at entry, just execute
            engine.selectMove(move);
            setIsAnimating(false);
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
              setKilledAnimatingPawn(null);
              engine.selectMove(move);
              setIsAnimating(false);
            } else {
              setKilledAnimatingPawn({
                pawnIds: [killedPawn!.id],
                playerId: killedPawn!.playerId,
                currentCellId: reverseCells[killStep],
              });
            }
          }, KILL_STEP_MS);
        } else {
          // No kill — execute immediately
          engine.selectMove(move);
          // Double entry for value 8 (animated path)
          if (move.isEntry && gameState.lastDiceResult?.value === 8) {
            autoEnterSecondPawn(move.pawnId);
          }
          setIsAnimating(false);
        }
      } else {
        setAnimatingPawn({
          pawnIds: movingPawnIds,
          playerId,
          currentCellId: forwardCells[step],
        });
      }
    }, FORWARD_STEP_MS);
  }, [engine, gameState, isAnimating, autoEnterSecondPawn]);

  // Auto-move: if there's exactly 1 valid move, execute it automatically after a short delay.
  useEffect(() => {
    if (isAnimating) return;
    if (gameState.phase !== GamePhase.WAITING_FOR_MOVE) return;
    if (gameState.validMoves.length === 0) return;

    const moves = gameState.validMoves;
    
    if (moves.length === 1) {
      const timer = setTimeout(() => selectMove(moves[0]), 1000);
      return () => clearTimeout(timer);
    }

    const allSamePawnAndTarget = moves.every(
      m => m.pawnId === moves[0].pawnId && m.targetPathIndex === moves[0].targetPathIndex
    );
    if (allSamePawnAndTarget && moves.length > 0) {
      const timer = setTimeout(() => selectMove(moves[0]), 1000);
      return () => clearTimeout(timer);
    }
  }, [gameState.phase, gameState.validMoves, isAnimating, selectMove]);

  const value = {
    state: gameState,
    roll,
    selectMove,
    animatingPawn,
    killedAnimatingPawn,
    isAnimating,
    myPosition: gameState.currentTurn,
    isMyTurn: true,
  };

  return (
    <UnifiedGameProvider value={value}>
      {children}
    </UnifiedGameProvider>
  );
}
