// Verify Supabase tables exist
import { db } from '../src/lib/db'

async function main() {
  console.log('Verifying Supabase tables...\n')

  // Count rows in each table (should all be 0 since we just created them)
  const tables = ['user', 'order', 'garmentMedia', 'payment', 'statusEvent'] as const
  for (const table of tables) {
    const count = await (db as any)[table].count()
    console.log(`  ${table}: ${count} rows`)
  }

  // Test creating a user
  const testUser = await db.user.create({
    data: {
      email: 'test@kozy.ng',
      name: 'Test User',
      phone: '+234 800 000 0000',
      role: 'B2C',
    },
  })
  console.log(`\n✅ Created test user: ${testUser.id}`)

  // Clean up
  await db.user.delete({ where: { id: testUser.id } })
  console.log('✅ Deleted test user (cleanup)')

  console.log('\n🎉 Supabase is ready to use!')
}

main()
  .catch((e) => {
    console.error('❌ Verification failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
