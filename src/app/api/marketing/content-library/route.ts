// =============================================================================
// GET /api/marketing/content-library — the 52-week newsletter plan (admin)
// =============================================================================
// Returns the full content library (52 entries sequenced to the Nigerian
// year) plus the available banner images, for the "Browse the content plan"
// browser in the Marketing tab. Read-only: the owner picks where the engine
// starts (PUT /api/marketing/automation { currentWeekIndex }) and every
// generated draft is fully editable before it is ever sent.

import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { NEWSLETTER_LIBRARY, NEWSLETTER_BANNERS, NEWSLETTER_LIBRARY_TOTAL } from '@/lib/newsletter-content'

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

export async function GET() {
  const guard = await guardAdmin()
  if (guard instanceof NextResponse) return guard

  return NextResponse.json({
    entries: NEWSLETTER_LIBRARY,
    banners: NEWSLETTER_BANNERS,
    total: NEWSLETTER_LIBRARY_TOTAL,
  })
}
