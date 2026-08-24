'use client'

import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/components/shell/theme-provider'

interface Props {
  portal: 'landing' | 'customer' | 'admin' | 'driver'
  onChange: (p: 'landing' | 'customer' | 'admin' | 'driver') => void
}

export function RoleSwitcher({ portal, onChange }: Props) {
  const { theme, toggle } = useTheme()

  const items = [
    { key: 'landing', label: 'Landing' },
    { key: 'customer', label: 'Customer' },
    { key: 'admin', label: 'Admin' },
    { key: 'driver', label: 'Driver' },
  ] as const

  return (
    <div className="sticky top-0 z-50 w-full border-b border-navy-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 dark:border-navy-500 dark:bg-navy-800/95 dark:supports-[backdrop-filter]:bg-navy-800/85">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <button
          onClick={() => onChange('landing')}
          className="flex items-center gap-2.5 transition hover:opacity-80"
        >
          <svg width="32" height="32" viewBox="0 0 40 40" fill="none" className="shrink-0" xmlns="http://www.w3.org/2000/svg">
            <rect width="40" height="40" rx="9" fill="#0A192F"/>
            <path d="M11 12 L20 20 L11 28" stroke="#D4AF37" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <path d="M29 12 L20 20 L29 28" stroke="#D4AF37" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <circle cx="20" cy="20" r="2.2" fill="#D4AF37"/>
          </svg>
          <div className="leading-tight">
            <p className="font-serif text-base font-semibold tracking-tight text-navy dark:text-white">Kozy</p>
            <p className="text-[10px] uppercase tracking-[0.15em] text-navy-300 dark:text-navy-200">
              {portal === 'landing' && 'Public site'}
              {portal === 'customer' && 'Customer Portal'}
              {portal === 'admin' && 'Atelier Console'}
              {portal === 'driver' && 'Field Operations'}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-linen-200 p-1 dark:bg-navy-600">
            {items.map((it) => {
              const active = portal === it.key
              return (
                <button
                  key={it.key}
                  onClick={() => onChange(it.key)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition',
                    active
                      ? 'bg-navy text-white shadow-navy dark:bg-gold-400 dark:text-navy'
                      : 'text-navy-300 hover:text-navy dark:text-navy-200 dark:hover:text-white'
                  )}
                >
                  {it.label}
                </button>
              )
            })}
          </div>

          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-linen-200 text-navy transition hover:bg-linen-300 dark:bg-navy-600 dark:text-gold-400 dark:hover:bg-navy-500"
          >
            {theme === 'light' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  )
}
