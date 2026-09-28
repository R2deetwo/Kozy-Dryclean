// =============================================================================
// GET /api/marketing/campaigns/[id]/preview — the saved campaign as an email
// =============================================================================
// Returns the exact HTML the campaign sends to customers (with the yellow
// "test copy" banner added so it can never be confused with a real send).
// Nothing is sent, nothing is recorded. Powers the Preview button on each
// campaign card — the owner can look at ANY campaign (draft or already
// sent) exactly as his customers saw it.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { buildCampaignPreviewHtml } from '@/lib/marketing'

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

  const viewerEmail = (guard as any).user?.email ?? 'preview@kozycare.ng'
  const html = buildCampaignPreviewHtml(campaign, viewerEmail)

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
