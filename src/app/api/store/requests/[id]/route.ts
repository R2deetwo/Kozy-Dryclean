// =============================================================================
// PATCH /api/store/requests/[id] — the office confirms or declines a request
// =============================================================================
// ADMIN only. Confirming means "it rides along with the customer's next
// pickup" — the office handles the money through the usual paths (invoice /
// transfer / card at renewal). No member email fires from here: the store
// line lives inside the monthly summary only, never its own mailshot.
// =============================================================================

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { setProductRequestStatus } from '@/lib/kozy-store'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const limit = await rateLimit(`store-requests:${session.user.id}`, {
    max: 60,
    windowMs: 60 * 60 * 1000,
  })
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many changes — try again later.' }, { status: 429 })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const status = body?.status
  if (status !== 'CONFIRMED' && status !== 'DECLINED') {
    return NextResponse.json({ error: 'status must be CONFIRMED or DECLINED' }, { status: 400 })
  }

  try {
    const request = await setProductRequestStatus(id, status)
    return NextResponse.json({ request })
  } catch (e: any) {
    if (String(e?.code) === 'P2025') {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }
    console.error('[store] request status failed:', e)
    return NextResponse.json({ error: 'Could not update the request' }, { status: 500 })
  }
}
