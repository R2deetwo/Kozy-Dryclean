// =============================================================================
// Memberships — The Kozy Circle (phase 62) server-side domain library
// =============================================================================
// Three admin-priced monthly tiers whose volume is regulated by physical kits
// (Kozy Bag / Kozy Box). Follows the AppSetting/PriceCatalog precedent:
// self-seeding on first read so a fresh database needs no manual seed step,
// and a DB failure degrades to the code defaults instead of breaking pages.
//
// Cycle engine:
//   periodStart → periodEnd = one monthly cycle (30 days).
//   unitsUsed counts bag/box pickups THIS cycle; renewal resets it.
//   duvetsUsed / curtainsUsed count against the CALENDAR quarter;
//   springCleanUsed against the calendar year — rolled lazily at read time
//   via the usage*Key bookmarks, so a member who joins mid-quarter still
//   gets the full quarter's perks on their next renewal.
// =============================================================================

import { db } from '@/lib/db'
import {
  formatNaira,
  renewalPriceFor,
  renewalSavingFor,
  GARMENT_CATALOG,
  type MembershipPlan,
  type Membership,
} from '@/lib/types'
import { assignBranchForAddress } from '@/lib/branches'
import { notifyOrderCreated, notifyAdminNewOrder } from '@/lib/notifications'

// ----- Plan defaults (phase 66 → 67: the owner's ladder, retold in plain words) -----
// Three plans sized by KIT (bag → box → the whole home). Couture, designer
// and premium traditional wear is deliberately NOT a plan — it is the
// separate Couture Care specialist service on /services (assessed, quoted
// and hand-finished per piece; Circle members get their plan discount on
// the quote). Names and taglines are deliberately plain: a regular person
// should understand what is on offer without a dictionary. Everything
// numeric is admin-adjustable at runtime; these are the seeds.

interface PlanSeed {
  code: string
  name: string
  tagline: string
  family: 'KIT' | 'SHOES'
  priceMonthly: number
  sortOrder: number
  includedUnits: number
  unitKind: string
  unitName: string
  extraUnitPrice: number
  maxExtraUnits: number
  replacementFee: number
  duvetsPerQuarter: number
  curtainsPerQuarter: number
  springCleanPerYear: number
  shoesPerMonth: number
  bedsheetsPerMonth: number
  concierge: boolean
  memberDiscountPct: number
  prioritySlots: boolean
}

// ----- The weekly kit (Oct 2026 client directive) -----
// The tiers are sized by PEOPLE: 1 (Essentials), 3 (Household), 5 (Whole
// Home). One Kozy Bag holds one person's full week — 7 collared/long-sleeve
// shirts, 7 inner vests, 7 underwear, 7 trousers, 7 pairs of socks — “fresh
// and kitted for a full week”. The bag/box system itself is UNCHANGED (the
// box simply holds 3× / 5× the weekly kit). The presentation copy lives in
// types.ts (WEEKLY_KIT_COPY / PEOPLE_PER_TIER) so client surfaces can share
// it without importing this server module.

export const DEFAULT_PLANS: PlanSeed[] = [
  {
    code: 'ESSENTIALS',
    name: 'The Essentials',
    tagline:
      'One person, kitted for a full week — seven shirts, vests, underwear, trousers and pairs of socks in every bag.',
    family: 'KIT',
    priceMonthly: 30000,
    sortOrder: 1,
    includedUnits: 4,
    unitKind: 'bag',
    unitName: 'Kozy Bag',
    extraUnitPrice: 5000,
    maxExtraUnits: 2,
    replacementFee: 5000,
    duvetsPerQuarter: 0,
    curtainsPerQuarter: 0,
    springCleanPerYear: 0,
    shoesPerMonth: 1,
    bedsheetsPerMonth: 0,
    concierge: false,
    memberDiscountPct: 5,
    prioritySlots: false,
  },
  {
    code: 'HOUSEHOLD',
    name: 'The Household',
    tagline:
      'Three people, kitted for the week — three times the Essentials kit in one box, plus the beds.',
    family: 'KIT',
    priceMonthly: 50000,
    sortOrder: 2,
    includedUnits: 4,
    unitKind: 'box',
    unitName: 'Kozy Box',
    extraUnitPrice: 7500,
    maxExtraUnits: 2,
    replacementFee: 12000,
    duvetsPerQuarter: 2,
    curtainsPerQuarter: 0,
    springCleanPerYear: 0,
    shoesPerMonth: 3,
    bedsheetsPerMonth: 4,
    concierge: false,
    memberDiscountPct: 10,
    prioritySlots: false,
  },
  {
    code: 'WHOLEHOME',
    name: 'The Whole Home',
    tagline:
      'Five people, kitted for the week — five times the kit, plus the beds, the curtains and a yearly deep clean.',
    family: 'KIT',
    priceMonthly: 80000,
    sortOrder: 3,
    includedUnits: 4,
    unitKind: 'box',
    unitName: 'Kozy Box',
    extraUnitPrice: 7500,
    maxExtraUnits: 2,
    replacementFee: 12000,
    duvetsPerQuarter: 3,
    curtainsPerQuarter: 6,
    springCleanPerYear: 1,
    shoesPerMonth: 5,
    bedsheetsPerMonth: 6,
    concierge: false,
    memberDiscountPct: 15,
    prioritySlots: true,
  },
]

// ----- The Shoe Club (phase 70 → 71) — a standalone shoes-only membership -----
// Lives with the SHOES section on /services, never in the tiers grid (owner
// directive). The unit is a PAIR — no kit, no bag; the monthly allowance is
// the tier-style shoesPerMonth counter the pickup route already consumes
// (kind=shoes). One pair = the standard sneaker/canvas clean (wash, brush,
// deodorise, air-dry); suede, leather and embellished pairs stay à-la-carte
// with the member discount — premium materials need specialist time, so
// they can never be flat-rated inside an allowance.
//
// Counts (phase 71, owner): 2 / 4 / 6 pairs — NOT 1/3/5, which mirrors the
// laundry tiers and confuses the shelf. A shoe-service customer thinks in
// ROTATION RHYTHM: 2 = a fresh pair every fortnight, 4 = the weekly
// rotation, 6 = the sneakerhead's twice-a-week rotation. Every club card
// then beats the Essentials perk (1 pair) and the top card beats even Whole
// Home (5), so the club stacks cleanly on top of any tier.
//
// Pricing (phase 71, owner directive: "cheaper than our cheapest competitor
// — not too cheap"): Lagos sneaker specialists charge ₦7,000–₦8,000 a pair
// for a basic clean (Care by Sneaklin: Sneaker Clean ₦8,000, Leather ₦7,000,
// Suede ₦12,000; Lekki IG shops from ~₦5,000). Kozy's own card reads
// ₦1,000 (coloured) – ₦1,500 (white) – ₦2,000 (suede) a pair. The club
// ladder prices a pair at ₦1,500 / ₦1,250 / ₦1,200 — never below our own
// ₦1,000 floor (so the club never undercuts Kozy's own card), a modest
// volume discount for commitment, and still 70–85% under the specialists.
// The anchor: the whole 6-pair rotation costs about ONE pair at a sneaker
// laundry. A ₦3,000 entry also covers a dedicated monthly pickup trip,
// which the old ₦1,000 tag never could.
export const DEFAULT_SHOE_CLUB: PlanSeed[] = [
  {
    code: 'SHOES2',
    name: 'Shoe Club · 2 pairs',
    tagline: 'The fortnightly freshen — one pair out, one pair back, every two weeks.',
    family: 'SHOES',
    priceMonthly: 3000,
    sortOrder: 11,
    includedUnits: 0,
    unitKind: 'pair',
    unitName: 'pair',
    extraUnitPrice: 0,
    maxExtraUnits: 0,
    replacementFee: 0,
    duvetsPerQuarter: 0,
    curtainsPerQuarter: 0,
    springCleanPerYear: 0,
    shoesPerMonth: 2,
    bedsheetsPerMonth: 0,
    concierge: false,
    memberDiscountPct: 5,
    prioritySlots: false,
  },
  {
    code: 'SHOES4',
    name: 'Shoe Club · 4 pairs',
    tagline: 'The weekly rotation — a fresh pair ready every week of the month.',
    family: 'SHOES',
    priceMonthly: 5000,
    sortOrder: 12,
    includedUnits: 0,
    unitKind: 'pair',
    unitName: 'pair',
    extraUnitPrice: 0,
    maxExtraUnits: 0,
    replacementFee: 0,
    duvetsPerQuarter: 0,
    curtainsPerQuarter: 0,
    springCleanPerYear: 0,
    shoesPerMonth: 4,
    bedsheetsPerMonth: 0,
    concierge: false,
    memberDiscountPct: 10,
    prioritySlots: false,
  },
  {
    code: 'SHOES6',
    name: 'Shoe Club · 6 pairs',
    tagline: 'The sneakerhead rotation — twice a week, always something fresh.',
    family: 'SHOES',
    priceMonthly: 7200,
    sortOrder: 13,
    includedUnits: 0,
    unitKind: 'pair',
    unitName: 'pair',
    extraUnitPrice: 0,
    maxExtraUnits: 0,
    replacementFee: 0,
    duvetsPerQuarter: 0,
    curtainsPerQuarter: 0,
    springCleanPerYear: 0,
    shoesPerMonth: 6,
    bedsheetsPerMonth: 0,
    concierge: false,
    memberDiscountPct: 15,
    prioritySlots: false,
  },
]

// ----- Self-seeding plan access -----

/** Map a Prisma row onto the client-facing shape (zoneNames-style arrays). */
export function rowToPlan(row: any): MembershipPlan {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    tagline: row.tagline ?? '',
    family: row.family === 'SHOES' ? 'SHOES' : 'KIT',
    priceMonthly: row.priceMonthly,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    includedUnits: row.includedUnits,
    unitKind: row.unitKind,
    unitName: row.unitName,
    extraUnitPrice: row.extraUnitPrice,
    maxExtraUnits: row.maxExtraUnits,
    replacementFee: row.replacementFee,
    duvetsPerQuarter: row.duvetsPerQuarter,
    curtainsPerQuarter: row.curtainsPerQuarter,
    springCleanPerYear: row.springCleanPerYear,
    shoesPerMonth: row.shoesPerMonth ?? 0,
    bedsheetsPerMonth: row.bedsheetsPerMonth ?? 0,
    concierge: row.concierge,
    memberDiscountPct: row.memberDiscountPct,
    prioritySlots: row.prioritySlots,
    paystackPlanCode: row.paystackPlanCode ?? null,
    createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt),
    updatedAt: row.updatedAt?.toISOString?.() ?? String(row.updatedAt),
  }
}

/** All seeds — tiers first, then the Shoe Club. */
const ALL_SEEDS: PlanSeed[] = [...DEFAULT_PLANS, ...DEFAULT_SHOE_CLUB]

/**
 * All plans, ordered for display, optionally narrowed to one family
 * ('KIT' = the tiers grid, 'SHOES' = the shoe-care section). Seeds ALL_SEEDS
 * on an empty table (idempotent create per code — concurrent first requests
 * race harmlessly thanks to the unique constraint + the create-only-if-
 * missing loop).
 */
export async function getPlans(
  includeInactive = true,
  family?: 'KIT' | 'SHOES'
): Promise<MembershipPlan[]> {
  try {
    let rows = await db.subscriptionPlan.findMany({
      orderBy: [{ sortOrder: 'asc' }, { priceMonthly: 'asc' }],
    })
    if (rows.length === 0) {
      for (const seed of ALL_SEEDS) {
        try {
          await db.subscriptionPlan.create({ data: { ...seed } })
        } catch {
          // Lost a create race — fine, the code row already exists.
        }
      }
      rows = await db.subscriptionPlan.findMany({
        orderBy: [{ sortOrder: 'asc' }, { priceMonthly: 'asc' }],
      })
    }
    let mapped = rows.map(rowToPlan)
    if (family) mapped = mapped.filter((p) => p.family === family)
    return includeInactive ? mapped : mapped.filter((p) => p.isActive)
  } catch {
    // DB unavailable (build-time prerender etc.) — serve code defaults so
    // every surface still renders sensible numbers.
    let fallback = ALL_SEEDS.map((seed, i) => ({
      ...seed,
      id: `default-${seed.code.toLowerCase()}`,
      isActive: true,
      paystackPlanCode: null as string | null,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      sortOrder: seed.sortOrder || i + 1,
    }))
    if (family) fallback = fallback.filter((p) => p.family === family)
    return includeInactive ? fallback : fallback.filter((p) => p.isActive)
  }
}

/** Persist an admin's plan edits (price, perks, caps — everything). */
export async function savePlans(
  edits: Array<{ id: string } & Partial<PlanSeed> & { isActive?: boolean }>
): Promise<MembershipPlan[]> {
  for (const edit of edits) {
    if (!edit.id || edit.id.startsWith('default-')) {
      // A default-shaped row reached the editor before the DB seeded —
      // create the real row instead of a no-op update.
      const code = edit.code
      if (code) {
        await db.subscriptionPlan.upsert({
          where: { code },
          update: {},
          create: {
            // Tier codes AND club codes live across both seed tables — search
            // ALL_SEEDS, never DEFAULT_PLANS alone (a club default-row would
            // otherwise seed a duplicate ESSENTIALS-shaped row).
            ...(ALL_SEEDS.find((p) => p.code === code) ?? DEFAULT_PLANS[0]),
          },
        })
      }
      continue
    }
    const data: Record<string, unknown> = {}
    const numericKeys = [
      'priceMonthly',
      'sortOrder',
      'includedUnits',
      'extraUnitPrice',
      'maxExtraUnits',
      'replacementFee',
      'duvetsPerQuarter',
      'curtainsPerQuarter',
      'springCleanPerYear',
      'shoesPerMonth',
      'bedsheetsPerMonth',
      'memberDiscountPct',
    ] as const
    for (const k of numericKeys) {
      const v = (edit as any)[k]
      if (v !== undefined && Number.isFinite(Number(v))) {
        data[k] = Math.max(0, Math.round(Number(v)))
      }
    }
    const stringKeys = ['name', 'tagline', 'unitKind', 'unitName'] as const
    for (const k of stringKeys) {
      const v = (edit as any)[k]
      if (typeof v === 'string' && v.trim().length > 0) data[k] = v.trim()
    }
    for (const k of ['concierge', 'prioritySlots', 'isActive'] as const) {
      const v = (edit as any)[k]
      if (typeof v === 'boolean') data[k] = v
    }
    if (Object.keys(data).length > 0) {
      await db.subscriptionPlan.update({ where: { id: edit.id }, data })
    }
  }
  return getPlans(true)
}

// ----- Cycle / usage helpers (pure — shared by API + client) -----

export function quarterKey(d = new Date()): string {
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`
}

export function yearKey(d = new Date()): string {
  return String(d.getFullYear())
}

export function cycleKey(periodStart: Date | string | null | undefined): string {
  if (!periodStart) return 'none'
  const d = new Date(periodStart)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const CYCLE_DAYS = 30

/**
 * The effective status a member sees:
 *   ACTIVE, ACTIVE-but-expiring (cancelAtPeriodEnd), PAST_DUE (period ended
 *   within the last 7 days — grace), LAPSED (ended longer ago).
 * Stored status stays simple; the nuance is computed.
 */
export function effectiveStatus(sub: {
  status: string
  periodEnd?: string | Date | null
  cancelAtPeriodEnd?: boolean
}): string {
  if (sub.status === 'CANCELLED' || sub.status === 'LAPSED') return sub.status
  if (sub.status === 'PENDING_ACTIVATION') return 'PENDING_ACTIVATION'
  const end = sub.periodEnd ? new Date(sub.periodEnd) : null
  if (end && end.getTime() < Date.now()) {
    const daysLate = (Date.now() - end.getTime()) / (24 * 60 * 60 * 1000)
    return daysLate <= 7 ? 'PAST_DUE' : 'LAPSED'
  }
  return sub.cancelAtPeriodEnd ? 'EXPIRING' : 'ACTIVE'
}

/**
 * Usage with lazy quarter/year rolls: if the stored counters belong to an
 * older quarter/year than "now", they read as zero (the write-back happens
 * at the next booking/renewal — reads must never mutate).
 */
export function effectiveUsage(
  sub: {
    unitsUsed: number
    extraUnitsUsed: number
    shoesUsed: number
    duvetsUsed: number
    curtainsUsed: number
    springCleanUsed: number
    bedsheetsUsed: number
    usageQuarterKey?: string | null
    usageYearKey?: string | null
  },
  plan: { includedUnits: number; maxExtraUnits: number; shoesPerMonth: number; duvetsPerQuarter: number; curtainsPerQuarter: number; springCleanPerYear: number; bedsheetsPerMonth: number }
) {
  const quarterRolled = (sub.usageQuarterKey ?? '') !== quarterKey()
  const yearRolled = (sub.usageYearKey ?? '') !== yearKey()
  const unitsUsed = sub.unitsUsed
  const shoesUsed = sub.shoesUsed ?? 0
  const duvetsUsed = quarterRolled ? 0 : sub.duvetsUsed
  const curtainsUsed = quarterRolled ? 0 : sub.curtainsUsed
  const springCleanUsed = yearRolled ? 0 : sub.springCleanUsed
  const bedsheetsUsed = sub.bedsheetsUsed ?? 0
  return {
    unitsUsed,
    unitsRemaining: Math.max(0, plan.includedUnits - unitsUsed),
    extraUnitsUsed: sub.extraUnitsUsed,
    extraRemaining: Math.max(0, plan.maxExtraUnits - sub.extraUnitsUsed),
    shoesUsed,
    shoesRemaining: Math.max(0, plan.shoesPerMonth - shoesUsed),
    duvetsUsed,
    duvetsRemaining: Math.max(0, plan.duvetsPerQuarter - duvetsUsed),
    curtainsUsed,
    curtainsRemaining: Math.max(0, plan.curtainsPerQuarter - curtainsUsed),
    springCleanUsed,
    springCleanRemaining: Math.max(0, plan.springCleanPerYear - springCleanUsed),
    bedsheetsUsed,
    bedsheetsRemaining: Math.max(0, plan.bedsheetsPerMonth - bedsheetsUsed),
  }
}

/** Map a Prisma subscription row (with plan included) onto the client shape. */
export function rowToMembership(row: any): Membership {
  const plan = row.plan ? rowToPlan(row.plan) : undefined
  // Phase 81: the member-scheduled tier switch (present only for live
  // memberships with a change queued). Surfaces so the portal can say
  // "switching to X at your next renewal" and the admin drill-down can
  // see it coming.
  const pendingPlan = row.pendingPlan ? rowToPlan(row.pendingPlan) : undefined
  return {
    id: row.id,
    userId: row.userId,
    status: row.status as Membership['status'],
    pricePaid: row.pricePaid,
    paymentMethod: row.paymentMethod,
    periodStart: row.periodStart?.toISOString?.() ?? null,
    periodEnd: row.periodEnd?.toISOString?.() ?? null,
    cancelAtPeriodEnd: Boolean(row.cancelAtPeriodEnd),
    pendingPlan,
    unitsUsed: row.unitsUsed,
    extraUnitsUsed: row.extraUnitsUsed,
    shoesUsed: row.shoesUsed ?? 0,
    duvetsUsed: row.duvetsUsed,
    curtainsUsed: row.curtainsUsed,
    springCleanUsed: row.springCleanUsed,
    bedsheetsUsed: row.bedsheetsUsed ?? 0,
    kitState: row.kitState,
    kitDeliveredAt: row.kitDeliveredAt?.toISOString?.() ?? null,
    paystackRef: row.paystackRef ?? null,
    plan,
    createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt),
    updatedAt: row.updatedAt?.toISOString?.() ?? String(row.updatedAt),
  }
}

// ----- Activation / renewal (shared by admin verify + Paystack webhook) -----

// =============================================================================
// THE OPEN TRANSFER CLAIM (Task 82) — "I've made payment", wired properly
// =============================================================================
// A member pressing "I've made payment" writes a RENEWAL_INTENT ledger row.
// Until the office confirms (a CYCLE_START lands — verify, renew, webhook),
// that claim is OPEN: the member's card must show it (greyed months, no
// duplicate claims — the claimed state used to live only in React state and
// evaporated on refresh), and the office roster must show it (the claim was
// invisible on the admin list until this task — "nothing on the admin side").
//
// A claim with no confirmation after CLAIM_STALE_DAYS stops gating the member
// (they can pay again) but stays visible to the office for reconciliation.
// =============================================================================

export const CLAIM_STALE_DAYS = 14

export interface RenewalClaim {
  months: number
  amount: number
  reference: string
  /** true = the claim completes a PENDING_ACTIVATION first payment. */
  isInitial: boolean
  receipt: boolean
  planCode: string | null
  claimedAt: string
  /** True when older than CLAIM_STALE_DAYS without a confirmation. */
  stale: boolean
}

function claimFromEvent(
  intent: { meta: string | null; createdAt: Date },
  now: Date = new Date()
): RenewalClaim | null {
  let meta: Record<string, unknown> = {}
  try {
    meta = JSON.parse(intent.meta ?? '{}')
  } catch {
    return null
  }
  const months = Math.round(Number(meta.months))
  if (!Number.isFinite(months) || months < 1) return null
  const claimedAt = new Date(intent.createdAt)
  const stale = now.getTime() - claimedAt.getTime() > CLAIM_STALE_DAYS * 24 * 60 * 60 * 1000
  return {
    months: Math.min(months, 12),
    amount: Math.max(0, Math.round(Number(meta.amount) || 0)),
    reference: String(meta.reference ?? 'transfer'),
    isInitial: Boolean(meta.isInitial),
    receipt: Boolean(meta.receipt) && meta.receipt !== 'none',
    planCode: typeof meta.planCode === 'string' ? meta.planCode : null,
    claimedAt: claimedAt.toISOString(),
    stale,
  }
}

/**
 * The member's open transfer claim, or null. Open = the newest RENEWAL_INTENT
 * with NO newer CYCLE_START (the office's confirmation settles every claim
 * before it — approving a different amount still clears the member's
 * "awaiting" state, which is the honest outcome: the office has acted).
 */
export async function openRenewalClaim(
  subscriptionId: string,
  now: Date = new Date()
): Promise<RenewalClaim | null> {
  const events = await db.subscriptionEvent.findMany({
    where: {
      subscriptionId,
      kind: { in: ['RENEWAL_INTENT', 'CYCLE_START'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { kind: true, meta: true, createdAt: true },
  })
  const latestIntent = events.find((e) => e.kind === 'RENEWAL_INTENT')
  if (!latestIntent) return null
  const settled = events.some(
    (e) => e.kind === 'CYCLE_START' && e.createdAt > latestIntent.createdAt
  )
  if (settled) return null
  return claimFromEvent(latestIntent, now)
}

/**
 * Batch version for the admin roster: ONE query for all listed memberships,
 * same settlement rule per subscription. Returns a map of subscriptionId →
 * open claim (unsettled claims only — stale ones included so the office can
 * reconcile old money).
 */
export async function openRenewalClaimsFor(
  subscriptionIds: string[],
  now: Date = new Date()
): Promise<Map<string, RenewalClaim>> {
  const out = new Map<string, RenewalClaim>()
  if (subscriptionIds.length === 0) return out
  const events = await db.subscriptionEvent.findMany({
    where: {
      subscriptionId: { in: subscriptionIds },
      kind: { in: ['RENEWAL_INTENT', 'CYCLE_START'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: { subscriptionId: true, kind: true, meta: true, createdAt: true },
  })
  for (const subId of subscriptionIds) {
    const mine = events.filter((e) => e.subscriptionId === subId)
    const latestIntent = mine.find((e) => e.kind === 'RENEWAL_INTENT')
    if (!latestIntent) continue
    const settled = mine.some(
      (e) => e.kind === 'CYCLE_START' && e.createdAt > latestIntent.createdAt
    )
    if (settled) continue
    const claim = claimFromEvent(latestIntent, now)
    if (claim) out.set(subId, claim)
  }
  return out
}

/**
 * Activate a fresh subscription or renew an existing cycle. Resets the unit
 * counters belonging to the new cycle and lazily rolls the quarter/year
 * bookmarks. Idempotent-ish: called only after money is confirmed.
 *
 * Phase 75: every activation/renewal also writes a CYCLE_START ledger row —
 * the renewal history the member (and the office) can look back on.
 */
export async function activateOrRenewSubscription(
  subscriptionId: string,
  opts: { pricePaid: number; method: string; cycles?: number }
): Promise<any> {
  const sub = await db.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true, pendingPlan: true },
  })
  if (!sub) throw new Error('Subscription not found')

  // Phase 76: multi-month renewals — one payment can cover several cycles.
  // Clamped to a sane 1..12 so a bad payload can never mint a decade.
  const cycles = Math.min(Math.max(Math.round(opts.cycles ?? 1), 1), 12)
  const cycleMs = CYCLE_DAYS * 24 * 60 * 60 * 1000

  // Phase 81: apply a member-scheduled tier switch with this payment — the
  // new cycle (and its entitlements + kit language) run on the pending plan.
  // Swapped atomically in the same update so a member never lands in a
  // half-switched state.
  const switchTo = sub.pendingPlan ?? null
  const switchedFrom = switchTo ? sub.plan : null

  const now = new Date()
  const periodStart = now
  const periodEnd = new Date(now.getTime() + cycles * cycleMs)

  // A renewal while still active extends from the CURRENT period end, so a
  // member who pays early never loses days — multi-month payments extend by
  // cycles × 30 from the same base.
  const base =
    sub.periodEnd && sub.periodEnd.getTime() > now.getTime() ? sub.periodEnd : now
  const end =
    sub.status === 'ACTIVE' && sub.periodEnd
      ? new Date(base.getTime() + cycles * cycleMs)
      : periodEnd

  const updated = await db.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'ACTIVE',
      periodStart,
      periodEnd: end,
      pricePaid: Math.round(opts.pricePaid),
      paymentMethod: opts.method,
      transferReceipt: null,
      // Phase 81: the scheduled switch lands with the money.
      ...(switchTo ? { planId: switchTo.id, pendingPlanId: null } : {}),
      // Unit counters reset for the new cycle; perk counters roll lazily
      // (their bookmarks are stamped so effectiveUsage can compute).
      unitsUsed: 0,
      extraUnitsUsed: 0,
      shoesUsed: 0,
      bedsheetsUsed: 0,
      usageCycleKey: cycleKey(periodStart),
      usageQuarterKey: quarterKey(),
      usageYearKey: yearKey(),
      cancelAtPeriodEnd: false,
      cancelledAt: null,
      cancelledReason: null,
    },
    include: { plan: true },
  })

  // The ledger row (best-effort — activation must never fail on it).
  try {
    await db.subscriptionEvent.create({
      data: {
        subscriptionId,
        kind: 'CYCLE_START',
        delta: 0,
        count: 0,
        meta: JSON.stringify({
          periodStart: periodStart.toISOString(),
          periodEnd: end.toISOString(),
          pricePaid: Math.round(opts.pricePaid),
          method: opts.method,
          renewal: sub.status === 'ACTIVE',
          cycles,
          ...(switchTo && switchedFrom
            ? { planChanged: { from: switchedFrom.code, to: switchTo.code } }
            : {}),
        }),
        ...(switchTo && switchedFrom
          ? {
              note: `Tier switch applied with this payment: ${switchedFrom.name} → ${switchTo.name}.`,
            }
          : {}),
      },
    })
  } catch (e) {
    console.error('emberships] CYCLE_START ledger write failed:', e)
  }

  // ----- Task 86: book the first Kozy Bag claimed at checkout -----
  // A FRESH activation (not a renewal) whose member claimed their checkout
  // basket as the first Bag gets it placed NOW: the exact basket they
  // built, mixed as it is, at zero naira, riding the normal order pipeline
  // (rider, kanban, notifications). Best-effort - activation itself must
  // never fail because a courtesy booking hiccuped; the claim stays on the
  // ledger either way, and the office can book it by hand.
  if (sub.status !== 'ACTIVE') {
    try {
      await placeFirstBagOrder(updated.id)
    } catch (e) {
      console.error('emberships] first-bag booking failed (claim preserved on ledger):', e)
    }
  }

  return updated
}


// =============================================================================
// Task 86 — the first Kozy Bag claimed at checkout (the conversion engine)
// =============================================================================
// The owner's offer, honoured mechanically: a customer whose one-off basket
// reached ₦15,000+ at checkout was pitched the tier their spend maps to,
// with THIS basket — mixed as it is — riding as their first Kozy Bag, free.
// The claim (validated basket, addresses, slot) waits on the ledger as
// FIRST_BAG_CLAIMED; the moment the first month is PAID
// (activateOrRenewSubscription — office-verified transfer or Paystack),
// this function turns it into a real order:
//   - every garment they selected, at zero naira each (the plan covers it)
//   - the plan's standard turnaround (express was a one-off choice)
//   - ONE included bag/box unit consumed (the first bag IS a pickup)
//   - the kit hand-over rides the same stop
//   - rides the NORMAL pipeline: branch assignment, rider view, kanban,
//     customer + admin notifications — zero new pipeline code.
// If the claimed pickup date has passed by activation time, the pickup
// moves to tomorrow (same slot) — the office sees the note on the manifest.
// =============================================================================

interface FirstBagBasket {
  items: Record<string, number>
  pickupAddress: string
  pickupDate: string
  pickupSlot: string
  deliveryAddress: string
  modeOfWash?: 'MACHINE' | 'HANDWASH' | 'IRON_ONLY'
  serviceSpeed?: 'STANDARD' | 'EXPRESS_24' | 'EXPRESS_48' | 'EXPRESS_12'
  alterationNotes?: string
  estimatedTotal: number
}

function parseFirstBagBasket(metaJson: string | null): FirstBagBasket | null {
  if (!metaJson) return null
  try {
    const b = JSON.parse(metaJson)
    if (!b || typeof b !== 'object') return null
    if (!b.items || typeof b.items !== 'object' || Array.isArray(b.items)) return null
    if (typeof b.pickupAddress !== 'string' || b.pickupAddress.length < 8) return null
    if (typeof b.pickupSlot !== 'string' || !b.pickupSlot) return null
    return b as FirstBagBasket
  } catch {
    return null
  }
}

/** Place the claimed first Kozy Bag. Idempotent: a claim that already has
 *  its FIRST_BAG_BOOKED marker (or its order) is never booked twice. */
export async function placeFirstBagOrder(subscriptionId: string): Promise<string | null> {
  const sub = await db.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  })
  if (!sub || !sub.plan) return null

  // The claim, and whether it has already been honoured.
  const events = await db.subscriptionEvent.findMany({
    where: { subscriptionId, kind: { in: ['FIRST_BAG_CLAIMED', 'FIRST_BAG_BOOKED'] } },
    orderBy: { createdAt: 'asc' },
  })
  const claimed = events.find((e) => e.kind === 'FIRST_BAG_CLAIMED')
  const booked = events.find((e) => e.kind === 'FIRST_BAG_BOOKED')
  if (!claimed || booked) return null
  const basket = parseFirstBagBasket(claimed.meta)
  if (!basket) return null

  // Rebuild the item manifest from the shared catalog: every garment they
  // selected, at zero naira. Alterations ride as "to be quoted" (the
  // seamstress quotes before any work — the plan does not include sewing).
  const items: Array<{ id: string; name: string; quantity: number; unitPrice: number }> = []
  for (const [id, qty] of Object.entries(basket.items)) {
    if (id === 'alteration') {
      items.push({
        id: 'firstbag_alteration',
        name: `Alterations — to be quoted by the studio (${qty} piece${qty === 1 ? '' : 's'})`,
        quantity: qty,
        unitPrice: 0,
      })
      continue
    }
    const g = GARMENT_CATALOG.find((c) => c.id === id)
    if (!g) continue // unknown id — drop silently, never fail the booking
    items.push({
      id: `firstbag_${g.id}`,
      name: `${g.name} — first ${sub.plan.unitName} (included)`,
      quantity: qty,
      unitPrice: 0,
    })
  }
  if (items.length === 0) return null

  // The pickup date: honoured as claimed unless it has already passed —
  // then the next sensible day, same slot, with a manifest note.
  const claimedDate = new Date(basket.pickupDate)
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const pickupDate =
    !Number.isNaN(claimedDate.getTime()) && claimedDate.getTime() >= todayStart.getTime()
      ? claimedDate
      : new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
  const dateMoved = pickupDate.getTime() !== claimedDate.getTime()

  const branch = await assignBranchForAddress(basket.pickupAddress)

  const manifestNote: string[] = [
    `FIRST KOZY BAG — included with the first month of ${sub.plan.name} (claimed at checkout: ${formatNaira(basket.estimatedTotal)} one-off basket, mixed as-is)`,
    `KIT DELIVERY — hand over the ${sub.plan.unitName} at this stop`,
  ]
  if (dateMoved) {
    manifestNote.push(`Date moved from ${basket.pickupDate} (claimed) — first month confirmed after that date`)
  }
  if (basket.serviceSpeed && basket.serviceSpeed !== 'STANDARD') {
    manifestNote.push('Express was selected at checkout — the first Bag rides at the plan standard turnaround')
  }
  if (items.some((i) => i.id === 'firstbag_alteration')) {
    manifestNote.push(`Alteration note from checkout: ${basket.alterationNotes ?? '(none given — the seamstress will call)'}`)
  }

  const orderNumber = `KZ-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`
  const order = await db.order.create({
    data: {
      orderNumber,
      userId: sub.userId,
      status: 'PAYMENT_VERIFIED', // money settled by the membership itself
      type: 'ITEM',
      guaranteeActive: false,
      serviceSpeed: 'STANDARD',
      modeOfWash: basket.modeOfWash ?? 'MACHINE',
      deliveryFee: 0,
      itemsManifest: JSON.stringify(items),
      alterationNotes: manifestNote.join(' · '), // shows in the admin manifest panel
      totalPrice: 0,
      subscriptionId: sub.id,
      ...(branch ? { branchId: branch.branchId } : {}),
      pickupAddress: basket.pickupAddress,
      pickupDate,
      pickupTimeSlot: basket.pickupSlot,
      deliveryAddress: basket.deliveryAddress || null,
    },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, role: true } },
      payments: true,
    },
  })

  // Status trail.
  try {
    await db.statusEvent.create({
      data: {
        orderId: order.id,
        status: order.status,
        note: `First ${sub.plan.unitName} claimed at checkout — covered by the first month of ${sub.plan.name}${branch ? ` · ${branch.branchName} branch` : ''}`,
      },
    })
  } catch {
    /* trail is best-effort */
  }

  // Consume ONE included unit (the first bag IS a pickup of the plan) and
  // hand over the kit on the same stop.
  try {
    await db.subscription.update({
      where: { id: sub.id },
      data: {
        unitsUsed: (sub.unitsUsed ?? 0) + 1,
        usageCycleKey: sub.usageCycleKey ?? 'seed',
        ...(sub.kitState === 'PENDING_DELIVERY'
          ? { kitState: 'WITH_MEMBER', kitDeliveredAt: new Date() }
          : {}),
      },
    })
  } catch (e) {
    console.error('emberships] first-bag usage update failed (order still placed):', e)
  }

  // The ledger: the UNIT consumption + the booking marker (idempotency) +
  // the kit hand-over.
  await recordSubscriptionEvent({
    subscriptionId: sub.id,
    kind: 'UNIT',
    delta: 1,
    count: 1,
    meta: { includedUnits: 1, extraUnits: 0, firstBag: true },
    note: 'First Kozy Bag claimed at checkout — booked on activation',
    orderId: order.id,
  })
  await recordSubscriptionEvent({
    subscriptionId: sub.id,
    kind: 'FIRST_BAG_BOOKED',
    delta: 0,
    count: 0,
    note: `Order ${order.orderNumber} placed — the checkout basket rides as the first ${sub.plan.unitName}`,
    orderId: order.id,
  })
  if (sub.kitState === 'PENDING_DELIVERY') {
    await recordSubscriptionEvent({
      subscriptionId: sub.id,
      kind: 'KIT_DELIVERED',
      delta: 0,
      count: 0,
      note: 'Kit handed over with the first Kozy Bag',
      orderId: order.id,
    })
  }

  // Notifications (best-effort — the booking itself is already done).
  try {
    await notifyOrderCreated(order as any)
    await notifyAdminNewOrder(order as any)
  } catch (e) {
    console.error('emberships] first-bag notifications failed:', e)
  }

  return order.id
}

// =============================================================================
// THE MEMBER ACTIVITY LEDGER (phase 75)
// =============================================================================
// Append-only SubscriptionEvent rows are the WHY behind the counters. The
// helpers below are the ONLY sanctioned ways to write them, so every surface
// (member booking, order cancellation, admin desk) records the same shape.
// =============================================================================

/** Kinds that consume allowance (their refund twins carry _REFUND). */
export const BOOKING_KINDS = ['UNIT', 'SHOES', 'DUVET', 'CURTAIN', 'SPRING', 'BEDSHEET'] as const
export type BookingKind = (typeof BOOKING_KINDS)[number]

export const KIND_COUNTER: Record<BookingKind, 'unitsUsed' | 'shoesUsed' | 'duvetsUsed' | 'curtainsUsed' | 'springCleanUsed' | 'bedsheetsUsed'> = {
  UNIT: 'unitsUsed',
  SHOES: 'shoesUsed',
  DUVET: 'duvetsUsed',
  CURTAIN: 'curtainsUsed',
  SPRING: 'springCleanUsed',
  BEDSHEET: 'bedsheetsUsed',
}

/**
 * Record a booking's consumption (or its refund — pass a negative delta).
 * `meta` for UNIT bookings carries the included/extra split so a refund can
 * put back exactly what was taken.
 */
export async function recordSubscriptionEvent(input: {
  subscriptionId: string
  kind: string
  delta: number
  count?: number
  meta?: Record<string, unknown>
  note?: string
  orderId?: string
  recordedById?: string
}): Promise<void> {
  try {
    await db.subscriptionEvent.create({
      data: {
        subscriptionId: input.subscriptionId,
        kind: input.kind,
        delta: Math.round(input.delta),
        count: Math.max(0, Math.round(input.count ?? 1)),
        ...(input.meta ? { meta: JSON.stringify(input.meta) } : {}),
        ...(input.note ? { note: input.note.slice(0, 300) } : {}),
        ...(input.orderId ? { orderId: input.orderId } : {}),
        ...(input.recordedById ? { recordedById: input.recordedById } : {}),
      },
    })
  } catch (e) {
    // The ledger is append-only history — never let it break the money path.
    console.error('[memberships] ledger write failed:', input.kind, e)
  }
}

/**
 * Refund a cancelled member order's allowance. Reads the order's original
 * booking event (with the included/extra split in meta) and returns exactly
 * that to the counters — clamped at zero so a refund can never go negative
 * (edge: the cycle rolled between booking and cancellation).
 *
 * Idempotent: a second call finds the refund already written and no-ops —
 * dragging an order in and out of CANCELLED can never double-refund.
 */
export async function refundSubscriptionUsage(orderId: string): Promise<boolean> {
  const booking = await db.subscriptionEvent.findFirst({
    where: { orderId, kind: { in: [...BOOKING_KINDS] } },
    orderBy: { createdAt: 'desc' },
  })
  if (!booking) return false
  const already = await db.subscriptionEvent.findFirst({
    where: { orderId, kind: `${booking.kind}_REFUND` },
  })
  if (already) return false

  const sub = await db.subscription.findUnique({ where: { id: booking.subscriptionId } })
  if (!sub) return false

  const meta = (() => {
    try {
      return JSON.parse(booking.meta ?? '{}')
    } catch {
      return {}
    }
  })()

  const patch: Record<string, number> = {}
  if (booking.kind === 'UNIT') {
    const included = Math.max(0, Number(meta.includedUnits ?? booking.count))
    const extra = Math.max(0, Number(meta.extraUnits ?? 0))
    patch.unitsUsed = Math.max(0, sub.unitsUsed - included)
    patch.extraUnitsUsed = Math.max(0, sub.extraUnitsUsed - extra)
  } else {
    const counter = KIND_COUNTER[booking.kind as BookingKind]
    const before = (sub as any)[counter] ?? 0
    ;(patch as any)[counter] = Math.max(0, before - booking.count)
  }

  await db.subscription.update({ where: { id: sub.id }, data: patch })
  await recordSubscriptionEvent({
    subscriptionId: sub.id,
    kind: `${booking.kind}_REFUND`,
    delta: -booking.count,
    count: booking.count,
    meta,
    note: 'Cancelled booking — allowance returned',
    orderId,
  })
  return true
}

// =============================================================================
// KIT TAGS (phase 75) — the QR on the physical Kozy Bag / Kozy Box
// =============================================================================
// Minted when the kit goes out (first pickup or admin "mark delivered").
// The QR encodes https://kozycare.ng/kit/{code} — staff scan it in the van
// or on the wash floor and instantly see whose bag this is, the plan and
// the cycle usage.
// =============================================================================

// 32-char alphabet without ambiguous glyphs (no 0/O/1/I) — readable aloud
// over the phone when a label smudges.
const KIT_TAG_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function mintKitTagCode(): string {
  let s = ''
  for (let i = 0; i < 6; i++) {
    s += KIT_TAG_ALPHABET[Math.floor(Math.random() * KIT_TAG_ALPHABET.length)]
  }
  return `KZK-${s}`
}

/**
 * Ensure the subscription has a kit tag (mint on first need). Retries on the
    (rare) unique collision. Returns the tag.
 */
export async function ensureKitTag(subscriptionId: string): Promise<string> {
  const sub = await db.subscription.findUnique({ where: { id: subscriptionId } })
  if (!sub) throw new Error('Subscription not found')
  if (sub.kitTag) return sub.kitTag
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = mintKitTagCode()
    try {
      const updated = await db.subscription.update({
        where: { id: subscriptionId },
        data: { kitTag: code },
      })
      return updated.kitTag ?? code
    } catch {
      // Either a concurrent mint or a code collision — try a fresh code.
      const again = await db.subscription.findUnique({ where: { id: subscriptionId } })
      if (again?.kitTag) return again.kitTag
    }
  }
  throw new Error('Could not mint a kit tag — try again')
}

// =============================================================================
// CYCLE HEALTH (phase 75) — the retention radar
// =============================================================================
// One glance per member: are they USING what they paid for? An unused member
// is a cancellation waiting to happen; an over-quota member is a candidate
// for the next tier up. Missed pickups need a phone call today.
// =============================================================================

export type CycleHealth = {
  /** OK | UNUSED_RISK | OVER_QUOTA | NO_USAGE_DATA | INACTIVE */
  state: string
  /** Human sentence for the admin roster + drill-down. */
  label: string
  missedPickups: number
  pickupsThisCycle: number
  /** Allowance share consumed (0–1); null when the plan has no units. */
  usageRatio: number | null
  /** Share of the cycle already elapsed (0–1). */
  cycleElapsed: number | null
}

/**
 * Compute a member's cycle health from the counters + this cycle's member
 * orders. `orders` should be the subscription's orders created since
 * periodStart (status != CANCELLED for the live view).
 */
export function cycleHealth(
  sub: { status: string; periodStart: Date | string | null; periodEnd: Date | string | null; unitsUsed: number },
  plan: { includedUnits: number } | null | undefined,
  orders: Array<{ status: string; pickupDate: Date | string; pickedUpAt: Date | string | null; createdAt: Date | string }>,
  now: Date = new Date()
): CycleHealth {
  const eff = effectiveStatus(sub as any)
  if (eff !== 'ACTIVE' && eff !== 'EXPIRING' && eff !== 'PAST_DUE') {
    return {
      state: 'INACTIVE',
      label: 'Not running',
      missedPickups: 0,
      pickupsThisCycle: 0,
      usageRatio: null,
      cycleElapsed: null,
    }
  }

  const start = sub.periodStart ? new Date(sub.periodStart) : null
  const end = sub.periodEnd ? new Date(sub.periodEnd) : null
  const live = orders.filter((o) => o.status !== 'CANCELLED')
  const missed = live.filter((o) => {
    const pd = new Date(o.pickupDate)
    // A member order whose pickup day passed without being picked up.
    const dayEnd = new Date(pd)
    dayEnd.setHours(23, 59, 59, 999)
    return !o.pickedUpAt && dayEnd.getTime() < now.getTime()
  })

  const pickedUp = live.filter((o) => Boolean(o.pickedUpAt)).length
  const usageRatio = plan && plan.includedUnits > 0 ? Math.min(1, sub.unitsUsed / plan.includedUnits) : null

  let cycleElapsed: number | null = null
  if (start && end && end.getTime() > start.getTime()) {
    cycleElapsed = Math.max(0, Math.min(1, (now.getTime() - start.getTime()) / (end.getTime() - start.getTime())))
  }

  let state = 'OK'
  let label = 'On track'
  if (missed.length > 0) {
    state = 'MISSED_PICKUP'
    label = `${missed.length} missed pickup${missed.length === 1 ? '' : 's'} — call today`
  } else if (usageRatio !== null && cycleElapsed !== null && cycleElapsed > 0.6 && usageRatio < 0.25) {
    state = 'UNUSED_RISK'
    label = 'Barely used — nudge before the month runs out'
  } else if (usageRatio !== null && usageRatio >= 1) {
    state = 'OVER_QUOTA'
    label = 'Full allowance used — extras or next tier'
  } else if (pickedUp === 0 && live.length === 0 && cycleElapsed !== null && cycleElapsed > 0.35) {
    state = 'NO_USAGE_DATA'
    label = 'No bookings yet this cycle'
  }

  return { state, label, missedPickups: missed.length, pickupsThisCycle: pickedUp, usageRatio, cycleElapsed }
}

/**
 * A member's in-cycle activity for the portal and the admin drill-down:
 * the subscription orders since periodStart (with live status + the
 * missed-pickup flag) and the raw ledger tail. Kept lean — the portal
 * payload stays small even for a heavy member.
 */
export async function getSubscriptionActivity(subscriptionId: string, opts?: { eventLimit?: number }) {
  const sub = await db.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  })
  if (!sub) return null

  const since = sub.periodStart ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const orders = await db.order.findMany({
    where: { subscriptionId: sub.id, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      itemsManifest: true,
      pickupDate: true,
      pickupTimeSlot: true,
      pickedUpAt: true,
      deliveredAt: true,
      totalPrice: true,
      createdAt: true,
    },
  })

  const events = await db.subscriptionEvent.findMany({
    where: { subscriptionId: sub.id },
    orderBy: { createdAt: 'desc' },
    take: opts?.eventLimit ?? 30,
  })

  const now = new Date()
  const activity = orders.map((o) => {
    let kind = 'unit'
    let count = 1
    let label = 'Member pickup'
    try {
      const first = JSON.parse(o.itemsManifest ?? '[]')[0]
      if (first?.id) {
        if (first.id === 'member_unit') {
          kind = 'unit'
          count = Number(first.quantity ?? 1)
          label = `${count} × ${sub.plan?.unitName ?? 'Kozy Bag'} pickup${count === 1 ? '' : 's'}`
        } else if (first.id === 'member_perk_duvet') {
          kind = 'duvet'
          count = Number(first.quantity ?? 1)
          label = count === 1 ? 'Duvet wash — included' : `${count} × duvet wash — included`
        } else if (first.id === 'member_perk_curtain') {
          kind = 'curtain'
          count = Number(first.quantity ?? 1)
          label = 'Curtain care — included'
        } else if (first.id === 'member_perk_spring') {
          kind = 'spring-clean'
          count = 1
          label = 'Spring clean — included'
        } else if (first.id === 'member_perk_shoes') {
          kind = 'shoes'
          count = Number(first.quantity ?? 1)
          label = count === 1 ? 'Shoe clean — included' : `${count} × shoe clean — included`
        }
      }
    } catch {
      /* manifest unparsable — the generic label stands */
    }
    const dayEnd = new Date(o.pickupDate)
    dayEnd.setHours(23, 59, 59, 999)
    const missed = !o.pickedUpAt && o.status !== 'CANCELLED' && dayEnd.getTime() < now.getTime()
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      kind,
      count,
      label,
      status: o.status,
      missed,
      pickupDate: o.pickupDate.toISOString(),
      pickupTimeSlot: o.pickupTimeSlot,
      pickedUpAt: o.pickedUpAt?.toISOString() ?? null,
      deliveredAt: o.deliveredAt?.toISOString() ?? null,
      extraCharge: o.totalPrice ?? 0,
      createdAt: o.createdAt.toISOString(),
    }
  })

  return {
    subscriptionId: sub.id,
    activity,
    events: events.map((e) => ({
      id: e.id,
      kind: e.kind,
      delta: e.delta,
      count: e.count,
      meta: e.meta,
      note: e.note,
      orderId: e.orderId,
      createdAt: e.createdAt.toISOString(),
    })),
  }
}

// =============================================================================
// THE SMART NUDGE (phase 78) — behaviour-targeted upselling, done politely
// =============================================================================
// ONE quiet line, at most, riding inside an email that is already being sent
// for a functional reason (the monthly summary). Never a standalone mail,
// never a popup, never a countdown. The member's own behaviour picks the
// line — or picks silence:
//
//   UPGRADE  for the power user (allowance exhausted + extras on top, and a
//            higher tier exists) — framed as right-sizing, not selling.
//   PREPAY   for the proven loyalist who already prepays — shown the NEXT
//            rung of the ladder only (3→6, 6→12). A member who has never
//            prepaid gets NO prepay nudge: the email's green 3-month button
//            and the quiet ladder line already tell that story.
//   silence  for everyone we don't yet know (first cycle), everyone whose
//            membership is struggling (missed pickups, barely-used, paused),
//            and anyone nudged recently. Silence, done well, is also service.
//
// Frequency governance (the anti-harassment constitution), enforced from the
// append-only ledger (UPSELL_SHOWN rows written by the sweep after a real
// send): at most one nudge line per email (by construction), at most one
// nudge of any kind per 30 days, at most one of the same kind per 60 days,
// and after the same kind has been shown twice without the member acting on
// it, we go quiet on that kind for a further 90 days.
// =============================================================================

export type NudgeKind = 'UPGRADE' | 'PREPAY'

export interface MembershipNudge {
  kind: NudgeKind
  /** PREPAY: the rung being shown (6 or 12 — never 3, the button covers it). */
  months?: number
  /** The complete, ready-to-render line (numbers baked in). */
  line: string
  /** Why this member, in one sentence — for the ledger row + the office. */
  reason: string
}

/** The caps, in days. Same constants the sweep enforces when it writes the
 *  UPSELL_SHOWN ledger rows. */
export const NUDGE_CAPS = { anyKindDays: 30, sameKindDays: 60, quietAfterShown: 2, quietDays: 90 } as const

function parseMeta(meta: string | null): Record<string, unknown> {
  try {
    return JSON.parse(meta ?? '{}')
  } catch {
    return {}
  }
}

/**
 * Pick the one nudge this member should see — or none. Pure: every input is
 * data the sweep already holds (the ledger + the health computation), so the
 * choice is testable and identical everywhere it runs.
 */
export function pickMembershipNudge(input: {
  sub: { unitsUsed: number; extraUnitsUsed: number }
  plan: { code: string; family: string; priceMonthly: number; includedUnits: number; unitName: string }
  health: { state: string; usageRatio: number | null }
  /** CYCLE_START rows this membership has produced (≥2 = a renewer). */
  renewalCount: number
  /** The deepest cover the member has EVER paid for (1 = monthly only). */
  maxPrepaidMonths: number
  /** This membership's ledger rows, for the frequency caps. */
  events: Array<{ kind: string; meta: string | null; createdAt: Date | string }>
  /** The next tier up in the same family, or null (top tier / SHOES). */
  higherPlan: {
    code: string
    name: string
    priceMonthly: number
    includedUnits: number
    unitName: string
    duvetsPerQuarter: number
  } | null
}): MembershipNudge | null {
  const { sub, plan, health, renewalCount, maxPrepaidMonths, events, higherPlan } = input

  // ----- Suppression: we do not upsell strangers or struggling members -----
  if (renewalCount < 2) return null // first cycle — we don't know them yet
  const struggling = ['MISSED_PICKUP', 'UNUSED_RISK', 'NO_USAGE_DATA', 'INACTIVE']
  if (struggling.includes(health.state)) return null
  if (health.usageRatio === null) return null

  // ----- Frequency caps from the ledger -----
  const shown = events
    .filter((e) => e.kind === 'UPSELL_SHOWN')
    .map((e) => {
      const meta = parseMeta(e.meta)
      return {
        kind: String(meta.kind ?? '') as NudgeKind,
        months: Number(meta.months ?? 0) || undefined,
        at: new Date(e.createdAt).getTime(),
      }
    })
    .sort((a, b) => b.at - a.at)
  const now = Date.now()
  const DAY = 24 * 60 * 60 * 1000
  if (shown.some((s) => now - s.at < NUDGE_CAPS.anyKindDays * DAY)) return null
  const countSameKind = (kind: NudgeKind) => shown.filter((s) => s.kind === kind).length

  // ----- The upgrade path: allowance exhausted + extras on top -----
  const extras = Math.max(0, sub.extraUnitsUsed)
  const powerUser =
    health.state === 'OVER_QUOTA' || (health.usageRatio >= 0.9 && extras >= 1)
  if (powerUser && higherPlan) {
    if (now - (shown.find((s) => s.kind === 'UPGRADE')?.at ?? 0) < NUDGE_CAPS.sameKindDays * DAY) return null
    if (countSameKind('UPGRADE') >= NUDGE_CAPS.quietAfterShown) return null
    const duvetLine = higherPlan.duvetsPerQuarter > 0 ? ` plus ${higherPlan.duvetsPerQuarter} duvets a quarter at no extra cost` : ''
    return {
      kind: 'UPGRADE',
      line: `When your weeks run this full, the next plan up tends to fit better: ${higherPlan.name} is ${formatNaira(higherPlan.priceMonthly)} a month for ${higherPlan.includedUnits} × ${higherPlan.unitName}${duvetLine}. Reply to this email or call the office and we'll move you up from your next cycle — whenever it suits you.`,
      reason: `Used ${sub.unitsUsed}/${plan.includedUnits} ${plan.unitName}s with ${extras} extra${extras === 1 ? '' : 's'} on top — allowance outgrown`,
    }
  }

  // ----- The prepay path: escalate ONLY members who already prepay -----
  if (maxPrepaidMonths >= 6) {
    if (countSameKind('PREPAY') >= NUDGE_CAPS.quietAfterShown) return null
    const yearPrice = renewalPriceFor(plan.priceMonthly, 12)
    const yearPerMonth = Math.round(yearPrice / 12)
    return {
      kind: 'PREPAY',
      months: 12,
      line: `A year with Kozy is one payment of ${formatNaira(yearPrice)} — ${formatNaira(yearPerMonth)} a month, our kindest rate, and nothing to think about for twelve cycles. Whenever it suits you, it's waiting in your portal.`,
      reason: 'Has covered 6 months at a time before — shown the year rung',
    }
  }
  if (maxPrepaidMonths >= 3) {
    if (countSameKind('PREPAY') >= NUDGE_CAPS.quietAfterShown) return null
    const sixPrice = renewalPriceFor(plan.priceMonthly, 6)
    const sixSaving = renewalSavingFor(plan.priceMonthly, 6)
    const sixPerMonth = Math.round(sixPrice / 6)
    return {
      kind: 'PREPAY',
      months: 6,
      line: `You've been covering 3 months at a time — thank you. If it ever suits you to think about laundry even less: 6 months is one payment of ${formatNaira(sixPrice)} (${formatNaira(sixPerMonth)} a month, ${formatNaira(sixSaving)} kinder than monthly). It's in your portal whenever you like.`,
      reason: 'Has covered 3 months at a time before — shown the 6-month rung',
    }
  }
  // Never prepaid → the email's own green button + the quiet ladder line
  // already carry the story. No behavioural line for them.
  return null
}

/**
 * Gather the ledger facts the nudge needs (renewal count, deepest cover,
 * upsell history) in ONE query — called by the sweep per candidate member.
 */
export async function nudgeFacts(subscriptionId: string): Promise<{
  renewalCount: number
  maxPrepaidMonths: number
  events: Array<{ kind: string; meta: string | null; createdAt: Date }>
}> {
  const rows = await db.subscriptionEvent.findMany({
    where: { subscriptionId, kind: { in: ['CYCLE_START', 'RENEWAL_INTENT', 'UPSELL_SHOWN'] } },
    select: { kind: true, meta: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  let renewalCount = 0
  let maxPrepaidMonths = 1
  for (const r of rows) {
    const meta = parseMeta(r.meta)
    if (r.kind === 'CYCLE_START') {
      renewalCount++
      const months = Math.round(Number(meta.cycles ?? meta.months ?? 1)) || 1
      if (months >= 1 && months <= 12) maxPrepaidMonths = Math.max(maxPrepaidMonths, months)
    } else if (r.kind === 'RENEWAL_INTENT') {
      const months = Math.round(Number(meta.months ?? 1)) || 1
      if (months >= 1 && months <= 12) maxPrepaidMonths = Math.max(maxPrepaidMonths, months)
    }
  }
  return { renewalCount, maxPrepaidMonths, events: rows }
}

/**
 * The next plan up in the same family (KIT only — the Shoe Club composes on
 * top of tiers and is never an "upgrade destination"). Null at the top.
 */
export async function higherPlanFor(plan: { code: string; family: string }): Promise<MembershipPlan | null> {
  if (plan.family !== 'KIT') return null
  const plans = await getPlans(false, 'KIT')
  const current = plans.find((p) => p.code === plan.code)
  if (!current) return null
  const higher = plans
    .filter((p) => p.priceMonthly > current.priceMonthly)
    .sort((a, b) => a.priceMonthly - b.priceMonthly)[0]
  return higher ?? null
}
