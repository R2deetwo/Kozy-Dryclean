// =============================================================================
// GET /api/driver/earnings — the rider's payout ledger
// =============================================================================
// Earnings = completed legs × the per-stop rates the OFFICE sets in
// Settings → Rider pay (rider_pickup_rate / rider_delivery_rate, naira per
// stop). The view is a transparent ledger, not a black box: every line is a
// leg the rider swiped, priced at today's published rate, rolled up into
// this payout week (Monday 00:00 Lagos) and all-time. When the office has
// not published rates yet, the response says so plainly — the rider sees
// their completed work, never a fake number.
//
// Phase 72 — the money side: payouts the office actually settled are now
// included, so the rider sees pending (earned minus paid), paid-to-date and
// the payout history with method + reference. The disclaimer era ("payout
// timing follows your arrangement with the office") is over: the cycle is
// weekly, to the bank details on file in the Account tab.
//
// RBAC: DRIVER only.

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getRiderLegs, summarizeLegs, getRiderPayoutSummary } from '@/lib/rider-ledger'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'DRIVER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { legs, rates } = await getRiderLegs(session.user.id, { limit: 200 })
    const summary = summarizeLegs(legs, rates)
    const payouts = await getRiderPayoutSummary(session.user.id, rates, { limit: 20 })
    const me = await db.user.findUnique({
      where: { id: session.user.id },
      select: { bankName: true, bankAccountNumber: true, bankAccountName: true },
    })
    return NextResponse.json({
      published: rates.published,
      rates: { pickup: rates.pickup, delivery: rates.delivery },
      summary,
      // The money side (phase 72): what has actually been settled.
      payouts: {
        paidTotal: payouts.paidTotal,
        pending: payouts.pending,
        lastPayoutAt: payouts.lastPayoutAt,
        history: payouts.payouts,
      },
      bank: me
        ? {
            set: Boolean(me.bankName && me.bankAccountNumber && me.bankAccountName),
            bankName: me.bankName,
            bankAccountNumber: me.bankAccountNumber,
            bankAccountName: me.bankAccountName,
          }
        : { set: false },
      // The itemised ledger (newest first) — the proof behind the totals.
      ledger: legs.slice(0, 50).map((l) => ({
        orderNumber: l.orderNumber,
        leg: l.leg,
        completedAt: l.completedAt,
        zone: l.zone,
        onTime: l.onTime,
        amount: l.amount,
      })),
    })
  } catch (e) {
    console.error('[driver/earnings] failed:', e)
    return NextResponse.json({ error: 'Could not load your earnings' }, { status: 500 })
  }
}
