// =============================================================================
// GET /api/reviews — public testimonials for the landing page carousel
// POST /api/reviews — submit a customer review for a delivered order
// =============================================================================
// Public (no auth):
//   GET  returns approved + non-hidden + rating >= 4.5 reviews (newest first),
//        mapped to the public Testimonial shape. Starter marketing
//        testimonials fill the carousel up to MIN_TESTIMONIALS so the landing
//        page never looks empty while real reviews accumulate.
//   POST accepts a review for a DELIVERED order. The orderId (cuid) in the
//        customer's review link acts as the capability token — no login
//        required (review links arrive by SMS/email). Rate-limited by IP.
//
// Auto-approval rule (same as before):
//   rating >= 4.5  → isApproved = true (shows publicly immediately)
//   rating <  4.5  → isApproved = false (sent privately to admin moderation)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'
import { CreateReviewSchema } from '@/lib/schemas'
import { Testimonial } from '@/lib/types'
import {
  STARTER_TESTIMONIALS,
  MIN_TESTIMONIALS,
  MAX_TESTIMONIALS,
} from '@/lib/starter-testimonials'

// This route reads the DB on every request — never statically cached.
export const dynamic = 'force-dynamic'

// ----- GET /api/reviews (public testimonials) -----
export async function GET() {
  try {
    const reviews = await db.review.findMany({
      where: { isApproved: true, isHidden: false, rating: { gte: 4.5 } },
      orderBy: { createdAt: 'desc' },
      take: MAX_TESTIMONIALS,
      include: { user: { select: { name: true } } },
    })

    const real: Testimonial[] = reviews.map((r) => ({
      id: r.id,
      displayName: r.displayName || r.user?.name || 'Verified Customer',
      displayLocation: r.displayLocation || undefined,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
    }))

    // Fill with starter marketing testimonials only up to the minimum.
    const fill = Math.max(0, MIN_TESTIMONIALS - real.length)
    const testimonials = [...real, ...STARTER_TESTIMONIALS.slice(0, fill)].slice(
      0,
      MAX_TESTIMONIALS
    )

    return NextResponse.json({ testimonials })
  } catch (err) {
    console.error('GET /api/reviews failed:', err)
    return NextResponse.json(
      { error: 'Failed to load testimonials' },
      { status: 500 }
    )
  }
}

// ----- POST /api/reviews (submit a review) -----
export async function POST(req: NextRequest) {
  // Rate limit: 5 submissions per IP per hour — plenty for real customers,
  // blocks scripted spam.
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rl = await rateLimit(`review-post:${ip}`, { max: 5, windowMs: 60 * 60 * 1000 })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many submissions. Please try again later.' },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = CreateReviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid review' },
      { status: 400 }
    )
  }

  const { orderId, rating, comment, displayName, displayLocation } = parsed.data

  // Snap rating to the nearest half star (4.2 → 4.0, 4.3 → 4.5)
  const snappedRating = Math.round(rating * 2) / 2
  if (snappedRating < 1 || snappedRating > 5) {
    return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
  }

  try {
    // Look up by the full cuid only (orderNumbers are guessable — never
    // accept them here, otherwise anyone could review someone else's order).
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        driverId: true,
        status: true,
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    if (order.status !== 'DELIVERED') {
      return NextResponse.json(
        { error: 'You can only review delivered orders' },
        { status: 400 }
      )
    }

    const existing = await db.review.findUnique({ where: { orderId: order.id } })
    if (existing) {
      return NextResponse.json(
        { error: 'This order has already been reviewed' },
        { status: 409 }
      )
    }

    // Auto-approve high ratings so happy customers show immediately;
    // lower ratings stay pending for admin review.
    const isApproved = snappedRating >= 4.5
    const now = new Date()

    const review = await db.review.create({
      data: {
        orderId: order.id,
        userId: order.userId, // server-derived — clients can't spoof
        driverId: order.driverId,
        rating: snappedRating,
        comment: comment.trim(),
        displayName: displayName?.trim() || null,
        displayLocation: displayLocation?.trim() || null,
        isApproved,
        approvedAt: isApproved ? now : null,
        approvedById: isApproved ? 'auto' : null,
      },
    })

    return NextResponse.json({ review }, { status: 201 })
  } catch (err) {
    console.error('POST /api/reviews failed:', err)
    return NextResponse.json(
      { error: 'Failed to submit review' },
      { status: 500 }
    )
  }
}
