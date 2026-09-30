// =============================================================================
// POST /api/subscriptions/pickup — the member's one-tap booking
// =============================================================================
// Members never itemize: the Kozy Bag/Box regulates volume. This endpoint
// consumes the caller's ACTIVE membership entitlements and creates a REAL
// order that rides the existing pipeline (riders see the stop, kanban shows
// it, notifications fire) — zero new pipeline code.
//
//   kind=unit          → N × bag/box pickups. Included allowance first;
//                         extras bill at the plan rate (bank transfer on the
//                         order, or Paystack after). A fully-covered pickup
//                         lands straight on PAYMENT_VERIFIED (money settled
//                         by the membership) and is instantly dispatchable.
//   kind=duvet|curtain → the tier's quarterly perk (count against the
//                         quarter's allowance).
//   kind=spring-clean  → the annual perk (The Whole Home).
//   kind=shoes         → the tier's monthly shoe-clean pairs (phase 70).
//                         One pair = the standard sneaker/canvas clean;
//                         premium materials stay à-la-carte. Resets with
//                         the monthly cycle, exactly like bag/box units.
//
// First pickup also carries the kit hand-over (rider delivers the Kozy
// Bag/Box), and the membership's priority flag is stamped on the manifest
// so the station sees it.
// =============================================================================

import { NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { MemberPickupSchema } from '@/lib/schemas'
import { effectiveStatus, effectiveUsage, quarterKey, yearKey, recordSubscriptionEvent } from '@/lib/subscriptions'
import { assignBranchForAddress } from '@/lib/branches'
import { notifyOrderCreated, notifyAdminNewOrder } from '@/lib/notifications'

const PERK_LABEL: Record<string, { id: string; name: (plan: string) => string }> = {
  duvet: { id: 'member_perk_duvet', name: (p) => `Duvet wash — included (${p})` },
  curtain: { id: 'member_perk_curtain', name: (p) => `Curtain care — included (${p})` },
  'spring-clean': { id: 'member_perk_spring', name: (p) => `Spring clean — rugs & heavy materials (${p})` },
  shoes: { id: 'member_perk_shoes', name: (p) => `Shoe clean — included (${p})` },
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const role = (session.user as any)?.role
  if (role !== 'B2C' && role !== 'B2B') {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'Member pickups are booked from a customer account.' },
      { status: 403 }
    )
  }
  const userId = (session.user as any).id as string

  // Share the booking rate-limit budget with the regular order flow (30/hr).
  const limit = await rateLimit(`user-order:${userId}`, {
    max: 30,
    windowMs: 60 * 60 * 1000,
  })
  if (!limit.success) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', message: 'Too many bookings in one hour — please try again shortly.' },
      { status: 429 }
    )
  }

  const parsed = MemberPickupSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const { kind, pickupAddress, pickupDate, pickupTimeSlot, deliveryAddress, note } = parsed.data
  const count = Math.max(1, Math.min(4, parsed.data.count ?? 1))

  // ----- The membership must be live (PAST_DUE enjoys the 7-day grace) -----
  // Phase 70: a shoes pickup draws from the STANDALONE Shoe Club first (the
  // dedicated shoes-only membership from /services), and falls back to a
  // laundry tier's monthly shoe perk when no club exists. Every other kind
  // reads the laundry tier. Both families can be live on one account.
  const wantClub = kind === 'shoes'
  let sub = wantClub
    ? await db.subscription.findFirst({
        where: { userId, status: { in: ['ACTIVE', 'PAST_DUE'] }, plan: { family: 'SHOES' } },
        orderBy: { createdAt: 'desc' },
        include: { plan: true },
      })
    : null
  if (!sub) {
    sub = await db.subscription.findFirst({
      where: { userId, status: { in: ['ACTIVE', 'PAST_DUE'] }, plan: { family: 'KIT' } },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    })
  }
  if (!sub || !sub.plan) {
    return NextResponse.json(
      {
        error: 'NO_ACTIVE_MEMBERSHIP',
        message:
          kind === 'shoes'
            ? 'The Shoe Club lives in your account — join it from the shoe care section and your monthly pairs are one tap away.'
            : 'Your membership is not active. Join the Kozy Circle from the Membership tab to book bag pickups.',
      },
      { status: 400 }
    )
  }
  if (sub.cancelAtPeriodEnd && sub.periodEnd && new Date(sub.periodEnd).getTime() < Date.now()) {
    return NextResponse.json(
      { error: 'MEMBERSHIP_ENDED', message: 'This membership ended and was set not to renew.' },
      { status: 400 }
    )
  }
  const plan = sub.plan
  const status = effectiveStatus(sub)
  if (status !== 'ACTIVE' && status !== 'EXPIRING' && status !== 'PAST_DUE') {
    return NextResponse.json(
      { error: 'NO_ACTIVE_MEMBERSHIP', message: 'Your membership is not active.' },
      { status: 400 }
    )
  }

  const usage = effectiveUsage(sub, plan)

  // ----- Entitlement math -----
  let items: Array<{ id: string; name: string; quantity: number; unitPrice: number }>
  let extraUnits = 0
  let includedUnitsUsed = 0
  let perkCount = 0

  if (kind === 'unit') {
    if (count > usage.unitsRemaining + usage.extraRemaining) {
      return NextResponse.json(
        {
          error: 'UNITS_EXCEEDED',
          message: `Your ${plan.name} plan covers ${usage.unitsRemaining} more ${plan.unitName} pickup${usage.unitsRemaining === 1 ? '' : 's'} this month${usage.extraRemaining > 0 ? `, plus up to ${usage.extraRemaining} extra at ${plan.extraUnitPrice.toLocaleString('en-NG')} naira each` : ''}.`,
        },
        { status: 400 }
      )
    }
    includedUnitsUsed = Math.min(count, usage.unitsRemaining)
    extraUnits = count - includedUnitsUsed
    items = [
      {
        id: 'member_unit',
        name: `${plan.unitName} — wash & fold (${plan.name})`,
        quantity: count,
        unitPrice: extraUnits > 0 ? plan.extraUnitPrice : 0,
      },
    ]
  } else {
    const perk = PERK_LABEL[kind]
    if (!perk) {
      return NextResponse.json({ error: 'Unknown pickup kind' }, { status: 400 })
    }
    if (kind === 'duvet' && count > usage.duvetsRemaining) {
      return NextResponse.json(
        {
          error: 'PERK_EXCEEDED',
          message: `Your plan includes ${plan.duvetsPerQuarter} duvet wash${plan.duvetsPerQuarter === 1 ? '' : 'es'} per quarter — ${usage.duvetsRemaining} left until the next quarter.`,
        },
        { status: 400 }
      )
    }
    if (kind === 'curtain' && count > usage.curtainsRemaining) {
      return NextResponse.json(
        {
          error: 'PERK_EXCEEDED',
          message: `Your plan includes ${plan.curtainsPerQuarter} curtain care${plan.curtainsPerQuarter === 1 ? '' : ' visits'} per quarter — ${usage.curtainsRemaining} left.`,
        },
        { status: 400 }
      )
    }
    if (kind === 'spring-clean' && usage.springCleanRemaining < 1) {
      return NextResponse.json(
        {
          error: 'PERK_EXCEEDED',
          message: 'The annual spring clean has already been used this year — it returns next January.',
        },
        { status: 400 }
      )
    }
    if (kind === 'shoes' && count > usage.shoesRemaining) {
      return NextResponse.json(
        {
          error: 'PERK_EXCEEDED',
          message:
            plan.family === 'SHOES'
              ? `Your ${plan.name} covers ${plan.shoesPerMonth} pair${plan.shoesPerMonth === 1 ? '' : 's'} this month — ${usage.shoesRemaining} left. Extra pairs can ride along on any booking at the à-la-carte rate with your member discount.`
              : `Your plan includes ${plan.shoesPerMonth} shoe clean${plan.shoesPerMonth === 1 ? '' : 's'} per month — ${usage.shoesRemaining} left this month. (Premium materials — suede, leather, embellished — are booked separately with your member discount.)`,
        },
        { status: 400 }
      )
    }
    perkCount = kind === 'spring-clean' ? 1 : count
    items = [
      {
        id: perk.id,
        name: perk.name(plan.name),
        quantity: perkCount,
        unitPrice: 0,
      },
    ]
  }

  // ----- Duplicate-submission guard (same guard philosophy as orders) -----
  // Identity = same member, same entitlement KIND, same address, same date
  // AND same time slot, within 5 minutes. A bag pickup and a duvet pickup at
  // the same address on the same day are DIFFERENT orders (both legitimate);
  // only a true double-tap of one submission is collapsed.
  const recentSameSlot = await db.order.findMany({
    where: {
      userId,
      subscriptionId: sub.id,
      pickupAddress,
      pickupDate: new Date(pickupDate),
      pickupTimeSlot,
      status: { in: ['REQUESTED', 'PAYMENT_PENDING_VERIFICATION', 'PAYMENT_VERIFIED'] },
      createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
    },
    orderBy: { createdAt: 'desc' },
  })
  const firstItemId = items[0]?.id
  const duplicate = recentSameSlot.find((o) => {
    try {
      return JSON.parse(o.itemsManifest ?? '[]')[0]?.id === firstItemId
    } catch {
      return false
    }
  })
  if (duplicate) {
    return NextResponse.json({ order: duplicate, duplicate: true }, { status: 201 })
  }

  // ----- Branch assignment (same engine as regular orders) -----
  const branch = await assignBranchForAddress(pickupAddress)

  // ----- Price: extras only -----
  const totalPrice = extraUnits * plan.extraUnitPrice
  const manifestNote: string[] = []
  if (plan.prioritySlots) manifestNote.push('Priority member — first available window')
  if (sub.kitState === 'PENDING_DELIVERY' && kind === 'unit') {
    manifestNote.push(`KIT DELIVERY — hand over the ${plan.unitName} at this stop`)
  }
  if (status === 'PAST_DUE') manifestNote.push('Renewal pending — payment grace')
  if (note) manifestNote.push(`Member note: ${note}`)

  const orderNumber = `KZ-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`

  const order = await db.order.create({
    data: {
      orderNumber,
      userId,
      status: totalPrice > 0 ? 'PAYMENT_PENDING_VERIFICATION' : 'PAYMENT_VERIFIED',
      type: 'ITEM',
      guaranteeActive: false,
      serviceSpeed: 'STANDARD',
      modeOfWash: 'MACHINE',
      deliveryFee: 0, // members never pay delivery
      itemsManifest: JSON.stringify(items),
      ...(manifestNote.length > 0
        ? { alterationNotes: manifestNote.join(' · ') } // shown in the admin manifest panel
        : {}),
      totalPrice,
      subscriptionId: sub.id,
      ...(branch ? { branchId: branch.branchId } : {}),
      pickupAddress,
      pickupDate: new Date(pickupDate),
      pickupTimeSlot,
      deliveryAddress: deliveryAddress || null,
      ...(totalPrice > 0
        ? {
            payments: {
              create: {
                amount: totalPrice,
                method: 'BANK_TRANSFER',
                status: 'PENDING',
              },
            },
          }
        : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, role: true } },
      payments: true,
    },
  })

  // ----- Status trail -----
  try {
    await db.statusEvent.create({
      data: {
        orderId: order.id,
        status: order.status,
        note:
          totalPrice > 0
            ? `Membership pickup — ${extraUnits} extra ${plan.unitKind}(s) billed at ${(plan.extraUnitPrice * extraUnits).toLocaleString('en-NG')} naira${branch ? ` · ${branch.branchName} branch` : ''}`
            : `Membership pickup — covered by ${plan.name}${branch ? ` · ${branch.branchName} branch (${branch.reason})` : ''}`,
      },
    })
  } catch {
    /* trail is best-effort */
  }

  // ----- Consume the entitlements (after the order exists) -----
  const usagePatch: Record<string, unknown> = {}
  if (kind === 'unit') {
    usagePatch.unitsUsed = sub.unitsUsed + includedUnitsUsed
    usagePatch.extraUnitsUsed = sub.extraUnitsUsed + extraUnits
    usagePatch.usageCycleKey = sub.periodStart ? sub.usageCycleKey ?? 'seed' : 'seed'
  } else if (kind === 'duvet') {
    // Lazy quarter roll: counters belonged to an old quarter → start fresh.
    const rolled = (sub.usageQuarterKey ?? '') !== quarterKey()
    usagePatch.duvetsUsed = (rolled ? 0 : sub.duvetsUsed) + perkCount
    usagePatch.usageQuarterKey = quarterKey()
  } else if (kind === 'shoes') {
    // Monthly-cycle perk: same semantics as bag/box units — the counter
    // resets at renewal (activateOrRenewSubscription), never lazily.
    usagePatch.shoesUsed = (sub.shoesUsed ?? 0) + perkCount
    usagePatch.usageCycleKey = sub.periodStart ? sub.usageCycleKey ?? 'seed' : 'seed'
  } else if (kind === 'curtain') {
    const rolled = (sub.usageQuarterKey ?? '') !== quarterKey()
    usagePatch.curtainsUsed = (rolled ? 0 : sub.curtainsUsed) + perkCount
    usagePatch.usageQuarterKey = quarterKey()
  } else if (kind === 'spring-clean') {
    const rolled = (sub.usageYearKey ?? '') !== yearKey()
    usagePatch.springCleanUsed = (rolled ? 0 : sub.springCleanUsed) + 1
    usagePatch.usageYearKey = yearKey()
  }
  // First bag pickup = the kit hand-over.
  if (sub.kitState === 'PENDING_DELIVERY' && kind === 'unit') {
    usagePatch.kitState = 'WITH_MEMBER'
    usagePatch.kitDeliveredAt = new Date()
  }
  if (Object.keys(usagePatch).length > 0) {
    try {
      await db.subscription.update({ where: { id: sub.id }, data: usagePatch })
    } catch (e) {
      console.error('[memberships] usage update failed (order still placed):', e)
    }
  }

  // ----- The ledger row (phase 75) — the WHY behind the counter movement -----
  // UNIT bookings carry the included/extra split in meta so a cancellation
  // can refund exactly what this booking took.
  {
    const kindMap: Record<string, string> = {
      unit: 'UNIT',
      duvet: 'DUVET',
      curtain: 'CURTAIN',
      'spring-clean': 'SPRING',
      shoes: 'SHOES',
    }
    const qty = kind === 'unit' ? count : perkCount
    await recordSubscriptionEvent({
      subscriptionId: sub.id,
      kind: kindMap[kind] ?? 'UNIT',
      delta: qty,
      count: qty,
      meta:
        kind === 'unit'
          ? { includedUnits: includedUnitsUsed, extraUnits }
          : kind === 'shoes'
            ? { club: plan.family === 'SHOES' }
            : undefined,
      note: `Booked by member${extraUnits > 0 ? ` — ${extraUnits} extra billed` : ''}`,
      orderId: order.id,
    })
    if (usagePatch.kitState === 'WITH_MEMBER') {
      await recordSubscriptionEvent({
        subscriptionId: sub.id,
        kind: 'KIT_DELIVERED',
        delta: 0,
        count: 0,
        note: 'Kit handed over with the first member pickup',
        orderId: order.id,
      })
    }
  }

  // ----- Notifications (customer confirmation + admin alert) -----
  after(async () => {
    try {
      await notifyOrderCreated(order as any)
      await notifyAdminNewOrder(order as any)
    } catch (e) {
      console.error('[memberships] pickup notifications failed:', e)
    }
  })

  return NextResponse.json({ order, extraUnits, extraCharge: totalPrice }, { status: 201 })
}
