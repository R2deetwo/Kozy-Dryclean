// =============================================================================
// GET  /api/marketing/automation — the newsletter engine state (admin)
// PUT  /api/marketing/automation — update the engine settings (admin)
// =============================================================================
// Phase 40: the engine drafts campaigns from the 52-week content library on
// the owner's cadence. GET returns everything the panel renders (schedule,
// pending draft, last sent, next library entry). PUT updates cadence / send
// day / send time / content starting point, and — when the timing settings
// change while nothing is pending — recomputes the next slot from now.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { getOrCreateSchedule, getAutomationState, ensureNextAutoDraft, nextOccurrenceLagos } from '@/lib/marketing'

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

  const state = await getAutomationState()
  return NextResponse.json(state)
}

const UpdateSchema = z.object({
  enabled: z.boolean().optional(),
  cadenceWeeks: z.union([z.literal(1), z.literal(2), z.literal(4)]).optional(),
  dayOfWeek: z.int().min(0).max(6).optional(),
  sendTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Send time must be HH:mm (24-hour)')
    .optional(),
  currentWeekIndex: z.int().min(0).max(51).optional(),
})

export async function PUT(req: NextRequest) {
  const guard = await guardAdmin()
  if (guard instanceof NextResponse) return guard

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid automation settings', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const current = await getOrCreateSchedule()
  const timingChanged =
    (parsed.data.cadenceWeeks !== undefined && parsed.data.cadenceWeeks !== current.cadenceWeeks) ||
    (parsed.data.dayOfWeek !== undefined && parsed.data.dayOfWeek !== current.dayOfWeek) ||
    (parsed.data.sendTime !== undefined && parsed.data.sendTime !== current.sendTime)

  // If timing changed and nothing is pending, the next slot is recomputed
  // from now — the old slot belonged to the old rhythm.
  let nextSlotDate: Date | null | undefined
  if (timingChanged) {
    const pending = await db.newsletterCampaign.findFirst({
      where: { source: 'automation', status: { in: ['DRAFT', 'SCHEDULED'] } },
      select: { id: true },
    })
    if (!pending) {
      nextSlotDate = nextOccurrenceLagos(
        parsed.data.dayOfWeek ?? current.dayOfWeek,
        parsed.data.sendTime ?? current.sendTime
      )
    }
  }

  await db.marketingSchedule.update({
    where: { id: 'main' },
    data: {
      ...parsed.data,
      ...(nextSlotDate !== undefined ? { nextSlotDate } : {}),
    },
  })

  // Turning the engine on (or timing moved closer) — give it the chance to
  // prepare the first draft immediately if the slot is close.
  if (parsed.data.enabled === true || timingChanged) {
    try {
      await ensureNextAutoDraft()
    } catch (e) {
      console.error('ensureNextAutoDraft after settings update failed:', e)
    }
  }

  const state = await getAutomationState()
  return NextResponse.json(state)
}
