// Phase-24 recon: why did the owner not receive admin alert emails?
// 1) What are the live alert settings? 2) Did signups/payment-confirmations
// actually happen after the phase-22 deploy that introduced alerts?
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const settings = await db.appSetting.findMany({
    where: { key: { startsWith: 'admin_alerts' } },
  })
  console.log('--- AppSetting (admin_alerts*) ---')
  for (const s of settings) console.log(s.key, '=', s.value)

  console.log('\n--- Users created in the last 30 days (newest first, max 15) ---')
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000)
  const users = await db.user.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 15,
    select: { name: true, email: true, role: true, createdAt: true, emailVerified: true },
  })
  for (const u of users)
    console.log(
      u.createdAt.toISOString(),
      '|', u.email, '|', u.role, '| verified:', !!u.emailVerified
    )
  const total = await db.user.count({ where: { createdAt: { gte: since } } })
  console.log('total signups last 30d:', total)

  console.log('\n--- Payments PENDING / verified in last 30 days ---')
  const payments = await db.payment.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 15,
    select: {
      status: true,
      createdAt: true,
      verifiedAt: true,
      order: { select: { orderNumber: true, user: { select: { email: true } } } },
    },
  })
  for (const p of payments)
    console.log(
      p.createdAt.toISOString(),
      '|', p.status, '| order:', p.order?.orderNumber,
      '| user:', p.order?.user?.email
    )
  const pTotal = await db.payment.count({ where: { createdAt: { gte: since } } })
  console.log('total payments last 30d:', pTotal)

  console.log('\n--- Current admins in the DB ---')
  const admins = await db.user.findMany({
    where: { role: 'ADMIN' },
    select: { email: true, name: true, createdAt: true, emailVerified: true },
  })
  for (const a of admins)
    console.log(a.email, '|', a.name, '| created:', a.createdAt.toISOString(), '| verified:', !!a.emailVerified)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
