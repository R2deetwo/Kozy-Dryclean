// =============================================================================
// PATCH /api/settings/discounts/[id] — admin-only, update a discount/coupon
// =============================================================================

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'

// Phase 31: explicit 401/403 instead of the thrown-Response-becomes-500
// quirk (same pattern as the other console routes).
async function guardAdmin(): Promise<ReturnType<typeof requireRole> | NextResponse> {
  try {
    return await requireRole('ADMIN')
  } catch (e) {
    if (e instanceof Response) {
      return new NextResponse(e.body, {
        status: e.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    throw e
  }
}

const PatchDiscountSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(300).nullable().optional(),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{3,20}$/, 'Codes use 3–20 letters/numbers only')
    .optional(),
  // PERCENTAGE value ≤ 100; FIXED value is a naira amount
  value: z.number().finite().positive().optional(),
  active: z.boolean().optional(),
  appliesTo: z.enum(['ALL', 'FIRST_ORDER', 'B2C', 'B2B']).optional(),
  minOrderValue: z.number().finite().min(0).nullable().optional(),
  maxDiscount: z.number().finite().positive().nullable().optional(),
  maxUsesTotal: z.number().int().positive().nullable().optional(),
  maxUsesPerUser: z.number().int().positive().nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await guardAdmin()
  if (guard instanceof NextResponse) return guard

  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Validate before touching the DB — the old handler ran parseFloat on the
  // raw body, so a typo could persist NaN into the discount value (audit
  // finding).
  const parsed = PatchDiscountSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid discount update', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const existing = await db.discount.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Discount not found' }, { status: 404 })
  }

  // Percentage sanity: either the new value or (unchanged) current value
  const newType = existing.type
  const newValue = parsed.data.value ?? existing.value
  if (newType === 'PERCENTAGE' && newValue > 100) {
    return NextResponse.json(
      { error: 'A percentage discount cannot exceed 100%' },
      { status: 400 }
    )
  }

  const { startDate, endDate, minOrderValue, maxDiscount, maxUsesTotal, maxUsesPerUser, ...rest } =
    parsed.data

  try {
    const updated = await db.discount.update({
      where: { id },
      data: {
        ...rest,
        minOrderValue: minOrderValue === undefined ? undefined : minOrderValue,
        maxDiscount: maxDiscount === undefined ? undefined : maxDiscount,
        maxUsesTotal: maxUsesTotal === undefined ? undefined : maxUsesTotal,
        maxUsesPerUser: maxUsesPerUser === undefined ? undefined : maxUsesPerUser,
        startDate: startDate === undefined ? undefined : startDate === null ? null : new Date(startDate),
        endDate: endDate === undefined ? undefined : endDate === null ? null : new Date(endDate),
      },
    })
    return NextResponse.json({ discount: updated })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json(
        { error: 'That code is already in use by another coupon.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Discount not found' }, { status: 404 })
  }
}
