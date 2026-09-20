// =============================================================================
// GET  /api/marketing/automation — the newsletter engine state (admin)
// PUT  /api/marketing/automation — update the engine settings (admin)
// =============================================================================
// Phase 40: the engine drafts campaigns from the 52-week content library on
// the owner's cadence. GET returns everything the panel renders (schedule,
// pending draft, last sent, next library entry). PUT updates cadence / send
// day / send time / content starting point, and — when the timing settings
// change while nothing is pending — recomputes the next slot from now.
//
// Phase 44 adds `startDate` ('YYYY-MM-DD'): the owner picks the EXACT day
// the first newsletter goes out from a calendar. Rules, in plain words:
//   * A newsletter already waiting (draft or approved)? The owner can still
//     pick a start date — as long as it is AFTER the waiting one's day. The
//     pin then applies to the next cycle (phase 45: the old blanket 409 made
//     the calendar button useless in the most common state — a draft waiting
//     is exactly when the engine is "running").
//   * The weekly rhythm follows the chosen date: dayOfWeek is synced to the
//     weekday the owner picked (future sends stay on that day).
//   * A send-time change later re-times the pinned slot (same date); a
//     send-DAY change takes the rhythm back over (pin cleared).
//   * The pin is consumed when the engine advances past the first slot.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import {
  getOrCreateSchedule,
  getAutomationState,
  ensureNextAutoDraft,
  nextOccurrenceLagos,
  slotFromStartDateLagos,
} from '@/lib/marketing'

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
  // Phase 44 — pick the exact first-send day from the calendar.
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD')
    .optional(),
})

// At least this far ahead for a hand-picked slot, so the daily cron / lazy
// scheduler reliably gets a chance to see it before it is due.
const MIN_PINNED_LEAD_MS = 60 * 60_000

function lagosDateStr(d: Date): string {
  const lagos = new Date(d.getTime() + 60 * 60_000) // Africa/Lagos, UTC+1, no DST
  return `${lagos.getUTCFullYear()}-${String(lagos.getUTCMonth() + 1).padStart(2, '0')}-${String(
    lagos.getUTCDate()
  ).padStart(2, '0')}`
}

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

  const { startDate, ...rest } = parsed.data // rest = Prisma-safe fields
  const current = await getOrCreateSchedule()

  // ---- Rule 1: an explicit start date pins the first send -----------------
  if (startDate) {
    // Date sanity first — a past date is wrong no matter what is pending,
    // and this message is the one the owner needs to see.
    const { slot, dayOfWeek } = slotFromStartDateLagos(startDate, rest.sendTime ?? current.sendTime)
    if (slot.getTime() <= Date.now() + MIN_PINNED_LEAD_MS) {
      return NextResponse.json(
        {
          error:
            'That day has already passed (or is less than an hour away) at your current send time. Pick a day that is still ahead.',
        },
        { status: 400 }
      )
    }

    // A newsletter already waiting? The pin simply has to land AFTER it —
    // the waiting one keeps its own day, the pin takes the NEXT cycle.
    const pending = await db.newsletterCampaign.findFirst({
      where: { source: 'automation', status: { in: ['DRAFT', 'SCHEDULED'] } },
      select: { id: true, status: true, slotDate: true, scheduledAt: true, subject: true },
    })
    if (pending) {
      const pendingAt = pending.slotDate ?? pending.scheduledAt
      if (pendingAt && slot.getTime() <= new Date(pendingAt).getTime()) {
        const pendingDay = new Date(pendingAt).toLocaleDateString('en-NG', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })
        return NextResponse.json(
          {
            error: `That day is on or before the newsletter already waiting (${pendingDay}). Pick a later day — it will become the start of the next one.`,
          },
          { status: 400 }
        )
      }
    }

    await db.marketingSchedule.update({
      where: { id: 'main' },
      data: {
        ...rest,
        nextSlotDate: slot,
        slotPinned: true,
        // The rhythm follows the picked date's weekday from now on.
        dayOfWeek: rest.dayOfWeek ?? dayOfWeek,
      },
    })

    // Slot close enough? Prepare the draft right away so the owner sees it.
    try {
      await ensureNextAutoDraft()
    } catch (e) {
      console.error('ensureNextAutoDraft after start-date pin failed:', e)
    }
    const state = await getAutomationState()
    return NextResponse.json(state)
  }

  // ---- Rule 2: timing changes while nothing is pending --------------------
  const dowChanged = rest.dayOfWeek !== undefined && rest.dayOfWeek !== current.dayOfWeek
  const timeChanged = rest.sendTime !== undefined && rest.sendTime !== current.sendTime

  let nextSlotDate: Date | null | undefined
  let slotPinned: boolean | undefined
  if (timeChanged || dowChanged) {
    const pending = await db.newsletterCampaign.findFirst({
      where: { source: 'automation', status: { in: ['DRAFT', 'SCHEDULED'] } },
      select: { id: true },
    })
    if (!pending) {
      if (timeChanged && !dowChanged && current.slotPinned && current.nextSlotDate) {
        // Keep the owner's chosen DATE, move only the time on it.
        const { slot } = slotFromStartDateLagos(
          lagosDateStr(current.nextSlotDate),
          rest.sendTime ?? current.sendTime
        )
        if (slot.getTime() <= Date.now() + MIN_PINNED_LEAD_MS) {
          return NextResponse.json(
            {
              error:
                'That send time has already passed for your chosen start date. Pick a later time or a later start date.',
            },
            { status: 400 }
          )
        }
        nextSlotDate = slot
        slotPinned = true
      } else {
        // A new send DAY takes the rhythm back over — recompute from now.
        nextSlotDate = nextOccurrenceLagos(
          rest.dayOfWeek ?? current.dayOfWeek,
          rest.sendTime ?? current.sendTime
        )
        slotPinned = false
      }
    }
  }

  await db.marketingSchedule.update({
    where: { id: 'main' },
    data: {
      ...rest,
      ...(nextSlotDate !== undefined ? { nextSlotDate } : {}),
      ...(slotPinned !== undefined ? { slotPinned } : {}),
    },
  })

  // Turning the engine on (or timing moved closer) — give it the chance to
  // prepare the first draft immediately if the slot is close.
  if (rest.enabled === true || timeChanged || dowChanged) {
    try {
      await ensureNextAutoDraft()
    } catch (e) {
      console.error('ensureNextAutoDraft after settings update failed:', e)
    }
  }

  const state = await getAutomationState()
  return NextResponse.json(state)
}
