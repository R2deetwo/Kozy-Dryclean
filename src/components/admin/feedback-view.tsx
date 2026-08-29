'use client'

// =============================================================================
// FeedbackView — admin inbox for the public "Reviews & Complaints" form
// (Phase 14). Complements ReviewsView (order-linked reviews): this collects
// everything submitted through the site's feedback form — reviews without an
// order, complaints, and questions — with a simple NEW → IN_PROGRESS →
// RESOLVED workflow and an internal admin note per item.
// =============================================================================

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  MessageSquareHeart,
  Star,
  AlertTriangle,
  HelpCircle,
  Inbox,
  CircleDot,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/types'

interface FeedbackItem {
  id: string
  type: 'REVIEW' | 'COMPLAINT' | 'QUESTION'
  name: string
  email: string
  phone?: string | null
  reference?: string | null
  rating?: number | null
  message: string
  status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED'
  adminNote?: string | null
  createdAt: string
}

const TYPE_META: Record<FeedbackItem['type'], { label: string; icon: any; cls: string }> = {
  REVIEW: { label: 'Review', icon: Star, cls: 'bg-emerald-100 text-emerald-800' },
  COMPLAINT: { label: 'Complaint', icon: AlertTriangle, cls: 'bg-red-100 text-red-800' },
  QUESTION: { label: 'Question', icon: HelpCircle, cls: 'bg-blue-100 text-blue-800' },
}

const STATUS_META: Record<FeedbackItem['status'], { label: string; cls: string }> = {
  NEW: { label: 'New', cls: 'bg-gold-100 text-gold-800' },
  IN_PROGRESS: { label: 'In progress', cls: 'bg-blue-100 text-blue-800' },
  RESOLVED: { label: 'Resolved', cls: 'bg-emerald-100 text-emerald-800' },
}

export function FeedbackView() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<'ALL' | 'NEW' | 'IN_PROGRESS' | 'RESOLVED'>('ALL')
  const [openId, setOpenId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['admin-feedback', filter],
    queryFn: async () => {
      const url = filter === 'ALL' ? '/api/feedback' : `/api/feedback?status=${filter}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to load feedback')
      const data = await res.json()
      return data.items as FeedbackItem[]
    },
    refetchInterval: 30 * 1000,
  })

  const update = useMutation({
    mutationFn: async (args: { id: string; status?: string; adminNote?: string }) => {
      const res = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      })
      if (!res.ok) throw new Error('Update failed')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-feedback'] }),
  })

  const items = data ?? []
  const counts = {
    NEW: items.filter((i) => i.status === 'NEW').length,
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-navy">
          Complaints &amp; Questions
        </h1>
        <p className="mt-1 text-sm text-navy-300">
          Every submission from the /feedback page — complaints and questions,
          read by a human and tracked to resolution. Aim to resolve complaints
          within one working day. (Public reviews are order-verified and live in
          the Reviews tab.)
        </p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(['ALL', 'NEW', 'IN_PROGRESS', 'RESOLVED'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
              filter === f
                ? 'bg-navy text-white'
                : 'bg-white text-navy-300 ring-1 ring-navy-100 hover:text-navy'
            )}
          >
            {f === 'ALL' ? 'All' : STATUS_META[f].label}
            {f === 'NEW' && counts.NEW > 0 && (
              <span className="ml-1.5 rounded-full bg-gold-400 px-1.5 text-[10px] font-bold text-navy">
                {counts.NEW}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-navy-300">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading feedback…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-navy-100 bg-white py-16 text-center">
          <Inbox className="h-10 w-10 text-navy-200" />
          <p className="mt-3 text-sm font-medium text-navy">Nothing here yet</p>
          <p className="mt-1 max-w-xs text-xs text-navy-300">
            {filter === 'ALL'
              ? 'Complaints and questions from the /feedback page will appear here.'
              : `No ${STATUS_META[filter as FeedbackItem['status']].label.toLowerCase()} items right now.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const TypeIcon = TYPE_META[item.type].icon
            const open = openId === item.id
            const note = notes[item.id] ?? item.adminNote ?? ''
            return (
              <div
                key={item.id}
                className="overflow-hidden rounded-xl border border-navy-100 bg-white shadow-sm"
              >
                <button
                  onClick={() => setOpenId(open ? null : item.id)}
                  className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-linen-50"
                >
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                      TYPE_META[item.type].cls
                    )}
                  >
                    <TypeIcon className="h-4.5 w-4.5 h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-navy">{item.name}</span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                          TYPE_META[item.type].cls
                        )}
                      >
                        {TYPE_META[item.type].label}
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                          STATUS_META[item.status].cls
                        )}
                      >
                        {STATUS_META[item.status].label}
                      </span>
                      {item.rating != null && (
                        <span className="flex items-center gap-0.5 text-xs text-gold-600">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={cn(
                                'h-3 w-3',
                                i < Math.round(item.rating!)
                                  ? 'fill-gold-400 text-gold-400'
                                  : 'text-navy-200'
                              )}
                            />
                          ))}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm text-navy-300">{item.message}</p>
                    <p className="mt-1 text-[11px] text-navy-300/70">
                      {formatDateTime(item.createdAt)} · {item.email}
                      {item.phone ? ` · ${item.phone}` : ''}
                      {item.reference ? ` · Ref: ${item.reference}` : ''}
                    </p>
                  </div>
                </button>

                {open && (
                  <div className="border-t border-navy-100 bg-linen-50 p-4">
                    <p className="whitespace-pre-wrap rounded-lg bg-white p-3 text-sm leading-relaxed text-navy ring-1 ring-navy-100">
                      {item.message}
                    </p>
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-navy-300">
                        Internal note (not visible to the customer)
                      </p>
                      <Textarea
                        value={note}
                        onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })}
                        placeholder="e.g. Called customer — replacement shirt pressed and delivered 8 Sep"
                        rows={2}
                        className="mt-1.5 bg-white"
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.status !== 'IN_PROGRESS' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={update.isPending}
                          onClick={() =>
                            update.mutate({ id: item.id, status: 'IN_PROGRESS', adminNote: note || undefined })
                          }
                        >
                          <CircleDot className="mr-1.5 h-3.5 w-3.5" /> Mark in progress
                        </Button>
                      )}
                      {item.status !== 'RESOLVED' && (
                        <Button
                          size="sm"
                          disabled={update.isPending}
                          onClick={() =>
                            update.mutate({ id: item.id, status: 'RESOLVED', adminNote: note || undefined })
                          }
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Resolve
                        </Button>
                      )}
                      {item.status !== 'NEW' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={update.isPending}
                          onClick={() => update.mutate({ id: item.id, status: 'NEW' })}
                        >
                          Re-open as new
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={update.isPending || !note.trim()}
                        onClick={() => update.mutate({ id: item.id, adminNote: note.trim() })}
                      >
                        Save note
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-6 flex items-start gap-2 rounded-xl bg-gold-50 p-4 text-xs leading-relaxed text-navy-300 ring-1 ring-gold-200">
        <MessageSquareHeart className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
        <p>
          Reviews submitted here are separate from order reviews (the Reviews tab) — those
          come from delivered orders and feed the testimonials carousel. A great review
          from this form can be featured by asking the customer to leave an order review,
          or by seeding it into the testimonials manually.
        </p>
      </div>
    </div>
  )
}
