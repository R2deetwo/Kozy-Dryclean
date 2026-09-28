'use client'

// =============================================================================
// PARTNER ACCOUNT TAB (phase 72) — what the partner owns outside the floor
// =============================================================================
// Business profile (read-only — changes go through the office, like every
// console role) · the settlement bank account (self-service, same PATCH the
// rider app uses) · password · sign out. The bank card is the money-facing
// twin of the rider app's: settlements go to whatever is listed here.
// =============================================================================

import { useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Landmark,
  KeyRound,
  LogOut,
  CheckCircle2,
  Store,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface MeProfile {
  name: string
  phone: string
  email: string
  createdAt: string
  bankName?: string | null
  bankAccountNumber?: string | null
  bankAccountName?: string | null
}

interface PartnerInfo {
  businessName: string
  contactName: string
  email: string
  phone: string
  address: string
  lga: string | null
  servicesOffered: string | null
  revenueSharePartnerPct: number
}

export function PartnerAccountTab({
  partner,
  onOpenPassword,
}: {
  partner: PartnerInfo | null
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
      <BusinessCard partner={partner} me={me} />
      <BankDetailsCard me={me} />
      <PasswordCard onOpen={onOpenPassword} />
      <button
        onClick={() => signOut({ callbackUrl: '/' })}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-600/10 py-3 text-sm font-semibold text-rose-300 transition hover:bg-rose-600/20"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
      <p className="text-center text-[10px] text-slate-500">
        Kozy Care partner portal · {new Date().getFullYear()}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------- Business
function BusinessCard({ partner, me }: { partner: PartnerInfo | null; me: MeProfile | null }) {
  return (
    <div className="rounded-2xl bg-slate-800 p-5">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-navy text-lg font-bold text-gold-300">
          <Store className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-white">
            {partner?.businessName ?? me?.name ?? 'Partner'}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <Building2 className="h-3 w-3" /> Kozy Network · {partner?.revenueSharePartnerPct ?? '—'}% share
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-1 rounded-xl bg-slate-900/60 p-3 text-xs">
        {(partner?.contactName || me?.name) && (
          <p className="flex items-center justify-between gap-2 text-slate-300">
            <span className="text-slate-500">Contact</span>
            <span>{partner?.contactName ?? me?.name}</span>
          </p>
        )}
        {(partner?.phone || me?.phone) && (
          <p className="flex items-center justify-between gap-2 text-slate-300">
            <span className="text-slate-500">Phone</span>
            <span className="font-mono">{partner?.phone ?? me?.phone}</span>
          </p>
        )}
        {(partner?.email || me?.email) && (
          <p className="flex items-center justify-between gap-2 text-slate-300">
            <span className="text-slate-500">Sign-in email</span>
            <span className="truncate font-mono text-[10px]">{partner?.email ?? me?.email}</span>
          </p>
        )}
        {partner?.address && (
          <p className="flex items-start justify-between gap-2 text-slate-300">
            <span className="shrink-0 text-slate-500">Address</span>
            <span className="text-right">
              {partner.address}
              {partner.lga ? `, ${partner.lga}` : ''}
            </span>
          </p>
        )}
        {partner?.servicesOffered && (
          <p className="flex items-start justify-between gap-2 text-slate-300">
            <span className="shrink-0 text-slate-500">Services</span>
            <span className="text-right">{partner.servicesOffered}</span>
          </p>
        )}
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
        Business details are managed by the Kozy Care office — call us for any change (contact,
        address, share). Your sign-in and payout account below are yours to edit.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------- Bank
// Same card as the rider app's Account tab (phase 72) — the settlement
// account. Self-service: the partner enters it, the office pays what is
// listed.
function BankDetailsCard({ me }: { me: MeProfile | null }) {
  const set = Boolean(me?.bankName && me?.bankAccountNumber && me?.bankAccountName)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [form, setForm] = useState({ bankName: '', bankAccountNumber: '', bankAccountName: '' })

  const startEdit = () => {
    setForm({
      bankName: me?.bankName ?? '',
      bankAccountNumber: me?.bankAccountNumber ?? '',
      bankAccountName: me?.bankAccountName ?? me?.name ?? '',
    })
    setNote(null)
    setEditing(true)
  }

  const save = async () => {
    if (busy) return
    setBusy(true)
    setNote(null)
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setNote(data?.error ?? 'Could not save — check the details and try again.')
        return
      }
      if (me) {
        me.bankName = data.bank?.bankName ?? form.bankName
        me.bankAccountNumber = data.bank?.bankAccountNumber ?? form.bankAccountNumber
        me.bankAccountName = data.bank?.bankAccountName ?? form.bankAccountName
      }
      setEditing(false)
      setNote('Saved — settlements will be sent to this account.')
    } catch {
      setNote('Network hiccup — try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    'mt-1 w-full rounded-lg border border-slate-600 bg-slate-900/70 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-gold-400 focus:outline-none'

  return (
    <div className="rounded-2xl bg-slate-800 p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-bold text-white">
          <Landmark className="h-4 w-4 text-gold-400" /> Settlement bank account
        </p>
        <button
          onClick={editing ? () => setEditing(false) : startEdit}
          className="rounded-full border border-slate-600 px-3 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-gold-400 hover:text-gold-300"
        >
          {editing ? 'Cancel' : set ? 'Update' : 'Add'}
        </button>
      </div>

      {editing ? (
        <div className="mt-3 space-y-2.5">
          <div>
            <label className="text-[11px] font-medium text-slate-400">Bank</label>
            <input
              value={form.bankName}
              onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
              placeholder="e.g. GTBank"
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400">Account number</label>
            <input
              value={form.bankAccountNumber}
              onChange={(e) =>
                setForm((f) => ({ ...f, bankAccountNumber: e.target.value.replace(/\D/g, '') }))
              }
              inputMode="numeric"
              placeholder="10 digits, as printed by your bank"
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400">Account name</label>
            <input
              value={form.bankAccountName}
              onChange={(e) => setForm((f) => ({ ...f, bankAccountName: e.target.value }))}
              placeholder="The name on the account"
              className={inputClass}
            />
          </div>
          <button
            onClick={save}
            disabled={busy}
            className="w-full rounded-xl bg-gold-gradient py-2.5 text-sm font-bold text-navy transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save settlement account'}
          </button>
        </div>
      ) : set ? (
        <div className="mt-3 space-y-1 rounded-xl bg-slate-900/60 p-3 text-xs">
          <p className="flex items-center justify-between gap-2 text-slate-300">
            <span className="text-slate-500">Bank</span>
            <span>{me?.bankName}</span>
          </p>
          <p className="flex items-center justify-between gap-2 text-slate-300">
            <span className="text-slate-500">Account</span>
            <span className="font-mono">{me?.bankAccountNumber}</span>
          </p>
          <p className="flex items-center justify-between gap-2 text-slate-300">
            <span className="text-slate-500">Name</span>
            <span className="truncate">{me?.bankAccountName}</span>
          </p>
        </div>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          Not set yet. Your revenue-share settlements are sent to the account you list here — add
          one so the money reaches the business first time.
        </p>
      )}

      {note && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
          <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
          {note}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Password
function PasswordCard({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center justify-between rounded-2xl bg-slate-800 px-5 py-4 text-left transition hover:bg-slate-700/60"
    >
      <span className="flex items-center gap-2.5 text-sm font-semibold text-white">
        <KeyRound className="h-4 w-4 text-gold-400" /> Change password
      </span>
      <span className="text-xs text-slate-500">Your sign-in</span>
    </button>
  )
}
