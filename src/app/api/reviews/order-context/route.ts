// =============================================================================
// GET /api/reviews/order-context?orderId=<cuid>
// GET /api/reviews/order-context?orderNumber=KZ-…&contact=<email or phone>
// =============================================================================
// Lightweight context for the customer review forms:
//   • /review/[orderId] uses the cuid path — the order id in the customer's
//     private link acts as an unguessable capability token.
//   • /feedback (Phase 17) uses the orderNumber path — the client directive
//     lets non-registered customers review, but ONLY with an order number,
//     and the contact (email or phone used at booking) must match the order's
//     customer record so nobody can review somebody else's order.
//
// Response (both paths):
//   { found: false }                                — invalid reference or
//                                                    contact mismatch
//   { found: true, orderNumber, status,
//     alreadyReviewed, canReview, customerName? }   — order context
//
// customerName is ONLY included when the caller is logged in as the order's
// owner (used to pre-fill the display name field). No cuids are ever
// returned — the public page posts with orderNumber + contact directly.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/** Phones match on the last 9 digits (0803…, +234803…, 234803… all equal);
 *  emails compare case-insensitively. */
function contactMatches(
  submitted: string,
  owner: { email: string | null; phone: string | null }
): boolean {
  const s = submitted.trim().toLowerCase()
  if (s.includes('@')) {
    return !!owner.email && owner.email.toLowerCase() === s
  }
  const digits = (v: string | null | undefined) => (v || '').replace(/[^0-9]/g, '')
  const sDigits = digits(submitted)
  if (sDigits.length < 7 || !owner.phone) return false
  const ownerDigits = digits(owner.phone)
  return (
    ownerDigits.endsWith(sDigits.slice(-9)) || sDigits.endsWith(ownerDigits.slice(-9))
  )
}

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

  const orderNumberRaw = req.nextUrl.searchParams.get('orderNumber')?.trim() || ''
  const contact = req.nextUrl.searchParams.get('contact')?.trim() || ''
  const orderId = req.nextUrl.searchParams.get('orderId')?.trim() || ''

  try {
    let order:
      | { id: string; orderNumber: string; status: string; userId: string }
      | null = null

    if (orderNumberRaw) {
      // ----- Public /feedback path: order number + contact verification -----
      if (!/^KZ-?\d{6,10}$/i.test(orderNumberRaw)) {
        return NextResponse.json({ found: false, error: 'invalid_number' })
      }
      const normalized = orderNumberRaw.toUpperCase().replace(/^KZ-?/, 'KZ-')
      order = await db.order.findUnique({
        where: { orderNumber: normalized },
        select: { id: true, orderNumber: true, status: true, userId: true },
      })
      if (!order) return NextResponse.json({ found: false })

      // Ownership: signed-in owner OR matching booking contact.
      const session = await getSession()
      const isOwner = !!session?.user && (session.user as any).id === order.userId
      if (!isOwner) {
        if (!contact) {
          return NextResponse.json({ found: false, error: 'contact_required' })
        }
        const owner = await db.user.findUnique({
          where: { id: order.userId },
          select: { email: true, phone: true },
        })
        if (!owner || !contactMatches(contact, owner)) {
          // Same response as not-found — no oracle for guessing contacts.
          return NextResponse.json({ found: false, error: 'contact_required' })
        }
      }
    } else {
      // ----- Private link path: full cuid only (orderNumbers are guessable) -----
      if (!orderId || orderId.length < 10) {
        return NextResponse.json({ found: false })
      }
      order = await db.order.findUnique({
        where: { id: orderId },
        select: { id: true, orderNumber: true, status: true, userId: true },
      })
    }

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
