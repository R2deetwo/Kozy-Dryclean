'use client'

import { useState, useRef, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { motion, AnimatePresence, type PanInfo } from 'framer-motion'
import {
  Phone,
  Navigation,
  Navigation2,
  Package,
  Truck,
  CheckCircle2,
  MapPin,
  Clock,
  ChevronRight,
  ArrowLeft,
  Wind,
  Check,
  AlertCircle,
  AlertTriangle,
  Route,
  ListChecks,
  LogOut,
  Scissors,
  ShieldCheck,
  Bell,
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useOrders, useUpdateOrder } from '@/lib/hooks'
import { formatDate } from '@/lib/types'
import { orderDistanceKm } from '@/lib/geo'
import { getOrderTiming, formatDue } from '@/lib/order-timing'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  useDriverGeofence,
  DriverGeofencePill,
  DriverGeofenceBanner,
} from '@/components/driver/driver-geofence'

// The rider's duty-of-care rules — shown in the rider app itself (phase 55:
// "what if the rider steals, damages or misplaces the items?" → make the
// right way the easy way). Written with a rider's phone in mind: short
// imperatives, grouped by what actually happens on the road.
const RIDER_RULES: { icon: typeof ShieldCheck; title: string; points: string[] }[] = [
  {
    icon: Package,
    title: 'Care of the garments',
    points: [
      'Count every item against the list BEFORE you ride off — the swipe is your signature that the count is right.',
      'Garment bag zipped closed at all times. Nothing rides loose on the bike.',
      'Keep the bag away from the exhaust pipe and hot engine parts.',
      'Rain? Bag it first, ride second — a wet garment is a damaged garment.',
      'Gold “Guarantee” badge: inspect the items WITH the customer at pickup, and note anything odd before you leave.',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Ride by the law',
    points: [
      'Valid driver’s licence on you at all times — you showed it at onboarding; carry it.',
      'Helmet on, every trip (Lagos State law for riders).',
      'Phone in the mount, not in your hand. Pull over safely to check the route.',
      'One-ways, BRT lanes and red lights carry fines — those are yours to pay.',
      'No passengers while on a Kozy route; your focus is the garments.',
    ],
  },
  {
    icon: AlertTriangle,
    title: 'Money & honesty',
    points: [
      'You never handle cash. If a customer offers cash at the door, politely refuse — the office will help them pay digitally.',
      'A tip offered is yours to keep; never ask for one.',
      'Damage, loss, theft or a fall — REPORT IT HERE IMMEDIATELY (the Report a problem button on the stop). Reporting is always the right move: hidden problems grow into disputes, reported ones get solved the same day.',
      'Kozy stands behind honest riders. The moment we learn about a problem from you — not from an angry customer — you have the whole team on your side.',
    ],
  },
]

// =============================================================================
// Phase 59 — stop helpers. A stop's identity is its TYPE (pickup or delivery)
// and its own address. Every top-tier delivery app (Uber Driver, DoorDash,
// Onfleet) renders the task type as the card's primary identity — never a
// small badge — because "what am I doing here?" is the first question at
// every stop. Pickup → collect at the customer's address; delivery → drop
// at the delivery address (falling back to the pickup address when the
// customer's drop-off is the same place).
// =============================================================================
export function isPickupStop(order: any): boolean {
  return order?.status === 'PAYMENT_VERIFIED'
}

export function stopAddress(order: any): string {
  if (!order) return ''
  return isPickupStop(order)
    ? order.pickupAddress
    : order.deliveryAddress || order.pickupAddress
}

/** Google Maps deep link that actually STARTS NAVIGATION (phase 59 fix).
 *  The old /maps/search/?api=1&destination=… link opened a search page —
 *  it never seeded the destination, which is exactly what the owner hit
 *  ("opened the navigation, it did not seed the address"). The /maps/dir/
 *  endpoint is the documented turn-by-turn URL: destination pre-filled,
 *  route computed from the rider's current location. "Lagos, Nigeria" is
 *  appended to help the geocoder resolve free-text Lagos street addresses. */
export function navigationUrl(order: any): string {
  const address = `${stopAddress(order)}, Lagos, Nigeria`
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    address
  )}&travelmode=driving`
}

export function DriverView() {
  const { data: session } = useSession()

  // ----- Rider geofencing -----
  // Tracks GPS, pings the server ~1/min, and pauses order activity while the
  // rider is outside every Kozy service area (owner-requested behaviour).
  const geofence = useDriverGeofence(true)
  const ordersPaused = geofence.status === 'outside'

  const { data: allOrders, isLoading, hasMore, loadMore, isFetchingMore } = useOrders({
    enabled: !ordersPaused, // pause polling + new activity while outside the fence
    refetchInterval: 15000, // live route updates (new assignments appear automatically)
  })
  const updateOrderMutation = useUpdateOrder()
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)

  // The API already filters orders to the logged-in driver (RBAC).
  // Phase 59: the route list shows only ACTIONABLE stops — a picked-up
  // order is at the studio (its next rider moment is OUT_FOR_DELIVERY,
  // which re-adds it as a delivery). It used to linger on the route with
  // no type badge — the rider couldn't tell what was left to do with it.
  // While paused (outside the geofence) the server would return no stops —
  // mirror that client-side so no stale route lingers on screen.
  const orders = ordersPaused
    ? []
    : (allOrders ?? []).filter((o: any) =>
        ['OUT_FOR_DELIVERY', 'PAYMENT_VERIFIED'].includes(o.status)
      )
  const selected = orders.find((o: any) => o.id === selectedId)

  // ----- New-stop alert (phase 55, rebuilt phase 59 without
  // setState-in-effect — the new lint rule) -----
  // The rider's phone is their dashboard: when the team assigns a new pickup
  // or delivery, the polled list gains a stop and the banner lights up —
  // the "alert me when there's a ride" behaviour the owner asked for,
  // without building push infrastructure. Skipped on the first load (those
  // are existing stops, not news), and frozen while paused so re-entering
  // the service area never replays the whole route as "new".
  const [knownIds, setKnownIds] = useState<string[] | null>(null)
  const [newStopAlert, setNewStopAlert] = useState<{ id: string; label: string } | null>(null)
  // `isLoading` guard: the first render has an EMPTY list while the query
  // is in flight — baselining against it would make every stop on the
  // first load look "new" and fire a phantom banner. Only learn the route
  // once real data has arrived (an empty route AFTER a fetch is a real
  // baseline — the next assignment then correctly alerts).
  if (!ordersPaused && !isLoading) {
    const ids = orders.map((o: any) => o.id)
    if (knownIds === null) {
      // First sight of the route — a baseline, never news.
      setKnownIds(ids)
    } else {
      const fresh = orders.filter((o: any) => !knownIds.includes(o.id))
      if (fresh.length > 0) {
        // Newest first (the list is createdAt-desc) — when several stops
        // land in one poll, the banner carries the latest assignment.
        const o = fresh[0]
        setNewStopAlert({
          id: o.id,
          label: `New ${o.status === 'PAYMENT_VERIFIED' ? 'pickup' : 'delivery'} assigned — ${
            o.user?.name ?? 'customer'
          }`,
        })
      }
      // Adopt the current route (drops completed stops, so the same order
      // returning as a DELIVERY leg IS new work and alerts again).
      if (fresh.length > 0 || ids.join('\u241f') !== knownIds.join('\u241f')) {
        setKnownIds(ids)
      }
    }
  }
  // Self-dismiss after 8s — setState in the timer callback, not the effect
  // body, per the lint rule's async-callback allowance.
  useEffect(() => {
    if (!newStopAlert) return
    const t = setTimeout(() => {
      setNewStopAlert((a) => (a && a.id === newStopAlert.id ? null : a))
    }, 8000)
    return () => clearTimeout(t)
  }, [newStopAlert?.id])

  // ----- Care & safety rules dialog -----
  const [rulesOpen, setRulesOpen] = useState(false)

  // ----- First-sign-in password change (phase 55) -----
  // The welcome email promises "the app will ask you to choose your own
  // password" — the console had that dialog for staff, the rider app did
  // not. Riders approved through the pipeline get mustChangePassword=true;
  // this non-dismissible dialog honours the promise. The dialog's open
  // state IS the flag (derived, not synced through an effect).
  const [mustChangePassword, setMustChangePassword] = useState<boolean | null>(null)
  useEffect(() => {
    let alive = true
    fetch('/api/users/me')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('me failed'))))
      .then((d) => {
        if (alive) setMustChangePassword(Boolean(d?.user?.mustChangePassword))
      })
      .catch(() => {
        if (alive) setMustChangePassword(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const driverName = session?.user?.name ?? 'Driver'

  if (selected) {
    return (
      <>
        <DriverOrderDetail
          order={selected}
          onBack={() => setSelectedId(undefined)}
          newStopAlert={newStopAlert}
          onOpenAlertedStop={(id) => {
            setNewStopAlert(null)
            setSelectedId(id)
          }}
        />
        <RiderPasswordDialog
          open={mustChangePassword === true}
          forced={mustChangePassword === true}
          onDone={() => setMustChangePassword(false)}
        />
      </>
    )
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-slate-900 text-white">
      {/* Driver header */}
      <header className="bg-slate-950 px-4 py-4 shadow-lg sm:px-6">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-gold-400">Driver on duty</p>
              <p className="text-lg font-bold">{driverName}</p>
            </div>
            <div className="flex items-center gap-3">
              <DriverGeofencePill state={geofence} />
              {/* Care & safety rules — phase 55: the duty-of-care brief lives
                  IN the rider app, one tap away at all times. */}
              <button
                onClick={() => setRulesOpen(true)}
                className="flex items-center gap-1 rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-gold-300 transition hover:bg-slate-700"
                title="Care & safety rules — garment care, the law, and what to do when something goes wrong"
              >
                <ShieldCheck className="h-3.5 w-3.5" /> Rules
              </button>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="flex items-center gap-1 rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-rose-700"
              >
                <LogOut className="h-3 w-3" /> Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 py-4 sm:px-6">
        {/* New-stop alert (phase 55) — lights up the moment the team assigns
            a new pickup or delivery; dismisses itself after a few seconds. */}
        <AnimatePresence>
          {newStopAlert && (
            <motion.button
              key={newStopAlert.id}
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              onClick={() => {
                setSelectedId(newStopAlert.id)
                setNewStopAlert(null)
              }}
              className="mb-4 flex w-full items-center gap-3 rounded-xl border border-gold-400/40 bg-gold-400/10 px-4 py-3 text-left"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-400/20">
                <Bell className="h-4 w-4 text-gold-300" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-gold-300">New stop assigned</span>
                <span className="block truncate text-xs text-amber-100/80">{newStopAlert.label} — tap to open</span>
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Stats */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-slate-800 p-3 text-center">
            <p className="text-xs text-slate-400">Today</p>
            <p className="text-2xl font-bold text-white">{orders.length}</p>
            <p className="text-[10px] text-slate-500">stops</p>
          </div>
          <div className="rounded-xl bg-slate-800 p-3 text-center">
            <p className="text-xs text-slate-400">Pickups</p>
            <p className="text-2xl font-bold text-gold-400">
              {orders.filter((o) => o.status === 'PAYMENT_VERIFIED').length}
            </p>
            <p className="text-[10px] text-slate-500">to collect</p>
          </div>
          <div className="rounded-xl bg-slate-800 p-3 text-center">
            <p className="text-xs text-slate-400">Drops</p>
            <p className="text-2xl font-bold text-cyan-400">
              {orders.filter((o) => o.status === 'OUT_FOR_DELIVERY').length}
            </p>
            <p className="text-[10px] text-slate-500">to deliver</p>
          </div>
        </div>

        {/* Geofence status (paused / live-in-zone / location-off) */}
        <DriverGeofenceBanner state={geofence} />

        {/* Route header */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Route className="h-4 w-4 text-gold-400" /> Your route today
          </h2>
          <span className="text-xs text-slate-400">
            {orders.length} stop{orders.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Stop cards */}
        {orders.length === 0 ? (
          ordersPaused ? (
            <div className="rounded-xl border border-amber-500/30 bg-slate-800 p-8 text-center">
              <Navigation2 className="mx-auto mb-2 h-10 w-10 text-amber-400" />
              <p className="font-semibold text-white">No active stops</p>
              <p className="mt-1 text-xs text-slate-400">
                Your route resumes automatically when you re-enter a Kozy service
                area — no action needed.
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-slate-800 p-8 text-center">
              <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-gold-400" />
              <p className="font-semibold text-white">Route complete!</p>
              <p className="mt-1 text-xs text-slate-400">
                No pickups or deliveries assigned right now.
              </p>
            </div>
          )
        ) : (
          <ul className="space-y-3">
            {orders.map((o, i) => (
              <DriverStopCard
                key={o.id}
                order={o}
                index={i + 1}
                geofence={geofence}
                onOpen={() => setSelectedId(o.id)}
              />
            ))}
          </ul>
        )}

        {/* Orders are cursor-paginated — older assignments load on demand */}
        {!ordersPaused && hasMore && (
          <button
            onClick={() => loadMore()}
            disabled={isFetchingMore}
            className="mt-3 w-full rounded-full border border-slate-600 py-2 text-xs font-semibold text-slate-300 transition hover:border-gold-400 hover:text-white disabled:opacity-50"
          >
            {isFetchingMore ? 'Loading…' : `Load more (${orders.length} shown)`}
          </button>
        )}

        <p className="mt-6 text-center text-[10px] text-slate-500">
          Tap a stop for its 3 steps — ride there, count with the customer, swipe to confirm.
        </p>
      </div>

      {/* Care & safety rules (phase 55) */}
      <RiderRulesDialog open={rulesOpen} onOpenChange={setRulesOpen} />

      {/* First-sign-in password change (phase 55) — forced while
          mustChangePassword is set (welcome-email promise). The flag IS the
          dialog's open state — no mirrored state, no sync effect. */}
      <RiderPasswordDialog
        open={mustChangePassword === true}
        forced={mustChangePassword === true}
        onDone={() => setMustChangePassword(false)}
      />
    </div>
  )
}

/** Forced first-sign-in password change for riders — the rider-app half of
 *  the invite flow (staff had theirs in the console since phase 32). Posts
 *  /api/users/me/password with the emailed initial password + the rider's
 *  own new one; the server clears mustChangePassword on success. */
function RiderPasswordDialog({
  open,
  forced,
  onDone,
}: {
  open: boolean
  forced: boolean
  onDone: () => void
}) {
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const strengthOk =
    newPw.length >= 10 &&
    [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(newPw)).length >= 2

  const submit = async () => {
    setError(null)
    if (newPw !== confirmPw) {
      setError('The two new passwords do not match.')
      return
    }
    if (!strengthOk) {
      setError('At least 10 characters, with a mix of letters, numbers or symbols.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/users/me/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not set the password')
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      onDone()
    } catch (e: any) {
      setError(e?.message || 'Could not set the password — try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!forced) onDone() }}>
      <DialogContent className="border-slate-700 bg-slate-900 sm:max-w-sm" onInteractOutside={(e: any) => forced && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-white">Set your own password</DialogTitle>
          <DialogDescription className="text-slate-400">
            {forced
              ? 'Welcome! For your security, choose your own password before you start riding — the one from your welcome email was just to get you in.'
              : 'Choose a new password for your rider account.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-300">Password from your welcome email</p>
            <input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-white focus:border-gold-400 focus:outline-none"
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-300">Your new password</p>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-white focus:border-gold-400 focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-slate-500">At least 10 characters, mixed letters/numbers/symbols.</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-300">Repeat the new password</p>
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-white focus:border-gold-400 focus:outline-none"
            />
          </div>
          {error && (
            <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>
          )}
          <Button
            onClick={submit}
            disabled={saving || !currentPw || !strengthOk || newPw !== confirmPw}
            className="w-full bg-navy text-white hover:bg-navy-500"
          >
            {saving ? 'Setting…' : 'Set my password'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** The duty-of-care brief: garment care, Lagos road law, the no-cash rule
 *  and the report-immediately promise. One tap from the header, any time. */
function RiderRulesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto border-slate-700 bg-slate-900 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <ShieldCheck className="h-5 w-5 text-gold-400" /> Care &amp; safety rules
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            You are the face of Kozy Care at every door. These rules protect the
            garments, protect you, and keep you on the right side of the law.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {RIDER_RULES.map((section) => (
            <div key={section.title} className="rounded-xl bg-slate-800/70 p-4 ring-1 ring-slate-700">
              <p className="flex items-center gap-2 text-sm font-bold text-white">
                <section.icon className="h-4 w-4 text-gold-400" /> {section.title}
              </p>
              <ul className="mt-2 space-y-2">
                {section.points.map((p, i) => (
                  <li key={i} className="flex gap-2 text-xs leading-relaxed text-slate-300">
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-center text-[11px] leading-relaxed text-slate-500">
            Something already went wrong? Open the stop and tap{' '}
            <span className="font-semibold text-amber-300">Report a problem</span> — the office is
            alerted instantly, and reporting immediately is always the right move.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DriverStopCard({
  order,
  index,
  geofence,
  onOpen,
}: {
  order: any
  index: number
  geofence: { lat?: number; lng?: number }
  onOpen: () => void
}) {
  const customer = order.user
  const isPickup = order.status === 'PAYMENT_VERIFIED'
  const isDrop = order.status === 'OUT_FOR_DELIVERY'

  // The stop's OWN address (delivery stops show the drop-off, not the
  // pickup address) and the distance to THAT zone.
  const addr = stopAddress(order)
  const stop =
    geofence.lat != null && geofence.lng != null
      ? orderDistanceKm(geofence.lat, geofence.lng, addr)
      : null

  // The stop's own clock: pickup → the customer's chosen slot; delivery →
  // the one-hour delivery-run promise (phase 57's clocks, in the rider's
  // pocket). Overdue deliveries surface in rose so the route answers
  // "which stop first?" at a glance.
  const timing = getOrderTiming(order)
  const dueText = timing ? formatDue(timing.dueAt) : null

  return (
    <motion.button
      onClick={onOpen}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'relative w-full overflow-hidden rounded-2xl p-4 text-left shadow-lg',
        isPickup && 'bg-gradient-to-br from-navy to-navy-500',
        isDrop && 'bg-gradient-to-br from-cyan-600 to-blue-700'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
            {index}
          </div>
          {isPickup && (
            <Badge className="bg-gold-400/90 text-navy hover:bg-gold-400/90">
              <Package className="mr-1 h-3 w-3" /> Pickup
            </Badge>
          )}
          {isDrop && (
            <Badge className="bg-white/90 text-cyan-700 hover:bg-white/90">
              <Truck className="mr-1 h-3 w-3" /> Delivery
            </Badge>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-white/70" />
      </div>

      <p className="mt-3 text-base font-bold text-white">{customer?.name}</p>
      <p className="mt-1 flex items-start gap-1 text-xs text-white/80">
        <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
        {addr}
      </p>

      <div className="mt-3 flex items-center justify-between text-xs">
        <span
          className={cn(
            'flex items-center gap-1',
            isPickup ? 'text-white/70' : timing?.state === 'overdue' ? 'font-semibold text-rose-300' : 'text-white/70'
          )}
        >
          <Clock className="h-3 w-3" />
          {isPickup
            ? `Slot ${order.pickupTimeSlot}`
            : dueText
            ? timing?.state === 'overdue'
              ? `Due by ${dueText} · running over`
              : `Due by ${dueText}`
            : order.pickupTimeSlot}
        </span>
        <span className="flex items-center gap-2">
          {stop && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
              <MapPin className="h-2.5 w-2.5" /> {stop.distanceKm} km · {stop.zone}
            </span>
          )}
          <span className="rounded-full bg-white/15 px-2 py-0.5 font-mono text-[10px]">
            #{order.orderNumber}
          </span>
        </span>
      </div>

      {order.type === 'ITEM' && (() => {
        try {
          const items = JSON.parse(order.itemsManifest || '[]')
          if (items.length === 0) return null
          return (
            <div className="mt-2 text-xs text-white/80">
              {items.reduce((s: number, i: any) => s + i.quantity, 0)} items ·{' '}
              {items.slice(0, 2).map((i: any) => `${i.quantity}× ${i.name}`).join(', ')}
              {items.length > 2 && ` +${items.length - 2} more`}
            </div>
          )
        } catch { return null }
      })()}
      {order.type === 'KG' && (
        <div className="mt-2 text-xs text-white/80">
          Bulk laundry — {order.finalWeight ? `${order.finalWeight}kg` : 'weigh at station'}
        </div>
      )}
    </motion.button>
  )
}

function DriverOrderDetail({
  order,
  onBack,
  newStopAlert,
  onOpenAlertedStop,
}: {
  order: any
  onBack: () => void
  newStopAlert?: { id: string; label: string } | null
  onOpenAlertedStop?: (id: string) => void
}) {
  const customer = order.user
  const updateOrderMutation = useUpdateOrder()

  const isPickup = order.status === 'PAYMENT_VERIFIED'
  const actionLabel = isPickup ? 'Swipe to confirm pickup' : 'Swipe to confirm delivery'
  const actionVerb = isPickup ? 'PICKED_UP' : 'DELIVERED'

  // The stop's own clock (phase 57): pickup → the chosen slot; delivery →
  // the one-hour run promise. Shown on the customer card in the promise's
  // own words, coloured by state like the ops board.
  const timing = getOrderTiming(order)
  const dueText = timing ? formatDue(timing.dueAt) : null

  const [confirming, setConfirming] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ----- Report a problem (phase 55) -----
  // The rider-facing half of the incident pipeline: damage / loss / theft /
  // accident / other, posted straight to the office. Low friction by
  // design — a report must never be harder than the problem itself.
  const [reportOpen, setReportOpen] = useState(false)

  const handleDragEnd = (_e: any, info: PanInfo) => {
    if (info.offset.x > 180) {
      setConfirming(true)
      setError(null)
      updateOrderMutation.mutate(
        { id: order.id, status: actionVerb },
        {
          onSuccess: () => {
            setConfirming(false)
            setDone(true)
            setTimeout(() => onBack(), 1200)
          },
          onError: (err: any) => {
            setConfirming(false)
            // Surfaces the server's geofence message ("You're about 22 km from
            // this stop's area…") or a generic failure message.
            setError(err?.message || 'Could not confirm — please try again.')
          },
        }
      )
    }
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-slate-900 text-white">
      <div className="mx-auto max-w-md">
        {/* New-stop alert also shows while working inside a stop — a rider is
            most often HERE when the team assigns the next pickup. */}
        <AnimatePresence>
          {newStopAlert && (
            <motion.button
              key={newStopAlert.id}
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              onClick={() => onOpenAlertedStop?.(newStopAlert.id)}
              className="mx-4 mt-3 flex w-auto items-center gap-3 rounded-xl border border-gold-400/40 bg-gold-400/10 px-4 py-3 text-left"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-400/20">
                <Bell className="h-4 w-4 text-gold-300" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-gold-300">New stop assigned</span>
                <span className="block truncate text-xs text-amber-100/80">{newStopAlert.label} — tap to open</span>
              </span>
            </motion.button>
          )}
        </AnimatePresence>
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between bg-slate-950 px-4 py-3 sm:px-6">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-slate-300 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Route
          </button>
          <span className="font-mono text-xs text-slate-400">#{order.orderNumber}</span>
        </header>

        {/* Action banner — the stop's type identity, colour-coded to match
            its route card: gold = collect, cyan = hand over. The first
            question at every door is "what am I doing here?" — answered
            before anything else on the screen. */}
        <div
          className={cn(
            'flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold tracking-wide sm:px-6',
            isPickup
              ? 'bg-gold-400/15 text-gold-300 ring-1 ring-inset ring-gold-400/30'
              : 'bg-cyan-400/15 text-cyan-300 ring-1 ring-inset ring-cyan-400/30'
          )}
        >
          {isPickup ? <Package className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
          {isPickup ? 'PICKUP — COLLECT FROM CUSTOMER' : 'DELIVERY — HAND OVER TO CUSTOMER'}
        </div>

        {/* Customer card */}
        <div className="p-4 sm:p-6">
          <div className="rounded-2xl bg-slate-800 p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy text-lg font-bold text-white">
                  {customer?.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{customer?.name}</p>
                  <p className="text-xs text-slate-400">Customer</p>
                </div>
              </div>
              {order.guaranteeActive && (
                <Badge className="bg-navy/20 text-gold-300 hover:bg-navy/20">
                  <Check className="mr-1 h-3 w-3" /> Guarantee
                </Badge>
              )}
            </div>

            {/* Address — the stop's OWN address: delivery stops show the
                drop-off, not the address the garments came from. */}
            <div className="mt-4 rounded-xl bg-slate-900/60 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <MapPin className="h-3.5 w-3.5" /> {isPickup ? 'Pickup address' : 'Delivery address'}
              </p>
              <p className="mt-1 text-sm text-white">{stopAddress(order)}</p>
            </div>

            {/* The stop's promise: the pickup slot the customer chose, or the
                one-hour delivery-run clock for drops. */}
            <div className="mt-2 rounded-xl bg-slate-900/60 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <Clock className="h-3.5 w-3.5" /> {isPickup ? 'Pickup window' : 'Delivery promise'}
              </p>
              {isPickup || !dueText ? (
                <p className="mt-1 text-sm text-white">
                  {formatDate(order.pickupDate)} · {order.pickupTimeSlot}
                </p>
              ) : (
                <p
                  className={cn(
                    'mt-1 text-sm font-semibold',
                    timing?.state === 'overdue'
                      ? 'text-rose-300'
                      : timing?.state === 'watch'
                      ? 'text-amber-300'
                      : 'text-emerald-300'
                  )}
                >
                  Due by {dueText}
                  {timing?.state === 'overdue' ? ' — running over' : ' — within the hour of dispatch'}
                </p>
              )}
            </div>
          </div>

          {/* What happens at this stop, in order — the "after accepting,
              what next?" answer. Every top courier app (Uber Driver,
              DoorDash, Onfleet) answers it the same way: a numbered
              sequence with the ride-first action carrying the buttons. */}
          <StopSteps order={order} isPickup={isPickup} />

          {/* Items list — no financial data */}
          <div className="mt-4 rounded-2xl bg-slate-800 p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
              <ListChecks className="h-4 w-4 text-gold-400" />
              {isPickup ? 'Items to collect' : 'Items to deliver'}
            </p>
            {order.type === 'ITEM' ? (() => {
              try {
                const items = JSON.parse(order.itemsManifest || '[]')
                return (
                  <ul className="mt-2 space-y-1.5">
                    {items.map((i: any, idx: number) => (
                      <li key={idx} className="flex items-center justify-between rounded-lg bg-slate-900/60 px-3 py-2 text-sm">
                        <span className="text-white">
                          <span className="mr-1 font-bold text-gold-400">{i.quantity}×</span>
                          {i.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                )
              } catch { return <p className="text-sm text-slate-400">Items</p> }
            })() : (
              <div className="mt-2 rounded-lg bg-slate-900/60 p-3 text-sm text-white">
                <p>Bulk laundry bag</p>
                <p className="text-xs text-slate-400">
                  {order.finalWeight
                    ? `${order.finalWeight}kg weighed at station`
                    : 'Weigh at station upon pickup'}
                </p>
              </div>
            )}
            {order.guaranteeActive && (
              <p className="mt-2 flex items-center gap-1 text-xs text-gold-300">
                <AlertCircle className="h-3 w-3" /> Handle with care — Guarantee active. Inspect items before confirming pickup.
              </p>
            )}
            {order.alterationNotes && (
              <div className="mt-2 rounded-lg bg-gold-400/10 p-3 ring-1 ring-gold-400/30">
                <p className="flex items-center gap-1 text-xs font-semibold text-gold-300">
                  <Scissors className="h-3 w-3" /> Alteration pieces on this pickup
                </p>
                <p className="mt-1 text-xs leading-relaxed text-white/80">{order.alterationNotes}</p>
                <p className="mt-1 text-[10px] text-slate-400">
                  Just collect and tag the pieces — the seamstress assesses and quotes at the studio (no measuring at the door).
                </p>
              </div>
            )}
          </div>

          {/* Items handled indicator */}
          <p className="mt-4 text-center text-[10px] text-slate-500">
            Financial details hidden — driver role restricts access to payment fields.
          </p>

          {/* Report a problem (phase 55) — the incident pipeline entry point.
              Subtle on purpose (it must not compete with the swipe), but
              always present: a problem can surface at any point of the stop. */}
          <button
            onClick={() => setReportOpen(true)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 py-2.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/10"
          >
            <AlertTriangle className="h-4 w-4" /> Report a problem with this stop
          </button>
        </div>

        {/* Swipe-to-confirm slider */}
        <div className="sticky bottom-0 z-10 bg-slate-950 px-4 py-3 sm:px-6">
          {error && (
            <div className="mb-2 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          <AnimatePresence mode="wait">
            {done ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-navy text-lg font-bold text-white"
              >
                <CheckCircle2 className="h-6 w-6" /> Confirmed!
              </motion.div>
            ) : (
              <SwipeToConfirm
                key="swipe"
                label={actionLabel}
                loading={confirming}
                onConfirm={handleDragEnd}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Incident reporter (phase 55) */}
      <ReportProblemDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        order={order}
        isPickup={isPickup}
      />
    </div>
  )
}

/** The "after accepting — what next?" card. A stop is always the same
 *  three moves in the same order: ride there, verify the items WITH the
 *  customer, swipe to confirm. Step 1 carries the action buttons — Navigate
 *  seeds Google Maps with this stop's address and draws the route from the
 *  rider's current location (the phase-59 fix for "it did not seed the
 *  address"); Call reaches the customer without leaving the screen. */
function StopSteps({ order, isPickup }: { order: any; isPickup: boolean }) {
  const customer = order.user

  const itemCount = (() => {
    try {
      const items = JSON.parse(order.itemsManifest || '[]')
      return items.reduce((s: number, i: any) => s + i.quantity, 0)
    } catch {
      return 0
    }
  })()

  const steps = [
    {
      title: isPickup ? 'Ride to the pickup address' : 'Ride to the delivery address',
      body: 'Navigate opens Google Maps with this stop already set and the route drawn from where you stand. Call if you can\u2019t find the gate.',
      actions: true as const,
    },
    {
      title: isPickup ? 'Count the items with the customer' : 'Hand over and count together',
      body:
        order.type === 'KG'
          ? 'Bulk laundry bag \u2014 the studio weighs it in.'
          : `${itemCount} item${itemCount === 1 ? '' : 's'} on the list \u2014 the count must match before you ride off. Spot something odd? Report it now, not later.`,
    },
    {
      title: isPickup ? 'Swipe to confirm pickup' : 'Swipe to confirm delivery',
      body: 'The slider at the bottom of this screen \u2014 your signature that the stop is done.',
    },
  ]

  return (
    <div className="mt-3 rounded-2xl bg-slate-800 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        At this stop — in this order
      </p>
      <ol className="mt-3 space-y-4">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                i === 0 ? 'bg-gold-400 text-navy' : 'bg-slate-700 text-slate-300'
              )}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">{s.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{s.body}</p>
              {'actions' in s && (
                <div className="mt-2 flex gap-2">
                  <a
                    href={navigationUrl(order)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-600 text-sm font-bold text-white shadow-lg active:scale-95 transition active:bg-cyan-700"
                  >
                    <Navigation className="h-4 w-4" /> Navigate
                  </a>
                  <a
                    href={`tel:${customer?.phone}`}
                    className="flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-700 px-4 text-sm font-bold text-white active:scale-95 transition active:bg-slate-600"
                  >
                    <Phone className="h-4 w-4" /> Call
                  </a>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Rider-side incident form: what happened + description → POST
 *  /api/orders/[id]/incident. On success the rider sees confirmation that
 *  the office was alerted (and is told to stay reachable) — the report is
 *  now the office's problem to chase, not the rider's to hide. */
function ReportProblemDialog({
  open,
  onOpenChange,
  order,
  isPickup,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  order: any
  isPickup: boolean
}) {
  const KINDS = [
    { value: 'DAMAGE', label: 'Damaged', hint: 'A garment got torn, stained or wet' },
    { value: 'LOSS', label: 'Lost / missing', hint: 'An item is missing from the manifest' },
    { value: 'THEFT', label: 'Theft', hint: 'Something was stolen' },
    { value: 'ACCIDENT', label: 'Accident / fall', hint: 'You came off the bike or crashed' },
    { value: 'OTHER', label: 'Other', hint: 'Anything else that needs the office' },
  ]
  const [kind, setKind] = useState('DAMAGE')
  const [description, setDescription] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const text = description.trim()
    if (text.length < 10) {
      setError('A little more detail, please — at least 10 characters.')
      return
    }
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/orders/${order.id}/incident`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, description: text, atStop: isPickup ? 'pickup' : 'delivery' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Send failed')
      setSent(true)
    } catch (e: any) {
      setError(e?.message || 'Could not send the report — call the office.')
    } finally {
      setSending(false)
    }
  }

  const close = (o: boolean) => {
    onOpenChange(o)
    if (!o) {
      // Reset for the next time it's needed.
      setTimeout(() => {
        setSent(false)
        setDescription('')
        setKind('DAMAGE')
        setError(null)
      }, 300)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="border-slate-700 bg-slate-900 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <AlertTriangle className="h-5 w-5 text-amber-400" /> Report a problem
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Order #{order.orderNumber} · {isPickup ? 'at pickup' : 'on delivery'}. The office is
            alerted the moment you send — reporting immediately is always the right move.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-emerald-400" />
            <p className="text-sm font-bold text-white">Reported — the office knows</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">
              Stay reachable: they will call you shortly. If a customer is waiting with you, tell
              them the office will make it right — you don&apos;t have to promise anything specific.
            </p>
            <Button
              onClick={() => close(false)}
              className="mt-3 w-full bg-navy text-white hover:bg-navy-500"
            >
              Back to the stop
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-300">What happened?</p>
              <div className="grid grid-cols-2 gap-2">
                {KINDS.map((k) => (
                  <button
                    key={k.value}
                    onClick={() => setKind(k.value)}
                    className={cn(
                      'rounded-xl border px-3 py-2.5 text-left transition',
                      kind === k.value
                        ? 'border-gold-400 bg-gold-400/10'
                        : 'border-slate-700 bg-slate-800/60 hover:border-slate-500'
                    )}
                  >
                    <span className="block text-sm font-semibold text-white">{k.label}</span>
                    <span className="block text-[10px] leading-snug text-slate-400">{k.hint}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-300">Tell us what happened</p>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="e.g. The customer's white shirt has a fresh oil stain down the sleeve — I spotted it while counting the items at the gate."
                className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-gold-400 focus:outline-none"
              />
              <p className="mt-1 text-right text-[10px] text-slate-500">{description.trim().length}/2000</p>
            </div>
            {error && (
              <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => close(false)}
                disabled={sending}
                className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                Never mind
              </Button>
              <Button
                onClick={submit}
                disabled={sending || description.trim().length < 10}
                className="bg-amber-600 text-white hover:bg-amber-700"
              >
                {sending ? 'Sending…' : 'Send report to the office'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SwipeToConfirm({
  label,
  loading,
  onConfirm,
}: {
  label: string
  loading: boolean
  onConfirm: (e: any, info: PanInfo) => void
}) {
  const [drag, setDrag] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={containerRef}
      className="relative flex h-16 items-center overflow-hidden rounded-2xl bg-slate-800"
    >
      {/* Track */}
      <div
        className="absolute inset-0 flex items-center justify-center text-sm font-medium text-slate-300"
        style={{ paddingLeft: 80 }}
      >
        {loading ? 'Confirming…' : label}
      </div>

      {/* Progress fill */}
      <motion.div
        className="absolute inset-y-0 left-0 rounded-2xl bg-gold-400/30"
        animate={{ width: 80 + drag }}
        transition={{ duration: 0 }}
      />

      {/* Knob */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 200 }}
        dragElastic={0.1}
        dragMomentum={false}
        onDrag={(_, info) => setDrag(Math.max(0, info.offset.x))}
        onDragEnd={(e, info) => {
          onConfirm(e, info)
          setDrag(0)
        }}
        whileTap={{ cursor: 'grabbing' }}
        className="relative z-10 ml-1 flex h-14 w-14 cursor-grab items-center justify-center rounded-full bg-navy text-white shadow-lg active:cursor-grabbing"
      >
        {loading ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Wind className="h-5 w-5" />
          </motion.div>
        ) : (
          <ChevronRight className="h-6 w-6" />
        )}
      </motion.div>
    </div>
  )
}
