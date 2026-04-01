import {
  Globe,
  Smartphone,
  Wifi,
  Lock,
  Scale,
  Palette,
  Users,
  Zap,
  Heart
} from 'lucide-react';

interface AboutProps {
  onBack: () => void;
}

export function About({ onBack }: AboutProps) {
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
          <span className="text-sm font-bold text-stone-700">About</span>
          <div className="w-16" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-8 md:px-8">
        <div className="max-w-lg mx-auto space-y-8">

          {/* App Identity */}
          <div className="text-center">
            <div className="w-20 h-20 mx-auto rounded-2xl overflow-hidden shadow-xl shadow-amber-900/15 border-2 border-white/60 mb-4">
              <img src="/icons/icon-512.png" alt="Ashta Chamma" className="w-full h-full object-cover" draggable={false} />
            </div>
            <h1 className="text-2xl font-black text-stone-800">Ashta Chamma</h1>
            <p className="text-sm text-stone-500 mt-1">A timeless village game, reimagined</p>
          </div>

          {/* The Game */}
          <section className="bg-white/60 border border-stone-200/40 rounded-2xl p-5">
            <h2 className="text-sm font-black text-stone-700 uppercase tracking-wider mb-3">The Game</h2>
            <div className="space-y-3 text-sm text-stone-600 leading-relaxed">
              <p>
                <strong>Ashta Chamma</strong> (also known as <em>Daayam</em>, <em>Chowka Bara</em>, or <em>Katte Mane</em>)
                is one of India's oldest and most beloved board games. Played for centuries in villages across
                South India, it's a game of strategy, luck, and endless fun.
              </p>
              <p>
                Players roll cowrie shells or tamarind seeds as dice, moving their pawns around a cross-shaped board.
                The goal: get all your pawns safely to the center (HOME) before your opponents - while capturing
                their pieces along the way.
              </p>
              <p>
                This digital version brings the classic game to your phone and browser, preserving the authentic
                rules while adding modern conveniences like online multiplayer, customizable rules, and offline play.
              </p>
            </div>
          </section>

          {/* Features */}
          <section className="bg-white/60 border border-stone-200/40 rounded-2xl p-5">
            <h2 className="text-sm font-black text-stone-700 uppercase tracking-wider mb-3">Features</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: <Globe size={18} className="text-amber-500" />, title: 'Play Online', desc: 'With friends anywhere' },
                { icon: <Smartphone size={18} className="text-amber-500" />, title: 'Pass & Play', desc: 'Same device, no internet' },
                { icon: <Wifi size={18} className="text-amber-500" />, title: 'Works Offline', desc: 'Install as an app' },
                { icon: <Lock size={18} className="text-amber-500" />, title: 'No Login', desc: 'Jump right in' },
                { icon: <Scale size={18} className="text-amber-500" />, title: 'Fair Dice', desc: 'Anti-frustration system' },
                { icon: <Palette size={18} className="text-amber-500" />, title: 'Themes', desc: 'Wood, marble, slate & more' },
                { icon: <Users size={18} className="text-amber-500" />, title: 'Teams Mode', desc: '2v2 with teammates' },
                { icon: <Zap size={18} className="text-amber-500" />, title: 'Fast Games', desc: 'Customizable rules' },
              ].map((f) => (
                <div key={f.title} className="flex items-start gap-2.5 p-3 bg-stone-50/50 rounded-xl">
                  <div className="shrink-0 mt-0.5">{f.icon}</div>
                  <div>
                    <p className="text-xs font-bold text-stone-700">{f.title}</p>
                    <p className="text-[10px] text-stone-400 mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Developer */}
          <section className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/50 rounded-2xl p-5">
            <h2 className="text-sm font-black text-amber-800 uppercase tracking-wider mb-3">The Developer</h2>
            <div className="space-y-3 text-sm text-stone-600 leading-relaxed">
              <p>
                Built with <Heart size={14} className="inline text-red-500 fill-red-500" /> by <strong className="text-stone-800">Balaji Nayak</strong>.
              </p>
              <p>
                Growing up, Ashta Chamma was more than just a game - it was the sound of cowrie shells
                on a rangoli-drawn board, the laughter of cousins, the thrill of a last-second kill.
                Evenings in the village were spent huddled around this game, and those memories are
                some of the best.
              </p>
              <p>
                This project was built for everyone who misses those days - for people who grew up
                playing this game and want to relive it, and for a new generation who deserves to
                experience the same joy.
              </p>
              <p className="text-xs text-stone-400 italic">
                "Some games don't need fancy graphics or complex mechanics. They just need the right
                people around the board."
              </p>
            </div>
          </section>

          {/* Footer */}
          <div className="text-center pb-4">
            <p className="text-xs text-stone-400 flex items-center justify-center gap-1 mb-2">
              Made with <Heart size={12} className="text-red-400 fill-red-400" /> for village game lovers
            </p>
            <p className="text-xs text-stone-400">
              <a href="https://ashtachamma.tech" className="hover:text-stone-600 transition-colors no-underline text-stone-400">
                ashtachamma.tech
              </a>
              {' '}© {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
