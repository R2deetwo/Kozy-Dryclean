'use client'

// =============================================================================
// NewsletterEnginePanel — "Your newsletter engine" (phase 40)
// =============================================================================
// The automation hub at the top of the Marketing → Campaigns tab.
//
// What the owner sees (and the client asked for, in plain words):
//   1. A switch that turns the engine ON/OFF + how-often / which-day /
//      what-time controls — default: every 2 weeks, Thursday 9:00am.
//   2. What is about to go out: the prepared draft (subject, date,
//      picture) with Preview / Test / Approve / Skip — the engine DRAFTS,
//      the owner APPROVES. Nothing is ever sent automatically.
//   3. What is next in the 52-week content plan + a browser to start from
//      any week (seasonal material: Valentine, Easter, Eid, Independence,
//      Owambe season, Detty December…).
//   4. A four-step "how this works" strip for first-time use — the client
//      was confused about how to activate the system; this is the manual.
//
// Also exported: BannerPicker (shared by the composer + the editor) and
// EditCampaignDialog (review-and-change any draft before it goes out).
// =============================================================================

import { useEffect, useState } from 'react'
import {
  CalendarClock,
  Check,
  Eye,
  Loader2,
  Pencil,
  Play,
  SkipForward,
  Sparkles,
  BookOpen,
  Trash2,
  Send,
  Wand2,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import {
  useMarketingAutomation,
  useUpdateMarketingAutomation,
  usePrepareAutomationDraft,
  useSkipAutomationDraft,
  useApproveAutomationCampaign,
  useNewsletterLibrary,
  type NewsletterLibraryEntry,
} from '@/lib/hooks'
import type { MarketingCampaign } from '@/lib/hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const CADENCE_OPTIONS: { weeks: 1 | 2 | 4; label: string; note: string }[] = [
  { weeks: 1, label: 'Every week', note: '52 sends a year' },
  { weeks: 2, label: 'Every 2 weeks', note: '26 a year — the default' },
  { weeks: 4, label: 'Monthly', note: '12 a year' },
]

const CATEGORY_STYLES: Record<string, string> = {
  TIP: 'bg-sky-100 text-sky-700',
  PROMO: 'bg-amber-100 text-amber-700',
  SERVICE: 'bg-emerald-100 text-emerald-700',
  STORY: 'bg-violet-100 text-violet-700',
  SEASONAL: 'bg-rose-100 text-rose-700',
}

function fmtDay(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-NG', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// -----------------------------------------------------------------------------
// Banner picker — shared by the composer and the campaign editor
// -----------------------------------------------------------------------------
export function BannerPicker({
  value,
  onChange,
}: {
  value: string | null
  onChange: (slug: string | null) => void
}) {
  const { data } = useNewsletterLibrary()
  const banners = data?.banners ?? []

  return (
    <div className="space-y-2">
      <Label>Picture at the top of the email (optional)</Label>
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            'flex h-[52px] w-[86px] flex-shrink-0 items-center justify-center rounded-lg border text-xs font-medium text-navy-300',
            value === null ? 'border-gold-400 ring-2 ring-gold-200' : 'border-navy-100'
          )}
        >
          No picture
        </button>
        {banners.map((b) => (
          <button
            key={b.slug}
            type="button"
            title={b.label}
            onClick={() => onChange(b.slug)}
            className={cn(
              'h-[52px] w-[86px] flex-shrink-0 overflow-hidden rounded-lg border',
              value === b.slug ? 'border-gold-400 ring-2 ring-gold-200' : 'border-navy-100'
            )}
          >
            <img
              src={`/marketing/banners/banner-${b.slug}.jpg`}
              alt={b.label}
              className="h-full w-full object-cover"
            />
          </button>
        ))}
        {banners.length === 0 && (
          <span className="self-center text-xs text-navy-300">Loading pictures…</span>
        )}
      </div>
      <p className="text-xs text-navy-300">
        Brand-matched pictures for promos, seasons and fabric tips — they sit under the
        Kozy Care header. You can change or remove it any time before sending.
      </p>
    </div>
  )
}

// -----------------------------------------------------------------------------
// The engine panel
// -----------------------------------------------------------------------------
export function NewsletterEnginePanel() {
  const { data: state, isLoading } = useMarketingAutomation()
  const update = useUpdateMarketingAutomation()
  const prepare = usePrepareAutomationDraft()
  const skip = useSkipAutomationDraft()
  const approve = useApproveAutomationCampaign()

  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [confirmApprove, setConfirmApprove] = useState(false)
  const [confirmSkip, setConfirmSkip] = useState(false)
  const [timeDraft, setTimeDraft] = useState<string | null>(null)

  useEffect(() => {
    if (state?.schedule) setTimeDraft(state.schedule.sendTime)
  }, [state?.schedule?.sendTime])

  if (isLoading || !state) {
    return (
      <Card className="border-navy-100 shadow-navy">
        <CardContent className="flex items-center gap-3 p-5 text-sm text-navy-300">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading the newsletter engine…
        </CardContent>
      </Card>
    )
  }

  const { schedule, pending, nextUp, lastSent } = state
  const enabled = schedule.enabled

  async function openPreview() {
    if (!pending) return
    setPreviewLoading(true)
    try {
      const res = await fetch(`/api/marketing/campaigns/${pending.id}/preview`)
      setPreviewHtml(res.ok ? await res.text() : null)
    } catch {
      setPreviewHtml(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleTest() {
    if (!pending) return
    try {
      const res = await fetch(`/api/marketing/campaigns/${pending.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast({
          title: 'Test email sent',
          description: data.message || 'Check your own inbox — it went only to you.',
        })
      } else {
        toast({ title: 'Test send failed', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Test send failed', variant: 'destructive' })
    }
  }

  return (
    <>
      <Card className="border-navy-100 shadow-navy">
        <CardContent className="p-5 sm:p-6">
          {/* Title row + the ON/OFF switch (the "activation" the client asked about) */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy text-gold-300">
                <Wand2 className="h-4.5 w-4.5" />
              </span>
              <div>
                <h3 className="font-serif text-lg font-semibold text-navy">
                  Your newsletter engine
                </h3>
                <p className="text-xs text-navy-300">
                  Writes the newsletters for you from a 52-week plan — you check each one
                  before it goes anywhere.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className={cn('text-sm font-medium', enabled ? 'text-emerald-600' : 'text-navy-300')}>
                {enabled ? 'ON' : 'OFF'}
              </span>
              <Switch
                checked={enabled}
                onCheckedChange={(on) =>
                  update.mutate(
                    { enabled: on },
                    {
                      onSuccess: () =>
                        toast({
                          title: on ? 'Newsletter engine ON' : 'Newsletter engine paused',
                          description: on
                            ? 'It will prepare your next newsletter a few days before each send day — you approve before anything goes out.'
                            : 'No new newsletters will be prepared. Already-approved ones still go out on their day.',
                        }),
                      onError: (e) => toast({ title: 'Could not save', description: e.message, variant: 'destructive' }),
                    }
                  )
                }
              />
            </div>
          </div>

          {/* The 4-step manual — always visible, small */}
          <div className="mt-4 grid gap-2 rounded-xl bg-linen-50 p-3 text-xs leading-relaxed text-navy-300 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <span className="font-semibold text-navy">1. Turn it on</span> — pick how often
              below (default: every 2 weeks).
            </div>
            <div>
              <span className="font-semibold text-navy">2. It writes the newsletter</span> —
              a draft appears a few days before send day.
            </div>
            <div>
              <span className="font-semibold text-navy">3. You review it</span> — preview the
              email, edit anything, test it to your own inbox.
            </div>
            <div>
              <span className="font-semibold text-navy">4. You press Approve</span> — it goes
              out on the day. Nothing sends without your approval.
            </div>
          </div>

          {enabled && (
            <>
              {/* Cadence / day / time */}
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">How often</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {CADENCE_OPTIONS.map((o) => (
                      <button
                        key={o.weeks}
                        type="button"
                        title={o.note}
                        disabled={update.isPending}
                        onClick={() => update.mutate({ cadenceWeeks: o.weeks })}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                          schedule.cadenceWeeks === o.weeks
                            ? 'border-navy bg-navy text-white'
                            : 'border-navy-100 text-navy hover:border-navy-300'
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-navy-300">
                    Promo season? Switch to weekly — there are 52 weeks of material ready.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Send day</Label>
                  <select
                    value={schedule.dayOfWeek}
                    disabled={update.isPending}
                    onChange={(e) => update.mutate({ dayOfWeek: parseInt(e.target.value, 10) })}
                    className="flex h-9 w-full rounded-lg border border-navy-100 bg-white px-3 text-sm text-navy shadow-sm focus:border-gold-400 focus:outline-none"
                  >
                    {DAYS.map((d, i) => (
                      <option key={d} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Send time (Lagos)</Label>
                  <Input
                    type="time"
                    className="h-9"
                    value={timeDraft ?? schedule.sendTime}
                    disabled={update.isPending}
                    onChange={(e) => setTimeDraft(e.target.value)}
                    onBlur={() => {
                      if (timeDraft && timeDraft !== schedule.sendTime) {
                        update.mutate({ sendTime: timeDraft })
                      }
                    }}
                  />
                </div>
              </div>

              {/* What is about to go out */}
              <div className="mt-5 rounded-xl border border-gold-200 bg-gold-50/60 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gold-700">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {pending
                    ? pending.status === 'SCHEDULED'
                      ? 'Approved — going out automatically'
                      : 'Ready for your review'
                    : 'Next on the plan'}
                </div>

                {pending ? (
                  <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-serif text-base font-semibold text-navy">
                        {pending.subject}
                      </p>
                      <p className="mt-0.5 text-xs text-navy-300">
                        Send day: {fmtDay(pending.slotDate ?? pending.scheduledAt)}
                        {pending.testSentAt ? ' · tested ✓' : ''}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Badge className="bg-navy text-white">
                          {pending.status === 'SCHEDULED' ? 'Approved' : 'Draft'}
                        </Badge>
                        <Badge variant="outline" className="border-navy-200 text-navy-300">
                          From the 52-week plan
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={openPreview}
                        disabled={previewLoading}
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" /> Preview
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleTest}>
                        <Send className="mr-1 h-3.5 w-3.5" /> Test me
                      </Button>
                      {pending.status === 'DRAFT' && (
                        <>
                          <Button
                            size="sm"
                            className="bg-gold-gradient text-navy hover:opacity-90"
                            onClick={() => setConfirmApprove(true)}
                          >
                            <Check className="mr-1 h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmSkip(true)}
                          >
                            <SkipForward className="mr-1 h-3.5 w-3.5" /> Skip
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-serif text-base font-semibold text-navy">
                        Week {nextUp.week} — {nextUp.title}
                      </p>
                      <p className="mt-0.5 text-xs text-navy-300">
                        &ldquo;{nextUp.subject}&rdquo; · {nextUp.season} · prepared for{' '}
                        {fmtDay(schedule.nextSlotDate)} (your approval first)
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        prepare.mutate(undefined, {
                          onSuccess: (d: any) =>
                            toast({
                              title: 'Next newsletter prepared',
                              description: `“${d.campaign?.subject ?? ''}” is waiting for your review below.`,
                            }),
                          onError: (e) =>
                            toast({ title: 'Could not prepare', description: e.message, variant: 'destructive' }),
                        })
                      }
                      disabled={prepare.isPending}
                    >
                      {prepare.isPending ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="mr-1 h-3.5 w-3.5" />
                      )}
                      Prepare it now
                    </Button>
                  </div>
                )}
              </div>

              {/* Content plan + last sent */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-navy-300">
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowLibrary(true)}>
                    <BookOpen className="mr-1 h-3.5 w-3.5" /> Browse the 52-week plan
                  </Button>
                  <span>
                    Next up: Week {nextUp.week} ({nextUp.season})
                  </span>
                </div>
                {lastSent && (
                  <span>
                    Last sent: &ldquo;{lastSent.subject}&rdquo; ·{' '}
                    {fmtDay(lastSent.sentAt)} to {lastSent.sentCount}{' '}
                    {lastSent.sentCount === 1 ? 'person' : 'people'}
                  </span>
                )}
              </div>
            </>
          )}

          {/* Unsubscribe behaviour — the client asked for this to be clear */}
          <p className="mt-4 border-t border-navy-50 pt-3 text-[11px] leading-relaxed text-navy-300">
            <Sparkles className="mr-1 inline h-3 w-3 text-gold-400" />
            Every email carries a one-tap Unsubscribe link. Unsubscribing only stops the
            newsletters — the person stays registered, still gets their order emails, and
            you can see who opted out under Email list.
          </p>
        </CardContent>
      </Card>

      {/* Preview dialog — the exact email, nothing sent */}
      <Dialog open={!!previewHtml || previewLoading} onOpenChange={() => setPreviewHtml(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email preview</DialogTitle>
            <DialogDescription>
              Exactly what customers will receive — the yellow &ldquo;test copy&rdquo; stripe is
              removed on the real send. Nothing is sent from this screen.
            </DialogDescription>
          </DialogHeader>
          {previewLoading ? (
            <div className="flex h-72 items-center justify-center text-sm text-navy-300">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing…
            </div>
          ) : (
            <iframe
              title="Newsletter preview"
              srcDoc={previewHtml ?? ''}
              className="h-[460px] w-full rounded-lg border border-navy-100"
              sandbox=""
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Library browser */}
      <LibraryBrowser
        open={showLibrary}
        onOpenChange={setShowLibrary}
        currentWeekIndex={schedule.currentWeekIndex}
        onPick={(index) =>
          update.mutate(
            { currentWeekIndex: index },
            {
              onSuccess: () =>
                toast({
                  title: 'Starting point saved',
                  description: 'The next newsletter the engine prepares will use this one.',
                }),
              onError: (e) =>
                toast({ title: 'Could not save', description: e.message, variant: 'destructive' }),
            }
          )
        }
      />

      {/* Approve confirmation */}
      <Dialog open={confirmApprove} onOpenChange={setConfirmApprove}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Approve this newsletter?</DialogTitle>
            <DialogDescription>
              {pending
                ? `“${pending.subject}” will be scheduled for ${fmtDay(
                    pending.slotDate ?? pending.scheduledAt
                  )} and sent automatically on that day (daily check + whenever you open this tab). You can still delete it any time before the day.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {!pending?.testSentAt && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Tip: press <b>Test me</b> first to see it in your own inbox before approving.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmApprove(false)}>
              Not yet
            </Button>
            <Button
              className="bg-gold-gradient text-navy hover:opacity-90"
              disabled={approve.isPending || !pending}
              onClick={() =>
                pending &&
                approve.mutate(
                  { id: pending.id, slotDate: pending.slotDate },
                  {
                    onSuccess: () => {
                      setConfirmApprove(false)
                      toast({
                        title: 'Approved ✓',
                        description: 'Scheduled — it goes out on the day. You can delete it any time before.',
                      })
                    },
                    onError: (e) =>
                      toast({ title: 'Could not approve', description: e.message, variant: 'destructive' }),
                  }
                )
              }
            >
              {approve.isPending ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="mr-1 h-3.5 w-3.5" />
              )}
              Approve — schedule it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Skip confirmation */}
      <Dialog open={confirmSkip} onOpenChange={setConfirmSkip}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Skip this newsletter?</DialogTitle>
            <DialogDescription>
              The draft is deleted and the engine moves to the next one on the plan. You can
              always write your own from scratch — this only affects the automatic plan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSkip(false)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              disabled={skip.isPending || !pending}
              onClick={() =>
                pending &&
                skip.mutate(pending.id, {
                  onSuccess: () => {
                    setConfirmSkip(false)
                    toast({
                      title: 'Skipped',
                      description: 'The next newsletter on the plan is ready for review.',
                    })
                  },
                  onError: (e) =>
                    toast({ title: 'Could not skip', description: e.message, variant: 'destructive' }),
                })
              }
            >
              {skip.isPending ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <SkipForward className="mr-1 h-3.5 w-3.5" />
              )}
              Skip it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// -----------------------------------------------------------------------------
// Library browser — 52 weeks, pick where the engine starts
// -----------------------------------------------------------------------------
function LibraryBrowser({
  open,
  onOpenChange,
  currentWeekIndex,
  onPick,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  currentWeekIndex: number
  onPick: (index: number) => void
}) {
  const { data, isLoading } = useNewsletterLibrary()
  const entries = data?.entries ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>The 52-week content plan</DialogTitle>
          <DialogDescription>
            A full year of newsletters, sequenced to the Nigerian calendar — harmattan,
            Valentine, Easter, rainy season, back-to-school, Independence, the Owambe
            circuit and Detty December. Press &ldquo;Start here&rdquo; to make any week the
            engine&rsquo;s next pickup.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[420px] overflow-y-auto pr-1">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-navy-300">Loading the plan…</p>
          ) : (
            <div className="divide-y divide-navy-50">
              {entries.map((e: NewsletterLibraryEntry, i: number) => (
                <div key={e.week} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold text-navy">Week {e.week}</span>
                      <Badge className={cn('text-[10px]', CATEGORY_STYLES[e.category] ?? '')}>
                        {e.category}
                      </Badge>
                      <span className="text-[11px] text-navy-300">{e.season}</span>
                      {i === currentWeekIndex && (
                        <Badge className="bg-gold-100 text-gold-700">next up</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-navy">{e.subject}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={i === currentWeekIndex ? 'secondary' : 'outline'}
                    disabled={i === currentWeekIndex}
                    onClick={() => onPick(i)}
                  >
                    {i === currentWeekIndex ? 'Selected' : 'Start here'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// -----------------------------------------------------------------------------
// Edit a draft — review-and-change before sending (works for engine drafts
// and hand-written drafts alike)
// -----------------------------------------------------------------------------
function htmlToPlainText(html: string): string {
  return html
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function EditCampaignDialog({
  campaign,
  onClose,
  onSaved,
}: {
  campaign: MarketingCampaign | null
  onClose: () => void
  onSaved: () => void
}) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [banner, setBanner] = useState<string | null>(null)
  const [segment, setSegment] = useState('ALL')
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    if (campaign) {
      setName(campaign.name)
      setSubject(campaign.subject)
      setSegment(campaign.segment)
      setBanner(campaign.bannerSlug ?? null)
      setBody((campaign as any).bodyText ?? htmlToPlainText(campaign.htmlContent))
      setMode('write')
    }
  }, [campaign])

  // live preview of the edited draft
  useEffect(() => {
    if (mode !== 'preview' || !campaign) return
    if (!body.trim()) {
      setPreviewHtml(null)
      return
    }
    const t = setTimeout(async () => {
      setPreviewLoading(true)
      try {
        const res = await fetch('/api/marketing/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bodyText: body, bannerSlug: banner }),
        })
        setPreviewHtml(res.ok ? await res.text() : null)
      } catch {
        setPreviewHtml(null)
      } finally {
        setPreviewLoading(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [mode, body, banner, campaign])

  if (!campaign) return null

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/marketing/campaigns/${campaign!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, subject, bodyText: body, segment, bannerSlug: banner }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast({ title: 'Changes saved', description: 'The draft was updated.' })
        await qc.invalidateQueries({ queryKey: ['marketing-campaigns'] })
        await qc.invalidateQueries({ queryKey: ['marketing-automation'] })
        onSaved()
        onClose()
      } else {
        toast({ title: 'Could not save', description: data.error, variant: 'destructive' })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!campaign} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-gold-500" /> Edit draft
          </DialogTitle>
          <DialogDescription>
            Change anything before it goes out — the words, the subject, the audience or the
            picture. Save, then preview or send from the campaign card.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Campaign name (just for you)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label>Email subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Who should receive it?</Label>
            <select
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-navy-100 bg-white px-3 py-2 text-sm text-navy shadow-sm focus:border-gold-400 focus:outline-none"
            >
              <option value="ALL">All customers + subscribers</option>
              <option value="B2C">Retail customers only</option>
              <option value="B2B">Corporate customers only</option>
              <option value="INACTIVE">Win-back — no order in 60+ days</option>
            </select>
          </div>
          <BannerPicker value={banner} onChange={setBanner} />
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Your message</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setMode(mode === 'write' ? 'preview' : 'write')}
              >
                {mode === 'write' ? (
                  <>
                    <Eye className="mr-1 h-3.5 w-3.5" /> Preview
                  </>
                ) : (
                  <>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Edit message
                  </>
                )}
              </Button>
            </div>
            {mode === 'write' ? (
              <Textarea
                rows={9}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="text-sm leading-relaxed"
              />
            ) : previewLoading ? (
              <div className="flex h-56 items-center justify-center text-sm text-navy-300">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing the preview…
              </div>
            ) : (
              <iframe
                title="Edit preview"
                srcDoc={previewHtml ?? ''}
                className="h-[380px] w-full rounded-lg border border-navy-100"
                sandbox=""
              />
            )}
            <p className="text-xs text-navy-300">
              Blank line = new paragraph · <code className="rounded bg-linen-100 px-1">**two stars**</code>{' '}
              = bold · pasted links become buttons.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-gold-gradient text-navy hover:opacity-90"
            onClick={save}
            disabled={saving || !subject.trim() || !body.trim()}
          >
            {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="hidden" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
