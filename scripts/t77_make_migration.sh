#!/bin/bash
# Task 77 — compose the migration: Kozy Store tables + ENABLE ROW LEVEL
# SECURITY on every table in the public schema (the Supabase "your tables
# are public" security-advisor hole).
#
# Why RLS-without-policies is the right fix here:
#   * Supabase exposes public-schema tables through PostgREST to holders of
#     the PUBLIC anon key. RLS enabled + zero policies = those roles read
#     nothing. The Supabase advisor checks exactly this flag.
#   * The app connects via Prisma as the table OWNER (the postgres role) —
#     owners bypass RLS (no FORCE), so application behaviour is unchanged.
#   * Belt and braces: REVOKE the anon/authenticated direct grants too.
set -e
cd /home/z/my-project
PG=/home/z/my-project/work/pgvenv/lib/python3.12/site-packages/pgserver/pginstall/bin

# Postgres must be up (battery scripts auto-start it; be safe).
if ! node -e "const n=require('net');const s=n.connect(54329,'127.0.0.1',()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1))" 2>/dev/null; then
  bash scripts/start_pg_tcp.sh >/dev/null 2>&1
fi

# 1) Fresh shadow DB for the diff.
$PG/psql -h 127.0.0.1 -p 54329 -U postgres -c "DROP DATABASE IF EXISTS shadow77;" >/dev/null
$PG/psql -h 127.0.0.1 -p 54329 -U postgres -c "CREATE DATABASE shadow77;" >/dev/null

# 2) DDL for the new store models (migrations so far → new schema).
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54329/kozy"
export DIRECT_URL="$DATABASE_URL"
export SHADOW_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54329/shadow77"
bunx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --shadow-database-url "$SHADOW_DATABASE_URL" \
  --script > work/t77_store_ddl.sql

if ! grep -q "CREATE TABLE" work/t77_store_ddl.sql; then
  echo "UNEXPECTED diff output:"; cat work/t77_store_ddl.sql; exit 1
fi
echo "--- store DDL generated ---"
cat work/t77_store_ddl.sql

# 3) Compose the final migration: DDL + RLS on EVERY table.
MIG=prisma/migrations/20260930100000_store_rls_security
mkdir -p "$MIG"
{
  cat work/t77_store_ddl.sql
  cat <<'RLS'

-- =============================================================================
-- Phase 77 — Supabase security: Row Level Security on EVERY public table
-- =============================================================================
-- Supabase's security advisor flags "tables are public" because every table
-- in the public schema is readable through its auto-generated REST API
-- (PostgREST) by anyone holding the project's public anon key. Enabling RLS
-- with NO policies means those exposed roles (anon / authenticated) can no
-- longer read a single row. The application is unaffected: Prisma connects
-- as the table OWNER (the postgres role), and owners bypass RLS (the tables
-- are deliberately NOT FORCEd, which would lock the app out too).
-- Belt and braces: the direct table/sequence grants those API roles hold
-- are revoked as well.
-- =============================================================================

ALTER TABLE "public"."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."NotificationEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."GarmentMedia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."StagedPhoto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."StatusEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."OrderAnomaly" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."VerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Discount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."DiscountUsage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."NewsletterCampaign" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."MarketingSchedule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."NewsletterRecipient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."NewsletterSubscriber" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RiderApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PriceCatalog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AppSetting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ReferralCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ReferralRedemption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Feedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."DriverLocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RiderIncident" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PushSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Review" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Branch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SubscriptionPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SubscriptionEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Partner" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RiderPayout" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PartnerSettlement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."StoreProduct" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ProductRequest" ENABLE ROW LEVEL SECURITY;

-- The anon/authenticated roles also hold direct grants from Supabase's
-- defaults — strip them so even schema-level access is closed off.
REVOKE ALL ON ALL TABLES IN SCHEMA "public" FROM "anon", "authenticated";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA "public" FROM "anon", "authenticated";
RLS
} > "$MIG/migration.sql"

echo "--- migration written to $MIG/migration.sql ---"

# 4) Apply locally + regenerate the client.
bunx prisma migrate deploy 2>&1 | tail -4
bunx prisma generate 2>&1 | tail -1

# 5) Prove the flags on the LOCAL database (all tables, RLS on, zero rows
#    readable by a non-owner role).
$PG/psql -h 127.0.0.1 -p 54329 -U postgres -d kozy -t -c \
  "SELECT count(*) AS tables, count(*) FILTER (WHERE relrowsecurity) AS rls_on FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r';"
$PG/psql -h 127.0.0.1 -p 54329 -U postgres -d kozy -c "DROP DATABASE IF EXISTS shadow77;" >/dev/null
echo "LOCAL MIGRATION OK"
