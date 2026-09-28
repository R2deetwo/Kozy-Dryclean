'use client'

import { PIPELINE_STAGES, type Order, formatDateTime } from '@/lib/types'
import { pipelineIndex } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

interface Props {
  order: Order
  compact?: boolean
}

export function OrderPipeline({ order, compact = false }: Props) {
  const activeIdx = pipelineIndex(order.status)

  if (order.status === 'PAYMENT_PENDING_VERIFICATION') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg bg-gold-50 px-3 py-2 text-xs text-navy ring-1 ring-gold-200">
          <span className="font-medium">Awaiting payment verification</span>
          <span className="text-navy-300">— our atelier will confirm your bank transfer shortly.</span>
        </div>
        <PipelineRail activeIdx={0} compact={compact} />
      </div>
    )
  }

  if (order.status === 'CANCELLED') {
    return (
      <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800 ring-1 ring-rose-200">
        This order was cancelled.
      </div>
    )
  }

  return <PipelineRail activeIdx={activeIdx} compact={compact} />
}

function PipelineRail({ activeIdx, compact }: { activeIdx: number; compact?: boolean }) {
  return (
    <>
      {/* Desktop: horizontal progress bar */}
      <div className="hidden sm:block">
        {/* items-start (NOT items-center): a two-line label like "Payment
            Confirmed" used to grow its column, vertically center it, and lift
            its number bubble out of line. Anchoring every column to the top
            + giving labels a fixed two-line box keeps all 8 bubbles on one
            horizontal line, no matter how labels wrap. */}
        <div className="flex items-start justify-between gap-1">
          {PIPELINE_STAGES.map((stage, i) => {
            const done = i < activeIdx
            const active = i === activeIdx
            return (
              <div key={stage.key} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-6 w-full items-center">
                  {i > 0 && (
                    <div
                      className={cn(
                        'h-0.5 flex-1',
                        done || active ? 'bg-navy' : 'bg-linen-300'
                      )}
                    />
                  )}
                  <div
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ring-2 transition',
                      active && 'bg-navy text-white ring-gold-400/30',
                      done && 'bg-navy text-white ring-gold-400/30',
                      !active && !done && 'bg-white text-navy-300 ring-linen-300'
                    )}
                  >
                    {done ? <Check className="h-3 w-3" /> : stage.short}
                  </div>
                  {i < PIPELINE_STAGES.length - 1 && (
                    <div
                      className={cn(
                        'h-0.5 flex-1',
                        done ? 'bg-navy' : 'bg-linen-300'
                      )}
                    />
                  )}
                </div>
                {!compact && (
                  <p
                    className={cn(
                      'flex h-7 items-start justify-center text-center text-[10px] leading-tight',
                      active ? 'font-semibold text-navy' : 'text-navy-300'
                    )}
                  >
                    {stage.label}
                  </p>
                )}
              </div>
            )
          })}
        </div>
        {!compact && (
          <p className="mt-2 text-center text-[11px] text-navy-300">
            <span className="font-semibold text-navy">{PIPELINE_STAGES[activeIdx].label}</span>
            {' · '}
            {PIPELINE_STAGES[activeIdx].description}
          </p>
        )}
      </div>

      {/* Mobile: vertical timeline with current stage highlighted */}
      <div className="sm:hidden">
        {/* Compact status banner */}
        <div className="mb-3 rounded-lg bg-navy px-4 py-3 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gold-300">Stage {activeIdx + 1} of {PIPELINE_STAGES.length}</p>
              <p className="font-serif text-lg font-semibold text-white">
                {PIPELINE_STAGES[activeIdx].label}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-400 text-navy">
              <span className="font-bold text-sm">{activeIdx + 1}</span>
            </div>
          </div>
          <p className="mt-1 text-xs text-navy-100">{PIPELINE_STAGES[activeIdx].description}</p>
        </div>

        {/* Progress bar */}
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-linen-300">
          <div
            className="h-full rounded-full bg-gold-gradient transition-all duration-500"
            style={{ width: `${((activeIdx + 1) / PIPELINE_STAGES.length) * 100}%` }}
          />
        </div>

        {/* Vertical step list */}
        {!compact && (
          <div className="space-y-0">
            {PIPELINE_STAGES.map((stage, i) => {
              const done = i < activeIdx
              const active = i === activeIdx
              return (
                <div key={stage.key} className="flex items-start gap-2.5">
                  {/* Dot + connector line */}
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold shrink-0',
                        done && 'bg-navy text-white',
                        active && 'bg-gold-400 text-navy ring-2 ring-gold-200',
                        !done && !active && 'bg-linen-300 text-navy-300'
                      )}
                    >
                      {done ? <Check className="h-2.5 w-2.5" /> : stage.short}
                    </div>
                    {i < PIPELINE_STAGES.length - 1 && (
                      <div className={cn('w-0.5 h-4', done ? 'bg-navy' : 'bg-linen-300')} />
                    )}
                  </div>
                  {/* Label */}
                  <p
                    className={cn(
                      'text-xs pt-0.5',
                      active ? 'font-semibold text-navy' : done ? 'text-navy-300' : 'text-navy-300/60'
                    )}
                  >
                    {stage.label}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

export function OrderTimeline({ order }: { order: Order }) {
  const events: Array<{ label: string; at?: string }> = [
    { label: 'Booking Placed', at: order.createdAt },
    // Shown as soon as the order reaches PAYMENT_VERIFIED — including via
    // the payment being verified, which the modal's live order object
    // reflects immediately.
    {
      label: 'Payment Verified',
      at:
        (order as any).payments?.find?.((p: any) => p.status === 'VERIFIED')?.verifiedAt ??
        (order.status === 'PAYMENT_VERIFIED' || isPastStage(order.status)
          ? (order as any).payments?.[0]?.verifiedAt ?? order.updatedAt
          : undefined),
    },
    { label: 'Picked Up', at: order.pickedUpAt },
    { label: 'At Station', at: order.atStationAt },
    { label: 'Processing', at: order.processingAt },
    { label: 'Finishing', at: order.finishingAt },
    { label: 'Out for Delivery', at: order.outForDeliveryAt },
    { label: 'Delivered', at: order.deliveredAt },
  ].filter((e) => e.at)

  return (
    <div className="space-y-2">
      {events.map((e, i) => (
        <div key={i} className="flex items-start gap-2 text-sm">
          <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-navy" />
          <div className="flex-1">
            <span className="text-navy">{e.label}</span>
            <span className="ml-2 text-xs text-navy-300">{formatDateTime(e.at)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

/** True when the order's status is at or beyond `stage` on the pipeline. */
function isPastStage(status: string): boolean {
  const order = [
    'REQUESTED',
    'PAYMENT_PENDING_VERIFICATION',
    'PAYMENT_VERIFIED',
    'PICKED_UP',
    'AT_STATION',
    'PROCESSING',
    'FINISHING',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
  ]
  return order.indexOf(status) >= order.indexOf('PAYMENT_VERIFIED')
}
