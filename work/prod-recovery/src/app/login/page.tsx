'use client'

import { useState, Suspense } from 'react'
import { signIn, signOut, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Mail, Lock, Eye, EyeOff, AlertCircle, Send, UserCheck, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Logo } from '@/components/shell/logo'
import { consumeAuthRedirect } from '@/lib/booking-draft'
import Link from 'next/link'

/** Only allow same-site relative redirect targets (no open redirects). */
function safePath(p: string | null | undefined): string | null {
  return p && p.startsWith('/') && !p.startsWith('//') ? p : null
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-linen"><div className="text-sm text-navy-300">Loading...</div></div>}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = safePath(searchParams.get('callbackUrl'))
  const { data: session, status } = useSession()

  // Owner request (phase 58): visiting /login while signed in used to
  // force-redirect straight to the console — the owner could never see the
  // form to sign in with a DIFFERENT set of credentials (e.g. his admin
  // persona while testing the rider login link). Now the form always shows,
  // with a banner making the existing session explicit (that banner also
  // preserves the old audit fix: a signed-in visitor is never left guessing
  // whether their sign-in "failed" — the card says plainly that they are
  // already in) and one-tap Continue / Sign out actions.
  const sessionUser = session?.user as any
  const sessionRole = sessionUser?.role
  const continueUrl =
    sessionRole === 'ADMIN' || sessionRole === 'STAFF'
      ? '/admin'
      : sessionRole === 'DRIVER'
        ? '/driver'
        : callbackUrl || '/portal'

  const [email, setEmail] = useState(searchParams.get('email') || '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Prefill the email from the active session ("showing my credentials"),
  // unless the URL carries an explicit ?email= (rider/ops login links win —
  // that is exactly the switch-account test path). Render-time adjustment
  // pattern (React docs: "You Might Not Need an Effect") — fills an EMPTY
  // field once per session identity, so typing is never clobbered and no
  // cascading effect renders.
  const sessionEmail = sessionUser?.email ?? null
  const [prefilledFrom, setPrefilledFrom] = useState<string | null>(null)
  if (sessionEmail && sessionEmail !== prefilledFrom) {
    setPrefilledFrom(sessionEmail)
    if (!email && !searchParams.get('email')) setEmail(sessionEmail)
  }

  const [unverifiedEmail, setUnverifiedEmail] = useState(false)
  const [resending, setResending] = useState(false)
  // Phase 31: staff lockout messaging (paused / revoked) — shown as its own
  // banner because "invalid email or password" would be actively misleading
  // after a CORRECT password match.
  const [accessNotice, setAccessNotice] = useState<
    { kind: 'ACCOUNT_PAUSED' | 'ACCOUNT_REVOKED' } | null
  >(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setUnverifiedEmail(false)
    setAccessNotice(null)

    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (res?.error) {
      setAccessNotice(null)
      // Staff lockout codes (phase 31) — thrown by authorize() after the
      // password was verified correct, same channel as EMAIL_NOT_VERIFIED.
      if (res.error === 'ACCOUNT_PAUSED' || res.error === 'ACCOUNT_REVOKED') {
        setAccessNotice({ kind: res.error })
        setError('')
      } else if (res.error === 'EMAIL_NOT_VERIFIED' || res.error?.includes('EMAIL_NOT_VERIFIED')) {
        setUnverifiedEmail(true)
        setError('')
      } else {
        setError('Invalid email or password. Please check your credentials.')
      }
      setLoading(false)
    } else if (res?.ok) {
      // Fetch the user's role to redirect to the right portal
      const meRes = await fetch('/api/users/me')
      const meData = await meRes.json()
      const role = meData.user?.role
      // Consume any stored post-auth destination (set by the booking wizard's
      // member gate) regardless of role, so stale entries never linger.
      const storedRedirect = consumeAuthRedirect()
      // Phase 44 fix: ONE navigation, no router.refresh() — the refresh used
      // to abort this very push mid-flight (stuck "Signing in…" for drivers).
      // A fresh route load already pulls current server data.
      if (role === 'ADMIN' || role === 'STAFF') router.push('/admin')
      else if (role === 'DRIVER') router.push('/driver')
      else {
        // Customers: an explicit return destination wins (e.g. back to a
        // saved booking), then the stored redirect, then the portal.
        router.push(callbackUrl || storedRedirect || '/portal')
      }
    }
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
            {status === 'authenticated' && sessionUser && (
              <div
                role="status"
                className="mb-5 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900 ring-1 ring-emerald-200"
              >
                <div className="flex items-start gap-2">
                  <UserCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold">You&apos;re already signed in</p>
                    <p className="mt-0.5">
                      Signed in as <strong className="break-all">{sessionUser.email}</strong>. Continue where you
                      left off, or sign in below with a different account.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => router.push(continueUrl)}
                        className="bg-gold-gradient font-semibold text-[#0A192F] hover:opacity-90"
                      >
                        Continue as {sessionUser.name?.split(' ')[0] || 'your account'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="border-navy-200 text-navy hover:bg-navy hover:text-white"
                      >
                        <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign out
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <h1 className="font-serif text-2xl font-semibold text-navy text-center mb-2">Welcome back</h1>
            <p className="text-sm text-navy-300 text-center mb-6">
              {status === 'authenticated'
                ? 'Sign in below with a different account'
                : 'Sign in to your Kozy Care account'}
            </p>

            {error && (
              <div className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 flex items-start gap-2 ring-1 ring-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {accessNotice && (
              <div
                role="alert"
                className={`mb-4 rounded-lg px-3 py-2 text-xs flex items-start gap-2 ring-1 ${
                  accessNotice.kind === 'ACCOUNT_PAUSED'
                    ? 'bg-amber-50 text-amber-800 ring-amber-200'
                    : 'bg-rose-50 text-rose-700 ring-rose-200'
                }`}
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    {accessNotice.kind === 'ACCOUNT_PAUSED'
                      ? 'Your access is paused'
                      : 'Your access has been revoked'}
                  </p>
                  <p className="mt-1">
                    Your sign-in details are correct, but a Kozy Care manager has
                    {accessNotice.kind === 'ACCOUNT_PAUSED'
                      ? ' temporarily paused this account. Contact your manager to be reactivated.'
                      : " closed this account's access to the console. Contact your manager if you believe this is a mistake."}
                  </p>
                </div>
              </div>
            )}

            {unverifiedEmail && (
              <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-start gap-2 ring-1 ring-amber-200">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Please verify your email first</p>
                  <p className="mt-1">We sent a verification link to <strong>{email}</strong>. Check your inbox and spam folder.</p>
                  <button
                    onClick={async () => {
                      setResending(true)
                      const r = await fetch('/api/auth/resend-verification', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email }),
                      })
                      const d = await r.json()
                      alert(d.message || d.error)
                      setResending(false)
                    }}
                    disabled={resending}
                    className="mt-1 font-semibold text-[#0A192F] hover:underline disabled:opacity-50"
                  >
                    {resending ? 'Sending...' : 'Resend verification email'}
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-xs uppercase tracking-wide text-navy-300">Email</Label>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-300" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="password" className="text-xs uppercase tracking-wide text-navy-300">Password</Label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-300" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 pr-9"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-300 hover:text-navy"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gold-gradient text-[#0A192F] hover:opacity-90 font-semibold"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>

              <div className="text-center">
                <a href="/forgot-password" className="text-xs text-[#6F88A8] hover:text-[#0A192F]">
                  Forgot password?
                </a>
              </div>

              {/* Guest-checkout rescue: guest orders create an account with a
                  random password, so the fastest path to "track my order" is
                  SET a password, not guess one (audit finding). */}
              <div className="rounded-lg bg-linen-100 p-3 text-center text-xs text-navy-300">
                Booked as a guest?{' '}
                <Link
                  href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ''}`}
                  className="font-semibold text-navy hover:underline"
                >
                  Set a password
                </Link>{' '}
                to track your orders — no sign-up needed.
              </div>
            </form>

            <div className="mt-6 text-center text-sm text-navy-300">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-navy font-semibold hover:underline">
                Sign up
              </Link>
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
