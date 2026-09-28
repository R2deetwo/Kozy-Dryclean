import type { Metadata } from 'next'
import { PartnersClient } from '@/components/customer/partners-page'

// =============================================================================
// /partners — the Kozy Network (phase 62)
// =============================================================================
// The B2B front door for the franchise-lite program: independent laundry
// operators join the Kozy brand — demand, technology and riders from us;
// processing capacity from them; revenue shared. Linked quietly from the
// footer ("Run a laundry? Join the network").
// =============================================================================

export const metadata: Metadata = {
  title: 'The Kozy Network — Run Your Laundry Under Our Brand | Kozy Care',
  description:
    'Own a laundry? Join the Kozy Network: we bring the demand, the brand and the technology — you bring the processing. Revenue share, onboarding included.',
  openGraph: {
    title: 'The Kozy Network — Kozy Care',
    description:
      'Demand, technology and brand in exchange for processing capacity. A revenue-share partnership for laundry operators in Lagos.',
  },
}

export default function PartnersPage() {
  return <PartnersClient />
}
