// Service worker — makes the web app installable on Chromebooks and
// usable offline. Strategy:
//   • On install, pre-cache the core shell (HTML, CSS, JS, banks, specs).
//   • On fetch, "stale-while-revalidate" — serve from cache instantly,
//     then refresh the cache in the background. Means students see new
//     content the second time they open the app after we ship a release.
//   • On activate, drop old caches.
//
// Bump CACHE on every release so clients pick up new code immediately
// rather than waiting for stale-while-revalidate.

const CACHE = 'mathsfs-v1';

const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/renderer/styles/main.css',
  './src/renderer/styles/print.css',
  './src/renderer/app.js',
  './src/renderer/bridge.js',
  './src/renderer/screens/components.js',
  './src/renderer/screens/home.js',
  './src/renderer/screens/paper.js',
  './src/renderer/screens/results.js',
  './src/renderer/screens/history.js',
  './src/renderer/screens/progress.js',
  './src/renderer/screens/games.js',
  './src/renderer/screens/game-quickfire.js',
  './src/renderer/screens/game-flashcards.js',
  './src/renderer/screens/game-dragdrop.js',
  './src/renderer/screens/topics.js',
  './src/renderer/screens/teacher.js',
  './src/renderer/screens/print.js',
  './src/renderer/engine/paper-builder.js',
  './src/renderer/engine/marker.js',
  './assets/banks/e3.json',
  './assets/banks/l1.json',
  './assets/banks/l2.json',
  './assets/spec/e3.json',
  './assets/spec/l1.json',
  './assets/spec/l2.json',
  './assets/icons/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Only same-origin requests are cached.
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then((res) => {
      // Only cache successful, same-origin responses.
      if (res && res.status === 200 && res.type === 'basic') {
        cache.put(req, res.clone());
      }
      return res;
    }).catch(() => null);
    return cached || (await network) || new Response('Offline', { status: 503 });
  })());
});
