// =============================================================================
// POST /api/orders/[id]/message — staff question to the customer (phase 54)
// =============================================================================
// The owner's cadence rule: apart from the curated status emails (awaiting
// payment / ready to pick up / finishing / out for delivery / delivered),
// the ONLY mid-order message a customer should receive is a genuine
// question from the team ("which gate should the rider call at?").
//
// RBAC: ADMIN and STAFF may ask; drivers and customers may not (drivers
// already have a Call button in their app). Staff live-access is enforced
// exactly like the order PATCH route.
//
// What it does:
//   1. validates the question (10–1,000 chars),
//   2. writes a StatusEvent note into the order timeline (auditable —
//      the modal's activity feed shows who asked what, when),
//   3. after the response: emails the customer the question in full and
//      sends a best-effort SMS with a trimmed version (never throws).
// Rate-limited per order so a stuck client can never spam a customer.
// =============================================================================

import { NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { getSession, verifyLiveAccess } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { notifyCustomerQuestion } from '@/lib/notifications'
import type { Prisma } from '@prisma/client'

const MESSAGE_INCLUDE = {
  user: { select: { id: true, name: true, email: true, phone: true, role: true } },
  driver: { select: { id: true, name: true, phone: true } },
  payments: true,
  media: { select: { id: true } },
} satisfies Prisma.OrderInclude

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // ----- RBAC: console roles only -----
  const role = session.user?.role
  if (role !== 'ADMIN' && role !== 'STAFF') {
    return NextResponse.json(
      { error: 'Only the Kozy Care team can message a customer about an order' },
      { status: 403 }
    )
  }

  // ----- Staff live-access check (phase 31) -----
  const blocked = await verifyLiveAccess(session)
  if (blocked) {
    return new NextResponse(blocked.body, {
      status: blocked.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ----- Rate limit: 5 questions per order per hour -----
  const limit = await rateLimit(`order-msg:${id}`, { max: 5, windowMs: 60 * 60 * 1000 })
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Several messages were already sent for this order — please wait a little before messaging again.' },
      { status: 429 }
    )
  }

  const body = await req.json().catch(() => null)
  const question: unknown = body?.question
  if (typeof question !== 'string') {
    return NextResponse.json({ error: 'A question is required' }, { status: 400 })
  }
  const text = question.trim().replace(/\s+/g, ' ')
  if (text.length < 10) {
    return NextResponse.json(
      { error: 'The question is too short — tell the customer what you need to know.' },
      { status: 400 }
    )
  }
  if (text.length > 1000) {
    return NextResponse.json(
      { error: 'The question is too long (max 1,000 characters).' },
      { status: 400 }
    )
  }

  const order = await db.order.findUnique({
    where: { id },
    include: MESSAGE_INCLUDE,
  })
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const senderName = session.user?.name || 'The Kozy Care team'

  // Timeline entry — status stays the CURRENT stage (this is not a status
  // change); the note carries the question so the audit trail answers
  // "what did we ask and when".
  await db.statusEvent.create({
    data: {
      orderId: id,
      status: order.status,
      note: `Question to customer: ${text.slice(0, 180)}${text.length > 180 ? '…' : ''}`,
      actorId: session.user?.id,
    },
  })

  // Email + SMS after the response — Brevo/Termii latency must not slow
  // the modal. notifyCustomerQuestion never throws.
  const notifiable = { ...order, totalPrice: order.totalPrice ?? 0 }
  after(async () => {
    try {
      await notifyCustomerQuestion(notifiable, text, senderName)
    } catch (e) {
      console.error('Customer-question notification failed:', e)
    }
  })

  return NextResponse.json({ ok: true })
}
