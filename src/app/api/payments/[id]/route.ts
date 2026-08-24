// =============================================================================
// PATCH /api/payments/[id] — verify or reject a payment
// =============================================================================
// RBAC rules:
//   - ADMIN ONLY: can verify or reject payments
//   - All other roles: 403
//   - Drivers: 403 (explicitly forbidden from any payment access per master prompt)
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { UpdatePaymentSchema } from '@/lib/schemas'

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
    await db.order.update({
      where: { id: payment.orderId },
      data: { status: 'PAYMENT_VERIFIED' },
    })
  }

  return NextResponse.json({ payment: updated })
}
