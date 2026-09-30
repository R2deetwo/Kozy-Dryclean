// =============================================================================
// Member email sweep (phase 76 → 77) — the automated member relationship
// =============================================================================
// ONE daily pass, called by /api/cron/member-emails (vercel.json cron) and
// reusable from the admin drill-down preview and the test harness:
//
//   Job 1 — MONTHLY SUMMARY: a member whose period ends in 2–4 days gets
//   the month in review + the prepopulated renewal buttons (next month vs
//   the discounted 3-month prepay + the tier's extra bag/box upsell).
//   Card members with auto-renew get the informational version.
//   Sent once per cycle.
//
//   Job 2 — PAUSED: a member whose period ended within the last ~36 hours
//   (PAST_DUE day 1) without a renewal gets the one-tap reactivation email.
//   Sent once per lapse.
//
// ALWAYS ON FOR MEMBERS (phase 77, the owner's directive): there is no
//   admin toggle — real members receive their emails as a matter of course.
//   The only guard is for OUR OWN testing: when MEMBER_EMAIL_TEST_MODE is
//   set in the environment (local batteries, dry-run harnesses — never in
//   production), recipients outside the test allowlist (the woosh test
//   accounts + practiceprosystems@gmail.com) are suppressed and logged so
//   a test can never reach a real member. EMAIL_OVERRIDE_TO stays the
//   master valve it has always been.
// =============================================================================

import { db } from '@/lib/db'
import { getAppSettings } from '@/lib/app-settings'
import {
  effectiveStatus,
  effectiveUsage,
  cycleHealth,
  pickMembershipNudge,
  nudgeFacts,
  higherPlanFor,
  recordSubscriptionEvent,
} from '@/lib/subscriptions'
import {
  notifyMembershipMonthlySummary,
  notifyMembershipPaused,
} from '@/lib/notifications'
import { getStoreProducts } from '@/lib/kozy-store'

function baseUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://kozycare.ng'
  )
}

/** The D-3 window: the summary lands when 2–4 days remain (the daily cron
 *  catches the anniversary of a 30-day cycle exactly once). */
const SUMMARY_WINDOW_DAYS = { min: 2, max: 4 }

/** The paused email targets period ends within the last 36 hours — the
 *  daily cron catches day 1 even if it fires up to 12h off-schedule. */
const PAUSED_WINDOW_MS = 36 * 60 * 60 * 1000

/** The test allowlist (phase 77): the woosh test world + the owner. Entries
 *  are comma-separated; "@domain" matches any address there, a plain entry
 *  must match the full address. Overridable via MEMBER_EMAIL_TEST_ALLOWLIST
 *  — never via the admin UI (there is no toggle, per the owner's directive). */
export const DEFAULT_MEMBER_EMAIL_TEST_ALLOWLIST =
  '@woosh.dpdns.org,practiceprosystems@gmail.com'

export function memberEmailTestAllowlist(): string {
  return (
    process.env.MEMBER_EMAIL_TEST_ALLOWLIST?.trim() ||
    DEFAULT_MEMBER_EMAIL_TEST_ALLOWLIST
  )
}

/** True when this process is explicitly running TESTS (local batteries,
 *  harnesses). Never true in production — the env var simply is not set. */
export function memberEmailTestMode(): boolean {
  const v = process.env.MEMBER_EMAIL_TEST_MODE
  return v === '1' || v === 'true' || v === 'yes'
}

export type SweepOutcome = 'SENT' | 'SUPPRESSED' | 'SKIPPED_SENT_ALREADY' | 'DRY_RUN'

export interface SweepDetail {
  job: 'summary' | 'paused'
  member: { name: string; email: string }
  planName: string
  outcome: SweepOutcome
  reason: string
  subjectHint?: string
}

export interface SweepResult {
  ranAt: string
  dryRun: boolean
  testMode: boolean
  allowlist: string
  summaryCandidates: number
  pausedCandidates: number
  sent: number
  suppressed: number
  skipped: number
  details: SweepDetail[]
}

/** Does this address pass the test allowlist? Entries are comma-separated;
 *  an entry starting with "@" matches any address at that domain, a plain
 *  entry must match the full address (case-insensitive). */
export function isTestSafeRecipient(email: string, allowlist: string): boolean {
  const target = email.trim().toLowerCase()
  if (!target.includes('@')) return false
  const entries = allowlist
    .split(/[,;\n]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return entries.some((entry) =>
    entry.startsWith('@')
      ? target.endsWith(entry)
      : target === entry
  )
}

/** The prepopulated renewal link — the portal membership tab with the
 *  renewal panel open and the month count preselected. */
export function memberRenewUrl(subId: string, months?: number): string {
  const base = `${baseUrl()}/portal?renew=1`
  return months && months !== 1 ? `${base}&months=${months}` : base
}

export interface SubWithPlan {
  id: string
  userId: string
  status: string
  periodStart: Date | null
  periodEnd: Date | null
  cancelAtPeriodEnd: boolean
  paymentMethod: string | null
  unitsUsed: number
  extraUnitsUsed: number
  shoesUsed: number
  duvetsUsed: number
  curtainsUsed: number
  springCleanUsed: number
  usageQuarterKey: string | null
  usageYearKey: string | null
  plan: {
    id: string
    name: string
    code: string
    priceMonthly: number
    unitName: string
    includedUnits: number
    maxExtraUnits: number
    shoesPerMonth: number
    duvetsPerQuarter: number
    curtainsPerQuarter: number
    springCleanPerYear: number
  } | null
  user: { id: string; name: string; email: string } | null
}

/** Has this cycle already produced this kind of email? Dedupe key: the
 *  periodEnd the email was about — renewal resets periodEnd, so the next
 *  cycle naturally sends again. */
async function alreadyHandled(
  subscriptionId: string,
  kind: 'SUMMARY_SENT' | 'PAUSED_SENT',
  periodEnd: Date
): Promise<boolean> {
  const events = await db.subscriptionEvent.findMany({
    where: { subscriptionId, kind },
    select: { meta: true },
  })
  const needle = periodEnd.toISOString()
  return events.some((e) => {
    try {
      const meta = JSON.parse(e.meta ?? '{}')
      return meta.periodEnd === needle
    } catch {
      return false
    }
  })
}

/** Record the dedupe row AFTER a real send (never on suppression — a
 *  suppressed member must still receive once the office arms the gate). */
async function markHandled(
  subscriptionId: string,
  kind: 'SUMMARY_SENT' | 'PAUSED_SENT',
  periodEnd: Date
): Promise<void> {
  try {
    await db.subscriptionEvent.create({
      data: {
        subscriptionId,
        kind,
        delta: 0,
        count: 0,
        meta: JSON.stringify({
          periodEnd: periodEnd.toISOString(),
          automation: true,
        }),
        note:
          kind === 'SUMMARY_SENT'
            ? 'Monthly usage summary emailed'
            : 'Membership paused — reactivation email sent',
      },
    })
  } catch (e) {
    console.error('[member-emails] dedupe write failed:', e)
  }
}

/** Compute + send the monthly summary for one subscription. Returns the
 *  outcome. Shared by the sweep, the admin preview button, and the test
 *  harness so every surface renders the SAME email. `overrideTo` delivers
 *  the identical render to a different inbox (the admin preview) without
 *  touching the member — and without writing the UPSELL_SHOWN ledger row
 *  (only the sweep's real sends count against the frequency caps; a preview
 *  must never spend a member's nudge budget). The strategic Kozy Store line
 *  rides along only when the office has switched the store on (phase 77),
 *  and the ONE behaviour-targeted nudge line rides along only when the
 *  member's own behaviour picked one (phase 78). */
export async function sendMonthlySummaryFor(
  sub: SubWithPlan,
  opts: { dry?: boolean; overrideTo?: string } = {}
): Promise<{
  outcome: SweepOutcome
  subjectHint: string
  nudge?: { kind: 'UPGRADE' | 'PREPAY'; months?: number; reason: string }
}> {
  const settings = await getAppSettings()
  const since = sub.periodStart ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const orders = await db.order.findMany({
    where: { subscriptionId: sub.id, createdAt: { gte: since } },
    select: {
      status: true,
      pickupDate: true,
      pickedUpAt: true,
      deliveredAt: true,
      createdAt: true,
    },
  })
  const health = cycleHealth(sub, sub.plan, orders as any, new Date())
  const usage = effectiveUsage(sub, sub.plan!)
  const periodEnd = sub.periodEnd as Date
  const days = Math.max(
    1,
    Math.ceil((periodEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  )
  const live = orders.filter((o) => o.status !== 'CANCELLED')
  const delivered = live.filter((o) => Boolean(o.deliveredAt)).length
  const cardAutomatic =
    sub.paymentMethod === 'PAYSTACK' && !sub.cancelAtPeriodEnd
  const monthLabel = (sub.periodStart ?? new Date()).toLocaleDateString('en-NG', {
    month: 'long',
  })
  const subjectHint = cardAutomatic
    ? `Your ${monthLabel} with Kozy — ${usage.unitsUsed} of ${sub.plan!.includedUnits} washes, card renews in ${days} days`
    : `Your ${monthLabel} with Kozy — ${usage.unitsUsed} of ${sub.plan!.includedUnits} washes, ${days} days to renew`

  // ----- Phase 78: the one behaviour-targeted nudge line -----
  // Computed BEFORE the dry-run return so a dry run REPORTS the line it
  // would carry (the office can see the targeting without sending).
  const facts = await nudgeFacts(sub.id)
  const higher = await higherPlanFor({ code: sub.plan!.code, family: 'KIT' })
  let picked = pickMembershipNudge({
    sub: { unitsUsed: usage.unitsUsed, extraUnitsUsed: usage.extraUnitsUsed },
    plan: {
      code: sub.plan!.code,
      family: 'KIT',
      priceMonthly: sub.plan!.priceMonthly,
      includedUnits: sub.plan!.includedUnits,
      unitName: sub.plan!.unitName,
    },
    health: { state: health.state, usageRatio: health.usageRatio },
    renewalCount: facts.renewalCount,
    maxPrepaidMonths: facts.maxPrepaidMonths,
    events: facts.events,
    higherPlan: higher
      ? {
          code: higher.code,
          name: higher.name,
          priceMonthly: higher.priceMonthly,
          includedUnits: higher.includedUnits,
          unitName: higher.unitName,
          duvetsPerQuarter: higher.duvetsPerQuarter,
        }
      : null,
  })
  // Card members: the informational block + the ladder line already cover
  // prepay; their behavioural targeting is upgrades only (usage-driven).
  if (cardAutomatic && picked?.kind === 'PREPAY') picked = null

  if (opts.dry) {
    return {
      outcome: 'DRY_RUN',
      subjectHint,
      ...(picked ? { nudge: { kind: picked.kind, months: picked.months, reason: picked.reason } } : {}),
    }
  }

  // The strategic store line — active products only, never more than two,
  // only when the office has switched the store on.
  const storeProducts = settings.storeEnabled
    ? (await getStoreProducts({ activeOnly: true })).slice(0, 2).map((p) => ({
        name: p.name,
        tagline: p.tagline,
        price: p.price,
      }))
    : []

  await notifyMembershipMonthlySummary({
    user: { name: sub.user!.name, email: opts.overrideTo ?? sub.user!.email },
    planName: sub.plan!.name,
    unitName: sub.plan!.unitName,
    includedUnits: sub.plan!.includedUnits,
    usedUnits: usage.unitsUsed,
    extraUnits: usage.extraUnitsUsed,
    missedPickups: health.missedPickups,
    deliveredCount: delivered,
    periodStart: sub.periodStart ?? since,
    periodEnd,
    priceMonthly: sub.plan!.priceMonthly,
    renewalMode: cardAutomatic ? 'CARD_AUTOMATIC' : 'NEEDS_PAYMENT',
    renewUrl: memberRenewUrl(sub.id),
    contactPhone: settings.contactPhone,
    storeProducts,
    ...(picked ? { nudge: { kind: picked.kind, line: picked.line } } : {}),
  })
  return {
    outcome: 'SENT',
    subjectHint,
    ...(picked ? { nudge: { kind: picked.kind, months: picked.months, reason: picked.reason } } : {}),
  }
}

/** Compute + send the paused/reactivation email for one subscription. */
export async function sendPausedFor(
  sub: SubWithPlan,
  opts: { dry?: boolean } = {}
): Promise<{ outcome: SweepOutcome; subjectHint: string }> {
  const settings = await getAppSettings()
  const periodEnd = sub.periodEnd as Date
  if (opts.dry) {
    return { outcome: 'DRY_RUN', subjectHint: `Your ${sub.plan!.name} has paused — one tap brings it back` }
  }
  await notifyMembershipPaused({
    user: { name: sub.user!.name, email: sub.user!.email },
    planName: sub.plan!.name,
    unitName: sub.plan!.unitName,
    includedUnits: sub.plan!.includedUnits,
    periodEnd,
    priceMonthly: sub.plan!.priceMonthly,
    renewUrl: memberRenewUrl(sub.id),
    contactPhone: settings.contactPhone,
  })
  return {
    outcome: 'SENT',
    subjectHint: `Your ${sub.plan!.name} has paused — one tap brings it back`,
  }
}

/** The daily pass. Safe to run any time: idempotent per cycle via the
 *  ledger. Member emails are ALWAYS ON (phase 77) — the only suppression
 *  is our own test mode, which never exists in production. */
export async function runMemberEmailSweep(opts: { dry?: boolean } = {}): Promise<SweepResult> {
  const testMode = memberEmailTestMode()
  const allowlist = memberEmailTestAllowlist()

  const result: SweepResult = {
    ranAt: new Date().toISOString(),
    dryRun: Boolean(opts.dry),
    testMode,
    allowlist,
    summaryCandidates: 0,
    pausedCandidates: 0,
    sent: 0,
    suppressed: 0,
    skipped: 0,
    details: [],
  }

  const now = Date.now()
  const subs = (await db.subscription.findMany({
    where: { status: { in: ['ACTIVE'] } },
    include: {
      plan: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { periodEnd: 'asc' },
  })) as unknown as SubWithPlan[]

  for (const sub of subs) {
    if (!sub.plan || !sub.user?.email || !sub.periodEnd) continue
    const periodEnd = new Date(sub.periodEnd)
    const eff = effectiveStatus(sub)
    const msToEnd = periodEnd.getTime() - now

    // ----- Job 1: the monthly summary (D-3 window) -----
    const daysToEnd = msToEnd / (24 * 60 * 60 * 1000)
    if (
      eff === 'ACTIVE' &&
      daysToEnd >= SUMMARY_WINDOW_DAYS.min &&
      daysToEnd <= SUMMARY_WINDOW_DAYS.max
    ) {
      result.summaryCandidates++
      if (await alreadyHandled(sub.id, 'SUMMARY_SENT', periodEnd)) {
        result.skipped++
        result.details.push({
          job: 'summary',
          member: { name: sub.user.name, email: sub.user.email },
          planName: sub.plan.name,
          outcome: 'SKIPPED_SENT_ALREADY',
          reason: 'Summary already sent for this cycle',
        })
        continue
      }
      const safe = !testMode || isTestSafeRecipient(sub.user.email, allowlist)
      if (!safe) {
        result.suppressed++
        result.details.push({
          job: 'summary',
          member: { name: sub.user.name, email: sub.user.email },
          planName: sub.plan.name,
          outcome: 'SUPPRESSED',
          reason:
            'Test mode is ON and this recipient is outside the test allowlist — logged only; production sends to every member',
        })
        continue
      }
      const { outcome, subjectHint, nudge } = await sendMonthlySummaryFor(sub, opts)
      if (outcome === 'SENT') {
        await markHandled(sub.id, 'SUMMARY_SENT', periodEnd)
        result.sent++
        // Phase 78: record the nudge the member actually received — the
        // append-only ledger IS the frequency governor (caps + dampening
        // read these rows back on every future pick).
        if (nudge) {
          await recordSubscriptionEvent({
            subscriptionId: sub.id,
            kind: 'UPSELL_SHOWN',
            delta: 0,
            count: 0,
            meta: {
              kind: nudge.kind,
              ...(nudge.months ? { months: nudge.months } : {}),
              reason: nudge.reason,
              periodEnd: periodEnd.toISOString(),
              automation: true,
            },
            note:
              nudge.kind === 'UPGRADE'
                ? 'Smart nudge emailed: the next tier up'
                : `Smart nudge emailed: ${nudge.months ?? 3}-month cover`,
          })
        }
      }
      result.details.push({
        job: 'summary',
        member: { name: sub.user.name, email: sub.user.email },
        planName: sub.plan.name,
        outcome,
        reason: opts.dry ? 'Dry run — planned only' : 'Summary emailed',
        subjectHint,
        // Phase 78: which nudge line this email carries (absent = the quiet
        // standing ladder line renders instead).
        ...(nudge ? { nudge: `${nudge.kind}${nudge.months ? `-${nudge.months}` : ''}` } : {}),
      })
      continue
    }

    // ----- Job 2: the paused / reactivation email (day 1 past end) -----
    const lateMs = now - periodEnd.getTime()
    if (eff === 'PAST_DUE' && lateMs <= PAUSED_WINDOW_MS) {
      result.pausedCandidates++
      if (await alreadyHandled(sub.id, 'PAUSED_SENT', periodEnd)) {
        result.skipped++
        result.details.push({
          job: 'paused',
          member: { name: sub.user.name, email: sub.user.email },
          planName: sub.plan.name,
          outcome: 'SKIPPED_SENT_ALREADY',
          reason: 'Paused email already sent for this lapse',
        })
        continue
      }
      const safe = !testMode || isTestSafeRecipient(sub.user.email, allowlist)
      if (!safe) {
        result.suppressed++
        result.details.push({
          job: 'paused',
          member: { name: sub.user.name, email: sub.user.email },
          planName: sub.plan.name,
          outcome: 'SUPPRESSED',
          reason:
            'Test mode is ON and this recipient is outside the test allowlist — logged only; production sends to every member',
        })
        continue
      }
      const { outcome, subjectHint } = await sendPausedFor(sub, opts)
      if (outcome === 'SENT') {
        await markHandled(sub.id, 'PAUSED_SENT', periodEnd)
        result.sent++
      }
      result.details.push({
        job: 'paused',
        member: { name: sub.user.name, email: sub.user.email },
        planName: sub.plan.name,
        outcome,
        reason: opts.dry ? 'Dry run — planned only' : 'Reactivation email sent',
        subjectHint,
      })
    }
  }

  return result
}
