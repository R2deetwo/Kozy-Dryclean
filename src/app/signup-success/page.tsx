'use client'

// =============================================================================
// /signup-success — the distinct URL for a completed signup (phase 73)
// =============================================================================
// WHY THIS PAGE EXISTS: submitting the signup form used to keep the URL at
// /signup while showing the "check your email" notice — which made signup
// conversion tracking (Google Ads, analytics funnels) impossible, because
// every visitor of /signup looked identical whether they converted or not.
// The form now redirects here on success, so:
//   • the ad platform can use https://kozycare.ng/signup-success as its
//     conversion URL;
//   • a GA4 `sign_up` event + a dataLayer `signup_success` event fire here
//     (plus the Google Ads conversion call when the env IDs are set);
//   • the user keeps the whole rescue kit — resend, fix-the-typo'd-address,
//     and a login CTA that still carries their callbackUrl home.
// =============================================================================

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Loader2, PencilLine, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Logo } from '@/components/shell/logo'
import { isValidEmail, EMAIL_HELP } from '@/lib/email-validation'

/** Only allow same-site relative redirect targets (no open redirects). */
function safePath(p: string | null | undefined): string | null {
  return p && p.startsWith('/') && !p.startsWith('//') ? p : null
}

export default function SignupSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-linen">
          <Loader2 className="h-8 w-8 animate-spin text-navy-300" />
        </div>
      }
    >
      <SignupSuccess />
    </Suspense>
  )
}

function SignupSuccess() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const emailParam = (searchParams.get('email') || '').trim()
  const callbackUrl = safePath(searchParams.get('callbackUrl'))
  const activeEmail = isValidEmail(emailParam) ? emailParam : ''

  const [email, setEmail] = useState(activeEmail)
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  // Rescue flow: if the verification email never arrives (usually a typo in
  // the address), the customer can correct it right here — the account is
  // still unverified, so the email is safely updatable.
  const [fixingEmail, setFixingEmail] = useState(false)
  const [fixedEmail, setFixedEmail] = useState('')
  const [fixing, setFixing] = useState(false)
  const [fixMessage, setFixMessage] = useState('')
  const [fixError, setFixError] = useState('')

  // ----- Conversion tracking (the reason this URL exists) -----
  useEffect(() => {
    const w = window as unknown as {
      gtag?: (...args: unknown[]) => void
      dataLayer?: unknown[]
    }
    // Always announce the funnel event server-agnostically.
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({ event: 'signup_success' })
    if (typeof w.gtag === 'function') {
      // GA4 recommended event — shows as a "sign_up" key event in GA.
      w.gtag('event', 'sign_up', { method: 'email' })
      // Google Ads conversion — fires only when the office has set the Ads
      // ID + signup label in the Vercel env (NEXT_PUBLIC_GOOGLE_ADS_ID /
      // NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL); harmless no-op otherwise.
      const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID
      const label = process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL
      if (adsId && label) {
        w.gtag('event', 'conversion', { send_to: `${adsId}/${label}` })
      }
    }
  }, [])

  const handleResend = async () => {
    if (!email) return
    setResending(true)
    setResendMessage('')
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Phase 80 — the resend keeps the return destination on the link so
        // the chain still lands back on the plan being joined.
        body: JSON.stringify({ email, callbackUrl }),
      })
      const data = await res.json()
      setResendMessage(data.message || data.error || 'Something went wrong.')
    } catch {
      setResendMessage('Network error. Please try again.')
    }
    setResending(false)
  }

  const handleFixEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setFixError('')
    setFixMessage('')
    if (!isValidEmail(fixedEmail)) {
      setFixError(EMAIL_HELP)
      return
    }
    setFixing(true)
    try {
      const res = await fetch('/api/auth/update-unverified-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentEmail: email, newEmail: fixedEmail.trim(), callbackUrl }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFixError(data.message || data.error || 'Could not update the email.')
      } else {
        setEmail(data.email || fixedEmail.trim())
        setFixMessage(data.message || `Verification email sent to ${fixedEmail.trim()}.`)
        setFixingEmail(false)
      }
    } catch {
      setFixError('Network error. Please try again.')
    }
    setFixing(false)
  }

  const loginHref = email
    ? `/login?email=${encodeURIComponent(email)}${
        callbackUrl ? `&callbackUrl=${encodeURIComponent(callbackUrl)}` : ''
      }`
    : callbackUrl
      ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : '/login'

  return (
    <div className="min-h-screen flex items-center justify-center bg-linen px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Link href="/">
            <Logo size="md" subtitle="Drycleaning & Laundry" />
          </Link>
        </div>

        <Card className="border-navy-100 shadow-navy">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold-100">
              <CheckCircle2 className="h-7 w-7 text-gold-600" />
            </div>
            <h1 className="font-serif text-2xl font-semibold text-navy mb-2">
              Account created — check your email
            </h1>
            <p className="text-sm text-navy-300 mb-2">
              {email ? (
                <>
                  We&apos;ve sent a verification link to{' '}
                  <strong className="text-navy">{email}</strong>.
                </>
              ) : (
                <>We&apos;ve sent a verification link to the address you signed up with.</>
              )}
            </p>
            <p className="text-xs text-navy-300 mb-4">
              Click the link to activate your account, then sign in.
              {callbackUrl?.includes('join=') ? (
                <>
                  <br />
                  <strong className="text-navy">We&apos;ll bring you straight back to your chosen plan</strong>{' '}
                  to complete your first payment — nothing is charged until then.
                </>
              ) : null}
              <br />
              <strong className="text-navy">Didn&apos;t get it?</strong> Check your spam folder — or
              fix the address below.
            </p>

            {email && (
              <div className="mb-6">
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="text-xs text-[#0A192F] font-semibold hover:underline disabled:opacity-50"
                >
                  {resending ? 'Sending...' : 'Resend verification email'}
                </button>
                {resendMessage && (
                  <p className="mt-2 text-xs text-navy-300">{resendMessage}</p>
                )}
              </div>
            )}

            {/* Wrong-email rescue: typos like "name@gmail" (no .com) are the
                #1 reason verification emails never arrive — the customer can
                correct the address right here, no support call needed. */}
            {email && (
              <div className="mb-6 rounded-lg border border-navy-100 bg-linen-100 p-4 text-left">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-navy">
                  <PencilLine className="h-3.5 w-3.5 text-gold-600" />
                  Wrong email address?
                </p>
                {fixingEmail ? (
                  <form onSubmit={handleFixEmail} className="mt-2 space-y-2">
                    <Input
                      type="email"
                      value={fixedEmail}
                      onChange={(e) => setFixedEmail(e.target.value)}
                      placeholder="correct.email@example.com"
                      autoFocus
                      required
                    />
                    {fixError && <p className="text-xs text-rose-600">{fixError}</p>}
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        disabled={fixing}
                        className="flex-1 bg-gold-gradient text-navy hover:opacity-90 text-xs h-9"
                      >
                        {fixing ? 'Updating…' : 'Save & resend link'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setFixingEmail(false)
                          setFixError('')
                        }}
                        className="text-xs h-9"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p className="mt-1 text-xs text-navy-300">
                      Typed your address wrong? Correct it and we&apos;ll resend the
                      verification link.
                    </p>
                    <button
                      onClick={() => {
                        setFixingEmail(true)
                        setFixedEmail(email)
                        setFixError('')
                      }}
                      className="mt-2 text-xs font-semibold text-[#0A192F] hover:underline"
                    >
                      Fix my email address
                    </button>
                  </>
                )}
                {fixMessage && (
                  <p className="mt-2 rounded bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700">
                    {fixMessage}
                  </p>
                )}
              </div>
            )}

            <Button
              onClick={() => router.push(loginHref)}
              className="bg-gold-gradient text-navy hover:opacity-90 w-full"
            >
              Go to login
            </Button>
          </CardContent>
        </Card>

        <Link href="/" className="mt-6 flex items-center justify-center gap-1 text-xs text-navy-300 hover:text-navy">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to home
        </Link>
      </div>
    </div>
  )
}
