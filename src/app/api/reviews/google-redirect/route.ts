// =============================================================================
// GET /api/reviews/google-redirect — the tracked Google review hand-off
// =============================================================================
// The link inside every review-ask email. HMAC-signed per customer (no login
// needed — it arrives by email). The FIRST tap marks the customer as having
// reviewed (our honest proxy: Google shares no per-reviewer signal we could
// match) and from that moment they are never asked again. Every tap lands
// on the Google Business Profile's review form.
//
// No data is collected beyond the ask-state this customer already knows
// about (disclosed in the privacy policy): the fact that the link was used.
// =============================================================================

import { NextResponse } from 'next/server'
import { recordReviewClick, verifyAskToken } from '@/lib/google-reviews'
import { GOOGLE_REVIEW_URL } from '@/lib/local-seo'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const userId = url.searchParams.get('u') ?? ''
  const token = url.searchParams.get('t') ?? ''
  if (!userId || !verifyAskToken(userId, token, 'google-review')) {
    return NextResponse.json(
      {
        error: 'INVALID_LINK',
        message:
          'That review link is not valid. Open your latest Kozy email, or find Kozy Care on Google Maps.',
      },
      { status: 400 }
    )
  }
  await recordReviewClick(userId)
  return NextResponse.redirect(GOOGLE_REVIEW_URL, { status: 302 })
}
