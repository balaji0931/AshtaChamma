import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateEnv } from './env.js';
import { initDB, query } from './db.js';
import { registerSocketHandlers } from './socket/handlers.js';
import * as RoomManager from './rooms/RoomManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = validateEnv();

const app = express();
app.use(express.json({ limit: '16kb' })); // Prevent large payload attacks

// ─── Security Headers ───────────────────────────────────────────────────────
app.use((_req, res, next) => {
  // Prevent XSS
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Permissions policy (disable unused APIs)
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use((_req, res, next) => {
  const origin = env.NODE_ENV === 'production'
    ? (env.CLIENT_URL || _req.headers.origin || '*')
    : '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// ─── Static Assets with aggressive caching ───────────────────────────────────
const distPath = path.join(__dirname, '../dist');

// Hashed assets (JS/CSS/images) — cache for 1 year (immutable, Vite hashes filenames)
app.use('/assets', express.static(path.join(distPath, 'assets'), {
  maxAge: '365d',
  immutable: true,
}));

// Public assets (board images, pawn PNGs, sounds) — cache for 7 days
app.use('/assets', express.static(path.join(__dirname, '../public/assets'), {
  maxAge: '7d',
}));

// Remaining static files (index.html etc.) — short cache
app.use(express.static(distPath, {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    // Never cache index.html (SPA entry point)
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  },
}));

// ─── API Routes ──────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Check room existence and privacy (public endpoint, no session needed)
app.get('/api/rooms/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase().trim();
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      res.status(400).json({ error: 'Invalid room code' });
      return;
    }

    const result = await query(
      `SELECT r.is_private, r.status, r.config,
              (SELECT COUNT(*) FROM room_players WHERE room_id = r.id) as player_count
       FROM rooms r WHERE r.code = $1`,
      [code],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    const room = result.rows[0];
    const config = room.config as { playerCount: number };

    res.json({
      exists: true,
      isPrivate: room.is_private,
      status: room.status,
      playerCount: parseInt(room.player_count as string, 10),
      maxPlayers: config.playerCount,
    });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get environment config (APK download URL etc.)
app.get('/api/config', (_req, res) => {
  res.json({
    apkDownloadUrl: env.APK_DOWNLOAD_URL || null,
  });
});

// ─── SPA Fallback ────────────────────────────────────────────────────────────
app.get('{*path}', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ─── Socket.io ───────────────────────────────────────────────────────────────
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    // Same-origin in production (Render), allow all in dev
    origin: env.NODE_ENV === 'production'
      ? (env.CLIENT_URL || true)  // true = allow same origin
      : '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
  maxHttpBufferSize: 1e5, // 100KB — prevent large payload attacks
});

registerSocketHandlers(io);

// ─── Room Cleanup Job (every 5 minutes, only when rooms exist) ───────────────
async function cleanupStaleRooms(): Promise<void> {
  // Skip DB query entirely if no rooms are active in memory
  const activeCount = RoomManager.getActiveRoomCount();
  if (activeCount === 0) return;

  try {
    // Delete WAITING rooms older than 30 minutes
    const waiting = await query(
      `DELETE FROM rooms WHERE status = 'WAITING' AND created_at < NOW() - INTERVAL '30 minutes'`,
    );

    // Delete FINISHED rooms older than 5 minutes
    const finished = await query(
      `DELETE FROM rooms WHERE status = 'FINISHED' AND updated_at < NOW() - INTERVAL '5 minutes'`,
    );

    const total = (waiting.rowCount ?? 0) + (finished.rowCount ?? 0);
    if (total > 0) {
      console.log(`🧹 Cleaned up ${total} stale room(s)`);
    }
  } catch (err) {
    console.error('Room cleanup error:', (err as Error).message);
  }
}

setInterval(cleanupStaleRooms, 5 * 60 * 1000);

// ─── Start Server ────────────────────────────────────────────────────────────
async function start(): Promise<void> {
  await initDB();
  httpServer.listen(env.PORT, () => {
    console.log(`🚀 Server running on port ${env.PORT} (${env.NODE_ENV})`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
