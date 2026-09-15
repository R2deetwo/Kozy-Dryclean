#!/usr/bin/env python3
"""kozy_v91_lib.py — shared library for Kozy Care v9.1 fixes.

Rebuilt after the v8/v9 session files were lost. Carries forward every
client-approved rule:

  * WORDMARK = the WEBSITE lockup, exactly (client: "The web site is key",
    "the brand is supposed to look exactly like how the brand is on every
    single poster"): K mark LEFT + "Kozy Care" in Playfair Display 700,
    TITLE CASE, tracking-tight (-0.025em), + "DRYCLEANING & LAUNDRY"
    subtitle in Outfit caps, 0.15em tracking, gold. Never restyled.
  * No decorative element ever crosses the wordmark.
  * QR = K-monogram recipe (6-module K-pad, 2-module baked quiet zone,
    ~528px frame, scan-verified) -> qr-k-navy.b64
  * Phone always on ONE line, never wrapped.
  * The NEAT SOCIAL BOX: QR + social handles + call row grouped in a single
    bordered box (client: "put the QR code and the social media things in a
    neat box ... at the moment it looks scattered").
"""
from pathlib import Path

WORK = Path('/home/z/my-project/work/kozy-brand')
V9 = WORK / 'marketing-v9'

# ---------------------------------------------------------------- brand tokens
NAVY = '#0A192F'
GOLD = '#D4AF37'
GOLD_DEEP = '#B8942C'
CREAM = '#F5F1E8'
WHITE = '#FFFFFF'
TINT_BODY = '#C9D5E6'
TINT_HI = '#E7EDF5'
TINT_HEAD = '#F2F6FB'
TINT_MUTE = '#9FB0C6'

PX_MM = 96 / 25.4

PHONE = '+234 803 175 5230'
PHONE_LAGOS = '0803 175 5230'
WEB = 'kozycare.ng'
EMAIL = 'kozygarmentcare@gmail.com'
ADDR1 = 'No 20, Westsyde Drive, Ogombo, Lagos'
ADDR2 = 'Paradise 3 Estate, Road 5/3, Chevron, Lagos'

# social handles (bag artwork; flag in README if client's handles differ)
HANDLES = {
    'instagram': '@kozycare.ng',
    'facebook': 'Kozy Care',
    'tiktok': '@kozycare.ng',
}

FONTS_HEAD = (
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
    '<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;0,800;1,500&family=Marcellus&family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">'
)

# ------------------------------------------------------------------ K mark SVG
K_MARK_PATHS = (
    'M689 708V689Q657 682 620.5 661.0Q584 640 544 593L356 369L414 452L652 81'
    'Q666 58 682.0 44.0Q698 30 724 20V0Q689 2 646.0 2.5Q603 3 568 3Q547 3 517.0 2.5'
    'Q487 2 441 0V20Q482 22 490.5 31.5Q499 41 483 65L338 300Q324 323 313.0 334.5'
    'Q302 346 291.0 350.5Q280 355 262 356V377Q306 378 340.5 401.0Q375 424 416 471'
    'L475 542Q513 587 519.5 619.5Q526 652 506.5 670.0Q487 688 447 689V708Q472 707 '
    '494.5 706.5Q517 706 541.5 705.5Q566 705 595 705Q624 705 647.5 706.0Q671 707 689 708Z'
    'M343 708V688Q311 687 294.5 680.5Q278 674 273.0 656.5Q268 639 268 602V106Q268 70 '
    '273.5 52.0Q279 34 295.0 28.0Q311 22 343 20V0Q316 2 275.0 2.5Q234 3 192 3Q144 3 '
    '101.5 2.5Q59 2 34 0V20Q66 22 82.0 28.0Q98 34 103.5 52.0Q109 70 109 106V602Q109 639 '
    '103.5 656.5Q98 674 81.5 680.5Q65 687 34 688V708Q59 707 101.5 706.0Q144 705 192 705'
    'Q234 705 275.0 706.0Q316 707 343 708Z'
)
K_WIRE_PATH = (
    'M 92.1 709.1 L 95.9 710.0 L 100.3 711.4 L 105.6 713.1 L 111.5 715.1 L 118.1 717.2 '
    'L 125.3 719.5 L 133.1 721.8 L 141.3 724.1 L 150.0 726.3 L 159.1 728.2 L 168.6 730.0 '
    'L 178.5 731.5 L 189.0 733.0 L 200.2 734.5 L 211.9 735.9 L 224.0 737.2 L 236.4 738.4 '
    'L 249.0 739.6 L 261.7 740.6 L 274.4 741.6 L 287.1 742.5 L 299.5 743.2 L 312.0 743.9 '
    'L 324.8 744.4 L 337.7 744.9 L 350.8 745.3 L 363.9 745.5 L 377.0 745.7 L 390.1 745.8 '
    'L 403.0 745.9 L 415.6 745.8 L 428.0 745.7 L 440.1 745.5 L 452.0 745.1 L 463.8 744.7 '
    'L 475.5 744.2 L 487.1 743.5 L 498.5 742.8 L 509.7 742.1 L 520.6 741.2 L 531.2 740.4 '
    'L 541.4 739.5 L 551.2 738.6 L 560.5 737.7 L 569.4 736.8 L 577.8 735.8 L 585.8 734.8 '
    'L 593.4 733.8 L 600.7 732.7 L 607.7 731.6 L 614.5 730.4 L 621.2 729.3 L 627.7 728.2 '
    'L 634.2 727.1 L 640.8 726.0 L 647.3 725.0 L 653.8 724.1 L 660.2 723.2 L 666.6 722.3 '
    'L 672.8 721.4 L 678.9 720.4 L 684.8 719.4 L 690.6 718.4 L 696.1 717.1 L 701.4 715.8 '
    'L 706.4 714.3 L 711.1 712.6 L 715.5 710.8 L 719.8 708.8 L 723.8 706.8 L 727.6 704.7 '
    'L 731.1 702.5 L 734.4 700.2 L 737.4 697.8 L 740.2 695.4 L 742.7 693.0 L 744.9 690.5 '
    'L 746.9 687.9 L 748.6 685.1 L 750.0 682.3 L 751.1 679.4 L 751.9 676.4 L 752.5 673.5 '
    'L 752.7 670.6 L 752.7 667.7 L 752.4 665.0 L 751.9 662.4 L 751.1 659.8 L 749.9 657.3 '
    'L 748.3 654.9 L 746.4 652.7 L 744.2 650.5 L 741.9 648.4 L 739.4 646.5 L 736.8 644.8 '
    'L 734.2 643.3 L 731.6 642.0 L 729.1 641.0 L 726.6 640.3 L 724.0 640.0 L 721.4 640.2 '
    'L 718.8 640.7 L 716.2 641.6 L 713.8 642.5 L 711.5 643.6 L 709.3 644.7 L 707.3 645.8 '
    'L 705.6 646.7 L 704.2 647.4 L 703.2 647.9 L 704.8 652.1 L 706.1 651.6 L 707.7 650.9 '
    'L 709.5 650.1 L 711.5 649.1 L 713.6 648.1 L 715.7 647.2 L 717.9 646.4 L 720.0 645.9 '
    'L 722.0 645.5 L 723.8 645.5 L 725.4 645.7 L 727.1 646.3 L 729.1 647.2 L 731.3 648.4 '
    'L 733.6 649.8 L 735.8 651.4 L 737.9 653.2 L 739.9 655.0 L 741.6 656.9 L 743.1 658.7 '
    'L 744.2 660.5 L 744.9 662.2 L 745.3 663.9 L 745.6 665.9 L 745.7 668.0 L 745.7 670.2 '
    'L 745.4 672.4 L 744.9 674.7 L 744.2 677.0 L 743.2 679.2 L 742.1 681.4 L 740.7 683.5 '
    'L 739.1 685.5 L 737.1 687.4 L 734.9 689.5 L 732.4 691.5 L 729.6 693.5 L 726.6 695.5 '
    'L 723.4 697.4 L 719.9 699.2 L 716.1 701.0 L 712.2 702.7 L 708.0 704.3 L 703.6 705.7 '
    'L 699.0 707.0 L 694.1 708.2 L 688.8 709.2 L 683.3 710.2 L 677.5 711.0 L 671.5 711.9 '
    'L 665.3 712.6 L 658.9 713.4 L 652.4 714.2 L 645.9 715.0 L 639.2 716.0 L 632.6 716.9 '
    'L 626.1 717.9 L 619.5 718.9 L 612.9 719.9 L 606.1 720.9 L 599.1 721.9 L 591.9 722.8 '
    'L 584.4 723.8 L 576.5 724.6 L 568.3 725.5 L 559.5 726.3 L 550.2 727.0 L 540.4 727.8 '
    'L 530.2 728.5 L 519.7 729.3 L 508.9 730.0 L 497.8 730.6 L 486.5 731.2 L 475.0 731.7 '
    'L 463.4 732.1 L 451.6 732.4 L 439.9 732.5 L 427.9 732.6 L 415.6 732.6 L 403.0 732.5 '
    'L 390.2 732.4 L 377.3 732.1 L 364.2 731.8 L 351.2 731.4 L 338.3 730.9 L 325.4 730.3 '
    'L 312.8 729.6 L 300.5 728.8 L 288.1 727.9 L 275.6 726.9 L 263.0 725.8 L 250.4 724.6 '
    'L 237.9 723.3 L 225.7 721.9 L 213.7 720.4 L 202.2 718.9 L 191.3 717.3 L 181.0 715.7 '
    'L 171.4 714.0 L 162.5 712.2 L 154.0 710.1 L 145.8 707.9 L 138.0 705.5 L 130.6 703.1 '
    'L 123.7 700.7 L 117.4 698.4 L 111.6 696.2 L 106.3 694.2 L 101.7 692.4 L 97.9 690.9 Z'
)
MARK_VIEWBOX = '-24 -838 861 896'


def k_mark(fill: str = GOLD, height_px: float = 52.0, style: str = '') -> str:
    """Inline K-mark SVG sized by height (the v4 monogram, verbatim)."""
    return (
        f'<svg viewBox="{MARK_VIEWBOX}" style="height:{height_px}px;width:{height_px * 0.9636:.2f}px;display:block;{style}" '
        f'xmlns="http://www.w3.org/2000/svg"><g transform="scale(1,-1)">'
        f'<path d="{K_MARK_PATHS}" fill="{fill}"/>'
        f'<path d="{K_WIRE_PATH}" fill="{fill}"/>'
        f'<circle cx="95" cy="700" r="10.0" fill="{fill}"/></g></svg>'
    )


# ------------------------------------------------------------- website lockup
LOCKUP_CSS = """
  /* WEBSITE-EXACT lockup (src/components/shell/logo.tsx):
     K mark left + "Kozy Care" Playfair Display 700, TITLE CASE,
     tracking-tight (-0.025em), line-height 1.15, with the uppercase
     "Drycleaning & Laundry" subtitle in Outfit, 0.15em tracking, gold.
     Proportions follow the site's md size (mark 40 / name 20 / sub 9). */
  .lockup { display:flex; align-items:center; }
  .lockup .lt { display:flex; flex-direction:column; justify-content:center;
                text-align:left; }
  .lockup .bn { font-family:'Playfair Display', Georgia, serif; font-weight:700;
                letter-spacing:-0.025em; line-height:1.15; white-space:nowrap; }
  .lockup .bd { font-family:'Outfit', Arial, sans-serif; font-weight:600;
                text-transform:uppercase; letter-spacing:0.15em;
                white-space:nowrap; }
"""


def lockup_website(name_px: float, mark_h: float = None, gap_px: float = None,
                   name_color: str = WHITE, sub_color: str = GOLD,
                   sub_text: str = 'Drycleaning &amp; Laundry') -> str:
    """The website wordmark lockup, scaled from the name font size.

    Site proportions: mark = 2x name, gap = 0.5x name, subtitle = 0.45x name
    with 0.2x name top margin.
    """
    mark_h = mark_h if mark_h is not None else name_px * 2.0
    gap_px = gap_px if gap_px is not None else name_px * 0.5
    sub_px = round(name_px * 0.45, 2)
    sub_mt = round(name_px * 0.2, 2)
    return (
        f'<div class="lockup" style="gap:{gap_px}px">'
        f'{k_mark(GOLD, mark_h)}'
        f'<div class="lt">'
        f'<div class="bn" style="font-size:{name_px}px;color:{name_color}">Kozy Care</div>'
        f'<div class="bd" style="font-size:{sub_px}px;color:{sub_color};margin-top:{sub_mt}px">{sub_text}</div>'
        f'</div></div>'
    )


# ------------------------------------------------------------------ social icons
# Filled brand glyphs (Font Awesome style, 24x24 viewBox, fill=currentColor)
ICON_IG = ('M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 '
           '1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 '
           '4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 '
           '0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 '
           '2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 '
           '2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 '
           '4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 '
           '0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 '
           '15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 '
           '0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 '
           '0 2.881 1.44 1.44 0 0 0 0-2.881z')
ICON_FB = ('M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 '
           '10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 '
           '4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 '
           '1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z')
ICON_TT = ('M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 '
           '1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 '
           '0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 '
           '4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z')
ICON_WA = ('M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 '
           '1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z')


def social_icon(path: str, size_px: float = 46, cls: str = '') -> str:
    return (f'<svg viewBox="0 0 24 24"{" class=" + cls if cls else ""} '
            f'style="width:{size_px}px;height:{size_px}px;fill:currentColor;display:block" '
            f'xmlns="http://www.w3.org/2000/svg"><path d="{path}"/></svg>')


# --------------------------------------------------------------- the SOCIAL BOX
SOCIAL_BOX_CSS = """
  /* THE NEAT SOCIAL BOX (client fix v9.1): QR + socials + call grouped in
     ONE bordered box — three tight columns sharing the full width, no
     dead gaps, nothing scattered. 's' scale factor multiplies sizes. */
  .socialbox { border:6px solid #D4AF37; border-radius:30px;
               background:rgba(212,175,55,.07);
               display:flex; align-items:center; }
  .sb-col { display:flex; flex-direction:column; justify-content:center;
            flex-shrink:0; }
  .sb-qr { display:block; border-radius:8px; }
  .sb-scan { font-weight:700; letter-spacing:.24em; color:#D4AF37;
             white-space:nowrap; text-align:center; }
  .sb-div { width:3px; align-self:stretch; background:rgba(212,175,55,.5);
            border-radius:2px; flex-shrink:0; }
  .sb-follow { font-weight:700; color:#D4AF37; letter-spacing:.34em; }
  .sb-row { display:flex; align-items:center; }
  .sb-ic { color:#D4AF37; display:flex; align-items:center; flex-shrink:0; }
  .sb-handle { color:#F2F6FB; font-weight:500; white-space:nowrap; }
  .sb-lbl { color:#D4AF37; font-weight:700; letter-spacing:.18em;
            white-space:nowrap; }
  .sb-tel { color:#F2F6FB; font-weight:600; white-space:nowrap;
            letter-spacing:.02em; }
  .sb-web { font-family:'Playfair Display', Georgia, serif; font-style:italic;
            color:rgba(212,175,55,.92); white-space:nowrap; }
"""


def social_box(s: float = 1.0, qr_px: float = 280) -> str:
    """The neat social box — three columns in one bordered box.

    [ QR + SCAN TO BOOK ] | [ FOLLOW US + icon rows ] | [ CALL/WHATSAPP + tel + web ]
    """
    pad_v = round(50 * s)
    pad_h = round(54 * s)
    gap = round(46 * s)
    qr = round(qr_px)
    scan_px = round(26 * s)
    scan_mt = round(24 * s)

    follow_px = round(30 * s)
    follow_mb = round(30 * s)
    row_mb = round(22 * s)
    ic = round(52 * s)
    ic_gap = round(26 * s)
    handle_px = round(42 * s)

    call_ic = round(58 * s)
    call_gap = round(28 * s)
    lbl_px = round(24 * s)
    lbl_mb = round(14 * s)
    tel_px = round(46 * s)
    web_px = round(28 * s)
    web_mt = round(12 * s)

    def row(icon, handle):
        return (f'<div class="sb-row" style="gap:{ic_gap}px;margin-bottom:{row_mb}px">'
                f'<span class="sb-ic">{social_icon(icon, ic)}</span>'
                f'<span class="sb-handle" style="font-size:{handle_px}px">{handle}</span></div>')

    qr_uri = qr_data_uri()
    return f'''
    <div class="socialbox" style="padding:{pad_v}px {pad_h}px;gap:{gap}px">
      <div class="sb-col" style="align-items:center">
        <img class="sb-qr" src="{qr_uri}" alt="QR — scan to book" style="width:{qr}px;height:{qr}px">
        <div class="sb-scan" style="font-size:{scan_px}px;margin-top:{scan_mt}px">SCAN TO BOOK</div>
      </div>
      <div class="sb-div"></div>
      <div class="sb-col">
        <div class="sb-follow" style="font-size:{follow_px}px;margin-bottom:{follow_mb}px">FOLLOW US</div>
        {row(ICON_IG, HANDLES['instagram'])}
        {row(ICON_FB, HANDLES['facebook'])}
        {row(ICON_TT, HANDLES['tiktok'])}
      </div>
      <div class="sb-div"></div>
      <div class="sb-col" style="flex:1">
        <div class="sb-row" style="gap:{call_gap}px">
          <span class="sb-ic">{social_icon(ICON_WA, call_ic)}</span>
          <span class="sb-lbl" style="font-size:{lbl_px}px">CALL / WHATSAPP</span>
        </div>
        <div class="sb-tel" style="font-size:{tel_px}px;margin-top:{lbl_mb}px">{PHONE}</div>
        <div class="sb-web" style="font-size:{web_px}px;margin-top:{web_mt}px">{WEB}</div>
      </div>
    </div>'''


# ------------------------------------------------------------------------ QR
def qr_data_uri() -> str:
    """The K-monogram QR (528px, baked quiet zone) as a data URI."""
    return (V9 / 'qr-k-navy.b64').read_text(encoding='utf-8').strip()


# ------------------------------------------------------------------ base css
def base_css(extra: str = '') -> str:
    return f'''
  html, body {{ margin:0; padding:0; background:#FFFFFF; }}
  * {{ box-sizing:border-box; }}
  {LOCKUP_CSS}
  {SOCIAL_BOX_CSS}
  {extra}
'''
