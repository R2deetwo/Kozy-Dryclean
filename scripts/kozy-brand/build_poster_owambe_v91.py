#!/usr/bin/env python3
"""build_poster_owambe_v91.py — Kozy Care A3 Owambe poster, v9.1.

THE FIX (client): the two women in the previous party image had defects —
the right-hand woman had black/disturbing eyes and the left-hand woman had
ill-formed fingers resting on the man's shoulder. The asset was regenerated
(z-ai, VLM-verified: natural eyes with white sclera, five well-formed
fingers, no hands on anyone's shoulder) and this poster rebuild uses it.

Brand rules carried forward:
  - website-exact lockup, generous clear space, NOTHING crosses the wordmark
  - humans in the poster (client: posters must not be big and bland)
  - gold-arch image window at the asset's EXACT 3:4 aspect (no crop)
  - festive gold confetti in the image flanks for visual activity — kept
    well away from the wordmark
  - consumer offer copy from the approved flyer-b (10% off first clean)
  - K-monogram QR + phone on one line in the footer

Outputs (work/kozy-brand/marketing-v9/):
  poster-owambe-a3.html          print master (A3 + 3mm bleed + crop marks)
  poster-owambe-a3-digital.html  flat A3 (PNG source)
"""
import base64
import math
import sys

sys.path.insert(0, '/home/z/my-project/scripts/kozy-brand')
from kozy_kit_lib import crop_marks
import kozy_v91_lib as L

OUT = L.V9
ASSET = OUT / 'images' / 'asset-owambe-party.png'

MM = L.PX_MM
TRIM_W, TRIM_H = 297.0, 420.0
BLEED = 3.0
MARGIN = 5.0
# integer page px (ceil) — avoids the sub-pixel second-page spill
PAGE_W = math.ceil((TRIM_W + 2 * (BLEED + MARGIN)) * MM)   # 1183 px
PAGE_H = math.ceil((TRIM_H + 2 * (BLEED + MARGIN)) * MM)   # 1648 px
DIG_W, DIG_H = 1123, 1588

IMG_URI = 'data:image/png;base64,' + base64.b64encode(ASSET.read_bytes()).decode()

# gold-arch image window at the asset's exact 3:4 aspect (no crop)
ARCH_W, ARCH_H = 480, 640
ARCH_R = (ARCH_W + 14) / 2   # border included -> perfect semicircle


def confetti() -> str:
    """Hand-placed gold confetti in the image flanks + arch shoulders.
    Coordinates are inside .content (994px wide); NOTHING comes within
    170px of the top (lockup zone)."""
    dots = [
        # (x, y, size, kind, opacity)
        (78, 470, 10, 'd', .9), (150, 560, 7, 'o', .75), (108, 660, 12, 'd', .95),
        (176, 760, 8, 'o', .7), (92, 870, 9, 's', .9), (156, 980, 13, 'd', .85),
        (110, 1090, 7, 'o', .75), (184, 1180, 10, 'd', .9), (128, 1290, 8, 's', .8),
        (914, 500, 9, 'o', .8), (846, 610, 12, 'd', .9), (906, 720, 7, 's', .85),
        (852, 840, 10, 'd', .9), (922, 950, 8, 'o', .7), (866, 1070, 11, 'd', .85),
        (908, 1190, 7, 's', .8), (844, 1300, 9, 'o', .75),
        # arch shoulders (beside the arch curve, still far below the lockup)
        (286, 448, 8, 's', .9), (706, 452, 8, 's', .9),
    ]
    out = []
    for x, y, s, kind, op in dots:
        if kind == 'o':
            out.append(f'<circle cx="{x}" cy="{y}" r="{s / 2}" fill="#D4AF37" opacity="{op}"/>')
        elif kind == 'd':
            out.append(f'<rect x="{x - s / 2}" y="{y - s / 2}" width="{s}" height="{s}" '
                       f'fill="#D4AF37" opacity="{op}" transform="rotate(45 {x} {y})"/>')
        else:  # sparkle: 4-point star
            r = s * 0.9
            out.append(f'<path d="M{x} {y - r} L{x + r * .22} {y - r * .22} '
                       f'L{x + r} {y} L{x + r * .22} {y + r * .22} L{x} {y + r} '
                       f'L{x - r * .22} {y + r * .22} L{x - r} {y} '
                       f'L{x - r * .22} {y - r * .22} Z" fill="#D4AF37" opacity="{op}"/>')
    return ('<svg class="confetti" width="994" height="900" viewBox="0 0 994 900" '
            'xmlns="http://www.w3.org/2000/svg">' + ''.join(out) + '</svg>')


def content_html() -> str:
    return f'''
      <div class="ghost">{L.k_mark('#D4AF37', 780, 'opacity:.05')}</div>
      <div class="content">

        <div class="lock">{L.lockup_website(name_px=44)}</div>

        <div class="kicker">PARTY-READY GARMENT CARE</div>
        <h1>Every Owambe,<br><em>Immaculate.</em></h1>
        <p class="sub">Premium drycleaning for agbada, aso-oke &amp; gele —
        collected at your door and returned flawless, right on time for the party.</p>

        <div class="archwrap">
          {confetti()}
          <div class="arch"><img src="{IMG_URI}" alt="Owambe party trio in agbada and gele"></div>
        </div>

        <div class="offer">
          <div class="big">10% OFF YOUR FIRST PREMIUM CLEAN</div>
          <div class="small">FREE PICKUP &amp; DELIVERY · EXPRESS FROM 24 HOURS</div>
        </div>

        <div class="foot">
          <img class="fqr" src="{L.qr_data_uri()}" alt="QR — scan to book">
          <div class="fscan">SCAN · BOOK · RELAX<span>kozycare.ng</span></div>
          <div class="fcontact">
            <div class="fc1"><b>CALL / WHATSAPP</b> {L.PHONE}</div>
            <div class="fc2">{L.ADDR1}</div>
            <div class="fc2">{L.ADDR2}</div>
            <div class="fc2">{L.EMAIL}</div>
          </div>
        </div>

      </div>'''


def content_css() -> str:
    return '''
  .ghost { position:absolute; right:-260px; top:420px; pointer-events:none; }
  .content { position:absolute; inset:0; padding:58px 64px 52px;
             display:flex; flex-direction:column; align-items:center;
             font-family:'Outfit', Arial, sans-serif; color:#E7EDF5; }
  .lock { position:relative; z-index:3; }
  .kicker { font-family:'Marcellus', 'Times New Roman', serif; color:#D4AF37;
            font-size:20px; letter-spacing:9px; margin-top:44px; }
  h1 { font-family:'Playfair Display', Georgia, serif; font-weight:700;
       font-size:68px; line-height:1.08; margin:18px 0 0; text-align:center;
       color:#F2F6FB; }
  h1 em { font-style:italic; font-weight:500; color:#D4AF37; }
  .sub { font-weight:300; font-size:21px; line-height:1.5; text-align:center;
         max-width:660px; color:#C9D5E6; margin:20px 0 0; }
  .archwrap { margin-top:38px; position:relative; z-index:2;
              width:994px; display:flex; justify-content:center; }
  .confetti { position:absolute; left:0; top:34px; pointer-events:none; }
  .arch { border:7px solid #D4AF37; border-radius:247px 247px 22px 22px;
          overflow:hidden; box-shadow:0 0 0 10px rgba(212,175,55,.14),
          0 26px 60px rgba(0,0,0,.38); }
  .arch img { display:block; width:480px; height:640px;
              object-fit:cover; }
  .offer { margin-top:44px; width:100%; background:#D4AF37; border-radius:10px;
           text-align:center; padding:26px 30px 24px; color:#0A192F;
           position:relative; z-index:2; }
  .offer .big { font-family:'Playfair Display', Georgia, serif; font-weight:800;
                font-size:38px; letter-spacing:.6px; }
  .offer .small { font-size:17px; font-weight:700; letter-spacing:4.2px;
                  margin-top:10px; }
  .foot { width:100%; margin-top:30px; border-top:1px solid rgba(212,175,55,.45);
          padding-top:26px; display:flex; align-items:center; gap:30px;
          position:relative; z-index:2; }
  .fqr { width:122px; height:122px; background:#FFFFFF; padding:5px;
         border-radius:6px; flex-shrink:0; }
  .fscan { font-family:'Marcellus', 'Times New Roman', serif; color:#D4AF37;
           font-size:22px; letter-spacing:4px; line-height:1.5; }
  .fscan span { display:block; font-family:'Playfair Display', Georgia, serif;
                font-style:italic; color:#F2F6FB; font-size:24px;
                letter-spacing:1px; margin-top:6px; }
  .fcontact { margin-left:auto; text-align:right; font-size:17px; line-height:1.7;
              color:#C9D5E6; letter-spacing:1.4px; }
  .fcontact b { color:#D4AF37; font-weight:600; letter-spacing:2.6px; }
  .fc1 { font-size:19px; white-space:nowrap; }
'''


def main() -> None:
    marks = crop_marks(PAGE_W, PAGE_H, TRIM_W, TRIM_H,
                       'KOZY CARE · A3 POSTER · OWAMBE · 297 × 420 MM · V9.1')
    html = f'''<!DOCTYPE html>
<html><head><meta charset="utf-8">
{L.FONTS_HEAD}
<style>
{L.base_css()}
  .poster {{ width:{PAGE_W:.2f}px; height:{PAGE_H:.2f}px; position:relative;
             background:#FFFFFF; }}
  .bleedbox {{ position:absolute; inset:18.9px; background:#0A192F;
               overflow:hidden; }}
  .trim {{ position:absolute; inset:11.34px; }}
  .marks {{ position:absolute; left:0; top:0; pointer-events:none; }}
{content_css()}
</style></head>
<body>
<div class="poster">
  <div class="bleedbox"><div class="trim">
{content_html()}
  </div></div>
  {marks}
</div>
</body></html>'''
    (OUT / 'poster-owambe-a3.html').write_text(html, encoding='utf-8')
    print('  poster-owambe-a3.html (print master)')

    html = f'''<!DOCTYPE html>
<html><head><meta charset="utf-8">
{L.FONTS_HEAD}
<style>
{L.base_css()}
  html, body {{ background:#0A192F; }}
  .poster {{ width:{DIG_W}px; height:{DIG_H}px; position:relative;
             background:#0A192F; }}
  .trim {{ position:absolute; inset:0; overflow:hidden; }}
{content_css()}
</style></head>
<body>
<div class="poster">
  <div class="trim">
{content_html()}
  </div>
</div>
</body></html>'''
    (OUT / 'poster-owambe-a3-digital.html').write_text(html, encoding='utf-8')
    print('  poster-owambe-a3-digital.html (flat A3)')


if __name__ == '__main__':
    main()
