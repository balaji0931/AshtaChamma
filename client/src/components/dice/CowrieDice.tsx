// ============================================================================
// Cowrie Shell Dice — Uses real PNG images with CSS 3D flip
// ============================================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { PlayerPosition } from '@shared/types';
import { useGame } from '../../contexts/UnifiedGameContext';
import { playRollSound } from '../../audio/SoundEngine';

const COWRIE_OPEN = '/assets/dice/cowrie_open.png';
const COWRIE_CLOSED = '/assets/dice/cowrie_closed.png';

export function CowrieDice({ position }: { position: PlayerPosition }) {
  const { state, roll, isAnimating, isMyTurn } = useGame();
  const [isRolling, setIsRolling] = useState(false);
  const [shellAngles, setShellAngles] = useState([0, 0, 0, 0]);
  const [shellYAngles, setShellYAngles] = useState([0, 0, 0, 0]);
  const rollCountRef = useRef(0);
  const lastRollIdRef = useRef<number | string | null>(null);
  const pendingSeedsRef = useRef<boolean[] | null>(null);

  const isTurn = state.currentTurn === position;
  const canRoll = isMyTurn && isTurn && state.phase === 'WAITING_FOR_ROLL' && !isRolling && !isAnimating;

  // ─── Sync Animation with State ───
  useEffect(() => {
    const result = state.lastDiceResult;
    if (!result) return;

    const currentRollId = result.timestamp || `${state.turnNumber}-${result.value}`;
    if (lastRollIdRef.current === currentRollId) return;
    lastRollIdRef.current = currentRollId;

    if (isRolling) {
      pendingSeedsRef.current = result.seeds;
    } else if (state.phase === 'WAITING_FOR_MOVE') {
      animateLocally(result.seeds);
    }
  }, [state.lastDiceResult, state.turnNumber, isRolling]);

  const animateLocally = (seeds: boolean[]) => {
    setIsRolling(true);
    playRollSound();

    let frame = 0;
    const totalFrames = 16;
    const interval = setInterval(() => {
      frame++;
      const speed = 1 - (frame / totalFrames) * 0.8;
      setShellAngles((prev) =>
        prev.map((a) => a + (Math.random() * 260 + 120) * speed * (Math.random() > 0.5 ? 1 : -1)),
      );
      setShellYAngles((prev) =>
        prev.map((a) => a + (Math.random() * 30 - 15) * speed),
      );

      if (frame >= totalFrames) {
        clearInterval(interval);
        setShellAngles(seeds.map((isOpen) => (isOpen ? 0 : 180)));
        setShellYAngles([0, 0, 0, 0]);
        setIsRolling(false);
      }
    }, 90);
  };

  const handleRoll = useCallback(() => {
    if (!canRoll) return;

    pendingSeedsRef.current = null;
    setIsRolling(true);
    playRollSound();

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
      setShellAngles((prev) =>
        prev.map((a) => a + (Math.random() * 260 + 120) * speed * (Math.random() > 0.5 ? 1 : -1)),
      );
      setShellYAngles((prev) =>
        prev.map((a) => a + (Math.random() * 30 - 15) * speed),
      );

      if (frame >= totalFrames) {
        clearInterval(interval);
        if (rollCountRef.current === count) {
          const finalSeeds = pendingSeedsRef.current || state.lastDiceResult?.seeds;
          if (finalSeeds) {
            setShellAngles(finalSeeds.map((isOpen) => (isOpen ? 0 : 180)));
            setShellYAngles([0, 0, 0, 0]);
            setIsRolling(false);
          } else {
            setIsRolling(false);
          }
        }
      }
    }, 90);
  }, [canRoll, roll, state.lastDiceResult]);

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
            width: '24px',
            height: '18px',
            transformStyle: 'preserve-3d',
            transform: `rotateX(${shellAngles[i]}deg) rotateY(${shellYAngles[i]}deg)`,
            transition: isRolling
              ? 'transform 0.06s linear'
              : 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <img
            src={COWRIE_OPEN}
            alt="cowrie open"
            className="absolute inset-0 w-full h-full object-contain"
            style={{ backfaceVisibility: 'hidden' }}
            draggable={false}
          />
          <img
            src={COWRIE_CLOSED}
            alt="cowrie closed"
            className="absolute inset-0 w-full h-full object-contain"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateX(180deg)' }}
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
}
