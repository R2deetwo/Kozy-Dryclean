// =============================================================================
// GET /api/orders/lookup — PUBLIC payment-status lookup by email
// =============================================================================
// Powers /payment/pending (the post-transfer "we're verifying your payment"
// screen). The customer lands there straight after confirming a bank-transfer
// order and the page polls this endpoint so the status flips to confirmed the
// moment admin verifies — no refresh, no guessing, no re-submitting.
//
// Auth model: the caller must supply BOTH the order number AND the email on
// the order — knowledge of the pair acts as the capability. Only payment-
// relevant fields are returned (no addresses, no names, no contact details),
// so the endpoint is safe to expose publicly.
//
// Rate limit: 120 lookups / 15 min per IP — generous enough for the pending
// page's 10-second poll for the full verification window, tight enough to
// stop enumeration of order numbers.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit, getClientIP } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function GET(req: NextRequest) {
  const ip = getClientIP(req)
  const limit = await rateLimit(`order-lookup:${ip}`, { max: 120, windowMs: 15 * 60 * 1000 })
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Too many status checks. Please try again in a few minutes.' },
      { status: 429 }
    )
  }

  const { searchParams } = new URL(req.url)
  const orderNumber = (searchParams.get('orderNumber') || '').trim().toUpperCase()
  const email = (searchParams.get('email') || '').trim().toLowerCase()

  if (!orderNumber || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: 'Provide both the order number and the email used at booking.' },
      { status: 400 }
    )
  }

  const order = await db.order.findUnique({
    where: { orderNumber },
    select: {
      orderNumber: true,
      status: true,
      type: true,
      totalPrice: true,
      pickupDate: true,
      pickupTimeSlot: true,
      createdAt: true,
      user: { select: { email: true } },
      payments: {
        select: { method: true, status: true, amount: true, verifiedAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  // Same visible behaviour for "no such order" and "wrong email" — never
  // confirm to a stranger which order numbers exist.
  if (!order || order.user.email.toLowerCase() !== email) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const payment = order.payments.find((p) => p.status === 'PENDING') ?? order.payments[0] ?? null

  return NextResponse.json({
    orderNumber: order.orderNumber,
    status: order.status,
    type: order.type,
    total: order.totalPrice,
    pickupDate: order.pickupDate,
    pickupTimeSlot: order.pickupTimeSlot,
    createdAt: order.createdAt,
    payment: payment
      ? {
          method: payment.method,
          status: payment.status,
          amount: payment.amount,
          verifiedAt: payment.verifiedAt,
        }
      : null,
  })
}
