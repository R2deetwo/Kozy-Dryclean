// =============================================================================
// GET /api/driver-stats — the rider response-time leaderboard (phase 69)
// =============================================================================
// The owner's ask: "encourage the riders to accept on time." Every dispatch
// writes assignedAt (auto-assign or claim) and acceptedAt (the rider's Accept
// tap or first real move on the stop). The gap between them is the rider's
// response time — this endpoint turns those gaps into a team leaderboard
// (rider app + Team → Riders) and the raw material for the monthly bonus
// pool conversation.
//
// RBAC: DRIVER / STAFF / ADMIN. Riders see the full team board — they are a
// team, and the fastest responder being visible is the point.
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/auth'

const WINDOW_DAYS = 30

export async function GET() {
  const session = await requireSession()
  const role = session.user?.role
  if (role !== 'DRIVER' && role !== 'STAFF' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000)

  // Every dispatched order in the window (assigned to a rider).
  const orders = await db.order.findMany({
    where: {
      createdAt: { gte: since },
      driverId: { not: null },
    },
    select: {
      driverId: true,
      assignedAt: true,
      acceptedAt: true,
      createdAt: true,
      status: true,
    },
    take: 2000,
    orderBy: { createdAt: 'desc' },
  })

  const drivers = await db.user.findMany({
    where: { role: 'DRIVER' },
    select: { id: true, name: true, employmentType: true, accessStatus: true },
  })

  type Row = {
    id: string
    name: string
    employmentType: 'FULL_TIME' | 'PART_TIME'
    active: boolean
    assignments: number
    accepted: number
    pendingAck: number
    avgResponseMin: number | null
    claims: number
  }

  const byId = new Map<string, Row>()
  for (const d of drivers) {
    byId.set(d.id, {
      id: d.id,
      name: d.name,
      employmentType: d.employmentType === 'FULL_TIME' ? 'FULL_TIME' : 'PART_TIME',
      active: d.accessStatus === 'ACTIVE',
      assignments: 0,
      accepted: 0,
      pendingAck: 0,
      avgResponseMin: null,
      claims: 0,
    })
  }

  const respPerDriver = new Map<string, number[]>()
  const allTimes: number[] = []
  for (const o of orders) {
    const driverId = o.driverId as string
    const row = byId.get(driverId)
    if (!row) continue
    row.assignments++
    if (o.acceptedAt) {
      row.accepted++
      const from = o.assignedAt ?? o.createdAt
      const minutes = (o.acceptedAt.getTime() - from.getTime()) / 60000
      if (minutes >= 0) {
        const list = respPerDriver.get(driverId) ?? []
        list.push(minutes)
        respPerDriver.set(driverId, list)
        allTimes.push(minutes)
        // Claimed straight from the pool: assigned and accepted within 2s.
        if (o.assignedAt && Math.abs(o.assignedAt.getTime() - o.acceptedAt.getTime()) < 2000) {
          row.claims++
        }
      }
    } else if (['REQUESTED', 'PAYMENT_VERIFIED', 'OUT_FOR_DELIVERY'].includes(o.status)) {
      row.pendingAck++
    }
  }

  for (const row of byId.values()) {
    const list = respPerDriver.get(row.id)
    if (list && list.length > 0) {
      row.avgResponseMin = Math.round((list.reduce((s, m) => s + m, 0) / list.length) * 10) / 10
    }
  }

  // The board: fastest average response first; riders with no accepted stops
  // yet sink below ranked ones (alphabetical within groups).
  const board = [...byId.values()].sort((a, b) => {
    if (a.avgResponseMin == null && b.avgResponseMin == null) return a.name.localeCompare(b.name)
    if (a.avgResponseMin == null) return 1
    if (b.avgResponseMin == null) return -1
    return a.avgResponseMin - b.avgResponseMin
  })

  const myIndex = role === 'DRIVER' ? board.findIndex((r) => r.id === session.user?.id) : -1

  return NextResponse.json({
    windowDays: WINDOW_DAYS,
    board: board.map((r, i) => ({ ...r, rank: i + 1 })),
    myIndex,
    myId: role === 'DRIVER' ? session.user?.id : null,
    teamAvgResponseMin:
      allTimes.length > 0
        ? Math.round((allTimes.reduce((s, m) => s + m, 0) / allTimes.length) * 10) / 10
        : null,
  })
}
