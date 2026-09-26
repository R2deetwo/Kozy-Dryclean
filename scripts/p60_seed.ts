// Phase 60 seed — the intelligence layer, on REAL data shapes.
// Creates (all directly in the DB — no API calls, so ZERO emails fire):
//
//   admin60                     (known password, for the QA login)
//
//   RIDERS (the dispatch test bench):
//     rider60a  Tunde Bakare — THE ideal Lekki rider: fresh GPS at Lekki
//               centre, 2 open Lekki stops today (corridor), 9/10 on-time,
//               7 of 12 lifetime deliveries in Lekki → must rank #1
//     rider60b  Chuka Eze — GPS 2h old in Ajah (stale + far), 5 open stops
//               (at capacity), 2 unresolved incidents, 2/8 on-time → must
//               rank LAST with flags visible
//     rider60c  Ibrahim Musa — no GPS at all, 1 open Ikeja stop, brand new
//               (0 delivered) → neutral proximity, "New rider" note
//     rider60d  Paused Rider — accessStatus PAUSED, GPS at Lekki → must
//               NOT appear in suggestions at all
//
//   KZ-60000001 — the dispatch target: unassigned, PAYMENT_VERIFIED,
//     Lekki pickup, slot one hour from now (imminent → urgency-weighted
//     proximity bites). Plus 2 assigned Lekki pickups today (rider60a) so
//     the zone-load context reads "3 pickups in Lekki today · 1 unassigned".
//
//   CUSTOMERS (the health test bench):
//     cust60a  Bisi Adeyemi — LOYAL: 7-day rhythm, last 5d ago, ₦60k LTV
//     cust60b  Femi Ojo — COOLING: 7-day rhythm, last 10d ago
//     cust60c  Ada Umeh — AT RISK: 7-day rhythm, last 21d ago
//     cust60d  Chidi Nwankwo — VIP: ₦500k+ LTV across 6 delivered orders
//     cust60e  New Person — 0 orders → "new", no verdict
//
// Idempotent: clears its own rows first.
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

const ADMIN_EMAIL = 'admin60@kozy-test.example'
const ADMIN_PASS = 'Phase60!Admin2026'

const H = 3600_000
const D = 24 * H

function pad(n: number) {
  return String(n).padStart(2, '0')
}

async function main() {
  // ---- Clean our own previous rows ----
  const mine = await db.user.findMany({
    where: {
      OR: [
        { email: { endsWith: '@p60.test' } },
        { email: { endsWith: '@kozy-test.example' }, name: { startsWith: 'Phase 60' } },
      ],
    },
    select: { id: true },
  })
  const ids = mine.map((u) => u.id)
  if (ids.length > 0) {
    await db.riderIncident.deleteMany({ where: { driverId: { in: ids } } })
    await db.driverLocation.deleteMany({ where: { driverId: { in: ids } } })
    await db.order.deleteMany({ where: { OR: [{ userId: { in: ids } }, { driverId: { in: ids } }] } })
    await db.user.deleteMany({ where: { id: { in: ids } } })
  }
  await db.order.deleteMany({ where: { orderNumber: { startsWith: 'KZ-60' } } })
  await db.riderIncident.deleteMany({ where: { order: { orderNumber: { startsWith: 'KZ-60' } } } })

  const now = new Date()
  // Lagos time (UTC+1) — the business clock everything on the board reads.
  const lagos = new Date(now.getTime() + H)

  // ---- Admin ----
  await db.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      name: 'Phase 60 Admin',
      phone: '+234 803 000 0060',
      role: 'ADMIN',
      passwordHash: await bcrypt.hash(ADMIN_PASS, 10),
      emailVerified: new Date(),
      accessStatus: 'ACTIVE',
    },
  })

  // ---- Riders ----
  const rider = async (email: string, name: string, phone: string, access: string = 'ACTIVE') =>
    db.user.create({
      data: {
        email,
        name,
        phone,
        role: 'DRIVER',
        passwordHash: await bcrypt.hash('x', 10),
        emailVerified: new Date(),
        accessStatus: access,
        mustChangePassword: false,
      },
    })
  const a = await rider('rider60a@p60.test', 'Tunde Bakare', '+234 802 111 0001')
  const b = await rider('rider60b@p60.test', 'Chuka Eze', '+234 802 111 0002')
  const c = await rider('rider60c@p60.test', 'Ibrahim Musa', '+234 802 111 0003')
  const d = await rider('rider60d@p60.test', 'Phase 60 Paused Rider', '+234 802 111 0004', 'PAUSED')

  // GPS pings: a = fresh at Lekki centre; b = stale (2h) in Ajah; d = Lekki
  // (must still be excluded because PAUSED); c = none.
  await db.driverLocation.create({ data: { driverId: a.id, lat: 6.4392, lng: 3.4712, zone: 'Lekki', updatedAt: new Date(now.getTime() - 4 * 60_000) } })
  await db.driverLocation.create({ data: { driverId: b.id, lat: 6.4683, lng: 3.5673, zone: 'Ajah', updatedAt: new Date(now.getTime() - 2 * H) } })
  await db.driverLocation.create({ data: { driverId: d.id, lat: 6.4392, lng: 3.4712, zone: 'Lekki', updatedAt: new Date(now.getTime() - 5 * 60_000) } })

  // ---- Customers ----
  const cust = async (email: string, name: string) =>
    db.user.create({
      data: {
        email,
        name,
        phone: '+234 801 222 ' + email.slice(6, 10),
        role: 'B2C',
        passwordHash: await bcrypt.hash('x', 10),
        emailVerified: new Date(),
        accessStatus: 'ACTIVE',
      },
    })
  // Holder customers for rider track-record orders (kept OUT of the health
  // bench so their mixed dates never pollute anyone's rhythm).
  const histA = await cust('hist60a@p60.test', 'Rhoda History')
  const histB = await cust('hist60b@p60.test', 'Rosemary History')
  const ca = await cust('cust60a@p60.test', 'Bisi Adeyemi')
  const cb = await cust('cust60b@p60.test', 'Femi Ojo')
  const cc = await cust('cust60c@p60.test', 'Ada Umeh')
  const cd = await cust('cust60d@p60.test', 'Chidi Nwankwo')
  const ce = await cust('cust60e@p60.test', 'New Person')

  // ---- Orders ----
  const mk = (data: any) =>
    db.order.create({
      data: {
        type: 'ITEM',
        modeOfWash: 'MACHINE',
        itemsManifest: JSON.stringify([
          { id: 'shirt', name: 'Shirt', quantity: 2, unitPrice: 3000 },
        ]),
        totalPrice: 6000,
        pickupAddress: '12 Admiralty Way, Lekki Phase 1',
        deliveryAddress: '12 Admiralty Way, Lekki Phase 1',
        ...data,
      },
    })

  // The dispatch target — slot one hour from now (Lagos clock), unassigned.
  const slotHour = (lagos.getHours() + 1) % 24
  const target = await mk({
    orderNumber: 'KZ-60000001',
    userId: ca.id,
    status: 'PAYMENT_VERIFIED',
    serviceSpeed: 'STANDARD',
    pickupDate: new Date(lagos.getFullYear(), lagos.getMonth(), lagos.getDate()),
    pickupTimeSlot: `${pad(slotHour)}:00 - ${pad((slotHour + 1) % 24)}:00`,
    totalPrice: 12500,
  })

  // rider60a's two open Lekki stops (corridor + today's zone load).
  await mk({
    orderNumber: 'KZ-60000002',
    userId: cb.id,
    status: 'PAYMENT_VERIFIED',
    serviceSpeed: 'STANDARD',
    pickupDate: new Date(lagos.getFullYear(), lagos.getMonth(), lagos.getDate()),
    pickupTimeSlot: `${pad(Math.max(8, lagos.getHours()))}:00 - ${pad(Math.max(9, lagos.getHours() + 1))}:00`,
    driverId: a.id,
    pickupAddress: '24 Ikate Elegushi Road, Lekki',
    deliveryAddress: '24 Ikate Elegushi Road, Lekki',
  })
  await mk({
    orderNumber: 'KZ-60000003',
    userId: cc.id,
    status: 'PAYMENT_VERIFIED',
    serviceSpeed: 'STANDARD',
    pickupDate: new Date(lagos.getFullYear(), lagos.getMonth(), lagos.getDate()),
    pickupTimeSlot: `${pad(Math.max(8, lagos.getHours()))}:00 - ${pad(Math.max(9, lagos.getHours() + 1))}:00`,
    driverId: a.id,
    pickupAddress: '8 Idejo Street, Lekki',
    deliveryAddress: '8 Idejo Street, Lekki',
  })

  // rider60b's five open stops (at capacity) — Ikeja/VI mix.
  for (let i = 1; i <= 5; i++) {
    await mk({
      orderNumber: `KZ-6000010${i}`,
      userId: cb.id,
      status: i <= 3 ? 'PAYMENT_VERIFIED' : 'PROCESSING',
      serviceSpeed: 'STANDARD',
      pickupDate: new Date(lagos.getFullYear(), lagos.getMonth(), lagos.getDate()),
      pickupTimeSlot: '09:00 - 10:00',
      driverId: b.id,
      pickupAddress: i % 2 === 0 ? '14 Allen Avenue, Ikeja' : '21 Adeola Odeku Street, Victoria Island',
      deliveryAddress: '14 Allen Avenue, Ikeja',
    })
  }

  // rider60c's single open stop — Ikeja (no corridor with Lekki).
  await mk({
    orderNumber: 'KZ-60000201',
    userId: cc.id,
    status: 'PAYMENT_VERIFIED',
    serviceSpeed: 'STANDARD',
    pickupDate: new Date(lagos.getFullYear(), lagos.getMonth(), lagos.getDate()),
    pickupTimeSlot: '11:00 - 12:00',
    driverId: c.id,
    pickupAddress: '7 Opebi Road, Ikeja',
    deliveryAddress: '7 Opebi Road, Ikeja',
  })

  // ---- Histories: reliability + terrain ----
  // rider60a: 9 on-time, 1 late; 7 of 12 in Lekki.
  for (let i = 0; i < 12; i++) {
    const picked = new Date(now.getTime() - (30 - i * 2) * D)
    const late = i === 5
    await mk({
      orderNumber: `KZ-600010${pad(i)}`,
      userId: ca.id,
      status: 'DELIVERED',
      serviceSpeed: 'STANDARD',
      pickupDate: picked,
      pickupTimeSlot: '09:00 - 10:00',
      pickedUpAt: picked,
      deliveredAt: new Date(picked.getTime() + (late ? 6 * D : 2 * D)),
      createdAt: new Date(picked.getTime() - 12 * H),
      driverId: a.id,
      userId: histA.id,
      pickupAddress: i < 7 ? '19 Agoro Ogundipe Drive, Lekki' : '4 Bourdillon Road, Ikoyi',
      deliveryAddress: i < 7 ? '19 Agoro Ogundipe Drive, Lekki' : '4 Bourdillon Road, Ikoyi',
    })
  }
  // rider60b: 2 on-time, 8 late; Ajah-heavy history.
  for (let i = 0; i < 10; i++) {
    const picked = new Date(now.getTime() - (40 - i * 3) * D)
    await mk({
      orderNumber: `KZ-600020${pad(i)}`,
      userId: cb.id,
      status: 'DELIVERED',
      serviceSpeed: 'STANDARD',
      pickupDate: picked,
      pickupTimeSlot: '09:00 - 10:00',
      pickedUpAt: picked,
      deliveredAt: new Date(picked.getTime() + (i < 2 ? 2 * D : 7 * D)),
      createdAt: new Date(picked.getTime() - 12 * H),
      driverId: b.id,
      userId: histB.id,
      pickupAddress: '3 Abraham Adesanya Street, Ajah',
      deliveryAddress: '3 Abraham Adesanya Street, Ajah',
    })
  }
  // 2 unresolved incidents on rider60b.
  const bOrders = await db.order.findMany({
    where: { orderNumber: { startsWith: 'KZ-600020' } },
    take: 2,
  })
  for (const o of bOrders) {
    await db.riderIncident.create({
      data: {
        orderId: o.id,
        driverId: b.id,
        kind: 'DAMAGE',
        description: 'Phase-60 seed: unresolved incident for the dispatch reliability penalty.',
        atStop: 'delivery',
      },
    })
  }

  // ---- Customer health histories ----
  // Bisi (cust60a): 7-day rhythm, last 5d ago → LOYAL (also owns the target
  // order — she is the customer being dispatched for).
  for (let i = 0; i < 5; i++) {
    const at = new Date(now.getTime() - (5 + i * 7) * D)
    await mk({
      orderNumber: `KZ-600030${pad(i)}`,
      userId: ca.id,
      status: 'DELIVERED',
      serviceSpeed: 'STANDARD',
      pickupDate: at,
      pickupTimeSlot: '09:00 - 10:00',
      pickedUpAt: at,
      deliveredAt: new Date(at.getTime() + 2 * D),
      createdAt: new Date(at.getTime() - 12 * H),
      totalPrice: 12000,
    })
  }
  // Femi (cust60b): 7-day rhythm, last 10d ago → COOLING.
  for (let i = 0; i < 4; i++) {
    const at = new Date(now.getTime() - (10 + i * 7) * D)
    await mk({
      orderNumber: `KZ-600031${pad(i)}`,
      userId: cb.id,
      status: 'DELIVERED',
      serviceSpeed: 'STANDARD',
      pickupDate: at,
      pickupTimeSlot: '09:00 - 10:00',
      pickedUpAt: at,
      deliveredAt: new Date(at.getTime() + 2 * D),
      createdAt: new Date(at.getTime() - 12 * H),
      totalPrice: 11000,
    })
  }
  // Ada (cust60c): 7-day rhythm, last 21d ago → AT RISK.
  for (let i = 0; i < 4; i++) {
    const at = new Date(now.getTime() - (21 + i * 7) * D)
    await mk({
      orderNumber: `KZ-600032${pad(i)}`,
      userId: cc.id,
      status: 'DELIVERED',
      serviceSpeed: 'STANDARD',
      pickupDate: at,
      pickupTimeSlot: '09:00 - 10:00',
      pickedUpAt: at,
      deliveredAt: new Date(at.getTime() + 2 * D),
      createdAt: new Date(at.getTime() - 12 * H),
      totalPrice: 10500,
    })
  }
  // Chidi (cust60d): the VIP — ₦645k across 6 delivered, 14-day rhythm.
  for (let i = 0; i < 6; i++) {
    const at = new Date(now.getTime() - (6 + i * 14) * D)
    await mk({
      orderNumber: `KZ-600033${pad(i)}`,
      userId: cd.id,
      status: 'DELIVERED',
      serviceSpeed: 'EXPRESS_48',
      pickupDate: at,
      pickupTimeSlot: '10:00 - 11:00',
      pickedUpAt: at,
      deliveredAt: new Date(at.getTime() + 1.5 * D),
      createdAt: new Date(at.getTime() - 12 * H),
      totalPrice: 107500,
    })
  }
  // cust60e: nothing — the "new" case (no rhythm to read yet).

  console.log('Phase 60 seed complete:')
  console.log(`  target order ${target.orderNumber} (unassigned, Lekki, slot in ~1h)`)
  console.log(`  riders: a=${a.id.slice(-4)} b=${b.id.slice(-4)} c=${c.id.slice(-4)} d(paused)=${d.id.slice(-4)}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => process.exit(0))
