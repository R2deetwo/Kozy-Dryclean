'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence, type PanInfo } from 'framer-motion'
import {
  Phone,
  Navigation,
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
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { useMemo } from 'react'
import { formatDate, type Order } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const DRIVER_ID = 'u-driver-2' // Bisi Adebayo — has LG-1002 out for delivery

export function DriverView() {
  const allUsers = useStore((s) => s.users)
  const allOrders = useStore((s) => s.orders)
  const drivers = useMemo(
    () => allUsers.filter((u) => u.role === 'DRIVER'),
    [allUsers]
  )
  const [driverId, setDriverId] = useState(DRIVER_ID)
  const orders = useMemo(
    () =>
      allOrders.filter(
        (o) =>
          o.driverId === driverId &&
          ['PICKED_UP', 'OUT_FOR_DELIVERY', 'PAYMENT_VERIFIED'].includes(o.status)
      ),
    [allOrders, driverId]
  )
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const selected = orders.find((o) => o.id === selectedId)

  const driver = drivers.find((d) => d.id === driverId)!

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
              <p className="text-xs uppercase tracking-wider text-emerald-400">Driver on duty</p>
              <p className="text-lg font-bold">{driver.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-amber-400" />
              <span className="text-xs text-slate-300">
                {new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <span className="text-xs text-slate-400">Active rider:</span>
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white"
            >
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
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
            <p className="text-2xl font-bold text-emerald-400">
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

        {/* Route header */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Route className="h-4 w-4 text-emerald-400" /> Your route today
          </h2>
          <span className="text-xs text-slate-400">
            {orders.length} stop{orders.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Stop cards */}
        {orders.length === 0 ? (
          <div className="rounded-xl bg-slate-800 p-8 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-emerald-500" />
            <p className="font-semibold text-white">Route complete!</p>
            <p className="mt-1 text-xs text-slate-400">
              No pickups or deliveries assigned right now.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((o, i) => (
              <DriverStopCard
                key={o.id}
                order={o}
                index={i + 1}
                onOpen={() => setSelectedId(o.id)}
              />
            ))}
          </ul>
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
  onOpen,
}: {
  order: Order
  index: number
  onOpen: () => void
}) {
  const users = useStore((s) => s.users)
  const customer = users.find((u) => u.id === order.userId)
  const isPickup = order.status === 'PAYMENT_VERIFIED'
  const isDrop = order.status === 'OUT_FOR_DELIVERY'

  return (
    <motion.button
      onClick={onOpen}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'relative w-full overflow-hidden rounded-2xl p-4 text-left shadow-lg',
        isPickup && 'bg-gradient-to-br from-emerald-600 to-teal-700',
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
        <span className="rounded-full bg-white/15 px-2 py-0.5 font-mono text-[10px]">
          #{order.orderNumber}
        </span>
      </div>

      {order.type === 'ITEM' && order.items.length > 0 && (
        <div className="mt-2 text-xs text-white/80">
          {order.items.reduce((s, i) => s + i.quantity, 0)} items ·{' '}
          {order.items.slice(0, 2).map((i) => `${i.quantity}× ${i.name}`).join(', ')}
          {order.items.length > 2 && ` +${order.items.length - 2} more`}
        </div>
      )}
      {order.type === 'KG' && (
        <div className="mt-2 text-xs text-white/80">
          Bulk laundry — {order.finalWeight ? `${order.finalWeight}kg` : 'weigh at station'}
        </div>
      )}
    </motion.button>
  )
}

function DriverOrderDetail({ order, onBack }: { order: Order; onBack: () => void }) {
  const users = useStore((s) => s.users)
  const customer = users.find((u) => u.id === order.userId)
  const updateStatus = useStore((s) => s.updateOrderStatus)

  const isPickup = order.status === 'PAYMENT_VERIFIED'
  const actionLabel = isPickup ? 'Swipe to confirm pickup' : 'Swipe to confirm delivery'
  const actionVerb = isPickup ? 'PICKED UP' : 'DELIVERED'

  const [confirming, setConfirming] = useState(false)
  const [done, setDone] = useState(false)

  const handleDragEnd = (_e: any, info: PanInfo) => {
    if (info.offset.x > 180) {
      setConfirming(true)
      // simulate API call
      setTimeout(() => {
        updateStatus(order.id, actionVerb as any, order.driverId)
        setConfirming(false)
        setDone(true)
        setTimeout(() => onBack(), 1200)
      }, 600)
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
            isPickup ? 'bg-emerald-600' : 'bg-cyan-600'
          )}
        >
          {isPickup ? 'COLLECT FROM CUSTOMER' : 'DELIVER TO CUSTOMER'}
        </div>

        {/* Customer card */}
        <div className="p-4 sm:p-6">
          <div className="rounded-2xl bg-slate-800 p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-lg font-bold text-white">
                  {customer?.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{customer?.name}</p>
                  <p className="text-xs text-slate-400">Customer</p>
                </div>
              </div>
              {order.guaranteeActive && (
                <Badge className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20">
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
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-bold text-white shadow-lg active:scale-95"
            >
              <Phone className="h-5 w-5" /> Call
            </a>
            <a
              href="https://www.google.com/maps"
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
              <ListChecks className="h-4 w-4 text-emerald-400" />
              {isPickup ? 'Items to collect' : 'Items to deliver'}
            </p>
            {order.type === 'ITEM' ? (
              <ul className="mt-2 space-y-1.5">
                {order.items.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center justify-between rounded-lg bg-slate-900/60 px-3 py-2 text-sm"
                  >
                    <span className="text-white">
                      <span className="mr-1 font-bold text-emerald-400">{i.quantity}×</span>
                      {i.name}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
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
              <p className="mt-2 flex items-center gap-1 text-xs text-emerald-300">
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
          <AnimatePresence mode="wait">
            {done ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-lg font-bold text-white"
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
        className="absolute inset-y-0 left-0 rounded-2xl bg-emerald-600/30"
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
        className="relative z-10 ml-1 flex h-14 w-14 cursor-grab items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg active:cursor-grabbing"
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
