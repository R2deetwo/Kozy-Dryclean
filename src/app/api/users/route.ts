// =============================================================================
// GET /api/users — list users (console roles, cursor-paginated)
// =============================================================================
// `?cursor=<id>&limit=<n>` — cursor-based, default limit 25, hard cap 100.
// Ordered by (createdAt DESC, id DESC) so the cursor is stable.
// Response shape: { items, nextCursor } — nextCursor is null on the last page.
//
// Phase 31: STAFF joins ADMIN here because the customer directory is part
// of the operational side (calling customers, checking who placed what).
// Scope differs: STAFF only ever gets customer records (B2C/B2B) — never
// other staff or admin accounts — so console identities can't be
// enumerated from a staff login.
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'

export async function GET(req: Request) {
  const session = await requireRole('ADMIN', 'STAFF')
  const isStaff = (session.user as any)?.role === 'STAFF'

  // ----- Cursor pagination params -----
  const { searchParams } = new URL(req.url)
  const limitRaw = parseInt(searchParams.get('limit') ?? '', 10)
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 25, 1), 100)
  const cursor = searchParams.get('cursor') || undefined

  // take limit+1 rows so we can tell whether another page exists
  let users = await db.user.findMany({
    // Staff see customers only — the staff list itself lives in /api/staff
    // (ADMIN-only) and admin identities are invisible to staff.
    where: isStaff ? { role: { in: ['B2C', 'B2B'] } } : undefined,
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      company: true,
      address: true,
      emailVerified: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasMore = users.length > limit
  if (hasMore) users = users.slice(0, limit)
  const nextCursor = hasMore ? users[users.length - 1].id : null

  return NextResponse.json({ items: users, nextCursor })
}
