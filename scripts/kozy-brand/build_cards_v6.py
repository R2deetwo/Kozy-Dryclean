#!/usr/bin/env python3
"""build_cards_v6.py — personal business cards (v6).

Two people (Mr. Orion Akenuwa — CEO; Ms. Khare Akenuwa) x three finishes
(navy signature / white light / gold corporate) x two sides, following the
approved v5 card geometry (85x55mm trim, 3mm bleed, 5mm marks margin).

Design intent:
  FRONT = the person (their name, role, direct contacts) with the brand
          header small at the top — so the card is recognisably theirs.
  BACK  = the approved company side (KOZY CARE, company phone/email/web,
          scan-to-book QR, both addresses) — unchanged in feel.

Print + digital variants for each.
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
  .content { position:absolute; inset:0; padding:23px 26px 27px;
             display:flex; flex-direction:column; font-family:'Outfit', Arial, sans-serif; }
  .frame { position:absolute; inset:15px; border:1px solid __FRAME__; border-radius:2px;
           pointer-events:none; }
  .brandrow { display:flex; align-items:center; gap:8px; }
  .brandrow .bn { font-family:'Playfair Display', Georgia, serif; font-weight:700;
                  font-size:13px; letter-spacing:1.5px; color:__WORD__; line-height:1; }
  .brandrow .bd { font-family:'Marcellus', 'Times New Roman', serif; font-size:5.4px;
                  letter-spacing:1.9px; color:__DESC__; margin-top:3px; white-space:nowrap; }
  .mid { flex:1; display:flex; flex-direction:column; justify-content:center; }
  .name { font-family:'Playfair Display', Georgia, serif; font-weight:700;
          font-size:21px; letter-spacing:2.0px; color:__NAME__; line-height:1; }
  .role { font-family:'Marcellus', 'Times New Roman', serif; font-size:6.6px;
          letter-spacing:2.4px; color:__TITLE__; margin-top:7px; white-space:nowrap; }
  .rule { width:42px; height:1px; background:__RULE__; margin-top:11px; }
  .rows { display:flex; gap:28px; margin-top:2px; }
  .col { display:flex; flex-direction:column; gap:9px; min-width:0; }
  .lbl { font-family:'Marcellus', 'Times New Roman', serif; font-size:6.2px;
         letter-spacing:1.8px; color:__LBL__; }
  .val { font-size:10px; font-weight:500; color:__VAL__; letter-spacing:.35px;
         margin-top:2px; white-space:nowrap; }
  .fillrow { flex:1; }
"""

BACK_CSS = """
  * { box-sizing:border-box; }
  html, body { margin:0; padding:0; background:__BODYBG__; }
  .poster { width:__PW__px; height:__PH__px; position:relative; background:__BODYBG__; }
  .bleedbox { position:absolute; inset:__BINSET__px; background:__BG__; overflow:hidden; }
  .trim { position:absolute; inset:__TINSET__px; }
  .marks { position:absolute; left:0; top:0; pointer-events:none; }
  .content { position:absolute; inset:0; padding:23px 26px 18px;
             display:flex; flex-direction:column; font-family:'Outfit', Arial, sans-serif; }
  .frame { position:absolute; inset:15px; border:1px solid __FRAME__; border-radius:2px;
           pointer-events:none; }
  .headrow { display:flex; align-items:center; gap:9px; }
  .headrow .hn { font-family:'Playfair Display', Georgia, serif; font-weight:700;
                 font-size:14.5px; letter-spacing:1.6px; color:__WORD__; line-height:1; }
  .rows { display:flex; flex-direction:column; gap:11px; margin-top:2px; }
  .lbl { font-family:'Marcellus', 'Times New Roman', serif; font-size:6.4px;
         letter-spacing:1.7px; color:__LBL__; }
  .val { font-size:10.5px; font-weight:500; color:__VAL__; letter-spacing:.4px;
         margin-top:2.5px; white-space:nowrap; }
  .qrbox { width:78px; padding:3px; background:__QRPAD__; border-radius:5px;
           border:1px solid __QRBORDER__; }
  .qrbox img { width:100%; display:block; }
  .scan { font-family:'Marcellus', 'Times New Roman', serif; font-size:6.4px;
          letter-spacing:1.7px; color:__LBL__; text-align:center; margin-top:5px; }
  .mid { display:flex; justify-content:space-between; align-items:center;
          flex:1; padding-right:6px; }
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
    mark_svg = k_mark(p['mark'], 30 if digital else 34)
    role = f'<div class="role">{person["title"]}</div>' if person['title'] else ''
    # contact columns: direct email + phone / web
    contacts = (
        '<div class="rows">'
        '<div class="col">'
        f'<div><div class="lbl">EMAIL</div><div class="val">{person["email"]}</div></div>'
        f'<div><div class="lbl">CALL / WHATSAPP</div><div class="val">{person["phone"]}</div></div>'
        '</div>'
        '<div class="col">'
        f'<div><div class="lbl">WEB</div><div class="val">{COMPANY["web"]}</div></div>'
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
      <div class="brandrow">{mark_svg}<div><div class="bn">KOZY CARE</div>
        <div class="bd">PREMIUM DRYCLEANING &amp; LAUNDRY</div></div></div>
      <div class="mid">
        <div class="name">{person['name']}</div>
        {role}
        <div class="rule"></div>
        <div class="fillrow"></div>
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
    mark_svg = k_mark(p['mark'], 21)
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
      <div class="headrow">{mark_svg}<div class="hn">KOZY CARE</div></div>
      <div class="mid">
        <div class="rows">
          <div><div class="lbl">CALL / WHATSAPP</div><div class="val">{COMPANY['phone']}</div></div>
          <div><div class="lbl">EMAIL</div><div class="val">{COMPANY['email']}</div></div>
          <div><div class="lbl">WEB</div><div class="val">{COMPANY['web']}</div></div>
        </div>
        <div>
          <div class="qrbox"><img src="{QR}" alt="QR"></div>
          <div class="scan">SCAN TO BOOK</div>
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
    print(f'BUILT {count} card HTML files in {OUT}')


if __name__ == '__main__':
    main()
