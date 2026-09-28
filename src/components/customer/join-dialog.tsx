'use client'

// =============================================================================
// JoinDialog — confirm a plan → choose payment → done (shared, phase 70)
// =============================================================================
// Extracted from memberships-page so BOTH product families use the exact
// same join flow: the Kozy Circle tiers (from /memberships) and the standalone
// Shoe Club (from the /services shoe-care section). The copy adapts to the
// plan's family — kit hand-over language for tiers, pair language for the
// club — while the machinery (Paystack charge → webhook activation, or
// transfer receipt → admin verification) is identical.
// =============================================================================

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BadgeCheck, Banknote, CreditCard, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { formatNaira } from '@/lib/types'
import {
  useSubscribe,
  useMembershipPaystackInit,
  type ApiMembershipPlan,
} from '@/lib/hooks'

export function JoinDialog({
  plan,
  onClose,
  sessionEmail,
}: {
  plan: ApiMembershipPlan
  onClose: () => void
  sessionEmail: string | null
}) {
  const subscribe = useSubscribe()
  const paystackInit = useMembershipPaystackInit()
  const [paymentMethod, setPaymentMethod] = useState<'PAYSTACK' | 'BANK_TRANSFER'>('PAYSTACK')
  const [receipt, setReceipt] = useState<string | null>(null)
  const [done, setDone] = useState<'paystack-redirect' | 'transfer-pending' | null>(null)

  const isClub = plan.family === 'SHOES'

  const downscaleReceipt = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => {
          const maxEdge = 1200
          const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(1, Math.round(img.width * scale))
          canvas.height = Math.max(1, Math.round(img.height * scale))
          const ctx = canvas.getContext('2d')
          if (!ctx) return reject(new Error('Canvas unavailable'))
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/jpeg', 0.82))
        }
        img.onerror = () => reject(new Error('Could not decode the image'))
        img.src = reader.result as string
      }
      reader.onerror = () => reject(new Error('Could not read the file'))
      reader.readAsDataURL(file)
    })

  const onJoin = async () => {
    try {
      const res = await subscribe.mutateAsync({
        planCode: plan.code,
        paymentMethod,
        ...(receipt ? { transferReceipt: receipt } : {}),
      })

      if (res.next === 'paystack') {
        setDone('paystack-redirect')
        try {
          const init = await paystackInit.mutateAsync(res.subscription.id)
          window.location.href = init.authorizationUrl
        } catch (e: any) {
          // Paystack unavailable/failed — fall back to transfer guidance.
          toast({
            title: 'Card payment unavailable right now',
            description: e?.message ?? 'Please pay by bank transfer below.',
          })
          setPaymentMethod('BANK_TRANSFER')
          setDone('transfer-pending')
        }
      } else {
        setDone('transfer-pending')
      }
    } catch (e: any) {
      toast({
        title: 'Could not start the membership',
        description: e?.message ?? 'Please try again in a moment.',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-md">
        {!done ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif text-xl text-navy">
                {isClub ? `Join the ${plan.name}` : `Join ${plan.name}`}
              </DialogTitle>
              <DialogDescription>
                {isClub
                  ? `${plan.shoesPerMonth} pair${plan.shoesPerMonth === 1 ? '' : 's'} cleaned a month · free pickup & delivery · ${plan.memberDiscountPct}% off everything else`
                  : `${plan.includedUnits} × ${plan.unitName} pickups a month · free delivery · ${plan.memberDiscountPct}% off everything else`}
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl bg-navy-50 p-4 ring-1 ring-navy-100">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-navy">Monthly</span>
                <span className="font-serif text-3xl font-bold text-navy">
                  {formatNaira(plan.priceMonthly)}
                </span>
              </div>
              {sessionEmail && (
                <p className="mt-2 text-[11px] text-navy-300">Billed to {sessionEmail}</p>
              )}
            </div>

            {/* Payment method */}
            <div className="mt-4 space-y-2">
              <button
                onClick={() => setPaymentMethod('PAYSTACK')}
                className={
                  paymentMethod === 'PAYSTACK'
                    ? 'flex w-full items-center gap-3 rounded-xl border-2 border-gold-300 bg-gold-50/50 p-3 text-left'
                    : 'flex w-full items-center gap-3 rounded-xl border border-navy-100 p-3 text-left transition hover:border-gold-200'
                }
              >
                <CreditCard className="h-5 w-5 shrink-0 text-navy" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy">Pay by card</p>
                  <p className="text-[11px] text-navy-300">
                    Instant activation · renews automatically each month
                  </p>
                </div>
              </button>
              <button
                onClick={() => setPaymentMethod('BANK_TRANSFER')}
                className={
                  paymentMethod === 'BANK_TRANSFER'
                    ? 'flex w-full items-center gap-3 rounded-xl border-2 border-gold-300 bg-gold-50/50 p-3 text-left'
                    : 'flex w-full items-center gap-3 rounded-xl border border-navy-100 p-3 text-left transition hover:border-gold-200'
                }
              >
                <Banknote className="h-5 w-5 shrink-0 text-navy" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy">Pay by bank transfer</p>
                  <p className="text-[11px] text-navy-300">
                    Attach your receipt · we activate on verification
                  </p>
                </div>
              </button>
            </div>

            {paymentMethod === 'BANK_TRANSFER' && (
              <div className="mt-3 rounded-xl border border-dashed border-navy-200 p-3">
                <label className="flex cursor-pointer items-center gap-3">
                  <Upload className="h-4 w-4 shrink-0 text-navy-300" />
                  <span className="text-xs text-navy-300">
                    {receipt ? 'Receipt attached — looking good' : 'Attach your transfer receipt (optional now)'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      try {
                        setReceipt(await downscaleReceipt(file))
                      } catch {
                        toast({
                          title: 'Receipt not attached',
                          description: "We couldn't read that image — you can continue without it.",
                          variant: 'destructive',
                        })
                      }
                    }}
                  />
                </label>
              </div>
            )}

            <Button
              onClick={onJoin}
              disabled={subscribe.isPending || paystackInit.isPending}
              className="mt-4 w-full rounded-full bg-gold-gradient font-semibold text-navy hover:opacity-90"
            >
              {subscribe.isPending || paystackInit.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting…
                </>
              ) : isClub ? (
                <>Join the Shoe Club · {formatNaira(plan.priceMonthly)}/mo</>
              ) : (
                <>Start my membership · {formatNaira(plan.priceMonthly)}/mo</>
              )}
            </Button>
            <p className="text-center text-[10px] text-navy-300">
              Cancel any time — the plan runs to the end of the month
            </p>
          </>
        ) : done === 'transfer-pending' ? (
          <div className="py-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold-100">
              <BadgeCheck className="h-7 w-7 text-gold-600" />
            </div>
            <DialogTitle className="mt-4 font-serif text-xl text-navy">
              {isClub ? 'Almost in the club' : 'Almost in the Circle'}
            </DialogTitle>
            <p className="mt-2 text-sm leading-relaxed text-navy-300">
              {isClub ? (
                <>
                  Transfer <strong className="text-navy">{formatNaira(plan.priceMonthly)}</strong> to
                  the studio account (bank details are in your portal and your confirmation email).
                  The moment our team verifies it, your monthly pairs unlock and you can book your
                  first pickup.
                </>
              ) : (
                <>
                  Transfer <strong className="text-navy">{formatNaira(plan.priceMonthly)}</strong> to
                  the studio account (bank details are in your portal and your confirmation email).
                  The moment our team verifies it, your month starts and your rider schedules the kit
                  hand-over.
                </>
              )}
            </p>
            <Link href="/portal" className="mt-5 block">
              <Button className="w-full rounded-full bg-navy text-white hover:bg-navy-600">
                Open my portal <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="py-8 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-gold-500" />
            <p className="mt-3 text-sm text-navy-300">
              Taking you to the secure card checkout…
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
