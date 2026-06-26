const CACHE_NAME = 'lyria-static-v3';
console.log('[Lyria PWA] Service Worker loaded. Cache version:', CACHE_NAME);

// Dynamic caching service worker.
// Uses Network-First for documents/routes (to prevent version trapping on new deployments).
// Uses Stale-While-Revalidate for static assets (js, css, images).
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          // Clean up old cache versions
          if (cache !== CACHE_NAME) {
            console.log('[Lyria PWA] Cleaning up old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests and skip external/Supabase API requests
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Skip hot reloading / web socket requests in development
  if (url.pathname.includes('chrome-extension') || url.pathname.includes('@vite')) {
    return;
  }

  // 1. Navigation/Document requests (HTML pages & routing)
  // STRATEGY: Network-First. Always check the network for the latest deployment,
  // falling back to local cache only if offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              // Cache the root / index.html for offline loading
              cache.put('/', responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback
          return caches.match('/');
        })
    );
    return;
  }

  // 2. Static Assets (JS, CSS, Images, Fonts)
  // STRATEGY: Stale-While-Revalidate. Load instantly from cache, and fetch
  // updated version in the background if network is available.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh version in background to update cache
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {/* Ignore network errors on background updates */});

        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // If resource is not in cache and network fails, return standard error
        return new Response('Rede indisponível offline', { status: 503, statusText: 'Offline' });
      });
    })
  );
});

// Generic Push Notification Listener
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Lembrete Lyria', body: event.data.text() };
    }
  }

  const title = data.title || 'Lembrete Lyria';
  const options = {
    body: data.body || '',
    icon: data.icon || '/favicon.svg',
    badge: data.badge || '/favicon.svg',
    data: {
      url: data.url || '/ia'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Generic Notification Click Listener
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/ia';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window matching domain, navigating to target URL if different
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (client.url !== urlToOpen && 'navigate' in client) {
            client.navigate(urlToOpen);
          }
          return client.focus();
        }
      }
      // Or open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
