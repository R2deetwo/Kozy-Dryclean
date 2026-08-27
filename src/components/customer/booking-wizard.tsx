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
  ArrowLeft,
  ArrowRight,
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
import { useServerPrices } from '@/lib/hooks'
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
import { useSession } from 'next-auth/react'
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

/** sessionStorage key for photos stashed while a guest hops through the
 *  login/signup round-trip to claim the guarantee (same tab only). */
const GATE_PHOTOS_KEY = 'kozy:gate-photos'

/** Default pickup date: tomorrow. */
function defaultPickupDate() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function BookingWizard({ onComplete, onCancel, allowGuest = false, initialCatalogTab }: Props) {
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
  const [photos, setPhotos] = useState<{ url: string; name: string }[]>([])
  const [guaranteeAck, setGuaranteeAck] = useState(false)
  const [pickupAddress, setPickupAddress] = useState('')
  const [pickupDate, setPickupDate] = useState(defaultPickupDate)
  const [pickupSlot, setPickupSlot] = useState(TIME_SLOTS[1])
  const [serviceSpeed, setServiceSpeed] = useState<ServiceSpeed>('STANDARD')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'BANK_TRANSFER' | 'PAYSTACK'>('BANK_TRANSFER')
  const [receiptUploaded, setReceiptUploaded] = useState(false)
  const [catalogTab, setCatalogTab] = useState<CatalogTab>(initialCatalogTab ?? 'men')
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
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
  const guestEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())
  const guestPhoneValid = guestPhone.trim().length >= 7
  const guestValid =
    guestName.trim().length >= 2 && guestEmailValid && guestPhoneValid

  // ----- Live prices from the server (PriceCatalog) -----
  // Displayed prices must match what POST /api/orders will actually charge.
  const serverPrices = useServerPrices()

  // ----- Restore a saved draft ("continue where you left off") -----
  // Runs once on mount, BEFORE the profile prefill effect below so a restored
  // address is never clobbered.
  useEffect(() => {
    hydrated.current = true
    const d = loadDraft()

    // Photos stashed before the guarantee gate's login round-trip: restore
    // them (once) so the customer doesn't have to re-upload after signing in.
    // The terms checkbox is deliberately NOT restored — acknowledging the
    // guarantee terms must stay an explicit, current action.
    try {
      const stashed = sessionStorage.getItem(GATE_PHOTOS_KEY)
      if (stashed) {
        const parsed = JSON.parse(stashed) as { url: string; name: string }[]
        if (Array.isArray(parsed) && parsed.length > 0) setPhotos(parsed)
        sessionStorage.removeItem(GATE_PHOTOS_KEY)
      }
    } catch {
      /* corrupt stash or unavailable sessionStorage — ignore */
    }

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
      deliveryAddress,
      paymentMethod,
      guestName,
      guestEmail,
      guestPhone,
    })
  }, [step, type, items, pickupAddress, pickupDate, pickupSlot, serviceSpeed, deliveryAddress, paymentMethod, guestName, guestEmail, guestPhone])

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
  const guaranteeActive =
    type === 'ITEM' && !isGuest && photos.length > 0 && guaranteeAck
  const grossTotal = subtotal + expressSurcharge
  const discount = guaranteeActive ? grossTotal * (settings.guaranteeDiscountPercent / 100) : 0
  const total = grossTotal - discount

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

  const onPhotos = (files: FileList | null) => {
    if (!files) return
    Array.from(files).slice(0, 6 - photos.length).forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        setPhotos((prev) => [...prev, { url: reader.result as string, name: file.name }])
      }
      reader.readAsDataURL(file)
    })
  }

  const onReceipt = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const file = files[0]
    const reader = new FileReader()
    reader.onload = () => {
      setReceiptUploaded(true)
      // Store receipt as a mock marker — in a real app this would upload to OSS
      // For the demo we just remember it was uploaded
    }
    reader.readAsDataURL(file)
  }

  const canContinue = () => {
    if (step === 1) {
      if (type === 'ITEM') return selectedItems.length > 0
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
    // Stash the photos for the login round-trip (sessionStorage survives
    // same-tab navigation to /login and back, unlike component state).
    // Best-effort: quota errors just mean re-uploading after sign-in.
    try {
      if (photos.length > 0) {
        sessionStorage.setItem(GATE_PHOTOS_KEY, JSON.stringify(photos))
      } else {
        sessionStorage.removeItem(GATE_PHOTOS_KEY)
      }
    } catch {
      /* sessionStorage full or unavailable — proceed without the stash */
    }
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
      //   no photos yet            -> nudge to upload (or skip)
      //   photos, terms not ticked -> nudge to acknowledge the terms
      //   photos + terms, guest    -> sign-in gate to claim the guarantee
      //   photos + terms, member   -> proceed with the guarantee active
      if (photos.length === 0) {
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
    setDeliveryAddress('')
    setPaymentMethod('BANK_TRANSFER')
    setGuestName('')
    setGuestEmail('')
    setGuestPhone('')
  }

  const handleConfirm = async () => {
    setLoading(true)
    setAccountExists(false)
    try {
      // Create order via API (guests pass their contact details; the payment
      // record for BANK_TRANSFER is created server-side in the same request)
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          items: type === 'ITEM' ? selectedItems : [],
          guaranteeActive,
          serviceSpeed: type === 'ITEM' ? effectiveSpeed : 'STANDARD',
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
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (err.error === 'ACCOUNT_EXISTS') {
          setAccountExists(true)
          setLoading(false)
          return
        }
        throw new Error(err.error === 'Validation failed' ? 'Please check your details and try again.' : err.error || 'Failed to create order')
      }

      const data = await res.json()
      const order = data.order

      // The order is placed — the saved draft is no longer needed
      clearDraft()
      setResumedAt(null)

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
          type === 'KG'
            ? 'We will weigh your items at the station and send the invoice.'
            : quoteOnly
            ? 'Our specialist will assess your pieces and send your quote for approval.'
            : paymentMethod === 'BANK_TRANSFER'
            ? receiptUploaded
              ? 'Your receipt is in the verification queue.'
              : 'Please complete your transfer to confirm payment.'
            : 'Complete your card payment to confirm.'
        }`,
      })

      setTimeout(() => onComplete(order, { guestAccountCreated: !!data.guestAccountCreated }), 300)
    } catch (e: any) {
      toast({
        title: 'Booking failed',
        description: e.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      })
      setLoading(false)
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
            <ArrowLeft className="h-3.5 w-3.5" /> Back to home
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
                      Your order will be priced at <strong>{formatNaira(settings.pricePerKg)}/kg</strong>{' '}
                      with a {settings.minimumKg}kg minimum charge. Our rider will collect your
                      items, weigh them at the station, and we&apos;ll send you the final invoice
                      with payment instructions.
                    </p>
                    <p className="mt-3 text-xs text-navy-300">
                      Estimated minimum charge: <strong>{formatNaira(settings.pricePerKg * settings.minimumKg)}</strong>
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
                    onChange={(e) => onPhotos(e.target.files)}
                    className="sr-only"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="border-gold-300 text-navy hover:bg-gold-50"
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Take or upload photos
                    </Button>
                    <span className="text-xs text-navy-300">
                      {photos.length}/6 photos · optional
                    </span>
                  </div>

                  {photos.length > 0 && (
                    <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {photos.map((p, i) => (
                        <div
                          key={i}
                          className="group relative aspect-square overflow-hidden rounded-lg ring-1 ring-gold-200"
                        >
                          <img
                            src={p.url}
                            alt={`Condition photo ${i + 1}`}
                            className="h-full w-full object-cover"
                          />
                          <button
                            onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                          >
                            <X className="h-3 w-3" />
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
                            Quoted item{quoteItemNames.length > 1 ? 's are' : ' is'} assessed free
                            at pickup — we send the final quote for your approval
                            before any work begins.
                          </span>
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
                            Return-as-Received discount ({settings.guaranteeDiscountPercent}%)
                          </span>
                          <span>−{formatNaira(discount)}</span>
                        </li>
                      )}
                    </ul>
                  )}

                  {type === 'KG' && (
                    <div className="mt-3 space-y-2 text-sm">
                      <p className="text-navy-300">
                        Bulk pickup requested. Final price depends on weight measured at our
                        station. Minimum charge: <strong>{formatNaira(settings.pricePerKg * settings.minimumKg)}</strong>{' '}
                        ({settings.minimumKg}kg @ {formatNaira(settings.pricePerKg)}/kg).
                      </p>
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
                        {quoteOnly ? 'Quote to follow' : formatNaira(total)}
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
              ) : type === 'ITEM' && (
                <div className="mt-5">
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
                        <p className="font-semibold text-navy">Bank Transfer (Manual)</p>
                        <p className="text-xs text-navy-300">
                          Transfer to our account, then upload your receipt. Admin verifies within
                          minutes.
                        </p>
                      </div>
                    </label>
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition',
                        paymentMethod === 'PAYSTACK'
                          ? 'border-gold-400 bg-gold-50/50'
                          : 'border-navy-100'
                      )}
                    >
                      <RadioGroupItem value="PAYSTACK" className="sr-only" />
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-100 text-navy">
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-navy">Pay Online — Card</p>
                        <p className="text-xs text-navy-300">
                          Pay securely with your debit card via Paystack. Payment is
                          confirmed instantly — no receipt upload needed.
                        </p>
                      </div>
                    </label>
                  </RadioGroup>

                  {paymentMethod === 'BANK_TRANSFER' && (
                    <Card className="mt-4 border-gold-200 bg-gold-50/40">
                      <CardContent className="p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-navy-300">
                          Transfer to
                        </p>
                        <div className="mt-2 space-y-1 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-navy-300">Bank</span>
                            <span className="font-medium">{settings.bankName}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-navy-300">Account Name</span>
                            <span className="font-medium">{settings.accountName}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-navy-300">Account Number</span>
                            <span className="font-mono font-bold text-navy-300">
                              {settings.accountNumber}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-navy-300">Amount</span>
                            <span className="font-bold text-navy-300">{formatNaira(total)}</span>
                          </div>
                        </div>
                        <div className="mt-4 border-t pt-3">
                          <p className="text-xs text-navy-300">
                            Upload your transfer receipt:
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
                                uploaded
                              </>
                            ) : (
                              <>
                                <Upload className="mr-2 h-4 w-4" /> Upload receipt
                              </>
                            )}
                          </Button>
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
    </div>
  )
}
