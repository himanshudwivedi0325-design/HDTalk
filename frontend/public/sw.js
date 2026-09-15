// HDTalk Service Worker for Background Web Push Notifications & Offline Caching
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activated');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  let data = {
    title: 'HDTalk Notification',
    body: 'You have a new alert on HDTalk',
    icon: '/hdtalk-logo.jpg',
    badge: '/hdtalk-logo.jpg',
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
    icon: data.icon || '/hdtalk-logo.jpg',
    badge: data.badge || '/hdtalk-logo.jpg',
    vibrate: data.vibrate || (isCall ? [600, 250, 600, 250, 1000] : [300, 100, 300]),
    tag: data.tag || 'hdtalk-notification',
    renotify: true,
    requireInteraction: isCall,
    data: data.data || { url: '/' },
    actions: isCall ? [
      { action: 'open_app', title: '📞 Answer' },
      { action: 'dismiss', title: 'Dismiss' }
    ] : [
      { action: 'open_app', title: '💬 Open' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus if already open
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.url.includes(self.location.origin)) {
            return client.focus();
          }
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
