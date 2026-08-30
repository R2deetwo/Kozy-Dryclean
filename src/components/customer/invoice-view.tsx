'use client'

import { useMemo } from 'react'
import {
  ArrowLeft,
  Download,
  Printer,
  Shield,
  Sparkles,
} from 'lucide-react'
import { useAppSettings } from '@/lib/hooks'
import {
  formatNaira,
  formatDateTime,
  formatDate,
  GUARANTEE_DISCOUNT,
  type Order,
  type OrderItem,
} from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

/** The API order shape (GET /api/orders includes user + payments and carries
 *  the item manifest as a JSON string). Legacy store-shaped orders (with
 *  `items` pre-parsed) still work through the fallbacks below. */
type InvoiceOrder = Order & {
  itemsManifest?: string | null
  user?: { id: string; name: string; email: string; phone?: string } | null
  payments?: {
    id: string
    orderId: string
    amount: number
    method: string
    status: string
    verifiedAt?: string | null
    createdAt?: string
  }[]
}

interface Props {
  order: InvoiceOrder
  onBack: () => void
}

export function InvoiceView({ order, onBack }: Props) {
  // EVERYTHING money-related comes from the server (AppSetting via
  // /api/settings/app): bank details, contact line and per-kg pricing.
  // This is the document a customer transfers against — it used to read the
  // admin's localStorage (placeholder GTB account + a non-existent
  // concierge email), which could send real money to a fake account number
  // (audit finding). The customer record comes from the API order object;
  // the old zustand fallback could print a demo persona as "Bill to".
  const settings = useAppSettings()
  const customer = order.user
  const payments = useMemo(
    () => (order.payments ?? []).filter((p) => p.orderId === order.id),
    [order.payments, order.id]
  )
  // API orders carry the manifest as JSON; store-shaped orders have items
  // pre-parsed. Support both.
  const items: OrderItem[] = useMemo(() => {
    if (order.items && order.items.length > 0) return order.items
    try {
      return JSON.parse(order.itemsManifest || '[]') as OrderItem[]
    } catch {
      return []
    }
  }, [order.items, order.itemsManifest])
  const verifiedPayment = payments.find((p) => p.status === 'VERIFIED')

  const subtotal =
    order.type === 'ITEM'
      ? items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
      : (order.finalWeight ?? 0) * settings.pricePerKg
  const guaranteeDiscount =
    order.guaranteeActive && order.type === 'ITEM'
      ? subtotal * GUARANTEE_DISCOUNT
      : 0
  const total = order.totalPrice ?? 0

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-linen-200">
      <div className="mx-auto max-w-3xl px-3 py-4 sm:px-6 sm:py-6">
        <button
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-1 text-xs text-navy-300 hover:text-navy"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </button>

        <Card className="overflow-hidden shadow-navy">
          {/* Invoice header */}
          <div className="bg-navy-gradient px-4 py-5 text-white sm:px-8 sm:py-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 shrink-0">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <p className="text-lg font-bold">Kozy Care</p>
                </div>
                <p className="mt-1 text-xs text-gold-100">
                  {settings.contactPhone} · {settings.contactEmail}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold uppercase tracking-wide">Invoice</p>
                <p className="font-mono text-sm">#{order.orderNumber}</p>
                <p className="mt-1 text-xs text-gold-100">
                  Issued: {formatDate(verifiedPayment?.verifiedAt ?? order.updatedAt)}
                </p>
              </div>
            </div>
          </div>

          <CardContent className="p-4 sm:p-8">
            {/* Bill to */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-300">Bill to</p>
                <p className="mt-1 font-semibold text-navy">{customer?.name}</p>
                <p className="text-sm text-navy-300">{customer?.phone}</p>
                <p className="text-sm text-navy-300 truncate">{customer?.email}</p>
                <p className="mt-1 text-xs text-navy-300">{order.pickupAddress}</p>
              </div>
              <div className="sm:text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-300">Order details</p>
                <p className="mt-1 text-sm text-navy-300">
                  Type: <span className="font-medium text-navy">
                    {order.type === 'ITEM' ? 'Retail / Per-item' : 'Corporate / Per-kg'}
                  </span>
                </p>
                <p className="text-sm text-navy-300">
                  Pickup: <span className="font-medium text-navy">{formatDate(order.pickupDate)}</span>
                </p>
                {order.deliveryDate && (
                  <p className="text-sm text-navy-300">
                    Delivered: <span className="font-medium text-navy">{formatDate(order.deliveryDate)}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="my-6 border-t border-linen-300" />

            {/* Line items — responsive: table on desktop, stacked cards on mobile */}
            {/* Desktop table */}
            <table className="hidden w-full text-sm sm:table">
              <thead>
                <tr className="border-b border-linen-300 text-left text-xs uppercase tracking-wide text-navy-300">
                  <th className="pb-2">Description</th>
                  <th className="pb-2 text-center">Qty / Weight</th>
                  <th className="pb-2 text-right">Unit price</th>
                  <th className="pb-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {order.type === 'ITEM' ? (
                  items.map((i) => (
                    <tr key={i.id} className="border-b border-linen-200 last:border-0">
                      <td className="py-2 text-navy">{i.name}</td>
                      <td className="py-2 text-center text-navy-300">{i.quantity}</td>
                      <td className="py-2 text-right text-navy-300">{formatNaira(i.unitPrice)}</td>
                      <td className="py-2 text-right font-medium text-navy">{formatNaira(i.quantity * i.unitPrice)}</td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-b border-linen-200 last:border-0">
                    <td className="py-2 text-navy">Bulk laundry (per kg)</td>
                    <td className="py-2 text-center text-navy-300">{order.finalWeight}kg</td>
                    <td className="py-2 text-right text-navy-300">{formatNaira(settings.pricePerKg)}</td>
                    <td className="py-2 text-right font-medium text-navy">
                      {formatNaira((order.finalWeight ?? 0) * settings.pricePerKg)}
                    </td>
                  </tr>
                )}
                {order.guaranteeActive && guaranteeDiscount > 0 && (
                  <tr>
                    <td className="py-2 text-navy-300" colSpan={3}>
                      Return-as-Received discount ({Math.round(GUARANTEE_DISCOUNT * 100)}%)
                    </td>
                    <td className="py-2 text-right font-medium text-navy-300">
                      −{formatNaira(guaranteeDiscount)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Mobile: stacked cards */}
            <div className="space-y-2 sm:hidden">
              {order.type === 'ITEM' ? (
                items.map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-2 rounded-lg bg-linen-100 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-navy truncate">{i.name}</p>
                      <p className="text-xs text-navy-300">
                        {i.quantity}× {formatNaira(i.unitPrice)}
                      </p>
                    </div>
                    <span className="font-medium text-navy shrink-0">{formatNaira(i.quantity * i.unitPrice)}</span>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-linen-100 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-navy">Bulk laundry (per kg)</p>
                    <p className="text-xs text-navy-300">
                      {order.finalWeight}kg × {formatNaira(settings.pricePerKg)}
                    </p>
                  </div>
                  <span className="font-medium text-navy shrink-0">
                    {formatNaira((order.finalWeight ?? 0) * settings.pricePerKg)}
                  </span>
                </div>
              )}
              {order.guaranteeActive && guaranteeDiscount > 0 && (
                <div className="flex items-center justify-between gap-2 px-3 py-1 text-xs text-navy-300">
                  <span>Discount ({Math.round(GUARANTEE_DISCOUNT * 100)}%)</span>
                  <span>−{formatNaira(guaranteeDiscount)}</span>
                </div>
              )}
            </div>

            {/* Totals */}
            <div className="mt-4 flex justify-end">
              <div className="w-full sm:w-48 space-y-1 text-sm">
                <div className="flex justify-between text-navy-300">
                  <span>Subtotal</span>
                  <span>{formatNaira(subtotal)}</span>
                </div>
                {guaranteeDiscount > 0 && (
                  <div className="flex justify-between text-navy-300">
                    <span>Discount</span>
                    <span>−{formatNaira(guaranteeDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-linen-300 pt-2 text-base font-bold text-navy">
                  <span>Total</span>
                  <span>{formatNaira(total)}</span>
                </div>
              </div>
            </div>

            {/* Payment summary */}
            {verifiedPayment && (
              <div className="mt-6 rounded-lg bg-gold-50 p-3 sm:p-4 text-sm ring-1 ring-gold-200">
                <p className="flex items-center justify-between gap-2">
                  <span className="text-navy">Payment received</span>
                  <span className="font-bold text-navy">{formatNaira(verifiedPayment.amount)}</span>
                </p>
                <p className="mt-1 text-xs text-navy-300">
                  {verifiedPayment.method === 'BANK_TRANSFER'
                    ? 'Bank transfer verified by admin'
                    : 'Paystack webhook auto-verified'}{' '}
                  · {formatDateTime(verifiedPayment.verifiedAt ?? payments[0]?.createdAt ?? order.updatedAt)}
                </p>
              </div>
            )}

            {/* Bank details */}
            <div className="mt-6 rounded-lg bg-linen-200 p-3 sm:p-4 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy-300">Bank details for transfer</p>
              <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <span className="text-navy-300">Bank</span>
                <span className="font-medium text-navy text-right">{settings.bankName}</span>
                <span className="text-navy-300">Account name</span>
                <span className="font-medium text-navy text-right">{settings.accountName}</span>
                <span className="text-navy-300">Account number</span>
                <span className="font-mono font-bold text-navy text-right">{settings.accountNumber}</span>
              </div>
            </div>

            {order.guaranteeActive && (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-gold-50 p-3 text-xs text-navy-300 ring-1 ring-gold-200">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
                <p>
                  Return-as-Received Guarantee active. Items must be returned clean and in the
                  structural condition documented at pickup. Claims must be filed within 24 hours
                  of delivery.
                </p>
              </div>
            )}

            {/* Footer actions */}
            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-linen-300 pt-4">
              <Button variant="outline" size="sm" onClick={() => window.print()} className="rounded-full border-navy-200 text-navy hover:bg-navy hover:text-white">
                <Printer className="mr-2 h-3.5 w-3.5" /> Print
              </Button>
              {/* window.print() lets the customer save the invoice as PDF via
                  the browser dialog — the button was previously dead. */}
              <Button
                size="sm"
                onClick={() => window.print()}
                className="rounded-full bg-gold-gradient text-navy hover:opacity-90"
              >
                <Download className="mr-2 h-3.5 w-3.5" /> Download PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-navy-300">
          This invoice was auto-generated by Kozy Care&apos;s order system.
        </p>
      </div>
    </div>
  )
}
