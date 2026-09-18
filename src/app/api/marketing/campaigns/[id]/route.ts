// =============================================================================
// GET    /api/marketing/campaigns/[id] — fetch one campaign + recipients
// PATCH  /api/marketing/campaigns/[id] — update (only DRAFT / SCHEDULED)
// DELETE /api/marketing/campaigns/[id] — delete (only DRAFT / SCHEDULED)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { plainTextToEmailHtml } from '@/lib/marketing'
import { NEWSLETTER_BANNERS } from '@/lib/newsletter-content'

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

const UpdateCampaignSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  subject: z.string().trim().min(1).max(200).optional(),
  // Phase 40: the automation DRAFTS are edited as plain text too (the
  // generated library body lands here for the owner's tweaks).
  bodyText: z.string().trim().min(1).max(100_000).optional(),
  htmlContent: z.string().trim().min(1).max(200_000).optional(),
  segment: z.enum(['ALL', 'B2C', 'B2B', 'INACTIVE']).optional(),
  // null clears the schedule (back to DRAFT); an ISO string schedules it
  scheduledAt: z.string().datetime().nullable().optional(),
  bannerSlug: z
    .string()
    .refine((s) => NEWSLETTER_BANNERS.some((b) => b.slug === s), 'Unknown banner')
    .nullable()
    .optional(),
})

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await guardAdmin()
  if (guard instanceof NextResponse) return guard
  const { id } = await params

  const campaign = await db.newsletterCampaign.findUnique({
    where: { id },
    include: {
      recipients: {
        select: {
          id: true,
          email: true,
          source: true,
          sentAt: true,
          openedAt: true,
          clickedAt: true,
          deliveryStatus: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      },
    },
  })
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  return NextResponse.json({ campaign })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await guardAdmin()
  if (guard instanceof NextResponse) return guard
  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = UpdateCampaignSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid campaign update', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const existing = await db.newsletterCampaign.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  if (!['DRAFT', 'SCHEDULED'].includes(existing.status)) {
    return NextResponse.json(
      { error: 'A sent campaign cannot be edited (duplicate it instead)' },
      { status: 400 }
    )
  }

  const { scheduledAt, bodyText, ...rest } = parsed.data

  // Phase 44 guard — same rule as create: a schedule in the past fires on
  // the next tick, which is never what an edit intends. (The automation
  // "Approve" flow always schedules in the future, so it is unaffected.)
  if (
    scheduledAt !== undefined &&
    scheduledAt !== null &&
    new Date(scheduledAt).getTime() <= Date.now()
  ) {
    return NextResponse.json(
      {
        error:
          'That schedule date is already in the past — a past-dated newsletter would send immediately on the next check. Pick a future date, or save it as a draft and press "Send now".',
      },
      { status: 400 }
    )
  }

  const campaign = await db.newsletterCampaign.update({
    where: { id },
    data: {
      ...rest,
      ...(bodyText ? { htmlContent: plainTextToEmailHtml(bodyText), bodyText } : {}),
      ...(scheduledAt !== undefined
        ? {
            scheduledAt: scheduledAt === null ? null : new Date(scheduledAt),
            status: scheduledAt === null ? 'DRAFT' : 'SCHEDULED',
          }
        : {}),
    },
  })
  return NextResponse.json({ campaign })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await guardAdmin()
  if (guard instanceof NextResponse) return guard
  const { id } = await params

  const existing = await db.newsletterCampaign.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  if (!['DRAFT', 'SCHEDULED'].includes(existing.status)) {
    return NextResponse.json(
      { error: 'A sent campaign is your delivery record and cannot be deleted' },
      { status: 400 }
    )
  }

  await db.newsletterCampaign.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
