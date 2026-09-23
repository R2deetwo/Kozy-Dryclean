// Phase 54 production DB check — verifies the deploy's `prisma db push`
// landed the new RiderApplication columns on Supabase (and prints the
// production rider/app counts for the worklog). Run with DB_URL=<prod
// DIRECT_URL>.
const { PrismaClient } = require('@prisma/client')

async function main() {
  const p = new PrismaClient({ datasources: { db: { url: process.env.DB_URL } } })
  const cols = await p.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='RiderApplication' ORDER BY ordinal_position`
  )
  const names = cols.map((c) => c.column_name)
  console.log('RiderApplication columns in PROD:', names.join(', '))
  const need = ['refCode', 'userId', 'reviewedById', 'reviewedAt', 'decisionNote']
  const missing = need.filter((n) => !names.includes(n))
  console.log('phase-54 columns present:', missing.length === 0 ? 'ALL' : `MISSING ${missing.join(',')}`)
  const apps = await p.$queryRawUnsafe('SELECT count(*)::int AS n FROM "RiderApplication"')
  const drivers = await p.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "User" WHERE role='DRIVER'`)
  console.log(`prod rider applications: ${apps[0].n} | DRIVER accounts: ${drivers[0].n}`)
  await p.$disconnect()
  process.exit(missing.length === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('CHECK FAILED:', e.message)
  process.exit(1)
})
