/* =============================================================================
 * Kozy Care service worker (phase 61) — rider stop notifications
 * =============================================================================
 * Registered only by the rider app (/driver). Does three things:
 *
 *  1. PUSH: the server's assignment push arrives here; we surface it as a
 *     real system notification with the stop's essentials and a deep link.
 *     The rider sees it EVEN WHEN THE BROWSER IS CLOSED (Android/Chrome with
 *     the app installed; that is the whole point — no open tab required).
 *  2. NOTIFICATIONCLICK: tapping opens (or focuses) the rider app on the
 *     route, not a random new tab.
 *  3. OFFLINE FALLBACK: a tiny cache for the app shell so a tunnel moment
 *     on the Third Mainland Bridge doesn't white-screen the rider's day.
 *
 * Deliberately hand-rolled (no Workbox): ~60 readable lines, zero
 * dependencies, nothing to update for the sake of updating.
 * ========================================================================== */

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

/* --- Push: assignment arrives -> system notification ---------------------- */
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: 'Kozy Care', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Kozy Care'
  const options = {
    body: data.body || 'New stop assigned — open the rider app.',
    icon: '/favicon-192.png',
    badge: '/favicon-96.png',
    tag: data.tag || 'kozy-stop',
    renotify: true,
    vibrate: [100, 50, 100],
    data: { url: data.url || '/driver' },
    actions: [{ action: 'open', title: 'Open the stop' }],
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

/* --- Notification tap -> focus or open the rider app ---------------------- */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/driver'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus()
          if ('navigate' in client && client.url !== self.registration.scope + url.replace(/^\//, '')) {
            client.navigate(url).catch(() => {})
          }
          return
        }
      }
      return self.clients.openWindow(url)
    })
  )
})

/* --- Offline shell: keep the last good app frame reachable ---------------- */
const SHELL_CACHE = 'kozy-rider-shell-v1'

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // Only the rider app's documents — never cache the storefront, the
  // console, or API traffic (stale orders are worse than no orders).
  if (!url.pathname.startsWith('/driver')) return
  if (url.pathname.startsWith('/driver') && req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(SHELL_CACHE).then((c) => c.put(req, copy)).catch(() => {})
          return res
        })
        .catch(() =>
          caches.match(req).then(
            (hit) =>
              hit ||
              new Response(
                '<html><body style="background:#0f172a;color:#fff;font-family:system-ui;padding:2rem;text-align:center"><h2>Kozy Rider</h2><p>You are offline — head back into network to refresh your route.</p></body></html>',
                { headers: { 'Content-Type': 'text/html' } }
              )
          )
        )
    )
  }
})
