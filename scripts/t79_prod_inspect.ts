// t79_prod_inspect.ts — read-only look at production memberships
// Usage: npx tsx scripts/t79_prod_inspect.ts <DATABASE_URL>
import { PrismaClient } from '@prisma/client'

const url = process.argv[2]
if (!url) {
  console.error('pass the DIRECT_URL as argv[2]')
  process.exit(1)
}
const db = new PrismaClient({ datasources: { db: { url } } })

async function main() {
  const subs = await db.subscription.findMany({
    include: { plan: true, user: { select: { email: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })
  console.log(`=== ${subs.length} subscriptions in production ===`)
  for (const s of subs) {
    console.log(
      [
        s.id.slice(0, 8),
        (s.user?.email ?? '?').padEnd(34),
        (s.plan?.code ?? '?').padEnd(12),
        `status=${s.status}`.padEnd(28),
        `eff?`,
        `method=${s.paymentMethod ?? '-'}`,
        `ref=${s.paystackRef ?? '-'}`,
        `periodEnd=${s.periodEnd?.toISOString().slice(0, 10) ?? '-'}`,
        `created=${s.createdAt.toISOString().slice(0, 10)}`,
      ].join(' ')
    )
  }

  const events = await db.subscriptionEvent.findMany({
    where: { kind: { in: ['RENEWAL_INTENT', 'CYCLE_START'] } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  console.log(`\n=== last ${events.length} RENEWAL_INTENT / CYCLE_START events ===`)
  for (const e of events) {
    console.log(e.createdAt.toISOString(), e.kind, e.subscriptionId.slice(0, 8), e.note ?? '')
  }

  const users = await db.user.count({ where: { role: 'B2C' } })
  console.log(`\nB2C users: ${users}`)
}

main()
  .catch((e) => {
    console.error('FAILED:', e.message)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
