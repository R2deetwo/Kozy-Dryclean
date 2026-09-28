// =============================================================================
// POST /api/paystack/subscription-initialize — charge a membership cycle
// =============================================================================
// Authed members only (memberships require an account by design).
// Flow:
//   1. Client POST /api/subscriptions { planCode, paymentMethod: 'PAYSTACK' }
//      → PENDING_ACTIVATION row with paystackRef "SUB-{id}"
//   2. Client calls THIS endpoint { subscriptionId }
//   3. We call Paystack transaction/initialize — attaching the plan's
//      paystackPlanCode when one exists, so Paystack itself re-charges the
//      card monthly (recurring) and fires charge.success webhooks we extend.
//   4. Webhook (/api/webhooks/paystack) matches "SUB-{id}" → activates.
//   5. Callback lands on /payment/callback?ref=SUB-… which reads the
//      membership-aware verify response.
//
// Graceful degradation mirrors the order flow: no key → 503 with a clear
// message (the UI falls back to bank transfer).
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { rateLimit, getClientIP } from '@/lib/rate-limit'

function baseUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://kozycare.ng'
  )
}

export async function POST(req: Request) {
  // Rate limit: 10 attempts per IP per 10 minutes (same budget family as
  // the order initialize route).
  const ip = getClientIP(req)
  const limit = await rateLimit('paystack-sub-init:' + ip, {
    max: 10,
    windowMs: 10 * 60 * 1000,
  })
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Too many payment attempts. Please try again shortly.' },
      { status: 429 }
    )
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json(
      {
        error: 'PAYSTACK_NOT_CONFIGURED',
        message: 'Online payments are not configured yet — please pay by bank transfer and your membership activates the moment we verify it.',
      },
      { status: 503 }
    )
  }

  // ----- Authed only (memberships live in accounts) -----
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })
  }
  const userId = (session.user as any).id as string

  const body = await req.json().catch(() => ({}))
  const subscriptionId = typeof body?.subscriptionId === 'string' ? body.subscriptionId : ''
  if (!subscriptionId) {
    return NextResponse.json({ error: 'subscriptionId is required' }, { status: 400 })
  }

  const sub = await db.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  })
  if (!sub || !sub.plan) {
    return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
  }
  if (sub.userId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (sub.status === 'ACTIVE') {
    return NextResponse.json({ alreadyActive: true })
  }

  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  const reference = sub.paystackRef ?? `SUB-${sub.id}`
  const amountKobo = Math.round(sub.plan.priceMonthly * 100)

  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: user.email,
      amount: amountKobo,
      reference,
      currency: 'NGN',
      // The plan code makes this RECURRING: after the first successful
      // charge Paystack creates the subscription and re-bills monthly.
      ...(sub.plan.paystackPlanCode ? { plan: sub.plan.paystackPlanCode } : {}),
      callback_url: `${baseUrl()}/payment/callback?ref=${encodeURIComponent(reference)}`,
      metadata: {
        subscriptionId: sub.id,
        planCode: sub.plan.code,
        planName: sub.plan.name,
        customerName: user.name,
        kind: 'membership',
      },
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.data?.authorization_url) {
    console.error('Paystack subscription initialize failed:', res.status, JSON.stringify(data))
    return NextResponse.json(
      {
        error: 'Could not start the payment. Please try again or pay by bank transfer.',
      },
      { status: 502 }
    )
  }

  // Record the method choice (the row stays PENDING_ACTIVATION until the
  // webhook lands).
  await db.subscription.update({
    where: { id: sub.id },
    data: { paymentMethod: 'PAYSTACK', paystackRef: reference },
  })

  return NextResponse.json({
    authorizationUrl: data.data.authorization_url,
    reference,
    amount: sub.plan.priceMonthly,
    recurring: Boolean(sub.plan.paystackPlanCode),
  })
}
