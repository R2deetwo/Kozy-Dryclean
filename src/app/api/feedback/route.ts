// =============================================================================
// POST /api/feedback — PUBLIC. Submit a complaint or question from the
//                      standalone /feedback page. Submissions land in the
//                      admin Feedback inbox (NEW → IN_PROGRESS → RESOLVED)
//                      and are NEVER shown publicly (the testimonial wall is
//                      fed exclusively by order-verified reviews via
//                      /api/reviews — Phase 17, client directive).
// GET  /api/feedback — ADMIN. List feedback, newest first, filterable.
// PATCH /api/feedback — ADMIN. Update status (NEW → IN_PROGRESS → RESOLVED)
//                      and attach an admin note.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { rateLimit, getClientIP } from '@/lib/rate-limit'
import { moderateText } from '@/lib/content-filter'
import { notifyAdminNewFeedback } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

const CreateFeedbackSchema = z.object({
  type: z.enum(['REVIEW', 'COMPLAINT', 'QUESTION']).default('REVIEW'),
  name: z.string().trim().min(2, 'Please tell us your name').max(80),
  email: z.string().trim().email('Enter a valid email address').max(120),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : undefined)),
  reference: z
    .string()
    .trim()
    .max(80)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : undefined)),
  rating: z
    .number()
    .min(1)
    .max(5)
    .optional()
    .nullable()
    .transform((v) => (v === null ? undefined : v)),
  message: z.string().trim().min(10, 'Please give us a little more detail (10+ characters)').max(2000),
})

export async function POST(req: NextRequest) {
  // Public form — 5 submissions/hour per IP keeps the inbox clean.
  const ip = getClientIP(req)
  const limit = await rateLimit(`feedback:${ip}`, { max: 5, windowMs: 60 * 60 * 1000 })
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Too many submissions. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = CreateFeedbackSchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? 'Please check your details.'
    return NextResponse.json({ error: first }, { status: 400 })
  }

  // ----- Content moderation (Phase 17, client directive) -----
  // Complaints and questions are private to the team, but they still pass
  // the improper-content screen (sexual content, slurs, illegal goods).
  const moderation = moderateText(parsed.data.name, parsed.data.message)
  if (!moderation.ok) {
    return NextResponse.json({ error: moderation.message }, { status: 400 })
  }

  try {
    const feedback = await db.feedback.create({ data: parsed.data })
    // Ping the owner's inbox immediately — a complaint that sits unread in
    // the admin console until someone happens to open the tab is exactly
    // how customers get lost (audit finding). Never blocks the response.
    after(async () => {
      try {
        await notifyAdminNewFeedback(feedback)
      } catch (e) {
        console.error('Feedback admin alert failed:', e)
      }
    })
    return NextResponse.json({ feedback: { id: feedback.id } }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Could not save your feedback. Please try again.' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const items = await db.feedback.findMany({
    where: status && ['NEW', 'IN_PROGRESS', 'RESOLVED'].includes(status) ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return NextResponse.json({ items })
}

const PatchFeedbackSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['NEW', 'IN_PROGRESS', 'RESOLVED']).optional(),
  adminNote: z.string().trim().max(1000).optional(),
})

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = PatchFeedbackSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid update' }, { status: 400 })
  }
  const { id, ...patch } = parsed.data
  try {
    const feedback = await db.feedback.update({
      where: { id },
      data: patch,
    })
    return NextResponse.json({ feedback })
  } catch {
    return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })
  }
}
