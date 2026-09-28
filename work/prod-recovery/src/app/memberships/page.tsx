import type { Metadata } from 'next'
import { MembershipsClient } from '@/components/customer/memberships-page'

// =============================================================================
// /memberships — Plans & Pricing: the Kozy Circle (phase 62 → 64)
// =============================================================================
// Phase 64 (owner): pricing and the plans are MERGED here — the three monthly
// circles first, the full per-item price list below. The nav carries one
// Membership button (same pill family as Sign in / Sign up); the separate
// Pricing pill is retired so the top bar stays uncluttered. Placement stays
// deliberate: discoverable from the top bar, the home page strip and the
// footer — never shouted at visitors who just want a one-off clean.
// The price-SEO title/description moved here from /services when the price
// list did.
// =============================================================================

export const metadata: Metadata = {
  title: 'Laundry Membership Plans & Dry Cleaning Prices in Lagos | Kozy Care',
  description:
    'One page, both ways to pay: the Kozy Circle monthly plans — a Kozy Bag or Box collected weekly from ₦30,000 a month — and the full per-item dry cleaning price list for men, women and the home, plus per-kg corporate programs across Ikoyi, Lekki and Lagos Island. Free pickup and delivery on every plan.',
  alternates: { canonical: '/memberships' },
  openGraph: {
    title: 'Plans & Pricing — The Kozy Circle | Kozy Care',
    description:
      'Monthly laundry membership measured by the Kozy Bag and Kozy Box, with the full per-item price list below. Free pickup and delivery, every time.',
  },
}

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: 'https://kozycare.ng',
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Plans & pricing',
      item: 'https://kozycare.ng/memberships',
    },
  ],
}

export default function MembershipsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <MembershipsClient />
    </>
  )
}
