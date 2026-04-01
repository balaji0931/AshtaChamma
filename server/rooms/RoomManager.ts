// ============================================================================
// Room Manager — CRUD, code generation, player assignment
// ============================================================================

import bcrypt from 'bcryptjs';
import { query, transaction } from '../db.js';
import type { PlayerPosition, GameConfig } from '../../shared/types.js';
import { DEFAULT_POSITIONS } from '../../shared/constants.js';
import type { ActiveRoom, RoomRecord, RoomPlayerRecord } from './RoomTypes.js';
import { GameEngine } from '../engine/GameEngine.js';

// In-memory store for active rooms (engine instances + socket mappings)
const activeRooms = new Map<string, ActiveRoom>();

// Max concurrent active rooms (WAITING + IN_PROGRESS)
const MAX_ROOMS = 30;

// ---------------------------------------------------------------------------
// Code Generation
// ---------------------------------------------------------------------------

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 for clarity
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function generateUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateRoomCode();
    const existing = await query('SELECT id FROM rooms WHERE code = $1', [code]);
    if (existing.rows.length === 0) return code;
  }
  throw new Error('Failed to generate unique room code after 10 attempts');
}

// ---------------------------------------------------------------------------
// Room CRUD
// ---------------------------------------------------------------------------

export async function createRoom(
  hostToken: string,
  config: GameConfig,
  displayName: string,
  isPrivate: boolean,
  passcode?: string,
): Promise<{ code: string; roomId: string; position: PlayerPosition }> {
  // Check room limit
  const activeCount = getActiveRoomCount();
  if (activeCount >= MAX_ROOMS) {
    throw new Error('Server is busy. Please try again in a few minutes.');
  }

  const code = await generateUniqueCode();
  const passcodeHash = passcode ? await bcrypt.hash(passcode, 10) : null;
  const firstPosition = config.activePositions[0];

  const roomResult = await transaction(async (client) => {
    const roomRes = await client.query<RoomRecord>(
      `INSERT INTO rooms (code, host_token, is_private, passcode_hash, config, status)
       VALUES ($1, $2, $3, $4, $5, 'WAITING')
       RETURNING *`,
      [code, hostToken, isPrivate, passcodeHash, JSON.stringify(config)],
    );

    const room = roomRes.rows[0];

    await client.query(
      `INSERT INTO room_players (room_id, session_token, display_name, position, is_ready)
       VALUES ($1, $2, $3, $4, true)`,
      [room.id, hostToken, displayName, firstPosition],
    );

    return room;
  });

  // Create in-memory room
  const activeRoom: ActiveRoom = {
    id: roomResult.id,
    code,
    hostToken,
    config,
    status: 'WAITING',
    isPrivate,
    engine: null,
    socketMap: new Map(),
    positionMap: new Map([[firstPosition, hostToken]]),
    actionQueue: Promise.resolve(),
    disconnectGrace: new Map(),
  };

  activeRooms.set(code, activeRoom);

  return { code, roomId: roomResult.id, position: firstPosition };
}

export async function joinRoom(
  code: string,
  sessionToken: string,
  displayName: string,
  passcode?: string,
): Promise<{ roomId: string; position: PlayerPosition; config: GameConfig }> {
  const roomRes = await query<RoomRecord>(
    'SELECT * FROM rooms WHERE code = $1',
    [code],
  );

  if (roomRes.rows.length === 0) {
    throw new Error('Room not found');
  }

  const room = roomRes.rows[0];

  if (room.status !== 'WAITING') {
    // Check if this player was part of the game (allows reconnection)
    const existingPlayer = await query<RoomPlayerRecord>(
      'SELECT * FROM room_players WHERE room_id = $1 AND session_token = $2',
      [room.id, sessionToken],
    );
    if (existingPlayer.rows.length > 0 && existingPlayer.rows[0].position) {
      // This is a returning player — signal reconnection
      const err = new Error('RECONNECT_NEEDED');
      (err as any).position = existingPlayer.rows[0].position;
      (err as any).roomId = room.id;
      throw err;
    }
    throw new Error('Game already in progress');
  }

  if (room.is_private && room.passcode_hash) {
    if (!passcode) throw new Error('Passcode required');
    const valid = await bcrypt.compare(passcode, room.passcode_hash);
    if (!valid) throw new Error('Invalid passcode');
  }

  // Atomic capacity check + insert using FOR UPDATE
  const position = await transaction(async (client) => {
    // Lock room row to prevent race conditions
    await client.query('SELECT id FROM rooms WHERE id = $1 FOR UPDATE', [room.id]);

    const playersRes = await client.query<RoomPlayerRecord>(
      'SELECT * FROM room_players WHERE room_id = $1 ORDER BY joined_at',
      [room.id],
    );

    // Check if already in room
    const existing = playersRes.rows.find((p) => p.session_token === sessionToken);
    if (existing) {
      if (existing.position) return existing.position;
      throw new Error('Already in room without position');
    }

    const config = room.config as unknown as GameConfig;
    const maxPlayers = config.playerCount;

    if (playersRes.rows.length >= maxPlayers) {
      throw new Error('Room is full');
    }

    // Find next available position
    const takenPositions = new Set(playersRes.rows.map((p) => p.position));
    const availablePositions = config.activePositions.filter(
      (pos) => !takenPositions.has(pos),
    );

    if (availablePositions.length === 0) {
      throw new Error('No positions available');
    }

    const assignedPosition = availablePositions[0];

    await client.query(
      `INSERT INTO room_players (room_id, session_token, display_name, position)
       VALUES ($1, $2, $3, $4)`,
      [room.id, sessionToken, displayName, assignedPosition],
    );

    return assignedPosition;
  });

  // Update in-memory room
  let activeRoom = activeRooms.get(code);
  if (!activeRoom) {
    activeRoom = {
      id: room.id,
      code,
      hostToken: room.host_token,
      config: room.config as unknown as GameConfig,
      status: 'WAITING',
      isPrivate: room.is_private,
      engine: null,
      socketMap: new Map(),
      positionMap: new Map(),
      actionQueue: Promise.resolve(),
      disconnectGrace: new Map(),
    };
    activeRooms.set(code, activeRoom);
  }

  activeRoom.positionMap.set(position as PlayerPosition, sessionToken);

  return {
    roomId: room.id,
    position: position as PlayerPosition,
    config: room.config as unknown as GameConfig,
  };
}

export async function kickPlayer(
  code: string,
  hostToken: string,
  targetPosition: PlayerPosition,
): Promise<void> {
  const room = activeRooms.get(code);
  if (!room) throw new Error('Room not found');
  if (room.hostToken !== hostToken) throw new Error('Only host can kick');
  if (room.status !== 'WAITING') throw new Error('Cannot kick during game');

  await query(
    `DELETE FROM room_players WHERE room_id = $1 AND position = $2`,
    [room.id, targetPosition],
  );

  room.positionMap.delete(targetPosition);
}

export async function toggleReady(
  code: string,
  sessionToken: string,
): Promise<boolean> {
  const room = activeRooms.get(code);
  if (!room) throw new Error('Room not found');

  const result = await query<{ is_ready: boolean }>(
    `UPDATE room_players SET is_ready = NOT is_ready
     WHERE room_id = $1 AND session_token = $2
     RETURNING is_ready`,
    [room.id, sessionToken],
  );

  if (result.rows.length === 0) throw new Error('Player not in room');
  return result.rows[0].is_ready;
}

export async function updateConfig(
  code: string,
  hostToken: string,
  config: GameConfig,
): Promise<void> {
  const room = activeRooms.get(code);
  if (!room) throw new Error('Room not found');
  if (room.hostToken !== hostToken) throw new Error('Only host can update config');
  if (room.status !== 'WAITING') throw new Error('Cannot update during game');

  await query(
    'UPDATE rooms SET config = $1, updated_at = NOW() WHERE id = $2',
    [JSON.stringify(config), room.id],
  );

  room.config = config;
}

export async function startGame(
  code: string,
  hostToken: string,
): Promise<GameEngine> {
  const room = activeRooms.get(code);
  if (!room) throw new Error('Room not found');
  if (room.hostToken !== hostToken) throw new Error('Only host can start');

  // Room lock: prevent race condition on start
  if (room.status !== 'WAITING') throw new Error('Game already starting or in progress');
  room.status = 'STARTING';

  try {
    const playersRes = await query<RoomPlayerRecord>(
      'SELECT * FROM room_players WHERE room_id = $1 ORDER BY joined_at',
      [room.id],
    );

    const players = playersRes.rows;
    const config = room.config;

    // Validate all players are ready
    const notReady = players.filter((p) => !p.is_ready);
    if (notReady.length > 0) {
      room.status = 'WAITING';
      throw new Error('Not all players are ready');
    }

    if (players.length < 2) {
      room.status = 'WAITING';
      throw new Error('Need at least 2 players');
    }

    // Build player names
    const playerNames: Record<string, string> = {};
    for (const p of players) {
      if (p.position) {
        playerNames[p.position] = p.display_name;
      }
    }

    // Create engine
    const engine = new GameEngine(config, playerNames);
    room.engine = engine;
    room.status = 'IN_PROGRESS';

    // Update DB
    await query(
      `UPDATE rooms SET status = 'IN_PROGRESS', game_state = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(engine.getSerializableState()), room.id],
    );

    return engine;
  } catch (err) {
    if (room.status === 'STARTING') room.status = 'WAITING';
    throw err;
  }
}

export async function leaveRoom(
  code: string,
  sessionToken: string,
): Promise<PlayerPosition | null> {
  const room = activeRooms.get(code);
  if (!room) return null;

  const result = await query<{ position: string }>(
    'DELETE FROM room_players WHERE room_id = $1 AND session_token = $2 RETURNING position',
    [room.id, sessionToken],
  );

  if (result.rows.length === 0) return null;

  const position = result.rows[0].position as PlayerPosition;
  room.positionMap.delete(position);
  room.socketMap.delete(sessionToken);

  // If room is empty, clean up
  const remaining = await query(
    'SELECT COUNT(*) as count FROM room_players WHERE room_id = $1',
    [room.id],
  );

  if (parseInt(remaining.rows[0].count as string, 10) === 0) {
    await query('DELETE FROM rooms WHERE id = $1', [room.id]);
    activeRooms.delete(code);
  }

  return position;
}

export async function getPlayersInRoom(
  code: string,
): Promise<RoomPlayerRecord[]> {
  const room = activeRooms.get(code);
  if (!room) return [];

  const result = await query<RoomPlayerRecord>(
    'SELECT * FROM room_players WHERE room_id = $1 ORDER BY joined_at',
    [room.id],
  );

  return result.rows;
}

export async function reconnectPlayer(
  code: string,
  sessionToken: string,
): Promise<{ position: PlayerPosition; config: GameConfig } | null> {
  const room = activeRooms.get(code);
  if (!room) return null;

  const result = await query<RoomPlayerRecord>(
    `UPDATE room_players SET is_connected = true, disconnect_turns = 0
     WHERE room_id = $1 AND session_token = $2
     RETURNING *`,
    [room.id, sessionToken],
  );

  if (result.rows.length === 0) return null;

  const player = result.rows[0];
  if (!player.position) return null;

  // Clear grace timer
  const graceTimer = room.disconnectGrace.get(player.position as PlayerPosition);
  if (graceTimer) {
    clearTimeout(graceTimer);
    room.disconnectGrace.delete(player.position as PlayerPosition);
  }

  // Update engine
  if (room.engine) {
    room.engine.setPlayerConnected(player.position as PlayerPosition, true);
  }

  return {
    position: player.position as PlayerPosition,
    config: room.config,
  };
}

export async function saveGameState(code: string): Promise<void> {
  const room = activeRooms.get(code);
  if (!room?.engine) return;

  await query(
    'UPDATE rooms SET game_state = $1, updated_at = NOW() WHERE id = $2',
    [JSON.stringify(room.engine.getSerializableState()), room.id],
  );
}

export async function finishGame(code: string): Promise<void> {
  const room = activeRooms.get(code);
  if (!room) return;

  room.status = 'FINISHED';

  await query(
    `UPDATE rooms SET status = 'FINISHED', game_state = $1, updated_at = NOW() WHERE id = $2`,
    [room.engine ? JSON.stringify(room.engine.getSerializableState()) : null, room.id],
  );

  // Cleanup engine
  room.engine?.destroy();
  room.engine = null;

  // Clear grace timers
  for (const timer of room.disconnectGrace.values()) {
    clearTimeout(timer);
  }
  room.disconnectGrace.clear();
}

export function getActiveRoom(code: string): ActiveRoom | undefined {
  return activeRooms.get(code);
}

export function getActiveRoomByToken(sessionToken: string): { room: ActiveRoom; position: PlayerPosition } | undefined {
  for (const room of activeRooms.values()) {
    for (const [pos, token] of room.positionMap) {
      if (token === sessionToken) {
        return { room, position: pos };
      }
    }
  }
  return undefined;
}

export function removeActiveRoom(code: string): void {
  const room = activeRooms.get(code);
  if (room) {
    room.engine?.destroy();
    for (const timer of room.disconnectGrace.values()) {
      clearTimeout(timer);
    }
    activeRooms.delete(code);
  }
}

/** Get count of active (non-finished) rooms */
export function getActiveRoomCount(): number {
  let count = 0;
  for (const room of activeRooms.values()) {
    if (room.status !== 'FINISHED') count++;
  }
  return count;
}
