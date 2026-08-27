// =============================================================================
// GET /api/reviews/order-context?orderId=<cuid>
// =============================================================================
// Lightweight context for the customer review form (/review/[orderId]).
// Returns just enough to render the form's states — no PII, no auth required.
// The order cuid in the customer's link acts as the capability token.
//
// Response:
//   { found: false }                                — link is invalid
//   { found: true, orderNumber, status,
//     alreadyReviewed, canReview, customerName? }   — order context
//
// customerName is ONLY included when the caller is logged in as the order's
// owner (used to pre-fill the display name field).
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Rate limit: 60 lookups per IP per 5 minutes — stops careless enumeration.
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rl = await rateLimit(`review-context:${ip}`, {
    max: 60,
    windowMs: 5 * 60 * 1000,
  })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  const orderId = req.nextUrl.searchParams.get('orderId')?.trim() || ''

  // Only full cuids are accepted — orderNumbers (KZ-1024) are guessable.
  if (!orderId || orderId.length < 10) {
    return NextResponse.json({ found: false })
  }

  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        userId: true,
      },
    })

    if (!order) {
      return NextResponse.json({ found: false })
    }

    const existing = await db.review.findUnique({
      where: { orderId: order.id },
      select: { id: true },
    })

    // Pre-fill the display name only for the signed-in order owner.
    let customerName: string | undefined
    const session = await getSession()
    if (session?.user && (session.user as any).id === order.userId) {
      const owner = await db.user.findUnique({
        where: { id: order.userId },
        select: { name: true },
      })
      customerName = owner?.name || undefined
    }

    return NextResponse.json({
      found: true,
      orderNumber: order.orderNumber,
      status: order.status,
      alreadyReviewed: !!existing,
      canReview: order.status === 'DELIVERED' && !existing,
      customerName,
    })
  } catch (err) {
    console.error('GET /api/reviews/order-context failed:', err)
    return NextResponse.json(
      { error: 'Failed to load order context' },
      { status: 500 }
    )
  }
}
