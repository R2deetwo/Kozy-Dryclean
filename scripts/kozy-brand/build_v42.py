#!/usr/bin/env python3
"""Kozy brand kit v4.2 — apply Kozy Care v4 identity + owner-requested content fixes
to flyer A (front/back), flyer B and the A3 poster (print + digital HTML sources).

Fixes applied (owner directives, Aug 2026):
  1. v3 [K]OZY wordmark -> v4 lockup: gold K mark + KOZY CARE + single
     'PREMIUM DRYCLEANING & LAUNDRY' descriptor (site-matching style).
  2. Remove the duplicate top kicker 'PREMIUM DRY CLEANING & LAUNDRY' (the
     smaller of the two occurrences).
  3. '48 hour' turnaround claims corrected: express within 24 hours,
     regular service is 3-5 days (en-dash, never bold).
  4. Second address added everywhere (Paradise 3 Estate, Road 5/3, Chevron).
  5. Free pickup & delivery claims asterisked + fine print:
     '*Free pickup and delivery for first order only.'
  6. Flyer A back: sneaker prices synced to live catalog (White N1,500 /
     Coloured N1,000 - phase-13 swap) + sneaker restoration note.
"""
import re
import sys
from pathlib import Path

W = Path('/home/z/my-project/work/kozy-brand')
REPO_MARK = Path('/home/z/Kozy-Dryclean/public/brand/kozy-mark.svg')

# ---------------------------------------------------------------- v4 K mark
mark_svg = REPO_MARK.read_text()
v4_paths = re.findall(r'<path d="([^"]+)"', mark_svg)
assert len(v4_paths) == 2, 'expected K glyph + hanger wire paths'
V4_K, V4_WIRE = v4_paths
V4_INNER = (f'<path d="{V4_K}" fill="#D4AF37"/>'
            f'<path d="{V4_WIRE}" fill="#D4AF37"/>'
            f'<circle cx="95" cy="700" r="10.0" fill="#D4AF37"/>')
V4_VIEWBOX = '-24 -838 861 896'

def lockup(mark, name, ls, desc, dls, gap):
    """v4 brand lockup: K mark + KOZY CARE + single Premium descriptor."""
    html = (f'<div class="logo-row"><div class="brandlock">'
            f'<svg viewBox="{V4_VIEWBOX}" style="height:{mark}px;display:block" '
            f'xmlns="http://www.w3.org/2000/svg"><g transform="scale(1,-1)">{V4_INNER}</g></svg>'
            f'<div class="bt"><div class="bn">KOZY CARE</div>'
            f'<div class="bd">PREMIUM DRYCLEANING &amp; LAUNDRY</div></div></div></div>')
    css = (f'\n  .brandlock {{ display:flex; align-items:center; gap:{gap}px; }}\n'
           f'  .brandlock .bt {{ display:flex; flex-direction:column; align-items:flex-start; }}\n'
           f'  .brandlock .bn {{ font-family:\'Playfair Display\', Georgia, serif; font-weight:700; '
           f'font-size:{name}px; letter-spacing:{ls}px; color:#FFFFFF; line-height:1; }}\n'
           f'  .brandlock .bd {{ font-family:\'Marcellus\', \'Times New Roman\', serif; '
           f'font-size:{desc}px; letter-spacing:{dls}px; color:#D4AF37; margin-top:6px; white-space:nowrap; }}\n')
    return html, css

FINE_CSS = ('\n  .fineprint {{ font-size:{fs}px; color:{col}; letter-spacing:.4px; '
            'margin-top:{mt}px; text-align:center; }}\n')

def load(p):  return (W / p).read_text()
def save(p, s):  (W / p).write_text(s)

def swap_logo(html, css_extra, mark, name, ls, desc, dls, gap):
    """Replace the v3 wordmark logo-row with the v4 lockup; inject CSS."""
    pat = re.compile(
        r'<div class="logo-row"><svg style="width:\d+px;display:block"[^>]*>.*?</svg></div>',
        re.DOTALL)
    new_html, css = lockup(mark, name, ls, desc, dls, gap)
    html, n = pat.subn(new_html, html)
    assert n == 1, f'logo-row not replaced (n={n})'
    html = html.replace('</style>', css + '</style>')
    assert css in html, 'lockup CSS not injected'
    return html

def swap_standalone_mark(html):
    """v3 K mark (842 viewBox, 2 circles) -> v4 K mark (861 viewBox, tapered wire)."""
    pat = re.compile(
        r'(<svg style="height:\d+px;display:block"[^>]*viewBox=")-24 -838 842 896('
        r'[^>]*><g transform="scale\(1,-1\)">).*?(</g></svg>)', re.DOTALL)
    html, n = pat.subn(r'\g<1>' + V4_VIEWBOX + r'\g<2>' + V4_INNER.replace('\\', '\\\\') + r'\g<3>', html)
    return html, n

def drop_kicker(html, text):
    line = f'      <div class="kicker">{text}</div>\n'
    assert line in html, f'kicker not found: {text}'
    return html.replace(line, '')

def edits(html, pairs):
    for old, new in pairs:
        assert old in html, f'NOT FOUND: {old[:70]!r}'
        html = html.replace(old, new)
    return html

# ================================================================ FLYER A FRONT
for f in ['flyer-a-front.html', 'flyer-a-front-digital.html']:
    h = load(f)
    if 'brandlock' in h:
        print(f'↷ {f} (already v4.2)'); continue
    h = swap_logo(h, None, mark=62, name=28, ls=2.4, desc=8.5, dls=2.6, gap=13)
    h = drop_kicker(h, 'LAGOS · PREMIUM DRY CLEANING &amp; LAUNDRY')
    h = edits(h, [
        # free pickup asterisk + 48-hour fix (en-dash, no bold)
        ('<p class="sub">Free pickup and delivery across Lagos. Expert dry cleaning,\n'
         '        wash &amp; fold, and shoe care — back at your door in 48 hours.</p>',
         '<p class="sub">Free pickup and delivery* across Lagos. Expert dry cleaning,\n'
         '        wash &amp; fold, and shoe care. Within 24 hours service '
         '(regular service is 3–5 days).</p>'),
        # fine print under the footer row
        ('        <span><b>KOZYCARE.NG</b></span>\n      </div>',
         '        <span><b>KOZYCARE.NG</b></span>\n      </div>\n'
         '      <div class="fineprint">*Free pickup and delivery for first order only.</div>'),
    ])
    h = h.replace('  .footer b {', FINE_CSS.format(fs=8, col='rgba(201,213,230,.6)', mt=9) + '  .footer b {')
    save(f, h)
    print(f'✓ {f}')

# ================================================================ FLYER A BACK
for f in ['flyer-a-back.html', 'flyer-a-back-digital.html']:
    h = load(f)
    if 'Paradise 3 Estate' in h:
        print(f'↷ {f} (already v4.2)'); continue
    h, n = swap_standalone_mark(h)
    assert n == 1, f'standalone mark not swapped in {f} (n={n})'
    h = edits(h, [
        # phase-13 sneaker price swap (White 1500 / Coloured 1000)
        ('<li><span class="nm">Sneakers (White)</span><span class="dots"></span><span class="pr">₦1,000</span></li>',
         '<li><span class="nm">Sneakers (White)</span><span class="dots"></span><span class="pr">₦1,500</span></li>'),
        ('<li><span class="nm">Sneakers (Coloured)</span><span class="dots"></span><span class="pr">₦1,200</span></li>',
         '<li><span class="nm">Sneakers (Coloured)</span><span class="dots"></span><span class="pr">₦1,000</span></li>'),
        # note line: same character count as the removed bulk-plans text
        ('WASH &amp; FOLD FROM ₦800/KG · BULK &amp; BUSINESS PLANS AVAILABLE · FULL MENU AT KOZYCARE.NG',
         'WASH &amp; FOLD FROM ₦800/KG · SNEAKER RESTORATION FROM ₦5,000 · FULL MENU AT KOZYCARE.NG'),
        # step 03: the 48H claim goes away
        ('<div class="lb">DELIVERED IN 48H</div>', '<div class="lb">WE DELIVER</div>'),
        # second address
        ('No 20, Westsyde Drive, Ogombo, Lagos<br>\n          kozygarmentcare@gmail.com',
         'No 20, Westsyde Drive, Ogombo, Lagos<br>\n          Paradise 3 Estate, Road 5/3, Chevron, Lagos<br>\n'
         '          kozygarmentcare@gmail.com'),
    ])
    save(f, h)
    print(f'✓ {f}')

# ================================================================ FLYER B
for f in ['flyer-b.html', 'flyer-b-digital.html']:
    h = load(f)
    if 'brandlock' in h:
        print(f'↷ {f} (already v4.2)'); continue
    h = swap_logo(h, None, mark=56, name=25, ls=2.2, desc=8, dls=2.4, gap=12)
    h = drop_kicker(h, 'LAGOS · PREMIUM DRY CLEANING')
    h, n = swap_standalone_mark(h)   # ghost K
    assert n == 1, f'ghost mark not swapped in {f} (n={n})'
    h = edits(h, [
        # asterisk on the free pickup chip
        ('<span class="prop">FREE PICKUP &amp; DELIVERY<span class="dot"></span></span>',
         '<span class="prop">FREE PICKUP &amp; DELIVERY*<span class="dot"></span></span>'),
        # 48-hour turnaround fix
        ('<span class="prop">48-HOUR TURNAROUND<span class="dot"></span></span>',
         '<span class="prop">EXPRESS FROM 24 HOURS<span class="dot"></span></span>'),
        # second address
        ('No 20, Westsyde Drive, Ogombo, Lagos<br>\n          kozygarmentcare@gmail.com',
         'No 20, Westsyde Drive, Ogombo, Lagos<br>\n          Paradise 3 Estate, Road 5/3, Chevron, Lagos<br>\n'
         '          kozygarmentcare@gmail.com'),
        # fine print under the foot row
        ('kozygarmentcare@gmail.com</div>\n      </div>',
         'kozygarmentcare@gmail.com</div>\n      </div>\n'
         '      <div class="fineprint">*Free pickup and delivery for first order only. '
         'Express service from 24 hours — regular service is 3–5 days.</div>'),
    ])
    h = h.replace('</style>', FINE_CSS.format(fs=8, col='rgba(201,213,230,.6)', mt=10) + '</style>')
    save(f, h)
    print(f'✓ {f}')

# ================================================================ POSTER A3
for f in ['poster-a3.html', 'poster-a3-digital.html']:
    h = load(f)
    if 'brandlock' in h:
        print(f'↷ {f} (already v4.2)'); continue
    h = swap_logo(h, None, mark=104, name=48, ls=4.2, desc=15, dls=4.6, gap=24)
    h = drop_kicker(h, 'PREMIUM DRY CLEANING &amp; LAUNDRY · LAGOS')
    h = edits(h, [
        ('<div class="lb">DELIVERED IN 48H</div>', '<div class="lb">WE DELIVER</div>'),
        ('No 20, Westsyde Drive, Ogombo, Lagos</div>',
         'No 20, Westsyde Drive, Ogombo, Lagos · Paradise 3 Estate, Road 5/3, Chevron, Lagos</div>'),
    ])
    save(f, h)
    print(f'✓ {f}')

print('\nAll v4.2 content edits applied.')
