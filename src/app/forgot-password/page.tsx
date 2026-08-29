'use client'

import { useState } from 'react'
import { ArrowLeft, Mail, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Logo } from '@/components/shell/logo'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linen px-4 py-8">
        <Card className="w-full max-w-md border-navy-100 shadow-navy">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold-100">
              <CheckCircle2 className="h-7 w-7 text-gold-600" />
            </div>
            <h1 className="font-serif text-2xl font-semibold text-[#0A192F] mb-2">Check your email</h1>
            <p className="text-sm text-[#6F88A8] mb-6">
              If an account exists for <strong className="text-[#0A192F]">{email}</strong>, we&apos;ve sent a password reset link.
              Check your spam folder if you don&apos;t see it.
            </p>
            <Link href="/login">
              <Button className="bg-gold-gradient text-[#0A192F] hover:opacity-90 w-full">Back to login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linen px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Link href="/"><Logo size="md" subtitle="Drycleaning & Laundry" /></Link>
        </div>
        <Card className="border-navy-100 shadow-navy">
          <CardContent className="p-6 sm:p-8">
            <h1 className="font-serif text-2xl font-semibold text-[#0A192F] text-center mb-2">Forgot password?</h1>
            <p className="text-sm text-[#6F88A8] text-center mb-6">Enter your email and we&apos;ll send you a reset link.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-xs text-[#6F88A8]">Email</Label>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6F88A8]" />
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" placeholder="you@example.com" required />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-gold-gradient text-[#0A192F] hover:opacity-90 font-semibold">
                {loading ? 'Sending...' : 'Send reset link'}
              </Button>
            </form>
            <div className="mt-6 text-center">
              <Link href="/login" className="flex items-center justify-center gap-1 text-xs text-[#6F88A8] hover:text-[#0A192F]">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
