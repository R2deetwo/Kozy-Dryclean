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
import { GARMENT_CATALOG } from '@/lib/types'
import {
  getPlans,
  rowToMembership,
  effectiveStatus,
  effectiveUsage,
  cycleHealth,
  openRenewalClaimsFor,
  recordSubscriptionEvent,
} from '@/lib/subscriptions'
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
    include: { plan: true, pendingPlan: true },
  })

  const plans = await getPlans(true)
  const planById = new Map(plans.map((p) => [p.id, p]))
  const users = await db.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) } },
    select: { id: true, name: true, email: true, phone: true },
  })
  const userById = new Map(users.map((u) => [u.id, u]))

  // ----- Phase 75: the per-member cycle orders (ONE query, not N+1) -----
  // Everything since each member's periodStart powers the health radar:
  // missed pickups, last pickup, next scheduled, usage ratio vs cycle clock.
  const liveRows = rows.filter((r) => r.periodStart)
  const sinceBySub = new Map(liveRows.map((r) => [r.id, r.periodStart as Date]))
  const cycleOrders = liveRows.length
    ? await db.order.findMany({
        where: {
          subscriptionId: { in: liveRows.map((r) => r.id) },
          createdAt: { gte: new Date(Math.min(...Array.from(sinceBySub.values()).map((d) => d.getTime()))) },
        },
        orderBy: { pickupDate: 'asc' },
        select: {
          id: true,
          subscriptionId: true,
          status: true,
          pickupDate: true,
          pickupTimeSlot: true,
          pickedUpAt: true,
          deliveredAt: true,
          createdAt: true,
        },
      })
    : []
  type CycleOrder = (typeof cycleOrders)[number]
  const ordersBySub = new Map<string, CycleOrder[]>()
  for (const o of cycleOrders) {
    if (!o.subscriptionId) continue
    const since = sinceBySub.get(o.subscriptionId)
    if (since && o.createdAt >= since) {
      const list = ordersBySub.get(o.subscriptionId) ?? []
      list.push(o)
      ordersBySub.set(o.subscriptionId, list)
    }
  }

  const now = new Date()
  // Task 82 — every OPEN transfer claim on the roster, ONE query. This is
  // the wiring the owner asked for: a member saying "I've made payment" now
  // surfaces on the admin list itself (not only inside the record-renewal
  // dialog), with months + amount + reference ready to confirm.
  const openClaims = await openRenewalClaimsFor(rows.map((r) => r.id), now)

  // Task 88 — lifetime membership revenue per row. A member's laundry orders
  // are zero-naira BY DESIGN (the plan covers them), so the money they have
  // actually paid lives here instead: every confirmed cycle writes a
  // CYCLE_START ledger row whose meta carries that payment's pricePaid.
  // Memberships that predate the ledger (phase 75) carry no events, so the
  // row's own pricePaid — the only payment we can vouch for — is the floor.
  // One grouped query for the whole roster, never per-row.
  const cycleStarts = rows.length
    ? await db.subscriptionEvent.findMany({
        where: { kind: 'CYCLE_START', subscriptionId: { in: rows.map((r) => r.id) } },
        select: { subscriptionId: true, meta: true },
      })
    : []
  const lifetimeBySub = new Map<string, number>()
  for (const ev of cycleStarts) {
    let paid = 0
    try {
      paid = Math.round(Number(JSON.parse(ev.meta ?? '{}').pricePaid) || 0)
    } catch {
      // Corrupt meta on a ledger row — treat that payment as unverifiable 0.
    }
    lifetimeBySub.set(ev.subscriptionId, (lifetimeBySub.get(ev.subscriptionId) ?? 0) + paid)
  }

  const items = rows.map((r) => {
    const plan = r.plan ?? planById.get(r.planId)
    const subOrders = ordersBySub.get(r.id) ?? []
    const health = cycleHealth(r, plan, subOrders, now)
    const live = subOrders.filter((o) => o.status !== 'CANCELLED')
    const lastPickup = live
      .filter((o) => o.pickedUpAt)
      .sort((a, b) => new Date(b.pickedUpAt!).getTime() - new Date(a.pickedUpAt!).getTime())[0]
    const nextScheduled = live
      .filter((o) => !o.pickedUpAt && new Date(o.pickupDate).getTime() >= now.getTime() - 12 * 60 * 60 * 1000)
      .sort((a, b) => new Date(a.pickupDate).getTime() - new Date(b.pickupDate).getTime())[0]
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
              bedsheetsUsed: r.bedsheetsUsed ?? 0,
              usageQuarterKey: r.usageQuarterKey,
              usageYearKey: r.usageYearKey,
            },
            plan
          )
        : null,
      transferReceipt: r.transferReceipt,
      user: userById.get(r.userId) ?? null,
      // Phase 75: the retention radar + wash-floor facts.
      health,
      kitTag: r.kitTag,
      lastPickupAt: lastPickup?.pickedUpAt?.toISOString() ?? null,
      nextPickupAt: nextScheduled?.pickupDate?.toISOString() ?? null,
      nextPickupSlot: nextScheduled?.pickupTimeSlot ?? null,
      // Task 82: the member's open "I've made payment" claim.
      openClaim: openClaims.get(r.id) ?? null,
      // Task 88: everything this member has ever paid for the plan itself
      // (max of the ledger sum and the row's own pricePaid — legacy rows
      // predate the ledger; the row price is then the honest floor).
      lifetimePaid: Math.max(lifetimeBySub.get(r.id) ?? 0, r.pricePaid),
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

  // ----- Task 86: the first Kozy Bag claimed at checkout -----
  // The customer accepted the conversion pitch in the booking wizard, so
  // their exact basket (mixed as it is) rides with the join. Validated
  // field by field below — NEVER trusted as-is — then recorded on the
  // membership ledger as FIRST_BAG_CLAIMED. The order itself is only
  // placed when the first month is paid (activateOrRenewSubscription —
  // nobody rides free on an unpaid plan).
  const firstBag = sanitizeFirstBag(body?.firstBag)

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

  // ----- One live membership per FAMILY per customer (phase 70) -----
  // A laundry tier AND a Shoe Club compose (they are different products);
  // two of the SAME family do not (switching = cancel → re-subscribe, stated
  // plainly in the error message).
  const existing = await db.subscription.findFirst({
    where: {
      userId,
      status: { in: ['PENDING_ACTIVATION', 'ACTIVE', 'PAST_DUE'] },
      plan: { family: plan.family },
    },
    include: { plan: true, pendingPlan: true },
  })
  if (existing) {
    return NextResponse.json(
      {
        error: 'ALREADY_MEMBER',
        message:
          existing.status === 'PENDING_ACTIVATION'
            ? `You already have ${existing.plan?.family === 'SHOES' ? 'a Shoe Club' : 'a membership'} request waiting for its first payment — it activates the moment your transfer is verified.`
            : existing.plan?.family === 'SHOES'
              ? `You are already on the ${existing.plan?.name ?? 'Shoe Club'}. To switch clubs, use Change plan in your portal's Membership tab — it takes effect at your next renewal.`
              : `You are already on ${existing.plan?.name ?? 'a Kozy Circle plan'}. To switch tiers, use Change plan in your portal's Membership tab — it takes effect at your next renewal.`,
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
    include: { plan: true, pendingPlan: true },
  })

  // ----- Task 86: record the claimed first Kozy Bag on the ledger -----
  // The basket waits here (validated above). The moment the first month is
  // paid, activateOrRenewSubscription books it as the first weekly pickup
  // at ₦0 — mixed basket honoured, no scrutiny. One claim per membership.
  if (firstBag) {
    await recordSubscriptionEvent({
      subscriptionId: created.id,
      kind: 'FIRST_BAG_CLAIMED',
      delta: 0,
      count: 0,
      meta: firstBag as unknown as Record<string, unknown>,
      note: `First ${plan.unitName} claimed at checkout — rides free on activation (mixed basket accepted, one-off value ${firstBag.estimatedTotal.toLocaleString('en-NG')} naira)`,
    })
  }

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
          // Task 86 - tell the office a first Kozy Bag is riding on this
          // join: verifying the payment books the saved basket automatically.
          ...(firstBag
            ? {
                firstBagClaimed: {
                  estimatedTotal: firstBag.estimatedTotal,
                  pickupAddress: firstBag.pickupAddress,
                  pickupDate: firstBag.pickupDate,
                  pickupSlot: firstBag.pickupSlot,
                },
              }
            : {}),
        })
      }
    } catch (e) {
      console.error('emberships] admin alert failed:', e)
    }
  })

  return NextResponse.json(
    {
      subscription: rowToMembership(sub),
      next:
        paymentMethod === 'PAYSTACK'
          ? 'paystack'
          : 'transfer',
      ...(firstBag ? { firstBagClaimed: true } : {}),
    },
    { status: 201 }
  )
}

// -----------------------------------------------------------------------------
// Task 86 - first-bag payload validation. Everything is re-checked here
// (NEVER trust the client): garment ids must exist in the catalog,
// quantities are sane integers, the addresses have real length, the date is
// a plausible future pickup, and text fields are length-capped. The result
// is the exact shape stored on the ledger - nothing else rides along.
// -----------------------------------------------------------------------------
interface SanitizedFirstBag {
  items: Record<string, number>
  pickupAddress: string
  pickupDate: string
  pickupSlot: string
  deliveryAddress: string
  modeOfWash?: 'MACHINE' | 'HANDWASH' | 'IRON_ONLY'
  serviceSpeed?: 'STANDARD' | 'EXPRESS_24' | 'EXPRESS_48' | 'EXPRESS_12'
  alterationNotes?: string
  estimatedTotal: number
}

function sanitizeFirstBag(raw: unknown): SanitizedFirstBag | null {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as Record<string, unknown>

  // Items: garment id -> quantity. Ids must exist in the shared catalog
  // (alteration rides too - the seamstress quotes it as always).
  if (!b.items || typeof b.items !== 'object' || Array.isArray(b.items)) return null
  const items: Record<string, number> = {}
  let totalQty = 0
  for (const [id, qtyRaw] of Object.entries(b.items as Record<string, unknown>)) {
    const known = id === 'alteration' || GARMENT_CATALOG.some((g) => g.id === id)
    if (!known) return null
    const qty = Number(qtyRaw)
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) return null
    items[id] = qty
    totalQty += qty
  }
  if (totalQty < 1 || totalQty > 200) return null

  // Addresses / slots - same rules the member-pickup endpoint applies.
  const pickupAddress = typeof b.pickupAddress === 'string' ? b.pickupAddress.trim() : ''
  if (pickupAddress.length < 8 || pickupAddress.length > 400) return null
  const deliveryAddress = typeof b.deliveryAddress === 'string' ? b.deliveryAddress.trim() : ''
  if (deliveryAddress.length > 400) return null
  const pickupSlot = typeof b.pickupSlot === 'string' ? b.pickupSlot.trim() : ''
  if (!pickupSlot || pickupSlot.length > 40) return null

  // Date: a plausible pickup date (today -1 day through +60 days). Stored
  // as the YYYY-MM-DD string the wizard used.
  const pickupDate = typeof b.pickupDate === 'string' ? b.pickupDate.trim() : ''
  const when = new Date(pickupDate)
  if (!pickupDate || Number.isNaN(when.getTime())) return null
  const nowMs = Date.now()
  if (when.getTime() < nowMs - 24 * 60 * 60 * 1000 || when.getTime() > nowMs + 60 * 24 * 60 * 60 * 1000) {
    return null
  }

  // Mode of wash + turnaround: enum-guarded, optional.
  const modeOfWash =
    b.modeOfWash === 'MACHINE' || b.modeOfWash === 'HANDWASH' || b.modeOfWash === 'IRON_ONLY'
      ? b.modeOfWash
      : undefined
  const serviceSpeed =
    b.serviceSpeed === 'STANDARD' ||
    b.serviceSpeed === 'EXPRESS_24' ||
    b.serviceSpeed === 'EXPRESS_48' ||
    b.serviceSpeed === 'EXPRESS_12'
      ? b.serviceSpeed
      : undefined

  // Free-text note: length-capped, optional.
  const alterationNotes =
    typeof b.alterationNotes === 'string' && b.alterationNotes.trim()
      ? b.alterationNotes.trim().slice(0, 500)
      : undefined

  // The one-off estimate they were shown - informational only (the first
  // bag itself is zero-naira by construction; this number explains the gift).
  const estimatedTotal = Number(b.estimatedTotal)

  return {
    items,
    pickupAddress,
    pickupDate,
    pickupSlot,
    deliveryAddress,
    ...(modeOfWash ? { modeOfWash } : {}),
    ...(serviceSpeed ? { serviceSpeed } : {}),
    ...(alterationNotes ? { alterationNotes } : {}),
    estimatedTotal: Number.isFinite(estimatedTotal)
      ? Math.max(0, Math.min(Math.round(estimatedTotal), 10_000_000))
      : 0,
  }
}
