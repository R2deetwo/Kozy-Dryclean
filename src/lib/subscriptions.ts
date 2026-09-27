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
  concierge: boolean
  memberDiscountPct: number
  prioritySlots: boolean
}

export const DEFAULT_PLANS: PlanSeed[] = [
  {
    code: 'ESSENTIALS',
    name: 'The Essentials',
    tagline: 'One person’s clothes, every week. Bag goes out, clean clothes come back.',
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
    concierge: false,
    memberDiscountPct: 5,
    prioritySlots: false,
  },
  {
    code: 'HOUSEHOLD',
    name: 'The Household',
    tagline: 'The whole family’s weekly load in one big box — plus the beds.',
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
    concierge: false,
    memberDiscountPct: 10,
    prioritySlots: false,
  },
  {
    code: 'WHOLEHOME',
    name: 'The Whole Home',
    tagline: 'Everything in the house — the box, the duvets, the curtains, and one deep clean a year.',
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
    concierge: false,
    memberDiscountPct: 15,
    prioritySlots: true,
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
    concierge: row.concierge,
    memberDiscountPct: row.memberDiscountPct,
    prioritySlots: row.prioritySlots,
    paystackPlanCode: row.paystackPlanCode ?? null,
    createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt),
    updatedAt: row.updatedAt?.toISOString?.() ?? String(row.updatedAt),
  }
}

/**
 * All plans, ordered for display. Seeds the DEFAULT_PLANS on an empty table
 * (idempotent create per code — concurrent first requests race harmlessly
 * thanks to the unique constraint + the create-only-if-missing loop).
 */
export async function getPlans(includeInactive = true): Promise<MembershipPlan[]> {
  try {
    let rows = await db.subscriptionPlan.findMany({
      orderBy: [{ sortOrder: 'asc' }, { priceMonthly: 'asc' }],
    })
    if (rows.length === 0) {
      for (const seed of DEFAULT_PLANS) {
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
    const mapped = rows.map(rowToPlan)
    return includeInactive ? mapped : mapped.filter((p) => p.isActive)
  } catch {
    // DB unavailable (build-time prerender etc.) — serve code defaults so
    // every surface still renders sensible numbers.
    return DEFAULT_PLANS.map((seed, i) => ({
      ...seed,
      id: `default-${seed.code.toLowerCase()}`,
      isActive: true,
      paystackPlanCode: null,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      sortOrder: seed.sortOrder || i + 1,
    }))
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
            ...(DEFAULT_PLANS.find((p) => p.code === code) ?? DEFAULT_PLANS[0]),
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
    duvetsUsed: number
    curtainsUsed: number
    springCleanUsed: number
    usageQuarterKey?: string | null
    usageYearKey?: string | null
  },
  plan: { includedUnits: number; maxExtraUnits: number; duvetsPerQuarter: number; curtainsPerQuarter: number; springCleanPerYear: number }
) {
  const quarterRolled = (sub.usageQuarterKey ?? '') !== quarterKey()
  const yearRolled = (sub.usageYearKey ?? '') !== yearKey()
  const unitsUsed = sub.unitsUsed
  const duvetsUsed = quarterRolled ? 0 : sub.duvetsUsed
  const curtainsUsed = quarterRolled ? 0 : sub.curtainsUsed
  const springCleanUsed = yearRolled ? 0 : sub.springCleanUsed
  return {
    unitsUsed,
    unitsRemaining: Math.max(0, plan.includedUnits - unitsUsed),
    extraUnitsUsed: sub.extraUnitsUsed,
    extraRemaining: Math.max(0, plan.maxExtraUnits - sub.extraUnitsUsed),
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
