/* ReBeFit Napló — service worker
 * Új verzió kiadásakor NÖVELD a VERSION értékét, különben a telefonok a régit mutatják.
 */
const VERSION = 'v1.2.0';
const CACHE = 'rbf-naplo-' + VERSION;
const ASSETS = [
  './', './index.html', './style.css', './app.js', './manifest.webmanifest',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png', './icons/favicon-32.png',
  './fonts/inter-latin-wght-normal.woff2', './fonts/inter-latin-ext-wght-normal.woff2',
  './fonts/cormorant-garamond-latin-600-normal.woff2', './fonts/cormorant-garamond-latin-ext-600-normal.woff2',
  './fonts/cormorant-garamond-latin-700-normal.woff2', './fonts/cormorant-garamond-latin-ext-700-normal.woff2',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('rbf-naplo-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

// Cache-first: offline is mindig elindul. Frissítés a VERSION emelésével.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then(r => r || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  })));
});
