var CACHE_NAME = 'entexplain-v18';

var PRECACHE_URLS = [
  './',
  './index.html',
  './css/style.css',
  './js/reader-session.js',
  './js/app.js',
  './manifest.json',
  './procedures/index.json',
  './procedures/h-pylori-sequential.json',
  './images/h-pylori-sequential/thumb.png',
  './images/h-pylori-sequential/step1.png',
  './images/mounjaro/mounjaro-logo.svg',
  './images/wegovy/wegovy-logo-nav.png',
  './images/chlorella/thumb.webp',
  './images/chlorella/step1.webp',
  './images/chlorella/step2.webp',
  './images/chlorella/step3.webp',
  './images/chlorella/step4.webp',
  './images/chlorella/step5.webp'
];

// Install: precache core resources
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(PRECACHE_URLS);
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

// Activate: clean up old caches
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (cacheNames) {
        return Promise.all(
          cacheNames
            .filter(function (name) { return name !== CACHE_NAME; })
            .map(function (name) { return caches.delete(name); })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

// Fetch: cache-first with background update
self.addEventListener('fetch', function (event) {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then(function (cachedResponse) {
        // Background update: fetch fresh copy and update cache
        var fetchPromise = fetch(event.request)
          .then(function (networkResponse) {
            if (networkResponse && networkResponse.status === 200) {
              var responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then(function (cache) {
                cache.put(event.request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(function () {
            // Network failed, cached response is all we have
            return cachedResponse;
          });

        // Return cached response immediately, or wait for network
        return cachedResponse || fetchPromise;
      })
  );
});
