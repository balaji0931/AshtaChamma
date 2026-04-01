-- ============================================================================
-- Ashta Chamma — Database Schema
-- ============================================================================

-- Active game rooms
CREATE TABLE IF NOT EXISTS rooms (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(6) UNIQUE NOT NULL,
    host_token      VARCHAR(64) NOT NULL,
    is_private      BOOLEAN DEFAULT FALSE,
    passcode_hash   VARCHAR(72),
    config          JSONB NOT NULL,
    status          VARCHAR(20) DEFAULT 'WAITING'
                    CHECK (status IN ('WAITING', 'STARTING', 'IN_PROGRESS', 'FINISHED')),
    game_state      JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Players in rooms
CREATE TABLE IF NOT EXISTS room_players (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id         UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    session_token   VARCHAR(64) NOT NULL,
    display_name    VARCHAR(30) NOT NULL,
    position        VARCHAR(1) CHECK (position IN ('A', 'B', 'C', 'D')),
    is_ready        BOOLEAN DEFAULT FALSE,
    is_connected    BOOLEAN DEFAULT TRUE,
    disconnect_turns INTEGER DEFAULT 0,
    joined_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(room_id, session_token),
    UNIQUE(room_id, position)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_room_players_room ON room_players(room_id);
CREATE INDEX IF NOT EXISTS idx_room_players_token ON room_players(session_token);
