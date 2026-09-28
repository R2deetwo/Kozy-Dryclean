'use client'

// =============================================================================
// BranchesTab — Settings → Branches (phase 62)
// =============================================================================
// The owner's locations as first-class entities: name, address, the service
// zones each branch owns (which decides where a pickup lands), and which
// branch is the default fallback. Editing zones here changes tomorrow's
// order assignments — no deploy, no developer.
// =============================================================================

import { useState } from 'react'
import { MapPin, Save, Loader2, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import { useBranches, useSaveBranches, type ApiBranch } from '@/lib/hooks'
import { SERVICE_ZONES } from '@/lib/geo'
import { cn } from '@/lib/utils'

type BranchDraft = ApiBranch & { _dirty?: boolean }

export function BranchesTab() {
  const { data: branches, isLoading } = useBranches()
  const save = useSaveBranches()

  // Draft pattern: `edited` is null until the first edit — the view mirrors
  // the server branches directly. Saving returns to mirroring.
  const [edited, setEdited] = useState<BranchDraft[] | null>(null)
  const drafts: BranchDraft[] = edited ?? (branches ?? []).map((b) => ({ ...b }))

  const dirty = Boolean(edited) && drafts.some((d) => d._dirty)

  const patch = (id: string, key: keyof ApiBranch, value: any) =>
    setEdited(drafts.map((d) => (d.id === id ? { ...d, [key]: value, _dirty: true } : d)))

  const toggleZone = (id: string, zone: string) =>
    setEdited(
      drafts.map((d) =>
        d.id === id
          ? {
              ...d,
              zoneNames: d.zoneNames.includes(zone)
                ? d.zoneNames.filter((z) => z !== zone)
                : [...d.zoneNames, zone],
              _dirty: true,
            }
          : d
      )
    )

  const setDefault = (id: string) =>
    setEdited(drafts.map((d) => ({ ...d, isDefault: d.id === id, _dirty: true })))

  const onSave = async () => {
    try {
      await save.mutateAsync(
        drafts.map(({ _dirty, ...d }) => d as ApiBranch & { id: string })
      )
      setEdited(null)
      toast({
        title: 'Branches saved',
        description: 'New pickups will land according to these zones from the next booking.',
      })
    } catch (e: any) {
      toast({ title: 'Could not save', description: e?.message, variant: 'destructive' })
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-navy-300" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {drafts.map((b) => (
        <Card key={b.id} className="border-navy-100 shadow-navy">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 font-serif text-navy">
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gold-400" /> {b.name}
                {b.isDefault && (
                  <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-navy">
                    default
                  </span>
                )}
              </span>
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-navy-300">
                <input
                  type="checkbox"
                  checked={b.isActive}
                  onChange={(e) => patch(b.id, 'isActive', e.target.checked)}
                  className="h-3.5 w-3.5 accent-[#0A192F]"
                />
                {b.isActive ? 'Active' : 'Inactive'}
              </label>
            </CardTitle>
            <p className="text-xs text-navy-300">
              Pickups addressed to this branch&apos;s zones land here; unmatched addresses fall to
              the nearest active branch.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-navy-300">
                  Branch name
                </label>
                <Input
                  value={b.name}
                  onChange={(e) => patch(b.id, 'name', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-navy-300">
                  Phone
                </label>
                <Input
                  value={b.phone ?? ''}
                  onChange={(e) => patch(b.id, 'phone', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-navy-300">
                  Address
                </label>
                <Input
                  value={b.address}
                  onChange={(e) => patch(b.id, 'address', e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-navy-300">
                Service zones owned by this branch
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SERVICE_ZONES.map((z) => {
                  const on = b.zoneNames.includes(z.name)
                  return (
                    <button
                      key={z.name}
                      onClick={() => toggleZone(b.id, z.name)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
                        on
                          ? 'border-navy bg-navy text-white'
                          : 'border-navy-200 bg-white text-navy-300 hover:border-gold-300'
                      )}
                    >
                      {z.name}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[11px] text-navy-300">
                {b.zoneNames.length} zone{b.zoneNames.length === 1 ? '' : 's'} owned
              </p>
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-navy-300">
                <input
                  type="radio"
                  name="default-branch"
                  checked={b.isDefault}
                  onChange={() => setDefault(b.id)}
                  className="h-3.5 w-3.5 accent-[#0A192F]"
                />
                Default fallback branch
              </label>
            </div>

            {/* Phase 69 — ownership. COMPANY = ours end-to-end; FRANCHISE =
                partner-run under Kozy Care standards (gold treatment in the
                console, revenue-share ledger via the Partners tab). */}
            <div className="rounded-xl border border-navy-100 bg-linen-50/60 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-navy-300">
                Ownership
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {(['COMPANY', 'FRANCHISE'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => patch(b.id, 'ownershipType', t)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-[11px] font-medium transition',
                      (b.ownershipType ?? 'COMPANY') === t
                        ? t === 'FRANCHISE'
                          ? 'border-gold-400 bg-gold-100 text-gold-800'
                          : 'border-navy bg-navy text-white'
                        : 'border-navy-200 bg-white text-navy-300 hover:border-gold-300'
                    )}
                  >
                    {t === 'COMPANY' ? 'Company site' : 'Franchise · partner-run'}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[10px] leading-snug text-navy-300">
                Franchise branches run under the Kozy Care standard by an approved partner —
                they show gold with a partner chip across the console and feed the
                revenue-share ledger.
              </p>
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex items-center justify-end gap-3">
        {dirty && <p className="text-xs text-amber-700">Unsaved changes</p>}
        <Button
          onClick={onSave}
          disabled={!dirty || save.isPending}
          className="rounded-full bg-gold-gradient font-semibold text-navy hover:opacity-90"
        >
          {save.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" /> Save branches
            </>
          )}
        </Button>
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-navy-300">
        <Building2 className="h-3.5 w-3.5 text-gold-600" />
        A third location? It is added the day you need it — this list grows with the business.
      </p>
    </div>
  )
}
