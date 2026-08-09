const CACHE_NAME = 'sipena-lite-v81';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/logo.svg',
  './css/styles.css',
  './js/seed-data.js',
  './js/app.js',
  './js/db.js',
  './js/modules/utils.js',
  './js/modules/master-bkph.js',
  './js/modules/master-rph.js',
  './js/modules/master-tpg.js',
  './js/modules/master-petak.js',
  './js/modules/master-penyadap.js',
  './js/modules/master-penugasan.js',
  './js/modules/master-user.js',
  './js/modules/master-import.js',
  './js/modules/master.js',
  './js/modules/target.js',
  './js/modules/realisasi.js',
  './js/modules/dashboard.js',
  './js/modules/laporan.js'
];

// Install Service Worker and cache essential assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell');
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Service Worker and clean up old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Strategy: Network-First for JS/CSS/HTML (falls back to Cache when offline)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(e.request);
      })
  );
});
