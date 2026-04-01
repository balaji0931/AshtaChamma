// Server-side Room Types

import type { PlayerPosition, GameConfig } from '../../shared/types.js';
import type { GameEngine } from '../engine/GameEngine.js';

export interface RoomRecord {
  id: string;
  code: string;
  host_token: string;
  is_private: boolean;
  passcode_hash: string | null;
  config: GameConfig;
  status: 'WAITING' | 'STARTING' | 'IN_PROGRESS' | 'FINISHED';
  game_state: unknown | null;
  created_at: Date;
  updated_at: Date;
}

export interface RoomPlayerRecord {
  id: string;
  room_id: string;
  session_token: string;
  display_name: string;
  position: PlayerPosition | null;
  is_ready: boolean;
  is_connected: boolean;
  disconnect_turns: number;
  joined_at: Date;
}

/** In-memory active room with engine instance */
export interface ActiveRoom {
  id: string;
  code: string;
  hostToken: string;
  config: GameConfig;
  status: 'WAITING' | 'STARTING' | 'IN_PROGRESS' | 'FINISHED';
  isPrivate: boolean;
  engine: GameEngine | null;
  /** Maps session_token → socket.id */
  socketMap: Map<string, string>;
  /** Maps position → session_token */
  positionMap: Map<PlayerPosition, string>;
  /** Action queue for sequential execution */
  actionQueue: Promise<void>;
  /** Disconnect grace timers: position → timeout */
  disconnectGrace: Map<PlayerPosition, NodeJS.Timeout>;
}
