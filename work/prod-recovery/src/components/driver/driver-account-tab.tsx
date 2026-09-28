'use client'

// =============================================================================
// ACCOUNT TAB (phase 61) — everything a rider owns outside the route
// =============================================================================
// Profile · notifications (app push + the WhatsApp bridge) · install the app
// on the phone · care & safety rules · password · sign out. The
// notifications section is the owner's "riders don't have to watch the
// website" answer made real: a rider who turns on stop notifications gets a
// system-level push on assignment — browser closed or not (Android) — and
// the WhatsApp row verifies the number the office's one-tap bridge uses.
// =============================================================================

import { useEffect, useState, useCallback } from 'react'
import { signOut } from 'next-auth/react'
import {
  User as UserIcon,
  Bell,
  BellRing,
  ShieldCheck,
  KeyRound,
  LogOut,
  Download,
  Smartphone,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { waLink } from '@/lib/whatsapp'

interface MeProfile {
  name: string
  phone: string
  email: string
  createdAt: string
}

function deviceLabel(): string {
  if (typeof navigator === 'undefined') return 'This device'
  const ua = navigator.userAgent
  const isAndroid = /Android/i.test(ua)
  const isIOS = /iPhone|iPad|iPod/i.test(ua)
  const chrome = /Chrome/i.test(ua) && !/Edg|OPR/i.test(ua)
  const safari = /Safari/i.test(ua) && !/Chrome/i.test(ua)
  const browser = chrome ? 'Chrome' : safari ? 'Safari' : /Firefox/i.test(ua) ? 'Firefox' : 'browser'
  return `${browser} on ${isAndroid ? 'Android' : isIOS ? 'iPhone' : 'this device'}`
}

export function DriverAccountTab({
  onOpenRules,
  onOpenPassword,
}: {
  onOpenRules: () => void
  onOpenPassword: () => void
}) {
  const [me, setMe] = useState<MeProfile | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/users/me')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('me failed'))))
      .then((d) => {
        if (alive && d?.user) setMe(d.user)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="space-y-4 pb-2">
      <ProfileCard me={me} />
      <NotificationsCard me={me} />
      <InstallCard />
      <RulesCard onOpen={onOpenRules} />
      <PasswordCard onOpen={onOpenPassword} />
      <button
        onClick={() => signOut({ callbackUrl: '/' })}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-600/10 py-3 text-sm font-semibold text-rose-300 transition hover:bg-rose-600/20"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
      <p className="text-center text-[10px] text-slate-500">
        Kozy Care rider app · {new Date().getFullYear()}
      </p>
    </div>
  )
}

// ------------------------------------------------------------------- Profile
function ProfileCard({ me }: { me: MeProfile | null }) {
  const initials = (me?.name ?? 'R')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <div className="rounded-2xl bg-slate-800 p-5">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-navy text-lg font-bold text-gold-300">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-white">{me?.name ?? 'Rider'}</p>
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <UserIcon className="h-3 w-3" /> Kozy Care rider
          </p>
        </div>
      </div>
      {(me?.phone || me?.email) && (
        <div className="mt-4 space-y-1 rounded-xl bg-slate-900/60 p-3 text-xs">
          {me?.phone && (
            <p className="flex items-center justify-between gap-2 text-slate-300">
              <span className="text-slate-500">Phone</span>
              <span className="font-mono">{me.phone}</span>
            </p>
          )}
          {me?.email && (
            <p className="flex items-center justify-between gap-2 text-slate-300">
              <span className="text-slate-500">Sign-in email</span>
              <span className="truncate font-mono text-[10px]">{me.email}</span>
            </p>
          )}
          {me?.createdAt && (
            <p className="flex items-center justify-between gap-2 text-slate-300">
              <span className="text-slate-500">Riding since</span>
              <span>
                {new Date(me.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------ Notifications
function NotificationsCard({ me }: { me: MeProfile | null }) {
  const pushSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window

  const [permission, setPermission] = useState<string>('default')
  const [pushedOn, setPushedOn] = useState<boolean | null>(null) // null = checking
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    if (!pushSupported) return
    setPermission(Notification.permission)
    let alive = true
    ;(async () => {
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (alive) setPushedOn(Boolean(sub))
      } catch {
        if (alive) setPushedOn(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [pushSupported])

  const enablePush = useCallback(async () => {
    setBusy(true)
    setNote(null)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') {
        setNote('Notifications are blocked for this site — allow them in your browser settings, then try again.')
        return
      }
      const keyRes = await fetch('/api/push/key')
      const keyData = await keyRes.json()
      if (!keyData?.available) {
        setNote('Push is not configured on the server yet — the office has been notified by this message.')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(keyData.publicKey),
        }))
      const raw = sub.toJSON()
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: {
            endpoint: raw.endpoint,
            keys: { p256dh: raw.keys?.p256dh, auth: raw.keys?.auth },
          },
          device: deviceLabel(),
        }),
      })
      if (!res.ok) throw new Error('save failed')
      setPushedOn(true)
      setNote('On — the office can now reach this device the moment a stop is assigned.')
    } catch (e: any) {
      setNote(e?.message === 'save failed' ? 'Could not save this device — try again.' : 'Could not turn on notifications — try again.')
    } finally {
      setBusy(false)
    }
  }, [])

  const disablePush = useCallback(async () => {
    setBusy(true)
    setNote(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: { endpoint: sub.endpoint } }),
        })
      }
      setPushedOn(false)
      setNote('Off — no more notifications on this device.')
    } catch {
      setNote('Could not turn notifications off — try again.')
    } finally {
      setBusy(false)
    }
  }, [])

  const on = pushedOn === true && permission === 'granted'
  const waSelf = waLink(
    me?.phone,
    'Kozy Care rider app — WhatsApp test. If you can read this, the office can reach you here for new stops.'
  )

  return (
    <div className="rounded-2xl bg-slate-800 p-5">
      <p className="flex items-center gap-2 text-sm font-bold text-white">
        {on ? (
          <BellRing className="h-4 w-4 text-emerald-400" />
        ) : (
          <Bell className="h-4 w-4 text-gold-400" />
        )}
        Notifications
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">
        Turn these on and new stops find YOU — the phone rings even when the
        app is closed. No more watching the screen for the next job.
      </p>

      {/* App push toggle */}
      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-slate-900/60 p-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white">Stop notifications</p>
          <p className="mt-0.5 text-[10px] leading-snug text-slate-500">
            {pushSupported
              ? pushedOn === null
                ? 'Checking this device…'
                : on
                ? `${deviceLabel()} — receiving assignments`
                : 'Off on this device'
              : 'This browser does not support push — install the app or use Chrome on Android.'}
          </p>
        </div>
        {pushSupported && (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            disabled={busy || pushedOn === null}
            onClick={() => (on ? disablePush() : enablePush())}
            className={cn(
              'relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50',
              on ? 'bg-emerald-500' : 'bg-slate-600'
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all',
                on ? 'left-[22px]' : 'left-0.5'
              )}
            />
          </button>
        )}
      </div>

      {/* WhatsApp bridge row */}
      <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-slate-900/60 p-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <MessageCircle className="h-3.5 w-3.5 text-emerald-400" /> WhatsApp
          </p>
          <p className="mt-0.5 text-[10px] leading-snug text-slate-500">
            {me?.phone
              ? 'Test the number the office pings for new stops.'
              : 'No phone number on your profile yet — ask the office to add one.'}
          </p>
        </div>
        {waSelf && (
          <a
            href={waSelf}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-emerald-600 px-3 text-[11px] font-bold text-white transition active:scale-95 hover:bg-emerald-500"
          >
            <MessageCircle className="h-3 w-3" /> Send test
          </a>
        )}
      </div>

      {note && (
        <p
          className={cn(
            'mt-3 flex items-start gap-1.5 rounded-lg px-3 py-2 text-[11px] leading-snug',
            note.startsWith('On')
              ? 'bg-emerald-500/10 text-emerald-300'
              : 'bg-slate-700/40 text-slate-300'
          )}
        >
          {note.startsWith('On') ? (
            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          )}
          {note}
        </p>
      )}
    </div>
  )
}

function urlB64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i)
  return output
}

// ------------------------------------------------------------------- Install
function InstallCard() {
  const [deferred, setDeferred] = useState<any>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!deferred) return
    deferred.prompt()
    const choice = await deferred.userChoice.catch(() => null)
    if (choice?.outcome === 'accepted') setDeferred(null)
  }

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isIOS = /iPhone|iPad|iPod/i.test(ua)
  const standalone =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true)

  if (standalone) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
        <p className="text-xs leading-relaxed text-emerald-200/90">
          This is the installed app — notifications work even when it&apos;s closed.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-slate-800 p-5">
      <p className="flex items-center gap-2 text-sm font-bold text-white">
        <Smartphone className="h-4 w-4 text-gold-400" /> Get the app on your phone
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">
        Kozy Rider installs straight from this page — an icon on your home
        screen, full-screen, with notifications that reach you when the
        browser is closed.
      </p>
      {deferred ? (
        <button
          type="button"
          onClick={install}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gold-400 py-3 text-sm font-bold text-navy transition active:scale-[0.98] hover:bg-gold-300"
        >
          <Download className="h-4 w-4" /> Install Kozy Rider
        </button>
      ) : (
        <div className="mt-3 rounded-xl bg-slate-900/60 p-3 text-[11px] leading-relaxed text-slate-400">
          {isIOS ? (
            <>
              On iPhone: tap <span className="font-semibold text-white">Share</span> →{' '}
              <span className="font-semibold text-white">Add to Home Screen</span>.
            </>
          ) : (
            <>
              In Chrome&apos;s <span className="font-semibold text-white">⋮ menu</span>, tap{' '}
              <span className="font-semibold text-white">Install app</span> (or{' '}
              <span className="font-semibold text-white">Add to Home screen</span>).
            </>
          )}
        </div>
      )}
    </div>
  )
}

// --------------------------------------------------------------------- Rules
function RulesCard({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center justify-between gap-3 rounded-2xl bg-slate-800 p-5 text-left transition hover:bg-slate-700/70"
    >
      <div>
        <p className="flex items-center gap-2 text-sm font-bold text-white">
          <ShieldCheck className="h-4 w-4 text-gold-400" /> Care &amp; safety rules
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Garment care, Lagos road law, the no-cash rule — the duty-of-care brief.
        </p>
      </div>
      <span className="text-slate-500">›</span>
    </button>
  )
}

// ------------------------------------------------------------------ Password
function PasswordCard({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center justify-between gap-3 rounded-2xl bg-slate-800 p-5 text-left transition hover:bg-slate-700/70"
    >
      <div>
        <p className="flex items-center gap-2 text-sm font-bold text-white">
          <KeyRound className="h-4 w-4 text-gold-400" /> Password
        </p>
        <p className="mt-1 text-xs text-slate-400">Change your sign-in password.</p>
      </div>
      <span className="text-slate-500">›</span>
    </button>
  )
}

export function BusySpinner() {
  return <Loader2 className="h-4 w-4 animate-spin" />
}
