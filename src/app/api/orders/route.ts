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

  // Generate human-readable order number — timestamp + random for uniqueness (Item 5)
  const orderNumber = `KZ-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`

  // Calculate total price for ITEM orders — SERVER-SIDE PRICING ONLY
  let totalPrice: number | undefined
  let appliedDiscounts: string[] = []
  if (type === 'ITEM') {
    // Look up prices from PriceCatalog (Item 3 — server-side price validation)
    const itemKeys = items.map((i: any) => (i.id || '').replace('item_', '') || i.name)
    const catalogEntries = await db.priceCatalog.findMany({
      where: { itemKey: { in: itemKeys }, active: true }
    })
    const catalogMap = new Map(catalogEntries.map(c => [c.itemKey, c]))

    // Compute subtotal from server-side catalog prices — client-supplied unitPrice is IGNORED
    let subtotal = 0
    const pricedItems = items.map((i: any) => {
      const key = (i.id || '').replace('item_', '') || i.name
      const catalog = catalogMap.get(key)
      const unitPrice = catalog?.unitPrice ?? 0 // 0 if not found in catalog
      subtotal += unitPrice * i.quantity
      return { ...i, unitPrice } // override with server-side price
    })

    let totalDiscount = 0

    // Apply guarantee discount if active (5%)
    if (guaranteeActive) {
      totalDiscount += 0.05
      appliedDiscounts.push('Return-as-Received Guarantee (5%)')
    }

    // Apply signup discount — Item 4 fix: only mark as used if discount was actually applied
    if (owner.signupDiscountUsed === false) {
      const signupDiscount = await db.discount.findFirst({
        where: { appliesTo: 'SIGNUP', active: true }
      })
      if (signupDiscount && signupDiscount.type === 'PERCENTAGE') {
        totalDiscount += signupDiscount.value / 100
        appliedDiscounts.push(`Signup discount (${signupDiscount.value}%)`)
        // Item 4 fix: only mark as used INSIDE the if-branch
        await db.user.update({
          where: { id: ownerId },
          data: { signupDiscountUsed: true }
        })
      }
      // If signupDiscount is null or inactive, signupDiscountUsed stays false
    }

    totalPrice = Math.round(subtotal * (1 - Math.min(totalDiscount, 0.95)))
    // Update items with server-side prices for storage
    items.length = 0
    items.push(...pricedItems)
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
