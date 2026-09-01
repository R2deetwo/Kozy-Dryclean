// Inspect/patch AppSetting rows (helper for E2E verification).
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

const cmd = process.argv[2] ?? 'list'
const key = process.argv[3]
const value = process.argv[4]

async function main() {
  if (cmd === 'list') {
    const rows = await db.appSetting.findMany({ orderBy: { key: 'asc' } })
    for (const r of rows) console.log(r.key, '=', r.value)
  } else if (cmd === 'set') {
    if (!key || value === undefined) throw new Error('usage: set <key> <json-value>')
    await db.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    })
    console.log('set', key, '=', value)
  } else if (cmd === 'count-test-users') {
    const users = await db.user.findMany({
      where: { email: { contains: 'kozy-test.example' } },
      select: { email: true, role: true },
    })
    console.log('test-domain users:', users.length)
    for (const u of users) console.log(' -', u.email, u.role)
    const orders = await db.order.count({
      where: { orderNumber: { startsWith: 'KZ-E2E' } },
    })
    console.log('E2E orders:', orders)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
