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

import { NextResponse, after } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { getSession, verifyLiveAccess } from '@/lib/auth'
import { CreateOrderSchema } from '@/lib/schemas'
import { MAX_CONDITION_PHOTOS, scheduleMediaPurge } from '@/lib/media'
import {
  notifyOrderCreated,
  notifyGuestAccountCreated,
  notifyTransferPendingVerification,
  notifyAdminNewOrder,
  notifyAdminTransferPending,
} from '@/lib/notifications'
import { rateLimit, getClientIP } from '@/lib/rate-limit'
import { nearestZone, zoneFromAddress, haversineKm, GEO } from '@/lib/geo'
import { getServiceSpeed, allowsExpress24, GARMENT_CATALOG, GUARANTEE_DISCOUNT } from '@/lib/types'
import { getAppSettings } from '@/lib/app-settings'
import {
  checkCouponEligibility,
  computeCouponAmount,
  type CouponRecord,
} from '@/lib/marketing'
import { checkReferralEligibility, recordReferralRedemption } from '@/lib/referrals'
import { getLoyaltyState } from '@/lib/loyalty'
import { assignBranchForAddress } from '@/lib/branches'
import { availableOrdersForDriver, dispatchNewOrder, escalateUnclaimedOrders } from '@/lib/rider-dispatch'
import { effectiveStatus } from '@/lib/subscriptions'

// Positive-integer env override with a safe default (phase-29): lets the
// owner retune the booking rate limits from Vercel's dashboard without a
// code change. Blank, non-numeric, or <= 0 values all fall back.
function envInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

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

  // ----- Staff live-access check (phase 31) -----
  // Console roles (ADMIN/STAFF) get their DB status re-checked so a pause or
  // revoke bites within ~60s even mid-session. Drivers/customers skip it.
  if (session.user?.role === 'ADMIN' || session.user?.role === 'STAFF') {
    const blocked = await verifyLiveAccess(session)
    if (blocked) {
      return new NextResponse(blocked.body, {
        status: blocked.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  let where: any = {}

  if (session.user?.role === 'DRIVER') {
    // Drivers see only assigned orders
    where = { driverId: session.user?.id }
  } else if (session.user?.role === 'B2C' || session.user?.role === 'B2B') {
    // Customers see only their own orders
    where = { userId: session.user?.id }
  }
  // ADMIN and STAFF see all orders (no filter) — the ops board

  // take limit+1 rows so we can tell whether another page exists
  let orders = await db.order.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, role: true } },
      driver: { select: { id: true, name: true, phone: true } },
      payments: true,
      // Phase 51: the list payload carries a COUNT, never the photo bytes —
      // a 30-photo order used to ship ~5MB of data URLs to every board load
      // (and to the customer portal). Full media is fetched on demand by the
      // order detail modal via GET /api/orders/[id].
      media: { select: { id: true } },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasMore = orders.length > limit
  if (hasMore) orders = orders.slice(0, limit)
  const nextCursor = hasMore ? orders[orders.length - 1].id : null

  // Count-only media on every list row (see the include comment above).
  for (const o of orders as any[]) {
    o.mediaCount = Array.isArray(o.media) ? o.media.length : 0
    delete o.media
  }

  // Throttled retention sweep piggy-backs on board/portal traffic (the
  // daily cron is the backstop on quiet days).
  scheduleMediaPurge()

  // Phase 32: odd-movement flags for the kanban (ADMIN only — staff
  // payloads never carry anomaly rows; the client's directive). One grouped
  // query per page keeps this cheap.
  if (session.user?.role === 'ADMIN' && orders.length > 0) {
    const anomalyRows = await db.orderAnomaly.findMany({
      where: { orderId: { in: orders.map((o) => o.id) } },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { id: true, name: true, email: true } } },
    })
    const byOrder = new Map<string, any[]>()
    for (const row of anomalyRows) {
      const list = byOrder.get(row.orderId) ?? []
      list.push(row)
      byOrder.set(row.orderId, list)
    }
    for (const o of orders as any[]) {
      o.anomalies = byOrder.get(o.id) ?? []
    }
  }

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

  // ----- Dispatch (phase 69) -----
  // (a) RIDER available pool: unclaimed pickups the rider can claim — the
  //     broadcast & claim lane. Queried by the rider app alongside the route.
  if (session.user?.role === 'DRIVER' && searchParams.get('available') === '1') {
    const me = await db.user.findUnique({
      where: { id: session.user.id },
      select: { branchId: true },
    })
    const available = await availableOrdersForDriver(me?.branchId)
    return NextResponse.json({ items: available })
  }

  // (b) Console board loads (ADMIN/STAFF) drive the escalation ladder —
  //     an unclaimed order aging past 5/10/15 minutes raises admin events.
  //     Throttled internally to one scan per minute.
  if (session.user?.role === 'ADMIN' || session.user?.role === 'STAFF') {
    escalateUnclaimedOrders().catch(() => {})
  }

  return NextResponse.json({ items: orders, nextCursor, ...(geofence ? { geofence } : {}) })
}

// ----- POST /api/orders -----
export async function POST(req: Request) {
  const session = await getSession()

  // ----- Booking rate limits (phase-29: raised + env-tunable) -----
  // CGNAT reality: Nigerian mobile carriers (MTN, Airtel, Glo, 9mobile)
  // put thousands of subscribers behind ONE shared public IP, so a tight
  // per-IP guest cap blocks REAL customers, not just bots — exactly what
  // happened to the owner testing on a phone ("booking failed — too many
  // bookings from this device"). Defaults are now 20/hour (guest, per IP)
  // and 30/hour (authed, per user), overridable without a redeploy via
  // RATE_LIMIT_GUEST_BOOKINGS_PER_HOUR / RATE_LIMIT_USER_BOOKINGS_PER_HOUR.
  // Abuse is still structurally capped: every order costs a duplicate-guard
  // check + several emails, and the alert pipeline's stage-dedup keeps the
  // owner's inbox from re-sending on back-and-forth status moves.

  // ----- Staff cannot place customer orders (phase 31) -----
  // Staff accounts exist to RUN operations, not to buy laundry. A staff
  // member browsing the public site should book with their personal
  // customer account — mixing staff bookings into the console would pollute
  // the pipeline and apply the staff online-discount logic to the wrong
  // role family.
  if (session?.user?.role === 'STAFF') {
    return NextResponse.json(
      {
        error: 'FORBIDDEN_STAFF_BOOKING',
        message:
          'Staff accounts cannot place orders. Please use a customer account to book, or sign out.',
      },
      { status: 403 }
    )
  }

  const minutesLeft = (resetAt: number) =>
    Math.max(1, Math.ceil((resetAt - Date.now()) / 60_000))
  if (!session) {
    const ip = getClientIP(req)
    const limit = await rateLimit(`guest-order:${ip}`, {
      max: envInt('RATE_LIMIT_GUEST_BOOKINGS_PER_HOUR', 20),
      windowMs: 60 * 60 * 1000,
    })
    if (!limit.success) {
      return NextResponse.json(
        {
          error: 'RATE_LIMITED',
          message: `You have placed several bookings from this device in the last hour. Please try again in about ${minutesLeft(limit.resetAt)} minutes, or sign in to book straight away — nothing was booked and nothing was charged.`,
        },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } }
      )
    }
  } else if (session.user?.role !== 'ADMIN') {
    // ----- Authed rate limit: 30 orders/hour per user -----
    // ADMIN (the owner) is exempt: they stage-test bookings constantly while
    // running the business, and being locked out of their own site is worse
    // than the marginal abuse surface (a compromised admin can email-bomb
    // regardless of an order cap — that is an account-security problem).
    // Session identity is NOT a trust boundary against a compromised or
    // angry account: every order fires customer + owner alert emails, so an
    // unbounded loop would email-bomb the owner's inbox and burn the Brevo
    // quota (audit finding).
    const limit = await rateLimit(`user-order:${session.user?.id}`, {
      max: envInt('RATE_LIMIT_USER_BOOKINGS_PER_HOUR', 30),
      windowMs: 60 * 60 * 1000,
    })
    if (!limit.success) {
      return NextResponse.json(
        {
          error: 'RATE_LIMITED',
          message: `That is a lot of bookings in one hour — please try again in about ${minutesLeft(limit.resetAt)} minutes, or call us and we will be happy to place the order for you. Nothing was booked and nothing was charged.`,
        },
        { status: 429 }
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

  const { type, items, serviceSpeed, modeOfWash, promoCode, alterationNotes, pickupAddress, pickupDate, pickupTimeSlot, deliveryAddress, guest, paymentMethod, transferReceipt, conditionPhotos, stagedToken, stagedPhotoIds } = parsed.data

  // ----- Alterations note (Phase 17, client directive) -----
  // Riders never measure at the door: the customer DESCRIBES the work at
  // booking and the in-house seamstress works from that note. Any ITEM
  // order containing an alterations item must therefore carry a note of at
  // least 10 characters — the wizard collects it with a guided panel.
  const hasAlterationItems =
    type === 'ITEM' &&
    items.some((i: any) => (i.id || '').replace('item_', '') === 'alteration')
  if (hasAlterationItems && (!alterationNotes || alterationNotes.trim().length < 10)) {
    return NextResponse.json(
      {
        error: 'ALTERATION_NOTES_REQUIRED',
        message: 'Please describe the alteration work (what should change on which garment) — our seamstress works from your note and will call you to confirm before quoting.',
      },
      { status: 400 }
    )
  }

  // ----- Mode of wash (client-requested order-form option) -----
  // Retail orders must carry an explicit choice — the wizard makes it a
  // required field. KG/corporate orders skip it (washed by weight).
  if (type === 'ITEM' && !modeOfWash) {
    return NextResponse.json(
      { error: 'MODE_OF_WASH_REQUIRED', message: 'Please choose a mode of wash (handwash or machine wash) for your order.' },
      { status: 400 }
    )
  }

  // ----- Guarantee integrity (aligns the server with the wizard's UX) -----
  // The Return-as-Received Guarantee (5% off + damage coverage) requires an
  // authenticated account in the booking flow — a guest cannot activate it.
  // Ignore the client flag for unauthenticated requests so the discount can
  // never be claimed by crafting a request. (Server-side pricing integrity,
  // same class of fix as unitPrice coming from PriceCatalog.)
  //
  // Phase 51: the guarantee also requires EVIDENCE — the flag is only
  // honored when the order actually carries at least one condition photo
  // (staged or legacy inline). A crafted guaranteeActive=true with no
  // photos would otherwise sell the 5% discount with nothing on file.

  // ----- Staged condition photos (phase 51) -----
  // The wizard uploads each compressed photo to /api/media/stage as it is
  // selected (30-photo baskets would breach the serverless request-size
  // limit in one body); the order POST claims those rows HERE — token-scoped
  // so only the client that staged them can attach them — and moves them
  // into GarmentMedia below. Legacy cached bundles may still send inline
  // conditionPhotos; both paths feed the same rows, combined cap 30.
  const claimedStaged =
    stagedPhotoIds && stagedPhotoIds.length > 0 && stagedToken
      ? await db.stagedPhoto.findMany({
          where: { id: { in: stagedPhotoIds }, token: stagedToken },
          select: { id: true, data: true },
        })
      : []
  const stagedPhotoUrls = claimedStaged.map((r) => r.data)
  const legacyPhotoUrls = (conditionPhotos ?? []).slice(
    0,
    Math.max(0, MAX_CONDITION_PHOTOS - stagedPhotoUrls.length)
  )
  const allPhotoUrls = [...stagedPhotoUrls, ...legacyPhotoUrls]

  const guaranteeActive = session
    ? Boolean(parsed.data.guaranteeActive) && allPhotoUrls.length > 0
    : false

  // ----- Determine the order's owner (authed) or guest customer -----
  let ownerId: string | undefined
  let guestAccountCreated = false
  let guestEmail: string | null = null

  // Set when a guest re-books with an email that already has a password.
  // We no longer reject immediately: pricing + the duplicate-submission guard
  // run first, so a confused customer RE-SUBMITTING the same transfer order
  // gets their original order back (and lands on /payment/pending) instead of
  // a dead-end "sign in" error. Only a genuinely new basket from that email
  // gets the ACCOUNT_EXISTS prompt, exactly as before.
  let existingAccountNeedsSignIn = false

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
      ownerId = existing.id
      if (existing.passwordHash) {
        // Account with a password exists — hold the sign-in requirement until
        // the duplicate guard has had its chance (see comment above).
        existingAccountNeedsSignIn = true
      } else {
        // Previous guest account (no password) — reuse and refresh contact info
        await db.user.update({
          where: { id: existing.id },
          data: { name: guest.name, phone: guest.phone },
        })
      }
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
  // Phase 36: the coupon actually applied (if any) — recorded in
  // DiscountUsage after the order is created. Lives out here because the
  // usage trail is written after order creation, outside the pricing block.
  let appliedCoupon: (CouponRecord & { amount: number }) | null = null
  // Phase 52: the referral code actually applied (if any) — a friend's
  // FIRST order redeemed with another customer's personal code. Recorded in
  // ReferralRedemption after the order is created (own table — never the
  // admin discount console, never DiscountUsage).
  let appliedReferral: { codeId: string; amount: number; referrerName: string } | null = null
  // Phase 52: the referrer's thank-you credit being spent on THIS order.
  // Computed during pricing, but only decremented after the order is
  // actually created (the duplicate-submission guard returns early and must
  // never double-spend the balance).
  let pendingReferralCredit = 0
  // Phase-14 order attributes (mode of wash, promo code, delivery fee) —
  // filled in by the ITEM pricing block below.
  const orderExtras: { deliveryFee?: number; modeOfWash?: string | null; promoCode?: string | null } = {}
  // Phase 53: set inside the ITEM pricing block when this order is the
  // customer's earned complimentary service (their next after ten paid
  // washes) — the order is created with loyaltyFree and a zero total.
  let loyaltyFreeOrder = false
  // Phase 62: the owner's live Kozy Circle membership — filled in by the
  // ITEM pricing block (free delivery + member discount) and linked on the
  // created order for the member's history.
  let membershipLive: any = null

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

    // ----- Server-managed commercial settings (AppSetting) -----
    // Delivery fee, handwash surcharge, offer percentages and guarantee
    // thresholds all come from the DB so admin edits reach every customer.
    const appSettings = await getAppSettings()

    // ----- Guarantee eligibility (client-requested transparency) -----
    // An order qualifies for the Return-as-Received Guarantee when it has
    // at least N garments OR meets the minimum order value (either counts).
    // Photos + acknowledgement are still required in the wizard; this check
    // prevents a single-₦500-shirt order claiming guarantee coverage.
    if (guaranteeActive) {
      const garmentCount = pricedItems.reduce((s: number, i: any) => s + (i.quantity || 0), 0)
      const eligible =
        garmentCount >= appSettings.guaranteeMinGarments ||
        subtotal >= appSettings.guaranteeMinOrderValue
      if (!eligible) {
        return NextResponse.json(
          {
            error: 'GUARANTEE_NOT_ELIGIBLE',
            message: `The Return-as-Received Guarantee covers orders of at least ${appSettings.guaranteeMinGarments} garments or ${appSettings.guaranteeMinOrderValue.toLocaleString('en-NG')} naira. Please continue without the guarantee or add to your basket.`,
          },
          { status: 400 }
        )
      }
    }

    // ----- Handwash surcharge + express premium (hoisted: the coupon rules
    // and the final total both need the full SERVICE charge) -----
    // Handwash is per-garment labour-intensive care: +50% of the item
    // cleaning subtotal (admin-tunable). Machine wash is standard — no fee.
    // Express surcharge on the item subtotal; percentage discounts apply to
    // the combined service charge (item cleaning + express premium).
    const handwashSurcharge =
      modeOfWash === 'HANDWASH'
        ? Math.round(subtotal * (appSettings.handwashSurchargePercent / 100))
        : 0
    if (handwashSurcharge > 0) {
      appliedDiscounts.push(`Handwash care (+${appSettings.handwashSurchargePercent}% of cleaning)`)
    }
    const expressSurcharge = Math.round(subtotal * speed.surcharge)
    if (expressSurcharge > 0) {
      appliedDiscounts.push(`${speed.label} surcharge (+${Math.round(speed.surcharge * 100)}%)`)
    }
    const serviceTotal = subtotal + handwashSurcharge + expressSurcharge

    let totalDiscount = 0

    // Apply guarantee discount if active (5% photo-upload discount — kept
    // separate from the first-order offer so the two stack)
    if (guaranteeActive) {
      totalDiscount += GUARANTEE_DISCOUNT
      appliedDiscounts.push('Return-as-Received photo discount (5%)')
    }

    // ----- Coupon / offer code (phase 36: unified engine) -----
    // One code path for every promo code, first order or not:
    //   - First-order codes (hotel/corporate offer) still REPLACE the
    //     standard signup discount and consume the first-order benefit.
    //   - General coupons (ALL/B2C/B2B, any order) now also work.
    //   - Every coupon is rule-checked (active, dates, segment, minimum
    //     basket, usage limits) with the SAME functions the live "Apply
    //     code" preview uses (src/lib/marketing.ts) — preview and checkout
    //     can never disagree.
    //   - PERCENTAGE coupons honour the optional ₦ cap; FIXED coupons
    //     subtract a flat amount. Both are applied to the service charge
    //     (delivery fees are never discounted) and recorded in
    //     DiscountUsage for limits + analytics.
    let appliedPromoCode: string | null = null
    const isFirstOrder = owner.signupDiscountUsed === false
    const promoInput = typeof promoCode === 'string' ? promoCode.toUpperCase().trim() : ''

    if (promoInput) {
      const code = promoInput
      // ----- Phase 52: referral codes — the silent program -----
      // A customer's personal code lives in its own table (never the admin
      // discount console). Friend courtesy on their FIRST order only; it
      // REPLACES the standard first-order discount exactly like the hotel
      // offer code, and the same eligibility function powers the wizard's
      // live "Apply code" preview — the two can never disagree.
      const referralCheck = await checkReferralEligibility(code, {
        userId: ownerId,
        isFirstOrder,
      })
      if (referralCheck.ok) {
        const amount = referralCheck.previewAmount(serviceTotal)
        if (amount > 0) {
          appliedPromoCode = code
          appliedReferral = {
            codeId: referralCheck.codeId,
            amount,
            referrerName: referralCheck.referrerName,
          }
          // The referral consumed the first-order benefit (it replaces the
          // standard signup discount, same policy as first-order offer codes).
          await db.user.update({
            where: { id: ownerId },
            data: { signupDiscountUsed: true },
          })
          appliedDiscounts.push(
            `Referral from ${referralCheck.referrerName.split(' ')[0]} (${referralCheck.discountPercent}% off) — saved ${amount.toLocaleString('en-NG')} naira`
          )
        } else {
          appliedDiscounts.push(`Referral code ${code} applied but nothing to discount`)
        }
      } else if (referralCheck.reason !== 'NOT_FOUND') {
        // A REAL referral code that does not fit here (their own code, or not
        // a first order) — say so plainly; no need to also run the discount
        // lookup (it is definitely not a coupon).
        appliedDiscounts.push(`Referral code ${code} — ${referralCheck.message}`)
      } else {
      let promo = await db.discount.findFirst({ where: { code } })
      // Built-in hotel/corporate offer: the code + percentage live in
      // AppSetting, so it works even before a Discount row exists. Upsert the
      // row for admin visibility/auditability (first order only, as always).
      if (!promo && isFirstOrder && code === appSettings.hotelGuestPromoCode.toUpperCase()) {
        promo = await db.discount.upsert({
          where: { code },
          update: {
            active: true,
            value: appSettings.hotelGuestDiscountPercent,
            name: 'HOTEL15 First-Order Offer (Hotels & Corporate)',
            description: `${appSettings.hotelGuestDiscountPercent}% off the first order for hotels & corporate clients (stacks with the 5% picture discount).`,
          },
          create: {
            name: 'HOTEL15 First-Order Offer (Hotels & Corporate)',
            code,
            type: 'PERCENTAGE',
            value: appSettings.hotelGuestDiscountPercent,
            active: true,
            appliesTo: 'FIRST_ORDER',
            description: `${appSettings.hotelGuestDiscountPercent}% off the first order for hotels & corporate clients (stacks with the 5% picture discount).`,
          },
        })
      }

      if (!promo) {
        appliedDiscounts.push(`Offer code ${code} not recognised — standard offers applied`)
      } else {
        const eligibility = await checkCouponEligibility(
          promo as CouponRecord,
          {
            userRole: owner.role,
            isFirstOrder,
            userId: ownerId,
            userEmail: owner.email,
          },
          serviceTotal
        )
        if (!eligibility.ok) {
          // Unknown/ineligible codes are ignored with a notice, never a
          // dead end (same policy as before, now rule-aware).
          appliedDiscounts.push(`Offer code ${code} — ${eligibility.message}`)
        } else {
          const amount = computeCouponAmount(promo as CouponRecord, serviceTotal)
          if (amount > 0) {
            appliedPromoCode = code
            appliedCoupon = { ...(promo as CouponRecord), amount }
            if (isFirstOrder) {
              // A first-order code consumed the first-order benefit (it is
              // strictly better than the standard signup discount).
              await db.user.update({
                where: { id: ownerId },
                data: { signupDiscountUsed: true },
              })
            }
            if (promo.type === 'PERCENTAGE') {
              const cap = promo.maxDiscount != null ? `, capped at ${promo.maxDiscount.toLocaleString('en-NG')} naira` : ''
              appliedDiscounts.push(
                `Coupon ${code} (${promo.value}% off${cap}) — saved ${amount.toLocaleString('en-NG')} naira`
              )
            } else {
              appliedDiscounts.push(
                `Coupon ${code} (${amount.toLocaleString('en-NG')} naira off)`
              )
            }
          } else {
            appliedDiscounts.push(`Offer code ${code} applied but nothing to discount`)
          }
        }
      }
      } // end phase-52 else: not a referral code → standard coupon path
    } else if (isFirstOrder) {
      // Standard first-order discount — the percentage ALWAYS comes from
      // AppSetting (default 10%, admin-tunable). A legacy SIGNUP Discount row
      // only acts as an on/off switch: if it exists and is inactive, the
      // first-order offer is switched off entirely.
      const signupGate = await db.discount.findFirst({
        where: { appliesTo: 'SIGNUP' },
      })
      if (!signupGate || signupGate.active) {
        const pct = appSettings.firstOrderDiscountPercent
        totalDiscount += pct / 100
        appliedDiscounts.push(`First-order discount (${pct}%)`)
        await db.user.update({
          where: { id: ownerId },
          data: { signupDiscountUsed: true },
        })
      }
    }

    // ----- Delivery fee: first delivery free, then the going rate -----
    // The free delivery is per CUSTOMER (not per browser): count their
    // previous orders. Cancelled orders don't consume the free delivery.
    // Phase 62: Kozy Circle members NEVER pay delivery — their plan covers
    // every pickup and drop-off, which is the visible core benefit.
    const activeMembership =
      owner.role === 'B2C' || owner.role === 'B2B'
        ? await db.subscription.findFirst({
            where: { userId: ownerId, status: { in: ['ACTIVE', 'PAST_DUE'] } },
            orderBy: { createdAt: 'desc' },
            include: { plan: true },
          })
        : null
    membershipLive =
      activeMembership &&
      ['ACTIVE', 'EXPIRING', 'PAST_DUE'].includes(effectiveStatus(activeMembership))
        ? activeMembership
        : null
    const previousOrders = await db.order.count({
      where: { userId: ownerId, status: { not: 'CANCELLED' } },
    })
    const isFirstDelivery = previousOrders === 0
    const deliveryFee = membershipLive ? 0 : isFirstDelivery ? 0 : appSettings.deliveryFee
    if (membershipLive) {
      appliedDiscounts.push(
        `Member delivery — free (${membershipLive.plan?.name ?? 'Kozy Circle'})`
      )
    } else if (deliveryFee > 0) {
      appliedDiscounts.push(`Delivery fee`) // informational line in admin
    } else {
      appliedDiscounts.push(`Free first delivery`)
    }

    // ----- Phase 62: member discount on everything à-la-carte -----
    // The plan's percentage off dry cleaning, shoes and alterations —
    // composes with the guarantee 5% and the first-order/hotel offers under
    // the same 95% stack cap. Deliberately REPLACES the standing online
    // discount when it is stronger (an Atelier member's 20% beats the 5%
    // registered-customer discount; the weaker online line is simply not
    // applied) so the member's basket reads one clean benefit, not a pile.
    const memberDiscountPct = membershipLive?.plan?.memberDiscountPct ?? 0

    // ----- Permanent online-order discount (phase-30, client directive) -----
    // 5% (admin-tunable) off EVERY order placed by a signed-in customer —
    // the standing registration incentive. Guests are deliberately excluded:
    // the wizard shows them the sign-in offer instead, and eligibility is
    // computed here server-side anyway (a client flag is never trusted —
    // same class of fix as guaranteeActive). ADMIN sessions are excluded:
    // those are phone/walk-in customers placed on their behalf, not online
    // self-service. Stacks with the guarantee 5% and the first-order/hotel
    // offers; the combined percentage cap below (95%) still applies.
    // Phase 62: a member's stronger plan discount replaces the online line
    // (see the memberDiscountPct note above).
    const onlinePct =
      session && session.user?.role !== 'ADMIN'
        ? Math.max(0, Math.min(appSettings.onlineOrderDiscountPercent, 50))
        : 0
    if (memberDiscountPct > 0) {
      totalDiscount += memberDiscountPct / 100
      appliedDiscounts.push(
        `Kozy Circle member discount (${memberDiscountPct}%) — ${membershipLive?.plan?.name ?? 'plan'}`
      )
    } else if (onlinePct > 0) {
      totalDiscount += onlinePct / 100
      appliedDiscounts.push(`Online order discount (${onlinePct}%) — for registered customers, every order`)
    }

    // Total = (cleaning + handwash + express) − percentage discounts − the
    // coupon's naira amount − the referral courtesy, plus the flat delivery
    // fee (fees are never discounted). The percentage stack stays capped at
    // 95%; the coupon amount is already capped to the service charge by
    // computeCouponAmount, and the referral amount likewise derives from the
    // service charge only.
    const couponFlatAmount = appliedCoupon?.amount ?? 0
    const referralFlatAmount = appliedReferral?.amount ?? 0
    totalPrice =
      Math.max(
        0,
        Math.round(serviceTotal * (1 - Math.min(totalDiscount, 0.95))) -
          couponFlatAmount -
          referralFlatAmount
      ) + deliveryFee

    // ----- Phase 52: the referrer's thank-you credit, applied automatically -----
    // Their earned balance against THIS retail order, after every other
    // discount. Retail only — KG/corporate orders are priced later when the
    // admin weighs them, so the credit simply waits for their next basket.
    // The balance is decremented only AFTER the order is actually created
    // (the duplicate-submission guard below returns early and must never
    // double-spend it).
    if (owner.referralCredit > 0 && totalPrice > 0) {
      const creditApplied = Math.min(owner.referralCredit, totalPrice)
      if (creditApplied > 0) {
        totalPrice = Math.max(0, Math.round(totalPrice - creditApplied))
        appliedDiscounts.push(
          `Referral thank-you credit (${creditApplied.toLocaleString('en-NG')} naira applied)`
        )
        pendingReferralCredit = creditApplied
      }
    }
    // ----- Phase 53: loyalty — "after 10 washes, the 11th is free" -----
    // The customer's earned complimentary service applies itself to their
    // next retail basket: the whole order is priced at zero (delivery fee
    // included — a genuinely free service, matching the offline promise).
    // KG/bulk orders are priced at the station, so the earned service simply
    // waits for the next retail basket. The order is flagged loyaltyFree so
    // the confirmation email, the admin board and the card arithmetic all
    // tell the same story, and a delivered complimentary order never counts
    // as a punch on the next card.
    const loyalty = await getLoyaltyState(ownerId)
    if (loyalty.pending > 0) {
      loyaltyFreeOrder = true
      totalPrice = 0
      appliedDiscounts.push(
        `Complimentary service — earned after ten completed services (loyalty)`
      )
    }

    // Record the delivery fee + mode + code on the order for transparency
    orderExtras.deliveryFee = deliveryFee
    orderExtras.modeOfWash = modeOfWash ?? null
    orderExtras.promoCode = appliedPromoCode
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

  // ----- Duplicate-submission guard (bank transfer only) -----
  // When a customer is unsure whether their payment went through, the
  // instinct is to hit confirm again — each hit used to create a fresh
  // order + PENDING payment, flooding the admin queue with the same
  // verification request. The same basket submitted twice within 15 minutes
  // is treated as ONE submission: we return the original order and skip both
  // the DB write and the notification.
  //
  // Matched fields: manifest (items + server unit prices), pickup address,
  // mode of wash, service speed and promo code — every field that defines
  // the basket. totalPrice is deliberately NOT compared: it is derived, and
  // one-time benefits (first-order discount, free first delivery) are
  // consumed by the first submission, so a replay legitimately reprices
  // higher while still being the SAME order intent. A genuinely different
  // basket (any item, speed, wash mode or address change) never matches.
  if (bankTransferAmount !== null) {
    const manifest = JSON.stringify(items)
    const duplicate = await db.order.findFirst({
      where: {
        userId: ownerId,
        status: 'PAYMENT_PENDING_VERIFICATION',
        itemsManifest: manifest,
        pickupAddress,
        modeOfWash: orderExtras.modeOfWash ?? null,
        serviceSpeed: speed.id,
        promoCode: orderExtras.promoCode ?? null,
        createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, role: true } },
        driver: { select: { id: true, name: true, phone: true } },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    if (duplicate) {
      // Trimmed order — the client only needs the identity fields to route
      // the customer to /payment/pending; no need to echo addresses or
      // contact details back to an unauthenticated caller.
      return NextResponse.json(
        {
          order: {
            id: duplicate.id,
            orderNumber: duplicate.orderNumber,
            status: duplicate.status,
            totalPrice: duplicate.totalPrice,
            user: { email: duplicate.user.email },
          },
          guestAccountCreated: false,
          duplicate: true,
        },
        { status: 201 }
      )
    }
  }

  // ----- Guest re-booking with an email that has a real password -----
  // The duplicate guard above already had its chance (an identical pending
  // order was returned). This is a genuinely new basket from an email that
  // belongs to an existing account — they should sign in (prevents order
  // hijacking), exactly as the flow always worked.
  if (existingAccountNeedsSignIn) {
    return NextResponse.json(
      {
        error: 'ACCOUNT_EXISTS',
        message:
          'An account with this email already exists. Please sign in to book — your details will be waiting.',
      },
      { status: 409 }
    )
  }

  // ----- Phase 62: branch assignment (server-side, deterministic) -----
  // The pickup address's service zone decides which hub (Ogombo / Chevron
  // Drive) the order lands at; unknown zones fall back to the nearest
  // branch. Never blocks the booking — a lookup failure simply leaves the
  // order unassigned (admin can route it from the order modal).
  let branchAssignment: { branchId: string; branchName: string; reason: string } | null = null
  try {
    branchAssignment = await assignBranchForAddress(pickupAddress)
  } catch (e) {
    console.error('[branches] assignment failed (order still placed):', e)
  }

  const order = await db.order.create({
    data: {
      orderNumber,
      userId: ownerId,
      status: bankTransferAmount !== null ? 'PAYMENT_PENDING_VERIFICATION' : 'REQUESTED',
      type,
      guaranteeActive,
      loyaltyFree: loyaltyFreeOrder,
      serviceSpeed: speed.id,
      modeOfWash: orderExtras.modeOfWash ?? null,
      promoCode: orderExtras.promoCode ?? null,
      deliveryFee: orderExtras.deliveryFee ?? 0,
      itemsManifest: JSON.stringify(items),
      alterationNotes: hasAlterationItems ? alterationNotes!.trim() : (alterationNotes?.trim() || null),
      totalPrice,
      ...(membershipLive ? { subscriptionId: membershipLive.id } : {}),
      ...(branchAssignment ? { branchId: branchAssignment.branchId } : {}),
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
                // The customer's optional transfer screenshot (downscaled
                // client-side) — the admin queue verifies against the real
                // receipt instead of the old mock.
                ...(transferReceipt ? { receiptUrl: transferReceipt } : {}),
              },
            },
          }
        : {}),
      // Condition photos → GarmentMedia rows: the Return-as-Received
      // Guarantee's evidence trail. They used to be collected in the wizard
      // but never left the customer's browser, so damage claims had no
      // pre-pickup proof (audit finding). Phase 51: up to 30 photos arrive
      // from the staging table (claimed above, token-scoped) plus any legacy
      // inline photos from older cached bundles.
      ...(allPhotoUrls.length > 0
        ? {
            media: {
              create: allPhotoUrls.map((url, i) => ({
                imageUrl: url,
                notes: `Condition photo ${i + 1} (pre-pickup)`,
              })),
            },
          }
        : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, role: true } },
      driver: { select: { id: true, name: true, phone: true } },
      payments: true,
      // Count-only: the just-booked customer's phone should not download a
      // 5MB JSON echo of the photos it just uploaded (see GET above).
      media: { select: { id: true } },
    },
  })

  // The staged rows have been moved into GarmentMedia — clear them out so
  // the staging table stays tiny (best-effort; the 24h sweep catches any
  // stragglers if this delete fails).
  if (claimedStaged.length > 0) {
    try {
      await db.stagedPhoto.deleteMany({
        where: { id: { in: claimedStaged.map((r) => r.id) } },
      })
    } catch (e) {
      console.error('Staged photo cleanup failed (order still placed):', e)
    }
  }
  ;(order as any).mediaCount = (order as any).media?.length ?? 0
  delete (order as any).media

  // ----- Coupon usage trail (phase 36) — never blocks the booking -----
  // Records the redemption (per-user limits + "how much did this promo cost
  // me" analytics) and increments the coupon's live counter. Best-effort:
  // a tracking failure must never roll back a placed order.
  if (appliedCoupon) {
    try {
      await db.discountUsage.create({
        data: {
          discountId: appliedCoupon.id,
          userId: ownerId,
          userEmail: owner.email,
          orderId: order.id,
          discountAmount: appliedCoupon.amount,
        },
      })
      await db.discount.update({
        where: { id: appliedCoupon.id },
        data: { currentUses: { increment: 1 } },
      })
    } catch (e) {
      console.error('Coupon usage recording failed (order still placed):', e)
    }
  }

  // ----- Phase 52: spend the referral thank-you credit -----
  // Runs only now — after the duplicate guard and the order write — so a
  // replayed submission can never double-spend the balance. The conditional
  // decrement (gte guard) keeps concurrent bookings from overdrafting it.
  if (pendingReferralCredit > 0) {
    try {
      await db.user.updateMany({
        where: { id: ownerId, referralCredit: { gte: pendingReferralCredit } },
        data: { referralCredit: { decrement: pendingReferralCredit } },
      })
    } catch (e) {
      console.error('Referral credit decrement failed (order still placed):', e)
    }
  }

  // ----- Notifications (email + SMS) — never block the booking -----
  // Runs AFTER the response is sent (next/server after()): a slow email
  // provider must not make checkout feel broken. Bank-transfer orders get a
  // transfer-specific email: it tells the customer the verification is
  // underway and an email will follow the moment admin confirms — the exact
  // reassurance that stops double payments.
  after(async () => {
    try {
      if (guestAccountCreated && guestEmail) {
        await notifyGuestAccountCreated(order, guestEmail, {
          transferPending: bankTransferAmount !== null,
        })
      } else if (bankTransferAmount !== null) {
        await notifyTransferPendingVerification(order)
      } else {
        await notifyOrderCreated(order)
      }

      // ----- Admin alert (one email per event) -----
      // Bank transfer → "payment to verify" (the actionable one: the
      // customer is waiting on the status page). Anything else → "new order".
      if (bankTransferAmount !== null) {
        await notifyAdminTransferPending(order)
      } else {
        await notifyAdminNewOrder(order)
      }

      // ----- Phase 69: dispatch to a rider -----
      // Only PAYMENT_VERIFIED orders dispatch (member-covered one-tap bookings
      // land here instantly). REQUESTED card orders wait for the Paystack
      // webhook, transfer orders for admin verification — both of those
      // trigger dispatch at the moment the money clears.
      if ((order as any).status === 'PAYMENT_VERIFIED') {
        await dispatchNewOrder(order as Parameters<typeof dispatchNewOrder>[0])
      }

      // ----- Phase 52: referral redemption trail -----
      // A friend's first order was placed with a customer's personal code —
      // record it (the thank-you credit grant hangs off this row when the
      // order is delivered) and ping the admins quietly.
      if (appliedReferral) {
        await recordReferralRedemption({
          codeId: appliedReferral.codeId,
          orderId: order.id,
          friendEmail: owner.email,
          friendName: owner.name,
          friendDiscountAmount: appliedReferral.amount,
          orderNumber: order.orderNumber,
        })
      }
    } catch (e) {
      console.error('Post-booking notifications failed:', e)
    }
  })

  return NextResponse.json({ order, guestAccountCreated }, { status: 201 })
}
