'use client'

// =============================================================================
// PublicNav — the sticky top bar shared by the public pages (home, /services,
// /memberships).
// Phase 64 (owner): the Membership entry is now a full BRAND-NAVY pill with
// white text in the same family as Sign in / Sign up — the quiet text link
// and the separate Pricing pill are retired. Pricing moved in with the plans
// on /memberships ("Plans & Pricing"), so ONE button covers both and the top
// bar stays uncluttered: Membership -> Sign in -> Sign up (gold, terminal),
// the owner's funnel order, on every breakpoint.
// Logo click always goes home.
// =============================================================================

import Link from 'next/link'
import { Crown, LogIn, UserPlus } from 'lucide-react'
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
              goes home.
              Two variants keep the mobile bar to ONE row (even on 360px
              Androids): phones get the compact mark + wordmark — the
              "Drycleaning & Laundry" subtitle returns from sm up, where the
              row has room for it. The hero right below already carries the
              "drycleaning & laundry" context on phones. */}
          <Logo
            size="sm"
            subtitle={null}
            href="/"
            title="Back to the home page"
            className="sm:hidden"
          />
          <Logo
            size="md"
            subtitle="Drycleaning & Laundry"
            href="/"
            title="Back to the home page"
            className="hidden sm:flex"
          />
        </div>
        {/* Account cluster — one aligned pill family, mobile and desktop.
            Order is the owner's funnel: plans & prices (navy, the strongest
            non-terminal action) -> sign in -> sign up (gold, terminal).
            Icons hide below sm and the navy pill reads "Plans" there — the
            owner's own word for the tiers — so logo + all three pills sit on
            ONE row on a 390px phone (a two-row 108px sticky bar crowded the
            hero); full "Membership" label returns from sm up. */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Link href="/memberships">
            <Button
              size="sm"
              className="rounded-full border-navy bg-navy px-2.5 text-xs font-medium text-white hover:bg-navy-600 hover:text-white sm:px-4"
            >
              <Crown className="mr-1.5 hidden h-3.5 w-3.5 sm:inline-block" />
              <span className="sm:hidden">Plans</span>
              <span className="hidden sm:inline">Membership</span>
            </Button>
          </Link>
          <Link href="/login">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-navy-200 px-2.5 text-navy hover:bg-navy hover:text-white sm:px-4"
            >
              <LogIn className="mr-1.5 hidden h-3.5 w-3.5 sm:inline-block" /> Sign in
            </Button>
          </Link>
          <Link href="/signup">
            <Button
              size="sm"
              className="rounded-full bg-gold-gradient px-2.5 text-xs font-semibold text-navy hover:opacity-90 sm:px-4"
            >
              <UserPlus className="mr-1.5 hidden h-3.5 w-3.5 sm:inline-block" /> Sign up
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
