// Phase 44 local verification seed: one DRIVER user for the /driver
// skeleton + client-navigation check. Idempotent.
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

async function main() {
  const email = 'driver44@kozy-test.example'
  await db.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'Phase 44 Rider',
      phone: '+234 800 000 0002',
      role: 'DRIVER',
      passwordHash: await bcrypt.hash('Phase44!Driver2026', 10),
      emailVerified: new Date(),
      accessStatus: 'ACTIVE',
    },
  })
  console.log('driver:', email)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .then(() => process.exit(0))
