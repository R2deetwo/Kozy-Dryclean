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
import { zoneFromAddress, haversineKm, type ServiceZone } from '@/lib/geo'
import { pickupSlotWindow, TURNAROUND_DUE_MS } from '@/lib/order-timing'
import { getAppSettings } from '@/lib/app-settings'
import { getBranches } from '@/lib/branches'
import type { KozyAppSettings } from '@/lib/types'

// The delivery-run promise (mirrors order-timing's RUN_DUE — kept local
// because that constant is not exported; the value IS the promise).
const RUN_DUE = 60 * 60_000

// Distance pay uses straight-line km × this factor — Lagos roads wind, so
// the crow-flies number under-pays the actual ride. 1.3 is the usual
// road-network approximation for the island/mainland corridors.
const ROAD_FACTOR = 1.3

const round1 = (n: number) => Math.round(n * 10) / 10

/** The office's full rider-rate card (phase 73) — base per stop PLUS the
 *  distance top-up terms. One shape so the rider screen, the payout desk
 *  and the application roster can never disagree about what a leg pays. */
export interface RiderRates {
  pickup: number
  delivery: number
  /** ₦ per whole km beyond freeKm (0 disables distance pay entirely). */
  perKm: number
  /** Kilometres included in the base rate before the top-up starts. */
  freeKm: number
  /** Maximum ₦ of distance top-up per leg (payroll safety). */
  cap: number
  published: boolean
}

/** Build the rate card from DB settings — the single rates constructor. */
export function riderRatesFromSettings(settings: KozyAppSettings | null): RiderRates {
  const pickup = settings?.riderPickupRate ?? 0
  const delivery = settings?.riderDeliveryRate ?? 0
  return {
    pickup,
    delivery,
    perKm: settings?.riderPerKmRate ?? 0,
    freeKm: settings?.riderFreeKm ?? 0,
    cap: settings?.riderDistanceCap ?? 0,
    published: Boolean(settings && (pickup > 0 || delivery > 0)),
  }
}

/** Distance from the order's branch to the stop's zone centre (km, road
 *  factor applied, 0.1 precision). null = unknowable (no branch link or
 *  no zone match) → the leg pays base only; never blocks pay. */
function stopDistanceKm(
  branch: { lat: number; lng: number } | null,
  zone: ServiceZone | null
): number | null {
  if (!branch || !zone) return null
  return round1(haversineKm(branch.lat, branch.lng, zone.lat, zone.lng) * ROAD_FACTOR)
}

/** Branch coordinates keyed by branch id — the lookup the scalar Order.branchId
 *  resolves through (branchId is deliberately not a foreign key). */
export interface BranchCoords {
  id: string
  name: string
  lat: number
  lng: number
}

export async function branchCoordsMap(): Promise<Map<string, BranchCoords>> {
  try {
    const branches = await getBranches()
    return new Map(
      branches.map((b) => [b.id, { id: b.id, name: b.name, lat: b.lat, lng: b.lng }])
    )
  } catch {
    return new Map()
  }
}

/** Price one leg at the published rates: base + per-km top-up beyond the
 *  free kilometres, capped. Whole naira — the ledger never shows kobo. */
export function legPay(
  base: number,
  rates: Pick<RiderRates, 'perKm' | 'freeKm' | 'cap'>,
  distanceKm: number | null
): { amount: number; distancePay: number } {
  if (base <= 0) return { amount: 0, distancePay: 0 }
  if (distanceKm === null || rates.perKm <= 0) return { amount: base, distancePay: 0 }
  const billableKm = Math.max(0, Math.ceil(distanceKm - rates.freeKm))
  const amount = Math.round(base + Math.min(rates.cap, billableKm * rates.perKm))
  return { amount, distancePay: amount - base }
}

/** Price a single leg from raw order fields — the ONE pricing path shared by
 *  the rider's ledger, the earned-total balance math and the admin roster,
 *  so no surface can ever price a leg differently from another. */
export function priceLeg(
  order: {
    pickupAddress: string
    deliveryAddress?: string | null
    branchId?: string | null
  },
  status: 'PICKED_UP' | 'DELIVERED',
  rates: RiderRates,
  branches?: Map<string, BranchCoords>
): {
  address: string
  zoneName: string | null
  branchName: string | null
  distanceKm: number | null
  amount: number
  distancePay: number
} {
  const isPickup = status === 'PICKED_UP'
  const address = isPickup
    ? order.pickupAddress
    : order.deliveryAddress || order.pickupAddress
  const zone = zoneFromAddress(address) ?? null
  const branch = order.branchId ? branches?.get(order.branchId) ?? null : null
  const distanceKm = stopDistanceKm(branch, zone)
  const { amount, distancePay } = legPay(
    isPickup ? rates.pickup : rates.delivery,
    rates,
    distanceKm
  )
  return {
    address,
    zoneName: zone?.name ?? null,
    branchName: branch?.name ?? null,
    distanceKm,
    amount,
    distancePay,
  }
}

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
  /** Branch → stop-zone distance in km (road factor applied), or null when
   *  it can't be reconstructed — that leg pays the base rate only. */
  distanceKm: number | null
  /** Naira earned for this leg at today's published rates (base + distance). */
  amount: number
  /** The distance component of `amount` (0 when within the free km). */
  distancePay: number
  /** onTime true/false, or null when the clock can't be reconstructed */
  onTime: boolean | null
  orderStatus: string
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
  rates: RiderRates
}> {
  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 200)

  const settings = await getAppSettings().catch(() => null)
  const rates = riderRatesFromSettings(settings)
  const branches = await branchCoordsMap()

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
          branchId: true,
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
    const priced = priceLeg(e.order, e.status as "PICKED_UP" | "DELIVERED", rates, branches)

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
      address: priced.address,
      zone: priced.zoneName,
      distanceKm: priced.distanceKm,
      amount: priced.amount,
      distancePay: priced.distancePay,
      onTime,
      orderStatus: e.order.status,
    })
    if (legs.length >= limit) break
  }

  return { legs, rates }
}

/** Roll up the ledger into the payout-week summary the Earnings tab shows. */
export function summarizeLegs(legs: RiderLeg[], rates: RiderRates) {
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
 *  rule the per-leg ledger uses ((order, leg) pairs, latest swipe wins), and
 *  the SAME distance math (branch → stop zone, road factor, capped top-up),
 *  so the balance can never drift from the itemised ledger. Used by the
 *  admin payout desk and the balance math; the itemised tab view keeps
 *  getRiderLegs. */
export async function getRiderEarnedTotal(
  userId: string,
  rates: RiderRates
): Promise<{ earned: number; pickups: number; deliveries: number }> {
  const events = await db.statusEvent.findMany({
    where: { actorId: userId, status: { in: ['PICKED_UP', 'DELIVERED'] } },
    select: {
      orderId: true,
      status: true,
      createdAt: true,
      order: {
        select: {
          pickupAddress: true,
          deliveryAddress: true,
          branchId: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  const branches = await branchCoordsMap()
  const seen = new Set<string>()
  let earned = 0
  let pickups = 0
  let deliveries = 0
  for (const e of events) {
    const key = `${e.orderId}:${e.status}`
    if (seen.has(key)) continue
    seen.add(key)
    const priced = priceLeg(e.order, e.status as "PICKED_UP" | "DELIVERED", rates, branches)
    earned += priced.amount
    if (e.status === 'PICKED_UP') pickups++
    else deliveries++
  }
  return { earned, pickups, deliveries }
}

/** The money side: payouts actually recorded for a rider, plus the balance
 *  (earned at today's rates minus paid). `pending` can legitimately go
 *  negative if the office settles ahead of the ledger or rates are later
 *  lowered — the desk shows it plainly rather than hiding it. */
export async function getRiderPayoutSummary(
  userId: string,
  rates: RiderRates,
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
