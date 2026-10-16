// Офлайн-кеш «Белки». При каждом выпуске увеличивайте VERSION.
const VERSION = '1.0.0';
const CACHE = `belka-${VERSION}`;
const FONTS = 'belka-fonts';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/ui.js', './js/game.js', './js/engine.js', './js/i18n.js', './js/storage.js',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('belka-') && k !== CACHE && k !== FONTS) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

const timeout = ms => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate'){
    e.respondWith((async () => {
      try { return await Promise.race([fetch(req), timeout(3000)]); }
      catch { return (await caches.match('./index.html')) || Response.error(); }
    })());
    return;
  }
  if (url.origin === self.location.origin){
    e.respondWith((async () => (await caches.match(req)) || fetch(req))());
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'){
    e.respondWith((async () => {
      const cache = await caches.open(FONTS);
      const hit = await cache.match(req);
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }).catch(() => null);
      return hit || (await net) || Response.error();
    })());
  }
});
