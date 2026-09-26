# Kozy Care — Growth Architecture Plan
### Subscriptions ("The Kozy Circle") · Multi-Branch Operations · Partner Network · Console Restructure

Prepared September 2026 · For the project owner · Status: **approved for execution**

---

## 1. What this plan delivers

Four initiatives, sequenced so each one builds on the last:

1. **The Kozy Circle** — a monthly membership with three tiers (₦30,000 / ₦50,000 / ₦80,000), measured by physical Kozy Bags and Kozy Boxes the business provides. Moves the business from one-off transactions to recurring revenue.
2. **Multi-branch operations** — Ogombo and Chevron Drive become first-class entities. Every pickup is assigned to a branch automatically; the console gets a branch switcher and per-branch health monitoring.
3. **The Kozy Network** — a partner program where independent laundry operators join the brand, receive demand through our technology, and share revenue.
4. **Console restructure** — 13 sidebar tabs condensed into 9 grouped items with sub-tabs inside pages (Reviews+Feedback fold into Customers; Orders+Payments fold into Operations; Staff+Riders fold into Team).

---

## 2. Research findings (what the market already proved)

| Player | Model | What we borrow |
|---|---|---|
| **2ULaundry (US)** | "2U Weekly" — one branded laundry bag per week, free rush delivery, 15% off additional services; "2U Weekly+" adds more volume | The bag IS the unit. Weekly cadence. Members still pay for dry-cleaning extras at a discount — subscription covers the recurring base load, premium items stay à-la-carte |
| **Rinse (US)** | "Rinse Go / Rinse Repeat" — per-bag all-inclusive subscription, waived service fees, no order minimum. Positions it as "a subscription that pays for itself" (up to 45% savings vs per-piece) | Value-anchoring language: show the member what the same volume would cost à-la-carte. Fee waivers (delivery) feel like perks without discounting the craft |
| **Lagos market (Jiji, laundromat listings)** | "Monthly Laundry Plans ₦30,000" already exists in the market; everyday-wear items run ₦500–₦1,500, suits ₦2,000–₦5,000 | The owner's Tier 1 price is market-validated, not a guess. Our tiers sit at 30/50/80 which is a clean ladder with a middle anchor |
| **Laundry OS platforms (onthewaylaundry, Bundle)** | License "service zones + pickup windows + route capacity" software to independent operators | The tech-licensing precedent for the Kozy Network: demand + brand + software in exchange for a revenue share |
| **Franchise-management SaaS (QVALON, FranMantra)** | Per-location dashboards: monitor, analyze, optimize each branch separately | The branch-health tab: same KPIs per branch, alerts when one branch drifts |

**Pricing psychology applied** (Shopify/Gravy guidance): tiered pricing with a middle anchor, value-based framing ("pays for itself"), and a hard benefit gap between tiers so the upgrade is always rational.

---

## 3. The Kozy Circle — tier design

### 3.1 The tiers

| | **The Essentials** ₦30,000/mo | **The Household** ₦50,000/mo | **The Concierge** ₦80,000/mo |
|---|---|---|---|
| What regulates volume | 4 × **Kozy Bag** pickups / month (weekly cadence) | 4 × **Kozy Box** pickups / month (~2.5 bags of volume) | 4 × **Kozy Box** pickups / month |
| Extra units | up to 2 extra bags/cycle at ₦5,000 each | up to 2 extra boxes/cycle at ₦7,500 each | up to 2 extra boxes/cycle at ₦7,500 each |
| Pickup & delivery | always free | always free | always free, **priority windows** |
| Quarterly duvet wash | — | up to 3 duvets every quarter | up to 3 duvets every quarter |
| Quarterly curtain care | — | — | up to 6 panels every quarter |
| Annual spring clean (rugs & heavy materials) | — | — | once a year |
| Concierge channel (designer pieces, condition assessment before every treatment) | — | — | yes — hand-over to the concierge desk |
| Discount on everything à-la-carte (dry cleaning, shoes, alterations) | 5% | 10% | 15% |
| The kit | Kozy Bag — return it or pay ₦5,000 replacement | Kozy Box — return it or pay ₦12,000 replacement | Kozy Box, monogrammed |

*All counts, caps, prices, replacement fees and perk limits are admin-editable — nothing here is hardcoded.*

### 3.2 Value math (the "pays for itself" anchor, per Rinse)

- **Essentials**: 4 bag washes + 4 free deliveries ≈ ₦36,000 à-la-carte → **₦30,000** (saves ~₦6,000 + 5% off everything else)
- **Household**: 4 box loads (≈ 2.5 bags each) + duvets (₦15,000/qtr value) + deliveries ≈ ₦85,000 à-la-carte → **₦50,000**
- **Concierge**: Household + curtains (₦25,000/qtr) + spring clean (₦40,000/yr) + 15% off + concierge assessment ≈ ₦110,000+ → **₦80,000**

### 3.3 How members use it (the flow)

1. **Discover**: footer link ("The Kozy Circle") + quiet "Membership" text link in the nav → `/memberships` page. Classy, not shouty — never front-and-center, per the owner's directive.
2. **Subscribe**: pick a tier → if signed out, log in first (subscriptions need an account) → pay by **Paystack** (instant activation) or **bank transfer** (admin verifies → activation).
3. **The kit arrives**: the rider hands over the Kozy Bag/Box on the first member pickup; from pickup two onward, laundry is measured by the kit — *no item counting at all*.
4. **Weekly rhythm**: portal → Membership tab → "Book your member pickup" — one-tap booking (address, date, slot). Zero charge while units remain; extra units are charged at the plan rate.
5. **Perks**: duvets / curtains / spring clean book from the same tab with quarterly counters shown ("2 of 3 duvets left this quarter").
6. **Renewal**: Paystack recurring (plan-based) auto-renews; transfer members get a reminder as expiry approaches. Cancel anytime → stays active to period end.

### 3.4 Why this structure (decision log — where I deviated and why)

| Owner's suggestion | What I built instead | Reasoning |
|---|---|---|
| "Wash **all** your duvets every quarter" | Capped at 3/quarter (admin-tunable) | Unbounded perks get abused and break unit economics; 3 covers a normal household (master + 2 guest rooms). The owner can raise it in Settings in 5 seconds |
| Bag tier implied unlimited-ish usage | 4 bag pickups/month, weekly cadence | 2ULaundry's proven cadence. "Unlimited" laundromat models die on power users; weekly rhythm also gives riders a predictable route |
| "Maximum two after paying extra" | Up to 2 extra units per cycle, priced | Kept exactly as described — extras are the margin builder |
| Suggested recurring billing | Paystack **Plan-based recurring** where configured; bank transfer + manual renewal as fallback | Honest SaaS behavior: card members auto-renew; transfer members (the majority in Lagos) get reminders. Both paths land in the same cycle engine |
| Kit deposit | Replacement fee on non-return, tracked as kit state (Delivered → With member → Returned / Replaced) | Deposits complicate payments and refunds; a fee on non-return achieves the same protection and is standard in the industry |

---

## 4. Multi-branch operations (Ogombo & Chevron Drive)

### 4.1 Data model
- New **Branch** entity: name, address, phone, GPS point, the set of service zones it owns, active flag, default flag.
- Seeded: **Ogombo** (zones: Ajah + the eastern corridor; default branch/HQ) and **Chevron Drive** (zones: Victoria Island, Ikoyi, Lekki). Mainland zones auto-assign to the nearest branch until a third branch exists.
- Orders gain `branchId`; riders gain `branchId` (their home branch).

### 4.2 Assignment logic (the careful part)
1. Zone the pickup address (existing `geo.ts` zone matcher — already battle-tested for rider geofencing).
2. Zone → owning branch. No zone match → nearest branch by GPS distance. No branches configured → default branch.
3. Assignment happens server-side at order creation, is written into the status trail ("Assigned to Chevron Drive"), and admins can re-route an order to the other branch from the order modal.
4. Dispatch suggestions gain a **branch-affinity bonus** — a rider whose home branch matches the order's branch floats to the top of the suggestion list.

### 4.3 Console experience
- **Branch switcher** in the admin header: *All branches / Ogombo / Chevron Drive*. Filters the Overview KPIs, the Operations board, the payment queue and Finances.
- **Operations → Health tab**: a card per branch — active orders, today's pickups, awaiting-payment count, week revenue, riders on duty — with alert chips ("no rider assigned to today's 6 pickups", "3 receipts waiting > 24h"). This is the founder's "is something going wrong at Chevron?" view.

---

## 5. The Kozy Network (partner program)

### 5.1 The model (franchise-lite, tech-led)
A partner is an **independent laundry operator** who joins the Kozy brand:
- Kozy brings: demand (orders from their zone route straight to them), the brand, the technology (booking, dispatch, tracking, payments), and onboarding.
- The partner brings: processing capacity (wash, treat, finish) at their location.
- **Revenue share**: default 70% partner / 30% Kozy, set per partner at approval. Kozy's share covers demand generation, tech and brand.

This is the "buy into the technology" model the owner described — riders keep collecting, the pickup lands at the *partner's* hub instead of an owned branch, and the platform tracks every naira.

### 5.2 What ships now (v1) vs later
**Now**: public `/partners` page (classy B2B pitch + application form), admin Partners view (applications queue → approve/reject with notes; approved network table with branch, share %, live MTD orders/revenue), order-modal fulfillment tagging ("Processed by partner X" — revenue ledger derives from delivered orders automatically).
**Phase 2** (documented, not built today): partner self-serve portal login (statement view, SLA management), automatic zone-based routing to partners.

*Rationale for the split*: partner logins need their own RBAC surface and portal — building it before the first partner exists is speculative. The application + approval + ledger flow is everything needed to sign the first partner this month.

---

## 6. Console restructure

**Before (13 flat tabs):** Dashboard, Notifications, Orders, Verify Payments, Customers, Finances, Marketing, Reviews, Feedback, Staff, Riders, Settings, Help.

**After (9 items in 4 groups, sub-tabs inside pages):**

| Group | Item | Contains |
|---|---|---|
| — | **Overview** | KPIs, quick actions, recent activity |
| — | **Notifications** | ops alert inbox (badge) |
| Run | **Operations** | Pipeline · Payments · **Health** (branch) |
| Grow | **Customers** | Directory · Reviews · Feedback |
| Grow | **Memberships** | Plans · Subscribers *(new)* |
| Grow | **Growth** | Marketing hub (renamed) |
| Scale | **Partners** | Applications · Network *(new)* |
| Scale | **Team** | Staff · Riders |
| Manage | **Finance** · **Settings** | Settings gains a **Branches** tab; Help moves to a quiet sidebar footer link |

Reviews and Feedback stay separate *datasets* (order-linked reviews vs. open feedback inbox) but live behind one Customers page — the left rail reads as one concern: people. Orders + Verify Payments merge into Operations because verifying a payment *is* moving an order through the pipeline. All existing deep-links from notifications are remapped, so nothing breaks.

---

## 7. Implementation chunks

| Chunk | Scope | Files (new ➕ / edited ✏️) |
|---|---|---|
| **A. Data layer** | Prisma models: `Branch`, `SubscriptionPlan`, `Subscription`, `Partner`; scalars on Order (`branchId`, `subscriptionId`, `fulfilledByPartnerId`) and User (`branchId`); types + defaults; db push | ✏️ schema.prisma, types.ts, ➕ lib/subscriptions.ts, lib/branches.ts |
| **B. Membership APIs** | Plans CRUD (self-seeding, admin-priced, Paystack plan sync); subscribe; my-subscription; admin list/actions; member pickup order creation; à-la-carte member pricing (free delivery + % off) in the order POST | ➕ api/subscriptions/*, ✏️ api/orders/route.ts, schemas.ts, hooks.ts, notifications.ts |
| **C. Payments** | Paystack subscription initialize (passes plan code → Paystack auto-creates recurring subscription); webhook handles `SUB-` refs + renewal events; transfer fallback with admin verification | ➕ api/paystack/subscription-initialize, ✏️ webhooks/paystack |
| **D. Customer surfaces** | `/memberships` page (tiers, comparison, FAQ, checkout); portal Membership tab (usage meters, book pickup, perks, cancel); footer + nav links | ➕ app/memberships, components/customer/memberships-*, ✏️ site-footer, public-nav, customer-portal |
| **E. Branches** | Branch CRUD + self-seeding; server-side assignment in order POST; admin re-assign; branch switcher; Health tab; rider branch field | ➕ api/branches, components/admin/branch-health, ✏️ settings-view (Branches tab), admin-dashboard, riders-view, users/[id], dispatch.ts |
| **F. Partners** | `/partners` public page + application API; admin Partners view; fulfillment tagging in order modal + PATCH | ➕ app/partners, api/partners, components/admin/partners-view, ✏️ order-detail-modal, orders/[id] |
| **G. Console IA** | Grouped sidebar, merged wrapper views (Operations/Customers/Team/Memberships/Partners), deep-link compat map, Help footer link | ✏️ admin-dashboard.tsx, ➕ operations-view, customers-page, team-view |
| **H. QA + ship** | Typecheck, lint, build, dev-server smoke tests on all new flows; commit; deploy (Vercel db-push build); verify live | .zscripts + git |

**Sequencing:** A → B → C → D → E → F → G → H. Each chunk lands compiling; the console restructure (G) comes last so it can wire the finished views in one pass.

---

## 8. Risks & mitigations

- **Perk abuse** → every perk has an admin-tunable cap + usage counters; admin can reset counters.
- **Paystack not configured** → plans still save (plan code syncs when keys appear); transfer fallback always works.
- **Fresh DB / new environment** → plans and branches self-seed on first API read (same pattern as PriceCatalog — no manual migration step).
- **Existing deep links** → old tab keys remapped inside the new structure; notifications keep working.
- **Schema deploy** → Vercel build already runs `prisma db push`; local push verified before commit.

*Backlog carried from the rider-app workstream (Rules exit, distance copy, rider notifications test to 08124129296, APK hosting) is unaffected and stays queued separately.*
