// =============================================================================
// POST /api/driver/location — record a rider GPS ping (geofencing)
// GET  /api/driver/location — read the rider's own last ping + fence status
// =============================================================================
// The driver app calls POST ~once a minute while the rider is on duty:
//   body: { lat: number, lng: number }
// The server stores the ping on DriverLocation and answers with the rider's
// geofence status (nearest zone, distance, in/out of service area).
//
// RBAC:
//   - DRIVER: full access (this is the feature's primary user)
//   - ADMIN:   allowed too, so the owner can test the fence from their account
//   - anyone else: 403
// =============================================================================

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { geofenceStatus, GEO } from '@/lib/geo'

const LocationPingSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

// Pings are throttled client-side to ~1/min; allow a burst for reconnects.
const PING_RATE_LIMIT = { max: 30, windowMs: 10 * 60 * 1000 }

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'DRIVER' && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const limit = rateLimit(`driver-ping:${session.user.id}`, PING_RATE_LIMIT)
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Too many location pings. Slow down.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } }
    )
  }

  const body = await req.json().catch(() => null)
  const parsed = LocationPingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid coordinates', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { lat, lng } = parsed.data
  const status = geofenceStatus(lat, lng)

  try {
    await db.driverLocation.upsert({
      where: { driverId: session.user.id },
      create: {
        driverId: session.user.id,
        lat,
        lng,
        zone: status.zone,
      },
      update: {
        lat,
        lng,
        zone: status.zone,
      },
    })
  } catch {
    // Geofencing is an additive feature — if the table is somehow missing we
    // still answer with the computed status so the app degrades gracefully.
    return NextResponse.json({
      ...status,
      stored: false,
      location: { lat, lng, updatedAt: new Date().toISOString() },
    })
  }

  return NextResponse.json({
    ...status,
    stored: true,
    location: { lat, lng, updatedAt: new Date().toISOString() },
  })
}

// ----- GET: the rider's own last ping -----
export async function GET() {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'DRIVER' && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let loc: { lat: number; lng: number; zone: string | null; updatedAt: Date } | null = null
  try {
    loc = await db.driverLocation.findUnique({ where: { driverId: session.user.id } })
  } catch {
    loc = null
  }

  if (!loc) {
    return NextResponse.json({ status: 'none', inServiceArea: null })
  }

  const fresh = Date.now() - loc.updatedAt.getTime() < GEO.PING_STALE_MINUTES * 60 * 1000
  const status = geofenceStatus(loc.lat, loc.lng)

  return NextResponse.json({
    status: fresh ? (status.inServiceArea ? 'in' : 'outside') : 'stale',
    ...status,
    inServiceArea: fresh ? status.inServiceArea : null,
    location: { lat: loc.lat, lng: loc.lng, updatedAt: loc.updatedAt.toISOString() },
  })
}
