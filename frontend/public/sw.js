// ─── Creator 11 Progressive Web App Service Worker ───
// Handles offline caching + Web Push (FCM-style) notifications.
const CACHE_NAME = 'creator11-v1';
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/globe.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Let API requests pass straight through to network with SmartEngine
  if (event.request.url.includes('/api/') || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        // Fallback for document navigation when offline
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});

// ─── Web Push (FCM-style) — display notification ───
self.addEventListener('push', (event) => {
  let data = { title: 'Prime Dreems', message: 'You have a new notification', type: 'system' };
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (_) {
    // fall back to defaults if payload is not valid JSON
  }

  const options = {
    body: data.message || data.body || '',
    icon: '/globe.svg',
    badge: '/globe.svg',
    data: { url: data.url || '/' },
    tag: data.type || 'notification',
    requireInteraction: false,
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(data.title || 'Prime Dreems', options));
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
