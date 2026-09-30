-- CreateTable
CREATE TABLE "StoreProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "price" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductRequest_status_createdAt_idx" ON "ProductRequest"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ProductRequest" ADD CONSTRAINT "ProductRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRequest" ADD CONSTRAINT "ProductRequest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StoreProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;


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
-- Prisma's own bookkeeping table lives in public too — the Supabase advisor
-- flags it like any other. The owner (Prisma migrations) still writes freely.
ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- The anon/authenticated roles also hold direct grants from Supabase's
-- defaults — strip them so even schema-level access is closed off. The
-- roles only exist on Supabase (not on a plain Postgres), so each revoke
-- is conditional; the RLS flags above apply everywhere regardless.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA "public" FROM "anon"';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA "public" FROM "anon"';
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA "public" FROM "authenticated"';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA "public" FROM "authenticated"';
  END IF;
END
$$;
