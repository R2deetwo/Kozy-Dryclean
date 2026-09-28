// =============================================================================
// GET   /api/subscriptions/me — the signed-in member's membership
// PATCH /api/subscriptions/me — { action: 'cancel' | 'cancel-undo' }
// =============================================================================
// GET returns the caller's CURRENT membership (newest non-cancelled first)
// with computed effective status, the usage snapshot for the current cycle /
// quarter / year, and the renewal date. 404-shaped { membership: null } for
// non-members — the portal renders the join CTA instead.
//
// PATCH 'cancel' sets cancelAtPeriodEnd — the classy cancellation: the
// membership stays fully active until the paid month runs out, then simply
// does not renew. 'cancel-undo' clears the flag (Lagos reality: people
// change their minds). Hard immediate cancellation is an admin action.
// =============================================================================

import { NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { effectiveStatus, effectiveUsage, rowToMembership } from '@/lib/subscriptions'
import { notifyMembershipCancelled } from '@/lib/notifications'

async function loadCurrent(userId: string) {
  const row = await db.subscription.findFirst({
    where: { userId, status: { not: 'CANCELLED' } },
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

  const row = await loadCurrent(userId)
  if (!row) {
    return NextResponse.json({ membership: null })
  }

  const plan = row.plan
  return NextResponse.json({
    membership: rowToMembership(row),
    effectiveStatus: effectiveStatus(row),
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
  if (action !== 'cancel' && action !== 'cancel-undo') {
    return NextResponse.json({ error: 'action must be "cancel" or "cancel-undo"' }, { status: 400 })
  }

  const row = await loadCurrent(userId)
  if (!row) {
    return NextResponse.json({ error: 'No membership to cancel.' }, { status: 404 })
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
