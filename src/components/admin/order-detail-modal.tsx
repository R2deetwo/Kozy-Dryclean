'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  X,
  Phone,
  MapPin,
  Calendar,
  Clock,
  Truck,
  Shield,
  Receipt,
  Scale,
  Scissors,
  Zap,
  Sparkles,
  User as UserIcon,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw,
  Trash2,
  Ban,
  MessageCircleQuestion,
  MessageCircle,
  Bell,
} from 'lucide-react'
import {
  useOrders,
  useUpdateOrder,
  usePayments,
  useVerifyPayment,
  useDeletePayment,
  useAppSettings,
  useBranches,
  usePartners,
} from '@/lib/hooks'
import { formatNaira, formatDateTime, formatDate, type OrderStatus } from '@/lib/types'
import { getOrderTiming, pacingSentence } from '@/lib/order-timing'
import { waLink, assignmentBrief } from '@/lib/whatsapp'
import { OrderPipeline, OrderTimeline } from '@/components/shared/order-pipeline'
import { DispatchCard } from '@/components/admin/dispatch-card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { Textarea } from '@/components/ui/textarea'
import { whatsappLink } from '@/lib/phone-validation'
import { cn } from '@/lib/utils'

interface Props {
  order: any
  isAdmin?: boolean
  onClose: () => void
  onViewInvoice?: (o: any) => void
}

const STATUS_OPTIONS: OrderStatus[] = [
  'REQUESTED',
  'PAYMENT_PENDING_VERIFICATION',
  'PAYMENT_VERIFIED',
  'PICKED_UP',
  'AT_STATION',
  'PROCESSING',
  'FINISHING',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
]

export function OrderDetailModal({ order, isAdmin = false, onClose, onViewInvoice }: Props) {
  // `order` is the LIVE object derived from the React Query cache (the board
  // passes selectedId, not a stale snapshot) — so every field below reflects
  // verify/reject/status mutations the moment they land.
  const customer = order.user
  const driver = order.driver
  const payments = order.payments ?? []

  // ----- Condition photos (phase 51) -----
  // Board/list payloads carry a COUNT, not the photo bytes (a 30-photo
  // order used to ship ~5MB of data URLs on every board load) — so the full
  // photos are fetched once, here, when the modal opens. Photos expire 24h
  // after delivery (the guarantee's claim window) — when they are gone, say
  // so instead of silently omitting the section.
  const mediaCount: number =
    order.mediaCount ?? (Array.isArray(order.media) ? order.media.length : 0)
  const [mediaRows, setMediaRows] = useState<any[] | null>(
    Array.isArray(order.media) ? order.media : null
  )
  useEffect(() => {
    if (mediaCount <= 0 || mediaRows !== null) return
    let alive = true
    fetch(`/api/orders/${order.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((d) => {
        if (alive) setMediaRows(d?.order?.media ?? [])
      })
      .catch(() => {
        if (alive) setMediaRows([])
      })
    return () => {
      alive = false
    }
  }, [order.id])
  const media = mediaRows ?? []
  const photosExpired = Boolean(
    order.guaranteeActive &&
      order.deliveredAt &&
      Date.now() - new Date(order.deliveredAt).getTime() > 24 * 3600 * 1000
  )
  const appSettings = useAppSettings()

  // Mutations via React Query
  const updateOrderMutation = useUpdateOrder()
  const verifyPaymentMutation = useVerifyPayment()
  const deletePaymentMutation = useDeletePayment()
  const [confirmRemovePayment, setConfirmRemovePayment] = useState<any | null>(null)
  const [confirmCancelOrder, setConfirmCancelOrder] = useState(false)

  // ----- "Ask the customer" composer (phase 54) -----
  // The one mid-order message the cadence rules ALLOW: a genuine question
  // from the team (email + SMS + a timeline entry for the audit trail).
  const [askOpen, setAskOpen] = useState(false)
  const [askText, setAskText] = useState('')
  const [askSending, setAskSending] = useState(false)

  const handleAskCustomer = async () => {
    const text = askText.trim()
    if (text.length < 10) {
      toast({
        title: 'A little more detail, please',
        description: 'Tell the customer what you need to know (at least 10 characters).',
        variant: 'destructive',
      })
      return
    }
    setAskSending(true)
    try {
      const res = await fetch(`/api/orders/${order.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Send failed')
      setAskOpen(false)
      setAskText('')
      toast({
        title: 'Question sent',
        description: `${customer?.name ?? 'The customer'} will get it by email and text — the question is also logged in this order's timeline.`,
      })
    } catch (e: any) {
      toast({ title: 'Could not send the question', description: e?.message, variant: 'destructive' })
    } finally {
      setAskSending(false)
    }
  }

  // Phase 60: rider assignment moved from a blind name dropdown (which had
  // actually rotted into dead code — the console had NO assignment UI at
  // all) to the Dispatch card: scored, explained suggestions with the
  // assign button on each. The card fetches its own fleet facts, so the
  // modal no longer pulls the full users list either.

  // Parse items from itemsManifest JSON string
  const items = useMemo(() => {
    try { return JSON.parse(order.itemsManifest || '[]') } catch { return [] }
  }, [order.itemsManifest])

  const [weightInput, setWeightInput] = useState(order.finalWeight?.toString() ?? '')
  const [statusSelect, setStatusSelect] = useState<OrderStatus>(order.status)
  const [receiptZoom, setReceiptZoom] = useState(false)

  // ----- Live-sync the status dropdown with the order -----
  // React's "adjust state during render" pattern (no useEffect — that
  // flickers and can loop): when the order's status changes under us
  // (verify advanced it, a drag moved it, another admin edited it), the
  // select follows in the same render.
  if (order.status !== statusSelect) {
    setStatusSelect(order.status)
  }

  const handleStatusChange = (newStatus: OrderStatus) => {
    setStatusSelect(newStatus)
    updateOrderMutation.mutate({ id: order.id, status: newStatus }, {
      onError: (e: any) => toast({ title: 'Status update failed', description: e?.message, variant: 'destructive' }),
    })
    toast({ title: 'Status updated', description: `Order is now ${newStatus.replace(/_/g, ' ').toLowerCase()}.` })
  }

  const handleSetWeight = () => {
    const kg = parseFloat(weightInput) || 0
    if (kg <= 0) { toast({ title: 'Invalid weight', variant: 'destructive' }); return }
    // Server calculates totalPrice from weight × pricePerKg
    updateOrderMutation.mutate(
      { id: order.id, finalWeight: kg },
      {
        onSuccess: () => toast({ title: 'Weight recorded', description: `${kg}kg — invoice sent.` }),
        onError: (e: any) => toast({ title: 'Could not record weight', description: e?.message, variant: 'destructive' }),
      }
    )
  }

  const handleVerify = (paymentId: string) => {
    verifyPaymentMutation.mutate(
      { id: paymentId, status: 'VERIFIED' },
      {
        onSuccess: (data) =>
          toast({
            title: 'Payment verified',
            description: data.noOp
              ? 'Already verified — nothing to do.'
              : 'Customer emailed · order moved to Ready to Pick Up.',
          }),
        onError: (e: any) => toast({ title: 'Verification failed', description: e?.message, variant: 'destructive' }),
      }
    )
  }
  const handleReject = (paymentId: string) => {
    verifyPaymentMutation.mutate(
      { id: paymentId, status: 'REJECTED' },
      {
        onSuccess: () =>
          toast({
            title: 'Payment rejected',
            description: 'The customer has been emailed with what to check and what to do next.',
            variant: 'destructive',
          }),
        onError: (e: any) => toast({ title: 'Rejection failed', description: e?.message, variant: 'destructive' }),
      }
    )
  }

  const handleRemovePayment = (paymentId: string) => {
    deletePaymentMutation.mutate(paymentId, {
      onSuccess: (data) => {
        setConfirmRemovePayment(null)
        toast({
          title: 'Removed from the queue',
          description: data.order
            ? 'Claim deleted. The order is back in Requested — the customer can re-confirm payment anytime.'
            : 'Claim deleted. Verified payment history and the order itself are untouched.',
        })
      },
      onError: (e: any) => {
        setConfirmRemovePayment(null)
        toast({ title: 'Could not remove', description: e?.message, variant: 'destructive' })
      },
    })
  }

  // Cancelling removes the order from the Kanban board (CANCELLED orders are
  // not pipeline columns) and emails the customer — the manual counterpart to
  // an order leaving the board organically via DELIVERED.
  const handleCancelOrder = () => {
    updateOrderMutation.mutate(
      { id: order.id, status: 'CANCELLED' },
      {
        onSuccess: () => {
          setConfirmCancelOrder(false)
          toast({
            title: 'Order cancelled',
            description: 'The customer has been emailed and the order has left the board.',
            variant: 'destructive',
          })
        },
        onError: (e: any) => {
          setConfirmCancelOrder(false)
          toast({ title: 'Could not cancel order', description: e?.message, variant: 'destructive' })
        },
      }
    )
  }

  const pendingPayment = payments.find((p: any) => p.status === 'PENDING')
  const rejectedBankTransfer = payments.find(
    (p: any) => p.status === 'REJECTED' && p.method === 'BANK_TRANSFER'
  )
  const busy = verifyPaymentMutation.isPending
  // Phase 32 — odd-movement flags (ADMIN only; the API never ships anomaly
  // rows to staff, and this check is defence in depth on top of that).
  const anomalies: any[] = isAdmin ? order.anomalies ?? [] : []
  // Staff may drive the pipeline but may NOT cancel an order — cancellation
  // removes revenue from the board and is a manager decision (client
  // directive: nothing destructive or revenue-hiding without approval).
  const statusChoices = STATUS_OPTIONS.filter(
    (s) => isAdmin || s !== 'CANCELLED'
  )

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono">#{order.orderNumber}</span>
            {anomalies.length > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700"
                title="Odd movements recorded on this order — see the flagged activity section"
              >
                <Shield className="h-3 w-3" /> {anomalies.length} flag{anomalies.length === 1 ? '' : 's'}
              </span>
            )}
            <Badge variant="outline" className="rounded-full text-[10px] text-[#0A192F] border-[#E2E5E9]">
              {order.type === 'ITEM' ? 'Retail' : 'Corporate'}
            </Badge>
            {(order as any).loyaltyFree && (
              <Badge
                className="rounded-full bg-[#FBF5E0] text-[#0A192F]"
                title="The customer's earned complimentary service — after ten paid washes, the 11th is free. Nothing to collect on this order."
              >
                <Sparkles className="mr-1 h-2.5 w-2.5" /> Complimentary — loyalty
              </Badge>
            )}
            {order.serviceSpeed && order.serviceSpeed !== 'STANDARD' && (
              <Badge className="rounded-full bg-amber-100 text-amber-800">
                <Zap className="mr-1 h-2.5 w-2.5" />
                {order.serviceSpeed === 'EXPRESS_24' ? 'Express 24' : 'Express 48'} · due within{' '}
                {order.serviceSpeed === 'EXPRESS_24' ? '24h' : '48h'} of pickup
              </Badge>
            )}
            {order.guaranteeActive && (
              <Badge className="rounded-full bg-[#FBF5E0] text-[#0A192F]">
                <Shield className="mr-1 h-2.5 w-2.5" /> Guarantee
              </Badge>
            )}
            {order.modeOfWash && (
              <Badge className="rounded-full bg-blue-100 text-blue-800">
                {order.modeOfWash === 'HANDWASH'
                  ? 'Handwash'
                  : order.modeOfWash === 'IRON_ONLY'
                    ? 'Iron only'
                    : 'Machine wash'}
              </Badge>
            )}
            {order.promoCode && (
              <Badge className="rounded-full bg-gold-100 text-gold-800">
                Code {order.promoCode}
              </Badge>
            )}
            {typeof order.deliveryFee === 'number' && order.deliveryFee > 0 && (
              <Badge variant="outline" className="rounded-full text-[10px] text-[#0A192F] border-[#E2E5E9]">
                Delivery ₦{order.deliveryFee.toLocaleString('en-NG')}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>Booked on {formatDateTime(order.createdAt)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Customer contact (phase 55) — the team used to have to dig for
              the phone in the CRM just to call about an order. Name, email,
              Call and WhatsApp now sit at the top of every order. The
              WhatsApp button is a deep link (wa.me), NOT an API integration:
              it opens WhatsApp on THIS device with a chat to the customer's
              number and a sensible opening line, and the conversation lives
              on the staff member's phone — nothing is logged here. */}
          <section className="rounded-lg bg-[#EEF0F2] p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-[#0A192F]">
                  <UserIcon className="h-3.5 w-3.5 text-[#D4AF37]" /> Customer
                </p>
                <p className="mt-1 truncate text-sm font-medium text-[#0A192F]">{customer?.name}</p>
                {customer?.email && (
                  <a
                    href={`mailto:${customer.email}`}
                    className="text-xs text-[#6F88A8] underline-offset-2 hover:underline"
                  >
                    {customer.email}
                  </a>
                )}
              </div>
              {customer?.phone && (
                <div className="flex shrink-0 gap-2">
                  <a
                    href={`tel:${customer.phone}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#C8D2DF] bg-white px-2.5 text-xs font-semibold text-[#0A192F] transition hover:bg-[#EEF0F2]"
                    title="Call the customer from this device"
                  >
                    <Phone className="h-3.5 w-3.5" /> Call
                  </a>
                  <a
                    href={whatsappLink(
                      customer.phone,
                      `Hello ${(customer.name || 'there').split(' ')[0]}, it's Kozy Care about your order #${order.orderNumber} — `
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#25D366] px-2.5 text-xs font-semibold text-white transition hover:bg-[#1eb85a]"
                    title="Open WhatsApp on this device with a chat to the customer"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                </div>
              )}
            </div>
          </section>

          {/* Phase 32 — odd-movement flags: admin eyes only. Staff payloads
              never contain anomaly rows, so this section never renders for
              them even before the role check. */}
          {anomalies.length > 0 && (
            <section className="rounded-lg border border-rose-200 bg-rose-50 p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-rose-800">
                <Shield className="h-4 w-4" /> Flagged activity (manager only)
              </p>
              <ul className="mt-2 space-y-1.5">
                {anomalies.slice(0, 6).map((a: any) => (
                  <li key={a.id} className="text-xs leading-relaxed text-rose-900">
                    <span className="font-medium">
                      {a.detail || a.kind.replace(/_/g, ' ').toLowerCase()}
                    </span>
                    <span className="ml-1 text-rose-500">
                      · {a.actor?.name ?? 'unknown actor'} ·{' '}
                      {new Date(a.createdAt).toLocaleString('en-NG', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </li>
                ))}
                {anomalies.length > 6 && (
                  <li className="text-xs text-rose-500">
                    …and {anomalies.length - 6} earlier flag{anomalies.length - 6 === 1 ? '' : 's'}
                  </li>
                )}
              </ul>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-sm font-semibold text-[#0A192F]">Order progress</h3>
            <OrderPipeline order={order} />
            <div className="mt-3 flex items-center gap-2">
              <Label className="text-xs text-[#0A192F]">Set status</Label>
              <Select value={statusSelect} onValueChange={(v) => handleStatusChange(v as OrderStatus)}>
                <SelectTrigger className="h-8 w-56 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusChoices.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">{s.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Ask the customer (phase 54) — the one mid-order message
               * the cadence rules allow. Staff and admins both see it;
               * drivers have their own Call button in the rider app. */}
              {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAskOpen(true)}
                  className="ml-auto h-8 border-[#C8D2DF] text-[#0A192F] hover:bg-[#EEF0F2]"
                  title="Email and text the customer a question about this order — also logged in the timeline"
                >
                  <MessageCircleQuestion className="mr-1 h-3.5 w-3.5" /> Ask the customer
                </Button>
              )}
              {/* The explicit way an order LEAVES the board (other than being
               * delivered): cancelling emails the customer and drops the
               * tile off every pipeline column. Admin-only (phase 32):
               * cancellation is destructive + revenue-hiding, so it needs
               * the owner's hand, not a staff member's. */}
              {isAdmin && order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmCancelOrder(true)}
                  className="ml-auto h-8 border-rose-200 text-rose-600 hover:bg-rose-50"
                  title="Cancel this order — it leaves the Kanban board and the customer is emailed"
                >
                  <Ban className="mr-1 h-3.5 w-3.5" /> Cancel order
                </Button>
              )}
            </div>
            {/* Phase 57: the order's promise, stated where the team acts.
             * Same clocks the Kanban colours use — pickup slot before pickup,
             * the speed tier the customer paid for during turnaround, and
             * the one-hour delivery run at the end. */}
            {(() => {
              const timing = getOrderTiming(order)
              if (!timing) return null
              const tone =
                timing.state === 'overdue'
                  ? 'text-rose-700'
                  : timing.state === 'watch'
                    ? 'text-amber-700'
                    : 'text-emerald-700/80'
              const dot =
                timing.state === 'overdue'
                  ? 'bg-rose-400'
                  : timing.state === 'watch'
                    ? 'bg-amber-400'
                    : 'bg-emerald-300'
              return (
                <p className={cn('mt-2 flex items-center gap-1.5 text-[11px] leading-snug', tone)}>
                  <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot)} />
                  {pacingSentence(timing)}
                </p>
              )
            })()}
            {/* Phase 55: the owner's "don't over-log" rule, right where the
             * status is changed. Staff see exactly which moves email the
             * customer, so a card is only advanced when the stage has
             * physically happened — never "to tidy the board". */}
            <p className="mt-2 text-[11px] leading-snug text-[#6F88A8]">
              <Bell className="mr-1 inline h-3 w-3" />
              Emails go out at <strong>awaiting payment, ready to pick up, finishing, out for
              delivery</strong> and <strong>delivered</strong> — the quiet stages (picked up, at the
              station, processing) send nothing. Only advance the status when that stage has
              physically happened.
            </p>
          </section>

          <Separator />

          <section>
            <h3 className="mb-2 text-sm font-semibold text-[#0A192F]">{order.type === 'ITEM' ? 'Items' : 'Weight'}</h3>
            {order.type === 'ITEM' ? (
              <ul className="space-y-1.5 text-sm">
                {items.map((i: any, idx: number) => (
                  <li key={idx} className="flex items-center justify-between">
                    <span className="text-[#6F88A8]"><span className="font-semibold text-[#0A192F]">{i.quantity}×</span> {i.name}</span>
                    <span className="font-medium text-[#0A192F]">{formatNaira(i.quantity * i.unitPrice)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-lg bg-[#EEF0F2] p-3 text-sm">
                {order.finalWeight != null ? (
                  <>
                    <p className="text-[#0A192F]">Final weight: <strong>{order.finalWeight}kg</strong></p>
                    <p className="text-[#6F88A8]">@ {formatNaira(appSettings.pricePerKg)}/kg · Minimum {appSettings.minimumKg}kg charge applies.</p>
                  </>
                ) : (
                  <p className="text-amber-700">Awaiting weighing at the station.</p>
                )}
              </div>
            )}
          </section>

          {order.alterationNotes && (
            <section className="rounded-lg border border-[#E3BE4F] bg-[#FBF5E0] p-4">
              <p className="flex items-center gap-1.5 font-medium text-[#0A192F]">
                <Scissors className="h-4 w-4 text-[#D4AF37]" /> Alteration note (from the customer)
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-[#6F88A8]">{order.alterationNotes}</p>
              <p className="mt-2 text-xs text-[#6F88A8]">
                Seamstress workflow: assess each piece → call the customer to confirm details → send
                the quote → sew only after approval. Update the customer by phone or SMS.
              </p>
            </section>
          )}

          {order.type === 'KG' && (
            <section className="rounded-lg border border-[#C8D2DF] bg-[#FBF5E0] p-4">
              <p className="flex items-center gap-1.5 font-medium text-[#0A192F]"><Scale className="h-4 w-4 text-[#D4AF37]" /> Weight entry</p>
              <p className="mt-1 text-xs text-[#6F88A8]">Weigh at station, enter kg. Server calculates total.</p>
              <div className="mt-3 flex items-end gap-2">
                <div className="flex-1"><Label htmlFor="weight" className="text-xs">Weight (kg)</Label>
                <Input id="weight" type="number" min="0" step="0.5" value={weightInput} onChange={(e) => setWeightInput(e.target.value)} className="mt-1" /></div>
                <Button onClick={handleSetWeight} className="bg-[#0A192F] hover:bg-[#1B3A5F]">Calculate &amp; send invoice</Button>
              </div>
            </section>
          )}

          <section className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg bg-[#EEF0F2] p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-[#0A192F]"><MapPin className="h-3.5 w-3.5 text-[#D4AF37]" /> Pickup</p>
              <p className="mt-1 text-[#6F88A8] break-words">{order.pickupAddress}</p>
              <p className="mt-1 text-xs text-[#6F88A8]"><Calendar className="mr-1 inline h-3 w-3" />{formatDate(order.pickupDate)} · {order.pickupTimeSlot}</p>
            </div>
            <div className="rounded-lg bg-[#EEF0F2] p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-[#0A192F]"><Truck className="h-3.5 w-3.5 text-[#D4AF37]" /> Delivery</p>
              <p className="mt-1 text-[#6F88A8] break-words">{order.deliveryAddress ?? order.pickupAddress}</p>
              <p className="mt-1 text-xs text-[#6F88A8]">{order.deliveryDate ? formatDate(order.deliveryDate) : 'To be confirmed'}</p>
            </div>
          </section>

          {driver && (
            <section className="rounded-lg bg-[#FBF5E0] p-3 text-sm ring-1 ring-[#E3BE4F]">
              <p className="flex items-center gap-1.5 font-medium text-[#0A192F]"><UserIcon className="h-3.5 w-3.5 text-[#D4AF37]" /> Assigned rider</p>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[#6F88A8]">{driver.name}</span>
                <a href={`tel:${driver.phone}`} className="inline-flex items-center gap-1 text-xs text-[#0A192F] font-semibold hover:underline"><Phone className="h-3 w-3" /> {driver.phone}</a>
              </div>
              {/* Phase 61 — the WhatsApp bridge. The stop is already on the
               * rider's route (their app announces it, and their phone rings
               * if they turned notifications on). This is the belt-and-braces
               * nudge the owner asked for: one tap opens WhatsApp with the
               * job brief pre-typed — no integration, no keys, nothing to
               * break. If the Meta Cloud API credentials are ever added,
               * this same brief also goes out automatically. */}
              {(() => {
                const leg: 'PICKUP' | 'DELIVERY' = order.status === 'OUT_FOR_DELIVERY' ? 'DELIVERY' : 'PICKUP'
                const brief = assignmentBrief({
                  orderNumber: order.orderNumber,
                  leg,
                  customerName: customer?.name ?? null,
                  address:
                    leg === 'DELIVERY'
                      ? (order.deliveryAddress || order.pickupAddress)
                      : order.pickupAddress,
                  slot:
                    leg === 'PICKUP'
                      ? `${order.pickupDate ? formatDate(order.pickupDate) : 'today'} · ${order.pickupTimeSlot ?? ''}`.trim()
                      : 'next delivery run',
                })
                const href = waLink(driver.phone, brief)
                if (!href) return null
                return (
                  <div className="mt-2 border-t border-[#E3BE4F]/40 pt-2">
                    <p className="text-[11px] leading-snug text-[#6F88A8]">
                      Their app shows the stop within a minute. For a WhatsApp nudge as well:
                    </p>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> Send the job brief on WhatsApp
                    </a>
                  </div>
                )
              })()}
            </section>
          )}

          {/* Phase 60 — Smart Dispatch: the assignment moment. Ranked,
           * explained rider suggestions with one-click assign, shown exactly
           * while the order has no rider. (Assignment sends no email — the
           * rider's own app announces the new stop; see phase 55/59.) */}
          {!driver && order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
            <DispatchCard orderId={order.id} orderNumber={order.orderNumber} />
          )}

          {/* Phase 62 — Routing & fulfillment (ADMIN only): which branch
           * processes this order (usually decided automatically by the
           * pickup zone — re-route here when capacity says otherwise), and
           * whether an approved network partner processes it instead (their
           * revenue share is derived from delivered orders tagged here). */}
          {isAdmin && <RoutingSection order={order} updateOrderMutation={updateOrderMutation} />}

          <section>
            <h3 className="mb-2 text-sm font-semibold text-[#0A192F]">Payment</h3>
            {payments.length === 0 ? <p className="text-sm text-[#6F88A8]">No payment yet.</p> : (
              <div className="space-y-2">
                {payments.map((p: any) => (
                  <div key={p.id} className="rounded-lg bg-[#EEF0F2] px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <div><span className="text-[#6F88A8]">{p.method === 'BANK_TRANSFER' ? 'Bank Transfer' : 'Paystack'}</span>
                      <span className="ml-2 text-xs text-[#6F88A8]">{formatDateTime(p.createdAt)}</span></div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#0A192F]">{p.amount > 0 ? formatNaira(p.amount) : ''}</span>
                        {p.status === 'VERIFIED' && <Badge className="bg-[#FBF5E0] text-[#0A192F]"><CheckCircle2 className="mr-1 h-3 w-3" /> Verified</Badge>}
                        {p.status === 'REJECTED' && <Badge variant="outline" className="border-rose-200 text-rose-700"><XCircle className="mr-1 h-3 w-3" /> Rejected</Badge>}
                        {p.status === 'PENDING' && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700"><AlertCircle className="mr-1 h-3 w-3" /> Pending</Badge>}
                      </div>
                    </div>

                    {/* The customer's transfer screenshot, right where the
                        verify decision is made — tap to see it full size. */}
                    {p.receiptUrl && (
                      <button
                        type="button"
                        onClick={() => setReceiptZoom(true)}
                        className="mt-2 block overflow-hidden rounded-md border border-[#C8D2DF] bg-white transition hover:ring-2 hover:ring-[#D4AF37]"
                        title="View full receipt"
                      >
                        <img
                          src={p.receiptUrl}
                          alt="Transfer receipt"
                          className="block max-h-28 w-auto"
                        />
                      </button>
                    )}

                    {p.status === 'PENDING' && p.method === 'BANK_TRANSFER' && (
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" onClick={() => handleVerify(p.id)} disabled={busy} className="bg-[#0A192F] hover:bg-[#1B3A5F] disabled:opacity-60">
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> {busy ? 'Verifying…' : 'Verify payment'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleReject(p.id)} disabled={busy} className="border-rose-300 text-rose-700 disabled:opacity-60">
                          <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
                        </Button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Late-landing money: a rejected transfer can still be
                    approved — banks sometimes deliver minutes or hours after
                    the check. One click, same email + pipeline rules as a
                    fresh verify. Staff keep the approve power (verification
                    is their day job); permanently REMOVING a claim from the
                    queue is destructive, so that button is admin-only
                    (phase 32). */}
                {rejectedBankTransfer && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-800">
                      <RotateCcw className="h-4 w-4" /> Approve payment
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-emerald-700">
                      Transfers can land minutes or hours after a rejection. If the money has now
                      arrived, approve it — the customer is emailed and the order moves on, exactly
                      like a fresh verification.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleVerify(rejectedBankTransfer.id)}
                        disabled={busy}
                        className="bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-60"
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> {busy ? 'Approving…' : 'Approve payment now'}
                      </Button>
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmRemovePayment(rejectedBankTransfer)}
                          disabled={deletePaymentMutation.isPending}
                          className="border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                          title="Delete this rejected claim from the verification queue"
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          {deletePaymentMutation.isPending ? 'Removing…' : 'Remove from queue'}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            {order.totalPrice != null && onViewInvoice && (
              <div className="mt-3 flex items-center justify-between border-t pt-3">
                <Button variant="outline" size="sm" onClick={() => onViewInvoice(order)} className="rounded-full border-[#E2E5E9] text-[#0A192F]"><Receipt className="mr-1 h-3.5 w-3.5" /> View invoice</Button>
                <span className="text-sm text-[#6F88A8]">Total: <strong className="text-[#0A192F]">{(order as any).loyaltyFree ? 'On the house — ₦0' : formatNaira(order.totalPrice)}</strong></span>
              </div>
            )}
          </section>

          {(media.length > 0 || (mediaCount > 0 && mediaRows === null) || photosExpired) && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[#0A192F]"><Shield className="h-4 w-4 text-[#D4AF37]" /> Condition photos{media.length > 0 ? ` (${media.length})` : mediaCount > 0 ? ` (${mediaCount})` : ''}</h3>
              {media.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {media.map((m: any) => (
                    <a
                      key={m.id}
                      href={m.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="Open full size"
                      className="aspect-square overflow-hidden rounded-lg ring-1 ring-[#E3BE4F] transition hover:ring-2 hover:ring-[#D4AF37]"
                    >
                      <img src={m.imageUrl} alt="Condition" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
              {media.length === 0 && mediaCount > 0 && mediaRows === null && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {Array.from({ length: Math.min(mediaCount, 8) }).map((_, i) => (
                    <div key={i} className="aspect-square animate-pulse rounded-lg bg-[#F1F3F6]" />
                  ))}
                </div>
              )}
              {media.length === 0 && photosExpired && (
                <p className="rounded-lg bg-[#F5F7FA] p-3 text-xs text-[#6F88A8]">
                  The 24-hour claim window after delivery has closed, so this order's condition
                  photos were removed — exactly as the Return-as-Received Guarantee terms provide.
                  The order record itself is untouched.
                </p>
              )}
            </section>
          )}

          <section><h3 className="mb-2 text-sm font-semibold text-[#0A192F]">Timeline</h3><OrderTimeline order={order} /></section>
        </div>
      </DialogContent>

      {/* Full-size receipt viewer — the thumbnail above opens this. */}
      {receiptZoom && (
        <Dialog open onOpenChange={(o) => !o && setReceiptZoom(false)}>
          <DialogContent className="max-h-[92vh] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-sm">Transfer receipt</DialogTitle>
              <DialogDescription className="text-xs">
                Uploaded by the customer — cross-check the amount and sender against your bank
                statement before verifying.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[70vh] overflow-y-auto rounded-lg bg-[#EEF0F2] p-2">
              <img
                src={payments.find((p: any) => p.receiptUrl)?.receiptUrl}
                alt="Transfer receipt"
                className="block w-full rounded-md bg-white"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirm removing a rejected payment claim from the queue */}
      <AlertDialog open={!!confirmRemovePayment} onOpenChange={(o) => !o && setConfirmRemovePayment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this rejected transfer?</AlertDialogTitle>
            <AlertDialogDescription>
              The claim for{' '}
              <strong>{confirmRemovePayment ? formatNaira(confirmRemovePayment.amount) : ''}</strong>{' '}
              will be deleted from the verification queue for good. The customer is not emailed —
              they already received the rejection instructions. If this order is still awaiting
              payment, it returns to Requested so the customer can re-confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmRemovePayment && handleRemovePayment(confirmRemovePayment.id)}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              Remove from queue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Ask-the-customer composer (phase 54) */}
      <Dialog open={askOpen} onOpenChange={setAskOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Ask {customer?.name ?? 'the customer'} a question</DialogTitle>
            <DialogDescription className="text-xs">
              This is the only mid-order message customers get apart from their status updates —
              use it when the team genuinely needs an answer (a gate code, a colour check, a
              missing item). It goes out by email and text, and is logged in the order timeline.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={askText}
            onChange={(e) => setAskText(e.target.value)}
            placeholder="e.g. Our rider is nearby — which gate should he call at for the pickup?"
            rows={4}
            maxLength={1000}
            className="text-sm"
          />
          <p className="text-[11px] text-[#6F88A8]">
            {askText.trim().length}/1000 · they can reply by calling or messaging the Kozy line.
          </p>
          {/* Phase 55: WhatsApp deep link — the owner's "this is where
             WhatsApp can come in". Some conversations are better had on
             WhatsApp (photos of a stain, a voice note); this opens WhatsApp
             on this device with the question prefilled. IMPORTANT: unlike
             the email/SMS send, a WhatsApp exchange is NOT logged to the
             order timeline — that trade-off is stated right here so nobody
             mistakes it for the audited channel. */}
          {customer?.phone && (
            <a
              href={whatsappLink(
                customer.phone,
                `Hello ${(customer.name || 'there').split(' ')[0]} — quick question about your Kozy Care order #${order.orderNumber}: ${askText.trim()}`
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#25D366] px-3 text-xs font-semibold text-white transition hover:bg-[#1eb85a]"
              title="Open WhatsApp on this device with this question prefilled — the chat is not logged to the order timeline"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Send this on WhatsApp instead
            </a>
          )}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setAskOpen(false)} disabled={askSending}>
              Never mind
            </Button>
            <Button
              size="sm"
              onClick={handleAskCustomer}
              disabled={askSending || askText.trim().length < 10}
              className="bg-[#0A192F] text-white hover:bg-[#102740]"
            >
              {askSending ? 'Sending…' : 'Send question'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm cancelling the order */}
      <AlertDialog open={confirmCancelOrder} onOpenChange={setConfirmCancelOrder}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel order #{order.orderNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              The order will leave the Kanban board immediately and {customer?.name ?? 'the customer'}{' '}
              will be emailed that the order is cancelled. This does not delete any records — the
              order stays searchable in lists with a Cancelled status, and any verified payments
              remain in your finances. This cannot be undone from the board (an admin can still
              set the status back from the dropdown if needed).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Don&apos;t cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelOrder}
              disabled={updateOrderMutation.isPending}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {updateOrderMutation.isPending ? 'Cancelling…' : 'Cancel this order'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}

// =====================================================
// ROUTING & FULFILLMENT (phase 62, ADMIN only)
// =====================================================
// Branch re-routing + partner fulfillment tagging. Both write through the
// standard order PATCH (audited as status events server-side) and update the
// shared cache instantly.
function RoutingSection({
  order,
  updateOrderMutation,
}: {
  order: any
  updateOrderMutation: any
}) {
  const { data: branches } = useBranches()
  const { data: partnerData } = usePartners()
  const approved = (partnerData?.partners ?? []).filter((p: any) => p.status === 'APPROVED')

  const setBranch = (branchId: string) =>
    updateOrderMutation.mutate({ id: order.id, branchId: branchId || null })
  const setPartner = (partnerId: string) =>
    updateOrderMutation.mutate({ id: order.id, fulfilledByPartnerId: partnerId || null })

  const selectClass =
    'mt-1 w-full rounded-lg border border-[#D5DBE1] bg-white px-2.5 py-2 text-sm text-[#0A192F] focus:border-[#D4AF37] focus:outline-none'

  return (
    <section className="rounded-lg border border-[#D5DBE1] bg-white p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-[#0A192F]">
        <MapPin className="h-3.5 w-3.5 text-[#D4AF37]" /> Routing &amp; fulfillment
      </p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wide text-[#6F88A8]">
            Processing branch
          </label>
          <select
            value={(order as any).branchId ?? ''}
            onChange={(e) => setBranch(e.target.value)}
            className={selectClass}
          >
            <option value="">Not routed (legacy)</option>
            {(branches ?? []).map((b: any) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.zoneNames?.length ? ` — ${b.zoneNames.join(', ')}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wide text-[#6F88A8]">
            Fulfilled by (network partner)
          </label>
          <select
            value={(order as any).fulfilledByPartnerId ?? ''}
            onChange={(e) => setPartner(e.target.value)}
            className={selectClass}
            disabled={approved.length === 0}
          >
            <option value="">
              {approved.length === 0 ? 'No approved partners yet' : 'In-house (this branch)'}
            </option>
            {approved.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.businessName} — {p.revenueSharePartnerPct}% partner share
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-[#6F88A8]">
        Branch routing is automatic from the pickup&apos;s zone — change it only when capacity
        says otherwise. Tagging a partner moves processing (and their revenue share) to them;
        the Partners ledger updates when the order is delivered.
      </p>
    </section>
  )
}
