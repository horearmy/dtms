const CACHE_NAME = 'dtms-v4';
const PRECACHE = [
  '/login',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/api/')) return;
  // Jangan cache Next.js internals — biarkan network langsung
  if (e.request.url.includes('/_next/')) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && e.request.url.startsWith(self.location.origin)) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((cached) => {
          if (cached) return cached;
          // Kembalikan response 503 yang valid agar tidak TypeError: Failed to convert value to 'Response'
          return new Response('Offline — tidak ada cache', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        })
      )
  );
});
