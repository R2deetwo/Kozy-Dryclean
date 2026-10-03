// =============================================================================
// GET   /api/subscriptions/[id] — ADMIN drill-down: ledger + activity + kit tag
// PATCH /api/subscriptions/[id] — ADMIN membership management
// =============================================================================
// Actions (PATCH):
//   verify       — the transfer receipt checks out → activate/renew the cycle
//   reject       — the receipt does not match → notify + keep pending (the
//                  member sees "awaiting verification" and can re-upload)
//   renew        — record a manual/cash renewal (price override optional)
//   cancel       — immediate hard cancellation (member-requested, offline)
//   kit-delivered / kit-returned / kit-replaced — the physical kit lifecycle
//   reset-usage  — zero the counters (goodwill / billing correction)
//   adjust-usage (phase 75) — move ONE counter by a signed delta with a note;
//                  writes a USAGE_ADJUST ledger row (the WHY survives)
//   nudge-usage  (phase 75) — send the at-risk member the "your pickups are
//                  waiting" email
//   nudge-renewal(phase 75) — send the transfer member a renewal reminder
//   kit-tag      (phase 75) — mint (or re-mint) the bag/box QR tag; returns
//                  the code + QR SVG for the printable label
//   preview-summary (phase 76) — render THIS member's monthly summary email
//                  and deliver it to the signed-in admin's own inbox (never
//                  to the member) — the office sees exactly what the
//                  automation would send, with real numbers
//   renew        (phase 76) — accepts `months` (1/3/6/12); defaults to the
//                  member's claimed RENEWAL_INTENT months when one is open,
//                  else 1. A multi-month confirm extends periodEnd by that
//                  many cycles and the member email says so.
//
// The verify + renew paths reuse activateOrRenewSubscription — the same
// engine the Paystack webhook drives — so a card member and a transfer
// member land in an identical state, byte for byte.
// =============================================================================

import { NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import {
  activateOrRenewSubscription,
  rowToMembership,
  getSubscriptionActivity,
  ensureKitTag,
  recordSubscriptionEvent,
  KIND_COUNTER,
} from '@/lib/subscriptions'
import {
  notifyMembershipActive,
  notifyMembershipUsageNudge,
  notifyMembershipRenewalReminder,
} from '@/lib/notifications'
import { sendMonthlySummaryFor, type SubWithPlan } from '@/lib/member-emails'
import { renewalPriceFor } from '@/lib/types'

async function guard(): Promise<ReturnType<typeof requireRole> | NextResponse | null> {
  try {
    return await requireRole('ADMIN')
  } catch (e: any) {
    if (e instanceof Response) {
      return new NextResponse(e.body, {
        status: e.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

/** The base URL a kit QR points at (kozycare.ng in prod). */
function kitTagUrl(code: string): string {
  const raw = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? ''
  const base = raw.replace(/\/$/, '')
  return `${base || 'https://kozycare.ng'}/kit/${code}`
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await guard()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const sub = await db.subscription.findUnique({
    where: { id },
    include: {
      plan: true,
      user: { select: { id: true, name: true, email: true, phone: true } },
    },
  })
  if (!sub) {
    return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
  }

  const activity = await getSubscriptionActivity(id, { eventLimit: 50 })
  return NextResponse.json({
    membership: rowToMembership(sub),
    user: sub.user,
    kitTag: sub.kitTag,
    activity,
  })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await guard()
  if (session instanceof NextResponse) return session
  const adminName = session?.user?.name || 'Admin'
  const adminId = session?.user?.id

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const action = typeof body?.action === 'string' ? body.action : ''

  const sub = await db.subscription.findUnique({
    where: { id },
    include: { plan: true, pendingPlan: true, user: { select: { id: true, name: true, email: true, phone: true } } },
  })
  if (!sub) {
    return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
  }

  // Phase 81: the activation email describes the plan the cycle actually
  // runs on — with a scheduled tier switch applied by the engine, that is
  // the NEW plan (the caller passes the updated row).
  const sendActiveEmail = (
    pricePaid: number,
    periodEnd: Date,
    months = 1,
    effective?: { plan?: { name: string; unitName: string; includedUnits: number } | null }
  ) =>
    after(async () => {
      try {
        const emailPlan = effective?.plan ?? sub.plan
        if (emailPlan && sub.user?.email) {
          await notifyMembershipActive({
            user: { name: sub.user.name, email: sub.user.email },
            planName: emailPlan.name,
            pricePaid,
            periodEnd,
            unitName: emailPlan.unitName,
            includedUnits: emailPlan.includedUnits,
            months,
          })
        }
      } catch (e) {
        console.error('[memberships] activation email failed:', e)
      }
    })

  switch (action) {
    case 'preview-summary': {
      // Render the member's monthly summary with REAL numbers and deliver
      // it to the ADMIN'S OWN inbox — the office previews the automation
      // without emailing the member.
      if (!sub.plan || !sub.user?.email) {
        return NextResponse.json({ error: 'Nothing to preview' }, { status: 400 })
      }
      const adminEmail = (session?.user as any)?.email
      if (!adminEmail) {
        return NextResponse.json({ error: 'No admin email on this session' }, { status: 400 })
      }
      try {
        const previewSub = { ...sub, user: sub.user } as unknown as SubWithPlan
        const { subjectHint } = await sendMonthlySummaryFor(previewSub, {
          overrideTo: adminEmail,
        })
        return NextResponse.json({
          ok: true,
          sentTo: adminEmail,
          subjectHint,
          note: 'Preview delivered to your own inbox — the member was not emailed.',
        })
      } catch (e) {
        console.error('[memberships] summary preview failed:', e)
        return NextResponse.json({ error: 'Preview failed' }, { status: 500 })
      }
    }
    case 'verify':
    case 'renew': {
      // renew allows a price override (goodwill discounts, founding-member
      // pricing); verify always charges the plan price. Phase 76: months —
      // explicit beats the open RENEWAL_INTENT claim, which beats 1.
      const openIntent = await db.subscriptionEvent.findFirst({
        where: { subscriptionId: id, kind: 'RENEWAL_INTENT' },
        orderBy: { createdAt: 'desc' },
      })
      let intentMonths = 1
      if (openIntent) {
        try {
          const meta = JSON.parse(openIntent.meta ?? '{}')
          if (Number.isFinite(Number(meta.months)) && Number(meta.months) >= 1) {
            intentMonths = Math.min(Math.round(Number(meta.months)), 12)
          }
        } catch {
          // malformed meta — fall back to 1
        }
      }
      const bodyMonths = Number(body?.months)
      const months =
        Number.isFinite(bodyMonths) && bodyMonths >= 1 && bodyMonths <= 12
          ? Math.round(bodyMonths)
          : intentMonths
      // Phase 81: with a member-scheduled tier switch, the cycle being paid
      // for runs on the plan being switched TO — price it there (the engine
      // applies the swap with this payment).
      const pricingPlan = sub.pendingPlan ?? sub.plan
      const price =
        action === 'renew' &&
        Number.isFinite(Number(body?.pricePaid)) &&
        Number(body?.pricePaid) >= 0
          ? Math.round(Number(body?.pricePaid))
          : renewalPriceFor(pricingPlan?.priceMonthly ?? 0, months)
      try {
        const updated = await activateOrRenewSubscription(id, {
          pricePaid: price,
          method: body?.method === 'PAYSTACK' ? 'PAYSTACK' : 'BANK_TRANSFER',
          cycles: months,
        })
        sendActiveEmail(price, updated.periodEnd, months, updated)
        console.log(
          `[memberships] ${adminName} ${action === 'verify' ? 'verified' : 'renewed'} membership ${id} (${sub.user?.email}) at ${price} naira for ${months} month${months === 1 ? '' : 's'}`
        )
        return NextResponse.json({ membership: rowToMembership(updated) })
      } catch (e) {
        console.error('[memberships] activation failed:', e)
        return NextResponse.json({ error: 'Activation failed.' }, { status: 500 })
      }
    }

    case 'reject': {
      await db.subscription.update({
        where: { id },
        data: {
          // Keep PENDING_ACTIVATION but drop the receipt so the member is
          // prompted to re-upload; the portal explains the rejection.
          transferReceipt: null,
        },
      })
      return NextResponse.json({ ok: true })
    }

    case 'cancel': {
      const updated = await db.subscription.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelAtPeriodEnd: false,
          cancelledAt: new Date(),
          cancelledReason:
            typeof body?.reason === 'string' && body.reason.trim()
              ? body.reason.trim().slice(0, 300)
              : `Cancelled by ${adminName}`,
        },
        include: { plan: true, pendingPlan: true },
      })
      return NextResponse.json({ membership: rowToMembership(updated) })
    }

    case 'kit-delivered': {
      const updated = await db.subscription.update({
        where: { id },
        data: { kitState: 'WITH_MEMBER', kitDeliveredAt: new Date() },
        include: { plan: true, pendingPlan: true },
      })
      await recordSubscriptionEvent({
        subscriptionId: id,
        kind: 'KIT_DELIVERED',
        delta: 0,
        count: 0,
        note: 'Kit delivered (recorded by office)',
        recordedById: adminId,
      })
      return NextResponse.json({ membership: rowToMembership(updated) })
    }

    case 'kit-returned':
    case 'kit-replaced': {
      const updated = await db.subscription.update({
        where: { id },
        data: { kitState: action === 'kit-returned' ? 'RETURNED' : 'REPLACED' },
        include: { plan: true, pendingPlan: true },
      })
      await recordSubscriptionEvent({
        subscriptionId: id,
        kind: action === 'kit-returned' ? 'KIT_RETURNED' : 'KIT_REPLACED',
        delta: 0,
        count: 0,
        note: action === 'kit-returned' ? 'Kit returned to the office' : 'Kit replaced — fee charged',
        recordedById: adminId,
      })
      return NextResponse.json({ membership: rowToMembership(updated) })
    }

    case 'reset-usage': {
      const updated = await db.subscription.update({
        where: { id },
        data: {
          unitsUsed: 0,
          extraUnitsUsed: 0,
          shoesUsed: 0,
          duvetsUsed: 0,
          curtainsUsed: 0,
          springCleanUsed: 0,
          bedsheetsUsed: 0,
        },
        include: { plan: true, pendingPlan: true },
      })
      await recordSubscriptionEvent({
        subscriptionId: id,
        kind: 'USAGE_ADJUST',
        delta: 0,
        count: 0,
        note: 'Counters reset to zero (office correction)',
        recordedById: adminId,
      })
      return NextResponse.json({ membership: rowToMembership(updated) })
    }

    // ----- Phase 75: the retention desk -----

    case 'adjust-usage': {
      // { counter: 'unitsUsed' | 'shoesUsed' | 'duvetsUsed' | 'bedsheetsUsed' | 'curtainsUsed' | 'springCleanUsed',
      //   delta: signed int, note: required }
      const counter = typeof body?.counter === 'string' ? body.counter : ''
      const delta = Math.round(Number(body?.delta))
      const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 300) : ''
      const allowed = Object.values(KIND_COUNTER) as string[]
      if (!allowed.includes(counter) || !Number.isFinite(delta) || delta === 0) {
        return NextResponse.json(
          { error: 'adjust-usage needs { counter, delta (nonzero), note }' },
          { status: 400 }
        )
      }
      if (!note) {
        return NextResponse.json(
          { error: 'A note is required — the ledger records WHY' },
          { status: 400 }
        )
      }
      const before = (sub as any)[counter] ?? 0
      const after = Math.max(0, before + delta)
      const updated = await db.subscription.update({
        where: { id },
        data: { [counter]: after },
        include: { plan: true, pendingPlan: true },
      })
      await recordSubscriptionEvent({
        subscriptionId: id,
        kind: 'USAGE_ADJUST',
        delta: after - before,
        count: 0,
        meta: { counter, before, after },
        note: `${note} — ${adminName}`,
        recordedById: adminId,
      })
      return NextResponse.json({ membership: rowToMembership(updated) })
    }

    case 'nudge-usage': {
      if (!sub.plan || !sub.user?.email || !sub.periodEnd) {
        return NextResponse.json({ error: 'Nothing to nudge — no plan, email or period.' }, { status: 400 })
      }
      const remaining = Math.max(0, sub.plan.includedUnits - sub.unitsUsed)
      after(async () => {
        try {
          await notifyMembershipUsageNudge({
            user: { name: sub.user!.name, email: sub.user!.email },
            planName: sub.plan!.name,
            unitName: sub.plan!.unitName,
            unitsRemaining: remaining,
            periodEnd: sub.periodEnd!,
          })
        } catch (e) {
          console.error('[memberships] usage nudge failed:', e)
        }
      })
      return NextResponse.json({ ok: true, sent: 'usage-nudge' })
    }

    case 'nudge-renewal': {
      if (!sub.plan || !sub.user?.email || !sub.periodEnd) {
        return NextResponse.json({ error: 'Nothing to remind — no plan, email or period.' }, { status: 400 })
      }
      after(async () => {
        try {
          await notifyMembershipRenewalReminder({
            user: { name: sub.user!.name, email: sub.user!.email },
            planName: sub.plan!.name,
            priceMonthly: sub.plan!.priceMonthly,
            periodEnd: sub.periodEnd!,
          })
        } catch (e) {
          console.error('[memberships] renewal reminder failed:', e)
        }
      })
      return NextResponse.json({ ok: true, sent: 'renewal-reminder' })
    }

    // ----- Phase 75: the bag/box QR tag -----

    case 'kit-tag': {
      // Mints on first use; re-mint=true issues a FRESH code (worn/swapped
      // bag — the old code dies with the row update).
      try {
        if (body?.reMint === true) {
          await db.subscription.update({ where: { id }, data: { kitTag: null } })
        }
        const code = await ensureKitTag(id)
        const url = kitTagUrl(code)
        // The QR as inline SVG — drop-in for the label preview + print page.
        const QRCode = (await import('qrcode')).default
        const qrSvg = await QRCode.toString(url, {
          type: 'svg',
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#0A192F', light: '#FFFFFF' },
        })
        await recordSubscriptionEvent({
          subscriptionId: id,
          kind: 'KIT_TAG_MINTED',
          delta: 0,
          count: 0,
          meta: { code, reMint: body?.reMint === true },
          note: body?.reMint === true ? 'Kit tag re-minted (new label printed)' : 'Kit tag minted',
          recordedById: adminId,
        })
        return NextResponse.json({ code, url, qrSvg })
      } catch (e: any) {
        console.error('[memberships] kit tag mint failed:', e)
        return NextResponse.json({ error: e?.message ?? 'Could not mint the tag' }, { status: 500 })
      }
    }

    default:
      return NextResponse.json(
        {
          error: 'Unknown action',
          actions: [
            'verify', 'reject', 'renew', 'cancel', 'kit-delivered', 'kit-returned',
            'kit-replaced', 'reset-usage', 'adjust-usage', 'nudge-usage',
            'nudge-renewal', 'kit-tag',
          ],
        },
        { status: 400 }
      )
  }
}
