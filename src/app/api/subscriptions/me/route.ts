// =============================================================================
// GET   /api/subscriptions/me — the signed-in member's memberships
// PATCH /api/subscriptions/me — { action: 'cancel' | 'cancel-undo', family? }
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
// PATCH 'cancel' sets cancelAtPeriodEnd — the classy cancellation: the
// membership stays fully active until the paid month runs out, then simply
// does not renew. 'cancel-undo' clears the flag (Lagos reality: people
// change their minds). Hard immediate cancellation is an admin action.
// =============================================================================

import { NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { effectiveStatus, effectiveUsage, rowToMembership, getSubscriptionActivity } from '@/lib/subscriptions'
import { notifyMembershipCancelled } from '@/lib/notifications'

async function loadCurrent(userId: string, family: 'KIT' | 'SHOES' = 'KIT') {
  const row = await db.subscription.findFirst({
    where: { userId, status: { not: 'CANCELLED' }, plan: { family } },
    orderBy: { createdAt: 'desc' },
    include: { plan: true },
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
  if (action !== 'cancel' && action !== 'cancel-undo') {
    return NextResponse.json({ error: 'action must be "cancel" or "cancel-undo"' }, { status: 400 })
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
