'use client'

import { useState } from 'react'
import { CustomerLanding } from './customer-landing'
import { BookingWizard } from './booking-wizard'
import { CustomerDashboard } from './customer-dashboard'
import { InvoiceView } from './invoice-view'
import type { Order } from '@/lib/types'

type View =
  | { name: 'landing' }
  | { name: 'booking' }
  | { name: 'dashboard'; highlightOrderId?: string }
  | { name: 'invoice'; order: Order }

export function CustomerPortal() {
  const [view, setView] = useState<View>({ name: 'landing' })

  if (view.name === 'landing') {
    return (
      <CustomerLanding
        onBook={() => setView({ name: 'booking' })}
        onDashboard={() => setView({ name: 'dashboard' })}
      />
    )
  }
  if (view.name === 'booking') {
    return (
      <BookingWizard
        onComplete={(order) =>
          setView({ name: 'dashboard', highlightOrderId: order.id })
        }
        onCancel={() => setView({ name: 'landing' })}
      />
    )
  }
  if (view.name === 'dashboard') {
    return (
      <CustomerDashboard
        // Key forces a fresh mount whenever highlightOrderId changes,
        // so the OrderDetailModal useState initializer can pick it up.
        key={view.highlightOrderId ?? 'default'}
        initialHighlight={view.highlightOrderId}
        onBack={() => setView({ name: 'landing' })}
        onBook={() => setView({ name: 'booking' })}
        onViewInvoice={(order) => setView({ name: 'invoice', order })}
      />
    )
  }
  if (view.name === 'invoice') {
    return (
      <InvoiceView
        order={view.order}
        onBack={() => setView({ name: 'dashboard' })}
      />
    )
  }
  return null
}
