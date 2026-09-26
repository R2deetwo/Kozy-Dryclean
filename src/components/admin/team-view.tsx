'use client'

// =============================================================================
// TeamView — the Scale group's people page (phase 62 restructure)
// =============================================================================
// Staff (console operators, ADMIN-only management) and Riders (the fleet —
// applications, roster, branch assignment) behind one page. Recruiting and
// access are both "who works here" concerns; one row in the rail.
// =============================================================================

import { useState } from 'react'
import { UserCog, Bike } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { StaffView } from './staff-view'
import { RidersView } from './riders-view'

export type TeamTab = 'staff' | 'riders'

export function TeamView({ initialTab }: { initialTab?: TeamTab }) {
  const [tab, setTab] = useState<TeamTab>(initialTab ?? 'staff')
  const [lastInitial, setLastInitial] = useState(initialTab)
  if (initialTab !== lastInitial) {
    setLastInitial(initialTab)
    if (initialTab) setTab(initialTab)
  }

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as TeamTab)}>
      <div className="px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="mb-4">
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-navy">Team</h1>
          <p className="mt-1 text-sm text-navy-300">
            Console access and the rider fleet — the people who move the work.
          </p>
        </div>
        <TabsList className="bg-linen-200">
          <TabsTrigger value="staff" className="data-[state=active]:bg-navy data-[state=active]:text-white text-navy-300">
            <UserCog className="mr-1.5 h-3.5 w-3.5" /> Staff
          </TabsTrigger>
          <TabsTrigger value="riders" className="data-[state=active]:bg-navy data-[state=active]:text-white text-navy-300">
            <Bike className="mr-1.5 h-3.5 w-3.5" /> Riders
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="staff" className="mt-4">
        <StaffView />
      </TabsContent>
      <TabsContent value="riders" className="mt-4">
        <RidersView />
      </TabsContent>
    </Tabs>
  )
}
