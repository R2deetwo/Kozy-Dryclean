// =============================================================================
// PATCH /api/settings/discounts/[id] — admin-only, update discount
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireRole('ADMIN')
  const { id } = await params
  const body = await req.json()

  const updated = await db.discount.update({
    where: { id },
    data: {
      ...(body.value !== undefined && { value: parseFloat(body.value) }),
      ...(body.active !== undefined && { active: body.active }),
      ...(body.name !== undefined && { name: body.name }),
    }
  })

  return NextResponse.json({ discount: updated })
}
