'use client'

// =============================================================================
// MarketingView — the owner's marketing hub (phase 36)
// =============================================================================
// ADMIN-only tab with four sub-views:
//   Campaigns    — write, schedule, test-send and blast newsletter emails
//                  to customer segments + footer subscribers
//   Coupons      — create and manage promo codes with rules (expiry, usage
//                  limits, minimums, caps, retail/corporate-only)
//   Subscribers  — the email list: footer signups + opted-in customers
//   Analytics    — sends, open/click rates, coupon redemption value
//
// On mount the view fires the lazy scheduler (process-due): any SCHEDULED
// campaign whose time has come is sent right then, so a delayed daily cron
// never holds a campaign hostage. Sends are also resumable — "Send Now" on
// an interrupted campaign continues where it stopped.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Megaphone,
  Tag,
  Users,
  BarChart3,
  Plus,
  Send,
  Eye,
  Trash2,
  Copy,
  Check,
  Calendar,
  Clock,
  Loader2,
  MailCheck,
  MousePointerClick,
  Search,
  Download,
  Ticket,
  AlertCircle,
  X,
  Sparkles,
  Bold,
  Italic,
  Pencil,
  Wand2,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { formatNaira } from '@/lib/types'
import {
  getUpcomingPromoPlan,
  getPromoPlanStatus,
  type PromoPlanEntry,
} from '@/lib/promo-calendar'
import {
  useMarketingCampaigns,
  useMarketingCoupons,
  useMarketingSubscribers,
  useMarketingStats,
  useProcessDueCampaigns,
  type MarketingCampaign,
  type MarketingCoupon,
  type MarketingSubscriber,
} from '@/lib/hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
import {
  NewsletterEnginePanel,
  EditCampaignDialog,
  BannerPicker,
} from '@/components/admin/newsletter-engine'

type SubTab = 'campaigns' | 'coupons' | 'subscribers' | 'analytics'

const SEGMENT_META: Record<string, { label: string; hint: string }> = {
  ALL: {
    label: 'All customers + subscribers',
    hint: 'Every retail & corporate customer who has not unsubscribed, plus every footer subscriber.',
  },
  B2C: { label: 'Retail customers only', hint: 'Personal accounts (B2C).' },
  B2B: { label: 'Corporate customers only', hint: 'Hotels, estates and businesses (B2B).' },
  INACTIVE: {
    label: 'Win-back — no order in 60+ days',
    hint: 'Customers who have not ordered in the last 60 days, including signups who never booked.',
  },
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Min value for the datetime-local schedule input: one minute ahead,
 *  formatted in the ADMIN's local time (the format the input expects).
 *  Past dates are also rejected server-side — this is just the friendly
 *  first line of defence (phase 44). */
function scheduleMin(): string {
  const d = new Date(Date.now() + 60_000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** "Dec 15 – Jan 5, 2027" — promo windows in Lagos terms, year shown when it isn't the current one. */
function fmtPromoWindow(p: PromoPlanEntry): string {
  const fmt = (d: Date, withYear = false) =>
    d.toLocaleDateString('en-NG', {
      timeZone: 'Africa/Lagos',
      day: 'numeric',
      month: 'short',
      ...(withYear ? { year: 'numeric' } : {}),
    })
  const endYear = p.end.toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', year: 'numeric' })
  const nowYear = new Date().toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', year: 'numeric' })
  return `${fmt(p.start)} – ${fmt(p.end, endYear !== nowYear)}`
}

export function MarketingView() {
  const [subTab, setSubTab] = useState<SubTab>('campaigns')

  // Lazy scheduler: on mount, send any due SCHEDULED campaigns. The daily
  // cron (vercel.json) is the other trigger; this one means "whenever the
  // owner opens Marketing, due campaigns go out" — never held hostage.
  const processDue = useProcessDueCampaigns()
  useEffect(() => {
    processDue.mutate()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-semibold tracking-tight text-navy">Marketing</h2>
        <p className="mt-1 text-sm text-navy-300">
          Keep Kozy Care front of mind — newsletters, promo codes and the email list, in one place.
        </p>
      </div>

      <Tabs value={subTab} onValueChange={(v) => setSubTab(v as SubTab)}>
        <TabsList className="bg-linen-200">
          <TabsTrigger
            value="campaigns"
            className="data-[state=active]:bg-navy data-[state=active]:text-white"
          >
            <Megaphone className="mr-1.5 h-3.5 w-3.5" /> Campaigns
          </TabsTrigger>
          <TabsTrigger
            value="coupons"
            className="data-[state=active]:bg-navy data-[state=active]:text-white"
          >
            <Tag className="mr-1.5 h-3.5 w-3.5" /> Coupons
          </TabsTrigger>
          <TabsTrigger
            value="subscribers"
            className="data-[state=active]:bg-navy data-[state=active]:text-white"
          >
            <Users className="mr-1.5 h-3.5 w-3.5" /> Email list
          </TabsTrigger>
          <TabsTrigger
            value="analytics"
            className="data-[state=active]:bg-navy data-[state=active]:text-white"
          >
            <BarChart3 className="mr-1.5 h-3.5 w-3.5" /> Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="mt-6">
          <CampaignsTab />
        </TabsContent>
        <TabsContent value="coupons" className="mt-6">
          <CouponsTab />
        </TabsContent>
        <TabsContent value="subscribers" className="mt-6">
          <SubscribersTab />
        </TabsContent>
        <TabsContent value="analytics" className="mt-6">
          <AnalyticsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// =============================================================================
// CAMPAIGNS
// =============================================================================
function CampaignsTab() {
  const qc = useQueryClient()
  const { data: campaigns, isLoading } = useMarketingCampaigns()
  const [showCreate, setShowCreate] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  // Saved-campaign preview dialog (the exact email, nothing is sent)
  const [previewCampaign, setPreviewCampaign] = useState<MarketingCampaign | null>(null)
  // Phase 40: review-and-change editor for drafts (engine + hand-written)
  const [editingCampaign, setEditingCampaign] = useState<MarketingCampaign | null>(null)
  // Safe send dialog: the owner sees HOW MANY people will receive the email
  // and must type SEND — a live blast can never be a single stray click.
  const [sendDialog, setSendDialog] = useState<{
    campaign: MarketingCampaign
    count: number | null
    tested: boolean
    loadingCount: boolean
    typed: string
    sending: boolean
  } | null>(null)

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ['marketing-campaigns'] })
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const scheduledRaw = (fd.get('scheduledAt') as string) || ''
    const bannerRaw = (fd.get('bannerSlug') as string) || ''
    const body = {
      name: fd.get('name'),
      subject: fd.get('subject'),
      // Plain message — the API turns it into the pretty email HTML
      bodyText: fd.get('bodyText'),
      segment: fd.get('segment'),
      bannerSlug: bannerRaw || null,
      // datetime-local → ISO (local time, as the admin meant it)
      scheduledAt: scheduledRaw ? new Date(scheduledRaw).toISOString() : undefined,
    }
    const res = await fetch('/api/marketing/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      toast({
        title: 'Campaign saved',
        description: scheduledRaw
          ? 'Scheduled — it sends automatically on the day (daily check + when you open this tab).'
          : 'Saved as a draft. Open Preview to see the email, send yourself a Test, then send it to everyone.',
      })
      setShowCreate(false)
      refresh()
    } else {
      const err = await res.json().catch(() => ({}))
      toast({
        title: 'Could not save the campaign',
        description: err.error || 'Please check the fields and try again.',
        variant: 'destructive',
      })
    }
  }

  /** Test copy → the owner's own inbox only. No confirmation needed —
   *  it can never reach a customer. */
  async function handleTestSend(campaign: MarketingCampaign) {
    setBusyId(campaign.id)
    try {
      const res = await fetch(`/api/marketing/campaigns/${campaign.id}/send`, {
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
        refresh()
      } else {
        toast({
          title: 'Test send failed',
          description: data.error || 'Please try again.',
          variant: 'destructive',
        })
      }
    } finally {
      setBusyId(null)
    }
  }

  /** Live blast → always through the safe dialog (count + typed SEND). */
  async function openSendDialog(campaign: MarketingCampaign) {
    setSendDialog({ campaign, count: null, tested: campaign.testSentAt != null, loadingCount: true, typed: '', sending: false })
    try {
      const res = await fetch(`/api/marketing/campaigns/${campaign.id}/audience`)
      const data = await res.json().catch(() => ({}))
      setSendDialog((d) =>
        d && d.campaign.id === campaign.id
          ? { ...d, count: res.ok ? data.count : null, tested: res.ok ? !!data.tested : d.tested, loadingCount: false }
          : d
      )
    } catch {
      setSendDialog((d) => (d && d.campaign.id === campaign.id ? { ...d, loadingCount: false } : d))
    }
  }

  async function confirmSend() {
    if (!sendDialog) return
    const { campaign } = sendDialog
    setSendDialog({ ...sendDialog, sending: true })
    try {
      const res = await fetch(`/api/marketing/campaigns/${campaign.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast({
          title: 'Campaign sent',
          description: data.message || 'Check the analytics tab for open and click rates.',
        })
        setSendDialog(null)
        refresh()
      } else if (data.code === 'TEST_FIRST') {
        toast({
          title: 'One more step — test it first',
          description: data.error,
        })
        setSendDialog(null)
      } else {
        toast({
          title: 'Send failed',
          description: data.error || 'Please try again.',
          variant: 'destructive',
        })
      }
    } finally {
      setSendDialog((d) => (d ? { ...d, sending: false } : null))
    }
  }

  async function handleDelete(campaign: MarketingCampaign) {
    if (!confirm(`Delete the draft "${campaign.name}"?`)) return
    setBusyId(campaign.id)
    try {
      const res = await fetch(`/api/marketing/campaigns/${campaign.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast({ title: 'Campaign deleted' })
        refresh()
      } else {
        const err = await res.json().catch(() => ({}))
        toast({
          title: 'Could not delete',
          description: err.error || 'Sent campaigns are kept as your delivery record.',
          variant: 'destructive',
        })
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* The newsletter engine — drafts from the 52-week plan, owner approves */}
      <NewsletterEnginePanel />

      <div className="flex justify-end">
        <Button onClick={() => setShowCreate((v) => !v)} className="bg-navy text-white hover:bg-navy/90">
          <Plus className="mr-1.5 h-4 w-4" /> New campaign
        </Button>
      </div>

      {showCreate && (
        <Card className="border-gold-200 shadow-navy">
          <CardContent className="p-6">
            <CampaignForm onSubmit={handleCreate} onCancel={() => setShowCreate(false)} />
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="py-8 text-center text-sm text-navy-300">Loading campaigns…</p>
      ) : (campaigns ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-navy-100 p-10 text-center">
          <Megaphone className="mx-auto h-8 w-8 text-gold-400" />
          <p className="mt-3 font-semibold text-navy">No campaigns yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-navy-300">
            Your first newsletter could be a simple offer — e.g. &ldquo;12% off every suit this
            weekend&rdquo; — with a coupon code from the Coupons tab. Create it above, press{' '}
            <strong>Preview</strong> to see the exact email, send yourself a <strong>Test</strong>,
            then send it to everyone.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {(campaigns ?? []).map((c) => (
            <Card key={c.id} className="border-navy-100 shadow-navy">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-navy">{c.name}</h3>
                      <StatusBadge status={c.status} />
                      {c.source === 'automation' && (
                        <Badge className="bg-gold-50 text-[10px] font-semibold text-gold-700" title="Drafted automatically from the 52-week plan">
                          <Wand2 className="mr-0.5 h-2.5 w-2.5" /> Auto
                        </Badge>
                      )}
                      <Badge className="bg-linen-100 text-[10px] text-navy-300">
                        {SEGMENT_META[c.segment]?.label ?? c.segment}
                      </Badge>
                      {c.testSentAt && (
                        <Badge className="bg-emerald-50 text-[10px] font-semibold text-emerald-700" title={`Tested ${fmtDateTime(c.testSentAt)}`}>
                          <Check className="mr-0.5 h-2.5 w-2.5" /> Tested
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-navy-300">{c.subject}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy-300">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {c.status === 'SCHEDULED'
                          ? `Scheduled ${fmtDateTime(c.scheduledAt)}`
                          : c.status === 'SENT'
                            ? `Sent ${fmtDateTime(c.sentAt)}`
                            : 'Draft — not scheduled'}
                      </span>
                      <span>{c.deliveredCount ?? c.sentCount} delivered</span>
                      {c.sentCount > 0 && (
                        <span className="flex items-center gap-3 text-emerald-700">
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" /> {c.openCount} opens
                          </span>
                          <span className="flex items-center gap-1">
                            <MousePointerClick className="h-3 w-3" /> {c.clickCount} clicks
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {['DRAFT', 'SCHEDULED'].includes(c.status) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === c.id}
                        onClick={() => setEditingCampaign(c)}
                        title="Change anything before it goes out"
                      >
                        <Pencil className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                    )}
                    {['DRAFT', 'SCHEDULED', 'SENDING', 'SENT'].includes(c.status) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === c.id}
                        onClick={() => setPreviewCampaign(c)}
                        title="See the exact email — nothing is sent"
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        Preview
                      </Button>
                    )}
                    {['DRAFT', 'SCHEDULED', 'SENDING', 'SENT'].includes(c.status) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === c.id}
                        onClick={() => handleTestSend(c)}
                        title="Send a test copy to your own inbox only"
                      >
                        {busyId === c.id ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <MailCheck className="mr-1 h-3 w-3" />
                        )}
                        Test
                      </Button>
                    )}
                    {['DRAFT', 'SCHEDULED', 'SENDING', 'SENT'].includes(c.status) && (
                      <Button
                        size="sm"
                        className="bg-navy text-white hover:bg-navy/90"
                        disabled={busyId === c.id}
                        onClick={() => openSendDialog(c)}
                      >
                        <Send className="mr-1 h-3 w-3" />
                        {c.status === 'SENT' ? 'Retry failed' : c.status === 'SCHEDULED' ? 'Send early' : 'Send now'}
                      </Button>
                    )}
                    {['DRAFT', 'SCHEDULED'].includes(c.status) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-500 hover:bg-red-50 hover:text-red-600"
                        disabled={busyId === c.id}
                        onClick={() => handleDelete(c)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ---- Preview dialog: the exact email, nothing is sent ---- */}
      <Dialog open={!!previewCampaign} onOpenChange={(o) => !o && setPreviewCampaign(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email preview — {previewCampaign?.name}</DialogTitle>
            <DialogDescription>
              This is exactly what your customers receive. Nothing is sent from this screen — use
              Test to get a copy in your own inbox, or Send now to deliver it.
            </DialogDescription>
          </DialogHeader>
          {previewCampaign && (
            <iframe
              title="Campaign email preview"
              src={`/api/marketing/campaigns/${previewCampaign.id}/preview`}
              className="h-[65vh] w-full rounded-lg border border-navy-100 bg-white"
              sandbox=""
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ---- Phase 40: review-and-change editor for drafts ---- */}
      <EditCampaignDialog
        campaign={editingCampaign}
        onClose={() => setEditingCampaign(null)}
        onSaved={() => refresh()}
      />

      {/* ---- Safe send dialog: count + typed confirmation ---- */}
      <Dialog open={!!sendDialog} onOpenChange={(o) => !o && setSendDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send this email to your customers?</DialogTitle>
            <DialogDescription>
              {sendDialog?.campaign.status === 'SENT'
                ? 'This campaign was already sent — this only re-tries the recipients whose copy failed.'
                : 'This cannot be undone, so it needs a deliberate confirmation.'}
            </DialogDescription>
          </DialogHeader>
          {sendDialog && (
            <div className="space-y-4">
              <div className="rounded-xl border border-navy-100 bg-linen-50 p-4 text-sm">
                <p className="font-medium text-navy">
                  {sendDialog.campaign.subject}
                </p>
                <p className="mt-1 text-navy-300">
                  Goes to:{' '}
                  <span className="font-medium text-navy">
                    {SEGMENT_META[sendDialog.campaign.segment]?.label ?? sendDialog.campaign.segment}
                  </span>
                </p>
                <p className="mt-1 text-navy-300">
                  Recipients:{' '}
                  <span className="font-semibold text-navy">
                    {sendDialog.loadingCount ? 'counting…' : sendDialog.count != null ? sendDialog.count : 'unavailable'}
                  </span>{' '}
                  {sendDialog.count === 1 ? 'person' : 'people'}
                </p>
              </div>
              {!sendDialog.tested && (
                <p className="rounded-lg bg-gold-50 p-3 text-xs leading-relaxed text-gold-700">
                  You haven&rsquo;t tested this campaign yet — the send will be refused until you
                  click <strong>Test</strong> and check it in your own inbox first.
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="send-confirm">Type SEND to confirm</Label>
                <Input
                  id="send-confirm"
                  autoComplete="off"
                  placeholder="SEND"
                  value={sendDialog.typed}
                  onChange={(e) =>
                    setSendDialog((d) => (d ? { ...d, typed: e.target.value.toUpperCase() } : d))
                  }
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSendDialog(null)}>
                  Cancel
                </Button>
                <Button
                  className="bg-navy text-white hover:bg-navy/90"
                  disabled={sendDialog.typed !== 'SEND' || sendDialog.sending || sendDialog.loadingCount}
                  onClick={confirmSend}
                >
                  {sendDialog.sending ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Sending…
                    </>
                  ) : (
                    <>
                      <Send className="mr-1.5 h-3.5 w-3.5" /> Send to{' '}
                      {sendDialog.loadingCount ? '…' : sendDialog.count ?? ''}{' '}
                      {sendDialog.count === 1 ? 'person' : 'people'}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: 'bg-navy-100 text-navy-500',
    SCHEDULED: 'bg-gold-100 text-gold-700',
    SENDING: 'bg-blue-100 text-blue-700',
    SENT: 'bg-emerald-100 text-emerald-700',
    CANCELLED: 'bg-red-100 text-red-600',
  }
  return <Badge className={cn('text-[10px] font-semibold', styles[status])}>{status}</Badge>
}

function CampaignForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onCancel: () => void
}) {
  // The message is PLAIN TEXT — typed like a normal email or WhatsApp
  // message. No HTML knowledge needed; the server converts it (paragraphs,
  // bold, clickable links) and the Preview tab shows the exact result.
  const [message, setMessage] = useState(
    'Hi there,\n\nWrite your message here, exactly like typing a normal email. Leave a blank line between paragraphs, put **two stars** around words you want bold, and any link you paste becomes a button customers can tap.\n\n— The Kozy Care team'
  )
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  // Debounced live preview — renders through the SAME wrapper the real
  // email uses, so what the owner sees is exactly what customers get.
  // This endpoint never sends anything.
  useEffect(() => {
    if (mode !== 'preview') return
    if (!message.trim()) {
      setPreviewHtml(null)
      return
    }
    const t = setTimeout(async () => {
      setPreviewLoading(true)
      try {
        const res = await fetch('/api/marketing/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bodyText: message, bannerSlug: banner }),
        })
        setPreviewHtml(res.ok ? await res.text() : null)
      } catch {
        setPreviewHtml(null)
      } finally {
        setPreviewLoading(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [message, mode, banner])

  /** Wrap the current selection with a marker (e.g. ** for bold). */
  function wrapSelection(marker: string) {
    const ta = taRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = message.slice(start, end) || 'bold text'
    setMessage(message.slice(0, start) + marker + selected + marker + message.slice(end))
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + marker.length, start + marker.length + selected.length)
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Campaign name (just for you)</Label>
          <Input name="name" placeholder="e.g. September Weekend Offer" required maxLength={100} />
        </div>
        <div className="space-y-2">
          <Label>Email subject</Label>
          <Input name="subject" placeholder="e.g. Your suits called — 12% off this weekend" required maxLength={200} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Who should receive it?</Label>
        <select
          name="segment"
          defaultValue="ALL"
          className="flex h-10 w-full rounded-lg border border-navy-100 bg-white px-3 py-2 text-sm text-navy shadow-sm focus:border-gold-400 focus:outline-none"
        >
          {Object.entries(SEGMENT_META).map(([key, meta]) => (
            <option key={key} value={key}>
              {meta.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-navy-300">Website sign-ups are included in &ldquo;All customers&rdquo; sends.</p>
      </div>
      <BannerPicker value={banner} onChange={setBanner} />
      <input type="hidden" name="bannerSlug" value={banner ?? ''} />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Your message</Label>
          <div className="flex items-center gap-1">
            {mode === 'write' ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => wrapSelection('**')}
                  title="Make the selected text bold"
                >
                  <Bold className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => wrapSelection('*')}
                  title="Make the selected text italic"
                >
                  <Italic className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setMode('preview')}
                  title="See exactly what the email looks like"
                >
                  <Eye className="mr-1 h-3.5 w-3.5" /> Preview
                </Button>
              </>
            ) : (
              <Button type="button" size="sm" variant="ghost" onClick={() => setMode('write')}>
                <Pencil className="mr-1 h-3.5 w-3.5" /> Edit message
              </Button>
            )}
          </div>
        </div>

        {mode === 'write' ? (
          <>
            <Textarea
              ref={taRef}
              name="bodyText"
              rows={10}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              className="text-sm leading-relaxed"
              placeholder="Write your message like a normal email…"
            />
            <p className="text-xs leading-relaxed text-navy-300">
              Type it like a normal message — a blank line starts a new paragraph. To make
              something bold, wrap it in two stars:{' '}
              <code className="rounded bg-linen-100 px-1 py-0.5">**like this**</code>. Any link you
              paste (like https://kozycare.ng/book) becomes a clickable button in the email. The
              Kozy Care header, sign-off and one-click unsubscribe are added automatically.
            </p>
          </>
        ) : (
          <div className="rounded-lg border border-navy-100 bg-white">
            {previewLoading ? (
              <div className="flex h-64 items-center justify-center text-sm text-navy-300">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing the preview…
              </div>
            ) : previewHtml ? (
              <iframe
                title="Live email preview"
                srcDoc={previewHtml}
                className="h-[420px] w-full rounded-lg"
                sandbox=""
              />
            ) : (
              <div className="flex h-64 items-center justify-center px-6 text-center text-sm text-navy-300">
                Write your message first — the preview will appear here.
              </div>
            )}
            <p className="border-t border-navy-100 px-4 py-2 text-xs text-navy-300">
              This is exactly what customers will receive (the yellow &ldquo;test copy&rdquo; stripe
              is removed on the real send). Nothing is sent from this screen.
            </p>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <Label>Schedule (optional — leave blank to save as draft)</Label>
        <Input name="scheduledAt" type="datetime-local" min={scheduleMin()} />
        <p className="text-xs text-navy-300">
          Scheduled campaigns are checked daily at 8am and whenever you open this tab — so they
          also go out as soon as you next check Marketing. The date must be in the future.
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="bg-gold-gradient text-navy hover:opacity-90">
          Save campaign
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

// =============================================================================
// COUPONS
// =============================================================================
function CouponsTab() {
  const qc = useQueryClient()
  const { data: coupons, isLoading } = useMarketingCoupons()
  const [showCreate, setShowCreate] = useState(false)
  // Prefill from the seasonal promo plan ("Create this coupon") — the plan
  // only pre-fills; nothing is created until the owner presses Create.
  const [prefill, setPrefill] = useState<CouponFormInitial | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const promoPlan = useMemo(() => getUpcomingPromoPlan(), [])

  function startPrefilled(entry: PromoPlanEntry) {
    setPrefill({
      name: entry.name,
      code: entry.code,
      description: entry.description,
      type: entry.type,
      value: entry.value,
      appliesTo: entry.appliesTo,
      minOrderValue: entry.minOrderValue,
      maxDiscount: entry.maxDiscount,
      maxUsesPerUser: entry.maxUsesPerUser,
      startDate: entry.startLocal,
      endDate: entry.endLocal,
    })
    setShowCreate(true)
  }

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ['marketing-coupons'] })
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const body = {
      name: fd.get('name'),
      code: (fd.get('code') as string) || undefined,
      description: (fd.get('description') as string) || undefined,
      type: fd.get('type'),
      value: Number(fd.get('value')),
      appliesTo: fd.get('appliesTo'),
      minOrderValue: fd.get('minOrderValue') ? Number(fd.get('minOrderValue')) : undefined,
      maxDiscount: fd.get('maxDiscount') ? Number(fd.get('maxDiscount')) : undefined,
      maxUsesTotal: fd.get('maxUsesTotal') ? Number(fd.get('maxUsesTotal')) : undefined,
      maxUsesPerUser: fd.get('maxUsesPerUser') ? Number(fd.get('maxUsesPerUser')) : undefined,
      startDate: fd.get('startDate') ? new Date(fd.get('startDate') as string).toISOString() : undefined,
      endDate: fd.get('endDate') ? new Date(fd.get('endDate') as string).toISOString() : undefined,
    }
    const res = await fetch('/api/settings/discounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const data = await res.json()
      toast({
        title: 'Coupon created',
        description: `Code ${data.coupon.code} is live — share it in a campaign or on your flyers.`,
      })
      setShowCreate(false)
      refresh()
    } else {
      const err = await res.json().catch(() => ({}))
      toast({
        title: 'Could not create the coupon',
        description: err.error || 'Please check the fields and try again.',
        variant: 'destructive',
      })
    }
  }

  async function handleToggle(coupon: MarketingCoupon) {
    setTogglingId(coupon.id)
    try {
      const res = await fetch(`/api/settings/discounts/${coupon.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !coupon.active }),
      })
      if (res.ok) {
        toast({
          title: !coupon.active ? 'Coupon activated' : 'Coupon paused',
          description: !coupon.active
            ? `${coupon.code} can now be redeemed at checkout.`
            : `${coupon.code} will be rejected at checkout until you reactivate it.`,
        })
        refresh()
      } else {
        toast({ title: 'Could not update the coupon', variant: 'destructive' })
      }
    } finally {
      setTogglingId(null)
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).catch(() => undefined)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
    toast({ title: 'Code copied', description: `${code} is on your clipboard.` })
  }

  return (
    <div className="space-y-4">
      {/* The seasonal promo plan — recommended windows for the Nigerian year.
          Guidance + prefill only: the owner reviews and presses Create. */}
      <Card className="border-gold-200 shadow-navy">
        <CardContent className="p-6">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gold-500" />
            <h3 className="font-serif text-lg font-semibold text-navy">The seasonal promo plan</h3>
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-navy-300">
            Recommended coupon windows, sequenced with the 52-week newsletter plan — so a code
            goes live the same week the matching email goes out.{' '}
            <span className="font-medium text-navy">Detty December starts December 15</span>, so
            its window opens on the 15th and runs into the new year — never December 1. Press
            &ldquo;Create&rdquo; to prefill the form; nothing is created until you confirm.
          </p>
          <div className="mt-4 divide-y divide-navy-50">
            {promoPlan.map((p) => {
              const status = getPromoPlanStatus(p)
              return (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold text-navy">{p.season}</span>
                      <Badge
                        className={cn(
                          status === 'LIVE'
                            ? 'bg-emerald-100 text-emerald-700'
                            : status === 'UPCOMING'
                              ? 'bg-gold-100 text-gold-700'
                              : 'bg-slate-100 text-slate-500'
                        )}
                      >
                        {status === 'LIVE' ? 'Live now' : status === 'UPCOMING' ? 'Upcoming' : 'Ended'}
                      </Badge>
                      <code className="font-mono text-xs font-bold tracking-wider text-navy">{p.code}</code>
                      <span className="text-xs text-navy-300">
                        {p.type === 'PERCENTAGE' ? `${p.value}% off` : `${formatNaira(p.value)} off`}
                        {p.appliesTo === 'B2C' && ' · retail'}
                        {p.appliesTo === 'B2B' && ' · corporate'}
                        {p.appliesTo === 'ALL' && ' · everyone'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-navy-300">
                      {fmtPromoWindow(p)} · {p.note}
                    </p>
                    <p className="mt-0.5 text-[11px] text-navy-300/80">Announce with: {p.announceWith}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startPrefilled(p)}
                    disabled={showCreate && prefill?.code === p.code}
                  >
                    {showCreate && prefill?.code === p.code ? 'In the form' : 'Create this coupon'}
                  </Button>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => {
            setPrefill(null)
            setShowCreate((v) => !v)
          }}
          className="bg-navy text-white hover:bg-navy/90"
        >
          <Plus className="mr-1.5 h-4 w-4" /> New coupon
        </Button>
      </div>

      {showCreate && (
        <Card className="border-gold-200 shadow-navy">
          <CardContent className="p-6">
            <CouponForm
              key={prefill?.code ?? 'blank'}
              initial={prefill ?? undefined}
              onSubmit={handleCreate}
              onCancel={() => {
                setShowCreate(false)
                setPrefill(null)
              }}
            />
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="py-8 text-center text-sm text-navy-300">Loading coupons…</p>
      ) : (coupons ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-navy-100 p-10 text-center">
          <Ticket className="mx-auto h-8 w-8 text-gold-400" />
          <p className="mt-3 font-semibold text-navy">No coupons yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-navy-300">
            Create a code like <span className="font-mono font-semibold">WEEKEND12</span> — 12%
            off any order this weekend — or pick a season from the plan above. Then announce it in
            a campaign. Rules (expiry, usage limits, minimum spend) are all optional.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(coupons ?? []).map((c) => (
            <Card key={c.id} className={cn('border-navy-100 shadow-navy', !c.active && 'opacity-60')}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-navy">{c.name}</h3>
                    <p className="truncate text-xs text-navy-300">
                      {c.description || SEGMENT_META[c.appliesTo]?.label || c.appliesTo}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={c.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                      {c.active ? 'Active' : 'Paused'}
                    </Badge>
                    {togglingId === c.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-navy-300" />
                    ) : (
                      <Switch checked={c.active} onCheckedChange={() => handleToggle(c)} />
                    )}
                  </div>
                </div>

                {c.code && (
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-linen-50 p-3">
                    <code className="font-mono text-sm font-bold tracking-wider text-navy">{c.code}</code>
                    <button
                      onClick={() => copyCode(c.code!)}
                      className="text-navy-300 transition hover:text-gold-500"
                      aria-label="Copy code"
                    >
                      {copiedCode === c.code ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                )}

                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-navy-300">
                  <span className="font-medium text-navy">
                    {c.type === 'PERCENTAGE' ? `${c.value}% off` : `${formatNaira(c.value)} off`}
                  </span>
                  <span>
                    Used {c.usageCount ?? c.currentUses}
                    {c.maxUsesTotal ? ` / ${c.maxUsesTotal}` : ''}
                  </span>
                  {(c.minOrderValue ?? 0) > 0 && (
                    <span className="col-span-1">Min spend {formatNaira(c.minOrderValue!)}</span>
                  )}
                  {c.maxUsesPerUser != null && (
                    <span>{c.maxUsesPerUser}× per customer</span>
                  )}
                  {c.maxDiscount != null && (
                    <span className="col-span-2">Cap {formatNaira(c.maxDiscount)}</span>
                  )}
                  {c.startDate && <span className="col-span-1">From {fmtDateTime(c.startDate)}</span>}
                  {c.endDate && (
                    <span className={cn('col-span-1', new Date(c.endDate) < new Date() && 'font-semibold text-red-500')}>
                      Expires {fmtDateTime(c.endDate)}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

/** Prefill shape for the coupon form — used by the seasonal promo plan. */
export interface CouponFormInitial {
  name?: string
  code?: string
  description?: string
  type?: 'PERCENTAGE' | 'FIXED'
  value?: number
  appliesTo?: string
  minOrderValue?: number
  maxDiscount?: number
  maxUsesPerUser?: number
  /** datetime-local string, e.g. "2026-12-15T00:00" */
  startDate?: string
  endDate?: string
}

function CouponForm({
  onSubmit,
  onCancel,
  initial,
}: {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onCancel: () => void
  initial?: CouponFormInitial
}) {
  const [type, setType] = useState<'PERCENTAGE' | 'FIXED'>(initial?.type ?? 'PERCENTAGE')
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {initial && (
        <div className="flex items-start gap-2 rounded-lg bg-gold-50 p-3 text-xs text-navy-300">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-500" />
          <p>
            Prefilled from the seasonal promo plan — change anything, then press Create. The dates
            below are the code&rsquo;s live window: it is rejected at checkout before the start and
            after the end.
          </p>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input name="name" placeholder="e.g. Weekend Special" required maxLength={60} defaultValue={initial?.name} />
        </div>
        <div className="space-y-2">
          <Label>Code (leave blank to auto-generate)</Label>
          <Input name="code" placeholder="e.g. WEEKEND12" className="font-mono uppercase" maxLength={20} defaultValue={initial?.code} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Description (shown to admins — customers only see the code working)</Label>
        <Input name="description" placeholder="e.g. 12% off everything, September weekends" maxLength={300} defaultValue={initial?.description} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Type</Label>
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as 'PERCENTAGE' | 'FIXED')}
            className="flex h-10 w-full rounded-lg border border-navy-100 bg-white px-3 py-2 text-sm text-navy shadow-sm focus:border-gold-400 focus:outline-none"
          >
            <option value="PERCENTAGE">Percentage (%)</option>
            <option value="FIXED">Fixed amount (₦)</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label>{type === 'PERCENTAGE' ? 'Percentage off' : 'Amount off (₦)'}</Label>
          <Input name="value" type="number" min="1" step={type === 'PERCENTAGE' ? '1' : '50'} placeholder={type === 'PERCENTAGE' ? '12' : '1000'} required defaultValue={initial?.value} />
        </div>
        <div className="space-y-2">
          <Label>Applies to</Label>
          <select
            name="appliesTo"
            defaultValue={initial?.appliesTo ?? 'ALL'}
            className="flex h-10 w-full rounded-lg border border-navy-100 bg-white px-3 py-2 text-sm text-navy shadow-sm focus:border-gold-400 focus:outline-none"
          >
            <option value="ALL">Any customer, any order</option>
            <option value="B2C">Retail customers only</option>
            <option value="B2B">Corporate customers only</option>
            <option value="FIRST_ORDER">First order only</option>
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label>Min spend (₦)</Label>
          <Input name="minOrderValue" type="number" min="0" step="50" placeholder="0" defaultValue={initial?.minOrderValue} />
        </div>
        {type === 'PERCENTAGE' && (
          <div className="space-y-2">
            <Label>Max discount (₦)</Label>
            <Input name="maxDiscount" type="number" min="50" step="50" placeholder="No cap" defaultValue={initial?.maxDiscount} />
          </div>
        )}
        <div className="space-y-2">
          <Label>Total uses</Label>
          <Input name="maxUsesTotal" type="number" min="1" placeholder="Unlimited" />
        </div>
        <div className="space-y-2">
          <Label>Uses per customer</Label>
          <Input name="maxUsesPerUser" type="number" min="1" placeholder="Unlimited" defaultValue={initial?.maxUsesPerUser} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Start date (optional)</Label>
          <Input name="startDate" type="datetime-local" defaultValue={initial?.startDate} />
        </div>
        <div className="space-y-2">
          <Label>End date (optional)</Label>
          <Input name="endDate" type="datetime-local" defaultValue={initial?.endDate} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="bg-gold-gradient text-navy hover:opacity-90">
          Create coupon
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

// =============================================================================
// SUBSCRIBERS
// =============================================================================
function SubscribersTab() {
  const [search, setSearch] = useState('')
  // Phase 40: opt-in filter — the client wanted unsubscribe behaviour to be
  // visible and manageable: unsubscribed people stay in the list, just
  // filtered out of every send.
  const [optFilter, setOptFilter] = useState<'all' | 'in' | 'out'>('all')
  const { data, isLoading } = useMarketingSubscribers(search)

  const shown = useMemo(
    () =>
      (data?.subscribers ?? []).filter((s) =>
        optFilter === 'all' ? true : optFilter === 'in' ? s.optIn : !s.optIn
      ),
    [data, optFilter]
  )

  const exportCsv = useMemo(
    () => () => {
      const rows = (data?.subscribers ?? []).filter((s) => s.optIn)
      const csv = ['email,name,source,joined']
        .concat(rows.map((s) => `${s.email},"${(s.name ?? '').replace(/"/g, "'")}",${s.source},${new Date(s.createdAt).toISOString().slice(0, 10)}`))
        .join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kozy-subscribers-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast({
        title: 'CSV exported',
        description: `${rows.length} opted-in subscriber${rows.length === 1 ? '' : 's'} — excludes unsubscribed.`,
      })
    },
    [data]
  )

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Newsletter subscribers" value={data?.total ?? '…'} icon={Users} />
        <StatCard label="Customers opted in" value={data?.optedInCustomers ?? '…'} icon={MailCheck} hint="Customers are subscribed by default — one-click unsubscribe in every email." />
        <StatCard label="Unsubscribed" value={data?.unsubscribed ?? '…'} icon={X} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-navy-300" />
          <Input
            placeholder="Search subscribers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex rounded-lg border border-navy-100 p-0.5">
          {([
            ['all', 'All'],
            ['in', 'Subscribed'],
            ['out', 'Unsubscribed'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setOptFilter(key)}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                optFilter === key ? 'bg-navy text-white' : 'text-navy-300 hover:text-navy'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={(data?.subscribers ?? []).length === 0}>
          <Download className="mr-1.5 h-4 w-4" /> Export CSV
        </Button>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-navy-300">Loading subscribers…</p>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-navy-100 p-10 text-center">
          <Users className="mx-auto h-8 w-8 text-gold-400" />
          <p className="mt-3 font-semibold text-navy">
            {search
              ? 'No subscribers match that search'
              : optFilter === 'out'
                ? 'Nobody has unsubscribed yet'
                : optFilter === 'in'
                  ? 'No subscribed emails yet'
                  : 'No subscribers yet'}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-navy-300">
            The signup form lives in the website footer — every visitor can join the list
            without creating an account. They receive &ldquo;All customers&rdquo; campaigns.
          </p>
        </div>
      ) : (
        <Card className="border-navy-100 shadow-navy">
          <CardContent className="p-0">
            <div className="divide-y divide-navy-50">
              {shown.map((s: MarketingSubscriber) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-navy">{s.email}</p>
                    <p className="text-xs text-navy-300">
                      {s.name ? `${s.name} · ` : ''}
                      {s.source === 'footer' ? 'Website signup' : s.source} · joined{' '}
                      {new Date(s.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <Badge
                    className={
                      s.optIn
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }
                  >
                    {s.optIn ? 'Subscribed' : 'Unsubscribed'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// =============================================================================
// ANALYTICS
// =============================================================================
function AnalyticsTab() {
  const { data: stats } = useMarketingStats()

  if (!stats) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-navy-300">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading analytics…
      </div>
    )
  }

  const openRateLabel = stats.totalEmailsSent > 0 ? `${stats.openRate}%` : '—'
  const clickRateLabel = stats.totalEmailsSent > 0 ? `${stats.clickRate}%` : '—'

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Emails sent" value={stats.totalEmailsSent} icon={Send} />
        <StatCard label="Open rate" value={openRateLabel} icon={Eye} hint="Opens recorded via the tracking pixel — email apps that block images are not counted." />
        <StatCard label="Click rate" value={clickRateLabel} icon={MousePointerClick} />
        <StatCard label="Campaigns sent" value={`${stats.sentCampaigns} of ${stats.totalCampaigns}`} icon={Megaphone} />
        <StatCard label="Active subscribers" value={stats.subscribers + stats.optedInCustomers} icon={Users} hint="Footer subscribers + opted-in customers." />
        <StatCard label="Coupon redemptions" value={stats.totalCouponUsages} icon={Ticket} />
        <StatCard label="Discount value given" value={formatNaira(stats.totalDiscountGiven)} icon={Tag} hint="Total naira saved by customers through coupons." />
      </div>

      {stats.topCoupons.length > 0 && (
        <div>
          <h3 className="mb-3 font-serif text-lg font-semibold text-navy">Top coupons</h3>
          <Card className="border-navy-100 shadow-navy">
            <CardContent className="p-0">
              <div className="divide-y divide-navy-50">
                {stats.topCoupons.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-navy">
                        {c.name}
                        {c.code && <span className="ml-2 font-mono text-xs text-gold-600">{c.code}</span>}
                      </p>
                      <p className="text-xs text-navy-300">
                        {c.type === 'PERCENTAGE' ? `${c.value}% off` : c.type === 'FIXED' ? `${formatNaira(c.value ?? 0)} off` : ''}
                        {c.active ? '' : ' · paused'}
                      </p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-semibold text-navy">{c.redemptions} redemption{c.redemptions === 1 ? '' : 's'}</p>
                      <p className="text-navy-300">{formatNaira(c.totalDiscount)} given</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div>
        <h3 className="mb-3 font-serif text-lg font-semibold text-navy">Recent campaigns</h3>
        {stats.recentCampaigns.length === 0 ? (
          <p className="py-6 text-center text-sm text-navy-300">
            No campaigns yet — analytics appear after your first send.
          </p>
        ) : (
          <Card className="border-navy-100 shadow-navy">
            <CardContent className="p-0">
              <div className="divide-y divide-navy-50">
                {stats.recentCampaigns.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-navy">{c.name}</p>
                      <p className="truncate text-xs text-navy-300">{c.subject}</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-navy-300">
                      <span className="flex items-center gap-1">
                        <Send className="h-3 w-3" /> {c.sentCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" /> {c.openCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <MousePointerClick className="h-3 w-3" /> {c.clickCount}
                      </span>
                      <StatusBadge status={c.status} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string
  value: string | number
  icon: any
  hint?: string
}) {
  return (
    <Card className="border-navy-100 shadow-navy">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium tracking-wide text-navy-300 uppercase">{label}</p>
          <Icon className="h-4 w-4 text-gold-400" />
        </div>
        <p className="mt-1.5 font-serif text-2xl font-bold text-navy">{value}</p>
        {hint && <p className="mt-1.5 text-[11px] leading-snug text-navy-300">{hint}</p>}
      </CardContent>
    </Card>
  )
}
