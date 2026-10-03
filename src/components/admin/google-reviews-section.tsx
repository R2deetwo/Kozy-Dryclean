'use client'

// =============================================================================
// GoogleReviewsSection (Task 87) — the public wall's source, managed.
// =============================================================================
// Google is the single place customers are asked to review Kozy Care; the
// site's testimonials come from the Google Business Profile. This section
// is the office's control room for it:
//   - SYNC: pull the listing's reviews via the Places API (needs
//     GOOGLE_MAPS_API_KEY in Vercel — until then an honest setup note and
//     manual entry keep the wall alive).
//   - SELECTION: AUTO shows every synced review ≥ 4★ that is not hidden
//     (the office curates by hiding); MANUAL shows only hand-picked rows.
//   - MANUAL ENTRY: type a review in straight from the public Google
//     listing (the office's own data entry — labelled MANUAL).
// The delivered-order email asks for Google reviews with a tracked link;
// once a customer taps it they are never asked again (see google-reviews.ts).
// =============================================================================

import { useState } from 'react'
import {
  BadgeCheck,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  RefreshCw,
  Star,
  Upload,
} from 'lucide-react'
import {
  useAddGoogleReview,
  useGoogleReviews,
  useModerateGoogleReview,
  useSyncGoogleReviews,
} from '@/lib/hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

export function GoogleReviewsSection() {
  const { data, isLoading } = useGoogleReviews()
  const sync = useSyncGoogleReviews()
  const moderate = useModerateGoogleReview()
  const addManual = useAddGoogleReview()

  const [autoSelect, setAutoSelect] = useState<boolean | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ authorName: '', rating: '5', text: '', relativeTime: '' })
  const [savingMode, setSavingMode] = useState(false)

  const mode = autoSelect ?? data?.autoSelect ?? true

  async function saveMode(next: boolean) {
    setAutoSelect(next)
    setSavingMode(true)
    try {
      const res = await fetch('/api/settings/app', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleReviewAutoSelect: next }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not save')
    } catch (e) {
      toast({
        title: 'Could not save the selection mode',
        description: (e as Error).message,
        variant: 'destructive',
      })
      setAutoSelect(null)
    } finally {
      setSavingMode(false)
    }
  }

  async function submitManual() {
    const rating = Math.round(Number(form.rating))
    if (form.authorName.trim().length < 2 || !Number.isFinite(rating) || rating < 1 || rating > 5 || !form.text.trim()) {
      toast({
        title: 'A few fields are missing',
        description: 'Author (as shown on Google), a 1–5 rating, and the review text.',
        variant: 'destructive',
      })
      return
    }
    try {
      await addManual.mutateAsync({
        authorName: form.authorName.trim(),
        rating,
        text: form.text.trim(),
        relativeTime: form.relativeTime.trim() || undefined,
      })
      setForm({ authorName: '', rating: '5', text: '', relativeTime: '' })
      setShowAdd(false)
      toast({ title: 'Added', description: 'The review is on the wall now.' })
    } catch (e) {
      toast({ title: 'Could not add', description: (e as Error).message, variant: 'destructive' })
    }
  }

  const reviews = data?.reviews ?? []
  const stats = data?.stats ?? null

  return (
    <Card className="border-gold-200 bg-gold-50/30">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-gold-600" aria-hidden="true" />
              <p className="text-sm font-bold uppercase tracking-wide text-navy">
                Google reviews — the public wall&rsquo;s source
              </p>
            </div>
            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-navy-300">
              Customers are asked to review Kozy on Google (never in two places) — the delivered-order
              email carries a tracked link that stops asking once they review. What Google holds shows
              here; choose what appears on the site.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {stats && (
              <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-navy-100">
                <Star className="h-4 w-4 fill-gold-400 text-gold-400" aria-hidden="true" />
                <span className="font-serif text-lg font-bold text-navy">{stats.rating.toFixed(1)}</span>
                <span className="text-xs text-navy-300">
                  · {stats.count} Google review{stats.count === 1 ? '' : 's'}
                </span>
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={sync.isPending}
              onClick={() =>
                sync.mutate(undefined, {
                  onSuccess: (r) =>
                    toast({ title: r.status === 'SYNCED' ? 'Synced' : 'Sync state', description: r.message }),
                  onError: (e) =>
                    toast({ title: 'Sync did not complete', description: (e as Error).message, variant: 'destructive' }),
                })
              }
              className="border-navy-200 text-navy hover:bg-navy-50"
            >
              {sync.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
              Sync from Google
            </Button>
          </div>
        </div>

        {/* Setup note / last sync */}
        <p className="mt-2 text-[11px] leading-relaxed text-navy-300">
          {data?.syncConfigured
            ? stats?.syncedAt
              ? `Last sync ${new Date(stats.syncedAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })} — Google returns the 5 most recent reviews per sync.`
              : 'The Places API key is configured — run your first sync above.'
            : 'Automatic sync needs a Google Maps API key: Google Cloud Console → enable "Places API" → create a key → add GOOGLE_MAPS_API_KEY in Vercel (Project → Settings → Environment Variables). Until then, enter reviews manually below — they show the same way.'}
        </p>

        {/* Mode toggle */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-navy-300">Selection</span>
          {[
            { key: true, label: 'Auto — show every review ≥ 4★ (hide exceptions)' },
            { key: false, label: 'Manual — only reviews I approve' },
          ].map((opt) => (
            <button
              key={String(opt.key)}
              type="button"
              disabled={savingMode}
              onClick={() => saveMode(opt.key)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition',
                mode === opt.key
                  ? 'border-gold-400 bg-white text-navy shadow-sm'
                  : 'border-navy-200 bg-white/50 text-navy-300 hover:border-gold-300'
              )}
            >
              {opt.label}
            </button>
          ))}
          {savingMode && <Loader2 className="h-3.5 w-3.5 animate-spin text-navy-300" />}
        </div>

        {/* Manual add */}
        <div className="mt-3">
          {!showAdd ? (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold-700 underline-offset-2 hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Add a Google review manually
            </button>
          ) : (
            <div className="mt-2 rounded-xl border border-navy-200 bg-white p-4">
              <p className="text-xs text-navy-300">
                Copy a review from the public Google listing (Google Maps → Kozy Care → reviews) and
                paste it here — the wall shows it with the Google badge.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-[2fr_80px_140px]">
                <Input
                  placeholder="Author name (as shown on Google)"
                  value={form.authorName}
                  onChange={(e) => setForm({ ...form, authorName: e.target.value })}
                  aria-label="Review author name"
                />
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={form.rating}
                  onChange={(e) => setForm({ ...form, rating: e.target.value })}
                  aria-label="Star rating"
                />
                <Input
                  placeholder='When (e.g. "2 weeks ago")'
                  value={form.relativeTime}
                  onChange={(e) => setForm({ ...form, relativeTime: e.target.value })}
                  aria-label="Relative time as shown on Google"
                />
              </div>
              <textarea
                className="mt-2 w-full rounded-lg border border-navy-200 p-2.5 text-sm placeholder:text-navy-300 focus:border-gold-400 focus:outline-none"
                rows={3}
                placeholder="The review text, exactly as written on Google"
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
                aria-label="Review text"
              />
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={submitManual} disabled={addManual.isPending} className="bg-navy text-white hover:bg-navy-600">
                  {addManual.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                  Add to the wall
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowAdd(false)} className="border-navy-200 text-navy-300">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Rows */}
        <div className="mt-4 space-y-2">
          {isLoading ? (
            <p className="flex items-center gap-2 py-3 text-sm text-navy-300">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading Google reviews…
            </p>
          ) : reviews.length === 0 ? (
            <p className="rounded-lg border border-dashed border-navy-200 bg-white/60 px-4 py-6 text-center text-sm text-navy-300">
              No Google reviews on the wall yet — sync above, or add one manually.
            </p>
          ) : (
            reviews.map((r) => {
              const visible = !r.hidden && (mode ? r.rating >= 4 : r.approved)
              return (
                <div
                  key={r.id}
                  className={cn(
                    'rounded-xl border bg-white p-3.5 transition',
                    r.hidden ? 'border-navy-100 opacity-60' : visible ? 'border-green-200' : 'border-navy-100'
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-navy">{r.authorName}</span>
                        <span className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={cn('h-3 w-3', r.rating >= s ? 'fill-gold-400 text-gold-400' : 'fill-transparent text-navy-200')}
                            />
                          ))}
                        </span>
                        {r.relativeTime && <span className="text-xs text-navy-300">· {r.relativeTime}</span>}
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                            r.source === 'MANUAL' ? 'bg-navy-100 text-navy-300' : 'bg-gold-100 text-gold-700'
                          )}
                        >
                          {r.source === 'MANUAL' ? 'Entered manually' : 'Google sync'}
                        </span>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                            r.hidden ? 'bg-navy-100 text-navy-300' : visible ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                          )}
                        >
                          {r.hidden ? 'Hidden' : visible ? 'On the wall' : mode ? 'Below 4★ (auto hides)' : 'Awaiting your pick'}
                        </span>
                      </div>
                      {r.text && <p className="mt-1.5 text-sm leading-relaxed text-navy">&ldquo;{r.text}&rdquo;</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {!mode && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={moderate.isPending}
                          onClick={() => moderate.mutate({ id: r.id, approved: !r.approved })}
                          className="h-7 border-navy-200 px-2 text-[11px] text-navy-300 hover:bg-navy-50"
                        >
                          {r.approved ? 'Unpick' : 'Show on wall'}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={moderate.isPending}
                        onClick={() => moderate.mutate({ id: r.id, hidden: !r.hidden })}
                        className="h-7 border-navy-200 px-2 text-[11px] text-navy-300 hover:bg-navy-50"
                        title={r.hidden ? 'Show again' : 'Hide from the wall'}
                      >
                        {r.hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}
