#!/usr/bin/env python3
"""build_gold_corporate.py — Gold Corporate series (v6.1).

Institutional / corporate-facing collateral for Kozy Care. Per the client's
directive: the material targets institutions (hospitality, food service,
education, healthcare, corporate offices ...) WITHOUT enumerating them —
instead it speaks in the register those buyers know: partnership terms,
scheduled collection, per-kilogram pricing, condition documentation,
consolidated invoicing, dedicated account contact.

Pieces:
  1. A4 institutional services sheet  (print + digital) — the flagship
     'corporate one-pager' a procurement officer can file.
  2. A5 institutional flyer, front + back (print + digital) — for drop-offs,
     visits, notice boards.

v6.1 FIX (client review of the printed PDFs): the first build's bottom
sections (COMMERCIAL TERMS box with the 15% + 5% partner rates, the contact
band, the QR foot row and the PREFERRED PARTNER RATES offer band) extended
up to 296px past the trim line — the cutter would slice them off. Every
piece is now measured against the trim box (scripts/kozy-brand/audit_v6_fit.js)
and the typography is set so ALL content sits inside the trim with a safe
margin. Edge gold bands now run to the BLEED edge (full-bleed bands, no
cream sliver after cutting).

Styling: Kozy Cream ground, navy text, deep-gold structure; same Playfair /
Marcellus / Outfit system and the same geometry conventions as the v5 kit
(3mm bleed, 5mm marks margin, 3.78px/mm).
"""
import sys
from pathlib import Path

sys.path.insert(0, '/home/z/my-project/scripts/kozy-brand')
from kozy_kit_lib import (WORK, k_mark, qr_data_uri, crop_marks, COMPANY,
                          FONTS_HEAD, NAVY, GOLD, GOLD_DEEP, CREAM, WHITE)

OUT = WORK / 'gold-corporate'
OUT.mkdir(parents=True, exist_ok=True)
QR = qr_data_uri()

T_BODY = '#3B4A63'
T_MUTE = '#6F88A8'
PANEL = '#FFFFFF'

# ---------------------------------------------------------------------------
HEAD = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
{FONTS_HEAD}
<style>
%s
</style></head>
<body>
%s
</body></html>"""


def a4_sheet(digital: bool) -> str:
    """A4 institutional services sheet — v6.1 compressed to fit the trim."""
    if digital:
        pw, ph = 793.7, 1122.5
        binset, tinset = '0', '0'
    else:
        pw, ph = 854.17, 1183.0
        binset, tinset = '18.9', '11.34'
    css = f"""
  * {{ box-sizing:border-box; }}
  html, body {{ margin:0; padding:0; background:#FFFFFF; }}
  .poster {{ width:{pw}px; height:{ph}px; position:relative; background:#FFFFFF; }}
  .bleedbox {{ position:absolute; inset:{binset}px; background:{CREAM}; overflow:hidden; }}
  .trim {{ position:absolute; inset:{tinset}px; }}
  .marks {{ position:absolute; left:0; top:0; pointer-events:none; }}
  .topline {{ position:absolute; top:0; left:0; right:0; height:7px;
              background:{GOLD}; }}
  .content {{ position:absolute; inset:0; padding:36px 48px 38px;
              display:flex; flex-direction:column;
              font-family:'Outfit', Arial, sans-serif; color:{T_BODY}; }}
  .brandrow {{ display:flex; align-items:center; justify-content:space-between; }}
  .brandlock {{ display:flex; align-items:center; gap:12px; }}
  .bn {{ font-family:'Playfair Display', Georgia, serif; font-weight:700;
         font-size:23px; letter-spacing:1.8px; color:{NAVY}; line-height:1; }}
  .bd {{ font-family:'Marcellus', 'Times New Roman', serif; font-size:7.5px;
         letter-spacing:2.2px; color:{GOLD_DEEP}; margin-top:4px; white-space:nowrap; }}
  .docref {{ font-size:7.5px; letter-spacing:1.9px; color:{T_MUTE};
             text-align:right; line-height:1.5; }}
  h1 {{ font-family:'Playfair Display', Georgia, serif; font-weight:700;
        font-size:33px; line-height:1.12; letter-spacing:.4px; color:{NAVY};
        margin:18px 0 0; }}
  h1 em {{ font-style:italic; font-weight:500; color:{GOLD_DEEP}; }}
  .lede {{ font-weight:300; font-size:13px; line-height:1.55; max-width:620px;
           color:{T_BODY}; margin:12px 0 0; }}
  .rule {{ width:74px; height:2px; background:{GOLD}; margin:16px 0 0; }}

  .grid {{ display:flex; flex-wrap:wrap; gap:14px 18px; margin-top:18px; }}
  .cell {{ flex:1 1 320px; max-width:100%; background:{PANEL}; border-radius:8px;
           border:1px solid rgba(184,148,44,.28); padding:12px 16px 10px; }}
  .cell h3 {{ font-family:'Marcellus', 'Times New Roman', serif; font-size:10.5px;
              letter-spacing:2.4px; color:{GOLD_DEEP}; margin:0 0 5px; }}
  .cell p {{ font-size:10.5px; line-height:1.5; margin:0; font-weight:300; }}

  .scope {{ margin-top:18px; background:{NAVY}; border-radius:10px;
            padding:15px 22px 13px; color:{CREAM}; }}
  .scope h2 {{ font-family:'Playfair Display', Georgia, serif; font-weight:700;
               font-size:16px; margin:0; color:#F2F6FB; }}
  .scope h2 em {{ font-style:italic; font-weight:500; color:{GOLD}; }}
  .scope ul {{ list-style:none; margin:10px 0 0; padding:0; display:flex;
               flex-wrap:wrap; gap:7px 8px; }}
  .scope li {{ font-size:10px; letter-spacing:1px; color:{CREAM};
               border:1px solid rgba(212,175,55,.4); border-radius:999px;
               padding:5px 12px; white-space:nowrap; }}

  .steps {{ margin-top:18px; }}
  .steps h2 {{ font-family:'Playfair Display', Georgia, serif; font-weight:700;
               font-size:16px; margin:0; color:{NAVY}; }}
  .steps h2 em {{ font-style:italic; font-weight:500; color:{GOLD_DEEP}; }}
  .steprow {{ display:flex; flex-wrap:wrap; gap:10px 16px; margin-top:12px; }}
  .step {{ flex:1 1 210px; max-width:100%; min-width:180px; }}
  .no {{ font-family:'Marcellus', 'Times New Roman', serif; font-size:20px;
         color:{GOLD_DEEP}; letter-spacing:2px; }}
  .step h4 {{ font-size:11px; font-weight:600; letter-spacing:1.5px;
              color:{NAVY}; margin:4px 0 3px; }}
  .step p {{ font-size:10.5px; line-height:1.45; font-weight:300; margin:0;
             color:{T_BODY}; }}
  .steprule {{ width:100%; height:1px; background:rgba(184,148,44,.35);
               margin-top:16px; }}

  .terms {{ margin-top:16px; border:1.5px solid {GOLD}; border-radius:10px;
            padding:13px 18px 11px; background:{PANEL}; }}
  .terms h2 {{ font-family:'Marcellus', 'Times New Roman', serif; font-size:10.5px;
               letter-spacing:2.6px; color:{GOLD_DEEP}; margin:0 0 7px; }}
  .terms table {{ width:100%; border-collapse:collapse; }}
  .terms td {{ font-size:11px; line-height:1.5; padding:3.5px 0;
               vertical-align:top; }}
  .terms td.k {{ font-family:'Marcellus', 'Times New Roman', serif;
                 font-size:9.5px; letter-spacing:1.6px; color:{NAVY};
                 white-space:nowrap; padding-right:18px; width:1%; }}
  .terms td.v {{ font-weight:300; color:{T_BODY}; }}

  .contact {{ margin-top:16px; background:{GOLD}; border-radius:10px;
              padding:14px 22px; display:flex; align-items:center;
              justify-content:space-between; gap:16px; color:{NAVY};
              flex-wrap:wrap; }}
  .contact .cta {{ font-family:'Playfair Display', Georgia, serif;
                   font-weight:700; font-size:16px; letter-spacing:.5px; }}
  .contact .cta small {{ display:block; font-family:'Outfit', Arial, sans-serif;
                          font-weight:500; font-size:9px; letter-spacing:1.9px;
                          margin-top:4px; }}
  .contact .det {{ font-size:11px; line-height:1.6; font-weight:500;
                   text-align:right; }}
  .contact .det b {{ letter-spacing:1.1px; font-weight:600; }}

  .foot {{ margin-top:14px; font-size:8.5px; letter-spacing:.5px; color:{T_MUTE};
           text-align:center; line-height:1.6; }}
  .foot .legal {{ letter-spacing:1.4px; }}
  .filler {{ flex:1; }}
"""
    mark = k_mark(GOLD, 42)
    body = f"""
<div class="poster">
  <div class="bleedbox">
    <div class="topline"></div>
    <div class="trim">
    <div class="content">
      <div class="brandrow">
        <div class="brandlock">{mark}<div><div class="bn">KOZY CARE</div>
          <div class="bd">INSTITUTIONAL &amp; CORPORATE GARMENT CARE</div></div></div>
        <div class="docref">SERVICE OVERVIEW · LAGOS<br>2026</div>
      </div>
      <h1>Partnership-grade garment care.<br><em>Delivered to standard.</em></h1>
      <p class="lede">Kozy Care provides scheduled collection, garment-specific
        cleaning and documented returns for organisations whose presentation is
        part of the promise they make — from daily linen programs to executive
        wardrobes. One accountable partner; one monthly statement.</p>
      <div class="rule"></div>

      <div class="grid">
        <div class="cell"><h3>SCHEDULED COLLECTION</h3>
          <p>Fixed weekly or twice-weekly collection windows that fit your
            operations. Your rider arrives on the agreed day, at the agreed
            time, every week.</p></div>
        <div class="cell"><h3>DOCUMENTED HANDLING</h3>
          <p>Every item is condition-captured at collection and documented at
            return — a clean audit trail your team can rely on.</p></div>
        <div class="cell"><h3>CAPACITY &amp; TURNAROUND</h3>
          <p>Express service from 24 hours; regular service 3–5 days. Volume
            processed garment-by-garment under item-specific protocols.</p></div>
        <div class="cell"><h3>CONSOLIDATED INVOICING</h3>
          <p>Per-kilogram and per-item pricing, one consolidated monthly
            statement, and a dedicated account contact for queries.</p></div>
      </div>

      <div class="scope">
        <h2>What we <em>care for</em></h2>
        <ul>
          <li>LINEN &amp; BEDDING PROGRAMS</li><li>UNIFORMS &amp; STAFF WEAR</li>
          <li>GUEST &amp; RESIDENT GARMENTS</li><li>EXECUTIVE WARDROBE</li>
          <li>SHOE CARE &amp; RESTORATION</li><li>HOUSEHOLD TEXTILES</li>
        </ul>
      </div>

      <div class="steps">
        <h2>How the partnership <em>works</em></h2>
        <div class="steprow">
          <div class="step"><div class="no">01</div><h4>ACCOUNT SETUP</h4>
            <p>We agree your collection schedule, pricing basis and contact
              channels — in writing.</p></div>
          <div class="step"><div class="no">02</div><h4>SCHEDULED COLLECTION</h4>
            <p>Your rider collects at the fixed window. Items are counted and
              condition-captured on the spot.</p></div>
          <div class="step"><div class="no">03</div><h4>PROCESSING</h4>
            <p>Garment-specific protocols — wash, press, finish — with
              documentation at every stage.</p></div>
          <div class="step"><div class="no">04</div><h4>RETURN &amp; INVOICE</h4>
            <p>Scheduled returns in sealed garment bags; one consolidated
              monthly statement.</p></div>
        </div>
        <div class="steprule"></div>
      </div>

      <div class="terms">
        <h2>COMMERCIAL TERMS</h2>
        <table>
          <tr><td class="k">PRICING</td><td class="v">Per-kilogram and per-item.
            Wash &amp; fold from ₦800/kg. Full menu at kozycare.ng.</td></tr>
          <tr><td class="k">PARTNER RATES</td><td class="v">15% off + 5% for
            institutional &amp; corporate accounts with code
            <b>HOTEL15</b>.</td></tr>
          <tr><td class="k">TURNAROUND</td><td class="v">Express from 24 hours.
            Regular service 3–5 days.</td></tr>
          <tr><td class="k">ACCOUNT CARE</td><td class="v">Dedicated account
            contact and consolidated monthly invoicing.</td></tr>
        </table>
      </div>

      <div class="contact">
        <div class="cta">Arrange a partnership review.
          <small>CALL / WHATSAPP +234 803 175 5230 · KOZYCARE.NG</small></div>
        <div class="det"><b>EMAIL</b> kozygarmentcare@gmail.com<br>
          <b>WEB</b> kozycare.ng</div>
      </div>

      <div class="filler"></div>
      <div class="foot"><span class="legal">{COMPANY['legal']}</span><br>
        {COMPANY['addr1']} · {COMPANY['addr2']}</div>
    </div>
    </div>
  </div>
  {'' if digital else crop_marks(pw, ph, 210, 297, 'KOZY CARE · CORPORATE SHEET A4 · TRIM 210 x 297 MM · BLEED 3 MM · KOZYCARE.NG · GOLD')}
</div>"""
    return HEAD % (css, body)


def a5_flyer_front(digital: bool) -> str:
    if digital:
        pw, ph = 559.4, 793.7
        binset, tinset = '0', '0'
    else:
        pw, ph = 619.84, 854.17
        binset, tinset = '18.9', '11.34'
    css = f"""
  * {{ box-sizing:border-box; }}
  html, body {{ margin:0; padding:0; background:#FFFFFF; }}
  .poster {{ width:{pw}px; height:{ph}px; position:relative; background:#FFFFFF; }}
  .bleedbox {{ position:absolute; inset:{binset}px; background:{CREAM}; overflow:hidden; }}
  .trim {{ position:absolute; inset:{tinset}px; }}
  .marks {{ position:absolute; left:0; top:0; pointer-events:none; }}
  .content {{ position:absolute; inset:0; padding:32px 42px 34px;
              display:flex; flex-direction:column; align-items:center;
              font-family:'Outfit', Arial, sans-serif; color:{T_BODY}; }}
  .goldband {{ position:absolute; top:0; left:0; right:0; height:12px; background:{GOLD}; }}
  .goldband-b {{ position:absolute; bottom:0; left:0; right:0; height:12px; background:{GOLD}; }}
  .brandlock {{ display:flex; align-items:center; gap:10px; margin-top:6px; }}
  .bn {{ font-family:'Playfair Display', Georgia, serif; font-weight:700;
         font-size:21px; letter-spacing:1.8px; color:{NAVY}; line-height:1; }}
  .bd {{ font-family:'Marcellus', 'Times New Roman', serif; font-size:7px;
         letter-spacing:2.1px; color:{GOLD_DEEP}; margin-top:4px; white-space:nowrap; }}
  .kicker {{ font-family:'Marcellus', 'Times New Roman', serif; color:{GOLD_DEEP};
            font-size:10.5px; letter-spacing:4.4px; margin-top:22px; text-align:center; }}
  h1 {{ font-family:'Playfair Display', Georgia, serif; font-weight:700;
       font-size:40px; line-height:1.1; margin:24px 0 0; text-align:center;
       letter-spacing:.5px; color:{NAVY}; }}
  h1 em {{ font-style:italic; font-weight:500; color:{GOLD_DEEP}; }}
  .rule {{ width:100px; height:2px; background:{GOLD}; margin:14px 0 14px; }}
  .sub {{ font-weight:300; font-size:12.5px; line-height:1.5; text-align:center;
         max-width:400px; color:{T_BODY}; margin:0; }}
  .val {{ margin-top:24px; display:flex; flex-direction:column; gap:10px;
          width:100%; max-width:420px; }}
  .vrow {{ display:flex; align-items:center; gap:14px; background:{PANEL};
           border:1px solid rgba(184,148,44,.3); border-radius:8px;
           padding:10px 16px; }}
  .vrow .no {{ font-family:'Marcellus', 'Times New Roman', serif; font-size:17px;
               color:{GOLD_DEEP}; }}
  .vrow .tx {{ font-size:10.5px; line-height:1.45; font-weight:400; }}
  .vrow .tx b {{ display:block; font-size:11px; letter-spacing:1.4px;
                 color:{NAVY}; margin-bottom:2px; }}
  .spacer {{ flex:1; }}
  .offer {{ margin-top:6px; background:{GOLD}; color:{NAVY}; width:100%;
            border-radius:6px; padding:14px 22px; text-align:center; }}
  .offer .big {{ font-family:'Playfair Display', Georgia, serif; font-weight:800;
                 font-size:18px; letter-spacing:.6px; }}
  .offer .small {{ font-weight:600; font-size:10px; letter-spacing:2.2px;
                   margin-top:4px; }}
  .footer {{ width:100%; border-top:1px solid rgba(184,148,44,.45);
             padding-top:10px; margin-top:12px; display:flex;
             justify-content:space-between; align-items:center;
             font-size:11px; letter-spacing:1px; color:{T_BODY}; flex-wrap:wrap; gap:8px; }}
  .footer b {{ color:{GOLD_DEEP}; font-weight:600; letter-spacing:1.4px; }}
"""
    mark = k_mark(GOLD, 44)
    body = f"""
<div class="poster">
  <div class="bleedbox">
    <div class="goldband"></div>
    <div class="trim">
    <div class="content">
      <div class="brandlock">{mark}<div><div class="bn">KOZY CARE</div>
        <div class="bd">INSTITUTIONAL &amp; CORPORATE GARMENT CARE</div></div></div>
      <div class="kicker">A PARTNER IN PRESENTATION</div>
      <h1>Immaculate presentation.<br><em>Zero admin effort.</em></h1>
      <div class="rule"></div>
      <p class="sub">Scheduled collection, garment-specific cleaning and
        documented returns for organisations that present impeccably — with
        one monthly statement and one accountable partner.</p>
      <div class="val">
        <div class="vrow"><div class="no">01</div><div class="tx"><b>SCHEDULED
          COLLECTION</b>Fixed weekly windows — your rider, your day, your time.</div></div>
        <div class="vrow"><div class="no">02</div><div class="tx"><b>DOCUMENTED
          RETURNS</b>Condition-captured at collection, documented at return.</div></div>
        <div class="vrow"><div class="no">03</div><div class="tx"><b>CONSOLIDATED
          INVOICING</b>Per-kilogram &amp; per-item pricing, one monthly statement.</div></div>
      </div>
      <div class="spacer"></div>
      <div class="offer">
        <div class="big">PREFERRED PARTNER RATES — 15% + 5%</div>
        <div class="small">FOR INSTITUTIONAL &amp; CORPORATE ACCOUNTS · CODE HOTEL15</div>
      </div>
      <div class="footer">
        <span><b>CALL / WHATSAPP</b>&nbsp; {COMPANY['phone']}</span>
        <span><b>KOZYCARE.NG</b></span>
      </div>
    </div>
    </div>
    <div class="goldband-b"></div>
  </div>
  {'' if digital else crop_marks(pw, ph, 148, 210, 'KOZY CARE · INSTITUTIONAL FLYER A5 FRONT · TRIM 148 x 210 MM · BLEED 3 MM · KOZYCARE.NG · GOLD')}
</div>"""
    return HEAD % (css, body)


def a5_flyer_back(digital: bool) -> str:
    if digital:
        pw, ph = 559.4, 793.7
        binset, tinset = '0', '0'
    else:
        pw, ph = 619.84, 854.17
        binset, tinset = '18.9', '11.34'
    css = f"""
  * {{ box-sizing:border-box; }}
  html, body {{ margin:0; padding:0; background:#FFFFFF; }}
  .poster {{ width:{pw}px; height:{ph}px; position:relative; background:#FFFFFF; }}
  .bleedbox {{ position:absolute; inset:{binset}px; background:{CREAM}; overflow:hidden; }}
  .trim {{ position:absolute; inset:{tinset}px; }}
  .marks {{ position:absolute; left:0; top:0; pointer-events:none; }}
  .content {{ position:absolute; inset:0; padding:30px 42px 30px;
              font-family:'Outfit', Arial, sans-serif; color:{T_BODY}; }}
  .goldband {{ position:absolute; top:0; left:0; right:0; height:12px; background:{GOLD}; }}
  .goldband-b {{ position:absolute; bottom:0; left:0; right:0; height:12px; background:{GOLD}; }}
  h2 {{ font-family:'Playfair Display', Georgia, serif; font-weight:700; font-size:26px;
       margin:0; color:{NAVY}; }}
  h2 em {{ font-style:italic; font-weight:500; color:{GOLD_DEEP}; }}
  .panel {{ margin-top:16px; background:{PANEL}; border-radius:10px;
            padding:17px 26px 14px; border:1px solid rgba(184,148,44,.28); }}
  .scope h3, .steps h3, .terms h3 {{ font-family:'Marcellus', 'Times New Roman', serif;
       font-size:11px; letter-spacing:2.6px; color:{GOLD_DEEP}; margin:0 0 8px; }}
  .cols {{ column-count:2; column-gap:26px; }}
  .grp {{ break-inside:avoid; margin-bottom:11px; }}
  .gl {{ font-family:'Marcellus', 'Times New Roman', serif; font-size:11px;
        letter-spacing:2.2px; color:{NAVY}; border-bottom:1px solid {GOLD};
        padding-bottom:3px; margin-bottom:6px; }}
  ul {{ list-style:none; margin:0; padding:0; }}
  li {{ display:flex; align-items:baseline; font-size:12px; line-height:1.58;
       font-weight:300; color:{T_BODY}; }}
  .nm {{ white-space:nowrap; }}
  .dots {{ flex:1; border-bottom:1px dotted #B8AE9A; margin:0 6px;
          transform:translateY(-3px); min-width:14px; }}
  .pr {{ font-weight:600; white-space:nowrap; color:{NAVY}; }}
  .note {{ margin-top:10px; font-size:10.5px; color:{T_MUTE}; letter-spacing:1.2px;
          text-align:center; }}
  .steps-row {{ margin-top:13px; display:flex; flex-wrap:wrap; gap:12px;
                justify-content:space-between; }}
  .step {{ flex:1 1 auto; min-width:110px; max-width:100%; text-align:center; }}
  .step .no {{ font-family:'Marcellus', 'Times New Roman', serif; font-size:21px;
              color:{GOLD_DEEP}; letter-spacing:2px; }}
  .step .lb {{ font-size:10.5px; letter-spacing:1.7px; color:{NAVY}; margin-top:3px;
              line-height:1.4; font-weight:500; }}
  .termsbox {{ margin-top:13px; border:1.5px solid {GOLD}; border-radius:10px;
               padding:13px 22px 11px; background:{PANEL}; }}
  .termsbox td {{ font-size:11px; line-height:1.5; padding:3.5px 0;
                  vertical-align:top; }}
  .termsbox td.k {{ font-family:'Marcellus', 'Times New Roman', serif;
                    font-size:10px; letter-spacing:1.7px; color:{NAVY};
                    white-space:nowrap; padding-right:14px; width:1%; }}
  .foot {{ margin-top:16px; border-top:1px solid rgba(184,148,44,.45);
          padding-top:12px; display:flex; align-items:center; gap:20px; }}
  .qr {{ width:78px; height:78px; background:#FFFFFF; padding:3px;
        border-radius:4px; border:1px solid rgba(184,148,44,.4); flex-shrink:0; }}
  .foot .cta {{ font-family:'Marcellus', 'Times New Roman', serif; color:{GOLD_DEEP};
               font-size:12px; letter-spacing:2px; line-height:1.45; }}
  .foot .addr {{ font-size:10.5px; line-height:1.5; color:{T_MUTE}; margin-left:auto;
                text-align:right; letter-spacing:.4px; }}
"""
    body = f"""
<div class="poster">
  <div class="bleedbox">
    <div class="goldband"></div>
    <div class="trim">
    <div class="content">
      <div class="scope">
        <h2>The partnership <em>menu.</em></h2>
        <div class="panel">
          <div class="cols">
          <div class="grp"><div class="gl">PER-KILOGRAM</div><ul>
            <li><span class="nm">Wash &amp; Fold</span><span class="dots"></span><span class="pr">from ₦800/kg</span></li>
            <li><span class="nm">Scheduled collection</span><span class="dots"></span><span class="pr">included</span></li>
            <li><span class="nm">Condition documentation</span><span class="dots"></span><span class="pr">included</span></li>
          </ul></div>
          <div class="grp"><div class="gl">PER-ITEM DRYCLEANING</div><ul>
            <li><span class="nm">Shirt / Top</span><span class="dots"></span><span class="pr">from ₦500</span></li>
            <li><span class="nm">Suit (2-Piece)</span><span class="dots"></span><span class="pr">from ₦4,500</span></li>
            <li><span class="nm">Traditional wear</span><span class="dots"></span><span class="pr">from ₦1,500</span></li>
          </ul></div>
          <div class="grp"><div class="gl">HOUSEHOLD &amp; TEXTILES</div><ul>
            <li><span class="nm">Bedsheet</span><span class="dots"></span><span class="pr">from ₦1,200</span></li>
            <li><span class="nm">Duvet</span><span class="dots"></span><span class="pr">from ₦2,500</span></li>
            <li><span class="nm">Curtain (per panel)</span><span class="dots"></span><span class="pr">from ₦1,800</span></li>
          </ul></div>
          <div class="grp"><div class="gl">SHOE CARE &amp; RESTORATION</div><ul>
            <li><span class="nm">Leather</span><span class="dots"></span><span class="pr">from ₦1,000</span></li>
            <li><span class="nm">Sneaker restoration</span><span class="dots"></span><span class="pr">from ₦5,000</span></li>
          </ul></div>
          </div>
        </div>
        <div class="note">FULL MENU AT KOZYCARE.NG · PRICING CONFIRMED IN YOUR PARTNERSHIP AGREEMENT</div>
      </div>

      <div class="steps">
        <h3>HOW IT WORKS</h3>
        <div class="steps-row">
          <div class="step"><div class="no">01</div><div class="lb">ACCOUNT SETUP</div></div>
          <div class="step"><div class="no">02</div><div class="lb">SCHEDULED COLLECTION</div></div>
          <div class="step"><div class="no">03</div><div class="lb">PROCESSING &amp; DOCS</div></div>
          <div class="step"><div class="no">04</div><div class="lb">RETURN &amp; INVOICE</div></div>
        </div>
      </div>

      <div class="termsbox">
        <h3>PARTNER TERMS</h3>
        <table>
          <tr><td class="k">RATES</td><td>15% off + 5% for institutional &amp;
            corporate accounts with code <b>HOTEL15</b>.</td></tr>
          <tr><td class="k">TURNAROUND</td><td>Express from 24 hours; regular
            service 3–5 days.</td></tr>
          <tr><td class="k">ACCOUNT</td><td>Dedicated contact; consolidated
            monthly invoicing.</td></tr>
        </table>
      </div>

      <div class="foot">
        <img class="qr" src="{QR}" alt="QR">
        <div class="cta">SCAN TO ARRANGE<br>A PARTNERSHIP REVIEW</div>
        <div class="addr">{COMPANY['legal']}<br>
          {COMPANY['addr1']}<br>
          {COMPANY['addr2']}<br>
          {COMPANY['email']} · {COMPANY['phone']}</div>
      </div>
    </div>
    </div>
    <div class="goldband-b"></div>
  </div>
  {'' if digital else crop_marks(pw, ph, 148, 210, 'KOZY CARE · INSTITUTIONAL FLYER A5 BACK · TRIM 148 x 210 MM · BLEED 3 MM · KOZYCARE.NG · GOLD')}
</div>"""
    return HEAD % (css, body)


def main() -> None:
    pieces = {
        'corporate-sheet-a4.html': a4_sheet(False),
        'corporate-sheet-a4-digital.html': a4_sheet(True),
        'flyer-institutional-front.html': a5_flyer_front(False),
        'flyer-institutional-front-digital.html': a5_flyer_front(True),
        'flyer-institutional-back.html': a5_flyer_back(False),
        'flyer-institutional-back-digital.html': a5_flyer_back(True),
    }
    for name, html in pieces.items():
        (OUT / name).write_text(html, encoding='utf-8')
        print('  built', name)
    print('GOLD CORPORATE series built (v6.1 fit-fixed)')


if __name__ == '__main__':
    main()
