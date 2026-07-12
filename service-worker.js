const CACHE_NAME = 'sipena-lite-v16';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/logo.svg',
  './css/styles.css',
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

// Fetch Strategy: Stale-While-Revalidate (offline-first)
self.addEventListener('fetch', (e) => {
  // Only handle GET requests and local assets (skip browser extensions, chrome-extension://, api endpoints, etc.)
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) {
    return;
  }

  e.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(e.request).then((cachedResponse) => {
        const fetchedResponse = fetch(e.request).then((networkResponse) => {
          // If valid response, update the cache copy in background
          if (networkResponse.status === 200) {
            cache.put(e.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // Silent catch for network failure
        });

        // Return cache hit, or fallback to network request
        return cachedResponse || fetchedResponse;
      });
    })
  );
});
