// Phase 40 local E2E seed: admin + customers (one opted-OUT to prove
// unsubscribe semantics) + footer subscriber. FK-safe cleanup of earlier
// phase test rows. Run with DATABASE_URL pointed at the embedded Postgres.
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

async function main() {
  // ---- Clean old test data (FK-safe order) ----
  await db.newsletterRecipient.deleteMany({})
  await db.newsletterCampaign.deleteMany({})
  await db.newsletterSubscriber.deleteMany({})
  await db.marketingSchedule.deleteMany({})
  await db.discountUsage.deleteMany({})

  const testUsers = await db.user.findMany({
    where: { email: { endsWith: '@kozy-test.example' } },
    select: { id: true },
  })
  const ids = testUsers.map((u) => u.id)
  if (ids.length > 0) {
    await db.order.deleteMany({ where: { userId: { in: ids } } })
    await db.user.deleteMany({ where: { id: { in: ids } } })
  }

  // ---- Admin ----
  const adminEmail = 'admin40@kozy-test.example'
  await db.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Phase 40 Admin',
      phone: '+234 800 000 0001',
      role: 'ADMIN',
      passwordHash: await bcrypt.hash('Phase40!Admin2026', 10),
      emailVerified: new Date(),
      accessStatus: 'ACTIVE',
    },
  })
  console.log('admin:', adminEmail)

  // ---- Customers: two opted-in, one UNSUBSCRIBED (marketingOptIn=false) ----
  const customerSeeds = [
    { email: 'customer40@kozy-test.example', name: 'Ada Customer', role: 'B2C', optIn: true },
    { email: 'chidi40@kozy-test.example', name: 'Chidi Customer', role: 'B2C', optIn: true },
    { email: 'unsub40@kozy-test.example', name: 'Unsub Customer', role: 'B2C', optIn: false },
    { email: 'hotel40@kozy-test.example', name: 'Hotel Customer', role: 'B2B', optIn: true },
  ]
  for (const c of customerSeeds) {
    await db.user.upsert({
      where: { email: c.email },
      update: { marketingOptIn: c.optIn },
      create: {
        email: c.email,
        name: c.name,
        phone: '+234 800 000 0002',
        role: c.role,
        passwordHash: await bcrypt.hash('Phase40!Customer2026', 10),
        emailVerified: new Date(),
        accessStatus: 'ACTIVE',
        signupDiscountUsed: true,
        marketingOptIn: c.optIn,
      },
    })
  }
  console.log('customers:', customerSeeds.map((c) => `${c.email}(${c.optIn ? 'in' : 'OUT'})`).join(', '))

  // ---- Footer subscriber (opted in) + one unsubscribed subscriber ----
  await db.newsletterSubscriber.create({
    data: { email: 'sub40@kozy-test.example', name: 'Footer Sub', source: 'footer', optIn: true },
  })
  await db.newsletterSubscriber.create({
    data: {
      email: 'gone40@kozy-test.example',
      name: 'Gone Sub',
      source: 'footer',
      optIn: false,
      unsubscribedAt: new Date(),
    },
  })
  console.log('subscribers: sub40 (in), gone40 (out)')

  console.log('SEED DONE')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .then(() => process.exit(0))
