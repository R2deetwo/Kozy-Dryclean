// =============================================================================
// GET /api/settings/discounts — admin-only, list all discounts
// PATCH /api/settings/discounts/[id] — admin-only, update a discount
// GET /api/settings/discounts/public — public, active discounts only (value + name)
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'

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
    orderBy: { createdAt: 'asc' }
  })
  return NextResponse.json({ discounts })
}
