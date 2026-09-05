#!/usr/bin/env python3
"""package_v6_zip.py — build download/kozy-brand-kit-v6-complete.zip:
   01-current-kit-v5.1/ (old material, untouched) + 02-new-v6/ + README-FIRST.txt
Also updates download/kozy-brand/VERSIONS.txt with the v6 / v6.1 entries
BEFORE staging, so the zip always carries the fresh version history."""
import shutil
import zipfile
from pathlib import Path

BASE = Path('/home/z/my-project/download/kozy-brand')
V6 = BASE / 'v6-name-and-series-update'
STAGE = Path('/tmp/kozy-kit-v6-stage')
ZIP = Path('/home/z/my-project/download/kozy-brand-kit-v6-complete.zip')

# ---- 0. update VERSIONS.txt FIRST so the zip carries it -------------------
vt = BASE / 'VERSIONS.txt'
txt = vt.read_text(encoding='utf-8')
marker = '------------------------------------------------------------------\nVERSION HISTORY'
v6_entry = """------------------------------------------------------------------
CURRENT VERSION: v6  (5 September 2026) — NAME ENFORCEMENT + LIGHT
                                + GOLD CORPORATE SERIES
------------------------------------------------------------------
WHAT CHANGED IN v6 (three things):

  1. THE NAME IS FIXED. The old logo pack spelled the wordmark "KOZY"
     while the website and collateral say "Kozy Care". All lockups are
     rebuilt as "Kozy Care" (title case, matches the landing page) and
     "KOZY CARE" (tracked caps, print). The K monogram is unchanged —
     it is an icon, not the name. Brand Sheet V2 opens with THE NAME
     rules. Nothing else about the approved navy design changed.

  2. NEW: LIGHT SERIES — the approved services flyer (A5, both sides)
     and A3 poster re-set on Kozy Cream #F5F1E8, gold text deepened to
     #B8942C for readability. Same layout, same typography.

  3. NEW: GOLD CORPORATE SERIES — material for institutions and
     corporate buyers: A4 institutional services sheet (partnership
     terms, scheduled collection, per-kg pricing, documentation,
     consolidated invoicing) + A5 institutional flyer + gold business
     cards. Per the client's direction these pieces do NOT list
     institution types — they speak the buyers' language instead.

  4. NEW: PERSONAL BUSINESS CARDS for Mr. Orion Akenuwa (CEO) and
     Ms. Khare Akenuwa in navy / white / gold (see v6.1 below for the
     redesigned layout and contacts).

"""
v61_entry = """------------------------------------------------------------------
CURRENT VERSION: v6.1  (5 September 2026) — PRINT-FIT FIX + CARD
                                REDESIGN
------------------------------------------------------------------
WHAT CHANGED IN v6.1 (client print review):

  1. EVERYTHING NOW FITS THE PAGE. The first v6 printouts let bottom
     sections drift past the trim line — on the institutional A5 flyer
     the QR code and the PREFERRED PARTNER RATES band were being sliced
     by the cutter, and on the corporate A4 sheet the COMMERCIAL TERMS
     box, the contact band and the legal foot ran off the page. Every
     v6 piece was re-measured against its trim box and re-set so all
     content sits safely inside the cut lines. The gold edge bands now
     bleed properly (they run past the trim into the bleed area, so no
     cream sliver can appear at the cut edge).

  2. BUSINESS CARDS REDESIGNED (client direction):
     FRONT — the person, centered and classier: Kozy Care lockup small
     at the top right; "Mr./Ms. + Name" centered (smaller, refined) with
     the title and the gold rule beneath; contacts at the bottom:
     kozygarmentcare@gmail.com + the direct line +234 808 888 8846.
     No web address on the front.
     BACK — turn-over information only (no repeated logo/name block):
     the scan-to-book QR, kozycare.ng, CUSTOMER CARE +234 803 175 5230,
     and both addresses.
     The personal orion@/khare@kozycare.ng addresses are retired from
     print — kozygarmentcare@gmail.com (the address on the flyer) is
     now the standard on both cards.

  3. Full set regenerated: print PDFs (CMYK + RGB), digital PDFs, PNG
     previews and the card versions overview sheet.

"""
if 'CURRENT VERSION: v6.1' not in txt:
    txt = txt.replace('CURRENT VERSION: v6  (5 September 2026) — see VERSION HISTORY below',
                      'CURRENT VERSION: v6.1  (5 September 2026) — see VERSION HISTORY below')
    if 'CURRENT VERSION: v6  (5 September 2026) — NAME ENFORCEMENT' not in txt:
        txt = txt.replace(marker, v6_entry + marker)
    txt = txt.replace(marker, v61_entry + marker)
    vt.write_text(txt, encoding='utf-8')
    print('VERSIONS.txt updated with v6.1 entry')
else:
    print('VERSIONS.txt already has v6.1 entry')

# ---- 1. stage old kit (v5 + v5.1, as-is) --------------------------------
if STAGE.exists():
    shutil.rmtree(STAGE)
old = STAGE / '01-current-kit-v5.1'
old.mkdir(parents=True)
for item in BASE.iterdir():
    if item.name in ('v6-name-and-series-update', 'VERSIONS.txt'):
        continue
    shutil.copy2(item, old / item.name) if item.is_file() \
        else shutil.copytree(item, old / item.name)

# ---- 2. stage new kit ----------------------------------------------------
new = STAGE / '02-new-v6'
shutil.copytree(V6, new)
shutil.copy2(BASE / 'VERSIONS.txt', new / 'VERSIONS.txt')

# ---- 3. top-level readme -------------------------------------------------
shutil.copy2(V6 / 'README-FIRST.txt', STAGE / 'README-FIRST.txt')

# ---- 4. zip --------------------------------------------------------------
if ZIP.exists():
    ZIP.unlink()
with zipfile.ZipFile(ZIP, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for f in sorted(STAGE.rglob('*')):
        if f.is_file():
            z.write(f, f.relative_to(STAGE))

count = sum(1 for f in STAGE.rglob('*') if f.is_file())
size_mb = ZIP.stat().st_size / 1024 / 1024
print(f'ZIP built: {ZIP} — {count} files, {size_mb:.1f} MB')
