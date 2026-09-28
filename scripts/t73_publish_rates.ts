// =============================================================================
// Task 73 — publish the owner's rider-rate decision (local OR prod).
// =============================================================================
// The owner set the starting rates: "it should be N1500/N1500 to start with"
// (prod was sitting on the phase-72 defaults of 500/500). This script:
//   1. Sets rider_pickup_rate / rider_delivery_rate to 1500/1500 EXPLICITLY —
//      this is the owner's decision, not a default, so it overwrites whatever
//      is there (the phase-72 guard only ever touched 0/0 rows).
//   2. Seeds the three NEW distance keys (per-km rate, free km, cap) ONLY
//      when missing — so a future office customisation can never be clobbered
//      by a re-run.
// Run against whatever DATABASE_URL is in the env (local battery or the
// decrypted prod URL via the t73_run_prod_rates.py wrapper). Safe to re-run.
// =============================================================================
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })

const OWNER_PICKUP = 1500
const OWNER_DELIVERY = 1500
const NEW_KEYS: Record<string, number> = {
  rider_per_km_rate: 150, // ₦ per whole km beyond the free distance
  rider_free_km: 4, // km included in the base rate
  rider_distance_cap: 1800, // max distance pay per leg
}

async function main() {
  const before = await db.appSetting.findMany({
    where: { key: { in: ['rider_pickup_rate', 'rider_delivery_rate', ...Object.keys(NEW_KEYS)] } },
  })
  const beforeMap = new Map(before.map((r) => [r.key, r.value]))

  await db.appSetting.upsert({
    where: { key: 'rider_pickup_rate' },
    update: { value: JSON.stringify(OWNER_PICKUP) },
    create: { key: 'rider_pickup_rate', value: JSON.stringify(OWNER_PICKUP) },
  })
  await db.appSetting.upsert({
    where: { key: 'rider_delivery_rate' },
    update: { value: JSON.stringify(OWNER_DELIVERY) },
    create: { key: 'rider_delivery_rate', value: JSON.stringify(OWNER_DELIVERY) },
  })
  for (const [key, value] of Object.entries(NEW_KEYS)) {
    // Only-if-missing: never overwrite an office customisation on re-run.
    await db.appSetting.upsert({
      where: { key },
      update: {},
      create: { key, value: JSON.stringify(value) },
    })
  }

  const after = await db.appSetting.findMany({
    where: { key: { in: ['rider_pickup_rate', 'rider_delivery_rate', ...Object.keys(NEW_KEYS)] } },
  })

  console.log('--- rider pay rate card ---')
  for (const row of [...after].sort((a, b) => a.key.localeCompare(b.key))) {
    const had = beforeMap.has(row.key) ? `(was ${beforeMap.get(row.key)})` : '(new)'
    console.log(`  ${row.key} = ${row.value} ${had}`)
  }
  console.log(
    JSON.stringify({
      pickup: OWNER_PICKUP,
      delivery: OWNER_DELIVERY,
      perKm: JSON.parse(after.find((r) => r.key === 'rider_per_km_rate')?.value ?? '0'),
      freeKm: JSON.parse(after.find((r) => r.key === 'rider_free_km')?.value ?? '0'),
      cap: JSON.parse(after.find((r) => r.key === 'rider_distance_cap')?.value ?? '0'),
    })
  )
}

main()
  .catch((e) => {
    console.error('publish failed:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
