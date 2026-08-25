'use client'

import { useState } from 'react'
import {
  CheckCircle2,
  XCircle,
  ZoomIn,
  ZoomOut,
  AlertCircle,
  Banknote,
  CreditCard,
  Phone,
  Mail,
  ChevronRight,
  Inbox,
  Shield,
  Receipt,
} from 'lucide-react'
import { usePayments, useVerifyPayment, useOrders } from '@/lib/hooks'
import { formatNaira, formatDateTime, formatDate } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

export function PaymentQueue() {
  const { data: paymentsData, isLoading } = usePayments()
  const verifyMutation = useVerifyPayment()
  const payments = (paymentsData ?? []).filter((p) => p.status === 'PENDING')
  const orders = useOrders().data ?? []
  const [selectedId, setSelectedId] = useState<string | undefined>(payments[0]?.id)
  const [zoom, setZoom] = useState(1)

  const selected = payments.find((p) => p.id === selectedId) ?? payments[0]
  const order = selected ? orders.find((o: any) => o.id === selected.orderId) : undefined
  const customer = order?.user

  const handleVerify = (p: any) => {
    verifyMutation.mutate({ id: p.id, status: 'VERIFIED' })
    toast({ title: 'Payment verified', description: 'Customer notified.' })
    // Select next pending payment if any
    const idx = payments.findIndex((x) => x.id === p.id)
    const next = payments[idx + 1] ?? payments[idx - 1]
    setSelectedId(next?.id)
    setZoom(1)
  }
  const handleReject = (p: any) => {
    verifyMutation.mutate({ id: p.id, status: 'REJECTED' })
    toast({
      title: 'Payment rejected',
      description: 'Order remains in pending verification until re-uploaded.',
      variant: 'destructive',
    })
    const idx = payments.findIndex((x) => x.id === p.id)
    const next = payments[idx + 1] ?? payments[idx - 1]
    setSelectedId(next?.id)
    setZoom(1)
  }

  if (payments.length === 0) {
    return (
      <div className="p-4 sm:p-6">
        <h1 className="text-lg font-bold tracking-tight text-navy dark:text-white">Payment Verification Queue</h1>
        <p className="text-xs text-navy-300 dark:text-navy-200">No pending receipts — you&apos;re all caught up.</p>
        <Card className="mt-6 border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-100 text-navy">
              <Inbox className="h-7 w-7" />
            </div>
            <p className="font-medium text-navy dark:text-white">Inbox zero!</p>
            <p className="max-w-sm text-sm text-navy-300 dark:text-navy-200">
              When customers upload transfer receipts, they&apos;ll appear here for manual
              verification. Paystack payments are auto-verified via webhook.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col lg:h-[calc(100vh-9rem)]">
      {/* Header */}
      <div className="border-b bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-navy dark:text-white">
              Payment Verification Queue
            </h1>
            <p className="text-xs text-navy-300 dark:text-navy-200">
              Review each uploaded receipt against the order total, then verify or reject.
            </p>
          </div>
          <Badge className="rounded-full bg-amber-100 text-amber-800 hover:bg-amber-100">
            {payments.length} pending
          </Badge>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[280px_1fr_320px]">
        {/* Left: queue list */}
        <aside className="overflow-y-auto border-r bg-linen-100 dark:bg-navy-700">
          <div className="border-b px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-300 dark:text-navy-200">
              Receipts to review
            </p>
          </div>
          <ul>
            {payments.map((p) => {
              const o = orders.find((o) => o.id === p.orderId)
              const c = o?.user
              const isActive = selected?.id === p.id
              return (
                <li key={p.id}>
                  <button
                    onClick={() => {
                      setSelectedId(p.id)
                      setZoom(1)
                    }}
                    className={cn(
                      'flex w-full items-start gap-2 border-b p-3 text-left transition',
                      isActive ? 'bg-gold-50 ring-1 ring-gold-200' : 'hover:bg-linen-200 dark:bg-navy-700'
                    )}
                  >
                    <div
                      className={cn(
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                        isActive ? 'bg-navy text-white' : 'bg-linen-200 dark:bg-navy-700 text-navy-300 dark:text-navy-200'
                      )}
                    >
                      <Receipt className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs font-semibold text-navy dark:text-white">
                        #{o?.orderNumber}
                      </p>
                      <p className="truncate text-xs text-navy-300 dark:text-navy-200">{c?.name}</p>
                      <p className="mt-0.5 text-xs font-semibold text-navy-300">
                        {formatNaira(p.amount)}
                      </p>
                      <p className="text-[10px] text-navy-300 dark:text-navy-200">
                        {formatDateTime(p.createdAt)}
                      </p>
                    </div>
                    <ChevronRight className="mt-1 h-3 w-3 text-navy-300 dark:text-navy-200" />
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        {/* Center: receipt viewer */}
        <main className="overflow-auto bg-linen-200 dark:bg-navy-700 p-3 sm:p-5">
          {selected ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-navy dark:text-white">
                  Receipt — <span className="font-mono">#{order?.orderNumber}</span>
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
                    className="h-8 w-8"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </Button>
                  <span className="w-12 text-center text-xs text-navy-300 dark:text-navy-200">
                    {Math.round(zoom * 100)}%
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setZoom((z) => Math.min(2, z + 0.2))}
                    className="h-8 w-8"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="overflow-auto rounded-xl bg-white p-3 ring-1 ring-muted shadow-sm" style={{ maxHeight: 'calc(100vh - 18rem)' }}>
                <div
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
                  className="mx-auto w-full max-w-md"
                >
                  {/* Mock receipt — in production this would be the actual uploaded image */}
                  <div className="overflow-hidden rounded-lg border bg-white">
                    <div className="bg-navy-gradient px-5 py-4 text-white">
                      <p className="text-xs uppercase tracking-wider opacity-80">
                        Transfer receipt
                      </p>
                      <p className="font-mono text-base font-bold">
                        {"0123456789"}
                      </p>
                      <p className="text-xs opacity-80">{"Guaranty Trust Bank (GTB)"}</p>
                    </div>
                    <div className="space-y-2 p-5 text-sm">
                      <Row label="Sender" value={customer?.name ?? '—'} />
                      <Row label="Amount" value={formatNaira(selected.amount)} bold />
                      <Row label="Date" value={formatDateTime(selected.createdAt)} />
                      <Row label="Reference" value={`TRX-${selected.id.slice(-8).toUpperCase()}`} mono />
                      <Row label="Status" value="Success" tone="emerald" />
                      <div className="mt-3 border-t pt-3">
                        <p className="text-xs text-navy-300 dark:text-navy-200">
                          ⚠ This is a mock receipt rendered for the demo. In production, the actual
                          screenshot uploaded by the customer will be displayed here.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons (mobile-friendly bottom-sheet style) */}
              <div className="sticky bottom-0 flex gap-2 rounded-xl bg-white p-3 shadow-lg ring-1 ring-muted">
                <Button
                  onClick={() => handleVerify(selected)}
                  className="flex-1 bg-gold-gradient text-navy hover:opacity-90"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Verify payment
                </Button>
                <Button
                  onClick={() => handleReject(selected)}
                  variant="outline"
                  className="border-rose-300 text-rose-700 hover:bg-rose-50"
                >
                  <XCircle className="mr-2 h-4 w-4" /> Reject
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-navy-300 dark:text-navy-200">
              Select a receipt to review.
            </div>
          )}
        </main>

        {/* Right: order summary */}
        <aside className="overflow-y-auto border-l bg-white">
          {selected && order && customer ? (
            <div className="space-y-4 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-300 dark:text-navy-200">
                  Order
                </p>
                <p className="font-mono text-sm font-semibold text-navy dark:text-white">
                  #{order.orderNumber}
                </p>
                <p className="text-xs text-navy-300 dark:text-navy-200">
                  {order.type === 'ITEM' ? 'Retail / Per-item' : 'Corporate / Per-kg'}
                </p>
              </div>

              <div className="rounded-lg bg-linen-200 dark:bg-navy-700 p-3 text-sm">
                <p className="flex items-center gap-1.5 font-medium text-navy dark:text-white">
                  <Banknote className="h-3.5 w-3.5" /> Total expected
                </p>
                <p className="mt-1 text-2xl font-bold text-navy-300">
                  {formatNaira(order.totalPrice ?? selected.amount)}
                </p>
                <p className="mt-1 text-xs text-navy-300 dark:text-navy-200">
                  Receipt amount: <strong>{formatNaira(selected.amount)}</strong>
                </p>
                {order.totalPrice !== undefined && order.totalPrice === selected.amount && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-navy-300">
                    <CheckCircle2 className="h-3 w-3" /> Amount matches order total
                  </div>
                )}
                {order.totalPrice !== undefined && order.totalPrice !== selected.amount && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-rose-700">
                    <AlertCircle className="h-3 w-3" /> Amount mismatch! Expected{' '}
                    {formatNaira(order.totalPrice ?? 0)}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-300 dark:text-navy-200">
                  Customer
                </p>
                <p className="mt-1 font-medium text-navy dark:text-white">{customer.name}</p>
                <a
                  href={`tel:${customer.phone}`}
                  className="mt-1 flex items-center gap-1 text-xs text-navy-300 hover:underline"
                >
                  <Phone className="h-3 w-3" /> {customer.phone}
                </a>
                <a
                  href={`mailto:${customer.email}`}
                  className="mt-0.5 flex items-center gap-1 text-xs text-navy-300 hover:underline"
                >
                  <Mail className="h-3 w-3" /> {customer.email}
                </a>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-300 dark:text-navy-200">
                  Items
                </p>
                {order.type === 'ITEM' ? (() => {
                  try {
                    const items = JSON.parse(order.itemsManifest || '[]')
                    return (
                      <ul className="mt-1 space-y-1 text-sm">
                        {items.map((i: any, idx: number) => (
                          <li key={idx} className="flex justify-between">
                            <span className="text-navy-300">{i.quantity}× {i.name}</span>
                            <span>{formatNaira(i.quantity * i.unitPrice)}</span>
                          </li>
                        ))}
                      </ul>
                    )
                  } catch { return <p className="text-sm text-navy-300">Items</p> }
                })() : (
                  <p className="mt-1 text-sm text-navy-300 dark:text-navy-200">
                    Bulk order ·{' '}
                    {order.finalWeight ? `${order.finalWeight}kg` : 'awaiting weighing'}
                  </p>
                )}
              </div>

              {order.guaranteeActive && (
                <div className="rounded-lg bg-gold-50 p-3 text-xs text-navy-300 ring-1 ring-gold-100">
                  <p className="flex items-center gap-1 font-medium">
                    <Shield className="h-3.5 w-3.5" /> Return-as-Received Guarantee active
                  </p>
                  <p className="mt-1">
                    Customer uploaded condition photos. Handle with care.
                  </p>
                </div>
              )}

              <div className="border-t pt-3 text-xs text-navy-300 dark:text-navy-200">
                <p className="flex items-center gap-1">
                  <CreditCard className="h-3 w-3" /> Payment method
                </p>
                <p className="mt-1 font-medium text-navy dark:text-white">
                  {selected.method === 'BANK_TRANSFER' ? 'Bank Transfer (Manual)' : 'Paystack'}
                </p>
                <p className="mt-2 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Uploaded at
                </p>
                <p className="mt-1 font-medium text-navy dark:text-white">
                  {formatDateTime(selected.createdAt)}
                </p>
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  bold,
  mono,
  tone,
}: {
  label: string
  value: string
  bold?: boolean
  mono?: boolean
  tone?: 'emerald'
}) {
  return (
    <div className="flex items-center justify-between border-b pb-1 last:border-0">
      <span className="text-xs text-navy-300 dark:text-navy-200">{label}</span>
      <span
        className={cn(
          'text-sm font-medium',
          mono && 'font-mono',
          bold && 'font-bold',
          tone === 'emerald' && 'text-navy-300'
        )}
      >
        {value}
      </span>
    </div>
  )
}
