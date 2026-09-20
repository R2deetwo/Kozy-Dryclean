#!/usr/bin/env python3
"""Phase 45 — slim the home page:
1. Replace the big PRICING & SERVICES section with a compact services summary.
2. Remove LIFESTYLE/ATELIER + SHOE CARE + ALTERATIONS sections (moved to /services).
3. Replace the inline FOOTER + sticky CTA + NewsletterSignup with shared components.
Run from /home/z/my-project.
"""

from pathlib import Path

F = Path('src/components/customer/customer-landing.tsx')
src = F.read_text()

def find_block_start(text: str, header_line: str) -> int:
    """Index of the line that begins the comment block containing header_line."""
    lines = text.split('\n')
    for i, ln in enumerate(lines):
        if header_line in ln:
            # walk back to the opening {/* ===== line
            j = i
            while j > 0 and not lines[j].strip().startswith('{/*'):
                j -= 1
            return text.index('\n'.join(lines[j:])) if j > 0 else None
    raise ValueError(f'header not found: {header_line}')

def idx_of(text: str, marker: str) -> int:
    i = text.index(marker)
    return i

# ---- 1. PRICING & SERVICES -> services-at-a-glance -------------------------
pricing_start = idx_of(src, '      {/* ============================================================\n          PRICING & SERVICES')
testimonials_start = idx_of(src, "      {/* ============================================================\n          TESTIMONIALS")

SUMMARY = '''      {/* ============================================================
          SERVICES AT A GLANCE — compact pointer to /services (phase 45).
          The client's customer found the home page a very long scroll, so
          the full per-item pricing tables, atelier story, sneaker
          restoration and alterations moved to their own page. The home page
          keeps this summary: six cards, honest "from" prices (live from the
          server catalog), one click to the detail.
      ============================================================ */}
      <section id="services" className="bg-white py-20 scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">
                What we do
              </p>
              <h2 className="font-serif text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
                Six services. One pickup.
              </h2>
              <p className="mt-2 max-w-xl text-navy-300">
                Everything rides the same free island-wide pickup — dry cleaning, household
                linens, sneakers, even alterations. First delivery is on us.
              </p>
            </div>
            <Button
              asChild
              variant="outline"
              className="rounded-full border-gold-300 bg-white text-navy hover:bg-gold-50"
            >
              <Link href="/services">
                See all services &amp; pricing{' '}
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                href: '/services',
                icon: ShoppingBag,
                title: "Men's dry cleaning",
                blurb: 'Suits, shirts, agbada and native wear — pressed to atelier standard.',
                price: menFrom != null ? `From ${formatNaira(menFrom)}` : 'Per item',
              },
              {
                href: '/services',
                icon: Sparkles,
                title: "Women's dry cleaning",
                blurb: 'Dresses, skirts, iro & buba — delicate fabrics get dedicated care zones.',
                price: womenFrom != null ? `From ${formatNaira(womenFrom)}` : 'Per item',
              },
              {
                href: '/services',
                icon: BedDouble,
                title: 'Home & linens',
                blurb: 'Bedsheets, duvets, curtains — fresh, folded, sealed for delivery.',
                price: homeFrom != null ? `From ${formatNaira(homeFrom)}` : 'Per item',
              },
              {
                href: '/services#shoe-care',
                icon: Zap,
                title: 'Shoe care & restoration',
                blurb: 'Sneakers and trainers brought back to box-fresh condition.',
                price: 'From \\u20a65,000',
              },
              {
                href: '/services#alterations',
                icon: Scissors,
                title: 'Alterations & repairs',
                blurb: 'In-house tailor — same rider, same delivery as your laundry.',
                price:
                  appSettings.alterationsFromPrice > 0
                    ? `From ${formatNaira(appSettings.alterationsFromPrice)}`
                    : 'Quoted before we sew',
              },
              {
                href: '/services#pricing',
                icon: Building2,
                title: 'Corporate & hotels',
                blurb: 'Weight-based programs with monthly statements and Net-15 terms.',
                price: `${formatNaira(appSettings.pricePerKg)} per kg`,
              },
            ].map((c) => {
              const Icon = c.icon
              return (
                <Link
                  key={c.title}
                  href={c.href}
                  className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
                >
                  <Card className="h-full border-navy-100 shadow-navy transition-shadow duration-200 group-hover:shadow-lg group-hover:ring-1 group-hover:ring-gold-200">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linen-50">
                          <Icon className="h-5 w-5 text-gold-500" />
                        </div>
                        <ArrowRight className="h-4 w-4 text-navy-200 transition-all group-hover:translate-x-0.5 group-hover:text-gold-500" />
                      </div>
                      <h3 className="mt-3 font-serif text-lg font-semibold text-navy">
                        {c.title}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-navy-300">{c.blurb}</p>
                      <p className="mt-3 text-sm font-semibold text-navy">{c.price}</p>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

'''

src = src[:pricing_start] + SUMMARY + src[testimonials_start:]

# ---- 2. Remove LIFESTYLE/ATELIER + SHOE CARE + ALTERATIONS ------------------
lifestyle_start = idx_of(src, '      {/* ============================================================\n          LIFESTYLE / ATELIER')
female_start = idx_of(src, '      {/* ============================================================\n          FEMALE LIFESTYLE')
src = src[:lifestyle_start] + src[female_start:]

# ---- 3. FOOTER + sticky CTA + NewsletterSignup -> shared components ---------
footer_start = idx_of(src, '      {/* ============================================================\n          FOOTER')
src = src[:footer_start] + '''      <SiteFooter />
      <StickyMobileCta onBook={onBook} />
    </div>
  )
}
'''

F.write_text(src)
print('OK — new length:', len(src.split(chr(10))), 'lines')
