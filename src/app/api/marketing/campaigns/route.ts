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

const CreateCampaignSchema = z.object({
  name: z.string().trim().min(1, 'Campaign name is required').max(100),
  subject: z.string().trim().min(1, 'Email subject is required').max(200),
  htmlContent: z.string().trim().min(1, 'Email body is required').max(200_000),
  segment: z.enum(['ALL', 'B2C', 'B2B', 'INACTIVE']).default('ALL'),
  // Optional ISO datetime — blank/undefined saves as a DRAFT
  scheduledAt: z.string().datetime().optional(),
})

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

  const { name, subject, htmlContent, segment, scheduledAt } = parsed.data
  const campaign = await db.newsletterCampaign.create({
    data: {
      name,
      subject,
      htmlContent,
      segment,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
      createdById: (guard as any).user?.id ?? null,
    },
  })
  return NextResponse.json({ campaign }, { status: 201 })
}
