// Phase 72: publish default rider rates ONLY if currently unpublished (0/0).
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
async function main() {
  const rows = await p.appSetting.findMany({ where: { key: { in: ['rider_pickup_rate', 'rider_delivery_rate'] } } })
  const cur = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]))
  console.log('current rates:', JSON.stringify(cur))
  const untouched = (cur.rider_pickup_rate ?? 0) === 0 && (cur.rider_delivery_rate ?? 0) === 0
  if (!untouched) {
    console.log('rates already set by the office — NOT touching them')
    return
  }
  for (const [key, value] of [['rider_pickup_rate', 500], ['rider_delivery_rate', 500]]) {
    if (rows.some((r) => r.key === key)) {
      await p.appSetting.update({ where: { key }, data: { value: JSON.stringify(value) } })
    } else {
      await p.appSetting.create({ data: { key, value: JSON.stringify(value) } })
    }
  }
  const after = await p.appSetting.findMany({ where: { key: { in: ['rider_pickup_rate', 'rider_delivery_rate'] } } })
  console.log('published:', JSON.stringify(Object.fromEntries(after.map((r) => [r.key, JSON.parse(r.value)]))))
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => p.$disconnect())
