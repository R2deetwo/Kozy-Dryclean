// Phase 61 seed — the rider app as a real app: History / Earnings / Account,
// push notifications, and the WhatsApp bridge. Creates:
//   driver61   (known password; phone = the owner's WhatsApp test number
//               08124129296, so every wa.me link in QA targets the real
//               number the owner will verify with)
//   admin61    (for the console side: Rider Pay settings + WhatsApp bridge)
//   2 customers
//   orders covering every ledger/history state:
//     PAYMENT_VERIFIED  → live pickup stop on the route
//     OUT_FOR_DELIVERY  → live delivery stop (different drop-off address)
//     PICKED_UP + DELIVERED today WITH StatusEvents (actorId = driver61)
//                        → History "Today" group + this week's earnings
//     DELIVERED 6 days ago WITH StatusEvents
//                        → History weekday group, LAST week (outside payout
//                           week) but inside all-time totals
//     a pickup swiped INSIDE the slot yesterday  → onTime = true
//     a delivery swiped AFTER the 1h run promise  → onTime = false
// Idempotent: clears its own rows first. No emails (direct-to-DB).
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

const DRIVER_EMAIL = 'driver61@kozy-test.example'
const DRIVER_PASS = 'Phase61!Rider2026'
const ADMIN_EMAIL = 'admin61@kozy-test.example'
const ADMIN_PASS = 'Phase61!Admin2026'
// The owner's WhatsApp test number — normalised internationally this is
// 2348124129296; stored as the local format the owner dictated.
const OWNER_TEST_PHONE = '08124129296'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

async function main() {
  // ---- Clean our own previous rows (FK-safe) ----
  const mine = await db.user.findMany({
    where: {
      OR: [
        { email: { endsWith: '@kozy-test.example' }, name: { startsWith: 'Phase 61' } },
        { email: { endsWith: '@p61.test' } },
      ],
    },
    select: { id: true },
  })
  const ids = mine.map((u) => u.id)
  if (ids.length > 0) {
    await db.statusEvent.deleteMany({ where: { actorId: { in: ids } } })
    await db.riderIncident.deleteMany({ where: { driverId: { in: ids } } })
    await db.pushSubscription.deleteMany({ where: { userId: { in: ids } } })
    await db.order.deleteMany({ where: { OR: [{ userId: { in: ids } }, { driverId: { in: ids } }] } })
    await db.user.deleteMany({ where: { id: { in: ids } } })
  }
  await db.order.deleteMany({ where: { orderNumber: { startsWith: 'KZ-61' } } })
  await db.statusEvent.deleteMany({ where: { order: { orderNumber: { startsWith: 'KZ-61' } } } })
  // Reset rider pay rates to unpublished for a clean QA start.
  await db.appSetting.deleteMany({ where: { key: { in: ['rider_pickup_rate', 'rider_delivery_rate'] } } })

  // ---- Driver (the owner's WhatsApp test number on their profile) ----
  const driver = await db.user.upsert({
    where: { email: DRIVER_EMAIL },
    update: { mustChangePassword: false, phone: OWNER_TEST_PHONE },
    create: {
      email: DRIVER_EMAIL,
      name: 'Phase 61 Rider',
      phone: OWNER_TEST_PHONE,
      role: 'DRIVER',
      passwordHash: await bcrypt.hash(DRIVER_PASS, 10),
      emailVerified: new Date(),
      accessStatus: 'ACTIVE',
      mustChangePassword: false,
    },
  })

  // ---- Admin ----
  await db.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      name: 'Phase 61 Admin',
      phone: '+234 803 000 0061',
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
        email: `${tag}@p61.test`,
        name,
        phone: '+234 801 000 ' + tag.slice(-4).padStart(4, '0'),
        role: 'B2C' as const,
        passwordHash: await bcrypt.hash('x', 10),
        emailVerified: new Date(),
        accessStatus: 'ACTIVE',
      },
    })
  const c1 = await cust('Amaka Nwosu', 'cust6101')
  const c2 = await cust('Segun Alabi', 'cust6102')

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const H = 3600_000

  const mk = (data: any) =>
    db.order.create({
      data: {
        type: 'ITEM',
        modeOfWash: 'MACHINE',
        itemsManifest: JSON.stringify([
          { id: 'shirt', name: 'Shirt', quantity: 3, unitPrice: 3000 },
          { id: 'trouser', name: 'Trouser', quantity: 1, unitPrice: 3500 },
        ]),
        totalPrice: 12500,
        pickupAddress: '12 Admiralty Way, Lekki Phase 1',
        deliveryAddress: '12 Admiralty Way, Lekki Phase 1',
        driverId: driver.id,
        ...data,
      },
    })

  const ev = (orderId: string, status: any, actorId: string, createdAt: Date) =>
    db.statusEvent.create({ data: { orderId, status, actorId, createdAt } })

  // 1. Live pickup stop — this afternoon's slot.
  const o1 = await mk({
    orderNumber: 'KZ-61000001',
    userId: c1.id,
    status: 'PAYMENT_VERIFIED',
    serviceSpeed: 'STANDARD',
    pickupDate: today,
    pickupTimeSlot: `${pad(Math.max(8, Math.min(now.getHours(), 17)))}:00 - ${pad(Math.max(9, Math.min(now.getHours() + 1, 18)))}:00`,
  })

  // 2. Live delivery stop — out 20 minutes ago (on-track run clock),
  //    different drop-off address.
  const o2 = await mk({
    orderNumber: 'KZ-61000002',
    userId: c2.id,
    status: 'OUT_FOR_DELIVERY',
    serviceSpeed: 'STANDARD',
    pickupDate: new Date(today.getTime() - 2 * 24 * H),
    pickupTimeSlot: '09:00 - 10:00',
    pickedUpAt: new Date(now.getTime() - 20 * H),
    outForDeliveryAt: new Date(now.getTime() - 20 * 60_000),
    deliveryAddress: '5B Alexander Avenue, Ikoyi',
  })

  // 3. Completed today: picked up 4h ago (inside the 09:00-10:00 slot
  //    boundary story is irrelevant here — swipes carry the credit),
  //    delivered 90m ago with a fast 30m run → both legs onTime, "Today"
  //    history group, this payout week.
  const o3 = await mk({
    orderNumber: 'KZ-61000003',
    userId: c1.id,
    status: 'DELIVERED',
    serviceSpeed: 'STANDARD',
    pickupDate: new Date(today.getTime() - 24 * H),
    pickupTimeSlot: '09:00 - 10:00',
    pickedUpAt: new Date(now.getTime() - 4 * H),
    outForDeliveryAt: new Date(now.getTime() - 2 * H),
    deliveredAt: new Date(now.getTime() - 90 * 60_000),
    deliveryAddress: '9B Kiaba Street, Lekki Phase 1',
  })
  await ev(o3.id, 'PICKED_UP', driver.id, new Date(now.getTime() - 4 * H))
  await ev(o3.id, 'DELIVERED', driver.id, new Date(now.getTime() - 90 * 60_000))

  // 4. Yesterday: pickup swiped INSIDE the customer's 10:00-11:00 slot
  //    (10:25) → onTime = true. Order still at the studio (PICKED_UP),
  //    so the pickup leg shows in history but the run hasn't happened.
  const o4 = await mk({
    orderNumber: 'KZ-61000004',
    userId: c2.id,
    status: 'PICKED_UP',
    serviceSpeed: 'STANDARD',
    pickupDate: new Date(today.getTime() - 24 * H),
    pickupTimeSlot: '10:00 - 11:00',
    pickedUpAt: new Date(today.getTime() - 24 * H + 10.4 * H),
  })
  await ev(o4.id, 'PICKED_UP', driver.id, new Date(today.getTime() - 24 * H + 10.4 * H))

  // 5. Six days ago: delivered LATE — out for delivery at T, delivered at
  //    T+80m (past the 1h promise) → onTime = false; last week's work (not
  //    this payout week), all-time totals.
  const o5 = await mk({
    orderNumber: 'KZ-61000005',
    userId: c1.id,
    status: 'DELIVERED',
    serviceSpeed: 'STANDARD',
    pickupDate: new Date(today.getTime() - 7 * 24 * H),
    pickupTimeSlot: '09:00 - 10:00',
    pickedUpAt: new Date(now.getTime() - 6 * 24 * H),
    outForDeliveryAt: new Date(now.getTime() - 6 * 24 * H - H),
    deliveredAt: new Date(now.getTime() - 6 * 24 * H - H + 80 * 60_000),
    deliveryAddress: '22 Ozumba Mbadiwe Avenue, Victoria Island',
  })
  await ev(o5.id, 'PICKED_UP', driver.id, new Date(now.getTime() - 6 * 24 * H))
  await ev(o5.id, 'DELIVERED', driver.id, new Date(now.getTime() - 6 * 24 * H - H + 80 * 60_000))

  // 6. UNASSIGNED pickup — QA assigns this one live while the rider app is
  //    open: proves the in-app alert, the web push and the WhatsApp hook all
  //    fire at the assignment moment.
  await mk({
    orderNumber: 'KZ-61000006',
    userId: c2.id,
    status: 'PAYMENT_VERIFIED',
    serviceSpeed: 'STANDARD',
    pickupDate: today,
    pickupTimeSlot: '14:00 - 15:00',
    pickupAddress: '14 Admiralty Way, Lekki Phase 1',
    driverId: undefined,
  })

  console.log('driver:', DRIVER_EMAIL, '/', DRIVER_PASS, '| phone:', OWNER_TEST_PHONE)
  console.log('admin:', ADMIN_EMAIL, '/', ADMIN_PASS)
  console.log('orders: live pickup / live delivery / done-today (both legs) / pickup-yesterday onTime / delivered-6d-ago late')
  console.log('ledger legs for driver61: 5 (3 pickup + 2 delivery)')
  console.log('SEED DONE')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .then(() => db.$disconnect?.())
