// ============================================================================
// Online Menu — Create Room / Join Room
// ============================================================================

import { useState, useEffect } from 'react';
import {
  type GameConfig,
  type RoomInfo,
  type PlayerPosition,
  type LobbyPlayer,
  GameMode,
  PlayStyle,
  EntryMode,
  InnerPathMode,
  DiceMode,
} from '@shared/types';
import type { SerializableGameState } from '@shared/types';
import { DEFAULT_POSITIONS } from '@shared/constants';
import { useSocket } from '../contexts/SocketContext';
import { useSession } from '../contexts/SessionContext';
import { useTheme, type DiceType, type PawnStyle, type BoardTheme } from '../contexts/ThemeContext';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { InfoTip } from '../components/InfoTip';
import {
  Plus,
  Link as LinkIcon,
  Users,
  User,
  Target,
  Lock,
  Unlock,
  RotateCcw,
  Swords,
  Users as TeamIcon,
  Scale,
  Dices,
  Circle,
  Hash,
  CheckCircle,
  XCircle,
  Star,
  Palette,
  FileText,
  TreeDeciduous,
  Square,
  Shell,
  Gamepad2,
  Trash2
} from 'lucide-react';

interface OnlineMenuProps {
  onRoomJoined: (room: RoomInfo, position: PlayerPosition) => void;
  onGameRejoined?: (room: RoomInfo, position: PlayerPosition, gameState: SerializableGameState) => void;
  onBack: () => void;
  initialRoomCode?: string;
}

export function OnlineMenu({ onRoomJoined, onGameRejoined, onBack, initialRoomCode }: OnlineMenuProps) {
  const { socket, isConnected } = useSocket();
  const { displayName, setDisplayName } = useSession();
  const { diceType, pawnStyle, boardTheme, setDiceType, setPawnStyle, setBoardTheme } = useTheme();

  const [mode, setMode] = useState<'menu' | 'create' | 'join'>(initialRoomCode ? 'join' : 'menu');
  const [name, setName] = useState(displayName || '');
  const [roomCode, setRoomCode] = useState(initialRoomCode || '');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Create room settings
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(4);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.CLASSIC);
  const [playStyle, setPlayStyle] = useState<PlayStyle>(PlayStyle.NORMAL);
  const [entryMode, setEntryMode] = useState<EntryMode>(EntryMode.LOCKED);
  const [innerPathMode, setInnerPathMode] = useState<InnerPathMode>(InnerPathMode.ROTATION);
  const [isPrivate, setIsPrivate] = useState(false);
  const [roomPasscode, setRoomPasscode] = useState('');
  const [diceMode, setDiceMode] = useState<DiceMode>(DiceMode.FAIR);
  const [startingPawnsOnBoard, setStartingPawnsOnBoard] = useState(0);
  const [extraSafeCells, setExtraSafeCells] = useState(false);

  // Join room - check if private
  const [needsPasscode, setNeedsPasscode] = useState(false);

  // Auto-check room if we have an initialRoomCode (from URL or rejoin)
  useEffect(() => {
    if (initialRoomCode && socket && isConnected && name.trim()) {
      setLoading(true);
      socket.emit('room:check', { code: initialRoomCode.toUpperCase().trim() });
    }
  }, [initialRoomCode, socket, isConnected]); // eslint-disable-line
  const [roomInfo, setRoomInfo] = useState<{ playerCount: number; maxPlayers: number } | null>(null);

  useEffect(() => {
    if (!socket) return;

    const onCreated = (data: { room: RoomInfo; shareLink: string }) => {
      setLoading(false);
      if (name) setDisplayName(name);
      const myPos = data.room.players.find((p: LobbyPlayer) => p.isHost)?.position;
      if (myPos) onRoomJoined(data.room, myPos);
    };

    const onJoined = (data: { room: RoomInfo; yourPosition: PlayerPosition }) => {
      setLoading(false);
      if (name) setDisplayName(name);
      onRoomJoined(data.room, data.yourPosition);
    };

    const onError = (data: { code: string; message: string }) => {
      setLoading(false);
      setError(data.message);
    };

    const onInfo = (data: {
      exists: boolean; isPrivate: boolean; playerCount: number;
      maxPlayers: number; isReconnect?: boolean; yourPosition?: string | null;
      status?: string;
    }) => {
      setLoading(false);
      if (!data.exists) {
        setError('Room not found');
        return;
      }

      // If this player is already in the room, rejoin directly (reconnection)
      if (data.isReconnect) {
        setLoading(true);
        doJoin(roomCode.toUpperCase().trim());
        return;
      }

      // Game already started and this is a new player
      if (data.status && data.status !== 'WAITING') {
        setError('Game already in progress');
        return;
      }

      if (data.playerCount >= data.maxPlayers) {
        setError('Room is full');
        return;
      }
      if (data.isPrivate) {
        setNeedsPasscode(true);
        setRoomInfo({ playerCount: data.playerCount, maxPlayers: data.maxPlayers });
      } else {
        // Join directly
        doJoin(roomCode.toUpperCase().trim());
      }
    };

    // Handle reconnection to an in-progress game
    const onRejoined = (data: { room: RoomInfo; yourPosition: PlayerPosition; gameState: unknown }) => {
      setLoading(false);
      if (name) setDisplayName(name);
      // If game is in progress and we have game state, go straight to game
      if (data.gameState && onGameRejoined && (data.room.status === 'IN_PROGRESS' || data.room.status === 'STARTING')) {
        onGameRejoined(data.room, data.yourPosition, data.gameState as SerializableGameState);
      } else {
        onRoomJoined(data.room, data.yourPosition);
      }
    };

    socket.on('room:created', onCreated);
    socket.on('room:joined', onJoined);
    socket.on('room:rejoined', onRejoined);
    socket.on('error', onError);
    socket.on('room:info', onInfo);

    return () => {
      socket.off('room:created', onCreated);
      socket.off('room:joined', onJoined);
      socket.off('room:rejoined', onRejoined);
      socket.off('error', onError);
      socket.off('room:info', onInfo);
    };
  }, [socket, name, roomCode]);

  function doJoin(code: string, pass?: string) {
    if (!socket || !name.trim()) return;
    setLoading(true);
    setError('');
    socket.emit('room:join', { code, name: name.trim(), passcode: pass });
  }

  function handleCreate() {
    if (!socket || !name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (isPrivate && !roomPasscode.trim()) {
      setError('Set a passcode for private room');
      return;
    }

    const config: GameConfig = {
      playerCount,
      gameMode,
      playStyle,
      entryMode,
      innerPathMode,
      activePositions: DEFAULT_POSITIONS[playerCount],
      diceConfig: {
        baseWeights: { 1: 20, 2: 20, 3: 20, 4: 25, 8: 15 },
        maxBoostPerNumber: 15,
        maxTotalAdjustment: 25,
      },
      diceMode,
      startingPawnsOnBoard,
      extraSafeCells: boardTheme === 'css' ? extraSafeCells : false,
    };

    setLoading(true);
    setError('');
    socket.emit('room:create', {
      config,
      name: name.trim(),
      isPrivate,
      passcode: isPrivate ? roomPasscode : undefined,
    });
  }

  function handleCheckRoom() {
    if (!socket || !roomCode.trim()) {
      setError('Enter a room code');
      return;
    }
    if (!name.trim()) {
      setError('Enter your name first');
      return;
    }
    setLoading(true);
    setError('');
    socket.emit('room:check', { code: roomCode.toUpperCase().trim() });
  }

  function handleJoinWithPasscode() {
    if (!passcode.trim()) {
      setError('Enter the room passcode');
      return;
    }
    doJoin(roomCode.toUpperCase().trim(), passcode);
  }

  // Pill component (reused from Home)
  const Pill = ({ options, value, onChange }: {
    options: { label: string; value: string; icon?: React.ReactNode }[];
    value: string;
    onChange: (v: string) => void;
  }) => (
    <div className="grid gap-1.5 w-full" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`flex flex-col items-center justify-center gap-0.5 rounded-xl text-center transition-all py-2.5 px-2 border ${value === opt.value
            ? 'bg-amber-50 border-amber-400 text-amber-800 shadow-sm font-bold'
            : 'bg-white/60 border-stone-200/60 text-stone-500 hover:bg-white active:scale-[0.97]'
            }`}
          onClick={() => onChange(opt.value)}
        >
          {opt.icon && <div className="shrink-0">{opt.icon}</div>}
          <span className="text-[11px] leading-tight font-semibold">{opt.label}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-[#faf8f4] to-[#f0ece4]">
      {/* Header */}
      <div className="pt-[env(safe-area-inset-top)] shrink-0">
        <div className="flex items-center justify-between px-4 pt-4">
          <button onClick={onBack} className="text-stone-400 hover:text-stone-600 font-medium text-sm">
            ← Back
          </button>
          <ConnectionStatus />
        </div>
        <div className="text-center py-4">
          <h1 className="text-2xl font-black text-stone-800 tracking-tight">Play Online</h1>
          <p className="text-[10px] text-black-400 mt-1 uppercase tracking-[0.2em]">create or join a room</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-md mx-auto space-y-4">

          {/* Name input (always visible) */}
          <div>
            <label className="text-[10px] font-bold text-black-400 uppercase tracking-widest mb-1.5 block">
              Your Name
            </label>
            <input
              className="w-full px-4 py-3 bg-white/70 border border-stone-200/50 rounded-xl text-sm font-medium text-stone-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              maxLength={30}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-600 font-medium animate-in fade-in">
              {error}
            </div>
          )}

          {/* Menu mode */}
          {mode === 'menu' && (
            <div className="space-y-3 animate-in fade-in">
              <button
                disabled={!isConnected}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-black text-sm uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-amber-200/50 disabled:opacity-50 flex items-center justify-center gap-2"
                onClick={() => setMode('create')}
              >
                <Plus size={18} />
                Create Room
              </button>
              <button
                disabled={!isConnected}
                className="w-full py-4 bg-stone-800 text-white rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-stone-900 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                onClick={() => setMode('join')}
              >
                <LinkIcon size={18} />
                Join Room
              </button>
            </div>
          )}

          {/* Create mode */}
          {mode === 'create' && (
            <div className="space-y-4 animate-in fade-in">
              <section>
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 block">Players</label>
                <Pill
                  options={[
                    { label: 'Two', value: '2', icon: <Users size={16} /> },
                    { label: 'Three', value: '3', icon: <Users size={16} /> },
                    { label: 'Four', value: '4', icon: <Users size={16} /> },
                  ]}
                  value={String(playerCount)}
                  onChange={(v) => setPlayerCount(Number(v) as 2 | 3 | 4)}
                />
              </section>

              <section>
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 flex items-center">
                  Mode
                  <InfoTip title="Game Mode">
                    <p><strong>Classic:</strong> Each pawn moves independently.</p>
                    <p><strong>Paired:</strong> Two pawns on a safe cell can pair up. Pairs move together at half speed.</p>
                  </InfoTip>
                </label>
                <Pill
                  options={[
                    { label: 'Classic', value: GameMode.CLASSIC, icon: <User size={16} /> },
                    { label: 'Paired', value: GameMode.PAIRS, icon: <div className="flex gap-0.5"><User size={12} /><User size={12} /></div> },
                  ]}
                  value={gameMode}
                  onChange={(v) => setGameMode(v as GameMode)}
                />
              </section>

              <section>
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 flex items-center">
                  Inner Path
                  <InfoTip title="Inner Path Entry">
                    <p><strong>Must Kill (🔒):</strong> Your pawns can only enter the inner path after you've killed at least one opponent.</p>
                    <p><strong>Free (🔓):</strong> No kill required.</p>
                  </InfoTip>
                </label>
                <Pill
                  options={[
                    { label: 'Must Kill', value: EntryMode.LOCKED, icon: <Lock size={16} /> },
                    { label: 'Free', value: EntryMode.FREE, icon: <Unlock size={16} /> },
                  ]}
                  value={entryMode}
                  onChange={(v) => setEntryMode(v as EntryMode)}
                />
              </section>

              <section>
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 flex items-center">
                  Overshoot Rule
                  <InfoTip title="Overshoot Rule">
                    <p><strong>Rotate (🔄):</strong> Pawn bounces back if it overshoots HOME.</p>
                    <p><strong>Exact Only (🎯):</strong> Must roll exact number to reach HOME.</p>
                  </InfoTip>
                </label>
                <Pill
                  options={[
                    { label: 'Rotate', value: InnerPathMode.ROTATION, icon: <RotateCcw size={16} /> },
                    { label: 'Exact Only', value: InnerPathMode.NO_ROTATION, icon: <Target size={16} /> },
                  ]}
                  value={innerPathMode}
                  onChange={(v) => setInnerPathMode(v as InnerPathMode)}
                />
              </section>

              {playerCount === 4 && (
                <section>
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 flex items-center">
                    Style
                    <InfoTip title="Play Style">
                      <p><strong>All vs All:</strong> Every player for themselves.</p>
                      <p><strong>Teams:</strong> A+C vs B+D.</p>
                    </InfoTip>
                  </label>
                  <Pill
                    options={[
                      { label: 'All vs All', value: PlayStyle.NORMAL, icon: <Swords size={16} /> },
                      { label: 'Teams', value: PlayStyle.TEAM, icon: <TeamIcon size={16} /> },
                    ]}
                    value={playStyle}
                    onChange={(v) => setPlayStyle(v as PlayStyle)}
                  />
                </section>
              )}

              <section className="pt-2 border-t border-stone-200/50">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 flex items-center">
                  Dice Mode
                  <InfoTip title="Dice Mode">
                    <p><strong>Fair Dice:</strong> Gentle probability tweaks to reduce frustration.</p>
                    <p><strong>Random:</strong> Pure equal probability, no adjustments.</p>
                  </InfoTip>
                </label>
                <Pill
                  options={[
                    { label: 'Fair Dice', value: DiceMode.FAIR, icon: <Scale size={16} /> },
                    { label: 'Random', value: DiceMode.RANDOM, icon: <Dices size={16} /> },
                  ]}
                  value={diceMode}
                  onChange={(v) => setDiceMode(v as DiceMode)}
                />
              </section>

              <section className="pt-2 border-t border-stone-200/50">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 block">Starting Pawns</label>
                <Pill
                  options={[
                    { label: '0', value: '0', icon: <XCircle size={16} /> },
                    { label: '1', value: '1', icon: <Hash size={14} className="opacity-70" /> },
                    { label: '2', value: '2', icon: <Hash size={14} className="opacity-70" /> },
                    { label: '3', value: '3', icon: <Hash size={14} className="opacity-70" /> },
                    { label: 'All 4', value: '4', icon: <CheckCircle size={16} /> },
                  ]}
                  value={String(startingPawnsOnBoard)}
                  onChange={(v) => setStartingPawnsOnBoard(Number(v))}
                />
              </section>

              {boardTheme === 'css' && (
                <section className="pt-2 border-t border-stone-200/50">
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 block">Inner Safe Cells</label>
                  <Pill
                    options={[
                      { label: 'Off', value: 'off', icon: <XCircle size={16} /> },
                      { label: 'On', value: 'on', icon: <Star size={16} /> },
                    ]}
                    value={extraSafeCells ? 'on' : 'off'}
                    onChange={(v) => {
                      setExtraSafeCells(v === 'on');
                      if (v === 'on') setBoardTheme('css' as BoardTheme);
                    }}
                  />
                </section>
              )}

              {/* Appearance */}
              <div className="pt-2 border-t border-stone-200/50 space-y-4">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Appearance</p>

                <section>
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 block">Pawn Style</label>
                  <Pill
                    options={[
                      { label: 'Ludo', value: 'ludo', icon: <User size={16} /> },
                      { label: 'Checkers', value: 'checkers', icon: <Circle size={14} fill="currentColor" /> },
                      { label: 'Rural', value: 'rural', icon: <Gamepad2 size={16} /> },
                    ]}
                    value={pawnStyle}
                    onChange={(v) => setPawnStyle(v as PawnStyle)}
                  />
                </section>

                <section>
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 block">Dice Type</label>
                  <Pill
                    options={[
                      { label: 'Tamarind', value: 'tamarind', icon: <div className="w-4 h-4 bg-amber-900/20 rounded-full flex items-center justify-center"><div className="w-2.5 h-0.5 bg-amber-900/40 rounded-full" /></div> },
                      { label: 'Cowrie', value: 'cowrie', icon: <Shell size={16} /> },
                    ]}
                    value={diceType}
                    onChange={(v) => setDiceType(v as DiceType)}
                  />
                </section>

                <section>
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 block">Board</label>
                  <Pill
                    options={extraSafeCells
                      ? [{ label: 'Classic', value: 'css', icon: <Palette size={16} /> }]
                      : [
                        { label: 'Classic', value: 'css', icon: <Palette size={16} /> },
                        { label: 'Paper', value: 'paper', icon: <FileText size={16} /> },
                        { label: 'Wood', value: 'wood', icon: <TreeDeciduous size={16} /> },
                        { label: 'Marble', value: 'marble', icon: <Circle size={14} className="text-stone-300" /> },
                        { label: 'Slate', value: 'slate', icon: <Square size={14} className="fill-stone-800" /> },
                      ]
                    }
                    value={boardTheme}
                    onChange={(v) => setBoardTheme(v as BoardTheme)}
                  />
                  {extraSafeCells && (
                    <p className="text-[10px] text-amber-500 mt-1.5 pl-1">
                      🔒 Locked to Classic — Inner Safe Cells requires CSS board.
                    </p>
                  )}
                </section>
              </div>

              {/* Private toggle */}
              <section className="flex items-center justify-between py-2 px-1">
                <div>
                  <p className="text-xs font-bold text-stone-600">Private Room</p>
                  <p className="text-[10px] text-stone-400">Require passcode to join</p>
                </div>
                <button
                  className={`w-12 h-7 rounded-full transition-colors ${isPrivate ? 'bg-amber-500' : 'bg-stone-200'}`}
                  onClick={() => setIsPrivate(!isPrivate)}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ml-1 ${isPrivate ? 'translate-x-5' : ''}`} />
                </button>
              </section>

              {isPrivate && (
                <input
                  className="w-full px-4 py-3 bg-white/70 border border-stone-200/50 rounded-xl text-sm font-medium text-stone-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  value={roomPasscode}
                  onChange={(e) => setRoomPasscode(e.target.value)}
                  placeholder="Room passcode"
                  maxLength={20}
                />
              )}

              <div className="flex gap-3 pt-2">
                <button
                  className="flex-1 py-3 bg-stone-100 text-stone-600 rounded-xl font-bold text-sm active:scale-95"
                  onClick={() => { setMode('menu'); setError(''); }}
                >
                  Cancel
                </button>
                <button
                  disabled={loading || !isConnected}
                  className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-black text-sm uppercase tracking-wider active:scale-95 disabled:opacity-50"
                  onClick={handleCreate}
                >
                  {loading ? '...' : 'Create'}
                </button>
              </div>
            </div>
          )}

          {/* Join mode */}
          {mode === 'join' && !needsPasscode && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5 block">
                  Room Code
                </label>
                <input
                  className="w-full px-4 py-3 bg-white/70 border border-stone-200/50 rounded-xl text-lg font-black text-center text-stone-700 uppercase tracking-[0.3em] outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="ABC123"
                  maxLength={6}
                />
              </div>

              <div className="flex gap-3">
                <button
                  className="flex-1 py-3 bg-stone-100 text-stone-600 rounded-xl font-bold text-sm active:scale-95"
                  onClick={() => { setMode('menu'); setError(''); setRoomCode(''); }}
                >
                  Cancel
                </button>
                <button
                  disabled={loading || !isConnected || roomCode.length < 6}
                  className="flex-1 py-3 bg-stone-800 text-white rounded-xl font-bold text-sm active:scale-95 disabled:opacity-50"
                  onClick={handleCheckRoom}
                >
                  {loading ? '...' : 'Join'}
                </button>
              </div>
            </div>
          )}

          {/* Passcode prompt for private room */}
          {mode === 'join' && needsPasscode && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                <p className="text-sm font-bold text-amber-700 flex items-center justify-center gap-2">
                  <Lock size={16} />
                  Private Room
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  {roomInfo && `${roomInfo.playerCount}/${roomInfo.maxPlayers} players`}
                </p>
              </div>
              <input
                className="w-full px-4 py-3 bg-white/70 border border-stone-200/50 rounded-xl text-sm font-medium text-center text-stone-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter room passcode"
                maxLength={20}
                type="password"
              />
              <div className="flex gap-3">
                <button
                  className="flex-1 py-3 bg-stone-100 text-stone-600 rounded-xl font-bold text-sm active:scale-95"
                  onClick={() => { setNeedsPasscode(false); setPasscode(''); setError(''); }}
                >
                  Back
                </button>
                <button
                  disabled={loading || !isConnected}
                  className="flex-1 py-3 bg-stone-800 text-white rounded-xl font-bold text-sm active:scale-95 disabled:opacity-50"
                  onClick={handleJoinWithPasscode}
                >
                  {loading ? '...' : 'Join'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
