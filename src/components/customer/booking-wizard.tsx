'use client'

import { useState, useRef } from 'react'
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
  GUARANTEE_DISCOUNT,
  B2B_PRICING,
  COMPANY_BANK,
  formatNaira,
  type OrderItem,
  type OrderType,
  type Order,
} from '@/lib/types'
import { useStore } from '@/lib/store'
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
  onComplete: (order: Order) => void
  onCancel: () => void
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

export function BookingWizard({ onComplete, onCancel }: Props) {
  const createOrder = useStore((s) => s.createOrder)
  const addMedia = useStore((s) => s.addMedia)
  const createPayment = useStore((s) => s.createPayment)
  const currentUser = useStore((s) => s.users.find((u) => u.id === s.currentUserId) ?? s.users[0])
  const isB2B = currentUser.role === 'B2B'

  const [step, setStep] = useState(1)
  const [type, setType] = useState<OrderType>(isB2B ? 'KG' : 'ITEM')
  const [items, setItems] = useState<Record<string, number>>({})
  const [photos, setPhotos] = useState<{ url: string; name: string }[]>([])
  const [guaranteeAck, setGuaranteeAck] = useState(false)
  const [pickupAddress, setPickupAddress] = useState(currentUser.address ?? '')
  const [pickupDate, setPickupDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  })
  const [pickupSlot, setPickupSlot] = useState(TIME_SLOTS[1])
  const [deliveryAddress, setDeliveryAddress] = useState(currentUser.address ?? '')
  const [paymentMethod, setPaymentMethod] = useState<'BANK_TRANSFER' | 'PAYSTACK'>('BANK_TRANSFER')
  const [receiptUploaded, setReceiptUploaded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const receiptInputRef = useRef<HTMLInputElement>(null)

  // ----- Computed pricing -----
  const selectedItems: OrderItem[] = Object.entries(items)
    .filter(([, q]) => q > 0)
    .map(([id, q]) => {
      const g = GARMENT_CATALOG.find((c) => c.id === id)!
      return { id: 'item_' + id, name: g.name, quantity: q, unitPrice: g.price }
    })
  const subtotal = selectedItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const guaranteeActive = type === 'ITEM' && photos.length > 0 && guaranteeAck
  const discount = guaranteeActive ? subtotal * GUARANTEE_DISCOUNT : 0
  const total = subtotal - discount

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
    if (step === 3) return Boolean(pickupAddress && pickupDate && pickupSlot)
    if (step === 4) return true
    return false
  }

  const next = () => {
    if (step === 2 && type === 'B2B') {
      // Skip condition capture step for B2B
      setStep(3)
      return
    }
    if (step < 4) setStep(step + 1)
  }
  const prev = () => {
    if (step === 3 && type === 'B2B') {
      // Skip back to step 1 for B2B
      setStep(1)
      return
    }
    if (step > 1) setStep(step - 1)
  }

  const handleConfirm = () => {
    const order = createOrder({
      userId: currentUser.id,
      type,
      items: type === 'ITEM' ? selectedItems : [],
      guaranteeActive,
      pickupAddress,
      pickupDate: new Date(pickupDate).toISOString(),
      pickupTimeSlot: pickupSlot,
      deliveryAddress,
    })

    // Persist photos as garment media
    photos.forEach((p) => addMedia(order.id, p.url))

    // Create payment record
    const amount = type === 'ITEM' ? total : 0
    createPayment({
      orderId: order.id,
      amount,
      method: paymentMethod,
      receiptUrl: paymentMethod === 'BANK_TRANSFER' && receiptUploaded ? 'mock-receipt' : undefined,
    })

    toast({
      title: 'Booking placed!',
      description: `Order #${order.orderNumber} is confirmed. ${
        type === 'KG'
          ? 'We will weigh your items at the station and send the invoice.'
          : paymentMethod === 'BANK_TRANSFER' && receiptUploaded
          ? 'Your receipt is in the verification queue.'
          : 'We\'ve initiated your Paystack payment request.'
      }`,
    })

    setTimeout(() => onComplete(order), 300)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/30 to-white pb-16">
      <Toaster />
      {/* Header / progress */}
      <div className="border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
          <button
            onClick={onCancel}
            className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
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
                      active && 'bg-emerald-600 text-white ring-emerald-600/30',
                      done && 'bg-emerald-100 text-emerald-700 ring-emerald-200',
                      !active && !done && 'bg-muted text-muted-foreground ring-muted-foreground/15'
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span
                    className={cn(
                      'ml-2 hidden text-sm font-medium sm:inline',
                      active ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {s.name}
                  </span>
                  {i < STEPS.length - 1 && (
                    <div className="mx-3 hidden h-px flex-1 bg-muted-foreground/15 sm:block" />
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
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Select service</h2>
              <p className="mt-1 text-sm text-muted-foreground">
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
                      type === 'ITEM' ? 'border-emerald-500 bg-emerald-50/50' : 'border-muted'
                    )}
                  >
                    <RadioGroupItem value="ITEM" className="sr-only" />
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">Per-item (Retail)</p>
                      <p className="text-xs text-muted-foreground">
                        Pick your garments. Exact total at checkout.
                      </p>
                    </div>
                  </label>
                  <label
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition',
                      type === 'KG' ? 'border-emerald-500 bg-emerald-50/50' : 'border-muted'
                    )}
                  >
                    <RadioGroupItem value="KG" className="sr-only" />
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">Bulk (Per kg)</p>
                      <p className="text-xs text-muted-foreground">
                        Total weighed at the station after pickup.
                      </p>
                    </div>
                  </label>
                </RadioGroup>
              )}

              {isB2B && (
                <Card className="mt-5 border-emerald-200 bg-emerald-50/50">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-emerald-700" />
                      <p className="font-semibold text-emerald-900">Corporate Bulk Pickup</p>
                    </div>
                    <p className="mt-2 text-sm text-emerald-800">
                      Your order will be priced at <strong>{formatNaira(B2B_PRICING.pricePerKg)}/kg</strong>{' '}
                      with a {B2B_PRICING.minimumKg}kg minimum charge. Our rider will collect your
                      items, weigh them at the station, and we&apos;ll send you the final invoice
                      with payment instructions.
                    </p>
                    <p className="mt-3 text-xs text-emerald-700">
                      Estimated minimum charge: <strong>{formatNaira(B2B_PRICING.minimumCharge)}</strong>
                    </p>
                  </CardContent>
                </Card>
              )}

              {type === 'ITEM' && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Pick your garments
                  </h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {GARMENT_CATALOG.map((g) => {
                      const qty = items[g.id] ?? 0
                      return (
                        <div
                          key={g.id}
                          className={cn(
                            'flex items-center justify-between rounded-xl border p-3 transition',
                            qty > 0
                              ? 'border-emerald-300 bg-emerald-50/50 ring-1 ring-emerald-200'
                              : 'border-muted hover:border-emerald-200'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{g.icon}</span>
                            <div>
                              <p className="text-sm font-medium text-foreground">{g.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatNaira(g.price)} each
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setQty(g.id, -1)}
                              disabled={qty === 0}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground hover:bg-muted-foreground/20 disabled:opacity-30"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-6 text-center text-sm font-semibold">{qty}</span>
                            <button
                              onClick={() => setQty(g.id, 1)}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {selectedItems.length > 0 && (
                    <div className="mt-4 flex items-center justify-between rounded-xl bg-foreground px-4 py-3 text-background">
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
              STEP 2 — CONDITION CAPTURE (B2C ONLY)
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
                <Shield className="mt-1 h-5 w-5 text-emerald-600" />
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-foreground">
                    Activate your Return-as-Received Guarantee
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Upload photos of your items to activate our guarantee. If we damage anything in
                    our care, we&apos;ll cover it. Plus — you get a{' '}
                    <strong>{Math.round(GUARANTEE_DISCOUNT * 100)}% discount</strong> on this order.
                  </p>
                </div>
              </div>

              <Card className="mt-5 border-dashed border-emerald-300">
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
                      className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Take or upload photos
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {photos.length}/6 photos · optional
                    </span>
                  </div>

                  {photos.length > 0 && (
                    <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {photos.map((p, i) => (
                        <div
                          key={i}
                          className="group relative aspect-square overflow-hidden rounded-lg ring-1 ring-emerald-200"
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
                    <label className="mt-4 flex items-start gap-2 rounded-lg bg-emerald-50/60 p-3 text-sm">
                      <input
                        type="checkbox"
                        checked={guaranteeAck}
                        onChange={(e) => setGuaranteeAck(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded accent-emerald-600"
                      />
                      <span className="text-emerald-900">
                        I confirm these photos document the condition of my items at pickup and I
                        agree to the Return-as-Received Guarantee terms. Claims must be made within
                        24 hours of delivery.
                      </span>
                    </label>
                  )}

                  <div className="mt-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                    <p className="flex items-center gap-1.5 font-medium text-foreground">
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
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-100 px-4 py-3 text-sm text-emerald-900">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>
                    <strong>Guarantee Activated.</strong> You saved{' '}
                    {formatNaira(discount)} ({Math.round(GUARANTEE_DISCOUNT * 100)}% off).
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
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Pickup &amp; delivery
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick a date and time slot. We&apos;ll handle the rest.
              </p>

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
                    <Calendar className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </div>
                </div>
                <div>
                  <Label>Pickup time slot</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {TIME_SLOTS.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => setPickupSlot(slot)}
                        className={cn(
                          'rounded-lg border px-3 py-2 text-xs font-medium transition',
                          pickupSlot === slot
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                            : 'border-muted text-muted-foreground hover:border-emerald-300'
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

              <div className="mt-4 flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
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
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Checkout</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {type === 'ITEM'
                  ? 'Review your order and choose how to pay.'
                  : 'Confirm your pickup request. Final invoice will be sent after weighing.'}
              </p>

              <Card className="mt-5">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between border-b pb-3">
                    <span className="text-sm font-medium text-muted-foreground">Order summary</span>
                    <Badge variant="outline" className="rounded-full">
                      {type === 'ITEM' ? 'Per-item (Retail)' : 'Per-kg (Corporate)'}
                    </Badge>
                  </div>

                  {type === 'ITEM' && (
                    <ul className="mt-3 space-y-2 text-sm">
                      {selectedItems.map((i) => (
                        <li key={i.id} className="flex items-center justify-between">
                          <span className="text-foreground/80">
                            {i.quantity}× {i.name}
                          </span>
                          <span className="font-medium">
                            {formatNaira(i.quantity * i.unitPrice)}
                          </span>
                        </li>
                      ))}
                      {guaranteeActive && (
                        <li className="flex items-center justify-between text-emerald-700">
                          <span className="flex items-center gap-1">
                            <Shield className="h-3.5 w-3.5" />
                            Return-as-Received discount ({Math.round(GUARANTEE_DISCOUNT * 100)}%)
                          </span>
                          <span>−{formatNaira(discount)}</span>
                        </li>
                      )}
                    </ul>
                  )}

                  {type === 'KG' && (
                    <div className="mt-3 space-y-2 text-sm">
                      <p className="text-muted-foreground">
                        Bulk pickup requested. Final price depends on weight measured at our
                        station. Minimum charge: <strong>{formatNaira(B2B_PRICING.minimumCharge)}</strong>{' '}
                        ({B2B_PRICING.minimumKg}kg @ {formatNaira(B2B_PRICING.pricePerKg)}/kg).
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
                      <span className="text-xl font-bold text-emerald-700">
                        {formatNaira(total)}
                      </span>
                    </div>
                  )}

                  {guaranteeActive && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 ring-1 ring-emerald-200">
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
                          ? 'border-emerald-500 bg-emerald-50/50'
                          : 'border-muted'
                      )}
                    >
                      <RadioGroupItem value="BANK_TRANSFER" className="sr-only" />
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">Bank Transfer (Manual)</p>
                        <p className="text-xs text-muted-foreground">
                          Transfer to our account, then upload your receipt. Admin verifies within
                          minutes.
                        </p>
                      </div>
                    </label>
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition',
                        paymentMethod === 'PAYSTACK'
                          ? 'border-emerald-500 bg-emerald-50/50'
                          : 'border-muted'
                      )}
                    >
                      <RadioGroupItem value="PAYSTACK" className="sr-only" />
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">
                          Paystack Virtual Account
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Get a dedicated virtual account. We auto-confirm payment via webhook.
                        </p>
                      </div>
                    </label>
                  </RadioGroup>

                  {paymentMethod === 'BANK_TRANSFER' && (
                    <Card className="mt-4 border-emerald-200 bg-emerald-50/40">
                      <CardContent className="p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                          Transfer to
                        </p>
                        <div className="mt-2 space-y-1 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Bank</span>
                            <span className="font-medium">{COMPANY_BANK.bankName}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Account Name</span>
                            <span className="font-medium">{COMPANY_BANK.accountName}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Account Number</span>
                            <span className="font-mono font-bold text-emerald-700">
                              {COMPANY_BANK.accountNumber}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Amount</span>
                            <span className="font-bold text-emerald-700">{formatNaira(total)}</span>
                          </div>
                        </div>
                        <div className="mt-4 border-t pt-3">
                          <p className="text-xs text-muted-foreground">
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
                                <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" /> Receipt
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
                          On confirm, we&apos;ll request a dedicated virtual account from Paystack
                          tied to this order. You&apos;ll receive the account details by SMS, and
                          once funds hit the account, we auto-confirm via webhook — no admin
                          review needed.
                        </p>
                        <div className="mt-2 text-xs text-blue-700">
                          Reference: <span className="font-mono">PSK_LG_{Date.now().toString().slice(-6)}</span>
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
              className="rounded-full bg-emerald-600 px-6 hover:bg-emerald-700"
            >
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleConfirm}
              className="rounded-full bg-emerald-600 px-6 hover:bg-emerald-700"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {type === 'ITEM' ? `Pay & Confirm ${formatNaira(total)}` : 'Confirm pickup request'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
