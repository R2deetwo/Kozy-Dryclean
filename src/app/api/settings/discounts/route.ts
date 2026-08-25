// =============================================================================
// GET /api/settings/discounts — admin-only, list all discounts
// PATCH /api/settings/discounts/[id] — admin-only, update a discount
// GET /api/settings/discounts/public — public, active discounts only (value + name)
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'

export async function GET() {
  const session = await requireRole('ADMIN')
  const discounts = await db.discount.findMany({
    orderBy: { createdAt: 'asc' }
  })
  return NextResponse.json({ discounts })
}
