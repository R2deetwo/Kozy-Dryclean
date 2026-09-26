'use client'

// =============================================================================
// PublicNav — the sticky top bar shared by the public pages (home, /services).
// Phase 49 (owner): the services/pricing entry is a BRAND-NAVY pill with white
// text in the account cluster (Pricing -> Sign in -> Sign up), aligned with
// the other pills and shown on EVERY breakpoint (the earlier desktop text
// link is replaced by the same pill — one entry point, consistent).
// Logo click always goes home.
// =============================================================================

import Link from 'next/link'
import { LogIn, Tag, UserPlus } from 'lucide-react'
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
        </div>
        {/* Account cluster — one aligned pill family, mobile and desktop.
            Order is the owner's funnel: browse pricing -> sign up (gold,
            terminal). The Membership link is deliberately a QUIET text link
            (phase 62): the Kozy Circle is an option for people who want it,
            never front-and-center. */}
        <div className="flex items-center gap-2">
          <Link href="/memberships">
            <Button
              variant="ghost"
              size="sm"
              className="hidden rounded-full px-3 text-xs font-medium text-navy-300 hover:bg-linen-100 hover:text-navy sm:inline-flex"
            >
              Membership
            </Button>
          </Link>
          <Link href="/services">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-navy bg-navy text-white hover:bg-navy-600 hover:text-white"
            >
              <Tag className="mr-1.5 h-3.5 w-3.5" /> Pricing
            </Button>
          </Link>
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
