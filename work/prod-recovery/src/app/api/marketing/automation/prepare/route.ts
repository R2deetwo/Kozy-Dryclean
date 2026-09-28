// =============================================================================
// POST /api/marketing/automation/prepare — draft the next newsletter NOW
// =============================================================================
// Same action the engine performs automatically ~3 days before each slot,
// triggered on demand: the owner turns the engine on and wants the first
// draft immediately instead of waiting. Creates a DRAFT campaign (never a
// send) from the 52-week library at the schedule's content pointer. Refuses
// (409) while another automation draft is already waiting for review.

import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { ensureNextAutoDraft, getPendingAutomationCampaign, getAutomationState } from '@/lib/marketing'

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

export async function POST() {
  const guard = await guardAdmin()
  if (guard instanceof NextResponse) return guard

  const campaign = await ensureNextAutoDraft(true)
  if (!campaign) {
    // Distinguish the two legitimate reasons (engine off vs draft waiting)
    const pending = await getPendingAutomationCampaign()
    return NextResponse.json(
      {
        error: pending
          ? 'One newsletter is already waiting for your review — send, approve or skip it first.'
          : 'Nothing to prepare — turn the newsletter engine on first (the switch at the top of this card).',
        code: pending ? 'DRAFT_WAITING' : 'ENGINE_OFF',
      },
      { status: 409 }
    )
  }
  return NextResponse.json({
    campaign: { id: campaign.id, name: campaign.name, subject: campaign.subject },
    state: await getAutomationState(),
  })
}
