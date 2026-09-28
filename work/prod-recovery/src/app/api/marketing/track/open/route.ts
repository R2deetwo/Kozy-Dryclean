// =============================================================================
// GET /api/marketing/track/open?c=<campaignId>&r=<recipientId>
// =============================================================================
// The invisible 1x1 GIF appended to every campaign email. When the customer's
// mail client loads it, we record the open (first time only — updateMany
// matches openedAt=null, so reloads and image-proxy prefetches never
// double-count) and increment the campaign's open counter.

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Transparent 1x1 GIF
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const campaignId = searchParams.get('c')
  const recipientId = searchParams.get('r')

  if (campaignId && recipientId && recipientId !== 'test') {
    try {
      // First open only — where openedAt IS NULL
      const updated = await db.newsletterRecipient.updateMany({
        where: { id: recipientId, campaignId, openedAt: null },
        data: { openedAt: new Date() },
      })
      if (updated.count > 0) {
        await db.newsletterCampaign.update({
          where: { id: campaignId },
          data: { openCount: { increment: 1 } },
        })
      }
    } catch {
      // Tracking must never error visibly — always return the pixel
    }
  }

  return new NextResponse(PIXEL, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Content-Length': String(PIXEL.length),
    },
  })
}
