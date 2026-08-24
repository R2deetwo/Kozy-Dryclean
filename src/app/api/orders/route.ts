// =============================================================================
// GET /api/orders — list orders (RBAC-filtered)
// POST /api/orders — create a new order
// =============================================================================
// RBAC rules:
//   GET:
//     - ADMIN: sees all orders
//     - DRIVER: sees only orders where driverId === their own ID
//     - B2C/B2B: sees only orders where userId === their own ID
//   POST:
//     - Any authenticated user can create an order
//     - The order's userId is forced to the session user's ID (cannot create
//       orders for other users without ADMIN role)
//     - ADMIN can optionally create orders for other users by passing userId
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, requireSession } from '@/lib/auth'
import { CreateOrderSchema } from '@/lib/schemas'

// ----- GET /api/orders -----
export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let where: any = {}

  if (session.user?.role === 'DRIVER') {
    // Drivers see only assigned orders
    where = { driverId: session.user?.id }
  } else if (session.user?.role === 'B2C' || session.user?.role === 'B2B') {
    // Customers see only their own orders
    where = { userId: session.user?.id }
  }
  // ADMIN sees all orders (no filter)

  const orders = await db.order.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, role: true } },
      driver: { select: { id: true, name: true, phone: true } },
      payments: true,
      media: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ orders })
}

// ----- POST /api/orders -----
export async function POST(req: Request) {
  const session = await requireSession()

  const body = await req.json()
  const parsed = CreateOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { type, items, guaranteeActive, pickupAddress, pickupDate, pickupTimeSlot, deliveryAddress } = parsed.data

  // Determine the order's owner
  // ADMIN can create orders for other users (by passing userId in the body)
  // Non-admins always create orders for themselves
  const ownerId = session.user?.role === 'ADMIN' && body.userId ? body.userId : session.user?.id

  // Verify the owner exists
  const owner = await db.user.findUnique({ where: { id: ownerId } })
  if (!owner) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Generate human-readable order number (KZ-####)
  const count = await db.order.count()
  const orderNumber = `KZ-${1000 + count + 1}`

  // Calculate total price for ITEM orders
  let totalPrice: number | undefined
  if (type === 'ITEM') {
    const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
    // Apply guarantee discount if active (5% default — will be dynamic from settings in future)
    const discount = guaranteeActive ? 0.05 : 0
    totalPrice = Math.round(subtotal * (1 - discount))
  }
  // KG orders: totalPrice is undefined until admin weighs at station

  const order = await db.order.create({
    data: {
      orderNumber,
      userId: ownerId,
      status: 'REQUESTED',
      type,
      guaranteeActive,
      itemsManifest: JSON.stringify(items),
      totalPrice,
      pickupAddress,
      pickupDate: new Date(pickupDate),
      pickupTimeSlot,
      deliveryAddress: deliveryAddress || null,
    },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, role: true } },
      driver: { select: { id: true, name: true, phone: true } },
      payments: true,
      media: true,
    },
  })

  return NextResponse.json({ order }, { status: 201 })
}
