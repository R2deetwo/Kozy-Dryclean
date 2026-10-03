// =============================================================================
// The memberships FAQ — one source for two consumers (Task 85)
// =============================================================================
// These are the exact questions and answers rendered on /memberships. The
// page component maps over them for the visible FAQ, and the route's server
// wrapper turns the same array into FAQPage structured data — so the answer
// Google shows in search results can never disagree with the answer on the
// page. Copy edits happen here, once.
// =============================================================================

export interface FaqEntry {
  q: string
  a: string
}

export const MEMBERSHIPS_FAQ: readonly FaqEntry[] = [
  {
    q: 'What about couture, designer or premium traditional wear?',
    a: 'That is Couture Care — its own specialist service, not a bigger plan. Designer pieces, aso-oke and lace, agbada, bridal: every piece is assessed before treatment, cleaned and finished by hand, returned in protective covers, and quoted for your approval before any work begins. Circle members get their plan discount on the quote. If you are unsure, send it with your next pickup — the studio will tell you honestly whether it needs the specialists or the normal wash.',
  },
  {
    q: 'Do the plans really include shoes?',
    a: 'Yes — every plan cleans shoes monthly, on the house: 1 pair on The Essentials, 3 pairs on The Household, 5 pairs on The Whole Home. One pair means the standard sneaker and canvas clean (washed, brushed, deodorised); suede, leather and embellished pairs use the specialist service with your member discount. Need more pairs than your plan includes — or shoes only, without a laundry plan? The Shoe Club adds 2, 4 or 6 pairs a month and stacks on top of any tier.',
  },
  {
    q: 'What if my bag is not full — or overflowing?',
    a: 'A half-full bag still counts as one of your pickups (the rider still rides). An overflowing one becomes an extra pickup — up to two a month at the plan rate, charged on that order. Nothing surprises you.',
  },
  {
    q: 'What exactly fits in one bag?',
    a: 'One bag is one person’s full week: 7 collared or long-sleeve shirts, 7 inner vests, 7 underwear, 7 trousers and 7 pairs of socks — fresh and kitted for a full week, every week. The Household box holds three people’s week (21 of each) and The Whole Home box holds five (35 of each), collected weekly. Need more of anything? Extras ride along at your member discount.',
  },
  {
    q: 'What happens to the bag or box if I leave?',
    a: 'It returns with your final delivery and that closes the chapter cleanly. If it does not come back, the replacement fee on your plan covers it — no deposits, no drama.',
  },
  {
    q: 'When do my duvets, sheets and curtains refresh?',
    a: 'Bed sheets refresh with your monthly cycle (The Household includes 4 a month — two every two weeks; The Whole Home, 6). Duvet and curtain perks reset every 3 months; the yearly deep clean resets each January. Your portal always shows what is left, so there is nothing to remember.',
  },
  {
    q: 'Can I really cancel any time?',
    a: 'Yes — one tap in your portal. The plan stays fully active to the last day you paid for, then simply does not renew. No calls, no forms, no drama.',
  },
  {
    q: 'How do I pay?',
    a: 'Card members are charged automatically each month through Paystack. Transfer members get a reminder before renewal with the studio account details — pay, attach the receipt, and the month extends.',
  },
] as const
