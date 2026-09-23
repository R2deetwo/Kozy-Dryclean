// Phase 52 — verify the PRODUCTION (Supabase) schema actually has the new
// referral tables/columns. Run with the production env sourced:
//   set -a && source .env.vercel-prod && set +a && node scripts/p52_prod_check.js
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

(async () => {
  const tables = await db.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('ReferralCode','ReferralRedemption','StagedPhoto') ORDER BY 1`;
  const cols = await db.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name='User' AND column_name IN ('lastMilestoneSent','referralCredit') ORDER BY 1`;
  const users = await db.$queryRaw`SELECT count(*)::int AS n FROM "User"`;
  const orders = await db.$queryRaw`SELECT count(*)::int AS n FROM "Order"`;
  console.log('tables:', tables.map((r) => r.table_name).join(',') || 'NONE');
  console.log('user columns:', cols.map((r) => r.column_name).join(',') || 'NONE');
  console.log('users:', users[0].n, '| orders:', orders[0].n);
  await db.$disconnect();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
