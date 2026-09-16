// =============================================================================
// GET  /api/marketing/campaigns — list all campaigns (admin)
// POST /api/marketing/campaigns — create a new campaign (admin)
// =============================================================================
// Campaign lifecycle: DRAFT → SCHEDULED → SENDING → SENT (see the schema).
// The list powers the Marketing tab; POST accepts an optional scheduledAt
// which immediately marks the campaign SCHEDULED (sent by the cron endpoint
// or the lazy scheduler when the owner opens the Marketing tab).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { plainTextToEmailHtml } from '@/lib/marketing'
import { NEWSLETTER_BANNERS } from '@/lib/newsletter-content'

// Phase 31/36: convert requireRole's thrown 401/403 Response into a real
// response — the console client must see 403, not an empty 500.
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

const CreateCampaignSchema = z
  .object({
    name: z.string().trim().min(1, 'Campaign name is required').max(100),
    subject: z.string().trim().min(1, 'Email subject is required').max(200),
    // Phase 37: the owner writes a plain message (like a normal email or
    // WhatsApp text) — converted to safe, pretty HTML server-side. The
    // htmlContent field stays for any power user who pastes real HTML.
    bodyText: z.string().trim().min(1, 'Email message is required').max(100_000).optional(),
    htmlContent: z.string().trim().min(1, 'Email body is required').max(200_000).optional(),
    segment: z.enum(['ALL', 'B2C', 'B2B', 'INACTIVE']).default('ALL'),
    // Optional ISO datetime — blank/undefined saves as a DRAFT
    scheduledAt: z.string().datetime().optional(),
    // Phase 40: optional email header banner slug (validated against the
    // banner pack; null/omitted = no image)
    bannerSlug: z
      .string()
      .refine((s) => NEWSLETTER_BANNERS.some((b) => b.slug === s), 'Unknown banner')
      .nullable()
      .optional(),
  })
  .refine((d) => d.bodyText || d.htmlContent, {
    message: 'Write the message before saving',
  })

/** Turn the submitted message into the HTML that gets stored.
 *  Plain text is auto-formatted (paragraphs, bold, clickable links);
 *  hand-written HTML from an advanced user is kept as-is. */
function messageToHtml(bodyText?: string, htmlContent?: string): string {
  if (bodyText) return plainTextToEmailHtml(bodyText)
  return htmlContent ?? ''
}

export async function GET() {
  const guard = await guardAdmin()
  if (guard instanceof NextResponse) return guard

  const campaigns = await db.newsletterCampaign.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          recipients: { where: { deliveryStatus: 'SENT' } },
        },
      },
    },
  })
  return NextResponse.json({
    campaigns: campaigns.map((c) => ({
      ...c,
      deliveredCount: (c as any)._count?.recipients ?? 0,
    })),
  })
}

export async function POST(req: NextRequest) {
  const guard = await guardAdmin()
  if (guard instanceof NextResponse) return guard

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = CreateCampaignSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid campaign details', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { name, subject, bodyText, htmlContent, segment, scheduledAt, bannerSlug } = parsed.data
  const campaign = await db.newsletterCampaign.create({
    data: {
      name,
      subject,
      htmlContent: messageToHtml(bodyText, htmlContent),
      // keep the plain-text source so the draft stays editable later
      bodyText: bodyText ?? null,
      segment,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
      bannerSlug: bannerSlug ?? null,
      createdById: (guard as any).user?.id ?? null,
    },
  })
  return NextResponse.json({ campaign }, { status: 201 })
}
