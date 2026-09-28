// =============================================================================
// GET /api/partner/overview — the partner portal's working screen
// =============================================================================
// The partner's whole world in one call: their network record (status, share
// %, branch), the orders currently routed to them (the processing pipeline:
// picked-up → at station → washing → finishing), recent completed ones, and
// a compact stats block (active count, finished this month, next action).
// PII discipline: the partner gets the customer's first name, the item
// manifest and care notes — NOT addresses or phone numbers (those are the
// riders' legs, and customer contact stays with the office).
//
// RBAC: PARTNER only, resolved to their linked partner record.
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { resolvePartnerForUser, PARTNER_PIPELINE, monthStartWAT } from '@/lib/partner-ledger'

export async function GET() {
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

  try {
    const monthStart = monthStartWAT()

    // The active pipeline — orders routed to this partner that are between
    // the rider's pickup and Kozy's dispatch back out.
    const [active, recentDone, finishedThisMonth] = await Promise.all([
      db.order.findMany({
        where: {
          fulfilledByPartnerId: partner.id,
          status: { in: [...PARTNER_PIPELINE] },
        },
        orderBy: { pickedUpAt: 'asc' },
        take: 50,
        select: selectForPortal(),
      }),
      db.order.findMany({
        where: {
          fulfilledByPartnerId: partner.id,
          status: { in: ['OUT_FOR_DELIVERY', 'DELIVERED'] },
        },
        orderBy: { deliveredAt: 'desc' },
        take: 15,
        select: selectForPortal(),
      }),
      db.order.count({
        where: {
          fulfilledByPartnerId: partner.id,
          status: 'DELIVERED',
          deliveredAt: { gte: monthStart },
        },
      }),
    ])

    return NextResponse.json({
      partner,
      stats: {
        active: active.length,
        awaitingReceipt: active.filter((o) => o.status === 'PICKED_UP').length,
        finishedThisMonth,
      },
      active: active.map(shapeOrder),
      recentDone: recentDone.map(shapeOrder),
    })
  } catch (e) {
    console.error('[partner/overview] failed:', e)
    return NextResponse.json({ error: 'Could not load your overview' }, { status: 500 })
  }
}

function selectForPortal() {
  return {
    id: true,
    orderNumber: true,
    status: true,
    type: true,
    serviceSpeed: true,
    modeOfWash: true,
    itemsManifest: true,
    alterationNotes: true,
    finalWeight: true,
    totalPrice: true,
    pickupDate: true,
    pickedUpAt: true,
    atStationAt: true,
    processingAt: true,
    finishingAt: true,
    deliveredAt: true,
    outForDeliveryAt: true,
    user: { select: { name: true } },
  }
}

function shapeOrder(o: any) {
  let items: { name: string; quantity: number }[] = []
  let itemCount = 0
  try {
    const parsed = o.itemsManifest ? JSON.parse(o.itemsManifest) : []
    if (Array.isArray(parsed)) {
      items = parsed
        .map((i: any) => ({ name: String(i?.name ?? 'item'), quantity: Number(i?.quantity ?? 1) }))
        .slice(0, 12)
      itemCount = parsed.reduce((s: number, i: any) => s + Number(i?.quantity ?? 1), 0)
    }
  } catch {
    /* manifest not JSON — fall back to weight */
  }
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    type: o.type,
    serviceSpeed: o.serviceSpeed,
    modeOfWash: o.modeOfWash,
    itemCount,
    items,
    finalWeight: o.finalWeight,
    alterationNotes: o.alterationNotes,
    pickupDate: o.pickupDate?.toISOString() ?? null,
    pickedUpAt: o.pickedUpAt?.toISOString() ?? null,
    atStationAt: o.atStationAt?.toISOString() ?? null,
    processingAt: o.processingAt?.toISOString() ?? null,
    finishingAt: o.finishingAt?.toISOString() ?? null,
    outForDeliveryAt: o.outForDeliveryAt?.toISOString() ?? null,
    deliveredAt: o.deliveredAt?.toISOString() ?? null,
    customerName: o.user?.name ?? 'customer',
  }
}
