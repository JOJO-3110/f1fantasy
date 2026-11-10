/* Service Worker der F1 Fantasy Liga.
   - Die Seite selbst wird immer zuerst aus dem Netz geholt (so kommen Updates sofort an)
     und nur offline aus dem Zwischenspeicher gezeigt.
   - Symbole und Manifest kommen aus dem Zwischenspeicher.
   - Schriften werden zwischengespeichert.
   - Daten (Supabase, F1-Feeds) und Fotos gehen immer direkt ans Netz und werden nie gespeichert. */
const V = 'f1-liga-v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  const font = /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!same && !font) return; // Supabase, OpenF1, Fotos: nicht anfassen

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => { const copy = res.clone(); caches.open(V).then(c => c.put('index.html', copy)); return res; })
        .catch(() => caches.match('index.html').then(r => r || caches.match('./')))
    );
    return;
  }
  if (font) {
    e.respondWith(
      caches.open(V).then(c => c.match(req).then(hit => {
        const net = fetch(req).then(res => { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      }))
    );
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(V).then(c => c.put(req, copy)); }
    return res;
  })));
});
