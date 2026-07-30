self.addEventListener('push', (event) => {
  let data = { title: 'Markbel Notification', body: 'You have updates in your bookmark vault!', url: '/' }
  try {
    if (event.data) {
      data = event.data.json()
    }
  } catch (err) {
    console.warn('[SW Push] Failed to parse push JSON:', err)
  }

  const options = {
    body: data.body || 'New bookmark update',
    icon: '/logo.png',
    badge: '/logo.png',
    data: {
      url: data.url || '/'
    },
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open', title: 'Open Markbel' }
    ]
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Markbel 🔖', options)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})
