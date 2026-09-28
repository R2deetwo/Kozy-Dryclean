// =============================================================================
// GET /api/referrals — the customer's own referral state (phase 52)
// =============================================================================
// Auth: EITHER a signed-in session OR a ?token= milestone token (the
// HMAC-signed link from the 10-order appreciation email — the customer may
// open it on a device where they are not signed in).
//
// Returns everything the quiet surfaces need:
//   deliveredCount, eligible (>= MILESTONE_ORDERS), the personal code
//   (minted lazily for eligible customers — legacy 10+ customers who crossed
//   the line before the feature existed get theirs on first visit), the
//   thank-you credit balance, and the program's live terms for the copy.
//
// The endpoint is deliberately SILENT for everyone else: a customer below
// the milestone gets { eligible: false, code: null } and nothing in the UI
// ever hints that a program exists (no locked badges, no teasers).
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getAppSettings } from '@/lib/app-settings'
import { ensureReferralCode, verifyMilestoneToken } from '@/lib/referrals'
import { MILESTONE_ORDERS } from '@/lib/types'

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
      select: { id: true, name: true, email: true, referralCredit: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const deliveredCount = await db.order.count({
      where: { userId: user.id, status: 'DELIVERED' },
    })
    const eligible = deliveredCount >= MILESTONE_ORDERS

    // Mint lazily for eligible customers (idempotent — the milestone email
    // path and this endpoint can race safely; one row wins).
    let code: string | null = null
    if (eligible) {
      const row = await ensureReferralCode({ id: user.id, name: user.name })
      code = row.code
    }

    const settings = await getAppSettings()
    const redemptions = await db.referralRedemption.findMany({
      where: { code: { userId: user.id } },
      orderBy: { createdAt: 'desc' },
      select: { friendName: true, createdAt: true, rewardGrantedAt: true },
      take: 20,
    })

    return NextResponse.json({
      deliveredCount,
      eligible,
      code,
      credit: user.referralCredit,
      friendDiscountPercent: Math.max(0, Math.min(settings.referralFriendDiscountPercent, 50)),
      rewardAmount: Math.max(0, Math.round(settings.referralRewardAmount)),
      // For prefilling the private feedback form (token or session holder only)
      userName: user.name,
      userEmail: user.email,
      redemptions: redemptions.map((r) => ({
        friendName: r.friendName,
        redeemedAt: r.createdAt.toISOString(),
        rewarded: r.rewardGrantedAt != null,
      })),
    })
  } catch (err) {
    console.error('GET /api/referrals failed:', err)
    return NextResponse.json({ error: 'Failed to load referral state' }, { status: 500 })
  }
}
