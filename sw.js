// Cache-first service worker so the app opens instantly and works offline.
const CACHE = 'd2m-v6';
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'grammar.js', 'lid.js', 'manifest.webmanifest',
  'data/vocab.json', 'data/decode.json', 'data/lid.json', 'data/tasks.json', 'data/missions.json', 'data/workbook.json', 'data/grammar.json', 'data/lessons.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
// Serve from cache, refresh the cache in the background (stale-while-revalidate).
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
