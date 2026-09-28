// =============================================================================
// POST /api/partners — apply to join the Kozy Network (PUBLIC)
// GET  /api/partners — ADMIN/STAFF: every application + the network roster
// =============================================================================
// The public page /partners collects the operator's story; approval happens
// in the admin Partners view. Applications are rate-limited like the other
// public forms, and every application fires the admin alert.
//
// Phase 72 — application parity with riders (the owner's ask: "partners
// should be able to register the same way riders sign up"): the POST is
// validated with the same strictness as /api/rider-applications (Nigerian
// mobile, LGA, at least one service chip), mints a KZP-XXXX reference, and
// the applicant gets a confirmation email + SMS immediately. GET now also
// returns each partner's settlement aggregate (settled + pending share) so
// the console's money desk and the partner portal read the same numbers.
// =============================================================================

import { NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { rateLimit, getClientIP } from '@/lib/rate-limit'
import { isValidNigerianMobile } from '@/lib/phone-validation'
import { notifyAdminPartnerApplication, notifyPartnerApplicationReceived } from '@/lib/notifications'
import { getPartnerShareLedger, getPartnerSettlementSummary } from '@/lib/partner-ledger'

/** Short application reference like KZP-7F2K (same alphabet as KZR — no
 *  ambiguous glyphs). Uniqueness enforced by the schema; retries on clash. */
function mintRefCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return `KZP-${code}`
}

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
  const lga = typeof body?.lga === 'string' ? body.lga.trim() : ''
  const capacityNotes =
    typeof body?.capacityNotes === 'string' ? body.capacityNotes.trim().slice(0, 2000) : ''
  const services = Array.isArray(body?.servicesOffered)
    ? body.servicesOffered
        .filter((s: unknown): s is string => typeof s === 'string')
        .map((s: string) => s.trim())
        .filter(Boolean)
        .slice(0, 6)
    : []

  // ----- Validation (phase 72: the same strictness riders get) -----
  const bad = (error: string, field?: string) =>
    NextResponse.json(field ? { error, field } : { error }, { status: 400 })
  if (!businessName || businessName.length < 2) {
    return bad('Business name is required.', 'businessName')
  }
  if (!contactName || !/^[A-Za-z][A-Za-z .'-]{1,}$/.test(contactName)) {
    return bad('Contact name should be your name as you would introduce yourself.', 'contactName')
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return bad('A valid email is required — your partner-portal sign-in will be emailed there.', 'email')
  }
  if (!isValidNigerianMobile(phone)) {
    return bad('Phone number must be a Nigerian mobile — e.g. 0803 222 4455 or +234 803 222 4455.', 'phone')
  }
  if (!address || address.length < 8) {
    return bad('Business address is required (street and area).', 'address')
  }
  if (!lga || lga.length < 2) {
    return bad('Tell us the Lagos area your laundry operates in.', 'lga')
  }
  if (services.length === 0) {
    return bad('Pick at least one service your laundry can process to the Kozy standard.', 'servicesOffered')
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

  // Collision-free KZP reference (practically never loops twice).
  let refCode = mintRefCode()
  for (let attempt = 0; attempt < 5; attempt++) {
    const clash = await db.partner.findUnique({ where: { refCode } })
    if (!clash) break
    refCode = mintRefCode()
  }

  const partner = await db.partner.create({
    data: {
      businessName,
      contactName,
      email,
      phone,
      address,
      lga,
      servicesOffered: services.join(', '),
      capacityNotes: capacityNotes || null,
      refCode,
      status: 'PENDING',
    },
  })

  after(async () => {
    // (1) the applicant knows it landed + what happens next — the same
    // "apply → know it landed" contract riders get (phase 54);
    // (2) the admins get the existing alert (unchanged behaviour).
    try {
      await notifyPartnerApplicationReceived({
        businessName,
        contactName,
        email,
        phone,
        lga,
        refCode,
      })
    } catch (e) {
      console.error('[partners] applicant confirmation failed:', e)
    }
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

  return NextResponse.json({ ok: true, partnerId: partner.id, refCode }, { status: 201 })
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

  const partners = await db.partner.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, name: true, email: true, accessStatus: true } } },
  })

  // Derived network ledger: delivered orders tagged per partner (this month
  // + lifetime) + the settlement money side (phase 72). Computed here so the
  // admin view stays a pure renderer — the SAME functions the partner portal
  // reads, so the two desks can never disagree.
  const approved = partners.filter((p) => p.status === 'APPROVED' || p.status === 'SUSPENDED')
  let ledger: any[] = []
  if (approved.length > 0) {
    ledger = await Promise.all(
      approved.map(async (p) => {
        const share = await getPartnerShareLedger(p)
        const money = await getPartnerSettlementSummary(p, { limit: 10 })
        return {
          partnerId: p.id,
          ordersLifetime: share.ordersLifetime,
          ordersThisMonth: share.ordersThisMonth,
          revenueLifetime: share.revenueLifetime,
          revenueThisMonth: share.revenueThisMonth,
          partnerShareThisMonth: Math.round((p.revenueSharePartnerPct / 100) * share.revenueThisMonth),
          kozyShareThisMonth: share.kozyShareThisMonth,
          shareEarned: share.shareEarned,
          settledTotal: money.settledTotal,
          pendingSettlement: money.pending,
          lastSettlementAt: money.lastSettlementAt,
          settlements: money.settlements,
        }
      })
    )
  }

  return NextResponse.json({
    partners: partners.map((p) => ({
      ...p,
      account: p.user
        ? { id: p.user.id, name: p.user.name, email: p.user.email, accessStatus: p.user.accessStatus }
        : null,
    })),
    ledger,
  })
}
