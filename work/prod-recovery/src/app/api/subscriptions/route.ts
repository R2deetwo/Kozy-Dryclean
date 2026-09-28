// =============================================================================
// GET  /api/subscriptions — ADMIN: every membership, newest first
// POST /api/subscriptions — a customer joins the Kozy Circle
// =============================================================================
// POST (authed customers only — B2C/B2B; staff/admin cannot subscribe, same
// policy as orders):
//   body: { planCode, paymentMethod: 'PAYSTACK' | 'BANK_TRANSFER', transferReceipt? }
//   PAYSTACK     → creates PENDING_ACTIVATION row + returns the reference;
//                  the client then calls /api/paystack/subscription-initialize
//                  and the webhook activates on charge.success.
//   BANK_TRANSFER→ creates PENDING_ACTIVATION row with the receipt; the admin
//                  verifies it in Memberships → Subscribers (or the customer
//                  is told the transfer details and uploads a receipt later).
//
// One membership per customer: an existing ACTIVE/PENDING_ACTIVATION/
// PAST_DUE membership blocks a new one (switching = cancel → re-subscribe,
// stated plainly in the error message).
// =============================================================================

import { NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { getPlans, rowToMembership, effectiveStatus, effectiveUsage } from '@/lib/subscriptions'
import { notifyAdminNewSubscription } from '@/lib/notifications'

export async function GET(req: Request) {
  // ----- ADMIN/STAFF gate -----
  let session
  try {
    session = await import('@/lib/auth').then((m) => m.requireRole('ADMIN', 'STAFF'))
  } catch (e: any) {
    if (e instanceof Response) {
      return new NextResponse(e.body, {
        status: e.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rows = await db.subscription.findMany({
    orderBy: { createdAt: 'desc' },
    include: { plan: true },
  })

  const plans = await getPlans(true)
  const planById = new Map(plans.map((p) => [p.id, p]))
  const users = await db.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) } },
    select: { id: true, name: true, email: true, phone: true },
  })
  const userById = new Map(users.map((u) => [u.id, u]))

  const items = rows.map((r) => {
    const plan = r.plan ?? planById.get(r.planId)
    return {
      ...rowToMembership({ ...r, plan }),
      effectiveStatus: effectiveStatus(r),
      usage: plan
        ? effectiveUsage(
            {
              unitsUsed: r.unitsUsed,
              extraUnitsUsed: r.extraUnitsUsed,
              shoesUsed: r.shoesUsed,
              duvetsUsed: r.duvetsUsed,
              curtainsUsed: r.curtainsUsed,
              springCleanUsed: r.springCleanUsed,
              usageQuarterKey: r.usageQuarterKey,
              usageYearKey: r.usageYearKey,
            },
            plan
          )
        : null,
      transferReceipt: r.transferReceipt,
      user: userById.get(r.userId) ?? null,
    }
  })

  return NextResponse.json({ items })
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json(
      { error: 'SIGN_IN_REQUIRED', message: 'Please sign in to join the Kozy Circle — your membership lives in your account.' },
      { status: 401 }
    )
  }
  const role = (session.user as any)?.role
  if (role === 'STAFF' || role === 'ADMIN' || role === 'DRIVER') {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'Memberships are for customer accounts. Please use a personal account.' },
      { status: 403 }
    )
  }
  const userId = (session.user as any).id as string

  // ----- Rate limit: 6 subscribe attempts per hour per user -----
  const limit = await rateLimit(`subscribe:${userId}`, { max: 6, windowMs: 60 * 60 * 1000 })
  if (!limit.success) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', message: 'Too many attempts — please try again in a little while.' },
      { status: 429 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const planCode = typeof body?.planCode === 'string' ? body.planCode.toUpperCase().trim() : ''
  const paymentMethod = body?.paymentMethod === 'PAYSTACK' ? 'PAYSTACK' : 'BANK_TRANSFER'
  const transferReceipt =
    typeof body?.transferReceipt === 'string' && body.transferReceipt.startsWith('data:image/')
      ? body.transferReceipt.slice(0, 1_500_000)
      : null

  if (!planCode) {
    return NextResponse.json({ error: 'planCode is required' }, { status: 400 })
  }

  const plans = await getPlans(true)
  const plan = plans.find((p) => p.code === planCode && p.isActive)
  if (!plan || plan.id.startsWith('default-')) {
    return NextResponse.json(
      { error: 'PLAN_UNAVAILABLE', message: 'That membership tier is not available right now.' },
      { status: 400 }
    )
  }

  // ----- One membership per customer -----
  const existing = await db.subscription.findFirst({
    where: { userId, status: { in: ['PENDING_ACTIVATION', 'ACTIVE', 'PAST_DUE'] } },
    include: { plan: true },
  })
  if (existing) {
    return NextResponse.json(
      {
        error: 'ALREADY_MEMBER',
        message:
          existing.status === 'PENDING_ACTIVATION'
            ? 'You already have a membership waiting for payment confirmation — it will activate the moment your transfer is verified.'
            : `You are already on ${existing.plan?.name ?? 'a Kozy Circle plan'}. To switch tiers, cancel it first (it stays active until your current month ends), then subscribe to the new one.`,
        subscription: rowToMembership(existing),
      },
      { status: 409 }
    )
  }

  // ----- Create the membership (awaiting payment) -----
  const created = await db.subscription.create({
    data: {
      userId,
      planId: plan.id,
      status: 'PENDING_ACTIVATION',
      pricePaid: 0,
      paymentMethod,
      ...(transferReceipt ? { transferReceipt } : {}),
    },
  })

  // The Paystack reference for THIS membership's charge. Renewals find the
  // row by subscription code; the initial charge finds it by this ref.
  const paystackRef = `SUB-${created.id}`
  const sub = await db.subscription.update({
    where: { id: created.id },
    data: { paystackRef },
    include: { plan: true },
  })

  // ----- Admin alert (never blocks the response) -----
  after(async () => {
    try {
      const user = await db.user.findUnique({ where: { id: userId } })
      if (user) {
        await notifyAdminNewSubscription({
          user,
          plan: { name: plan.name, code: plan.code, priceMonthly: plan.priceMonthly },
          paymentMethod,
          subscriptionId: sub.id,
        })
      }
    } catch (e) {
      console.error('[memberships] admin alert failed:', e)
    }
  })

  return NextResponse.json(
    {
      subscription: rowToMembership(sub),
      next:
        paymentMethod === 'PAYSTACK'
          ? 'paystack'
          : 'transfer',
    },
    { status: 201 }
  )
}
