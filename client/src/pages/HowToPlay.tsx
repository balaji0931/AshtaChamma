import { 
  Target, 
  Map as MapIcon, 
  Circle, 
  DoorOpen, 
  Swords, 
  Home as HomeIcon, 
  Dice5,
  RefreshCw,
  Trophy,
  Settings,
  Lightbulb,
  Check,
  Star,
  Lock,
  X
} from 'lucide-react';

interface HowToPlayProps {
  onClose: () => void;
}

export function HowToPlay({ onClose }: HowToPlayProps) {
  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-[#faf8f4] to-[#f0ece4] flex flex-col">
      {/* Header */}
      <div className="pt-[env(safe-area-inset-top)] shrink-0 border-b border-stone-200/60 bg-white/60 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
          <button
            className="px-3 py-1.5 text-sm font-bold text-stone-500 hover:text-stone-800 transition-colors"
            onClick={onClose}
          >
            ← Back
          </button>
          <h2 className="text-sm font-black text-stone-800 uppercase tracking-wider">How to Play</h2>
          <div className="w-16" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Intro */}
          <Section icon={<Target size={18} className="text-amber-500" />} title="What is Ashta Chamma?">
            <p>
              Ashta Chamma (meaning "Eight-Four") is a traditional Indian board game.
              It's played on a <strong>5×5 square grid</strong> where 2–4 players race their
              pawns around the outer edge, then spiral inward to reach HOME at the center.
            </p>
            <p className="mt-2">
              Each player has <strong>4 pawns</strong> and sits at one corner of the board.
              The first player to get all their pawns to HOME wins!
            </p>
          </Section>

          {/* Board */}
          <Section icon={<MapIcon size={18} className="text-amber-500" />} title="The Board">
            <p>
              The board is a <strong>5×5 grid</strong> with 25 cells. Players start from
              the 4 corners:
            </p>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <CornerTag color="bg-red-500" label="Player A" corner="Top-left" />
              <CornerTag color="bg-green-500" label="Player B" corner="Left-bottom area" />
              <CornerTag color="bg-yellow-500" label="Player C" corner="Bottom-right" />
              <CornerTag color="bg-blue-500" label="Player D" corner="Right-top area" />
            </div>
            <p className="mt-3">
              The <strong>outer track</strong> runs along the perimeter (16 cells).
              The <strong>inner spiral</strong> goes through the middle 8 cells toward
              the center. The center cell is <strong>HOME</strong>.
            </p>
            <Highlight>
              <strong>Safe Cells (<Star size={12} className="inline mr-1" />):</strong> The 4 corner entry cells are safe zones.
              Pawns on safe cells <strong>cannot be killed</strong>. Multiple players'
              pawns can share a safe cell.
            </Highlight>
          </Section>

          {/* Dice */}
          <Section icon={<Dice5 size={18} className="text-amber-500" />} title="Rolling the Dice">
            <p>
              Ashta Chamma uses <strong>4 cowrie shells</strong> (or tamarind seeds)
              instead of numbered dice. You throw all 4 at once — the number of shells
              landing face-up determines your roll:
            </p>
            <div className="mt-3 space-y-1.5">
              <DiceRow shells="1 open" value="1" extra={false} />
              <DiceRow shells="2 open" value="2" extra={false} />
              <DiceRow shells="3 open" value="3" extra={false} />
              <DiceRow shells="4 open" value="4" extra={true} />
              <DiceRow shells="0 open" value="8" extra={true} />
            </div>
            <Highlight>
              Rolling <strong>4 or 8</strong> gives you an <strong>extra turn</strong>!
              You can chain multiple extra turns — up to 3 consecutive bonus turns.
            </Highlight>
          </Section>

          {/* Entry */}
          <Section icon={<DoorOpen size={18} className="text-amber-500" />} title="Entering the Board">
            <p>
              All pawns start <strong>outside the board</strong>. To bring a pawn onto
              the board, you must roll a <strong>4 or 8</strong>. The pawn enters at
              your corner's entry cell (a safe cell).
            </p>
            <Highlight>
              Rolling <strong>8</strong> is special — it enters <strong>2 pawns</strong>
              at once (if you have 2+ pawns outside)! This is called <strong>Double Entry</strong>.
            </Highlight>
            <p className="mt-2 text-stone-500 text-[11px]">
              <Lightbulb size={10} className="inline mr-1" /> Tip: You can change the "Starting Pawns" setting to skip the entry phase
              and start with pawns already on the board.
            </p>
          </Section>

          {/* Movement */}
          <Section icon={<RefreshCw size={18} className="text-amber-500" />} title="Moving Pawns">
            <p>
              After rolling, choose which pawn to move. Pawns travel along the
              <strong> outer track</strong> (the perimeter of the 5×5 grid) in order.
            </p>
            <NumberedList items={[
              'Roll the dice — your roll value is how many cells the pawn moves',
              'Tap the pawn you want to move (highlighted pawns have valid moves)',
              'If only one pawn can move, it moves automatically',
              'If no valid moves exist, your turn is skipped after a short delay',
            ]} />
            <p className="mt-3">
              After completing a full loop of the outer track (16 cells), the pawn
              enters the <strong>inner spiral</strong> — heading toward HOME at the center.
            </p>
          </Section>

          {/* Killing */}
          <Section icon={<Swords size={18} className="text-amber-500" />} title="Killing Opponents">
            <p>
              If your pawn lands on a cell with an <strong>opponent's pawn</strong>,
              that pawn is <strong>killed</strong> — sent back outside the board. They'll
              need to roll 4 or 8 again to re-enter.
            </p>
            <Highlight>
              <strong>Killing gives you an extra turn!</strong> This stacks with the 4/8
              extra turn — so a kill on a 4 or 8 still only counts as one extra turn.
            </Highlight>
            <div className="mt-3 space-y-1.5">
              <RuleRow icon={<Check size={14} className="text-emerald-500" />} text="You CAN kill on normal (non-safe) cells" />
              <RuleRow icon={<Lock size={14} className="text-rose-500" />} text="You CANNOT kill on safe cells (★)" />
              <RuleRow icon={<Lock size={14} className="text-rose-500" />} text="You CANNOT kill teammates (in team mode)" />
              <RuleRow icon={<Lock size={14} className="text-rose-500" />} text="You CANNOT kill pawns on the inner path" />
            </div>
          </Section>

          {/* Inner Path */}
          <Section icon={<HomeIcon size={18} className="text-amber-500" />} title="Inner Path & HOME">
            <p>
              After a pawn completes the outer loop (16 cells), it enters the
              <strong> inner spiral</strong> — an 8-cell path winding toward the center.
              Pawns on the inner path are <strong>safe from kills</strong>.
            </p>
            <p className="mt-2">
              The final cell is <strong>HOME</strong> (the center of the board). To get
              there, your pawn must land exactly on it — or bounce back, depending on
              the Overshoot Rule setting.
            </p>
            <Highlight>
              <strong>Inner Path Entry Rule (setting):</strong> By default, a pawn can
              only enter the inner path after you've <strong>killed at least one opponent</strong>.
              With "Free Entry", no kill is needed.
            </Highlight>
          </Section>

          {/* Paired Mode */}
          <Section icon={<div className="flex gap-0.5"><Circle size={12} fill="currentColor"/><Circle size={12} fill="currentColor"/></div>} title="Paired Mode (Optional)">
            <p>
              In <strong>Paired</strong> game mode, two of your own pawns on the same
              <strong> non-safe cell</strong> automatically form a <strong>pair</strong>.
            </p>
            <div className="mt-2 space-y-1.5">
              <RuleRow icon={<Check size={14} className="text-emerald-500" />} text="Pairs move together as one unit" />
              <RuleRow icon={<Check size={14} className="text-emerald-500" />} text="Pairs can only move on even dice (2, 4, 8) at half speed" />
              <RuleRow icon={<Check size={14} className="text-emerald-500" />} text="Pairs block opponents — can't be passed unless opponent rolls 4 or 8" />
              <RuleRow icon={<Lock size={14} className="text-amber-500" />} text="Pairs dissolve on safe cells (can't pair on safe cells)" />
            </div>
          </Section>

          {/* Extra Turns */}
          <Section icon={<RefreshCw size={18} className="text-amber-500" />} title="Extra Turns">
            <p>You get an extra turn when:</p>
            <div className="mt-2 space-y-1.5">
              <RuleRow icon={<Dice5 size={14} className="text-amber-500" />} text="You roll a 4 (all shells open)" />
              <RuleRow icon={<Dice5 size={14} className="text-amber-500" />} text="You roll an 8 (no shells open)" />
              <RuleRow icon={<Swords size={14} className="text-amber-600" />} text="You kill an opponent's pawn" />
            </div>
            <Highlight>
              Extra turns are capped at <strong>3 consecutive</strong> bonus turns. After
              3 extras, your turn passes to the next player even if you roll 4 or 8.
            </Highlight>
          </Section>

          {/* Winning */}
          <Section icon={<Trophy size={18} className="text-amber-500" />} title="Winning the Game">
            <p>
              Get all <strong>4 of your pawns</strong> to the HOME cell (center) to win!
            </p>
            <p className="mt-2">
              In a multiplayer game, players who finish are ranked in order. The game
              continues until all players finish (or only one remains).
            </p>
            <p className="mt-2">
              In <strong>Teams mode</strong> (2v2), both teammates must finish all
              their pawns for the team to win. If your teammate disconnects, you can
              play their moves.
            </p>
          </Section>

          {/* Settings Quick Reference */}
          <Section icon={<Settings size={18} className="text-amber-500" />} title="Settings Quick Reference">
            <div className="space-y-3">
              <SettingRef name="Game Mode" options="Classic (independent pawns) or Paired (pawns can pair up)" />
              <SettingRef name="Starting Pawns" options="0–4 pawns start on the board. Default: 0 (all outside)" />
              <SettingRef name="Inner Path Entry" options="Must Kill First (default) or Free Entry" />
              <SettingRef name="Overshoot Rule" options="Rotate (bounce back) or Exact Only (must land exactly)" />
              <SettingRef name="Play Style" options="All vs All or Teams 2v2 (4-player only)" />
              <SettingRef name="Dice Mode" options="Fair (gentle balance adjustments) or Random (pure equal probability)" />
            </div>
          </Section>

          {/* Tips */}
          <Section icon={<Lightbulb size={18} className="text-amber-500" />} title="Pro Tips">
            <NumberedList items={[
              'Kill early — it unlocks the inner path and sends opponents back to start',
              'Park on safe cells when opponents are nearby — you\'re immune there',
              'Rolling 4 or 8 gives extra turns — use chains to rush pawns forward',
              'Spread your pawns instead of stacking — more move options each turn',
              'In teams, coordinate with your partner\'s pawn positions',
              'An 8 can enter 2 pawns at once — powerful for a quick start',
            ]} />
          </Section>

          <div className="h-12" />
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white/60 border border-stone-200/50 rounded-2xl p-5 shadow-sm">
      <h3 className="flex items-center gap-2 text-base font-black text-stone-800 mb-3">
        <span className="shrink-0">{icon}</span>
        {title}
      </h3>
      <div className="text-[13px] text-stone-600 leading-relaxed">{children}</div>
    </section>
  );
}

function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 px-3.5 py-2.5 bg-amber-50 border border-amber-200/60 rounded-xl text-[12px] text-amber-800 leading-relaxed">
      {children}
    </div>
  );
}

function DiceRow({ shells, value, extra }: { shells: string; value: string; extra: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 bg-stone-50 rounded-lg">
      <span className={`w-7 h-7 rounded-full text-white text-xs font-black flex items-center justify-center shrink-0 ${extra ? 'bg-amber-500' : 'bg-stone-400'}`}>
        {value}
      </span>
      <span className="text-[12px] text-stone-600 flex-1">{shells}</span>
      {extra && <span className="text-[9px] font-bold text-amber-600 uppercase bg-amber-100 px-1.5 py-0.5 rounded">+Turn</span>}
    </div>
  );
}

function RuleRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2 text-[12px]">
      <span className="shrink-0 mt-0.5">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function NumberedList({ items }: { items: string[] }) {
  return (
    <ol className="mt-2 space-y-1.5 pl-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-[12px]">
          <span className="w-5 h-5 rounded-full bg-stone-100 text-stone-500 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function CornerTag({ color, label, corner }: { color: string; label: string; corner: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-stone-50 rounded-lg">
      <div className={`w-3 h-3 rounded-full ${color}`} />
      <div>
        <p className="text-[11px] font-bold text-stone-700">{label}</p>
        <p className="text-[10px] text-stone-400">{corner}</p>
      </div>
    </div>
  );
}

function SettingRef({ name, options }: { name: string; options: string }) {
  return (
    <div className="pl-3 border-l-2 border-amber-300">
      <p className="text-[11px] font-bold text-stone-700">{name}</p>
      <p className="text-[11px] text-stone-500">{options}</p>
    </div>
  );
}
