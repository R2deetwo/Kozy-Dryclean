'use client'

// =============================================================================
// PartnersView — ADMIN: the Kozy Network desk (phase 62)
// =============================================================================
// Applications (the queue from /partners) and the approved network roster
// with branch assignment, revenue share and the derived monthly ledger
// (delivered orders tagged to each partner).
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'
import { formatNaira } from '@/lib/types'
import { usePartners, usePartnerDecision, useBranches } from '@/lib/hooks'
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
          technology, a shared ledger.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'applications' | 'network')}>
        <TabsList className="bg-linen-200">
          <TabsTrigger value="applications" className="data-[state=active]:bg-navy data-[state=active]:text-white text-navy-300">
            <Users className="mr-1.5 h-3.5 w-3.5" /> Applications
          </TabsTrigger>
          <TabsTrigger value="network" className="data-[state=active]:bg-navy data-[state=active]:text-white text-navy-300">
            <Store className="mr-1.5 h-3.5 w-3.5" /> Network &amp; ledger
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

  const pending = (data?.partners ?? []).filter((p) => p.status === 'PENDING')

  const run = async (id: string, action: string, extra?: Record<string, unknown>) => {
    try {
      await decision.mutateAsync({ id, action: action as any, ...extra })
      toast({ title: 'Done' })
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
            application lands here with an email alert.
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
                <p className="font-serif text-lg font-semibold text-navy">{p.businessName}</p>
                <p className="mt-0.5 text-xs text-navy-300">
                  {p.contactName} · <a className="hover:underline" href={`tel:${p.phone}`}>{p.phone}</a> ·{' '}
                  <a className="hover:underline" href={`mailto:${p.email}`}>{p.email}</a>
                </p>
                <p className="mt-1 flex items-center gap-1 text-xs text-navy-300">
                  <MapPin className="h-3.5 w-3.5 text-gold-600" /> {p.address}
                </p>
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
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
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
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-navy-300">Note (optional)</label>
                    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Agreed on call…" className={cn(field, 'mt-1')} />
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => run(p.id, 'approve', { branchId: branchId || null, revenueSharePartnerPct: Number(share) || 70, note: note || undefined })}
                    disabled={decision.isPending}
                    className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <Check className="mr-1.5 h-3.5 w-3.5" /> Approve &amp; welcome
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
// NETWORK ROSTER + LEDGER
// =====================================================
function NetworkRoster() {
  const { data, isLoading } = usePartners()
  const { data: branches } = useBranches()
  const decision = usePartnerDecision()
  const [editing, setEditing] = useState<string | null>(null)
  const [editShare, setEditShare] = useState('')
  const [editBranch, setEditBranch] = useState('')

  const partners = data?.partners ?? []
  const ledger = data?.ledger ?? []
  const approved = partners.filter((p) => p.status === 'APPROVED' || p.status === 'SUSPENDED')
  const branchName = (id: string | null) =>
    id ? (branches ?? []).find((b) => b.id === id)?.name ?? '—' : 'Partner hub'

  const run = async (id: string, action: string, extra?: Record<string, unknown>) => {
    try {
      await decision.mutateAsync({ id, action: action as any, ...extra })
      toast({ title: 'Done' })
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
            Approve an application and the operator appears here with their branch, revenue share
            and a live ledger fed by the orders you tag to them.
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
        The ledger counts DELIVERED orders tagged to each partner in the order modal (&ldquo;Fulfillment&rdquo;) — revenue arrives, the split follows the share.
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
