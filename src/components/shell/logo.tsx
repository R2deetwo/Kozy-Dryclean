'use client'

import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  subtitle?: string
  className?: string
  onClick?: () => void
  variant?: 'light' | 'dark'
}

const SIZES = {
  sm: { mark: 28, text: 'text-base', subtitle: 'text-[8px]', gap: 'gap-2' },
  md: { mark: 40, text: 'text-xl', subtitle: 'text-[9px]', gap: 'gap-2.5' },
  lg: { mark: 56, text: 'text-2xl', subtitle: 'text-[10px]', gap: 'gap-3' },
}

const DEFAULT_SUBTITLE = 'Drycleaning & Laundry'

export function Logo({ size = 'md', showText = true, subtitle, className, onClick, variant = 'light' }: LogoProps) {
  const s = SIZES[size]
  const textColor = variant === 'dark' ? 'text-white' : 'text-[#0A192F]'
  const subtitleColor = variant === 'dark' ? 'text-[#D4AF37]' : 'text-[#6F88A8]'

  return (
    <button
      onClick={onClick}
      className={cn('flex items-center', s.gap, className)}
      disabled={!onClick}
    >
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
    </button>
  )
}
