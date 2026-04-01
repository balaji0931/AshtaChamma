// ============================================================================
// Service Worker — Offline-first PWA for Ashta Chamma
// ============================================================================
// Strategy:
//   - Precache: game board/pawn/dice images + icons + manifest (known URLs)
//   - Runtime: cache-first for hashed assets (JS/CSS from Vite build)
//   - Network-first for HTML (to get latest app version)
//   - Skip API and Socket.io (online-only features)

const CACHE_VERSION = 'ashta-chamma-v2';
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icons/favicon-16.png',
  '/icons/favicon-32.png',
  '/icons/icon-48.png',
  '/icons/icon-96.png',
  '/icons/icon-192.png',
  '/icons/icon-384.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  // Board backgrounds
  '/assets/board/paper.png',
  '/assets/board/wood.png',
  '/assets/board/wood_higher_resolution.png',
  '/assets/board/marble.png',
  '/assets/board/marble-higher_resolution.png',
  '/assets/board/slate.png',
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

// ── Install: precache game assets ────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // Use individual adds so one failure doesn't block the rest
      return Promise.allSettled(
        PRECACHE_URLS.map((url) => cache.add(url).catch(() => {
          console.warn('[SW] Failed to precache:', url);
        }))
      );
    })
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: smart caching strategy ────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip API, Socket.io, and chrome-extension requests
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/socket.io') ||
    url.protocol === 'chrome-extension:'
  ) {
    return;
  }

  // ── Navigation (HTML pages) → Network-first, fall back to cached / ──
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache the latest HTML
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('/', clone));
          return response;
        })
        .catch(() => {
          // Offline: serve cached index.html
          return caches.match('/').then((cached) => {
            return cached || new Response('Offline — please connect to the internet and reload.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            });
          });
        })
    );
    return;
  }

  // ── Hashed assets (JS/CSS from Vite) → Cache-first ──
  // These have content hashes in filenames; once cached, they never change
  if (url.pathname.startsWith('/assets/') && url.pathname.match(/\.[a-f0-9]{8}\./)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // ── Static assets (images, fonts, sounds) → Cache-first ──
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.mp3') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff')
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => caches.match(event.request));
      })
    );
    return;
  }

  // ── Everything else → Network-first with cache fallback ──
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
