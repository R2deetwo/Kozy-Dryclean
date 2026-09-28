// =============================================================================
// GET /api/partner/earnings — the partner's share ledger + settlements
// =============================================================================
// The money side of the partnership, in the same shape the rider's Earnings
// tab uses: what they've EARNED (their % of delivered order value — this
// month + lifetime), what has been SETTLED (rows the office recorded), and
// what's PENDING (earned minus settled). The partner and the office read
// the same functions, so the numbers cannot disagree.
//
// RBAC: PARTNER only.
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { resolvePartnerForUser, getPartnerShareLedger, getPartnerSettlementSummary } from '@/lib/partner-ledger'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'PARTNER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const resolved = await resolvePartnerForUser(session.user.id)
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error, suspended: resolved.suspended },
      { status: resolved.status }
    )
  }
  const partner = resolved.partner

  try {
    const [ledger, money, recentDelivered] = await Promise.all([
      getPartnerShareLedger(partner),
      getPartnerSettlementSummary(partner, { limit: 20 }),
      db.order.findMany({
        where: { fulfilledByPartnerId: partner.id, status: 'DELIVERED' },
        orderBy: { deliveredAt: 'desc' },
        take: 25,
        select: {
          orderNumber: true,
          totalPrice: true,
          deliveredAt: true,
          serviceSpeed: true,
          user: { select: { name: true } },
        },
      }),
    ])

    const pct = partner.revenueSharePartnerPct
    return NextResponse.json({
      sharePct: pct,
      ledger: {
        ordersThisMonth: ledger.ordersThisMonth,
        ordersLifetime: ledger.ordersLifetime,
        revenueThisMonth: ledger.revenueThisMonth,
        revenueLifetime: ledger.revenueLifetime,
        shareEarned: ledger.shareEarned,
        shareThisMonth: Math.round((pct / 100) * ledger.revenueThisMonth),
      },
      settlements: {
        settledTotal: money.settledTotal,
        pending: money.pending,
        lastSettlementAt: money.lastSettlementAt,
        history: money.settlements,
      },
      // The delivered orders behind the numbers — the proof, same as the
      // rider's per-stop ledger.
      deliveredOrders: recentDelivered.map((o) => ({
        orderNumber: o.orderNumber,
        customerName: o.user?.name ?? 'customer',
        orderValue: o.totalPrice ?? 0,
        yourShare: Math.round((pct / 100) * (o.totalPrice ?? 0)),
        deliveredAt: o.deliveredAt?.toISOString() ?? null,
        serviceSpeed: o.serviceSpeed,
      })),
    })
  } catch (e) {
    console.error('[partner/earnings] failed:', e)
    return NextResponse.json({ error: 'Could not load your earnings' }, { status: 500 })
  }
}
