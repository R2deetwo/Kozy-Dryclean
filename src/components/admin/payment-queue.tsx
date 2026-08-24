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
import { useStore } from '@/lib/store'
import { useMemo } from 'react'
import { formatNaira, formatDateTime, formatDate, type Payment } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

export function PaymentQueue() {
  const allPayments = useStore((s) => s.payments)
  const payments = useMemo(
    () => allPayments.filter((p) => p.status === 'PENDING'),
    [allPayments]
  )
  const orders = useStore((s) => s.orders)
  const users = useStore((s) => s.users)
  const verify = useStore((s) => s.verifyPayment)
  const reject = useStore((s) => s.rejectPayment)
  const [selectedId, setSelectedId] = useState<string | undefined>(payments[0]?.id)
  const [zoom, setZoom] = useState(1)

  const selected = payments.find((p) => p.id === selectedId) ?? payments[0]
  const order = selected ? orders.find((o) => o.id === selected.orderId) : undefined
  const customer = order ? users.find((u) => u.id === order.userId) : undefined

  const handleVerify = (p: Payment) => {
    verify(p.id, 'u-admin')
    toast({ title: 'Payment verified', description: 'Customer notified by SMS.' })
    // Select next pending payment if any
    const idx = payments.findIndex((x) => x.id === p.id)
    const next = payments[idx + 1] ?? payments[idx - 1]
    setSelectedId(next?.id)
    setZoom(1)
  }
  const handleReject = (p: Payment) => {
    reject(p.id, 'u-admin')
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
        <h1 className="text-lg font-bold tracking-tight text-foreground">Payment Verification Queue</h1>
        <p className="text-xs text-muted-foreground">No pending receipts — you&apos;re all caught up.</p>
        <Card className="mt-6 border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Inbox className="h-7 w-7" />
            </div>
            <p className="font-medium text-foreground">Inbox zero!</p>
            <p className="max-w-sm text-sm text-muted-foreground">
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
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              Payment Verification Queue
            </h1>
            <p className="text-xs text-muted-foreground">
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
        <aside className="overflow-y-auto border-r bg-muted/20">
          <div className="border-b px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Receipts to review
            </p>
          </div>
          <ul>
            {payments.map((p) => {
              const o = orders.find((o) => o.id === p.orderId)
              const c = o ? users.find((u) => u.id === o.userId) : undefined
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
                      isActive ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'hover:bg-muted/40'
                    )}
                  >
                    <div
                      className={cn(
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                        isActive ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <Receipt className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs font-semibold text-foreground">
                        #{o?.orderNumber}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{c?.name}</p>
                      <p className="mt-0.5 text-xs font-semibold text-emerald-700">
                        {formatNaira(p.amount)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDateTime(p.createdAt)}
                      </p>
                    </div>
                    <ChevronRight className="mt-1 h-3 w-3 text-muted-foreground" />
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        {/* Center: receipt viewer */}
        <main className="overflow-auto bg-muted/30 p-3 sm:p-5">
          {selected ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">
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
                  <span className="w-12 text-center text-xs text-muted-foreground">
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
                    <div className="bg-gradient-to-br from-emerald-600 to-teal-600 px-5 py-4 text-white">
                      <p className="text-xs uppercase tracking-wider opacity-80">
                        Transfer receipt
                      </p>
                      <p className="font-mono text-base font-bold">
                        {COMPANY_BANK_DISPLAY.accountNumber}
                      </p>
                      <p className="text-xs opacity-80">{COMPANY_BANK_DISPLAY.bankName}</p>
                    </div>
                    <div className="space-y-2 p-5 text-sm">
                      <Row label="Sender" value={customer?.name ?? '—'} />
                      <Row label="Amount" value={formatNaira(selected.amount)} bold />
                      <Row label="Date" value={formatDateTime(selected.createdAt)} />
                      <Row label="Reference" value={`TRX-${selected.id.slice(-8).toUpperCase()}`} mono />
                      <Row label="Status" value="Success" tone="emerald" />
                      <div className="mt-3 border-t pt-3">
                        <p className="text-xs text-muted-foreground">
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
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
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
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Select a receipt to review.
            </div>
          )}
        </main>

        {/* Right: order summary */}
        <aside className="overflow-y-auto border-l bg-white">
          {selected && order && customer ? (
            <div className="space-y-4 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Order
                </p>
                <p className="font-mono text-sm font-semibold text-foreground">
                  #{order.orderNumber}
                </p>
                <p className="text-xs text-muted-foreground">
                  {order.type === 'ITEM' ? 'Retail / Per-item' : 'Corporate / Per-kg'}
                </p>
              </div>

              <div className="rounded-lg bg-muted/40 p-3 text-sm">
                <p className="flex items-center gap-1.5 font-medium text-foreground">
                  <Banknote className="h-3.5 w-3.5" /> Total expected
                </p>
                <p className="mt-1 text-2xl font-bold text-emerald-700">
                  {formatNaira(order.totalPrice ?? selected.amount)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Receipt amount: <strong>{formatNaira(selected.amount)}</strong>
                </p>
                {order.totalPrice !== undefined && order.totalPrice === selected.amount && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> Amount matches order total
                  </div>
                )}
                {order.totalPrice !== undefined && order.totalPrice !== selected.amount && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-rose-700">
                    <AlertCircle className="h-3 w-3" /> Amount mismatch! Expected{' '}
                    {formatNaira(order.totalPrice)}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Customer
                </p>
                <p className="mt-1 font-medium text-foreground">{customer.name}</p>
                <a
                  href={`tel:${customer.phone}`}
                  className="mt-1 flex items-center gap-1 text-xs text-emerald-700 hover:underline"
                >
                  <Phone className="h-3 w-3" /> {customer.phone}
                </a>
                <a
                  href={`mailto:${customer.email}`}
                  className="mt-0.5 flex items-center gap-1 text-xs text-emerald-700 hover:underline"
                >
                  <Mail className="h-3 w-3" /> {customer.email}
                </a>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Items
                </p>
                {order.type === 'ITEM' ? (
                  <ul className="mt-1 space-y-1 text-sm">
                    {order.items.map((i) => (
                      <li key={i.id} className="flex justify-between">
                        <span className="text-foreground/80">
                          {i.quantity}× {i.name}
                        </span>
                        <span>{formatNaira(i.quantity * i.unitPrice)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Bulk order ·{' '}
                    {order.finalWeight ? `${order.finalWeight}kg` : 'awaiting weighing'}
                  </p>
                )}
              </div>

              {order.guaranteeActive && (
                <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 ring-1 ring-emerald-100">
                  <p className="flex items-center gap-1 font-medium">
                    <Shield className="h-3.5 w-3.5" /> Return-as-Received Guarantee active
                  </p>
                  <p className="mt-1">
                    Customer uploaded condition photos. Handle with care.
                  </p>
                </div>
              )}

              <div className="border-t pt-3 text-xs text-muted-foreground">
                <p className="flex items-center gap-1">
                  <CreditCard className="h-3 w-3" /> Payment method
                </p>
                <p className="mt-1 font-medium text-foreground">
                  {selected.method === 'BANK_TRANSFER' ? 'Bank Transfer (Manual)' : 'Paystack'}
                </p>
                <p className="mt-2 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Uploaded at
                </p>
                <p className="mt-1 font-medium text-foreground">
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
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          'text-sm font-medium',
          mono && 'font-mono',
          bold && 'font-bold',
          tone === 'emerald' && 'text-emerald-700'
        )}
      >
        {value}
      </span>
    </div>
  )
}

const COMPANY_BANK_DISPLAY = {
  bankName: 'Guaranty Trust Bank (GTB)',
  accountName: 'Lagos Fresh Laundry Ltd',
  accountNumber: '0123456789',
}
