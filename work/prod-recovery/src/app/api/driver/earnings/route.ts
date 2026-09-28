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
// RBAC: DRIVER only.

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getRiderLegs, summarizeLegs } from '@/lib/rider-ledger'

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
    return NextResponse.json({
      published: rates.published,
      rates: { pickup: rates.pickup, delivery: rates.delivery },
      summary,
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
