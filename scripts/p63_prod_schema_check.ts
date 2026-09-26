// Phase 63 — verify the phase 61/62 tables exist in PRODUCTION (Supabase)
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } })

async function main() {
  const tables = ['PushSubscription', 'Branch', 'SubscriptionPlan', 'Subscription', 'Partner'] as const
  for (const t of tables) {
    try {
      const n = await (db as any)[t].count()
      console.log(`${t}: ${n} rows`)
    } catch (e) {
      console.log(`${t}: MISSING — ${String(e).slice(0, 90)}`)
    }
  }
  // Column-level check on Order (branchId etc. — prisma count won't fail on
  // a missing column, so probe one row's keys through raw SQL)
  const cols = await db.$queryRawUnsafe(
    `select column_name from information_schema.columns where table_name = 'Order' and column_name in ('branchId','subscriptionId','fulfilledByPartnerId')`
  )
  console.log('Order branch columns:', JSON.stringify(cols))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
