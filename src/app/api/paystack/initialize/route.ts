// =============================================================================
// POST /api/paystack/initialize — start an online card payment for an order
// =============================================================================
// Flow:
//   1. Client creates the order (POST /api/orders) — guests supported
//   2. Client calls this endpoint with { orderId, email? }
//   3. We create a PENDING Payment record with paystackRef = orderNumber
//   4. We call Paystack's transaction/initialize and return the hosted
//      checkout URL; the client redirects to it
//   5. Paystack redirects back to /payment/callback?ref=...
//   6. The webhook (/api/webhooks/paystack) verifies charge.success and
//      advances the order to PAYMENT_VERIFIED
//
// Security:
//   - Authed users may only initialize payments for their own orders
//   - Guests (no session) must pass the email they booked with — it must
//     match the order owner's email
//   - Idempotent: re-initializing an already-VERIFIED payment returns
//     { alreadyPaid: true } without contacting Paystack
//
// Graceful degradation:
//   - No PAYSTACK_SECRET_KEY configured -> 503 PAYSTACK_NOT_CONFIGURED
//     (the frontend falls back to bank-transfer instructions)
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { rateLimit, getClientIP } from '@/lib/rate-limit'

function baseUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://kozy-dryclean.vercel.app'
  )
}

export async function POST(req: Request) {
  // Rate limit: 10 initialize attempts per IP per 10 minutes
  const ip = getClientIP(req)
  const limit = await rateLimit(`paystack-init:${ip}`, { max: 10, windowMs: 10 * 60 * 1000 })
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many payment attempts. Please try again shortly.' }, { status: 429 })
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json(
      { error: 'PAYSTACK_NOT_CONFIGURED', message: 'Online payments are not configured yet. Please pay by bank transfer.' },
      { status: 503 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const { orderId, email } = body || {}
  if (!orderId || typeof orderId !== 'string') {
    return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      payments: true,
    },
  })
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // ----- Ownership check -----
  const session = await getSession()
  if (session) {
    if (order.userId !== (session.user as any).id && (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else {
    // Guest: the email used at booking must match the order owner
    if (!email || String(email).toLowerCase() !== order.user.email.toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden — email does not match this order' }, { status: 403 })
    }
  }

  // ----- Payable? -----
  if (!order.totalPrice || order.totalPrice <= 0) {
    return NextResponse.json(
      { error: 'This order has no payable total yet (pending weighing). Pay after the invoice is issued.' },
      { status: 400 }
    )
  }

  // Already fully verified?
  const alreadyVerified = order.payments.some((p) => p.status === 'VERIFIED')
  if (alreadyVerified) {
    return NextResponse.json({ alreadyPaid: true })
  }

  const reference = order.orderNumber // matches the webhook's lookup convention

  // ----- Create/refresh the PENDING payment record -----
  // The webhook's idempotency branch expects a payment row keyed by paystackRef.
  const existing = await db.payment.findFirst({ where: { paystackRef: reference } })
  if (!existing) {
    await db.payment.create({
      data: {
        orderId: order.id,
        amount: order.totalPrice,
        method: 'PAYSTACK',
        status: 'PENDING',
        paystackRef: reference,
      },
    })
  }

  // ----- Call Paystack -----
  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: order.user.email,
      amount: Math.round(order.totalPrice * 100), // kobo
      reference,
      currency: 'NGN',
      callback_url: `${baseUrl()}/payment/callback?ref=${encodeURIComponent(reference)}`,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.user.name,
      },
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.data?.authorization_url) {
    console.error('Paystack initialize failed:', res.status, JSON.stringify(data))
    return NextResponse.json(
      { error: 'Could not start the payment. Please try again or pay by bank transfer.' },
      { status: 502 }
    )
  }

  return NextResponse.json({
    authorizationUrl: data.data.authorization_url,
    reference,
    amount: order.totalPrice,
  })
}
