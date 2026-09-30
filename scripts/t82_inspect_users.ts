// t82_inspect_users.ts — READ-ONLY prod inspection (Task 82)
// Usage: npx tsx scripts/t82_inspect_users.ts <DIRECT_URL>
import { PrismaClient } from '@prisma/client'

const url = process.argv[2]
if (!url) {
  console.error('pass the DIRECT_URL as argv[2]')
  process.exit(1)
}
const db = new PrismaClient({ datasources: { db: { url } } })

async function main() {
  const users = await db.user.findMany({
    where: { role: { in: ['B2C', 'B2B'] } },
    orderBy: { createdAt: 'desc' },
    take: 40,
    select: {
      id: true, email: true, name: true, role: true,
      emailVerified: true, createdAt: true,
      _count: { select: { orders: true, subscriptions: true } },
    },
  })
  console.log(`=== ${users.length} customer accounts (newest first) ===`)
  for (const u of users) {
    console.log(
      [
        u.email.padEnd(38),
        (u.name ?? '?').slice(0, 20).padEnd(20),
        u.role,
        u.emailVerified ? 'verified  ' : 'UNVERIFIED',
        `orders=${u._count.orders}`,
        `subs=${u._count.subscriptions}`,
        `joined=${u.createdAt.toISOString().slice(0, 16).replace('T', ' ')}`,
      ].join(' ')
    )
  }

  const subs = await db.subscription.findMany({
    include: { plan: true, user: { select: { email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  console.log(`\n=== ${subs.length} subscriptions (newest first) ===`)
  for (const s of subs) {
    console.log(
      [
        (s.user?.email ?? '?').padEnd(38),
        (s.plan?.code ?? '?').padEnd(12),
        `status=${s.status}`.padEnd(24),
        `price=${s.pricePaid}`,
        `method=${s.paymentMethod ?? '-'}`,
        `periodEnd=${s.periodEnd?.toISOString().slice(0, 10) ?? '-'}`,
        `cancelAtEnd=${s.cancelAtPeriodEnd}`,
        `created=${s.createdAt.toISOString().slice(0, 16).replace('T', ' ')}`,
      ].join(' ')
    )
  }

  const events = await db.subscriptionEvent.findMany({
    where: { kind: { in: ['RENEWAL_INTENT', 'CYCLE_START', 'PLAN_CHANGE', 'PLAN_CHANGE_SCHEDULED'] } },
    orderBy: { createdAt: 'desc' },
    take: 25,
    include: { subscription: { include: { user: { select: { email: true } } } } },
  })
  console.log(`\n=== last ${events.length} membership events ===`)
  for (const e of events) {
    console.log(
      [
        (e.subscription?.user?.email ?? '?').padEnd(38),
        e.kind.padEnd(22),
        `at=${e.createdAt.toISOString().slice(0, 16).replace('T', ' ')}`,
        (e.meta ?? '').slice(0, 110),
      ].join(' ')
    )
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
