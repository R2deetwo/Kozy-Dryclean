// =============================================================================
// Partner ledger (phase 72) — a network partner's money, the honest way
// =============================================================================
// Server-only. Mirrors rider-ledger.ts on purpose: one mental model for both
// kinds of "how do they get paid". A partner earns their share
// (revenueSharePartnerPct) of every DELIVERED order routed to them; a
// settlement row is what the office actually paid. Pending = share earned
// minus settled. The admin Partners desk and the partner's own Earnings tab
// read the same functions, so the two can never drift.
// =============================================================================

import { db } from '@/lib/db'

export interface ShareLedger {
  ordersLifetime: number
  ordersThisMonth: number
  revenueLifetime: number
  revenueThisMonth: number
  sharePct: number
  shareEarned: number
  kozyShareThisMonth: number
}

/** Month boundary in West Africa Time (Lagos, UTC+1) — the settlement month
 *  the desks and the portal agree on, regardless of server timezone. */
export function monthStartWAT(now = new Date()): Date {
  const WAT_OFFSET = 60 // minutes
  const wat = new Date(now.getTime() + WAT_OFFSET * 60_000)
  const monthStartWat = Date.UTC(wat.getUTCFullYear(), wat.getUTCMonth(), 1)
  return new Date(monthStartWat - WAT_OFFSET * 60_000)
}

/** The derived revenue-share ledger for ONE partner: delivered orders routed
 *  to them, this month (WAT) + lifetime, at their current share %. */
export async function getPartnerShareLedger(partner: {
  id: string
  revenueSharePartnerPct: number
}): Promise<ShareLedger> {
  const orders = await db.order.findMany({
    where: { fulfilledByPartnerId: partner.id, status: 'DELIVERED' },
    select: { totalPrice: true, deliveredAt: true },
  })
  const monthStart = monthStartWAT()
  let revenueLifetime = 0
  let revenueThisMonth = 0
  let ordersThisMonth = 0
  for (const o of orders) {
    const value = o.totalPrice ?? 0
    revenueLifetime += value
    if (o.deliveredAt && new Date(o.deliveredAt).getTime() >= monthStart.getTime()) {
      revenueThisMonth += value
      ordersThisMonth++
    }
  }
  const pct = partner.revenueSharePartnerPct
  return {
    ordersLifetime: orders.length,
    ordersThisMonth,
    revenueLifetime: Math.round(revenueLifetime),
    revenueThisMonth: Math.round(revenueThisMonth),
    sharePct: pct,
    shareEarned: Math.round((pct / 100) * revenueLifetime),
    kozyShareThisMonth: Math.round(((100 - pct) / 100) * revenueThisMonth),
  }
}

export interface SettlementRow {
  id: string
  amount: number
  method: string
  reference: string | null
  note: string | null
  createdAt: string
}

/** The money side: settlements actually recorded for a partner + the pending
 *  balance (share earned minus settled). */
export async function getPartnerSettlementSummary(
  partner: { id: string; revenueSharePartnerPct: number },
  opts?: { limit?: number }
): Promise<{
  settledTotal: number
  pending: number
  lastSettlementAt: string | null
  settlements: SettlementRow[]
}> {
  const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 100)
  const ledger = await getPartnerShareLedger(partner)
  const [agg, rows] = await Promise.all([
    db.partnerSettlement.aggregate({
      where: { partnerId: partner.id },
      _sum: { amount: true },
      _max: { createdAt: true },
    }),
    db.partnerSettlement.findMany({
      where: { partnerId: partner.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, amount: true, method: true, reference: true, note: true, createdAt: true },
    }),
  ])
  const settledTotal = agg._sum.amount ?? 0
  return {
    settledTotal,
    pending: ledger.shareEarned - settledTotal,
    lastSettlementAt: agg._max.createdAt?.toISOString() ?? null,
    settlements: rows.map((r) => ({
      id: r.id,
      amount: r.amount,
      method: r.method,
      reference: r.reference,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
    })),
  }
}

/** Resolve the PARTNER-role session user to their network record, with the
 *  door rules: SUSPENDED partners keep their ledger (read) but cannot work
 *  orders; REJECTED/PENDING accounts should not exist (created only at
 *  approval) — refuse rather than guess. */
export async function resolvePartnerForUser(
  userId: string
): Promise<{ ok: true; partner: { id: string; businessName: string; contactName: string; email: string; phone: string; address: string; lga: string | null; servicesOffered: string | null; branchId: string | null; status: string; revenueSharePartnerPct: number } } | { ok: false; status: number; error: string; suspended: boolean }> {
  const partner = await db.partner.findUnique({ where: { userId } })
  if (!partner) {
    return { ok: false, status: 403, error: 'No partner record is linked to this account. Contact the Kozy Care office.', suspended: false }
  }
  if (partner.status === 'REJECTED') {
    return { ok: false, status: 403, error: 'This partner application was declined. Contact the Kozy Care office.', suspended: false }
  }
  return {
    ok: true,
    partner: {
      id: partner.id,
      businessName: partner.businessName,
      contactName: partner.contactName,
      email: partner.email,
      phone: partner.phone,
      address: partner.address,
      lga: partner.lga,
      servicesOffered: partner.servicesOffered,
      branchId: partner.branchId,
      status: partner.status,
      revenueSharePartnerPct: partner.revenueSharePartnerPct,
    },
  }
}

/** The statuses a partner can ACT on — the processing window between the
 *  rider's pickup swipe and Kozy's dispatch. Forward-only. */
export const PARTNER_PIPELINE = ['PICKED_UP', 'AT_STATION', 'PROCESSING', 'FINISHING'] as const

export const PARTNER_NEXT_STATUS: Record<string, string> = {
  PICKED_UP: 'AT_STATION', // "we received the batch at our facility"
  AT_STATION: 'PROCESSING', // "the wash is running"
  PROCESSING: 'FINISHING', // "pressing + quality check — ready for Kozy's rider"
}
