// =============================================================================
// POST /api/marketing/campaigns/process-due — lazy scheduler (admin)
// =============================================================================
// Vercel Hobby plans only run cron once a day, so scheduled campaigns also
// get a second trigger: the Marketing tab calls this endpoint on mount.
// Whenever the owner opens the console's Marketing tab, any SCHEDULED
// campaign whose time has come is sent immediately. Idempotent — the same
// campaign can never be processed twice (recipient rows are unique).

import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { processDueCampaigns } from '@/lib/marketing'

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

export async function POST() {
  const guard = await guardAdmin()
  if (guard instanceof NextResponse) return guard

  try {
    const result = await processDueCampaigns()
    return NextResponse.json({
      processed: result.processed.length,
      failed: result.failed,
    })
  } catch (e) {
    console.error('processDueCampaigns failed:', e)
    return NextResponse.json({ error: 'Could not process scheduled campaigns' }, { status: 500 })
  }
}
