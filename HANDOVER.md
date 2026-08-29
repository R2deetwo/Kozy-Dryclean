# Kozy Care — Project Handover

> **Status at handover (28 August 2026):** production is live at [kozycare.ng](https://kozycare.ng)
> and verified end-to-end. This file is the developer-facing handover. The client-facing
> version (operations guide + this content, print-formatted) is delivered as
> `Kozy-Care-Project-Handover.pdf` alongside the brand kit.

---

## 1. TL;DR for a new developer

1. Read this file top to bottom (10 minutes). It is the map.
2. **Deploys are NOT automatic.** Pushing to GitHub does nothing to production. See §4.
3. All secrets live in Vercel env settings. Never commit them. Push protection is on.
4. Three integrations are built but dormant pending API keys: Paystack (card payment),
   Termii (SMS), and the verified Brevo sender (concierge@kozy.ng).
5. The full chronological build history with verification evidence is in `worklog.md`.
6. Known technical debt is listed honestly in §8 — nothing customer-facing is broken.

## 2. Production inventory

| Asset | Where |
| --- | --- |
| Customer site | https://kozycare.ng (landing, `/book` guest booking, `/portal`, `/signup`, `/login`) |
| Admin console | https://kozycare.ng/admin (orders, payments, CRM, pricing, reviews, finance) |
| Driver app | https://kozycare.ng/driver (geofenced route view) |
| Rider recruitment | https://kozycare.ng/join-riders |
| Source | `main` branch of this repository (production) |
| Hosting | Vercel project `kozy-dryclean` (team `team_RJD4xe4C4h3TiJ3M3iEa8idV`, project `prj_BUv0ZqDMzsONFBQXXCgBJfmIN43e`) |
| Database | Supabase Postgres via Prisma |
| Rate limiting | Upstash Redis (REST) |
| Email | Brevo (sender falls back to a personal Gmail until `BREVO_VERIFIED_SENDER_EMAIL` is set) |
| Domain | kozycare.ng → Vercel (A 76.76.21.21, www CNAME, 308 apex redirect) |
| Brand/print kit | delivered folder `kozy-brand/` (logos, flyers, poster, business cards, brand sheet + editable HTML sources) |

SEO/analytics: sitemap.xml, robots.txt, canonical URLs, OG image, and the Vercel
Analytics script are all in place; Web Analytics still needs one click (project →
Analytics → Enable) to start collecting.

## 3. Architecture in one screen

- **Next.js 16 App Router + TypeScript 5.** One deployable, no microservices.
- **Tailwind 4 + shadcn/ui + Framer Motion** for UI; **@dnd-kit** for the admin Kanban.
- **Prisma + Supabase Postgres.** Schema auto-syncs on every deploy
  (`build:vercel` = `prisma db push` + `next build`) — there are no manual migrations.
- **Auth:** NextAuth credentials + server sessions. RBAC enforced in middleware and in
  every privileged API route (admin/driver checks server-side).
- **Server state:** React Query hooks (`src/lib/hooks.ts`). Zustand is ephemeral UI
  state only — plus legacy localStorage persistence being retired (§8).
- **Key modules:**
  - `src/lib/types.ts` — `GARMENT_CATALOG` (seed prices) + B2B pricing constants
  - `src/lib/pricing-groups.ts` — the single grouping used by BOTH the landing pricing
    cards and the booking wizard (they cannot drift apart)
  - `src/lib/geo.ts` — 12 Lagos service zones + enforcement radii (12 km stops,
    15 km confirmations)
  - `src/lib/notifications.ts` — Brevo email + Termii SMS, env-gated, never throws
  - `src/lib/email.ts` — branded templates; `BREVO_VERIFIED_SENDER_EMAIL` overrides sender
- **API surface** (`src/app/api/`): `orders` (+ `[id]`), `payments`, `reviews`
  (+ `order-context`, `admin`, `[id]`), `paystack/initialize` + `verify`, `auth/*`,
  `driver/location`.

### Non-obvious design decisions

1. **Pricing has one source of truth:** the DB `PriceCatalog` (seeded from
   `GARMENT_CATALOG`) is what orders are charged at; landing + wizard render those
   same live prices (`useServerPrices`). A price change in admin settings propagates
   everywhere instantly.
2. **Guest checkout is first-class:** `POST /api/orders` with a guest payload
   find-or-creates the customer, rejects password-holding emails with 409
   (`ACCOUNT_EXISTS`), and creates the bank-transfer payment **atomically** with the
   order. Guests get a random password so forgot-password claim flows still work.
3. **Paystack reference convention:** `paystackRef` = order number. The initialize
   route creates a PENDING payment with that ref; the `charge.success` webhook finds
   the payment by it. Keep this invariant.
4. **Everything degrades gracefully:** missing Paystack/Termii keys produce clean 503s
   or silent skips — never a crash in a user flow.
5. **Reviews cannot be hijacked:** the order-context lookup accepts full CUIDs only
   (human order numbers are rejected), is IP rate-limited, and moderation is
   admin-gated. Public testimonials = approved DB reviews, padded to a minimum of 6
   by `src/lib/starter-testimonials.ts`.

## 4. Deployment — the critical section

**The Vercel↔GitHub auto-deploy webhook is NOT connected** (the deployment API expects
an `org/repo/sha` gitSource that this repo arrangement does not provide). Every
production deploy is explicit:

```bash
# after merging to main:
git push origin main
VERCEL_TOKEN=xxx python3 scripts/vercel_deploy.py   # creates deployment from SHA, polls until READY
```

or: Vercel dashboard → project → Deployments → ⋯ → Redeploy on the commit.
(Dashboard "Deploy" on a past commit works fine; only the *automatic* webhook is absent.)

Build command: `bun run build:vercel` → `prisma db push` (tolerant) + `next build`.
Consequences: schema changes deploy themselves; local dev shares the production DB —
be careful with test writes.

### Environment variables

| Variable | Status | Notes |
| --- | --- | --- |
| `DATABASE_URL` | set | Supabase Postgres |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | set | URL = https://kozycare.ng |
| `NEXT_PUBLIC_APP_URL` | set | https://kozycare.ng |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | set | rate limiting |
| `BREVO_API_KEY` | set | transactional email |
| `BREVO_VERIFIED_SENDER_EMAIL` | **missing** | set to concierge@kozy.ng after Brevo sender verification |
| `PAYSTACK_SECRET_KEY` (+ webhook secret) | **missing** | activates card payment + webhook verification |
| `TERMII_API_KEY` | **missing** | activates SMS |

Local dev: `bun install`, `cp .env.example .env`, fill from Vercel, `bun run dev`.
`scripts/create-admin.ts` seeds an admin account.

## 5. Subsystem notes

### Phase 14 (Aug 2026) — commercial settings, mode of wash, offers, feedback

- **AppSetting table = single source of truth for commercial terms.** Bank
  details, delivery fee (₦1,500 after the free first delivery), handwash
  surcharge (50% of the cleaning subtotal), first-order discount (10%),
  hotel-guest offer (15%, code `HOTEL15`), guarantee thresholds (2 garments
  or ₦2,500) and the alterations from-price all live in the DB and are
  served by `GET /api/settings/app` (public) / `PUT` (admin). The API
  self-seeds code defaults on first read, so a fresh database needs no
  migration step. The admin Settings page saves through this API — the old
  localStorage-only flow (which never propagated to customers) is gone.
- **Mode of Wash** is a required field on retail orders (wizard step 1,
  `Order.modeOfWash`). The server rejects ITEM orders without it
  (`MODE_OF_WASH_REQUIRED`). Handwash adds the surcharge server-side; the
  wizard mirrors the math for the live estimate.
- **Offer codes.** `Order.promoCode` — a valid active `Discount` row by code
  applies its percentage INSTEAD of the standard first-order discount and
  marks `signupDiscountUsed`. The built-in hotel code self-upserts from
  AppSetting when first redeemed (no pre-seeding needed). Unknown codes are
  ignored with a notice, never a dead end.
- **Delivery fee.** `Order.deliveryFee` — 0 on a customer's first
  non-cancelled order, else the AppSetting rate. Fees are never discounted;
  percentage discounts apply to the service total only (cleaning + handwash
  + express).
- **Feedback.** `Feedback` model + `/api/feedback` (public POST,
  admin GET/PATCH) + `FeedbackForm` on the landing page + admin "Feedback"
  tab. Complements the order-linked Review system.
- **New catalog items** (Leather Jacket ₦4,000 / Jean Jacket ₦1,200 /
  Sweatshirt-Cardigan ₦1,000, Outerwear category) self-seed into
  PriceCatalog from `GET /api/settings/prices`.
- **Marketing kit v5** (`scripts/kozy-brand/build_v5.py` +
  `package_v5.sh`): 10% offer everywhere, HOTEL15 strip, Flyer B model now
  holds a KOZY CARE garment bag.

- **Reviews** — DB-backed end to end; Rate button on delivered orders →
  `/review/[orderId]`; moderation in admin (`/api/reviews/admin`); carousel min 6
  (seed-padded), cap 12.
- **Payments** — bank transfer: atomic PENDING payment + admin verification queue.
  Card: `/api/paystack/initialize` (ownership-checked) → Paystack redirect →
  `/payment/callback` polls `/api/paystack/verify`; webhook marks paid + notifies.
- **Geofencing** — riders ping `/api/driver/location` ~1/min; outside all 12 zones →
  activity paused; confirmations >15 km from stop zone rejected server-side; stale
  ping → legacy behaviour (never bricks the app).
- **Notifications** — email + SMS on order created / guest account created / status
  change / payment verified. SMS gated to actionable statuses.
- **Wizard** — retail (Men/Women/Shoes tabs) + corporate (per-kg) flows; express
  turnaround tiers; member-gated skip with booking resume; shared home-extras strip.

## 6. Testing what matters

There is no automated test suite; verification has been manual + scripted E2E against
production. The flows to smoke-test after any change:

1. Guest booking at `/book` → order created → appears in admin payment queue.
2. `ACCOUNT_EXISTS` guard (guest booking with a registered email → 409 + sign-in UI).
3. Paystack initialize without keys → clean 503 + fallback toast.
4. `/api/reviews` returns ≥6 testimonials; fake CUID → `found:false`; rating >5 → 400.
5. Admin endpoints without session → 403.
6. Driver location without auth → 401.
7. sitemap.xml + robots.txt + og:image resolve on the production domain.

## 7. Data quirks

- One labelled test order `KZ-02150959` ("E2E Test (safe to cancel)") + one guest test
  account exist in production data. Cancel/delete them when convenient.
- Signup discount: 15% first order (applied automatically). Printed materials carry
  the same offer plus the first-order-only free pickup fine print — keep them in sync.

## 8. Known limitations & debt (honest list)

| Item | Fix direction |
| --- | --- |
| Zustand still mirrors users/orders/payments to localStorage (legacy demo era) | finish migration to React Query; keep Zustand ephemeral-only |
| Admin notifications panel is localStorage-only | back with a DB table + polling |
| GitHub → Vercel auto-deploy not wired | fix webhook gitSource format or add a GitHub Action calling the deploy API |
| Brand sheet (v1.1) documents the pre-v4 logo | regenerate via `scripts/kozy-brand/build_brand_sheet.py` |
| New catalog items need a code edit (seeds in `types.ts`) | manage full catalogue from `PriceCatalog` via settings |
| No automated tests | start with API-route integration tests for the flows in §6 |

## 9. Suggested roadmap (priority order)

1. Activate Paystack + Termii (keys only) — highest ROI, zero code.
2. Enable Vercel Analytics; let data accumulate before funnel changes.
3. WhatsApp deep links (wa.me) on landing + in notifications — Lagos lives on WhatsApp.
4. GitHub Action for deploys (removes the manual-deploy footgun).
5. DB-backed admin notifications; retire Zustand localStorage.
6. Brand sheet v4 refresh; print re-runs as pricing evolves.

## 10. Brand & print kit

Delivered with this handover (folder `kozy-brand/`): v4 K-mark logo system (SVG + PNG),
A5 services flyer (double-sided, live prices), A5 offer flyer, A3 poster, business
cards (navy + white, 85×55 mm, 2-sided), A4 brand sheet, and README-PRINT with
printer specs. Every piece has editable HTML sources; regeneration is one command via
`scripts/kozy-brand/` (`build_v42.py`, `build_cards.py`, `render_v42.sh`,
`render_cards.sh`, `package_v42.sh`). QR codes point to kozycare.ng and were
decoded-verified.

---

Questions about "why is X like this?" → check `worklog.md` first; the reasoning behind
every phase is recorded there.
