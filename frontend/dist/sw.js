const CACHE_NAME = 'linguaai-v2'
const STATIC_ASSETS = ['/', '/index.html']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/api/')) return
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  )
})

// Handle notification click — focus the app tab
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if found
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          return client.focus()
        }
      }
      // Open new window if no tab found
      if (clients.openWindow) {
        return clients.openWindow('/')
      }
    })
  )
})

// Handle push notifications (for future server-push support)
self.addEventListener('push', (e) => {
  const data = e.data ? e.data.json() : {}
  const title = data.title || '🤖 Hey Chanakya!'
  const options = {
    body: data.body || 'Chanakya needs your attention',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'chanakya-push',
    requireInteraction: true,
    actions: [
      { action: 'open', title: 'Open LinguaAI' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  }
  e.waitUntil(self.registration.showNotification(title, options))
})
