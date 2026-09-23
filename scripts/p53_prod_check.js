// Phase 53 production DB check — verifies the deploy's `prisma db push`
// actually landed the loyaltyFree column on Supabase (and prints the
// production counts for the worklog). Run with DB_URL=<prod DIRECT_URL>.
const { PrismaClient } = require('@prisma/client')

async function main() {
  const p = new PrismaClient({ datasources: { db: { url: process.env.DB_URL } } })
  const col = await p.$queryRawUnsafe(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name='Order' AND column_name='loyaltyFree'`
  )
  console.log('loyaltyFree column in PROD:', JSON.stringify(col))
  const orders = await p.$queryRawUnsafe('SELECT count(*)::int AS n FROM "Order"')
  const users = await p.$queryRawUnsafe('SELECT count(*)::int AS n FROM "User"')
  const delivered = await p.$queryRawUnsafe(
    `SELECT count(*)::int AS n FROM "Order" WHERE status='DELIVERED'`
  )
  console.log(`prod orders: ${orders[0].n} | users: ${users[0].n} | delivered: ${delivered[0].n}`)
  await p.$disconnect()
  process.exit(col.length === 1 ? 0 : 1)
}

main().catch((e) => {
  console.error('CHECK FAILED:', e.message)
  process.exit(1)
})
