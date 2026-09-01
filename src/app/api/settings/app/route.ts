// =============================================================================
// GET  /api/settings/app — PUBLIC. Server-managed settings the storefront
//                           renders (bank details at checkout, delivery fee,
//                           handwash surcharge, guarantee thresholds, offer
//                           percentages, alterations from-price).
// PUT  /api/settings/app — ADMIN. Update any subset of the settings; the
//                           change is live for every visitor immediately.
// =============================================================================
// The bank-account case is the client-reported bug this fixes: details used
// to be admin-editable only in their own browser (localStorage), so the
// checkout kept showing stale account details to customers. Bank details are
// deliberately public-readable — every customer choosing "Bank Transfer" at
// checkout must see them, so there is nothing to gate here.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { rateLimit, getClientIP } from '@/lib/rate-limit'
import { getAppSettings, saveAppSettings } from '@/lib/app-settings'
import { isValidEmail } from '@/lib/email-validation'
import type { KozyAppSettings } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  const settings = await getAppSettings()
  // paystackAvailable is derived from the server env on every read — it is
  // never persisted, so adding PAYSTACK_SECRET_KEY to the environment
  // re-enables card checkout for everyone without any DB change.
  const payload: KozyAppSettings = {
    ...settings,
    paystackAvailable: Boolean(process.env.PAYSTACK_SECRET_KEY),
  }
  // The admin-alert config (destination inbox + toggles) is the business
  // owner's private setting — the storefront never renders it, so it is
  // stripped for everyone except signed-in admins (prevents harvesting the
  // owner's inbox address from the public payload).
  if (!session || session.user?.role !== 'ADMIN') {
    delete (payload as Partial<KozyAppSettings>).adminAlertsEmail
    delete (payload as Partial<KozyAppSettings>).adminAlertsNewSignup
    delete (payload as Partial<KozyAppSettings>).adminAlertsNewOrder
    delete (payload as Partial<KozyAppSettings>).adminAlertsPaymentPending
  }
  return NextResponse.json({ settings: payload })
}

export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ip = getClientIP(req)
  const limit = await rateLimit(`admin-app-settings:${session.user.id}:${ip}`, {
    max: 30,
    windowMs: 60 * 60 * 1000,
  })
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many updates. Please try again later.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const patch = (body as { settings?: unknown })?.settings
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return NextResponse.json({ error: 'Expected { settings: { ... } }' }, { status: 400 })
  }

  const p = patch as Record<string, unknown>
  const out: Partial<KozyAppSettings> = {}
  const errors: string[] = []

  const str = (key: keyof KozyAppSettings, max: number) => {
    const v = p[key]
    if (v === undefined) return
    if (typeof v !== 'string' || v.trim().length === 0 || v.trim().length > max) {
      errors.push(`${String(key)} must be 1–${max} characters`)
      return
    }
    ;(out as Record<string, unknown>)[key] = v.trim()
  }
  const pct = (key: keyof KozyAppSettings, min: number, max: number) => {
    const v = p[key]
    if (v === undefined) return
    const n = Number(v)
    if (!Number.isFinite(n) || n < min || n > max) {
      errors.push(`${String(key)} must be between ${min} and ${max}`)
      return
    }
    ;(out as Record<string, unknown>)[key] = n
  }

  str('bankName', 80)
  str('accountName', 120)
  str('accountNumber', 30)
  str('contactPhone', 40)
  str('contactEmail', 120)
  // Admin alert emails — accepts a comma/semicolon-separated LIST of valid
  // addresses (client request: alerts reach both owners). Every entry must
  // be a complete email so a typo can't silently swallow every future alert.
  {
    const v = p.adminAlertsEmail
    if (v !== undefined) {
      if (typeof v !== 'string') {
        errors.push('adminAlertsEmail must be a comma-separated list of email addresses')
      } else {
        const parts = v
          .split(/[,;\n]/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
        if (parts.length === 0 || parts.length > 6 || !parts.every((s) => isValidEmail(s))) {
          errors.push(
            'adminAlertsEmail must be 1–6 complete email addresses, comma-separated (e.g. kozygarmentcare@gmail.com,practiceprosystems@gmail.com)'
          )
        } else {
          ;(out as Record<string, unknown>).adminAlertsEmail = parts.join(',')
        }
      }
    }
  }
  // Alert toggles — plain booleans.
  const flag = (key: keyof KozyAppSettings) => {
    const v = p[key]
    if (v === undefined) return
    if (typeof v !== 'boolean') {
      errors.push(`${String(key)} must be true or false`)
      return
    }
    ;(out as Record<string, unknown>)[key] = v
  }
  flag('adminAlertsNewSignup')
  flag('adminAlertsNewOrder')
  flag('adminAlertsPaymentPending')
  pct('deliveryFee', 0, 100000)
  pct('handwashSurchargePercent', 0, 200)
  pct('guaranteeMinGarments', 0, 100)
  pct('guaranteeMinOrderValue', 0, 1000000)
  pct('firstOrderDiscountPercent', 0, 50)
  pct('hotelGuestDiscountPercent', 0, 50)
  str('hotelGuestPromoCode', 24)
  pct('alterationsFromPrice', 0, 100000)
  pct('pricePerKg', 0, 1000000)
  pct('minimumKg', 0, 1000)

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }
  if (Object.keys(out).length === 0) {
    return NextResponse.json({ error: 'No settings to update' }, { status: 400 })
  }

  const settings = await saveAppSettings(out)
  // Keep the derived flag consistent across GET and PUT responses.
  return NextResponse.json({
    settings: { ...settings, paystackAvailable: Boolean(process.env.PAYSTACK_SECRET_KEY) },
  })
}
