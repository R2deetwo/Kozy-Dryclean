// =============================================================================
// Create a proper admin account in Supabase
// =============================================================================
// This creates a REAL admin user in the database — NOT seed data.
// It won't be wiped when demo/mock data is cleared.
//
// Run: unset DATABASE_URL && bun run scripts/create-admin.ts
//
// Usage:
//   bun run scripts/create-admin.ts <email> <password> <name> <phone>
//   bun run scripts/create-admin.ts admin@kozy.ng mypassword "Chigo Bah" "+234 803 000 0000"
// =============================================================================

import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

async function main() {
  const email = process.argv[2] || 'admin@kozy.ng'
  const password = process.argv[3] || 'kozy-admin-2026'
  const name = process.argv[4] || 'Admin'
  const phone = process.argv[5] || '+234 800 000 0000'

  console.log(`\nCreating admin account...`)
  console.log(`  Email: ${email}`)
  console.log(`  Name:  ${name}`)
  console.log(`  Phone: ${phone}`)

  // Check if already exists
  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) {
    if (existing.role === 'ADMIN') {
      console.log(`\n✅ Admin already exists: ${email}`)
      console.log(`   Updating password...`)
      const passwordHash = await bcrypt.hash(password, 10)
      await db.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          emailVerified: new Date(),
          name,
          phone,
          role: 'ADMIN',
        },
      })
      console.log(`\n✅ Admin password updated. You can now log in:`)
      console.log(`   Email:    ${email}`)
      console.log(`   Password: ${password}`)
      console.log(`   URL:      https://kozycare.ng/login`)
      return
    }
    // User exists but isn't admin — promote them
    console.log(`\n⚠️  User exists as ${existing.role}. Promoting to ADMIN...`)
    const passwordHash = await bcrypt.hash(password, 10)
    await db.user.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        emailVerified: new Date(),
        name,
        phone,
        role: 'ADMIN',
      },
    })
    console.log(`\n✅ User promoted to ADMIN. Login:`)
    console.log(`   Email:    ${email}`)
    console.log(`   Password: ${password}`)
    return
  }

  // Create new admin
  const passwordHash = await bcrypt.hash(password, 10)
  const user = await db.user.create({
    data: {
      email: email.toLowerCase(),
      name,
      phone,
      role: 'ADMIN',
      passwordHash,
      emailVerified: new Date(),
    },
  })

  console.log(`\n✅ Admin account created successfully!`)
  console.log(`   ID:       ${user.id}`)
  console.log(`   Email:    ${email}`)
  console.log(`   Password: ${password}`)
  console.log(`   Role:     ADMIN`)
  console.log(`   Verified: ✅ (auto-verified — no email needed)`)
  console.log(`\n   Login URL: https://kozycare.ng/login`)
  console.log(`\n⚠️  This is a REAL database record — it will NOT be wiped`)
  console.log(`   when demo/seed data is cleared. Only deleting this user`)
  console.log(`   from the Supabase dashboard would remove it.`)
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
