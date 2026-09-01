'use client'

// =============================================================================
// Rider geofencing — client side
// =============================================================================
// useDriverGeofence(): tracks the rider's GPS position (permission-gated),
// pings the server ~once a minute, and exposes the fence status so the driver
// app can pause order activity while the rider is outside the service area.
//
// DriverGeofenceStatus / DriverGeofenceBanner: the UI that tells the rider
// where they stand ("In Lekki · 2.1 km to hub" / "Outside all service areas").
// =============================================================================

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { MapPin, LocateFixed, ShieldAlert, Navigation2 } from 'lucide-react'

export type GeofenceStatus =
  | 'locating' // getting the first GPS fix
  | 'in' // inside a service zone — full activity
  | 'outside' // outside every zone — activity paused
  | 'denied' // browser permission denied
  | 'unsupported' // no Geolocation API
  | 'error' // GPS or network error
  | 'off' // tracking not enabled

export interface GeofenceState {
  status: GeofenceStatus
  zone?: string
  distanceKm?: number
  lat?: number
  lng?: number
  updatedAt?: string
}

// Ping the server at most once a minute (watchPosition fires much more often).
const PING_THROTTLE_MS = 60_000

export function useDriverGeofence(enabled: boolean): GeofenceState {
  const [state, setState] = useState<GeofenceState>({ status: 'locating' })
  const lastPingAt = useRef(0)

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'off' })
      return
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({ status: 'unsupported' })
      return
    }

    let cancelled = false

    const ping = async (lat: number, lng: number) => {
      const now = Date.now()
      if (now - lastPingAt.current < PING_THROTTLE_MS) return
      lastPingAt.current = now
      try {
        const res = await fetch('/api/driver/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng }),
        })
        if (!res.ok) throw new Error('ping failed')
        const data = await res.json()
        if (!cancelled) {
          setState({
            status: data.inServiceArea ? 'in' : 'outside',
            zone: data.zone,
            distanceKm: data.distanceKm,
            lat,
            lng,
            updatedAt: data.location?.updatedAt,
          })
        }
      } catch {
        // Keep the last known status; only flag an error if we never got one.
        if (!cancelled) {
          setState((s) =>
            s.status === 'in' || s.status === 'outside' ? s : { status: 'error' }
          )
        }
      }
    }

    const onError = (err: GeolocationPositionError) => {
      if (cancelled) return
      setState({
        status: err.code === err.PERMISSION_DENIED ? 'denied' : 'error',
      })
    }

    // First fix right away, then continuous tracking (throttled pings).
    navigator.geolocation.getCurrentPosition(
      (pos) => ping(pos.coords.latitude, pos.coords.longitude),
      onError,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    )

    const watchId = navigator.geolocation.watchPosition(
      (pos) => ping(pos.coords.latitude, pos.coords.longitude),
      () => {}, // watch errors surface via getCurrentPosition / stale status
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 15000 }
    )

    return () => {
      cancelled = true
      navigator.geolocation.clearWatch(watchId)
    }
  }, [enabled])

  return state
}

// -----------------------------------------------------------------------------
// UI — compact status pill for the driver header
// -----------------------------------------------------------------------------
export function DriverGeofencePill({ state }: { state: GeofenceState }) {
  if (state.status === 'in') {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        {state.zone} · {state.distanceKm} km
      </span>
    )
  }
  if (state.status === 'outside') {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
        <ShieldAlert className="h-3 w-3" />
        Outside area · {state.distanceKm} km
      </span>
    )
  }
  if (state.status === 'locating') {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-slate-700/60 px-2.5 py-1 text-[11px] font-medium text-slate-300">
        <LocateFixed className="h-3 w-3 animate-pulse" />
        Locating…
      </span>
    )
  }
  if (state.status === 'denied') {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-slate-700/60 px-2.5 py-1 text-[11px] font-medium text-slate-300">
        <MapPin className="h-3 w-3" />
        Location off
      </span>
    )
  }
  return null
}

// -----------------------------------------------------------------------------
// UI — banner between stats and route list
// -----------------------------------------------------------------------------
export function DriverGeofenceBanner({ state }: { state: GeofenceState }) {
  if (state.status === 'outside') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
      >
        <p className="flex items-center gap-2 text-sm font-bold text-amber-300">
          <ShieldAlert className="h-4 w-4" /> Order activity paused
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-amber-200/80">
          You&apos;re outside all Kozy service areas — nearest zone is{' '}
          <span className="font-semibold text-amber-200">
            {state.zone} ({state.distanceKm} km away)
          </span>
          . Pickups and deliveries resume automatically once you&apos;re back in a
          service area.
        </p>
      </motion.div>
    )
  }
  if (state.status === 'denied') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 rounded-xl border border-slate-700 bg-slate-800/60 p-4"
      >
        <p className="flex items-center gap-2 text-sm font-bold text-slate-200">
          <MapPin className="h-4 w-4 text-gold-400" /> Location access is off
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
          Kozy can&apos;t confirm you&apos;re inside a service area, so all assigned
          stops are shown. To see only stops near you, allow location for this
          site in your browser settings, then reload.
        </p>
      </motion.div>
    )
  }
  if (state.status === 'in') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5"
      >
        <Navigation2 className="h-3.5 w-3.5 text-emerald-400" />
        <p className="text-xs text-emerald-200/80">
          Live in <span className="font-semibold text-emerald-300">{state.zone}</span>{' '}
          — showing stops within 12 km of you.
        </p>
      </motion.div>
    )
  }
  return null
}
