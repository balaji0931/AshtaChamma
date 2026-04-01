// ============================================================================
// Timer Bar — Countdown display for roll/move deadlines
// ============================================================================

import { useEffect, useState } from 'react';
import type { TimerSync, PlayerPosition } from '@shared/types';

const PLAYER_COLORS: Record<string, string> = {
  A: '#dc2626',
  B: '#059669',
  C: '#ca8a04',
  D: '#2563eb',
};

interface TimerBarProps {
  timer: TimerSync | null;
  isMyTurn: boolean;
}

export function TimerBar({ timer, isMyTurn }: TimerBarProps) {
  const [remaining, setRemaining] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!timer) {
      setRemaining(0);
      return;
    }

    setRemaining(timer.remainingMs);
    setTotal(timer.type === 'roll' ? 20_000 : 60_000);

    const interval = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 100));
    }, 100);

    return () => clearInterval(interval);
  }, [timer]);

  if (!timer || remaining <= 0) return null;

  const percent = (remaining / total) * 100;
  const seconds = Math.ceil(remaining / 1000);
  const isUrgent = seconds <= 3;
  const color = PLAYER_COLORS[timer.forPosition] || '#78716c';

  return (
    <div className="w-full px-2 py-1">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-100 ${isUrgent ? 'animate-pulse' : ''}`}
            style={{
              width: `${percent}%`,
              backgroundColor: color,
            }}
          />
        </div>
        <span
          className={`text-xs font-bold tabular-nums min-w-[2ch] text-right ${isUrgent ? 'text-red-500 animate-pulse' : 'text-stone-500'
            }`}
        >
          {seconds}s
        </span>
      </div>
    </div>
  );
}
