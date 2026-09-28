// =============================================================================
// POST /api/partners — apply to join the Kozy Network (PUBLIC)
// GET  /api/partners — ADMIN/STAFF: every application + the network roster
// =============================================================================
// The public page /partners collects the operator's story; approval happens
// in the admin Partners view. Applications are rate-limited like the other
// public forms, and every application fires the admin alert.
// =============================================================================

import { NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { rateLimit, getClientIP } from '@/lib/rate-limit'
import { notifyAdminPartnerApplication } from '@/lib/notifications'

export async function POST(req: Request) {
  // Rate limit: 5 applications per IP per hour (form spam valve).
  const ip = getClientIP(req)
  const limit = await rateLimit(`partner-apply:${ip}`, { max: 5, windowMs: 60 * 60 * 1000 })
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Too many attempts — please try again in a while, or call us directly.' },
      { status: 429 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const businessName = typeof body?.businessName === 'string' ? body.businessName.trim() : ''
  const contactName = typeof body?.contactName === 'string' ? body.contactName.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : ''
  const address = typeof body?.address === 'string' ? body.address.trim() : ''
  const capacityNotes =
    typeof body?.capacityNotes === 'string' ? body.capacityNotes.trim().slice(0, 2000) : ''

  if (!businessName || businessName.length < 2) {
    return NextResponse.json({ error: 'Business name is required.' }, { status: 400 })
  }
  if (!contactName || contactName.length < 2) {
    return NextResponse.json({ error: 'Contact name is required.' }, { status: 400 })
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
  }
  if (phone.length < 7) {
    return NextResponse.json({ error: 'Phone number is required.' }, { status: 400 })
  }
  if (!address || address.length < 8) {
    return NextResponse.json({ error: 'Business address is required.' }, { status: 400 })
  }

  // Duplicate guard: same email already in the pipeline.
  const existing = await db.partner.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json(
      {
        error: 'APPLICATION_EXISTS',
        message:
          existing.status === 'PENDING'
            ? 'An application with this email is already under review — we will call you within 48 hours.'
            : existing.status === 'APPROVED'
              ? 'This email is already part of the Kozy Network. Call us if you need anything changed.'
              : 'Please call us directly about your application.',
      },
      { status: 409 }
    )
  }

  const partner = await db.partner.create({
    data: {
      businessName,
      contactName,
      email,
      phone,
      address,
      capacityNotes: capacityNotes || null,
      status: 'PENDING',
    },
  })

  after(async () => {
    try {
      await notifyAdminPartnerApplication({
        businessName,
        contactName,
        email,
        phone,
        address,
        capacityNotes: capacityNotes || null,
      })
    } catch (e) {
      console.error('[partners] admin alert failed:', e)
    }
  })

  return NextResponse.json({ ok: true, partnerId: partner.id }, { status: 201 })
}

export async function GET() {
  let session
  try {
    session = await requireRole('ADMIN', 'STAFF')
  } catch (e: any) {
    if (e instanceof Response) {
      return new NextResponse(e.body, {
        status: e.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const partners = await db.partner.findMany({ orderBy: { createdAt: 'desc' } })

  // Derived network ledger: delivered orders tagged per partner (this month
  // + lifetime). Computed here so the admin view stays a pure renderer.
  const approved = partners.filter((p) => p.status === 'APPROVED')
  let ledger: any[] = []
  if (approved.length > 0) {
    const orders = await db.order.findMany({
      where: { fulfilledByPartnerId: { in: approved.map((p) => p.id) }, status: 'DELIVERED' },
      select: { fulfilledByPartnerId: true, totalPrice: true, deliveredAt: true },
    })
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    ledger = approved.map((p) => {
      const theirs = orders.filter((o) => o.fulfilledByPartnerId === p.id)
      const lifetimeValue = theirs.reduce((s, o) => s + (o.totalPrice ?? 0), 0)
      const monthOrders = theirs.filter(
        (o) => o.deliveredAt && new Date(o.deliveredAt) >= monthStart
      )
      const monthValue = monthOrders.reduce((s, o) => s + (o.totalPrice ?? 0), 0)
      const partnerShare = (p.revenueSharePartnerPct / 100) * monthValue
      return {
        partnerId: p.id,
        ordersLifetime: theirs.length,
        ordersThisMonth: monthOrders.length,
        revenueLifetime: lifetimeValue,
        revenueThisMonth: monthValue,
        partnerShareThisMonth: Math.round(partnerShare),
        kozyShareThisMonth: Math.round(monthValue - partnerShare),
      }
    })
  }

  return NextResponse.json({ partners, ledger })
}
