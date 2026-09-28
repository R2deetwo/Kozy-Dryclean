// =============================================================================
// GET /api/marketing/campaigns/[id]/audience — how many people would get it
// =============================================================================
// Resolves the campaign's segment with the SAME audience rules as the real
// send (opted-in customers + subscribers, deduped) and returns only the
// count. Powers the safe send dialog: the owner sees "this will go to N
// people" and types SEND before anything can go out. Read-only, no send.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { resolveSegmentRecipients, type CampaignSegment } from '@/lib/marketing'

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

export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await guardAdmin()
  if (guard instanceof NextResponse) return guard
  const { id } = await params

  const campaign = await db.newsletterCampaign.findUnique({ where: { id } })
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const recipients = await resolveSegmentRecipients(campaign.segment as CampaignSegment)
  return NextResponse.json({
    count: recipients.length,
    segment: campaign.segment,
    tested: campaign.testSentAt != null,
  })
}
