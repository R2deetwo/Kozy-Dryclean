// =============================================================================
// Phase 60 — pure engine unit tests (no server, no DB).
// Run: bun scripts/p60_unit.ts
// Proves the algorithm behaves as designed BEFORE any UI QA.
// =============================================================================
import { scoreRider, metTierPromise, scoreHeadline, RiderFacts, DispatchOrderLeg } from '../src/lib/dispatch'
import { computeCustomerHealth, vipCustomerIds, healthLabel } from '../src/lib/customer-health'
import { TURNAROUND_DUE_MS, pickupSlotWindow } from '../src/lib/order-timing'

let pass = 0
let fail = 0
function ok(name: string, cond: boolean) {
  if (cond) pass++
  else {
    fail++
    console.error(`  FAIL: ${name}`)
  }
}

const NOW = new Date('2026-09-25T12:00:00+01:00')
const LEKKI = { lat: 6.4392, lng: 3.4712 }

// ---------- metTierPromise ----------
ok(
  'express-24 delivered within 24h = on time',
  metTierPromise({ serviceSpeed: 'EXPRESS_24', pickedUpAt: '2026-09-24T10:00:00+01:00', pickupDate: '2026-09-24T10:00:00+01:00', deliveredAt: '2026-09-25T09:00:00+01:00' })
)
ok(
  'express-24 delivered after 24h = late',
  !metTierPromise({ serviceSpeed: 'EXPRESS_24', pickedUpAt: '2026-09-24T10:00:00+01:00', pickupDate: '2026-09-24T10:00:00+01:00', deliveredAt: '2026-09-25T11:00:00+01:00' })
)
ok('standard due = 5 days', TURNAROUND_DUE_MS('STANDARD') === 5 * 24 * 3600_000)
ok('express-48 due = 48h', TURNAROUND_DUE_MS('EXPRESS_48') === 48 * 3600_000)
ok('unknown tier falls back to standard', TURNAROUND_DUE_MS('WHATEVER') === 5 * 24 * 3600_000)
const win = pickupSlotWindow({ pickupDate: '2026-09-25T00:00:00+01:00', pickupTimeSlot: '09:00 - 10:00' })
ok('slot window start 09:00', win.start.getHours() === 9)
ok('slot window end 10:00', win.end.getHours() === 10)
const winFallback = pickupSlotWindow({ pickupDate: '2026-09-25T00:00:00+01:00', pickupTimeSlot: 'whenever' })
ok('odd slot falls back to business day 08:00', winFallback.start.getHours() === 8)

// ---------- scoreRider ----------
const baseFacts: RiderFacts = {
  id: 'r1', name: 'Rider One', phone: '0803 000 0001',
  ping: { lat: 6.4392, lng: 3.4712, zone: 'Lekki', at: NOW }, // exactly at zone centre
  openStops: 0, sameZoneOpenStops: 0,
  onTimeDelivered: 9, lateDelivered: 1, zoneDelivered: 7, totalDelivered: 12,
  unresolvedIncidents: 0,
}
const lekkiSoon: DispatchOrderLeg = { leg: 'PICKUP', zoneName: 'Lekki', zoneCenter: LEKKI, slotStart: new Date(NOW.getTime() + 30 * 60_000) }
const lekkiLater: DispatchOrderLeg = { leg: 'PICKUP', zoneName: 'Lekki', zoneCenter: LEKKI, slotStart: new Date(NOW.getTime() + 4 * 3600_000) }

const s1 = scoreRider(lekkiSoon, baseFacts, NOW)
ok('perfect rider scores high (35+25+3+9+6=78)', s1.total >= 75)
ok('proximity full for in-zone rider', s1.factors[0].points === 35)
ok('promises factor reflects 9/10', s1.factors.find((f) => f.kind === 'promises')!.text.includes('9 of 10'))
ok('terrain factor reflects 7 of 12', s1.factors.find((f) => f.kind === 'terrain')!.text.includes('7 of 12'))
ok('headline good match at 78', scoreHeadline(s1) === 'Good match')

// Urgency-weighted proximity: a rider 10 km away is punished for a 30-min
// slot but fine for a 4-hour slot.
const farFacts: RiderFacts = { ...baseFacts, ping: { lat: 6.52, lng: 3.58, zone: 'Ajah', at: NOW } }
const farSoon = scoreRider(lekkiSoon, farFacts, NOW)
const farLater = scoreRider(lekkiLater, farFacts, NOW)
const farSoonProx = farSoon.factors[0].points
const farLaterProx = farLater.factors[0].points
ok(`far rider punished for imminent slot (${farSoonProx} < 20)`, farSoonProx < 20)
ok(`far rider fine for later slot (${farLaterProx} >= 25)`, farLaterProx >= 25)

// Load + corridor
const busyFacts: RiderFacts = { ...baseFacts, openStops: 5, sameZoneOpenStops: 2 }
const sBusy = scoreRider(lekkiSoon, busyFacts, NOW)
ok('busy rider load factor zeroed', sBusy.factors.find((f) => f.kind === 'load')!.points === 0)
ok('busy rider flagged at capacity', sBusy.flags.includes('At capacity'))
ok('corridor batching bonus full', sBusy.factors.find((f) => f.kind === 'corridor')!.points === 15)

// No GPS — neutral, not buried
const noGpsFacts: RiderFacts = { ...baseFacts, ping: null }
const sNoGps = scoreRider(lekkiSoon, noGpsFacts, NOW)
ok('no GPS = neutral proximity', sNoGps.factors[0].points === 14)
ok('no GPS flag present', sNoGps.flags.some((f) => f.includes('GPS')))

// Stale GPS
const staleFacts: RiderFacts = { ...baseFacts, ping: { lat: 6.4392, lng: 3.4712, zone: 'Lekki', at: new Date(NOW.getTime() - 2 * 3600_000) } }
const sStale = scoreRider(lekkiSoon, staleFacts, NOW)
ok('stale GPS scored neutrally', sStale.factors[0].points === 14)
ok('stale GPS flagged', sStale.flags.includes('GPS is stale'))

// New rider — neutral promises
const newFacts: RiderFacts = { ...baseFacts, onTimeDelivered: 0, lateDelivered: 0, zoneDelivered: 0, totalDelivered: 0 }
const sNew = scoreRider(lekkiSoon, newFacts, NOW)
ok('new rider promises neutral', sNew.factors.find((f) => f.kind === 'promises')!.text.includes('New rider'))

// Incidents dent the score
const incidentFacts: RiderFacts = { ...baseFacts, unresolvedIncidents: 3 }
const sInc = scoreRider(lekkiSoon, incidentFacts, NOW)
const sClean = scoreRider(lekkiSoon, baseFacts, NOW)
ok('incidents lower the score', sInc.total < sClean.total)
ok('unresolved incident flag', sInc.flags.includes('Unresolved incident'))

// Unknown zone — never punish
const sUnknown = scoreRider({ leg: 'PICKUP', zoneName: null, zoneCenter: null, slotStart: new Date(NOW.getTime() + 30 * 60_000) }, baseFacts, NOW)
ok('unknown zone neutral proximity', sUnknown.factors[0].points === 14)

// Ranking sanity: the fresh, free, batched Lekki rider outranks the loaded,
// far, incident-carrying one for an imminent Lekki pickup.
const worseFacts: RiderFacts = { ...farFacts, openStops: 5, sameZoneOpenStops: 0, unresolvedIncidents: 2, onTimeDelivered: 2, lateDelivered: 8 }
const sWorse = scoreRider(lekkiSoon, worseFacts, NOW)
ok(`ranking: ${s1.total} > ${sWorse.total}`, s1.total > sWorse.total)

// ---------- computeCustomerHealth ----------
const d = (iso: string) => new Date(iso)
// Loyal: orders every ~7 days, last 5 days ago (ratio 0.7)
const loyalOrders = [1, 2, 3, 4, 5].flatMap((w) => [
  { status: 'DELIVERED', totalPrice: 9000, deliveredAt: d(`2026-08-${String(20 + w * 1).padStart(2, '0')}T10:00:00+01:00`), createdAt: d(`2026-08-${String(20 + w * 1).padStart(2, '0')}T10:00:00+01:00`) },
])
// build a clean 7-day cadence over 5 weeks
const loyalOrders2 = [0, 1, 2, 3, 4].map((i) => ({
  status: 'DELIVERED', totalPrice: 9000,
  deliveredAt: new Date(NOW.getTime() - (5 + i * 7) * 24 * 3600_000),
  createdAt: new Date(NOW.getTime() - (5 + i * 7) * 24 * 3600_000),
}))
const loyal = computeCustomerHealth(loyalOrders2, NOW)
ok('loyal status', loyal.status === 'loyal')
ok('loyal cadence ~7d', loyal.cadenceDays === 7)
ok('loyal low risk', (loyal.churnRisk ?? 0) <= 15)
ok('loyal sentence mentions rhythm', loyal.sentence.includes('usually every 7'))
ok('loyal ltv 45000', loyal.ltv === 45000)
ok('loyal aov 9000', loyal.aov === 9000)

// Cooling: same 7-day rhythm, last order 10 days ago (ratio 10/7 ≈ 1.43)
const coolingOrders = [0, 1, 2, 3].map((i) => ({
  status: 'DELIVERED', totalPrice: 9000,
  deliveredAt: new Date(NOW.getTime() - (10 + i * 7) * 24 * 3600_000),
  createdAt: new Date(NOW.getTime() - (10 + i * 7) * 24 * 3600_000),
}))
const cooling = computeCustomerHealth(coolingOrders, NOW)
ok('cooling status', cooling.status === 'cooling')
ok('cooling mid risk', (cooling.churnRisk ?? 0) > 15 && (cooling.churnRisk ?? 0) < 45)

// At risk: 7-day rhythm, last order 20 days ago (ratio ~2.9)
const atriskOrders = [0, 1, 2, 3].map((i) => ({
  status: 'DELIVERED', totalPrice: 9000,
  deliveredAt: new Date(NOW.getTime() - (20 + i * 7) * 24 * 3600_000),
  createdAt: new Date(NOW.getTime() - (20 + i * 7) * 24 * 3600_000),
}))
const atrisk = computeCustomerHealth(atriskOrders, NOW)
ok('atrisk status', atrisk.status === 'atrisk')
ok('atrisk high risk', (atrisk.churnRisk ?? 0) >= 80)
ok('atrisk sentence says slipping', atrisk.sentence.includes('Slipping'))

// New: one order only
const fresh = computeCustomerHealth([{ status: 'DELIVERED', totalPrice: 12000, deliveredAt: d('2026-09-20T10:00:00+01:00'), createdAt: d('2026-09-20T10:00:00+01:00') }], NOW)
ok('one order = new', fresh.status === 'new')
ok('new has no churn risk', fresh.churnRisk === null)

// Zero orders
const empty = computeCustomerHealth([], NOW)
ok('no orders = new', empty.status === 'new')
ok('no orders null lastDelivered', empty.lastDeliveredAt === null)

// Non-delivered orders do not count
const pending = computeCustomerHealth([{ status: 'PROCESSING', totalPrice: 12000, deliveredAt: null, createdAt: NOW }], NOW)
ok('processing order not counted', pending.deliveredCount === 0)

// ---------- VIP cohort ----------
const cohort = [
  { id: 'a', health: computeCustomerHealth([{ status: 'DELIVERED', totalPrice: 500000, deliveredAt: NOW, createdAt: NOW }, { status: 'DELIVERED', totalPrice: 400000, deliveredAt: NOW, createdAt: NOW }, { status: 'DELIVERED', totalPrice: 100000, deliveredAt: NOW, createdAt: NOW }], NOW) },
  { id: 'b', health: computeCustomerHealth([{ status: 'DELIVERED', totalPrice: 5000, deliveredAt: NOW, createdAt: NOW }, { status: 'DELIVERED', totalPrice: 4000, deliveredAt: NOW, createdAt: NOW }, { status: 'DELIVERED', totalPrice: 1000, deliveredAt: NOW, createdAt: NOW }], NOW) },
  { id: 'c', health: computeCustomerHealth([{ status: 'DELIVERED', totalPrice: 9000000, deliveredAt: NOW, createdAt: NOW }, { status: 'DELIVERED', totalPrice: 8000000, deliveredAt: NOW, createdAt: NOW }, { status: 'DELIVERED', totalPrice: 7000000, deliveredAt: NOW, createdAt: NOW }], NOW) },
]
const vips = vipCustomerIds(cohort)
ok('vip = top decile (1 of 3 → the big spender)', vips.has('c') && vips.size === 1)

// ---------- labels ----------
ok('label loyal', healthLabel('loyal').label === 'On rhythm')
ok('label cooling', healthLabel('cooling').label === 'Going quiet')
ok('label atrisk', healthLabel('atrisk').label === 'At risk')

console.log(`\nUnit engine tests: ${pass} pass, ${fail} fail`)
process.exit(fail > 0 ? 1 : 0)
