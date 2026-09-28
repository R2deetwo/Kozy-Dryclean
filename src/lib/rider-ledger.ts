// =============================================================================
// Rider ledger (phase 61) — a rider's completed legs, the honest way
// =============================================================================
// History and earnings both read the same source of truth: StatusEvent rows
// the RIDER THEMSELVES created by swiping (actorId attribution — not
// "orders where driverId = me", which would credit legs another rider
// actually rode after a re-assignment). One entry per (order, leg): a re-swipe
// after a backward move updates the existing entry instead of paying twice.
//
// on-time is measured against the same clocks the ops board runs on
// (order-timing.ts): pickup → the customer's chosen slot; delivery → the
// one-hour delivery-run promise from dispatch.
// =============================================================================

import { db } from '@/lib/db'
import { zoneFromAddress } from '@/lib/geo'
import { pickupSlotWindow, TURNAROUND_DUE_MS } from '@/lib/order-timing'
import { getAppSettings } from '@/lib/app-settings'

// The delivery-run promise (mirrors order-timing's RUN_DUE — kept local
// because that constant is not exported; the value IS the promise).
const RUN_DUE = 60 * 60_000

export interface RiderLeg {
  orderId: string
  orderNumber: string
  leg: 'PICKUP' | 'DELIVERY'
  /** When the rider's swipe completed this leg */
  completedAt: string
  customerName: string
  customerPhone?: string | null
  address: string
  zone: string | null
  /** onTime true/false, or null when the clock can't be reconstructed */
  onTime: boolean | null
  orderStatus: string
  /** Naira earned for this leg (rates set by the office; 0 = unpublished) */
  amount: number
}

/** Monday 00:00 West Africa Time (Lagos, UTC+1) — the payout week boundary. */
export function weekStartWAT(now = new Date()): Date {
  const WAT_OFFSET = 60 // minutes
  const wat = new Date(now.getTime() + WAT_OFFSET * 60_000)
  const day = wat.getUTCDay() // 0=Sun … 1=Mon
  const daysSinceMonday = (day + 6) % 7
  const mondayWat = Date.UTC(wat.getUTCFullYear(), wat.getUTCMonth(), wat.getUTCDate() - daysSinceMonday)
  return new Date(mondayWat - WAT_OFFSET * 60_000)
}

/** Fetch the rider's completed legs (newest first) + published rates. */
export async function getRiderLegs(userId: string, opts?: { limit?: number }): Promise<{
  legs: RiderLeg[]
  rates: { pickup: number; delivery: number; published: boolean }
}> {
  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 200)

  const settings = await getAppSettings().catch(() => null)
  const rates = {
    pickup: settings?.riderPickupRate ?? 0,
    delivery: settings?.riderDeliveryRate ?? 0,
    published: Boolean(settings && (settings.riderPickupRate > 0 || settings.riderDeliveryRate > 0)),
  }

  const events = await db.statusEvent.findMany({
    where: { actorId: userId, status: { in: ['PICKED_UP', 'DELIVERED'] } },
    orderBy: { createdAt: 'desc' },
    take: limit * 2, // headroom for (order, leg) dedupe
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          pickupAddress: true,
          deliveryAddress: true,
          pickupDate: true,
          pickupTimeSlot: true,
          outForDeliveryAt: true,
          serviceSpeed: true,
          user: { select: { name: true, phone: true } },
        },
      },
    },
  })

  // Dedupe (orderId, leg) — keep the LATEST event (a re-swipe after a
  // backward move supersedes the earlier one; no double pay, no ghost leg).
  const seen = new Set<string>()
  const legs: RiderLeg[] = []
  for (const e of events) {
    const key = `${e.orderId}:${e.status}`
    if (seen.has(key)) continue
    seen.add(key)

    const isPickup = e.status === 'PICKED_UP'
    const address = isPickup
      ? e.order.pickupAddress
      : e.order.deliveryAddress || e.order.pickupAddress
    const zone = zoneFromAddress(address)?.name ?? null

    // On-time, on the board's own clocks:
    //  pickup  → swiped before the END of the customer's chosen slot
    //  delivery → swiped within the hour after dispatch left the station
    let onTime: boolean | null = null
    if (isPickup) {
      const { end } = pickupSlotWindow(e.order)
      onTime = e.createdAt.getTime() <= end.getTime() + 10 * 60_000 // 10-min grace for the walk to the gate
    } else if (e.order.outForDeliveryAt) {
      onTime = e.createdAt.getTime() <= e.order.outForDeliveryAt.getTime() + RUN_DUE
    }

    legs.push({
      orderId: e.orderId,
      orderNumber: e.order.orderNumber,
      leg: isPickup ? 'PICKUP' : 'DELIVERY',
      completedAt: e.createdAt.toISOString(),
      customerName: e.order.user?.name ?? 'customer',
      customerPhone: e.order.user?.phone ?? null,
      address,
      zone,
      onTime,
      orderStatus: e.order.status,
      amount: isPickup ? rates.pickup : rates.delivery,
    })
    if (legs.length >= limit) break
  }

  return { legs, rates }
}

/** Roll up the ledger into the payout-week summary the Earnings tab shows. */
export function summarizeLegs(legs: RiderLeg[], rates: { pickup: number; delivery: number }) {
  const weekStart = weekStartWAT()
  let week = 0
  let weekLegs = 0
  let total = 0
  let pickups = 0
  let deliveries = 0
  let onTimeCount = 0
  let timedCount = 0
  for (const l of legs) {
    total += l.amount
    if (new Date(l.completedAt).getTime() >= weekStart.getTime()) {
      week += l.amount
      weekLegs++
    }
    if (l.leg === 'PICKUP') pickups++
    else deliveries++
    if (l.onTime !== null) {
      timedCount++
      if (l.onTime) onTimeCount++
    }
  }
  return {
    week, // naira this payout week
    weekLegs,
    total, // naira all-time (at today's published rates)
    pickups,
    deliveries,
    onTimePct: timedCount > 0 ? Math.round((onTimeCount / timedCount) * 100) : null,
    rates,
  }
}

// =============================================================================
// PAYOUTS (phase 72) — the money side of the ledger
// =============================================================================
// Earnings above are what the rider is OWED (computed live at the office's
// published rates). A payout row is what the office actually SETTLED. The
// rider's pending balance is earned minus paid — the two reconcile by
// construction, so neither the rider screen nor the admin desk can drift
// from the other.
// =============================================================================

export interface PayoutRow {
  id: string
  amount: number
  method: string
  reference: string | null
  note: string | null
  createdAt: string
}

/** All-time earned for a rider at today's published rates — the SAME dedupe
 *  rule the per-leg ledger uses ((order, leg) pairs, latest swipe wins), but
 *  computed over every event rather than a page of them. Used by the admin
 *  payout desk and the balance math; the itemised tab view keeps getRiderLegs. */
export async function getRiderEarnedTotal(
  userId: string,
  rates: { pickup: number; delivery: number }
): Promise<{ earned: number; pickups: number; deliveries: number }> {
  const events = await db.statusEvent.findMany({
    where: { actorId: userId, status: { in: ['PICKED_UP', 'DELIVERED'] } },
    select: { orderId: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  const seen = new Set<string>()
  let pickups = 0
  let deliveries = 0
  for (const e of events) {
    const key = `${e.orderId}:${e.status}`
    if (seen.has(key)) continue
    seen.add(key)
    if (e.status === 'PICKED_UP') pickups++
    else deliveries++
  }
  return {
    earned: pickups * rates.pickup + deliveries * rates.delivery,
    pickups,
    deliveries,
  }
}

/** The money side: payouts actually recorded for a rider, plus the balance
 *  (earned at today's rates minus paid). `pending` can legitimately go
 *  negative if the office settles ahead of the ledger or rates are later
 *  lowered — the desk shows it plainly rather than hiding it. */
export async function getRiderPayoutSummary(
  userId: string,
  rates: { pickup: number; delivery: number },
  opts?: { limit?: number }
): Promise<{
  paidTotal: number
  pending: number
  lastPayoutAt: string | null
  payouts: PayoutRow[]
}> {
  const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 100)
  const { earned } = await getRiderEarnedTotal(userId, rates)
  const [agg, rows] = await Promise.all([
    db.riderPayout.aggregate({
      where: { riderId: userId },
      _sum: { amount: true },
      _max: { createdAt: true },
    }),
    db.riderPayout.findMany({
      where: { riderId: userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, amount: true, method: true, reference: true, note: true, createdAt: true },
    }),
  ])
  const paidTotal = agg._sum.amount ?? 0
  return {
    paidTotal,
    pending: earned - paidTotal,
    lastPayoutAt: agg._max.createdAt?.toISOString() ?? null,
    payouts: rows.map((r) => ({
      id: r.id,
      amount: r.amount,
      method: r.method,
      reference: r.reference,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
    })),
  }
}
