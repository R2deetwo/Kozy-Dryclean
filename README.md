# Kozy Care — Drycleaning & Laundry Platform

> **Live site: [kozycare.ng](https://kozycare.ng)** · Uncompromising care. Exceptional convenience.

Kozy Care is a Lagos-based premium drycleaning and laundry service. This repository is
the complete production platform: the customer booking website with guest checkout,
memberships, the customer portal, the admin console (orders, payments, CRM, finance,
branches, marketing automation), and the rider app with GPS dispatch — plus the
generator scripts for the brand and print kit.

**New here? Read [`HANDOVER.md`](./HANDOVER.md) first.** It is the full handover:
architecture, deployment pipeline, environment variables, subsystem docs, known
limitations, and the roadmap. (`ARCHITECTURE.md` and `DEPLOYMENT.md` are historical
phase documents kept for context; `worklog.md` is the chronological build record.)

## What the platform does

| Surface | Route | Highlights |
| --- | --- | --- |
| Landing page | `/` | Live server pricing ("From ₦800/kg" for corporate/hotel laundry), offers strip, per-item catalog, testimonials, SEO + OG images |
| Guest booking | `/book` | Book in ~2 minutes with no account; 409 guard for existing accounts; auto-save draft resume; scroll-to-top on every step |
| Plans & pricing | `/memberships` | The Kozy Circle tiers (Essentials / Household / Whole Home — bag- and box-sized kits), persona routing, the full per-item price list, Paystack or bank-transfer join |
| Specialty services | `/services` | Couture Care (assessed & quoted per piece), Sneaker & Trainer Restoration (from ₦5,000), Alterations with in-house seamstress, **The Kozy Shoe Club** (shoes-only monthly subscription — 2/4/6 pairs on a rotation rhythm, sold in the shoe-care section, never a tier) |
| Customer portal | `/portal` | Order tracking, invoices, reviews, the membership tab (tier usage meters + Shoe Club card), referral and loyalty state |
| Admin console | `/admin` | Kanban/list orders, payment verification queue, CRM with health scoring, finance charts, pricing & settings (server-side — live for every visitor), branch management (company vs franchise), rider response-time league, newsletter engine, coupon & promo calendar, feedback inbox |
| Rider app | `/driver` | Route view, swipe confirmations, GPS geofencing across 12 Lagos service zones, full-time auto-dispatch (zone → load → distance), part-time claim pool with race-safe claiming, web-push stop notifications, earnings ledger + pending-payout balance, payouts history, bank-details self-service |
| Rider recruitment | `/join-riders` | Public application page feeding the admin review flow |
| Partner portal | `/partner` | The Kozy Network laundrette portal (phase 72): orders routed to the facility with the received → washing → finishing workflow, revenue-share ledger with pending settlement, settlements history, settlement bank account |
| Partner recruitment | `/partners` | Public application (validated like riders, KZP reference, email+SMS confirmation) → admin approval creates the PARTNER login with emailed credentials — full rider-parity |

### The two product families (phase 70 → 71)

- **Kozy Circle** (`family=KIT`) — laundry tiers measured by physical kits (Kozy Bag /
  Kozy Box). Sold on `/memberships`. Every tier includes a monthly shoe perk
  (1/3/5 pairs on Essentials/Household/Whole Home).
- **Shoe Club** (`family=SHOES`) — a standalone shoes-only subscription sold in the
  `/services` shoe-care section. Counts follow rotation rhythm, NOT the tier ladder:
  2 pairs (fortnightly) / 4 (weekly) / 6 (twice-weekly) at ₦3,000/₦5,000/₦7,200 a
  month — per-pair ₦1,500/₦1,250/₦1,200, never below Kozy's own ₦1,000 a-la-carte
  floor and ~70-85% under the ₦7,000-8,000 Lagos sneaker specialists. A customer may
  hold one membership in EACH family at the same time (the club stacks on any tier);
  two in the same family is refused with switch guidance. Shoe pickups draw from the
  club first, then a tier's monthly shoe perk.

### Branches & the numbers reset

Orders are branch-routed server-side at creation (zone ownership → nearest → default).
`ownershipType` separates **company** branches (Chevron Drive, Ogombo) from **franchise**
partner sites (gold treatment in the console, revenue-share ledger). Company branches
can restart their all-time numbers (orders/earnings) from the Branch Health card — a
reporting epoch (`statsResetAt`), never a deletion; franchise branches are locked
server-side because their ledger is contractual.

### Payments & notifications

Bank transfer with admin verification (live) and Paystack card payment + recurring
membership charges (activates when `PAYSTACK_SECRET_KEY` is set). Bank details live in
the `AppSetting` table — admin edits reach every checkout instantly. Orders carry a
required Mode of Wash (machine vs handwash +50%), offer/coupon codes (server-validated,
stacking with the 5% photo discount), a flat delivery fee after the free first
delivery, and guarantee eligibility checks. Notifications: branded email via Brevo
(live), SMS via Termii (activates when `TERMII_API_KEY` is set), and Web-Push for
riders (activates when `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` are set). All
integrations degrade gracefully when keys are absent.

### Marketing engine

A calendar-synced newsletter engine (seasonal content lands BEFORE its event; cadence
is admin-set — every week / 2 weeks / monthly), coupons with windows and caps, a promo
calendar, click/open tracking, and a daily 07:00 UTC cron (`/api/marketing/cron`,
armed by `CRON_SECRET`) that also fires whenever the console's Marketing tab opens.

## Tech stack

- **Framework**: Next.js 16 (App Router) · TypeScript 5
- **Data**: Prisma + Postgres (Supabase in production) · Upstash Redis (rate limiting,
  falls back to in-memory per instance)
- **UI**: Tailwind CSS 4 · shadcn/ui · Framer Motion · @dnd-kit
- **Auth**: NextAuth (credentials, server-side sessions, RBAC in middleware + API
  routes, staff-access lifecycle with pause/revoke)
- **State**: React Query for server state
- **Push**: web-push (RFC 8291/8292) with VAPID keys for rider stop notifications
- **Brand**: Kozy Navy `#0A192F` · Champagne Gold `#D4AF37` · Playfair Display + Outfit

## Quick start (local)

```bash
git clone https://github.com/R2deetwo/Kozy-Dryclean.git
cd Kozy-Dryclean
bun install                 # or npm install
cp .env.example .env        # fill values from Vercel → Settings → Environment Variables
bun run dev                 # http://localhost:3000
```

The app self-seeds: branches, the three tiers + Shoe Club plans, the price catalog and
app settings all seed on first read of an empty database, so a fresh local Postgres
works out of the box (set `DATABASE_URL`/`DIRECT_URL` to it). If you point `.env` at
the **production** database instead, create test data sparingly and clean it up.

Useful scripts (in `scripts/`): `create-admin.ts` (seed an admin account),
`deploy_prod.py` (direct REST upload deploy — see below), `start_pg_tcp.sh` (embedded
local Postgres on :54329), `kozy-brand/` (regenerate the entire print kit).

## Deployment (read this — it is not what you expect)

**Pushing to GitHub does NOT auto-deploy.** The Vercel Git integration is not wired
for this repository, and the available Vercel token is **project-scoped** (it cannot
answer `whoami` — never "validate" it that way). Production deploys ship the source
straight through the REST API:

```bash
# 1. Commit + push to GitHub (main = the record of truth)
# 2. Ship it (CLI recipe — works today):
VERCEL_TOKEN=vcp_... npx -y vercel deploy --prod --yes
#    (needs .vercel/project.json restored; the REST direct-upload fallback
#     lives in scripts/deploy_prod.py but its digest format is unresolved)
```

- Vercel project: `kozy-dryclean` · build `bun run build:vercel`
  (`prisma migrate deploy` + `next build` — schema changes ship as reviewed
  migrations; the accept-data-loss `db push` era ended phase 71).
- Domains: `kozycare.ng` (primary) · `www.kozycare.ng` → apex (308) ·
  `kozy-dryclean.vercel.app` (legacy).
- All secrets live in Vercel environment settings — never in the repository.
  GitHub push protection is enabled and has caught accidental leaks before.

### Database migrations (phase 71)

- `prisma/migrations/20260928000000_init/` is the BASELINE — it matches the
  live prod schema exactly (verified by an empty `migrate diff` before
  baselining) and is marked applied on prod (`_prisma_migrations`).
- Workflow: change `prisma/schema.prisma` → `npx prisma migrate dev --name x`
  (local, generates + applies the migration) → commit BOTH files → deploy;
  Vercel's `prisma migrate deploy` applies it via `DIRECT_URL`.
- Never use `prisma db push` against prod again — it bypasses the migration
  history and can accept data loss. (`db:push` stays in package.json as a
  local-only escape hatch.)
- Migration status: `DATABASE_URL=$DIRECT_URL npx prisma migrate status`.

### Ops runbook (audit P1 items, phase 71)

- **Backups — rehearsed 2026-09-28**: `python3 scripts/backup_rehearsal.py`
  exports every prod table (306 rows / 29 tables at rehearsal time) into one
  timestamped `.sql` in `work/backups/`, then RESTORES it into a scratch
  database and verifies row counts — proving the backup actually works.
  Ritual: run it weekly (or before risky changes) and file the `.sql` in
  cloud storage; Supabase's platform backups are the second line, this is
  the independent copy. `... backup_rehearsal.py dump` skips the rehearsal
  when you only need the export. The restore recipe is embedded in every
  backup file's header (migrate deploy + psql -f).
- **Rate limiting — Upstash Redis is LIVE**: `UPSTASH_REDIS_REST_URL` /
  `UPSTASH_REDIS_REST_TOKEN` are set on prod (verified: shared-counter 429s
  observed across instances). The limiter fails OPEN if Redis hiccups —
  by design, so checkout never bricks.
- **SMS — needs `TERMII_API_KEY`**: the Termii integration is coded and
  env-gated (Brevo email is live; SMS activates the moment the key lands in
  Vercel env). Get the key at termii.com → Settings → API keys, add it as
  `TERMII_API_KEY`, and request sender-ID approval for "Kozy" (Termii
  requires it for custom senders; until approved the generic route works).
  `TERMII_SENDER_ID` / `TERMII_CHANNEL` are already set. Then redeploy once.

## Repository map

```
src/app/                 App Router pages + API routes (orders, payments, branches,
                         subscriptions + Shoe Club, paystack + webhooks, marketing
                         engine, rider-applications, driver-stats, push, auth)
src/components/          customer / admin / driver / shell UI
src/lib/                 types (GARMENT_CATALOG), subscriptions (plans + Shoe Club),
                         branches, rider-dispatch, marketing, pricing-groups, geo,
                         notifications, email, webpush, hooks
prisma/schema.prisma     Users, Orders, Payments, Branches (ownership + stats epoch),
                         SubscriptionPlan (KIT/SHOES families) + Subscription, riders,
                         marketing tables, reviews, loyalty, referrals
prisma/migrations/       baseline + future migrations (deploy runs migrate deploy)
scripts/                 ops (backup_rehearsal.py, deploy, t7x migrations/verifiers)
                         + brand-kit generators (see scripts/kozy-brand/)
public/brand/            K mark, OG image, photography, service icons
worklog.md               chronological build record (start here for "why")
HANDOVER.md              the current handover document
```

## Brand & print kit

The print-ready marketing kit (A5 flyers, A3 poster, business cards in navy + white,
logo system, brand sheet) is delivered alongside this repository, with editable HTML
sources and one-command regeneration scripts in `scripts/kozy-brand/`. Printed pieces
carry the offer terms: 15% off the first order, and free pickup & delivery for the
first order only (asterisked fine print).

---

© 2026 Kozy Care Drycleaning & Laundry Services · Lagos, Nigeria · [kozycare.ng](https://kozycare.ng)
