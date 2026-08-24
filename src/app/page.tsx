'use client'

import { CustomerLanding } from '@/components/customer/customer-landing'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LogIn, UserPlus } from 'lucide-react'

export default function Home() {
  return (
    <>
      {/* Top nav with login/signup buttons */}
      <div className="sticky top-0 z-50 w-full border-b border-navy-100 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
              <rect width="40" height="40" rx="9" fill="#0A192F"/>
              <path d="M11 12 L20 20 L11 28" stroke="#D4AF37" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <path d="M29 12 L20 20 L29 28" stroke="#D4AF37" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <circle cx="20" cy="20" r="2.2" fill="#D4AF37"/>
            </svg>
            <div className="leading-tight">
              <p className="font-serif text-xl font-bold text-navy">Kozy</p>
              <p className="text-[9px] uppercase tracking-[0.18em] text-navy-400 font-medium">Drycleaning &amp; Laundry</p>
            </div>
          </div>
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
          // Redirect to signup/login
          window.location.href = '/signup'
        }}
        onPortal={() => {
          window.location.href = '/login'
        }}
      />
    </>
  )
}
