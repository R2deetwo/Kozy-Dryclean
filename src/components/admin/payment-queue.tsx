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
  Trash2,
} from 'lucide-react'
import { usePayments, useVerifyPayment, useDeletePayment, useOrders, ADMIN_POLL } from '@/lib/hooks'
import { formatNaira, formatDateTime, formatDate } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

export function PaymentQueue() {
  // fetchAll: the queue must see every PENDING receipt (a pending payment
  // beyond page 1 would otherwise be invisible), and the orders lookup map
  // needs the full set to resolve any receipt's order.
  // Live mode (phase 25): the queue polls every few seconds and refetches on
  // tab focus — a customer clicking "I have made the payment" appears here
  // without anyone pressing refresh.
  const { data: paymentsData, isLoading } = usePayments({
    fetchAll: true,
    refetchInterval: ADMIN_POLL.fast,
    refetchOnWindowFocus: true,
  })
  const verifyMutation = useVerifyPayment()
  const deleteMutation = useDeletePayment()
  // Pending = receipts waiting for a decision. Rejected = transfers we
  // couldn't match — they STAY listed (with an Approve button) because the
  // money can land minutes or hours later (client-reported scenario), until
  // the admin removes them from the list entirely (phase 25).
  const [tab, setTab] = useState<'PENDING' | 'REJECTED'>('PENDING')
  const [confirmRemove, setConfirmRemove] = useState<any | null>(null)
  const pending = (paymentsData ?? []).filter(
    (p) => p.status === 'PENDING' && p.method === 'BANK_TRANSFER'
  )
  const rejected = (paymentsData ?? []).filter(
    (p) => p.status === 'REJECTED' && p.method === 'BANK_TRANSFER'
  )
  const payments = tab === 'PENDING' ? pending : rejected
  const orders = useOrders({
    fetchAll: true,
    refetchInterval: ADMIN_POLL.medium,
    refetchOnWindowFocus: true,
  }).data ?? []
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [zoom, setZoom] = useState(1)

  const selected = payments.find((p) => p.id === selectedId) ?? payments[0]
  const order = selected ? orders.find((o: any) => o.id === selected.orderId) : undefined
  const customer = order?.user

  const advanceSelection = (p: any) => {
    const idx = payments.findIndex((x) => x.id === p.id)
    const next = payments[idx + 1] ?? payments[idx - 1]
    setSelectedId(next?.id)
    setZoom(1)
  }

  const handleVerify = (p: any) => {
    verifyMutation.mutate(
      { id: p.id, status: 'VERIFIED' },
      {
        onSuccess: (data) => {
          toast({
            title: 'Payment verified',
            description: data.noOp
              ? 'Already verified — nothing to do.'
              : 'Customer emailed · order moved to Ready to Pick Up.',
          })
          advanceSelection(p)
        },
        onError: (e: any) =>
          toast({ title: 'Verification failed', description: e?.message, variant: 'destructive' }),
      }
    )
  }
  const handleReject = (p: any) => {
    verifyMutation.mutate(
      { id: p.id, status: 'REJECTED' },
      {
        onSuccess: () => {
          toast({
            title: 'Payment rejected',
            description: 'The customer has been emailed with what to check and what to do next.',
            variant: 'destructive',
          })
          advanceSelection(p)
        },
        onError: (e: any) =>
          toast({ title: 'Rejection failed', description: e?.message, variant: 'destructive' }),
      }
    )
  }

  const handleRemove = (p: any) => {
    deleteMutation.mutate(p.id, {
      onSuccess: (data) => {
        setConfirmRemove(null)
        toast({
          title: 'Removed from the queue',
          description: data.order
            ? 'Claim deleted. The order is back in Requested — the customer can re-confirm payment anytime.'
            : 'Claim deleted. Verified payment history and the order itself are untouched.',
        })
        advanceSelection(p)
      },
      onError: (e: any) => {
        setConfirmRemove(null)
        toast({ title: 'Could not remove', description: e?.message, variant: 'destructive' })
      },
    })
  }

  if (payments.length === 0) {
    return (
      <div className="p-4 sm:p-6">
        <h1 className="text-lg font-bold tracking-tight text-navy">Payment Verification Queue</h1>
        <div className="mt-3 flex items-center gap-2">
          <QueueTabs pending={pending.length} rejected={rejected.length} tab={tab} onChange={setTab} />
        </div>
        {tab === 'PENDING' ? (
          <Card className="mt-6 border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-100 text-navy">
                <Inbox className="h-7 w-7" />
              </div>
              <p className="font-medium text-navy">Inbox zero!</p>
              <p className="max-w-sm text-sm text-navy-300">
                When customers confirm a bank-transfer order, it appears here for
                verification — with their receipt screenshot when they attached one.
                Verifying emails the customer instantly; Paystack payments are
                auto-verified via webhook.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-6 border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <p className="font-medium text-navy">No rejected transfers</p>
              <p className="max-w-sm text-sm text-navy-300">
                Rejected transfers stay listed here while their money can still land late —
                approve them anytime, or remove them from the list for good. Orders themselves
                are only cleared by delivery or cancellation.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col lg:h-[calc(100vh-9rem)]">
      {/* Header */}
      <div className="border-b bg-white px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-navy">
                Payment Verification Queue
              </h1>
              <LiveBadge />
            </div>
            <p className="text-xs text-navy-300">
              Match the transfer against your bank statement (and the customer&apos;s
              receipt when attached), then verify or reject — the customer is
              emailed automatically either way. New confirmations appear here live.
            </p>
          </div>
          <QueueTabs pending={pending.length} rejected={rejected.length} tab={tab} onChange={setTab} />
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[280px_1fr_320px]">
        {/* Left: queue list */}
        <aside className="overflow-y-auto border-r bg-linen-100">
          <div className="border-b px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-300">
              {tab === 'PENDING'
                ? 'Receipts to review'
                : 'Rejected transfers — approve late money, or remove'}
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
                      isActive ? 'bg-gold-50 ring-1 ring-gold-200' : 'hover:bg-linen-200'
                    )}
                  >
                    <div
                      className={cn(
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                        p.status === 'REJECTED'
                          ? 'bg-rose-100 text-rose-700'
                          : isActive
                          ? 'bg-navy text-white'
                          : 'bg-linen-200 text-navy-300'
                      )}
                    >
                      <Receipt className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs font-semibold text-navy">
                        #{o?.orderNumber}
                      </p>
                      <p className="truncate text-xs text-navy-300">{c?.name}</p>
                      <p className="mt-0.5 text-xs font-semibold text-navy-300">
                        {formatNaira(p.amount)}
                      </p>
                      <p className="text-[10px] text-navy-300">
                        {formatDateTime(p.createdAt)}
                      </p>
                    </div>
                    <ChevronRight className="mt-1 h-3 w-3 text-navy-300" />
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        {/* Center: receipt viewer */}
        <main className="overflow-auto bg-linen-200 p-3 sm:p-5">
          {selected ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-navy">
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
                  <span className="w-12 text-center text-xs text-navy-300">
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
                  {selected.receiptUrl ? (
                    /* The customer's actual transfer screenshot (downscaled at
                     * upload, stored on the payment record) — verify against
                     * this AND your bank statement. */
                    <figure className="overflow-hidden rounded-lg border bg-white">
                      <img
                        src={selected.receiptUrl}
                        alt={`Transfer receipt for order #${order?.orderNumber ?? ''}`}
                        className="block w-full"
                      />
                      <figcaption className="border-t bg-linen-50 px-4 py-2 text-[11px] text-navy-300">
                        Uploaded by the customer at checkout · cross-check with your bank
                        statement before verifying.
                      </figcaption>
                    </figure>
                  ) : (
                    /* No receipt attached — verification still works: match the
                     * expected amount + narration against the bank statement. */
                    <div className="overflow-hidden rounded-lg border bg-white">
                      <div className="bg-navy-gradient px-5 py-4 text-white">
                        <p className="text-xs uppercase tracking-wider opacity-80">
                          No receipt attached
                        </p>
                        <p className="font-mono text-base font-bold">
                          #{order?.orderNumber ?? '—'}
                        </p>
                      </div>
                      <div className="space-y-2 p-5 text-sm">
                        <Row label="Customer" value={customer?.name ?? '—'} />
                        <Row label="Amount" value={formatNaira(selected.amount)} bold />
                        <Row label="Requested" value={formatDateTime(selected.createdAt)} />
                        <Row label="Expected narration" value={`#${order?.orderNumber ?? '—'}`} mono />
                        <div className="mt-3 border-t pt-3">
                          <p className="text-xs leading-relaxed text-navy-300">
                            The customer didn&apos;t attach a screenshot. Verify by matching the
                            amount above against your bank statement — the customer is told to use
                            the order number as the transfer narration.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons (mobile-friendly bottom-sheet style) */}
              <div className="sticky bottom-0 flex gap-2 rounded-xl bg-white p-3 shadow-lg ring-1 ring-muted">
                {selected.status === 'PENDING' ? (
                  <>
                    <Button
                      onClick={() => handleVerify(selected)}
                      disabled={verifyMutation.isPending}
                      className="flex-1 bg-gold-gradient text-navy hover:opacity-90 disabled:opacity-60"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {verifyMutation.isPending ? 'Verifying…' : 'Verify payment'}
                    </Button>
                    <Button
                      onClick={() => handleReject(selected)}
                      disabled={verifyMutation.isPending}
                      variant="outline"
                      className="border-rose-300 text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                    >
                      <XCircle className="mr-2 h-4 w-4" /> Reject
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={() => handleVerify(selected)}
                      disabled={verifyMutation.isPending}
                      className="flex-1 bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-60"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {verifyMutation.isPending ? 'Approving…' : 'Approve payment now'}
                    </Button>
                    <Button
                      onClick={() => setConfirmRemove(selected)}
                      disabled={deleteMutation.isPending}
                      variant="outline"
                      title="Remove this rejected claim from the list entirely"
                      className="border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {deleteMutation.isPending ? 'Removing…' : 'Remove'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-navy-300">
              Select a receipt to review.
            </div>
          )}
        </main>

        {/* Right: order summary */}
        <aside className="overflow-y-auto border-l bg-white">
          {selected && order && customer ? (
            <div className="space-y-4 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-300">
                  Order
                </p>
                <p className="font-mono text-sm font-semibold text-navy">
                  #{order.orderNumber}
                </p>
                <p className="text-xs text-navy-300">
                  {order.type === 'ITEM' ? 'Retail / Per-item' : 'Corporate / Per-kg'}
                </p>
              </div>

              <div className="rounded-lg bg-linen-200 p-3 text-sm">
                <p className="flex items-center gap-1.5 font-medium text-navy">
                  <Banknote className="h-3.5 w-3.5" /> Total expected
                </p>
                <p className="mt-1 text-2xl font-bold text-navy-300">
                  {formatNaira(order.totalPrice ?? selected.amount)}
                </p>
                <p className="mt-1 text-xs text-navy-300">
                  Receipt amount: <strong>{formatNaira(selected.amount)}</strong>
                </p>
                {order.totalPrice != null && order.totalPrice === selected.amount && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-navy-300">
                    <CheckCircle2 className="h-3 w-3" /> Amount matches order total
                  </div>
                )}
                {order.totalPrice != null && order.totalPrice !== selected.amount && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-rose-700">
                    <AlertCircle className="h-3 w-3" /> Amount mismatch! Expected{' '}
                    {formatNaira(order.totalPrice ?? 0)}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-300">
                  Customer
                </p>
                <p className="mt-1 font-medium text-navy">{customer.name}</p>
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
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-300">
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
                  <p className="mt-1 text-sm text-navy-300">
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

              <div className="border-t pt-3 text-xs text-navy-300">
                <p className="flex items-center gap-1">
                  <CreditCard className="h-3 w-3" /> Payment method
                </p>
                <p className="mt-1 font-medium text-navy">
                  {selected.method === 'BANK_TRANSFER' ? 'Bank Transfer (Manual)' : 'Paystack'}
                </p>
                <p className="mt-2 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Uploaded at
                </p>
                <p className="mt-1 font-medium text-navy">
                  {formatDateTime(selected.createdAt)}
                </p>
              </div>
            </div>
          ) : null}
        </aside>
      </div>

      {/* Remove-confirmation — destructive bookkeeping action, so it never
       *  fires off a single mis-tap. */}
      <AlertDialog open={!!confirmRemove} onOpenChange={(o) => !o && setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this rejected transfer?</AlertDialogTitle>
            <AlertDialogDescription>
              The claim for{' '}
              <strong>{confirmRemove ? formatNaira(confirmRemove.amount) : ''}</strong> on order{' '}
              <span className="font-mono">
                #{confirmRemove ? (orders.find((o: any) => o.id === confirmRemove.orderId)?.orderNumber ?? '—') : ''}
              </span>{' '}
              will be deleted from the Rejected list for good. The customer is not emailed — they
              already received the rejection instructions. If the order is still awaiting payment,
              it returns to the Requested column so the customer can re-confirm. Verified payments
              and the order itself are never touched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmRemove && handleRemove(confirmRemove)}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              Remove from list
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** Live badge — signals that this surface auto-refreshes (phase 25). The
 *  pulsing dot reads as "connected"; polling pauses while the tab is hidden
 *  and refetches instantly when it regains focus. */
export function LiveBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200',
        className
      )}
      title="Auto-updating — changes appear without refreshing. Pauses while this tab is in the background."
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
      </span>
      Live
    </span>
  )
}

/** Pending / Rejected tabs — rejected transfers stay reachable so late
 *  money can still be approved (the #1 client complaint about rejections). */
function QueueTabs({
  pending,
  rejected,
  tab,
  onChange,
}: {
  pending: number
  rejected: number
  tab: 'PENDING' | 'REJECTED'
  onChange: (t: 'PENDING' | 'REJECTED') => void
}) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-linen-200 p-1">
      <button
        onClick={() => onChange('PENDING')}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition',
          tab === 'PENDING' ? 'bg-navy text-white' : 'text-navy-300 hover:text-navy'
        )}
      >
        Pending
        <span
          className={cn(
            'rounded-full px-1.5 text-[10px]',
            tab === 'PENDING' ? 'bg-white/20' : 'bg-white'
          )}
        >
          {pending}
        </span>
      </button>
      <button
        onClick={() => onChange('REJECTED')}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition',
          tab === 'REJECTED'
            ? 'bg-rose-600 text-white'
            : 'text-navy-300 hover:text-navy'
        )}
      >
        Rejected
        <span
          className={cn(
            'rounded-full px-1.5 text-[10px]',
            tab === 'REJECTED' ? 'bg-white/20' : 'bg-white'
          )}
        >
          {rejected}
        </span>
      </button>
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
      <span className="text-xs text-navy-300">{label}</span>
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
