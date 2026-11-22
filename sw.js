// Watchlog alpha 0.0.1 — service worker: keeps the app usable offline.
const SHELL = 'watchlog-shell-alpha-0.0.1'; // bump with every release
const RUNTIME = 'watchlog-runtime-v1';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== SHELL && !k.startsWith(RUNTIME)).map(k => caches.delete(k))
  )));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Posters and fonts: cache first. CORS and plain requests are cached separately
  // so a plain (opaque) copy never blocks the dot-matrix poster drawing.
  if (url.hostname === 'image.tmdb.org' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    const name = RUNTIME + (req.mode === 'cors' ? '-cors' : '-plain');
    e.respondWith(caches.open(name).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }));
    return;
  }

  // The app itself: network first so updates arrive, cache when offline.
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      caches.open(SHELL).then(c => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
  }
  // TMDB API calls go straight to the network.
});
