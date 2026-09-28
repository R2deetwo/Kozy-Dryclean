'use client'

// =============================================================================
// PARTNER ORDERS TAB (phase 72) — the laundrette's wash floor, on a phone
// =============================================================================
// The batches Kozy routes to this facility, oldest-first, with exactly one
// action available at a time (forward-only — the same discipline the office
// kanban enforces):
//     PICKED_UP  → "We've received it"      (AT_STATION)
//     AT_STATION → "The wash is running"    (PROCESSING)
//     PROCESSING → "Pressed + checked"      (FINISHING — ready for Kozy's rider)
// Every tap lands in the same StatusEvent ledger the office board and the
// customer's tracking read — one source of truth, no sync problems.
// =============================================================================

import { useState } from 'react'
import {
  Package,
  WashingMachine,
  Sparkles,
  CheckCircle2,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
  Weight,
  Zap,
  Scissors,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUpdatePartnerOrderStatus, type ApiPartnerPortalData, type ApiPartnerPortalOrder } from '@/lib/hooks'
import { toast } from '@/hooks/use-toast'

const naira = (n: number) => `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`

/** The single next action for an order in the partner pipeline. */
const NEXT_ACTION: Record<string, { to: string; label: string; hint: string; icon: typeof Package; tone: string }> = {
  PICKED_UP: {
    to: 'AT_STATION',
    label: "We've received it",
    hint: 'Confirm the batch arrived at your facility and the item count is right',
    icon: Package,
    tone: 'bg-gold-gradient text-navy hover:opacity-90',
  },
  AT_STATION: {
    to: 'PROCESSING',
    label: 'The wash is running',
    hint: 'Sorting, washing, treating — the work itself',
    icon: WashingMachine,
    tone: 'bg-cyan-500 text-white hover:bg-cyan-400',
  },
  PROCESSING: {
    to: 'FINISHING',
    label: 'Pressed & checked',
    hint: "Ironing, quality check, bagged — ready for Kozy's rider to collect",
    icon: Sparkles,
    tone: 'bg-emerald-600 text-white hover:bg-emerald-500',
  },
}

const STATUS_LABEL: Record<string, string> = {
  PICKED_UP: 'On the way to you',
  AT_STATION: 'Received — awaiting wash',
  PROCESSING: 'Washing',
  FINISHING: 'Finishing / ready for pickup',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
}

function fmtWhen(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

export function PartnerOrdersTab({ data, suspended }: { data: ApiPartnerPortalData; suspended: boolean }) {
  const mutation = useUpdatePartnerOrderStatus()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { active, recentDone, stats } = data

  const advance = (order: ApiPartnerPortalOrder) => {
    if (suspended) return
    const action = NEXT_ACTION[order.status]
    if (!action) return
    mutation.mutate(
      { orderId: order.id },
      {
        onSuccess: (d: any) => {
          toast({
            title: `#${order.orderNumber} — ${STATUS_LABEL[d?.order?.status] ?? action.to}`,
            description:
              d?.order?.status === 'FINISHING'
                ? "All done on your side. Kozy's rider will collect it for delivery."
                : undefined,
          })
        },
        onError: (e: Error) => {
          toast({ title: 'Could not update', description: e.message, variant: 'destructive' })
        },
      }
    )
  }

  return (
    <div className="space-y-4">
      {/* The day at a glance */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-slate-800 p-3 text-center">
          <p className="text-2xl font-bold text-white">{stats.active}</p>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">with you now</p>
        </div>
        <div className="rounded-xl bg-slate-800 p-3 text-center">
          <p className="text-2xl font-bold text-gold-400">{stats.awaitingReceipt}</p>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">to confirm</p>
        </div>
        <div className="rounded-xl bg-slate-800 p-3 text-center">
          <p className="text-2xl font-bold text-emerald-400">{stats.finishedThisMonth}</p>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">done this month</p>
        </div>
      </div>

      {/* Active pipeline */}
      {active.length === 0 ? (
        <div className="rounded-2xl bg-slate-800 p-6 text-center ring-1 ring-inset ring-slate-700/60">
          <WashingMachine className="mx-auto mb-2 h-8 w-8 text-slate-500" />
          <p className="text-sm font-semibold text-white">Nothing routed to you right now</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            When Kozy sends a batch your way it appears here the moment our rider swipes the
            pickup. New orders also surface automatically — keep this tab open on the counter.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {active.map((o) => {
            const action = NEXT_ACTION[o.status]
            const expanded = expandedId === o.id
            return (
              <div key={o.id} className="rounded-2xl bg-slate-800 p-4 ring-1 ring-inset ring-slate-700/60">
                {/* Order identity */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-bold text-white">#{o.orderNumber}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {o.customerName}
                      {o.itemCount > 0 ? ` · ${o.itemCount} item${o.itemCount === 1 ? '' : 's'}` : ''}
                      {o.finalWeight ? ` · ${o.finalWeight}kg` : ''}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold',
                      o.status === 'PICKED_UP'
                        ? 'bg-gold-400/15 text-gold-300'
                        : o.status === 'AT_STATION'
                          ? 'bg-cyan-400/15 text-cyan-300'
                          : o.status === 'PROCESSING'
                            ? 'bg-blue-400/15 text-blue-300'
                            : 'bg-emerald-400/15 text-emerald-300'
                    )}
                  >
                    {STATUS_LABEL[o.status] ?? o.status}
                  </span>
                </div>

                {/* Speed + wash mode — what the floor needs to know */}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                  {o.serviceSpeed !== 'STANDARD' && (
                    <span className="flex items-center gap-1 rounded-full bg-rose-400/15 px-2 py-0.5 font-bold text-rose-300">
                      <Zap className="h-3 w-3" />
                      {o.serviceSpeed === 'EXPRESS_24' ? '24-hour express' : '48-hour express'}
                    </span>
                  )}
                  {o.modeOfWash === 'HANDWASH' && (
                    <span className="flex items-center gap-1 rounded-full bg-purple-400/15 px-2 py-0.5 font-semibold text-purple-300">
                      <Scissors className="h-3 w-3" /> Handwash
                    </span>
                  )}
                  {o.pickedUpAt && (
                    <span className="flex items-center gap-1 text-slate-500">
                      <Clock className="h-3 w-3" /> collected {fmtWhen(o.pickedUpAt)}
                    </span>
                  )}
                  {o.finalWeight != null && (
                    <span className="flex items-center gap-1 text-slate-500">
                      <Weight className="h-3 w-3" /> {o.finalWeight}kg
                    </span>
                  )}
                </div>

                {/* The manifest — expandable so the card stays scannable */}
                {o.items.length > 0 && (
                  <div className="mt-2.5">
                    <button
                      onClick={() => setExpandedId(expanded ? null : o.id)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-slate-300 hover:text-gold-300"
                    >
                      {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {expanded ? 'Hide the list' : 'See the list'}
                    </button>
                    {expanded && (
                      <ul className="mt-2 divide-y divide-slate-700/60 rounded-xl bg-slate-900/60 px-3">
                        {o.items.map((it, i) => (
                          <li key={`${it.name}-${i}`} className="flex items-center justify-between py-1.5 text-xs">
                            <span className="text-slate-300">{it.name}</span>
                            <span className="font-mono text-slate-500">×{it.quantity}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Alteration / care notes — the "read before you wash" line */}
                {o.alterationNotes && (
                  <p className="mt-2.5 rounded-xl border border-gold-400/30 bg-gold-400/10 px-3 py-2 text-[11px] leading-relaxed text-gold-100/90">
                    <strong className="text-gold-200">Customer note:</strong> {o.alterationNotes}
                  </p>
                )}

                {/* The one action */}
                {action && !suspended && (
                  <div className="mt-3">
                    <button
                      onClick={() => advance(o)}
                      disabled={mutation.isPending}
                      className={cn(
                        'flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition disabled:opacity-60',
                        action.tone
                      )}
                    >
                      {mutation.isPending && mutation.variables?.orderId === o.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Updating…
                        </>
                      ) : (
                        <>
                          <action.icon className="h-4 w-4" /> {action.label}
                        </>
                      )}
                    </button>
                    <p className="mt-1.5 text-center text-[10px] text-slate-500">{action.hint}</p>
                  </div>
                )}
                {action && suspended && (
                  <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-[10px] text-amber-200/80">
                    Read-only while your partnership is paused.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Recently handled */}
      {recentDone.length > 0 && (
        <div className="rounded-2xl bg-slate-800 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Recently handled</p>
          <ul className="mt-2 divide-y divide-slate-700/60">
            {recentDone.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-2 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/15">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-slate-300">#{o.orderNumber}</p>
                    <p className="text-[10px] text-slate-500">
                      {STATUS_LABEL[o.status] ?? o.status} · {fmtWhen(o.deliveredAt ?? o.outForDeliveryAt)}
                    </p>
                  </div>
                </div>
                {o.itemCount > 0 && (
                  <span className="shrink-0 text-[10px] text-slate-500">{o.itemCount} items</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
