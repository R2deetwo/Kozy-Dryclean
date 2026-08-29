'use client'

import { CustomerLanding } from '@/components/customer/customer-landing'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LogIn, UserPlus } from 'lucide-react'
import { Logo } from '@/components/shell/logo'

export default function Home() {
  return (
    <>
      {/* Top nav with login/signup buttons */}
      <div className="sticky top-0 z-50 w-full border-b border-navy-100 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo size="md" subtitle="Drycleaning & Laundry" onClick={() => window.location.href = '/'} />
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="outline" size="sm" className="rounded-full border-navy-200 text-navy hover:bg-navy hover:text-white">
                <LogIn className="mr-1.5 h-3.5 w-3.5" /> Sign in
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="rounded-full bg-gold-gradient text-navy hover:opacity-90 font-semibold">
                <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Sign up
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <CustomerLanding
        onBook={() => {
          // Straight to booking — guests can check out without an account
          window.location.href = '/book'
        }}
        onBookShoes={() => {
          // Shoe-care section CTA — deep-link straight into the wizard's
          // Shoes tab so sneaker customers land on the shoe list.
          window.location.href = '/book?service=shoes'
        }}
        onPortal={() => {
          window.location.href = '/login'
        }}
      />
    </>
  )
}
