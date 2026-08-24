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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono">#{order.orderNumber}</span>
            <Badge variant="outline" className="rounded-full text-[10px]">
              {order.type === 'ITEM' ? 'Retail' : 'Corporate'}
            </Badge>
            {order.guaranteeActive && (
              <Badge className="rounded-full bg-gold-100 text-navy hover:bg-gold-100">
                <Shield className="mr-1 h-2.5 w-2.5" /> Guarantee
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Booked on {formatDateTime(order.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Pipeline */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-navy dark:text-white">Order progress</h3>
            <OrderPipeline order={order} />
          </section>

          <Separator />

          {/* Items / weight */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-navy dark:text-white">
              {order.type === 'ITEM' ? 'Items' : 'Weight'}
            </h3>
            {order.type === 'ITEM' ? (
              <ul className="space-y-1.5 text-sm">
                {order.items.map((i) => (
                  <li key={i.id} className="flex items-center justify-between">
                    <span className="text-navy-300 dark:text-navy-200">
                      {i.quantity}× {i.name}
                    </span>
                    <span className="font-medium">{formatNaira(i.quantity * i.unitPrice)}</span>
                  </li>
                ))}
                {order.guaranteeActive && (
                  <li className="text-xs text-navy-300">
                    Includes 5% Return-as-Received discount.
                  </li>
                )}
              </ul>
            ) : (
              <div className="rounded-lg bg-linen-200 dark:bg-navy-700/50 p-3 text-sm">
                {order.finalWeight !== undefined ? (
                  <>
                    <p>
                      Final weight: <strong>{order.finalWeight}kg</strong>
                    </p>
                    <p className="text-navy-300 dark:text-navy-200">
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
          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-linen-200 dark:bg-navy-700 p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-navy dark:text-white">
                <MapPin className="h-3.5 w-3.5" /> Pickup
              </p>
              <p className="mt-1 text-navy-300 dark:text-navy-200">{order.pickupAddress}</p>
              <p className="mt-1 text-xs text-navy-300 dark:text-navy-200">
                <Calendar className="mr-1 inline h-3 w-3" />
                {formatDate(order.pickupDate)} · {order.pickupTimeSlot}
              </p>
            </div>
            <div className="rounded-lg bg-linen-200 dark:bg-navy-700 p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-navy dark:text-white">
                <Truck className="h-3.5 w-3.5" /> Delivery
              </p>
              <p className="mt-1 text-navy-300 dark:text-navy-200">
                {order.deliveryAddress ?? order.pickupAddress}
              </p>
              <p className="mt-1 text-xs text-navy-300 dark:text-navy-200">
                {order.deliveryDate ? formatDate(order.deliveryDate) : 'To be confirmed'}
              </p>
            </div>
          </section>

          {/* Driver info */}
          {driver && (
            <section className="rounded-lg bg-gold-50/50 p-3 text-sm ring-1 ring-gold-100">
              <p className="flex items-center gap-1.5 font-medium text-navy dark:text-white">
                <UserIcon className="h-3.5 w-3.5" /> Assigned rider
              </p>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-navy-300 dark:text-navy-200">{driver.name}</span>
                <a
                  href={`tel:${driver.phone}`}
                  className="inline-flex items-center gap-1 text-xs text-navy-300 hover:underline"
                >
                  <Phone className="h-3 w-3" /> {driver.phone}
                </a>
              </div>
            </section>
          )}

          {/* Payment */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-navy dark:text-white">Payment</h3>
            {payments.length === 0 ? (
              <p className="text-sm text-navy-300 dark:text-navy-200">No payment yet.</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg bg-linen-200 dark:bg-navy-700 px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="text-navy-300 dark:text-navy-200">
                        {p.method === 'BANK_TRANSFER' ? 'Bank Transfer' : 'Paystack'}
                      </span>
                      <span className="ml-2 text-xs text-navy-300 dark:text-navy-200">
                        {formatDateTime(p.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.amount > 0 && (
                        <span className="font-medium">{formatNaira(p.amount)}</span>
                      )}
                      <PaymentStatusBadge status={p.status} />
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
                  className="rounded-full"
                >
                  <Receipt className="mr-1 h-3.5 w-3.5" /> View invoice
                </Button>
                <span className="text-sm text-navy-300 dark:text-navy-200">
                  Order total: <strong className="text-navy dark:text-white">{formatNaira(order.totalPrice)}</strong>
                </span>
              </div>
            )}
          </section>

          {/* Condition capture media */}
          {media.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-navy dark:text-white">
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
            <h3 className="mb-2 text-sm font-semibold text-navy dark:text-white">Timeline</h3>
            <OrderTimeline order={order} />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PaymentStatusBadge({ status }: { status: 'PENDING' | 'VERIFIED' | 'REJECTED' }) {
  if (status === 'VERIFIED') {
    return (
      <Badge className="rounded-full bg-gold-100 text-navy hover:bg-gold-100">
        Verified
      </Badge>
    )
  }
  if (status === 'REJECTED') {
    return (
      <Badge variant="outline" className="rounded-full border-rose-200 text-rose-700">
        Rejected
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-amber-700">
      Pending verification
    </Badge>
  )
}
