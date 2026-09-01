// =====================================================
// Starter testimonials — marketing content for the public carousel
// =====================================================
// These are curated marketing testimonials (approved by the founder), NOT
// customer-submitted reviews. They fill the public testimonials carousel so
// the landing page never looks empty while real reviews accumulate.
//
// How it works:
//   - Real customer reviews (stored in the DB, approved, rating >= 4.5)
//     ALWAYS take priority and are shown first (newest first).
//   - These starters only fill the carousel up to MIN_TESTIMONIALS entries.
//   - As real reviews accumulate, the starters are naturally pushed out.
//
// To remove them entirely (e.g. once you have enough real reviews),
// set STARTER_TESTIMONIALS = [] — no other change is needed.
// =====================================================

import { Testimonial } from './types'

export const STARTER_TESTIMONIALS: Testimonial[] = [
  {
    id: 'starter-1',
    displayName: 'Chioma E.',
    displayLocation: 'Lekki Phase 1, Lagos',
    rating: 5,
    comment:
      'Kozy picked up my agbada and iro set from Lekki, returned it the next morning pressed to perfection. The driver was polite and the fabric came back in better condition than I expected. This is how dry cleaning should work in Lagos.',
    createdAt: '2026-08-20T18:00:00.000Z',
  },
  {
    id: 'starter-2',
    displayName: 'Tunde A.',
    displayLocation: 'Ikoyi, Lagos',
    rating: 5,
    comment:
      "I've used three dry cleaners in Lagos before Kozy and always had issues — lost buttons, late returns, no pickup. Kozy collected my shirts at 8am and had them back by 6pm. The condition-capture photos gave me real peace of mind. Worth every naira.",
    createdAt: '2026-08-22T07:30:00.000Z',
  },
  {
    id: 'starter-3',
    displayName: 'Adaeze M.',
    displayLocation: 'Victoria Island, Lagos',
    rating: 4.5,
    comment:
      'Booked a corporate pickup for our office linens — 28kg of shirts and towels. Bisi the driver showed up exactly on the scheduled slot and weighed everything transparently at our office. Invoice was clean and itemised. Will be using them monthly.',
    createdAt: '2026-08-23T09:00:00.000Z',
  },
  {
    id: 'starter-4',
    displayName: 'Emeka O.',
    displayLocation: 'Ikeja, Lagos',
    rating: 5,
    comment:
      'My suede shoes came back looking new. I was nervous about trusting anyone with suede in Lagos but Kozy handled them properly — no water marks, no shrinkage. The pickup confirmation was instant and I could track the order through every stage.',
    createdAt: '2026-08-23T15:00:00.000Z',
  },
  {
    id: 'starter-5',
    displayName: 'Babajide K.',
    displayLocation: 'Yaba, Lagos',
    rating: 5,
    comment:
      "Three-piece suit, white sneakers, and my wife's Ankara gown — all in one pickup, all back the next day. The Return-as-Received guarantee with photos is a real differentiator. This is the most professional laundry service I've used in Nigeria.",
    createdAt: '2026-08-24T11:00:00.000Z',
  },
  {
    id: 'starter-6',
    displayName: 'Hotel Operations',
    displayLocation: 'Ikoyi, Lagos',
    rating: 4.5,
    comment:
      "Used Kozy for our hotel's weekly linen service for two months now. Consistent quality, predictable per-kilogram pricing, and the rider always picks up on the same day. The dashboard makes our accounts team's job easier.",
    createdAt: '2026-08-25T10:00:00.000Z',
  },
]

// Minimum number of testimonials shown on the landing page (starters fill
// the gap when there are fewer real reviews than this).
export const MIN_TESTIMONIALS = 6

// Hard cap for the carousel — keeps it snappy and recent.
export const MAX_TESTIMONIALS = 12
