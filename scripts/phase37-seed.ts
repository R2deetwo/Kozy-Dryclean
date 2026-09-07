// Phase 37 local E2E seed: admin + customers + footer subscriber, with
// dependency-safe cleanup of the phase-36 test rows.
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'
import { GARMENT_CATALOG } from '../src/lib/types'

async function main() {
  // ---- Clean old test data (FK-safe order) ----
  await db.newsletterRecipient.deleteMany({})
  await db.newsletterCampaign.deleteMany({})
  await db.newsletterSubscriber.deleteMany({})
  await db.discountUsage.deleteMany({})

  const testUsers = await db.user.findMany({
    where: { email: { endsWith: '@kozy-test.example' } },
    select: { id: true },
  })
  const ids = testUsers.map((u) => u.id)
  if (ids.length > 0) {
    // Orders cascade: StatusEvent, OrderAnomaly, GarmentMedia, Payment,
    // Review, DiscountUsage
    await db.order.deleteMany({ where: { userId: { in: ids } } })
    await db.user.deleteMany({ where: { id: { in: ids } } })
  }

  // ---- Admin ----
  const adminEmail = 'admin37@kozy-test.example'
  await db.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Phase 37 Admin',
      phone: '+234 800 000 0001',
      role: 'ADMIN',
      passwordHash: await bcrypt.hash('Phase37!Admin2026', 10),
      emailVerified: new Date(),
      accessStatus: 'ACTIVE',
    },
  })
  console.log('admin:', adminEmail)

  // ---- Two B2C customers + one B2B customer (all opted in) ----
  const customerSeeds = [
    { email: 'customer37@kozy-test.example', name: 'Ada Customer', role: 'B2C' },
    { email: 'chidi37@kozy-test.example', name: 'Chidi Customer', role: 'B2C' },
    { email: 'hotel37@kozy-test.example', name: 'Hotel Customer', role: 'B2B' },
  ]
  for (const c of customerSeeds) {
    await db.user.upsert({
      where: { email: c.email },
      update: {},
      create: {
        email: c.email,
        name: c.name,
        phone: '+234 800 000 0002',
        role: c.role,
        passwordHash: await bcrypt.hash('Phase37!Customer2026', 10),
        emailVerified: new Date(),
        accessStatus: 'ACTIVE',
        signupDiscountUsed: true,
        marketingOptIn: true,
      },
    })
  }
  console.log('customers:', customerSeeds.map((c) => c.email).join(', '))

  // ---- One footer subscriber ----
  await db.newsletterSubscriber.create({
    data: {
      email: 'sub37@kozy-test.example',
      name: 'Foot Subscriber',
      optIn: true,
    },
  })
  console.log('subscriber: sub37@kozy-test.example')

  // ---- Price catalog (server-side pricing source) ----
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
