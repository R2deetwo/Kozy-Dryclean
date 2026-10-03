// =============================================================================
// CUSTOMER HEALTH (phase 60) — retention intelligence for the CRM
// =============================================================================
// The brief: a solid end-to-end business knows who is slipping BEFORE they
// are gone. The CRM already shows what a customer ordered and spent; this
// adds the one thing a spreadsheet can't compute quietly: THEIR OWN RHYTHM.
//
// Every regular has a personal cadence — the gap between their orders. A
// weekly office shirt customer and a once-a-month duvet customer are BOTH
// healthy at very different gaps, so "hasn't ordered in 30 days" is noise.
// The honest question is: "has this customer been quiet for longer than
// THEY usually are?" That is what churn risk measures here:
//
//   ratio = days since their last delivered order ÷ their own typical gap
//     ratio ≤ 1        → healthy  (loyal)
//     1 < ratio ≤ 1.5  → going quiet (cooling)      — nudge soon
//     1.5 < ratio ≤ 2.5 → slipping (at risk)        — reach out now
//     ratio > 2.5      → long gone (at risk, deep)  — win-back
//
// New customers (< 2 delivered orders) get no verdict — there is no rhythm
// to read yet. VIP is a COHORT call (top decile of lifetime value among
// customers with a delivered order), never a per-row guess, so it stays
// honest as the book grows.
//
// Pure and isomorphic: same inputs → same verdict, unit-testable, no DB.
// =============================================================================

export type CustomerHealthStatus = 'new' | 'loyal' | 'cooling' | 'atrisk'

export interface CustomerHealth {
  status: CustomerHealthStatus
  /** Days since the last DELIVERED order (null when none yet). */
  daysSinceLastOrder: number | null
  /** This customer's own typical gap between delivered orders (null < 3). */
  cadenceDays: number | null
  /** 0–100, higher = more likely gone (null for brand-new accounts). */
  churnRisk: number | null
  /** Lifetime value: delivered one-off orders + membership plan payments. */
  ltv: number
  /** Average order value (delivered orders with a price). */
  aov: number | null
  deliveredCount: number
  lastDeliveredAt: Date | null
  /** One calm sentence for the detail modal. */
  sentence: string
}

/** Assumed cadence (days) while a customer has < 3 delivered orders. */
const DEFAULT_CADENCE_DAYS = 21

const DAY_MS = 24 * 3600_000

function median(nums: number[]): number | null {
  if (nums.length === 0) return null
  const s = nums.slice().sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

/** Piecewise-linear churn risk from the quietness ratio. */
function riskFromRatio(ratio: number): number {
  if (ratio <= 0.75) return Math.round((ratio / 0.75) * 15)
  if (ratio <= 1.5) return Math.round(15 + ((ratio - 0.75) / 0.75) * 30)
  if (ratio <= 2.5) return Math.round(45 + ((ratio - 1.5) / 1) * 35)
  return Math.min(100, Math.round(80 + (ratio - 2.5) * 8))
}

/**
 * Compute one customer's health from their order history. `now` is injected
 * for testability. Orders need only the fields shown.
 *
 * Task 88: `membershipSpend` is everything the customer has paid for their
 * Kozy Circle plan(s) — a member's laundry orders are zero-naira BY DESIGN
 * (the plan covers them), so without this a loyal ₦50,000/month member
 * reads as "spent nothing". It joins ltv (and therefore VIP ranking) but
 * NOT aov — an average ORDER value must stay about orders.
 */
export function computeCustomerHealth(
  orders: Array<{
    status: string
    totalPrice?: number | null
    deliveredAt?: string | Date | null
    createdAt?: string | Date | null
  }>,
  now: Date = new Date(),
  membershipSpend = 0
): CustomerHealth {
  const delivered = orders
    .filter((o) => o.status === 'DELIVERED')
    .sort(
      (a, b) =>
        new Date(a.deliveredAt ?? a.createdAt ?? 0).getTime() -
        new Date(b.deliveredAt ?? b.createdAt ?? 0).getTime()
    )

  const priced = delivered.filter((o) => typeof o.totalPrice === 'number' && o.totalPrice > 0)
  const orderLtv = priced.reduce((s, o) => s + (o.totalPrice ?? 0), 0)
  const ltv = orderLtv + Math.max(0, Math.round(membershipSpend))
  const aov = priced.length > 0 ? Math.round(orderLtv / priced.length) : null

  const last = delivered.length > 0 ? new Date(delivered[delivered.length - 1].deliveredAt ?? delivered[delivered.length - 1].createdAt!) : null
  const daysSinceLastOrder = last ? Math.floor((now.getTime() - last.getTime()) / DAY_MS) : null

  // Their own rhythm: median gap between consecutive delivered orders.
  const gaps: number[] = []
  for (let i = 1; i < delivered.length; i++) {
    const prev = new Date(delivered[i - 1].deliveredAt ?? delivered[i - 1].createdAt ?? 0).getTime()
    const cur = new Date(delivered[i].deliveredAt ?? delivered[i].createdAt ?? 0).getTime()
    const gapDays = Math.round((cur - prev) / DAY_MS)
    if (gapDays > 0) gaps.push(gapDays)
  }
  const cadenceDays = delivered.length >= 3 ? median(gaps) ?? DEFAULT_CADENCE_DAYS : null
  const effectiveCadence = cadenceDays ?? DEFAULT_CADENCE_DAYS

  // ----- Verdict -----
  let status: CustomerHealthStatus
  let churnRisk: number | null
  let sentence: string

  if (delivered.length < 2) {
    status = 'new'
    churnRisk = null
    sentence =
      delivered.length === 0
        ? 'No completed orders yet — the relationship is just beginning.'
        : 'First order completed — their rhythm will show after the next one.'
  } else {
    const ratio = (daysSinceLastOrder ?? 0) / effectiveCadence
    churnRisk = riskFromRatio(ratio)
    if (ratio <= 1) {
      status = 'loyal'
      sentence = cadenceDays
        ? `On their rhythm — usually every ${cadenceDays} day${cadenceDays === 1 ? '' : 's'}, last served ${daysSinceLastOrder} day${daysSinceLastOrder === 1 ? '' : 's'} ago.`
        : `Active — last served ${daysSinceLastOrder} day${daysSinceLastOrder === 1 ? '' : 's'} ago.`
    } else if (ratio <= 1.5) {
      status = 'cooling'
      sentence = `Going quiet — ${daysSinceLastOrder} days since their last order${
        cadenceDays ? `, longer than their usual ${cadenceDays}-day rhythm` : ''
      }. A gentle nudge fits.`
    } else {
      status = 'atrisk'
      sentence = `Slipping — ${daysSinceLastOrder} days quiet${
        cadenceDays ? ` against a ${cadenceDays}-day rhythm` : ''
      }. Worth a personal reach-out.`
    }
  }

  return {
    status,
    daysSinceLastOrder,
    cadenceDays,
    churnRisk,
    ltv,
    aov,
    deliveredCount: delivered.length,
    lastDeliveredAt: last,
    sentence,
  }
}

// ---------------------------------------------------------------
// VIP — a cohort decision, not a per-row one
// ---------------------------------------------------------------

/**
 * Mark VIP customers: the top decile of lifetime value among customers with
 * at least MIN_DELIVERED_FOR_VIP delivered orders. Returns the VIP id set.
 * (Call once per view over the whole customer list — never per row.)
 */
export const MIN_DELIVERED_FOR_VIP = 3

export function vipCustomerIds(
  customersWithHealth: Array<{ id: string; health: CustomerHealth }>
): Set<string> {
  const eligible = customersWithHealth.filter(
    (c) => c.health.deliveredCount >= MIN_DELIVERED_FOR_VIP && c.health.ltv > 0
  )
  if (eligible.length === 0) return new Set()
  const ranked = eligible.slice().sort((a, b) => b.health.ltv - a.health.ltv)
  const count = Math.max(1, Math.floor(ranked.length / 10))
  return new Set(ranked.slice(0, count).map((c) => c.id))
}

/** Short label + tone for chips (shared by the table and the modal). */
export function healthLabel(status: CustomerHealthStatus): { label: string; tone: 'good' | 'warn' | 'risk' | 'neutral' } {
  switch (status) {
    case 'loyal':
      return { label: 'On rhythm', tone: 'good' }
    case 'cooling':
      return { label: 'Going quiet', tone: 'warn' }
    case 'atrisk':
      return { label: 'At risk', tone: 'risk' }
    default:
      return { label: 'New', tone: 'neutral' }
  }
}
