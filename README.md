# Kozy Care — Drycleaning & Laundry Platform

> **Live site: [kozycare.ng](https://kozycare.ng)** · Uncompromising care. Exceptional convenience.

Kozy Care is a Lagos-based premium drycleaning and laundry service. This repository is
the complete production platform: the customer booking website, guest checkout, online
and bank-transfer payments, customer portal, admin console (orders, payment
verification, CRM, pricing, reviews, finance charts), and a GPS-geofenced driver app —
plus the generator scripts for the brand and print kit.

**New here? Read [`HANDOVER.md`](./HANDOVER.md) first.** It is the current, complete
handover: architecture, deployment pipeline, environment variables, subsystem docs,
known limitations, and the prioritised roadmap. (`ARCHITECTURE.md` and
`DEPLOYMENT.md` are historical phase documents kept for context; `worklog.md` is the
full chronological build record.)

## What the platform does

| Surface | Route | Highlights |
| --- | --- | --- |
| Landing page | `/` | Live server pricing, offers strip (10% first order, HOTEL15 hotel deal, 5% photos), Outerwear menu, Alterations, Reviews & Complaints form, delivery pricing, guarantee eligibility, testimonials, SEO + OG images |
| Guest booking | `/book` | Book in ~2 minutes with no account; 409 guard for existing accounts |
| Customer portal | `/portal` | Order tracking, invoices, review submission on delivered orders |
| Admin console | `/admin` | Kanban/list orders, payment verification queue, CRM, finance charts, pricing settings (server-side — live for every visitor), review moderation, Feedback inbox (reviews & complaints) |
| Driver app | `/driver` | Route view, swipe confirmations, GPS geofencing across 12 Lagos service zones |
| Rider recruitment | `/join-riders` | Public application page |

Payments: bank transfer with admin verification (live today) and Paystack online card
payment (built; activates when `PAYSTACK_SECRET_KEY` is set). Bank details live in the
`AppSetting` table — admin edits reach every customer's checkout instantly. Orders also
carry a required Mode of Wash (machine vs handwash +50%), an optional offer code
(`HOTEL15` = 15% first order for hotel guests, stacking with the 5% photo discount), a
flat delivery fee after the free first delivery, and server-validated guarantee
eligibility (min 2 garments or a 2,500+ total). Notifications: branded
email via Brevo (live) and SMS via Termii (built; activates when `TERMII_API_KEY` is
set). All integrations degrade gracefully when keys are absent.

## Tech stack

- **Framework**: Next.js 16 (App Router) · TypeScript 5
- **Data**: Prisma + Supabase Postgres · Upstash Redis (rate limiting)
- **UI**: Tailwind CSS 4 · shadcn/ui · Framer Motion · @dnd-kit
- **Auth**: NextAuth (credentials, server-side sessions, RBAC in middleware + API routes)
- **State**: React Query for server state; Zustand for ephemeral UI (legacy local
  persistence is being retired — see HANDOVER.md §10)
- **Brand**: Kozy Navy `#0A192F` · Champagne Gold `#D4AF37` · Playfair Display + Outfit

## Quick start (local)

```bash
git clone https://github.com/R2deetwo/Kozy-Dryclean.git
cd Kozy-Dryclean
bun install                 # or npm install
cp .env.example .env        # fill values from Vercel → Settings → Environment Variables
bun run dev                 # http://localhost:3000
```

⚠️ The local app talks to the **production** database — create test data sparingly and
clean it up.

Useful scripts (in `scripts/`): `create-admin.ts` (seed an admin account),
`vercel_deploy.py` (trigger + verify a production deploy via the Vercel API),
`kozy-brand/` (regenerate the entire print kit — flyers, poster, business cards).

## Deployment (read this — it is not what you expect)

**Pushing to GitHub does NOT auto-deploy.** The Vercel Git integration is not wired
for this repository. Production deploys are triggered via the Vercel REST API:

```bash
# 1. Push your commit to GitHub (main = production)
# 2. Trigger the deploy (see scripts/vercel_deploy.py for the full flow):
VERCEL_TOKEN=... python3 scripts/vercel_deploy.py
# ...or click "Deploy" on the commit in the Vercel dashboard.
```

- Vercel project: `kozy-dryclean` · build command `bun run build:vercel`
  (`prisma db push` + `next build` — the schema auto-syncs on every deploy).
- Domains: `kozycare.ng` (primary) · `www.kozycare.ng` → apex (308) ·
  `kozy-dryclean.vercel.app` (legacy).
- All secrets live in Vercel environment settings — never in the repository.
  GitHub push protection is enabled and has caught accidental leaks before.

## Repository map

```
src/app/                 App Router pages + API routes (orders, payments, reviews,
                         paystack, driver/location, auth)
src/components/          customer / admin / driver / shell UI
src/lib/                 types (GARMENT_CATALOG), pricing-groups, geo (service zones),
                         notifications, email, store, hooks
prisma/schema.prisma     Users, Orders, OrderItem, Payment, Review, DriverLocation,
                         PriceCatalog, Settings
scripts/                 ops + brand-kit generators (see scripts/kozy-brand/)
public/brand/            v4 K mark, OG image, service icons
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
