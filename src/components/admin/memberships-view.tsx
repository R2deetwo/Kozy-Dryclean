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

import { useMemo, useState } from 'react'
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

  const list = memberships ?? []
  const pending = list.filter((m) => m.status === 'PENDING_ACTIVATION')
  const expiringSoon = list.filter(
    (m) =>
      m.status === 'ACTIVE' &&
      m.periodEnd &&
      new Date(m.periodEnd).getTime() - Date.now() < 4 * 24 * 60 * 60 * 1000
  )

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
        {list.map((m) => (
          <Card key={m.id} className="shadow-navy">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-navy">{m.user?.name ?? 'Member'}</p>
                    <MemberStatusBadge m={m} />
                    {m.cancelAtPeriodEnd && (
                      <Badge variant="outline" className="rounded-full border-amber-200 text-[10px] text-amber-700">
                        not renewing
                      </Badge>
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
