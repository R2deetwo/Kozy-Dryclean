// =============================================================================
// POST /api/reviews/google-sync — pull the listing's reviews from Google
// =============================================================================
// ADMIN/STAFF button + the weekly cron (see /api/cron/google-review-sync).
// Calls the Places API (needs GOOGLE_MAPS_API_KEY) and upserts every review.
// Without the key the result is an honest NOT_CONFIGURED with the setup
// steps — the wall keeps whatever it already has, and manual entry still
// works.
// =============================================================================

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { syncGoogleReviews } from '@/lib/google-reviews'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST() {
  const session = await getSession()
  const role = (session?.user as any)?.role
  if (!session || (role !== 'ADMIN' && role !== 'STAFF')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const result = await syncGoogleReviews()
  return NextResponse.json(result, { status: result.ok ? 200 : result.status === 'NOT_CONFIGURED' ? 409 : 502 })
}
