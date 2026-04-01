// ============================================================================
// Auth Middleware — Session token + rate limiting for Socket.io
// ============================================================================

import type { Socket } from 'socket.io';

// ---------------------------------------------------------------------------
// Session Token Validation
// ---------------------------------------------------------------------------

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateSessionToken(token: unknown): string | null {
  if (typeof token !== 'string') return null;
  if (!UUID_REGEX.test(token)) return null;
  return token;
}

// ---------------------------------------------------------------------------
// Input Validation
// ---------------------------------------------------------------------------

export function validateRoomCode(code: unknown): string | null {
  if (typeof code !== 'string') return null;
  const cleaned = code.toUpperCase().trim();
  if (!/^[A-Z0-9]{6}$/.test(cleaned)) return null;
  return cleaned;
}

export function validateDisplayName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const cleaned = name.trim();
  if (cleaned.length === 0 || cleaned.length > 30) return null;
  // Strip any HTML/script tags
  return cleaned.replace(/<[^>]*>/g, '');
}

export function validatePasscode(passcode: unknown): string | null {
  if (passcode === undefined || passcode === null) return null;
  if (typeof passcode !== 'string') return null;
  if (passcode.length === 0 || passcode.length > 20) return null;
  return passcode;
}

// ---------------------------------------------------------------------------
// Rate Limiter (per socket)
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimits = new Map<string, RateLimitEntry>();

const MAX_EVENTS_PER_SECOND = 10;
const RATE_WINDOW_MS = 1000;

export function checkRateLimit(socketId: string): boolean {
  const now = Date.now();
  let entry = rateLimits.get(socketId);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + RATE_WINDOW_MS };
    rateLimits.set(socketId, entry);
    return true;
  }

  entry.count++;
  return entry.count <= MAX_EVENTS_PER_SECOND;
}

export function clearRateLimit(socketId: string): void {
  rateLimits.delete(socketId);
}

// Periodic cleanup of stale entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimits) {
    if (now >= entry.resetAt) {
      rateLimits.delete(key);
    }
  }
}, 60_000);

// ---------------------------------------------------------------------------
// Socket Auth Middleware
// ---------------------------------------------------------------------------

export function authenticateSocket(socket: Socket, next: (err?: Error) => void): void {
  const token = socket.handshake.auth?.token;
  const validToken = validateSessionToken(token);

  if (!validToken) {
    next(new Error('Invalid session token'));
    return;
  }

  // Attach token to socket data
  (socket.data as { sessionToken: string }).sessionToken = validToken;
  next();
}
