// =============================================================================
// Server-side app settings — AppSetting table (single source of truth)
// =============================================================================
// Why this exists (client-reported bug): bank details and commercial terms
// used to live in the localStorage-persisted zustand store, so an admin edit
// only reached the ADMIN's browser — every other visitor kept seeing the
// stale defaults baked into the bundle. AppSetting moves all of it to the
// database: the public GET below is what the storefront reads, and an admin
// PUT updates it for EVERYONE instantly.
//
// Seeding is self-healing and idempotent: getAppSettings() upserts any
// missing key with the code default on first read, so a fresh database (or a
// new environment) is populated without a separate migration step.
// =============================================================================

import { db } from '@/lib/db'
import {
  type KozyAppSettings,
  defaultAppSettings,
} from '@/lib/types'

/** Canonical key list — also drives admin Settings validation. */
export const APP_SETTING_KEYS = [
  'bank_name',
  'account_name',
  'account_number',
  'contact_phone',
  'contact_email',
  'delivery_fee',
  'handwash_surcharge_percent',
  'guarantee_min_garments',
  'guarantee_min_order_value',
  'first_order_discount_percent',
  'hotel_guest_discount_percent',
  'hotel_guest_promo_code',
  'alterations_from_price',
] as const

export type AppSettingKey = (typeof APP_SETTING_KEYS)[number]

/** Map DB rows onto the typed settings shape. */
function rowsToSettings(rows: { key: string; value: string }[]): KozyAppSettings {
  const map = new Map(rows.map((r) => [r.key, r.value]))
  const num = (key: AppSettingKey, fallback: number) => {
    const raw = map.get(key)
    if (raw === undefined) return fallback
    const parsed = Number(JSON.parse(raw))
    return Number.isFinite(parsed) ? parsed : fallback
  }
  const str = (key: AppSettingKey, fallback: string) => {
    const raw = map.get(key)
    if (raw === undefined) return fallback
    try {
      const parsed = JSON.parse(raw)
      return typeof parsed === 'string' ? parsed : fallback
    } catch {
      return fallback
    }
  }
  const d = defaultAppSettings()
  return {
    bankName: str('bank_name', d.bankName),
    accountName: str('account_name', d.accountName),
    accountNumber: str('account_number', d.accountNumber),
    contactPhone: str('contact_phone', d.contactPhone),
    contactEmail: str('contact_email', d.contactEmail),
    deliveryFee: num('delivery_fee', d.deliveryFee),
    handwashSurchargePercent: num('handwash_surcharge_percent', d.handwashSurchargePercent),
    guaranteeMinGarments: num('guarantee_min_garments', d.guaranteeMinGarments),
    guaranteeMinOrderValue: num('guarantee_min_order_value', d.guaranteeMinOrderValue),
    firstOrderDiscountPercent: num('first_order_discount_percent', d.firstOrderDiscountPercent),
    hotelGuestDiscountPercent: num('hotel_guest_discount_percent', d.hotelGuestDiscountPercent),
    hotelGuestPromoCode: str('hotel_guest_promo_code', d.hotelGuestPromoCode),
    alterationsFromPrice: num('alterations_from_price', d.alterationsFromPrice),
  }
}

/**
 * Read the settings, upserting defaults for any missing key so the table
 * self-seeds on first access. Callers wrap in try/catch — a settings failure
 * must never break an order; fall back to `defaultAppSettings()`.
 */
export async function getAppSettings(): Promise<KozyAppSettings> {
  try {
    const rows = await db.appSetting.findMany()
    const existing = new Set(rows.map((r) => r.key))
    const d = defaultAppSettings()
    const seed: Record<AppSettingKey, string> = {
      bank_name: JSON.stringify(d.bankName),
      account_name: JSON.stringify(d.accountName),
      account_number: JSON.stringify(d.accountNumber),
      contact_phone: JSON.stringify(d.contactPhone),
      contact_email: JSON.stringify(d.contactEmail),
      delivery_fee: JSON.stringify(d.deliveryFee),
      handwash_surcharge_percent: JSON.stringify(d.handwashSurchargePercent),
      guarantee_min_garments: JSON.stringify(d.guaranteeMinGarments),
      guarantee_min_order_value: JSON.stringify(d.guaranteeMinOrderValue),
      first_order_discount_percent: JSON.stringify(d.firstOrderDiscountPercent),
      hotel_guest_discount_percent: JSON.stringify(d.hotelGuestDiscountPercent),
      hotel_guest_promo_code: JSON.stringify(d.hotelGuestPromoCode),
      alterations_from_price: JSON.stringify(d.alterationsFromPrice),
    }
    const missing = (Object.keys(seed) as AppSettingKey[]).filter((k) => !existing.has(k))
    if (missing.length > 0) {
      // Best-effort seed — concurrent first requests may race; upsert makes
      // that harmless.
      await Promise.all(
        missing.map((key) =>
          db.appSetting.upsert({
            where: { key },
            update: {},
            create: { key, value: seed[key] },
          })
        )
      )
      const fresh = await db.appSetting.findMany()
      return rowsToSettings(fresh)
    }
    return rowsToSettings(rows)
  } catch {
    // DB unavailable (e.g. build-time prerender) — code defaults keep every
    // surface rendering correct values.
    return defaultAppSettings()
  }
}

/** Persist a partial update. Only known keys are accepted (validated by the
 *  API route before calling this). */
export async function saveAppSettings(patch: Partial<KozyAppSettings>): Promise<KozyAppSettings> {
  const map: Partial<Record<AppSettingKey, string>> = {}
  if (patch.bankName !== undefined) map.bank_name = JSON.stringify(patch.bankName)
  if (patch.accountName !== undefined) map.account_name = JSON.stringify(patch.accountName)
  if (patch.accountNumber !== undefined) map.account_number = JSON.stringify(patch.accountNumber)
  if (patch.contactPhone !== undefined) map.contact_phone = JSON.stringify(patch.contactPhone)
  if (patch.contactEmail !== undefined) map.contact_email = JSON.stringify(patch.contactEmail)
  if (patch.deliveryFee !== undefined) map.delivery_fee = JSON.stringify(Math.round(patch.deliveryFee))
  if (patch.handwashSurchargePercent !== undefined)
    map.handwash_surcharge_percent = JSON.stringify(patch.handwashSurchargePercent)
  if (patch.guaranteeMinGarments !== undefined)
    map.guarantee_min_garments = JSON.stringify(Math.round(patch.guaranteeMinGarments))
  if (patch.guaranteeMinOrderValue !== undefined)
    map.guarantee_min_order_value = JSON.stringify(Math.round(patch.guaranteeMinOrderValue))
  if (patch.firstOrderDiscountPercent !== undefined)
    map.first_order_discount_percent = JSON.stringify(patch.firstOrderDiscountPercent)
  if (patch.hotelGuestDiscountPercent !== undefined)
    map.hotel_guest_discount_percent = JSON.stringify(patch.hotelGuestDiscountPercent)
  if (patch.hotelGuestPromoCode !== undefined)
    map.hotel_guest_promo_code = JSON.stringify(patch.hotelGuestPromoCode.toUpperCase().trim())
  if (patch.alterationsFromPrice !== undefined)
    map.alterations_from_price = JSON.stringify(Math.round(patch.alterationsFromPrice))

  await Promise.all(
    (Object.keys(map) as AppSettingKey[]).map((key) =>
      db.appSetting.upsert({
        where: { key },
        update: { value: map[key]! },
        create: { key, value: map[key]! },
      })
    )
  )
  return getAppSettings()
}
