// =============================================================================
// POST /api/rider-applications — public submission (rate-limited)
// GET  /api/rider-applications — admin-only: the full onboarding pipeline
// =============================================================================
// Phase 54: applications are no longer a dead-end inbox row.
//   POST — assigns a short reference code (KZR-XXXX), stores the
//          application, alerts the admins (unchanged) AND now confirms to
//          the applicant: email when they gave one + SMS always, with the
//          reference and the 48-hour review-call promise.
//   GET  — applications (with the linked rider account where approved)
//          PLUS the rider roster: every DRIVER account with live delivery
//          stats, so the owner sees the pipeline AND the fleet health in
//          one view.
// =============================================================================

import { NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit, getClientIP } from '@/lib/rate-limit'
import { requireRole } from '@/lib/auth'
import { isValidNigerianMobile } from '@/lib/phone-validation'
import { getAppSettings } from '@/lib/app-settings'
import {
  notifyAdminRiderApplication,
  notifyRiderApplicationReceived,
} from '@/lib/notifications'

/** Short application reference like KZR-7F2K (4 alphanumeric chars, no
 *  ambiguous glyphs). Uniqueness is enforced by the schema; a collision
 *  retries with a fresh code. */
function mintRefCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return `KZR-${code}`
}

export async function POST(req: Request) {
  const ip = getClientIP(req)
  const limit = await rateLimit(`rider-app:${ip}`, { max: 3, windowMs: 60 * 60 * 1000 })
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many applications. Please try again later.' }, { status: 429 })
  }

  const body = await req.json()
  const { fullName, email, phone, altPhone, address, lga, bikeModel, bikeYear, licenseNumber, availability, experience, consent } = body

  if (!fullName || !phone || !address || !lga || !bikeModel || !bikeYear || !licenseNumber) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (consent !== true) {
    return NextResponse.json({ error: 'Contract consent is required' }, { status: 400 })
  }

  // ----- Phase 55: server-side field validation (mirrors the form's checks) -----
  // The form now validates before submitting, but the API is public — a
  // hand-rolled POST used to store any garbage ("it was really nice, i
  // enjoyed it" as experience, "nice" as a phone). Every required field
  // gets the same strict shape here so the review queue only ever holds
  // actionable applications.
  const bad = (field: string, error: string) =>
    NextResponse.json({ error, field }, { status: 400 })
  if (typeof fullName !== 'string' || !/^[A-Za-z][A-Za-z .'-]{2,}$/.test(fullName.trim())) {
    return bad('fullName', 'Full name should be your name as on your licence (letters only).')
  }
  if (typeof phone !== 'string' || !isValidNigerianMobile(phone)) {
    return bad('phone', 'Phone number must be a Nigerian mobile — e.g. 0803 222 4455 or +234 803 222 4455.')
  }
  if (altPhone && (typeof altPhone !== 'string' || !isValidNigerianMobile(altPhone))) {
    return bad('altPhone', 'Emergency contact must be a Nigerian mobile number (not your own number).')
  }
  if (typeof address !== 'string' || address.trim().length < 6) {
    return bad('address', 'Home address is too short to find you — include a street and area.')
  }
  if (typeof lga !== 'string' || lga.trim().length < 2) {
    return bad('lga', 'Tell us the Lagos area you want to ride in.')
  }
  if (typeof bikeModel !== 'string' || bikeModel.trim().length < 2) {
    return bad('bikeModel', 'Motorcycle model is required (e.g. Bajaj Boxer).')
  }
  const yearNum = parseInt(String(bikeYear), 10)
  if (!/^(19|20)\d{2}$/.test(String(bikeYear)) || yearNum < 1990 || yearNum > new Date().getFullYear() + 1) {
    return bad('bikeYear', 'Motorcycle year must be between 1990 and next year.')
  }
  if (typeof licenseNumber !== 'string' || licenseNumber.trim().length < 5) {
    return bad('licenseNumber', 'Licence number looks too short — enter it as printed on the card.')
  }
  const availabilityOk = ['full-time', 'part-time', 'weekends']
  const availabilityValue = availabilityOk.includes(availability) ? availability : 'full-time'

  const cleanEmail =
    typeof email === 'string' && email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      ? email.trim().toLowerCase()
      : null

  // Mint a collision-free reference code (practically never loops twice).
  let refCode = mintRefCode()
  for (let attempt = 0; attempt < 5; attempt++) {
    const clash = await db.riderApplication.findUnique({ where: { refCode } })
    if (!clash) break
    refCode = mintRefCode()
  }

  const application = await db.riderApplication.create({
    data: {
      refCode,
      fullName: fullName.trim(), email: cleanEmail, phone: phone.trim(), altPhone: altPhone?.trim() || null,
      address: address.trim(), lga: lga.trim(), bikeModel: bikeModel.trim(), bikeYear: String(bikeYear).trim(), licenseNumber: licenseNumber.trim(),
      availability: availabilityValue,
      experience: experience || null,
      consent: !!consent,
    },
  })

  // Never blocks the response:
  //   1. the applicant gets their confirmation (email + SMS) immediately —
  //      phase 54: "apply → know it landed → know what happens next";
  //   2. the admins get the existing alert (unchanged behaviour).
  after(async () => {
    try {
      await notifyRiderApplicationReceived({
        fullName: application.fullName,
        email: application.email,
        phone: application.phone,
        lga: application.lga,
        refCode: application.refCode ?? 'KZR',
      })
    } catch (e) {
      console.error('Rider-application confirmation failed:', e)
    }
    try {
      await notifyAdminRiderApplication(application)
    } catch (e) {
      console.error('Rider-application admin alert failed:', e)
    }
  })

  return NextResponse.json({ ok: true, id: application.id, refCode }, { status: 201 })
}

export async function GET() {
  // requireRole throws its 401/403 as a Response; some Next 16 builds turn
  // a thrown Response into an empty 500 (phase-24 finding — this endpoint
  // was orphaned before phase 54, so the latent bug never surfaced).
  // Converting it keeps the status code honest for the console UI.
  let session: Awaited<ReturnType<typeof requireRole>>
  try {
    session = await requireRole('ADMIN')
  } catch (e) {
    if (e instanceof Response) {
      return new NextResponse(e.body, {
        status: e.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    throw e
  }
  void session

  // ----- The applications pipeline -----
  const applications = await db.riderApplication.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, accessStatus: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
  })

  // ----- The rider roster (phase 54): every DRIVER account with live
  // delivery stats — the "business impact" view the owner asked for.
  // Open assignments are pipeline orders currently riding with them;
  // completed deliveries are orders they delivered. Phase 72 adds the
  // money side: computed earnings, payouts settled, pending balance and
  // whether bank details are on file — the payout desk's columns. -----
  const riders = await db.user.findMany({
    where: { role: 'DRIVER' },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      accessStatus: true,
      createdAt: true,
      branchId: true,
      employmentType: true,
      bankName: true,
      bankAccountNumber: true,
      bankAccountName: true,
      driverLocation: { select: { updatedAt: true, zone: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const riderIds = riders.map((r) => r.id)
  const openByDriver = new Map<string, number>()
  const deliveredByDriver = new Map<string, number>()
  const doneTodayByDriver = new Map<string, number>()
  const openIncidentsByDriver = new Map<string, number>()
  if (riderIds.length > 0) {
    const grouped = await db.order.groupBy({
      by: ['driverId', 'status'],
      where: { driverId: { in: riderIds } },
      _count: { _all: true },
    })
    for (const g of grouped) {
      if (!g.driverId) continue
      if (['PAYMENT_VERIFIED', 'PICKED_UP', 'AT_STATION', 'PROCESSING', 'FINISHING', 'OUT_FOR_DELIVERY'].includes(g.status)) {
        openByDriver.set(g.driverId, (openByDriver.get(g.driverId) ?? 0) + g._count._all)
      }
      if (g.status === 'DELIVERED') {
        deliveredByDriver.set(g.driverId, (deliveredByDriver.get(g.driverId) ?? 0) + g._count._all)
      }
    }

    // Phase 59 — driver-grade tracking, the way fleet dashboards (Onfleet
    // workers, Bringg) model it: what did this rider FINISH today? Each
    // completed stop counts — a pickup made and a delivery made on the
    // same order are two stops of work. "Today" is the Lagos business day
    // (UTC+1, no DST), not the server's UTC day.
    const lagosNow = new Date(Date.now() + 60 * 60 * 1000)
    lagosNow.setUTCHours(0, 0, 0, 0)
    const startOfLagosDay = new Date(lagosNow.getTime() - 60 * 60 * 1000)
    const [pickedToday, deliveredToday, openIncidents] = await Promise.all([
      db.order.groupBy({
        by: ['driverId'],
        where: { driverId: { in: riderIds }, pickedUpAt: { gte: startOfLagosDay } },
        _count: { _all: true },
      }),
      db.order.groupBy({
        by: ['driverId'],
        where: { driverId: { in: riderIds }, deliveredAt: { gte: startOfLagosDay } },
        _count: { _all: true },
      }),
      db.riderIncident.groupBy({
        by: ['driverId'],
        where: { driverId: { in: riderIds }, resolvedAt: null },
        _count: { _all: true },
      }),
    ])
    for (const g of pickedToday)
      if (g.driverId) doneTodayByDriver.set(g.driverId, (doneTodayByDriver.get(g.driverId) ?? 0) + g._count._all)
    for (const g of deliveredToday)
      if (g.driverId) doneTodayByDriver.set(g.driverId, (doneTodayByDriver.get(g.driverId) ?? 0) + g._count._all)
    for (const g of openIncidents)
      if (g.driverId) openIncidentsByDriver.set(g.driverId, g._count._all)
  }

  // ----- Phase 72: the money side of the roster -----
  // Computed earnings per rider (deduped (order, leg) pairs × published
  // rates — the same rule the rider's own ledger uses), payouts settled,
  // pending balance, last payout date. If rates aren't published yet the
  // desk says so rather than pretending (0/0 rates → earned 0, honest).
  const settings = await getAppSettings().catch(() => null)
  const rates = {
    pickup: settings?.riderPickupRate ?? 0,
    delivery: settings?.riderDeliveryRate ?? 0,
  }
  const ratesPublished = Boolean(settings && (rates.pickup > 0 || rates.delivery > 0))
  const payoutAgg = await db.riderPayout.groupBy({
    by: ['riderId'],
    _sum: { amount: true },
    _max: { createdAt: true },
  })
  const paidByRider = new Map(payoutAgg.map((g) => [g.riderId, g]))
  const earnedByRider = new Map<string, number>()
  if (ratesPublished) {
    // Only price legs when rates exist — an unpublished ledger shows work,
    // never fake money (the rider app's own honesty rule).
    const events = await db.statusEvent.findMany({
      where: { actorId: { in: riderIds }, status: { in: ['PICKED_UP', 'DELIVERED'] } },
      select: { actorId: true, orderId: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
    const seen = new Set<string>()
    for (const e of events) {
      if (!e.actorId) continue // defensive — actor is always the rider's account here
      const key = `${e.actorId}:${e.orderId}:${e.status}`
      if (seen.has(key)) continue
      seen.add(key)
      const rate = e.status === 'PICKED_UP' ? rates.pickup : rates.delivery
      earnedByRider.set(e.actorId, (earnedByRider.get(e.actorId) ?? 0) + rate)
    }
  }

  const roster = riders.map((r) => {
    const paid = paidByRider.get(r.id)
    const earned = earnedByRider.get(r.id) ?? 0
    const paidTotal = paid?._sum.amount ?? 0
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      accessStatus: r.accessStatus,
      joinedAt: r.createdAt,
      branchId: r.branchId ?? null,
      employmentType: r.employmentType ?? null,
      lastPingAt: r.driverLocation?.updatedAt ?? null,
      lastZone: r.driverLocation?.zone ?? null,
      openAssignments: openByDriver.get(r.id) ?? 0,
      deliveriesCompleted: deliveredByDriver.get(r.id) ?? 0,
      todayCompleted: doneTodayByDriver.get(r.id) ?? 0,
      unresolvedIncidents: openIncidentsByDriver.get(r.id) ?? 0,
      // Phase 72 — the payout desk columns
      ratesPublished,
      earnedTotal: earned,
      paidTotal,
      pendingPayout: ratesPublished ? earned - paidTotal : 0,
      lastPayoutAt: paid?._max.createdAt?.toISOString() ?? null,
      bankOnFile: Boolean(r.bankName && r.bankAccountNumber && r.bankAccountName),
      bank: r.bankName
        ? { bankName: r.bankName, bankAccountNumber: r.bankAccountNumber, bankAccountName: r.bankAccountName }
        : null,
    }
  })

  // ----- Rider incidents (phase 55): the risk-management ledger -----
  // Unresolved incidents first (that is the owner's action list the moment
  // something goes wrong mid-route), then the recent resolved tail. Joined
  // with order + rider so each row tells the whole story on its own.
  const incidents = await db.riderIncident.findMany({
    orderBy: [{ resolvedAt: 'asc' }, { createdAt: 'desc' }],
    take: 25,
    include: {
      order: { select: { id: true, orderNumber: true } },
      driver: { select: { id: true, name: true, phone: true } },
    },
  })

  const incidentRows = incidents.map((i) => ({
    id: i.id,
    kind: i.kind,
    description: i.description,
    atStop: i.atStop,
    createdAt: i.createdAt,
    resolvedAt: i.resolvedAt,
    resolution: i.resolution,
    orderNumber: i.order.orderNumber,
    orderId: i.order.id,
    riderId: i.driver.id,
    riderName: i.driver.name,
    riderPhone: i.driver.phone,
  }))

  return NextResponse.json({ applications, roster, incidents: incidentRows })
}
