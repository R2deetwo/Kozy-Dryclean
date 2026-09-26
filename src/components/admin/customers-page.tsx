'use client'

// =============================================================================
// CustomersPage — the Grow group's people page (phase 62 restructure)
// =============================================================================
// Directory (CRM) · Reviews (order-linked moderation, ADMIN only) · Feedback
// (the open inbox). Reviews and Feedback remain separate datasets (they
// always were — one hangs off delivered orders, the other off the public
// form) but they live behind ONE page: the left rail reads as a single
// concern — people and what they say.
// =============================================================================

import { useState } from 'react'
import { Users, Star, MessageSquareHeart } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CustomersView } from './customers-view'
import { ReviewsView } from './reviews-view'
import { FeedbackView } from './feedback-view'

export type CustomersTab = 'directory' | 'reviews' | 'feedback'

export function CustomersPage({
  isAdmin,
  initialTab,
  feedbackNew,
}: {
  isAdmin: boolean
  initialTab?: CustomersTab
  feedbackNew: number
}) {
  const [tab, setTab] = useState<CustomersTab>(initialTab ?? 'directory')
  const [lastInitial, setLastInitial] = useState(initialTab)
  if (initialTab !== lastInitial) {
    setLastInitial(initialTab)
    if (initialTab) setTab(initialTab)
  }

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as CustomersTab)}>
      <div className="px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="mb-4">
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-navy">Customers</h1>
          <p className="mt-1 text-sm text-navy-300">
            The people, their reviews on delivered orders, and every message that walks in.
          </p>
        </div>
        <TabsList className="bg-linen-200">
          <TabsTrigger value="directory" className="data-[state=active]:bg-navy data-[state=active]:text-white text-navy-300">
            <Users className="mr-1.5 h-3.5 w-3.5" /> Directory
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="reviews" className="data-[state=active]:bg-navy data-[state=active]:text-white text-navy-300">
              <Star className="mr-1.5 h-3.5 w-3.5" /> Reviews
            </TabsTrigger>
          )}
          <TabsTrigger value="feedback" className="data-[state=active]:bg-navy data-[state=active]:text-white text-navy-300">
            <MessageSquareHeart className="mr-1.5 h-3.5 w-3.5" /> Feedback
            {feedbackNew > 0 && (
              <span className="ml-1 rounded-full bg-gold-400 px-1.5 text-[10px] font-bold leading-4 text-navy">
                {feedbackNew}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="directory" className="mt-4">
        <CustomersView />
      </TabsContent>
      {isAdmin && (
        <TabsContent value="reviews" className="mt-4">
          <ReviewsView />
        </TabsContent>
      )}
      <TabsContent value="feedback" className="mt-4">
        <FeedbackView />
      </TabsContent>
    </Tabs>
  )
}
