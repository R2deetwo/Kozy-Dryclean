// =============================================================================
// POST /api/orders/[id]/incident — rider-reported problem (phase 55)
// =============================================================================
// The end-to-end answer to "what if the rider steals, damages or misplaces
// the items?": the moment something goes wrong mid-route, the rider taps
// Report a problem in the rider app and this endpoint makes the incident
// IMMEDIATE, AUDITABLE and VISIBLE:
//   1. a RiderIncident row is stored (kind + description + where),
//   2. a StatusEvent note lands on the order timeline (who, what, when),
//   3. the admins get an urgent alert email + a notifications-feed entry
//      (notifyRiderIncident — never throws, never blocks the response).
//
// RBAC: DRIVER only (staff report through their own channels; a customer
// complaint is the feedback/review pipeline, not this). The reporting rider
// must be the rider ASSIGNED to the order — a rider cannot file incidents
// against a colleague's route.
//
// Deliberately LOW friction: no rate limit beyond a sane per-order cap
// (real incidents are rare; a report must never be blocked by red tape),
// 10–2,000 characters, kind from a fixed set.
// =============================================================================

import { NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { notifyRiderIncident } from '@/lib/notifications'

const KINDS = new Set(['DAMAGE', 'LOSS', 'THEFT', 'ACCIDENT', 'OTHER'])

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = session.user?.role
  if (role !== 'DRIVER') {
    return NextResponse.json(
      { error: 'Incident reports come from the rider app' },
      { status: 403 }
    )
  }

  const { id } = await params

  // Per-order cap (anti-spam only — 10 genuine reports on one order would
  // already be the least of the team's problems).
  const limit = await rateLimit(`order-incident:${id}`, { max: 10, windowMs: 60 * 60 * 1000 })
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Too many reports for this order — call the office.' },
      { status: 429 }
    )
  }

  const body = await req.json().catch(() => null)
  const kind: unknown = body?.kind
  const description: unknown = body?.description
  const atStop: unknown = body?.atStop

  if (typeof kind !== 'string' || !KINDS.has(kind)) {
    return NextResponse.json(
      { error: 'Pick what happened: damaged, lost, theft, accident or other.' },
      { status: 400 }
    )
  }
  if (typeof description !== 'string') {
    return NextResponse.json({ error: 'Describe what happened' }, { status: 400 })
  }
  const text = description.trim().replace(/\s+/g, ' ')
  if (text.length < 10) {
    return NextResponse.json(
      { error: 'A little more detail, please — at least 10 characters.' },
      { status: 400 }
    )
  }
  if (text.length > 2000) {
    return NextResponse.json({ error: 'Too long (max 2,000 characters).' }, { status: 400 })
  }

  const order = await db.order.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      driver: { select: { id: true, name: true, phone: true } },
    },
  })
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // The reporting rider must be the assigned rider.
  if (order.driverId !== session.user?.id) {
    return NextResponse.json(
      { error: 'You can only report problems on orders assigned to you.' },
      { status: 403 }
    )
  }

  const stopLabel =
    typeof atStop === 'string' && atStop.trim()
      ? atStop.trim().slice(0, 120)
      : order.status === 'OUT_FOR_DELIVERY'
        ? 'delivery'
        : 'pickup'

  // 1) The durable record
  const incident = await db.riderIncident.create({
    data: {
      orderId: order.id,
      driverId: session.user!.id!,
      kind,
      description: text,
      atStop: stopLabel,
    },
  })

  // 2) The order timeline entry (auditable — the modal's activity feed)
  const kindLabel: Record<string, string> = {
    DAMAGE: 'Damage reported',
    LOSS: 'Lost / missing item(s)',
    THEFT: 'Theft reported',
    ACCIDENT: 'Accident reported',
    OTHER: 'Problem reported',
  }
  await db.statusEvent.create({
    data: {
      orderId: order.id,
      status: order.status,
      note: `RIDER INCIDENT (${kindLabel[kind] ?? kind}) at ${stopLabel}: ${text.slice(0, 300)}${text.length > 300 ? '…' : ''}`,
      actorId: session.user?.id,
    },
  })

  // 3) The urgent admin alert (email + feed) — after the response so the
  //    rider's app is never slowed by email latency. Never throws.
  const riderName = order.driver?.name || session.user?.name || 'A rider'
  const riderPhone = order.driver?.phone || ''
  after(async () => {
    try {
      await notifyRiderIncident({
        orderNumber: order.orderNumber,
        orderId: order.id,
        riderName,
        riderPhone,
        customerName: order.user?.name ?? 'the customer',
        customerPhone: order.user?.phone ?? '',
        kind,
        description: text,
        atStop: stopLabel,
      })
    } catch (e) {
      console.error('Rider-incident notification failed:', e)
    }
  })

  return NextResponse.json({ ok: true, id: incident.id }, { status: 201 })
}
