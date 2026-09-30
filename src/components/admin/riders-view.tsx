'use client'

// =============================================================================
// RidersView (phase 54) — the rider onboarding pipeline + fleet roster
// =============================================================================
// The backstory: the owner commissioned riders offline and they started
// emailing staff inboxes directly — there was no system behind "apply as a
// rider". The public /join-riders form existed but applications landed in
// the database with no console to review them and no way to turn an
// approval into an actual rider account.
//
// What this tab does:
//   Applications — every /join-riders submission with its reference code,
//   contact details, bike, licence, availability and experience. Approve
//   (creates a DRIVER account + emails the rider their sign-in and
//   onboarding steps — the email delivery outcome is reported) or reject
//   (quiet, internal note, kept for the audit trail).
//   Rider roster  — the approved fleet: who is active, their area's last
//   GPS ping, open assignments and completed deliveries — the "how riders
//   affect the business" view the owner asked for.
//
// ADMIN-only tab; the API routes enforce that server-side regardless of
// what any client renders.
// =============================================================================

import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Bike,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  MapPin,
  Clock,
  Route as RouteIcon,
  Package,
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Building2,
  Loader2,
  Timer,
  Banknote,
  Landmark,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  useRiderApplications,
  useRiderDecision,
  useBranches,
  useRiderBranchAssign,
  useDriverStats,
  useRiderPayouts,
  useRecordRiderPayout,
  type ApiRiderApplication,
  type ApiRiderRosterEntry,
  type ApiRiderIncident,
} from '@/lib/hooks'
import { cn } from '@/lib/utils'

type AppStatus = ApiRiderApplication['status']

function StatusBadge({ status }: { status: AppStatus }) {
  if (status === 'APPROVED')
    return (
      <Badge className="gap-1 rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
        <BadgeCheck className="h-3 w-3" /> Approved
      </Badge>
    )
  if (status === 'REJECTED')
    return (
      <Badge className="gap-1 rounded-full bg-rose-100 text-rose-700 hover:bg-rose-100">
        <XCircle className="h-3 w-3" /> Declined
      </Badge>
    )
  return (
    <Badge className="gap-1 rounded-full bg-amber-100 text-amber-800 hover:bg-amber-100">
      <Clock className="h-3 w-3" /> Pending review
    </Badge>
  )
}

function fmtWhen(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtPing(iso: string | null): string {
  if (!iso) return 'never'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.floor(hours / 24)} d ago`
}

const naira = (n: number) =>
  `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`

export function RidersView() {
  const { data, isLoading, error } = useRiderApplications()
  const decisionMutation = useRiderDecision()
  const queryClient = useQueryClient()
  const payoutsQuery = useRiderPayouts({ refetchInterval: 60_000 })
  const payoutMutation = useRecordRiderPayout()

  // ----- Phase 72: the payout desk state -----
  const [payoutTarget, setPayoutTarget] = useState<ApiRiderRosterEntry | null>(null)
  const [payoutAmount, setPayoutAmount] = useState('')
  const [payoutMethod, setPayoutMethod] = useState<'BANK_TRANSFER' | 'CASH'>('BANK_TRANSFER')
  const [payoutReference, setPayoutReference] = useState('')
  const [payoutNote, setPayoutNote] = useState('')

  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [approveTarget, setApproveTarget] = useState<ApiRiderApplication | null>(null)
  const [approveEmail, setApproveEmail] = useState('')
  const [approveNote, setApproveNote] = useState('')
  const [rejectTarget, setRejectTarget] = useState<ApiRiderApplication | null>(null)
  const [rejectNote, setRejectNote] = useState('')

  const applications = data?.applications ?? []
  const roster = data?.roster ?? []
  const incidents = data?.incidents ?? []

  // ----- Incident resolution (phase 55) -----
  const [resolveTarget, setResolveTarget] = useState<ApiRiderIncident | null>(null)
  const [resolutionText, setResolutionText] = useState('')
  const [resolving, setResolving] = useState(false)

  const submitResolve = async () => {
    if (!resolveTarget) return
    const text = resolutionText.trim()
    if (text.length < 5) {
      toast({
        title: 'A little more detail, please',
        description: 'Record what was done for the customer and/or the rider (at least 5 characters).',
        variant: 'destructive',
      })
      return
    }
    setResolving(true)
    try {
      const res = await fetch(`/api/rider-incidents/${resolveTarget.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution: text }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || 'Could not record the resolution')
      setResolveTarget(null)
      setResolutionText('')
      toast({
        title: 'Incident resolved',
        description: 'The outcome is recorded on the incident ledger and the order timeline.',
      })
      await queryClient.invalidateQueries({ queryKey: ['rider-applications'] })
    } catch (e: any) {
      toast({ title: 'Could not record the resolution', description: e?.message, variant: 'destructive' })
    } finally {
      setResolving(false)
    }
  }

  const counts = useMemo(
    () => ({
      pending: applications.filter((a) => a.status === 'PENDING').length,
      approved: applications.filter((a) => a.status === 'APPROVED').length,
      rejected: applications.filter((a) => a.status === 'REJECTED').length,
    }),
    [applications]
  )

  const visible =
    filter === 'ALL' ? applications : applications.filter((a) => a.status === filter)

  const openApprove = (app: ApiRiderApplication) => {
    setApproveTarget(app)
    setApproveEmail(app.email ?? '')
    setApproveNote('')
  }

  const submitApprove = () => {
    if (!approveTarget) return
    decisionMutation.mutate(
      {
        id: approveTarget.id,
        action: 'approve',
        email: approveEmail.trim(),
        note: approveNote.trim() || undefined,
      },
      {
        onSuccess: (res) => {
          setApproveTarget(null)
          if (res.welcome?.ok) {
            toast({
              title: 'Rider approved — welcome email sent',
              description:
                res.hint ??
                `${approveTarget.fullName} now has a rider account; their sign-in details are on the way.`,
            })
          } else {
            toast({
              title: 'Rider approved — but the email FAILED',
              description:
                res.hint ??
                'The account exists but the password email did not land. Fix the address and approve again, or share the sign-in directly.',
              variant: 'destructive',
            })
          }
        },
        onError: (e: any) =>
          toast({
            title: 'Could not approve',
            description: e?.message,
            variant: 'destructive',
          }),
      }
    )
  }

  const submitReject = () => {
    if (!rejectTarget) return
    decisionMutation.mutate(
      { id: rejectTarget.id, action: 'reject', note: rejectNote.trim() || undefined },
      {
        onSuccess: () => {
          setRejectTarget(null)
          setRejectNote('')
          toast({
            title: 'Application declined',
            description: `${rejectTarget.fullName} is marked declined. No email was sent — reaching out is your call.`,
          })
        },
        onError: (e: any) =>
          toast({ title: 'Could not decline', description: e?.message, variant: 'destructive' }),
      }
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-navy">
          Riders
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-navy-300">
          The rider pipeline: applications from the Join-the-Team page arrive here
          with a reference code and an automatic confirmation. Approving creates
          their rider account and emails the sign-in plus onboarding steps;
          assigning pickups happens on the order board as usual.
        </p>
      </div>

      {/* ===== Applications ===== */}
      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-300">
            Applications
          </h2>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {(
              [
                ['PENDING', `Pending (${counts.pending})`],
                ['APPROVED', `Approved (${counts.approved})`],
                ['REJECTED', `Declined (${counts.rejected})`],
                ['ALL', `All (${applications.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  'rounded-full px-3 py-1 font-medium ring-1 transition',
                  filter === key
                    ? 'bg-navy text-white ring-navy'
                    : 'bg-white text-navy-300 ring-navy-100 hover:text-navy'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {isLoading && <p className="text-sm text-navy-300">Loading applications…</p>}
        {error && (
          <div className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200">
            {error.message}
          </div>
        )}
        {!isLoading && !error && visible.length === 0 && (
          <div className="rounded-xl border border-dashed border-navy-100 bg-white p-8 text-center">
            <Bike className="mx-auto mb-2 h-8 w-8 text-navy-200" />
            <p className="text-sm font-medium text-navy">
              {filter === 'PENDING' ? 'No applications waiting' : 'Nothing here yet'}
            </p>
            <p className="mt-1 text-xs text-navy-300">
              New riders apply at kozycare.ng/join-riders — their applications,
              reference codes and confirmations flow in automatically.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {visible.map((app) => {
            const expanded = expandedId === app.id
            return (
              <Card key={app.id} className="border-navy-100 shadow-navy">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-serif text-base font-semibold text-navy">
                          {app.fullName}
                        </p>
                        <StatusBadge status={app.status} />
                        {app.refCode && (
                          <span className="rounded-full bg-navy-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-navy-300 ring-1 ring-navy-100">
                            {app.refCode}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy-300">
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {app.phone}
                        </span>
                        {app.email && (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {app.email}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {app.lga}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Bike className="h-3 w-3" /> {app.bikeModel} ({app.bikeYear})
                        </span>
                        <span>Applied {fmtWhen(app.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {app.status === 'PENDING' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => openApprove(app)}
                            disabled={decisionMutation.isPending}
                            className="bg-gold-gradient font-semibold text-navy hover:opacity-90"
                          >
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRejectTarget(app)
                              setRejectNote('')
                            }}
                            disabled={decisionMutation.isPending}
                            className="h-8 border-rose-200 text-rose-600 hover:bg-rose-50"
                          >
                            <XCircle className="mr-1 h-3.5 w-3.5" /> Decline
                          </Button>
                        </>
                      )}
                      {app.status === 'APPROVED' && app.user && (
                        <div className="text-right text-xs text-navy-300">
                          <p className="font-semibold text-navy">{app.user.name}</p>
                          <p>
                            Rider account ·{' '}
                            <span
                              className={
                                app.user.accessStatus === 'ACTIVE'
                                  ? 'font-semibold text-emerald-700'
                                  : 'font-semibold text-amber-700'
                              }
                            >
                              {app.user.accessStatus.toLowerCase()}
                            </span>
                          </p>
                        </div>
                      )}
                      <button
                        onClick={() => setExpandedId(expanded ? null : app.id)}
                        className="rounded-full p-1.5 text-navy-300 transition hover:bg-navy-50 hover:text-navy"
                        title={expanded ? 'Hide details' : 'Show details'}
                      >
                        {expanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="mt-4 grid gap-3 rounded-lg bg-linen-100 p-4 text-xs text-navy-300 ring-1 ring-navy-100 sm:grid-cols-2">
                      <div>
                        <p className="font-semibold uppercase tracking-wide text-navy-300">
                          Applicant
                        </p>
                        <p className="mt-1 text-navy">Address: {app.address}</p>
                        {app.altPhone && <p className="text-navy">Emergency: {app.altPhone}</p>}
                        <p className="text-navy">Availability: {app.availability}</p>
                        <p className="text-navy">Licence no.: {app.licenseNumber}</p>
                      </div>
                      <div>
                        <p className="font-semibold uppercase tracking-wide text-navy-300">
                          Experience & decision
                        </p>
                        <p className="mt-1 text-navy">
                          {app.experience ? app.experience : 'No experience noted.'}
                        </p>
                        {app.reviewedBy && app.reviewedAt && (
                          <p className="mt-1">
                            Decided by {app.reviewedBy.name} · {fmtWhen(app.reviewedAt)}
                          </p>
                        )}
                        {app.decisionNote && (
                          <p className="mt-1 italic">
                            Note: {app.decisionNote}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* ===== Rider incidents (phase 55) ===== */}
      {/* The risk-management ledger: every rider-reported problem, unresolved
         * ones first. An empty section is the goal — but the moment something
         * goes wrong mid-route, THIS is the owner's action list. */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-navy-300">
          <AlertTriangle className="h-4 w-4 text-rose-500" />
          Rider incidents
          {incidents.filter((i) => !i.resolvedAt).length > 0 && (
            <Badge className="rounded-full bg-rose-100 text-rose-700 hover:bg-rose-100">
              {incidents.filter((i) => !i.resolvedAt).length} open
            </Badge>
          )}
        </h2>
        {incidents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-navy-100 bg-white p-6 text-center">
            <p className="text-sm font-medium text-navy">No incidents reported</p>
            <p className="mx-auto mt-1 max-w-lg text-xs leading-relaxed text-navy-300">
              When a rider reports damage, loss, theft or an accident from their app, it appears
              here instantly with an urgent email. The play: speak to the rider, check the order
              timeline, agree the customer remedy (re-clean, replacement, guarantee claim or
              refund), then record the outcome — resolved incidents keep their story for the
              audit trail.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map((i) => (
              <Card
                key={i.id}
                className={cn(
                  'border-navy-100 shadow-navy',
                  !i.resolvedAt && 'border-rose-200 ring-1 ring-rose-100'
                )}
              >
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-navy">
                        <Badge
                          className={cn(
                            'rounded-full',
                            i.kind === 'THEFT' || i.kind === 'ACCIDENT'
                              ? 'bg-rose-100 text-rose-700 hover:bg-rose-100'
                              : 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                          )}
                        >
                          {i.kind === 'DAMAGE'
                            ? 'Damaged'
                            : i.kind === 'LOSS'
                              ? 'Lost / missing'
                              : i.kind === 'THEFT'
                                ? 'Theft'
                                : i.kind === 'ACCIDENT'
                                  ? 'Accident'
                                  : 'Other'}
                        </Badge>
                        <span className="font-mono text-xs text-navy-300">#{i.orderNumber}</span>
                        <span className="text-xs font-normal text-navy-300">
                          {i.atStop ? `at ${i.atStop}` : ''} · {fmtWhen(i.createdAt)}
                        </span>
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-navy-300">{i.description}</p>
                      <p className="mt-2 text-xs text-navy-300">
                        Reported by{' '}
                        <a
                          href={`tel:${i.riderPhone}`}
                          className="font-semibold text-navy hover:underline"
                        >
                          {i.riderName}
                        </a>
                      </p>
                      {i.resolvedAt && (
                        <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-800 ring-1 ring-emerald-100">
                          <CheckCircle2 className="mr-1 inline h-3 w-3" />
                          Resolved {fmtWhen(i.resolvedAt)} — {i.resolution}
                        </p>
                      )}
                    </div>
                    {!i.resolvedAt && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setResolveTarget(i)
                          setResolutionText('')
                        }}
                        className="h-8 bg-navy text-white hover:bg-navy-500"
                      >
                        Record the outcome
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ===== Rider roster ===== */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-300">
          Rider roster ({roster.length})
        </h2>
        {roster.length === 0 ? (
          <div className="rounded-xl border border-dashed border-navy-100 bg-white p-8 text-center">
            <RouteIcon className="mx-auto mb-2 h-8 w-8 text-navy-200" />
            <p className="text-sm font-medium text-navy">No rider accounts yet</p>
            <p className="mt-1 text-xs text-navy-300">
              Approving an application creates the rider&apos;s account and it appears
              here with live assignment and delivery counts.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {roster.map((r: ApiRiderRosterEntry) => (
              <Card key={r.id} className="border-navy-100 shadow-navy">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-serif text-base font-semibold text-navy">
                        {r.name}
                      </p>
                      <p className="mt-0.5 text-xs text-navy-300">{r.email}</p>
                    </div>
                    <Badge
                      className={cn(
                        'shrink-0 rounded-full',
                        r.accessStatus === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
                          : 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                      )}
                    >
                      {r.accessStatus === 'ACTIVE' ? 'Active' : 'Paused'}
                    </Badge>
                  </div>

                  <div className="mt-3 flex items-center gap-3 text-xs text-navy-300">
                    <a
                      href={`tel:${r.phone}`}
                      className="inline-flex items-center gap-1 font-semibold text-navy hover:underline"
                    >
                      <Phone className="h-3 w-3" /> {r.phone}
                    </a>
                    <span className="inline-flex items-center gap-1" title="Last GPS ping in the rider app">
                      <MapPin className="h-3 w-3" /> {fmtPing(r.lastPingAt)}
                      {r.lastZone ? ` · ${r.lastZone}` : ''}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
                    <div className="rounded-lg bg-linen-100 p-2" title="Stops currently on this rider's route">
                      <p className="text-lg font-bold text-navy">{r.openAssignments}</p>
                      <p className="text-[10px] uppercase tracking-wide text-navy-300">
                        open stops
                      </p>
                    </div>
                    <div className="rounded-lg bg-linen-100 p-2" title="Pickups + deliveries completed since midnight, Lagos time">
                      <p className="text-lg font-bold text-navy">{r.todayCompleted}</p>
                      <p className="text-[10px] uppercase tracking-wide text-navy-300">
                        done today
                      </p>
                    </div>
                    <div className="rounded-lg bg-linen-100 p-2" title="Deliveries completed all-time">
                      <p className="text-lg font-bold text-navy">{r.deliveriesCompleted}</p>
                      <p className="text-[10px] uppercase tracking-wide text-navy-300">
                        delivered
                      </p>
                    </div>
                    <div
                      className={cn(
                        'rounded-lg p-2',
                        r.unresolvedIncidents > 0 ? 'bg-rose-50 ring-1 ring-rose-200' : 'bg-linen-100'
                      )}
                      title={r.unresolvedIncidents > 0 ? 'Unresolved reported incidents — see the ledger below' : 'No unresolved incidents'}
                    >
                      <p className={cn('text-lg font-bold', r.unresolvedIncidents > 0 ? 'text-rose-600' : 'text-navy')}>
                        {r.unresolvedIncidents}
                      </p>
                      <p className={cn('text-[10px] uppercase tracking-wide', r.unresolvedIncidents > 0 ? 'text-rose-500' : 'text-navy-300')}>
                        open issues
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-[11px] leading-relaxed text-navy-300">
                    <Package className="mr-1 inline h-3 w-3" />
                    Joined {fmtWhen(r.joinedAt)} · assign this rider to pickups and deliveries
                    from any order&apos;s detail view — their route screen updates automatically.
                  </p>

                  {/* Phase 62 — home branch. Dispatch suggestions score
                   * same-branch riders higher, and the branch health cards
                   * count riders on duty per location.
                   * Phase 69 — employment type + response-time rank. */}
                  <RiderBranchSelect riderId={r.id} branchId={(r as any).branchId ?? null} />
                  <RiderEmploymentSelect riderId={r.id} employmentType={(r as any).employmentType ?? null} />
                  <RiderResponseStat riderId={r.id} />

                  {/* Phase 72 — the payout desk line: pending balance, bank
                   * status, and the settle action. The office pays riders
                   * weekly from exactly here. */}
                  <div className="mt-3 rounded-xl border border-navy-100 bg-linen-50 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-navy-300">
                          <Banknote className="h-3 w-3" /> Pending payout
                        </p>
                        <p className="text-base font-bold text-navy">
                          {r.ratesPublished ? naira(Math.max(r.pendingPayout, 0)) : '—'}
                          <span className="ml-1.5 text-[10px] font-normal text-navy-300">
                            {r.ratesPublished
                              ? `of ${naira(r.earnedTotal)} earned · ${naira(r.paidTotal)} paid`
                              : 'rates not published'}
                          </span>
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setPayoutTarget(r)
                          setPayoutAmount(r.ratesPublished && r.pendingPayout > 0 ? String(r.pendingPayout) : '')
                          setPayoutMethod('BANK_TRANSFER')
                          setPayoutReference('')
                          setPayoutNote('')
                        }}
                        className="shrink-0 rounded-full bg-navy px-3.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-navy-400"
                      >
                        Settle rider
                      </button>
                    </div>
                    <p className="mt-1.5 flex items-center gap-1 text-[10px] text-navy-300">
                      <Landmark className={cn('h-3 w-3', r.bankOnFile ? 'text-emerald-600' : 'text-amber-500')} />
                      {r.bankOnFile && r.bank
                        ? `${r.bank.bankName} · ${r.bank.bankAccountNumber} · ${r.bank.bankAccountName}`
                        : 'No bank details on file — the rider adds them in their app’s Account tab'}
                      {r.lastPayoutAt ? <span className="ml-auto">last paid {fmtWhen(r.lastPayoutAt)}</span> : null}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ===== Rider payouts (phase 72) — the money trail ===== */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-300">
          Payout history
        </h2>
        {(payoutsQuery.data?.payouts ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-navy-100 bg-white p-6 text-center">
            <Banknote className="mx-auto mb-2 h-6 w-6 text-navy-200" />
            <p className="text-sm font-medium text-navy">No payouts recorded yet</p>
            <p className="mt-1 text-xs text-navy-300">
              When you settle a rider (button on each rider card above), the record lands here —
              amount, method, reference and who recorded it. The rider gets an email receipt.
            </p>
          </div>
        ) : (
          <div className="nav-scroll overflow-x-auto rounded-xl border border-navy-100 bg-white">
            <table className="w-full min-w-[720px] whitespace-nowrap text-left text-xs">
              <thead className="bg-linen-50 text-[10px] uppercase tracking-wide text-navy-300">
                <tr>
                  <th className="px-3 py-2 font-semibold">Rider</th>
                  <th className="px-3 py-2 font-semibold">Amount</th>
                  <th className="px-3 py-2 font-semibold">Method</th>
                  <th className="px-3 py-2 font-semibold">Reference</th>
                  <th className="px-3 py-2 font-semibold">When</th>
                  <th className="px-3 py-2 font-semibold">Recorded by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {(payoutsQuery.data?.payouts ?? []).slice(0, 12).map((p) => (
                  <tr key={p.id} className="text-navy-200">
                    <td className="px-3 py-2 font-medium text-navy">{p.riderName}</td>
                    <td className="px-3 py-2 font-bold text-emerald-700">{naira(p.amount)}</td>
                    <td className="px-3 py-2">{p.method === 'CASH' ? 'Cash' : 'Bank transfer'}</td>
                    <td className="px-3 py-2 font-mono text-[10px]">{p.reference ?? '—'}</td>
                    <td className="px-3 py-2">{fmtWhen(p.createdAt)}</td>
                    <td className="px-3 py-2">{p.recordedByName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ===== Approve dialog ===== */}
      <Dialog open={!!approveTarget} onOpenChange={(o) => !o && setApproveTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Approve {approveTarget?.fullName ?? 'this rider'}?
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              This creates their rider account and emails them the sign-in details plus
              how their first week works. The system generates the password — you never
              see or type one. They&apos;ll choose their own at first sign-in.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="rider-email" className="text-xs text-navy-300">
                Sign-in email (required — their welcome email goes here)
              </Label>
              <Input
                id="rider-email"
                type="email"
                value={approveEmail}
                onChange={(e) => setApproveEmail(e.target.value)}
                placeholder="rider@example.com"
                className="mt-1"
              />
              <p className="mt-1 text-[11px] text-navy-300">
                Prefilled from their application — fix a typo or add the address they
                gave you on the phone. It must not belong to an existing customer
                account.
              </p>
            </div>
            <div>
              <Label htmlFor="rider-note" className="text-xs text-navy-300">
                Personal note (optional — included in the welcome email)
              </Label>
              <Textarea
                id="rider-note"
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                placeholder="e.g. Come by the studio on Saturday to pick up your Kozy shirt."
                rows={3}
                maxLength={500}
                className="mt-1 text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setApproveTarget(null)}
              disabled={decisionMutation.isPending}
            >
              Not yet
            </Button>
            <Button
              size="sm"
              onClick={submitApprove}
              disabled={decisionMutation.isPending || !approveEmail.trim()}
              className="bg-navy text-white hover:bg-navy-600"
            >
              {decisionMutation.isPending ? 'Approving…' : 'Approve & send welcome'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Reject dialog ===== */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Decline {rejectTarget?.fullName ?? 'this application'}?
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              The application is marked declined and kept for your records. No email or
              text is sent to the applicant — if you want to tell them, that call or
              message is yours to make, in your own words.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="reject-note" className="text-xs text-navy-300">
              Internal note (optional — only the team sees this)
            </Label>
            <Textarea
              id="reject-note"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="e.g. Licence expired — welcome to reapply once renewed."
              rows={3}
              maxLength={500}
              className="mt-1 text-sm"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRejectTarget(null)}
              disabled={decisionMutation.isPending}
            >
              Keep pending
            </Button>
            <Button
              size="sm"
              onClick={submitReject}
              disabled={decisionMutation.isPending}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {decisionMutation.isPending ? 'Saving…' : 'Decline application'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Resolve-incident dialog (phase 55) ===== */}
      <Dialog open={!!resolveTarget} onOpenChange={(o) => !o && setResolveTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Resolve the incident on #{resolveTarget?.orderNumber ?? '—'}?
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              {resolveTarget?.riderName} reported this. Record what was actually done — for the
              customer, the rider, or both. The outcome lands on the incident ledger and the
              order&apos;s timeline, so the story stays auditable end to end.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="incident-resolution" className="text-xs text-navy-300">
              What was done
            </Label>
            <Textarea
              id="incident-resolution"
              value={resolutionText}
              onChange={(e) => setResolutionText(e.target.value)}
              placeholder="e.g. Rider returned with the missing shirt same evening (it had slid under the bike seat). Garment re-pressed and re-delivered 5pm; customer called and apologised to. Rider coached on securing the load."
              rows={4}
              maxLength={2000}
              className="mt-1 text-sm"
            />
            <p className="mt-1 text-[11px] text-navy-300">
              {resolutionText.trim().length}/2000 · be specific — this note is the record if the
              customer, an insurer or the police ever asks.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setResolveTarget(null)}
              disabled={resolving}
            >
              Still open
            </Button>
            <Button
              size="sm"
              onClick={submitResolve}
              disabled={resolving || resolutionText.trim().length < 5}
              className="bg-emerald-700 text-white hover:bg-emerald-800"
            >
              {resolving ? 'Recording…' : 'Record & resolve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Record payout dialog (phase 72) ===== */}
      <Dialog open={!!payoutTarget} onOpenChange={(o) => !o && setPayoutTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Settle {payoutTarget?.name ?? 'this rider'}
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Records money you have actually paid out — the rider&apos;s pending balance drops by
              this amount and they get an email receipt with the method and reference. The amount
              is prefilled with their pending balance; adjust it if you are settling part or
              adding an advance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {payoutTarget?.ratesPublished ? (
              <div className="rounded-lg bg-linen-50 p-3 text-xs text-navy-300">
                <div className="flex justify-between">
                  <span>Earned (all stops, today&apos;s rates)</span>
                  <span className="font-semibold text-navy">{naira(payoutTarget.earnedTotal)}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span>Paid to date</span>
                  <span className="font-semibold text-navy">{naira(payoutTarget.paidTotal)}</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-navy-100 pt-1.5">
                  <span>Pending</span>
                  <span className="font-bold text-navy">
                    {naira(Math.max(payoutTarget.pendingPayout, 0))}
                    {payoutTarget.pendingPayout < 0 ? ' (settled ahead)' : ''}
                  </span>
                </div>
                {payoutTarget.bank && (
                  <p className="mt-2 flex items-center gap-1 border-t border-navy-100 pt-1.5 text-[11px]">
                    <Landmark className="h-3 w-3 text-emerald-600" />
                    {payoutTarget.bank.bankName} · {payoutTarget.bank.bankAccountNumber} ·{' '}
                    {payoutTarget.bank.bankAccountName}
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                Rider rates are not published yet (Settings → Rider pay) — earnings show as zero.
                You can still record a payout if you are settling on a private arrangement.
              </div>
            )}

            <div>
              <Label htmlFor="payout-amount" className="text-xs text-navy-300">
                Amount paid (naira)
              </Label>
              <Input
                id="payout-amount"
                type="number"
                min={1}
                inputMode="numeric"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder="e.g. 5000"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs text-navy-300">Method</Label>
              <div className="mt-1 flex gap-2">
                {(['BANK_TRANSFER', 'CASH'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPayoutMethod(m)}
                    className={cn(
                      'flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition',
                      payoutMethod === m
                        ? 'border-navy bg-navy text-white'
                        : 'border-navy-100 bg-white text-navy-300 hover:border-navy-300'
                    )}
                  >
                    {m === 'BANK_TRANSFER' ? 'Bank transfer' : 'Cash'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="payout-reference" className="text-xs text-navy-300">
                Transfer reference (optional)
              </Label>
              <Input
                id="payout-reference"
                value={payoutReference}
                onChange={(e) => setPayoutReference(e.target.value)}
                placeholder="Receipt / transfer ID"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="payout-note" className="text-xs text-navy-300">
                Note (optional — visible to the rider)
              </Label>
              <Input
                id="payout-note"
                value={payoutNote}
                onChange={(e) => setPayoutNote(e.target.value)}
                placeholder="e.g. Week of 22 Sept"
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button size="sm" variant="outline" onClick={() => setPayoutTarget(null)} disabled={payoutMutation.isPending}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const amount = Math.round(Number(payoutAmount))
                if (!payoutTarget || !Number.isFinite(amount) || amount <= 0) {
                  toast({ title: 'Enter a whole amount', variant: 'destructive' })
                  return
                }
                if (payoutTarget.ratesPublished && amount > payoutTarget.pendingPayout + 1) {
                  // Allowed (advances happen) — but confirm.
                  const ok = window.confirm(
                    `This is more than the pending balance (${naira(payoutTarget.pendingPayout)}). Record it anyway?`
                  )
                  if (!ok) return
                }
                payoutMutation.mutate(
                  {
                    riderId: payoutTarget.id,
                    amount,
                    method: payoutMethod,
                    reference: payoutReference.trim() || undefined,
                    note: payoutNote.trim() || undefined,
                  },
                  {
                    onSuccess: (d: any) => {
                      toast({
                        title: 'Payout recorded',
                        description: `${payoutTarget.name} — ${naira(amount)} by ${
                          payoutMethod === 'CASH' ? 'cash' : 'bank transfer'
                        }. Pending now ${naira(Math.max(d?.balance?.pending ?? 0, 0))}. Receipt email queued.`,
                      })
                      setPayoutTarget(null)
                    },
                    onError: (e: Error) => {
                      toast({ title: 'Could not record', description: e.message, variant: 'destructive' })
                    },
                  }
                )
              }}
              disabled={payoutMutation.isPending}
              className="bg-emerald-700 text-white hover:bg-emerald-800"
            >
              {payoutMutation.isPending ? 'Recording…' : 'Record payout'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// =====================================================
// RIDER EMPLOYMENT TYPE (phase 69)
// =====================================================
// FULL_TIME riders are auto-assigned new pickups at booking; PART_TIME
// riders work the broadcast & claim pool (first to accept wins the stop).
// The owner's dispatch design — the two lanes stay explicit in the console.
function RiderEmploymentSelect({
  riderId,
  employmentType,
}: {
  riderId: string
  employmentType: string | null
}) {
  const assign = useRiderBranchAssign()
  const [value, setValue] = useState(employmentType ?? '')
  const [lastType, setLastType] = useState(employmentType)
  if (employmentType !== lastType) {
    setLastType(employmentType)
    setValue(employmentType ?? '')
  }

  return (
    <div className="mt-2.5">
      <label className="text-[10px] font-semibold uppercase tracking-wide text-navy-300">
        Dispatch lane
      </label>
      <div className="mt-1 flex items-center gap-2">
        <Timer className="h-3.5 w-3.5 shrink-0 text-gold-600" />
        <select
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            assign.mutate({
              userId: riderId,
              employmentType: (e.target.value || null) as 'FULL_TIME' | 'PART_TIME' | null,
            })
          }}
          disabled={assign.isPending}
          className="h-8 w-full rounded-lg border border-navy-200 bg-white px-2 text-xs text-navy focus:border-gold-400 focus:outline-none"
        >
          <option value="">Not set (treated as part-time)</option>
          <option value="FULL_TIME">Full-time — auto-assigned</option>
          <option value="PART_TIME">Part-time — claim pool</option>
        </select>
        {assign.isPending && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-navy-300" />}
      </div>
      <p className="mt-1 text-[10px] leading-snug text-navy-300">
        Full-timers receive new pickups automatically (nearest / lightest load wins);
        part-timers get pinged and race to claim.
      </p>
    </div>
  )
}

// =====================================================
// RIDER RESPONSE STAT (phase 69)
// =====================================================
// The rider's average accept time + team rank — the accept-fast league,
// visible where the owner manages riders.
function RiderResponseStat({ riderId }: { riderId: string }) {
  const { data: stats } = useDriverStats({ refetchInterval: 60000 })
  const row = stats?.board?.find((r) => r.id === riderId)
  if (!row) return null
  const fmt = (m: number | null) => (m == null ? '—' : m < 1 ? '<1 min' : `${m} min`)
  return (
    <div className="mt-2.5 flex items-center justify-between rounded-lg bg-linen-100 px-3 py-2">
      <span className="flex items-center gap-1.5 text-[11px] text-navy-300">
        <Timer className="h-3 w-3" /> Avg accept
      </span>
      <span className="text-[11px] font-semibold text-navy">
        {fmt(row.avgResponseMin)}
        {stats && stats.board.length > 1 && (
          <span className="ml-1.5 font-normal text-navy-300">#{row.rank} of {stats.board.length}</span>
        )}
        {row.pendingAck > 0 && (
          <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
            {row.pendingAck} waiting to accept
          </span>
        )}
      </span>
    </div>
  )
}

// =====================================================
// RIDER BRANCH SELECT (phase 62)
// =====================================================
// Assigns the rider's home branch (Ogombo / Chevron Drive). Dispatch
// suggestions score same-branch riders higher; the branch health cards
// count riders per location.
function RiderBranchSelect({ riderId, branchId }: { riderId: string; branchId: string | null }) {
  const { data: branches } = useBranches()
  const assign = useRiderBranchAssign()
  const [value, setValue] = useState(branchId ?? '')
  // Follow server-side changes with the React-documented adjust-during-render
  // pattern (no effect, no cascade).
  const [lastBranch, setLastBranch] = useState(branchId)
  if (branchId !== lastBranch) {
    setLastBranch(branchId)
    setValue(branchId ?? '')
  }

  return (
    <div className="mt-3 border-t border-navy-100 pt-3">
      <label className="text-[10px] font-semibold uppercase tracking-wide text-navy-300">
        Home branch
      </label>
      <div className="mt-1 flex items-center gap-2">
        <Building2 className="h-3.5 w-3.5 shrink-0 text-gold-600" />
        <select
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            assign.mutate({ userId: riderId, branchId: e.target.value || null })
          }}
          disabled={assign.isPending}
          className="h-8 w-full rounded-lg border border-navy-200 bg-white px-2 text-xs text-navy focus:border-gold-400 focus:outline-none"
        >
          <option value="">Unassigned</option>
          {(branches ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        {assign.isPending && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-navy-300" />}
      </div>
    </div>
  )
}
