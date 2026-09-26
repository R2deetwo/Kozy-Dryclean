// =============================================================================
// PATCH /api/partners/[id] — ADMIN partner decisions
// =============================================================================
//   approve  — welcome them into the network (branch + revenue share set
//              here; both editable later)
//   reject   — decline with a note (kept for the record)
//   suspend  — pause the flow of orders to them without removing history
//   reactivate — undo a suspension
//   update   — adjust branch / revenue share / contact details
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'

async function requireAdmin(): Promise<ReturnType<typeof requireRole> | NextResponse> {
  try {
    return await requireRole('ADMIN')
  } catch (e: any) {
    if (e instanceof Response) {
      return new NextResponse(e.body, {
        status: e.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const action = typeof body?.action === 'string' ? body.action : ''

  const partner = await db.partner.findUnique({ where: { id } })
  if (!partner) {
    return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
  }

  switch (action) {
    case 'approve': {
      // Branch must exist when provided.
      let branchId: string | null = null
      if (typeof body?.branchId === 'string' && body.branchId) {
        const branch = await db.branch.findUnique({ where: { id: body.branchId } })
        if (!branch) {
          return NextResponse.json({ error: 'Branch not found' }, { status: 400 })
        }
        branchId = branch.id
      }
      const shareRaw = Number(body?.revenueSharePartnerPct)
      const share =
        Number.isFinite(shareRaw) && shareRaw >= 0 && shareRaw <= 100 ? Math.round(shareRaw) : 70

      const updated = await db.partner.update({
        where: { id },
        data: {
          status: 'APPROVED',
          branchId,
          revenueSharePartnerPct: share,
          reviewedAt: new Date(),
          reviewNote:
            typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : partner.reviewNote,
        },
      })
      console.log(
        `[partners] ${(session as any)?.user?.name ?? 'Admin'} approved ${updated.businessName} (branch ${branchId ?? '—'}, ${share}% partner share)`
      )
      return NextResponse.json({ partner: updated })
    }

    case 'reject':
    case 'suspend':
    case 'reactivate': {
      const status =
        action === 'reject' ? 'REJECTED' : action === 'suspend' ? 'SUSPENDED' : 'APPROVED'
      const updated = await db.partner.update({
        where: { id },
        data: {
          status,
          reviewedAt: new Date(),
          reviewNote:
            typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : partner.reviewNote,
        },
      })
      return NextResponse.json({ partner: updated })
    }

    case 'update': {
      const data: Record<string, unknown> = {}
      if (typeof body?.branchId === 'string') {
        const branch = body.branchId
          ? await db.branch.findUnique({ where: { id: body.branchId } })
          : null
        data.branchId = branch?.id ?? null
      }
      const shareRaw = Number(body?.revenueSharePartnerPct)
      if (Number.isFinite(shareRaw) && shareRaw >= 0 && shareRaw <= 100) {
        data.revenueSharePartnerPct = Math.round(shareRaw)
      }
      if (typeof body?.phone === 'string' && body.phone.trim().length >= 7) {
        data.phone = body.phone.trim()
      }
      if (typeof body?.address === 'string' && body.address.trim()) {
        data.address = body.address.trim()
      }
      if (typeof body?.capacityNotes === 'string') {
        data.capacityNotes = body.capacityNotes.trim().slice(0, 2000) || null
      }
      const updated = await db.partner.update({ where: { id }, data })
      return NextResponse.json({ partner: updated })
    }

    default:
      return NextResponse.json(
        { error: 'Unknown action', actions: ['approve', 'reject', 'suspend', 'reactivate', 'update'] },
        { status: 400 }
      )
  }
}
