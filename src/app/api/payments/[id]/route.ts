// =============================================================================
// PATCH /api/payments/[id] — verify or reject a payment
// =============================================================================
// RBAC rules:
//   - ADMIN ONLY: can verify or reject payments
//   - All other roles: 403
//   - Drivers: 403 (explicitly forbidden from any payment access per master prompt)
//
// Customer notifications (the emails customers were promised):
//   - VERIFIED → the order moves to PAYMENT_VERIFIED and the customer is
//     emailed/SMS'd ("Payment confirmed — pickup scheduled"). This used to be
//     missing entirely: admin saw "Customer notified" while nothing was sent.
//   - REJECTED → the customer is emailed/SMS'd with what to check and what NOT
//     to do (never pay twice — call us if debited).
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { UpdatePaymentSchema } from '@/lib/schemas'
import { notifyOrderStatus, notifyPaymentRejected } from '@/lib/notifications'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // requireRole throws a 401 if no session, 403 if wrong role
  const session = await requireRole('ADMIN')

  const { id } = await params

  const payment = await db.payment.findUnique({
    where: { id },
    include: { order: true },
  })
  if (!payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }

  const body = await req.json()
  const parsed = UpdatePaymentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { status } = parsed.data

  const updateData: any = { status }
  if (status === 'VERIFIED') {
    updateData.verifiedAt = new Date()
    updateData.verifiedById = session.user?.id
  }

  const updated = await db.payment.update({
    where: { id },
    data: updateData,
  })

  // If payment is verified, move the order to PAYMENT_VERIFIED status
  if (status === 'VERIFIED' && payment.order) {
    const order = await db.order.update({
      where: { id: payment.orderId },
      data: { status: 'PAYMENT_VERIFIED' },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    })

    // Email the customer the confirmation they were promised at checkout
    // ("you'll get an email the moment it's verified"). notifyOrderStatus
    // never throws, so a notification failure can't break the update.
    await notifyOrderStatus(
      { ...order, totalPrice: order.totalPrice ?? payment.amount },
      'PAYMENT_VERIFIED'
    )
  }

  // If payment is rejected, tell the customer what to do next — this email
  // must land, otherwise a rejected transfer leaves them silently stuck.
  if (status === 'REJECTED' && payment.order) {
    const order = await db.order.findUnique({
      where: { id: payment.orderId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    })
    if (order) {
      await notifyPaymentRejected({
        ...order,
        totalPrice: order.totalPrice ?? payment.amount,
      })
    }
  }

  return NextResponse.json({ payment: updated })
}
