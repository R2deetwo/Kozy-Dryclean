'use client'

import { Sparkles, ShoppingBag, LayoutDashboard, Truck } from 'lucide-react'
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
    <div className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-foreground">Lagos Fresh Laundry</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Demo · {portal} view
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-muted p-1">
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
                    ? 'bg-white text-foreground shadow-sm ring-1 ring-black/5'
                    : 'text-muted-foreground hover:text-foreground'
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
