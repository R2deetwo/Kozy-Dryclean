'use client'

import { useMemo } from 'react'
import {
  MapPin, Calendar, Clock, Phone, Shield, Truck, Receipt,
  User as UserIcon, CheckCircle2, XCircle, AlertCircle,
} from 'lucide-react'
import { formatNaira, formatDateTime, formatDate } from '@/lib/types'
import { OrderPipeline, OrderTimeline } from '@/components/shared/order-pipeline'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'

interface Props {
  order: any
  onClose: () => void
  onViewInvoice: (o: any) => void
}

export function OrderDetailModal({ order, onClose, onViewInvoice }: Props) {
  // All data comes from the order object (nested includes from the API)
  const customer = order.user
  const driver = order.driver
  const payments = order.payments ?? []
  const media = order.media ?? []

  // Parse items from itemsManifest JSON string
  const items = useMemo(() => {
    try { return JSON.parse(order.itemsManifest || '[]') } catch { return [] }
  }, [order.itemsManifest])

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bottom-0 top-auto sm:bottom-auto sm:top-[50%] max-h-[95vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl sm:max-w-2xl p-0 sm:p-6 gap-0">
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-[#E2E5E9]" />
        </div>

        <div className="px-4 pt-2 sm:px-0 sm:pt-0">
          <DialogHeader className="space-y-2">
            <DialogTitle className="flex flex-wrap items-center gap-2 text-left">
              <span className="font-mono text-base sm:text-lg text-[#0A192F]">#{order.orderNumber}</span>
              <Badge variant="outline" className="rounded-full text-[10px] border-[#E2E5E9] text-[#0A192F]">{order.type === 'ITEM' ? 'Retail' : 'Corporate'}</Badge>
              {order.guaranteeActive && <Badge className="rounded-full bg-[#FBF5E0] text-[#0A192F]"><Shield className="mr-1 h-2.5 w-2.5" /> Guarantee</Badge>}
            </DialogTitle>
            <DialogDescription className="text-[#6F88A8]">Booked on {formatDateTime(order.createdAt)}</DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5 px-4 pb-6 pt-4 sm:px-0">
          <section>
            <h3 className="mb-2 text-sm font-semibold text-[#0A192F]">Order progress</h3>
            <OrderPipeline order={order} />
          </section>

          <Separator />

          <section>
            <h3 className="mb-2 text-sm font-semibold text-[#0A192F]">{order.type === 'ITEM' ? 'Items' : 'Weight'}</h3>
            {order.type === 'ITEM' ? (
              <ul className="space-y-1.5 text-sm">
                {items.map((i: any, idx: number) => (
                  <li key={idx} className="flex items-center justify-between gap-2">
                    <span className="text-[#6F88A8]"><span className="font-semibold text-[#0A192F]">{i.quantity}×</span> {i.name}</span>
                    <span className="font-medium text-[#0A192F]">{formatNaira(i.quantity * i.unitPrice)}</span>
                  </li>
                ))}
                {order.guaranteeActive && <li className="text-xs text-[#D4AF37] pt-1">Includes Return-as-Received discount.</li>}
              </ul>
            ) : (
              <div className="rounded-lg bg-[#EEF0F2] p-3 text-sm">
                {order.finalWeight != null ? (
                  <><p className="text-[#0A192F]">Final weight: <strong>{order.finalWeight}kg</strong></p>
                  <p className="text-[#6F88A8]">@ ₦800/kg · Minimum 10kg charge applies.</p></>
                ) : <p className="text-amber-700">Awaiting weighing at the station.</p>}
              </div>
            )}
          </section>

          <section className="grid gap-2 sm:gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-[#EEF0F2] p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-[#0A192F]"><MapPin className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" /> Pickup</p>
              <p className="mt-1 text-[#6F88A8] break-words">{order.pickupAddress}</p>
              <p className="mt-1 text-xs text-[#6F88A8]"><Calendar className="mr-1 inline h-3 w-3" />{formatDate(order.pickupDate)} · {order.pickupTimeSlot}</p>
            </div>
            <div className="rounded-lg bg-[#EEF0F2] p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-[#0A192F]"><Truck className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" /> Delivery</p>
              <p className="mt-1 text-[#6F88A8] break-words">{order.deliveryAddress ?? order.pickupAddress}</p>
              <p className="mt-1 text-xs text-[#6F88A8]">{order.deliveryDate ? formatDate(order.deliveryDate) : 'To be confirmed'}</p>
            </div>
          </section>

          {driver && (
            <section className="rounded-lg bg-[#FBF5E0] p-3 text-sm ring-1 ring-[#E3BE4F]">
              <p className="flex items-center gap-1.5 font-medium text-[#0A192F]"><UserIcon className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" /> Assigned rider</p>
              <div className="mt-1 flex items-center justify-between gap-2">
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
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#EEF0F2] px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <span className="text-[#6F88A8]">{p.method === 'BANK_TRANSFER' ? 'Bank Transfer' : 'Paystack'}</span>
                      <span className="ml-2 text-xs text-[#6F88A8]">{formatDateTime(p.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {p.amount > 0 && <span className="font-medium text-[#0A192F]">{formatNaira(p.amount)}</span>}
                      {p.status === 'VERIFIED' && <Badge className="bg-[#FBF5E0] text-[#0A192F]"><CheckCircle2 className="mr-1 h-3 w-3" /> Verified</Badge>}
                      {p.status === 'REJECTED' && <Badge variant="outline" className="border-rose-200 text-rose-700"><XCircle className="mr-1 h-3 w-3" /> Rejected</Badge>}
                      {p.status === 'PENDING' && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700"><AlertCircle className="mr-1 h-3 w-3" /> Pending</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {order.totalPrice !== undefined && (
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
    </Dialog>
  )
}
