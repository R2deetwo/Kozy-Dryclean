// =============================================================================
// PATCH /api/subscriptions/[id] — ADMIN membership management
// =============================================================================
// Actions:
//   verify       — the transfer receipt checks out → activate/renew the cycle
//   reject       — the receipt does not match → notify + keep pending (the
//                  member sees "awaiting verification" and can re-upload)
//   renew        — record a manual/cash renewal (price override optional)
//   cancel       — immediate hard cancellation (member-requested, offline)
//   kit-delivered / kit-returned / kit-replaced — the physical kit lifecycle
//   reset-usage  — zero the counters (goodwill / billing correction)
//
// The verify + renew paths reuse activateOrRenewSubscription — the same
// engine the Paystack webhook drives — so a card member and a transfer
// member land in an identical state, byte for byte.
// =============================================================================

import { NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { activateOrRenewSubscription, rowToMembership } from '@/lib/subscriptions'
import { notifyMembershipActive } from '@/lib/notifications'

async function guard(): Promise<ReturnType<typeof requireRole> | NextResponse | null> {
  try {
    return await requireRole('ADMIN')
  } catch (e: any) {
    if (e instanceof Response) {
      return new NextResponse(e.body, {
        status: e.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await guard()
  if (session instanceof NextResponse) return session
  const adminName = session?.user?.name || 'Admin'

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const action = typeof body?.action === 'string' ? body.action : ''

  const sub = await db.subscription.findUnique({
    where: { id },
    include: { plan: true, user: { select: { id: true, name: true, email: true, phone: true } } },
  })
  if (!sub) {
    return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
  }

  const sendActiveEmail = (pricePaid: number) =>
    after(async () => {
      try {
        if (sub.plan && sub.user?.email) {
          await notifyMembershipActive({
            user: { name: sub.user.name, email: sub.user.email },
            planName: sub.plan.name,
            pricePaid,
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            unitName: sub.plan.unitName,
            includedUnits: sub.plan.includedUnits,
          })
        }
      } catch (e) {
        console.error('[memberships] activation email failed:', e)
      }
    })

  switch (action) {
    case 'verify':
    case 'renew': {
      // renew allows a price override (goodwill discounts, founding-member
      // pricing); verify always charges the plan price.
      const price =
        action === 'renew' &&
        Number.isFinite(Number(body?.pricePaid)) &&
        Number(body?.pricePaid) >= 0
          ? Math.round(Number(body?.pricePaid))
          : sub.plan?.priceMonthly ?? sub.pricePaid
      try {
        const updated = await activateOrRenewSubscription(id, {
          pricePaid: price,
          method: body?.method === 'PAYSTACK' ? 'PAYSTACK' : 'BANK_TRANSFER',
        })
        sendActiveEmail(price)
        console.log(
          `[memberships] ${adminName} ${action === 'verify' ? 'verified' : 'renewed'} membership ${id} (${sub.user?.email}) at ${price} naira`
        )
        return NextResponse.json({ membership: rowToMembership(updated) })
      } catch (e) {
        console.error('[memberships] activation failed:', e)
        return NextResponse.json({ error: 'Activation failed.' }, { status: 500 })
      }
    }

    case 'reject': {
      await db.subscription.update({
        where: { id },
        data: {
          // Keep PENDING_ACTIVATION but drop the receipt so the member is
          // prompted to re-upload; the portal explains the rejection.
          transferReceipt: null,
        },
      })
      return NextResponse.json({ ok: true })
    }

    case 'cancel': {
      const updated = await db.subscription.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelAtPeriodEnd: false,
          cancelledAt: new Date(),
          cancelledReason:
            typeof body?.reason === 'string' && body.reason.trim()
              ? body.reason.trim().slice(0, 300)
              : `Cancelled by ${adminName}`,
        },
        include: { plan: true },
      })
      return NextResponse.json({ membership: rowToMembership(updated) })
    }

    case 'kit-delivered': {
      const updated = await db.subscription.update({
        where: { id },
        data: { kitState: 'WITH_MEMBER', kitDeliveredAt: new Date() },
        include: { plan: true },
      })
      return NextResponse.json({ membership: rowToMembership(updated) })
    }

    case 'kit-returned':
    case 'kit-replaced': {
      const updated = await db.subscription.update({
        where: { id },
        data: { kitState: action === 'kit-returned' ? 'RETURNED' : 'REPLACED' },
        include: { plan: true },
      })
      return NextResponse.json({ membership: rowToMembership(updated) })
    }

    case 'reset-usage': {
      const updated = await db.subscription.update({
        where: { id },
        data: {
          unitsUsed: 0,
          extraUnitsUsed: 0,
          shoesUsed: 0,
          duvetsUsed: 0,
          curtainsUsed: 0,
          springCleanUsed: 0,
        },
        include: { plan: true },
      })
      return NextResponse.json({ membership: rowToMembership(updated) })
    }

    default:
      return NextResponse.json(
        {
          error: 'Unknown action',
          actions: ['verify', 'reject', 'renew', 'cancel', 'kit-delivered', 'kit-returned', 'kit-replaced', 'reset-usage'],
        },
        { status: 400 }
      )
  }
}
