'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, Check, X, Eye, EyeOff, MessageSquare, MapPin, User, Inbox, Loader2 } from 'lucide-react'
import { useAdminReviews, useModerateReview, type ApiReview } from '@/lib/hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/types'

type FilterKey = 'all' | 'pending' | 'approved' | 'hidden' | 'low'

export function ReviewsView() {
  const { data: reviews, isLoading } = useAdminReviews()
  const moderate = useModerateReview()

  const [filter, setFilter] = useState<FilterKey>('pending')

  const allReviews: ApiReview[] = reviews ?? []

  const filtered = useMemo(() => {
    return allReviews
      .filter((r) => {
        if (filter === 'all') return true
        if (filter === 'pending') return !r.isApproved && !r.isHidden
        if (filter === 'approved') return r.isApproved && !r.isHidden
        if (filter === 'hidden') return r.isHidden
        if (filter === 'low') return r.rating < 4.5
        return true
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [allReviews, filter])

  const stats = useMemo(() => {
    const approved = allReviews.filter((r) => r.isApproved && !r.isHidden && r.rating >= 4.5).length
    const pending = allReviews.filter((r) => !r.isApproved && !r.isHidden).length
    const hidden = allReviews.filter((r) => r.isHidden).length
    const low = allReviews.filter((r) => r.rating < 4.5).length
    const avg =
      allReviews.length > 0
        ? (allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length).toFixed(2)
        : '—'
    return { approved, pending, hidden, low, avg, total: allReviews.length }
  }, [allReviews])

  const filterTabs: { key: FilterKey; label: string; count: number }[] = [
    { key: 'pending', label: 'Pending', count: stats.pending },
    { key: 'approved', label: 'Approved', count: stats.approved },
    { key: 'low', label: 'Low rated', count: stats.low },
    { key: 'hidden', label: 'Hidden', count: stats.hidden },
    { key: 'all', label: 'All', count: stats.total },
  ]

  return (
    <div className="space-y-6">
      {/* ===== Header + stats ===== */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold tracking-tight text-navy">
            Reviews &amp; Testimonials
          </h2>
          <p className="mt-1 text-sm text-navy-300">
            Approve reviews to show them on the public testimonials carousel. Reviews below 4.5★
            never appear publicly but are visible here for your records.
          </p>
        </div>
        <div className="flex items-center gap-4 rounded-xl bg-white px-4 py-2 ring-1 ring-navy-100">
          <div className="text-center">
            <p className="font-serif text-2xl font-bold text-navy">{stats.avg}</p>
            <p className="text-[10px] uppercase tracking-wider text-navy-300">Avg rating</p>
          </div>
          <div className="h-8 w-px bg-navy-100" />
          <div className="text-center">
            <p className="font-serif text-2xl font-bold text-gold-500">{stats.approved}</p>
            <p className="text-[10px] uppercase tracking-wider text-navy-300">Public</p>
          </div>
          <div className="h-8 w-px bg-navy-100" />
          <div className="text-center">
            <p className="font-serif text-2xl font-bold text-navy-300">{stats.pending}</p>
            <p className="text-[10px] uppercase tracking-wider text-navy-300">Pending</p>
          </div>
        </div>
      </div>

      {/* ===== Filter tabs ===== */}
      <div className="flex items-center gap-2 border-b border-navy-100">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-semibold uppercase tracking-wide transition',
              filter === tab.key
                ? 'border-gold-400 text-navy'
                : 'border-transparent text-navy-300 hover:text-navy'
            )}
          >
            {tab.label}
            <span
              className={cn(
                'ml-2 rounded-full px-1.5 py-0.5 text-xs',
                filter === tab.key ? 'bg-gold-100 text-gold-700' : 'bg-navy-100 text-navy-300'
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ===== Review list ===== */}
      {isLoading ? (
        <Card className="border-navy-100">
          <CardContent className="flex items-center justify-center py-12 text-navy-300">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            <p className="text-sm">Loading reviews…</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-navy-200 bg-navy-50/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox className="h-10 w-10 text-navy-300" />
            <p className="mt-3 text-sm font-medium text-navy-300">No reviews here yet</p>
            <p className="mt-1 text-xs text-navy-300">
              {filter === 'pending'
                ? 'When customers submit reviews, they will appear here for approval.'
                : `No reviews match this filter.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((review) => {
              const isPublic = review.isApproved && !review.isHidden && review.rating >= 4.5
              return (
                <motion.div
                  key={review.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                >
                  <Card
                    className={cn(
                      'border-navy-100 shadow-navy transition',
                      review.isHidden && 'opacity-60',
                      !review.isApproved && !review.isHidden && 'ring-1 ring-gold-200'
                    )}
                  >
                    <CardContent className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        {/* Left: rating + comment */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            {/* Stars */}
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={cn(
                                    'h-4 w-4',
                                    review.rating >= star
                                      ? 'fill-gold-400 text-gold-400'
                                      : 'fill-transparent text-navy-200'
                                  )}
                                />
                              ))}
                            </div>
                            <span className="text-sm font-bold text-navy">{review.rating.toFixed(1)}</span>
                            {/* Status badge */}
                            {isPublic ? (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">
                                Public
                              </span>
                            ) : review.isHidden ? (
                              <span className="rounded-full bg-navy-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-navy-300">
                                Hidden
                              </span>
                            ) : !review.isApproved ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                                Pending
                              </span>
                            ) : (
                              <span className="rounded-full bg-navy-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-navy-300">
                                Approved (low rating)
                              </span>
                            )}
                          </div>

                          {/* Comment */}
                          <p className="mt-3 text-sm leading-relaxed text-navy">
                            &ldquo;{review.comment}&rdquo;
                          </p>

                          {/* Meta */}
                          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy-300">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {review.displayName || review.user?.name || 'Anonymous'}{' '}
                              {review.displayLocation && (
                                <span className="text-navy-200">·</span>
                              )}{' '}
                              {review.displayLocation && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {review.displayLocation}
                                </span>
                              )}
                            </span>
                            <span>·</span>
                            <span>
                              Order{' '}
                              <strong className="text-navy">#{review.order?.orderNumber ?? '—'}</strong>
                            </span>
                            {review.driverId && (
                              <>
                                <span>·</span>
                                <span>
                                  Driver:{' '}
                                  <strong className="text-navy">
                                    {review.driver?.name ?? '—'}
                                  </strong>
                                </span>
                              </>
                            )}
                            <span>·</span>
                            <span>{formatDateTime(review.createdAt)}</span>
                          </div>
                        </div>

                        {/* Right: actions */}
                        <div className="flex flex-shrink-0 items-center gap-1.5">
                          {!review.isApproved ? (
                            <Button
                              size="sm"
                              disabled={moderate.isPending}
                              onClick={() => moderate.mutate({ id: review.id, action: 'approve' })}
                              className="bg-green-600 text-white hover:bg-green-700"
                            >
                              <Check className="mr-1 h-3.5 w-3.5" /> Approve
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={moderate.isPending}
                              onClick={() => moderate.mutate({ id: review.id, action: 'unapprove' })}
                              className="border-navy-200 text-navy-300 hover:bg-navy-50"
                            >
                              <X className="mr-1 h-3.5 w-3.5" /> Unapprove
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={moderate.isPending}
                            onClick={() =>
                              moderate.mutate({ id: review.id, action: review.isHidden ? 'unhide' : 'hide' })
                            }
                            className="border-navy-200 text-navy-300 hover:bg-navy-50"
                            title={review.isHidden ? 'Unhide' : 'Hide from public'}
                          >
                            {review.isHidden ? (
                              <>
                                <Eye className="mr-1 h-3.5 w-3.5" /> Show
                              </>
                            ) : (
                              <>
                                <EyeOff className="mr-1 h-3.5 w-3.5" /> Hide
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
