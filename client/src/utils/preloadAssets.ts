// ============================================================================
// Asset Preloader — Cache all game images on first visit
// ============================================================================
// Runs in background on app mount. Uses <link rel="prefetch"> for images
// so the browser downloads them at low priority without blocking UI.

const GAME_ASSETS = [
  // Board backgrounds
  '/assets/board/paper.png',
  '/assets/board/wood.png',
  '/assets/board/marble.png',
  '/assets/board/slate.png',
  '/assets/board/wood_higher_resolution.png',
  '/assets/board/marble-higher_resolution.png',

  // Dice
  '/assets/dice/cowrie_open.png',
  '/assets/dice/cowrie_closed.png',
  '/assets/dice/seed_scratched.png',
  '/assets/dice/seed_dark.png',

  // Pawns — Ludo
  '/assets/pawns/ludo_red.png',
  '/assets/pawns/ludo_green.png',
  '/assets/pawns/ludo_yellow.png',
  '/assets/pawns/ludo_blue.png',

  // Pawns — Checkers
  '/assets/pawns/checker_red.png',
  '/assets/pawns/checker_green.png',
  '/assets/pawns/checker_yellow.png',
  '/assets/pawns/checker_blue.png',

  // Pawns — Rural
  '/assets/pawns/rural_stone.png',
  '/assets/pawns/rural_seed.png',
  '/assets/pawns/rural_stick.png',
  '/assets/pawns/rural_nut.png',
];

let preloaded = false;

export function preloadAssets(): void {
  if (preloaded) return;
  preloaded = true;

  // Use requestIdleCallback (or setTimeout fallback) to avoid blocking main thread
  const schedule = window.requestIdleCallback || ((cb: () => void) => setTimeout(cb, 200));

  schedule(() => {
    for (const src of GAME_ASSETS) {
      const img = new Image();
      img.src = src;
    }
  });
}
