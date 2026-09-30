// =============================================================================
// GET   /api/subscriptions/me — the signed-in member's memberships
// PATCH /api/subscriptions/me — membership self-serve actions
// =============================================================================
// GET returns the caller's CURRENT memberships (newest non-cancelled first)
// with computed effective status, the usage snapshot for the current cycle /
// quarter / year, and the renewal date. 404-shaped { membership: null } for
// non-members — the portal renders the join CTA instead.
//
// Phase 70 — two families, one account: `membership` stays the LAUNDRY tier
// (every existing surface reads it) and `shoeClub` carries the standalone
// Shoe Club subscription when the customer holds one. Both can be live at
// once; each is cancelled independently via PATCH with family: 'KIT' |
// 'SHOES' (default KIT, so legacy callers keep working).
//
// PATCH actions:
//   'cancel' / 'cancel-undo' — the classy at-period-end cancellation (and
//       its undo). Hard immediate cancellation stays an admin action.
//   'plan-change' (phase 81) — { planCode }: switch tier inside the SAME
//       family. A PENDING_ACTIVATION request swaps the plan immediately (no
//       money has moved, nothing to prorate). A live membership schedules
//       the switch — it lands with the NEXT paid cycle (the renew/verify
//       engine applies it), so paid days are never lost and no money moves
//       at request time. Upgrades and downgrades ride the same quiet door:
//       the portal calls it "Change plan" and never frames it as a
//       downgrade.
//   'plan-change-undo' (phase 81) — clear a scheduled switch.
// =============================================================================

import { NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { effectiveStatus, effectiveUsage, rowToMembership, getSubscriptionActivity, recordSubscriptionEvent } from '@/lib/subscriptions'
import { notifyMembershipCancelled } from '@/lib/notifications'

async function loadCurrent(userId: string, family: 'KIT' | 'SHOES' = 'KIT') {
  const row = await db.subscription.findFirst({
    where: { userId, status: { not: 'CANCELLED' }, plan: { family } },
    orderBy: { createdAt: 'desc' },
    include: { plan: true, pendingPlan: true },
  })
  return row
}

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id as string

  const row = await loadCurrent(userId, 'KIT')
  const club = await loadCurrent(userId, 'SHOES')
  if (!row && !club) {
    return NextResponse.json({ membership: null })
  }

  // Phase 75: the member's in-cycle activity — every booking with its live
  // status, the missed-pickup flag, and the ledger tail. The portal's
  // "Your pickups this month" section renders straight from this.
  const [tierActivity, clubActivity] = await Promise.all([
    row ? getSubscriptionActivity(row.id, { eventLimit: 12 }) : Promise.resolve(null),
    club ? getSubscriptionActivity(club.id, { eventLimit: 8 }) : Promise.resolve(null),
  ])

  const plan = row?.plan
  const clubPlan = club?.plan
  return NextResponse.json({
    membership: row ? rowToMembership(row) : null,
    effectiveStatus: row ? effectiveStatus(row) : null,
    usage: plan
      ? effectiveUsage(
          {
            unitsUsed: row.unitsUsed,
            extraUnitsUsed: row.extraUnitsUsed,
            shoesUsed: row.shoesUsed,
            duvetsUsed: row.duvetsUsed,
            curtainsUsed: row.curtainsUsed,
            springCleanUsed: row.springCleanUsed,
            usageQuarterKey: row.usageQuarterKey,
            usageYearKey: row.usageYearKey,
          },
          plan
        )
      : null,
    activity: tierActivity,
    // Phase 70: the standalone Shoe Club, when this customer holds one.
    shoeClub: club
      ? {
          membership: rowToMembership(club),
          effectiveStatus: effectiveStatus(club),
          usage: clubPlan
            ? effectiveUsage(
                {
                  unitsUsed: club.unitsUsed,
                  extraUnitsUsed: club.extraUnitsUsed,
                  shoesUsed: club.shoesUsed,
                  duvetsUsed: club.duvetsUsed,
                  curtainsUsed: club.curtainsUsed,
                  springCleanUsed: club.springCleanUsed,
                  usageQuarterKey: club.usageQuarterKey,
                  usageYearKey: club.usageYearKey,
                },
                clubPlan
              )
            : null,
          activity: clubActivity,
        }
      : null,
  })
}

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id as string

  const body = await req.json().catch(() => ({}))
  const action = body?.action
  const family: 'KIT' | 'SHOES' = body?.family === 'SHOES' ? 'SHOES' : 'KIT'

  // ----- Phase 81: the quiet tier switch (upgrade or downgrade) -----
  if (action === 'plan-change' || action === 'plan-change-undo') {
    // Same budget as the other self-serve membership actions: a handful of
    // deliberate taps, never a bot's hammer.
    const limit = await rateLimit(`planchange:${userId}`, { max: 12, windowMs: 60 * 60 * 1000 })
    if (!limit.success) {
      return NextResponse.json(
        { error: 'RATE_LIMITED', message: 'Too many changes — please try again in a little while.' },
        { status: 429 }
      )
    }

    const row = await loadCurrent(userId, family)
    if (!row) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'No membership to change.' },
        { status: 404 }
      )
    }

    // ---- Undo: clear a scheduled switch (immediate, no money involved) ----
    if (action === 'plan-change-undo') {
      if (!row.pendingPlanId) {
        return NextResponse.json(
          { error: 'NO_CHANGE_SCHEDULED', message: 'No plan change is scheduled for this membership.' },
          { status: 400 }
        )
      }
      const undone = await db.subscription.update({
        where: { id: row.id },
        data: { pendingPlanId: null },
        include: { plan: true, pendingPlan: true },
      })
      await recordSubscriptionEvent({
        subscriptionId: row.id,
        kind: 'PLAN_CHANGE_UNDO',
        delta: 0,
        count: 0,
        meta: { from: row.plan?.code, cancelledSwitchTo: row.pendingPlan?.code },
        note: 'Member undid the scheduled plan change.',
      })
      return NextResponse.json({
        membership: rowToMembership(undone),
        effectiveStatus: effectiveStatus(undone),
      })
    }

    // ---- Schedule (or, while pending, apply) a switch ----
    const planCode =
      typeof body?.planCode === 'string' ? body.planCode.toUpperCase().trim() : ''
    if (!planCode) {
      return NextResponse.json({ error: 'planCode is required' }, { status: 400 })
    }
    const target = await db.subscriptionPlan.findUnique({ where: { code: planCode } })
    if (!target || !target.isActive || target.id.startsWith('default-')) {
      return NextResponse.json(
        { error: 'PLAN_UNAVAILABLE', message: 'That plan is not available right now.' },
        { status: 400 }
      )
    }
    // Same family only — a laundry tier swaps with a laundry tier, a club
    // with a club. Cross-family (tier ↔ club) stays the separate products
    // they are.
    if (row.plan && target.family !== row.plan.family) {
      return NextResponse.json(
        {
          error: 'WRONG_FAMILY',
          message:
            target.family === 'SHOES'
              ? 'The Shoe Club is a separate membership — join it alongside your laundry plan from the Services page.'
              : 'Laundry tiers swap with laundry tiers — the Shoe Club is a separate membership.',
        },
        { status: 400 }
      )
    }
    if (target.id === row.planId) {
      return NextResponse.json(
        { error: 'SAME_PLAN', message: 'You are already on that plan.' },
        { status: 400 }
      )
    }

    // PENDING_ACTIVATION: no money has moved — swap the request immediately
    // so the member pays for the tier they actually want (and is never
    // trapped by the one-membership-per-family rule).
    if (row.status === 'PENDING_ACTIVATION') {
      const swapped = await db.subscription.update({
        where: { id: row.id },
        data: { planId: target.id, pendingPlanId: null },
        include: { plan: true, pendingPlan: true },
      })
      await recordSubscriptionEvent({
        subscriptionId: row.id,
        kind: 'PLAN_CHANGE',
        delta: 0,
        count: 0,
        meta: { from: row.plan?.code, to: target.code, while: 'PENDING_ACTIVATION' },
        note: `Membership request switched before first payment: ${row.plan?.name ?? 'plan'} → ${target.name}.`,
      })
      return NextResponse.json({
        membership: rowToMembership(swapped),
        effectiveStatus: effectiveStatus(swapped),
        applied: 'immediately',
      })
    }

    // LIVE membership: schedule the switch — it lands with the next paid
    // cycle (paid days untouched, no money moves now).
    const eff = effectiveStatus(row)
    if (eff !== 'ACTIVE' && eff !== 'EXPIRING' && eff !== 'PAST_DUE' && eff !== 'LAPSED') {
      return NextResponse.json(
        { error: 'NOT_CHANGEABLE', message: 'This membership cannot change plans in its current state.' },
        { status: 409 }
      )
    }
    const updated = await db.subscription.update({
      where: { id: row.id },
      data: { pendingPlanId: target.id },
      include: { plan: true, pendingPlan: true },
    })
    await recordSubscriptionEvent({
      subscriptionId: row.id,
      kind: 'PLAN_CHANGE_SCHEDULED',
      delta: 0,
      count: 0,
      meta: { from: row.plan?.code, to: target.code, replaces: row.pendingPlanId ?? null },
      note: `Plan switch scheduled for the next paid cycle: ${row.plan?.name ?? 'plan'} → ${target.name} (${target.priceMonthly.toLocaleString('en-NG')} naira/month).`,
    })
    return NextResponse.json({
      membership: rowToMembership(updated),
      effectiveStatus: effectiveStatus(updated),
      applied: 'next-renewal',
    })
  }

  if (action !== 'cancel' && action !== 'cancel-undo') {
    return NextResponse.json({ error: 'action must be "cancel", "cancel-undo", "plan-change" or "plan-change-undo"' }, { status: 400 })
  }

  const row = await loadCurrent(userId, family)
  if (!row) {
    return NextResponse.json(
      {
        error: 'No membership to cancel.',
        message:
          family === 'SHOES'
            ? 'You are not on the Shoe Club — nothing to cancel.'
            : 'No membership to cancel.',
      },
      { status: 404 }
    )
  }
  if (row.status === 'PENDING_ACTIVATION') {
    return NextResponse.json(
      {
        error: 'PENDING_ACTIVATION',
        message: 'This membership has not been activated yet — nothing to cancel. If you paid by transfer and it was a mistake, contact us and we will sort it out.',
      },
      { status: 400 }
    )
  }

  const cancelAtPeriodEnd = action === 'cancel'
  const updated = await db.subscription.update({
    where: { id: row.id },
    data: {
      cancelAtPeriodEnd,
      // A cancelled-then-undone membership: clear any recorded reason.
      ...(cancelAtPeriodEnd ? {} : { cancelledAt: null, cancelledReason: null }),
    },
    include: { plan: true },
  })

  if (cancelAtPeriodEnd) {
    after(async () => {
      try {
        const user = await db.user.findUnique({ where: { id: userId } })
        if (user) {
          await notifyMembershipCancelled({
            user,
            planName: row.plan?.name ?? 'your plan',
            periodEnd: row.periodEnd,
          })
        }
      } catch (e) {
        console.error('[memberships] cancellation email failed:', e)
      }
    })
  }

  return NextResponse.json({
    membership: rowToMembership(updated),
    effectiveStatus: effectiveStatus(updated),
  })
}
