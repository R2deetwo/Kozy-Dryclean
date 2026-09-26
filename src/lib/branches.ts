// =============================================================================
// Branches (phase 62) — Ogombo & Chevron Drive, the two processing hubs
// =============================================================================
// Every order's pickup lands at a branch. Assignment happens server-side at
// order creation:
//   1. Zone the pickup address (the battle-tested geo.ts matcher that rider
//      geofencing already uses — 'Lekki', 'Ajah', …).
//   2. The branch OWNING that zone takes the order (zoneNames is a JSON
//      array of SERVICE_ZONES names).
//   3. No zone match → the nearest branch by GPS distance.
//   4. No branches configured / DB down → the default branch, or null
//      (legacy behaviour: no branch routing — never blocks a booking).
//
// Same self-seeding pattern as AppSetting/PriceCatalog: a fresh database
// gets Ogombo + Chevron Drive on first read, admin edits reach everyone.
// =============================================================================

import { db } from '@/lib/db'
import { zoneFromAddress, haversineKm } from '@/lib/geo'
import type { Branch } from '@/lib/types'

interface BranchSeed {
  name: string
  slug: string
  address: string
  phone: string
  zoneNames: string[]
  lat: number
  lng: number
  isDefault: boolean
  sortOrder: number
}

// ----- The owner's two locations -----
// Ogombo is the HQ (default branch): it owns the Ajah/eastern corridor.
// Chevron Drive owns the island corridor (VI / Ikoyi / Lekki). Mainland
// zones fall back to the NEAREST branch until a third location exists.
export const DEFAULT_BRANCHES: BranchSeed[] = [
  {
    name: 'Ogombo',
    slug: 'ogombo',
    address: 'No 20. Westsyde Drive, Ogombo, Lagos State',
    phone: '+2348031755230',
    zoneNames: ['Ajah', 'Yaba', 'Surulere', 'Apapa', 'Festac', 'Gbagada', 'Maryland', 'Ikeja', 'Magodo'],
    lat: 6.4683,
    lng: 3.5673,
    isDefault: true,
    sortOrder: 1,
  },
  {
    name: 'Chevron Drive',
    slug: 'chevron',
    address: 'Paradise 3 Estate, Road 5/3, Chevron, Lagos State',
    phone: '+2348031755230',
    zoneNames: ['Victoria Island', 'Ikoyi', 'Lekki'],
    lat: 6.4392,
    lng: 3.4712,
    isDefault: false,
    sortOrder: 2,
  },
]

export function rowToBranch(row: any): Branch {
  let zoneNames: string[] = []
  try {
    const parsed = JSON.parse(row.zoneNames ?? '[]')
    if (Array.isArray(parsed)) zoneNames = parsed.map(String)
  } catch {
    zoneNames = []
  }
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    address: row.address,
    phone: row.phone ?? null,
    zoneNames,
    lat: row.lat,
    lng: row.lng,
    isActive: Boolean(row.isActive),
    isDefault: Boolean(row.isDefault),
    sortOrder: row.sortOrder,
    createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt),
    updatedAt: row.updatedAt?.toISOString?.() ?? String(row.updatedAt),
  }
}

/** All branches, display-ordered. Seeds the two defaults on an empty table. */
export async function getBranches(includeInactive = true): Promise<Branch[]> {
  try {
    let rows = await db.branch.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
    if (rows.length === 0) {
      for (const seed of DEFAULT_BRANCHES) {
        try {
          await db.branch.create({
            data: { ...seed, zoneNames: JSON.stringify(seed.zoneNames) },
          })
        } catch {
          // Lost a create race — harmless.
        }
      }
      rows = await db.branch.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
    }
    const mapped = rows.map(rowToBranch)
    return includeInactive ? mapped : mapped.filter((b) => b.isActive)
  } catch {
    // DB unavailable — code defaults keep surfaces rendering.
    return DEFAULT_BRANCHES.map((seed, i) => ({
      ...seed,
      id: `default-${seed.slug}`,
      isActive: true,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      sortOrder: seed.sortOrder || i + 1,
    }))
  }
}

/**
 * Decide which branch a pickup belongs to.
 *   zone match → owning branch; else nearest active branch; else default.
 * Returns null when no branch could be resolved (legacy behaviour).
 */
export async function assignBranchForAddress(
  pickupAddress: string
): Promise<{ branchId: string; branchName: string; reason: string } | null> {
  const branches = await getBranches(false) // active only
  if (branches.length === 0) return null

  const zone = zoneFromAddress(pickupAddress)
  if (zone) {
    const owner = branches.find((b) => b.zoneNames.includes(zone.name))
    if (owner) {
      return {
        branchId: owner.id,
        branchName: owner.name,
        reason: `${zone.name} zone → ${owner.name}`,
      }
    }
  }

  // No zone (or the zone has no owner yet) → nearest branch by distance.
  const zoneCenter = zone ?? { lat: 6.5, lng: 3.4 }
  let best = branches[0]
  let bestDist = Infinity
  for (const b of branches) {
    const d = haversineKm(zoneCenter.lat, zoneCenter.lng, b.lat, b.lng)
    if (d < bestDist) {
      best = b
      bestDist = d
    }
  }
  const fallback = branches.find((b) => b.isDefault) ?? best
  return {
    branchId: fallback.id,
    branchName: fallback.name,
    reason: zone
      ? `No owner for ${zone.name} → nearest (${fallback.name}, ${bestDist.toFixed(1)} km)`
      : `Unzoned address → nearest (${fallback.name}, ${bestDist.toFixed(1)} km)`,
  }
}
