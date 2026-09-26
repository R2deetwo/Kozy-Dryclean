// Phase 59 seed — the rider app's stop-type clarity + post-accept steps,
// and the people-list separation. Creates:
//   driver59   (mustChangePassword=false, known password)
//   customers  (B2C + B2B) and an ADMIN account — to prove the CRM list
//              shows ONLY customers
//   orders assigned to driver59 in every route state:
//     PAYMENT_VERIFIED  → pickup stop (gold badge)
//     OUT_FOR_DELIVERY  → delivery stop with a DIFFERENT deliveryAddress
//                         (proves delivery cards show the drop-off, and the
//                         run clock "Due by …"), one on-track, one overdue
//     PICKED_UP         → NOT on the route (at the studio)
//     DELIVERED         → NOT on the route; counts toward roster delivered
//     picked up + delivered today → roster "done today"
//   an unresolved incident → roster "open issues" (rose)
// Idempotent: clears its own rows first.
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

const DRIVER_EMAIL = 'driver59@kozy-test.example'
const DRIVER_PASS = 'Phase59!Rider2026'
const ADMIN_EMAIL = 'admin59@kozy-test.example'
const ADMIN_PASS = 'Phase59!Admin2026'

function pad(n: number) {
  return String(n).padStart(2, '0')
}
function slotFor(hour: number) {
  return `${pad(Math.max(8, Math.min(hour, 18)))}:00 - ${pad(Math.max(8, Math.min(hour, 18)) + 1)}:00`
}

async function main() {
  // ---- Clean our own previous rows (FK-safe) ----
  // Phase-59 personas: driver + admin by name; customers by their p59.test
  // email domain (they carry real-looking names, so a name match misses).
  const mine = await db.user.findMany({
    where: {
      OR: [
        { email: { endsWith: '@kozy-test.example' }, name: { startsWith: 'Phase 59' } },
        { email: { endsWith: '@p59.test' } },
      ],
    },
    select: { id: true },
  })
  const ids = mine.map((u) => u.id)
  if (ids.length > 0) {
    await db.riderIncident.deleteMany({ where: { driverId: { in: ids } } })
    await db.order.deleteMany({ where: { OR: [{ userId: { in: ids } }, { driverId: { in: ids } }] } })
    await db.user.deleteMany({ where: { id: { in: ids } } })
  }
  await db.order.deleteMany({ where: { orderNumber: { startsWith: 'KZ-59' } } })
  await db.riderIncident.deleteMany({ where: { order: { orderNumber: { startsWith: 'KZ-59' } } } })

  // ---- Driver ----
  const driver = await db.user.upsert({
    where: { email: DRIVER_EMAIL },
    update: { mustChangePassword: false },
    create: {
      email: DRIVER_EMAIL,
      name: 'Phase 59 Rider',
      phone: '+234 802 000 0059',
      role: 'DRIVER',
      passwordHash: await bcrypt.hash(DRIVER_PASS, 10),
      emailVerified: new Date(),
      accessStatus: 'ACTIVE',
      mustChangePassword: false,
    },
  })

  // ---- Admin (must NOT appear in the Customers CRM list) ----
  await db.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      name: 'Phase 59 Admin',
      phone: '+234 803 000 0059',
      role: 'ADMIN',
      passwordHash: await bcrypt.hash(ADMIN_PASS, 10),
      emailVerified: new Date(),
      accessStatus: 'ACTIVE',
    },
  })

  // ---- Customers (these DO belong in the CRM list) ----
  const cust = async (name: string, tag: string, role: 'B2C' | 'B2B' = 'B2C') =>
    db.user.create({
      data: {
        email: `${tag}@p59.test`,
        name,
        phone: '+234 801 000 ' + tag.slice(-4).padStart(4, '0'),
        role,
        passwordHash: await bcrypt.hash('x', 10),
        emailVerified: new Date(),
        accessStatus: 'ACTIVE',
      },
    })
  const c1 = await cust('Amaka Nwosu', 'cust5901')
  const c2 = await cust('Segun Alabi', 'cust5902')
  const c3 = await cust('Lekki Suites Ltd', 'cust5903', 'B2B')
  const c4 = await cust('Ngozi Obi', 'cust5904')

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

  // 1. PICKUP stop — payment verified, this afternoon's slot.
  await mk({
    orderNumber: 'KZ-59000001',
    userId: c1.id,
    status: 'PAYMENT_VERIFIED',
    serviceSpeed: 'STANDARD',
    pickupDate: today,
    pickupTimeSlot: slotFor(now.getHours()),
  })

  // 2. DELIVERY stop — out for delivery 20 minutes ago (on-track run,
  //    "Due by …"). DIFFERENT delivery address — proves the stop card and
  //    detail show the DROP-OFF, not the pickup address.
  await mk({
    orderNumber: 'KZ-59000002',
    userId: c2.id,
    status: 'OUT_FOR_DELIVERY',
    serviceSpeed: 'STANDARD',
    pickupDate: new Date(today.getTime() - 2 * 24 * H),
    pickupTimeSlot: '09:00 - 10:00',
    pickedUpAt: new Date(now.getTime() - 20 * H),
    outForDeliveryAt: new Date(now.getTime() - 20 * 60_000),
    deliveryAddress: '5B Alexander Avenue, Ikoyi',
  })

  // 3. DELIVERY stop — overdue run (out for delivery 75 minutes ago):
  //    rose "Due by … — running over" text on the route card.
  await mk({
    orderNumber: 'KZ-59000003',
    userId: c3.id,
    status: 'OUT_FOR_DELIVERY',
    serviceSpeed: 'EXPRESS_24',
    pickupDate: new Date(today.getTime() - 3 * 24 * H),
    pickupTimeSlot: '10:00 - 11:00',
    pickedUpAt: new Date(now.getTime() - 44 * H),
    outForDeliveryAt: new Date(now.getTime() - 75 * 60_000),
    deliveryAddress: '22 Ozumba Mbadiwe Avenue, Victoria Island',
  })

  // 4. AT THE STUDIO — PICKED_UP: must NOT appear on the rider's route.
  await mk({
    orderNumber: 'KZ-59000004',
    userId: c4.id,
    status: 'PICKED_UP',
    serviceSpeed: 'STANDARD',
    pickupDate: new Date(today.getTime() - 24 * H),
    pickupTimeSlot: '09:00 - 10:00',
    pickedUpAt: new Date(now.getTime() - 2 * H),
  })

  // 5. DELIVERED earlier today → roster "done today" (both stops) and
  //    "delivered" counts.
  await mk({
    orderNumber: 'KZ-59000005',
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

  // 6. Unresolved incident on the delivered order → roster "open issues".
  const incOrder = await db.order.findUnique({ where: { orderNumber: 'KZ-59000005' } })
  if (incOrder) {
    await db.riderIncident.create({
      data: {
        orderId: incOrder.id,
        driverId: driver.id,
        kind: 'DAMAGE',
        description: 'A shirt collar was creased on arrival; customer pointed it out at handover.',
        atStop: 'delivery',
      },
    })
  }

  // 7. DELIVERED long ago → "delivered" all-time, NOT "done today".
  await mk({
    orderNumber: 'KZ-59000006',
    userId: c2.id,
    status: 'DELIVERED',
    serviceSpeed: 'STANDARD',
    pickupDate: new Date(today.getTime() - 5 * 24 * H),
    pickupTimeSlot: '09:00 - 10:00',
    pickedUpAt: new Date(now.getTime() - 5 * 24 * H),
    outForDeliveryAt: new Date(now.getTime() - 4 * 24 * H),
    deliveredAt: new Date(now.getTime() - 4 * 24 * H),
  })

  console.log('driver:', DRIVER_EMAIL)
  console.log('admin:', ADMIN_EMAIL)
  console.log('customers: 3 (2 retail + 1 corporate) + driver + admin excluded from CRM')
  console.log('orders: pickup / delivery on-track / delivery overdue / PICKED_UP hidden / delivered today / delivered old')
  console.log('incident: 1 unresolved DAMAGE on KZ-59000005')
  console.log('SEED DONE')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .then(() => db.$disconnect?.())
