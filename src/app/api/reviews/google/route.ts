// =============================================================================
// /api/reviews/google — the office's Google-review management surface
// =============================================================================
//   GET    — every Google review row (the moderation list) + the listing's
//             synced aggregate + the selection mode + sync setup state.
//   POST   — add a review MANUALLY (typed in from the public Google listing;
//             the office's own data entry, labelled MANUAL in the UI).
//   PATCH  — body { id, approved?, hidden? }: the selection toggles.
//             approved only matters in MANUAL mode; hidden works in both.
//   POST /api/reviews/google-sync (separate route) pulls from the Places API.
//
// ADMIN/STAFF gated. The PUBLIC wall reads GET /api/reviews (the merged
// feed), never this route.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { allGoogleReviews, googleReviewStats } from '@/lib/google-reviews'
import { getAppSettings } from '@/lib/app-settings'

export const dynamic = 'force-dynamic'

async function requireStaff() {
  const session = await getSession()
  const role = (session?.user as any)?.role
  if (!session || (role !== 'ADMIN' && role !== 'STAFF')) return null
  return session
}

export async function GET() {
  const session = await requireStaff()
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const [reviews, stats, settings] = await Promise.all([
    allGoogleReviews(),
    googleReviewStats(),
    getAppSettings(),
  ])
  return NextResponse.json({
    reviews,
    stats,
    autoSelect: settings.googleReviewAutoSelect,
    syncConfigured: Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim()),
  })
}

export async function POST(req: NextRequest) {
  const session = await requireStaff()
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const authorName = typeof body?.authorName === 'string' ? body.authorName.trim() : ''
  const rating = Math.round(Number(body?.rating))
  const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 2000) : ''
  const relativeTime = typeof body?.relativeTime === 'string' ? body.relativeTime.trim().slice(0, 60) : ''

  if (authorName.length < 2 || authorName.length > 120) {
    return NextResponse.json({ error: 'Author name is required (as shown on Google).' }, { status: 400 })
  }
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be 1–5 stars (as shown on Google).' }, { status: 400 })
  }
  if (!text) {
    return NextResponse.json({ error: 'Paste the review text from the Google listing.' }, { status: 400 })
  }

  // MANUAL rows are approved by construction (the office chose to enter
  // them); they can still be hidden any time.
  const row = await db.googleReview.create({
    data: {
      googleKey: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      authorName,
      rating,
      text,
      relativeTime: relativeTime || null,
      source: 'MANUAL',
      approved: true,
    },
  })
  return NextResponse.json({ review: row }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await requireStaff()
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const id = typeof body?.id === 'string' ? body.id : ''
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }
  const patch: Record<string, boolean> = {}
  if (typeof body?.approved === 'boolean') patch.approved = body.approved
  if (typeof body?.hidden === 'boolean') patch.hidden = body.hidden
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update (approved / hidden).' }, { status: 400 })
  }
  try {
    const row = await db.googleReview.update({ where: { id }, data: patch })
    return NextResponse.json({ review: row })
  } catch {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  }
}
