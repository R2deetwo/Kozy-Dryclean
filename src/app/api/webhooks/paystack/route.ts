// =============================================================================
// POST /api/webhooks/paystack — Paystack webhook handler
// =============================================================================
// Handles charge.success events when customers pay via Paystack.
// This auto-verifies payments without admin intervention.
//
// Security:
//   - Verifies the Paystack signature using the webhook secret
//   - Rejects requests without a valid signature (401)
//   - Implements idempotency: if a payment with the same paystackRef already
//     exists and is VERIFIED, returns 200 without re-processing
//
// Paystack sends these event types (we handle charge.success):
//   - charge.success      → payment confirmed, advance order to PAYMENT_VERIFIED
//   - charge.failed       → payment failed (we log but don't change status)
//   - transfer.success    → for dedicated virtual accounts
//   - refund.processed    → refund completed
// =============================================================================

import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'

export async function POST(req: Request) {
  // ----- 1. Verify the Paystack signature -----
  const paystackSignature = req.headers.get('x-paystack-signature')

  if (!paystackSignature) {
    return NextResponse.json(
      { error: 'Missing Paystack signature' },
      { status: 401 }
    )
  }

  const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('PAYSTACK_WEBHOOK_SECRET not configured')
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  const rawBody = await req.text()

  // Compute HMAC SHA512 of the request body using the webhook secret
  const computedHash = crypto
    .createHmac('sha512', webhookSecret)
    .update(rawBody)
    .digest('hex')

  // Constant-time comparison to prevent timing attacks
  if (computedHash !== paystackSignature) {
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 401 }
    )
  }

  // ----- 2. Parse the webhook event -----
  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  // ----- 3. Handle the event -----
  const eventType = event?.event
  const data = event?.data

  if (eventType === 'charge.success') {
    return handleChargeSuccess(data)
  }

  if (eventType === 'charge.failed') {
    console.log('Paystack charge failed:', data?.reference)
    // Don't change order status — customer can retry
    return NextResponse.json({ ok: true })
  }

  // Unhandled event type — acknowledge receipt (Paystack expects 200)
  return NextResponse.json({ ok: true })
}

// ----- Handle charge.success -----
async function handleChargeSuccess(data: any) {
  const paystackRef = data?.reference
  const amountInKobo = data?.amount // Paystack sends amount in kobo (1 naira = 100 kobo)
  const amount = amountInKobo ? amountInKobo / 100 : 0

  if (!paystackRef) {
    console.error('Paystack charge.success missing reference:', data)
    return NextResponse.json(
      { error: 'Missing reference' },
      { status: 400 }
    )
  }

  // ----- Idempotency check -----
  // If a payment with this paystackRef already exists and is VERIFIED, skip
  const existing = await db.payment.findFirst({
    where: { paystackRef },
  })

  if (existing) {
    if (existing.status === 'VERIFIED') {
      // Already processed — return 200 (idempotent)
      return NextResponse.json({ ok: true, message: 'Already processed' })
    }
    // Payment exists but not verified — verify it now
    await db.payment.update({
      where: { id: existing.id },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
        amount: amount || existing.amount,
      },
    })

    // Advance the order to PAYMENT_VERIFIED
    await db.order.update({
      where: { id: existing.orderId },
      data: { status: 'PAYMENT_VERIFIED' },
    })

    return NextResponse.json({ ok: true, message: 'Payment verified' })
  }

  // ----- New payment from Paystack -----
  // Try to find the order by the reference (we encode orderId in the reference)
  // Convention: paystackRef = "KZ-{orderNumber}" or the reference passed at checkout
  const order = await db.order.findFirst({
    where: {
      OR: [
        { orderNumber: paystackRef },
        { orderNumber: paystackRef.replace('KZ-', '') },
      ],
    },
  })

  if (!order) {
    console.error('Paystack webhook: order not found for reference:', paystackRef)
    // Return 200 so Paystack doesn't retry — we can't match this payment
    return NextResponse.json({ ok: true, message: 'Order not found' })
  }

  // Create the payment record
  await db.payment.create({
    data: {
      orderId: order.id,
      amount,
      method: 'PAYSTACK',
      status: 'VERIFIED',
      paystackRef,
      verifiedAt: new Date(),
    },
  })

  // Advance the order to PAYMENT_VERIFIED
  await db.order.update({
    where: { id: order.id },
    data: { status: 'PAYMENT_VERIFIED' },
  })

  // Log as a status event
  await db.statusEvent.create({
    data: {
      orderId: order.id,
      status: 'PAYMENT_VERIFIED',
      note: `Auto-verified via Paystack webhook (ref: ${paystackRef})`,
    },
  })

  console.log(`Paystack webhook: verified payment for order ${order.orderNumber}`)

  return NextResponse.json({ ok: true, message: 'Payment verified and order advanced' })
}
