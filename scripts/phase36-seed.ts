// Phase 36 local E2E seed: admin + customer + price catalog + coupon test data
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'
import { GARMENT_CATALOG } from '../src/lib/types'

async function main() {
  // Clean old test data
  await db.newsletterRecipient.deleteMany({})
  await db.newsletterCampaign.deleteMany({})
  await db.newsletterSubscriber.deleteMany({})
  await db.discountUsage.deleteMany({})
  await db.user.deleteMany({ where: { email: { endsWith: '@kozy-test.example' } } })

  // Admin
  const adminEmail = 'admin36@kozy-test.example'
  await db.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Phase 36 Admin',
      phone: '+234 800 000 0001',
      role: 'ADMIN',
      passwordHash: await bcrypt.hash('Phase36!Admin2026', 10),
      emailVerified: new Date(),
      accessStatus: 'ACTIVE',
    },
  })
  console.log('admin:', adminEmail)

  // A B2C customer WITH an order history (so INACTIVE segment works against another user)
  const customerEmail = 'customer36@kozy-test.example'
  await db.user.upsert({
    where: { email: customerEmail },
    update: {},
    create: {
      email: customerEmail,
      name: 'Phase 36 Customer',
      phone: '+234 800 000 0002',
      role: 'B2C',
      passwordHash: await bcrypt.hash('Phase36!Customer2026', 10),
      emailVerified: new Date(),
      accessStatus: 'ACTIVE',
      signupDiscountUsed: true, // not first order
    },
  })
  console.log('customer:', customerEmail)

  // Price catalog (server-side pricing source)
  const existingPrices = await db.priceCatalog.count()
  if (existingPrices === 0) {
    await db.priceCatalog.createMany({
      data: GARMENT_CATALOG.map((g) => ({
        itemKey: g.id,
        label: g.name,
        unitPrice: g.price,
        category: g.category,
        active: true,
      })),
    })
    console.log('price catalog seeded:', GARMENT_CATALOG.length, 'items')
  } else {
    console.log('price catalog already has', existingPrices, 'items')
  }

  console.log('SEED DONE')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .then(() => process.exit(0))
