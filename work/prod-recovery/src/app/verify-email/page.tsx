'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-linen"><Loader2 className="h-8 w-8 animate-spin text-navy-300" /></div>}>
      <VerifyEmailContent />
    </Suspense>
  )
}

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      // Use a microtask to avoid setState-in-effect lint error
      Promise.resolve().then(() => {
        setStatus('error')
        setMessage('No verification token found. Check your email for the correct link.')
      })
      return
    }

    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (res.ok) {
          setStatus('success')
          setMessage(data.message || 'Email verified!')
        } else {
          setStatus('error')
          setMessage(data.error || 'Verification failed')
        }
      })
      .catch(() => {
        setStatus('error')
        setMessage('Something went wrong. Please try again.')
      })
  }, [token])

  return (
    <div className="min-h-screen flex items-center justify-center bg-linen px-4 py-8">
      <Card className="w-full max-w-md border-navy-100 shadow-navy">
        <CardContent className="p-8 text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="mx-auto mb-4 h-14 w-14 animate-spin text-navy-300" />
              <h1 className="font-serif text-xl font-semibold text-navy mb-2">Verifying your email...</h1>
              <p className="text-sm text-navy-300">Please wait a moment.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold-100">
                <CheckCircle2 className="h-7 w-7 text-gold-600" />
              </div>
              <h1 className="font-serif text-2xl font-semibold text-navy mb-2">Email verified!</h1>
              <p className="text-sm text-navy-300 mb-6">{message}</p>
              <Link href="/login">
                <Button className="bg-gold-gradient text-navy hover:opacity-90 w-full">
                  Sign in to your account
                </Button>
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
                <AlertCircle className="h-7 w-7 text-rose-500" />
              </div>
              <h1 className="font-serif text-xl font-semibold text-navy mb-2">Verification failed</h1>
              <p className="text-sm text-navy-300 mb-6">{message}</p>
              <div className="space-y-2">
                <Link href="/login">
                  <Button variant="outline" className="w-full border-navy-200 text-navy hover:bg-navy hover:text-white">
                    Back to login
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button variant="ghost" className="w-full text-navy-300">
                    Back to signup
                  </Button>
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
