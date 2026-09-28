// =============================================================================
// GET /api/loyalty — the customer's own loyalty state (phase 53)
// =============================================================================
// Auth: EITHER a signed-in session OR a ?token= milestone token (the
// HMAC-signed link from the ten-service appreciation email — the customer
// may open it on a device where they are not signed in).
//
// Powers the quiet loyalty surfaces ("after 10 washes, the 11th is free"):
//   - the portal card, visible ONLY from the 5th completed paid wash
//     (the owner's explicit reveal-at-5 rule), showing the countdown
//     "5 of 10 … 9 of 10" and, once earned, "your next service is on the
//     house"
//   - the private /milestone page reached from the appreciation email
//
// Deliberately SILENT below five paid washes: the response still computes
// everything, but `visible: false` and nothing in any UI hints that an
// offer exists. The offline paper version of this offer is never
// referenced anywhere online.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { verifyMilestoneToken } from '@/lib/referrals'
import { getLoyaltyState } from '@/lib/loyalty'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    // ----- Who is asking? (session OR milestone token) -----
    let userId: string | null = null

    const session = await getSession()
    if (session?.user?.id && (session.user as any).role !== 'ADMIN') {
      userId = session.user.id
    } else {
      const token = req.nextUrl.searchParams.get('token')
      if (token) {
        const fromToken = verifyMilestoneToken(token)
        if (fromToken) userId = fromToken
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const loyalty = await getLoyaltyState(user.id)

    return NextResponse.json({
      ...loyalty,
      // For prefilling the private milestone feedback form
      userName: user.name,
      userEmail: user.email,
    })
  } catch (err) {
    console.error('GET /api/loyalty failed:', err)
    return NextResponse.json({ error: 'Failed to load loyalty state' }, { status: 500 })
  }
}
