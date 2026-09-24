// =============================================================================
// GET /api/driver/history — the rider's completed rides
// =============================================================================
// Every pickup and delivery THIS rider finished, with where, for whom, when,
// and whether it beat the same clocks the ops board runs on. Attribution is
// by swipe (StatusEvent.actorId) — legs are credited to the rider who
// actually completed them, never merely to whoever the order is assigned to
// now.
//
// RBAC: DRIVER only. `?limit=<n>` caps the list (default 50, hard cap 200).

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getRiderLegs } from '@/lib/rider-ledger'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'DRIVER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const limit = Number(url.searchParams.get('limit') ?? 50)

  try {
    const { legs } = await getRiderLegs(session.user.id, {
      limit: Number.isFinite(limit) ? limit : 50,
    })
    return NextResponse.json({ legs })
  } catch (e) {
    console.error('[driver/history] failed:', e)
    return NextResponse.json({ error: 'Could not load your history' }, { status: 500 })
  }
}
