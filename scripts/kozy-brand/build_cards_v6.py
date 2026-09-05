#!/usr/bin/env python3
"""build_cards_v6.py — personal business cards (v6.1 redesign).

Two people (Mr. Orion Akenuwa — CEO; Ms. Khare Akenuwa) x three finishes
(navy signature / white light / gold corporate) x two sides, following the
approved v5 card geometry (85x55mm trim, 3mm bleed, 5mm marks margin).

v6.1 REDESIGN (client review, verbatim directions):
  FRONT = the person, centered and classier:
     - Kozy Care lockup small at the top-RIGHT
     - "Mr./Ms. <Name>" centered, smaller and less shouty (title case)
     - title ("CHIEF EXECUTIVE OFFICER") centered under the name
     - the gold demarcation rule (kept from the approved design)
     - contact information at the BOTTOM, centered:
       EMAIL kozygarmentcare@gmail.com  +  CALL / WHATSAPP line
     - NO web address on the front (it lives on the back)
  BACK  = turn-over information only (no repeated logo/name block):
     - scan-to-book QR centered with SCAN TO BOOK caption
     - WEB kozycare.ng  +  CUSTOMER CARE +234 803 175 5230
     - both addresses at the bottom, centered, under the hairline
  The standard email on both cards is kozygarmentcare@gmail.com (the
  address printed on the flyer) — the personal @kozycare.ng addresses
  are retired from print.

Print + digital variants for each. Geometry measured fit-safe with
scripts/kozy-brand/audit_v6_fit.js.
"""
import sys
from pathlib import Path

sys.path.insert(0, '/home/z/my-project/scripts/kozy-brand')
from kozy_kit_lib import (WORK, k_mark, qr_data_uri, crop_marks, PERSONS,
                          COMPANY, FONTS_HEAD, PX_MM, NAVY, GOLD, WHITE)

OUT = WORK / 'cards-v6'
OUT.mkdir(parents=True, exist_ok=True)

QR = qr_data_uri()

# print card: 382x269 (101mm x 71.2mm incl. 5mm marks margin each side)
PW, PH = 382.0, 269.0
# digital card: trim size 321x208
DW, DH = 321.26, 207.87

FINISHES = {
    'navy': {
        'bg': NAVY,
        'frame': 'rgba(212,175,55,.42)',
        'name': '#FFFFFF',
        'word': '#FFFFFF',
        'desc': GOLD,
        'title': GOLD,
        'rule': GOLD,
        'lbl': GOLD,
        'val': '#FFFFFF',
        'tagline': '#C9D5E6',
        'mark': GOLD,
        'body_bg': '#FFFFFF',   # page background outside the card (digital only)
        'qr_pad': '#FFFFFF',
        'qr_border': 'rgba(212,175,55,.35)',
        'addr': '#9FB0C6',
        'hairline': 'rgba(212,175,55,.38)',
    },
    'white': {
        'bg': WHITE,
        'frame': 'rgba(10,25,47,.30)',
        'name': NAVY,
        'word': NAVY,
        'desc': '#6F88A8',
        'title': '#B8942C',
        'rule': GOLD,
        'lbl': '#B8942C',
        'val': NAVY,
        'tagline': '#6F88A8',
        'mark': GOLD,
        'body_bg': '#FFFFFF',
        'qr_pad': WHITE,
        'qr_border': 'rgba(212,175,55,.5)',
        'addr': '#6F88A8',
        'hairline': 'rgba(10,25,47,.25)',
    },
    'gold': {
        'bg': GOLD,
        'frame': 'rgba(10,25,47,.38)',
        'name': NAVY,
        'word': NAVY,
        'desc': 'rgba(10,25,47,.78)',
        'title': NAVY,
        'rule': NAVY,
        'lbl': 'rgba(10,25,47,.72)',
        'val': NAVY,
        'tagline': 'rgba(10,25,47,.8)',
        'mark': NAVY,
        'body_bg': '#FFFFFF',
        'qr_pad': '#F5F1E8',
        'qr_border': 'rgba(10,25,47,.35)',
        'addr': 'rgba(10,25,47,.75)',
        'hairline': 'rgba(10,25,47,.32)',
    },
}

FRONT_CSS = """
  * { box-sizing:border-box; }
  html, body { margin:0; padding:0; background:__BODYBG__; }
  .poster { width:__PW__px; height:__PH__px; position:relative; background:__BODYBG__; }
  .bleedbox { position:absolute; inset:__BINSET__px; background:__BG__; overflow:hidden; }
  .trim { position:absolute; inset:__TINSET__px; }
  .marks { position:absolute; left:0; top:0; pointer-events:none; }
  .content { position:absolute; inset:0; padding:20px 24px 22px;
             display:flex; flex-direction:column; font-family:'Outfit', Arial, sans-serif; }
  .frame { position:absolute; inset:15px; border:1px solid __FRAME__; border-radius:2px;
           pointer-events:none; }
  /* brand lockup small, top-right */
  .brandrow { display:flex; align-items:center; gap:7px; justify-content:flex-end; }
  .brandrow .bn { font-family:'Playfair Display', Georgia, serif; font-weight:700;
                  font-size:11.5px; letter-spacing:1.3px; color:__WORD__; line-height:1; }
  .brandrow .bd { font-family:'Marcellus', 'Times New Roman', serif; font-size:4.8px;
                  letter-spacing:1.7px; color:__DESC__; margin-top:2.5px; white-space:nowrap; }
  /* the person — centered, classier, smaller */
  .mid { flex:1; display:flex; flex-direction:column; justify-content:center;
         align-items:center; text-align:center; }
  .name { font-family:'Playfair Display', Georgia, serif; font-weight:700;
          font-size:16.5px; letter-spacing:1.1px; color:__NAME__; line-height:1.15; }
  .role { font-family:'Marcellus', 'Times New Roman', serif; font-size:6.4px;
          letter-spacing:2.6px; color:__TITLE__; margin-top:6px; white-space:nowrap; }
  .rule { width:42px; height:1px; background:__RULE__; margin-top:11px; }
  /* direct contacts at the bottom, centered */
  .rows { display:flex; gap:24px; justify-content:center; }
  .col { display:flex; flex-direction:column; align-items:center; text-align:center;
         gap:8px; min-width:0; }
  .lbl { font-family:'Marcellus', 'Times New Roman', serif; font-size:6.0px;
         letter-spacing:1.8px; color:__LBL__; }
  .val { font-size:9.5px; font-weight:500; color:__VAL__; letter-spacing:.3px;
         margin-top:2px; white-space:nowrap; }
"""

BACK_CSS = """
  * { box-sizing:border-box; }
  html, body { margin:0; padding:0; background:__BODYBG__; }
  .poster { width:__PW__px; height:__PH__px; position:relative; background:__BODYBG__; }
  .bleedbox { position:absolute; inset:__BINSET__px; background:__BG__; overflow:hidden; }
  .trim { position:absolute; inset:__TINSET__px; }
  .marks { position:absolute; left:0; top:0; pointer-events:none; }
  .content { position:absolute; inset:0; padding:20px 24px 18px;
             display:flex; flex-direction:column; font-family:'Outfit', Arial, sans-serif; }
  .frame { position:absolute; inset:15px; border:1px solid __FRAME__; border-radius:2px;
           pointer-events:none; }
  /* turn-over information only — no repeated logo/name block */
  .mid { flex:1; display:flex; flex-direction:column; justify-content:center;
         align-items:center; gap:13px; }
  .qrbox { width:72px; padding:3px; background:__QRPAD__; border-radius:5px;
           border:1px solid __QRBORDER__; }
  .qrbox img { width:100%; display:block; }
  .scan { font-family:'Marcellus', 'Times New Roman', serif; font-size:6.2px;
          letter-spacing:1.9px; color:__LBL__; text-align:center; margin-top:5px; }
  .bkrow { display:flex; gap:26px; justify-content:center; margin-top:2px; }
  .col { display:flex; flex-direction:column; align-items:center; text-align:center; }
  .lbl { font-family:'Marcellus', 'Times New Roman', serif; font-size:6.2px;
         letter-spacing:1.9px; color:__LBL__; }
  .val { font-size:10px; font-weight:500; color:__VAL__; letter-spacing:.4px;
         margin-top:2.5px; white-space:nowrap; }
  .addrrule { height:1px; background:__HAIRLINE__; margin:0 2px; }
  .addr { font-size:6.6px; color:__ADDR__; letter-spacing:.5px; text-align:center;
          margin-top:6.5px; line-height:1.6; white-space:nowrap; }
"""


def sub(css: str, p: dict, **kw) -> str:
    s = css
    s = s.replace('__PW__', kw.get('pw')).replace('__PH__', kw.get('ph'))
    s = s.replace('__BINSET__', kw.get('binset', '18.9')).replace('__TINSET__', kw.get('tinset', '11.34'))
    for k, v in p.items():
        s = s.replace(f'__{k.upper()}__', v)
    s = s.replace('__BG__', p['bg'])
    return s


def front_html(person: dict, f: str, p: dict, digital: bool) -> str:
    pw, ph = (DW, DH) if digital else (PW, PH)
    css = sub(FRONT_CSS, p, pw=str(pw), ph=str(ph),
              binset='0' if digital else '18.9', tinset='0' if digital else '11.34')
    mark_svg = k_mark(p['mark'], 24 if digital else 26)
    role = f'<div class="role">{person["title"]}</div>' if person['title'] else ''
    # direct contacts at the bottom: the standard company email + the direct line
    contacts = (
        '<div class="rows">'
        '<div class="col">'
        f'<div><div class="lbl">EMAIL</div><div class="val">{COMPANY["email"]}</div></div>'
        '</div>'
        '<div class="col">'
        f'<div><div class="lbl">CALL / WHATSAPP</div><div class="val">{person["phone"]}</div></div>'
        '</div>'
        '</div>'
    )
    marks = '' if digital else crop_marks(
        pw, ph, 85, 55,
        f'KOZY CARE · BUSINESS CARD 85 x 55 MM · BLEED 3 MM · KOZYCARE.NG · '
        f'{f.upper()} FRONT · {person["display_name"].upper()}')
    body_bg = p['body_bg'] if digital else '#FFFFFF'
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
{FONTS_HEAD}
<style>{css.replace('__BODYBG__', body_bg)}</style></head>
<body>
<div class="poster">
  <div class="bleedbox"><div class="trim">
    <div class="content">
      <div class="frame"></div>
      <div class="brandrow">{mark_svg}<div style="text-align:right;"><div class="bn">KOZY CARE</div>
        <div class="bd">PREMIUM DRYCLEANING &amp; LAUNDRY</div></div></div>
      <div class="mid">
        <div class="name">{person['display_name']}</div>
        {role}
        <div class="rule"></div>
      </div>
      {contacts}
    </div>
  </div></div>
  {marks}
</div>
</body></html>"""


def back_html(f: str, p: dict, digital: bool) -> str:
    pw, ph = (DW, DH) if digital else (PW, PH)
    css = sub(BACK_CSS, p, pw=str(pw), ph=str(ph),
              binset='0' if digital else '18.9', tinset='0' if digital else '11.34')
    marks = '' if digital else crop_marks(
        pw, ph, 85, 55,
        f'KOZY CARE · BUSINESS CARD 85 x 55 MM · BLEED 3 MM · KOZYCARE.NG · '
        f'{f.upper()} BACK')
    body_bg = p['body_bg'] if digital else '#FFFFFF'
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
{FONTS_HEAD}
<style>{css.replace('__BODYBG__', body_bg)}</style></head>
<body>
<div class="poster">
  <div class="bleedbox"><div class="trim">
    <div class="content">
      <div class="frame"></div>
      <div class="mid">
        <div>
          <div class="qrbox"><img src="{QR}" alt="QR"></div>
          <div class="scan">SCAN TO BOOK</div>
        </div>
        <div class="bkrow">
          <div class="col"><div class="lbl">WEB</div><div class="val">{COMPANY['web']}</div></div>
          <div class="col"><div class="lbl">CUSTOMER CARE</div><div class="val">{COMPANY['phone']}</div></div>
        </div>
      </div>
      <div class="addrrule"></div>
      <div class="addr">{COMPANY['addr1']}<br>{COMPANY['addr2']}</div>
    </div>
  </div></div>
  {marks}
</div>
</body></html>"""


def main() -> None:
    count = 0
    for f, p in FINISHES.items():
        for digital, suffix in ((False, ''), (True, '-digital')):
            for person in PERSONS:
                (OUT / f'card-{f}-{person["key"]}-front{suffix}.html').write_text(
                    front_html(person, f, p, digital), encoding='utf-8')
                count += 1
            (OUT / f'card-{f}-back{suffix}.html').write_text(
                back_html(f, p, digital), encoding='utf-8')
            count += 1
    print(f'BUILT {count} card HTML files in {OUT} (v6.1 centered redesign)')


if __name__ == '__main__':
    main()
