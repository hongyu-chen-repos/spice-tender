// Offline support. The app is a handful of static files and three JSON documents,
// so the whole thing is precached on install: a kitchen is exactly where the
// signal drops out. Bump CACHE when any of these files change.
const CACHE = 'spice-tender-v1';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './assets/app.css', './assets/icon.svg', './assets/icon-192.png', './assets/icon-512.png',
  './src/app.js', './src/ui/i18n.js', './src/ui/tints.js',
  './src/engine/index.js', './src/engine/units.js', './src/engine/scale.js', './src/engine/heat.js',
  './src/engine/plan.js', './src/engine/substitute.js', './src/engine/pairing.js',
  './src/engine/pantry.js', './src/engine/shopping.js', './src/engine/compose.js',
  './data/spices.json', './data/blends.json', './data/dishes.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Cache first, then network, and refresh the cache in the background when online.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(caches.match(e.request).then((hit) => {
    const live = fetch(e.request).then((res) => {
      if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
      return res;
    }).catch(() => hit);
    return hit || live;
  }));
});
