'use client'

import { useState, useRef } from 'react'
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
  User,
  Sun,
  Wind,
  Check,
  AlertCircle,
  Route,
  ListChecks,
  LogOut,
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useOrders, useUpdateOrder } from '@/lib/hooks'
import { useMemo } from 'react'
import { formatDate, type Order } from '@/lib/types'
import { orderDistanceKm } from '@/lib/geo'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  useDriverGeofence,
  DriverGeofencePill,
  DriverGeofenceBanner,
} from '@/components/driver/driver-geofence'

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

  // The API already filters orders to the logged-in driver (RBAC)
  // For now, show all orders returned (driver sees only their own).
  // While paused (outside the geofence) the server would return no stops —
  // mirror that client-side so no stale route lingers on screen.
  const orders = ordersPaused
    ? []
    : (allOrders ?? []).filter((o: any) =>
        ['PICKED_UP', 'OUT_FOR_DELIVERY', 'PAYMENT_VERIFIED'].includes(o.status)
      )
  const selected = orders.find((o: any) => o.id === selectedId)

  const driverName = session?.user?.name ?? 'Driver'

  if (selected) {
    return (
      <DriverOrderDetail
        order={selected}
        onBack={() => setSelectedId(undefined)}
      />
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
              <Sun className="h-4 w-4 text-amber-400" />
              <span className="text-xs text-slate-300">
                {new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="flex items-center gap-1 rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-rose-700"
              >
                <LogOut className="h-3 w-3" /> Sign out
              </button>
            </div>
          </div>
          {/* Stats */}
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 py-4 sm:px-6">
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
          Tap any card to see details and swipe-to-confirm the action.
        </p>
      </div>
    </div>
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

  // Straight-line distance from the rider's last GPS fix to the stop's zone
  const stop =
    geofence.lat != null && geofence.lng != null
      ? orderDistanceKm(geofence.lat, geofence.lng, order.pickupAddress)
      : null

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
            <Badge className="bg-white/20 text-white hover:bg-white/20">
              <Package className="mr-1 h-3 w-3" /> Pickup
            </Badge>
          )}
          {isDrop && (
            <Badge className="bg-white/20 text-white hover:bg-white/20">
              <Truck className="mr-1 h-3 w-3" /> Delivery
            </Badge>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-white/70" />
      </div>

      <p className="mt-3 text-base font-bold text-white">{customer?.name}</p>
      <p className="mt-1 flex items-start gap-1 text-xs text-white/80">
        <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
        {order.pickupAddress}
      </p>

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-white/70">
          <Clock className="h-3 w-3" />
          {order.pickupTimeSlot}
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

function DriverOrderDetail({ order, onBack }: { order: any; onBack: () => void }) {
  const customer = order.user
  const updateOrderMutation = useUpdateOrder()

  const isPickup = order.status === 'PAYMENT_VERIFIED'
  const actionLabel = isPickup ? 'Swipe to confirm pickup' : 'Swipe to confirm delivery'
  const actionVerb = isPickup ? 'PICKED_UP' : 'DELIVERED'

  const [confirming, setConfirming] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

        {/* Action banner */}
        <div
          className={cn(
            'px-4 py-3 text-center text-sm font-semibold sm:px-6',
            isPickup ? 'bg-navy' : 'bg-navy-500'
          )}
        >
          {isPickup ? 'COLLECT FROM CUSTOMER' : 'DELIVER TO CUSTOMER'}
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

            {/* Address */}
            <div className="mt-4 rounded-xl bg-slate-900/60 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <MapPin className="h-3.5 w-3.5" /> Address
              </p>
              <p className="mt-1 text-sm text-white">
                {isPickup ? order.pickupAddress : order.deliveryAddress ?? order.pickupAddress}
              </p>
            </div>

            {/* Slot */}
            <div className="mt-2 rounded-xl bg-slate-900/60 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <Clock className="h-3.5 w-3.5" /> Time window
              </p>
              <p className="mt-1 text-sm text-white">
                {formatDate(order.pickupDate)} · {order.pickupTimeSlot}
              </p>
            </div>
          </div>

          {/* Large action buttons */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <a
              href={`tel:${customer?.phone}`}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-navy text-base font-bold text-white shadow-lg active:scale-95"
            >
              <Phone className="h-5 w-5" /> Call
            </a>
            <a
              href={`https://www.google.com/maps/search/?api=1&destination=${encodeURIComponent(
                isPickup ? order.pickupAddress : order.deliveryAddress ?? order.pickupAddress
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-cyan-600 text-base font-bold text-white shadow-lg active:scale-95"
            >
              <Navigation className="h-5 w-5" /> Navigate
            </a>
          </div>

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
          </div>

          {/* Items handled indicator */}
          <p className="mt-4 text-center text-[10px] text-slate-500">
            Financial details hidden — driver role restricts access to payment fields.
          </p>
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
    </div>
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
