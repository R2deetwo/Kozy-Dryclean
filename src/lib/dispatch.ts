// =============================================================================
// SMART DISPATCH (phase 60) — the assignment brain
// =============================================================================
// The brief: "is there some algorithm behind how this works — something
// others are not likely to get if they try to replicate?"
//
// This module is that algorithm's core. It scores every available rider for
// an order and — crucially — EXPLAINS itself: every point is traceable to a
// human sentence, because a suggestion the owner can't interrogate is a
// suggestion he won't trust. It never assigns on its own; it ranks, it
// reasons, and the owner (or a staff member) makes the call with one click.
//
// The scoring philosophy is the owner's own rule (phase 57): THE PROMISE IS
// THE PRIORITY. Everything is weighed by "can this rider keep the promise
// this customer was given":
//
//   PROXIMITY  (0–35)  — urgency-weighted distance. The distance a rider can
//                        be from the stop and still make it GROWS with the
//                        time left before the slot starts: a pickup in 30
//                        minutes wants a rider within ~3 km; a pickup this
//                        afternoon doesn't care where he is right now. This
//                        is what naive "nearest rider" dispatch gets wrong —
//                        it burns the close rider on the far-future stop.
//   LOAD       (0–25)  — open stops on the rider's route right now. Evenly
//                        spreading work finishes every promise sooner than
//                        stacking one rider while another idles.
//   CORRIDOR   (0–15)  — same-zone stops today. A rider already holding two
//                        Lekki stops collects a third Lekki pickup in the
//                        same pass — batching is the cheapest kilometre in
//                        Lagos logistics.
//   PROMISES   (0–15)  — the rider's on-time record against the SAME tier
//                        clocks the ops board runs (24h/48h/3–5d), dinged by
//                        unresolved incidents. Past behaviour, weighted.
//   TERRAIN    (0–10)  — lifetime share of the rider's deliveries made in
//                        this zone. A rider who has delivered into Lekki
//                        estates seven times knows the gates.
//
// Riders without fresh GPS get a neutral proximity score, never zero — the
// engine is a co-pilot, not a gatekeeper. PAUSED/REVOKED riders never appear.
//
// Pure and isomorphic: no DB, no clock side-effects (take `now` as input) —
// so it is unit-testable and can run on either side of the wire.
// =============================================================================

import { haversineKm } from '@/lib/geo'
import { TURNAROUND_DUE_MS } from '@/lib/order-timing'

// ----- Tunables (the policy, in one place) -----
export const DISPATCH = {
  /** GPS pings older than this count as "no position" (mirrors geo.ts). */
  PING_STALE_MINUTES: 30,
  /** Base km budget when the slot is imminent, plus this many km per hour
   *  of slack, clamped. 3 km now … 15 km for slots ≥ 3h out. */
  PROXIMITY_BASE_KM: 3,
  PROXIMITY_KM_PER_HOUR: 4,
  PROXIMITY_MAX_KM: 15,
  /** Points off per open stop (LOAD). */
  LOAD_COST_PER_STOP: 6,
  /** Open stops at/above which a rider is flagged "at capacity". */
  AT_CAPACITY_STOPS: 5,
  /** Delivered orders before the on-time record counts (else neutral). */
  RELIABILITY_MIN_DELIVERIES: 5,
  /** Points lost per unresolved incident (PROMISES), capped. */
  INCIDENT_PENALTY: 2.5,
  INCIDENT_PENALTY_CAP: 5,
} as const

// ----- Inputs -----

export interface DispatchOrderLeg {
  /** Which leg of the journey this assignment covers. */
  leg: 'PICKUP' | 'DELIVERY'
  /** Zone of the address the rider must reach (null when unmatched). */
  zoneName: string | null
  /** Zone centre coordinates — the proximity target. */
  zoneCenter?: { lat: number; lng: number } | null
  /** When the promise at this stop starts (pickup slot start / now-ish). */
  slotStart?: Date | null
}

export interface RiderFacts {
  id: string
  name: string
  phone: string
  /** Last GPS ping, if any. */
  ping?: { lat: number; lng: number; zone: string | null; at: Date } | null
  /** Open stops on their route right now (pipeline orders). */
  openStops: number
  /** Open stops today whose address is in the SAME zone as this order. */
  sameZoneOpenStops: number
  /** Delivered orders that met the tier promise, and that missed it. */
  onTimeDelivered: number
  lateDelivered: number
  /** Lifetime delivered orders in this zone / in total. */
  zoneDelivered: number
  totalDelivered: number
  /** Unresolved rider incidents. */
  unresolvedIncidents: number
}

// ----- Output -----

export type FactorTone = 'good' | 'neutral' | 'warn'

export interface DispatchFactor {
  /** Machine kind for tests/UI: proximity | load | corridor | promises | terrain */
  kind: string
  /** Short label, e.g. "Distance" */
  label: string
  /** The human sentence — always carries the actual numbers. */
  text: string
  tone: FactorTone
  /** Points earned / maximum for this factor. */
  points: number
  max: number
}

export interface DispatchScore {
  /** 0–100. */
  total: number
  factors: DispatchFactor[]
  /** Non-scoring notes shown under the reasons ("At capacity", "GPS 2h old"). */
  flags: string[]
}

// ----- Helpers -----

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function minutesAgo(at: Date, now: Date): number {
  return Math.max(0, Math.round((now.getTime() - at.getTime()) / 60_000))
}

function hoursUntil(target: Date | null | undefined, now: Date): number {
  if (!target) return DISPATCH.PROXIMITY_MAX_KM / DISPATCH.PROXIMITY_KM_PER_HOUR // ~3.75h neutral
  return Math.max(0, (target.getTime() - now.getTime()) / 3600_000)
}

/** Did a delivered order meet its turnaround tier promise? Same clock the
 *  ops board colours run on (phase 57) — one source of truth for "on time". */
export function metTierPromise(order: {
  serviceSpeed?: string | null
  pickedUpAt?: string | Date | null
  pickupDate: string | Date
  deliveredAt?: string | Date | null
}): boolean {
  if (!order.deliveredAt) return false
  const start = order.pickedUpAt ? new Date(order.pickedUpAt) : new Date(order.pickupDate)
  const due = start.getTime() + TURNAROUND_DUE_MS(order.serviceSpeed ?? 'STANDARD')
  return new Date(order.deliveredAt).getTime() <= due
}

// ----- The engine -----

/**
 * Score one rider for one order leg. Pure: same inputs → same score.
 */
export function scoreRider(
  order: DispatchOrderLeg,
  rider: RiderFacts,
  now: Date = new Date()
): DispatchScore {
  const factors: DispatchFactor[] = []
  const flags: string[] = []
  const zone = order.zoneName ?? 'this area'

  // ---- 1. PROXIMITY (0–35): urgency-weighted distance ----
  {
    const max = 35
    let points: number
    let text: string
    let tone: FactorTone
    const ping = rider.ping
    const stale =
      !ping || now.getTime() - ping.at.getTime() > DISPATCH.PING_STALE_MINUTES * 60_000

    if (!order.zoneCenter) {
      // Unknown zone (address matched nothing) — never punish the rider.
      points = 14
      text = `Address is outside the mapped zones — position not scored`
      tone = 'neutral'
    } else if (stale) {
      points = 14
      text = !ping
        ? 'No GPS ping yet — position unknown'
        : `GPS ${minutesAgo(ping!.at, now)}m old — position unknown`
      tone = 'neutral'
      flags.push(!ping ? 'No GPS yet' : 'GPS is stale')
    } else {
      const hours = hoursUntil(order.slotStart, now)
      const budget = clamp(
        DISPATCH.PROXIMITY_BASE_KM + DISPATCH.PROXIMITY_KM_PER_HOUR * hours,
        DISPATCH.PROXIMITY_BASE_KM,
        DISPATCH.PROXIMITY_MAX_KM
      )
      const km = haversineKm(ping!.lat, ping!.lng, order.zoneCenter.lat, order.zoneCenter.lng)
      if (km <= budget) {
        points = max
        tone = 'good'
      } else {
        points = Math.round(max * Math.max(0, 1 - (km - budget) / budget))
        tone = 'warn'
      }
      text = `${km.toFixed(1)} km from ${zone} — GPS ${minutesAgo(ping!.at, now)}m ago`
      if (km > budget) {
        text += ` (comfortable within ${budget.toFixed(0)} km only for a later slot)`
      }
    }
    factors.push({ kind: 'proximity', label: 'Distance', text, tone, points, max })
  }

  // ---- 2. LOAD (0–25): even the board, finish every promise sooner ----
  {
    const max = 25
    const points = clamp(max - DISPATCH.LOAD_COST_PER_STOP * rider.openStops, 0, max)
    const tone: FactorTone =
      rider.openStops === 0 ? 'good' : rider.openStops >= DISPATCH.AT_CAPACITY_STOPS ? 'warn' : 'neutral'
    const text =
      rider.openStops === 0
        ? 'No open stops — completely free'
        : `${rider.openStops} open stop${rider.openStops === 1 ? '' : 's'} on the route now`
    if (rider.openStops >= DISPATCH.AT_CAPACITY_STOPS) flags.push('At capacity')
    factors.push({ kind: 'load', label: 'Load', text, tone, points, max })
  }

  // ---- 3. CORRIDOR (0–15): batching is the cheapest kilometre ----
  {
    const max = 15
    const n = rider.sameZoneOpenStops
    const points = n === 0 ? 3 : n === 1 ? 9 : max
    const tone: FactorTone = n >= 2 ? 'good' : 'neutral'
    const text =
      n === 0
        ? `No other ${zone} stops today`
        : n === 1
          ? `Already holds 1 ${zone} stop today — easy pairing`
          : `Already holds ${n} ${zone} stops today — natural batching`
    factors.push({ kind: 'corridor', label: 'Corridor', text, tone, points, max })
  }

  // ---- 4. PROMISES (0–15): the rider's own on-time record ----
  {
    const max = 15
    const delivered = rider.onTimeDelivered + rider.lateDelivered
    let points: number
    let text: string
    let tone: FactorTone
    if (delivered < DISPATCH.RELIABILITY_MIN_DELIVERIES) {
      points = 8
      text = delivered === 0 ? 'New rider — no record yet' : `Early days (${delivered} delivered)`
      tone = 'neutral'
    } else {
      const rate = rider.onTimeDelivered / delivered
      const penalty = Math.min(
        DISPATCH.INCIDENT_PENALTY_CAP,
        rider.unresolvedIncidents * DISPATCH.INCIDENT_PENALTY
      )
      points = clamp(Math.round(rate * 10) - Math.round(penalty * 2) / 2, 0, max)
      tone = rate >= 0.85 && rider.unresolvedIncidents === 0 ? 'good' : rate < 0.6 ? 'warn' : 'neutral'
      text = `${rider.onTimeDelivered} of ${delivered} promises kept on time`
      if (rider.unresolvedIncidents > 0) {
        text += ` · ${rider.unresolvedIncidents} unresolved issue${rider.unresolvedIncidents === 1 ? '' : 's'}`
        flags.push('Unresolved incident')
      }
    }
    factors.push({ kind: 'promises', label: 'Promises', text, tone, points, max })
  }

  // ---- 5. TERRAIN (0–10): lifetime share delivered in this zone ----
  {
    const max = 10
    let points: number
    let text: string
    let tone: FactorTone
    if (rider.totalDelivered === 0) {
      points = 5
      text = 'No delivery history yet'
      tone = 'neutral'
    } else {
      const share = rider.zoneDelivered / rider.totalDelivered
      points = Math.round(share * 10)
      tone = share >= 0.5 ? 'good' : 'neutral'
      text =
        rider.zoneDelivered === 0
          ? `Has never delivered in ${zone}`
          : `${rider.zoneDelivered} of ${rider.totalDelivered} lifetime deliveries were in ${zone}`
    }
    factors.push({ kind: 'terrain', label: 'Terrain', text, tone, points, max })
  }

  const total = clamp(
    factors.reduce((s, f) => s + f.points, 0),
    0,
    100
  )
  return { total, factors, flags }
}

/** Human one-liner for the headline of a suggestion card. */
export function scoreHeadline(score: DispatchScore): string {
  if (score.total >= 80) return 'Strong match'
  if (score.total >= 65) return 'Good match'
  if (score.total >= 45) return 'Fair match'
  return 'Thin match'
}

/** Compact "why" for the top line of a card: the 2 strongest reasons. */
export function topReasons(score: DispatchScore, n = 2): string[] {
  return score.factors
    .slice()
    .sort((a, b) => b.points / b.max - a.points / a.max)
    .slice(0, n)
    .map((f) => f.text)
}
