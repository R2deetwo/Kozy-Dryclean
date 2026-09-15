#!/usr/bin/env python3
"""build_bag_v91.py — Kozy Care nylon bag artwork, v9.1.

THE FIX (client): the social section on the nylon bag was scattered and
mis-aligned. Rebuilt as the NEAT SOCIAL BOX: QR + social handles + call row
in one tight bordered box, following the classic "QR left / info right"
rhythm the client liked before. Everything else on the bag follows the
established brand system:
  - website-exact lockup (Playfair 700 "Kozy Care" title case + gold caps
    subtitle), generous clear space, nothing crossing it
  - navy #0A192F field, gold accents, cream type
  - K-monogram QR (scan-verified recipe)
  - phone on a single line, never wrapped

Face size: 450 x 600 mm (3:4 garment-bag face).
Outputs (work/kozy-brand/marketing-v9/):
  bag-navy-gold.html          print master (5mm marks + 3mm bleed + crop marks)
  bag-navy-gold-digital.html  flat 450x600mm (PNG source)
  bag-mockup.html             garment-bag preview
"""
import sys
import math
from pathlib import Path

sys.path.insert(0, '/home/z/my-project/scripts/kozy-brand')
from kozy_kit_lib import crop_marks
import kozy_v91_lib as L

OUT = L.V9
OUT.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------- geometry
MM = L.PX_MM
TRIM_W, TRIM_H = 450.0, 600.0          # bag face, mm
BLEED = 3.0
MARGIN = 5.0
# integer page px (ceil) — a fractional height can round DOWN in
# scrollHeight and spill a sub-pixel sliver onto a second PDF page
PAGE_W = math.ceil((TRIM_W + 2 * (BLEED + MARGIN)) * MM)   # 1762 px
PAGE_H = math.ceil((TRIM_H + 2 * (BLEED + MARGIN)) * MM)   # 2329 px
DIG_W, DIG_H = 1701, 2268                           # flat digital face

TAGLINE = 'Uncompromising care. Exceptional convenience.'
SERVICES_L1 = 'SHIRTS &amp; TOPS · TROUSERS · SUITS &amp; JACKETS'
SERVICES_L2 = 'TRADITIONAL · HOUSEHOLD · SHOES &amp; CARE'
PRICE_LINE = 'WASH &amp; FOLD FROM ₦800/KG · FULL MENU AT KOZYCARE.NG'
BAND = 'FREE PICKUP &amp; DELIVERY · EXPRESS FROM 24 HOURS'
LEGAL = 'Kozy Care Drycleaning &amp; Laundry Services'


def corners_css() -> str:
    return '''
  .corner { position:absolute; width:132px; height:132px;
            border:6px solid #D4AF37; pointer-events:none; }
  .corner.tl { top:56px; left:56px; border-right:none; border-bottom:none;
               border-radius:18px 0 0 0; }
  .corner.tr { top:56px; right:56px; border-left:none; border-bottom:none;
               border-radius:0 18px 0 0; }
  .corner.bl { bottom:56px; left:56px; border-right:none; border-top:none;
               border-radius:0 0 0 18px; }
  .corner.br { bottom:56px; right:56px; border-left:none; border-top:none;
               border-radius:0 0 18px 0; }
'''


def content_html() -> str:
    return f'''
      <div class="ghost">{L.k_mark('#D4AF37', 940, 'opacity:.045')}</div>
      <div class="content">

        <div class="lock">{L.lockup_website(name_px=132)}</div>

        <div class="tagline">{TAGLINE}</div>

        <div class="svc">
          <div class="sl">{SERVICES_L1}</div>
          <div class="sl">{SERVICES_L2}</div>
          <div class="price">{PRICE_LINE}</div>
        </div>

        <div class="band">{BAND}</div>

        {L.social_box(s=1.0, qr_px=280)}

        <div class="legal">{LEGAL}</div>

      </div>'''


def content_css() -> str:
    return corners_css() + '''
  .ghost { position:absolute; right:-120px; bottom:130px; pointer-events:none; }
  .content { position:absolute; inset:0; padding:118px 120px;
             display:flex; flex-direction:column; align-items:center;
             font-family:'Outfit', Arial, sans-serif; color:#E7EDF5; }
  .lock { position:relative; z-index:2; }
  .tagline { font-family:'Playfair Display', Georgia, serif; font-style:italic;
             font-weight:500; font-size:66px; color:#F2F6FB; margin-top:96px;
             text-align:center; white-space:nowrap; }
  .svc { margin-top:92px; text-align:center; position:relative; z-index:2; }
  .svc .sl { font-size:44px; font-weight:500; letter-spacing:9px;
             color:#C9D5E6; line-height:1.55; white-space:nowrap; }
  .svc .price { font-size:30px; font-weight:600; letter-spacing:6px;
                color:#D4AF37; margin-top:26px; white-space:nowrap; }
  .band { margin-top:96px; background:#D4AF37; border-radius:14px;
          padding:44px 54px; font-weight:800; font-size:54px;
          letter-spacing:3px; color:#0A192F; white-space:nowrap;
          position:relative; z-index:2; }
  .socialbox { margin-top:104px; width:100%; position:relative; z-index:2; }
  .legal { margin-top:auto; font-size:30px; font-weight:300;
           letter-spacing:3px; color:rgba(201,213,230,.62);
           white-space:nowrap; position:relative; z-index:2; }
'''


def page_shell(inner: str, extra_css: str, body_bg: str,
               page_w: float, page_h: float, marks: str = '') -> str:
    return f'''<!DOCTYPE html>
<html><head><meta charset="utf-8">
{L.FONTS_HEAD}
<style>
{L.base_css()}
  .poster {{ width:{page_w:.2f}px; height:{page_h:.2f}px; position:relative;
             background:{body_bg}; }}
  .bleedbox {{ position:absolute; inset:18.9px; background:#0A192F;
               overflow:hidden; }}
  .trim {{ position:absolute; inset:11.34px; }}
  .marks {{ position:absolute; left:0; top:0; pointer-events:none; }}
{extra_css}
</style></head>
<body>
<div class="poster">
  <div class="bleedbox"><div class="trim">
    <div class="corner tl"></div><div class="corner tr"></div>
    <div class="corner bl"></div><div class="corner br"></div>
{inner}
  </div></div>
  {marks}
</div>
</body></html>'''


def main() -> None:
    # ---- 1. print master (marks + bleed) ----
    marks = crop_marks(PAGE_W, PAGE_H, TRIM_W, TRIM_H,
                       'KOZY CARE · NYLON BAG ARTWORK · 450 × 600 MM · V9.1')
    html = page_shell(content_html(), content_css(), '#FFFFFF',
                      PAGE_W, PAGE_H, marks)
    (OUT / 'bag-navy-gold.html').write_text(html, encoding='utf-8')
    print('  bag-navy-gold.html (print master)')

    # ---- 2. flat digital ----
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
    <div class="corner tl"></div><div class="corner tr"></div>
    <div class="corner bl"></div><div class="corner br"></div>
{content_html()}
  </div>
</div>
</body></html>'''
    (OUT / 'bag-navy-gold-digital.html').write_text(html, encoding='utf-8')
    print('  bag-navy-gold-digital.html (flat 450x600)')

    # ---- 3. mockup preview ----
    face = content_css()
    mock = f'''<!DOCTYPE html>
<html><head><meta charset="utf-8">
{L.FONTS_HEAD}
<style>
{L.base_css()}
  html, body {{ background:linear-gradient(160deg,#F5F1E8 0%,#EAE3D2 100%); }}
  .stage {{ width:1050px; height:1470px; position:relative; margin:0 auto; }}
  .bag {{ position:absolute; left:105px; top:112px; width:840px; height:1120px;
         background:#0A192F; border-radius:34px 34px 18px 18px;
         box-shadow:0 42px 90px rgba(10,25,47,.35), 0 8px 22px rgba(10,25,47,.18);
         overflow:hidden; }}
  .seal {{ position:absolute; top:0; left:0; right:0; height:54px;
          background:#081324; opacity:.9; }}
  .seal::after {{ content:''; position:absolute; left:0; right:0; bottom:0;
                 height:4px; background:rgba(212,175,55,.55); }}
  .cord {{ position:absolute; top:-16px; left:50%; transform:translateX(-50%);
          width:330px; }}
  .gussetL, .gussetR {{ position:absolute; top:0; bottom:0; width:56px; }}
  .gussetL {{ left:0; background:linear-gradient(90deg,rgba(0,0,0,.34),rgba(0,0,0,0)); }}
  .gussetR {{ right:0; background:linear-gradient(-90deg,rgba(0,0,0,.30),rgba(0,0,0,0)); }}
  .face {{ position:absolute; inset:0; transform:scale(.4941); transform-origin:top left;
          width:{DIG_W}px; height:{DIG_H}px; }}
  .trim {{ position:absolute; inset:0; overflow:hidden; }}
{face}
  .caption {{ position:absolute; bottom:28px; left:0; right:0; text-align:center;
             font-family:'Outfit', Arial, sans-serif; font-size:22px;
             letter-spacing:6px; color:rgba(10,25,47,.55); font-weight:600; }}
</style></head>
<body>
<div class="stage">
  <div class="bag">
    <div class="gussetL"></div><div class="gussetR"></div>
    <div class="seal"></div>
    <div class="face"><div class="trim">
      <div class="corner tl"></div><div class="corner tr"></div>
      <div class="corner bl"></div><div class="corner br"></div>
{content_html()}
    </div></div>
  </div>
  <svg class="cord" viewBox="0 0 330 46" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 40 C 60 6, 270 6, 320 40" fill="none" stroke="#F5F1E8"
          stroke-width="11" stroke-linecap="round"/>
  </svg>
  <div class="caption">KOZY CARE · NYLON BAG · ARTWORK PREVIEW (450 × 600 MM)</div>
</div>
</body></html>'''
    (OUT / 'bag-mockup.html').write_text(mock, encoding='utf-8')
    print('  bag-mockup.html (preview)')


if __name__ == '__main__':
    main()
