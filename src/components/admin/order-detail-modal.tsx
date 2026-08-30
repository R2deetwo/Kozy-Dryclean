'use client'

import { useState, useMemo } from 'react'
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
  User as UserIcon,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw,
} from 'lucide-react'
import { useOrders, useUpdateOrder, usePayments, useVerifyPayment, useUsers, useAppSettings } from '@/lib/hooks'
import { formatNaira, formatDateTime, formatDate, type OrderStatus } from '@/lib/types'
import { OrderPipeline, OrderTimeline } from '@/components/shared/order-pipeline'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
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

interface Props {
  order: any
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

export function OrderDetailModal({ order, onClose, onViewInvoice }: Props) {
  // `order` is the LIVE object derived from the React Query cache (the board
  // passes selectedId, not a stale snapshot) — so every field below reflects
  // verify/reject/status mutations the moment they land.
  const customer = order.user
  const driver = order.driver
  const payments = order.payments ?? []
  const media = order.media ?? []
  const appSettings = useAppSettings()

  // Mutations via React Query
  const updateOrderMutation = useUpdateOrder()
  const verifyPaymentMutation = useVerifyPayment()

  // Users list for driver assignment — fetchAll so the dropdown contains
  // EVERY driver, not just the newest 25 users.
  const { data: usersData } = useUsers({ fetchAll: true })
  const drivers = (usersData ?? []).filter((u: any) => u.role === 'DRIVER')

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

  const handleAssignDriver = (driverId: string) => {
    updateOrderMutation.mutate(
      { id: order.id, driverId },
      {
        onSuccess: () => toast({ title: 'Driver assigned' }),
        onError: (e: any) => toast({ title: 'Could not assign driver', description: e?.message, variant: 'destructive' }),
      }
    )
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

  const pendingPayment = payments.find((p: any) => p.status === 'PENDING')
  const rejectedBankTransfer = payments.find(
    (p: any) => p.status === 'REJECTED' && p.method === 'BANK_TRANSFER'
  )
  const busy = verifyPaymentMutation.isPending

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono">#{order.orderNumber}</span>
            <Badge variant="outline" className="rounded-full text-[10px] text-[#0A192F] border-[#E2E5E9]">
              {order.type === 'ITEM' ? 'Retail' : 'Corporate'}
            </Badge>
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
                {order.modeOfWash === 'HANDWASH' ? 'Handwash' : 'Machine wash'}
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
          <section>
            <h3 className="mb-2 text-sm font-semibold text-[#0A192F]">Order progress</h3>
            <OrderPipeline order={order} />
            <div className="mt-3 flex items-center gap-2">
              <Label className="text-xs text-[#6F88A8]">Set status</Label>
              <Select value={statusSelect} onValueChange={(v) => handleStatusChange(v as OrderStatus)}>
                <SelectTrigger className="h-8 w-56 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">{s.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
            </section>
          )}

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
                    fresh verify. */}
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
                    <Button
                      size="sm"
                      onClick={() => handleVerify(rejectedBankTransfer.id)}
                      disabled={busy}
                      className="mt-2 bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-60"
                    >
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> {busy ? 'Approving…' : 'Approve payment now'}
                    </Button>
                  </div>
                )}
              </div>
            )}
            {order.totalPrice != null && onViewInvoice && (
              <div className="mt-3 flex items-center justify-between border-t pt-3">
                <Button variant="outline" size="sm" onClick={() => onViewInvoice(order)} className="rounded-full border-[#E2E5E9] text-[#0A192F]"><Receipt className="mr-1 h-3.5 w-3.5" /> View invoice</Button>
                <span className="text-sm text-[#6F88A8]">Total: <strong className="text-[#0A192F]">{formatNaira(order.totalPrice)}</strong></span>
              </div>
            )}
          </section>

          {media.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[#0A192F]"><Shield className="h-4 w-4 text-[#D4AF37]" /> Condition photos ({media.length})</h3>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {media.map((m: any) => (<div key={m.id} className="aspect-square overflow-hidden rounded-lg ring-1 ring-[#E3BE4F]"><img src={m.imageUrl} alt="Condition" className="h-full w-full object-cover" /></div>))}
              </div>
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
    </Dialog>
  )
}
