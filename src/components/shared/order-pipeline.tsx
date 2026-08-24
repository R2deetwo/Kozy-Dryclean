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
    // Render as "Awaiting payment" — show stage 0 only
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
    <div>
      <div className="flex items-center justify-between gap-1">
        {PIPELINE_STAGES.map((stage, i) => {
          const done = i < activeIdx
          const active = i === activeIdx
          return (
            <div key={stage.key} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full items-center">
                {i > 0 && (
                  <div
                    className={cn(
                      'h-0.5 flex-1',
                      done || active ? 'bg-navy' : 'bg-linen-200 dark:bg-navy-700-foreground/20'
                    )}
                  />
                )}
                <div
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ring-2 transition',
                    active && 'bg-navy text-white ring-gold-400/30',
                    done && 'bg-navy text-white ring-gold-400/30',
                    !active && !done && 'bg-white text-navy-300 dark:text-navy-200 ring-muted-foreground/20'
                  )}
                >
                  {done ? <Check className="h-3 w-3" /> : stage.short}
                </div>
                {i < PIPELINE_STAGES.length - 1 && (
                  <div
                    className={cn(
                      'h-0.5 flex-1',
                      done ? 'bg-navy' : 'bg-linen-200 dark:bg-navy-700-foreground/20'
                    )}
                  />
                )}
              </div>
              {!compact && (
                <p
                  className={cn(
                    'text-center text-[9px] leading-tight sm:text-[10px]',
                    active ? 'font-semibold text-navy dark:text-white' : 'text-navy-300 dark:text-navy-200'
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
        <p className="mt-2 text-center text-[11px] text-navy-300 dark:text-navy-200">
          Current stage: <span className="font-semibold text-navy dark:text-white">{PIPELINE_STAGES[activeIdx].label}</span>
          {' · '}
          {PIPELINE_STAGES[activeIdx].description}
        </p>
      )}
    </div>
  )
}

export function OrderTimeline({ order }: { order: Order }) {
  const events: Array<{ label: string; at?: string }> = [
    { label: 'Booking Placed', at: order.createdAt },
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
            <span className="text-navy dark:text-white">{e.label}</span>
            <span className="ml-2 text-xs text-navy-300 dark:text-navy-200">{formatDateTime(e.at)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
