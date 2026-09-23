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

import { useMemo, useState } from 'react'
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
  type ApiRiderApplication,
  type ApiRiderRosterEntry,
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

export function RidersView() {
  const { data, isLoading, error } = useRiderApplications()
  const decisionMutation = useRiderDecision()

  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [approveTarget, setApproveTarget] = useState<ApiRiderApplication | null>(null)
  const [approveEmail, setApproveEmail] = useState('')
  const [approveNote, setApproveNote] = useState('')
  const [rejectTarget, setRejectTarget] = useState<ApiRiderApplication | null>(null)
  const [rejectNote, setRejectNote] = useState('')

  const applications = data?.applications ?? []
  const roster = data?.roster ?? []

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

                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-linen-100 p-2">
                      <p className="text-lg font-bold text-navy">{r.openAssignments}</p>
                      <p className="text-[10px] uppercase tracking-wide text-navy-300">
                        open stops
                      </p>
                    </div>
                    <div className="rounded-lg bg-linen-100 p-2">
                      <p className="text-lg font-bold text-navy">{r.deliveriesCompleted}</p>
                      <p className="text-[10px] uppercase tracking-wide text-navy-300">
                        delivered
                      </p>
                    </div>
                    <div className="rounded-lg bg-linen-100 p-2">
                      <p className="text-lg font-bold text-navy">{fmtWhen(r.joinedAt)}</p>
                      <p className="text-[10px] uppercase tracking-wide text-navy-300">joined</p>
                    </div>
                  </div>

                  <p className="mt-3 text-[11px] leading-relaxed text-navy-300">
                    <Package className="mr-1 inline h-3 w-3" />
                    Assign this rider to pickups and deliveries from any order&apos;s detail
                    view — their route screen updates automatically.
                  </p>
                </CardContent>
              </Card>
            ))}
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
    </div>
  )
}
