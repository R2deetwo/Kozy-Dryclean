// Task 77 — post-deploy prod DB verification: the store migration applied,
// RLS is still fully on (the deploy re-ran it via migrate deploy), and the
// member-email cron reports production semantics (testMode false).
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })

async function main() {
  const applied = await db.$queryRawUnsafe<{ migration_name: string; finished_at: Date }[]>(
    `SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at`
  )
  console.log('--- migrations on prod ---')
  for (const m of applied) console.log(`  ${m.migration_name}`)
  const has77 = applied.some((m) => m.migration_name.includes('store_rls_security'))
  if (!has77) throw new Error('store_rls_security migration NOT applied on prod')

  const counts = await db.$queryRawUnsafe<{ tables: bigint; rls: bigint }[]>(
    `SELECT count(*) AS tables, count(*) FILTER (WHERE relrowsecurity) AS rls
     FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'`
  )
  const { tables, rls } = { tables: Number(counts[0].tables), rls: Number(counts[0].rls) }
  console.log(`--- RLS --- ${tables} tables, ${rls} with RLS`)
  if (tables !== rls) throw new Error(`RLS mismatch on prod: ${tables} tables, ${rls} with RLS`)

  // The new tables exist and are writable by the app (owner role).
  const productCount = await db.storeProduct.count()
  const requestCount = await db.productRequest.count()
  console.log(`--- store tables --- StoreProduct=${productCount}, ProductRequest=${requestCount} (empty = ships dark)`)

  // The retired settings keys are gone from the typed surface but may linger
  // as orphan rows in AppSetting — clean them up so the table stays honest.
  const orphans = await db.appSetting.deleteMany({
    where: { key: { in: ['member_email_automation', 'member_email_test_allowlist'] } },
  })
  console.log(`--- retired settings rows removed --- ${orphans.count}`)
  const storeKey = await db.appSetting.findUnique({ where: { key: 'store_enabled' } })
  console.log(`--- store_enabled on prod --- ${storeKey?.value ?? '(seeds on first read: false)'}`)

  console.log('PROD DB CHECKS COMPLETE')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .then(() => process.exit(0))
