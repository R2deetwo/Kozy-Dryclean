// =============================================================================
// Phase 56 — E2E TEST RIG: bootstrap the ADMIN personas in PRODUCTION
// =============================================================================
// The owner wants to run a REAL end-to-end test with disposable inboxes from
// his own mail app (woosh.dpdns.org): a customer, a staff member, a rider,
// and an admin inbox "so that i can see what the admin sees".
//
// Customer / staff / rider personas are created through the REAL product
// flows by the battery (signup → verification email; staff invite email;
// /join-riders → review → approval → welcome email) — only the ADMIN
// accounts need direct DB creation, because the product deliberately has no
// self-service admin signup.
//
// This script creates (in PRODUCTION, via DIRECT_URL):
//   1. kozy-a-admin@woosh.dpdns.org — the battery's own verification admin
//      (Pass A: my token-holding inbox, full programmatic assertions).
//   2. vk5m2w8t4a@woosh.dpdns.org — the OWNER's admin-view inbox (Pass B),
//      also a real ADMIN account so he can sign in and see the console.
//
// Idempotent: re-running re-arms the known test passwords.
//
// Run: source work/p56-env.env && DIRECT_URL="$DIRECT_URL" npx tsx scripts/p56_bootstrap_personas.ts
// =============================================================================

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } })

const ADMINS = [
  {
    email: 'kozy-a-admin@woosh.dpdns.org',
    password: 'KozyAutoAdmin!56',
    name: 'Test Auto Admin',
    phone: '+234 803 000 0018',
  },
  {
    email: 'vk5m2w8t4a@woosh.dpdns.org',
    password: 'KozyE2EAdmin!56',
    name: 'Test Admin',
    phone: '+234 803 000 0028',
  },
]

async function main() {
  for (const a of ADMINS) {
    const hash = await bcrypt.hash(a.password, 10)
    const user = await db.user.upsert({
      where: { email: a.email },
      update: {
        role: 'ADMIN',
        accessStatus: 'ACTIVE',
        emailVerified: new Date(),
        // Dedicated test account — always re-arm the known password.
        passwordHash: hash,
        mustChangePassword: false,
      },
      create: {
        email: a.email,
        name: a.name,
        phone: a.phone,
        role: 'ADMIN',
        passwordHash: hash,
        emailVerified: new Date(),
        accessStatus: 'ACTIVE',
        mustChangePassword: false,
      },
    })
    console.log(`admin ready: ${user.email} (${user.role}, ${user.accessStatus})`)
  }
  console.log('\nBoth admin personas are live in production.')
}

main()
  .catch((e) => {
    console.error('ERR', e.message)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
