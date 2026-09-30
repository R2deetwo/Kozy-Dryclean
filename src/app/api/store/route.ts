// =============================================================================
// GET /api/store — the customer-facing store shape (phase 77)
// =============================================================================
// PUBLIC. While the store is dark (store_enabled=false — the shipping state)
// this returns { enabled: false, products: [] } and NOTHING renders anywhere.
// When a super admin switches it on, the portal Store tab and the monthly
// email's store line read exactly this shape.
//
//   ?all=1  → ADMIN only: every product INCLUDING inactive ones (the office
//             list in Settings → Store). Anonymous/staff calls get the public
//             shape — never a 403 that would leak that the store exists.
// =============================================================================

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getAppSettings } from '@/lib/app-settings'
import { getStoreProducts, getStoreProductsForCustomers } from '@/lib/kozy-store'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const wantAll = url.searchParams.get('all') === '1'
    const settings = await getAppSettings()

    if (wantAll) {
      const session = await getSession()
      if (session?.user?.role === 'ADMIN') {
        const products = await getStoreProducts()
        return NextResponse.json({ enabled: settings.storeEnabled, products })
      }
      // Not a super admin → the public shape (no hint that a store exists).
      const products = await getStoreProductsForCustomers()
      return NextResponse.json({ enabled: settings.storeEnabled, products })
    }

    const products = await getStoreProductsForCustomers()
    return NextResponse.json({ enabled: settings.storeEnabled, products })
  } catch (e) {
    console.error('[store] GET failed:', e)
    // Dark and empty on any failure — the portal simply renders no tab.
    return NextResponse.json({ enabled: false, products: [] })
  }
}
