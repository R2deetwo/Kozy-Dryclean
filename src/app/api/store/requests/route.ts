// =============================================================================
// POST /api/store/requests — a customer adds a product to their next delivery
// GET  /api/store/requests — the office list (ADMIN) | ?mine=1 (own requests)
// =============================================================================
// The deliberately light ordering flow (phase 77): no cart, no checkout. The
// request lands PENDING, the office confirms or declines it in Settings →
// Store, and money moves through the paths the office already runs.
// =============================================================================

import { NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { createProductRequest, listProductRequests } from '@/lib/kozy-store'
import { notifyAdminStoreRequest } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json(
      { error: 'SIGN_IN_REQUIRED', message: 'Please sign in — requests live in your account.' },
      { status: 401 }
    )
  }
  const role = (session.user as any)?.role
  if (role !== 'B2C' && role !== 'B2B') {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'Store requests are for customer accounts.' },
      { status: 403 }
    )
  }
  const userId = (session.user as any).id as string

  // Enough room to change one's mind, not enough to spam the office.
  const limit = await rateLimit(`store-requests:${userId}`, {
    max: 12,
    windowMs: 60 * 60 * 1000,
  })
  if (!limit.success) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', message: 'Too many requests in a short while — try again later.' },
      { status: 429 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const productId = typeof body?.productId === 'string' ? body.productId : ''
  const qty = Math.min(Math.max(Math.round(Number(body?.qty)) || 1, 1), 10)
  const noteRaw = typeof body?.note === 'string' ? body.note.trim() : ''
  if (noteRaw.length > 300) {
    return NextResponse.json({ error: 'Note must be at most 300 characters' }, { status: 400 })
  }

  try {
    const request = await createProductRequest({
      userId,
      productId,
      qty,
      note: noteRaw || null,
    })
    if (!request) {
      // Dark store or inactive product — a plain 404 keeps it dark.
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Office alert — never blocks the customer's response.
    after(async () => {
      try {
        await notifyAdminStoreRequest({
          customer: {
            name: request.user.name,
            email: request.user.email,
            phone: request.user.phone,
          },
          product: { name: request.product.name, price: request.product.price },
          qty: request.qty,
          note: request.note,
        })
      } catch (e) {
        console.error('[store] request alert failed:', e)
      }
    })

    return NextResponse.json({ request })
  } catch (e) {
    console.error('[store] request failed:', e)
    return NextResponse.json({ error: 'Could not send the request' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const mine = url.searchParams.get('mine') === '1'
  const status = url.searchParams.get('status') ?? undefined

  if (mine) {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ requests: [] })
    }
    const userId = (session.user as any).id as string
    try {
      const rows = await db.productRequest.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          product: { select: { id: true, name: true, price: true } },
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
      })
      return NextResponse.json({
        requests: rows.map((r) => ({
          id: r.id,
          qty: r.qty,
          status: r.status,
          note: r.note,
          createdAt: r.createdAt,
          product: r.product,
        })),
      })
    } catch (e) {
      console.error('[store] own requests failed:', e)
      return NextResponse.json({ requests: [] })
    }
  }

  // The office list — ADMIN only.
  const session = await getSession()
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const requests = await listProductRequests(
      status ? { status } : undefined
    )
    return NextResponse.json({ requests })
  } catch (e) {
    console.error('[store] requests list failed:', e)
    return NextResponse.json({ error: 'Could not load requests' }, { status: 500 })
  }
}
