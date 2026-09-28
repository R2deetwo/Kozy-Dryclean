'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Logo } from '@/components/shell/logo'
import Link from 'next/link'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-linen"><Loader2 className="h-8 w-8 animate-spin text-[#6F88A8]" /></div>}>
      <ResetPasswordContent />
    </Suspense>
  )
}

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword: password }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Reset failed')
      setLoading(false)
    } else {
      setDone(true)
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linen px-4 py-8">
        <Card className="w-full max-w-md border-navy-100 shadow-navy">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold-100">
              <CheckCircle2 className="h-7 w-7 text-gold-600" />
            </div>
            <h1 className="font-serif text-2xl font-semibold text-[#0A192F] mb-2">Password reset!</h1>
            <p className="text-sm text-[#6F88A8] mb-6">Your password has been updated. You can now log in.</p>
            <Link href="/login"><Button className="bg-gold-gradient text-[#0A192F] hover:opacity-90 w-full">Sign in</Button></Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linen px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><Link href="/"><Logo size="md" subtitle="Drycleaning & Laundry" /></Link></div>
        <Card className="border-navy-100 shadow-navy">
          <CardContent className="p-6 sm:p-8">
            <h1 className="font-serif text-2xl font-semibold text-[#0A192F] text-center mb-2">Set new password</h1>
            <p className="text-sm text-[#6F88A8] text-center mb-6">Enter your new password below.</p>
            {error && (
              <div className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 flex items-start gap-2 ring-1 ring-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{error}</span>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="password" className="text-xs text-[#6F88A8]">New password</Label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6F88A8]" />
                  <Input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9 pr-9" placeholder="Min 8 characters" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6F88A8]"><span>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</span></button>
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-gold-gradient text-[#0A192F] hover:opacity-90 font-semibold">
                {loading ? 'Resetting...' : 'Reset password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
