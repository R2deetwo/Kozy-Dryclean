// =============================================================================
// GET /api/orders/[id] — get a single order by ID
// PATCH /api/orders/[id] — update an order's status/driver/weight
// =============================================================================
// RBAC rules:
//   GET:
//     - ADMIN: can view any order
//     - DRIVER: can view only orders assigned to them (driverId === session.user?.id)
//     - B2C/B2B: can view only their own orders (userId === session.user?.id)
//   PATCH:
//     - ADMIN: can change anything (status, driverId, finalWeight, totalPrice)
//     - DRIVER: can change ONLY the status, and ONLY to 'PICKED_UP' or 'DELIVERED',
//               and ONLY on orders assigned to them (driverId === session.user?.id)
//     - B2C/B2B: cannot PATCH orders at all (403)
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, requireSession } from '@/lib/auth'
import { UpdateOrderSchema } from '@/lib/schemas'

// ----- GET /api/orders/[id] -----
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const order = await db.order.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, role: true, address: true } },
      driver: { select: { id: true, name: true, phone: true } },
      payments: true,
      media: true,
      statusEvents: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // RBAC: check ownership/assignment
  if (session.user?.role === 'B2C' || session.user?.role === 'B2B') {
    if (order.userId !== session.user?.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (session.user?.role === 'DRIVER') {
    if (order.driverId !== session.user?.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }
  // ADMIN: no restriction

  return NextResponse.json({ order })
}

// ----- PATCH /api/orders/[id] -----
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()

  const { id } = await params

  const order = await db.order.findUnique({ where: { id } })
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const body = await req.json()
  const parsed = UpdateOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // ----- RBAC enforcement -----
  if (session.user?.role === 'B2C' || session.user?.role === 'B2B') {
    // Customers cannot modify orders at all
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (session.user?.role === 'DRIVER') {
    // Drivers can only update status on orders assigned to them
    if (order.driverId !== session.user?.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    // Drivers can only set status to PICKED_UP or DELIVERED
    const allowedStatuses = ['PICKED_UP', 'DELIVERED']
    if (parsed.data.status && !allowedStatuses.includes(parsed.data.status)) {
      return NextResponse.json(
        { error: 'Drivers can only set status to PICKED_UP or DELIVERED' },
        { status: 403 }
      )
    }
    // Drivers cannot change driverId, finalWeight, or totalPrice
    if (parsed.data.driverId !== undefined || parsed.data.finalWeight !== undefined || parsed.data.totalPrice !== undefined) {
      return NextResponse.json(
        { error: 'Drivers cannot modify driver assignment, weight, or price' },
        { status: 403 }
      )
    }
  }
  // ADMIN: can change anything — no restriction

  // ----- Apply the update -----
  const updateData: any = {}
  if (parsed.data.status !== undefined) {
    updateData.status = parsed.data.status

    // Auto-set timestamp fields when status changes
    if (parsed.data.status === 'PICKED_UP' && !order.pickedUpAt) updateData.pickedUpAt = new Date()
    if (parsed.data.status === 'AT_STATION' && !order.atStationAt) updateData.atStationAt = new Date()
    if (parsed.data.status === 'PROCESSING' && !order.processingAt) updateData.processingAt = new Date()
    if (parsed.data.status === 'FINISHING' && !order.finishingAt) updateData.finishingAt = new Date()
    if (parsed.data.status === 'OUT_FOR_DELIVERY' && !order.outForDeliveryAt) updateData.outForDeliveryAt = new Date()
    if (parsed.data.status === 'DELIVERED' && !order.deliveredAt) {
      updateData.deliveredAt = new Date()
      if (!order.deliveryDate) updateData.deliveryDate = new Date()
    }
  }
  if (parsed.data.driverId !== undefined) updateData.driverId = parsed.data.driverId
  if (parsed.data.finalWeight !== undefined) {
    updateData.finalWeight = parsed.data.finalWeight
    // Auto-calculate totalPrice for KG orders when weight is set
    const pricePerKg = 800 // will be dynamic from settings in future
    const minimumKg = 10
    const billableKg = Math.max(parsed.data.finalWeight ?? 0, minimumKg)
    updateData.totalPrice = billableKg * pricePerKg
  }
  if (parsed.data.totalPrice !== undefined) updateData.totalPrice = parsed.data.totalPrice

  const updated = await db.order.update({
    where: { id },
    data: updateData,
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, role: true } },
      driver: { select: { id: true, name: true, phone: true } },
      payments: true,
      media: true,
    },
  })

  // Log the status change as a StatusEvent
  if (parsed.data.status) {
    await db.statusEvent.create({
      data: {
        orderId: id,
        status: parsed.data.status,
        actorId: session.user?.id,
      },
    })
  }

  return NextResponse.json({ order: updated })
}
