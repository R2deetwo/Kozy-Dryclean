// Phase-32 E2E test data: a B2C customer + two orders + payments used to
// probe staff RBAC (cancel/price/financial-record blocks, anomaly flags,
// completed-cycle hiding). All of it is removed by phase32-e2e-cleanup.ts.
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

const CUST_EMAIL = 'e2e-cust-phase32@kozy-test.example'

async function main() {
  await db.user.deleteMany({ where: { email: CUST_EMAIL } })
  // Also clear any leftover test orders from an interrupted run
  await db.order.deleteMany({ where: { orderNumber: { startsWith: 'KZ-E2E32-' } } })

  const cust = await db.user.create({
    data: {
      email: CUST_EMAIL,
      name: 'E2E Customer Phase32',
      phone: '+2348000000099',
      role: 'B2C',
      passwordHash: await bcrypt.hash('E2eCust-Phase32!x', 10),
      emailVerified: new Date(),
      address: '12 Alexander Ave, Ikoyi, Lagos',
    },
  })

  const mk = (n: number, status: any, totalPrice: number | null) =>
    db.order.create({
      data: {
        orderNumber: `KZ-E2E32-${n}`,
        userId: cust.id,
        type: 'ITEM',
        status,
        totalPrice,
        itemsManifest: JSON.stringify([{ name: 'Shirt', quantity: 2, unitPrice: 300 }]),
        pickupAddress: '12 Alexander Ave, Ikoyi, Lagos',
        deliveryAddress: '12 Alexander Ave, Ikoyi, Lagos',
        pickupDate: new Date(),
        pickupTimeSlot: '10:00 – 12:00',
      },
    })

  // O1: the kanban-move probe order (stays unpaid the whole time)
  const o1 = await mk(1, 'REQUESTED', 5000)
  // O2: carries a VERIFIED payment (financial-record protection probe) and
  // a PENDING one (staff verify day-job probe)
  const o2 = await mk(2, 'PAYMENT_PENDING_VERIFICATION', 6000)
  await db.payment.create({
    data: { orderId: o2.id, amount: 6000, method: 'BANK_TRANSFER', status: 'VERIFIED', verifiedAt: new Date() },
  })
  await db.payment.create({
    data: { orderId: o2.id, amount: 6000, method: 'BANK_TRANSFER', status: 'PENDING' },
  })

  console.log('CUSTOMER:', cust.id)
  console.log('O1 (move probes):', o1.id, o1.orderNumber, 'REQUESTED/5000 unpaid')
  console.log('O2 (payment probes):', o2.id, o2.orderNumber, 'PAYMENT_PENDING_VERIFICATION + VERIFIED & PENDING payments')
}

main()
  .catch((e) => {
    console.error('DATA SETUP FAILED:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
