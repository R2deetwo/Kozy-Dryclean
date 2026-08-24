'use client'

import {
  ArrowLeft,
  Download,
  Printer,
  Shield,
  Sparkles,
} from 'lucide-react'
import { useStore, useUserById } from '@/lib/store'
import { useMemo } from 'react'
import {
  formatNaira,
  formatDateTime,
  formatDate,
  COMPANY_BANK,
  GUARANTEE_DISCOUNT,
  type Order,
} from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface Props {
  order: Order
  onBack: () => void
}

export function InvoiceView({ order, onBack }: Props) {
  const customer = useUserById(order.userId)
  const allPayments = useStore((s) => s.payments)
  const payments = useMemo(
    () => allPayments.filter((p) => p.orderId === order.id),
    [allPayments, order.id]
  )
  const verifiedPayment = payments.find((p) => p.status === 'VERIFIED')

  const subtotal = order.type === 'ITEM' ? order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0) : (order.finalWeight ?? 0) * 800
  const guaranteeDiscount =
    order.guaranteeActive && order.type === 'ITEM' ? subtotal * GUARANTEE_DISCOUNT : 0
  const total = order.totalPrice ?? 0

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-linen-200 dark:bg-navy-700">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <button
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-1 text-xs text-navy-300 dark:text-navy-200 dark:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </button>

        <Card className="overflow-hidden shadow-sm">
          {/* Invoice header */}
          <div className="bg-gradient-to-br from-navy to-navy-500 px-6 py-6 text-white sm:px-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <p className="text-lg font-bold">Lagos Fresh Laundry</p>
                </div>
                <p className="mt-1 text-xs text-gold-100">
                  12 Adeola Odeku St, Victoria Island, Lagos
                </p>
                <p className="text-xs text-gold-100">+234 800 LAUNDRY · hello@lagosfresh.ng</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold uppercase tracking-wide">Invoice</p>
                <p className="font-mono text-sm">#{order.orderNumber}</p>
                <p className="mt-1 text-xs text-gold-100">
                  Issued: {formatDate(verifiedPayment?.verifiedAt ?? order.updatedAt)}
                </p>
              </div>
            </div>
          </div>

          <CardContent className="p-6 sm:p-8">
            {/* Bill to */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-300 dark:text-navy-200">
                  Bill to
                </p>
                <p className="mt-1 font-semibold text-navy dark:text-white">{customer?.name}</p>
                <p className="text-sm text-navy-300 dark:text-navy-200">{customer?.phone}</p>
                <p className="text-sm text-navy-300 dark:text-navy-200">{customer?.email}</p>
                <p className="mt-1 text-xs text-navy-300 dark:text-navy-200">{order.pickupAddress}</p>
              </div>
              <div className="sm:text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-300 dark:text-navy-200">
                  Order details
                </p>
                <p className="mt-1 text-sm">
                  Type:{' '}
                  <span className="font-medium text-navy dark:text-white">
                    {order.type === 'ITEM' ? 'Retail / Per-item' : 'Corporate / Per-kg'}
                  </span>
                </p>
                <p className="text-sm">
                  Pickup:{' '}
                  <span className="font-medium text-navy dark:text-white">
                    {formatDate(order.pickupDate)}
                  </span>
                </p>
                {order.deliveryDate && (
                  <p className="text-sm">
                    Delivered:{' '}
                    <span className="font-medium text-navy dark:text-white">
                      {formatDate(order.deliveryDate)}
                    </span>
                  </p>
                )}
              </div>
            </div>

            <div className="my-6 border-t" />

            {/* Line items */}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-navy-300 dark:text-navy-200">
                  <th className="pb-2">Description</th>
                  <th className="pb-2 text-center">Qty / Weight</th>
                  <th className="pb-2 text-right">Unit price</th>
                  <th className="pb-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {order.type === 'ITEM' ? (
                  order.items.map((i) => (
                    <tr key={i.id} className="border-b last:border-0">
                      <td className="py-2 text-navy dark:text-white">{i.name}</td>
                      <td className="py-2 text-center text-navy-300 dark:text-navy-200">{i.quantity}</td>
                      <td className="py-2 text-right text-navy-300 dark:text-navy-200">
                        {formatNaira(i.unitPrice)}
                      </td>
                      <td className="py-2 text-right font-medium">
                        {formatNaira(i.quantity * i.unitPrice)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-b last:border-0">
                    <td className="py-2 text-navy dark:text-white">Bulk laundry (per kg)</td>
                    <td className="py-2 text-center text-navy-300 dark:text-navy-200">
                      {order.finalWeight}kg
                    </td>
                    <td className="py-2 text-right text-navy-300 dark:text-navy-200">₦800</td>
                    <td className="py-2 text-right font-medium">
                      {formatNaira((order.finalWeight ?? 0) * 800)}
                    </td>
                  </tr>
                )}
                {order.guaranteeActive && guaranteeDiscount > 0 && (
                  <tr>
                    <td className="py-2 text-navy-300" colSpan={3}>
                      Return-as-Received Guarantee discount ({Math.round(GUARANTEE_DISCOUNT * 100)}%)
                    </td>
                    <td className="py-2 text-right font-medium text-navy-300">
                      −{formatNaira(guaranteeDiscount)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="mt-4 flex justify-end">
              <div className="w-48 space-y-1 text-sm">
                <div className="flex justify-between text-navy-300 dark:text-navy-200">
                  <span>Subtotal</span>
                  <span>{formatNaira(subtotal)}</span>
                </div>
                {guaranteeDiscount > 0 && (
                  <div className="flex justify-between text-navy-300">
                    <span>Discount</span>
                    <span>−{formatNaira(guaranteeDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2 text-base font-bold text-navy dark:text-white">
                  <span>Total</span>
                  <span>{formatNaira(total)}</span>
                </div>
              </div>
            </div>

            {/* Payment summary */}
            {verifiedPayment && (
              <div className="mt-6 rounded-lg bg-gold-50 p-4 text-sm ring-1 ring-gold-100">
                <p className="flex items-center justify-between">
                  <span className="text-navy">Payment received</span>
                  <span className="font-bold text-navy-300">
                    {formatNaira(verifiedPayment.amount)}
                  </span>
                </p>
                <p className="mt-1 text-xs text-navy-300">
                  {verifiedPayment.method === 'BANK_TRANSFER'
                    ? 'Bank transfer verified by admin'
                    : 'Paystack webhook auto-verified'}{' '}
                  · {formatDateTime(verifiedPayment.verifiedAt)}
                </p>
              </div>
            )}

            {/* Bank details */}
            <div className="mt-6 rounded-lg bg-linen-200 dark:bg-navy-700 p-4 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy-300 dark:text-navy-200">
                Bank details for transfer
              </p>
              <div className="mt-2 grid grid-cols-2 gap-y-1">
                <span className="text-navy-300 dark:text-navy-200">Bank</span>
                <span className="font-medium">{COMPANY_BANK.bankName}</span>
                <span className="text-navy-300 dark:text-navy-200">Account name</span>
                <span className="font-medium">{COMPANY_BANK.accountName}</span>
                <span className="text-navy-300 dark:text-navy-200">Account number</span>
                <span className="font-mono font-bold text-navy-300">
                  {COMPANY_BANK.accountNumber}
                </span>
              </div>
            </div>

            {order.guaranteeActive && (
              <div className="mt-6 flex items-start gap-2 rounded-lg bg-gold-50/50 p-3 text-xs text-navy-300 ring-1 ring-gold-100">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
                <p>
                  Return-as-Received Guarantee active. Items must be returned clean and in the
                  structural condition documented at pickup. Claims must be filed within 24 hours of
                  delivery.
                </p>
              </div>
            )}

            {/* Footer actions */}
            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t pt-4">
              <Button variant="outline" size="sm" onClick={() => window.print()} className="rounded-full">
                <Printer className="mr-2 h-3.5 w-3.5" /> Print
              </Button>
              <Button size="sm" className="rounded-full bg-gold-gradient text-navy hover:opacity-90">
                <Download className="mr-2 h-3.5 w-3.5" /> Download PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-navy-300 dark:text-navy-200">
          This invoice was auto-generated by Lagos Fresh Laundry&apos;s order system.
        </p>
      </div>
    </div>
  )
}
