'use client'

// =============================================================================
// MembershipsView — ADMIN: the Kozy Circle control room (phase 62)
// =============================================================================
// Two tabs:
//   Plans      — every number the owner quoted is editable here: prices,
//                bag counts, extra-unit rates, perk limits, discounts. Saving
//                also syncs Paystack recurring plans (best-effort) so card
//                members auto-renew at the new price.
//   Subscribers— the member roster: status, cycle, usage, renewal actions,
//                transfer verification and the kit lifecycle.
// =============================================================================

import { useEffect, useMemo, useState } from 'react'
import {
  Loader2,
  Save,
  Users,
  BadgeCheck,
  CircleDollarSign,
  Package,
  BedDouble,
  Layers,
  Sun,
  Footprints,
  RefreshCcw,
  Receipt,
  Ban,
  Undo2,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  ImageIcon,
  ClipboardList,
  QrCode,
  Phone,
  Mail,
  CalendarClock,
  HeartPulse,
  Send,
  MinusCircle,
  PlusCircle,
  Printer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { formatNaira, formatDate } from '@/lib/types'
import {
  useMembershipPlans,
  useSaveMembershipPlans,
  useAdminMemberships,
  useMembershipAdminAction,
  useMembershipDrilldown,
  type ApiMembershipPlan,
  type ApiMembership,
} from '@/lib/hooks'
import { cn } from '@/lib/utils'

const field =
  'h-9 w-full rounded-lg border border-navy-200 bg-white px-3 text-sm text-navy focus:border-gold-400 focus:outline-none'

export function MembershipsView() {
  const [tab, setTab] = useState<'plans' | 'subscribers'>('plans')

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-navy">
            The Kozy Circle
          </h1>
          <p className="mt-1 text-sm text-navy-300">
            Monthly plans measured by the bag, the box — and the atelier. Priced here, verified here.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'plans' | 'subscribers')}>
        <TabsList className="bg-linen-200">
          <TabsTrigger value="plans" className="data-[state=active]:bg-navy data-[state=active]:text-white text-navy-300">
            <CircleDollarSign className="mr-1.5 h-3.5 w-3.5" /> Plans &amp; pricing
          </TabsTrigger>
          <TabsTrigger value="subscribers" className="data-[state=active]:bg-navy data-[state=active]:text-white text-navy-300">
            <Users className="mr-1.5 h-3.5 w-3.5" /> Subscribers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="mt-4">
          <PlansEditor />
        </TabsContent>
        <TabsContent value="subscribers" className="mt-4">
          <SubscribersList />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// =====================================================
// PLANS EDITOR
// =====================================================
type PlanDraft = ApiMembershipPlan & { _dirty?: boolean }

function PlansEditor() {
  const { data: plans, isLoading } = useMembershipPlans()
  const save = useSaveMembershipPlans()
  const [paystackNote, setPaystackNote] = useState<string | null>(null)

  // Draft pattern: `edited` is null until the first edit — the view mirrors
  // the server plans directly (no effect, no stale-copy risk); every patch
  // materialises an editable copy. Saving returns to mirroring.
  const [edited, setEdited] = useState<PlanDraft[] | null>(null)
  const drafts: PlanDraft[] = edited ?? (plans ?? []).map((p) => ({ ...p }))

  // Phase 70: two families, two grids — the laundry tiers and the Shoe Club
  // never mix in one editor (they are different products sold in different
  // places: tiers on /memberships, club in the /services shoe section).
  const tierDrafts = drafts.filter((d) => (d.family ?? 'KIT') === 'KIT')
  const clubDrafts = drafts.filter((d) => d.family === 'SHOES')

  const patch = (id: string, key: keyof ApiMembershipPlan, value: any) =>
    setEdited(drafts.map((d) => (d.id === id ? { ...d, [key]: value, _dirty: true } : d)))

  const num = (id: string, key: keyof ApiMembershipPlan) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.max(0, Math.round(Number(e.target.value) || 0))
    patch(id, key, v)
  }

  const dirty = Boolean(edited) && drafts.some((d) => d._dirty)

  const onSave = async () => {
    try {
      const res = await save.mutateAsync(
        drafts.map(({ _dirty, ...d }) => d as ApiMembershipPlan & { id: string })
      )
      // Back to mirroring the server's saved truth.
      setEdited(null)
      setPaystackNote(
        res.paystack && res.paystack.some((p) => p.planCode)
          ? 'Paystack recurring plans synced — card members will be charged the new price from their next cycle.'
          : null
      )
      toast({
        title: 'Plans saved',
        description: 'The membership page, portal and pricing engine now use these numbers.',
      })
    } catch (e: any) {
      toast({ title: 'Could not save', description: e?.message, variant: 'destructive' })
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-navy-300" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {paystackNote && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          <BadgeCheck className="h-4 w-4 shrink-0" /> {paystackNote}
        </div>
      )}

      {/* ===== The laundry tiers (KIT family) ===== */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <p className="font-serif text-lg font-semibold text-navy">The laundry tiers</p>
          <span className="rounded-full bg-navy-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-navy-300">sold on /memberships</span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {tierDrafts.map((d) => (
          <Card key={d.id} className={cn('shadow-navy', d.isActive ? 'border-navy-100' : 'border-dashed border-navy-200 opacity-70')}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="font-serif text-lg font-semibold text-navy">{d.name}</p>
                </div>
                <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-navy-300">
                  <input
                    type="checkbox"
                    checked={d.isActive}
                    onChange={(e) => patch(d.id, 'isActive', e.target.checked)}
                    className="h-3.5 w-3.5 accent-[#0A192F]"
                  />
                  {d.isActive ? 'Live' : 'Hidden'}
                </label>
              </div>
              <Input
                value={d.tagline}
                onChange={(e) => patch(d.id, 'tagline', e.target.value)}
                placeholder="Tagline"
                className="mt-2 h-8 border-navy-100 text-xs"
              />

              <div className="mt-4 grid grid-cols-2 gap-3">
                <NumField label="Monthly price (₦)" value={d.priceMonthly} onChange={num(d.id, 'priceMonthly')} money />
                <NumField label={`${d.unitKind === 'box' ? 'Box' : 'Bag'} pickups / month`} value={d.includedUnits} onChange={num(d.id, 'includedUnits')} />
                <NumField label="Extra unit price (₦)" value={d.extraUnitPrice} onChange={num(d.id, 'extraUnitPrice')} money />
                <NumField label="Max extra units" value={d.maxExtraUnits} onChange={num(d.id, 'maxExtraUnits')} />
                <NumField label="Kit replacement fee (₦)" value={d.replacementFee} onChange={num(d.id, 'replacementFee')} money />
                <NumField label="Member discount (%)" value={d.memberDiscountPct} onChange={num(d.id, 'memberDiscountPct')} />
                <NumField label="Duvets / quarter" value={d.duvetsPerQuarter} onChange={num(d.id, 'duvetsPerQuarter')} />
                <NumField label="Curtain panels / quarter" value={d.curtainsPerQuarter} onChange={num(d.id, 'curtainsPerQuarter')} />
                <NumField label="Spring cleans / year" value={d.springCleanPerYear} onChange={num(d.id, 'springCleanPerYear')} />
                <NumField label="Shoe pairs / month" value={d.shoesPerMonth} onChange={num(d.id, 'shoesPerMonth')} />
                <div className="flex flex-col justify-end gap-1.5 pb-0.5">
                  <Toggle label="Priority windows" checked={d.prioritySlots} onChange={(v) => patch(d.id, 'prioritySlots', v)} />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-lg bg-linen-100 px-3 py-2 text-[11px] text-navy-300">
                <span className="flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-gold-600" /> {d.includedUnits} × {d.unitName}
                </span>
                <span>{d.paystackPlanCode ? 'Paystack recurring ✓' : 'Transfer renewals only'}</span>
              </div>
            </CardContent>
          </Card>
        ))}
        </div>
      </div>

      {/* ===== The Shoe Club (SHOES family) — phase 70 ===== */}
      {clubDrafts.length > 0 && (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="font-serif text-lg font-semibold text-navy">The Shoe Club</p>
            <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-800">sold in the /services shoe section</span>
            <span className="text-[11px] text-navy-300">
              A shoes-only membership — never a fourth tier. One pair = the standard sneaker/canvas clean.
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {clubDrafts.map((d) => (
              <Card key={d.id} className={cn('shadow-navy', d.isActive ? 'border-gold-200' : 'border-dashed border-navy-200 opacity-70')}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-serif text-lg font-semibold text-navy">{d.name}</p>
                    <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-navy-300">
                      <input
                        type="checkbox"
                        checked={d.isActive}
                        onChange={(e) => patch(d.id, 'isActive', e.target.checked)}
                        className="h-3.5 w-3.5 accent-[#0A192F]"
                      />
                      {d.isActive ? 'Live' : 'Hidden'}
                    </label>
                  </div>
                  <Input
                    value={d.tagline}
                    onChange={(e) => patch(d.id, 'tagline', e.target.value)}
                    placeholder="Tagline"
                    className="mt-2 h-8 border-navy-100 text-xs"
                  />
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <NumField label="Monthly price (₦)" value={d.priceMonthly} onChange={num(d.id, 'priceMonthly')} money />
                    <NumField label="Pairs / month" value={d.shoesPerMonth} onChange={num(d.id, 'shoesPerMonth')} />
                    <NumField label="Member discount (% à-la-carte)" value={d.memberDiscountPct} onChange={num(d.id, 'memberDiscountPct')} />
                    <div className="flex items-end">
                      <p className="text-[10px] leading-tight text-navy-300">
                        {d.shoesPerMonth > 0
                          ? `₦${Math.round(d.priceMonthly / d.shoesPerMonth).toLocaleString('en-NG')} a pair at this price`
                          : 'Set pairs/month to price per pair'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between rounded-lg bg-linen-100 px-3 py-2 text-[11px] text-navy-300">
                    <span className="flex items-center gap-1.5">
                      <Footprints className="h-3.5 w-3.5 text-gold-600" /> {d.shoesPerMonth} pair{d.shoesPerMonth === 1 ? '' : 's'} a month
                    </span>
                    <span>{d.paystackPlanCode ? 'Paystack recurring ✓' : 'Transfer renewals only'}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {dirty && <p className="text-xs text-amber-700">Unsaved changes</p>}
        <Button
          onClick={onSave}
          disabled={!dirty || save.isPending}
          className="rounded-full bg-gold-gradient font-semibold text-navy hover:opacity-90"
        >
          {save.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" /> Save plans
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function NumField({
  label,
  value,
  onChange,
  money,
}: {
  label: string
  value: number
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  money?: boolean
}) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-wide text-navy-300">{label}</label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={onChange}
        className={cn(field, 'mt-1')}
      />
      {money && value > 0 && (
        <p className="mt-0.5 text-[10px] text-navy-300">{formatNaira(value)}</p>
      )}
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-navy-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-[#0A192F]"
      />
      {label}
    </label>
  )
}

// =====================================================
// SUBSCRIBERS LIST
// =====================================================
function SubscribersList() {
  const { data: memberships, isLoading } = useAdminMemberships({ refetchInterval: 30_000 })
  const action = useMembershipAdminAction()
  const [receipt, setReceipt] = useState<ApiMembership | null>(null)
  const [renewFor, setRenewFor] = useState<ApiMembership | null>(null)
  const [renewPrice, setRenewPrice] = useState('')
  // Phase 75: the member drill-down (ledger + kit tag + retention desk).
  const [drillId, setDrillId] = useState<string | null>(null)
  const [onlyAttention, setOnlyAttention] = useState(false)

  const list = memberships ?? []
  const pending = list.filter((m) => m.status === 'PENDING_ACTIVATION')
  const expiringSoon = list.filter(
    (m) =>
      m.status === 'ACTIVE' &&
      m.periodEnd &&
      new Date(m.periodEnd).getTime() - Date.now() < 4 * 24 * 60 * 60 * 1000
  )
  // Phase 75: the retention radar — members needing a human today.
  const attention = list.filter(
    (m) =>
      m.health &&
      m.health.state !== 'INACTIVE' &&
      m.health.state !== 'OK' &&
      m.status !== 'PENDING_ACTIVATION'
  )
  const activeCount = list.filter(
    (m) => m.effectiveStatus === 'ACTIVE' || m.effectiveStatus === 'EXPIRING' || m.effectiveStatus === 'PAST_DUE'
  ).length
  const kitsOut = list.filter((m) => m.kitState === 'WITH_MEMBER').length

  const shown = onlyAttention ? list.filter((m) => attention.some((a) => a.id === m.id)) : list

  const run = async (m: ApiMembership, act: string, extra?: Record<string, unknown>) => {
    try {
      await action.mutateAsync({ id: m.id, action: act, ...extra })
      toast({ title: 'Done', description: `${m.user?.name ?? 'Member'} · ${act.replace('-', ' ')}` })
    } catch (e: any) {
      toast({ title: 'Action failed', description: e?.message, variant: 'destructive' })
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-navy-300" />
      </div>
    )
  }

  if (list.length === 0) {
    return (
      <Card className="border-dashed border-navy-200">
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <Users className="h-8 w-8 text-navy-200" />
          <p className="font-medium text-navy">No members yet</p>
          <p className="max-w-sm text-sm text-navy-300">
            The roster fills as customers join from the membership page — this is where you verify
            their transfers, renew their months and track the kits.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* ===== Phase 75: the cohort dashboard — one glance, the whole Circle ===== */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Users} label="Running members" value={activeCount} tone="navy" />
        <StatCard icon={Package} label="Kits with members" value={kitsOut} tone="navy" />
        <StatCard
          icon={HeartPulse}
          label="Need a human"
          value={attention.length}
          tone={attention.length > 0 ? 'amber' : 'navy'}
        />
        <StatCard
          icon={RefreshCcw}
          label="Renewals ≤ 4 days"
          value={expiringSoon.length}
          tone={expiringSoon.length > 0 ? 'gold' : 'navy'}
        />
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setOnlyAttention(false)}
          className={cn(
            'rounded-full border px-3 py-1 text-[11px] font-semibold transition',
            !onlyAttention
              ? 'border-navy bg-navy text-white'
              : 'border-navy-200 bg-white text-navy-300 hover:border-navy-300'
          )}
        >
          All members ({list.length})
        </button>
        <button
          onClick={() => setOnlyAttention(true)}
          className={cn(
            'rounded-full border px-3 py-1 text-[11px] font-semibold transition',
            onlyAttention
              ? 'border-amber-400 bg-amber-50 text-amber-800'
              : 'border-amber-200 bg-white text-amber-700 hover:border-amber-300'
          )}
        >
          Needs attention ({attention.length})
        </button>
      </div>

      {pending.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {pending.length} membership{pending.length === 1 ? '' : 's'} waiting on payment verification
          — the customer is watching their portal.
        </div>
      )}
      {expiringSoon.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-navy-100 bg-linen-50 p-3 text-xs text-navy-300">
          <RefreshCcw className="h-4 w-4 shrink-0 text-gold-600" />
          {expiringSoon.length} renewal{expiringSoon.length === 1 ? '' : 's'} landing in the next 4 days
          {list.some((m) => m.paymentMethod === 'BANK_TRANSFER') && ' (transfer members renew manually)'}.
        </div>
      )}

      <div className="space-y-3">
        {shown.map((m) => (
          <Card key={m.id} className="shadow-navy">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Phase 75: the row opens the drill-down — the member's
                        whole life in one click. */}
                    <button
                      onClick={() => setDrillId(m.id)}
                      className="font-medium text-navy underline-offset-2 transition hover:text-gold-700 hover:underline"
                    >
                      {m.user?.name ?? 'Member'}
                    </button>
                    <MemberStatusBadge m={m} />
                    {m.cancelAtPeriodEnd && (
                      <Badge variant="outline" className="rounded-full border-amber-200 text-[10px] text-amber-700">
                        not renewing
                      </Badge>
                    )}
                    {m.health && m.health.state !== 'INACTIVE' && m.health.state !== 'OK' && m.status !== 'PENDING_ACTIVATION' && (
                      <HealthChip state={m.health.state} label={m.health.label} />
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-navy-300">
                    {m.user?.email} · {m.user?.phone}
                  </p>
                  <p className="mt-1 text-xs text-navy-300">
                    {m.plan?.name ?? 'Plan'} · {formatNaira(m.pricePaid || m.plan?.priceMonthly || 0)} ·{' '}
                    {m.paymentMethod === 'PAYSTACK' ? 'card' : m.paymentMethod === 'BANK_TRANSFER' ? 'transfer' : 'unpaid'}
                    {m.periodEnd && ` · ${m.status === 'PENDING_ACTIVATION' ? 'starts on activation' : `renews ${formatDate(m.periodEnd)}`}`}
                  </p>
                  {/* Phase 75: the wash-floor line — last/next pickup at a glance. */}
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-navy-300">
                    {m.lastPickupAt && (
                      <span className="flex items-center gap-1">
                        <ClipboardList className="h-3 w-3 text-gold-600" /> Last pickup {formatDate(m.lastPickupAt)}
                      </span>
                    )}
                    {m.nextPickupAt && (
                      <span className="flex items-center gap-1">
                        <CalendarClock className="h-3 w-3 text-gold-600" /> Next{' '}
                        {formatDate(m.nextPickupAt)}
                        {m.nextPickupSlot ? ` · ${m.nextPickupSlot}` : ''}
                      </span>
                    )}
                    {m.kitTag && (
                      <span className="flex items-center gap-1 font-mono">
                        <QrCode className="h-3 w-3 text-gold-600" /> {m.kitTag}
                      </span>
                    )}
                  </p>
                </div>

                {/* Usage */}
                {m.usage && m.plan && (
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <UsageChip icon={Package} used={m.usage.unitsUsed} total={m.plan.includedUnits} label={m.plan.unitKind} />
                    {m.plan.shoesPerMonth > 0 && (
                      <UsageChip icon={Footprints} used={m.usage.shoesUsed} total={m.plan.shoesPerMonth} label="shoes/mo" />
                    )}
                    {m.plan.duvetsPerQuarter > 0 && (
                      <UsageChip icon={BedDouble} used={m.usage.duvetsUsed} total={m.plan.duvetsPerQuarter} label="duvets/q" />
                    )}
                    {m.plan.curtainsPerQuarter > 0 && (
                      <UsageChip icon={Layers} used={m.usage.curtainsUsed} total={m.plan.curtainsPerQuarter} label="curtains/q" />
                    )}
                    {m.plan.springCleanPerYear > 0 && (
                      <UsageChip icon={Sun} used={m.usage.springCleanUsed} total={m.plan.springCleanPerYear} label="spring/yr" />
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-3 flex flex-wrap gap-2">
                {m.status === 'PENDING_ACTIVATION' && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => run(m, 'verify')}
                      disabled={action.isPending}
                      className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      <BadgeCheck className="mr-1.5 h-3.5 w-3.5" /> Verify &amp; activate
                    </Button>
                    {m.transferReceipt && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setReceipt(m)}
                        className="rounded-full border-navy-200 text-navy"
                      >
                        <Receipt className="mr-1.5 h-3.5 w-3.5" /> View receipt
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => run(m, 'reject')}
                      disabled={action.isPending}
                      className="rounded-full text-rose-500 hover:bg-rose-50"
                    >
                      Reject receipt
                    </Button>
                  </>
                )}
                {m.status !== 'PENDING_ACTIVATION' && m.status !== 'CANCELLED' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setRenewFor(m)
                        setRenewPrice(String(m.plan?.priceMonthly ?? m.pricePaid ?? ''))
                      }}
                      className="rounded-full border-navy-200 text-navy hover:bg-navy hover:text-white"
                    >
                      <RefreshCcw className="mr-1.5 h-3.5 w-3.5" /> Record renewal
                    </Button>
                    {/* Phase 75: the retention desk — one click per nudge. */}
                    {m.health && (m.health.state === 'UNUSED_RISK' || m.health.state === 'NO_USAGE_DATA') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => run(m, 'nudge-usage')}
                        disabled={action.isPending}
                        className="rounded-full border-gold-300 text-gold-800 hover:bg-gold-50"
                      >
                        <Send className="mr-1.5 h-3.5 w-3.5" /> Nudge: use it or lose it
                      </Button>
                    )}
                    {m.paymentMethod === 'BANK_TRANSFER' && m.periodEnd && new Date(m.periodEnd).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => run(m, 'nudge-renewal')}
                        disabled={action.isPending}
                        className="rounded-full border-navy-200 text-navy hover:bg-navy hover:text-white"
                      >
                        <Send className="mr-1.5 h-3.5 w-3.5" /> Remind: renewal
                      </Button>
                    )}
                    {m.status !== 'LAPSED' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => run(m, 'cancel')}
                        disabled={action.isPending}
                        className="rounded-full text-rose-500 hover:bg-rose-50"
                      >
                        <Ban className="mr-1.5 h-3.5 w-3.5" /> Cancel now
                      </Button>
                    )}
                    {m.status === 'LAPSED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => run(m, 'renew')}
                        className="rounded-full border-navy-200 text-navy"
                      >
                        <Undo2 className="mr-1.5 h-3.5 w-3.5" /> Reactivate
                      </Button>
                    )}
                  </>
                )}
                {/* Kit lifecycle */}
                {m.kitState === 'PENDING_DELIVERY' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => run(m, 'kit-delivered')}
                    className="rounded-full text-navy-300 hover:text-navy"
                  >
                    <Package className="mr-1.5 h-3.5 w-3.5" /> Mark kit delivered
                  </Button>
                )}
                {m.kitState === 'WITH_MEMBER' && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => run(m, 'kit-returned')}
                      className="rounded-full text-emerald-600 hover:bg-emerald-50"
                    >
                      <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Kit returned
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => run(m, 'kit-replaced')}
                      className="rounded-full text-navy-300 hover:text-navy"
                    >
                      Charge replacement ({formatNaira(m.plan?.replacementFee ?? 0)})
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => run(m, 'reset-usage')}
                  className="rounded-full text-navy-300 hover:text-navy"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset usage
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ===== Phase 75: the member drill-down — ledger, kit tag, adjustments ===== */}
      <MemberDrilldown
        id={drillId}
        onClose={() => setDrillId(null)}
        onAction={(act, extra) => {
          if (!drillId) return
          const m = list.find((x) => x.id === drillId)
          if (m) run(m, act, extra)
        }}
      />

      {/* Receipt viewer */}
      <Dialog open={Boolean(receipt)} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg text-navy">
              Transfer receipt — {receipt?.user?.name}
            </DialogTitle>
          </DialogHeader>
          {receipt?.transferReceipt ? (
            <img
              src={receipt.transferReceipt}
              alt="Transfer receipt"
              className="max-h-[70vh] w-full rounded-xl border border-navy-100 object-contain"
            />
          ) : (
            <div className="flex items-center gap-2 rounded-xl bg-linen-100 p-4 text-sm text-navy-300">
              <ImageIcon className="h-4 w-4" /> No receipt attached.
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Renewal price dialog */}
      <Dialog open={Boolean(renewFor)} onOpenChange={(o) => !o && setRenewFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg text-navy">
              Record renewal — {renewFor?.user?.name}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-navy-300">
            Extends the membership by one month from the current period end. Adjust the amount for
            goodwill pricing if needed.
          </p>
          <div className="mt-3">
            <label className="text-xs font-medium text-navy">Amount paid (₦)</label>
            <input
              type="number"
              min={0}
              value={renewPrice}
              onChange={(e) => setRenewPrice(e.target.value)}
              className={cn(field, 'mt-1.5')}
            />
            {Number(renewPrice) > 0 && (
              <p className="mt-1 text-[10px] text-navy-300">{formatNaira(Number(renewPrice) || 0)}</p>
            )}
          </div>
          <Button
            onClick={async () => {
              if (!renewFor) return
              await run(renewFor, 'renew', { pricePaid: Number(renewPrice) || undefined })
              setRenewFor(null)
            }}
            disabled={action.isPending}
            className="mt-4 w-full rounded-full bg-gold-gradient font-semibold text-navy hover:opacity-90"
          >
            {action.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Extend the month'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// =====================================================
// Phase 75: the drill-down — one member's whole life
// =====================================================
function MemberDrilldown({
  id,
  onClose,
  onAction,
}: {
  id: string | null
  onClose: () => void
  onAction: (action: string, extra?: Record<string, unknown>) => void
}) {
  const { data, isLoading } = useMembershipDrilldown(id)
  const action = useMembershipAdminAction()
  const [kitTagData, setKitTagData] = useState<{ code: string; url: string; qrSvg: string } | null>(null)
  const [minting, setMinting] = useState(false)
  const [adjustCounter, setAdjustCounter] = useState('unitsUsed')
  const [adjustDelta, setAdjustDelta] = useState('1')
  const [adjustNote, setAdjustNote] = useState('')

  // Load (or re-mint) the kit tag + QR whenever the dialog opens.
  useEffect(() => {
    if (!id) {
      setKitTagData(null)
      return
    }
    let cancelled = false
    setMinting(true)
    fetch(`/api/subscriptions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'kit-tag' }),
    })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body?.error ?? 'Could not mint the tag')
        return body
      })
      .then((body) => {
        if (!cancelled) setKitTagData(body)
      })
      .catch(() => {
        if (!cancelled) setKitTagData(null)
      })
      .finally(() => {
        if (!cancelled) setMinting(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const activity = data?.activity?.activity ?? []
  const events = data?.activity?.events ?? []
  const m = data?.membership

  const runAdjust = async () => {
    if (!id || !adjustNote.trim()) {
      toast({ title: 'A note is required', description: 'The ledger records WHY the counter moved.', variant: 'destructive' })
      return
    }
    try {
      await action.mutateAsync({
        id,
        action: 'adjust-usage',
        counter: adjustCounter,
        delta: Number(adjustDelta) || 0,
        note: adjustNote.trim(),
      })
      setAdjustNote('')
      toast({ title: 'Counter adjusted', description: 'The ledger row is written with your note.' })
    } catch (e: any) {
      toast({ title: 'Could not adjust', description: e?.message, variant: 'destructive' })
    }
  }

  return (
    <Dialog open={Boolean(id)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg text-navy">
            {data?.user?.name ?? 'Member'} — the member ledger
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-navy-300" />
          </div>
        )}

        {m && (
          <div className="space-y-4">
            {/* Contact + cycle */}
            <div className="rounded-xl bg-linen-100 p-3.5 text-xs text-navy-300">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {data?.user?.phone && (
                  <a href={`tel:${data.user.phone.replace(/\s/g, '')}`} className="flex items-center gap-1 font-medium text-navy">
                    <Phone className="h-3.5 w-3.5 text-gold-600" /> {data.user.phone}
                  </a>
                )}
                {data?.user?.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5 text-gold-600" /> {data.user.email}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5 text-gold-600" />
                  {m.periodEnd ? `Cycle to ${formatDate(m.periodEnd)}` : 'Not activated'}
                </span>
              </div>
              <p className="mt-1.5">
                {m.plan?.name} · {m.usage ? `${m.usage.unitsUsed}/${m.plan?.includedUnits ?? 0} ${m.plan?.unitKind ?? 'units'}` : 'no usage'}{' '}
                {m.usage && m.usage.shoesUsed > 0 && ` · shoes ${m.usage.shoesUsed}/${m.plan?.shoesPerMonth ?? 0}`}
              </p>
            </div>

            {/* The kit tag — QR + printable label */}
            <div className="rounded-xl border border-navy-100 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-navy-300">
                <QrCode className="h-4 w-4 text-gold-600" /> Bag / box tag
              </p>
              {minting && !kitTagData ? (
                <div className="flex items-center gap-2 py-3 text-xs text-navy-300">
                  <Loader2 className="h-4 w-4 animate-spin" /> Minting the tag…
                </div>
              ) : kitTagData ? (
                <div className="mt-3 flex flex-wrap items-start gap-4">
                  {/* The label preview — also the print target */}
                  <div id="kit-label" className="w-44 rounded-lg border-2 border-navy bg-white p-3 text-center">
                    <p className="font-serif text-sm font-bold text-navy">Kozy Care</p>
                    <p className="text-[9px] uppercase tracking-wide text-navy-300">
                      {m.plan?.unitName ?? 'Kozy Bag'} · {m.plan?.name}
                    </p>
                    {kitTagData.qrSvg && <div className="mt-2" dangerouslySetInnerHTML={{ __html: kitTagData.qrSvg }} />}
                    <p className="mt-1 font-mono text-[11px] font-bold tracking-wider text-navy">{kitTagData.code}</p>
                    <p className="mt-0.5 truncate text-[9px] text-navy-300">{data?.user?.name}</p>
                    <p className="text-[8px] text-navy-300">Scan: {kitTagData.url.replace('https://', '')}</p>
                  </div>
                  <div className="min-w-0 flex-1 space-y-2 text-xs text-navy-300">
                    <p>
                      Print this label and stick it on the member&apos;s {m.plan?.unitName?.toLowerCase() ?? 'bag'}.
                      Scanning it opens whose bag this is, the plan and the cycle usage — on any phone.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="rounded-full border-navy-200 text-navy" onClick={() => window.print()}>
                        <Printer className="mr-1.5 h-3.5 w-3.5" /> Print label
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-full text-navy-300 hover:text-navy"
                        onClick={async () => {
                          if (!id) return
                          setMinting(true)
                          try {
                            const r = await fetch(`/api/subscriptions/${id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ action: 'kit-tag', reMint: true }),
                            })
                            const body = await r.json()
                            if (!r.ok) throw new Error(body?.error ?? 'Could not re-mint')
                            setKitTagData(body)
                            toast({ title: 'New tag minted', description: 'The old code no longer opens anything — print the new label.' })
                          } catch (e: any) {
                            toast({ title: 'Could not re-mint', description: e?.message, variant: 'destructive' })
                          } finally {
                            setMinting(false)
                          }
                        }}
                      >
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> New code (worn label)
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-navy-300">No tag yet — mint one when the kit goes out.</p>
              )}
            </div>

            {/* This cycle's bookings */}
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-navy-300">
                <ClipboardList className="h-4 w-4 text-gold-600" /> This cycle&apos;s bookings
              </p>
              {activity.length === 0 ? (
                <p className="mt-2 rounded-xl border border-dashed border-navy-200 p-4 text-center text-xs text-navy-300">
                  No bookings since the cycle started {m.periodStart ? formatDate(m.periodStart) : ''}.
                </p>
              ) : (
                <div className="mt-2 divide-y divide-linen-100 rounded-xl border border-navy-100">
                  {activity.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-navy">{a.label}</p>
                        <p className="text-[11px] text-navy-300">
                          #{a.orderNumber} · pickup {formatDate(a.pickupDate)} · {a.status.toLowerCase().replace(/_/g, ' ')}
                          {a.pickedUpAt && ` · collected ${formatDate(a.pickedUpAt)}`}
                        </p>
                      </div>
                      {a.missed && (
                        <Badge variant="outline" className="rounded-full border-rose-200 bg-rose-50 text-[10px] text-rose-700">
                          missed
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* The raw ledger */}
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-navy-300">
                <Receipt className="h-4 w-4 text-gold-600" /> Ledger (why the counters moved)
              </p>
              {events.length === 0 ? (
                <p className="mt-2 text-xs text-navy-300">No ledger rows yet — history starts with the next booking or renewal.</p>
              ) : (
                <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-xl bg-linen-100 p-3 font-mono text-[11px] leading-relaxed text-navy">
                  {events.map((e) => (
                    <p key={e.id} className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-navy-300">{new Date(e.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}</span>
                      <span className={cn('font-bold', e.delta < 0 ? 'text-emerald-700' : e.delta > 0 ? 'text-gold-800' : 'text-navy')}>
                        {e.kind}
                        {e.delta !== 0 && ` ${e.delta > 0 ? '+' : ''}${e.delta}`}
                      </span>
                      {e.note && <span className="text-navy-300">{e.note}</span>}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* Manual adjustment */}
            <div className="rounded-xl border border-navy-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy-300">Adjust a counter</p>
              <p className="mt-1 text-[11px] text-navy-300">
                For goodwill corrections — the movement lands in the ledger with your note.
              </p>
              <div className="mt-2.5 flex flex-wrap items-end gap-2">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-navy-300">Counter</label>
                  <select
                    value={adjustCounter}
                    onChange={(e) => setAdjustCounter(e.target.value)}
                    className={cn(field, 'mt-1 h-9 w-36')}
                  >
                    <option value="unitsUsed">Bag/box pickups</option>
                    <option value="shoesUsed">Shoe pairs</option>
                    <option value="duvetsUsed">Duvets</option>
                    <option value="curtainsUsed">Curtains</option>
                    <option value="springCleanUsed">Spring cleans</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-navy-300">Change</label>
                  <div className="mt-1 flex items-center gap-1">
                    <button
                      onClick={() => setAdjustDelta(String(Math.max(1, (Number(adjustDelta) || 0) * -1)))}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-navy-200 text-navy transition hover:bg-linen-100"
                      title="Flip direction"
                    >
                      {Number(adjustDelta) < 0 ? <MinusCircle className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
                    </button>
                    <input
                      type="number"
                      value={adjustDelta}
                      onChange={(e) => setAdjustDelta(e.target.value)}
                      className={cn(field, 'w-20')}
                    />
                  </div>
                </div>
                <div className="min-w-40 flex-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-navy-300">Note (required)</label>
                  <input
                    value={adjustNote}
                    onChange={(e) => setAdjustNote(e.target.value)}
                    placeholder="e.g. counted the bag twice by mistake"
                    className={cn(field, 'mt-1')}
                  />
                </div>
                <Button
                  size="sm"
                  onClick={runAdjust}
                  disabled={action.isPending || !adjustNote.trim()}
                  className="rounded-full bg-navy text-white hover:bg-navy-700"
                >
                  Apply
                </Button>
              </div>
            </div>

            {/* Retention nudges */}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAction('nudge-usage')}
                className="rounded-full border-gold-300 text-gold-800 hover:bg-gold-50"
              >
                <Send className="mr-1.5 h-3.5 w-3.5" /> Send usage nudge
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAction('nudge-renewal')}
                className="rounded-full border-navy-200 text-navy hover:bg-navy hover:text-white"
              >
                <Send className="mr-1.5 h-3.5 w-3.5" /> Send renewal reminder
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// =====================================================
// Phase 75: roster + stat chips
// =====================================================
function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any
  label: string
  value: number
  tone: 'navy' | 'amber' | 'gold'
}) {
  return (
    <Card className={cn('shadow-navy', tone === 'amber' && 'border-amber-200', tone === 'gold' && 'border-gold-200')}>
      <CardContent className="flex items-center gap-3 p-3.5">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
            tone === 'amber' ? 'bg-amber-100 text-amber-700' : tone === 'gold' ? 'bg-gold-100 text-gold-800' : 'bg-linen-200 text-navy-300'
          )}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-navy-300">{label}</p>
          <p className="font-serif text-xl font-bold text-navy">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function HealthChip({ state, label }: { state: string; label: string }) {
  const tone: Record<string, string> = {
    MISSED_PICKUP: 'border-rose-200 bg-rose-50 text-rose-700',
    UNUSED_RISK: 'border-amber-200 bg-amber-50 text-amber-700',
    NO_USAGE_DATA: 'border-amber-200 bg-amber-50 text-amber-700',
    OVER_QUOTA: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  }
  const short: Record<string, string> = {
    MISSED_PICKUP: 'missed pickup',
    UNUSED_RISK: 'barely used',
    NO_USAGE_DATA: 'not booked',
    OVER_QUOTA: 'quota full',
  }
  return (
    <Badge
      variant="outline"
      className={`rounded-full text-[10px] ${tone[state] ?? 'border-navy-100 bg-linen-50 text-navy-300'}`}
      title={label}
    >
      <HeartPulse className="mr-1 h-3 w-3" />
      {short[state] ?? 'watch'}
    </Badge>
  )
}

function MemberStatusBadge({ m }: { m: ApiMembership }) {
  const status = m.effectiveStatus ?? m.status
  const tone: Record<string, string> = {
    ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    EXPIRING: 'border-amber-200 bg-amber-50 text-amber-700',
    PAST_DUE: 'border-amber-200 bg-amber-50 text-amber-700',
    PENDING_ACTIVATION: 'border-gold-300 bg-gold-50 text-navy',
    LAPSED: 'border-navy-200 bg-navy-50 text-navy-300',
    CANCELLED: 'border-navy-200 bg-navy-50 text-navy-300',
  }
  const label: Record<string, string> = {
    ACTIVE: 'active',
    EXPIRING: 'ending soon',
    PAST_DUE: 'renewal pending',
    PENDING_ACTIVATION: 'awaiting payment',
    LAPSED: 'lapsed',
    CANCELLED: 'cancelled',
  }
  return (
    <Badge variant="outline" className={`rounded-full text-[10px] ${tone[status] ?? tone.ACTIVE}`}>
      {label[status] ?? status.toLowerCase()}
    </Badge>
  )
}

function UsageChip({
  icon: Icon,
  used,
  total,
  label,
}: {
  icon: any
  used: number
  total: number
  label: string
}) {
  const full = used >= total
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono',
        full ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-navy-100 bg-white text-navy-300'
      )}
    >
      <Icon className="h-3 w-3" /> {used}/{total} {label}
    </span>
  )
}
