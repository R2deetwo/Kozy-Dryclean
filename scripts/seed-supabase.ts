// Seed the Supabase database with demo data
// Run with: unset DATABASE_URL && bun run scripts/seed-supabase.ts
import { db } from '../src/lib/db'

async function main() {
  console.log('🌱 Seeding Supabase with demo data...\n')

  // Wipe existing data (in case rerun)
  console.log('Cleaning existing data...')
  await db.statusEvent.deleteMany()
  await db.payment.deleteMany()
  await db.garmentMedia.deleteMany()
  await db.order.deleteMany()
  await db.user.deleteMany()

  // ----- USERS -----
  console.log('Creating users...')
  const [admin, driver1, driver2, b2c1, b2c2, b2b1, b2b2] = await Promise.all([
    db.user.create({
      data: {
        email: 'concierge@kozy.ng',
        name: 'Adaeze Okonkwo',
        phone: '+234 802 111 2233',
        role: 'ADMIN',
        address: 'Kozy Atelier, 12 Gerard Rd, Ikoyi, Lagos',
      },
    }),
    db.user.create({
      data: {
        email: 'tunde@kozy.ng',
        name: 'Tunde Balogun',
        phone: '+234 803 222 4455',
        role: 'DRIVER',
        address: 'Allen Avenue, Ikeja, Lagos',
      },
    }),
    db.user.create({
      data: {
        email: 'bisi@kozy.ng',
        name: 'Bisi Adebayo',
        phone: '+234 805 333 6677',
        role: 'DRIVER',
        address: 'Lekki Phase 1, Lagos',
      },
    }),
    db.user.create({
      data: {
        email: 'chioma.eze@gmail.com',
        name: 'Chioma Eze',
        phone: '+234 807 444 1122',
        role: 'B2C',
        address: '5 Adeniyi Jones Ave, Ikeja, Lagos',
      },
    }),
    db.user.create({
      data: {
        email: 'femi.adeyemi@yahoo.com',
        name: 'Femi Adeyemi',
        phone: '+234 809 555 3344',
        role: 'B2C',
        address: '23 Bourdillon Rd, Ikoyi, Lagos',
      },
    }),
    db.user.create({
      data: {
        email: 'procurement@meridianhotels.com',
        name: 'Meridian Hotel Group',
        phone: '+234 811 666 7788',
        role: 'B2B',
        company: 'Meridian Hotel Group',
        address: 'Marina Rd, Lagos Island, Lagos',
      },
    }),
    db.user.create({
      data: {
        email: 'facilities@lekkiheights.com',
        name: 'Lekki Heights Estates',
        phone: '+234 813 777 9900',
        role: 'B2B',
        company: 'Lekki Heights Estates',
        address: 'Lekki-Epe Expressway, Lagos',
      },
    }),
  ])

  console.log(`  ✓ ${7} users created`)

  // ----- ORDERS -----
  console.log('Creating orders...')
  const order1 = await db.order.create({
    data: {
      orderNumber: 'KZ-1001',
      userId: b2c1.id,
      driverId: driver1.id,
      status: 'DELIVERED',
      type: 'ITEM',
      guaranteeActive: true,
      itemsManifest: JSON.stringify([
        { id: 'i1', name: 'Shirt', quantity: 5, unitPrice: 500 },
        { id: 'i2', name: 'Trousers', quantity: 2, unitPrice: 700 },
        { id: 'i3', name: 'Agbada', quantity: 1, unitPrice: 3500 },
      ]),
      totalPrice: 5 * 500 + 2 * 700 + 3500,
      pickupAddress: '5 Adeniyi Jones Ave, Ikeja, Lagos',
      pickupDate: new Date('2026-08-18T09:00:00.000Z'),
      pickupTimeSlot: '09:00 - 10:00',
      deliveryAddress: '5 Adeniyi Jones Ave, Ikeja, Lagos',
      deliveryDate: new Date('2026-08-20T16:00:00.000Z'),
      pickedUpAt: new Date('2026-08-18T09:15:00.000Z'),
      atStationAt: new Date('2026-08-18T10:30:00.000Z'),
      processingAt: new Date('2026-08-19T08:00:00.000Z'),
      finishingAt: new Date('2026-08-19T15:00:00.000Z'),
      outForDeliveryAt: new Date('2026-08-20T14:00:00.000Z'),
      deliveredAt: new Date('2026-08-20T16:30:00.000Z'),
    },
  })

  const order2 = await db.order.create({
    data: {
      orderNumber: 'KZ-1002',
      userId: b2c2.id,
      driverId: driver2.id,
      status: 'OUT_FOR_DELIVERY',
      type: 'ITEM',
      guaranteeActive: false,
      itemsManifest: JSON.stringify([
        { id: 'i1', name: 'Suit (2-Piece)', quantity: 2, unitPrice: 4500 },
        { id: 'i2', name: 'Shirt', quantity: 4, unitPrice: 500 },
      ]),
      totalPrice: 2 * 4500 + 4 * 500,
      pickupAddress: '23 Bourdillon Rd, Ikoyi, Lagos',
      pickupDate: new Date('2026-08-22T10:00:00.000Z'),
      pickupTimeSlot: '10:00 - 11:00',
      deliveryAddress: '23 Bourdillon Rd, Ikoyi, Lagos',
      deliveryDate: new Date('2026-08-24T15:00:00.000Z'),
      pickedUpAt: new Date('2026-08-22T10:20:00.000Z'),
      atStationAt: new Date('2026-08-22T11:30:00.000Z'),
      processingAt: new Date('2026-08-23T08:00:00.000Z'),
      finishingAt: new Date('2026-08-23T18:00:00.000Z'),
      outForDeliveryAt: new Date('2026-08-24T13:00:00.000Z'),
    },
  })

  const order3 = await db.order.create({
    data: {
      orderNumber: 'KZ-1003',
      userId: b2b1.id,
      driverId: driver1.id,
      status: 'PICKED_UP',
      type: 'KG',
      guaranteeActive: false,
      itemsManifest: '[]',
      pickupAddress: 'Marina Rd, Lagos Island, Lagos',
      pickupDate: new Date('2026-08-23T08:00:00.000Z'),
      pickupTimeSlot: '08:00 - 09:00',
      deliveryAddress: 'Marina Rd, Lagos Island, Lagos',
      pickedUpAt: new Date('2026-08-23T08:30:00.000Z'),
    },
  })

  const order4 = await db.order.create({
    data: {
      orderNumber: 'KZ-1004',
      userId: b2c1.id,
      status: 'PAYMENT_PENDING_VERIFICATION',
      type: 'ITEM',
      guaranteeActive: true,
      itemsManifest: JSON.stringify([
        { id: 'i1', name: 'Ankara Gown', quantity: 3, unitPrice: 1800 },
        { id: 'i2', name: 'Iro & Buba', quantity: 2, unitPrice: 2000 },
      ]),
      totalPrice: Math.round((3 * 1800 + 2 * 2000) * 0.95),
      pickupAddress: '5 Adeniyi Jones Ave, Ikeja, Lagos',
      pickupDate: new Date('2026-08-25T09:00:00.000Z'),
      pickupTimeSlot: '09:00 - 10:00',
      deliveryAddress: '5 Adeniyi Jones Ave, Ikeja, Lagos',
    },
  })

  const order5 = await db.order.create({
    data: {
      orderNumber: 'KZ-1005',
      userId: b2b2.id,
      driverId: driver2.id,
      status: 'PROCESSING',
      type: 'KG',
      guaranteeActive: false,
      itemsManifest: '[]',
      finalWeight: 45,
      totalPrice: 45 * 800,
      pickupAddress: 'Lekki-Epe Expressway, Lagos',
      pickupDate: new Date('2026-08-21T07:00:00.000Z'),
      pickupTimeSlot: '07:00 - 08:00',
      deliveryAddress: 'Lekki-Epe Expressway, Lagos',
      pickedUpAt: new Date('2026-08-21T07:30:00.000Z'),
      atStationAt: new Date('2026-08-21T09:00:00.000Z'),
      processingAt: new Date('2026-08-22T08:00:00.000Z'),
    },
  })

  console.log(`  ✓ ${5} orders created`)

  // ----- PAYMENTS -----
  console.log('Creating payments...')
  await Promise.all([
    db.payment.create({
      data: {
        orderId: order1.id,
        amount: 6900,
        method: 'BANK_TRANSFER',
        status: 'VERIFIED',
        verifiedAt: new Date('2026-08-17T22:00:00.000Z'),
        verifiedById: admin.id,
      },
    }),
    db.payment.create({
      data: {
        orderId: order2.id,
        amount: 11000,
        method: 'PAYSTACK',
        status: 'VERIFIED',
        paystackRef: 'PSK_DEMO_KZ1002',
        verifiedAt: new Date('2026-08-21T20:00:00.000Z'),
      },
    }),
    db.payment.create({
      data: {
        orderId: order3.id,
        amount: 0,
        method: 'BANK_TRANSFER',
        status: 'PENDING',
      },
    }),
    db.payment.create({
      data: {
        orderId: order4.id,
        amount: 8930,
        method: 'BANK_TRANSFER',
        status: 'PENDING',
        receiptUrl: 'mock-receipt-1004',
      },
    }),
    db.payment.create({
      data: {
        orderId: order5.id,
        amount: 36000,
        method: 'BANK_TRANSFER',
        status: 'VERIFIED',
        verifiedAt: new Date('2026-08-21T18:00:00.000Z'),
        verifiedById: admin.id,
      },
    }),
  ])
  console.log(`  ✓ ${5} payments created`)

  console.log('\n🎉 Seed complete! Log in to Supabase → Table Editor to view the data.')
  console.log('\nDemo logins:')
  console.log('  Customer: chioma.eze@gmail.com / +234 807 444 1122')
  console.log('  Customer: femi.adeyemi@yahoo.com / +234 809 555 3344')
  console.log('  Corporate: procurement@meridianhotels.com / +234 811 666 7788')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
