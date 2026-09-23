// =============================================================================
// POST /api/rider-incidents/[id] — resolve an incident (ADMIN, phase 55)
// =============================================================================
// The closing half of the incident pipeline. A rider-reported problem
// arrives (damage / loss / theft / accident), the admins act on it, and the
// OUTCOME is recorded here: what was done for the customer and/or the
// rider. This ledger is what turns "we had an incident" into a real,
// auditable risk-management story — and it is what a serious dispute, an
// insurance question or a police report will want to see.
//
// Body: { resolution: string }  — required, 5–2,000 chars.
// The incident is marked resolved with a timestamp; re-posting updates the
// note (typos happen).
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user?.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Only an admin can resolve rider incidents' },
      { status: 403 }
    )
  }

  const { id } = await params
  const body = await req.json().catch(() => null)
  const resolution: unknown = body?.resolution
  if (typeof resolution !== 'string' || resolution.trim().length < 5) {
    return NextResponse.json(
      { error: 'Record what was done — at least 5 characters.' },
      { status: 400 }
    )
  }
  if (resolution.length > 2000) {
    return NextResponse.json({ error: 'Too long (max 2,000 characters).' }, { status: 400 })
  }

  const incident = await db.riderIncident.findUnique({
    where: { id },
    include: { order: { select: { status: true } } },
  })
  if (!incident) {
    return NextResponse.json({ error: 'Incident not found' }, { status: 404 })
  }

  const updated = await db.riderIncident.update({
    where: { id },
    data: { resolution: resolution.trim(), resolvedAt: new Date() },
  })

  // The order timeline keeps its own copy of the outcome — the audit trail
  // must be readable from the order, not only from this tab. The event
  // carries the order's CURRENT status (this is not a status change).
  await db.statusEvent.create({
    data: {
      orderId: incident.orderId,
      status: incident.order.status,
      note: `Incident resolved: ${resolution.trim().slice(0, 300)}${resolution.length > 300 ? '…' : ''}`,
      actorId: session.user?.id,
    },
  }).catch(() => {/* timeline write must never fail the resolution */})

  return NextResponse.json({ ok: true, incident: updated })
}
