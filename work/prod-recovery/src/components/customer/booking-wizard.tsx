'use client'

// =============================================================================
// BookingWizard — 4-step checkout (Service → Condition → Logistics → Pay)
// =============================================================================
// Condition-photo step (Return-as-Received Guarantee) — button contract:
//   - "Skip for now" is the GUEST escape hatch: anyone (guest or member)
//     moves on without photos, no login required, no guarantee / no 5%.
//   - "Continue" is the upload path: it nudges the customer to add photos
//     and acknowledge the terms. A guest who has uploaded photos is asked
//     to sign in / create an account so the guarantee is tied to their
//     identity (that's how claims can be honoured). Members sail through.
//   - The auth-gate modal's escape button performs the skip ("Skip for now —
//     continue without the guarantee"), so declining to sign in never dead-
//     ends the checkout.
//
// Draft persistence:
//   Selections (items, addresses, step, guest details) auto-save to
//   localStorage (see src/lib/booking-draft.ts) and restore the next time the
//   wizard opens — "Welcome back — continue where you left off." Photos
//   stashed for the auth gate ride in sessionStorage (same tab) so they
//   survive the login round-trip.
// =============================================================================

import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  LogIn,
  Camera,
  Check,
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  CreditCard,
  Building2,
  User,
  Shield,
  ShieldCheck,
  Plus,
  Minus,
  Info,
  Upload,
  X,
  Sparkles,
  Zap,
  Truck,
  Tag,
  Ruler,
  MailCheck,
  BadgeCheck,
  Loader2,
  RefreshCw,
  Gift,
} from 'lucide-react'
import {
  GARMENT_CATALOG,
  SERVICE_SPEEDS,
  allowsExpress24,
  formatNaira,
  type GarmentCatalogItem,
  type OrderItem,
  type OrderType,
  type Order,
  type ServiceSpeed,
} from '@/lib/types'
import { useStore } from '@/lib/store'
import { useServerPrices, useAppSettings } from '@/lib/hooks'
import {
  MEN_CATALOG_GROUPS,
  WOMEN_CATALOG_GROUPS,
  WIZARD_SHARED_GROUPS,
  SHOES_GROUP,
  itemsForGroup,
  catalogTabForCategory,
  type CatalogDisplayGroup,
  type CatalogTab,
} from '@/lib/pricing-groups'
import {
  loadSavedMeasurements,
  formatMeasurementsForNote,
  hasValues,
  type SavedMeasurements,
} from '@/lib/measurements'
import { useSession, signIn } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import {
  loadDraft,
  saveDraft,
  clearDraft,
  rememberAuthRedirect,
} from '@/lib/booking-draft'

// Zustand is now only used for settings (pricing config) — orders/payments go through the API
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'

interface Props {
  onComplete: (order: Order, meta?: { guestAccountCreated?: boolean }) => void
  onCancel: () => void
  /** Allow booking without an account (guest checkout). The guest's
   *  contact details are collected in step 3 and a customer record is
   *  created server-side. */
  allowGuest?: boolean
  /** Tab the "Select service" step opens on — used for deep links such as
   *  the landing page's "Book shoe care" CTA (/book?service=shoes). When
   *  omitted the tab is derived from the restored draft (if any) or Men. */
  initialCatalogTab?: CatalogTab
}

const STEPS = [
  { id: 1, name: 'Service', icon: User },
  { id: 2, name: 'Condition', icon: Camera },
  { id: 3, name: 'Logistics', icon: MapPin },
  { id: 4, name: 'Checkout', icon: CreditCard },
]

const TIME_SLOTS = [
  '08:00 - 09:00',
  '09:00 - 10:00',
  '10:00 - 11:00',
  '11:00 - 12:00',
  '13:00 - 14:00',
  '14:00 - 15:00',
  '15:00 - 16:00',
  '16:00 - 17:00',
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** sessionStorage keys for the condition-photo flow (phase 51).
 *
 * Photos upload to /api/media/stage ONE BY ONE while the customer fills
 * the wizard — a 30-photo basket inside the order POST would breach the
 * serverless request-size limit (the reason uploads used to cap at 6, which
 * sent a 30-garment customer to WhatsApp). Only the staged IDs + tiny
 * thumbnails are stashed client-side, so the stash survives the guest login
 * round-trip and reloads without ever approaching the sessionStorage quota.
 *
 * GATE_PHOTOS_KEY is the LEGACY pre-phase-51 stash (full data URLs); it is
 * read once on mount and re-staged through the new pipeline. */
const GATE_PHOTOS_KEY = 'kozy:gate-photos'
const PHOTO_STASH_KEY = 'kozy:condition-photos'
const STAGE_TOKEN_KEY = 'kozy:stage-token'

/** How many condition photos one order may carry. */
const PHOTO_LIMIT = 30

/** One condition photo in the wizard. `id` is the staged-photo ID on the
 *  server; `data` (memory only, never stashed) keeps the compressed data
 *  URL so a failed upload can be retried without re-reading the file. */
type ConditionPhoto = {
  key: string
  id?: string
  url: string
  thumb: string
  name: string
  data?: string
  status: 'uploading' | 'done' | 'failed'
}

/** Default pickup date: tomorrow. */
function defaultPickupDate() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function BookingWizard({ onComplete, onCancel, allowGuest = false, initialCatalogTab }: Props) {
  // Guarantee % from the client-side default (matches the server constant);
  // per-kg pricing comes from appSettings (server) below. The store is no
  // longer consulted for money values (audit finding).
  const settings = useStore((s) => s.settings)
  const { data: session, status: sessionStatus } = useSession()
  const sessionUser = session?.user
  const isGuest = allowGuest && sessionStatus !== 'loading' && !sessionUser
  const effectiveUser = sessionUser ? {
    id: (sessionUser as any).id || '',
    email: sessionUser.email || '',
    name: sessionUser.name || '',
    phone: '',
    role: (sessionUser as any).role || 'B2C',
    address: undefined,
    company: undefined,
    createdAt: '',
  } : undefined

  const [step, setStep] = useState(1)
  const [type, setType] = useState<OrderType>('ITEM')
  const [items, setItems] = useState<Record<string, number>>({})
  // Mode of wash — required choice on retail orders (client-requested
  // order-form option). MACHINE is standard; HANDWASH adds the gentle-care
  // surcharge. Kept as null until the customer picks, so the choice is
  // genuinely explicit.
  const [modeOfWash, setModeOfWash] = useState<'MACHINE' | 'HANDWASH' | null>(null)
  // Optional offer/coupon code. First order: the classic hotel/corporate
  // offer (e.g. HOTEL15) — any order: general coupon codes from newsletters
  // and promos (phase 36).
  const [promoCode, setPromoCode] = useState('')
  // Live validation of the typed code (phase 36): the customer taps Apply,
  // the server checks the exact same rules checkout will use, and the
  // result drives the on-screen estimate + an inline success/error note.
  // Null until the customer taps Apply; typing resets it.
  const [couponCheck, setCouponCheck] = useState<{
    code: string
    valid: boolean
    message?: string
    couponName?: string
    discountAmount?: number
    type?: 'PERCENTAGE' | 'FIXED'
    value?: number
  } | null>(null)
  const [couponChecking, setCouponChecking] = useState(false)
  // Alterations note (Phase 17): what the seamstress should change on which
  // garment. Collected via a guided panel whenever alteration items are in
  // the basket — riders never measure at the door; the seamstress works
  // from this note and calls the customer to confirm before quoting.
  const [alterationNotes, setAlterationNotes] = useState('')
  // Saved measurements from the free /measurements guide (Phase 18): offered
  // as a one-tap attach so repeat alteration customers never re-type their
  // sizes ("if they want alterations, they don't have to put their size in
  // all the time"). Lives in localStorage — private to this browser.
  const [savedMeasurements, setSavedMeasurements] = useState<SavedMeasurements | null>(null)
  const [photos, setPhotos] = useState<ConditionPhoto[]>([])
  const [guaranteeAck, setGuaranteeAck] = useState(false)
  const [pickupAddress, setPickupAddress] = useState('')
  const [pickupDate, setPickupDate] = useState(defaultPickupDate)
  const [pickupSlot, setPickupSlot] = useState(TIME_SLOTS[1])
  const [serviceSpeed, setServiceSpeed] = useState<ServiceSpeed>('STANDARD')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'BANK_TRANSFER' | 'PAYSTACK'>('BANK_TRANSFER')
  const [receiptUploaded, setReceiptUploaded] = useState(false)
  // The downscaled transfer-receipt image (data URL) — sent with the order
  // and stored on the BANK_TRANSFER payment record so admin verifies against
  // the actual screenshot, not a mock.
  const [receiptData, setReceiptData] = useState<string | null>(null)
  const [catalogTab, setCatalogTab] = useState<CatalogTab>(initialCatalogTab ?? 'men')
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  /** Staging token for this wizard session (see STAGE_TOKEN_KEY above) —
   *  presented with the photo IDs when the order is created so only this
   *  browser can claim the photos it staged. */
  const stageTokenRef = useRef<string>('')
  const receiptInputRef = useRef<HTMLInputElement>(null)

  // ----- Member gate + draft resume state -----
  const [showAuthGate, setShowAuthGate] = useState(false)
  const [gateEmail, setGateEmail] = useState('')
  const [gateChecking, setGateChecking] = useState(false)
  const [resumedAt, setResumedAt] = useState<number | null>(null)
  /** Set once the restore effect has run — auto-save waits for it. */
  const hydrated = useRef(false)
  const gateEmailValid = EMAIL_RE.test(gateEmail.trim())

  // ----- Guest checkout contact details (collected in step 3) -----
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [accountExists, setAccountExists] = useState(false)
  // Phase 36 (bank-transfer "stuck screen" fix): when a returning customer
  // checks out as a guest with their account email, a MODAL (not a notice
  // below the fold) asks for their password, signs them in, and re-submits
  // the exact same booking — so they still land on the "we're verifying your
  // payment / you'll get an email" page instead of a dead-looking button.
  const [accountPassword, setAccountPassword] = useState('')
  const [accountSigningIn, setAccountSigningIn] = useState(false)
  const [accountError, setAccountError] = useState<string | null>(null)
  /** Persistent, on-screen explanation of the LAST FAILED submit. Toasts
   *  expire after ~5s at the top of the screen and the account-exists
   *  notice lives in the step-3 form — a phone customer who just tapped
   *  the confirm button at the bottom of a long page could see NOTHING
   *  change (the exact recurring "I've made the transfer does nothing"
   *  complaint). This banner renders directly above the confirm button on
   *  EVERY step and stays until dismissed or retried, so a failed submit
   *  can never again be indistinguishable from a dead button. */
  const [submitError, setSubmitError] = useState<{
    title: string
    message: string
    showSignIn?: boolean
  } | null>(null)
  const guestEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())
  const guestPhoneValid = guestPhone.trim().length >= 7
  const guestValid =
    guestName.trim().length >= 2 && guestEmailValid && guestPhoneValid

  // ----- Live prices from the server (PriceCatalog) -----
  // Displayed prices must match what POST /api/orders will actually charge.
  const serverPrices = useServerPrices()

  // ----- Server-managed app settings (bank details, fees, offers) -----
  // The server is the single source of truth — an admin edit reaches this
  // checkout on the next page load (fixes stale per-browser bank details).
  const appSettings = useAppSettings()

  // ----- Card payments availability (Paystack) -----
  // Derived server-side from the presence of PAYSTACK_SECRET_KEY. While card
  // payments are off, the Paystack option renders greyed-out & disabled with
  // a clear "not available at the moment" note — the customer is steered to
  // bank transfer instead of selecting card and hitting a dead end.
  const paystackAvailable = appSettings.paystackAvailable === true

  // ----- Scroll to the top on every step change (phase 70) -----
  // Owner note: moving between wizard steps kept the OLD scroll position, so
  // a customer deep in a long step list landed mid-page on the next step.
  // Every step transition now starts at the top of the page — the flow reads
  // top-to-bottom like a fresh page, matching how Next.js route changes
  // behave (instant, not smooth — a long smooth glide feels slower than the
  // step itself). The stepRef guard skips the mount render (a fresh load is
  // already at the top) while still catching a draft restore that re-enters
  // at a later step (setStep happens after mount, so the values differ).
  const stepRef = useRef(step)
  useEffect(() => {
    if (stepRef.current !== step) {
      stepRef.current = step
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [step])

  useEffect(() => {
    if (!paystackAvailable && paymentMethod === 'PAYSTACK') {
      setPaymentMethod('BANK_TRANSFER')
    }
  }, [paystackAvailable, paymentMethod])

  // ----- First-order / first-delivery detection -----
  // The server decides authoritatively at order time; this only powers the
  // live estimate. Authed customers: their order list answers it. Guests:
  // assume first order (their guest account is brand new, or the server
  // will correct the total when reusing an existing guest account).
  const isFirstOrderEstimate = useQuery({
    queryKey: ['wizard-orders', effectiveUser?.id ?? 'guest'],
    queryFn: async () => {
      const res = await fetch('/api/orders?limit=1')
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      return (data.items?.length ?? 0) > 0
    },
    enabled: Boolean(effectiveUser),
    staleTime: 60 * 1000,
    retry: 0,
  })
  const isFirstOrder = !effectiveUser ? true : isFirstOrderEstimate.data === false

  // ----- Phase 53: loyalty state ("after 10 washes, the 11th is free") -----
  // Signed-in customers only — the server applies the earned complimentary
  // service authoritatively at order time; this fetch only powers the quiet
  // "this one's on us" note on the payment step so nobody is surprised by
  // a zero total. Guests never see it (no history to earn with).
  const loyaltyQuery = useQuery({
    queryKey: ['wizard-loyalty', effectiveUser?.id ?? 'guest'],
    queryFn: async () => {
      const res = await fetch('/api/loyalty')
      if (!res.ok) throw new Error('failed')
      return (await res.json()) as { unlocked: boolean; visible: boolean }
    },
    enabled: Boolean(effectiveUser),
    staleTime: 60 * 1000,
    retry: 0,
  })
  const loyaltyUnlocked = loyaltyQuery.data?.unlocked === true

  // ----- Saved measurements (Phase 18) -----
  // Loaded once on mount from localStorage (set by the /measurements guide).
  // If present and filled, the alterations panel offers a one-tap attach.
  useEffect(() => {
    setSavedMeasurements(loadSavedMeasurements())
  }, [])

  // Keep the tiny stash ({id, name, thumb} of staged photos) in sync on
  // every change — it is what restores the basket after the guest login
  // round-trip or an accidental reload (the full photos are already
  // server-side, so a few KB is all the client ever holds).
  useEffect(() => {
    try {
      const compact = photos
        .filter((p) => p.status === 'done' && p.id)
        .map((p) => ({ id: p.id as string, name: p.name, thumb: p.thumb }))
      if (compact.length > 0) {
        sessionStorage.setItem(PHOTO_STASH_KEY, JSON.stringify(compact))
      } else {
        sessionStorage.removeItem(PHOTO_STASH_KEY)
      }
    } catch {
      /* quota/unavailable — the photos are staged server-side already */
    }
  }, [photos])


  // ----- Restore a saved draft ("continue where you left off") -----
  // Runs once on mount, BEFORE the profile prefill effect below so a restored
  // address is never clobbered.
  useEffect(() => {
    hydrated.current = true

    // ----- Staging token (phase 51): one per tab, survives reloads -----
    try {
      let tok = sessionStorage.getItem(STAGE_TOKEN_KEY) || ''
      if (!tok || tok.length < 8) {
        tok =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID().replace(/-/g, '')
            : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
        sessionStorage.setItem(STAGE_TOKEN_KEY, tok)
      }
      stageTokenRef.current = tok
    } catch {
      stageTokenRef.current = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
    }

    // Photos stashed before the guarantee gate's login round-trip (or an
    // accidental reload): restore them (once) so the customer doesn't have
    // to re-upload after signing in. The terms checkbox is deliberately NOT
    // restored — acknowledging the guarantee terms must stay an explicit,
    // current action.
    try {
      const stashed = sessionStorage.getItem(PHOTO_STASH_KEY)
      if (stashed) {
        const parsed = JSON.parse(stashed) as { id: string; name: string; thumb: string }[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPhotos(
            parsed.map((p, i) => ({
              key: `restored-${p.id}-${i}`,
              id: p.id,
              url: p.thumb || '',
              thumb: p.thumb || '',
              name: p.name || `Photo ${i + 1}`,
              status: 'done' as const,
            }))
          )
        }
        sessionStorage.removeItem(PHOTO_STASH_KEY)
      } else {
        // LEGACY pre-phase-51 stash (full data URLs): re-stage through the
        // new pipeline so their IDs can ride along with the order. Oversized
        // old photos (>400k chars) simply fail their tile — remove/re-add.
        const legacy = sessionStorage.getItem(GATE_PHOTOS_KEY)
        if (legacy) {
          const parsed = JSON.parse(legacy) as { url: string; name: string }[]
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPhotos(
              parsed.map((p, i) => ({
                key: `legacy-${i}`,
                url: p.url,
                thumb: p.url,
                name: p.name || `Photo ${i + 1}`,
                data: p.url,
                status: 'uploading' as const,
              }))
            )
            void (async () => {
              for (let i = 0; i < parsed.length; i++) {
                try {
                  const res = await fetch('/api/media/stage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: stageTokenRef.current, photo: parsed[i].url }),
                  })
                  if (!res.ok) throw new Error('staging failed')
                  const { id } = await res.json()
                  setPhotos((prev) =>
                    prev.map((x, xi) => (xi === i && x.key === `legacy-${i}` ? { ...x, id, status: 'done' } : x))
                  )
                } catch {
                  setPhotos((prev) =>
                    prev.map((x, xi) => (xi === i && x.key === `legacy-${i}` ? { ...x, status: 'failed' } : x))
                  )
                }
              }
            })()
          }
          sessionStorage.removeItem(GATE_PHOTOS_KEY)
        }
      }
    } catch {
      /* corrupt stash or unavailable sessionStorage — ignore */
    }

    const d = loadDraft()
    if (!d) return
    setResumedAt(d.savedAt)
    // B2B drafts can never sit on the (hidden) condition step
    setStep(d.type === 'KG' && d.step === 2 ? 3 : d.step)
    setType(d.type)
    setItems(d.items)
    setPickupAddress(d.pickupAddress || '')
    setPickupDate(d.pickupDate || defaultPickupDate())
    setPickupSlot(d.pickupSlot || TIME_SLOTS[1])
    setDeliveryAddress(d.deliveryAddress || '')
    if (d.serviceSpeed === 'EXPRESS_48' || d.serviceSpeed === 'EXPRESS_24') {
      setServiceSpeed(d.serviceSpeed)
    }
    if (d.modeOfWash === 'MACHINE' || d.modeOfWash === 'HANDWASH') {
      setModeOfWash(d.modeOfWash)
    }
    if (typeof d.promoCode === 'string') setPromoCode(d.promoCode)
    if (typeof d.alterationNotes === 'string') setAlterationNotes(d.alterationNotes)
    // A restored PAYSTACK choice is safe: if card payments are switched off,
    // the paystackAvailable effect below forces BANK_TRANSFER immediately.
    if (d.paymentMethod === 'BANK_TRANSFER' || d.paymentMethod === 'PAYSTACK') {
      setPaymentMethod(d.paymentMethod)
    }
    if (d.guestName) setGuestName(d.guestName)
    if (d.guestEmail) setGuestEmail(d.guestEmail)
    if (d.guestPhone) setGuestPhone(d.guestPhone)

    // Land the catalog on the tab that holds most of the restored items, so
    // a returning customer sees their basket's tab instead of a default that
    // looks empty while the selection bar says otherwise. An explicit
    // initialCatalogTab (URL deep link) always wins.
    if (!initialCatalogTab) {
      const counts: Record<CatalogTab, number> = { men: 0, women: 0, shoes: 0 }
      for (const [id, qty] of Object.entries(d.items)) {
        counts[catalogTabForCategory(GARMENT_CATALOG.find((g) => g.id === id)?.category)] += qty
      }
      const best = (Object.keys(counts) as CatalogTab[]).reduce(
        (a, b) => (counts[b] > counts[a] ? b : a),
        'men'
      )
      if (counts[best] > 0) setCatalogTab(best)
    }
  }, [])

  // Populate address fields once we have the current user (never overwrite
  // an address the customer — or a restored draft — already filled in)
  useEffect(() => {
    if (effectiveUser?.address) {
      setPickupAddress((prev) => prev || effectiveUser.address!)
      setDeliveryAddress((prev) => prev || effectiveUser.address!)
    }
  }, [effectiveUser?.address])
  // If this user is B2B, default the type to KG
  useEffect(() => {
    if (effectiveUser?.role === "B2B") setType("KG")
  }, [effectiveUser?.role])

  // ----- Auto-save the draft as the customer progresses -----
  useEffect(() => {
    if (!hydrated.current) return // never save before the restore pass has run
    const hasContent =
      step > 1 ||
      Object.keys(items).length > 0 ||
      Boolean(pickupAddress) ||
      Boolean(deliveryAddress) ||
      Boolean(guestEmail)
    if (!hasContent) return
    saveDraft({
      savedAt: Date.now(),
      step,
      type,
      items,
      pickupAddress,
      pickupDate,
      pickupSlot,
      serviceSpeed,
      modeOfWash: modeOfWash ?? undefined,
      promoCode: promoCode || undefined,
      alterationNotes: alterationNotes || undefined,
      deliveryAddress,
      paymentMethod,
      guestName,
      guestEmail,
      guestPhone,
    })
  }, [step, type, items, pickupAddress, pickupDate, pickupSlot, serviceSpeed, modeOfWash, promoCode, alterationNotes, deliveryAddress, paymentMethod, guestName, guestEmail, guestPhone])

  // ----- Computed pricing (memoized for performance) -----
  // Must be called BEFORE any early returns (Rules of Hooks)
  const selectedItems: OrderItem[] = useMemo(() => {
    if (!effectiveUser && !isGuest) return []
    return Object.entries(items)
      .filter(([, q]) => q > 0)
      .map(([id, q]) => {
        const g = GARMENT_CATALOG.find((c) => c.id === id)!
        // Server prices (PriceCatalog) win; persisted settings and bundle
        // defaults are only fallbacks — the customer must see what the
        // server will charge at checkout.
        const unitPrice = serverPrices?.[id] ?? settings.garmentPrices[id] ?? g.price
        return { id: 'item_' + id, name: g.name, quantity: q, unitPrice }
      })
  }, [items, serverPrices, settings.garmentPrices, effectiveUser, isGuest])
  const subtotal = selectedItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  // ----- Quoted items (wedding dress, couture) -----
  // They sit in the basket at ₦0 and are priced after a free assessment —
  // the summary and checkout surfaces call this out so the ₦0 never reads
  // as "free".
  const quoteItemNames: string[] = Object.entries(items)
    .filter(([, q]) => q > 0)
    .map(([id]) => GARMENT_CATALOG.find((c) => c.id === id))
    .filter((c): c is GarmentCatalogItem => c?.pricingMode === 'quote')
    .map((c) => c.name)
  const hasQuoteItems = quoteItemNames.length > 0
  const quoteOnly = hasQuoteItems && subtotal === 0
  // Phase 53: the customer has earned their complimentary service ("after
  // 10 washes, the 11th is free") and THIS basket is a payable retail one —
  // the payment step collapses into a quiet "on the house" panel (no payment
  // radios, no coupon field: nothing to pay).
  const complimentaryCheckout = loyaltyUnlocked && type === 'ITEM' && !quoteOnly
  // ----- Alterations (Phase 17) -----
  const hasAlterationItems = (items['alteration'] ?? 0) > 0
  const alterationNotesValid = alterationNotes.trim().length >= 10
  // ----- Turnaround tier -----
  // Express 24 is blocked when bulky household items are in the basket
  // (matches the server-side rule in POST /api/orders).
  const selectedItemIds = Object.entries(items)
    .filter(([, q]) => q > 0)
    .map(([id]) => id)
  const express24Allowed = allowsExpress24(selectedItemIds)
  const effectiveSpeed: ServiceSpeed =
    !express24Allowed && serviceSpeed === 'EXPRESS_24' ? 'STANDARD' : serviceSpeed
  const speedOption =
    SERVICE_SPEEDS.find((s) => s.id === effectiveSpeed) ?? SERVICE_SPEEDS[0]
  const expressSurcharge = Math.round(subtotal * speedOption.surcharge)
  // Staged photos (server-side) — the count that gates the guarantee, not
  // tiles still uploading or failed ones.
  const stagedPhotoCount = photos.filter((p) => p.status === 'done').length
  const guaranteeActive =
    type === 'ITEM' && !isGuest && stagedPhotoCount > 0 && guaranteeAck

  // ----- Phase-14 pricing components -----
  // Handwash gentle-care surcharge: +50% (admin-tunable) of the cleaning
  // subtotal — machine wash is standard and free of surcharge.
  const handwashSurcharge =
    type === 'ITEM' && modeOfWash === 'HANDWASH'
      ? Math.round(subtotal * (appSettings.handwashSurchargePercent / 100))
      : 0
  // Delivery: free on the first order, the going rate (admin-tunable)
  // afterwards. Estimate only — the server re-verifies at order time.
  const deliveryFeeEstimate = isFirstOrder ? 0 : appSettings.deliveryFee
  // First-order offer: the hotel/corporate code REPLACES the standard first-order
  // discount (15% vs 10%); the 5% picture discount stacks on top of either.
  const trimmedCode = promoCode.trim().toUpperCase()
  const isHotelCode =
    isFirstOrder && trimmedCode === appSettings.hotelGuestPromoCode.toUpperCase()
  // ----- Phase 36: live-validated coupon -----
  // Only counts when it was validated against THIS code (typing after Apply
  // resets the result server-side of the mismatch). A valid coupon replaces
  // the first-order estimate exactly like the server's checkout rule.
  const validatedCoupon =
    couponCheck?.valid && couponCheck.code === trimmedCode ? couponCheck : null
  const couponPct =
    type === 'ITEM' && validatedCoupon?.type === 'PERCENTAGE'
      ? Math.max(0, Math.min(validatedCoupon.value ?? 0, 100))
      : 0
  const firstOrderPercent = isHotelCode
    ? appSettings.hotelGuestDiscountPercent
    : appSettings.firstOrderDiscountPercent
  const firstOrderDiscountActive =
    type === 'ITEM' && isFirstOrder && subtotal > 0 && !validatedCoupon
  // ----- Phase-30: permanent online-order discount (client directive) -----
  // Registered customers get a standing discount on EVERY online order (the
  // registration incentive); guests see a sign-in offer in the summary
  // instead. Mirrors the server's eligibility rule exactly (authed,
  // non-admin) and reads the SAME server-backed setting, so the preview
  // always matches what POST /api/orders will charge.
  const onlineDiscountPct =
    type === 'ITEM' && !isGuest && subtotal > 0
      ? Math.max(0, appSettings.onlineOrderDiscountPercent)
      : 0
  // Guest CTA for the online-order discount: deep-links into /signup with
  // the contact details they already typed (name/email/phone prefill is
  // supported by the signup page) and returns them to the wizard, where the
  // saved-draft restore puts this exact basket back on screen.
  const discountSignupHref =
    '/signup?callbackUrl=/book' +
    (guestEmailValid ? `&email=${encodeURIComponent(guestEmail.trim())}` : '') +
    (guestName.trim().length >= 2 ? `&name=${encodeURIComponent(guestName.trim())}` : '') +
    (guestPhone.trim().length >= 7 ? `&phone=${encodeURIComponent(guestPhone.trim())}` : '')
  // Discounts apply to the SERVICE charge (cleaning + handwash + express),
  // never to the delivery fee — mirrors the server's math exactly.
  const serviceSubtotal = subtotal + handwashSurcharge + expressSurcharge
  // A FIXED coupon subtracts its naira amount (never more than the service
  // charge) — mirrors computeCouponAmount on the server.
  const couponFlatAmount =
    type === 'ITEM' && validatedCoupon?.type === 'FIXED'
      ? Math.min(validatedCoupon.value ?? 0, serviceSubtotal)
      : 0
  // Preview of the coupon's saving for the summary row (PERCENTAGE coupon
  // savings recompute against the live basket)
  const couponPreviewAmount =
    validatedCoupon == null
      ? 0
      : validatedCoupon.type === 'PERCENTAGE'
        ? Math.round(serviceSubtotal * (couponPct / 100))
        : couponFlatAmount
  const discountPercent =
    (guaranteeActive ? settings.guaranteeDiscountPercent : 0) +
    (firstOrderDiscountActive ? firstOrderPercent : 0) +
    onlineDiscountPct +
    couponPct
  const discount = serviceSubtotal * (discountPercent / 100)
  const grossTotal = subtotal + expressSurcharge
  const total =
    Math.max(0, Math.round(serviceSubtotal - discount - couponFlatAmount)) + deliveryFeeEstimate

  // ----- Phase 36: live coupon validation -----
  // Checks the typed code against the SERVER's exact checkout rules (same
  // functions, same DB) so what the customer sees is what checkout charges.
  // Guests pass their email so first-order + per-user rules can be evaluated;
  // signed-in customers are identified by their session.
  const applyCoupon = async () => {
    if (!trimmedCode || couponChecking) return
    setCouponChecking(true)
    try {
      const res = await fetch('/api/marketing/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: trimmedCode,
          serviceSubtotal,
          ...(isGuest && guestEmailValid
            ? { email: guestEmail.trim().toLowerCase() }
            : {}),
        }),
      })
      const data = await res.json().catch(() => ({
        valid: false,
        message: 'Could not check that code — it will still be validated when you confirm.',
      }))
      setCouponCheck({ code: trimmedCode, ...data })
    } catch {
      setCouponCheck({
        code: trimmedCode,
        valid: false,
        message:
          'Network hiccup — tap Apply again. Codes are always validated at confirmation anyway.',
      })
    } finally {
      setCouponChecking(false)
    }
  }

  // Defensive guard — auth gate should prevent this, but we don't want to
  // crash. Guest mode (allowGuest) bypasses the session requirement.
  if (!effectiveUser && !isGuest) {
    return (
      <div className="p-10 text-center text-sm text-navy-300">
        {sessionStatus === 'loading' ? 'Loading…' : 'Please sign in to start a booking.'}
      </div>
    )
  }
  const isB2B = effectiveUser?.role === "B2B"

  // ----- Helpers -----
  const setQty = (id: string, delta: number) => {
    setItems((prev) => {
      const next = { ...prev }
      const q = (next[id] ?? 0) + delta
      if (q <= 0) delete next[id]
      else next[id] = q
      return next
    })
  }

  // ----- Catalog item card (one row of the Select-service grids) -----
  const renderCatalogCard = (g: GarmentCatalogItem) => {
    const qty = items[g.id] ?? 0
    // 'from' → price is a floor (Restoration); 'quote' → no price yet
    // (wedding dress & couture — assessed, then quoted for approval).
    const unitPrice = serverPrices?.[g.id] ?? settings.garmentPrices[g.id] ?? g.price
    const priceLine =
      g.pricingMode === 'quote'
        ? 'By quote — after assessment'
        : g.pricingMode === 'from'
          ? `From ${formatNaira(unitPrice)}`
          : `${formatNaira(unitPrice)} each`
    return (
      <div
        key={g.id}
        className={cn(
          'flex items-center justify-between rounded-xl border p-3 transition',
          qty > 0
            ? 'border-gold-300 bg-gold-50/50 ring-1 ring-gold-200'
            : 'border-navy-100 hover:border-gold-200'
        )}
      >
        <div className="flex items-center gap-2">
          <img src={g.icon} alt="" className="h-7 w-7" />
          <div>
            <p className="text-sm font-medium text-navy">{g.name}</p>
            <p
              className={cn(
                'text-xs',
                g.pricingMode ? 'font-semibold text-gold-600' : 'text-navy-300'
              )}
            >
              {priceLine}
            </p>
            {/* Disambiguation line (e.g. Lace / Aso-Ebi Gown vs Dress vs Ankara Gown) */}
            {g.description && (
              <p className="mt-0.5 max-w-[30ch] text-[11px] leading-snug text-navy-300/90">
                {g.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setQty(g.id, -1)}
            disabled={qty === 0}
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-navy-200 text-navy transition hover:bg-navy-100 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label={`Remove one ${g.name}`}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-8 text-center text-sm font-bold text-navy">{qty}</span>
          <button
            onClick={() => setQty(g.id, 1)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0A192F] text-white shadow-md transition hover:bg-[#1B3A5F] active:scale-95"
            aria-label={`Add one ${g.name}`}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  // ----- A titled block of catalog cards (e.g. "Shirts & Tops") -----
  const renderCatalogGroup = (group: CatalogDisplayGroup) => (
    <div key={group.title} className="mt-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-600">
        {group.title}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {itemsForGroup(group).map(renderCatalogCard)}
      </div>
    </div>
  )

  // ----- Condition photos (phase 51): compress → stage → reference -----
  // Every photo uploads to /api/media/stage the moment it is selected
  // (three at a time — gentle on mobile networks), so a 30-garment basket
  // never has to fit inside one order request. The order POST sends only
  // the staged IDs; the server moves them into the order's evidence rows.

  /** Patch one photo entry in state (by its stable key). */
  const updatePhoto = (key: string, patch: Partial<ConditionPhoto>) =>
    setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)))

  /** Compress one condition photo adaptively: start at full detail and step
   *  down (edge, then quality) only while it is too big to stage. Stays
   *  legible for damage claims — the whole point of the evidence trail —
   *  while each staged upload stays ~150-200KB. */
  const compressConditionPhoto = (
    file: File
  ): Promise<{ dataUrl: string; thumb: string }> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('Could not read the image'))
      reader.onload = () => {
        const img = new Image()
        img.onerror = () => reject(new Error('Could not decode the image'))
        img.onload = () => {
          const draw = (maxEdge: number, quality: number) => {
            const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
            const canvas = document.createElement('canvas')
            canvas.width = Math.max(1, Math.round(img.width * scale))
            canvas.height = Math.max(1, Math.round(img.height * scale))
            const ctx = canvas.getContext('2d')
            if (!ctx) throw new Error('Canvas unavailable')
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            return canvas.toDataURL('image/jpeg', quality)
          }
          try {
            // Target ≤ ~210k chars of data URL (~155KB binary): small enough
            // to stage in one request, detailed enough for a damage claim.
            const attempts: Array<[number, number]> = [
              [1440, 0.8],
              [1200, 0.72],
              [1080, 0.64],
              [960, 0.58],
            ]
            let dataUrl = ''
            for (const [edge, quality] of attempts) {
              dataUrl = draw(edge, quality)
              if (dataUrl.length <= 210_000) break
            }
            // Pathological detail (dense noise, intricate lace at full
            // frame): step edge AND quality down together until it fits.
            // Quality never drops below 0.35 and the edge never below 640px
            // — past those the evidence stops being legible, and the
            // server's 400k-char cap is the final ceiling.
            const descent: Array<[number, number]> = [
              [960, 0.5],
              [960, 0.42],
              [840, 0.38],
              [720, 0.35],
              [640, 0.35],
            ]
            for (const [edge, quality] of descent) {
              if (dataUrl.length <= 210_000) break
              dataUrl = draw(edge, quality)
            }
            // Tiny thumbnail for the stash (a few KB — never the full photo).
            const tScale = Math.min(1, 200 / Math.max(img.width, img.height))
            const tCanvas = document.createElement('canvas')
            tCanvas.width = Math.max(1, Math.round(img.width * tScale))
            tCanvas.height = Math.max(1, Math.round(img.height * tScale))
            const tCtx = tCanvas.getContext('2d')
            const thumb = tCtx
              ? (tCtx.drawImage(img, 0, 0, tCanvas.width, tCanvas.height),
                tCanvas.toDataURL('image/jpeg', 0.6))
              : ''
            resolve({ dataUrl, thumb })
          } catch (e) {
            reject(e instanceof Error ? e : new Error('Compression failed'))
          }
        }
        img.src = reader.result as string
      }
      reader.readAsDataURL(file)
    })

  /** Upload one compressed photo to the staging endpoint. */
  const stagePhoto = async (dataUrl: string): Promise<string> => {
    const res = await fetch('/api/media/stage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: stageTokenRef.current, photo: dataUrl }),
    })
    if (!res.ok) throw new Error('Staging failed')
    const data = await res.json()
    if (!data || typeof data.id !== 'string') throw new Error('Staging failed')
    return data.id
  }

  /** Compress + stage one file, updating its tile as it goes. */
  const processPhotoFile = async (key: string, file: File) => {
    try {
      const { dataUrl, thumb } = await compressConditionPhoto(file)
      updatePhoto(key, { url: thumb, thumb, data: dataUrl })
      const id = await stagePhoto(dataUrl)
      updatePhoto(key, { id, url: dataUrl, status: 'done' })
    } catch {
      updatePhoto(key, { status: 'failed' })
    }
  }

  const onPhotos = (files: FileList | null) => {
    if (!files) return
    // Condition photos are compressed and staged one-by-one (phase 51 — see
    // the block comment above). The old handler kept FULL-SIZE originals in
    // component state and capped the basket at 6 because everything had to
    // fit inside the order request body.
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (imageFiles.length === 0) return
    const room = PHOTO_LIMIT - photos.length
    if (room <= 0) {
      toast({
        title: 'Photo limit reached',
        description: `You can attach up to ${PHOTO_LIMIT} condition photos to one order — more than any basket needs.`,
      })
      return
    }
    const picked = imageFiles.slice(0, room)
    if (picked.length < imageFiles.length) {
      toast({
        title: `Only ${picked.length} photo${picked.length === 1 ? '' : 's'} added`,
        description: `Each order carries at most ${PHOTO_LIMIT} condition photos.`,
      })
    }
    const jobs = picked.map((file, i) => ({
      key: `${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 8)}`,
      file,
    }))
    setPhotos((prev) => [
      ...prev,
      ...jobs.map((j) => ({
        key: j.key,
        url: '',
        thumb: '',
        name: j.file.name,
        status: 'uploading' as const,
      })),
    ])
    // Small worker pool: three concurrent uploads — phones on slow networks
    // get steady progress instead of thirty simultaneous requests.
    void (async () => {
      let cursor = 0
      const worker = async () => {
        while (cursor < jobs.length) {
          const job = jobs[cursor++]
          await processPhotoFile(job.key, job.file)
        }
      }
      await Promise.all([worker(), worker(), worker()])
    })()
  }

  /** Retry one failed upload (the compressed data URL is kept in memory). */
  const retryPhoto = async (key: string) => {
    const photo = photos.find((p) => p.key === key)
    if (!photo?.data) return
    updatePhoto(key, { status: 'uploading' })
    try {
      const id = await stagePhoto(photo.data)
      updatePhoto(key, { id, status: 'done' })
    } catch {
      updatePhoto(key, { status: 'failed' })
    }
  }

  /** Remove a photo (a already-staged row is simply orphaned — the server
   *  purges unclaimed staged photos after 24h). */
  const removePhoto = (key: string) => {
    setPhotos((prev) => prev.filter((p) => p.key !== key))
  }

  /** Downscale an image file to a compact JPEG data URL (max edge 1200px,
   *  quality 0.82) — keeps the transfer-receipt upload small enough to ride
   *  along with the order request (~150–350KB) while staying legible for the
   *  admin verification queue. */
  const downscaleImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('Could not read the image'))
      reader.onload = () => {
        const img = new Image()
        img.onerror = () => reject(new Error('Could not decode the image'))
        img.onload = () => {
          const maxEdge = 1200
          const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(1, Math.round(img.width * scale))
          canvas.height = Math.max(1, Math.round(img.height * scale))
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Canvas unavailable'))
            return
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/jpeg', 0.82))
        }
        img.src = reader.result as string
      }
      reader.readAsDataURL(file)
    })

  const onReceipt = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const file = files[0]
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Receipt not attached',
        description: 'Please attach a screenshot or photo of your transfer receipt.',
        variant: 'destructive',
      })
      return
    }
    try {
      // Real receipt capture: downscaled client-side, then sent with the
      // order and stored on the payment record for the admin queue.
      const dataUrl = await downscaleImage(file)
      setReceiptData(dataUrl)
      setReceiptUploaded(true)
    } catch {
      toast({
        title: 'Receipt not attached',
        description: "We couldn't read that image — you can continue without it.",
        variant: 'destructive',
      })
    }
  }

  const canContinue = () => {
    if (step === 1) {
      if (type === 'ITEM')
        // Mode of wash is a REQUIRED choice on the order form (client
        // directive) — the customer must pick handwash or machine wash.
        return selectedItems.length > 0 && modeOfWash !== null
      return true // B2B always continues (just requests pickup)
    }
    if (step === 2) return true // condition capture is optional
    if (step === 3)
      return Boolean(
        pickupAddress && pickupDate && pickupSlot && (!isGuest || guestValid)
      )
    if (step === 4) return true
    return false
  }

  const next = () => {
    // B2B (per-kg) orders have no condition-capture step — jump straight
    // over it (both when leaving step 1 and defensively from step 2)
    if (type === 'KG' && (step === 1 || step === 2)) {
      setStep(3)
      return
    }
    if (step < 4) setStep(step + 1)
  }
  const prev = () => {
    if (step === 3 && type === 'KG') {
      // Skip back to step 1 for B2B
      setStep(1)
      return
    }
    if (step > 1) setStep(step - 1)
  }

  // ---- Guest guarantee-gate helpers -------------------------------------
  // "Skip for now" is free for everyone (guests included) — it simply forgoes
  // the guarantee. The auth gate only appears when a GUEST who has uploaded
  // photos tries to CONTINUE, because claiming the guarantee (5% off + damage
  // coverage) requires an account we can honour claims against.

  /** Force-save the current state as a draft (used right before the gate
   *  redirects the customer away to login/signup). */
  const ensureDraftSaved = () => {
    saveDraft({
      savedAt: Date.now(),
      step,
      type,
      items,
      pickupAddress,
      pickupDate,
      pickupSlot,
      deliveryAddress,
      paymentMethod,
      guestName,
      guestEmail,
      guestPhone,
    })
  }

  const openAuthGate = () => {
    ensureDraftSaved()
    // The staged-photo stash stays in sync automatically (the effect above
    // persists {id, name, thumb} — a few KB — on every change), so the
    // login round-trip restores this basket's photos without re-uploading.
    setGateEmail((prev) => prev || guestEmail)
    setShowAuthGate(true)
  }

  /** Skip = move on without the guarantee. Free for guests AND members —
   *  this is the low-friction escape hatch, never gated. */
  const handleSkipPhotos = () => {
    setGuaranteeAck(false) // skipping always forfeits the 5%
    setStep(3)
  }

  const handleNext = () => {
    if (step === 2 && type === 'ITEM') {
      // Continue is the UPLOAD path:
      //   uploads still in flight  -> give it a second
      //   no staged photos yet     -> nudge to upload (or skip)
      //   photos, terms not ticked -> nudge to acknowledge the terms
      //   photos + terms, guest    -> sign-in gate to claim the guarantee
      //   photos + terms, member   -> proceed with the guarantee active
      const uploading = photos.filter((p) => p.status === 'uploading').length
      const failed = photos.filter((p) => p.status === 'failed').length
      if (uploading > 0) {
        toast({
          title: 'Almost there',
          description: `${uploading} photo${uploading === 1 ? ' is' : 's are'} still uploading — photos upload as you add them, so just give it a second.`,
        })
        return
      }
      if (stagedPhotoCount === 0) {
        toast({
          title: 'Please upload a photo to activate your guarantee',
          description:
            'Add at least one condition photo for the Return-as-Received Guarantee and its 5% discount — or tap "Skip for now" to continue without it.',
        })
        return
      }
      if (!guaranteeAck) {
        toast({
          title: 'One more tick',
          description:
            'Tick the confirmation box above to accept the Return-as-Received Guarantee terms and activate your 5% discount.',
        })
        return
      }
      if (failed > 0) {
        // Non-blocking: the successfully staged photos still ride along.
        toast({
          title: `${failed} photo${failed === 1 ? ' was' : 's were'} left behind`,
          description: 'We could not upload ' + (failed === 1 ? 'it' : 'them') + ' — you can go back and tap ' + (failed === 1 ? 'its tile' : 'a tile') + ' to retry, or continue with the photos that made it.',
        })
      }
      if (isGuest) {
        openAuthGate()
        return
      }
      setStep(3)
      return
    }
    next()
  }

  /** Gate submit: check the email against accounts and route to /login
   *  (account exists) or /signup (new email). The draft is already saved,
   *  so both paths land back on this exact step after auth. */
  const submitAuthGate = async (e: React.FormEvent) => {
    e.preventDefault()
    const email = gateEmail.trim().toLowerCase()
    if (!EMAIL_RE.test(email)) return
    setGateChecking(true)
    ensureDraftSaved()
    rememberAuthRedirect('/book')
    try {
      const res = await fetch('/api/auth/check-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error('check failed')
      const data = await res.json()
      const params = `email=${encodeURIComponent(email)}&callbackUrl=${encodeURIComponent('/book')}`
      window.location.href = data.exists === true ? `/login?${params}` : `/signup?${params}`
    } catch {
      setGateChecking(false)
      toast({
        title: 'Something went wrong',
        description: 'We could not check that email. Please try again in a moment.',
        variant: 'destructive',
      })
    }
  }

  /** Discard the saved draft and start the wizard from scratch. */
  const resetToFresh = () => {
    clearDraft()
    setResumedAt(null)
    setStep(1)
    setType(effectiveUser?.role === 'B2B' ? 'KG' : 'ITEM')
    setItems({})
    setPhotos([])
    setGuaranteeAck(false)
    setPickupAddress('')
    setPickupDate(defaultPickupDate())
    setPickupSlot(TIME_SLOTS[1])
    setServiceSpeed('STANDARD')
    setModeOfWash(null)
    setPromoCode('')
    setDeliveryAddress('')
    setPaymentMethod('BANK_TRANSFER')
    setGuestName('')
    setGuestEmail('')
    setGuestPhone('')
  }

  /** Account-exists modal submit (phase 36): sign the returning customer in
   *  with their password, then automatically re-submit this exact booking —
   *  the basket, receipt and pickup details are all still in state. The
   *  signed-in submit creates the order and lands them on /payment/pending
   *  (the "we're verifying your payment — you'll get an email" page). */
  const submitAccountPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!guestEmail.trim() || !accountPassword || accountSigningIn) return
    setAccountSigningIn(true)
    setAccountError(null)
    try {
      const res = await signIn('credentials', {
        email: guestEmail.trim().toLowerCase(),
        password: accountPassword,
        redirect: false,
      })
      if (res?.error) {
        if (res.error === 'ACCOUNT_PAUSED' || res.error === 'ACCOUNT_REVOKED') {
          setAccountError(
            'This account is currently paused. Please contact us on +234 803 175 5230 and we will book for you right away.'
          )
        } else if (res.error === 'EMAIL_NOT_VERIFIED' || res.error?.includes('EMAIL_NOT_VERIFIED')) {
          setAccountError(
            'Your email address has not been verified yet. Use "Forgot password?" below to get back in, or book with a different email.'
          )
        } else {
          setAccountError(
            "That password didn't match this account. Try again — or use \u201CForgot password?\u201D below."
          )
        }
        setAccountSigningIn(false)
        return
      }
      // Signed in — close the modal and re-submit the booking. The server
      // now sees the session cookie; the guest fields in the body are
      // ignored, the order is placed under their real account, and the
      // normal bank-transfer redirect takes over.
      setAccountExists(false)
      setAccountPassword('')
      await handleConfirm()
    } catch {
      setAccountError('Something went wrong signing you in. Try again — or call us and we will place the order for you.')
      setAccountSigningIn(false)
    }
  }

  const handleConfirm = async () => {
    // Alterations (Phase 17): the seamstress works from the customer's note —
    // block checkout until the note describes the work.
    if (type === 'ITEM' && hasAlterationItems && !alterationNotesValid) {
      toast({
        title: 'Describe the alteration work',
        description:
          'Please tell our seamstress what to change on which garment — add a short note on the service step (e.g. "navy trousers — waist taken in").',
        variant: 'destructive',
      })
      setStep(1)
      setLoading(false)
      return
    }
    setLoading(true)
    setAccountExists(false)
    setSubmitError(null)
    // A slow mobile network must never leave the customer staring at a
    // "Placing order…" button forever: after 45s we surface a retry
    // message. Retrying is SAFE — the server's duplicate-submission guard
    // treats an identical basket within 15 minutes as ONE order and
    // returns the original, so a re-tap can never double-book.
    const submitController = new AbortController()
    const submitTimeout = setTimeout(() => submitController.abort(), 45_000)
    try {
      // Create order via API (guests pass their contact details; the payment
      // record for BANK_TRANSFER is created server-side in the same request)
      const res = await fetch('/api/orders', {
        method: 'POST',
        signal: submitController.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          items: type === 'ITEM' ? selectedItems : [],
          guaranteeActive,
          serviceSpeed: type === 'ITEM' ? effectiveSpeed : 'STANDARD',
          modeOfWash: type === 'ITEM' ? modeOfWash : undefined,
          promoCode: type === 'ITEM' && promoCode.trim() ? promoCode.trim().toUpperCase() : undefined,
          alterationNotes:
            type === 'ITEM' && alterationNotes.trim() ? alterationNotes.trim() : undefined,
          pickupAddress,
          pickupDate: new Date(pickupDate).toISOString(),
          pickupTimeSlot: pickupSlot,
          deliveryAddress,
          ...(isGuest
            ? {
                guest: {
                  name: guestName.trim(),
                  email: guestEmail.trim(),
                  phone: guestPhone.trim(),
                },
              }
            : {}),
          ...(type === 'ITEM' ? { paymentMethod } : {}),
          // The optional transfer-receipt screenshot rides along with the
          // order — the server stores it on the payment record.
          ...(type === 'ITEM' && paymentMethod === 'BANK_TRANSFER' && receiptData
            ? { transferReceipt: receiptData }
            : {}),
          // Condition photos ride along with the order — one GarmentMedia
          // row each (the guarantee's evidence trail). Phase 51: the photos
          // were staged one-by-one while the customer filled the wizard, so
          // only the IDs travel here — a 30-photo basket no longer has to
          // fit inside one request body (the old 6-photo cap).
          ...(type === 'ITEM' && stagedPhotoCount > 0
            ? {
                stagedToken: stageTokenRef.current,
                stagedPhotoIds: photos
                  .filter((p) => p.status === 'done' && p.id)
                  .map((p) => p.id),
              }
            : {}),
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (err.error === 'ACCOUNT_EXISTS') {
          // ROOT-CAUSE FIX for the recurring mobile "I've made the transfer
          // and nothing happened" report: a returning customer (or the owner
          // testing signed-out with their own email) submits the booking as
          // a guest with an email that already has a password. No order is
          // created, so no email can ever fire — the tap looks completely
          // dead. Phase 36: instead of a notice that renders below the fold
          // of this long payment step (which the customer never saw — the
          // "stuck on the upload screen" report), an un-missable MODAL
          // collects their password, signs them in and re-submits this
          // exact basket automatically. The customer ends up on the
          // /payment/pending confirmation page either way.
          setAccountExists(true)
          setAccountPassword('')
          setAccountError(null)
          setLoading(false)
          return
        }
        // 429 — booking rate limit (phase-29: the caps were raised 4x/3x and
        // made env-tunable, but a genuinely runaway device must still land
        // HERE — readable, on-screen, with the two real ways out — instead
        // of a generic "Booking failed" that reads like a dead button).
        // Works against both the new (error: RATE_LIMITED + message) and the
        // legacy (error: plain text) server shapes via res.status.
        if (res.status === 429) {
          const retryAfter = Number(res.headers.get('Retry-After')) || 0
          const waitMinutes = retryAfter > 0 ? Math.max(1, Math.ceil(retryAfter / 60)) : 15
          toast({
            title: 'Please hold on a moment',
            description: `Several bookings were just placed from this device. Try again in about ${waitMinutes} minute${waitMinutes === 1 ? '' : 's'}${isGuest ? ' — or sign in to book straight away' : ''}.`,
            variant: 'destructive',
          })
          setSubmitError({
            title: 'Booking paused for a few minutes',
            message: `${err.message || 'You have placed several bookings from this device in the last hour.'} Nothing was booked and nothing was charged.${isGuest ? ' Tap below to sign in and book straight away — it takes seconds.' : ' Tap the button again once the pause clears; a retry can never double-book you.'}`,
            ...(isGuest ? { showSignIn: true } : {}),
          })
          setLoading(false)
          return
        }
        // Friendly copy for the Phase-14 server validations — never raw JSON.
        if (err.error === 'MODE_OF_WASH_REQUIRED' || err.error === 'GUARANTEE_NOT_ELIGIBLE' || err.error === 'ALTERATION_NOTES_REQUIRED') {
          toast({
            title: 'Almost there',
            description: err.message || 'Please review your order details.',
            variant: 'destructive',
          })
          setSubmitError({
            title: 'Almost there — one detail is missing',
            message: err.message || 'Please review your order details.',
          })
          setLoading(false)
          setStep(1)
          return
        }
        throw new Error(err.error === 'Validation failed' ? 'Please check your details and try again.' : err.error || 'Failed to create order')
      }

      const data = await res.json()
      const order = data.order

      // The order is placed — the saved draft is no longer needed
      clearDraft()
      setResumedAt(null)
      // Nor are the staged-photo stash / staging token: they belong to THIS
      // basket, and leaving them would restore stale photos on the next
      // visit to the wizard.
      try {
        sessionStorage.removeItem(PHOTO_STASH_KEY)
        sessionStorage.removeItem(STAGE_TOKEN_KEY)
      } catch {
        /* sessionStorage unavailable — harmless */
      }

      // ----- Bank transfer: straight to the payment-verification page -----
      // The dedicated /payment/pending screen states unmistakably that the
      // transfer is being verified, an email is coming, and the customer
      // must NOT pay or submit again — and it live-polls until admin
      // verifies. This replaces the old toast + generic success screen that
      // left customers unsure whether their payment had gone through.
      // (Applies to fresh orders AND de-duplicated re-submissions — the
      // server flags the latter with duplicate: true, but the customer
      // experience is identical either way.)
      if (type === 'ITEM' && paymentMethod === 'BANK_TRANSFER' && order.totalPrice) {
        const emailForLookup = order.user?.email || (isGuest ? guestEmail.trim() : '')
        window.location.href = `/payment/pending?order=${encodeURIComponent(
          order.orderNumber
        )}&email=${encodeURIComponent(emailForLookup)}`
        return
      }

      // ----- Online card payment: redirect to Paystack's hosted checkout -----
      if (type === 'ITEM' && paymentMethod === 'PAYSTACK' && order.totalPrice) {
        try {
          const initRes = await fetch('/api/paystack/initialize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: order.id,
              ...(isGuest ? { email: guestEmail.trim() } : {}),
            }),
          })
          const initData = await initRes.json().catch(() => ({}))
          if (initRes.ok && initData.authorizationUrl) {
            // Redirect to the Paystack checkout page — after payment the
            // customer lands on /payment/callback and the webhook verifies.
            window.location.href = initData.authorizationUrl
            return
          }
          // Online payment unavailable — the order is still placed; fall
          // back to transfer instructions on the success screen.
          toast({
            title: 'Online payment unavailable',
            description:
              'Your order is confirmed — please complete payment by bank transfer using the details on the next screen.',
            variant: 'destructive',
          })
        } catch {
          toast({
            title: 'Online payment unavailable',
            description:
              'Your order is confirmed — please complete payment by bank transfer using the details on the next screen.',
            variant: 'destructive',
          })
        }
      }

      toast({
        title: 'Booking placed!',
        description: `Order #${order.orderNumber} is confirmed. ${
          order.loyaltyFree
            ? 'This one is on the house — no payment needed.'
            : type === 'KG'
            ? 'We will weigh your items at the station and send the invoice.'
            : quoteOnly
            ? 'Our specialist will assess your pieces and send your quote for approval.'
            : paymentMethod === 'BANK_TRANSFER'
            ? receiptUploaded
              ? 'Your receipt is in the verification queue.'
              : 'Please complete your transfer to confirm payment.'
            : 'Complete your card payment to confirm.'
        } A rider will confirm your pickup shortly.`,
      })

      setTimeout(() => onComplete(order, { guestAccountCreated: !!data.guestAccountCreated }), 300)
    } catch (e: any) {
      const aborted = e?.name === 'AbortError'
      toast({
        title: aborted ? 'Connection timed out' : 'Booking failed',
        description: aborted
          ? 'Your network dropped the request. Tap the button again — you can never be double-booked.'
          : e.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      })
      setSubmitError({
        title: aborted ? 'Connection timed out' : 'We could not place your order',
        message: aborted
          ? 'Your network dropped the request after 45 seconds. Tap the confirm button again — identical orders within 15 minutes are treated as ONE order, so a retry can never double-book you. If it keeps failing, call us and we will place the order for you.'
          : e.message ||
            'Something went wrong. Please try again — or call us and we will place the order for you.',
      })
      setLoading(false)
    } finally {
      clearTimeout(submitTimeout)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-linen-200 to-white pb-16">
      <Toaster />
      {/* Header / progress */}
      <div className="border-b border-navy-100 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60[backdrop-filter]:bg-navy-800/60">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
          <button
            onClick={onCancel}
            className="mb-3 inline-flex items-center gap-1 text-xs text-navy-300 hover:text-navy"
          >
            {/* Contextual label: inside the portal this returns to the
                dashboard, on the public site to the landing page. */}
            <ArrowLeft className="h-3.5 w-3.5" />
            {typeof window !== 'undefined' && window.location.pathname.startsWith('/portal')
              ? 'Back to dashboard'
              : 'Back to home'}
          </button>
          <div className="flex items-center justify-between gap-2">
            {STEPS.map((s, i) => {
              const active = step === s.id
              const done = step > s.id
              // Hide condition step for B2B
              if (s.id === 2 && type === 'KG') {
                return null
              }
              const Icon = s.icon
              return (
                <div key={s.id} className="flex flex-1 items-center">
                  <div
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ring-2 transition',
                      active && 'bg-navy text-white ring-gold-400/30',
                      done && 'bg-gold-100 text-navy ring-gold-200',
                      !active && !done && 'bg-linen-200 text-navy-300 ring-muted-foreground/15'
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span
                    className={cn(
                      'ml-2 hidden text-sm font-medium sm:inline',
                      active ? 'text-navy' : 'text-navy-300'
                    )}
                  >
                    {s.name}
                  </span>
                  {i < STEPS.length - 1 && (
                    <div className="mx-3 hidden h-px flex-1 bg-linen-200 sm:block" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {/* Draft resumed — let the customer know their basket came back */}
        {resumedAt && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 flex flex-col gap-2 rounded-xl border border-gold-200 bg-gold-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm text-navy">
              <strong>Welcome back.</strong> We saved your booking on{' '}
              {new Date(resumedAt).toLocaleDateString('en-NG', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}{' '}
              — continue right where you left off.
            </p>
            <button
              type="button"
              onClick={resetToFresh}
              className="shrink-0 text-xs font-semibold text-navy-300 underline decoration-gold-300 decoration-2 underline-offset-2 hover:text-navy"
            >
              Start fresh
            </button>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {/* ====================================================
              STEP 1 — SERVICE SELECTION
          ==================================================== */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="font-serif text-2xl font-semibold tracking-tight text-navy">Select service</h2>
              <p className="mt-1 text-sm text-navy-300">
                {isB2B
                  ? 'As a corporate client, your order is priced per kilogram.'
                  : 'Choose per-item retail pricing or request a bulk pickup.'}
              </p>

              {!isB2B && (
                <RadioGroup
                  value={type}
                  onValueChange={(v) => setType(v as OrderType)}
                  className="mt-5 grid grid-cols-2 gap-3"
                >
                  <label
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition',
                      type === 'ITEM' ? 'border-gold-400 bg-gold-50/50' : 'border-navy-100'
                    )}
                  >
                    <RadioGroupItem value="ITEM" className="sr-only" />
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-100 text-navy">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-navy">Per-item (Retail)</p>
                      <p className="text-xs text-navy-300">
                        Pick your items. Exact total at checkout.
                      </p>
                    </div>
                  </label>
                  <label
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition',
                      type === 'KG' ? 'border-gold-400 bg-gold-50/50' : 'border-navy-100'
                    )}
                  >
                    <RadioGroupItem value="KG" className="sr-only" />
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-100 text-navy">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-navy">Bulk (Per kg)</p>
                      <p className="text-xs text-navy-300">
                        Total weighed at the station after pickup.
                      </p>
                    </div>
                  </label>
                </RadioGroup>
              )}

              {isB2B && (
                <Card className="mt-5 border-gold-200 bg-gold-50/50">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-navy-300" />
                      <p className="font-semibold text-navy">Corporate Bulk Pickup</p>
                    </div>
                    <p className="mt-2 text-sm text-navy-300">
                      Your order will be priced from <strong>{formatNaira(appSettings.pricePerKg)}/kg</strong>{' '}
                      with a {appSettings.minimumKg}kg minimum charge. Our rider will collect your
                      items, weigh them at the station, and we&apos;ll send you the final invoice
                      with payment instructions.
                    </p>
                    <p className="mt-3 text-xs text-navy-300">
                      Estimated minimum charge: <strong>{formatNaira(appSettings.pricePerKg * appSettings.minimumKg)}</strong>
                    </p>
                  </CardContent>
                </Card>
              )}

              {type === 'ITEM' && (
                <div className="mt-6">
                  {/* Men / Women / Shoes — separated exactly like the landing
                      pricing section. Shoes keep their own tab; all three tabs
                      share the same quiet underline style (the old navy-filled
                      shoes tab read like a banner, not a tab). */}
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-300">
                    Pick your items
                  </p>
                  <div className="mt-1 flex items-stretch gap-2 border-b border-navy-100">
                    {(['men', 'women', 'shoes'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setCatalogTab(tab)}
                        className={cn(
                          '-mb-px border-b-2 px-4 py-2 text-sm font-semibold uppercase tracking-wide transition',
                          catalogTab === tab
                            ? 'border-gold-400 text-navy'
                            : 'border-transparent text-navy-300 hover:text-navy'
                        )}
                      >
                        {tab === 'men' ? 'Men' : tab === 'women' ? 'Women' : 'Shoes'}
                      </button>
                    ))}
                  </div>

                  {/* Restoration consultation (owner directive): assessment
                    comes BEFORE the trip, not after — a pair that can't be
                    saved shouldn't be collected only to be returned as-is. */}
                  {catalogTab === 'shoes' && (
                    <div className="mt-4 flex items-start gap-3 rounded-xl border border-gold-200 bg-gold-50/60 p-4">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                      <div>
                        <p className="text-sm font-semibold text-navy">
                          Restorations start with a free assessment
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-navy-300">
                          Restoration projects are priced by the extent of work —
                          sole whitening, repaints, repairs — and begin at ₦5,000.
                          Our specialist assesses your pair first and sends the
                          final quote for your approval before any work begins.
                          If a pair is beyond saving, we tell you straight — no
                          charge, no wasted collection.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Gendered groups for the active tab */}
                  {(catalogTab === 'men'
                    ? MEN_CATALOG_GROUPS
                    : catalogTab === 'women'
                      ? WOMEN_CATALOG_GROUPS
                      : [SHOES_GROUP]
                  ).map(renderCatalogGroup)}

                  {/* Shared strip — household & extras serve everyone, so they
                      show under BOTH the Men and Women tabs (mirrors the
                      landing page's "For the home & everything else" row).
                      Shoes are excluded here — they have their own tab above. */}
                  {catalogTab !== 'shoes' && (
                    <div className="mt-6 border-t border-navy-100 pt-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-300">
                        For the home &amp; everything else
                      </p>
                      {WIZARD_SHARED_GROUPS.map(renderCatalogGroup)}
                    </div>
                  )}

                  {/* MODE OF WASH — required order-form option (client directive:
                      "customer special request, on mode of wash of clothes,
                      either handwash or Machine wash"). Machine is standard;
                      handwash adds the gentle-care surcharge. */}
                  {type === 'ITEM' && (
                    <div className="mt-6">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-600">
                          Mode of wash <span className="text-red-500">*</span>
                        </p>
                        <p className="text-[10px] text-navy-300">Required</p>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => setModeOfWash('MACHINE')}
                          aria-pressed={modeOfWash === 'MACHINE'}
                          className={cn(
                            'flex items-start gap-3 rounded-xl border-2 p-3 text-left transition',
                            modeOfWash === 'MACHINE'
                              ? 'border-gold-400 bg-gold-50/60 ring-1 ring-gold-200'
                              : 'border-navy-100 hover:border-gold-200'
                          )}
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-100 text-navy">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="4" y="3" width="16" height="18" rx="2" />
                              <circle cx="12" cy="13" r="4.5" />
                              <path d="M8 3h8" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-navy">Machine Wash</p>
                            <p className="text-xs text-navy-300">
                              Standard professional care — no extra charge.
                            </p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setModeOfWash('HANDWASH')}
                          aria-pressed={modeOfWash === 'HANDWASH'}
                          className={cn(
                            'flex items-start gap-3 rounded-xl border-2 p-3 text-left transition',
                            modeOfWash === 'HANDWASH'
                              ? 'border-gold-400 bg-gold-50/60 ring-1 ring-gold-200'
                              : 'border-navy-100 hover:border-gold-200'
                          )}
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-100 text-navy">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M6 20c0-4 1.5-6 4-6.5C12.5 13 13 11 12 9s-.5-5 3-5c2 0 3 1.5 3 3.5S17 11 17 13s1.5 3.5 4 3.5" />
                              <path d="M7 20h10" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-navy">
                              Handwash{' '}
                              <span className="ml-1 rounded-full bg-gold-100 px-1.5 py-0.5 text-[10px] font-bold text-gold-700">
                                +{appSettings.handwashSurchargePercent}%
                              </span>
                            </p>
                            <p className="text-xs text-navy-300">
                              Gentle per-garment hand care for delicate fabrics.
                            </p>
                          </div>
                        </button>
                      </div>
                      {modeOfWash === 'HANDWASH' && (
                        <p className="mt-2 text-[11px] leading-snug text-navy-300">
                          Handwash adds {appSettings.handwashSurchargePercent}% of your cleaning
                          subtotal — every piece is washed and finished by hand.
                        </p>
                      )}
                    </div>
                  )}

                  {/* ALTERATIONS NOTE (Phase 17, client directive: riders never
                      measure at the door — the customer describes the work and
                      the seamstress takes it from there). Shown whenever an
                      alterations item is in the basket; quick chips seed common
                      requests, the note is required before placing the order. */}
                  {type === 'ITEM' && hasAlterationItems && (
                    <div className="mt-6">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-600">
                          Tell the seamstress what you need <span className="text-red-500">*</span>
                        </p>
                        <p className="text-[10px] text-navy-300">For the alteration items</p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {[
                          'Waist taken in',
                          'Trouser hem',
                          'Sleeves shortened',
                          'Zip replaced',
                          'Buttons / lining',
                          'Take-in / taper',
                        ].map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() =>
                              setAlterationNotes((prev) =>
                                prev.toLowerCase().includes(chip.toLowerCase())
                                  ? prev
                                  : `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${chip.toLowerCase()}. `
                              )
                            }
                            className="rounded-full border border-navy-100 bg-white px-2.5 py-1 text-[11px] font-medium text-navy-300 transition hover:border-gold-300 hover:text-navy"
                          >
                            + {chip}
                          </button>
                        ))}
                      </div>
                      {/* Saved measurements from the /measurements guide
                          (Phase 18): one-tap attach so repeat customers never
                          re-type their sizes. Cross-links to the guide when
                          nothing is saved yet. */}
                      {hasValues(savedMeasurements) ? (
                        <button
                          type="button"
                          onClick={() => {
                            const snippet = formatMeasurementsForNote(savedMeasurements)
                            if (!snippet) return
                            setAlterationNotes((prev) =>
                              prev.includes('My measurements (')
                                ? prev
                                : `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${snippet}`
                            )
                          }}
                          disabled={alterationNotes.includes('My measurements (')}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition disabled:cursor-default"
                          style={
                            alterationNotes.includes('My measurements (')
                              ? { borderColor: '#EFD87E', backgroundColor: '#FBF5E0', color: '#947621' }
                              : undefined
                          }
                        >
                          {alterationNotes.includes('My measurements (') ? (
                            <>
                              <Check className="h-3.5 w-3.5" /> Measurements attached to your note
                            </>
                          ) : (
                            <>
                              <Ruler className="h-3.5 w-3.5" /> Attach my saved measurements
                              <span className="font-normal text-navy-300">
                                (saved{' '}
                                {new Date(savedMeasurements.savedAt).toLocaleDateString('en-GB', {
                                  day: 'numeric',
                                  month: 'short',
                                })}
                                )
                              </span>
                            </>
                          )}
                        </button>
                      ) : (
                        <a
                          href="/measurements"
                          className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-navy-400 underline decoration-gold-300 underline-offset-2 transition hover:text-navy"
                        >
                          <Ruler className="h-3.5 w-3.5" />
                          Not sure of your numbers? Take the free measurement guide
                        </a>
                      )}
                      <textarea
                        value={alterationNotes}
                        onChange={(e) => setAlterationNotes(e.target.value)}
                        rows={3}
                        placeholder="e.g. Navy work trousers — take the waist in about 2 inches. Green kaftan — shorten the left sleeve to match the right."
                        className="mt-2 w-full resize-none rounded-xl border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy placeholder:text-navy-300 focus:border-gold-300 focus:outline-none focus:ring-2 focus:ring-gold-200"
                      />
                      <p className="mt-1 text-[11px] leading-snug text-navy-300">
                        {alterationNotes.trim().length >= 10 ? (
                          <>Our seamstress reads every note — she&apos;ll call you to confirm details, then send your quote. Nothing is sewn until you approve it.</>
                        ) : (
                          <>Describe the issue on each garment (10+ characters) — this is what our seamstress works from.</>
                        )}
                      </p>
                    </div>
                  )}

                  {selectedItems.length > 0 && (
                    <div className="mt-4 rounded-xl bg-navy px-4 py-3 text-white">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">
                          {selectedItems.reduce((s, i) => s + i.quantity, 0)} item
                          {selectedItems.reduce((s, i) => s + i.quantity, 0) === 1 ? '' : 's'} selected
                        </span>
                        <span className="text-lg font-bold">
                          {formatNaira(subtotal)}
                          {hasQuoteItems && (
                            <span className="ml-1.5 align-middle text-[11px] font-medium text-gold-300">
                              + quote
                            </span>
                          )}
                        </span>
                      </div>
                      {hasQuoteItems && (
                        <p className="mt-1 text-[11px] leading-snug text-white/70">
                          {quoteItemNames.join(', ')} — priced by quote after a
                          free assessment, not included in the total above.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* ====================================================
              STEP 2 — CONDITION CAPTURE (RETAIL ONLY)
          ==================================================== */}
          {step === 2 && type === 'ITEM' && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-start gap-2">
                <Shield className="mt-1 h-5 w-5 text-gold-400" />
                <div>
                  <h2 className="font-serif text-2xl font-semibold tracking-tight text-navy">
                    Activate your Return-as-Received Guarantee
                  </h2>
                  <p className="mt-1 text-sm text-navy-300">
                    Upload photos of your items to activate our guarantee. If we damage anything in
                    our care, we&apos;ll cover it. Plus — you get a{' '}
                    <strong>{settings.guaranteeDiscountPercent}% discount</strong> on this order.
                  </p>
                </div>
              </div>

              <Card className="mt-5 border-dashed border-gold-300">
                <CardContent className="p-5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={(e) => {
                      onPhotos(e.target.files)
                      // Reset so re-picking a previously-removed file still
                      // fires onChange (the value would otherwise be "unchanged").
                      e.target.value = ''
                    }}
                    className="sr-only"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={photos.length >= PHOTO_LIMIT}
                      className="border-gold-300 text-navy hover:bg-gold-50"
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Take or upload photos
                    </Button>
                    <span className="text-xs text-navy-300">
                      {stagedPhotoCount}/{PHOTO_LIMIT} photos · optional
                    </span>
                    {photos.some((p) => p.status === 'uploading') && (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-gold-600">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Uploading {photos.filter((p) => p.status === 'uploading').length}…
                      </span>
                    )}
                  </div>

                  {/* Phase 51 — a customer photographing 30 garments for the
                      first time needs to know what good evidence looks like:
                      what to shoot, in what light, and that it uploads as
                      they go. Short, scannable, no essay. */}
                  <div className="mt-3 rounded-lg bg-linen-100 p-3 text-xs text-navy-300">
                    <p className="font-medium text-navy">Getting good photos</p>
                    <ul className="mt-1 list-inside list-disc space-y-0.5">
                      <li>One garment per photo — or lay a few flat, fully visible.</li>
                      <li>Good light, whole item in frame.</li>
                      <li>Close-up of any existing stain, tear or missing button — that is what the guarantee judges against.</li>
                      <li>Up to {PHOTO_LIMIT} photos. Each uploads as you pick it.</li>
                    </ul>
                  </div>

                  {photos.length > 0 && (
                    <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {photos.map((p, i) => (
                        <div
                          key={p.key}
                          className={`group relative aspect-square overflow-hidden rounded-lg ring-1 ${
                            p.status === 'failed' ? 'ring-red-400' : 'ring-gold-200'
                          }`}
                        >
                          {p.url ? (
                            <img
                              src={p.url}
                              alt={`Condition photo ${i + 1}`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-linen-200">
                              <Loader2 className="h-5 w-5 animate-spin text-gold-500" />
                            </div>
                          )}
                          {p.status === 'uploading' && p.url && (
                            <div className="absolute inset-0 flex items-center justify-center bg-navy/40">
                              <Loader2 className="h-5 w-5 animate-spin text-white" />
                            </div>
                          )}
                          {p.status === 'failed' && (
                            <button
                              type="button"
                              onClick={() => retryPhoto(p.key)}
                              className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-red-950/70 text-white"
                              aria-label={`Retry condition photo ${i + 1}`}
                            >
                              <RefreshCw className="h-4 w-4" />
                              <span className="text-[10px] font-medium">Tap to retry</span>
                            </button>
                          )}
                          <button
                            onClick={() => removePhoto(p.key)}
                            className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                            aria-label={`Remove condition photo ${i + 1}`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {photos.length > 0 && (
                    <label className="mt-4 flex items-start gap-2 rounded-lg bg-gold-50/60 p-3 text-sm">
                      <input
                        type="checkbox"
                        checked={guaranteeAck}
                        onChange={(e) => setGuaranteeAck(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded accent-gold-400"
                      />
                      <span className="text-navy">
                        I confirm these photos document the condition of my items at pickup and I
                        agree to the Return-as-Received Guarantee terms. Claims must be made within
                        24 hours of delivery.
                      </span>
                    </label>
                  )}

                  <div className="mt-4 rounded-lg bg-linen-200 p-3 text-xs text-navy-300">
                    <p className="flex items-center gap-1.5 font-medium text-navy">
                      <Info className="h-3.5 w-3.5" /> What the guarantee covers
                    </p>
                    <p className="mt-1">
                      Covers physical damage occurring in our care. Does not cover pre-existing
                      wear or inherent fabric degradation. The guarantee activates automatically
                      when photos are uploaded and the terms above are acknowledged.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {guaranteeActive && (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-gold-100 px-4 py-3 text-sm text-navy">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>
                    <strong>Guarantee Activated.</strong> You saved{' '}
                    {formatNaira(discount)} ({settings.guaranteeDiscountPercent}% off).
                  </span>
                </div>
              )}

              {/* Guests: explain the choice in plain terms — skipping is
                  free but forfeits the guarantee; photos + continue claims it */}
              {isGuest && (
                <div className="mt-4 flex items-start gap-2 rounded-lg bg-linen-100 p-3 text-xs text-navy-300">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-500" />
                  <p>
                    <strong className="text-navy">Checking out as a guest?</strong> Skip the
                    photos and continue — you just won&apos;t be covered by the
                    Return-as-Received Guarantee or its{' '}
                    {settings.guaranteeDiscountPercent}% discount. Want the coverage? Add your
                    photos and continue — we&apos;ll ask you to sign in so claims are tied to
                    your account, and your basket will be waiting right here.
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* ====================================================
              STEP 3 — LOGISTICS
          ==================================================== */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="font-serif text-2xl font-semibold tracking-tight text-navy">
                Pickup &amp; delivery
              </h2>
              <p className="mt-1 text-sm text-navy-300">
                Pick a date and time slot. We&apos;ll handle the rest.
              </p>

              {/* Guest contact details (guest checkout only) */}
              {isGuest && (
                <Card className="mt-5 border-gold-200 bg-gold-50/30">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gold-600" />
                      <p className="text-sm font-semibold text-navy">Your details</p>
                      <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-navy-300 ring-1 ring-navy-100">
                        No account needed
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-navy-300">
                      We use these to confirm your pickup and email your receipt. You can set a
                      password afterwards to track this order.
                    </p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                      <div>
                        <Label htmlFor="guest-name">Full name</Label>
                        <Input
                          id="guest-name"
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          placeholder="e.g., Adaeze Okonkwo"
                          className="mt-1.5"
                          autoComplete="name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="guest-email">Email</Label>
                        <Input
                          id="guest-email"
                          type="email"
                          value={guestEmail}
                          onChange={(e) => {
                            setGuestEmail(e.target.value)
                            setAccountExists(false)
                          }}
                          placeholder="you@example.com"
                          className="mt-1.5"
                          autoComplete="email"
                        />
                        {guestEmail && !guestEmailValid && (
                          <p className="mt-1 text-xs text-red-500">Enter a valid email address</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="guest-phone">Phone</Label>
                        <Input
                          id="guest-phone"
                          type="tel"
                          value={guestPhone}
                          onChange={(e) => setGuestPhone(e.target.value)}
                          placeholder="e.g., 0803 123 4567"
                          className="mt-1.5"
                          autoComplete="tel"
                        />
                        {guestPhone && !guestPhoneValid && (
                          <p className="mt-1 text-xs text-red-500">Enter a valid phone number</p>
                        )}
                      </div>
                    </div>
                    {accountExists && (
                      <div className="mt-4 rounded-lg bg-blue-50 p-3 text-xs text-blue-900 ring-1 ring-blue-200">
                        <p className="font-semibold">You already have an account with this email.</p>
                        <p className="mt-0.5">
                          <a href="/login" className="font-semibold underline">
                            Sign in
                          </a>{' '}
                          to book — your saved details will be waiting for you.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="mt-6 grid gap-4">
                <div>
                  <Label htmlFor="pickup-date">Pickup date</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      id="pickup-date"
                      type="date"
                      value={pickupDate}
                      onChange={(e) => setPickupDate(e.target.value)}
                      min={new Date().toISOString().slice(0, 10)}
                    />
                    <Calendar className="h-5 w-5 shrink-0 text-navy-300" />
                  </div>
                </div>
                <div>
                  <Label className="text-navy">Pickup time slot</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {TIME_SLOTS.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setPickupSlot(slot)}
                        className={cn(
                          'rounded-lg border-2 px-3 py-2.5 text-xs font-medium transition cursor-pointer',
                          pickupSlot === slot
                            ? 'border-[#0A192F] bg-[#E8ECF2] text-[#0A192F]'
                            : 'border-[#E2E5E9] text-[#6F88A8] hover:border-[#D4AF37] hover:text-[#0A192F]'
                        )}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ----- Turnaround speed (retail orders only) ----- */}
                {type === 'ITEM' && (
                  <div>
                    <Label className="text-navy">How fast do you need it back?</Label>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      {SERVICE_SPEEDS.filter((s) => s.enabled).map((s) => {
                        const selected = effectiveSpeed === s.id
                        const blocked = s.id === 'EXPRESS_24' && !express24Allowed
                        return (
                          <button
                            key={s.id}
                            type="button"
                            disabled={blocked}
                            onClick={() => setServiceSpeed(s.id)}
                            className={cn(
                              'rounded-xl border-2 p-3 text-left transition',
                              blocked && 'cursor-not-allowed opacity-50',
                              !blocked && 'cursor-pointer',
                              selected
                                ? s.id === 'STANDARD'
                                  ? 'border-[#0A192F] bg-[#E8ECF2]'
                                  : 'border-gold-400 bg-gold-50/60'
                                : 'border-[#E2E5E9] hover:border-gold-300'
                            )}
                          >
                            <div className="flex items-center gap-1.5">
                              {s.id === 'STANDARD' ? (
                                <Clock className="h-3.5 w-3.5 text-navy" />
                              ) : (
                                <Zap className="h-3.5 w-3.5 text-gold-600" />
                              )}
                              <span className="text-sm font-semibold text-navy">{s.label}</span>
                            </div>
                            <p className="mt-1 text-[11px] font-medium text-navy-300">
                              {s.window}
                            </p>
                            <p
                              className={cn(
                                'mt-1 text-[11px] font-semibold',
                                s.id === 'STANDARD' ? 'text-navy-300' : 'text-gold-600'
                              )}
                            >
                              {s.surcharge === 0
                                ? 'Included'
                                : `+${Math.round(s.surcharge * 100)}% · ${formatNaira(
                                    Math.round(subtotal * s.surcharge)
                                  )}`}
                            </p>
                            {blocked && (
                              <p className="mt-1 text-[10px] leading-snug text-red-400">
                                Not available with bulky home items (duvets, curtains)
                              </p>
                            )}
                          </button>
                        )
                      })}
                    </div>
                    <p className="mt-2 text-[11px] leading-snug text-navy-300">
                      Standard turnaround is 3–5 days. Express orders jump the cleaning
                      queue and return within the express window from pickup — perfect for
                      last-minute events.
                    </p>
                  </div>
                )}
                <div>
                  <Label htmlFor="pickup-address">Pickup address</Label>
                  <Textarea
                    id="pickup-address"
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    placeholder="House number, street, area, nearest landmark"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="delivery-address">Delivery address (if different)</Label>
                  <Textarea
                    id="delivery-address"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Leave blank to deliver back to pickup address"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="mt-4 flex items-start gap-2 rounded-lg bg-linen-200 p-3 text-xs text-navy-300">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-400" />
                <p>
                  {type === 'ITEM'
                    ? `Turnaround: ${speedOption.label} (${speedOption.window} from pickup). Corporate bulk orders run on a dedicated SLA set up with your account manager.`
                    : 'Corporate bulk orders run on a dedicated SLA set up with your account manager — typically up to 72 hours depending on volume.'}
                </p>
              </div>
            </motion.div>
          )}

          {/* ====================================================
              STEP 4 — CHECKOUT
          ==================================================== */}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="font-serif text-2xl font-semibold tracking-tight text-navy">Checkout</h2>
              <p className="mt-1 text-sm text-navy-300">
                {type === 'ITEM'
                  ? 'Review your order and choose how to pay.'
                  : 'Confirm your pickup request. Final invoice will be sent after weighing.'}
              </p>

              <Card className="mt-5">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between border-b pb-3">
                    <span className="text-sm font-medium text-navy-300">Order summary</span>
                    <div className="flex items-center gap-2">
                      {type === 'ITEM' && effectiveSpeed !== 'STANDARD' && (
                        <Badge className="rounded-full bg-gold-100 text-gold-700 hover:bg-gold-100">
                          <Zap className="mr-1 h-3 w-3" />
                          {speedOption.label} · {speedOption.window}
                        </Badge>
                      )}
                      <Badge variant="outline" className="rounded-full">
                        {type === 'ITEM' ? 'Per-item' : 'Per-kg (Corporate)'}
                      </Badge>
                    </div>
                  </div>

                  {type === 'ITEM' && (
                    <ul className="mt-3 space-y-2 text-sm">
                      {selectedItems.map((i) => {
                        // Quoted items sit at ₦0 until the assessment quote is
                        // approved — show "Quoted" instead of a misleading ₦0.
                        const isQuote =
                          GARMENT_CATALOG.find((c) => c.id === i.id.replace('item_', ''))
                            ?.pricingMode === 'quote'
                        return (
                          <li key={i.id} className="flex items-center justify-between">
                            <span className="text-navy-300">
                              {i.quantity}× {i.name}
                            </span>
                            <span
                              className={cn('font-medium', isQuote && 'text-gold-600')}
                            >
                              {isQuote ? 'Quoted' : formatNaira(i.quantity * i.unitPrice)}
                            </span>
                          </li>
                        )
                      })}
                      {hasQuoteItems && (
                        <li className="flex items-start gap-1.5 rounded-lg bg-gold-50 px-3 py-2 text-xs leading-relaxed text-navy-300 ring-1 ring-gold-200">
                          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-500" />
                          <span>
                            {hasAlterationItems ? (
                              <>
                                Alterations ride the same pickup as your cleaning — the seamstress
                                assesses each piece, calls you to confirm the details, and sends your
                                quote. Nothing is sewn until you approve it.
                              </>
                            ) : (
                              <>
                                Quoted item{quoteItemNames.length > 1 ? 's are' : ' is'} assessed free
                                at pickup — we send the final quote for your approval
                                before any work begins.
                              </>
                            )}
                          </span>
                        </li>
                      )}
                      {hasAlterationItems && alterationNotes.trim() && (
                        <li className="rounded-lg border border-navy-100 bg-linen-50 px-3 py-2 text-xs leading-relaxed text-navy-300">
                          <span className="font-semibold text-navy">For the seamstress:</span>{' '}
                          {alterationNotes.trim().length > 220
                            ? `${alterationNotes.trim().slice(0, 220)}…`
                            : alterationNotes.trim()}
                        </li>
                      )}
                      {handwashSurcharge > 0 && (
                        <li className="flex items-center justify-between text-navy-300">
                          <span className="flex items-center gap-1">
                            <svg className="h-3.5 w-3.5 text-gold-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M6 20c0-4 1.5-6 4-6.5C12.5 13 13 11 12 9s-.5-5 3-5c2 0 3 1.5 3 3.5S17 11 17 13s1.5 3.5 4 3.5" />
                              <path d="M7 20h10" />
                            </svg>
                            Handwash gentle care (+{appSettings.handwashSurchargePercent}%)
                          </span>
                          <span>+{formatNaira(handwashSurcharge)}</span>
                        </li>
                      )}
                      {expressSurcharge > 0 && (
                        <li className="flex items-center justify-between text-navy-300">
                          <span className="flex items-center gap-1">
                            <Zap className="h-3.5 w-3.5 text-gold-500" />
                            {speedOption.label} surcharge (+{Math.round(speedOption.surcharge * 100)}%)
                          </span>
                          <span>+{formatNaira(expressSurcharge)}</span>
                        </li>
                      )}
                      {guaranteeActive && (
                        <li className="flex items-center justify-between text-navy-300">
                          <span className="flex items-center gap-1">
                            <Shield className="h-3.5 w-3.5" />
                            Photo discount ({settings.guaranteeDiscountPercent}%)
                          </span>
                          <span>−{formatNaira(Math.round(serviceSubtotal * (settings.guaranteeDiscountPercent / 100)))}</span>
                        </li>
                      )}
                      {firstOrderDiscountActive && !isHotelCode && (
                        <li className="flex items-center justify-between text-navy-300">
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3.5 w-3.5 text-gold-500" />
                            First-order discount ({firstOrderPercent}%) — applied at confirmation
                          </span>
                          <span>−{formatNaira(Math.round(serviceSubtotal * (firstOrderPercent / 100)))}</span>
                        </li>
                      )}
                      {isHotelCode && !validatedCoupon && (
                        <li className="flex items-center justify-between rounded-lg bg-gold-50 px-2 text-navy-300 ring-1 ring-gold-200">
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3.5 w-3.5 text-gold-500" />
                            Hotel &amp; corporate offer {appSettings.hotelGuestPromoCode} ({firstOrderPercent}%) — applied at confirmation
                          </span>
                          <span>−{formatNaira(Math.round(serviceSubtotal * (firstOrderPercent / 100)))}</span>
                        </li>
                      )}
                      {validatedCoupon && couponPreviewAmount > 0 && (
                        /* Phase 36: live-validated coupon row — green because
                         * the server has already confirmed this exact code
                         * against this basket's rules. */
                        <li className="flex items-center justify-between rounded-lg bg-emerald-50 px-2 text-emerald-800 ring-1 ring-emerald-200">
                          <span className="flex items-center gap-1">
                            <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />
                            Coupon {trimmedCode} (
                            {validatedCoupon.type === 'PERCENTAGE'
                              ? `${validatedCoupon.value}% off`
                              : `${formatNaira(validatedCoupon.value ?? 0)} off`}
                            ) — applied at confirmation
                          </span>
                          <span>−{formatNaira(couponPreviewAmount)}</span>
                        </li>
                      )}
                      {onlineDiscountPct > 0 && (
                        <li className="flex items-center justify-between rounded-lg bg-gold-50 px-2 text-navy-300 ring-1 ring-gold-200">
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3.5 w-3.5 text-gold-500" />
                            Online-order discount ({onlineDiscountPct}%) — yours on every order as a registered customer
                          </span>
                          <span>−{formatNaira(Math.round(serviceSubtotal * (onlineDiscountPct / 100)))}</span>
                        </li>
                      )}
                      {isGuest && type === 'ITEM' && appSettings.onlineOrderDiscountPercent > 0 && subtotal > 0 && (
                        /* Phase-30 registration driver: guests see exactly what
                         * the standing online discount is worth on THIS basket
                         * and can claim it in one tap — the wizard's draft
                         * restore brings them straight back to this basket
                         * after signing in. */
                        <li>
                          <a
                            href={discountSignupHref}
                            className="flex items-center justify-between rounded-lg bg-navy-800 px-3 py-2 text-xs font-semibold text-white transition hover:bg-navy-700"
                          >
                            <span className="flex items-center gap-1.5">
                              <LogIn className="h-3.5 w-3.5 text-gold-300" />
                              Registered customers get {appSettings.onlineOrderDiscountPercent}% off every order — create your free account to claim
                            </span>
                            <span className="whitespace-nowrap text-gold-300">
                              save {formatNaira(Math.round(serviceSubtotal * (appSettings.onlineOrderDiscountPercent / 100)))}
                            </span>
                          </a>
                        </li>
                      )}
                      <li className="flex items-center justify-between text-navy-300">
                        <span className="flex items-center gap-1">
                          <Truck className="h-3.5 w-3.5 text-gold-500" />
                          Delivery {isFirstOrder ? '' : '(subsequent delivery)'}
                        </span>
                        <span className={cn(deliveryFeeEstimate === 0 && 'font-semibold text-emerald-600')}>
                          {deliveryFeeEstimate === 0 ? 'FREE — first order' : formatNaira(deliveryFeeEstimate)}
                        </span>
                      </li>
                    </ul>
                  )}

                  {type === 'KG' && (
                    <div className="mt-3 space-y-2 text-sm">
                      <p className="text-navy-300">
                        Bulk pickup requested. Final price depends on weight measured at our
                        station. Minimum charge: <strong>{formatNaira(appSettings.pricePerKg * appSettings.minimumKg)}</strong>{' '}
                        ({appSettings.minimumKg}kg @ {formatNaira(appSettings.pricePerKg)}/kg).
                      </p>
                      {!isGuest && appSettings.onlineOrderDiscountPercent > 0 && (
                        <p className="rounded-lg bg-gold-50 px-3 py-2 text-xs text-navy-300 ring-1 ring-gold-200">
                          <Sparkles className="mr-1 inline h-3.5 w-3.5 text-gold-500" />
                          Your <strong>{appSettings.onlineOrderDiscountPercent}% online-order discount</strong> for registered
                          customers is applied to the invoice automatically.
                        </p>
                      )}
                      <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-amber-900 ring-1 ring-amber-200">
                        <span>Total</span>
                        <span className="font-semibold">Pending weighing</span>
                      </div>
                    </div>
                  )}

                  {type === 'ITEM' && (
                    <div className="mt-4 flex items-center justify-between border-t pt-3">
                      <span className="font-semibold">Total</span>
                      <span className="text-xl font-bold text-navy-300">
                        {quoteOnly
                          ? 'Quote to follow'
                          : complimentaryCheckout
                            ? 'On the house'
                            : formatNaira(total)}
                      </span>
                    </div>
                  )}

                  {guaranteeActive && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-gold-50 px-3 py-2 text-xs text-navy-300 ring-1 ring-gold-200">
                      <Shield className="h-3.5 w-3.5" /> Guarantee Activated · {photos.length} photos
                      on file
                    </div>
                  )}
                </CardContent>
              </Card>

              {type === 'ITEM' && quoteOnly ? (
                /* Quote-only basket (e.g. just a wedding dress): there is
                 * nothing to pay yet — the assessment comes first and payment
                 * follows the approved quote. Replaces the payment radios so
                 * no ₦0 transfer/card flow is ever offered. */
                <div className="mt-5">
                  <div className="flex items-start gap-3 rounded-xl border border-gold-200 bg-gold-50/50 p-4">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                    <div>
                      <p className="font-semibold text-navy">No payment yet — quote first</p>
                      <p className="mt-1 text-sm leading-relaxed text-navy-300">
                        Your basket only contains quoted item(s). We&apos;ll assess your
                        pieces at pickup and send the quote — payment details follow
                        once you approve the work.
                      </p>
                    </div>
                  </div>
                </div>
              ) : complimentaryCheckout ? (
                /* Phase 53 loyalty — the earned complimentary service ("after
                 * 10 washes, the 11th is free"): this whole order is on the
                 * house, so there is genuinely nothing to pay. The panel
                 * replaces the payment radios and the coupon field; the
                 * server prices the order at zero and the confirmation email
                 * tells the same story. */
                <div className="mt-5">
                  <div className="flex items-start gap-3 rounded-xl border border-gold-300 bg-gold-50/60 p-4">
                    <Gift className="mt-0.5 h-5 w-5 shrink-0 text-gold-500" />
                    <div>
                      <p className="font-semibold text-navy">This one is on us</p>
                      <p className="mt-1 text-sm leading-relaxed text-navy-300">
                        Ten services completed — your next is with our compliments.
                        Nothing to pay and nothing to type: confirm your pickup below
                        and we&apos;ll take care of the rest.
                      </p>
                    </div>
                  </div>
                </div>
              ) : type === 'ITEM' && (
                <div className="mt-5">
                  {/* Offer / coupon code (phase 36) — first order: the classic
                      hotel & corporate offer code; any order: general coupon
                      codes from newsletters and promos. Tap Apply for a live
                      server check (the exact rules checkout uses), or just
                      confirm — codes are always validated at checkout and
                      unknown codes are ignored with a notice, never a dead
                      end. */}
                  <div className="mb-4 rounded-xl border border-navy-100 bg-linen-50 p-4">
                    <label
                      htmlFor="promo-code"
                      className="flex items-center gap-1.5 text-sm font-semibold text-navy"
                    >
                      <Tag className="h-4 w-4 text-gold-500" />
                      {isFirstOrder ? 'Have an offer code?' : 'Have a coupon code?'}
                    </label>
                    <div className="mt-2 flex gap-2">
                      <Input
                        id="promo-code"
                        value={promoCode}
                        onChange={(e) => {
                          setPromoCode(e.target.value.toUpperCase())
                          // Typing invalidates the previous check
                          setCouponCheck(null)
                        }}
                        placeholder={`e.g. ${appSettings.hotelGuestPromoCode}`}
                        className="font-mono uppercase"
                        maxLength={24}
                        autoComplete="off"
                      />
                      <Button
                        type="button"
                        className="shrink-0 bg-navy text-white hover:bg-navy/90"
                        disabled={!trimmedCode || couponChecking}
                        onClick={applyCoupon}
                      >
                        {couponChecking ? (
                          <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Checking…
                          </>
                        ) : (
                          'Apply'
                        )}
                      </Button>
                      {promoCode && !couponChecking && (
                        <Button
                          type="button"
                          variant="outline"
                          className="shrink-0"
                          onClick={() => {
                            setPromoCode('')
                            setCouponCheck(null)
                          }}
                        >
                          Clear
                        </Button>
                      )}
                    </div>

                    {/* Validation result — success (green) or the exact reason
                        the code cannot be used (why it failed, in plain
                        language) */}
                    {couponCheck && couponCheck.code === trimmedCode && (
                      <p
                        className={cn(
                          'mt-2 flex items-start gap-1.5 rounded-lg px-3 py-2 text-xs leading-snug',
                          couponCheck.valid
                            ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                            : 'bg-red-50 text-red-700 ring-1 ring-red-200'
                        )}
                        role="status"
                      >
                        {couponCheck.valid ? (
                          <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        ) : (
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        )}
                        <span>
                          {couponCheck.valid ? (
                            <>
                              <strong>{couponCheck.couponName}</strong> applied —{' '}
                              {couponCheck.message}{' '}
                              {isFirstOrder && (
                                <span className="block text-[11px] text-emerald-700/80">
                                  Applied INSTEAD of the standard first-order discount (the better
                                  deal wins). The 5% photo discount still stacks on top.
                                </span>
                              )}
                            </>
                          ) : (
                            couponCheck.message
                          )}
                        </span>
                      </p>
                    )}

                    {!couponCheck && (
                      <p className="mt-1.5 text-[11px] leading-snug text-navy-300">
                        {isFirstOrder ? (
                          isHotelCode ? (
                            <span className="font-semibold text-emerald-700">
                              {appSettings.hotelGuestPromoCode} recognised —{' '}
                              {appSettings.hotelGuestDiscountPercent}% off your first order (+ the 5%
                              photo discount if you upload pictures).
                            </span>
                          ) : (
                            <>
                              Hotels &amp; corporate clients: use code{' '}
                              <span className="font-mono font-semibold text-navy">
                                {appSettings.hotelGuestPromoCode}
                              </span>{' '}
                              for {appSettings.hotelGuestDiscountPercent}% off your first order — or
                              apply any coupon code you received from us.
                            </>
                          )
                        ) : (
                          <>
                            Coupon codes from our offers and newsletters work here — tap Apply to
                            check one instantly.
                          </>
                        )}
                      </p>
                    )}
                  </div>

                  <p className="text-sm font-semibold">Choose payment method</p>
                  <RadioGroup
                    value={paymentMethod}
                    onValueChange={(v) => setPaymentMethod(v as 'BANK_TRANSFER' | 'PAYSTACK')}
                    className="mt-2 grid gap-3"
                  >
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition',
                        paymentMethod === 'BANK_TRANSFER'
                          ? 'border-gold-400 bg-gold-50/50'
                          : 'border-navy-100'
                      )}
                    >
                      <RadioGroupItem value="BANK_TRANSFER" className="sr-only" />
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-100 text-navy">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-navy">Bank Transfer</p>
                        <p className="text-xs text-navy-300">
                          Send the transfer first, then tap “I’ve made the transfer” below. We
                          verify within minutes and email you the moment it’s confirmed.
                        </p>
                      </div>
                    </label>
                    {/* Card option — while Paystack keys are not configured it renders
                     * greyed-out and unselectable with a plain-language notice, so
                     * customers are steered to transfer instead of hitting a dead end. */}
                    <label
                      className={cn(
                        'flex items-start gap-3 rounded-xl border-2 p-4 transition',
                        paystackAvailable && 'cursor-pointer',
                        !paystackAvailable && 'cursor-not-allowed bg-linen-100/70 opacity-60',
                        paymentMethod === 'PAYSTACK' && paystackAvailable
                          ? 'border-gold-400 bg-gold-50/50'
                          : 'border-navy-100'
                      )}
                    >
                      <RadioGroupItem
                        value="PAYSTACK"
                        className="sr-only"
                        disabled={!paystackAvailable}
                      />
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linen-200 text-navy-300">
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-navy-300">Pay Online — Card</p>
                          {!paystackAvailable && (
                            <span className="rounded-full bg-navy-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-navy-300">
                              Unavailable
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-navy-300">
                          {paystackAvailable
                            ? 'Pay securely with your debit card via Paystack. Payment is confirmed instantly — no receipt upload needed.'
                            : 'Card payment is not available at the moment — please pay by bank transfer instead.'}
                        </p>
                      </div>
                    </label>
                  </RadioGroup>

                  {paymentMethod === 'BANK_TRANSFER' && (
                    <Card className="mt-4 border-gold-200 bg-gold-50/40">
                      <CardContent className="p-4">
                        {/* Step 1 — the transfer itself */}
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-800 text-xs font-bold text-gold-300">
                            1
                          </span>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-navy">
                              Transfer {formatNaira(total)} to our account
                            </p>
                            <div className="mt-2 space-y-1 text-sm">
                              <div className="flex items-center justify-between">
                                <span className="text-navy-300">Bank</span>
                                <span className="font-medium">{appSettings.bankName}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-navy-300">Account Name</span>
                                <span className="font-medium">{appSettings.accountName}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-navy-300">Account Number</span>
                                <span className="font-mono font-bold text-navy">
                                  {appSettings.accountNumber}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Step 2 — narration */}
                        <div className="mt-4 flex items-start gap-3 border-t border-gold-200/70 pt-4">
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-800 text-xs font-bold text-gold-300">
                            2
                          </span>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-navy">
                              Tap “I’ve made the transfer” below
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-navy-300">
                              We&apos;ll take you straight to a page confirming your payment is
                              being verified — and we email you the moment it&apos;s confirmed.
                              You&apos;ll also get your order number there: use it as the transfer
                              narration so we can match your payment instantly.
                            </p>
                          </div>
                        </div>

                        {/* Optional receipt upload */}
                        <div className="mt-4 border-t border-gold-200/70 pt-3">
                          <p className="text-xs text-navy-300">
                            Optional — attach your transfer receipt for faster verification:
                          </p>
                          <input
                            ref={receiptInputRef}
                            type="file"
                            accept="image/*"
                            onChange={(e) => onReceipt(e.target.files)}
                            className="sr-only"
                          />
                          <Button
                            type="button"
                            variant={receiptUploaded ? 'secondary' : 'outline'}
                            onClick={() => receiptInputRef.current?.click()}
                            className="mt-2 w-full"
                          >
                            {receiptUploaded ? (
                              <>
                                <CheckCircle2 className="mr-2 h-4 w-4 text-gold-400" /> Receipt
                                attached
                              </>
                            ) : (
                              <>
                                <Upload className="mr-2 h-4 w-4" /> Upload receipt
                              </>
                            )}
                          </Button>
                        </div>

                        {/* Expectations — kills the "did my payment go through?" doubt */}
                        <div className="mt-4 flex items-start gap-2 rounded-lg bg-navy-50 p-3">
                          <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-navy-400" />
                          <p className="text-xs leading-relaxed text-navy-300">
                            After you confirm: our team verifies your transfer — usually within
                            minutes during business hours — then emails you. Your rider is
                            dispatched as soon as payment is verified. You never need to pay twice
                            or re-send anything.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {paymentMethod === 'PAYSTACK' && (
                    <Card className="mt-4 border-blue-200 bg-blue-50/40">
                      <CardContent className="p-4">
                        <p className="text-sm text-blue-900">
                          On confirm, you&apos;ll be redirected to Paystack&apos;s secure checkout
                          to pay {formatNaira(total)} with your card. After payment you&apos;ll
                          return here and your order is confirmed automatically — no admin
                          review needed.
                        </p>
                        <div className="mt-2 text-xs text-blue-700">
                          Secured by Paystack · Cards, USSD &amp; bank options at checkout
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ===== Persistent submit-failure banner ===== */}
        {/* The guarantee that a failed confirm can never look like a dead
            button: it sits directly above the confirm/continue button on
            every step, it is announced to screen readers (role=alert), and
            it stays until the customer retries or dismisses it. */}
        <AnimatePresence>
          {submitError && (
            <motion.div
              key={submitError.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              role="alert"
              className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-900">{submitError.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-red-700">
                  {submitError.message}
                </p>
                {submitError.showSignIn && (
                  <a
                    href={`/login?email=${encodeURIComponent(guestEmail.trim())}`}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-navy-800 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-700"
                  >
                    <LogIn className="h-3.5 w-3.5" /> Sign in and book
                  </a>
                )}
              </div>
              <button
                type="button"
                aria-label="Dismiss message"
                onClick={() => setSubmitError(null)}
                className="shrink-0 rounded-full p-1 text-red-400 hover:bg-red-100 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer nav */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          <Button variant="ghost" onClick={prev} disabled={step === 1}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-2">
            {step === 2 && type === 'ITEM' && (
              <Button
                variant="outline"
                onClick={handleSkipPhotos}
                className="rounded-full border-navy-200 text-navy-300 hover:border-gold-300 hover:text-navy"
              >
                Skip for now
              </Button>
            )}
            {step < 4 ? (
              <Button
                onClick={handleNext}
                disabled={!canContinue()}
                className="rounded-full bg-gold-gradient px-6 hover:opacity-90 text-navy"
              >
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleConfirm}
                disabled={loading}
                className="rounded-full bg-gold-gradient px-6 hover:opacity-90 text-navy"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {loading
                  ? 'Placing order...'
                  : type === 'ITEM'
                    ? quoteOnly
                      ? 'Confirm booking'
                      : complimentaryCheckout
                        ? 'Confirm pickup'
                        : paymentMethod === 'BANK_TRANSFER'
                          ? "I've Made the Transfer"
                          : `Pay & Confirm ${formatNaira(total)}`
                    : 'Confirm pickup request'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ====================================================
          GUARANTEE GATE — guests claiming the Return-as-Received
          Guarantee (uploaded photos + tapped Continue)
      ==================================================== */}
      <AnimatePresence>
        {showAuthGate && (
          <motion.div
            key="auth-gate"
            className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0A192F]/70 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!gateChecking) setShowAuthGate(false)
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 6 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-navy ring-1 ring-navy-100 sm:p-7"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-100">
                <ShieldCheck className="h-6 w-6 text-gold-600" />
              </div>
              <h3 className="mt-4 text-center font-serif text-xl font-semibold text-navy">
                Claim your {settings.guaranteeDiscountPercent}% guarantee
              </h3>
              <p className="mt-2 text-center text-sm leading-relaxed text-navy-300">
                The Return-as-Received Guarantee is tied to a Kozy Care account —
                that&apos;s how we verify and honour claims. Your basket and photos
                are saved; enter your email and we&apos;ll take you straight back to
                finish checkout.
              </p>
              <form onSubmit={submitAuthGate} className="mt-5 space-y-3">
                <div>
                  <Label
                    htmlFor="gate-email"
                    className="text-xs uppercase tracking-wide text-navy-300"
                  >
                    Your email
                  </Label>
                  <Input
                    id="gate-email"
                    type="email"
                    value={gateEmail}
                    onChange={(e) => setGateEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="mt-1.5"
                    autoFocus
                    required
                    disabled={gateChecking}
                    autoComplete="email"
                  />
                  {gateEmail && !gateEmailValid && (
                    <p className="mt-1 text-xs text-red-500">Enter a valid email address</p>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={gateChecking || !gateEmailValid}
                  className="w-full bg-gold-gradient text-navy hover:opacity-90"
                >
                  {gateChecking ? 'Checking…' : 'Continue'}
                </Button>
              </form>
              <p className="mt-3 text-center text-[11px] leading-relaxed text-navy-300/80">
                Already have an account? We&apos;ll sign you back in. New here? Sign-up
                takes 60 seconds and your basket will be waiting.
              </p>
              <button
                type="button"
                onClick={() => {
                  // Declining to sign in performs the skip — checkout never
                  // dead-ends. The guarantee (and its 5%) is forfeited.
                  setShowAuthGate(false)
                  handleSkipPhotos()
                }}
                disabled={gateChecking}
                className="mt-4 w-full text-center text-xs font-semibold text-navy-300 hover:text-navy"
              >
                Skip for now — continue without the guarantee
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====================================================
          ACCOUNT-EXISTS MODAL (phase 36)
          A returning customer who checks out as a GUEST with their
          account email gets a 409 from POST /api/orders — no order,
          no email, a dead-looking button. This un-missable modal
          (unlike the old below-the-fold notice — the exact
          "stuck on the upload screen" report) collects their
          password, signs them in and re-submits the SAME booking
          automatically: they still land on the payment-verification
          page with the "you'll get an email" confirmation.
      ==================================================== */}
      <AnimatePresence>
        {accountExists && (
          <motion.div
            key="account-exists"
            className="fixed inset-0 z-[75] flex items-center justify-center bg-[#0A192F]/75 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 6 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
              className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-navy ring-1 ring-navy-100 sm:p-7"
              role="dialog"
              aria-modal="true"
              aria-labelledby="account-exists-title"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-100">
                <LogIn className="h-6 w-6 text-gold-600" />
              </div>
              <h3
                id="account-exists-title"
                className="mt-4 text-center font-serif text-xl font-semibold text-navy"
              >
                Welcome back — one step to finish
              </h3>
              <p className="mt-2 text-center text-sm leading-relaxed text-navy-300">
                An account already exists for{' '}
                <strong className="break-all text-navy">{guestEmail.trim()}</strong>. Your order was{' '}
                <strong className="text-navy">not placed yet</strong> and nothing was charged —
                enter your password to place this booking with your saved details. Your items,
                transfer receipt and pickup are all preserved.
              </p>
              <form onSubmit={submitAccountPassword} className="mt-5 space-y-3">
                <div>
                  <Label
                    htmlFor="account-password"
                    className="text-xs uppercase tracking-wide text-navy-300"
                  >
                    Your account password
                  </Label>
                  <Input
                    id="account-password"
                    type="password"
                    value={accountPassword}
                    onChange={(e) => setAccountPassword(e.target.value)}
                    placeholder="Your password"
                    className="mt-1.5"
                    autoFocus
                    required
                    disabled={accountSigningIn}
                    autoComplete="current-password"
                  />
                </div>
                {accountError && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700 ring-1 ring-red-200" role="alert">
                    {accountError}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={accountSigningIn || !accountPassword}
                  className="w-full bg-gold-gradient text-navy hover:opacity-90"
                >
                  {accountSigningIn ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Placing your order…
                    </>
                  ) : (
                    'Place my order'
                  )}
                </Button>
              </form>
              <div className="mt-4 flex flex-col items-center gap-2 text-center">
                <a
                  href={`/forgot-password?email=${encodeURIComponent(guestEmail.trim())}`}
                  className="text-xs font-semibold text-navy-300 underline-offset-2 hover:text-navy hover:underline"
                >
                  Forgot password?
                </a>
                <button
                  type="button"
                  onClick={() => {
                    // Decline: go back to the contact step with a cleared
                    // email so they can either use a different address or
                    // continue as a brand-new guest.
                    setAccountExists(false)
                    setAccountPassword('')
                    setAccountError(null)
                    setGuestEmail('')
                    setStep(3)
                  }}
                  disabled={accountSigningIn}
                  className="text-xs font-semibold text-navy-300 hover:text-navy"
                >
                  Book with a different email instead
                </button>
              </div>
              <p className="mt-4 text-center text-[11px] leading-relaxed text-navy-300/80">
                After signing in you&apos;ll go straight to the payment confirmation page — and
                we email you the moment your transfer is verified.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
