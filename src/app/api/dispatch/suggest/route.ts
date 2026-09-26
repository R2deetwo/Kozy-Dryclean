// =============================================================================
// GET /api/dispatch/suggest?orderId=… — the Smart Dispatch suggester (phase 60)
// =============================================================================
// ADMIN + STAFF (assignment is an operational fact — the same RBAC the order
// PATCH uses; PAUSED/REVOKED accounts are filtered out before scoring).
//
// One request gathers every fact the scoring engine (src/lib/dispatch.ts)
// needs, scores every eligible rider for THIS order's next leg, and returns
// a ranked, fully-explained shortlist:
//
//   { order: { leg, zone, slotStart, hoursUntilSlot },
//     context: { zonePickupsToday, unassignedInZoneToday },
//     suggestions: [ { rider, score, factors, flags } ] }
//
// Read-only by construction: it never writes, so it can never notify.
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { zoneFromAddress } from '@/lib/geo'
import { pickupSlotWindow } from '@/lib/order-timing'
import { scoreRider, metTierPromise, RiderFacts, DispatchScore } from '@/lib/dispatch'

// Pipeline statuses a rider is actively holding (mirrors the roster's set).
const ACTIVE_STATUSES = [
  'PAYMENT_VERIFIED',
  'PICKED_UP',
  'AT_STATION',
  'PROCESSING',
  'FINISHING',
  'OUT_FOR_DELIVERY',
] as const

/** The Lagos business day containing `now` (UTC+1, no DST). */
function lagosDayWindow(now: Date): { start: Date; end: Date } {
  const lagos = new Date(now.getTime() + 60 * 60 * 1000)
  lagos.setUTCHours(0, 0, 0, 0)
  const start = new Date(lagos.getTime() - 60 * 60 * 1000)
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) }
}

export async function GET(req: Request) {
  let session: Awaited<ReturnType<typeof requireRole>>
  try {
    session = await requireRole('ADMIN', 'STAFF')
  } catch (e) {
    if (e instanceof Response) {
      return new NextResponse(e.body, { status: e.status, headers: { 'Content-Type': 'application/json' } })
    }
    throw e
  }
  void session

  const { searchParams } = new URL(req.url)
  const orderId = searchParams.get('orderId')
  if (!orderId) {
    return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      driverId: true,
      pickupAddress: true,
      pickupDate: true,
      pickupTimeSlot: true,
      deliveryAddress: true,
      serviceSpeed: true,
    },
  })
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  if (order.driverId) {
    return NextResponse.json(
      { error: 'ALREADY_ASSIGNED', message: 'This order already has a rider. Unassign first to re-suggest.' },
      { status: 409 }
    )
  }

  const now = new Date()

  // ----- Which leg, which zone, which deadline -----
  // A rider holds the order across BOTH legs, so assignment is mostly a
  // pre-pickup decision; but a delivery-leg assignment (OUT_FOR_DELIVERY)
  // targets the drop-off address and the one-hour run urgency.
  const isDeliveryLeg = order.status === 'OUT_FOR_DELIVERY'
  const leg: 'PICKUP' | 'DELIVERY' = isDeliveryLeg ? 'DELIVERY' : 'PICKUP'
  const legAddress = isDeliveryLeg ? order.deliveryAddress ?? order.pickupAddress : order.pickupAddress
  const zone = zoneFromAddress(legAddress)
  const slot = pickupSlotWindow(order)

  // ----- The fleet -----
  const riders = await db.user.findMany({
    where: { role: 'DRIVER', accessStatus: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      phone: true,
      driverLocation: { select: { lat: true, lng: true, zone: true, updatedAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const riderIds = riders.map((r) => r.id)
  const openByRider = new Map<string, { total: number; sameZone: number }>()
  const onTimeByRider = new Map<string, { onTime: number; late: number; zoneDelivered: number; total: number }>()
  const incidentsByRider = new Map<string, number>()

  if (riderIds.length > 0) {
    // Open stops per rider — the route load + corridor facts.
    const [openOrders, deliveredOrders, incidents] = await Promise.all([
      db.order.findMany({
        where: { driverId: { in: riderIds }, status: { in: ACTIVE_STATUSES as any } },
        select: {
          driverId: true,
          status: true,
          pickupAddress: true,
          deliveryAddress: true,
          outForDeliveryAt: true,
        },
      }),
      db.order.findMany({
        where: { driverId: { in: riderIds }, status: 'DELIVERED' },
        select: {
          driverId: true,
          serviceSpeed: true,
          pickedUpAt: true,
          pickupDate: true,
          deliveredAt: true,
          pickupAddress: true,
          deliveryAddress: true,
        },
      }),
      db.riderIncident.groupBy({
        by: ['driverId'],
        where: { driverId: { in: riderIds }, resolvedAt: null },
        _count: { _all: true },
      }),
    ])

    for (const o of openOrders) {
      if (!o.driverId) continue
      const entry = openByRider.get(o.driverId) ?? { total: 0, sameZone: 0 }
      entry.total += 1
      // The address this open stop will next send the rider to.
      const nextAddress =
        o.status === 'OUT_FOR_DELIVERY' ? o.deliveryAddress ?? o.pickupAddress : o.pickupAddress
      if (zone && zoneFromAddress(nextAddress)?.name === zone.name) entry.sameZone += 1
      openByRider.set(o.driverId, entry)
    }

    for (const d of deliveredOrders) {
      if (!d.driverId || !d.deliveredAt) continue
      const entry =
        onTimeByRider.get(d.driverId) ?? { onTime: 0, late: 0, zoneDelivered: 0, total: 0 }
      entry.total += 1
      if (metTierPromise(d)) entry.onTime += 1
      else entry.late += 1
      if (zone) {
        const landedAt = d.deliveryAddress ?? d.pickupAddress
        if (zoneFromAddress(landedAt)?.name === zone.name) entry.zoneDelivered += 1
      }
      onTimeByRider.set(d.driverId, entry)
    }

    for (const g of incidents) incidentsByRider.set(g.driverId, g._count._all)
  }

  // ----- Score every rider -----
  const suggestions = riders
    .map((r) => {
      const open = openByRider.get(r.id) ?? { total: 0, sameZone: 0 }
      const record = onTimeByRider.get(r.id) ?? { onTime: 0, late: 0, zoneDelivered: 0, total: 0 }
      const facts: RiderFacts = {
        id: r.id,
        name: r.name,
        phone: r.phone,
        ping: r.driverLocation
          ? {
              lat: r.driverLocation.lat,
              lng: r.driverLocation.lng,
              zone: r.driverLocation.zone,
              at: r.driverLocation.updatedAt,
            }
          : null,
        openStops: open.total,
        sameZoneOpenStops: open.sameZone,
        onTimeDelivered: record.onTime,
        lateDelivered: record.late,
        zoneDelivered: record.zoneDelivered,
        totalDelivered: record.total,
        unresolvedIncidents: incidentsByRider.get(r.id) ?? 0,
      }
      const score: DispatchScore = scoreRider(
        {
          leg,
          zoneName: zone?.name ?? null,
          zoneCenter: zone ? { lat: zone.lat, lng: zone.lng } : null,
          slotStart: isDeliveryLeg ? now : slot.start,
        },
        facts,
        now
      )
      return {
        rider: { id: r.id, name: r.name, phone: r.phone },
        score: score.total,
        factors: score.factors,
        flags: score.flags,
      }
    })
    .sort((a, b) => b.score - a.score)

  // ----- Zone context: today's load where this stop is -----
  const { start, end } = lagosDayWindow(now)
  const todaysOrders = await db.order.findMany({
    where: {
      pickupDate: { gte: start, lt: end },
      status: { in: [...ACTIVE_STATUSES, 'REQUESTED', 'PAYMENT_PENDING_VERIFICATION'] as any },
    },
    select: { driverId: true, pickupAddress: true },
  })
  const inZone = zone ? todaysOrders.filter((o) => zoneFromAddress(o.pickupAddress)?.name === zone.name) : []
  const zonePickupsToday = inZone.length
  const unassignedInZoneToday = inZone.filter((o) => !o.driverId).length

  return NextResponse.json({
    order: {
      leg,
      zone: zone?.name ?? null,
      slotStart: slot.start.toISOString(),
      hoursUntilSlot: Math.max(
        0,
        Math.round(((isDeliveryLeg ? now.getTime() : slot.start.getTime()) - now.getTime()) / 900_000) / 4
      ),
    },
    context: { zonePickupsToday, unassignedInZoneToday },
    suggestions,
  })
}
