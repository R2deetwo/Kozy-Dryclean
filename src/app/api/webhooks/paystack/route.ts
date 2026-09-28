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
import { notifyPaymentVerified, notifyMembershipActive } from '@/lib/notifications'
import { activateOrRenewSubscription } from '@/lib/subscriptions'
import { dispatchNewOrder } from '@/lib/rider-dispatch'

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
    // ----- Phase 62: membership charges route separately -----
    // Initial charge: reference "SUB-{subscriptionId}". Renewals: the
    // event carries a subscription object (subscription_code) and a
    // Paystack-generated reference — matched by the stored code.
    const isMembership =
      typeof paystackRefOf(data) === 'string' && String(paystackRefOf(data)).startsWith('SUB-')
    if (isMembership || data?.subscription) {
      return handleMembershipChargeSuccess(data)
    }
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
  // notifyPaymentVerified never throws and needs the order + owner; wrap the
  // lookups once here so both branches below can use it.
  const notify = async (orderId: string) => {
    try {
      const o = await db.order.findUnique({
        where: { id: orderId },
        include: { user: { select: { id: true, name: true, email: true, phone: true } } },
      })
      if (o) await notifyPaymentVerified(o)
    } catch (e) {
      console.error('notifyPaymentVerified failed:', e)
    }
  }

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

    // Phase 69: the money just cleared — dispatch the pickup to a rider
    // (auto-assign a full-timer, or ping the claim pool). Fire-and-forget.
    const paidOrder = await db.order.findUnique({
      where: { id: existing.orderId },
      select: { id: true, orderNumber: true, branchId: true, pickupAddress: true, pickupDate: true, pickupTimeSlot: true, status: true, userId: true, driverId: true },
    })
    if (paidOrder && !paidOrder.driverId) {
      dispatchNewOrder(paidOrder).catch(() => {})
    }

    await notify(existing.orderId)

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

  // Phase 69: money cleared → dispatch (auto-assign / claim pool).
  dispatchNewOrder({
    id: order.id,
    orderNumber: order.orderNumber,
    branchId: order.branchId,
    pickupAddress: order.pickupAddress,
    pickupDate: order.pickupDate,
    pickupTimeSlot: order.pickupTimeSlot,
    status: 'PAYMENT_VERIFIED',
    userId: order.userId,
  }).catch(() => {})

  // Log as a status event
  await db.statusEvent.create({
    data: {
      orderId: order.id,
      status: 'PAYMENT_VERIFIED',
      note: `Auto-verified via Paystack webhook (ref: ${paystackRef})`,
    },
  })

  await notify(order.id)

  console.log(`Paystack webhook: verified payment for order ${order.orderNumber}`)

  return NextResponse.json({ ok: true, message: 'Payment verified and order advanced' })
}

// Small helper: read the reference off a Paystack event payload.
function paystackRefOf(data: any): string | undefined {
  return data?.reference ?? undefined
}

// ----- Handle charge.success for MEMBERSHIPS (phase 62) -----
// Two shapes arrive here:
//   1. Initial charge — reference "SUB-{subscriptionId}" (we set it at
//      initialize). Find the subscription, activate the cycle, store the
//      recurring-subscription codes Paystack hands back.
//   2. Renewal charge — Paystack-generated reference + data.subscription
//      (subscription_code / email_token). Match by the stored code and
//      extend the member's period by one cycle.
// Both paths are idempotent: an ACTIVE membership whose periodEnd already
// covers "now + 29 days" is treated as processed.
async function handleMembershipChargeSuccess(data: any) {
  const ref = paystackRefOf(data)
  const amountInKobo = data?.amount
  const amount = amountInKobo ? amountInKobo / 100 : 0

  const subCode = data?.subscription?.subscription_code ?? data?.subscription?.subscriptionCode
  const emailToken = data?.subscription?.email_token ?? data?.subscription?.emailToken

  // Resolve the subscription: by reference first (initial charge), then by
  // subscription code (renewals).
  let sub: any = null
  if (ref && String(ref).startsWith('SUB-')) {
    sub = await db.subscription.findUnique({ where: { paystackRef: String(ref) } })
  }
  if (!sub && subCode) {
    sub = await db.subscription.findFirst({ where: { paystackSubscriptionCode: subCode } })
  }
  if (!sub) {
    console.error('[memberships] Paystack webhook: no subscription for ref/code:', ref, subCode)
    // 200 so Paystack does not retry forever — nothing we can match.
    return NextResponse.json({ ok: true, message: 'Subscription not found' })
  }

  // Idempotency: a renewal that landed twice, or a race with the initial
  // activation. The period must EXTEND by exactly one cycle from the
  // current end — never re-activate from scratch on an active membership
  // unless the period has actually lapsed.
  const now = Date.now()
  const periodEndMs = sub.periodEnd ? new Date(sub.periodEnd).getTime() : 0
  const activeAndFresh = sub.status === 'ACTIVE' && periodEndMs - now > 29 * 24 * 60 * 60 * 1000
  if (activeAndFresh) {
    // Still record the recurring codes if this is the first time we see them.
    if (subCode && !sub.paystackSubscriptionCode) {
      await db.subscription.update({
        where: { id: sub.id },
        data: { paystackSubscriptionCode: subCode, paystackEmailToken: emailToken ?? null },
      })
    }
    return NextResponse.json({ ok: true, message: 'Already active — renewal ignored' })
  }

  // A lapsed membership being re-charged (retry after PAST_DUE) should
  // restart from now; an expiring-soon renewal extends from period end —
  // activateOrRenewSubscription handles both branches.
  const plan = await db.subscriptionPlan.findUnique({ where: { id: sub.planId } })
  const pricePaid = amount > 0 ? amount : plan?.priceMonthly ?? 0

  const updated = await activateOrRenewSubscription(sub.id, {
    pricePaid,
    method: 'PAYSTACK',
  })

  // Persist the recurring codes — every future charge.success with this
  // subscription_code finds the member.
  if (subCode) {
    await db.subscription.update({
      where: { id: sub.id },
      data: { paystackSubscriptionCode: subCode, paystackEmailToken: emailToken ?? null },
    })
  }

  // Member email — never blocks the webhook response.
  try {
    const user = await db.user.findUnique({ where: { id: sub.userId } })
    if (user && plan) {
      await notifyMembershipActive({
        user: { name: user.name, email: user.email },
        planName: plan.name,
        pricePaid,
        periodEnd: updated.periodEnd,
        unitName: plan.unitName,
        includedUnits: plan.includedUnits,
      })
    }
  } catch (e) {
    console.error('[memberships] activation email failed:', e)
  }

  console.log(`[memberships] Paystack webhook: membership ${sub.id} charged ${pricePaid}`)
  return NextResponse.json({ ok: true, message: 'Membership activated/renewed' })
}
