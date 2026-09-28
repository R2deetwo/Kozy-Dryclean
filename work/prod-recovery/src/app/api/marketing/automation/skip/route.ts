// =============================================================================
// POST /api/marketing/automation/skip — skip the pending automation DRAFT
// =============================================================================
// Body: { campaignId }. Deletes the DRAFT (drafts only — an approved
// SCHEDULED campaign must be deleted from the campaign list like any other)
// and immediately prepares the next one, so the panel always shows the
// next thing that would go out. The content pointer advanced when the
// skipped draft was created, so the next draft is the NEXT library entry —
// the rhythm and the content stay in sync.

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { skipAutoDraft, getAutomationState } from '@/lib/marketing'

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

export async function POST(req: NextRequest) {
  const guard = await guardAdmin()
  if (guard instanceof NextResponse) return guard

  const { campaignId } = await req.json().catch(() => ({}) as { campaignId?: string })
  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })
  }

  try {
    await skipAutoDraft(campaignId)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not skip this draft' },
      { status: 400 }
    )
  }

  return NextResponse.json({ skipped: true, state: await getAutomationState() })
}
