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
//
// Phase 73 — the account step: a membership can only ever live on a
// PERSONAL CUSTOMER account. Signed-out visitors now get the account step
// INSIDE the dialog (no more blind redirects to /login that lose the plan
// context), and a lingering rider/partner/team session can never surface a
// “Billed to” line — the dialog explains the account needs to be personal
// and offers sign-up (or sign-out) right there.
// =============================================================================

import { useState } from 'react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { ArrowRight, BadgeCheck, Banknote, CreditCard, Loader2, LogIn, LogOut, Upload, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { formatNaira } from '@/lib/types'
import {
  useAppSettings,
  useSubscribe,
  useMembershipPaystackInit,
  type ApiMembershipPlan,
} from '@/lib/hooks'

export function JoinDialog({
  plan,
  onClose,
  sessionEmail,
  sessionRole,
  authStatus,
}: {
  plan: ApiMembershipPlan
  onClose: () => void
  /** Customer-session email ONLY — the pages pass null for every other
   *  session type (rider/partner/team), so a non-customer account can never
   *  appear as “Billed to”. */
  sessionEmail: string | null
  /** Role of whoever is signed in, if anyone (‘DRIVER’, ‘B2C’, …). */
  sessionRole?: string | null
  /** next-auth status — while loading we hold the dialog instead of guessing. */
  authStatus?: 'loading' | 'authenticated' | 'unauthenticated'
}) {
  const subscribe = useSubscribe()
  const paystackInit = useMembershipPaystackInit()
  const appSettings = useAppSettings()
  // Phase 79 — the honesty gate: when Paystack is not configured the card
  // option is NEVER offered as a working choice. Before this, "Pay by card"
  // was the default even with no PAYSTACK_SECRET_KEY — members joined,
  // the checkout never opened, and they were trapped in "awaiting payment"
  // with no way to complete it (the office complaint that started phase 79).
  const paystackAvailable = appSettings?.paystackAvailable === true
  const [paymentMethod, setPaymentMethod] = useState<'PAYSTACK' | 'BANK_TRANSFER'>(
    paystackAvailable ? 'PAYSTACK' : 'BANK_TRANSFER'
  )
  // If availability resolves AFTER first render (settings fetch), a card
  // pre-selection must fall back to transfer — never offer a dead button.
  const effectiveMethod: 'PAYSTACK' | 'BANK_TRANSFER' =
    paymentMethod === 'PAYSTACK' && !paystackAvailable ? 'BANK_TRANSFER' : paymentMethod
  const [receipt, setReceipt] = useState<string | null>(null)
  const [done, setDone] = useState<'paystack-redirect' | 'transfer-pending' | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  const isClub = plan.family === 'SHOES'
  const auth = authStatus ?? (sessionEmail ? 'authenticated' : 'unauthenticated')
  // Phase 80 — the account step carries the PLAN, not just the page. The
  // deep link (?join=CODE) re-opens this exact dialog after the signup →
  // verify-email → login detour (both pages auto-open it). Before this the
  // plan — and its payment step — were lost at the first hop: a visitor
  // "joined", created an account, landed in the portal, and no payment was
  // ever shown (the phase-80 owner complaint: "no payment required, it went
  // straight to the portal").
  const backTo = isClub
    ? `/services?join=${encodeURIComponent(plan.code)}#shoe-care`
    : `/memberships?join=${encodeURIComponent(plan.code)}`
  const backToEncoded = encodeURIComponent(backTo)
  // Plain words for the signed-in-but-wrong-account case.
  const accountLabel =
    sessionRole === 'DRIVER'
      ? 'rider'
      : sessionRole === 'PARTNER'
        ? 'partner laundrette'
        : sessionRole === 'ADMIN' || sessionRole === 'STAFF'
          ? 'team'
          : 'non-customer'

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
    // The method the server actually gets (a dead card choice can never be
    // submitted — see the honesty gate above).
    const method = effectiveMethod
    try {
      const res = await subscribe.mutateAsync({
        planCode: plan.code,
        paymentMethod: method,
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
      // Phase 79: ALREADY_MEMBER while PENDING_ACTIVATION now carries the
      // completion path — point the member at their portal instead of a
      // dead "waiting for verification" message.
      const code = (e as any)?.code
      const existing = (e as any)?.subscription as { id?: string } | undefined
      if (code === 'ALREADY_MEMBER' && existing?.id) {
        toast({
          title: 'Your membership is waiting for its first payment',
          description:
            'Complete it in a moment from your portal — pay by transfer (or card when available) right from the Membership tab.',
        })
        return
      }
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
              {/* The billed-to line is customer-only by construction — the
                  pages never pass a rider/partner/team email here. */}
              {sessionEmail && (
                <p className="mt-2 text-[11px] text-navy-300">Billed to {sessionEmail}</p>
              )}
            </div>

            {auth === 'loading' ? (
              /* Session still resolving — hold the dialog rather than flashing
                 the wrong step (or letting a rider click Start). */
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-navy-300">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking your account…
              </div>
            ) : !sessionEmail ? (
              /* ------------------ THE ACCOUNT STEP (phase 73) ------------------ */
              <div className="mt-4 space-y-4">
                {authStatus === 'authenticated' && sessionRole && sessionRole !== 'B2C' && sessionRole !== 'B2B' ? (
                  <div className="rounded-xl border border-gold-200 bg-gold-50/60 p-4">
                    <p className="text-sm font-semibold text-navy">
                      You&apos;re signed in as a {accountLabel} account
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-navy-300">
                      Memberships live on personal customer accounts — the plan, your kit
                      and the monthly billing all attach to one. Create your personal
                      account to join {plan.name}; it takes about a minute.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-navy-300">
                    A membership lives on your Kozy account — the plan, your kit and the
                    monthly billing all attach to one. Create your account now (60 seconds)
                    or sign in, and we&apos;ll bring you straight back to this plan.
                  </p>
                )}
                <div className="space-y-2">
                  <Link href={`/signup?callbackUrl=${backToEncoded}`}>
                    <Button className="w-full rounded-full bg-gold-gradient font-semibold text-navy hover:opacity-90">
                      <UserPlus className="mr-2 h-4 w-4" /> Create my account
                    </Button>
                  </Link>
                  {authStatus === 'authenticated' ? (
                    <Button
                      variant="outline"
                      disabled={signingOut}
                      onClick={async () => {
                        setSigningOut(true)
                        // Sign the rider/partner/team account out and land back
                        // here as a fresh visitor.
                        await signOut({ callbackUrl: backTo })
                      }}
                      className="w-full rounded-full"
                    >
                      {signingOut ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <LogOut className="mr-2 h-4 w-4" />
                      )}
                      {signingOut ? 'Signing out…' : `Sign out of the ${accountLabel} account`}
                    </Button>
                  ) : (
                    <Link href={`/login?callbackUrl=${backToEncoded}`} className="block">
                      <Button variant="outline" className="w-full rounded-full">
                        <LogIn className="mr-2 h-4 w-4" /> I already have an account
                      </Button>
                    </Link>
                  )}
                </div>
                <p className="text-center text-[10px] text-navy-300">
                  Your chosen plan is waiting right here when you come back
                </p>
              </div>
            ) : (
              <>

            {/* Payment method */}
            <div className="mt-4 space-y-2">
              <button
                type="button"
                disabled={!paystackAvailable}
                onClick={() => setPaymentMethod('PAYSTACK')}
                className={
                  effectiveMethod === 'PAYSTACK'
                    ? 'flex w-full items-center gap-3 rounded-xl border-2 border-gold-300 bg-gold-50/50 p-3 text-left'
                    : paystackAvailable
                    ? 'flex w-full items-center gap-3 rounded-xl border border-navy-100 p-3 text-left transition hover:border-gold-200'
                    : 'flex w-full cursor-not-allowed items-center gap-3 rounded-xl border border-navy-100 bg-linen-100/70 p-3 text-left opacity-60'
                }
              >
                <CreditCard className="h-5 w-5 shrink-0 text-navy" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy">
                    Pay by card
                    {!paystackAvailable && (
                      <span className="ml-2 rounded-full bg-navy-50 px-2 py-px text-[9px] font-bold uppercase tracking-wide text-navy-300">
                        coming soon
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-navy-300">
                    {paystackAvailable
                      ? 'Instant activation · renews automatically each month'
                      : 'Card checkout is being set up — transfer works today'}
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('BANK_TRANSFER')}
                className={
                  effectiveMethod === 'BANK_TRANSFER'
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

            {effectiveMethod === 'BANK_TRANSFER' && (
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
            )}
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
