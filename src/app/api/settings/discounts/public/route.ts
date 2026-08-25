// =============================================================================
// GET /api/settings/discounts/public — public, active discounts only
// Only exposes name + value + appliesTo (no admin fields)
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const discounts = await db.discount.findMany({
    where: { active: true },
    select: { name: true, value: true, appliesTo: true, type: true }
  })
  return NextResponse.json({ discounts })
}
