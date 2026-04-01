// ============================================================================
// Tamarind Seed Dice — Uses real PNG images with 3D flip animation
// ============================================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { PlayerPosition } from '@shared/types';
import { useGame } from '../../contexts/UnifiedGameContext';
import { playRollSound } from '../../audio/SoundEngine';

const SEED_SCRATCHED = '/assets/dice/seed_scratched.png';
const SEED_DARK = '/assets/dice/seed_dark.png';

export function TamarindDice({ position }: { position: PlayerPosition }) {
  const { state, roll, isAnimating, isMyTurn, setIsRolling } = useGame();
  const [localIsRolling, setLocalIsRolling] = useState(false);
  const [seedAngles, setSeedAngles] = useState([0, 0, 0, 0]);
  const [seedYAngles, setSeedYAngles] = useState([0, 0, 0, 0]);
  const rollCountRef = useRef(0);
  const lastRollIdRef = useRef<number | string | null>(null);
  const pendingSeedsRef = useRef<boolean[] | null>(null);

  const isTurn = state.currentTurn === position;
  const canRoll = isMyTurn && isTurn && state.phase === 'WAITING_FOR_ROLL' && !localIsRolling && !isAnimating;

  // ─── Sync Animation with State ───
  useEffect(() => {
    const result = state.lastDiceResult;
    if (!result) return;

    const currentRollId = result.timestamp || `${state.turnNumber}-${result.value}`;
    if (lastRollIdRef.current === currentRollId) return;
    lastRollIdRef.current = currentRollId;

    if (localIsRolling) {
      // If we are already animating (as the roller), capture the new seeds
      // so the animation can snap to them when it finishes.
      pendingSeedsRef.current = result.seeds;
    } else if (state.phase === 'WAITING_FOR_MOVE') {
      // Only trigger animation if we just transitioned to the Move phase (i.e. a roll just happened)
      animateLocally(result.seeds);
    }
  }, [state.lastDiceResult, state.turnNumber, localIsRolling]);

  const animateLocally = (seeds: boolean[]) => {
    setIsRolling(true);
    setLocalIsRolling(true);
    playRollSound();

    let frame = 0;
    const totalFrames = 16;
    const interval = setInterval(() => {
      frame++;
      const speed = 1 - (frame / totalFrames) * 0.8;
      setSeedAngles((prev) =>
        prev.map((a) => a + (Math.random() * 260 + 120) * speed * (Math.random() > 0.5 ? 1 : -1)),
      );
      setSeedYAngles((prev) =>
        prev.map((a) => a + (Math.random() * 40 - 20) * speed),
      );

      if (frame >= totalFrames) {
        clearInterval(interval);
        setSeedAngles(seeds.map((isWhite) => (isWhite ? 0 : 180)));
        setSeedYAngles([0, 0, 0, 0]);
        setLocalIsRolling(false);
        setTimeout(() => setIsRolling(false), 200); // Small buffer
      }
    }, 90);
  };

  const handleRoll = useCallback(() => {
    if (!canRoll) return;

    // 1. Reset pending seeds
    pendingSeedsRef.current = null;

    // 2. Start local animation
    setIsRolling(true);
    setLocalIsRolling(true);
    playRollSound();

    // 3. Emit roll immediately (Online) or calculate (Local)
    const immediateResult = roll();
    if (immediateResult) {
      pendingSeedsRef.current = immediateResult.seeds;
    }

    const count = ++rollCountRef.current;
    let frame = 0;
    const totalFrames = 16;

    const interval = setInterval(() => {
      frame++;
      const speed = 1 - (frame / totalFrames) * 0.8;
      setSeedAngles((prev) =>
        prev.map((a) => a + (Math.random() * 260 + 120) * speed * (Math.random() > 0.5 ? 1 : -1)),
      );
      setSeedYAngles((prev) =>
        prev.map((a) => a + (Math.random() * 40 - 20) * speed),
      );

      if (frame >= totalFrames) {
        clearInterval(interval);
        if (rollCountRef.current === count) {
          // Use result from pendingSeeds (which could be from the immediate local roll
          // OR from the useEffect capturing the server's response during animation)
          const finalSeeds = pendingSeedsRef.current || state.lastDiceResult?.seeds;
          
          if (finalSeeds) {
            setSeedAngles(finalSeeds.map((isWhite) => (isWhite ? 0 : 180)));
            setSeedYAngles([0, 0, 0, 0]);
            setLocalIsRolling(false);
            setTimeout(() => setIsRolling(false), 200); // Small buffer
          } else {
            // Fallback: if result hasn't arrived at all, keep shaking or wait
            setLocalIsRolling(false);
            setIsRolling(false);
          }
        }
      }
    }, 90);
  }, [canRoll, roll, state.lastDiceResult, setIsRolling]);

  return (
    <div
      className={`
        grid grid-cols-2 grid-rows-2 gap-0.5 p-0.5 rounded-lg transition-all duration-150
        ${canRoll ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'}
        ${isTurn ? '' : 'opacity-25'}
      `}
      onClick={handleRoll}
      role={canRoll ? 'button' : undefined}
      tabIndex={canRoll ? 0 : undefined}
      style={{ perspective: '300px' }}
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="relative"
          style={{
            width: '22px',
            height: '18px',
            transformStyle: 'preserve-3d',
            transform: `rotateX(${seedAngles[i]}deg) rotateY(${seedYAngles[i]}deg)`,
            transition: localIsRolling
              ? 'transform 0.06s linear'
              : 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <img
            src={SEED_SCRATCHED}
            alt="seed scratched"
            className="absolute inset-0 w-full h-full object-contain"
            style={{ backfaceVisibility: 'hidden' }}
            draggable={false}
          />
          <img
            src={SEED_DARK}
            alt="seed dark"
            className="absolute inset-0 w-full h-full object-contain"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateX(180deg)' }}
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
}
