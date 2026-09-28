// =============================================================================
// GET /api/branches — the processing hubs (Ogombo, Chevron Drive, …)
// PUT /api/branches — ADMIN edits (zones, addresses, default, active,
//                       ownershipType: COMPANY | FRANCHISE)
// POST /api/branches — ADMIN maintenance actions (phase 69 backfill)
// =============================================================================
// GET is console-readable (STAFF included — riders/orders reference branch
// names and staff run the board). The table self-seeds the owner's two
// locations on first read.
//
// POST { action: 'backfill-orders', branchId } — one-time (idempotent)
// attribution: every order with NO branch yet is attributed to the given
// branch (the owner's directive: ALL current earnings belong to Chevron
// Drive — every order to date was processed there). Re-running affects zero
// rows because reruns only match branchId-null orders.
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { getBranches, rowToBranch } from '@/lib/branches'

export async function GET() {
  // Console users (ADMIN/STAFF) may read the full list; anyone else gets
  // the ACTIVE branches only (the rider app shows branch names on stops).
  let canSeeAll = false
  try {
    const session = await import('@/lib/auth').then((m) => m.getSession())
    canSeeAll = session?.user?.role === 'ADMIN' || session?.user?.role === 'STAFF'
  } catch {
    canSeeAll = false
  }
  const branches = await getBranches(!canSeeAll)
  return NextResponse.json({ branches: canSeeAll ? branches : branches.filter((b) => b.isActive) })
}

export async function PUT(req: Request) {
  let session
  try {
    session = await requireRole('ADMIN')
  } catch (e: any) {
    if (e instanceof Response) {
      return new NextResponse(e.body, {
        status: e.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const edits = Array.isArray(body?.branches) ? body.branches : null
  if (!edits) {
    return NextResponse.json({ error: 'Body must be { branches: [...] }' }, { status: 400 })
  }

  const existing = await db.branch.findMany()
  const existingIds = new Set(existing.map((b) => b.id))

  for (const edit of edits) {
    if (!edit?.id) continue

    // Default flag: exactly ONE branch may be default. Setting one clears
    // the others (assignment fallback depends on it).
    if (edit.isDefault === true) {
      await db.branch.updateMany({ data: { isDefault: false } })
    }

    const data: Record<string, unknown> = {}
    if (typeof edit.name === 'string' && edit.name.trim()) data.name = edit.name.trim()
    if (typeof edit.address === 'string' && edit.address.trim()) data.address = edit.address.trim()
    if (typeof edit.phone === 'string') data.phone = edit.phone.trim() || null
    if (Array.isArray(edit.zoneNames)) {
      // Whitelist against the canonical SERVICE_ZONES so a typo can never
      // orphan a zone (orders would silently fall to "nearest").
      const { SERVICE_ZONES } = await import('@/lib/geo')
      const valid = new Set(SERVICE_ZONES.map((z) => z.name))
      data.zoneNames = JSON.stringify(edit.zoneNames.filter((z: unknown) => typeof z === 'string' && valid.has(z)))
    }
    if (Number.isFinite(Number(edit.lat))) data.lat = Number(edit.lat)
    if (Number.isFinite(Number(edit.lng))) data.lng = Number(edit.lng)
    if (typeof edit.isActive === 'boolean') data.isActive = edit.isActive
    if (typeof edit.isDefault === 'boolean') data.isDefault = edit.isDefault
    if (edit.ownershipType === 'COMPANY' || edit.ownershipType === 'FRANCHISE') {
      data.ownershipType = edit.ownershipType
    }
    if (Number.isFinite(Number(edit.sortOrder))) data.sortOrder = Math.round(Number(edit.sortOrder))

    if (existingIds.has(edit.id)) {
      if (Object.keys(data).length > 0) {
        // Never deactivate the default branch (assignment needs a landing
        // spot) — the edit is ignored rather than erroring.
        const current = existing.find((b) => b.id === edit.id)
        if (data.isActive === false && current?.isDefault) {
          delete data.isActive
        }
        await db.branch.update({ where: { id: edit.id }, data })
      }
    }
    // New branches: create with a slug derived from the name.
    else if (typeof edit.name === 'string' && edit.name.trim()) {
      const slug = edit.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
      try {
        await db.branch.create({
          data: {
            name: edit.name.trim(),
            slug,
            address: typeof edit.address === 'string' ? edit.address : '',
            phone: typeof edit.phone === 'string' ? edit.phone : null,
            zoneNames: JSON.stringify(Array.isArray(edit.zoneNames) ? edit.zoneNames : []),
            lat: Number.isFinite(Number(edit.lat)) ? Number(edit.lat) : 6.5,
            lng: Number.isFinite(Number(edit.lng)) ? Number(edit.lng) : 3.4,
            isActive: edit.isActive !== false,
            isDefault: edit.isDefault === true,
            ownershipType: edit.ownershipType === 'FRANCHISE' ? 'FRANCHISE' : 'COMPANY',
            sortOrder: Number.isFinite(Number(edit.sortOrder)) ? Math.round(Number(edit.sortOrder)) : 99,
          },
        })
      } catch (e) {
        console.error('[branches] create failed:', e)
      }
    }
  }

  const fresh = await db.branch.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
  return NextResponse.json({ branches: fresh.map(rowToBranch) })
}

// ----- POST /api/branches — maintenance actions (ADMIN only) -----
export async function POST(req: Request) {
  let session
  try {
    session = await requireRole('ADMIN')
  } catch (e: any) {
    if (e instanceof Response) {
      return new NextResponse(e.body, {
        status: e.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))

  // ---- backfill-orders: attribute every branch-less order to one branch ----
  // The owner's call (phase 69): ALL current orders and earnings belong to
  // Chevron Drive — every wash to date was processed there. Idempotent: a
  // second run matches zero rows.
  if (body?.action === 'backfill-orders') {
    const target = typeof body.branchId === 'string' ? body.branchId : null
    const branch = target ? await db.branch.findUnique({ where: { id: target } }) : null
    if (!branch) {
      return NextResponse.json({ error: 'branchId must reference an existing branch' }, { status: 400 })
    }
    const res = await db.order.updateMany({
      where: { branchId: null },
      data: { branchId: branch.id },
    })
    const remaining = await db.order.count({ where: { branchId: null } })
    return NextResponse.json({
      action: 'backfill-orders',
      branch: { id: branch.id, name: branch.name },
      attributed: res.count,
      remainingUnattributed: remaining,
    })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
