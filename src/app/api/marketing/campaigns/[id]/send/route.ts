// =============================================================================
// POST /api/marketing/campaigns/[id]/send — send a campaign (admin)
// Body: { test?: boolean }
//   test=true  → one preview copy to the admin's own inbox (no audience,
//                no counters, subject prefixed [TEST])
//   test absent → live send to the resolved segment. Resumable: recipients
//                are created once per (campaign, email) and only PENDING
//                rows are sent, so re-running after an interruption
//                continues instead of duplicating.
//
// Phase 37 accident guard: a live blast is REFUSED (409) until the campaign
// has been test-sent at least once — the owner must have seen the email in
// his own inbox before it can go to customers. Scheduled campaigns (cron /
// lazy scheduler) are exempt: scheduling was a deliberate, separate step.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { sendCampaignNow, sendCampaignTest } from '@/lib/marketing'

export const maxDuration = 60

async function guardAdmin(): Promise<ReturnType<typeof requireRole> | NextResponse> {
  try {
    return await requireRole('ADMIN')
  } catch (e) {
    if (e instanceof Response) {
      return new NextResponse(e.body, {
        status: e.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    throw e
  }
}

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
  const guard = await guardAdmin()
  if (guard instanceof NextResponse) return guard
  const { id } = await params

  const { test } = await req.json().catch(() => ({}) as { test?: boolean })

  const campaign = await db.newsletterCampaign.findUnique({ where: { id } })
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  if (test) {
    const adminEmail = (guard as any).user?.email
    if (!adminEmail) {
      return NextResponse.json({ error: 'No admin email on this session' }, { status: 400 })
    }
    try {
      await sendCampaignTest(id, adminEmail)
      return NextResponse.json({
        success: true,
        message: `Test copy sent to ${adminEmail}`,
      })
    } catch (e) {
      console.error('Campaign test send failed:', e)
      return NextResponse.json(
        { error: 'The test email could not be sent — check the email settings' },
        { status: 502 }
      )
    }
  }

  if (campaign.status === 'CANCELLED') {
    return NextResponse.json({ error: 'This campaign was cancelled' }, { status: 400 })
  }

  // Accident guard (phase 37): no live blast before the owner has seen a
  // test copy in his own inbox. Retry-after-failure on an already-SENT
  // campaign stays allowed (it only re-tries failed recipients).
  if (!campaign.testSentAt && campaign.status !== 'SENT') {
    return NextResponse.json(
      {
        error:
          'Send yourself a test first — click “Test” to receive the email in your own inbox, then come back and send it to everyone.',
        code: 'TEST_FIRST',
      },
      { status: 409 }
    )
  }

  try {
    const result = await sendCampaignNow(id)
    return NextResponse.json({
      success: true,
      sentCount: result.sentCount,
      total: result.total,
      failedCount: result.failedCount,
      message:
        result.failedCount > 0
          ? `Sent to ${result.sentCount} of ${result.total} recipients — ${result.failedCount} failed (re-check the campaign later to retry them)`
          : `Campaign sent to ${result.sentCount} recipient${result.sentCount === 1 ? '' : 's'}`,
    })
  } catch (e) {
    console.error('Campaign send failed:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'The campaign send failed' },
      { status: 500 }
    )
  }
}
