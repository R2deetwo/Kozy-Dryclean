// =============================================================================
// Geo service — rider geofencing for Kozy Dry-Clean (Lagos)
// =============================================================================
// Pure, isomorphic helpers (safe to import from both server routes and client
// components — no server-only dependencies).
//
// HOW IT WORKS
//   1. The driver app pings the rider's GPS position (POST /api/driver/location)
//   2. The server stores the ping and computes the distance to the nearest
//      service zone ("Lekki", "Victoria Island", …) with the haversine formula
//   3. Order activity is gated by that distance:
//        - inside a service zone  -> full route activity (stops within
//                                    ORDER_VISIBILITY_RADIUS_KM are shown)
//        - outside every zone     -> order activity paused server-side
//        - no recent ping         -> legacy behaviour (no filtering)
//   4. Order confirmations (PICKED_UP / DELIVERED) are additionally guarded by
//      ACTION_MAX_DISTANCE_KM so a rider far from a stop cannot confirm it.
//
// Zone centres are approximate district midpoints — good enough for a fence,
// they are NOT survey-grade coordinates. Tune SERVICE_ZONES below as the
// business adds/removes service areas.
// =============================================================================

export interface ServiceZone {
  /** Canonical zone name shown in the UI */
  name: string
  /** Keywords matched against free-text addresses (word-boundary, case-insensitive) */
  keywords: string[]
  lat: number
  lng: number
  /** Radius of the zone itself (km) — a rider inside this radius is "in the zone" */
  radiusKm: number
}

// ----- Lagos service zones (ordered by matching specificity, not priority) -----
export const SERVICE_ZONES: ServiceZone[] = [
  {
    name: 'Victoria Island',
    keywords: ['victoria island', 'vi', 'v.i', 'ahmadu bello', 'adeola odeku', 'ozumba mbadiwe'],
    lat: 6.4281,
    lng: 3.4219,
    radiusKm: 6,
  },
  {
    name: 'Ikoyi',
    keywords: ['ikoyi', 'banana island', 'osborne', 'park view', 'kingsway road', 'awolowo road ikoyi'],
    lat: 6.4531,
    lng: 3.4336,
    radiusKm: 6,
  },
  {
    name: 'Lekki',
    keywords: ['lekki', 'ikate', 'chevron', 'admiralty', 'idejo', 'agoro'],
    lat: 6.4392,
    lng: 3.4712,
    radiusKm: 8,
  },
  {
    name: 'Ajah',
    keywords: ['ajah', 'sangotedo', 'abraham adesanya', 'ilaje', 'badore'],
    lat: 6.4683,
    lng: 3.5673,
    radiusKm: 8,
  },
  {
    name: 'Yaba',
    keywords: ['yaba', 'akoka', 'sabo yaba', 'herbert macaulay yaba', 'unilag'],
    lat: 6.5095,
    lng: 3.3711,
    radiusKm: 6,
  },
  {
    name: 'Surulere',
    keywords: ['surulere', 'lawanson', 'bode thomas', 'shitta', 'adierin'],
    lat: 6.4931,
    lng: 3.3555,
    radiusKm: 6,
  },
  {
    name: 'Apapa',
    keywords: ['apapa', 'olodi', 'wharf road', 'iju'],
    lat: 6.4489,
    lng: 3.3592,
    radiusKm: 6,
  },
  {
    name: 'Festac',
    keywords: ['festac', 'amuwo odofin', 'okuoba', 'mile 2'],
    lat: 6.4667,
    lng: 3.2833,
    radiusKm: 6,
  },
  {
    name: 'Gbagada',
    keywords: ['gbagada', 'soluyi', 'millennium estate', 'ladipo olokun'],
    lat: 6.5551,
    lng: 3.3836,
    radiusKm: 6,
  },
  {
    name: 'Maryland',
    keywords: ['maryland', 'anthony', 'ojota', 'ikeja toll gate'],
    lat: 6.572,
    lng: 3.3667,
    radiusKm: 6,
  },
  {
    name: 'Ikeja',
    keywords: ['ikeja', 'allen avenue', 'opebi', 'alausa', 'adeniyi jones', 'omole', 'agidingbi', 'acme road'],
    lat: 6.6018,
    lng: 3.3515,
    radiusKm: 8,
  },
  {
    name: 'Magodo',
    keywords: ['magodo', 'isheri'],
    lat: 6.6172,
    lng: 3.3855,
    radiusKm: 6,
  },
]

// ----- Tunables -----
export const GEO = {
  /** Stops are shown to a rider when they are within this distance of the stop's zone centre */
  ORDER_VISIBILITY_RADIUS_KM: 12,
  /** A rider further than this from a stop's zone cannot confirm pickup/delivery */
  ACTION_MAX_DISTANCE_KM: 15,
  /** GPS pings older than this are ignored (rider app refreshes every ~60s) */
  PING_STALE_MINUTES: 30,
  /** Slack added to a zone's radius when deciding "in service area" (GPS drift) */
  ZONE_BUFFER_KM: 2,
} as const

/** Fallback centre of Lagos used only when an order has no zone match */
export const LAGOS_CENTER = { lat: 6.5, lng: 3.4 } as const

// =============================================================================
// Distance
// =============================================================================

/** Great-circle distance between two coordinates, in kilometres. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371 // Earth radius (km)
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return 2 * R * Math.asin(Math.sqrt(a))
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// =============================================================================
// Zone lookup
// =============================================================================

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const compiledPatterns = SERVICE_ZONES.map((zone) => ({
  zone,
  patterns: zone.keywords.map(
    (k) => new RegExp(`(?<![a-z])${escapeRegex(k)}(?![a-z])`, 'i')
  ),
}))

/**
 * Match a free-text Lagos address to a service zone.
 * When several zones match, the one with the LONGEST matched keyword wins
 * (e.g. "Banana Island" beats "Island"-style short matches).
 * Returns null when nothing matches — callers should treat unknown addresses
 * conservatively (still visible / never blocked).
 */
export function zoneFromAddress(address?: string | null): ServiceZone | null {
  if (!address) return null
  let best: { zone: ServiceZone; len: number } | null = null
  for (const { zone, patterns } of compiledPatterns) {
    for (const p of patterns) {
      const m = address.match(p)
      if (m && (!best || m[0].length > best.len)) {
        best = { zone, len: m[0].length }
      }
    }
  }
  return best?.zone ?? null
}

/** Nearest service zone to a coordinate (always returns one). */
export function nearestZone(lat: number, lng: number): {
  zone: ServiceZone
  distanceKm: number
} {
  let best = SERVICE_ZONES[0]
  let bestDist = Infinity
  for (const z of SERVICE_ZONES) {
    const d = haversineKm(lat, lng, z.lat, z.lng)
    if (d < bestDist) {
      best = z
      bestDist = d
    }
  }
  return { zone: best, distanceKm: bestDist }
}

/** Is the coordinate inside any service zone (zone radius + GPS buffer)? */
export function inServiceArea(lat: number, lng: number): boolean {
  const { zone, distanceKm } = nearestZone(lat, lng)
  return distanceKm <= zone.radiusKm + GEO.ZONE_BUFFER_KM
}

/**
 * Full geofence snapshot for a driver position — the shape returned by
 * /api/driver/location and consumed by the driver app banner.
 */
export function geofenceStatus(lat: number, lng: number) {
  const { zone, distanceKm } = nearestZone(lat, lng)
  const inside = distanceKm <= zone.radiusKm + GEO.ZONE_BUFFER_KM
  return {
    zone: zone.name,
    zoneRadiusKm: zone.radiusKm,
    distanceKm: round1(distanceKm),
    inServiceArea: inside,
    visibilityRadiusKm: GEO.ORDER_VISIBILITY_RADIUS_KM,
  }
}

/** Distance from a driver to an order's zone centre (null when the address is unknown). */
export function orderDistanceKm(
  driverLat: number,
  driverLng: number,
  address?: string | null
): { zone: string; distanceKm: number } | null {
  const zone = zoneFromAddress(address)
  if (!zone) return null
  return {
    zone: zone.name,
    distanceKm: round1(haversineKm(driverLat, driverLng, zone.lat, zone.lng)),
  }
}
