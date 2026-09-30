// =============================================================================
// Task 77 — prod Supabase RLS lockdown (run via t77_prod_rls.py which decrypts
// the DIRECT_URL and exports it; works equally well against the local DB).
// =============================================================================
// Enables Row Level Security on every table that exists in the public schema
// (+ Prisma's _prisma_migrations) and strips the anon/authenticated direct
// grants. Idempotent — the 20260930100000_store_rls_security migration
// re-applies the same flags at deploy time with zero conflict. The app keeps
// working because Prisma connects as the table OWNER, which bypasses RLS.
// =============================================================================
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })

async function tables(): Promise<string[]> {
  const rows = await db.$queryRawUnsafe<{ relname: string }[]>(
    `SELECT c.relname FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'
     ORDER BY c.relname`
  )
  return rows.map((r) => r.relname)
}

async function rlsCounts(): Promise<{ tables: number; rls: number }> {
  const rows = await db.$queryRawUnsafe<{ tables: bigint; rls: bigint }[]>(
    `SELECT count(*) AS tables, count(*) FILTER (WHERE relrowsecurity) AS rls
     FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'`
  )
  return { tables: Number(rows[0].tables), rls: Number(rows[0].rls) }
}

async function main() {
  const before = await rlsCounts()
  console.log(`BEFORE: ${before.tables} tables, ${before.rls} with RLS`)

  const names = await tables()
  for (const name of names) {
    await db.$executeRawUnsafe(
      `ALTER TABLE public."${name.replace(/"/g, '""')}" ENABLE ROW LEVEL SECURITY`
    )
  }
  console.log(`ENABLE RLS on ${names.length} tables (incl. _prisma_migrations)`)

  // Belt and braces — only when the Supabase API roles actually exist.
  const roles = await db.$queryRawUnsafe<{ rolname: string }[]>(
    `SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')`
  )
  for (const role of roles.map((r) => r.rolname)) {
    await db.$executeRawUnsafe(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM "${role}"`)
    await db.$executeRawUnsafe(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM "${role}"`)
    console.log(`REVOKE ALL (tables + sequences) from ${role}`)
  }

  const after = await rlsCounts()
  console.log(`AFTER:  ${after.tables} tables, ${after.rls} with RLS`)

  // Proof the app's own connection (owner role) still reads the data.
  const users = await db.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*) AS count FROM public."User"`)
  const plans = await db.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*) AS count FROM public."SubscriptionPlan"`)
  console.log(`app-role reads still work: User=${Number(users[0].count)}, SubscriptionPlan=${Number(plans[0].count)}`)

  if (after.tables !== after.rls) {
    throw new Error(`mismatch: ${after.tables} tables but only ${after.rls} with RLS`)
  }
  console.log('RLS LOCKDOWN COMPLETE')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .then(() => process.exit(0))
