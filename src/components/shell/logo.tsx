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

// The icon is a wide logo (725x243 aspect ratio = ~3:1)
// We size it by HEIGHT so it scales proportionally
const SIZES = {
  sm: { height: 24, text: 'text-sm', subtitle: 'text-[8px]', gap: 'gap-2' },
  md: { height: 32, text: 'text-xl', subtitle: 'text-[9px]', gap: 'gap-2.5' },
  lg: { height: 44, text: 'text-2xl', subtitle: 'text-[10px]', gap: 'gap-3' },
}

export function Logo({ size = 'md', showText = true, subtitle, className, onClick, variant = 'light' }: LogoProps) {
  const s = SIZES[size]
  const textColor = variant === 'dark' ? 'text-white' : 'text-[#0A192F]'
  const subtitleColor = variant === 'dark' ? 'text-[#D4AF37]' : 'text-[#6F88A8]'

  return (
    <button
      onClick={onClick}
      className={cn('flex items-center transition hover:opacity-80', s.gap, className)}
      disabled={!onClick}
    >
      {/* Logo image — sized by height, width auto-scales from aspect ratio */}
      <img
        src="/kozy-icon.png"
        alt="Kozy Care"
        className="shrink-0"
        style={{ height: s.height, width: 'auto' }}
      />
      {showText && subtitle && (
        <div className="flex flex-col justify-center leading-none">
          <p className={cn('font-serif font-bold tracking-tight', textColor, s.text)} style={{ lineHeight: 1.1 }}>
            Kozy Care
          </p>
          <p className={cn('uppercase tracking-[0.15em] font-medium mt-0.5', subtitleColor, s.subtitle)}>
            {subtitle}
          </p>
        </div>
      )}
    </button>
  )
}
