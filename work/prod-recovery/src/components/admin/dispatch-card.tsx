'use client'

// =============================================================================
// DISPATCH CARD (phase 60) — the suggestion surface inside the order modal
// =============================================================================
// Appears exactly when an order has NO rider yet (the assignment moment) and
// the order is still live. Three calm rows — ranked, scored, explained — and
// the assign button sits right on the suggestion. The full rider list stays
// one tap away: the engine suggests, the human decides.
//
// Design language is the phase-57 rule: soft colours, no drama. Scores are
// shown as thin gold bars; reasons as one-line facts with a tone dot; the
// strongest rider is never louder than the board around it.
// =============================================================================

import { useState } from 'react'
import { ChevronDown, ChevronUp, Navigation, Phone, Sparkles, UserCheck } from 'lucide-react'
import { useDispatchSuggest, useUpdateOrder } from '@/lib/hooks'
import { scoreHeadline } from '@/lib/dispatch'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

interface Props {
  orderId: string
  orderNumber: string
}

const TONE_DOT: Record<string, string> = {
  good: 'bg-emerald-400',
  neutral: 'bg-slate-300',
  warn: 'bg-amber-400',
}

export function DispatchCard({ orderId, orderNumber }: Props) {
  const { data, isLoading, isError } = useDispatchSuggest(orderId)
  const updateOrder = useUpdateOrder()
  const [assigning, setAssigning] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const assign = (riderId: string, riderName: string) => {
    setAssigning(riderId)
    updateOrder.mutate(
      { id: orderId, driverId: riderId },
      {
        onSuccess: () =>
          toast({
            title: 'Rider assigned',
            description: `${riderName} takes ${orderNumber} — the stop appears on their route within a minute.`,
          }),
        onError: (e: any) =>
          toast({
            title: 'Could not assign rider',
            description: e?.message,
            variant: 'destructive',
          }),
        onSettled: () => setAssigning(null),
      }
    )
  }

  if (isLoading) {
    return (
      <section className="rounded-lg border border-navy-100 bg-white p-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-navy">
          <Navigation className="h-3.5 w-3.5 text-gold-500" /> Dispatch
        </p>
        <p className="mt-1 text-xs text-navy-300">Scoring the fleet for this stop…</p>
      </section>
    )
  }

  if (isError || !data) {
    // Silent, quiet failure: the modal keeps every other capability.
    return null
  }

  const suggestions = data.suggestions ?? []
  if (suggestions.length === 0) {
    return (
      <section className="rounded-lg border border-navy-100 bg-white p-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-navy">
          <Navigation className="h-3.5 w-3.5 text-gold-500" /> Dispatch
        </p>
        <p className="mt-1 text-xs leading-relaxed text-navy-300">
          No active riders to suggest right now — check the <span className="font-semibold text-navy">Riders</span> tab
          (an application may be waiting for approval).
        </p>
      </section>
    )
  }

  const top = suggestions.slice(0, 3)
  const rest = suggestions.slice(3)
  const legLabel = data.order.leg === 'PICKUP' ? 'pickup' : 'delivery'

  return (
    <section className="rounded-lg border border-navy-100 bg-white p-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-navy">
          <Navigation className="h-3.5 w-3.5 text-gold-500" /> Dispatch
        </p>
        <span className="text-xs text-navy-300">
          who should take this {legLabel}
          {data.order.zone ? (
            <>
              {' '}in <span className="font-semibold text-navy">{data.order.zone}</span>
            </>
          ) : null}
        </span>
        {data.context.zonePickupsToday > 0 && (
          <span className="ml-auto text-[11px] text-navy-300">
            {data.context.zonePickupsToday} pickup{data.context.zonePickupsToday === 1 ? '' : 's'} in{' '}
            {data.order.zone ?? 'this zone'} today
            {data.context.unassignedInZoneToday > 0 ? (
              <span className="font-semibold text-amber-700">
                {' '}· {data.context.unassignedInZoneToday} still unassigned
              </span>
            ) : null}
          </span>
        )}
      </div>

      <div className="mt-2 space-y-2">
        {top.map((s, i) => (
          <SuggestionRow
            key={s.rider.id}
            rank={i + 1}
            suggestion={s}
            onAssign={() => assign(s.rider.id, s.rider.name)}
            busy={assigning === s.rider.id}
            anyBusy={assigning !== null}
          />
        ))}
      </div>

      {rest.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="flex w-full items-center justify-center gap-1 rounded-md border border-navy-100 py-1.5 text-xs font-semibold text-navy-300 transition hover:border-gold-300 hover:text-navy"
          >
            {showAll ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showAll ? 'Hide other riders' : `All riders (${rest.length} more)`}
          </button>
          {showAll && (
            <div className="mt-2 space-y-1.5">
              {rest.map((s) => (
                <div
                  key={s.rider.id}
                  className="flex items-center justify-between gap-3 rounded-md bg-linen-100 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-navy">
                      {s.rider.name}{' '}
                      <span className="ml-1 font-mono text-xs text-navy-300">{s.score}</span>
                    </p>
                    <p className="truncate text-xs text-navy-300">
                      {s.factors[0]?.text}
                      {s.flags.length > 0 ? ` · ${s.flags.join(' · ')}` : ''}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 shrink-0 border-navy-200 text-xs text-navy hover:bg-linen-200"
                    onClick={() => assign(s.rider.id, s.rider.name)}
                    disabled={assigning !== null}
                  >
                    <UserCheck className="mr-1 h-3 w-3" /> Assign
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="mt-2 flex items-center gap-1 text-[10px] leading-snug text-navy-300/80">
        <Sparkles className="h-3 w-3 shrink-0 text-gold-400" />
        Scored on distance to the slot, current load, same-zone batching, on-time record and
        zone familiarity — the suggestion carries the reasons, the call stays yours.
      </p>
    </section>
  )
}

function SuggestionRow({
  rank,
  suggestion,
  onAssign,
  busy,
  anyBusy,
}: {
  rank: number
  suggestion: {
    rider: { id: string; name: string; phone: string }
    score: number
    factors: Array<{ kind: string; label: string; text: string; tone: 'good' | 'neutral' | 'warn'; points: number; max: number }>
    flags: string[]
  }
  onAssign: () => void
  busy: boolean
  anyBusy: boolean
}) {
  const headline = scoreHeadline({ total: suggestion.score, factors: suggestion.factors, flags: suggestion.flags })
  return (
    <div
      className={cn(
        'rounded-lg bg-linen-100 p-3 ring-1 ring-inset',
        rank === 1 ? 'ring-gold-300' : 'ring-transparent'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-[10px] font-bold text-gold-300">
            {rank}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-navy">
              {suggestion.rider.name}
              <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-navy-300">
                {headline}
              </span>
            </p>
            <p className="flex items-center gap-1 truncate text-xs text-navy-300">
              <Phone className="h-2.5 w-2.5" /> {suggestion.rider.phone}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="w-16">
            <div className="h-1 overflow-hidden rounded-full bg-navy-100">
              <div
                className="h-full rounded-full bg-gold-400"
                style={{ width: `${Math.max(4, suggestion.score)}%` }}
              />
            </div>
            <p className="mt-0.5 text-center font-mono text-[10px] font-semibold text-navy-300">
              {suggestion.score}/100
            </p>
          </div>
          <Button
            size="sm"
            className="h-7 bg-navy text-xs text-white hover:bg-navy-700"
            onClick={onAssign}
            disabled={anyBusy}
          >
            <UserCheck className="mr-1 h-3 w-3" />
            {busy ? 'Assigning…' : 'Assign'}
          </Button>
        </div>
      </div>

      <ul className="mt-2 space-y-0.5">
        {suggestion.factors.map((f) => (
          <li key={f.kind} className="flex items-start gap-1.5 text-[11px] leading-snug text-navy-300">
            <span className={cn('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', TONE_DOT[f.tone] ?? TONE_DOT.neutral)} />
            <span className="min-w-0">
              <span className="font-semibold text-navy">{f.label}:</span> {f.text}
            </span>
          </li>
        ))}
        {suggestion.flags.map((flag) => (
          <li key={flag} className="flex items-start gap-1.5 text-[11px] leading-snug text-amber-700">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
            {flag}
          </li>
        ))}
      </ul>
    </div>
  )
}
