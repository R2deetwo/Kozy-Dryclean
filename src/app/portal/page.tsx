'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CustomerPortal } from '@/components/customer/customer-portal'
import { RENEWAL_MONTH_CHOICES } from '@/lib/types'

// Phase 76: the prepopulated renewal deep link. The monthly summary email
// (and the paused/reactivation email) point at /portal?renew=1&months=N —
// this opens the portal straight on the Membership tab with the renewal
// card's month count already selected, so the member is one tap from paying.
// Phase 77: /portal?store=1 (the email's store line) opens the Store tab —
// and quietly falls back to the dashboard while the store is dark.
function PortalWithDeepLinks() {
  const params = useSearchParams()
  const renew = params.get('renew') === '1'
  const store = params.get('store') === '1'
  const monthsRaw = Number(params.get('months'))
  const months = (RENEWAL_MONTH_CHOICES as readonly number[]).includes(monthsRaw)
    ? monthsRaw
    : undefined
  return (
    <CustomerPortal
      initialView="dashboard"
      initialTab={renew ? 'membership' : store ? 'store' : undefined}
      renewPrefill={renew ? (months ?? 1) : undefined}
    />
  )
}

export default function PortalPage() {
  return (
    <Suspense fallback={null}>
      <PortalWithDeepLinks />
    </Suspense>
  )
}
