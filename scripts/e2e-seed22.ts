// Seed E2E artifacts for the phase-22 test run (against the PRODUCTION DB —
// everything created here uses .example emails and is removed by
// e2e-cleanup22.ts afterwards).
//   - e2e-admin22@kozy-test.example        (ADMIN, for login)
//   - e2e-kanban-user@kozy-test.example    (owner of orders A–D)
//   - Orders A/B/D: PAYMENT_PENDING_VERIFICATION + PENDING transfer
//     (A with a tiny receipt data-URL, B without, D for dropdown auto-verify)
//   - Order C: PICKED_UP + PENDING transfer (late payment — must NOT regress)
// Prints the seeded order numbers for the Playwright script to consume.
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

// 1x1 transparent PNG (base64) — stands in for the customer's receipt shot.
const TINY_RECEIPT =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

async function main() {
  // ----- Admin -----
  const adminEmail = 'e2e-admin22@kozy-test.example'
  const passwordHash = await bcrypt.hash('E2e-Admin-Pw-7261!', 10)
  const admin = await db.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, role: 'ADMIN', emailVerified: new Date() },
    create: {
      email: adminEmail,
      name: 'E2E Admin 22',
      phone: '+2347000000022',
      role: 'ADMIN',
      passwordHash,
      emailVerified: new Date(),
    },
  })
  console.log(`ADMIN ${admin.email}`)

  // ----- Customer owning the pipeline orders -----
  const custEmail = 'e2e-kanban-user@kozy-test.example'
  const cust = await db.user.upsert({
    where: { email: custEmail },
    update: {},
    create: {
      email: custEmail,
      name: 'E2E Kanban User',
      phone: '+2347000000023',
      role: 'B2C',
      passwordHash: await bcrypt.hash('E2e-Cust-Pw-7261!', 10),
      emailVerified: new Date(),
    },
  })

  // Clean any previous run's orders for this user
  const old = await db.order.findMany({ where: { userId: cust.id }, select: { id: true } })
  if (old.length > 0) {
    await db.payment.deleteMany({ where: { orderId: { in: old.map((o) => o.id) } } })
    await db.garmentMedia.deleteMany({ where: { orderId: { in: old.map((o) => o.id) } } })
    await db.statusEvent.deleteMany({ where: { orderId: { in: old.map((o) => o.id) } } })
    await db.order.deleteMany({ where: { userId: cust.id } })
  }

  const mkOrder = async (suffix: string, status: any, payment: { receipt?: boolean } | null) => {
    const orderNumber = `KZ-E2E${suffix}`
    const order = await db.order.create({
      data: {
        orderNumber,
        userId: cust.id,
        status,
        type: 'ITEM',
        serviceSpeed: 'STANDARD',
        modeOfWash: 'MACHINE',
        totalPrice: 5000,
        itemsManifest: JSON.stringify([{ id: 'shirt', name: 'Shirt', quantity: 2, unitPrice: 2500 }]),
        pickupAddress: '12 E2E Test Close, Lekki Phase 1',
        pickupDate: new Date(Date.now() + 24 * 3600 * 1000),
        pickupTimeSlot: '09:00 – 11:00',
        ...(status === 'PICKED_UP' ? { pickedUpAt: new Date() } : {}),
        ...(payment
          ? {
              payments: {
                create: {
                  amount: 5000,
                  method: 'BANK_TRANSFER',
                  status: 'PENDING',
                  ...(payment.receipt ? { receiptUrl: TINY_RECEIPT } : {}),
                },
              },
            }
          : {}),
      },
    })
    console.log(`ORDER ${orderNumber}`)
    return order
  }

  await mkOrder('A5511', 'PAYMENT_PENDING_VERIFICATION', { receipt: true })
  await mkOrder('B6622', 'PAYMENT_PENDING_VERIFICATION', { receipt: false })
  await mkOrder('C7733', 'PICKED_UP', { receipt: false })
  await mkOrder('D8844', 'PAYMENT_PENDING_VERIFICATION', { receipt: false })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
