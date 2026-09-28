'use client'

// =============================================================================
// PartnersView — ADMIN: the Kozy Network desk (phase 62 → phase 72)
// =============================================================================
// Applications (the queue from /partners) and the approved network roster
// with branch assignment, revenue share and the derived monthly ledger
// (delivered orders tagged to each partner).
//
// Phase 72 — the pipeline is now rider-parity end to end: approval CREATES
// the partner's portal login (emailed credentials, exactly like riders),
// suspension PAUSES that login, and each partner card carries the money
// side — share earned, settled, pending — with a Settle action that records
// what the office actually paid and emails the partner a receipt.
// =============================================================================

import { useState } from 'react'
import {
  Handshake,
  Loader2,
  Check,
  X,
  Pause,
  Play,
  MapPin,
  Phone,
  Mail,
  Store,
  TrendingUp,
  CircleDollarSign,
  Users,
  Banknote,
  Landmark,
  KeyRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'
import { formatNaira } from '@/lib/types'
import { usePartners, usePartnerDecision, useBranches, useRecordPartnerSettlement } from '@/lib/hooks'
import { cn } from '@/lib/utils'

const field =
  'h-9 w-full rounded-lg border border-navy-200 bg-white px-3 text-sm text-navy focus:border-gold-400 focus:outline-none'

export function PartnersView() {
  const [tab, setTab] = useState<'applications' | 'network'>('applications')

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-navy">
          The Kozy Network
        </h1>
        <p className="mt-1 text-sm text-navy-300">
          Independent laundries running under the Kozy brand — their capacity, our demand and
          technology, a shared ledger. Approvals create their portal login; settlements record
          the money the office pays out.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'applications' | 'network')}>
        <TabsList className="bg-linen-200">
          <TabsTrigger value="applications" className="data-[state=active]:bg-navy data-[state=active]:text-white text-navy-300">
            <Users className="mr-1.5 h-3.5 w-3.5" /> Applications
          </TabsTrigger>
          <TabsTrigger value="network" className="data-[state=active]:bg-navy data-[state=active]:text-white text-navy-300">
            <Store className="mr-1.5 h-3.5 w-3.5" /> Network, ledger &amp; settlements
          </TabsTrigger>
        </TabsList>
        <TabsContent value="applications" className="mt-4">
          <ApplicationsQueue />
        </TabsContent>
        <TabsContent value="network" className="mt-4">
          <NetworkRoster />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// =====================================================
// APPLICATIONS QUEUE
// =====================================================
function ApplicationsQueue() {
  const { data, isLoading } = usePartners()
  const decision = usePartnerDecision()
  const { data: branches } = useBranches()

  // Approve needs branch + share — a small inline panel per application.
  const [approveFor, setApproveFor] = useState<string | null>(null)
  const [branchId, setBranchId] = useState('')
  const [share, setShare] = useState('70')
  const [note, setNote] = useState('')
  const [email, setEmail] = useState('')

  const pending = (data?.partners ?? []).filter((p) => p.status === 'PENDING')

  const run = async (id: string, action: string, extra?: Record<string, unknown>) => {
    try {
      const res: any = await decision.mutateAsync({ id, action: action as any, ...extra })
      if (action === 'approve') {
        // Phase 72: the response now tells the admin about the login that
        // was created and whether the credentials email landed.
        toast({
          title: 'Partner approved — portal login created',
          description:
            res?.welcome?.ok
              ? `Credentials emailed to ${res?.account?.email ?? 'the partner'}. They sign in at /partner and set their own password.`
              : (res?.hint ??
                'The account exists but the welcome email could not be sent — fix the address and approve again.'),
        })
      } else {
        toast({ title: 'Done' })
      }
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

  if (pending.length === 0) {
    return (
      <Card className="border-dashed border-navy-200">
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <Handshake className="h-8 w-8 text-navy-200" />
          <p className="font-medium text-navy">No applications waiting</p>
          <p className="max-w-sm text-sm text-navy-300">
            Operators apply from the /partners page (quietly linked in the footer). Every
            application lands here with an email alert — and now a confirmation email + SMS to
            the operator, with a KZP reference.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {pending.map((p) => (
        <Card key={p.id} className="shadow-navy">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-serif text-lg font-semibold text-navy">{p.businessName}</p>
                  {p.refCode && (
                    <Badge variant="outline" className="rounded-full border-navy-200 bg-linen-50 font-mono text-[10px] text-navy-300">
                      {p.refCode}
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-navy-300">
                  {p.contactName} · <a className="hover:underline" href={`tel:${p.phone}`}>{p.phone}</a> ·{' '}
                  <a className="hover:underline" href={`mailto:${p.email}`}>{p.email}</a>
                </p>
                <p className="mt-1 flex items-center gap-1 text-xs text-navy-300">
                  <MapPin className="h-3.5 w-3.5 text-gold-600" /> {p.address}
                  {p.lga ? ` · ${p.lga}` : ''}
                </p>
                {p.servicesOffered && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.servicesOffered.split(',').map((s) => (
                      <span key={s} className="rounded-full bg-gold-50 px-2.5 py-0.5 text-[10px] font-medium text-navy ring-1 ring-gold-200">
                        {s.trim()}
                      </span>
                    ))}
                  </div>
                )}
                {p.capacityNotes && (
                  <p className="mt-2 max-w-2xl rounded-lg bg-linen-100 p-3 text-xs leading-relaxed text-navy-300">
                    {p.capacityNotes}
                  </p>
                )}
              </div>
              <Badge variant="outline" className="rounded-full border-gold-300 bg-gold-50 text-[10px] text-navy">
                applied {new Date(p.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
              </Badge>
            </div>

            {approveFor === p.id ? (
              <div className="mt-4 rounded-xl border border-gold-200 bg-gold-50/40 p-4">
                <p className="text-xs font-semibold text-navy">Onboarding terms</p>
                <p className="mt-1 text-[11px] leading-relaxed text-navy-300">
                  Approving creates the partner&apos;s portal login (a system-generated password is
                  emailed — you never see one) with the terms below. They sign in at /partner, see
                  the orders you route to them, and track their own share ledger.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-navy-300">Home branch</label>
                    <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={cn(field, 'mt-1')}>
                      <option value="">No branch (partner hub)</option>
                      {(branches ?? []).map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-navy-300">Partner share (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={share}
                      onChange={(e) => setShare(e.target.value)}
                      className={cn(field, 'mt-1')}
                    />
                    <p className="mt-0.5 text-[10px] text-navy-300">Kozy keeps {100 - (Number(share) || 0)}%</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-navy-300">Sign-in email</label>
                    <input
                      type="email"
                      value={email || p.email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={cn(field, 'mt-1')}
                    />
                    <p className="mt-0.5 text-[10px] text-navy-300">The welcome email goes here</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-navy-300">Note (optional)</label>
                    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Agreed on call…" className={cn(field, 'mt-1')} />
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      run(p.id, 'approve', {
                        branchId: branchId || null,
                        revenueSharePartnerPct: Number(share) || 70,
                        note: note || undefined,
                        email: (email || p.email).trim() || undefined,
                      })
                    }
                    disabled={decision.isPending}
                    className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <Check className="mr-1.5 h-3.5 w-3.5" /> Approve, create login &amp; welcome
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setApproveFor(null)} className="rounded-full text-navy-300">
                    Back
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setApproveFor(p.id)
                    setBranchId('')
                    setShare('70')
                    setNote('')
                    setEmail(p.email)
                  }}
                  className="rounded-full bg-gold-gradient font-semibold text-navy hover:opacity-90"
                >
                  <Check className="mr-1.5 h-3.5 w-3.5" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => run(p.id, 'reject')}
                  disabled={decision.isPending}
                  className="rounded-full text-rose-500 hover:bg-rose-50"
                >
                  <X className="mr-1.5 h-3.5 w-3.5" /> Decline
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// =====================================================
// NETWORK ROSTER + LEDGER + SETTLEMENTS
// =====================================================
function NetworkRoster() {
  const { data, isLoading } = usePartners()
  const { data: branches } = useBranches()
  const decision = usePartnerDecision()
  const settlementMutation = useRecordPartnerSettlement()
  const [editing, setEditing] = useState<string | null>(null)
  const [editShare, setEditShare] = useState('')
  const [editBranch, setEditBranch] = useState('')

  // ----- Settlement desk state (phase 72) -----
  const [settleFor, setSettleFor] = useState<string | null>(null)
  const [settleAmount, setSettleAmount] = useState('')
  const [settleMethod, setSettleMethod] = useState<'BANK_TRANSFER' | 'CASH'>('BANK_TRANSFER')
  const [settleReference, setSettleReference] = useState('')
  const [settleNote, setSettleNote] = useState('')

  const partners = data?.partners ?? []
  const ledger = data?.ledger ?? []
  const approved = partners.filter((p) => p.status === 'APPROVED' || p.status === 'SUSPENDED')
  const branchName = (id: string | null) =>
    id ? (branches ?? []).find((b) => b.id === id)?.name ?? '—' : 'Partner hub'

  const run = async (id: string, action: string, extra?: Record<string, unknown>) => {
    try {
      await decision.mutateAsync({ id, action: action as any, ...extra })
      toast({
        title: 'Done',
        description:
          action === 'suspend'
            ? 'Order routing and the partner login are paused; the ledger is untouched.'
            : action === 'reactivate'
              ? 'The partner login is active again.'
              : undefined,
      })
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

  if (approved.length === 0) {
    return (
      <Card className="border-dashed border-navy-200">
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <Store className="h-8 w-8 text-navy-200" />
          <p className="font-medium text-navy">The network is empty — for now</p>
          <p className="max-w-sm text-sm text-navy-300">
            Approve an application and the operator appears here with their portal login, branch,
            revenue share and a live ledger fed by the orders you tag to them.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {approved.map((p) => {
        const row = ledger.find((l) => l.partnerId === p.id)
        return (
          <Card key={p.id} className={cn('shadow-navy', p.status === 'SUSPENDED' && 'opacity-70')}>
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-serif text-lg font-semibold text-navy">{p.businessName}</p>
                    <Badge variant="outline" className={`rounded-full text-[10px] ${p.status === 'APPROVED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                      {p.status === 'APPROVED' ? 'active' : 'suspended'}
                    </Badge>
                    {p.account && (
                      <Badge variant="outline" className="rounded-full border-navy-200 bg-white text-[10px] text-navy-300">
                        <KeyRound className="mr-1 h-2.5 w-2.5" />
                        login {p.account.accessStatus === 'ACTIVE' ? 'active' : 'paused'} · {p.account.email}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-navy-300">
                    {p.contactName} · <a className="hover:underline" href={`tel:${p.phone}`}>{p.phone}</a> ·{' '}
                    <a className="hover:underline" href={`mailto:${p.email}`}>{p.email}</a>
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-navy-300">
                    <MapPin className="h-3.5 w-3.5 text-gold-600" /> {p.address} · hub:{' '}
                    <strong className="text-navy">{branchName(p.branchId)}</strong>
                  </p>
                  {p.reviewNote && <p className="mt-1 text-[11px] italic text-navy-300">“{p.reviewNote}”</p>}
                </div>

                {/* Ledger */}
                {row && (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-xl bg-navy-50 px-4 py-3 text-right sm:grid-cols-4">
                    <LedgerStat label="Orders (mo)" value={String(row.ordersThisMonth)} />
                    <LedgerStat label="Revenue (mo)" value={formatNaira(row.revenueThisMonth)} money />
                    <LedgerStat label="Partner share" value={formatNaira(row.partnerShareThisMonth)} money highlight />
                    <LedgerStat label="Kozy share" value={formatNaira(row.kozyShareThisMonth)} money />
                  </div>
                )}
              </div>

              {/* ----- Settlement money side (phase 72) ----- */}
              {row && (
                <div className="mt-3 rounded-xl border border-navy-100 bg-linen-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-navy-300">
                      <Banknote className="h-3 w-3" /> Settlements — share earned {formatNaira(row.shareEarned)} · paid{' '}
                      {formatNaira(row.settledTotal)} ·{' '}
                      <span className={cn('font-bold', row.pendingSettlement > 0 ? 'text-gold-700' : 'text-emerald-700')}>
                        pending {formatNaira(Math.max(row.pendingSettlement, 0))}
                      </span>
                    </p>
                    <button
                      onClick={() => {
                        setSettleFor(settleFor === p.id ? null : p.id)
                        setSettleAmount(row.pendingSettlement > 0 ? String(row.pendingSettlement) : '')
                        setSettleMethod('BANK_TRANSFER')
                        setSettleReference('')
                        setSettleNote('')
                      }}
                      className="shrink-0 rounded-full bg-navy px-3.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-navy-400"
                    >
                      {settleFor === p.id ? 'Close' : 'Settle partner'}
                    </button>
                  </div>

                  {settleFor === p.id && (
                    <div className="mt-3 grid gap-3 rounded-lg border border-navy-100 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-navy-300">Amount (naira)</label>
                        <input
                          type="number"
                          min={1}
                          value={settleAmount}
                          onChange={(e) => setSettleAmount(e.target.value)}
                          className={cn(field, 'mt-1')}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-navy-300">Method</label>
                        <select
                          value={settleMethod}
                          onChange={(e) => setSettleMethod(e.target.value as 'BANK_TRANSFER' | 'CASH')}
                          className={cn(field, 'mt-1')}
                        >
                          <option value="BANK_TRANSFER">Bank transfer</option>
                          <option value="CASH">Cash</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-navy-300">Reference (optional)</label>
                        <input
                          value={settleReference}
                          onChange={(e) => setSettleReference(e.target.value)}
                          placeholder="Transfer ID"
                          className={cn(field, 'mt-1')}
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <Button
                          size="sm"
                          disabled={settlementMutation.isPending}
                          onClick={() => {
                            const amount = Math.round(Number(settleAmount))
                            if (!Number.isFinite(amount) || amount <= 0) {
                              toast({ title: 'Enter a whole amount', variant: 'destructive' })
                              return
                            }
                            if (amount > row.pendingSettlement + 1) {
                              const ok = window.confirm(
                                `This is more than the pending share (${formatNaira(row.pendingSettlement)}). Record it anyway?`
                              )
                              if (!ok) return
                            }
                            settlementMutation.mutate(
                              {
                                partnerId: p.id,
                                amount,
                                method: settleMethod,
                                reference: settleReference.trim() || undefined,
                                note: settleNote.trim() || undefined,
                              },
                              {
                                onSuccess: (d: any) => {
                                  toast({
                                    title: 'Settlement recorded',
                                    description: `${p.businessName} — ${formatNaira(amount)}. Pending share now ${formatNaira(Math.max(d?.balance?.pending ?? 0, 0))}. Receipt email queued.`,
                                  })
                                  setSettleFor(null)
                                },
                                onError: (e: Error) => {
                                  toast({ title: 'Could not record', description: e.message, variant: 'destructive' })
                                },
                              }
                            )
                          }}
                          className="rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
                        >
                          {settlementMutation.isPending ? 'Recording…' : 'Record settlement'}
                        </Button>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-4">
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-navy-300">Note (optional — visible to the partner)</label>
                        <input
                          value={settleNote}
                          onChange={(e) => setSettleNote(e.target.value)}
                          placeholder="e.g. October share"
                          className={cn(field, 'mt-1')}
                        />
                      </div>
                      {row.settlements.length > 0 && (
                        <div className="sm:col-span-2 lg:col-span-4">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-navy-300">Recent settlements</p>
                          <ul className="mt-1.5 divide-y divide-navy-50">
                            {row.settlements.slice(0, 5).map((s) => (
                              <li key={s.id} className="flex items-center justify-between gap-2 py-1.5 text-xs text-navy-300">
                                <span className="flex items-center gap-1.5">
                                  <Landmark className="h-3 w-3 text-emerald-600" />
                                  {s.method === 'CASH' ? 'Cash' : 'Bank transfer'}
                                  {s.reference ? ` · ${s.reference}` : ''}
                                  {s.note ? ` · ${s.note}` : ''}
                                </span>
                                <span className="font-semibold text-navy">
                                  {formatNaira(s.amount)} ·{' '}
                                  {new Date(s.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {editing === p.id ? (
                <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-gold-200 bg-gold-50/40 p-4">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-navy-300">Partner share (%)</label>
                    <input type="number" min={0} max={100} value={editShare} onChange={(e) => setEditShare(e.target.value)} className={cn(field, 'mt-1 w-28')} />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-navy-300">Home branch</label>
                    <select value={editBranch} onChange={(e) => setEditBranch(e.target.value)} className={cn(field, 'mt-1 w-44')}>
                      <option value="">No branch (partner hub)</option>
                      {(branches ?? []).map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    size="sm"
                    onClick={async () => {
                      await run(p.id, 'update', {
                        revenueSharePartnerPct: Number(editShare) || undefined,
                        branchId: editBranch || null,
                      })
                      setEditing(null)
                    }}
                    disabled={decision.isPending}
                    className="rounded-full bg-navy text-white hover:bg-navy-600"
                  >
                    Save terms
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)} className="rounded-full text-navy-300">
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(p.id)
                      setEditShare(String(p.revenueSharePartnerPct))
                      setEditBranch(p.branchId ?? '')
                    }}
                    className="rounded-full border-navy-200 text-navy hover:bg-navy hover:text-white"
                  >
                    <CircleDollarSign className="mr-1.5 h-3.5 w-3.5" /> Edit terms ({p.revenueSharePartnerPct}%)
                  </Button>
                  {p.status === 'APPROVED' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => run(p.id, 'suspend')}
                      disabled={decision.isPending}
                      className="rounded-full text-amber-700 hover:bg-amber-50"
                    >
                      <Pause className="mr-1.5 h-3.5 w-3.5" /> Suspend
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => run(p.id, 'reactivate')}
                      disabled={decision.isPending}
                      className="rounded-full text-emerald-600 hover:bg-emerald-50"
                    >
                      <Play className="mr-1.5 h-3.5 w-3.5" /> Reactivate
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}

      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-navy-300">
        <TrendingUp className="h-3.5 w-3.5 text-gold-600" />
        The ledger counts DELIVERED orders tagged to each partner in the order modal (&ldquo;Fulfillment&rdquo;) — revenue arrives, the split follows the share, and settlements track what the office has actually paid.
      </p>
    </div>
  )
}

function LedgerStat({
  label,
  value,
  money,
  highlight,
}: {
  label: string
  value: string
  money?: boolean
  highlight?: boolean
}) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-wide text-navy-300">{label}</p>
      <p className={cn('font-mono text-sm', highlight ? 'font-bold text-gold-700' : 'text-navy')}>{value}</p>
    </div>
  )
}
