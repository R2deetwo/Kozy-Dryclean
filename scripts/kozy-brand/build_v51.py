#!/usr/bin/env python3
"""
build_v51.py — Marketing kit v5.1 (Phase 15)

WHAT CHANGED vs v5 (kept intact in download/kozy-brand/):
  * The HOTEL15 offer line now targets HOTELS & CORPORATE CLIENTS (businesses)
    instead of "HOTEL GUESTS" — matching the corrected reading of the client's
    instruction ("hotels already spend with the company") and the website
    wording ("Hotels & corporate clients").
  * ONLY 3 pieces change: Flyer A front (services), Flyer B (offer, model with
    KOZY garment bag), Poster A3. Flyer A back, business cards, brand sheet
    and logo are UNTOUCHED.

VERSIONING POLICY (owner request): updates are ADDITIVE — v5 files stay where
they are; v5.1 renders into download/kozy-brand/v5.1-hotel-corporate-update/.
"""

import os
import re
import sys

W = '/home/z/my-project/work/kozy-brand'

# source (v5) -> v5.1 copy
PIECES = [
    'flyer-a-front.html',
    'flyer-a-front-digital.html',
    'flyer-b.html',
    'flyer-b-digital.html',
    'poster-a3.html',
    'poster-a3-digital.html',
]

OLD_BAND = 'HOTEL GUESTS: 15% OFF + 5% WITH CODE HOTEL15'
NEW_BAND_FLYER = 'HOTELS &amp; CORPORATE: 15% OFF + 5% WITH CODE HOTEL15'
NEW_BAND_POSTER = 'HOTELS &amp; CORPORATE CLIENTS: 15% OFF + 5% WITH CODE HOTEL15'

OLD_STRIP_BIG = 'HOTEL GUESTS: 15% OFF'
NEW_STRIP_BIG = 'HOTELS &amp; CORPORATE CLIENTS: 15% OFF'

changed = {}
for src in PIECES:
    path = os.path.join(W, src)
    if not os.path.exists(path):
        sys.exit(f'ERROR: missing source {src}')

    html = open(path, encoding='utf-8').read()
    n = 0

    if src.startswith('flyer-a'):
        if OLD_BAND in html:
            html = html.replace(OLD_BAND, NEW_BAND_FLYER)
            n += 1
    elif src.startswith('poster'):
        if OLD_BAND in html:
            html = html.replace(OLD_BAND, NEW_BAND_POSTER)
            n += 1
    elif src.startswith('flyer-b'):
        if OLD_STRIP_BIG in html:
            html = html.replace(OLD_STRIP_BIG, NEW_STRIP_BIG)
            n += 1

    # Any straggler "hotel guest" wording (title/comments) — normalize too.
    html, stray = re.subn(r'HOTEL GUESTS', 'HOTELS &amp; CORPORATE', html)

    out = os.path.join(W, src.replace('.html', '-v51.html'))
    open(out, 'w', encoding='utf-8').write(html)
    changed[src] = (n + stray, out)
    print(f'✓ {out}  (line swaps: {n}, stray normalised: {stray})')

missing = [s for s, (n, _) in changed.items() if n == 0]
if missing:
    sys.exit(f'ERROR: no hotel line found in: {missing}')
print('v5.1 HTML sources ready')
