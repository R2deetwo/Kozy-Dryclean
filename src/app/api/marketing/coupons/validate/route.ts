// =============================================================================
// POST /api/marketing/coupons/validate — public live coupon check
// =============================================================================
// Body: { code: string, serviceSubtotal: number, email?: string }
// Returns: { valid, message?, couponName?, discountAmount?, type?, value? }
//
// Called by the booking wizard's "Apply code" button so the customer sees
// the coupon working BEFORE confirming. This is a PREVIEW — the
// authoritative pricing happens in POST /api/orders using the exact same
// rule functions (src/lib/marketing.ts), so the two can never disagree.
//
// Works signed-in (session used for role/first-order/usage checks) and as a
// guest (email → existing-account lookup). The built-in hotel/corporate
// first-order code is honoured from AppSetting without creating a row.
//
// Rate limited (30/hour/IP) — enough for a customer trying a few codes,
// useless for brute-forcing.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { rateLimit, getClientIP } from '@/lib/rate-limit'
import { getAppSettings } from '@/lib/app-settings'
import {
  checkCouponEligibility,
  computeCouponAmount,
  type CouponRecord,
} from '@/lib/marketing'

const ValidateSchema = z.object({
  code: z.string().trim().min(1).max(24),
  serviceSubtotal: z.number().finite().min(0),
  email: z.string().trim().email().optional(),
})

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  const limit = await rateLimit(`coupon-validate:${ip}`, {
    max: 30,
    windowMs: 60 * 60 * 1000,
  })
  if (!limit.success) {
    return NextResponse.json(
      { valid: false, message: 'Too many attempts — please try again in a little while.' },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ valid: false, message: 'Invalid request' }, { status: 400 })
  }
  const parsed = ValidateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ valid: false, message: 'Invalid request' }, { status: 400 })
  }

  const { code, serviceSubtotal, email } = parsed.data
  const normalizedCode = code.toUpperCase().trim()

  // ----- Who is asking? (optional session) -----
  const session = await getSession().catch(() => null)
  let userRole: string | null = null
  let userId: string | null = null
  let userEmail: string | null = email?.toLowerCase() ?? null
  let isFirstOrder = true
  if (session?.user?.email) {
    const u = await db.user.findUnique({
      where: { email: session.user.email.toLowerCase() },
      select: { id: true, role: true, signupDiscountUsed: true },
    })
    if (u && (u.role === 'B2C' || u.role === 'B2B')) {
      userRole = u.role
      userId = u.id
      userEmail = session.user.email.toLowerCase()
      isFirstOrder = u.signupDiscountUsed === false
    }
  } else if (userEmail) {
    // Guest with a typed email — an existing account with a used first-order
    // benefit is NOT on their first order anymore
    const u = await db.user.findUnique({
      where: { email: userEmail },
      select: { id: true, role: true, signupDiscountUsed: true },
    })
    if (u) {
      userRole = u.role === 'B2C' || u.role === 'B2B' ? u.role : null
      userId = u.id
      isFirstOrder = u.signupDiscountUsed === false
    }
  }

  // ----- Find the coupon -----
  let coupon = (await db.discount.findFirst({
    where: { code: normalizedCode },
  })) as CouponRecord | null

  // Built-in hotel/corporate offer — the code + percentage live in
  // AppSetting so it works before any Discount row exists (checkout
  // upserts the row for auditability when the order is actually placed).
  const appSettings = await getAppSettings()
  if (!coupon && normalizedCode === (appSettings.hotelGuestPromoCode || '').toUpperCase()) {
    coupon = {
      id: 'builtin-hotel',
      name: 'Hotel & corporate first-order offer',
      code: normalizedCode,
      type: 'PERCENTAGE',
      value: appSettings.hotelGuestDiscountPercent,
      active: true,
      appliesTo: 'FIRST_ORDER',
      minOrderValue: null,
      maxDiscount: null,
      maxUsesTotal: null,
      maxUsesPerUser: 1,
      currentUses: 0,
      startDate: null,
      endDate: null,
    } as CouponRecord
  }

  if (!coupon || !coupon.code) {
    return NextResponse.json({
      valid: false,
      message: 'That code is not recognised. Check the spelling and try again.',
    })
  }

  const eligibility = await checkCouponEligibility(coupon, {
    userRole,
    isFirstOrder,
    userId,
    userEmail,
  }, serviceSubtotal)
  if (!eligibility.ok) {
    return NextResponse.json({ valid: false, message: eligibility.message })
  }

  const discountAmount = computeCouponAmount(coupon, serviceSubtotal)
  return NextResponse.json({
    valid: true,
    couponName: coupon.name,
    discountAmount,
    type: coupon.type,
    value: coupon.value,
    message:
      coupon.type === 'PERCENTAGE'
        ? `${coupon.value}% off — you save ${'₦' + discountAmount.toLocaleString('en-NG')}`
        : `${'₦' + discountAmount.toLocaleString('en-NG')} off this order`,
  })
}
