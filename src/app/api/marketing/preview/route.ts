// =============================================================================
// POST /api/marketing/preview — live email preview for the composer (admin)
// =============================================================================
// Body: { bodyText?: string, htmlContent?: string }
// Returns the EXACT HTML the campaign email would contain — same wrapper,
// same footer, same unsubscribe link — with the yellow "test copy" banner.
// NOTHING is sent and NOTHING is saved: this endpoint exists so the owner
// sees the email as customers will see it BEFORE saving, and so rendering
// can be verified without ever touching the real send path.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { buildCampaignPreviewHtml, plainTextToEmailHtml } from '@/lib/marketing'

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

const PreviewSchema = z
  .object({
    bodyText: z.string().max(100_000).optional(),
    htmlContent: z.string().max(200_000).optional(),
  })
  .refine((d) => (d.bodyText ?? '').trim().length > 0 || (d.htmlContent ?? '').trim().length > 0, {
    message: 'Write the message first — then the preview appears here.',
  })

export async function POST(req: NextRequest) {
  const guard = await guardAdmin()
  if (guard instanceof NextResponse) return guard

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = PreviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Nothing to preview yet' },
      { status: 400 }
    )
  }

  const { bodyText, htmlContent } = parsed.data
  const innerHtml = (bodyText ?? '').trim() ? plainTextToEmailHtml(bodyText!) : htmlContent ?? ''
  const viewerEmail = (guard as any).user?.email ?? 'preview@kozycare.ng'
  const html = buildCampaignPreviewHtml({ id: 'unsaved', htmlContent: innerHtml }, viewerEmail)

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
