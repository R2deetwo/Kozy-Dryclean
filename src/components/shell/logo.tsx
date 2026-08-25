'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  subtitle?: string
  className?: string
  onClick?: () => void
}

const SIZES = {
  sm: { mark: 28, text: 'text-sm', subtitle: 'text-[8px]' },
  md: { mark: 40, text: 'text-xl', subtitle: 'text-[9px]' },
  lg: { mark: 56, text: 'text-2xl', subtitle: 'text-[10px]' },
}

export function Logo({ size = 'md', showText = true, subtitle, className, onClick }: LogoProps) {
  const s = SIZES[size]

  return (
    <button
      onClick={onClick}
      className={cn('flex items-center gap-2.5 transition hover:opacity-80', className)}
      disabled={!onClick}
    >
      <div className="relative shrink-0" style={{ width: s.mark, height: s.mark }}>
        <Image
          src="/kozy-logo.png"
          alt="Kozy"
          fill
          className="object-contain rounded-lg"
          sizes={`${s.mark}px`}
        />
      </div>
      {showText && (
        <div className="leading-tight text-left">
          <p className={cn('font-serif font-bold tracking-tight text-navy', s.text)}>Kozy</p>
          {subtitle && (
            <p className={cn('uppercase tracking-[0.18em] text-navy-400 font-medium', s.subtitle)}>
              {subtitle}
            </p>
          )}
        </div>
      )}
    </button>
  )
}
