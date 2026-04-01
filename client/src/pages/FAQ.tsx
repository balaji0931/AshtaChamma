import { useState } from 'react';
import { HelpCircle, ChevronDown, BookOpen } from 'lucide-react';

interface FAQProps {
  onBack: () => void;
}

interface FAQItem {
  q: string;
  a: string;
}

const faqs: FAQItem[] = [
  {
    q: 'What is Ashta Chamma?',
    a: 'Ashta Chamma (also called Daayam, Chowka Bara, or Katte Mane) is an ancient Indian board game played for centuries in villages across South India. Players roll dice (cowrie shells or tamarind seeds) and race their pawns to the center of the board while capturing opponent pieces.',
  },
  {
    q: 'How do I play online with friends?',
    a: 'Tap "Play Online" on the home page. You can create a private room with a code and share it with friends, or join an existing room. No login or account needed — just share the 6-letter room code.',
  },
  {
    q: 'Can I play offline?',
    a: 'Yes! Use "Pass & Play" mode to play on the same device — just pass the phone between turns. If you install the app (via the Install button), it works completely offline with no internet needed.',
  },
  {
    q: 'How does the dice work?',
    a: 'The game uses 4 cowrie shells (or tamarind seeds). The number of shells landing face-up determines your move: 0 whites = 8 steps (+ extra turn), 1 white = 1 step, 2 whites = 2 steps, 3 whites = 3 steps, 4 whites = 4 steps (+ extra turn). Values 4 and 8 also let you bring new pawns onto the board.',
  },
  {
    q: 'What is "Fair Dice" mode?',
    a: 'Fair Dice applies very gentle probability adjustments (2-4%) to reduce frustrating bad-luck streaks. If you\'re stuck with no pawns on the board for many turns, it slightly increases your chance of rolling a 4 or 8. The adjustments are tiny and capped — you won\'t notice them, but they prevent extreme frustration. Choose "Random" mode for pure equal probability.',
  },
  {
    q: 'How do I capture (kill) opponent pawns?',
    a: 'Land on a cell occupied by an opponent\'s pawn, and it gets sent back to their start. But be careful — pawns on safe cells (marked with an X) cannot be captured. Corner entry cells and the inner path are also safe zones.',
  },
  {
    q: 'What is the inner path?',
    a: 'After completing a full loop around the outer board, your pawn enters the inner diagonal path toward HOME (the center). Depending on your rules setting, you may need to kill at least one opponent pawn before entering the inner path.',
  },
  {
    q: 'What happens if I disconnect during an online game?',
    a: 'You get a grace period to reconnect. If you don\'t return within a few turns, your turns are automatically skipped. You can rejoin an in-progress game by entering the same room code — the game will recognize you and put you back in.',
  },
  {
    q: 'Can I play in teams?',
    a: 'Yes! In 4-player games, you can choose "Teams (2v2)" mode. Players A+C form one team and B+D form another. If your teammate disconnects, you can play their turns too.',
  },
  {
    q: 'How do I install the app?',
    a: 'On the home page, tap "Install App" (if available). On Android Chrome, you can also tap the ⋮ menu → "Install App". On iOS Safari, tap the share button → "Add to Home Screen". The installed app works offline and opens without browser UI.',
  },
  {
    q: 'Is there a time limit for turns?',
    a: 'In online games, yes — you have 30 seconds to roll and 30 seconds to select a move. If time runs out, the game auto-plays for you. In Pass & Play mode, there\'s no time limit.',
  },
  {
    q: 'Is this game free?',
    a: 'Yes, completely free. No ads, no in-app purchases, no login required. Just play.',
  },
];

export function FAQ({ onBack }: FAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-[#faf8f4] to-[#f0ece4]">
      {/* Navbar */}
      <div className="pt-[env(safe-area-inset-top)] shrink-0 bg-white/40 backdrop-blur-sm border-b border-stone-200/40">
        <div className="flex items-center justify-between px-4 py-2.5 max-w-2xl mx-auto">
          <button
            className="px-3 py-1.5 text-stone-500 text-sm font-semibold hover:text-stone-700 active:scale-95 transition-all"
            onClick={onBack}
          >
            ← Back
          </button>
          <span className="text-sm font-bold text-stone-700">FAQ</span>
          <div className="w-16" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-8 md:px-8">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <HelpCircle size={48} className="text-amber-500" />
            </div>
            <h1 className="text-2xl font-black text-stone-800">Frequently Asked Questions</h1>
            <p className="text-sm text-stone-500 mt-1">Everything you need to know about Ashta Chamma</p>
          </div>

          <div className="space-y-2">
            {faqs.map((faq, i) => {
              const isOpen = openIndex === i;
              return (
                <div
                  key={i}
                  className="bg-white/60 border border-stone-200/40 rounded-xl overflow-hidden transition-all"
                >
                  <button
                    className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-white/80 transition-colors"
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                  >
                    <span className="text-sm font-semibold text-stone-700 pr-4">{faq.q}</span>
                    <ChevronDown
                      size={18}
                      className={`text-stone-400 shrink-0 transition-transform duration-300 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4">
                      <p className="text-sm text-stone-500 leading-relaxed">{faq.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="text-center py-8">
            <p className="text-xs text-stone-400 flex items-center justify-center gap-1.5">
              <BookOpen size={14} className="text-amber-500" />
              Still have questions? The game explains rules in-app with the guide.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
