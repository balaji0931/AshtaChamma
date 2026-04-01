// ============================================================================
// Home Page — Premium Mobile-First Landing + Setup Wizard
// ============================================================================

import { useState, useEffect } from 'react';
import {
  type GameConfig,
  GameMode,
  PlayStyle,
  EntryMode,
  InnerPathMode,
  PlayerPosition,
  DiceMode,
} from '@shared/types';
import { DEFAULT_POSITIONS } from '@shared/constants';
import {
  Heart,
  XCircle,
  Star,
  Target,
  Globe,
  Smartphone,
  BookOpen,
  Download,
  RefreshCw,
  Info,
  HelpCircle,
  Users,
  Swords,
  ShieldCheck,
  Zap,
  Dice5,
  Scale,
  Dices,
  Lock,
  Wifi,
  Trophy,
  ChevronRight,
  ArrowRight,
  Play,
  Check,
  CheckCircle,
  FileText,
  TreeDeciduous,
  Square,
  Shell,
  Gamepad2,
  Palette,
  Circle,
  User,
  Hash,
  Unlock
} from 'lucide-react';
import { useTheme, type DiceType, type PawnStyle, type BoardTheme } from '../contexts/ThemeContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { InfoTip } from '../components/InfoTip';
import { HowToPlay } from './HowToPlay';

interface HomeProps {
  onStartGame: (config: GameConfig, playerNames: Record<string, string>) => void;
  onPlayOnline?: () => void;
  onViewAbout: () => void;
  onViewFAQ: () => void;
  onRejoinRoom?: (code: string) => void;
  activeRoomCode?: string | null;
}

export function Home({ onStartGame, onPlayOnline, onViewAbout, onViewFAQ, onRejoinRoom, activeRoomCode }: HomeProps) {
  const { diceType, pawnStyle, boardTheme, setDiceType, setPawnStyle, setBoardTheme } = useTheme();
  const isOnline = useOnlineStatus();
  const { canInstall, isInstalled, promptInstall } = useInstallPrompt();

  const [step, setStep] = useState(0);
  const [showRules, setShowRules] = useState(false);
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(4);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.CLASSIC);
  const [playStyle, setPlayStyle] = useState<PlayStyle>(PlayStyle.NORMAL);
  const [entryMode, setEntryMode] = useState<EntryMode>(EntryMode.LOCKED);
  const [innerPathMode, setInnerPathMode] = useState<InnerPathMode>(InnerPathMode.ROTATION);
  const [diceMode, setDiceMode] = useState<DiceMode>(DiceMode.FAIR);
  const [startingPawnsOnBoard, setStartingPawnsOnBoard] = useState(0);
  const [extraSafeCells, setExtraSafeCells] = useState(false);

  const activePositions = DEFAULT_POSITIONS[playerCount];

  const [names, setNames] = useState<Record<string, string>>({
    [PlayerPosition.A]: 'Player A',
    [PlayerPosition.B]: 'Player B',
    [PlayerPosition.C]: 'Player C',
    [PlayerPosition.D]: 'Player D',
  });

  const handleStart = () => {
    const config: GameConfig = {
      playerCount,
      gameMode,
      playStyle,
      entryMode,
      innerPathMode,
      activePositions,
      diceConfig: {
        baseWeights: { 1: 20, 2: 20, 3: 20, 4: 25, 8: 15 },
        maxBoostPerNumber: 15,
        maxTotalAdjustment: 25,
      },
      diceMode,
      startingPawnsOnBoard,
      extraSafeCells: boardTheme === 'css' ? extraSafeCells : false,
    };
    const filteredNames: Record<string, string> = {};
    for (const pos of activePositions) {
      filteredNames[pos] = names[pos] || `Player ${pos}`;
    }
    onStartGame(config, filteredNames);
  };

  // -- Toggle Pill --
  const Pill = ({
    options,
    value,
    onChange,
    columns = options.length,
  }: {
    options: { label: string; value: string; icon?: React.ReactNode }[];
    value: string;
    onChange: (v: string) => void;
    columns?: number;
  }) => (
    <div className={`grid gap-1.5 w-full`} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            className={`
              flex flex-col items-center justify-center gap-1 rounded-xl text-center transition-all duration-200
              py-2.5 px-2 border
              ${active
                ? 'bg-amber-50 border-amber-400 text-amber-800 shadow-sm font-bold'
                : 'bg-white/60 border-stone-200/60 text-stone-500 hover:bg-white hover:border-stone-300 active:scale-[0.97]'
              }
            `}
            onClick={() => onChange(opt.value)}
          >
            {opt.icon && <div className="text-amber-600 shrink-0">{opt.icon}</div>}
            <span className="text-[11px] leading-tight font-semibold">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );

  const DOT = (pos: string) => {
    const colors: Record<string, string> = {
      A: 'bg-red-500', B: 'bg-green-500', C: 'bg-yellow-500', D: 'bg-blue-500',
    };
    return <div className={`w-3 h-3 rounded-full shrink-0 ${colors[pos]}`} />;
  };

  const STEP_TITLES = ['Players', 'Rules', 'Style'];

  // ============================================================================
  // LANDING PAGE (step === 0)
  // ============================================================================
  if (step === 0) {
    return (
      <div className="min-h-dvh flex flex-col bg-gradient-to-b from-[#faf8f4] to-[#f0ece4]">
        {showRules && <HowToPlay onClose={() => setShowRules(false)} />}

        {/* ─── Hero Section ─── */}
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-8" style={{ minHeight: 0 }}>

          {/* Logo */}
          <div className="mb-5 relative">
            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl overflow-hidden shadow-2xl shadow-amber-900/20 border-2 border-white/60">
              <img
                src="/icons/icon-512.png"
                alt="Ashta Chamma"
                className="w-full h-full object-cover"
                draggable={false}
              />
            </div>
            {/* Decorative glow */}
            <div className="absolute inset-0 rounded-3xl bg-amber-400/20 blur-2xl -z-10 scale-150" />
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl font-black text-stone-800 tracking-tight text-center">
            Ashta Chamma
          </h1>
          <p className="mt-2 text-sm sm:text-base text-stone-500 text-center max-w-sm leading-relaxed">
            The classic Indian board game - play online with friends or offline on the same device
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            <span className="flex items-center gap-1.5 px-3 py-1 bg-white/80 border border-stone-200/50 rounded-full text-[10px] sm:text-xs font-semibold text-stone-500">
              <Trophy size={12} className="text-amber-500" /> Free to Play
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 bg-white/80 border border-stone-200/50 rounded-full text-[10px] sm:text-xs font-semibold text-stone-500">
              <Wifi size={12} className="text-amber-500" /> Works Offline
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 bg-white/80 border border-stone-200/50 rounded-full text-[10px] sm:text-xs font-semibold text-stone-500">
              <Lock size={12} className="text-amber-500" /> No Login
            </span>
          </div>

          {/* ─── Rejoin Banner ─── */}
          {activeRoomCode && onRejoinRoom && (
            <button
              className="w-full max-w-sm mt-6 flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-2xl shadow-lg shadow-amber-200/50 hover:brightness-110 active:scale-[0.98] transition-all"
              onClick={() => onRejoinRoom(activeRoomCode)}
            >
              <div className="flex items-center gap-3">
                <RefreshCw size={20} className="animate-spin" />
                <div className="text-left">
                  <p className="text-sm font-black uppercase tracking-wider">Rejoin Game</p>
                  <p className="text-[10px] opacity-80">Room: {activeRoomCode}</p>
                </div>
              </div>
              <ChevronRight size={18} />
            </button>
          )}

          {/* ─── Main Actions ─── */}
          <div className="w-full max-w-sm flex flex-col gap-3 mt-6">
            {/* Play Online */}
            {isOnline && onPlayOnline && (
              <button
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-2xl font-black text-sm uppercase tracking-wider hover:brightness-110 active:scale-[0.97] transition-all shadow-lg shadow-amber-200/50 flex items-center justify-center gap-3"
                onClick={onPlayOnline}
              >
                <Globe size={18} />
                Play Online
              </button>
            )}

            {/* Pass & Play */}
            <button
              className="w-full py-4 bg-stone-800 text-white rounded-2xl font-bold text-sm uppercase tracking-wider hover:bg-stone-900 active:scale-[0.97] transition-all flex items-center justify-center gap-3"
              onClick={() => setStep(1)}
            >
              <Smartphone size={18} />
              Pass & Play
            </button>

            {/* How to Play */}
            <button
              className="w-full py-3 bg-white/70 border border-stone-200/60 text-stone-600 rounded-2xl font-semibold text-sm hover:bg-white hover:border-stone-300 active:scale-[0.97] transition-all flex items-center justify-center gap-3"
              onClick={() => setShowRules(true)}
            >
              <BookOpen size={18} />
              How to Play
            </button>

            {/* Offline indicator */}
            {!isOnline && (
              <div className="flex items-center justify-center gap-2 py-1 text-stone-400">
                <div className="w-1.5 h-1.5 rounded-full bg-stone-300" />
                <span className="text-[10px] font-medium uppercase tracking-widest tracking-widest">Offline — Online play unavailable</span>
              </div>
            )}
          </div>

          {/* ─── Install Section ─── */}
          {canInstall && (
            <div className="w-full max-w-sm mt-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-px bg-stone-200/60" />
                <span className="text-[10px] text-stone-300 font-semibold uppercase tracking-widest">Get the App</span>
                <div className="flex-1 h-px bg-stone-200/60" />
              </div>

              <button
                className="w-full py-3.5 bg-white border-2 border-amber-400 text-amber-700 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-amber-50 active:scale-[0.97] transition-all flex items-center justify-center gap-2"
                onClick={promptInstall}
              >
                <Download size={16} /> Install App
              </button>

              {isInstalled && (
                <div className="flex items-center justify-center gap-2 py-2 text-emerald-600">
                  <CheckCircle size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">App Installed</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Footer ─── */}
        <div className="shrink-0 pb-[env(safe-area-inset-bottom)]">
          <div className="text-center py-4 px-4">
            <p className="text-xs text-black-400 flex items-center justify-center gap-1.5">
              Made with <Heart size={12} className="text-black-500" /> for village game lovers
            </p>

            {/* About & FAQ Links */}
            <div className="flex items-center justify-center gap-6 mt-4 mb-2">
              <button
                onClick={onViewAbout}
                className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-black text-stone-500 hover:text-amber-600 transition-colors"
              >
                <Info size={14} /> About
              </button>
              <div className="w-1 h-1 rounded-full bg-stone-200" />
              <button
                onClick={onViewFAQ}
                className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-black text-stone-500 hover:text-amber-600 transition-colors"
              >
                <HelpCircle size={14} /> FAQ
              </button>
            </div>

            <p className="text-[10px] text-black-300 mt-2">
              <a href="https://ashtachamma.tech" className="hover:text-stone-500 transition-colors no-underline text-blue-500">ashtachamma.tech</a>
              {' '}© {new Date().getFullYear()} • Works offline
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // GAME SETUP WIZARD (step >= 1)
  // ============================================================================
  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-[#faf8f4] to-[#f0ece4]">
      {showRules && <HowToPlay onClose={() => setShowRules(false)} />}

      {/* ---- TOP NAVBAR ---- */}
      <div className="pt-[env(safe-area-inset-top)] shrink-0 bg-white/40 backdrop-blur-sm border-b border-stone-200/40">
        <div className="flex items-center justify-between px-4 py-2 max-w-2xl mx-auto">
          <button
            className="px-3 py-1.5 text-stone-500 text-sm font-semibold hover:text-stone-700 active:scale-95 transition-all"
            onClick={() => setStep(0)}
          >
            ← Home
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-stone-700">Pass & Play Setup</span>
          </div>
          <button
            className="w-10 h-10 flex items-center justify-center bg-stone-100 text-stone-600 rounded-xl hover:bg-amber-100 hover:text-amber-700 transition-colors active:scale-90"
            onClick={() => setShowRules(true)}
          >
            <BookOpen size={18} />
          </button>
        </div>
      </div>

      {/* ---- STEP TABS ---- */}
      <div className="flex justify-center gap-0 px-6 shrink-0">
        {STEP_TITLES.map((title, i) => {
          const s = i + 1;
          const active = step === s;
          const done = step > s;
          return (
            <button
              key={s}
              className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all border-b-2 ${active
                ? 'text-amber-700 border-amber-500'
                : done
                  ? 'text-stone-400 border-stone-300 cursor-pointer'
                  : 'text-stone-300 border-transparent cursor-default'
                }`}
              onClick={() => done && setStep(s)}
            >
              <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${active ? 'bg-amber-500 text-white' : done ? 'bg-stone-300 text-white' : 'bg-stone-200 text-stone-400'
                }`}>
                {done ? <Check size={12} strokeWidth={4} /> : s}
              </span>
              <span className="hidden sm:inline">{title}</span>
            </button>
          );
        })}
      </div>

      {/* ---- SCROLLABLE CONTENT ---- */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 md:py-6">
        <div className="max-w-md mx-auto">

          {/* STEP 1: Players */}
          {step === 1 && (
            <div className="flex flex-col gap-5 animate-in fade-in duration-300">
              <section>
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 block">
                  How many players?
                </label>
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
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 block">
                  Player Names
                </label>
                <div className="space-y-2">
                  {activePositions.map((pos) => (
                    <div
                      key={pos}
                      className="flex items-center gap-3 px-3.5 py-2.5 bg-white/70 border border-stone-200/50 rounded-xl focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-100 transition-all"
                    >
                      {DOT(String(pos))}
                      <input
                        className="flex-1 bg-transparent text-sm font-medium text-stone-700 outline-none placeholder:text-stone-300"
                        value={names[pos]}
                        placeholder={`Player ${pos}`}
                        onChange={(e) => setNames((prev) => ({ ...prev, [pos]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* STEP 2: Rules */}
          {step === 2 && (
            <div className="flex flex-col gap-5 animate-in fade-in duration-300">
              <section>
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 flex items-center">
                  Game Mode
                  <InfoTip title="Game Mode">
                    <p><strong>Classic:</strong> Each pawn moves independently around the board.</p>
                    <p><strong>Paired:</strong> Two of your pawns on the same safe cell can pair up. Pairs move together at half the dice value but are harder to kill.</p>
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
                <p className="text-[10px] text-stone-400 mt-1.5 pl-1">
                  {gameMode === GameMode.CLASSIC
                    ? 'Each pawn moves independently.'
                    : 'Pair pawns on safe cells. Pairs move together at half speed.'}
                </p>
              </section>

              <section>
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 flex items-center">
                  Starting Pawns
                  <InfoTip title="Starting Pawns on Board">
                    <p>Normally, all 4 pawns start outside the board. You need to roll a 4 or 8 to bring each one in.</p>
                    <p>Change this to start with pawns already on the board — more action from the first turn!</p>
                  </InfoTip>
                </label>
                <Pill
                  options={[
                    { label: '0', value: '0', icon: <Lock size={16} className="opacity-40" /> },
                    { label: '1', value: '1', icon: <Hash size={14} className="opacity-70" /> },
                    { label: '2', value: '2', icon: <Hash size={14} className="opacity-70" /> },
                    { label: '3', value: '3', icon: <Hash size={14} className="opacity-70" /> },
                    { label: 'All 4', value: '4', icon: <ShieldCheck size={16} /> },
                  ]}
                  value={String(startingPawnsOnBoard)}
                  onChange={(v) => setStartingPawnsOnBoard(Number(v))}
                />
                <p className="text-[10px] text-stone-400 mt-1.5 pl-1">
                  {startingPawnsOnBoard === 0
                    ? 'All pawns start outside. Roll 4 or 8 to enter.'
                    : startingPawnsOnBoard === 4
                      ? 'All pawns start on the board. No entry rolls needed!'
                      : `${startingPawnsOnBoard} pawn${startingPawnsOnBoard > 1 ? 's' : ''} start on the board. Rest need 4 or 8 to enter.`}
                </p>
              </section>

              <section>
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 flex items-center">
                  Inner Path Entry
                  <InfoTip title="Inner Path Entry">
                    <p><strong>Must Kill First (🔒):</strong> Your pawns can only enter the inner path (toward HOME) after you've killed at least one opponent pawn.</p>
                    <p><strong>Free Entry (🔓):</strong> No kill required — pawns can enter the inner path anytime after completing the outer loop.</p>
                  </InfoTip>
                </label>
                <Pill
                  options={[
                    { label: 'Must Kill First', value: EntryMode.LOCKED, icon: <Lock size={16} /> },
                    { label: 'Free Entry', value: EntryMode.FREE, icon: <Unlock size={16} /> },
                  ]}
                  value={entryMode}
                  onChange={(v) => setEntryMode(v as EntryMode)}
                />
              </section>

              <section>
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 flex items-center">
                  Overshoot Rule
                  <InfoTip title="Overshoot Rule">
                    <p><strong>Rotate (🔄):</strong> If your dice roll would take a pawn past HOME, it bounces back. You never waste a turn.</p>
                    <p><strong>Exact Only (🎯):</strong> A pawn can only reach HOME with an exact roll. If the dice overshoots, that pawn can't move.</p>
                  </InfoTip>
                </label>
                <Pill
                  options={[
                    { label: 'Rotate', value: InnerPathMode.ROTATION, icon: <RefreshCw size={16} /> },
                    { label: 'Exact Only', value: InnerPathMode.NO_ROTATION, icon: <Target size={16} /> },
                  ]}
                  value={innerPathMode}
                  onChange={(v) => setInnerPathMode(v as InnerPathMode)}
                />
              </section>

              {playerCount === 4 && (
                <section className="pt-2 border-t border-stone-200/50">
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 flex items-center">
                    Play Style
                    <InfoTip title="Play Style">
                      <p><strong>All vs All (⚔️):</strong> Every player plays for themselves.</p>
                      <p><strong>Teams 2v2 (🤝):</strong> A+C vs B+D. If your teammate disconnects, you can play their turns.</p>
                    </InfoTip>
                  </label>
                  <Pill
                    options={[
                      { label: 'All vs All', value: PlayStyle.NORMAL, icon: <Swords size={16} /> },
                      { label: 'Teams (2v2)', value: PlayStyle.TEAM, icon: <Users size={16} /> },
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
                    <p><strong>Fair Dice (⚖️):</strong> Gentle probability tweaks to prevent long bad-luck streaks. Gives tiny boosts when you're stuck or behind.</p>
                    <p><strong>Random (🎲):</strong> Pure random. Every value (1, 2, 3, 4, 8) has equal 20% chance. No adjustments at all.</p>
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
                <p className="text-[10px] text-stone-400 mt-1.5 pl-1">
                  {diceMode === DiceMode.FAIR
                    ? 'Balanced dice with gentle anti-frustration adjustments.'
                    : 'Pure random — every roll is equally likely. No adjustments.'}
                </p>
              </section>

              {boardTheme === 'css' && (
                <section className="pt-2 border-t border-stone-200/50">
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 flex items-center">
                    Inner Safe Cells
                    <InfoTip title="Inner Safe Cells">
                      <p>Adds 4 extra safe cells on the inner diagonal positions of the board (the cells diagonally adjacent to the center).</p>
                      <p>Pawns on these cells <strong>cannot be killed</strong>, just like the corner entry cells.</p>
                      <p className="text-stone-400 mt-1">Only available on the Classic CSS board.</p>
                    </InfoTip>
                  </label>
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
            </div>
          )}

          {/* STEP 3: Appearance */}
          {step === 3 && (
            <div className="flex flex-col gap-5 animate-in fade-in duration-300">
              <section>
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 flex items-center">
                  Pawn Style
                  <InfoTip title="Pawn Style">
                    <p>Choose how your game pieces look. This is purely visual — all styles play the same way.</p>
                  </InfoTip>
                </label>
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
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 flex items-center">
                  Dice Type
                  <InfoTip title="Dice Type">
                    <p>Choose the visual style of your dice. Tamarind seeds or cowrie shells — same roll mechanics, different look!</p>
                  </InfoTip>
                </label>
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
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 flex items-center">
                  Board
                  <InfoTip title="Board Theme">
                    <p>Choose the board background texture. Classic uses CSS colors, others use realistic textures.</p>
                  </InfoTip>
                </label>
                <Pill
                  columns={3}
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
                    🔒 Locked to Classic — Inner Safe Cells requires the CSS board.
                  </p>
                )}
              </section>
            </div>
          )}
        </div>
      </div>

      {/* ---- BOTTOM BAR ---- */}
      <div className="shrink-0 pb-[env(safe-area-inset-bottom)]">
        <div className="px-4 py-3 md:px-8 md:py-4 flex items-center justify-between gap-3 max-w-md mx-auto">

          {/* Back */}
          <button
            className="px-5 py-3 rounded-xl font-bold text-sm transition-all text-stone-600 bg-stone-100 hover:bg-stone-200 active:scale-95"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            ← Back
          </button>

          {/* Dots */}
          <div className="flex gap-1.5">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-500 ${s === step ? 'w-6 bg-amber-500' : s < step ? 'w-2 bg-amber-300' : 'w-2 bg-stone-200'
                  }`}
              />
            ))}
          </div>

          {/* Next / Start */}
          {step < 3 ? (
            <button
              className="px-5 py-3 bg-stone-800 text-white rounded-xl font-bold text-sm hover:bg-stone-900 active:scale-95 transition-all flex items-center gap-2"
              onClick={() => setStep((s) => Math.min(3, s + 1))}
            >
              Next
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              className="px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-black text-sm uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-amber-200/50 flex items-center gap-2"
              onClick={handleStart}
            >
              Start
              <Play size={16} fill="currentColor" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
