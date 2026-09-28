// =============================================================================
// GET /api/cron/purge-media — daily condition-photo retention sweep
// =============================================================================
// Configured in vercel.json (daily, 02:30 UTC = 03:30 Lagos). Runs the same
// purgeExpiredMedia() the hot admin paths trigger lazily (throttled) — the
// cron forces a full sweep so photos expire on schedule even on quiet days.
//
// Authorization (same class as the marketing cron):
//   Authorization: Bearer $CRON_SECRET   — primary, matches vercel.json
//   x-vercel-cron: 1                     — genuine Vercel cron invocation
// Everything else gets 401. The endpoint only deletes ALREADY-EXPIRED photos
// (delivered >24h ago / cancelled >24h / staged >24h) — a forced call can
// never touch live evidence inside the guarantee window.

import { NextRequest, NextResponse } from 'next/server'
import { purgeExpiredMedia } from '@/lib/media'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  const isVercelCron = req.headers.get('x-vercel-cron') === '1'

  const authorized =
    (secret ? auth === `Bearer ${secret}` : false) || isVercelCron

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await purgeExpiredMedia({ force: true })
  return NextResponse.json({
    purgedMedia: result.purgedMedia,
    purgedStaged: result.purgedStaged,
  })
}
