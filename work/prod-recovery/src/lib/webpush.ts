// =============================================================================
// Web Push (phase 61) — the rider's phone as the dashboard
// =============================================================================
// Answers the owner's core question: "do they have to be on the website to
// see that a ride has come in?" — with this, NO. Riders who turn on
// notifications in the rider app (Account → Notifications) get a real push
// through the browser's push service when the team assigns a stop. On
// Android/Chrome the notification arrives even with the browser closed once
// the app is installed to the home screen (or even as an open tab); on iOS
// the app must be added to the home screen first (Apple's rule, iOS 16.4+).
//
// Standard Web Push (RFC 8291/8292) with VAPID:
//   - VAPID_PUBLIC_KEY  — sent to browsers, safe to expose
//   - VAPID_PRIVATE_KEY — server-only, signs the pushes
// Both live in the environment. The push itself is free — no per-message
// costs, no vendor lock-in; the browser vendor's push service (FCM on
// Android, Apple's service on iOS) does the delivery.
// =============================================================================

import webpush from 'web-push'
import { db } from '@/lib/db'

let configured = false
let available = false

function ensureConfigured() {
  if (configured) return available
  configured = true
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) {
    console.log('[notify] Web Push not configured — rider stop pushes disabled (set VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY)')
    available = false
    return false
  }
  webpush.setVapidDetails('mailto:concierge@kozycare.ng', pub, priv)
  available = true
  return true
}

export interface PushMessage {
  title: string
  body: string
  /** Deep link opened when the rider taps the notification */
  url?: string
  tag?: string
}

/** Send one push to every subscription of one rider. Dead endpoints (410) are
 *  pruned so the table stays clean. Never throws — a push failure must never
 *  break the assignment it announces. */
export async function pushToUser(userId: string, message: PushMessage): Promise<number> {
  if (!ensureConfigured()) return 0
  try {
    const subs = await db.pushSubscription.findMany({ where: { userId } })
    if (subs.length === 0) return 0
    const payload = JSON.stringify(message)
    let delivered = 0
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(JSON.parse(s.payload) as webpush.PushSubscription, payload, {
            urgency: 'high',
            TTL: 60 * 60, // stop assignments stay meaningful for an hour
          })
          delivered++
        } catch (err: any) {
          // 404/410 = the subscription expired or was revoked — delete it.
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await db.pushSubscription
              .delete({ where: { endpoint: s.endpoint } })
              .catch(() => {})
          } else {
            console.error('[notify] push error:', err?.statusCode ?? err?.message)
          }
        }
      })
    )
    return delivered
  } catch (e) {
    console.error('[notify] pushToUser failed:', e)
    return 0
  }
}
