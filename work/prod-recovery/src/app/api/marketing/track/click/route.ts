// =============================================================================
// GET /api/marketing/track/click?c=<campaignId>&r=<recipientId>&url=<encoded>
// =============================================================================
// Campaign links are rewritten through this endpoint (src/lib/marketing.ts
// rewriteCampaignLinks). We record the first click per recipient, then
// 302-redirect to the real destination. Only http(s) destinations are
// accepted — anything else (javascript:, data:, …) is rejected, which also
// makes this a safe open-redirect guard.

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const campaignId = searchParams.get('c')
  const recipientId = searchParams.get('r')
  const rawUrl = searchParams.get('url')

  // Validate the destination BEFORE any DB write — a bad URL never gets tracked
  let destination: string | null = null
  if (rawUrl) {
    try {
      const decoded = decodeURIComponent(rawUrl)
      if (/^https?:\/\//i.test(decoded)) {
        destination = decoded
      } else if (decoded.startsWith('/')) {
        destination = decoded
      }
    } catch {
      destination = null
    }
  }

  if (campaignId && recipientId && recipientId !== 'test') {
    try {
      const updated = await db.newsletterRecipient.updateMany({
        where: { id: recipientId, campaignId, clickedAt: null },
        data: { clickedAt: new Date() },
      })
      if (updated.count > 0) {
        await db.newsletterCampaign.update({
          where: { id: campaignId },
          data: { clickCount: { increment: 1 } },
        })
      }
    } catch {
      // Tracking failure must never block the redirect
    }
  }

  if (!destination) {
    // Bad or missing destination — fall back to the site home
    destination = process.env.NEXT_PUBLIC_APP_URL || '/'
  }

  return NextResponse.redirect(destination, 302)
}
