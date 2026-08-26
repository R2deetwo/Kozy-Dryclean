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

export function Logo({ size = 'md', showText = true, subtitle, className, onClick, variant = 'light' }: LogoProps) {
  const s = SIZES[size]
  const textColor = variant === 'dark' ? 'text-white' : 'text-[#0A192F]'
  const subtitleColor = variant === 'dark' ? 'text-[#D4AF37]' : 'text-[#6F88A8]'
  const bg = variant === 'dark' ? '#102740' : '#0A192F'

  return (
    <button
      onClick={onClick}
      className={cn('flex items-center', s.gap, className)}
      disabled={!onClick}
    >
      {/* Inline SVG mark — no image file, renders crisp at all sizes */}
      <svg
        width={s.mark}
        height={s.mark}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <rect width="40" height="40" rx="9" fill={bg} />
        <path d="M11 12 L20 20 L11 28" stroke="#D4AF37" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M29 12 L20 20 L29 28" stroke="#D4AF37" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="20" cy="20" r="2.2" fill="#D4AF37" />
      </svg>
      {showText && (
        <div className="flex flex-col justify-center text-left leading-none">
          <p className={cn('font-serif font-bold tracking-tight', textColor, s.text)} style={{ lineHeight: 1.15 }}>
            Kozy Care
          </p>
          {subtitle && (
            <p className={cn('uppercase tracking-[0.15em] font-medium mt-1', subtitleColor, s.subtitle)}>
              {subtitle}
            </p>
          )}
        </div>
      )}
    </button>
  )
}
