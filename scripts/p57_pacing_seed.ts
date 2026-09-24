// Phase 57 pacing seed — one order in EVERY pacing state so the board's
// colour coding can be verified at a glance:
//   overdue pickup / watch pickup / on-track pickup (pre-pickup clock)
//   overdue express-24 / watch express-48 / watch standard / on-track (turnaround clock)
//   overdue delivery run / watch delivery run (the 1h journey promise)
//   delivered (terminal — no clock)
// Idempotent: clears its own rows first. Run against the embedded PG.
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

const ADMIN_EMAIL = 'admin57@kozy-test.example'
const ADMIN_PASS = 'Phase57!Admin2026'

function pad(n: number) {
  return String(n).padStart(2, '0')
}
function slotFor(hour: number) {
  return `${pad(hour)}:00 - ${pad(hour + 1)}:00`
}

async function main() {
  // ---- Clean our own previous rows (FK-safe) ----
  const mine = await db.user.findMany({
    where: { email: { endsWith: '@pacing57.test' } },
    select: { id: true },
  })
  const ids = mine.map((u) => u.id)
  if (ids.length > 0) {
    await db.order.deleteMany({ where: { userId: { in: ids } } })
    await db.user.deleteMany({ where: { id: { in: ids } } })
  }
  await db.order.deleteMany({ where: { orderNumber: { startsWith: 'KZ-57' } } })

  // ---- Admin ----
  await db.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      name: 'Phase 57 Admin',
      phone: '+234 800 000 0057',
      role: 'ADMIN',
      passwordHash: await bcrypt.hash(ADMIN_PASS, 10),
      emailVerified: new Date(),
      accessStatus: 'ACTIVE',
    },
  })

  // ---- Customers ----
  const cust = async (name: string, tag: string) =>
    db.user.create({
      data: {
        email: `${tag}@pacing57.test`,
        name,
        phone: '+234 801 000 ' + tag.slice(-4).padStart(4, '0'),
        role: 'B2C',
        passwordHash: await bcrypt.hash('x', 10),
        emailVerified: new Date(),
        accessStatus: 'ACTIVE',
      },
    })
  const c1 = await cust('Adaeze Okonkwo', 'cust0001')
  const c2 = await cust('Tunde Balogun', 'cust0002')
  const c3 = await cust('Chinelo Eze', 'cust0003')
  const c4 = await cust('Ifeanyi Adeyemi', 'cust0004')

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 24 * 3600_000)
  const H = 3600_000
  const currentHour = now.getHours()

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

  // 1. OVERDUE pickup — the slot ended three hours ago, never collected.
  await mk({
    orderNumber: 'KZ-57000001',
    userId: c1.id,
    status: 'REQUESTED',
    serviceSpeed: 'STANDARD',
    pickupDate: today,
    pickupTimeSlot: slotFor(Math.max(currentHour - 3, 8)),
  })

  // 2. WATCH pickup — the current slot is running right now.
  await mk({
    orderNumber: 'KZ-57000002',
    userId: c2.id,
    status: 'PAYMENT_VERIFIED',
    serviceSpeed: 'STANDARD',
    pickupDate: today,
    pickupTimeSlot: slotFor(currentHour),
  })

  // 3. ON TRACK pickup — tomorrow morning's slot.
  await mk({
    orderNumber: 'KZ-57000003',
    userId: c3.id,
    status: 'PAYMENT_VERIFIED',
    serviceSpeed: 'STANDARD',
    pickupDate: tomorrow,
    pickupTimeSlot: '10:00 - 11:00',
  })

  // 4. OVERDUE express 24 — the 24h promise broke 20h after pickup... i.e.
  //    picked up 20h ago? No: overdue needs >24h. Picked up 25h ago.
  await mk({
    orderNumber: 'KZ-57000004',
    userId: c1.id,
    status: 'PICKED_UP',
    serviceSpeed: 'EXPRESS_24',
    pickupDate: new Date(today.getTime() - 25 * H),
    pickupTimeSlot: '09:00 - 10:00',
    pickedUpAt: new Date(now.getTime() - 25 * H),
  })

  // 5. WATCH express 48 — picked up 40h ago, due in 8h (past the 36h mark).
  await mk({
    orderNumber: 'KZ-57000005',
    userId: c2.id,
    status: 'PROCESSING',
    serviceSpeed: 'EXPRESS_48',
    pickupDate: new Date(today.getTime() - 40 * H),
    pickupTimeSlot: '09:00 - 10:00',
    pickedUpAt: new Date(now.getTime() - 40 * H),
    atStationAt: new Date(now.getTime() - 39 * H),
    processingAt: new Date(now.getTime() - 30 * H),
  })

  // 6. WATCH standard — day 3.5 of the 3–5 day window.
  await mk({
    orderNumber: 'KZ-57000006',
    userId: c3.id,
    status: 'FINISHING',
    serviceSpeed: 'STANDARD',
    pickupDate: new Date(today.getTime() - 84 * H),
    pickupTimeSlot: '09:00 - 10:00',
    pickedUpAt: new Date(now.getTime() - 84 * H),
    atStationAt: new Date(now.getTime() - 83 * H),
    processingAt: new Date(now.getTime() - 60 * H),
    finishingAt: new Date(now.getTime() - 10 * H),
  })

  // 7. ON TRACK standard — day 1 of 3–5.
  await mk({
    orderNumber: 'KZ-57000007',
    userId: c4.id,
    status: 'AT_STATION',
    serviceSpeed: 'STANDARD',
    pickupDate: new Date(today.getTime() - 24 * H),
    pickupTimeSlot: '11:00 - 12:00',
    pickedUpAt: new Date(now.getTime() - 24 * H),
    atStationAt: new Date(now.getTime() - 23 * H),
  })

  // 8. OVERDUE delivery run — out for delivery 70 minutes ago.
  await mk({
    orderNumber: 'KZ-57000008',
    userId: c4.id,
    status: 'OUT_FOR_DELIVERY',
    serviceSpeed: 'EXPRESS_24',
    pickupDate: new Date(today.getTime() - 24 * H),
    pickupTimeSlot: '09:00 - 10:00',
    pickedUpAt: new Date(now.getTime() - 24 * H),
    atStationAt: new Date(now.getTime() - 23 * H),
    processingAt: new Date(now.getTime() - 20 * H),
    finishingAt: new Date(now.getTime() - 2 * H),
    outForDeliveryAt: new Date(now.getTime() - 70 * 60_000),
  })

  // 9. WATCH delivery run — out for delivery 50 minutes ago.
  await mk({
    orderNumber: 'KZ-57000009',
    userId: c1.id,
    status: 'OUT_FOR_DELIVERY',
    serviceSpeed: 'STANDARD',
    pickupDate: new Date(today.getTime() - 72 * H),
    pickupTimeSlot: '09:00 - 10:00',
    pickedUpAt: new Date(now.getTime() - 72 * H),
    atStationAt: new Date(now.getTime() - 71 * H),
    processingAt: new Date(now.getTime() - 48 * H),
    finishingAt: new Date(now.getTime() - 3 * H),
    outForDeliveryAt: new Date(now.getTime() - 50 * 60_000),
  })

  // 10. TERMINAL — delivered, no clock at all.
  await mk({
    orderNumber: 'KZ-57000010',
    userId: c2.id,
    status: 'DELIVERED',
    serviceSpeed: 'STANDARD',
    pickupDate: new Date(today.getTime() - 96 * H),
    pickupTimeSlot: '09:00 - 10:00',
    pickedUpAt: new Date(now.getTime() - 96 * H),
    atStationAt: new Date(now.getTime() - 95 * H),
    processingAt: new Date(now.getTime() - 72 * H),
    finishingAt: new Date(now.getTime() - 30 * H),
    outForDeliveryAt: new Date(now.getTime() - 5 * H),
    deliveredAt: new Date(now.getTime() - 4 * H),
    deliveryDate: new Date(now.getTime() - 4 * H),
  })

  console.log('SEEDED: 10 pacing orders (KZ-57000001..10) + admin', ADMIN_EMAIL)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .then(() => process.exit(0))
