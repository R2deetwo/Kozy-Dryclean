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

import { NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { getSession, requireSession } from '@/lib/auth'
import { UpdateOrderSchema } from '@/lib/schemas'
import { notifyOrderStatus, notifyInvoiceReady } from '@/lib/notifications'
import { getAppSettings } from '@/lib/app-settings'
import { zoneFromAddress, haversineKm, GEO } from '@/lib/geo'

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

    // ----- Geofence guard -----
    // A rider with a fresh GPS ping on file cannot confirm a pickup/delivery
    // while they are far from the stop's service zone. Generous margin
    // (ACTION_MAX_DISTANCE_KM) so normal GPS drift never blocks real work.
    // No ping / stale ping / lookup error -> guard skipped (feature is additive).
    if (parsed.data.status) {
      try {
        const loc = await db.driverLocation.findUnique({
          where: { driverId: session.user.id },
        })
        const fresh =
          loc && Date.now() - loc.updatedAt.getTime() < GEO.PING_STALE_MINUTES * 60 * 1000
        if (loc && fresh) {
          const zone = zoneFromAddress(order.pickupAddress)
          if (zone) {
            const distanceKm = haversineKm(loc.lat, loc.lng, zone.lat, zone.lng)
            if (distanceKm > GEO.ACTION_MAX_DISTANCE_KM) {
              return NextResponse.json(
                {
                  error: 'GEOFENCE_TOO_FAR',
                  message: `You're about ${Math.round(distanceKm)} km from this stop's area (${zone.name}). Move within ${GEO.ACTION_MAX_DISTANCE_KM} km to confirm.`,
                },
                { status: 403 }
              )
            }
          }
        }
      } catch {
        // Geofence table unavailable — skip the guard
      }
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
    // Auto-calculate totalPrice for KG orders when weight is set — priced
    // with the server-side per-kg settings the admin edits in Settings →
    // Pricing (previously hardcoded ₦800/10kg here, so admin price edits
    // never reached the invoice the customer received).
    const settings = await getAppSettings()
    const billableKg = Math.max(parsed.data.finalWeight ?? 0, settings.minimumKg)
    updateData.totalPrice = billableKg * settings.pricePerKg
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

  // ----- Consistency guard (admin status -> PAYMENT_VERIFIED) -----
  // When the admin moves an order to PAYMENT_VERIFIED via the dropdown or a
  // drag, any PENDING/REJECTED bank-transfer payment on it is auto-verified.
  // Without this, the order says "paid" while the payment queue still flags
  // the receipt — the exact ghost state that confused the pipeline before
  // (real-world case: an order at PAYMENT_VERIFIED whose receipt was still
  // marked REJECTED).
  if (
    parsed.data.status === 'PAYMENT_VERIFIED' &&
    session.user?.role === 'ADMIN' &&
    order.status !== 'PAYMENT_VERIFIED'
  ) {
    const unverified = (updated.payments ?? []).filter(
      (p: any) => p.method === 'BANK_TRANSFER' && p.status !== 'VERIFIED'
    )
    if (unverified.length > 0) {
      await db.payment.updateMany({
        where: { id: { in: unverified.map((p: any) => p.id) } },
        data: {
          status: 'VERIFIED',
          verifiedAt: new Date(),
          verifiedById: session.user?.id,
        },
      })
      const fresh = await db.order.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true, role: true } },
          driver: { select: { id: true, name: true, phone: true } },
          payments: true,
          media: true,
        },
      })
      if (fresh) Object.assign(updated, fresh)
    }
  }

  // Log the status change as a StatusEvent
  if (parsed.data.status) {
    await db.statusEvent.create({
      data: {
        orderId: id,
        status: parsed.data.status,
        actorId: session.user?.id,
      },
    })

    // Email + SMS the customer about the status change — after the response
    // so the admin's dropdown/drag feels instant (email providers take
    // seconds). notifyOrderStatus never throws, so it can't break the update.
    if (parsed.data.status !== order.status) {
      after(async () => {
        try {
          await notifyOrderStatus(updated, parsed.data.status!)
        } catch (e) {
          console.error('Status-change notification failed:', e)
        }
      })
    }
  }

  // ----- Bulk invoice email (admin recorded the weight) -----
  // The order modal has always toasted "Weight recorded — invoice sent";
  // now the email/SMS genuinely goes out, priced with the live per-kg
  // settings. Only fires the FIRST time a weight is recorded on a KG order
  // (re-weighing updates the total silently unless it is also the first).
  if (
    parsed.data.finalWeight !== undefined &&
    order.type === 'KG' &&
    order.finalWeight === null &&
    updated.totalPrice
  ) {
    const settings = await getAppSettings()
    const billableKg = Math.max(parsed.data.finalWeight ?? 0, settings.minimumKg)
    const invoiceTotal = updated.totalPrice ?? billableKg * settings.pricePerKg
    after(async () => {
      try {
        await notifyInvoiceReady(updated, billableKg, invoiceTotal)
      } catch (e) {
        console.error('Invoice-ready notification failed:', e)
      }
    })
  }

  return NextResponse.json({ order: updated })
}
