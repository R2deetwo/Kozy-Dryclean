// =============================================================================
// Order anomalies (phase 32) — "odd movements" on the kanban, admin eyes only
// =============================================================================
// Client directive: "it would be nice to see a flag at the super admin side
// when there are odd movement of things on the kanban view. The staff should
// not see these flags." Plus: staff must not be able to do destructive things
// or hide that money has come in "without approval".
//
// This module centralises:
//   - detectAnomalies(): given an order + from/to status, return the kinds
//     of oddness the move represents (may be several, may be none).
//   - logAnomaly(): persist one OrderAnomaly row (never throws — a logging
//     failure must never break the business action it describes).
//
// Only STAFF moves are flagged — an owner moving their own board around is
// not a signal. Staff ATTEMPTING a blocked action (price override, order
// cancel, editing/deleting verified money) is logged as BLOCKED_ACTION even
// though the API rejects it with a 403: the attempt itself is the signal.
//
// No API ever exposes this table to STAFF; orders include `anomalies` only
// when the requesting session is ADMIN.

import { db } from '@/lib/db'
import { STAGE_RANK } from '@/lib/types'

/** The oddness rules for a status transition performed by a staff member. */
export function detectAnomalies(opts: {
  orderNumber: string
  from: string
  to: string
  hasVerifiedPayment: boolean
  amountDue: number | null | undefined
}): string[] {
  const { from, to, hasVerifiedPayment, amountDue } = opts
  const kinds: string[] = []

  // A no-op move (same status) is never odd.
  if (from === to) return kinds

  const fromRank = STAGE_RANK[from] ?? -1
  const toRank = STAGE_RANK[to] ?? -1

  // PAYMENT_PENDING_VERIFICATION (-1) is a sideways state, not a stage —
  // moves into/out of it are compared against the last real stage.
  if (to === 'PAYMENT_PENDING_VERIFICATION') return kinds

  // ---- BACKWARD_MOVE: pipeline regression ----
  // e.g. Processing → Requested. Legit corrections happen, but the owner
  // wants to see who rewound what (a rewind is also the first step of
  // "hide that this order ever happened").
  if (fromRank >= 0 && toRank < fromRank) {
    kinds.push('BACKWARD_MOVE')
  }

  // ---- STAGE_SKIP: jumped forward past an intermediate stage ----
  // e.g. Requested → At Station, skipping payment verification and pickup.
  // The staff member MAY have a good reason, but a pattern of skips is how
  // orders walk out the door with stages nobody performed.
  if (fromRank >= 0 && toRank > fromRank + 1) {
    kinds.push('STAGE_SKIP')
  }

  // ---- UNPAID_DELIVERY: completed with no verified money ----
  // The single most expensive odd move: an order that reaches Delivered
  // while no payment on it was ever VERIFIED (bank transfer still pending /
  // rejected, or the order simply was never paid). If it was genuinely a
  // free/zero-value order (₦0) it is not money walking out.
  if (to === 'DELIVERED' && !hasVerifiedPayment && (amountDue ?? 0) > 0) {
    kinds.push('UNPAID_DELIVERY')
  }

  return kinds
}

/** Human sentence for an anomaly kind. */
export function anomalyLabel(kind: string, from?: string | null, to?: string | null): string {
  const pretty = (s?: string | null) => (s ? s.replace(/_/g, ' ').toLowerCase() : '?')
  switch (kind) {
    case 'BACKWARD_MOVE':
      return `Moved backwards (${pretty(from)} → ${pretty(to)})`
    case 'STAGE_SKIP':
      return `Skipped stages (${pretty(from)} → ${pretty(to)})`
    case 'UNPAID_DELIVERY':
      return 'Delivered with no verified payment'
    case 'BLOCKED_ACTION':
      return 'Attempted a manager-only action'
    default:
      return kind
  }
}

/** Persist one anomaly row. NEVER throws — logging must not break the
 *  operation being logged. `detail` should be a human sentence. */
export async function logAnomaly(opts: {
  orderId: string
  kind: string
  actorId?: string | null
  fromStatus?: string | null
  toStatus?: string | null
  detail?: string
}): Promise<void> {
  try {
    await db.orderAnomaly.create({
      data: {
        orderId: opts.orderId,
        kind: opts.kind,
        actorId: opts.actorId ?? null,
        fromStatus: opts.fromStatus ?? null,
        toStatus: opts.toStatus ?? null,
        detail: opts.detail ?? null,
      },
    })
  } catch (e) {
    console.error('Failed to log order anomaly:', e)
  }
}

/** The include shape for admin reads (orders list + detail + kanban). */
export const ANOMALY_INCLUDE = {
  anomalies: {
    orderBy: { createdAt: 'desc' } as const,
    include: { actor: { select: { id: true, name: true, email: true } } },
  },
}
