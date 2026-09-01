#!/usr/bin/env python3
"""Kozy Care business cards — navy + white colorways, 85x55mm (3mm bleed),
front (brand) + back (contact) per colorway. Print frames match the flyer kit
conventions: 3mm bleed, 5mm slug, 8 crop marks, slug caption; digital variants
are trim-size with no marks.

Brand: v4 K mark (gold) + KOZY CARE (Playfair) + single 'PREMIUM DRYCLEANING
& LAUNDRY' descriptor (Marcellus). QR -> https://kozycare.ng (reused from kit).
"""
import base64
import re
from pathlib import Path

W = Path('/home/z/my-project/work/kozy-brand')
QR_B64 = base64.b64encode((W / 'qr-navy.png').read_bytes()).decode()

mark_svg = Path('/home/z/Kozy-Dryclean/public/brand/kozy-mark.svg').read_text()
V4_K, V4_WIRE = re.findall(r'<path d="([^"]+)"', mark_svg)
V4_INNER = (f'<path d="{V4_K}" fill="{{FILL}}"/>'
            f'<path d="{V4_WIRE}" fill="{{FILL}}"/>'
            f'<circle cx="95" cy="700" r="10.0" fill="{{FILL}}"/>')

def kmark(height, fill='#D4AF37'):
    return (f'<svg viewBox="-24 -838 861 896" style="height:{height}px;display:block" '
            f'xmlns="http://www.w3.org/2000/svg"><g transform="scale(1,-1)">'
            f'{V4_INNER.replace("{FILL}", fill)}</g></svg>')

# 85x55mm at 96dpi
TRIM_W, TRIM_H = 321.26, 207.87
OFF = 30.24                     # bleed(11.34) + slug(18.9)
# ceil: Chromium reports scrollHeight as an int, so a fractional frame height
# (268.35px) overflows the generated page by <1px and spawns a blank 2nd page.
import math
POST_W, POST_H = math.ceil(TRIM_W + 2 * OFF), math.ceil(TRIM_H + 2 * OFF)

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:'
         'ital,wght@0,600;0,700;1,500&family=Marcellus&family=Outfit:wght@300;400;500;600'
         '&display=swap" rel="stylesheet">')

# ------------------------------------------------------------------ C S S
CSS_COMMON = '''
  * {{ box-sizing:border-box; }}
  html, body {{ margin:0; padding:0; background:{PAGBG}; }}
  .poster {{ width:{PW}px; height:{PH}px; position:relative; background:{PAGBG}; }}
  .bleedbox {{ position:absolute; inset:{INSET}px; background:{BG}; overflow:hidden; }}
  .trim {{ position:absolute; inset:{TRIMIN}px; }}
  .marks {{ position:absolute; left:0; top:0; pointer-events:none; }}
  .content {{ position:absolute; inset:0; padding:{PADX}px {PADX}px {PADY}px;
             display:flex; flex-direction:column; font-family:'Outfit', Arial, sans-serif;
             color:{BODY}; }}
  .frame {{ position:absolute; inset:16px; border:1px solid {FRAME}; border-radius:2px;
            pointer-events:none; }}
  .deco {{ position:absolute; top:-70px; right:-70px; opacity:.5; }}
  .center {{ flex:1; display:flex; flex-direction:column; align-items:center;
             justify-content:center; }}
  .name {{ font-family:'Playfair Display', Georgia, serif; font-weight:700;
           font-size:23px; letter-spacing:2.2px; color:{NAME}; line-height:1; }}
  .desc {{ font-family:'Marcellus', 'Times New Roman', serif; font-size:6.8px;
           letter-spacing:2.3px; color:{DESC}; margin-top:7px; white-space:nowrap; }}
  .rule {{ width:46px; height:1px; background:{RULE}; margin-top:11px; }}
  .tagline {{ font-family:'Playfair Display', Georgia, serif; font-style:italic;
              font-weight:500; font-size:9.5px; color:{TAG}; margin-top:10px;
              letter-spacing:.3px; }}
  .headrow {{ display:flex; align-items:center; gap:9px; }}
  .headrow .hn {{ font-family:'Playfair Display', Georgia, serif; font-weight:700;
                  font-size:14.5px; letter-spacing:1.6px; color:{NAME}; line-height:1; }}
  .rows {{ display:flex; flex-direction:column; gap:11px; margin-top:2px; }}
  .lbl {{ font-family:'Marcellus', 'Times New Roman', serif; font-size:6.4px;
          letter-spacing:1.7px; color:{LBL}; }}
  .val {{ font-size:10.5px; font-weight:500; color:{VAL}; letter-spacing:.4px;
          margin-top:2.5px; }}
  .qrbox {{ width:78px; padding:3px; background:#FFFFFF; border-radius:5px;
            border:1px solid {QRB}; }}
  .qrbox img {{ width:100%; display:block; }}
  .scan {{ font-family:'Marcellus', 'Times New Roman', serif; font-size:6.4px;
           letter-spacing:1.7px; color:{LBL}; text-align:center; margin-top:5px; }}
  .mid {{ display:flex; justify-content:space-between; align-items:center;
          flex:1; padding-right:6px; }}
  .addrrule {{ height:1px; background:{ADDRULE}; margin:0 2px; }}
  .addr {{ font-size:6.6px; color:{ADDR}; letter-spacing:.5px; text-align:center;
           margin-top:6.5px; white-space:nowrap; }}
'''

NAVY = dict(PAGBG='#FFFFFF', BG='#0A192F', BODY='#E7EDF5', NAME='#FFFFFF',
            DESC='#D4AF37', RULE='#D4AF37', TAG='#C9D5E6', LBL='#D4AF37',
            VAL='#FFFFFF', QRB='rgba(212,175,55,.35)', FRAME='rgba(212,175,55,.42)',
            ADDRULE='rgba(212,175,55,.38)', ADDR='#9FB0C6')
WHITE = dict(PAGBG='#FFFFFF', BG='#FFFFFF', BODY='#0A192F', NAME='#0A192F',
             DESC='#8A6D1E', RULE='#D4AF37', TAG='#46618A', LBL='#8A6D1E',
             VAL='#0A192F', QRB='#D4AF37', FRAME='rgba(212,175,55,.65)',
             ADDRULE='rgba(212,175,55,.55)', ADDR='#6F88A8')

# ------------------------------------------------------------------ B O D I E S
def front_body():
    return f'''
    <div class="content">
      <div class="frame"></div>
      <div class="center">
        {kmark(52)}
        <div class="name" style="margin-top:13px">KOZY CARE</div>
        <div class="desc">PREMIUM DRYCLEANING &amp; LAUNDRY</div>
        <div class="rule"></div>
        <div class="tagline">Uncompromising care. Exceptional convenience.</div>
      </div>
    </div>'''

def back_body():
    return f'''
    <div class="content" style="padding:21px 24px 16px;">
      <div class="headrow">{kmark(21)}<div class="hn">KOZY CARE</div></div>
      <div class="mid">
        <div class="rows">
          <div><div class="lbl">CALL / WHATSAPP</div><div class="val">+234 803 175 5230</div></div>
          <div><div class="lbl">EMAIL</div><div class="val">kozygarmentcare@gmail.com</div></div>
          <div><div class="lbl">WEB</div><div class="val">kozycare.ng</div></div>
        </div>
        <div>
          <div class="qrbox"><img src="data:image/png;base64,{QR_B64}" alt="QR"></div>
          <div class="scan">SCAN TO BOOK</div>
        </div>
      </div>
      <div class="addrrule"></div>
      <div class="addr">No 20. Westsyde Drive, Ogombo, Lagos State<br>
        Paradise 3 Estate, Road 5/3, Chevron, Lagos State</div>
    </div>'''

def build_html(theme, side, print_mode):
    label = f"{theme['__name__'].upper()} {side.upper()}"
    dims = '85 x 55 MM · BLEED 3 MM · ' if print_mode else ''
    css = CSS_COMMON.format(
        PW=POST_W if print_mode else TRIM_W,
        PH=POST_H if print_mode else TRIM_H,
        INSET=18.9 if print_mode else 0,
        TRIMIN=11.34 if print_mode else 0,
        PADX=24, PADY=20, **theme)
    body = front_body() if side == 'front' else back_body()
    marks = ''
    if print_mode:
        tm, bm = OFF, POST_H - OFF          # top/bottom trim edges
        lm, rm = OFF, POST_W - OFF          # left/right trim edges
        marks = f'''
  <svg class="marks" width="{POST_W}" height="{POST_H}" viewBox="0 0 {POST_W} {POST_H}">
    <g stroke="#111827" stroke-width="0.35" opacity="0.9">
      <line x1="15.12" y1="{tm}" x2="22.68" y2="{tm}"/>
      <line x1="{rm+7.56}" y1="{tm}" x2="{rm+15.12}" y2="{tm}"/>
      <line x1="15.12" y1="{bm}" x2="22.68" y2="{bm}"/>
      <line x1="{rm+7.56}" y1="{bm}" x2="{rm+15.12}" y2="{bm}"/>
      <line x1="{lm}" y1="15.12" x2="{lm}" y2="22.68"/>
      <line x1="{lm}" y1="{bm+7.56}" x2="{lm}" y2="{bm+15.12}"/>
      <line x1="{rm}" y1="15.12" x2="{rm}" y2="22.68"/>
      <line x1="{rm}" y1="{bm+7.56}" x2="{rm}" y2="{bm+15.12}"/>
    </g>
    <text x="{POST_W/2}" y="{POST_H-6.7}" text-anchor="middle"
      font-family="Outfit, Arial, sans-serif" font-size="8.5" fill="#6B7280"
      letter-spacing="1.5">KOZY · BUSINESS CARD {dims}KOZYCARE.NG · {label}</text>
  </svg>'''
    return (f'<!DOCTYPE html>\n<html><head><meta charset="utf-8">\n{FONTS}\n'
            f'<style>{css}</style></head>\n<body>\n<div class="poster">\n'
            f'  <div class="bleedbox"><div class="trim">{body}\n  </div></div>\n'
            f'{marks}\n</div>\n</body></html>\n')

for theme_name, theme in [('navy', NAVY), ('white', WHITE)]:
    theme['__name__'] = theme_name
    for side in ['front', 'back']:
        for mode, suffix in [(True, ''), (False, '-digital')]:
            f = f'card-{theme_name}-{side}{suffix}.html'
            (W / f).write_text(build_html(theme, side, mode))
            print(f'✓ {f}')
print('\nBusiness card HTML sources generated.')
