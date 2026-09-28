'use client'

// =============================================================================
// StickyMobileCta — thumb-reach booking bar for phones (phase 44), shared by
// home + /services (phase 45). Appears once the visitor scrolls past the top
// of the page, respects the iPhone home-indicator safe area, and the spacer
// keeps it from covering the footer's last lines at page bottom.
// prefers-reduced-motion disables the slide (handled by the
// kozy-sticky-cta class in globals.css).
// =============================================================================

import { useEffect, useState } from 'react'
import { ArrowRight, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'

export function StickyMobileCta({ onBook }: { onBook: () => void }) {
  const [showStickyCta, setShowStickyCta] = useState(false)
  useEffect(() => {
    const onScroll = () => setShowStickyCta(window.scrollY > 520)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <div className="h-20 md:hidden" aria-hidden="true" />
      <div
        className={cn(
          'kozy-sticky-cta fixed inset-x-0 bottom-0 z-40 border-t border-navy-100 bg-white/95 shadow-[0_-4px_20px_rgba(15,35,64,0.08)] backdrop-blur transition-transform duration-300 md:hidden',
          'pb-[env(safe-area-inset-bottom)]',
          showStickyCta ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <a
            href="tel:+2348031755230"
            aria-label="Call Kozy Care"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-navy-200 text-navy transition-colors hover:border-gold-400"
          >
            <Phone className="h-4 w-4" />
          </a>
          <button
            onClick={onBook}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-gold-gradient text-sm font-bold text-navy transition hover:opacity-90"
          >
            Book a pickup <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  )
}
