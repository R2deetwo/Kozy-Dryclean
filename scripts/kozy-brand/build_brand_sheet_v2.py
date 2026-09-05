#!/usr/bin/env python3
"""build_brand_sheet_v2.py — Kozy Care brand sheet V2 (v6 kit).

Same visual system as the V1 sheet (cream ground, white cards, Marcellus
section numbers, gold accents) but now leads with THE NAME — the rule the
client asked to enforce — and documents the three collateral series
(Signature Navy / Light / Gold Corporate) and the corrected wordmarks.
New lockup SVGs are inlined so the sheet is fully self-contained.
"""
import sys
from pathlib import Path

sys.path.insert(0, '/home/z/my-project/scripts/kozy-brand')
from kozy_kit_lib import WORK, k_mark, FONTS_HEAD, NAVY, GOLD, GOLD_DEEP, CREAM

OUT = WORK / 'brand-sheet-v2'
OUT.mkdir(parents=True, exist_ok=True)
LOGO = WORK / 'logo-v6'


def inline_svg(name: str) -> str:
    s = (LOGO / name).read_text(encoding='utf-8')
    s = s.replace('<svg ', '<svg style="height:100%;width:auto;display:block" ')
    return s


def build() -> str:
    primary_navy = inline_svg('kozy-logo-primary-navy.svg')
    primary_white = inline_svg('kozy-logo-primary-white.svg')
    compact_gold = inline_svg('kozy-logo-compact-gold.svg')
    caps_white = inline_svg('kozy-logo-print-caps-white.svg')
    mark_gold = k_mark(GOLD, 40)
    mark_navy = k_mark(NAVY, 40)

    css = f"""
  html, body {{ margin:0; padding:0; background:{CREAM}; }}
  * {{ box-sizing:border-box; }}
  .poster {{ width:794px; height:1123px; background:{CREAM}; position:relative;
            font-family:'Outfit', Arial, sans-serif; color:{NAVY};
            padding:20px 48px 18px; display:flex; flex-direction:column; }}
  .hd {{ display:flex; justify-content:space-between; align-items:center;
        padding-bottom:8px; border-bottom:2px solid {NAVY}; }}
  .hd .lock {{ height:44px; display:flex; align-items:center; }}
  .hd .rt {{ text-align:right; }}
  .hd .t1 {{ font-family:'Marcellus', 'Times New Roman', serif; font-size:17px;
            letter-spacing:5px; }}
  .hd .t2 {{ font-size:11px; color:#5A6B80; letter-spacing:2.5px; margin-top:4px; }}
  .sec {{ margin-top:7px; }}
  .sn {{ font-family:'Marcellus', 'Times New Roman', serif; font-size:12px;
        letter-spacing:3.5px; color:{NAVY}; display:flex; align-items:center;
        gap:12px; margin-bottom:6px; }}
  .sn::after {{ content:''; flex:1; height:1px; background:rgba(10,25,47,.18); }}
  .sn b {{ color:{GOLD}; font-weight:400; }}

  /* 01 — the name */
  .namewrap {{ display:flex; gap:16px; }}
  .namecard {{ flex:1.35; background:#FFFFFF; border:1px solid rgba(10,25,47,.10);
              border-radius:10px; padding:10px 15px; }}
  .namecard .big {{ font-family:'Playfair Display', Georgia, serif; font-weight:700;
                   font-size:29px; letter-spacing:1px; }}
  .namecard .big i {{ font-style:italic; font-weight:500; color:{GOLD_DEEP}; }}
  .namecard p {{ font-size:9.6px; line-height:1.52; color:#3A4A5E; margin:6px 0 0; }}
  .namecard p b {{ color:{NAVY}; }}
  .namerules {{ flex:1; background:#FFFFFF; border:1px solid rgba(10,25,47,.10);
               border-radius:10px; padding:9px 14px; }}
  .namerules table {{ width:100%; border-collapse:collapse; }}
  .namerules td {{ font-size:9.3px; line-height:1.45; padding:2.6px 0;
                  vertical-align:top; color:#3A4A5E; }}
  .namerules td.k {{ font-family:'Marcellus', 'Times New Roman', serif;
                    letter-spacing:1.6px; color:{NAVY}; white-space:nowrap;
                    padding-right:12px; width:1%; }}
  .namerules .ok {{ color:#1E6B4F; font-weight:600; }}
  .namerules .no {{ color:#9C2F2F; font-weight:600; }}

  /* 02 — lockups */
  .variants {{ display:flex; gap:16px; align-items:stretch; }}
  .vcard {{ flex:1; background:#FFFFFF; border:1px solid rgba(10,25,47,.10);
           border-radius:10px; padding:9px 12px; text-align:center; }}
  .vcard .chip {{ display:flex; align-items:center; justify-content:center;
                 height:50px; border-radius:8px; }}
  .vcard .chip.navy {{ background:{NAVY}; }}
  .vcard .chip.cream {{ background:{CREAM}; }}
  .vcard .lbl {{ font-size:9.8px; letter-spacing:2.4px; color:#5A6B80; margin-top:7px; }}
  .vcard .use {{ font-size:8.9px; color:#8A97A8; margin-top:2px; letter-spacing:.4px;
                line-height:1.42; }}
  .vsizes {{ display:none; }}
  .vmini {{ flex:1; background:#FFFFFF; border:1px solid rgba(10,25,47,.10);
           border-radius:10px; padding:10px 14px; display:flex; align-items:center;
           justify-content:center; gap:18px; }}

  /* 03 — series */
  .series {{ display:flex; gap:16px; }}
  .scard {{ flex:1; border-radius:10px; overflow:hidden; border:1px solid rgba(10,25,47,.10);
           background:#FFFFFF; }}
  .scard .bar {{ height:38px; display:flex; align-items:center; justify-content:center; }}
  .scard .bar.navy {{ background:{NAVY}; }}
  .scard .bar.cream {{ background:{CREAM}; border-bottom:1px solid rgba(184,148,44,.25); }}
  .scard .bar.gold {{ background:{GOLD}; }}
  .scard .meta {{ padding:8px 12px; }}
  .scard .nm2 {{ font-family:'Marcellus', 'Times New Roman', serif; font-size:11.5px;
                letter-spacing:2px; }}
  .scard .cd {{ font-size:9.2px; color:#3A4A5E; margin-top:4px; line-height:1.48;
               letter-spacing:.3px; }}
  .scard .cd b {{ color:{NAVY}; }}

  /* 04 — colour */
  .swatches {{ display:flex; gap:16px; }}
  .sw {{ flex:1; border-radius:10px; overflow:hidden; border:1px solid rgba(10,25,47,.10);
        background:#FFFFFF; }}
  .sw .col {{ height:34px; }}
  .sw .meta {{ padding:7px 12px; }}
  .sw .nm {{ font-family:'Marcellus', 'Times New Roman', serif; font-size:11.5px;
            letter-spacing:2px; }}
  .sw .cd {{ font-size:8.9px; color:#5A6B80; margin-top:3px; line-height:1.45;
            letter-spacing:.4px; }}

  /* 05 — typography */
  .type {{ display:flex; flex-direction:column; gap:6px; }}
  .trow {{ display:flex; align-items:baseline; gap:18px; background:#FFFFFF;
          border:1px solid rgba(10,25,47,.10); border-radius:10px; padding:3px 16px; }}
  .trow .aa {{ font-size:21px; width:140px; }}
  .trow .fi {{ font-family:'Playfair Display', Georgia, serif; font-weight:700; }}
  .trow .fm {{ font-family:'Marcellus', 'Times New Roman', serif; letter-spacing:4px; }}
  .trow .fo {{ font-family:'Outfit', Arial, sans-serif; font-weight:300; }}
  .trow .tn {{ font-size:9.8px; color:#5A6B80; letter-spacing:1.6px; }}
  .trow .tv {{ margin-left:auto; text-align:right; font-size:9.2px; color:#8A97A8;
              letter-spacing:.3px; line-height:1.45; }}

  /* 06 — rules */
  .rules {{ display:flex; gap:16px; }}
  .rcol {{ flex:1; background:#FFFFFF; border:1px solid rgba(10,25,47,.10);
          border-radius:10px; padding:9px 13px; }}
  .rcol h4 {{ margin:0 0 7px; font-family:'Marcellus', 'Times New Roman', serif;
             font-size:12px; letter-spacing:2.6px; }}
  .rcol.do h4 {{ color:#1E6B4F; }}
  .rcol.dont h4 {{ color:#9C2F2F; }}
  .rcol ul {{ margin:0; padding-left:14px; font-size:9.4px; line-height:1.5;
             color:#3A4A5E; }}
  .ft {{ margin-top:auto; padding-top:8px; border-top:1px solid rgba(10,25,47,.18);
        display:flex; justify-content:space-between; font-size:10px;
        letter-spacing:1.6px; color:#5A6B80; }}
"""

    body = f"""
<div class="poster">
  <div class="hd">
    <div class="lock">{primary_navy}</div>
    <div class="rt">
      <div class="t1">BRAND GUIDELINES</div>
      <div class="t2">KOZY CARE · 2026 · V2</div>
    </div>
  </div>

  <div class="sec">
    <div class="sn"><b>01</b> THE NAME</div>
    <div class="namewrap">
      <div class="namecard">
        <div class="big">Kozy <i>Care</i></div>
        <p>The brand is <b>always two words — Kozy Care</b> — exactly as it
          appears on the website. <b>Kozy</b> alone never appears in
          customer-facing copy, signage or collateral. Capitalisation may
          follow the setting: title case <b>Kozy Care</b> (web, documents) or
          tracked caps <b>KOZY CARE</b> (print, labels). The monogram K is an
          icon — not the name.</p>
      </div>
      <div class="namerules">
        <table>
          <tr><td class="k">BRAND</td><td><span class="ok">Kozy Care</span> — two words, every use</td></tr>
          <tr><td class="k">LEGAL</td><td>Kozy Care Drycleaning &amp; Laundry Services — documents &amp; invoices</td></tr>
          <tr><td class="k">BANK</td><td>Kozy Cleaning Services Ltd — bank records only</td></tr>
          <tr><td class="k">WEB</td><td>kozycare.ng · @kozycare.ng email</td></tr>
          <tr><td class="k">ICON</td><td>The K monogram (avatars, favicons, embroidery, watermark)</td></tr>
          <tr><td class="k">NEVER</td><td><span class="no">“Kozy”</span> alone in public copy</td></tr>
        </table>
      </div>
    </div>
  </div>

  <div class="sec">
    <div class="sn"><b>02</b> THE LOGO — CORRECTED LOCKUPS</div>
    <div class="variants">
      <div class="vcard">
        <div class="chip cream" style="height:50px">{primary_navy}</div>
        <div class="lbl">PRIMARY · TITLE CASE</div>
        <div class="use">Website header, documents, email chrome — matches the landing page exactly.</div>
      </div>
      <div class="vcard">
        <div class="chip navy" style="height:50px">{caps_white}</div>
        <div class="lbl">PRINT · TRACKED CAPS</div>
        <div class="use">Flyers, posters, cards — the collateral lockup.</div>
      </div>
      <div class="vcard">
        <div class="chip cream" style="height:50px">{compact_gold}</div>
        <div class="lbl">COMPACT</div>
        <div class="use">Tight spaces — footers, social avatars with text.</div>
      </div>
      <div class="vcard">
        <div class="chip navy" style="height:50px;flex-direction:column;gap:4px">
          <div style="display:flex;justify-content:center">{mark_gold}</div>
        </div>
        <div class="lbl">MONOGRAM</div>
        <div class="use">Favicons, avatars, embroidery, corner anchor &amp; watermarks.</div>
      </div>
    </div>
    <div class="vsizes">
      <div class="vmini">
        <span style="font-size:9.5px;letter-spacing:2px;color:#5A6B80">CLEARSPACE — KEEP X MARGIN ON ALL SIDES (X = BALL TERMINAL DIAMETER) · MIN 12 MM PRINT / 32 PX SCREEN</span>
      </div>
    </div>
  </div>

  <div class="sec">
    <div class="sn"><b>03</b> THE THREE SERIES</div>
    <div class="series">
      <div class="scard">
        <div class="bar navy">{caps_white}</div>
        <div class="meta">
          <div class="nm2">SIGNATURE NAVY</div>
          <div class="cd"><b>Consumer retail.</b> The approved original —
            flyers, posters, cards for everyday customer-facing use.</div>
        </div>
      </div>
      <div class="scard">
        <div class="bar cream" style="border-bottom:1px solid rgba(184,148,44,.25)">
          <span style="font-family:'Marcellus',serif;font-size:10.5px;letter-spacing:2.6px;color:{NAVY}">LIGHT SERIES</span>
        </div>
        <div class="meta">
          <div class="nm2">LIGHT</div>
          <div class="cd"><b>Bright settings.</b> Same pieces on Kozy Cream —
            warm interiors, daylight notice boards, soft-print runs.</div>
        </div>
      </div>
      <div class="scard">
        <div class="bar gold">
          <span style="font-family:'Marcellus',serif;font-size:10.5px;letter-spacing:2.6px;color:{NAVY}">GOLD CORPORATE</span>
        </div>
        <div class="meta">
          <div class="nm2">GOLD CORPORATE</div>
          <div class="cd"><b>Institutional &amp; B2B.</b> Partnership language —
            scheduled collection, documentation, consolidated invoicing.</div>
        </div>
      </div>
    </div>
  </div>

  <div class="sec">
    <div class="sn"><b>04</b> COLOUR</div>
    <div class="swatches">
      <div class="sw"><div class="col" style="background:{NAVY}"></div>
        <div class="meta"><div class="nm">KOZY NAVY</div>
        <div class="cd">HEX #0A192F · RGB 10 25 47<br>Print C100 M78 Y32 K40</div></div></div>
      <div class="sw"><div class="col" style="background:{GOLD}"></div>
        <div class="meta"><div class="nm">KOZY GOLD</div>
        <div class="cd">HEX #D4AF37 · Pantone 871 C<br>Accents, hairlines &amp; CTAs (~10% area)</div></div></div>
      <div class="sw"><div class="col" style="background:{GOLD_DEEP}"></div>
        <div class="meta"><div class="nm">DEEP GOLD</div>
        <div class="cd">HEX #B8942C · RGB 184 148 44<br>Gold text on light grounds (readability)</div></div></div>
      <div class="sw"><div class="col" style="background:{CREAM};border-bottom:1px solid rgba(10,25,47,.12)"></div>
        <div class="meta"><div class="nm">KOZY CREAM</div>
        <div class="cd">HEX #F5F1E8 · RGB 245 241 232<br>Light-series ground &amp; panels</div></div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sn"><b>05</b> TYPOGRAPHY</div>
    <div class="type">
      <div class="trow"><span class="aa fi">Aa</span>
        <span class="tn">HEADLINES — PLAYFAIR DISPLAY 600–800</span>
        <span class="tv">Luxury Didone serif · pairs with italic</span></div>
      <div class="trow"><span class="aa fm">Aa</span>
        <span class="tn">LABELS &amp; KICKERS — MARCELLUS, TRACKED</span>
        <span class="tv">Trajan-style Roman caps · always letterspaced</span></div>
      <div class="trow"><span class="aa fo">Aa</span>
        <span class="tn">BODY &amp; PRICES — OUTFIT 300–600</span>
        <span class="tv">Clean geometric sans · digits align in tables</span></div>
    </div>
  </div>

  <div class="sec">
    <div class="sn"><b>06</b> RULES</div>
    <div class="rules">
      <div class="rcol do">
        <h4>DO</h4>
        <ul>
          <li>Write <b>Kozy Care</b> — both words, every time</li>
          <li>Gold on navy; navy on cream or white; Deep Gold text on light grounds</li>
          <li>Keep the clearspace margin around every lockup</li>
          <li>Use supplied vector files (SVG / PDF) for print</li>
        </ul>
      </div>
      <div class="rcol dont">
        <h4>DON'T</h4>
        <ul>
          <li>Never “Kozy” without “Care” in public-facing copy</li>
          <li>Don't stretch, rotate, skew or re-colour the mark</li>
          <li>Don't add shadows, gradients or outlines to the logo</li>
          <li>Don't set light gold text on white — use Deep Gold or navy</li>
        </ul>
      </div>
    </div>
  </div>

  <div class="ft">
    <span>V2 · KOZYCARE.NG · KOZYGARMENTCARE@GMAIL.COM · +234 803 175 5230</span>
    <span>NO 20, WESTSYDE DRIVE, OGOMBO, LAGOS</span>
  </div>
</div>"""
    head = ('<!DOCTYPE html>\n<html><head><meta charset="utf-8">\n'
            f'{FONTS_HEAD}\n<style>{css}</style></head>\n<body>\n')
    return head + body + '\n</body></html>'


if __name__ == '__main__':
    p = OUT / 'kozy-brand-sheet-v2.html'
    p.write_text(build(), encoding='utf-8')
    print('built', p)
