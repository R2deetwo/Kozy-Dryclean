'use client'

// Registers the rider service worker (public/sw.js) — the piece that makes
// stop notifications reach the rider's phone even when the browser is
// closed, and keeps a cached copy of the app shell for offline moments.
// Registered once when the rider app mounts; silent and invisible by design.

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
        // Never break the app over a notification layer.
        console.warn('[sw] registration skipped:', err?.message)
      })
    }
    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register, { once: true })
      return () => window.removeEventListener('load', register)
    }
  }, [])
  return null
}
