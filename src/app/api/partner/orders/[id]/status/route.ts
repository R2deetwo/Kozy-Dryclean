// =============================================================================
// POST /api/partner/orders/[id]/status — the partner's workflow swipe
// =============================================================================
// The partner advances orders routed to them through the processing window,
// forward-only:
//     PICKED_UP → AT_STATION  ("batch received at our facility")
//     AT_STATION → PROCESSING ("the wash is running")
//     PROCESSING → FINISHING  ("pressed + quality-checked, ready for Kozy's rider")
//
// Guards: the order must belong to THIS partner (fulfilledByPartnerId),
// the partner must be APPROVED, the move must be exactly one step forward,
// and the audit trail gets a StatusEvent with the partner user as the actor
// — the same ledger the admin kanban and customer tracking read, so a
// partner-side move is indistinguishable from an office-side one (that is
// the point: one source of truth).
//
// RBAC: PARTNER only.
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { resolvePartnerForUser, PARTNER_NEXT_STATUS } from '@/lib/partner-ledger'

const TIMESTAMP_FIELD: Record<string, string> = {
  AT_STATION: 'atStationAt',
  PROCESSING: 'processingAt',
  FINISHING: 'finishingAt',
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'PARTNER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const resolved = await resolvePartnerForUser(session.user.id)
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error, suspended: resolved.suspended },
      { status: resolved.status }
    )
  }
  const partner = resolved.partner
  if (partner.status === 'SUSPENDED') {
    return NextResponse.json(
      { error: 'Your partner account is paused — contact the Kozy Care office.' },
      { status: 403 }
    )
  }

  const { id } = await params
  const order = await db.order.findUnique({ where: { id } })
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  if (order.fulfilledByPartnerId !== partner.id) {
    return NextResponse.json({ error: 'This order is not routed to you.' }, { status: 403 })
  }

  const next = PARTNER_NEXT_STATUS[order.status]
  if (!next) {
    return NextResponse.json(
      {
        error:
          order.status === 'FINISHING'
            ? 'This order is finished and waiting for Kozy\u2019s rider — nothing left for you to do.'
            : 'This order is not in your processing window.',
      },
      { status: 409 }
    )
  }

  const now = new Date()
  const data: Record<string, unknown> = { status: next }
  const tsField = TIMESTAMP_FIELD[next]
  if (tsField) {
    data[tsField] = now
  }

  const [updated] = await db.$transaction([
    db.order.update({ where: { id }, data: data as any }),
    db.statusEvent.create({
      data: {
        orderId: id,
        // The actor is the partner's user account — the ledger attributes
        // this move to the facility that actually did the work.
        actorId: session.user.id,
        status: next as any, // PARTNER_NEXT_STATUS values are valid OrderStatus strings
        note: `Partner — ${partner.businessName}`,
      },
    }),
  ])

  return NextResponse.json({
    ok: true,
    order: {
      id: updated.id,
      orderNumber: updated.orderNumber,
      status: updated.status,
      atStationAt: updated.atStationAt?.toISOString() ?? null,
      processingAt: updated.processingAt?.toISOString() ?? null,
      finishingAt: updated.finishingAt?.toISOString() ?? null,
    },
  })
}
