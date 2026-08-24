'use client'

import { ShoppingBag, LayoutDashboard, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  portal: 'customer' | 'admin' | 'driver'
  onChange: (p: 'customer' | 'admin' | 'driver') => void
}

export function RoleSwitcher({ portal, onChange }: Props) {
  const items = [
    { key: 'customer', label: 'Customer Portal', icon: ShoppingBag },
    { key: 'admin', label: 'Admin Dashboard', icon: LayoutDashboard },
    { key: 'driver', label: 'Driver App', icon: Truck },
  ] as const

  return (
    <div className="sticky top-0 z-50 w-full border-b border-navy-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-2.5">
          {/* Kozy mark */}
          <svg width="32" height="32" viewBox="0 0 40 40" fill="none" className="shrink-0">
            <rect width="40" height="40" rx="9" fill="#0A192F"/>
            <path d="M11 12 L20 20 L11 28" stroke="#D4AF37" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <path d="M29 12 L20 20 L29 28" stroke="#D4AF37" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <circle cx="20" cy="20" r="2.2" fill="#D4AF37"/>
          </svg>
          <div className="leading-tight">
            <p className="font-serif text-base font-semibold tracking-tight text-navy">Kozy</p>
            <p className="text-[10px] uppercase tracking-[0.15em] text-navy-300">
              {portal === 'customer' ? 'Customer Portal' : portal === 'admin' ? 'Atelier Console' : 'Field Operations'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-full bg-linen-200 p-1">
          {items.map((it) => {
            const Icon = it.icon
            const active = portal === it.key
            return (
              <button
                key={it.key}
                onClick={() => onChange(it.key)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition',
                  active
                    ? 'bg-navy text-white shadow-navy'
                    : 'text-navy-300 hover:text-navy'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{it.label}</span>
                <span className="sm:hidden">
                  {it.key === 'customer' ? 'Customer' : it.key === 'admin' ? 'Admin' : 'Driver'}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
