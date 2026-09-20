'use client'

// =============================================================================
// PublicNav — the sticky top bar shared by the public pages (home, /services).
// Phase 45: gained the "Services & pricing" link so the split-out services
// page is one click away from anywhere. Logo click always goes home.
// =============================================================================

import Link from 'next/link'
import { LogIn, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/shell/logo'

export function PublicNav() {
  return (
    <div className="sticky top-0 z-50 w-full border-b border-navy-100 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-5 lg:gap-7">
          {/* Logo = "back to home". Rendered as a real link: finger pointer on
              hover, middle-click/new-tab support, smooth client-side nav (no
              full-page reload), and a tooltip that teaches laptop users it
              goes home. */}
          <Logo
            size="md"
            subtitle="Drycleaning & Laundry"
            href="/"
            title="Back to the home page"
          />
          <Link
            href="/services"
            className="hidden text-sm font-medium text-navy-300 transition-colors hover:text-navy sm:inline"
          >
            Services &amp; pricing
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-navy-200 text-navy hover:bg-navy hover:text-white"
            >
              <LogIn className="mr-1.5 h-3.5 w-3.5" /> Sign in
            </Button>
          </Link>
          <Link href="/signup">
            <Button
              size="sm"
              className="rounded-full bg-gold-gradient font-semibold text-navy hover:opacity-90"
            >
              <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Sign up
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
