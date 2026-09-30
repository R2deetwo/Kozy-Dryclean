// t80_prod_inspect.ts — read-only look at the dv5u6wcr5y test account + all subs
// Usage: npx tsx scripts/t80_prod_inspect.ts <DIRECT_URL>
import { PrismaClient } from '@prisma/client'

const url = process.argv[2]
if (!url) {
  console.error('pass the DIRECT_URL as argv[2]')
  process.exit(1)
}
const db = new PrismaClient({ datasources: { db: { url } } })

async function main() {
  const user = await db.user.findFirst({
    where: { email: { contains: 'dv5u6wcr5y' } },
    include: { subscriptions: { include: { plan: true } } },
  })
  console.log('=== test account ===')
  if (user) {
    console.log('user:', user.id, user.email, 'role=', user.role, 'createdAt=', user.createdAt.toISOString())
    for (const s of user.subscriptions) {
      console.log(JSON.stringify({
        id: s.id,
        plan: s.plan?.code,
        family: s.plan?.family,
        status: s.status,
        method: s.paymentMethod,
        ref: s.paystackRef,
        pricePaid: s.pricePaid,
        periodStart: s.periodStart,
        periodEnd: s.periodEnd,
        createdAt: s.createdAt,
        hasReceipt: Boolean(s.transferReceipt),
      }, null, 2))
    }
  } else {
    console.log('NOT FOUND')
  }

  console.log('\n=== all subscriptions (latest 15) ===')
  const subs = await db.subscription.findMany({
    include: { plan: true, user: { select: { email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 15,
  })
  for (const s of subs) {
    console.log(
      [
        s.id.slice(0, 8),
        (s.user?.email ?? '?').padEnd(34),
        (s.plan?.code ?? '?').padEnd(12),
        `status=${s.status}`,
        `method=${s.paymentMethod ?? '-'}`,
        `pricePaid=${s.pricePaid}`,
        `periodEnd=${s.periodEnd?.toISOString().slice(0, 10) ?? '-'}`,
        `created=${s.createdAt.toISOString()}`,
      ].join(' ')
    )
  }

  console.log('\n=== recent subscription events (20) ===')
  const events = await db.subscriptionEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 20 })
  for (const e of events) {
    console.log(e.createdAt.toISOString(), e.kind, e.subscriptionId.slice(0, 8), (e.note ?? '').slice(0, 80))
  }
}

main()
  .catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
  .finally(() => db.$disconnect())
