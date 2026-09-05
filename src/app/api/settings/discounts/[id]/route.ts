// =============================================================================
// PATCH /api/settings/discounts/[id] — admin-only, update discount
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
  value: z.coerce.number().finite().min(0).max(100).optional(),
  active: z.boolean().optional(),
  name: z.string().trim().min(1).max(60).optional(),
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

  try {
    const updated = await db.discount.update({ where: { id }, data: parsed.data })
    return NextResponse.json({ discount: updated })
  } catch {
    return NextResponse.json({ error: 'Discount not found' }, { status: 404 })
  }
}
