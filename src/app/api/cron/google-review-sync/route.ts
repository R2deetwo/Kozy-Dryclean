// =============================================================================
// GET /api/cron/google-review-sync — the weekly pull of Google reviews
// =============================================================================
// vercel.json schedules this weekly (Monday 09:30 UTC = 10:30 WAT). Same
// CRON_SECRET bearer auth as the other crons. Self-degrading: without
// GOOGLE_MAPS_API_KEY it reports NOT_CONFIGURED and does nothing — the
// office's manual entries and the wall keep working either way.
// =============================================================================

import { NextResponse } from 'next/server'
import { syncGoogleReviews } from '@/lib/google-reviews'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  return token === secret
}

async function handle() {
  if (!process.env.GOOGLE_MAPS_API_KEY?.trim()) {
    // Not an error worth paging anyone for — a 200 with the honest state.
    return NextResponse.json({ ok: false, status: 'NOT_CONFIGURED', message: 'GOOGLE_MAPS_API_KEY not set — nothing to sync yet.' })
  }
  const result = await syncGoogleReviews()
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return handle()
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return handle()
}
