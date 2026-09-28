// =============================================================================
// GET  /api/settings/discounts — admin-only, list all discounts (+ usage)
// POST /api/settings/discounts — admin-only, create a coupon
// GET  /api/settings/discounts/public — public, active discounts only
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { generateCouponCode } from '@/lib/marketing'

// Phase 31: convert requireRole's thrown 401/403 Response into a real
// response — the client (a staff member poking at the discount engine, or
// monitoring) must see 403, not an empty 500 (phase-24 Next 16 quirk).
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

export async function GET() {
  const guard = await guardAdmin()
  if (guard instanceof NextResponse) return guard

  const discounts = await db.discount.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { usages: true } },
    },
  })
  return NextResponse.json({
    discounts: discounts.map((d) => ({
      ...d,
      usageCount: (d as any)._count?.usages ?? 0,
    })),
  })
}

// Phase 36 — create a coupon. Codes are auto-generated when left blank.
// PERCENTAGE value ≤ 100; FIXED value is a naira amount.
const CreateCouponSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{3,20}$/, 'Codes use 3–20 letters/numbers only')
    .optional(),
  description: z.string().trim().max(300).optional(),
  type: z.enum(['PERCENTAGE', 'FIXED']),
  value: z.number().finite().positive(),
  appliesTo: z.enum(['ALL', 'FIRST_ORDER', 'B2C', 'B2B']),
  minOrderValue: z.number().finite().min(0).optional(),
  maxDiscount: z.number().finite().positive().optional(),
  maxUsesTotal: z.number().int().positive().optional(),
  maxUsesPerUser: z.number().int().positive().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

export async function POST(req: NextRequest) {
  const guard = await guardAdmin()
  if (guard instanceof NextResponse) return guard

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Auto-generate the code when not provided (or blank)
  if (!body?.code || String(body.code).trim() === '') {
    body.code = generateCouponCode()
  }

  const parsed = CreateCouponSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid coupon details', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const data = parsed.data

  if (data.type === 'PERCENTAGE' && data.value > 100) {
    return NextResponse.json(
      { error: 'A percentage discount cannot exceed 100%' },
      { status: 400 }
    )
  }

  try {
    const coupon = await db.discount.create({
      data: {
        name: data.name,
        code: data.code,
        description: data.description ?? null,
        type: data.type,
        value: data.value,
        appliesTo: data.appliesTo,
        active: true,
        minOrderValue: data.minOrderValue ?? null,
        maxDiscount: data.maxDiscount ?? null,
        maxUsesTotal: data.maxUsesTotal ?? null,
        maxUsesPerUser: data.maxUsesPerUser ?? null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
    })
    return NextResponse.json({ coupon }, { status: 201 })
  } catch (e: any) {
    // P2002 = unique constraint (code already exists)
    if (e?.code === 'P2002') {
      return NextResponse.json(
        { error: `The code ${data.code} is already in use — pick another.` },
        { status: 409 }
      )
    }
    console.error('Coupon create failed:', e)
    return NextResponse.json({ error: 'Could not create the coupon' }, { status: 500 })
  }
}
