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
  User as UserIcon,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import { useStore, useUserById } from '@/lib/store'
import {
  formatNaira,
  formatDateTime,
  formatDate,
  B2B_PRICING,
  type Order,
  type OrderStatus,
} from '@/lib/types'
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
import { OrderPipeline, OrderTimeline } from '@/components/shared/order-pipeline'

interface Props {
  order: Order
  onClose: () => void
  onViewInvoice?: (o: Order) => void
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
  const customer = useUserById(order.userId)
  const driver = useUserById(order.driverId)
  const allUsers = useStore((s) => s.users)
  const allPayments = useStore((s) => s.payments)
  const allMedia = useStore((s) => s.media)
  const drivers = useMemo(
    () => allUsers.filter((u) => u.role === 'DRIVER'),
    [allUsers]
  )
  const payments = useMemo(
    () => allPayments.filter((p) => p.orderId === order.id),
    [allPayments, order.id]
  )
  const media = useMemo(
    () => allMedia.filter((m) => m.orderId === order.id),
    [allMedia, order.id]
  )
  const assignDriver = useStore((s) => s.assignDriver)
  const updateStatus = useStore((s) => s.updateOrderStatus)
  const setB2BWeight = useStore((s) => s.setB2BWeight)
  const verifyPayment = useStore((s) => s.verifyPayment)
  const rejectPayment = useStore((s) => s.rejectPayment)

  const [weightInput, setWeightInput] = useState(
    order.finalWeight?.toString() ?? ''
  )
  const [statusSelect, setStatusSelect] = useState<OrderStatus>(order.status)

  const pendingPayment = payments.find((p) => p.status === 'PENDING')

  const handleAssignDriver = (driverId: string) => {
    assignDriver(order.id, driverId)
    toast({ title: 'Driver assigned', description: 'The rider has been notified.' })
  }

  const handleStatusChange = (newStatus: OrderStatus) => {
    setStatusSelect(newStatus)
    updateStatus(order.id, newStatus, 'u-admin')
    toast({
      title: 'Status updated',
      description: `Order #${order.orderNumber} is now ${newStatus.replace(/_/g, ' ').toLowerCase()}.`,
    })
  }

  const handleSetWeight = () => {
    const kg = parseFloat(weightInput) || 0
    if (kg <= 0) {
      toast({ title: 'Invalid weight', description: 'Enter a value greater than 0.', variant: 'destructive' })
      return
    }
    setB2BWeight(order.id, kg, 'u-admin')
    toast({
      title: 'Weight recorded',
      description: `${kg}kg · ${formatNaira(Math.max(kg, B2B_PRICING.minimumKg) * B2B_PRICING.pricePerKg)} invoice sent.`,
    })
  }

  const handleVerify = () => {
    if (!pendingPayment) return
    verifyPayment(pendingPayment.id, 'u-admin')
    toast({ title: 'Payment verified', description: 'Customer notified by SMS.' })
  }
  const handleReject = () => {
    if (!pendingPayment) return
    rejectPayment(pendingPayment.id, 'u-admin')
    toast({ title: 'Payment rejected', description: 'Customer notified to re-upload.', variant: 'destructive' })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono">#{order.orderNumber}</span>
            <Badge variant="outline" className="rounded-full text-[10px]">
              {order.type === 'ITEM' ? 'Retail' : 'Corporate'}
            </Badge>
            {order.guaranteeActive && (
              <Badge className="rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                <Shield className="mr-1 h-2.5 w-2.5" /> Guarantee
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Booked on {formatDateTime(order.createdAt)} · Last updated {formatDateTime(order.updatedAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Pipeline + status control */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Order progress</h3>
            <OrderPipeline order={order} />
            <div className="mt-3 flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Set status</Label>
              <Select value={statusSelect} onValueChange={(v) => handleStatusChange(v as OrderStatus)}>
                <SelectTrigger className="h-8 w-56 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">
                      {s.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <Separator />

          {/* Customer */}
          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-foreground">
                <UserIcon className="h-3.5 w-3.5" /> Customer
              </p>
              <p className="mt-1 font-medium text-foreground">{customer?.name}</p>
              <a
                href={`tel:${customer?.phone}`}
                className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline"
              >
                <Phone className="h-3 w-3" /> {customer?.phone}
              </a>
              <p className="mt-1 text-xs text-muted-foreground">{customer?.email}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Role: <span className="font-medium">{customer?.role}</span>
              </p>
            </div>

            {/* Driver assignment */}
            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-foreground">
                <Truck className="h-3.5 w-3.5" /> Assigned rider
              </p>
              {driver ? (
                <>
                  <p className="mt-1 font-medium text-foreground">{driver.name}</p>
                  <a
                    href={`tel:${driver.phone}`}
                    className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline"
                  >
                    <Phone className="h-3 w-3" /> {driver.phone}
                  </a>
                </>
              ) : (
                <p className="mt-1 text-xs text-amber-700">No driver assigned.</p>
              )}
              <div className="mt-2">
                <Select onValueChange={handleAssignDriver}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Assign rider…" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Logistics */}
          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-foreground">
                <MapPin className="h-3.5 w-3.5" /> Pickup
              </p>
              <p className="mt-1 text-muted-foreground">{order.pickupAddress}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                <Calendar className="mr-1 inline h-3 w-3" />
                {formatDate(order.pickupDate)} · {order.pickupTimeSlot}
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-foreground">
                <Truck className="h-3.5 w-3.5" /> Delivery
              </p>
              <p className="mt-1 text-muted-foreground">
                {order.deliveryAddress ?? order.pickupAddress}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {order.deliveryDate ? formatDate(order.deliveryDate) : 'To be confirmed'}
              </p>
            </div>
          </section>

          {/* B2B weight input */}
          {order.type === 'KG' && (
            <section className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4">
              <p className="flex items-center gap-1.5 font-medium text-foreground">
                <Scale className="h-4 w-4 text-indigo-600" /> B2B weight entry
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Weigh the items at the station and enter the kilogram amount. Final invoice will
                be calculated at {formatNaira(B2B_PRICING.pricePerKg)}/kg (minimum{' '}
                {B2B_PRICING.minimumKg}kg).
              </p>
              <div className="mt-3 flex items-end gap-2">
                <div className="flex-1">
                  <Label htmlFor="weight" className="text-xs">
                    Weight (kg)
                  </Label>
                  <Input
                    id="weight"
                    type="number"
                    min="0"
                    step="0.5"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    placeholder="e.g. 25"
                    className="mt-1"
                  />
                </div>
                <Button
                  onClick={handleSetWeight}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  Calculate &amp; send invoice
                </Button>
              </div>
              {order.finalWeight !== undefined && (
                <p className="mt-2 text-xs text-indigo-700">
                  Recorded: {order.finalWeight}kg · Invoice: <strong>{formatNaira(order.totalPrice ?? 0)}</strong>
                </p>
              )}
            </section>
          )}

          {/* Items / weight */}
          {order.type === 'ITEM' && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Items</h3>
              <ul className="space-y-1.5 text-sm">
                {order.items.map((i) => (
                  <li key={i.id} className="flex items-center justify-between rounded bg-muted/40 px-3 py-1.5">
                    <span className="text-foreground/80">
                      {i.quantity}× {i.name}
                    </span>
                    <span className="font-medium">{formatNaira(i.quantity * i.unitPrice)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Payment verification */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Payment</h3>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payment yet.</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-lg border bg-muted/30 p-3 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">
                          {p.method === 'BANK_TRANSFER' ? 'Bank Transfer' : 'Paystack'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(p.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{formatNaira(p.amount)}</span>
                        {p.status === 'VERIFIED' && (
                          <Badge className="rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Verified
                          </Badge>
                        )}
                        {p.status === 'REJECTED' && (
                          <Badge variant="outline" className="rounded-full border-rose-200 text-rose-700">
                            <XCircle className="mr-1 h-3 w-3" /> Rejected
                          </Badge>
                        )}
                        {p.status === 'PENDING' && (
                          <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-amber-700">
                            <AlertCircle className="mr-1 h-3 w-3" /> Pending
                          </Badge>
                        )}
                      </div>
                    </div>

                    {p.status === 'PENDING' && p.method === 'BANK_TRANSFER' && (
                      <div className="mt-3 rounded-lg bg-amber-50 p-2 ring-1 ring-amber-200">
                        <p className="text-xs text-amber-900">
                          ⚠ Customer uploaded a receipt. Use the full Payment Verification Queue
                          for zoom-in review.
                        </p>
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleVerify}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Verify
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleReject}
                            className="border-rose-300 text-rose-700 hover:bg-rose-50"
                          >
                            <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {order.totalPrice !== undefined && onViewInvoice && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewInvoice(order)}
                className="mt-3 rounded-full"
              >
                <Receipt className="mr-1 h-3.5 w-3.5" /> View invoice
              </Button>
            )}
          </section>

          {/* Condition capture media */}
          {media.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Shield className="h-4 w-4 text-emerald-600" /> Condition photos ({media.length})
              </h3>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {media.map((m) => (
                  <div key={m.id} className="aspect-square overflow-hidden rounded-lg ring-1 ring-emerald-200">
                    <img src={m.imageUrl} alt="Condition" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Timeline</h3>
            <OrderTimeline order={order} />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
