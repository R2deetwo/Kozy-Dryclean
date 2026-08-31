// Seed E2E artifacts for the phase-25 test run (against the PRODUCTION DB —
// everything created here uses .example emails and is removed by
// e2e-cleanup25.ts afterwards).
//   - e2e-admin25@kozy-test.example            (ADMIN, for login)
//   - e2e-p25-user@kozy-test.example           (owner of the orders)
//   - KZ-E2EP25R: PAYMENT_PENDING_VERIFICATION + REJECTED transfer (removable)
//   - KZ-E2EP25P: PAYMENT_PENDING_VERIFICATION + PENDING transfer (removable)
//   - KZ-E2EP25V: PAYMENT_VERIFIED + VERIFIED payment (delete must be blocked)
// Prints seeded ids for the E2E script to consume.
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

const TINY_RECEIPT =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

async function main() {
  const adminEmail = 'e2e-admin25@kozy-test.example'
  const passwordHash = await bcrypt.hash('E2e-Admin-Pw-2525!', 10)
  const admin = await db.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, role: 'ADMIN', emailVerified: new Date() },
    create: {
      email: adminEmail,
      name: 'E2E Admin 25',
      phone: '+2347000000025',
      role: 'ADMIN',
      passwordHash,
      emailVerified: new Date(),
    },
  })
  console.log(`ADMIN ${admin.email}`)

  const custEmail = 'e2e-p25-user@kozy-test.example'
  const cust = await db.user.upsert({
    where: { email: custEmail },
    update: {},
    create: {
      email: custEmail,
      name: 'E2E Phase25 User',
      phone: '+2347000000125',
      role: 'B2C',
      passwordHash: await bcrypt.hash('E2e-Cust-Pw-2525!', 10),
      emailVerified: new Date(),
    },
  })

  const old = await db.order.findMany({ where: { userId: cust.id }, select: { id: true } })
  if (old.length > 0) {
    await db.payment.deleteMany({ where: { orderId: { in: old.map((o) => o.id) } } })
    await db.garmentMedia.deleteMany({ where: { orderId: { in: old.map((o) => o.id) } } })
    await db.statusEvent.deleteMany({ where: { orderId: { in: old.map((o) => o.id) } } })
    await db.order.deleteMany({ where: { userId: cust.id } })
  }

  const mk = async (suffix: string, status: any, payStatus: any, receipt: boolean) => {
    const orderNumber = `KZ-E2EP25${suffix}`
    const order = await db.order.create({
      data: {
        orderNumber,
        userId: cust.id,
        status,
        type: 'ITEM',
        serviceSpeed: 'STANDARD',
        modeOfWash: 'MACHINE',
        totalPrice: 6000,
        itemsManifest: JSON.stringify([{ id: 'shirt', name: 'Shirt', quantity: 2, unitPrice: 3000 }]),
        pickupAddress: '25 Phase 25 Test Close, Lekki Phase 1',
        pickupDate: new Date(Date.now() + 24 * 3600 * 1000),
        pickupTimeSlot: '09:00 – 11:00',
        payments: {
          create: {
            amount: 6000,
            method: 'BANK_TRANSFER',
            status: payStatus,
            ...(receipt ? { receiptUrl: TINY_RECEIPT } : {}),
            ...(payStatus === 'VERIFIED' ? { verifiedAt: new Date(), verifiedById: admin.id } : {}),
          },
        },
      },
    })
    console.log(`ORDER ${orderNumber} ${order.id}`)
    return order
  }

  await mk('R', 'PAYMENT_PENDING_VERIFICATION', 'REJECTED', true)
  await mk('P', 'PAYMENT_PENDING_VERIFICATION', 'PENDING', false)
  await mk('V', 'PAYMENT_VERIFIED', 'VERIFIED', false)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
