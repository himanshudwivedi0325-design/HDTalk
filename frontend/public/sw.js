// HDTalk Service Worker: PWA Offline App Shell, Caching & Web Push Notifications
const CACHE_NAME = 'hdtalk-pwa-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/hdtalk-logo.jpg'
];

// Install Event: Precache core app shell
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up old caches & claim clients
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activated.');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Network-first with cache fallback (Crucial for PWA installation eligibility)
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignore non-GET requests and WebSocket / Socket.io / API requests from caching
  if (
    request.method !== 'GET' || 
    request.url.includes('/socket.io/') || 
    request.url.includes('/api/')
  ) {
    return;
  }

  // Network-first strategy for navigation and assets with offline fallback
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Cache valid successful responses for static assets
        if (
          networkResponse && 
          networkResponse.status === 200 && 
          networkResponse.type === 'basic' &&
          (request.url.match(/\.(js|css|svg|png|jpg|jpeg|webp|woff2)$/) || request.mode === 'navigate')
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // Offline fallback
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        if (request.mode === 'navigate') {
          return caches.match('/');
        }
      })
  );
});

// Push Notification Event: Fullscreen Calls & Messages
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  let data = {
    title: 'HDTalk Notification',
    body: 'You have a new alert on HDTalk',
    icon: '/icon.svg',
    badge: '/icon.svg',
    vibrate: [300, 100, 300],
    data: { url: '/' }
  };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    try {
      data.body = event.data.text();
    } catch (_) {}
  }

  const isCall = data.data?.type === 'incoming_call';

  const options = {
    body: data.body,
    icon: data.icon || '/icon.svg',
    badge: data.badge || '/icon.svg',
    vibrate: data.vibrate || (isCall ? [600, 250, 600, 250, 1000] : [300, 100, 300]),
    tag: data.tag || 'hdtalk-notification',
    renotify: true,
    requireInteraction: isCall,
    data: data.data || { url: '/' },
    actions: isCall ? [
      { action: 'open_app', title: '📞 Answer Call' },
      { action: 'dismiss', title: 'Decline' }
    ] : [
      { action: 'open_app', title: '💬 Open Chat' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click Event: Focus or open app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus if already open in a standalone window or tab
      for (const client of clientList) {
        if ('focus' in client && client.url.includes(self.location.origin)) {
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
