'use client'

// =============================================================================
// OperationsView — the Run group's single page (phase 62 console restructure)
// =============================================================================
// Three internal tabs replace three separate sidebar rows:
//   Pipeline — the Kanban board (was "Orders")
//   Payments — the transfer verification queue (was "Verify Payments")
//   Health   — per-branch pulse cards (new)
// Verifying a payment IS moving an order through the pipeline — one page,
// one mental model. `initialTab` lets notification deep-links land directly.
// =============================================================================

import { useState } from 'react'
import { KanbanSquare, CreditCard, Activity } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { KanbanBoard } from './kanban-board'
import { PaymentQueue } from './payment-queue'
import { BranchHealth } from './branch-health'

export type OperationsTab = 'pipeline' | 'payments' | 'health'

export function OperationsView({
  isAdmin,
  initialTab,
  paymentsPending,
  activeOrders,
}: {
  isAdmin: boolean
  initialTab?: OperationsTab
  paymentsPending: number
  activeOrders: number
}) {
  // Deep-links land at mount time (the dashboard mounts this view on tab
  // switch); a changed initialTab while mounted is followed with the
  // React-documented adjust-during-render pattern — no effect, no cascade.
  const [tab, setTab] = useState<OperationsTab>(initialTab ?? 'pipeline')
  const [lastInitial, setLastInitial] = useState(initialTab)
  if (initialTab !== lastInitial) {
    setLastInitial(initialTab)
    if (initialTab) setTab(initialTab)
  }

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as OperationsTab)}>
      <div className="px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-semibold tracking-tight text-navy">
              Operations
            </h1>
            <p className="mt-1 text-sm text-navy-300">
              The pipeline, the money queue and each branch&apos;s pulse — one place.
            </p>
          </div>
        </div>
        <TabsList className="bg-linen-200">
          <TabsTrigger value="pipeline" className="data-[state=active]:bg-navy data-[state=active]:text-white text-navy-300">
            <KanbanSquare className="mr-1.5 h-3.5 w-3.5" /> Pipeline
            {activeOrders > 0 && (
              <span className="ml-1 rounded-full bg-navy-100 px-1.5 text-[10px] font-mono leading-4 text-navy">
                {activeOrders}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="payments" className="data-[state=active]:bg-navy data-[state=active]:text-white text-navy-300">
            <CreditCard className="mr-1.5 h-3.5 w-3.5" /> Payments
            {paymentsPending > 0 && (
              <span className="ml-1 rounded-full bg-gold-400 px-1.5 text-[10px] font-bold leading-4 text-navy">
                {paymentsPending}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="health" className="data-[state=active]:bg-navy data-[state=active]:text-white text-navy-300">
            <Activity className="mr-1.5 h-3.5 w-3.5" /> Branch health
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="pipeline" className="mt-4">
        <KanbanBoard isAdmin={isAdmin} />
      </TabsContent>
      <TabsContent value="payments" className="mt-4">
        <PaymentQueue isAdmin={isAdmin} />
      </TabsContent>
      <TabsContent value="health" className="mt-4 px-4 pb-8 sm:px-6">
        <BranchHealth />
      </TabsContent>
    </Tabs>
  )
}
