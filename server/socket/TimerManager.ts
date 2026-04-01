// ============================================================================
// Timer Manager — Server-side roll/move countdown timers
// ============================================================================

import type { PlayerPosition } from '../../shared/types.js';

const ROLL_TIMEOUT_MS = 20_000;  // 20 seconds to roll
const MOVE_TIMEOUT_MS = 60_000;  // 60 seconds (1 minute) to make a move

interface RoomTimers {
  rollTimer: NodeJS.Timeout | null;
  moveTimer: NodeJS.Timeout | null;
  rollStartedAt: number | null;
  moveStartedAt: number | null;
  currentPosition: PlayerPosition | null;
}

export class TimerManager {
  private timers: Map<string, RoomTimers> = new Map();

  private getOrCreate(roomCode: string): RoomTimers {
    let t = this.timers.get(roomCode);
    if (!t) {
      t = {
        rollTimer: null,
        moveTimer: null,
        rollStartedAt: null,
        moveStartedAt: null,
        currentPosition: null,
      };
      this.timers.set(roomCode, t);
    }
    return t;
  }

  // ─── Roll Timer ──────────────────────────────────────────

  startRollTimer(
    roomCode: string,
    position: PlayerPosition,
    onExpire: () => void,
  ): void {
    const t = this.getOrCreate(roomCode);
    this.clearRollTimer(roomCode);
    t.currentPosition = position;
    t.rollStartedAt = Date.now();
    t.rollTimer = setTimeout(() => {
      t.rollTimer = null;
      t.rollStartedAt = null;
      onExpire();
    }, ROLL_TIMEOUT_MS);
  }

  clearRollTimer(roomCode: string): void {
    const t = this.timers.get(roomCode);
    if (t?.rollTimer) {
      clearTimeout(t.rollTimer);
      t.rollTimer = null;
      t.rollStartedAt = null;
    }
  }

  getRollRemaining(roomCode: string): number {
    const t = this.timers.get(roomCode);
    if (!t?.rollStartedAt) return 0;
    return Math.max(0, ROLL_TIMEOUT_MS - (Date.now() - t.rollStartedAt));
  }

  // ─── Move Timer ──────────────────────────────────────────

  startMoveTimer(
    roomCode: string,
    position: PlayerPosition,
    onExpire: () => void,
  ): void {
    const t = this.getOrCreate(roomCode);
    this.clearMoveTimer(roomCode);
    t.currentPosition = position;
    t.moveStartedAt = Date.now();
    t.moveTimer = setTimeout(() => {
      t.moveTimer = null;
      t.moveStartedAt = null;
      onExpire();
    }, MOVE_TIMEOUT_MS);
  }

  clearMoveTimer(roomCode: string): void {
    const t = this.timers.get(roomCode);
    if (t?.moveTimer) {
      clearTimeout(t.moveTimer);
      t.moveTimer = null;
      t.moveStartedAt = null;
    }
  }

  getMoveRemaining(roomCode: string): number {
    const t = this.timers.get(roomCode);
    if (!t?.moveStartedAt) return 0;
    return Math.max(0, MOVE_TIMEOUT_MS - (Date.now() - t.moveStartedAt));
  }

  // ─── Cleanup ─────────────────────────────────────────────

  clearAll(roomCode: string): void {
    this.clearRollTimer(roomCode);
    this.clearMoveTimer(roomCode);
    this.timers.delete(roomCode);
  }

  getCurrentPosition(roomCode: string): PlayerPosition | null {
    return this.timers.get(roomCode)?.currentPosition ?? null;
  }
}

export const timerManager = new TimerManager();
