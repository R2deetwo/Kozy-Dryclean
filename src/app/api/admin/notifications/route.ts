// =============================================================================
// /api/admin/notifications — the REAL operations feed (phase 24)
// =============================================================================
// GET   ?take=50        → latest NotificationEvents + unread count
// POST  { action:'read', ids:[...] } | { action:'readAll' } → mark as read
//
// The events are written by the same code that sends the admin alert emails
// (deliverAdminAlert in src/lib/notifications.ts), so the feed is guaranteed
// to mirror reality: if an email bounced or a toggle was off, the recorded
// emailStatus says so — the owner no longer has to take the spam folder's
// word for it.
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'

/** Call requireRole and convert its thrown Response into a real response
 * (some Next 16 builds surface thrown Response objects as 500s — returning
 * it explicitly guarantees clients see the proper 401/403). */
async function requireAdmin(): Promise<ReturnType<typeof requireRole> | NextResponse> {
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

export async function GET(req: Request) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

  const { searchParams } = new URL(req.url)
  const take = Math.min(Math.max(Number(searchParams.get('take')) || 50, 1), 200)

  const [events, unread] = await Promise.all([
    db.notificationEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take,
    }),
    db.notificationEvent.count({ where: { readAt: null } }),
  ])

  return NextResponse.json({ events, unread })
}

export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { action, ids } = body as { action?: string; ids?: string[] }

  if (action === 'readAll') {
    const r = await db.notificationEvent.updateMany({
      where: { readAt: null },
      data: { readAt: new Date() },
    })
    return NextResponse.json({ ok: true, updated: r.count })
  }

  if (action === 'read') {
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((i) => typeof i === 'string')) {
      return NextResponse.json({ error: 'ids must be a non-empty array of event ids' }, { status: 400 })
    }
    const r = await db.notificationEvent.updateMany({
      where: { id: { in: ids }, readAt: null },
      data: { readAt: new Date() },
    })
    return NextResponse.json({ ok: true, updated: r.count })
  }

  return NextResponse.json({ error: 'Unknown action — use "read" or "readAll"' }, { status: 400 })
}
