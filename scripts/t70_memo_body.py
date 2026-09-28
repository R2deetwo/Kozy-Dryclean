#!/usr/bin/env python3
"""Kozy Shoe Club — Lagos market research & pricing memo (Task 70)."""
import os, sys
sys.path.insert(0, '/home/z/my-project/skills/pdf/scripts')

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/freefont/FreeSerif.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-BoldItalic', f'{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold',
                   italic='FreeSerif-Italic', boldItalic='FreeSerif-BoldItalic')
registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')

from pdf import install_font_fallback
install_font_fallback()

# ━━ Cascade Palette (design_engine.py palette-cascade, seed 71) ━━
PAGE_BG       = colors.HexColor('#f2f1f0')
TABLE_STRIPE  = colors.HexColor('#f1f0ee')
HEADER_FILL   = colors.HexColor('#675c3b')
BORDER        = colors.HexColor('#cbc8be')
ACCENT        = colors.HexColor('#907422')
TEXT_PRIMARY  = colors.HexColor('#1a1917')
TEXT_MUTED    = colors.HexColor('#7b7971')

OUT = '/home/z/my-project/download/Kozy_Shoe_Club_Market_Research_Memo.pdf'
MARGIN = 0.9 * inch
AVAIL = A4[0] - 2 * MARGIN

h1 = ParagraphStyle('H1', fontName='FreeSerif', fontSize=16, leading=21,
                    textColor=HEADER_FILL, spaceBefore=6, spaceAfter=10)
h2 = ParagraphStyle('H2', fontName='FreeSerif', fontSize=12, leading=16,
                    textColor=TEXT_PRIMARY, spaceBefore=12, spaceAfter=6)
body = ParagraphStyle('Body', fontName='FreeSerif', fontSize=10.5, leading=16.5,
                      textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY)
bullet = ParagraphStyle('Bullet', parent=body, alignment=TA_LEFT, leftIndent=14,
                        bulletIndent=4, spaceAfter=5)
cell = ParagraphStyle('Cell', fontName='FreeSerif', fontSize=9, leading=12.5,
                      textColor=TEXT_PRIMARY, alignment=TA_LEFT)
cellc = ParagraphStyle('CellC', parent=cell, alignment=TA_CENTER)
th = ParagraphStyle('TH', fontName='FreeSerif', fontSize=9.5, leading=12,
                    textColor=colors.white, alignment=TA_CENTER)
cap = ParagraphStyle('Cap', fontName='FreeSerif-Italic', fontSize=8.5, leading=11,
                     textColor=TEXT_MUTED, alignment=TA_CENTER, spaceBefore=4)

story = []

def H1(t): story.append(Paragraph(f'<b>{t}</b>', h1))
def H2(t): story.append(Paragraph(f'<b>{t}</b>', h2))
def P(t):
    story.append(Paragraph(t, body)); story.append(Spacer(1, 7))
def B(t):
    story.append(Paragraph(f'•&nbsp;&nbsp;{t}', bullet))
def TBL(header, rows, ratios, caption=None):
    widths = [r * AVAIL for r in ratios]
    data = [[Paragraph(f'<b>{c}</b>', th) for c in header]]
    for r in rows:
        data.append([Paragraph(c, cell if i == 0 else cellc) for i, c in enumerate(r)])
    t = Table(data, colWidths=widths, hAlign='CENTER', repeatRows=1)
    style = [('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
             ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
             ('GRID', (0, 0), (-1, -1), 0.4, BORDER),
             ('LEFTPADDING', (0, 0), (-1, -1), 6), ('RIGHTPADDING', (0, 0), (-1, -1), 6),
             ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5)]
    for i in range(1, len(data)):
        style.append(('BACKGROUND', (0, i), (-1, i), colors.white if i % 2 == 1 else TABLE_STRIPE))
    t.setStyle(TableStyle(style))
    story.append(Spacer(1, 10)); story.append(t)
    if caption:
        story.append(Spacer(1, 4)); story.append(Paragraph(caption, cap))
    story.append(Spacer(1, 12))

# ==================== CONTENT ====================
H1('1. Executive Summary')
P('The owner asked for a shoes-only monthly subscription that competes with the dedicated '
  'sneaker laundries in Lagos, priced to undercut them, sold from the shoes section of the '
  'site rather than as a fourth laundry tier. This memo documents the market research behind '
  'that decision, the unit economics that make it safe, and the pricing ladder now live on '
  'kozycare.ng. The headline finding: the Lagos sneaker-care specialists charge between '
  '7,000 and 25,000 naira to clean a single pair, while Kozy\u2019s laundry-attached economics '
  'support a club price of 800 to 1,000 naira per pair with pickup and delivery included. '
  'The undercut is therefore not a promotion; it is a structural cost advantage, and the '
  'ladder of one, three and five pairs a month at 1,000, 2,500 and 4,000 naira monthly '
  'converts that advantage into a subscription product with healthy margin at every step.')
P('The over-promise question the owner explicitly raised — whether we are offering more '
  'than necessary or something that does not make sense — receives its own chapter. The '
  'short answer is that the design deliberately avoids the three classic failure modes of '
  'shoe subscriptions: unlimited plans that invite abuse, premium-material coverage that '
  'cannot be batch-processed, and allowances that roll over and accumulate into fulfilment '
  'debt. Each club pair is the standard sneaker and canvas clean, premium materials stay '
  'a-la-carte with a member discount, and unused pairs reset every month exactly like the '
  'laundry tiers reset their bag pickups.')

H1('2. The Lagos Market')
P('Research on 28 September 2026 identified three directly comparable operators plus a '
  'long tail of Instagram-led services. The clearest benchmark is Care by Sneaklin, which '
  'positions itself as Lagos\u2019s number one sneaker laundry: an on-demand app with pickup '
  'and delivery, a claimed 4.9 rating, a 72-hour turnaround, and a published per-pair price '
  'list. Their basic sneaker clean costs 8,000 naira a pair, leather care 7,000, suede '
  '12,000, and their premium refresh, restore and revive packages run 15,000 to 25,000 a '
  'pair. LBN Laundry, operating from Richmond Pearl Estate in Lekki Phase 1, advertises '
  'more than six hundred pairs cleaned or restored in a single week and quotes around '
  '10,000 naira per pair or pack for cleaning and restoration work. K-Kleen Sneakers and '
  'Shoe Services operates a walk-in location on TF Kuboye Street in Lekki with a published '
  'specialist price list above laundry norms. Around these named players sits a cluster of '
  'Instagram shops quoting similar per-pair figures.')
TBL(['Operator', 'Position', 'Per-pair pricing observed', 'Turnaround'],
    [['Care by Sneaklin', 'App-based premium sneaker laundry, Lekki focus',
      'Basic 8,000 · Leather 7,000 · Suede 12,000 · Premium packages 15,000-25,000', '72 hours'],
     ['LBN Laundry', 'Instagram-led cleaning and restoration, Lekki Phase 1',
      'About 10,000 per pair or pack; volume claim of 600+ pairs weekly', 'Not published'],
     ['K-Klein / K-Kleen', 'Walk-in specialist service, Lekki',
      'Specialist per-pair list above laundry norms', 'Not published'],
     ['Instagram long tail', 'DM-booked home services across the island',
      'Commonly 5,000-10,000 per pair depending on condition', 'Days, variable']],
    [0.18, 0.30, 0.38, 0.14],
    'Table 1. Lagos shoe-care operators researched 28 September 2026 (public listings and profiles).')
P('Two facts stand out from this table. First, the market has already validated willingness '
  'to pay: Lagos customers demonstrably pay eight to ten thousand naira to have one pair '
  'professionally cleaned, which means a club price below one thousand naira a pair is not '
  'competing on thin margins against a cheaper rival — it is offering an entirely different '
  'value curve to a mass audience the specialists never court. Second, none of the named '
  'operators sells a subscription; they sell one-off cleans and restoration projects. The '
  'subscription shelf in Lagos shoe care is effectively empty, which gives Kozy the same '
  'first-mover framing the laundry tiers already enjoy.')

H1('3. What Global Operators Teach')
P('The international reference class confirms the attach-to-laundry pattern rather than '
  'a standalone shoes-only norm. Washmen in Dubai runs shoe cleaning, repair and '
  'restoration explicitly as a ShoeCare division of a laundry app — the same shape Kozy '
  'now has, with the shoe-care section living inside the services page of a laundry '
  'business. Rinse and 2ULaundry in the United States, the two most-cited laundry '
  'subscription businesses, both regulate plans with countable units — a bag, a box, a '
  'per-garment cap — rather than unlimited service, and both price the convenience of '
  'recurring collection rather than the cleaning itself. Neither offers unlimited shoe '
  'care of any kind, and Rinse\u2019s own materials position shoe care as an add-on priced '
  'per piece.')
P('The lesson applied here is threefold. Volume must be regulated by a countable unit, '
  'which is why the club counts pairs rather than promising open-ended care. Convenience '
  'is the product being sold, which is why free pickup and delivery are in the club rather '
  'than a surcharge. And premium work must be quoted, which is why suede, leather and '
  'embellished pairs, along with every restoration, remain assessment-first services with '
  'the member discount applied on top.')

H1('4. Unit Economics')
P('The cost side rests on how a hub actually processes shoes. A standard sneaker clean is '
  'a wash-and-brush-and-deodorise workflow of roughly ten to fifteen minutes of labour, '
  'pennies of solution, and air-dry time that overlaps other work; the materials cost is '
  'negligible and the labour, at Lagos hub wages, lands in the low hundreds of naira per '
  'pair at batch scale. The dominant cost of a standalone shoe service is not the cleaning '
  'at all — it is the dedicated logistics of collecting and returning single pairs. Kozy '
  'does not pay that cost: club pairs ride existing rider routes and return with deliveries '
  'already scheduled, so the incremental logistics per pair is close to zero whenever the '
  'member already has any other interaction with the service, and small even when they do '
  'not.')
TBL(['Club tier', 'Monthly price', 'Pairs', 'Effective per pair', 'Blended a-la-carte equivalent', 'Discount vs own card'],
    [['Shoe Club · 1 pair', '1,000', '1', '1,000', '1,000-1,500', '0 to 33%'],
     ['Shoe Club · 3 pairs', '2,500', '3', '833', '3,000-4,500', '17 to 45%'],
     ['Shoe Club · 5 pairs', '4,000', '5', '800', '5,000-7,500', '20 to 47%']],
    [0.20, 0.14, 0.10, 0.18, 0.22, 0.16],
    'Table 2. The live club ladder against Kozy\u2019s own a-la-carte sneaker prices.')
P('At the five-pair tier the member pays 4,000 naira a month for work that would cost '
  '5,000 to 7,500 naira at Kozy\u2019s own card price and 35,000 to 50,000 naira at '
  'Sneaklin\u2019s list price. Even in the worst case — every pair being the coloured-sneaker '
  'clean at 1,000 naira — the hub retains comfortable margin on direct cost, and the '
  'member-discount hook (5, 10 and 15 percent across the tiers) nudges club members to '
  'bring their laundry into the ecosystem, which is where the real basket value sits.')

H1('5. The Shoe Club Design')
P('The product follows the owner\u2019s placement instruction exactly: it lives in the '
  'shoe-care section of the services page, under the sneaker restoration story, and never '
  'appears as a fourth card in the laundry tiers grid. A customer can hold one membership '
  'in each family, so a Household member can add a Shoe Club without disturbing their '
  'laundry plan, and a shoes-only customer sees their club card in the portal above a quiet '
  'invitation to explore laundry plans. Shoe pickups draw from the club first and fall back '
  'to the laundry tier\u2019s monthly shoe perk only when no club exists, so existing members '
  'keep exactly the behaviour they had before launch.')
B('Pricing is admin-editable at runtime from Memberships, in a dedicated Shoe Club editor '
  'separate from the tiers, with the per-pair arithmetic recalculated live on the card.')
B('Payment paths are identical to the tiers: Paystack recurring billing with automatic '
  'monthly charges, or bank transfer with receipt verification by the team.')
B('Usage resets with the monthly cycle exactly like bag pickups; there is no rollover, so '
  'fulfilment debt can never accumulate across months.')
B('One pair means the standard sneaker and canvas clean. Suede, leather and embellished '
  'pairs, and all restorations, are booked a-la-carte with the club discount — quoted '
  'after free assessment, never flat-rated.')

H1('6. The Over-Promise Check')
P('The owner asked directly whether this offer does too much or anything that does not '
  'make sense. Walked through honestly, the failure modes of shoe subscriptions elsewhere '
  'are: unlimited plans attracting the one customer with forty pairs; premium materials '
  'promised inside a flat allowance and then ruined by batch chemistry; allowances rolling '
  'over until a member banks a festival-season avalanche; and liability exposure when an '
  'expensive collector pair is lost. The shipped design pre-empts each. The ladder caps at '
  'five pairs, so the heaviest possible member costs the hub fifteen to seventy-five '
  'minutes of batchable labour a month. Premium materials are contractually outside the '
  'allowance, so nothing requiring specialist chemistry is ever flat-rated. Pairs reset '
  'monthly with no rollover, so there is no banked work. And loss liability follows the '
  'standard order manifest the laundry already operates, with the restoration-tier habit '
  'of photographing condition at pickup available for valuable pairs.')
P('What the club deliberately does not include is as important as what it does. There is '
  'no dedicated shoe courier, no 24-hour turnaround promise (the laundry pipeline\u2019s '
  '48-to-72-hour rhythm is the honest commitment), no free replacements of laces or insoles '
  'beyond what a-la-carte pricing already covers, and no discount stacking beyond the '
  'stated member percentage. The offer under-promises relative to the specialists on '
  'frills while over-delivering on price per pair, which is the correct posture for a '
  'laundry business entering an adjacent category.')

H1('7. Launch Playbook')
P('The club is live on production as of this memo, so the remaining work is demand. The '
  'rider fleet is the physical channel: every delivered bag is a doorstep moment, and a '
  'small card in the return leg — five pairs a month for the price of less than one '
  'specialist clean — reaches exactly the sneaker-owning demographic already paying for '
  'laundry. The digital channel is the newsletter engine, where a calendar-aware campaign '
  'can land the undercut story ahead of Detty December, the season when shoe cleaning '
  'demand peaks in Lagos. The services page itself now carries the anchor line comparing '
  'the seven-to-eight-thousand-naira market rate with the club\u2019s eight-hundred-naira '
  'effective price, which does the selling without naming any competitor.')
B('Week one: confirm Paystack recurring charges for one club tier with a real card, and '
  'process one transfer-based activation end to end so the verification queue sees the '
  'new plan codes.')
B('Weeks two to four: rider cards in every delivery, one newsletter feature, and a '
  'WhatsApp broadcast to the order history offering the first month at the entry tier.')
B('Ongoing: watch the Memberships subscribers list for club churn against the laundry '
  'tiers; the expectation is that club members churn less, because the price is trivial '
  'and the habit is monthly.')

H1('8. Decision Review')
P('The research supports the owner\u2019s instinct on every axis. A shoes-only subscription '
  'makes commercial sense in Lagos because the subscription shelf is empty while per-pair '
  'willingness to pay is proven at specialist prices. Undercutting is not merely possible '
  'but structural, since existing routes and hub batching remove the logistics cost that '
  'defines the specialists\u2019 pricing. The 1-3-5 pair ladder honours the owner\u2019s '
  'original specification while keeping every tier profitable, and the placement in the '
  'shoes section keeps the laundry tiers\u2019 story clean. The one caution this memo adds '
  'is sequencing: with zero subscribers across the whole membership engine today, the '
  'club\u2019s launch should ride a deliberate sales push rather than assuming the page '
  'alone will fill it. The follow-up audit delivered alongside this memo carries that '
  '30-60-90 plan.')

# ---- build (memo: no TOC → SimpleDocTemplate + build) ----
doc = SimpleDocTemplate(OUT, pagesize=A4,
                        leftMargin=MARGIN, rightMargin=MARGIN,
                        topMargin=0.8 * inch, bottomMargin=0.8 * inch,
                        title='The Kozy Shoe Club — Market Research & Pricing Memo',
                        author='Kozy Care')

def footer(canvas, doc_):
    canvas.saveState()
    canvas.setFont('FreeSerif', 8)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(MARGIN, 0.5 * inch, 'Kozy Care · Shoe Club Market Research & Pricing Memo · September 2026')
    canvas.drawRightString(A4[0] - MARGIN, 0.5 * inch, f'Page {doc_.page}')
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.4)
    canvas.line(MARGIN, 0.62 * inch, A4[0] - MARGIN, 0.62 * inch)
    canvas.restoreState()

doc.build(story, onFirstPage=footer, onLaterPages=footer)
print('BODY OK:', OUT)
