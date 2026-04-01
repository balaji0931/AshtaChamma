// ============================================================================
// Socket.io Event Handlers — All room + game events
// ============================================================================

import type { Server, Socket } from 'socket.io';
import {
  type GameConfig,
  type PlayerPosition,
  type LobbyPlayer,
  GamePhase,
  PlayStyle,
} from '../../shared/types.js';
import {
  authenticateSocket,
  checkRateLimit,
  clearRateLimit,
  validateRoomCode,
  validateDisplayName,
  validatePasscode,
} from '../middleware/auth.js';
import * as RoomManager from '../rooms/RoomManager.js';
import { timerManager } from './TimerManager.js';
import { query } from '../db.js';
import type { RoomPlayerRecord } from '../rooms/RoomTypes.js';
import { AppError } from '../utils/errors.js';

// Disconnect grace period before counting auto-turns (10 seconds)
const DISCONNECT_GRACE_MS = 10_000;
// Max auto-turns before abandonment in normal mode
const MAX_DISCONNECT_TURNS = 3;

// ---------------------------------------------------------------------------
// Helper: get session token from socket
// ---------------------------------------------------------------------------

function getToken(socket: Socket): string {
  return (socket.data as { sessionToken: string }).sessionToken;
}

/**
 * Emit a safe, user-friendly error to the client.
 * Logs internal details only on the server.
 */
function emitError(socket: Socket, error: unknown, defaultCode = 'SERVER_ERROR'): void {
  if (error instanceof AppError) {
    // If it's a known AppError, we use its code and message (if public)
    const message = error.isPublic ? error.message : 'An internal server error occurred. Please try again.';
    socket.emit('error', { code: error.code, message });
    
    // Log non-public errors for developer troubleshooting
    if (!error.isPublic) {
      console.error(`[Internal Error] ${error.code}: ${error.message}`, error.stack);
    }
    return;
  }

  // Handle unexpected errors (database, network, etc.)
  const message = 'A connection or server error occurred. Please try again later.';
  console.error(`[Unexpected Error] ${defaultCode}:`, error);
  socket.emit('error', { code: defaultCode, message });
}

// ---------------------------------------------------------------------------
// Helper: enqueue room action for sequential execution
// ---------------------------------------------------------------------------

function enqueueRoomAction(roomCode: string, action: () => Promise<void> | void): void {
  const room = RoomManager.getActiveRoom(roomCode);
  if (!room) return;
  room.actionQueue = room.actionQueue.then(async () => {
    try {
      await action();
    } catch (err) {
      // Internal actions shouldn't crash the queue, but we should log them
      console.error(`[Room Action Error] ${roomCode}:`, err);
    }
  });
}

// ---------------------------------------------------------------------------
// Helper: build lobby player list
// ---------------------------------------------------------------------------

async function buildLobbyPlayers(roomCode: string): Promise<LobbyPlayer[]> {
  const players = await RoomManager.getPlayersInRoom(roomCode);
  const room = RoomManager.getActiveRoom(roomCode);
  if (!room) return [];

  return players.map((p): LobbyPlayer => ({
    sessionToken: p.session_token.slice(-4),
    displayName: p.display_name,
    position: p.position as PlayerPosition | null,
    isReady: p.is_ready,
    isConnected: p.is_connected,
    isHost: p.session_token === room.hostToken,
  }));
}

// ---------------------------------------------------------------------------
// Helper: start timers after state change
// ---------------------------------------------------------------------------

function scheduleTimers(io: Server, roomCode: string): void {
  const room = RoomManager.getActiveRoom(roomCode);
  if (!room?.engine) return;

  const state = room.engine.getState();
  if (state.phase === GamePhase.GAME_OVER) return;

  const currentTurn = state.currentTurn;

  if (state.phase === GamePhase.WAITING_FOR_ROLL) {
    timerManager.startRollTimer(roomCode, currentTurn, () => {
      enqueueRoomAction(roomCode, async () => {
        if (!room.engine) return;
        const s = room.engine.getState();
        if (s.phase !== GamePhase.WAITING_FOR_ROLL) return;

        // Auto-roll
        const result = room.engine.roll();
        if (!result) return;
        result.timestamp = Date.now();

        io.to(roomCode).emit('game:auto-action', { type: 'roll', position: currentTurn });
        io.to(roomCode).emit('game:dice-rolled', { result, position: currentTurn });
        broadcastState(io, roomCode);

        // Check for auto-move or next timer
        await handlePostAction(io, roomCode);
      });
    });

    // Sync timer to clients
    io.to(roomCode).emit('timer:sync', {
      type: 'roll' as const,
      remainingMs: 20_000,
      forPosition: currentTurn,
    });
  }

  if (state.phase === GamePhase.WAITING_FOR_MOVE && state.validMoves.length > 0) {
    timerManager.startMoveTimer(roomCode, currentTurn, () => {
      enqueueRoomAction(roomCode, async () => {
        if (!room.engine) return;
        const s = room.engine.getState();
        if (s.phase !== GamePhase.WAITING_FOR_MOVE) return;

        // Auto-select random move
        room.engine.selectRandomMove();

        io.to(roomCode).emit('game:auto-action', { type: 'move', position: currentTurn });
        broadcastState(io, roomCode);

        await handlePostAction(io, roomCode);
      });
    });

    io.to(roomCode).emit('timer:sync', {
      type: 'move' as const,
      remainingMs: 60_000,
      forPosition: currentTurn,
    });
  }
}

// ---------------------------------------------------------------------------
// Helper: handle post-action logic (disconnect tracking, game over, timers)
// ---------------------------------------------------------------------------

async function handlePostAction(io: Server, roomCode: string): Promise<void> {
  const room = RoomManager.getActiveRoom(roomCode);
  if (!room?.engine) return;

  const state = room.engine.getState();

  // Check game over
  if (state.phase === GamePhase.GAME_OVER) {
    timerManager.clearAll(roomCode);
    io.to(roomCode).emit('game:over', { rankings: state.rankings });
    await RoomManager.finishGame(roomCode);
    return;
  }

  // Track disconnect turns for current player
  const currentTurn = state.currentTurn;
  const playerToken = room.positionMap.get(currentTurn);
  if (playerToken) {
    try {
      const playerRes = await query<RoomPlayerRecord>(
        'SELECT * FROM room_players WHERE room_id = $1 AND session_token = $2',
        [room.id, playerToken],
      );

      if (playerRes.rows.length > 0 && !playerRes.rows[0].is_connected) {
        // Player is disconnected — check if we need to handle disconnect turns
        const playStyle = room.config.playStyle;

        if (playStyle === PlayStyle.NORMAL) {
          const newDisconnectTurns = playerRes.rows[0].disconnect_turns + 1;
          await query(
            'UPDATE room_players SET disconnect_turns = $1 WHERE id = $2',
            [newDisconnectTurns, playerRes.rows[0].id],
          );

          if (newDisconnectTurns >= MAX_DISCONNECT_TURNS) {
            // Remove player (abandon)
            room.engine.removePlayer(currentTurn);
            io.to(roomCode).emit('game:player-abandoned', {
              position: currentTurn,
              reason: 'Disconnected for too long',
            });
            broadcastState(io, roomCode);

            // Check if game should end
            const activeCount = countActivePlayers(room);
            if (activeCount < 2) {
              const finalState = room.engine.getState();
              if (finalState.phase !== GamePhase.GAME_OVER) {
                // Force game over
                io.to(roomCode).emit('game:over', { rankings: finalState.rankings });
                await RoomManager.finishGame(roomCode);
                timerManager.clearAll(roomCode);
                return;
              }
            }
          }
        }
        // TEAM mode: disconnect turns don't lead to removal, game continues
      }
    } catch (err) {
      console.error('[PostAction Error] DB failure during disconnect tracking:', err);
    }
  }

  // Save state periodically (every 5 turns)
  if (state.turnNumber % 5 === 0) {
    try {
      await RoomManager.saveGameState(roomCode);
    } catch (err) {
      console.error('[PostAction Error] Failed to save game state:', err);
    }
  }

  // Schedule next timer (delayed to allow for client-side animations)
  setTimeout(() => {
    scheduleTimers(io, roomCode);
  }, 1500);
}

function countActivePlayers(room: ReturnType<typeof RoomManager.getActiveRoom>): number {
  if (!room?.engine) return 0;
  const state = room.engine.getState();
  let count = 0;
  for (const [, player] of state.players) {
    if (!player.isFinished) count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Helper: broadcast state to room
// ---------------------------------------------------------------------------

function broadcastState(io: Server, roomCode: string): void {
  const room = RoomManager.getActiveRoom(roomCode);
  if (!room?.engine) return;
  io.to(roomCode).emit('game:state-update', room.engine.getSerializableState());
}

// ---------------------------------------------------------------------------
// Register All Handlers
// ---------------------------------------------------------------------------

export function registerSocketHandlers(io: Server): void {
  // Authentication middleware
  io.use(authenticateSocket);

  io.on('connection', (socket: Socket) => {
    const sessionToken = getToken(socket);
    let currentRoomCode: string | null = null;

    // ── Rate limiting wrapper ──
    function withRateLimit(handler: () => void): void {
      if (!checkRateLimit(socket.id)) {
        emitError(socket, new AppError('RATE_LIMIT', 'Too many requests'));
        return;
      }
      handler();
    }

    // ════════════════════════════════════════════════════════════════════
    // ROOM EVENTS
    // ════════════════════════════════════════════════════════════════════

    socket.on('room:create', (data: unknown) => withRateLimit(async () => {
      try {
        const d = data as { config: GameConfig; name: string; isPrivate: boolean; passcode?: string };
        const name = validateDisplayName(d?.name);
        if (!name) throw new AppError('INVALID_INPUT', 'Invalid name');

        const passcode = d.isPrivate ? validatePasscode(d.passcode) : null;
        if (d.isPrivate && !passcode) throw new AppError('INVALID_INPUT', 'Passcode required for private rooms');

        const config = d.config;
        if (!config || !config.activePositions || !config.playerCount) {
          throw new AppError('INVALID_INPUT', 'Invalid game config');
        }

        const result = await RoomManager.createRoom(
          sessionToken, config, name, d.isPrivate, passcode || undefined,
        );

        const room = RoomManager.getActiveRoom(result.code)!;
        room.socketMap.set(sessionToken, socket.id);

        currentRoomCode = result.code;
        socket.join(result.code);

        const players = await buildLobbyPlayers(result.code);

        socket.emit('room:created', {
          room: {
            roomCode: result.code,
            hostToken: sessionToken.slice(-4),
            config,
            status: 'WAITING' as const,
            players,
            isPrivate: d.isPrivate,
          },
          shareLink: `/join/${result.code}`,
        });
      } catch (err) {
        emitError(socket, err, 'CREATE_FAILED');
      }
    }));

    socket.on('room:check', (data: unknown) => withRateLimit(async () => {
      try {
        const d = data as { code: string };
        const code = validateRoomCode(d?.code);
        if (!code) throw new AppError('INVALID_INPUT', 'Invalid room code');

        const room = RoomManager.getActiveRoom(code);
        if (!room) {
          socket.emit('room:info', { exists: false, isPrivate: false, playerCount: 0, maxPlayers: 0, isReconnect: false });
          return;
        }

        const players = await RoomManager.getPlayersInRoom(code);

        // Check if this session is already in the room (reconnect scenario)
        const existingPlayer = players.find(p => p.session_token === sessionToken);

        socket.emit('room:info', {
          exists: true,
          isPrivate: room.isPrivate,
          status: room.status,
          playerCount: players.length,
          maxPlayers: room.config.playerCount,
          isReconnect: !!existingPlayer,
          yourPosition: existingPlayer?.position || null,
        });
      } catch (err) {
        emitError(socket, err, 'CHECK_FAILED');
      }
    }));

    socket.on('room:join', (data: unknown) => withRateLimit(async () => {
      try {
        const d = data as { code: string; name: string; passcode?: string; isReconnect?: boolean };
        const code = validateRoomCode(d?.code);
        const name = validateDisplayName(d?.name);
        if (!code) throw new AppError('INVALID_INPUT', 'Invalid room code');
        if (!name) throw new AppError('INVALID_INPUT', 'Invalid name');

        const room = RoomManager.getActiveRoom(code);

        // Handle reconnection for in-progress games
        if (room && (room.status === 'IN_PROGRESS' || room.status === 'STARTING')) {
          const reconnectResult = await RoomManager.reconnectPlayer(code, sessionToken);
          if (reconnectResult) {
            room.socketMap.set(sessionToken, socket.id);
            currentRoomCode = code;
            socket.join(code);

            // Send reconnect response
            socket.emit('room:rejoined', {
              room: {
                roomCode: code,
                hostToken: room.hostToken.slice(-4),
                config: room.config,
                status: room.status,
                players: await buildLobbyPlayers(code),
                isPrivate: room.isPrivate,
              },
              yourPosition: reconnectResult.position,
              gameState: room.engine?.getSerializableState() || null,
            });

            socket.to(code).emit('room:player-reconnected', reconnectResult.position);
            return;
          }
        }

        const passcode = validatePasscode(d?.passcode);

        const result = await RoomManager.joinRoom(code, sessionToken, name, passcode || undefined);

        const activeRoom = RoomManager.getActiveRoom(code)!;
        activeRoom.socketMap.set(sessionToken, socket.id);

        currentRoomCode = code;
        socket.join(code);

        const players = await buildLobbyPlayers(code);

        socket.emit('room:joined', {
          room: {
            roomCode: code,
            hostToken: activeRoom.hostToken.slice(-4),
            config: result.config,
            status: activeRoom.status as 'WAITING',
            players,
            isPrivate: activeRoom.isPrivate,
          },
          yourPosition: result.position,
        });

        // Notify others
        socket.to(code).emit('room:player-joined', {
          sessionToken: sessionToken.slice(-4),
          displayName: name,
          position: result.position,
          isReady: false,
          isConnected: true,
          isHost: false,
        });
      } catch (err) {
        const error = err as Error & { position?: PlayerPosition; roomId?: string };
        
        // Handle reconnection for returning players
        if (error.message === 'RECONNECT_NEEDED' && error.position) {
          const code = validateRoomCode((data as any)?.code);
          if (!code) return emitError(socket, new AppError('JOIN_FAILED', 'Invalid room code'));
          
          // Try to find the active room (it may have been restored)
          const room = RoomManager.getActiveRoom(code);
          if (room) {
            try {
              const reconnectResult = await RoomManager.reconnectPlayer(code, sessionToken);
              if (reconnectResult) {
                room.socketMap.set(sessionToken, socket.id);
                currentRoomCode = code;
                socket.join(code);
                
                socket.emit('room:rejoined', {
                  room: {
                    roomCode: code,
                    hostToken: room.hostToken.slice(-4),
                    config: room.config,
                    status: room.status,
                    players: await buildLobbyPlayers(code),
                    isPrivate: room.isPrivate,
                  },
                  yourPosition: reconnectResult.position,
                  gameState: room.engine?.getSerializableState() || null,
                });
                
                socket.to(code).emit('room:player-reconnected', reconnectResult.position);
                return;
              }
            } catch (reconErr) {
              return emitError(socket, reconErr, 'RECONNECT_FAILED');
            }
          }
          
          return emitError(socket, new AppError('JOIN_FAILED', 'Game in progress but could not reconnect. The room may have expired.'));
        }
        
        emitError(socket, err, 'JOIN_FAILED');
      }
    }));

    socket.on('room:toggle-ready', () => withRateLimit(async () => {
      if (!currentRoomCode) return emitError(socket, new AppError('NOT_IN_ROOM', 'Not in a room'));
      try {
        await RoomManager.toggleReady(currentRoomCode, sessionToken);
        const players = await buildLobbyPlayers(currentRoomCode);
        io.to(currentRoomCode).emit('room:players-updated', players);
      } catch (err) {
        emitError(socket, err, 'TOGGLE_FAILED');
      }
    }));

    socket.on('room:kick', (data: unknown) => withRateLimit(async () => {
      if (!currentRoomCode) return emitError(socket, new AppError('NOT_IN_ROOM', 'Not in a room'));
      try {
        const d = data as { position: string };
        const pos = d?.position;
        if (!pos || !['A', 'B', 'C', 'D'].includes(pos)) {
          throw new AppError('INVALID_INPUT', 'Invalid position');
        }

        await RoomManager.kickPlayer(currentRoomCode, sessionToken, pos as PlayerPosition);
        io.to(currentRoomCode).emit('room:player-kicked', pos as PlayerPosition);

        // Notify kicked player's socket
        const room = RoomManager.getActiveRoom(currentRoomCode);
        if (room) {
          const kickedToken = room.positionMap.get(pos as PlayerPosition);
          if (kickedToken) {
            const kickedSocketId = room.socketMap.get(kickedToken);
            if (kickedSocketId) {
              io.to(kickedSocketId).emit('room:you-were-kicked');
            }
          }
        }

        const players = await buildLobbyPlayers(currentRoomCode);
        io.to(currentRoomCode).emit('room:players-updated', players);
      } catch (err) {
        emitError(socket, err, 'KICK_FAILED');
      }
    }));

    socket.on('room:update-config', (data: unknown) => withRateLimit(async () => {
      if (!currentRoomCode) return emitError(socket, new AppError('NOT_IN_ROOM', 'Not in a room'));
      try {
        const d = data as { config: GameConfig };
        if (!d?.config) throw new AppError('INVALID_INPUT', 'Invalid config');

        await RoomManager.updateConfig(currentRoomCode, sessionToken, d.config);
        io.to(currentRoomCode).emit('room:config-updated', d.config);
      } catch (err) {
        emitError(socket, err, 'CONFIG_FAILED');
      }
    }));

    socket.on('room:leave', () => withRateLimit(async () => {
      if (!currentRoomCode) return;
      try {
        const position = await RoomManager.leaveRoom(currentRoomCode, sessionToken);
        if (position) {
          socket.to(currentRoomCode).emit('room:player-left', position);
          const players = await buildLobbyPlayers(currentRoomCode);
          io.to(currentRoomCode).emit('room:players-updated', players);
        }
        socket.leave(currentRoomCode);
        currentRoomCode = null;
      } catch (err) {
        console.error('[RoomLeave Error] Internal failure:', err);
      }
    }));

    socket.on('room:start-game', () => withRateLimit(async () => {
      if (!currentRoomCode) return emitError(socket, new AppError('NOT_IN_ROOM', 'Not in a room'));
      try {
        const engine = await RoomManager.startGame(currentRoomCode, sessionToken);

        // Broadcast initial state
        io.to(currentRoomCode).emit('game:started', engine.getSerializableState());

        // Listen for engine state changes
        engine.on('stateChange', () => {
          if (currentRoomCode) {
            broadcastState(io, currentRoomCode);
          }
        });

        // Start first roll timer
        scheduleTimers(io, currentRoomCode);
      } catch (err) {
        emitError(socket, err, 'START_FAILED');
      }
    }));

    socket.on('game:roll-dice', () => withRateLimit(() => {
      if (!currentRoomCode) return emitError(socket, new AppError('NOT_IN_ROOM', 'Not in a room'));

      enqueueRoomAction(currentRoomCode, async () => {
        const room = RoomManager.getActiveRoom(currentRoomCode!);
        if (!room?.engine) return emitError(socket, new AppError('NO_GAME', 'No game in progress'));

        const state = room.engine.getState();

        // Validate it's this player's turn
        const playerPosition = findPositionByToken(room, sessionToken);
        if (!playerPosition) return emitError(socket, new AppError('NOT_IN_GAME', 'Not in this game'));

        // In team mode, teammate can roll for disconnected player
        const isTheirTurn = state.currentTurn === playerPosition;
        const isTeammate = isTeammateControlling(room, sessionToken, state.currentTurn);

        if (!isTheirTurn && !isTeammate) {
          return emitError(socket, new AppError('NOT_YOUR_TURN', 'Not your turn'));
        }

        // Idempotency: only roll if waiting
        if (state.phase !== GamePhase.WAITING_FOR_ROLL) return;

        timerManager.clearRollTimer(currentRoomCode!);

        const result = room.engine.roll();
        if (!result) return;
        result.timestamp = Date.now();

        io.to(currentRoomCode!).emit('game:dice-rolled', {
          result,
          position: state.currentTurn,
        });

        await handlePostAction(io, currentRoomCode!);
      });
    }));

    socket.on('game:select-move', (data: unknown) => withRateLimit(() => {
      if (!currentRoomCode) return emitError(socket, new AppError('NOT_IN_ROOM', 'Not in a room'));

      const d = data as { moveIndex: number };
      const moveIndex = d?.moveIndex;

      if (typeof moveIndex !== 'number' || !Number.isInteger(moveIndex) || moveIndex < 0) {
        return emitError(socket, new AppError('INVALID_INPUT', 'Invalid move index'));
      }

      enqueueRoomAction(currentRoomCode, async () => {
        const room = RoomManager.getActiveRoom(currentRoomCode!);
        if (!room?.engine) return emitError(socket, new AppError('NO_GAME', 'No game in progress'));

        const state = room.engine.getState();

        const playerPosition = findPositionByToken(room, sessionToken);
        if (!playerPosition) return emitError(socket, new AppError('NOT_IN_GAME', 'Not in this game'));

        const isTheirTurn = state.currentTurn === playerPosition;
        const isTeammate = isTeammateControlling(room, sessionToken, state.currentTurn);

        if (!isTheirTurn && !isTeammate) {
          return emitError(socket, new AppError('NOT_YOUR_TURN', 'Not your turn'));
        }

        // Idempotency
        if (state.phase !== GamePhase.WAITING_FOR_MOVE) return;

        if (moveIndex >= state.validMoves.length) {
          return emitError(socket, new AppError('INVALID_MOVE', 'Move index out of range'));
        }

        timerManager.clearMoveTimer(currentRoomCode!);

        const move = state.validMoves[moveIndex];
        const success = room.engine.selectMoveByIndex(moveIndex);

        if (success) {
          io.to(currentRoomCode!).emit('game:move-executed', {
            move,
            position: state.currentTurn,
          });
        }

        await handlePostAction(io, currentRoomCode!);
      });
    }));

    socket.on('game:reconnect', (data: unknown) => withRateLimit(async () => {
      try {
        const d = data as { roomCode: string };
        const code = validateRoomCode(d?.roomCode);
        if (!code) throw new AppError('INVALID_INPUT', 'Invalid room code');

        const result = await RoomManager.reconnectPlayer(code, sessionToken);
        if (!result) throw new AppError('RECONNECT_FAILED', 'Could not reconnect');

        const room = RoomManager.getActiveRoom(code);
        if (!room) throw new AppError('ROOM_GONE', 'Room no longer exists');

        room.socketMap.set(sessionToken, socket.id);
        currentRoomCode = code;
        socket.join(code);

        // Send full state
        if (room.engine) {
          socket.emit('game:state-update', room.engine.getSerializableState());
        }

        // Notify others
        socket.to(code).emit('room:player-reconnected', result.position);
      } catch (err) {
        emitError(socket, err, 'RECONNECT_FAILED');
      }
    }));

    socket.on('disconnect', async () => {
      clearRateLimit(socket.id);

      if (!currentRoomCode) return;

      const room = RoomManager.getActiveRoom(currentRoomCode);
      if (!room) return;

      const position = findPositionByToken(room, sessionToken);
      if (!position) return;

      // If game hasn't started, leave the room
      if (room.status === 'WAITING') {
        try {
          await RoomManager.leaveRoom(currentRoomCode, sessionToken);
          socket.to(currentRoomCode).emit('room:player-left', position);
          const players = await buildLobbyPlayers(currentRoomCode);
          io.to(currentRoomCode).emit('room:players-updated', players);
        } catch (err) {
          console.error('[Disconnect Error] Failed to leave room:', err);
        }
        return;
      }

      // Game in progress: mark disconnected
      try {
        await query(
          'UPDATE room_players SET is_connected = false WHERE room_id = $1 AND session_token = $2',
          [room.id, sessionToken],
        );

        room.engine?.setPlayerConnected(position, false);
        io.to(currentRoomCode).emit('room:player-disconnected', position);

        // Start grace period before counting disconnect turns
        const graceTimer = setTimeout(async () => {
          room.disconnectGrace.delete(position);
        }, DISCONNECT_GRACE_MS);

        room.disconnectGrace.set(position, graceTimer);
      } catch (err) {
        console.error('[Disconnect Error] DB failure:', err);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

function findPositionByToken(
  room: ReturnType<typeof RoomManager.getActiveRoom>,
  token: string,
): PlayerPosition | null {
  if (!room) return null;
  for (const [pos, t] of room.positionMap) {
    if (t === token) return pos;
  }
  return null;
}

function isTeammateControlling(
  room: ReturnType<typeof RoomManager.getActiveRoom>,
  actingToken: string,
  currentTurn: PlayerPosition,
): boolean {
  if (!room?.engine) return false;
  const state = room.engine.getState();

  if (state.config.playStyle !== PlayStyle.TEAM && state.config.playStyle !== ('TEAM' as PlayStyle)) {
    return false;
  }

  // Check if current turn player is disconnected
  const turnPlayerToken = room.positionMap.get(currentTurn);
  if (!turnPlayerToken) return false;

  const turnPlayerConnected = room.socketMap.has(turnPlayerToken);

  if (turnPlayerConnected) return false; // Not disconnected, can't take over

  // Check if acting player is the teammate
  const TEAMMATES: Record<string, string> = { A: 'C', B: 'D', C: 'A', D: 'B' };
  const actingPosition = findPositionByToken(room, actingToken);
  if (!actingPosition) return false;

  return TEAMMATES[currentTurn] === actingPosition;
}
