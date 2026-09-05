#!/usr/bin/env python3
"""package_v6_zip.py — build download/kozy-brand-kit-v6-complete.zip:
   01-current-kit-v5.1/ (old material, untouched) + 02-new-v6/ + README-FIRST.txt
Also updates download/kozy-brand/VERSIONS.txt with the v6 entry."""
import shutil
import zipfile
from pathlib import Path

BASE = Path('/home/z/my-project/download/kozy-brand')
V6 = BASE / 'v6-name-and-series-update'
STAGE = Path('/tmp/kozy-kit-v6-stage')
ZIP = Path('/home/z/my-project/download/kozy-brand-kit-v6-complete.zip')

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

# ---- 5. update VERSIONS.txt ---------------------------------------------
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

  4. NEW: PERSONAL BUSINESS CARDS for Mr. Orion Akenuwa (CEO,
     orion@kozycare.ng, +234 808 888 8846) and Ms. Khare Akenuwa
     (khare@kozycare.ng, same line) in navy / white / gold. Front = the
     person; back = the company (QR, contacts, addresses). See
     business-cards/kozy-card-VERSIONS-overview.png.

WHERE THE FILES LIVE:
  v6 (current) ...... download/kozy-brand/v6-name-and-series-update/
  client zip ........ download/kozy-brand-kit-v6-complete.zip
                      (old kit + new kit in one file to send to the
                      client: 01-current-kit-v5.1/ + 02-new-v6/)
  v5.1 (previous) ... download/kozy-brand/v5.1-hotel-corporate-update/
  v5 ................ download/kozy-brand/ (flyer-services-a5/,
                      flyer-offer-a5/, poster-a3/, business-cards/,
                      brand-sheet/, logo/)

REPRINT GUIDANCE: the navy v5/v5.1 material is still valid — no forced
reprint. Reprint whenever natural. New print work: use the corrected
"Kozy Care" logo files from the v6 logo pack going forward.

"""
if 'CURRENT VERSION: v6' not in txt:
    txt = txt.replace('CURRENT VERSION: v5.1  (29 August 2026)',
                      'CURRENT VERSION: v6  (5 September 2026) — see VERSION HISTORY below')
    txt = txt.replace(marker, v6_entry + marker)
    # old "CURRENT VERSION: v5.1" header lines remain as history context
    vt.write_text(txt, encoding='utf-8')
    print('VERSIONS.txt updated with v6 entry')
else:
    print('VERSIONS.txt already has v6 entry')
