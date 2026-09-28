// Phase 51 — condition-photo media lifecycle.
//
// RETENTION POLICY (owner's directive):
//   Condition photos exist as evidence for the Return-as-Received Guarantee.
//   The customer has 24 hours after delivery to raise an issue, so the photos
//   have no legal/operational value after that window — they are purged
//   24h after an order is marked DELIVERED (and from CANCELLED orders once
//   the cancellation has settled for 24h, since a dragged-back card resets
//   updatedAt). Unclaimed staged photos (uploaded in the wizard but the
//   booking never completed) expire 24h after upload.
//
// TRIGGERS (belt and braces):
//   1. Lazily from hot admin paths (order list load + status PATCH) via
//      fire-and-forget after() — throttled in-memory so a busy board does
//      not hammer the sweep.
//   2. Daily Vercel cron (vercel.json → /api/cron/purge-media) so photos
//      expire on schedule even on a quiet day.
import { db } from '@/lib/db'

/** How many condition photos one order may carry (wizard cap + API cap). */
export const MAX_CONDITION_PHOTOS = 30

/** Hours after DELIVERED (or cancellation) before photos are purged. */
export const PHOTO_RETENTION_HOURS = 24

/** Hours an unclaimed staged photo survives before the sweep deletes it. */
export const STAGED_PHOTO_RETENTION_HOURS = 24

// In-memory throttle: each serverless instance sweeps at most this often on
// the lazy path (the cron path bypasses it with force=true). On serverless a
// cold instance starts fresh, which is fine — the sweep is one cheap DELETE.
const LAZY_SWEEP_INTERVAL_MS = 10 * 60 * 1000
let lastSweepAt = 0

export interface PurgeResult {
  purgedMedia: number
  purgedStaged: number
  skipped?: boolean
}

/** Delete expired condition photos + stale staged photos. Never throws. */
export async function purgeExpiredMedia(options?: {
  force?: boolean
}): Promise<PurgeResult> {
  const now = Date.now()
  if (!options?.force && now - lastSweepAt < LAZY_SWEEP_INTERVAL_MS) {
    return { purgedMedia: 0, purgedStaged: 0, skipped: true }
  }
  lastSweepAt = now

  try {
    // GarmentMedia rows whose order's guarantee window has closed:
    //   - DELIVERED more than 24h ago (the dispute window), or
    //   - CANCELLED and untouched for 24h (dragging the card back resets
    //     updatedAt, un-cancelling the order keeps its photos alive).
    // Raw SQL because Prisma's deleteMany cannot join across tables.
    const purgedMedia = await db.$executeRaw`
      DELETE FROM "GarmentMedia"
      WHERE "orderId" IN (
        SELECT o.id FROM "Order" o
        WHERE (o.status = 'DELIVERED' AND o."deliveredAt" IS NOT NULL
               AND o."deliveredAt" < now() - interval '24 hours')
           OR (o.status = 'CANCELLED' AND o."updatedAt" < now() - interval '24 hours')
      )`

    // Staged photos that were never claimed by an order (abandoned wizards).
    const purgedStaged = await db.$executeRaw`
      DELETE FROM "StagedPhoto"
      WHERE "createdAt" < now() - interval '24 hours'`

    if (purgedMedia > 0 || purgedStaged > 0) {
      console.log(
        `[media] retention sweep: ${purgedMedia} condition photo(s) and ${purgedStaged} staged photo(s) purged`
      )
    }
    return { purgedMedia, purgedStaged }
  } catch (e) {
    // Never let housekeeping break a customer/admin request.
    console.error('[media] retention sweep failed:', e)
    return { purgedMedia: 0, purgedStaged: 0, skipped: true }
  }
}

/**
 * Fire-and-forget wrapper for request paths: schedules the throttled sweep
 * without awaiting it. Safe to call from any route handler.
 */
export function scheduleMediaPurge(): void {
  void purgeExpiredMedia().catch(() => {})
}
