import type { Metadata } from 'next'
import { MembershipsClient } from '@/components/customer/memberships-page'
import { MEMBERSHIPS_FAQ } from '@/lib/faq-content'

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

// Structured data (Task 85): the breadcrumb stays, and the FAQ the page
// already renders becomes FAQPage schema — built from the SAME source array
// the visible FAQ uses (src/lib/faq-content.ts), so the answer Google shows
// in search can never disagree with the answer on the page. No invented
// questions; every word is already published on the page.
const graphSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
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
    },
    {
      '@type': 'FAQPage',
      '@id': 'https://kozycare.ng/memberships#faq',
      mainEntity: MEMBERSHIPS_FAQ.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: f.a,
        },
      })),
    },
  ],
}

export default function MembershipsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(graphSchema) }}
      />
      <MembershipsClient />
    </>
  )
}
