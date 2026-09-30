// =============================================================================
// PATCH  /api/store/products/[id] — a super admin edits / toggles a product
// DELETE /api/store/products/[id] — a super admin retires it for good
// =============================================================================

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { updateStoreProduct, deleteStoreProduct } from '@/lib/kozy-store'

export const dynamic = 'force-dynamic'

async function adminGuard() {
  const session = await getSession()
  if (!session || session.user?.role !== 'ADMIN') return null
  return session
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await adminGuard()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const limit = await rateLimit(`store-products:${session.user.id}`, {
    max: 30,
    windowMs: 60 * 60 * 1000,
  })
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many changes — try again later.' }, { status: 429 })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = {}

  if (body?.name !== undefined) {
    const name = String(body.name).trim()
    if (name.length < 2 || name.length > 80) {
      return NextResponse.json({ error: 'Name must be 2–80 characters' }, { status: 400 })
    }
    patch.name = name
  }
  if (body?.tagline !== undefined) {
    const tagline = String(body.tagline).trim()
    if (tagline.length > 140) {
      return NextResponse.json({ error: 'Tagline must be at most 140 characters' }, { status: 400 })
    }
    patch.tagline = tagline || null
  }
  if (body?.price !== undefined) {
    const price = Number(body.price)
    if (!Number.isFinite(price) || price < 100 || price > 500000) {
      return NextResponse.json({ error: 'Price must be between ₦100 and ₦500,000' }, { status: 400 })
    }
    patch.price = Math.round(price)
  }
  if (body?.active !== undefined) patch.active = Boolean(body.active)
  if (body?.sortOrder !== undefined) {
    patch.sortOrder = Number.isFinite(Number(body.sortOrder))
      ? Math.round(Number(body.sortOrder))
      : 0
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  try {
    const product = await updateStoreProduct(id, patch)
    if (!product) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }
    return NextResponse.json({ product })
  } catch (e: any) {
    if (String(e?.code) === 'P2025') {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    console.error('[store] update failed:', e)
    return NextResponse.json({ error: 'Could not update the product' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await adminGuard()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  try {
    const ok = await deleteStoreProduct(id)
    if (!ok) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[store] delete failed:', e)
    return NextResponse.json({ error: 'Could not delete the product' }, { status: 500 })
  }
}
