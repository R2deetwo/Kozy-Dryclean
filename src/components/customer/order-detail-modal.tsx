'use client'

import { useMemo } from 'react'
import {
  X,
  MapPin,
  Calendar,
  Clock,
  Phone,
  Shield,
  Truck,
  Receipt,
  User as UserIcon,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import { useStore, useUserById } from '@/lib/store'
import { formatNaira, formatDateTime, formatDate, type Order } from '@/lib/types'
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

interface Props {
  order: Order
  onClose: () => void
  onViewInvoice: (o: Order) => void
}

export function OrderDetailModal({ order, onClose, onViewInvoice }: Props) {
  const customer = useUserById(order.userId)
  const driver = useUserById(order.driverId)
  const allPayments = useStore((s) => s.payments)
  const allMedia = useStore((s) => s.media)
  const payments = useMemo(
    () => allPayments.filter((p) => p.orderId === order.id),
    [allPayments, order.id]
  )
  const media = useMemo(
    () => allMedia.filter((m) => m.orderId === order.id),
    [allMedia, order.id]
  )

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      {/* Mobile: full-screen bottom sheet | Desktop: centered modal */}
      <DialogContent className="bottom-0 top-auto sm:bottom-auto sm:top-[50%] max-h-[95vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl sm:max-w-2xl p-0 sm:p-6 gap-0">
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-navy-100" />
        </div>

        <div className="px-4 pt-2 sm:px-0 sm:pt-0">
          <DialogHeader className="space-y-2">
            <DialogTitle className="flex flex-wrap items-center gap-2 text-left">
              <span className="font-mono text-base sm:text-lg text-navy">#{order.orderNumber}</span>
              <Badge variant="outline" className="rounded-full text-[10px] border-navy-200 text-navy">
                {order.type === 'ITEM' ? 'Retail' : 'Corporate'}
              </Badge>
              {order.guaranteeActive && (
                <Badge className="rounded-full bg-gold-100 text-navy hover:bg-gold-100">
                  <Shield className="mr-1 h-2.5 w-2.5" /> Guarantee
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-navy-300">
              Booked on {formatDateTime(order.createdAt)}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5 px-4 pb-6 pt-4 sm:px-0">
          {/* Pipeline */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-navy">Order progress</h3>
            <OrderPipeline order={order} />
          </section>

          <Separator />

          {/* Items / weight */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-navy">
              {order.type === 'ITEM' ? 'Items' : 'Weight'}
            </h3>
            {order.type === 'ITEM' ? (
              <ul className="space-y-1.5 text-sm">
                {order.items.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2">
                    <span className="text-navy-300">
                      <span className="font-semibold text-navy">{i.quantity}×</span> {i.name}
                    </span>
                    <span className="font-medium text-navy shrink-0">{formatNaira(i.quantity * i.unitPrice)}</span>
                  </li>
                ))}
                {order.guaranteeActive && (
                  <li className="text-xs text-gold-600 pt-1">
                    Includes Return-as-Received discount.
                  </li>
                )}
              </ul>
            ) : (
              <div className="rounded-lg bg-linen-200 p-3 text-sm">
                {order.finalWeight !== undefined ? (
                  <>
                    <p className="text-navy">
                      Final weight: <strong>{order.finalWeight}kg</strong>
                    </p>
                    <p className="text-navy-300">
                      @ ₦800/kg · Minimum 10kg charge applies.
                    </p>
                  </>
                ) : (
                  <p className="text-amber-700">
                    Awaiting weighing at the station. Final invoice will be sent by SMS.
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Logistics */}
          <section className="grid gap-2 sm:gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-linen-200 p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-navy">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-gold-400" /> Pickup
              </p>
              <p className="mt-1 text-navy-300 break-words">{order.pickupAddress}</p>
              <p className="mt-1 text-xs text-navy-300">
                <Calendar className="mr-1 inline h-3 w-3" />
                {formatDate(order.pickupDate)} · {order.pickupTimeSlot}
              </p>
            </div>
            <div className="rounded-lg bg-linen-200 p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-navy">
                <Truck className="h-3.5 w-3.5 shrink-0 text-gold-400" /> Delivery
              </p>
              <p className="mt-1 text-navy-300 break-words">
                {order.deliveryAddress ?? order.pickupAddress}
              </p>
              <p className="mt-1 text-xs text-navy-300">
                {order.deliveryDate ? formatDate(order.deliveryDate) : 'To be confirmed'}
              </p>
            </div>
          </section>

          {/* Driver info */}
          {driver && (
            <section className="rounded-lg bg-gold-50 p-3 text-sm ring-1 ring-gold-200">
              <p className="flex items-center gap-1.5 font-medium text-navy">
                <UserIcon className="h-3.5 w-3.5 shrink-0 text-gold-400" /> Assigned rider
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-navy-300">{driver.name}</span>
                <a
                  href={`tel:${driver.phone}`}
                  className="inline-flex items-center gap-1 text-xs text-navy font-semibold hover:underline"
                >
                  <Phone className="h-3 w-3" /> {driver.phone}
                </a>
              </div>
            </section>
          )}

          {/* Payment */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-navy">Payment</h3>
            {payments.length === 0 ? (
              <p className="text-sm text-navy-300">No payment yet.</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-linen-200 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <span className="text-navy-300">
                        {p.method === 'BANK_TRANSFER' ? 'Bank Transfer' : 'Paystack'}
                      </span>
                      <span className="ml-2 text-xs text-navy-300">
                        {formatDateTime(p.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {p.amount > 0 && (
                        <span className="font-medium text-navy">{formatNaira(p.amount)}</span>
                      )}
                      {p.status === 'VERIFIED' && (
                        <Badge className="rounded-full bg-gold-100 text-navy hover:bg-gold-100">
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
                ))}
              </div>
            )}
            {order.totalPrice !== undefined && (
              <div className="mt-3 flex items-center justify-between border-t pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewInvoice(order)}
                  className="rounded-full border-navy-200 text-navy hover:bg-navy hover:text-white"
                >
                  <Receipt className="mr-1 h-3.5 w-3.5" /> View invoice
                </Button>
                <span className="text-sm text-navy-300">
                  Total: <strong className="text-navy">{formatNaira(order.totalPrice)}</strong>
                </span>
              </div>
            )}
          </section>

          {/* Condition capture media */}
          {media.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-navy">
                <Shield className="h-4 w-4 text-gold-400" /> Condition photos ({media.length})
              </h3>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {media.map((m) => (
                  <div
                    key={m.id}
                    className="aspect-square overflow-hidden rounded-lg ring-1 ring-gold-200"
                  >
                    <img
                      src={m.imageUrl}
                      alt="Condition"
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Timeline */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-navy">Timeline</h3>
            <OrderTimeline order={order} />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
