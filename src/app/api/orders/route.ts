// =============================================================================
// GET /api/orders — list orders (RBAC-filtered, cursor-paginated)
// POST /api/orders — create a new order (authed OR guest checkout)
// =============================================================================
// RBAC rules:
//   GET:
//     - ADMIN: sees all orders
//     - DRIVER: sees only orders where driverId === their own ID
//     - B2C/B2B: sees only orders where userId === their own ID
//   Pagination (GET):
//     - `?cursor=<id>&limit=<n>` — cursor-based, default limit 25, hard cap 100.
//     - Ordered by (createdAt DESC, id DESC) so the cursor is stable.
//     - Response shape: { items, nextCursor, ... } — nextCursor is null on the
//       last page. RBAC filters compose with the cursor exactly as before.
//   POST:
//     - Authenticated users create orders for themselves (userId is forced to
//       the session user's ID; ADMIN can optionally pass userId for someone else)
//     - GUESTS (no session): must pass `guest: { name, email, phone }`.
//       The server find-or-creates a customer record from those details:
//         * email unknown             -> create a B2C "guest account" with a
//                                        random password + emailVerified set
//                                        (the guest can set a real password via
//                                        the forgot-password flow to claim it)
//         * email exists w/o password -> reuse the earlier guest account
//         * email exists w/ password  -> 409 ACCOUNT_EXISTS (they should log in)
//     - `paymentMethod: BANK_TRANSFER` creates the Payment record atomically
//       with the order (works for guests too, who can't call /api/payments).
//       PAYSTACK payments are initialized separately after the order exists.
// =============================================================================

import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { CreateOrderSchema } from '@/lib/schemas'
import { notifyOrderCreated, notifyGuestAccountCreated } from '@/lib/notifications'
import { rateLimit, getClientIP } from '@/lib/rate-limit'
import { nearestZone, zoneFromAddress, haversineKm, GEO } from '@/lib/geo'
import { getServiceSpeed, allowsExpress24, GARMENT_CATALOG } from '@/lib/types'

// ----- GET /api/orders -----
export async function GET(req: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ----- Cursor pagination params -----
  const { searchParams } = new URL(req.url)
  const limitRaw = parseInt(searchParams.get('limit') ?? '', 10)
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 25, 1), 100)
  const cursor = searchParams.get('cursor') || undefined

  let where: any = {}

  if (session.user?.role === 'DRIVER') {
    // Drivers see only assigned orders
    where = { driverId: session.user?.id }
  } else if (session.user?.role === 'B2C' || session.user?.role === 'B2B') {
    // Customers see only their own orders
    where = { userId: session.user?.id }
  }
  // ADMIN sees all orders (no filter)

  // take limit+1 rows so we can tell whether another page exists
  let orders = await db.order.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, role: true } },
      driver: { select: { id: true, name: true, phone: true } },
      payments: true,
      media: true,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasMore = orders.length > limit
  if (hasMore) orders = orders.slice(0, limit)
  const nextCursor = hasMore ? orders[orders.length - 1].id : null

  // ----- Rider geofencing (DRIVER only) -----
  // Applied to the current PAGE (the query is already RBAC-filtered and
  // cursor-paginated; visibility is a per-order computation). hiddenCount is
  // therefore page-scoped.
  // With a fresh GPS ping on file, gate the rider's activity:
  //   - outside every service zone  -> order activity paused (empty page)
  //   - inside a zone               -> only stops within ORDER_VISIBILITY_RADIUS_KM
  // No ping / stale ping / lookup error -> legacy behaviour (no filtering),
  // so the feature can never brick the driver app.
  let geofence: Record<string, unknown> | undefined
  if (session.user?.role === 'DRIVER') {
    try {
      const loc = await db.driverLocation.findUnique({
        where: { driverId: session.user.id },
      })
      const fresh =
        loc && Date.now() - loc.updatedAt.getTime() < GEO.PING_STALE_MINUTES * 60 * 1000
      if (loc && fresh) {
        const nearest = nearestZone(loc.lat, loc.lng)
        const inArea = nearest.distanceKm <= nearest.zone.radiusKm + GEO.ZONE_BUFFER_KM
        if (!inArea) {
          geofence = {
            status: 'outside',
            zone: nearest.zone.name,
            distanceKm: Math.round(nearest.distanceKm * 10) / 10,
          }
          orders = [] // activity paused while outside all service areas
        } else {
          const visible = orders.filter((o) => {
            const zone = zoneFromAddress(o.pickupAddress)
            // Unknown addresses are always shown (never hide a stop we can't place)
            if (!zone) return true
            return (
              haversineKm(loc.lat, loc.lng, zone.lat, zone.lng) <=
              GEO.ORDER_VISIBILITY_RADIUS_KM
            )
          })
          geofence = {
            status: 'in',
            zone: nearest.zone.name,
            distanceKm: Math.round(nearest.distanceKm * 10) / 10,
            hiddenCount: orders.length - visible.length,
          }
          orders = visible
        }
      } else {
        geofence = { status: loc ? 'stale' : 'none' }
      }
    } catch {
      geofence = { status: 'error' } // degrade gracefully
    }
  }

  return NextResponse.json({ items: orders, nextCursor, ...(geofence ? { geofence } : {}) })
}

// ----- POST /api/orders -----
export async function POST(req: Request) {
  const session = await getSession()

  // ----- Guest checkout rate limit: 5 orders/hour per IP -----
  // (authed users are identified by their session — no extra limit needed)
  if (!session) {
    const ip = getClientIP(req)
    const limit = await rateLimit(`guest-order:${ip}`, { max: 5, windowMs: 60 * 60 * 1000 })
    if (!limit.success) {
      return NextResponse.json(
        { error: 'Too many bookings from this device. Please try again later or sign in.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } }
      )
    }
  }

  const body = await req.json()
  const parsed = CreateOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { type, items, serviceSpeed, pickupAddress, pickupDate, pickupTimeSlot, deliveryAddress, guest, paymentMethod } = parsed.data

  // ----- Guarantee integrity (aligns the server with the wizard's UX) -----
  // The Return-as-Received Guarantee (5% off + damage coverage) requires an
  // authenticated account in the booking flow — a guest cannot activate it.
  // Ignore the client flag for unauthenticated requests so the discount can
  // never be claimed by crafting a request. (Server-side pricing integrity,
  // same class of fix as unitPrice coming from PriceCatalog.)
  const guaranteeActive = session ? Boolean(parsed.data.guaranteeActive) : false

  // ----- Determine the order's owner (authed) or guest customer -----
  let ownerId: string | undefined
  let guestAccountCreated = false
  let guestEmail: string | null = null

  if (session) {
    // ADMIN can create orders for other users (by passing userId in the body)
    // Non-admins always create orders for themselves
    ownerId = session.user?.role === 'ADMIN' && body.userId ? body.userId : session.user?.id
  } else {
    // Guest checkout — contact details are mandatory
    if (!guest) {
      return NextResponse.json(
        { error: 'Guest bookings require a name, email and phone number.' },
        { status: 401 }
      )
    }
    const email = guest.email.toLowerCase()
    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      if (existing.passwordHash) {
        // Real account exists — they should sign in (prevents order hijacking)
        return NextResponse.json(
          {
            error: 'ACCOUNT_EXISTS',
            message: 'An account with this email already exists. Please sign in to book — your details will be waiting.',
          },
          { status: 409 }
        )
      }
      // Previous guest account (no password) — reuse and refresh contact info
      ownerId = existing.id
      await db.user.update({
        where: { id: existing.id },
        data: { name: guest.name, phone: guest.phone },
      })
    } else {
      // First-time guest — create a customer record with a random password.
      // emailVerified is set so the guest can claim the account via the
      // forgot-password flow without an extra verification round-trip.
      const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10)
      const guestUser = await db.user.create({
        data: {
          email,
          name: guest.name,
          phone: guest.phone,
          role: 'B2C',
          passwordHash,
          emailVerified: new Date(),
          signupDiscountUsed: false,
        },
      })
      ownerId = guestUser.id
      guestAccountCreated = true
      guestEmail = email
    }
  }

  // ownerId is always set by this point (session user, admin override, or the
  // guest find-or-create branches above) — the guard is for TypeScript.
  if (!ownerId) {
    return NextResponse.json({ error: 'Could not determine the order owner.' }, { status: 400 })
  }

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

  // ----- Service speed (turnaround tier) -----
  // KG / corporate orders always run on the standard SLA. For ITEM orders
  // the tier must be live (enabled) and the 24-hour tier is blocked for
  // bulky household items — they cannot honestly be finished in 24h.
  let speed = getServiceSpeed(type === 'ITEM' ? serviceSpeed : 'STANDARD')
  if (!speed.enabled) {
    speed = getServiceSpeed('STANDARD')
  }
  if (type === 'ITEM' && speed.id === 'EXPRESS_24') {
    const itemIds = items.map((i: any) => (i.id || '').replace('item_', ''))
    if (!allowsExpress24(itemIds)) {
      return NextResponse.json(
        {
          error: 'EXPRESS_24_UNAVAILABLE',
          message: '24-hour express is not available for bulky home items (duvets, curtains, bedsheets). Please choose Standard or Express 48.',
        },
        { status: 400 }
      )
    }
  }

  if (type === 'ITEM') {
    // Look up prices from PriceCatalog (Item 3 — server-side price validation)
    const itemKeys = items.map((i: any) => (i.id || '').replace('item_', '') || i.name)
    const catalogEntries = await db.priceCatalog.findMany({
      where: { itemKey: { in: itemKeys }, active: true },
    })
    const catalogMap = new Map(catalogEntries.map(c => [c.itemKey, c]))

    // Compute subtotal from server-side catalog prices — client-supplied unitPrice is IGNORED
    let subtotal = 0
    const pricedItems = items.map((i: any) => {
      const key = (i.id || '').replace('item_', '') || i.name
      const catalog = catalogMap.get(key)
      const unitPrice = catalog?.unitPrice ?? 0 // 0 if not found in catalog
      subtotal += unitPrice * i.quantity
      // Quoted items (wedding dress, couture) carry no fixed price until the
      // assessment quote is approved — annotate the stored manifest so admin
      // sees "quote to follow" instead of a bare ₦0 line and knows to send
      // the customer a quote after assessment.
      const isQuote = GARMENT_CATALOG.find((g) => g.id === key)?.pricingMode === 'quote'
      return {
        ...i,
        unitPrice,
        ...(isQuote ? { name: `${i.name} — quote to follow` } : {}),
      }
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

    // Express surcharge on the item subtotal, then percentage discounts apply
    // to the combined service charge (item cleaning + express premium)
    const expressSurcharge = Math.round(subtotal * speed.surcharge)
    if (expressSurcharge > 0) {
      appliedDiscounts.push(`${speed.label} surcharge (+${Math.round(speed.surcharge * 100)}%)`)
    }

    totalPrice = Math.round((subtotal + expressSurcharge) * (1 - Math.min(totalDiscount, 0.95)))
    // Update items with server-side prices for storage
    items.length = 0
    items.push(...pricedItems)
  }
  // KG orders: totalPrice is undefined until admin weighs at station

  // ----- Create the order (+ bank-transfer payment record atomically) -----
  // BANK_TRANSFER: create a PENDING payment now and move the order straight
  // to PAYMENT_PENDING_VERIFICATION — one atomic request, works for guests.
  // PAYSTACK: no payment record here; the client initializes the transaction
  // separately (POST /api/paystack/initialize) which creates it.
  const bankTransferAmount =
    type === 'ITEM' && paymentMethod === 'BANK_TRANSFER' && totalPrice && totalPrice > 0
      ? totalPrice
      : null

  const order = await db.order.create({
    data: {
      orderNumber,
      userId: ownerId,
      status: bankTransferAmount !== null ? 'PAYMENT_PENDING_VERIFICATION' : 'REQUESTED',
      type,
      guaranteeActive,
      serviceSpeed: speed.id,
      itemsManifest: JSON.stringify(items),
      totalPrice,
      pickupAddress,
      pickupDate: new Date(pickupDate),
      pickupTimeSlot,
      deliveryAddress: deliveryAddress || null,
      ...(bankTransferAmount !== null
        ? {
            payments: {
              create: {
                amount: bankTransferAmount,
                method: 'BANK_TRANSFER',
                status: 'PENDING',
              },
            },
          }
        : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, role: true } },
      driver: { select: { id: true, name: true, phone: true } },
      payments: true,
      media: true,
    },
  })

  // ----- Notifications (email + SMS) — never block the booking -----
  // Runs after the DB write so a notification failure can't lose the order.
  if (guestAccountCreated && guestEmail) {
    await notifyGuestAccountCreated(order, guestEmail)
  } else {
    await notifyOrderCreated(order)
  }

  return NextResponse.json({ order, guestAccountCreated }, { status: 201 })
}
