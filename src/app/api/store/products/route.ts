// =============================================================================
// POST /api/store/products — a super admin lists a product (phase 77)
// =============================================================================
// ADMIN only (the office's whitelabelled hygiene add-ons: scents, soaps,
// sprays…). Products sit completely dark until a super admin ALSO switches
// store_enabled on in Settings → Store.
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { createStoreProduct } from '@/lib/kozy-store'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limit = await rateLimit(`store-products:${session.user.id}`, {
    max: 30,
    windowMs: 60 * 60 * 1000,
  })
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many changes — try again later.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const taglineRaw = typeof body?.tagline === 'string' ? body.tagline.trim() : ''
  const price = Number(body?.price)
  const active = body?.active === undefined ? true : Boolean(body?.active)
  const sortOrder = Number.isFinite(Number(body?.sortOrder)) ? Math.round(Number(body?.sortOrder)) : 0

  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ error: 'Name must be 2–80 characters' }, { status: 400 })
  }
  if (taglineRaw.length > 140) {
    return NextResponse.json({ error: 'Tagline must be at most 140 characters' }, { status: 400 })
  }
  if (!Number.isFinite(price) || price < 100 || price > 500000) {
    return NextResponse.json({ error: 'Price must be between ₦100 and ₦500,000' }, { status: 400 })
  }

  try {
    const existing = await db.storeProduct.count()
    if (existing >= 40) {
      return NextResponse.json({ error: 'Product list is full (40) — retire one first.' }, { status: 400 })
    }
    const product = await createStoreProduct({
      name,
      tagline: taglineRaw || null,
      price: Math.round(price),
      active,
      sortOrder,
    })
    return NextResponse.json({ product })
  } catch (e) {
    console.error('[store] create failed:', e)
    return NextResponse.json({ error: 'Could not save the product' }, { status: 500 })
  }
}
