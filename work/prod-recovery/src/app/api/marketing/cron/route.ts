// =============================================================================
// GET /api/marketing/cron — daily trigger for scheduled campaigns
// =============================================================================
// Configured in vercel.json (Hobby-safe daily schedule, 07:00 UTC = 08:00
// Lagos). Authenticated with a shared secret:
//   Authorization: Bearer $CRON_SECRET
// If CRON_SECRET is not configured the endpoint stays LOCKED (401) — it
// never becomes an open "send everyone email" endpoint. The lazy scheduler
// (Marketing tab mount) provides the second, owner-triggered path.

import { NextRequest, NextResponse } from 'next/server'
import { processDueCampaigns } from '@/lib/marketing'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')

  if (!secret) {
    // Locked: the env var is not configured (fresh deploy without the var)
    return NextResponse.json(
      { error: 'Cron endpoint locked — set CRON_SECRET in the environment' },
      { status: 401 }
    )
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processDueCampaigns()
    return NextResponse.json({
      processed: result.processed.length,
      failed: result.failed,
    })
  } catch (e) {
    console.error('Cron processing failed:', e)
    return NextResponse.json({ error: 'Cron processing failed' }, { status: 500 })
  }
}
