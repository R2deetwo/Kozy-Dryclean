import type { Metadata } from 'next'
import { MembershipsClient } from '@/components/customer/memberships-page'

// =============================================================================
// /memberships — The Kozy Circle (phase 62)
// =============================================================================
// Deliberately NOT front-and-center: the landing page links here quietly
// (footer + a text link in the nav). The people who want recurring laundry
// find it; nobody else is shouted at. Classy, unhurried, premium.
// =============================================================================

export const metadata: Metadata = {
  title: 'The Kozy Circle — Monthly Laundry Membership | Kozy Care',
  description:
    'One bag. One box. One rhythm. Monthly membership with free pickup & delivery, quarterly duvet care and a concierge tier for designer pieces — from ₦30,000 a month.',
  openGraph: {
    title: 'The Kozy Circle — Kozy Care Membership',
    description:
      'Monthly laundry membership measured by the Kozy Bag and Kozy Box. Free pickup and delivery, every time.',
  },
}

export default function MembershipsPage() {
  return <MembershipsClient />
}
