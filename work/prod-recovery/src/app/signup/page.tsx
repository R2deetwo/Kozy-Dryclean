'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Mail, Lock, User, Phone, Eye, EyeOff, AlertCircle, CheckCircle2, PencilLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/shell/logo'
import { isValidEmail, EMAIL_HELP } from '@/lib/email-validation'
import Link from 'next/link'

/** Only allow same-site relative redirect targets (no open redirects). */
function safePath(p: string | null | undefined): string | null {
  return p && p.startsWith('/') && !p.startsWith('//') ? p : null
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-linen">
          <div className="text-sm text-navy-300">Loading...</div>
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  )
}

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Prefill from the booking wizard's member gate (email known there) and
  // carry the return destination through to the login page, so after email
  // verification + sign-in the customer lands back on their saved booking.
  const callbackUrl = safePath(searchParams.get('callbackUrl'))

  const [name, setName] = useState(searchParams.get('name') || '')
  const [email, setEmail] = useState(searchParams.get('email') || '')
  const [phone, setPhone] = useState(searchParams.get('phone') || '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [accountType, setAccountType] = useState<'B2C' | 'B2B'>('B2C')
  const [company, setCompany] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [success, setSuccess] = useState(false)
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
  const [activeEmail, setActiveEmail] = useState('')

  const handleResend = async () => {
    setResending(true)
    setResendMessage('')
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: activeEmail || email }),
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
        body: JSON.stringify({ currentEmail: email, newEmail: fixedEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFixError(data.message || data.error || 'Could not update the email.')
      } else {
        setActiveEmail(data.email || fixedEmail.trim())
        setFixMessage(data.message || `Verification email sent to ${fixedEmail.trim()}.`)
        setFixingEmail(false)
      }
    } catch {
      setFixError('Network error. Please try again.')
    }
    setFixing(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    // Strict shape check BEFORE the request — "name@gmail" passes the
    // browser's built-in type=email rule but nothing can ever be delivered
    // to it (the exact bug that stranded a real customer).
    if (!isValidEmail(email)) {
      setEmailError(EMAIL_HELP)
      return
    }
    setEmailError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          name: accountType === 'B2B' ? company : name,
          phone,
          role: accountType,
          company: accountType === 'B2B' ? company : undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'INVALID_EMAIL') {
          setEmailError(data.message || EMAIL_HELP)
        } else {
          setError(data.message || data.error || 'Signup failed')
        }
        setLoading(false)
      } else {
        setActiveEmail(email.trim())
        setSuccess(true)
        setLoading(false)
      }
    } catch (e: any) {
      setError('Network error. Please check your connection and try again.')
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linen px-4 py-8">
        <Card className="w-full max-w-md border-navy-100 shadow-navy">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold-100">
              <CheckCircle2 className="h-7 w-7 text-gold-600" />
            </div>
            <h1 className="font-serif text-2xl font-semibold text-navy mb-2">Check your email</h1>
            <p className="text-sm text-navy-300 mb-2">
              We&apos;ve sent a verification link to <strong className="text-navy">{activeEmail || email}</strong>.
            </p>
            <p className="text-xs text-navy-300 mb-4">
              Click the link to activate your account, then sign in.
              <br />
              <strong className="text-navy">Didn&apos;t get it?</strong> Check your spam folder — or fix the address below.
            </p>

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

            {/* Wrong-email rescue: typos like "name@gmail" (no .com) are the
                #1 reason verification emails never arrive — the customer can
                correct the address right here, no support call needed. */}
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
                  {fixError && (
                    <p className="text-xs text-rose-600">{fixError}</p>
                  )}
                  <div className="flex gap-2">
                    <Button type="submit" disabled={fixing} className="flex-1 bg-gold-gradient text-navy hover:opacity-90 text-xs h-9">
                      {fixing ? 'Updating…' : 'Save & resend link'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => { setFixingEmail(false); setFixError('') }} className="text-xs h-9">
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="mt-1 text-xs text-navy-300">
                    Typed your address wrong? Correct it and we&apos;ll resend the verification link.
                  </p>
                  <button
                    onClick={() => { setFixingEmail(true); setFixedEmail(activeEmail || email); setFixError('') }}
                    className="mt-2 text-xs font-semibold text-[#0A192F] hover:underline"
                  >
                    Fix my email address
                  </button>
                </>
              )}
              {fixMessage && (
                <p className="mt-2 rounded bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700">{fixMessage}</p>
              )}
            </div>

            <Button
              onClick={() =>
                router.push(
                  `/login?email=${encodeURIComponent(activeEmail || email)}${
                    callbackUrl ? `&callbackUrl=${encodeURIComponent(callbackUrl)}` : ''
                  }`
                )
              }
              className="bg-gold-gradient text-navy hover:opacity-90 w-full"
            >
              Go to login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linen px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Link href="/">
            <Logo size="md" subtitle="Drycleaning & Laundry" />
          </Link>
        </div>

        <Card className="border-navy-100 shadow-navy">
          <CardContent className="p-6 sm:p-8">
            <h1 className="font-serif text-2xl font-semibold text-navy text-center mb-2">Create account</h1>
            <p className="text-sm text-navy-300 text-center mb-6">Get started with Kozy Care in 60 seconds</p>

            {error && (
              <div className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 flex items-start gap-2 ring-1 ring-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Account type toggle */}
            <div className="mb-4">
              <Label className="text-xs uppercase tracking-wide text-navy-300 mb-2 block">Account type</Label>
              <RadioGroup value={accountType} onValueChange={(v) => setAccountType(v as 'B2C' | 'B2B')} className="grid grid-cols-2 gap-2">
                <label className={cn('flex cursor-pointer items-center gap-2 rounded-lg border-2 p-3 transition', accountType === 'B2C' ? 'border-gold-400 bg-gold-50' : 'border-navy-100')}>
                  <RadioGroupItem value="B2C" className="sr-only" />
                  <User className="h-4 w-4 text-navy" />
                  <span className="text-sm font-medium text-navy">Personal</span>
                </label>
                <label className={cn('flex cursor-pointer items-center gap-2 rounded-lg border-2 p-3 transition', accountType === 'B2B' ? 'border-gold-400 bg-gold-50' : 'border-navy-100')}>
                  <RadioGroupItem value="B2B" className="sr-only" />
                  <span className="text-sm font-medium text-navy">Corporate</span>
                </label>
              </RadioGroup>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {accountType === 'B2B' ? (
                <div>
                  <Label htmlFor="company" className="text-xs uppercase tracking-wide text-navy-300">Company Name</Label>
                  <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Meridian Hotel Group" className="mt-1.5" required />
                </div>
              ) : (
                <div>
                  <Label htmlFor="name" className="text-xs uppercase tracking-wide text-navy-300">Full Name</Label>
                  <div className="relative mt-1.5">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-300" />
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Chioma Eze" className="pl-9" required />
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="email" className="text-xs uppercase tracking-wide text-navy-300">Email</Label>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-300" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError('') }}
                    placeholder="you@example.com"
                    className={cn('pl-9', emailError && 'border-rose-300 focus-visible:ring-rose-200')}
                    aria-invalid={!!emailError}
                    required
                  />
                </div>
                {emailError ? (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs text-rose-600">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {emailError}
                  </p>
                ) : (
                  <p className="mt-1.5 text-[11px] text-navy-300/80">
                    Double-check the address — it needs the full ending (e.g. .com or .ng).
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="phone" className="text-xs uppercase tracking-wide text-navy-300">Phone</Label>
                <div className="relative mt-1.5">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-300" />
                  <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234 807 444 1122" className="pl-9" required />
                </div>
              </div>

              <div>
                <Label htmlFor="password" className="text-xs uppercase tracking-wide text-navy-300">Password</Label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-300" />
                  <Input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" className="pl-9 pr-9" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-300 hover:text-navy">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full bg-gold-gradient text-navy hover:opacity-90 font-semibold">
                {loading ? 'Creating account...' : 'Create account'}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-navy-300">
              Already have an account?{' '}
              <Link href="/login" className="text-navy font-semibold hover:underline">Sign in</Link>
            </div>
          </CardContent>
        </Card>

        <Link href="/" className="mt-6 flex items-center justify-center gap-1 text-xs text-navy-300 hover:text-navy">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to home
        </Link>
      </div>
    </div>
  )
}
