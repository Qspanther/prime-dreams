// ─── Prime Dreams Progressive Web App Service Worker ───
// Network-first for navigation, ensure mobile devices always fetch the latest live release.
const CACHE_NAME = 'prime-dreams-v5';

self.addEventListener('install', (event) => {
  // Activate immediately without waiting for existing tabs to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Purging old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Bypass all non-GET, API, backend proxy, socket, and telemetry requests
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/api-backend') ||
    url.pathname.startsWith('/socket.io')
  ) {
    return;
  }

  // 2. NETWORK-FIRST for HTML / page navigation
  // This guarantees mobile phones and PWAs always see the newest live version
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline, serve from cache
          return caches.match(event.request);
        })
    );
    return;
  }

  // 3. CACHE-FIRST for Immutable Next.js static assets and media (Instant 0ms mobile loads)
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/cricket/') ||
    url.pathname.match(/\.(?:woff2?|ttf|otf|eot|ico|png|jpg|jpeg|webp|svg|css)$/i)
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => cachedResponse);
      })
    );
    return;
  }
});

// ─── Web Push (FCM-style) — display notification ───
self.addEventListener('push', (event) => {
  let data = { title: 'Prime Dreams', message: 'You have a new notification', type: 'system' };
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (_) {}

  const options = {
    body: data.message || data.body || '',
    icon: '/globe.svg',
    badge: '/globe.svg',
    data: { url: data.url || '/' },
    tag: data.type || 'notification',
    requireInteraction: false,
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(data.title || 'Prime Dreams', options));
});

// ─── Notification click → navigate to target ───
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
