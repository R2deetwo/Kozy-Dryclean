// =============================================================================
// Rider dispatch (phase 69) — SERVER-ONLY. How a new pickup reaches a rider.
// =============================================================================
// The owner's repro: customer books → admin gets the alert → admin pushes the
// order forward → the RIDER sees nothing. Root cause: riders could only see
// orders already assigned to them (driverId = their id), and nothing ever
// assigned new orders automatically. The rider app was a dead end.
//
// Two lanes (the owner's design):
//   FULL-TIME riders  → auto-assigned. At booking, the system picks the
//                       best-placed full-timer and the existing assignment
//                       notifications fire — web push to their phone plus the
//                       WhatsApp job brief (the "rider called her within
//                       minutes" magic, preserved).
//   PART-TIME riders  → broadcast & claim. Orders no full-timer took land in
//                       the Available-now pool every rider can see; the first
//                       to tap Claim wins the stop (race-safe compare-and-set).
//
// Acceptance is measured: assignedAt → acceptedAt is the rider's response
// time, feeding the leaderboard in the rider app and Team → Riders.
//
// Escalation ladder: an order nobody claimed for 5 / 10 / 15 minutes raises
// admin events (checked lazily when the console board loads — the board polls
// every few seconds, so the ladder is near-real-time without a new cron).
//
// NOTE: this module imports web-push (Node built-ins) and Prisma — it must
// NEVER be imported from a client component. The pure isomorphic scoring
// engine lives separately in src/lib/dispatch.ts.
// =============================================================================

import { db } from '@/lib/db'
import { pushToUser } from '@/lib/webpush'
import { sendWhatsApp, assignmentBrief } from '@/lib/whatsapp'
import { haversineKm } from '@/lib/geo'
import { DISPATCH } from '@/lib/dispatch'

/** Pre-pickup states a rider can act on. PAYMENT_VERIFIED means the money
 * is confirmed (card webhook / transfer verified / member-covered / admin
 * moved the board) — that is the ONLY state a rider may roll on.
 * REQUESTED (card payment still pending) and PAYMENT_PENDING_VERIFICATION
 * (transfer awaiting verification) wait for money first. */
export const RIDER_DISPATCH_STATUSES = ['PAYMENT_VERIFIED'] as const

/** The escalation ladder (minutes since booking with no rider attached). */
const ESCALATION_MINUTES = [5, 10, 15] as const

// Throttle: the lazy escalation scan runs at most once a minute per instance.
let lastEscalationScan = 0

// -----------------------------------------------------------------------------
// Rider assignment notification — shared by auto-assign, claim, and the
// console's manual assignment (extracted from the PATCH route, phase 61).
// -----------------------------------------------------------------------------
export async function notifyRiderAssignment(
  order: {
    id: string
    orderNumber: string
    pickupAddress: string
    pickupDate: Date | string
    pickupTimeSlot: string
    status: string
  },
  riderId: string,
  riderPhone?: string | null,
  customerName?: string | null
): Promise<void> {
  const leg: 'PICKUP' | 'DELIVERY' = order.status === 'OUT_FOR_DELIVERY' ? 'DELIVERY' : 'PICKUP'
  const address = order.pickupAddress
  const slot = `${new Date(order.pickupDate).toDateString()} · ${order.pickupTimeSlot}`
  try {
    await pushToUser(riderId, {
      title: `New ${leg === 'PICKUP' ? 'pickup' : 'delivery'} assigned`,
      body: `${customerName ?? 'customer'} — ${address}. Open the app for the 3 steps.`,
      url: '/driver',
      tag: `stop-${order.id}`,
    })
    await sendWhatsApp(
      riderPhone,
      assignmentBrief({
        orderNumber: order.orderNumber,
        leg,
        customerName: customerName ?? undefined,
        address,
        slot,
      })
    )
  } catch (e) {
    console.error('[dispatch] assignment notification failed:', e)
  }
}

// -----------------------------------------------------------------------------
// The available pool a rider sees (first-to-claim lane).
// -----------------------------------------------------------------------------
export async function availableOrdersForDriver(driverBranchId?: string | null) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  return db.order.findMany({
    where: {
      driverId: null,
      status: { in: [...RIDER_DISPATCH_STATUSES] },
      createdAt: { gte: since },
      ...(driverBranchId ? { branchId: driverBranchId } : {}),
    },
    include: {
      user: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: 25,
  })
}

// -----------------------------------------------------------------------------
// Full-time auto-assign: pick the best-placed full-timer for a fresh order.
// Returns the rider that won the compare-and-set, or null (nobody took it
// → the order stays in the broadcast pool).
// -----------------------------------------------------------------------------
async function autoAssignFullTimer(
  orderId: string
): Promise<{ id: string; name: string; phone: string } | null> {
  const drivers = await db.user.findMany({
    where: {
      role: 'DRIVER',
      accessStatus: 'ACTIVE',
      employmentType: 'FULL_TIME',
    },
    select: { id: true, name: true, phone: true, branchId: true },
  })
  if (drivers.length === 0) return null

  // Active load per driver: stops still waiting on them. Load-balances the
  // fleet instead of stacking one rider.
  const active = await db.order.groupBy({
    by: ['driverId'],
    where: {
      driverId: { in: drivers.map((d) => d.id) },
      status: { in: ['REQUESTED', 'PAYMENT_VERIFIED', 'OUT_FOR_DELIVERY'] },
    },
    _count: { _all: true },
  })
  const loadByDriver = new Map(active.map((a) => [a.driverId as string, a._count._all]))

  // Fresh GPS per driver (stale pings don't count — never route by dead data).
  const pings = await db.driverLocation.findMany({
    where: { driverId: { in: drivers.map((d) => d.id) } },
  })
  const pingByDriver = new Map(
    pings
      .filter((p) => Date.now() - p.updatedAt.getTime() < DISPATCH.PING_STALE_MINUTES * 60 * 1000)
      .map((p) => [p.driverId as string, p])
  )

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { branchId: true },
  })

  let best: (typeof drivers)[number] | null = null
  let bestScore = Infinity
  for (const d of drivers) {
    const sameBranch = order?.branchId && d.branchId === order.branchId
    const ping = pingByDriver.get(d.id)
    let distance = 12 // no fresh GPS → assume "far" but not disqualified
    if (ping) {
      distance = haversineKm(ping.lat, ping.lng, 6.45, 3.5)
    }
    const score = (sameBranch ? 0 : 100) + (loadByDriver.get(d.id) ?? 0) * 10 + distance
    if (score < bestScore) {
      bestScore = score
      best = d
    }
  }
  if (!best) return null

  // Compare-and-set: only win if the order is still unclaimed.
  const res = await db.order.updateMany({
    where: { id: orderId, driverId: null },
    data: { driverId: best.id, assignedAt: new Date() },
  })
  if (res.count === 0) return null
  return best
}

// -----------------------------------------------------------------------------
// Broadcast: ping every active rider's devices about a claimable pickup.
// Web push only (WhatsApp is reserved for YOUR assignments — broadcasting to
// a group chat would need a different product decision).
// -----------------------------------------------------------------------------
async function broadcastToRiders(order: {
  id: string
  pickupAddress: string
  pickupTimeSlot: string
}): Promise<void> {
  const drivers = await db.user.findMany({
    where: { role: 'DRIVER', accessStatus: 'ACTIVE' },
    select: { id: true },
  })
  await Promise.all(
    drivers.map((d) =>
      pushToUser(d.id, {
        title: 'New pickup available',
        body: `${order.pickupAddress} · ${order.pickupTimeSlot} — first rider to accept gets it. Open the app.`,
        url: '/driver',
        tag: `available-${order.id}`,
      }).catch(() => 0)
    )
  )
}

// -----------------------------------------------------------------------------
// The entry point: run dispatch for a freshly-created (or just-verified)
// order. Fire-and-forget from POST /api/orders and the PATCH verification —
// a dispatch failure must never fail a booking.
// -----------------------------------------------------------------------------
export async function dispatchNewOrder(order: {
  id: string
  orderNumber: string
  branchId: string | null
  pickupAddress: string
  pickupDate: Date | string
  pickupTimeSlot: string
  status: string
  userId: string
}): Promise<void> {
  try {
    const rider = await autoAssignFullTimer(order.id)
    if (rider) {
      const customer = await db.user.findUnique({
        where: { id: order.userId },
        select: { name: true },
      })
      await notifyRiderAssignment(order, rider.id, rider.phone, customer?.name)
      return
    }
    // No full-timer won it → broadcast pool + device pings.
    await broadcastToRiders(order)
  } catch (e) {
    console.error('[dispatch] dispatchNewOrder failed:', e)
  }
}

// -----------------------------------------------------------------------------
// Escalation ladder — unclaimed pickup-ready orders aging 5 / 10 / 15 minutes.
// Checked lazily on console board loads (throttled to once a minute).
// Each scan FIRST retries full-time auto-assign (an FT rider may have come on
// duty since booking — the system heals itself silently), then raises admin
// events for whatever still has no rider.
// -----------------------------------------------------------------------------
export async function escalateUnclaimedOrders(): Promise<void> {
  if (Date.now() - lastEscalationScan < 60 * 1000) return
  lastEscalationScan = Date.now()
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const unclaimed = await db.order.findMany({
      where: {
        driverId: null,
        status: { in: [...RIDER_DISPATCH_STATUSES] },
        createdAt: { gte: since },
      },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
      take: 50,
    })
    if (unclaimed.length === 0) return

    // Self-heal: retry full-time assignment (silent compare-and-set — no
    // re-broadcast; riders who missed the original ping still see the pool
    // whenever they open the app).
    for (const o of unclaimed) {
      const rider = await autoAssignFullTimer(o.id).catch(() => null)
      if (rider) {
        await notifyRiderAssignment(o, rider.id, rider.phone, o.user?.name).catch(() => {})
      }
    }
    const stillUnclaimed: typeof unclaimed = []
    for (const o of unclaimed) {
      const fresh = await db.order
        .findUnique({ where: { id: o.id }, select: { driverId: true } })
        .catch(() => null)
      if (!fresh?.driverId) stillUnclaimed.push(o)
    }
    if (stillUnclaimed.length === 0) return

    // Dedupe: which order×tier events already exist?
    const existing = await db.notificationEvent.findMany({
      where: { type: { startsWith: 'ORDER_UNCLAIMED_' }, createdAt: { gte: since } },
      select: { type: true, data: true },
    })
    const seen = new Set<string>()
    for (const ev of existing) {
      try {
        const data = JSON.parse(ev.data ?? '{}')
        if (data.orderId) seen.add(`${ev.type}:${data.orderId}`)
      } catch {
        /* ignore malformed rows */
      }
    }

    const now = Date.now()
    for (const o of stillUnclaimed) {
      const ageMin = Math.floor((now - o.createdAt.getTime()) / 60000)
      for (const tier of ESCALATION_MINUTES) {
        if (ageMin < tier) break
        const type = `ORDER_UNCLAIMED_${tier}`
        if (seen.has(`${type}:${o.id}`)) continue
        seen.add(`${type}:${o.id}`)
        const minutes = tier === 5 ? '5 minutes' : tier === 10 ? '10 minutes' : '15 minutes'
        await db.notificationEvent
          .create({
            data: {
              type,
              title: `No rider yet — order #${o.orderNumber} (${minutes})`,
              body:
                `${o.user?.name ?? 'customer'} · ${o.pickupAddress} · booked ${ageMin} min ago. ` +
                `Assign a rider from the board or call the customer directly.`,
              data: JSON.stringify({ orderId: o.id, orderNumber: o.orderNumber, minutes: tier }),
              linkTab: 'kanban',
              recipients: '[]',
              emailStatus: 'NONE',
            },
          })
          .catch(() => {})
      }
    }
  } catch (e) {
    console.error('[dispatch] escalation scan failed:', e)
  }
}
