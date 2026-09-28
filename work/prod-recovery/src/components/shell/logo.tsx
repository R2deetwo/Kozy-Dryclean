'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  /** Optional line under the wordmark. Pass null to render the wordmark only
   *  (e.g. the compact mobile nav logo); omit for the default subtitle. */
  subtitle?: string | null
  className?: string
  onClick?: () => void
  /** Render as a Next.js Link (navigation) instead of a <button> (action). */
  href?: string
  /** Native hover tooltip, e.g. "Back to the home page". Also used as the
      accessible label so screen readers announce the destination. */
  title?: string
  variant?: 'light' | 'dark'
}

const SIZES = {
  sm: { mark: 28, text: 'text-base', subtitle: 'text-[8px]', gap: 'gap-2' },
  md: { mark: 40, text: 'text-xl', subtitle: 'text-[9px]', gap: 'gap-2.5' },
  lg: { mark: 56, text: 'text-2xl', subtitle: 'text-[10px]', gap: 'gap-3' },
}

const DEFAULT_SUBTITLE = 'Drycleaning & Laundry'

export function Logo({
  size = 'md',
  showText = true,
  subtitle,
  className,
  onClick,
  href,
  title,
  variant = 'light',
}: LogoProps) {
  const s = SIZES[size]
  const textColor = variant === 'dark' ? 'text-white' : 'text-[#0A192F]'
  const subtitleColor = variant === 'dark' ? 'text-[#D4AF37]' : 'text-[#6F88A8]'

  const content = (
    <>
      {/* Kozy Care brand mark — v4 stylized K with tapered hanger-wire (vector,
          transparent background; gold reads on both light and navy surfaces). */}
      <img
        src="/brand/kozy-mark.svg"
        alt="Kozy Care mark"
        width={s.mark}
        height={s.mark}
        className="shrink-0"
        style={{ width: s.mark, height: s.mark }}
      />
      {showText && (
        <div className="flex flex-col justify-center text-left leading-none">
          <p className={cn('font-serif font-bold tracking-tight', textColor, s.text)} style={{ lineHeight: 1.15 }}>
            Kozy Care
          </p>
          {subtitle !== null && (
            <p className={cn('uppercase tracking-[0.15em] font-medium mt-1', subtitleColor, s.subtitle)}>
              {subtitle ?? DEFAULT_SUBTITLE}
            </p>
          )}
        </div>
      )}
    </>
  )

  // Navigation usage: a real anchor. Anchors show the finger pointer on hover
  // (a <button> never does — the client's exact complaint) and support
  // middle-click / "open in new tab", which buttons don't.
  if (href) {
    return (
      <Link
        href={href}
        title={title}
        aria-label={title}
        className={cn('flex items-center', s.gap, className)}
      >
        {content}
      </Link>
    )
  }

  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      // cursor-pointer only when the button actually does something —
      // decorative logos keep the default arrow and stay disabled.
      className={cn('flex items-center', s.gap, onClick && 'cursor-pointer', className)}
      disabled={!onClick}
    >
      {content}
    </button>
  )
}
