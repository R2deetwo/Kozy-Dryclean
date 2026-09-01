// Seed Phase-24 E2E artifacts (production DB; .example emails; cleaned up
// by the p24 cleanup after the run):
//   - p24-user@kozy-test.example  (B2C customer, password known to the suite)
//   - Order KZ-P24Exx: REQUESTED, NO payment  (transfer-confirm + dedup moves)
//   - Order KZ-P24Fxx: REQUESTED + PENDING bank-transfer payment (verify dedup)
// Prints the seeded order numbers for the Playwright/requests suite.
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

const TINY_RECEIPT =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhUhEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

async function main() {
  const suffix = Date.now().toString().slice(-6)
  const email = `p24-user-${suffix}@kozy-test.example`
  const passwordHash = await bcrypt.hash('P24-User-Pw-3151!', 10)

  const user = await db.user.upsert({
    where: { email },
    update: { passwordHash, emailVerified: new Date(), role: 'B2C' },
    create: {
      email,
      name: 'P24 Stage User',
      phone: '+2347000000242',
      role: 'B2C',
      passwordHash,
      emailVerified: new Date(),
    },
  })

  const mk = async (n: number, withPayment: boolean) => {
    const orderNumber = `KZ-P24${String.fromCharCode(64 + n)}${suffix}`
    const order = await db.order.create({
      data: {
        orderNumber,
        userId: user.id,
        status: 'REQUESTED',
        type: 'ITEM',
        pickupAddress: 'P24 Test Street 24, Lekki Phase 1',
        pickupDate: new Date(Date.now() + 48 * 3600 * 1000),
        pickupTimeSlot: '10:00 – 12:00',
        totalPrice: 12500,
        itemsManifest: JSON.stringify([{ id: 'shirt', qty: 3 }]),
      },
    })
    if (withPayment) {
      await db.payment.create({
        data: {
          orderId: order.id,
          amount: 12500,
          method: 'BANK_TRANSFER',
          status: 'PENDING',
          receiptUrl: TINY_RECEIPT,
        },
      })
    }
    return orderNumber
  }

  const orderE = await mk(5, false)
  const orderF = await mk(6, true)

  console.log(JSON.stringify({ email, password: 'P24-User-Pw-3151!', orderE, orderF }))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
