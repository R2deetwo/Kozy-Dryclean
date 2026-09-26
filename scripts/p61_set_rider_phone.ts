// Set the demo rider's phone to the owner's WhatsApp test number.
// Run AFTER phase 61 is deployed (the number powers the WhatsApp bridge
// button in the console + the rider's Account self-test — both phase-61).
// Usage: DATABASE_URL=<production Supabase URL> npx tsx scripts/p61_set_rider_phone.ts
import { db } from '../src/lib/db'

const RIDER_EMAIL = 'd8cne7n6mu@woosh.dpdns.org' // "Test Rider" — the login given to the owner
const PHONE = '08124129296' // the owner's WhatsApp test number

async function main() {
  const rider = await db.user.findUnique({ where: { email: RIDER_EMAIL } })
  if (!rider) {
    console.error(`Rider not found: ${RIDER_EMAIL}`)
    process.exit(1)
  }
  await db.user.update({
    where: { id: rider.id },
    data: { phone: PHONE },
  })
  console.log(`OK — ${rider.name} <${RIDER_EMAIL}> phone set to ${PHONE}`)
  console.log('The console WhatsApp bridge and the rider Account self-test now target wa.me/2348124129296.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .then(() => db.$disconnect?.())
