// =============================================================================
// Kozy Store (phase 77) — whitelabelled hygiene add-ons
// =============================================================================
// The infrastructure for the owner's future product line (scents, soaps,
// sprays…), deliberately DARK on arrival: `store_enabled` in AppSetting
// ships false, and only a super admin (the settings PUT is ADMIN-only) can
// switch it on. While dark, getStoreProductsForCustomers returns NOTHING and
// no surface renders a hint that a store exists — including the landing
// page, which never carries the store even when it IS on. When lit, active
// products appear in the customer/member portal (the Store tab) and as ONE
// strategic line in the monthly member email — never a separate mailshot.
//
// Ordering stays light on purpose (no cart, no checkout): the member taps
// "add to my next delivery", a PENDING ProductRequest lands, and the office
// confirms or declines it from Settings → Store. Money moves through the
// paths the office already runs (invoice / bank transfer / card at renewal).
//
// (Named kozy-store.ts because lib/store.ts is the legacy Zustand client
//  store — a collision an earlier draft of this file learned the hard way.)
// =============================================================================

import { db } from '@/lib/db'
import { getAppSettings } from '@/lib/app-settings'

export interface StoreProductRow {
  id: string
  name: string
  tagline: string | null
  price: number
  active: boolean
  sortOrder: number
}

function rowToProduct(r: {
  id: string
  name: string
  tagline: string | null
  price: number
  active: boolean
  sortOrder: number
}): StoreProductRow {
  return {
    id: r.id,
    name: r.name,
    tagline: r.tagline,
    price: r.price,
    active: r.active,
    sortOrder: r.sortOrder,
  }
}

/** All products (admin list), or only active ones, ordered for display. */
export async function getStoreProducts(
  opts: { activeOnly?: boolean } = {}
): Promise<StoreProductRow[]> {
  const rows = await db.storeProduct.findMany({
    where: opts.activeOnly ? { active: true } : undefined,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return rows.map(rowToProduct)
}

/** The CUSTOMER-facing shape: empty unless a super admin has switched the
 *  store on — dark means dark, so this is the single gate every public
 *  surface (portal tab, email line) reads. */
export async function getStoreProductsForCustomers(): Promise<
  { id: string; name: string; tagline: string | null; price: number }[]
> {
  const settings = await getAppSettings()
  if (!settings.storeEnabled) return []
  const rows = await db.storeProduct.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, name: true, tagline: true, price: true },
  })
  return rows
}

export interface StoreProductInput {
  name: string
  tagline?: string | null
  price: number
  active?: boolean
  sortOrder?: number
}

export async function createStoreProduct(input: StoreProductInput): Promise<StoreProductRow> {
  const row = await db.storeProduct.create({
    data: {
      name: input.name,
      tagline: input.tagline ?? null,
      price: input.price,
      active: input.active ?? true,
      sortOrder: input.sortOrder ?? 0,
    },
  })
  return rowToProduct(row)
}

export async function updateStoreProduct(
  id: string,
  patch: Partial<StoreProductInput>
): Promise<StoreProductRow | null> {
  const data: Record<string, unknown> = {}
  if (patch.name !== undefined) data.name = patch.name
  if (patch.tagline !== undefined) data.tagline = patch.tagline
  if (patch.price !== undefined) data.price = patch.price
  if (patch.active !== undefined) data.active = patch.active
  if (patch.sortOrder !== undefined) data.sortOrder = patch.sortOrder
  if (Object.keys(data).length === 0) return null
  const row = await db.storeProduct.update({ where: { id }, data })
  return rowToProduct(row)
}

export async function deleteStoreProduct(id: string): Promise<boolean> {
  try {
    await db.storeProduct.delete({ where: { id } })
    return true
  } catch {
    return false
  }
}

// -----------------------------------------------------------------------------
// Product requests — "add to my next delivery"
// -----------------------------------------------------------------------------

export interface ProductRequestRow {
  id: string
  qty: number
  status: string
  note: string | null
  createdAt: Date
  product: { id: string; name: string; price: number }
  user: { id: string; name: string; email: string; phone: string }
}

/** The office list — newest first, PENDING at the top by default. */
export async function listProductRequests(
  opts: { status?: string } = {}
): Promise<ProductRequestRow[]> {
  const rows = await db.productRequest.findMany({
    where: opts.status ? { status: opts.status } : undefined,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      product: { select: { id: true, name: true, price: true } },
      user: { select: { id: true, name: true, email: true, phone: true } },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    qty: r.qty,
    status: r.status,
    note: r.note,
    createdAt: r.createdAt,
    product: r.product,
    user: r.user,
  }))
}

export async function createProductRequest(input: {
  userId: string
  productId: string
  qty: number
  note?: string | null
}): Promise<ProductRequestRow | null> {
  // The store must be lit and the product active — checked server-side so a
  // dark store can never be ordered against even by a crafted request.
  const settings = await getAppSettings()
  if (!settings.storeEnabled) return null
  const product = await db.storeProduct.findUnique({ where: { id: input.productId } })
  if (!product || !product.active) return null
  const row = await db.productRequest.create({
    data: {
      userId: input.userId,
      productId: input.productId,
      qty: input.qty,
      note: input.note ?? null,
      status: 'PENDING',
    },
    include: {
      product: { select: { id: true, name: true, price: true } },
      user: { select: { id: true, name: true, email: true, phone: true } },
    },
  })
  return {
    id: row.id,
    qty: row.qty,
    status: row.status,
    note: row.note,
    createdAt: row.createdAt,
    product: row.product,
    user: row.user,
  }
}

export async function setProductRequestStatus(
  id: string,
  status: 'CONFIRMED' | 'DECLINED'
): Promise<ProductRequestRow | null> {
  const row = await db.productRequest.update({
    where: { id },
    data: { status },
    include: {
      product: { select: { id: true, name: true, price: true } },
      user: { select: { id: true, name: true, email: true, phone: true } },
    },
  })
  return {
    id: row.id,
    qty: row.qty,
    status: row.status,
    note: row.note,
    createdAt: row.createdAt,
    product: row.product,
    user: row.user,
  }
}
