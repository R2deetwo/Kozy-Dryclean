// Phase 55 post-deploy checks: prod schema sync + safety counts.
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } })

async function main() {
  const cols: any[] = await db.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name='RiderIncident' ORDER BY ordinal_position;`
  )
  console.log('RiderIncident columns:', cols.map((c) => c.column_name).join(', '))
  const apps: any[] = await db.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "RiderApplication";`)
  const drivers: any[] = await db.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "User" WHERE role='DRIVER';`)
  const incidents: any[] = await db.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "RiderIncident";`)
  console.log('applications:', apps[0].n, '| DRIVER accounts:', drivers[0].n, '| incidents:', incidents[0].n)
}
main().catch((e) => { console.error('ERR', e.message); process.exit(1) }).finally(() => db.$disconnect())
