// Service Worker - Despacho R&C Abogados
const CACHE_VERSION = 'rc-abogados-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;

// Solo cachear imágenes/iconos estáticos (nunca JS/CSS que cambian con cada build)
const PRECACHE_URLS = [
  '/manifest.json',
  '/Logo.jpg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

// Install: precache solo recursos estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

// Activate: limpiar caches antiguos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: Network first para TODO (excepto imágenes cacheadas)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((res) => {
        // Solo cachear imágenes/iconos estáticos
        if (res.ok && /\.(png|jpg|jpeg|svg|ico|webp)$/i.test(url.pathname)) {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});
