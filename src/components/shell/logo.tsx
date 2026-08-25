'use client'

import Image from 'next/image'
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
  sm: { mark: 28, text: 'text-sm', subtitle: 'text-[8px]' },
  md: { mark: 40, text: 'text-xl', subtitle: 'text-[9px]' },
  lg: { mark: 56, text: 'text-2xl', subtitle: 'text-[10px]' },
}

export function Logo({ size = 'md', showText = true, subtitle, className, onClick, variant = 'light' }: LogoProps) {
  const s = SIZES[size]
  const textColor = variant === 'dark' ? 'text-white' : 'text-navy'
  const subtitleColor = variant === 'dark' ? 'text-gold-300' : 'text-navy-400'

  return (
    <button
      onClick={onClick}
      className={cn('flex items-center gap-2 transition hover:opacity-80', className)}
      disabled={!onClick}
    >
      <div className="relative shrink-0" style={{ width: s.mark, height: s.mark }}>
        <Image
          src="/kozy-icon.png"
          alt="Kozy Care"
          fill
          className="object-contain"
          sizes={`${s.mark}px`}
        />
      </div>
      {showText && (
        <div className="leading-tight text-left">
          <p className={cn('font-serif font-bold tracking-tight', textColor, s.text)}>Kozy Care</p>
          {subtitle && (
            <p className={cn('uppercase tracking-[0.18em] font-medium', subtitleColor, s.subtitle)}>
              {subtitle}
            </p>
          )}
        </div>
      )}
    </button>
  )
}
