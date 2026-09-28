// =============================================================================
// ORDER PACING (phase 57) — the "staying ahead" clocks for the ops board.
// =============================================================================
// The owner's brief: the board should tell the team AT A GLANCE which orders
// are priority / falling behind and which are on track — softly, not loudly.
//
// Every active order carries one live promise, derived from what the
// CUSTOMER stipulated at booking (no new schema fields needed):
//
//   1. PICKUP clock  (Requested → Ready to pick up)
//        The customer chose a 1-hour pickup slot. The slot STARTING means a
//        rider should be rolling (amber); the slot ENDING un-picked-up means
//        the promise to that customer is broken (rose).
//
//   2. TURNAROUND clock (Picked up → Finishing)
//        The customer paid for a speed tier, and the tier is the promise:
//          Express 24  — back within 24h of pickup   (watch from 18h)
//          Express 48  — back within 48h of pickup   (watch from 36h)
//          Standard    — 3–5 days from pickup        (watch from day 3)
//        For express tiers "watch" is the final quarter of the window; for
//        Standard it is day 3 of the 3–5 day promise — the team should be
//        finishing, not starting, when amber appears.
//
//   3. DELIVERY RUN clock (Out for delivery)
//        The owner's own generous limit: no delivery journey takes more than
//        an hour. Watch at 45 minutes, overdue at 60.
//
// Delivered / Cancelled orders are terminal — no clock, no colour.
//
// Everything is derived client-side from fields the orders API already
// returns (status, serviceSpeed, pickupDate, pickupTimeSlot, pickedUpAt,
// outForDeliveryAt, updatedAt), so pacing lights up on every board with
// zero backend changes and keeps itself honest as the board polls.
// =============================================================================

export type TimingState = 'onTrack' | 'watch' | 'overdue'
export type TimingKind = 'PICKUP' | 'TURNAROUND' | 'DELIVERY_RUN'

export interface OrderTiming {
  state: TimingState
  kind: TimingKind
  /** The moment the promise is broken — rose from here on. */
  dueAt: Date
  /** The moment attention becomes warranted — amber from here on. */
  watchAt: Date
  /** What the clock is measuring, e.g. "Pickup slot", "24h turnaround". */
  clock: string
}

// Status groups for the three clocks.
const PRE_PICKUP = new Set([
  'REQUESTED',
  'PAYMENT_PENDING_VERIFICATION',
  'PAYMENT_VERIFIED',
])
const TURNAROUND = new Set(['PICKED_UP', 'AT_STATION', 'PROCESSING', 'FINISHING'])
const TERMINAL = new Set(['DELIVERED', 'CANCELLED'])

// Turnaround tiers — milliseconds from PICKUP until watch / due.
const HOUR = 3600_000
const DAY = 24 * HOUR
const TURNAROUND_TIERS: Record<string, { watch: number; due: number; clock: string }> = {
  EXPRESS_24: { watch: 18 * HOUR, due: 24 * HOUR, clock: '24h turnaround' },
  EXPRESS_48: { watch: 36 * HOUR, due: 48 * HOUR, clock: '48h turnaround' },
  STANDARD: { watch: 3 * DAY, due: 5 * DAY, clock: '3–5 day turnaround' },
}

// The delivery-run promise (owner: "no journey takes more than an hour,
// to be over generous").
const RUN_WATCH = 45 * 60_000
const RUN_DUE = 60 * 60_000

/** Milliseconds from pickup until the tier's promise is due (phase 60:
 *  shared with the dispatch engine so "on time" means the same thing on
 *  the board and in a rider's reliability score). */
export function TURNAROUND_DUE_MS(serviceSpeed?: string | null): number {
  return (TURNAROUND_TIERS[serviceSpeed ?? 'STANDARD'] ?? TURNAROUND_TIERS.STANDARD).due
}

/** Parse a pickup slot like "09:00 - 10:00" into minutes-from-midnight. */
function parseSlot(slot?: string | null): { start: number; end: number } | null {
  if (!slot) return null
  const m = slot.match(/(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/)
  if (!m) return null
  const start = Number(m[1]) * 60 + Number(m[2])
  const end = Number(m[3]) * 60 + Number(m[4])
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
  return { start, end }
}

function atLocalTime(base: Date, minutesFromMidnight: number): Date {
  const d = new Date(base.getTime())
  d.setHours(Math.floor(minutesFromMidnight / 60), minutesFromMidnight % 60, 0, 0)
  return d
}

/** The customer's chosen slot on the pickup date, as calendar moments
 * (phase 60: the dispatch engine uses the START as its urgency deadline).
 * Falls back to the business day (08:00–17:00) when the slot string is odd. */
export function pickupSlotWindow(order: {
  pickupDate: string | Date
  pickupTimeSlot?: string | null
}): { start: Date; end: Date } {
  const base = new Date(order.pickupDate)
  const slot = parseSlot(order.pickupTimeSlot)
  const startMin = slot?.start ?? 8 * 60
  const endMin = slot?.end ?? 17 * 60
  return { start: atLocalTime(base, startMin), end: atLocalTime(base, endMin) }
}

/** The active promise on an order, or null for terminal orders. */
export function getOrderTiming(
  order: {
    status: string
    serviceSpeed?: string | null
    pickupDate: string | Date
    pickupTimeSlot?: string | null
    pickedUpAt?: string | Date | null
    outForDeliveryAt?: string | Date | null
    updatedAt?: string | Date | null
  },
  now: Date = new Date()
): OrderTiming | null {
  if (TERMINAL.has(order.status)) return null

  // ---- 1. Pre-pickup: the customer's chosen slot is the promise ----
  if (PRE_PICKUP.has(order.status)) {
    const base = new Date(order.pickupDate)
    const slot = parseSlot(order.pickupTimeSlot)
    // Fallback when the slot string is odd: the business day (08:00–17:00).
    const startMin = slot?.start ?? 8 * 60
    const endMin = slot?.end ?? 17 * 60
    const watchAt = atLocalTime(base, startMin)
    const dueAt = atLocalTime(base, endMin)
    return {
      state: stateFor(now, watchAt, dueAt),
      kind: 'PICKUP',
      dueAt,
      watchAt,
      clock: 'Pickup slot',
    }
  }

  // ---- 3. Out for delivery: the one-hour journey promise ----
  if (order.status === 'OUT_FOR_DELIVERY') {
    const start = order.outForDeliveryAt
      ? new Date(order.outForDeliveryAt)
      : new Date(order.updatedAt ?? order.pickupDate)
    const watchAt = new Date(start.getTime() + RUN_WATCH)
    const dueAt = new Date(start.getTime() + RUN_DUE)
    return {
      state: stateFor(now, watchAt, dueAt),
      kind: 'DELIVERY_RUN',
      dueAt,
      watchAt,
      clock: 'Delivery run',
    }
  }

  // ---- 2. Turnaround: the speed tier the customer paid for ----
  if (TURNAROUND.has(order.status)) {
    const start = order.pickedUpAt
      ? new Date(order.pickedUpAt)
      : new Date(order.pickupDate)
    const tier = TURNAROUND_TIERS[order.serviceSpeed ?? 'STANDARD'] ?? TURNAROUND_TIERS.STANDARD
    const watchAt = new Date(start.getTime() + tier.watch)
    const dueAt = new Date(start.getTime() + tier.due)
    return {
      state: stateFor(now, watchAt, dueAt),
      kind: 'TURNAROUND',
      dueAt,
      watchAt,
      clock: tier.clock,
    }
  }

  return null
}

function stateFor(now: Date, watchAt: Date, dueAt: Date): TimingState {
  if (now.getTime() >= dueAt.getTime()) return 'overdue'
  if (now.getTime() >= watchAt.getTime()) return 'watch'
  return 'onTrack'
}

// ---------------------------------------------------------------
// Formatting — small, calm strings for cards, rows and the modal.
// ---------------------------------------------------------------

/** "10:00" today, "Thu 10:00" this week, "12 Mar" further out. */
export function formatDue(due: Date, now: Date = new Date()): string {
  const time = due.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: false })
  const sameDay = due.toDateString() === now.toDateString()
  if (sameDay) return time
  const daysAway = (due.getTime() - now.getTime()) / DAY
  if (daysAway > -7 && daysAway < 7) {
    return `${due.toLocaleDateString('en-NG', { weekday: 'short' })} ${time}`
  }
  return due.toLocaleDateString('en-NG', { day: '2-digit', month: 'short' })
}

/** "45m", "6h", "3h 20m", "2d" — compact durations. */
function formatDuration(ms: number): string {
  const mins = Math.round(ms / 60_000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const rem = mins % 60
  if (hours < 48) return rem > 0 && hours < 10 ? `${hours}h ${rem}m` : `${hours}h`
  return `${Math.round(hours / 24)}d`
}

/** The chip text: "Due in 3h", "40m overdue", "Due Thu 10:00". */
export function pacingText(t: OrderTiming, now: Date = new Date()): string {
  const diff = t.dueAt.getTime() - now.getTime()
  if (diff < 0) return `${formatDuration(-diff)} overdue`
  if (t.state === 'watch') return `Due in ${formatDuration(diff)}`
  return `Due ${formatDue(t.dueAt, now)}`
}

/** Longer sentence for the order modal, e.g.
 *  "Pickup slot · due Thu 10:00 — on track". */
export function pacingSentence(t: OrderTiming, now: Date = new Date()): string {
  const state = t.state === 'onTrack' ? 'on track' : t.state === 'watch' ? 'due soon' : 'overdue'
  return `${t.clock} · due ${formatDue(t.dueAt, now)} — ${state}`
}
