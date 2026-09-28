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
import type { MembershipPlan, Membership } from '@/lib/types'

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
  concierge: boolean
  memberDiscountPct: number
  prioritySlots: boolean
}

export const DEFAULT_PLANS: PlanSeed[] = [
  {
    code: 'ESSENTIALS',
    name: 'The Essentials',
    tagline: 'One person’s clothes, every week. Bag goes out, clean clothes come back.',
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
    concierge: false,
    memberDiscountPct: 5,
    prioritySlots: false,
  },
  {
    code: 'HOUSEHOLD',
    name: 'The Household',
    tagline: 'The whole family’s weekly load in one big box — plus the beds.',
    family: 'KIT',
    priceMonthly: 50000,
    sortOrder: 2,
    includedUnits: 4,
    unitKind: 'box',
    unitName: 'Kozy Box',
    extraUnitPrice: 7500,
    maxExtraUnits: 2,
    replacementFee: 12000,
    duvetsPerQuarter: 3,
    curtainsPerQuarter: 0,
    springCleanPerYear: 0,
    shoesPerMonth: 3,
    concierge: false,
    memberDiscountPct: 10,
    prioritySlots: false,
  },
  {
    code: 'WHOLEHOME',
    name: 'The Whole Home',
    tagline: 'Everything in the house — the box, the duvets, the curtains, and one deep clean a year.',
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
    usageQuarterKey?: string | null
    usageYearKey?: string | null
  },
  plan: { includedUnits: number; maxExtraUnits: number; shoesPerMonth: number; duvetsPerQuarter: number; curtainsPerQuarter: number; springCleanPerYear: number }
) {
  const quarterRolled = (sub.usageQuarterKey ?? '') !== quarterKey()
  const yearRolled = (sub.usageYearKey ?? '') !== yearKey()
  const unitsUsed = sub.unitsUsed
  const shoesUsed = sub.shoesUsed ?? 0
  const duvetsUsed = quarterRolled ? 0 : sub.duvetsUsed
  const curtainsUsed = quarterRolled ? 0 : sub.curtainsUsed
  const springCleanUsed = yearRolled ? 0 : sub.springCleanUsed
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
  }
}

/** Map a Prisma subscription row (with plan included) onto the client shape. */
export function rowToMembership(row: any): Membership {
  const plan = row.plan ? rowToPlan(row.plan) : undefined
  return {
    id: row.id,
    userId: row.userId,
    status: row.status as Membership['status'],
    pricePaid: row.pricePaid,
    paymentMethod: row.paymentMethod,
    periodStart: row.periodStart?.toISOString?.() ?? null,
    periodEnd: row.periodEnd?.toISOString?.() ?? null,
    cancelAtPeriodEnd: Boolean(row.cancelAtPeriodEnd),
    unitsUsed: row.unitsUsed,
    extraUnitsUsed: row.extraUnitsUsed,
    shoesUsed: row.shoesUsed ?? 0,
    duvetsUsed: row.duvetsUsed,
    curtainsUsed: row.curtainsUsed,
    springCleanUsed: row.springCleanUsed,
    kitState: row.kitState,
    kitDeliveredAt: row.kitDeliveredAt?.toISOString?.() ?? null,
    plan,
    createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt),
    updatedAt: row.updatedAt?.toISOString?.() ?? String(row.updatedAt),
  }
}

// ----- Activation / renewal (shared by admin verify + Paystack webhook) -----

/**
 * Activate a fresh subscription or renew an existing cycle. Resets the unit
 * counters belonging to the new cycle and lazily rolls the quarter/year
 * bookmarks. Idempotent-ish: called only after money is confirmed.
 */
export async function activateOrRenewSubscription(
  subscriptionId: string,
  opts: { pricePaid: number; method: string }
): Promise<any> {
  const sub = await db.subscription.findUnique({ where: { id: subscriptionId } })
  if (!sub) throw new Error('Subscription not found')

  const now = new Date()
  const periodStart = now
  const periodEnd = new Date(now.getTime() + CYCLE_DAYS * 24 * 60 * 60 * 1000)

  // A renewal while still active extends from the CURRENT period end, so a
  // member who pays early never loses days.
  const base =
    sub.periodEnd && sub.periodEnd.getTime() > now.getTime() ? sub.periodEnd : now
  const end =
    sub.status === 'ACTIVE' && sub.periodEnd
      ? new Date(base.getTime() + CYCLE_DAYS * 24 * 60 * 60 * 1000)
      : periodEnd

  return db.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'ACTIVE',
      periodStart,
      periodEnd: end,
      pricePaid: Math.round(opts.pricePaid),
      paymentMethod: opts.method,
      transferReceipt: null,
      // Unit counters reset for the new cycle; perk counters roll lazily
      // (their bookmarks are stamped so effectiveUsage can compute).
      unitsUsed: 0,
      extraUnitsUsed: 0,
      shoesUsed: 0,
      usageCycleKey: cycleKey(periodStart),
      usageQuarterKey: quarterKey(),
      usageYearKey: yearKey(),
      cancelAtPeriodEnd: false,
      cancelledAt: null,
      cancelledReason: null,
    },
    include: { plan: true },
  })
}
