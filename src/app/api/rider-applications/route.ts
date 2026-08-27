// =============================================================================
// POST /api/rider-applications — public submission (rate-limited)
// GET  /api/rider-applications — admin-only, list all applications
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit, getClientIP } from '@/lib/rate-limit'
import { requireRole } from '@/lib/auth'

export async function POST(req: Request) {
  const ip = getClientIP(req)
  const limit = await rateLimit(`rider-app:${ip}`, { max: 3, windowMs: 60 * 60 * 1000 })
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many applications. Please try again later.' }, { status: 429 })
  }

  const body = await req.json()
  const { fullName, email, phone, altPhone, address, lga, bikeModel, bikeYear, licenseNumber, availability, experience, consent } = body

  if (!fullName || !phone || !address || !lga || !bikeModel || !bikeYear || !licenseNumber) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const application = await db.riderApplication.create({
    data: {
      fullName, email: email || null, phone, altPhone: altPhone || null,
      address, lga, bikeModel, bikeYear, licenseNumber,
      availability: availability || 'full-time',
      experience: experience || null,
      consent: !!consent,
    }
  })

  return NextResponse.json({ ok: true, id: application.id }, { status: 201 })
}

export async function GET() {
  const session = await requireRole('ADMIN')
  const applications = await db.riderApplication.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ applications })
}
