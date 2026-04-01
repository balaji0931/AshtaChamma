// ============================================================================
// Lobby — Room lobby screen (players, ready, host controls)
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  type RoomInfo,
  type LobbyPlayer,
  type PlayerPosition,
  type GameConfig,
  type SerializableGameState,
} from '@shared/types';
import { useSocket } from '../contexts/SocketContext';
import { useSession } from '../contexts/SessionContext';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { Clipboard, Check, Play, Lock, Crown, LogOut, UserMinus } from 'lucide-react';

const POSITION_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  A: { bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-500' },
  B: { bg: 'bg-green-50', text: 'text-green-600', dot: 'bg-green-500' },
  C: { bg: 'bg-yellow-50', text: 'text-yellow-600', dot: 'bg-yellow-500' },
  D: { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-500' },
};

interface LobbyProps {
  room: RoomInfo;
  myPosition: PlayerPosition;
  onGameStart: (state: SerializableGameState) => void;
  onLeave: () => void;
}

export function Lobby({ room: initialRoom, myPosition, onGameStart, onLeave }: LobbyProps) {
  const { socket } = useSocket();
  const { sessionToken } = useSession();

  const [players, setPlayers] = useState<LobbyPlayer[]>(initialRoom.players);
  const [config, setConfig] = useState<GameConfig>(initialRoom.config);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const isHost = initialRoom.hostToken === sessionToken.slice(-4);
  const allReady = players.length >= 2 && players.every((p) => p.isReady);
  const roomCode = initialRoom.roomCode;

  useEffect(() => {
    if (!socket) return;

    const onPlayersUpdated = (updatedPlayers: LobbyPlayer[]) => {
      setPlayers(updatedPlayers);
    };

    const onPlayerJoined = (player: LobbyPlayer) => {
      setPlayers((prev) => [...prev.filter((p) => p.position !== player.position), player]);
    };

    const onPlayerLeft = (position: PlayerPosition) => {
      setPlayers((prev) => prev.filter((p) => p.position !== position));
    };

    const onPlayerKicked = (position: PlayerPosition) => {
      setPlayers((prev) => prev.filter((p) => p.position !== position));
    };

    const onYouWereKicked = () => {
      onLeave();
    };

    const onConfigUpdated = (newConfig: GameConfig) => {
      setConfig(newConfig);
    };

    const onGameStarted = (state: SerializableGameState) => {
      onGameStart(state);
    };

    const onError = (data: { code: string; message: string }) => {
      setError(data.message);
      setTimeout(() => setError(''), 3000);
    };

    socket.on('room:players-updated', onPlayersUpdated);
    socket.on('room:player-joined', onPlayerJoined);
    socket.on('room:player-left', onPlayerLeft);
    socket.on('room:player-kicked', onPlayerKicked);
    socket.on('room:you-were-kicked', onYouWereKicked);
    socket.on('room:config-updated', onConfigUpdated);
    socket.on('game:started', onGameStarted);
    socket.on('error', onError);

    return () => {
      socket.off('room:players-updated', onPlayersUpdated);
      socket.off('room:player-joined', onPlayerJoined);
      socket.off('room:player-left', onPlayerLeft);
      socket.off('room:player-kicked', onPlayerKicked);
      socket.off('room:you-were-kicked', onYouWereKicked);
      socket.off('room:config-updated', onConfigUpdated);
      socket.off('game:started', onGameStarted);
      socket.off('error', onError);
    };
  }, [socket, onGameStart, onLeave]);

  const handleCopyCode = useCallback(() => {
    const shareUrl = `${window.location.origin}/join/${roomCode}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [roomCode]);

  const handleToggleReady = () => {
    socket?.emit('room:toggle-ready');
  };

  const handleKick = (position: PlayerPosition) => {
    socket?.emit('room:kick', { position });
  };

  const handleStart = () => {
    socket?.emit('room:start-game');
  };

  const handleLeave = () => {
    socket?.emit('room:leave');
    onLeave();
  };

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-[#faf8f4] to-[#f0ece4]">
      {/* Header */}
      <div className="pt-[env(safe-area-inset-top)] shrink-0">
        <div className="flex items-center justify-between px-4 pt-4">
          <button onClick={handleLeave} className="text-stone-400 hover:text-stone-600 font-medium text-sm flex items-center gap-1">
            <LogOut size={14} />
            Leave
          </button>
          <ConnectionStatus />
        </div>
        <div className="text-center py-3">
          <h1 className="text-xl font-black text-stone-800">Room Lobby</h1>
          {/* Room code */}
          <button
            onClick={handleCopyCode}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-white/80 border border-stone-200 rounded-xl hover:bg-white transition-all active:scale-95"
          >
            <span className="text-lg font-black tracking-[0.3em] text-stone-700">{roomCode}</span>
            <span className="text-xs text-stone-400 flex items-center gap-1">
              {copied ? <Check size={14} className="text-emerald-500" /> : <Clipboard size={14} />}
              {copied ? 'Copied!' : 'Copy link'}
            </span>
          </button>
          {initialRoom.isPrivate && (
            <p className="text-[10px] text-amber-600 mt-1 font-medium flex items-center justify-center gap-1">
              <Lock size={12} />
              Private Room
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <div className="max-w-md mx-auto space-y-4">

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-sm text-red-600 font-medium animate-in fade-in">
              {error}
            </div>
          )}

          {/* Game Settings (read-only for non-host) */}
          <section className="bg-white/60 border border-stone-200/50 rounded-xl p-4">
            <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">Game Settings</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-stone-50 rounded-lg px-3 py-2">
                <span className="text-stone-400">Players</span>
                <span className="block font-bold text-stone-700">{config.playerCount}</span>
              </div>
              <div className="bg-stone-50 rounded-lg px-3 py-2">
                <span className="text-stone-400">Mode</span>
                <span className="block font-bold text-stone-700">{config.gameMode}</span>
              </div>
              <div className="bg-stone-50 rounded-lg px-3 py-2">
                <span className="text-stone-400">Style</span>
                <span className="block font-bold text-stone-700">{config.playStyle}</span>
              </div>
              <div className="bg-stone-50 rounded-lg px-3 py-2">
                <span className="text-stone-400">Inner Path</span>
                <span className="block font-bold text-stone-700">{config.entryMode}</span>
              </div>
            </div>
          </section>

          {/* Players */}
          <section>
            <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">
              Players ({players.length}/{config.playerCount})
            </h3>
            <div className="space-y-2">
              {config.activePositions.map((pos: PlayerPosition) => {
                const player = players.find((p) => p.position === pos);
                const colors = POSITION_COLORS[pos] || POSITION_COLORS.A;
                const isMe = player?.position === myPosition;

                return (
                  <div
                    key={pos}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                      player
                        ? `${colors.bg} border-current/10`
                        : 'bg-stone-50 border-dashed border-stone-200'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full shrink-0 ${player ? colors.dot : 'bg-stone-300'}`} />
                    <div className="flex-1 min-w-0">
                      {player ? (
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${colors.text} truncate`}>
                            {player.displayName}
                            {isMe && <span className="text-[10px] ml-1">(You)</span>}
                          </span>
                          {player.isHost && (
                            <span className="text-[9px] bg-amber-200 text-amber-700 px-1.5 py-0.5 rounded-full font-bold uppercase flex items-center gap-1">
                              <Crown size={10} />
                              Host
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-stone-400 italic">Waiting for player...</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {player && (
                        <>
                          {player.isReady ? (
                            <span className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                              <Check size={14} />
                              Ready
                            </span>
                          ) : (
                            <span className="text-xs text-stone-400">Not ready</span>
                          )}
                          {isHost && !player.isHost && (
                            <button
                              onClick={() => handleKick(pos)}
                              className="text-[10px] text-red-400 hover:text-red-600 font-bold px-1 flex items-center gap-0.5"
                            >
                              <UserMinus size={10} />
                              Kick
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 pb-[env(safe-area-inset-bottom)]">
        <div className="px-4 py-3 flex gap-3 max-w-md mx-auto">
          {isHost ? (
            <button
              disabled={!allReady}
              className="flex-1 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-black text-sm uppercase tracking-wider active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-200/50 flex items-center justify-center gap-2"
              onClick={handleStart}
            >
              {allReady ? <><Play size={16} fill="currentColor" /> Start Game</> : 'Waiting for all ready...'}
            </button>
          ) : (
            <button
              className={`flex-1 py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider active:scale-95 transition-all ${
                players.find((p) => p.position === myPosition)?.isReady
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200/50'
                  : 'bg-stone-800 text-white'
              }`}
              onClick={handleToggleReady}
            >
              <div className="flex items-center justify-center gap-2">
                {players.find((p) => p.position === myPosition)?.isReady && <Check size={16} />}
                {players.find((p) => p.position === myPosition)?.isReady ? 'Ready!' : 'Ready Up'}
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
