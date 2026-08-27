// =============================================================================
// GET /api/settings/prices — PUBLIC live garment prices from PriceCatalog
// PUT /api/settings/prices — ADMIN updates garment prices (upserts PriceCatalog)
// =============================================================================
// The landing page and booking wizard previously priced items from a
// localStorage-persisted zustand store, which meant:
//   • every visitor saw the prices baked into THEIR browser's last visit
//   • admin price edits only reached the admin's own browser
//   • the server charged PriceCatalog prices regardless of what was displayed
// This endpoint makes PriceCatalog the single source of truth: the client
// displays what the server will actually charge.
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { rateLimit, getClientIP } from '@/lib/rate-limit'
import { GARMENT_CATALOG } from '@/lib/types'

export async function GET() {
  try {
    const rows = await db.priceCatalog.findMany({ where: { active: true } })
    const garmentPrices: Record<string, number> = {}
    for (const row of rows) {
      garmentPrices[row.itemKey] = row.unitPrice
    }
    return NextResponse.json({ garmentPrices })
  } catch {
    // Never break the storefront because of a catalog read failure —
    // callers fall back to the bundled GARMENT_CATALOG defaults.
    return NextResponse.json({ garmentPrices: {} })
  }
}

export async function PUT(req: Request) {
  const session = await getSession()
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Light rate limit — admin edits are rare
  const ip = getClientIP(req)
  const limit = await rateLimit(`admin-prices:${session.user.id}:${ip}`, {
    max: 30,
    windowMs: 60 * 60 * 1000,
  })
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many updates. Please try again later.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const garmentPrices = (body as { garmentPrices?: unknown })?.garmentPrices
  if (!garmentPrices || typeof garmentPrices !== 'object' || Array.isArray(garmentPrices)) {
    return NextResponse.json(
      { error: 'Expected { garmentPrices: { [itemKey]: number } }' },
      { status: 400 }
    )
  }

  // Validate every entry against the known catalog — no arbitrary keys,
  // no negative/absurd prices
  const catalogById = new Map(GARMENT_CATALOG.map((g) => [g.id, g]))
  const updates: { itemKey: string; label: string; unitPrice: number; category: string }[] = []
  for (const [itemKey, rawPrice] of Object.entries(garmentPrices as Record<string, unknown>)) {
    const catalogItem = catalogById.get(itemKey)
    if (!catalogItem) {
      return NextResponse.json(
        { error: `Unknown garment id "${itemKey}"` },
        { status: 400 }
      )
    }
    const price = Number(rawPrice)
    if (!Number.isFinite(price) || price < 0 || price > 1_000_000) {
      return NextResponse.json(
        { error: `Invalid price for "${catalogItem.name}"` },
        { status: 400 }
      )
    }
    updates.push({
      itemKey,
      label: catalogItem.name,
      unitPrice: Math.round(price),
      category: catalogItem.category,
    })
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'No prices to update' }, { status: 400 })
  }

  // Upsert each price in sequence (small N — the catalog is ~35 items)
  for (const u of updates) {
    await db.priceCatalog.upsert({
      where: { itemKey: u.itemKey },
      create: { itemKey: u.itemKey, label: u.label, unitPrice: u.unitPrice, category: u.category, active: true },
      update: { unitPrice: u.unitPrice, label: u.label, category: u.category, active: true },
    })
  }

  return NextResponse.json({ updated: updates.length })
}
