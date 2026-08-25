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
  sm: { mark: 32, text: 'text-base', subtitle: 'text-[8px]', gap: 'gap-2' },
  md: { mark: 44, text: 'text-xl', subtitle: 'text-[9px]', gap: 'gap-2.5' },
  lg: { mark: 64, text: 'text-3xl', subtitle: 'text-[10px]', gap: 'gap-3' },
}

export function Logo({ size = 'md', showText = true, subtitle, className, onClick, variant = 'light' }: LogoProps) {
  const s = SIZES[size]
  const textColor = variant === 'dark' ? 'text-white' : 'text-navy'
  const subtitleColor = variant === 'dark' ? 'text-gold-300' : 'text-navy-400'

  return (
    <button
      onClick={onClick}
      className={cn('flex items-center transition hover:opacity-80', s.gap, className)}
      disabled={!onClick}
    >
      <img
        src="/kozy-icon.png"
        alt="Kozy Care"
        width={s.mark}
        height={s.mark}
        className="shrink-0 rounded-lg"
        style={{ width: s.mark, height: s.mark }}
      />
      {showText && (
        <div className="leading-tight text-left">
          <p className={cn('font-serif font-bold tracking-tight', textColor, s.text)}>Kozy Care</p>
          {subtitle && (
            <p className={cn('uppercase tracking-[0.15em] font-medium', subtitleColor, s.subtitle)}>
              {subtitle}
            </p>
          )}
        </div>
      )}
    </button>
  )
}
