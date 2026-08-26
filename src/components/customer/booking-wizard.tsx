'use client'

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
  Plus,
  Minus,
  Info,
  Upload,
  X,
  Sparkles,
} from 'lucide-react'
import {
  GARMENT_CATALOG,
  formatNaira,
  type OrderItem,
  type OrderType,
  type Order,
} from '@/lib/types'
import { useStore } from '@/lib/store'
import { useSession } from 'next-auth/react'

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

export function BookingWizard({ onComplete, onCancel, allowGuest = false }: Props) {
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
  const [pickupDate, setPickupDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  })
  const [pickupSlot, setPickupSlot] = useState(TIME_SLOTS[1])
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'BANK_TRANSFER' | 'PAYSTACK'>('BANK_TRANSFER')
  const [receiptUploaded, setReceiptUploaded] = useState(false)
  const [catalogTab, setCatalogTab] = useState<'garments' | 'shoes'>('garments')
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const receiptInputRef = useRef<HTMLInputElement>(null)

  // ----- Guest checkout contact details (collected in step 3) -----
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [accountExists, setAccountExists] = useState(false)
  const guestEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())
  const guestPhoneValid = guestPhone.trim().length >= 7
  const guestValid =
    guestName.trim().length >= 2 && guestEmailValid && guestPhoneValid

  // Populate address fields once we have the current user
  useEffect(() => {
    if (effectiveUser?.address) {
      setPickupAddress(effectiveUser.address)
      setDeliveryAddress(effectiveUser.address)
    }
  }, [effectiveUser?.address])
  // If this user is B2B, default the type to KG
  useEffect(() => {
    if (effectiveUser?.role === "B2B") setType("KG")
  }, [effectiveUser?.role])

  // ----- Computed pricing (memoized for performance) -----
  // Must be called BEFORE any early returns (Rules of Hooks)
  const selectedItems: OrderItem[] = useMemo(() => {
    if (!effectiveUser && !isGuest) return []
    return Object.entries(items)
      .filter(([, q]) => q > 0)
      .map(([id, q]) => {
        const g = GARMENT_CATALOG.find((c) => c.id === id)!
        const unitPrice = settings.garmentPrices[id] ?? g.price
        return { id: 'item_' + id, name: g.name, quantity: q, unitPrice }
      })
  }, [items, settings.garmentPrices, effectiveUser, isGuest])
  const subtotal = selectedItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const guaranteeActive = type === 'ITEM' && photos.length > 0 && guaranteeAck
  const discount = guaranteeActive ? subtotal * (settings.guaranteeDiscountPercent / 100) : 0
  const total = subtotal - discount

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
    if (step === 2 && type === 'KG') {
      // Skip condition capture step for B2B
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
                        Pick your garments. Exact total at checkout.
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
                  {/* Pick your garments / Pick your shoes — two tabs on the same line.
                      "Pick your garments" stays in the muted navy-300 tone of the old label;
                      "Pick your shoes" uses a navy fill + white text so it's unmissable,
                      but still inside the brand palette (navy + gold). */}
                  <div className="flex items-stretch gap-2 border-b border-navy-100">
                    <button
                      type="button"
                      onClick={() => setCatalogTab('garments')}
                      className={cn(
                        '-mb-px border-b-2 px-4 py-2 text-sm font-semibold uppercase tracking-wide transition',
                        catalogTab === 'garments'
                          ? 'border-gold-400 text-navy'
                          : 'border-transparent text-navy-300 hover:text-navy'
                      )}
                    >
                      Pick your garments
                    </button>
                    <button
                      type="button"
                      onClick={() => setCatalogTab('shoes')}
                      className={cn(
                        '-mb-px border-b-2 px-4 py-2 text-sm font-semibold uppercase tracking-wide transition',
                        catalogTab === 'shoes'
                          ? 'border-gold-400 bg-navy text-white'
                          : 'border-transparent bg-navy text-white hover:bg-[#1B3A5F]'
                      )}
                    >
                      Pick your shoes
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {GARMENT_CATALOG.filter(
                      (g) => (catalogTab === 'garments' ? g.category !== 'Shoes' : g.category === 'Shoes')
                    ).map((g) => {
                      const qty = items[g.id] ?? 0
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
                            <img
                              src={g.icon}
                              alt=""
                              className="h-7 w-7"
                            />
                            <div>
                              <p className="text-sm font-medium text-navy">{g.name}</p>
                              <p className="text-xs text-navy-300">
                                {formatNaira(settings.garmentPrices[g.id] ?? g.price)} each
                              </p>
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
                    })}
                  </div>

                  {selectedItems.length > 0 && (
                    <div className="mt-4 flex items-center justify-between rounded-xl bg-navy px-4 py-3 text-white">
                      <span className="text-sm">
                        {selectedItems.reduce((s, i) => s + i.quantity, 0)} item
                        {selectedItems.reduce((s, i) => s + i.quantity, 0) === 1 ? '' : 's'} selected
                      </span>
                      <span className="text-lg font-bold">{formatNaira(subtotal)}</span>
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
                  Standard turnaround is 48 hours from pickup for retail orders. Corporate
                  bulk orders may take up to 72 hours depending on volume.
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
                    <Badge variant="outline" className="rounded-full">
                      {type === 'ITEM' ? 'Per-item' : 'Per-kg (Corporate)'}
                    </Badge>
                  </div>

                  {type === 'ITEM' && (
                    <ul className="mt-3 space-y-2 text-sm">
                      {selectedItems.map((i) => (
                        <li key={i.id} className="flex items-center justify-between">
                          <span className="text-navy-300">
                            {i.quantity}× {i.name}
                          </span>
                          <span className="font-medium">
                            {formatNaira(i.quantity * i.unitPrice)}
                          </span>
                        </li>
                      ))}
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
                        {formatNaira(total)}
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

              {type === 'ITEM' && (
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
        <div className="mt-8 flex items-center justify-between border-t pt-5">
          <Button variant="ghost" onClick={prev} disabled={step === 1}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          {step < 4 ? (
            <Button
              onClick={next}
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
              {loading ? 'Placing order...' : type === 'ITEM' ? `Pay & Confirm ${formatNaira(total)}` : 'Confirm pickup request'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
