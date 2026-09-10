/**
 * WL Wordly - Service Worker (PWA Offline & Caching Engine)
 */

const CACHE_NAME = 'wlwordly-cache-v1.0.0';

// Alapvető helyi fájlok gyorsítótárazása
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/auth.js',
  './js/excel.js',
  './js/storage.js',
  './js/practice.js',
  './js/firebaseConfig.js',
  './js/pwa.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/favicon.png'
];

// Telepítés és előtöltés
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[ServiceWorker] Előtöltött gyorsítótár létrehozása...');
      try {
        await cache.addAll(STATIC_ASSETS);
      } catch (err) {
        console.warn('[ServiceWorker] Néhány fájl előtöltése sikertelen volt:', err);
      }
    }).then(() => self.skipWaiting())
  );
});

// Aktiválás és régi gyorsítótárak törlése
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Régi gyorsítótár törlése:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Hálózati kérések kezelése (Stale-While-Revalidate & Cache-First offline fallback)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Csak GET kéréseket gyorsítótárazunk
  if (req.method !== 'GET') return;

  // Firebase Auth kérések közvetlenül menjenek a hálózatra
  if (url.hostname.includes('googleapis.com') && url.pathname.includes('/identitytoolkit/')) {
    return;
  }

  // HTML navigációs kérések (SPA útvonalak offline kiszolgálása)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => {
        return caches.match('./index.html') || caches.match('./');
      })
    );
    return;
  }

  // Statikus fájlok és CDN elemek (Stale-While-Revalidate)
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseToCache);
          });
        }
        return networkResponse;
      }).catch((err) => {
        // Hálózat hiba esetén, ha van cache, az visszatért már fent
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});
