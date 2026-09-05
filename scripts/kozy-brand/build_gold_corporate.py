#!/usr/bin/env python3
"""build_gold_corporate.py — Gold Corporate series (v6).

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
    """A4 institutional services sheet."""
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
  .content {{ position:absolute; inset:0; padding:46px 52px 40px;
              display:flex; flex-direction:column;
              font-family:'Outfit', Arial, sans-serif; color:{T_BODY}; }}
  .topline {{ position:absolute; top:0; left:0; right:0; height:7px;
              background:{GOLD}; }}
  .brandrow {{ display:flex; align-items:center; justify-content:space-between; }}
  .brandlock {{ display:flex; align-items:center; gap:14px; }}
  .bn {{ font-family:'Playfair Display', Georgia, serif; font-weight:700;
         font-size:30px; letter-spacing:2.4px; color:{NAVY}; line-height:1; }}
  .bd {{ font-family:'Marcellus', 'Times New Roman', serif; font-size:8.5px;
         letter-spacing:2.6px; color:{GOLD_DEEP}; margin-top:6px; white-space:nowrap; }}
  .docref {{ font-size:8.5px; letter-spacing:2.2px; color:{T_MUTE};
             text-align:right; line-height:1.7; }}
  h1 {{ font-family:'Playfair Display', Georgia, serif; font-weight:700;
        font-size:41px; line-height:1.14; letter-spacing:.4px; color:{NAVY};
        margin:34px 0 0; }}
  h1 em {{ font-style:italic; font-weight:500; color:{GOLD_DEEP}; }}
  .lede {{ font-weight:300; font-size:14.5px; line-height:1.6; max-width:560px;
           color:{T_BODY}; margin:16px 0 0; }}
  .rule {{ width:74px; height:2px; background:{GOLD}; margin:22px 0 0; }}

  .grid {{ display:flex; flex-wrap:wrap; gap:18px 26px; margin-top:26px; }}
  .cell {{ flex:1 1 320px; max-width:100%; background:{PANEL}; border-radius:8px;
           border:1px solid rgba(184,148,44,.28); padding:16px 20px 14px; }}
  .cell h3 {{ font-family:'Marcellus', 'Times New Roman', serif; font-size:11px;
              letter-spacing:2.8px; color:{GOLD_DEEP}; margin:0 0 7px; }}
  .cell p {{ font-size:11.5px; line-height:1.6; margin:0; font-weight:300; }}

  .scope {{ margin-top:24px; background:{NAVY}; border-radius:10px;
            padding:20px 28px 18px; color:{CREAM}; }}
  .scope h2 {{ font-family:'Playfair Display', Georgia, serif; font-weight:700;
               font-size:20px; margin:0; color:#F2F6FB; }}
  .scope h2 em {{ font-style:italic; font-weight:500; color:{GOLD}; }}
  .scope ul {{ list-style:none; margin:12px 0 0; padding:0; display:flex;
               flex-wrap:wrap; gap:8px 10px; }}
  .scope li {{ font-size:11px; letter-spacing:1.1px; color:{CREAM};
               border:1px solid rgba(212,175,55,.4); border-radius:999px;
               padding:6px 14px; white-space:nowrap; }}

  .steps {{ margin-top:24px; }}
  .steps h2 {{ font-family:'Playfair Display', Georgia, serif; font-weight:700;
               font-size:20px; margin:0; color:{NAVY}; }}
  .steps h2 em {{ font-style:italic; font-weight:500; color:{GOLD_DEEP}; }}
  .steprow {{ display:flex; flex-wrap:wrap; gap:14px 20px; margin-top:14px; }}
  .step {{ flex:1 1 210px; max-width:100%; min-width:180px; }}
  .no {{ font-family:'Marcellus', 'Times New Roman', serif; font-size:24px;
         color:{GOLD_DEEP}; letter-spacing:2px; }}
  .step h4 {{ font-size:12.5px; font-weight:600; letter-spacing:1.8px;
              color:{NAVY}; margin:6px 0 5px; }}
  .step p {{ font-size:11px; line-height:1.55; font-weight:300; margin:0;
             color:{T_BODY}; }}
  .steprule {{ width:100%; height:1px; background:rgba(184,148,44,.35);
               margin-top:18px; }}

  .terms {{ margin-top:20px; border:1.5px solid {GOLD}; border-radius:10px;
            padding:16px 24px 14px; background:{PANEL}; }}
  .terms h2 {{ font-family:'Marcellus', 'Times New Roman', serif; font-size:12px;
               letter-spacing:3px; color:{GOLD_DEEP}; margin:0 0 10px; }}
  .terms table {{ width:100%; border-collapse:collapse; }}
  .terms td {{ font-size:11.5px; line-height:1.55; padding:4.5px 0;
               vertical-align:top; }}
  .terms td.k {{ font-family:'Marcellus', 'Times New Roman', serif;
                 font-size:10.5px; letter-spacing:1.8px; color:{NAVY};
                 white-space:nowrap; padding-right:18px; width:1%; }}
  .terms td.v {{ font-weight:300; color:{T_BODY}; }}

  .contact {{ margin-top:22px; background:{GOLD}; border-radius:10px;
              padding:18px 28px; display:flex; align-items:center;
              justify-content:space-between; gap:18px; color:{NAVY};
              flex-wrap:wrap; }}
  .contact .cta {{ font-family:'Playfair Display', Georgia, serif;
                   font-weight:700; font-size:19px; letter-spacing:.5px; }}
  .contact .cta small {{ display:block; font-family:'Outfit', Arial, sans-serif;
                          font-weight:500; font-size:10px; letter-spacing:2.2px;
                          margin-top:5px; }}
  .contact .det {{ font-size:12px; line-height:1.7; font-weight:500;
                   text-align:right; }}
  .contact .det b {{ letter-spacing:1.2px; font-weight:600; }}

  .foot {{ margin-top:16px; font-size:9px; letter-spacing:.6px; color:{T_MUTE};
           text-align:center; line-height:1.7; }}
  .foot .legal {{ letter-spacing:1.6px; }}
"""
    mark = k_mark(GOLD, 58)
    body = f"""
<div class="poster">
  <div class="bleedbox"><div class="trim">
    <div class="content">
      <div class="topline"></div>
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

      <div class="foot"><span class="legal">{COMPANY['legal']}</span><br>
        {COMPANY['addr1']} · {COMPANY['addr2']}</div>
    </div>
  </div></div>
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
  .content {{ position:absolute; inset:0; padding:38px 42px 34px;
              display:flex; flex-direction:column; align-items:center;
              font-family:'Outfit', Arial, sans-serif; color:{T_BODY}; }}
  .goldband {{ position:absolute; top:0; left:0; right:0; height:12px; background:{GOLD}; }}
  .goldband-b {{ position:absolute; bottom:0; left:0; right:0; height:12px; background:{GOLD}; }}
  .brandlock {{ display:flex; align-items:center; gap:12px; margin-top:8px; }}
  .bn {{ font-family:'Playfair Display', Georgia, serif; font-weight:700;
         font-size:27px; letter-spacing:2.2px; color:{NAVY}; line-height:1; }}
  .bd {{ font-family:'Marcellus', 'Times New Roman', serif; font-size:8px;
         letter-spacing:2.4px; color:{GOLD_DEEP}; margin-top:6px; white-space:nowrap; }}
  .kicker {{ font-family:'Marcellus', 'Times New Roman', serif; color:{GOLD_DEEP};
            font-size:11.5px; letter-spacing:5px; margin-top:30px; text-align:center; }}
  h1 {{ font-family:'Playfair Display', Georgia, serif; font-weight:700;
       font-size:50px; line-height:1.12; margin:30px 0 0; text-align:center;
       letter-spacing:.5px; color:{NAVY}; }}
  h1 em {{ font-style:italic; font-weight:500; color:{GOLD_DEEP}; }}
  .rule {{ width:100px; height:2px; background:{GOLD}; margin:24px 0 20px; }}
  .sub {{ font-weight:300; font-size:15px; line-height:1.55; text-align:center;
         max-width:390px; color:{T_BODY}; margin:0; }}
  .val {{ margin-top:34px; display:flex; flex-direction:column; gap:12px;
          width:100%; max-width:420px; }}
  .vrow {{ display:flex; align-items:center; gap:14px; background:{PANEL};
           border:1px solid rgba(184,148,44,.3); border-radius:8px;
           padding:13px 18px; }}
  .vrow .no {{ font-family:'Marcellus', 'Times New Roman', serif; font-size:21px;
               color:{GOLD_DEEP}; }}
  .vrow .tx {{ font-size:12px; line-height:1.5; font-weight:400; }}
  .vrow .tx b {{ display:block; font-size:12.5px; letter-spacing:1.6px;
                 color:{NAVY}; margin-bottom:2px; }}
  .spacer {{ flex:1; }}
  .offer {{ margin-top:8px; background:{GOLD}; color:{NAVY}; width:100%;
            border-radius:6px; padding:20px 26px; text-align:center; }}
  .offer .big {{ font-family:'Playfair Display', Georgia, serif; font-weight:800;
                 font-size:22px; letter-spacing:.6px; }}
  .offer .small {{ font-weight:600; font-size:11.5px; letter-spacing:2.6px;
                   margin-top:6px; }}
  .footer {{ width:100%; border-top:1px solid rgba(184,148,44,.45);
             padding-top:16px; margin-top:22px; display:flex;
             justify-content:space-between; align-items:center;
             font-size:12px; letter-spacing:1.1px; color:{T_BODY}; flex-wrap:wrap; gap:8px; }}
  .footer b {{ color:{GOLD_DEEP}; font-weight:600; letter-spacing:1.6px; }}
"""
    mark = k_mark(GOLD, 56)
    body = f"""
<div class="poster">
  <div class="bleedbox"><div class="trim">
    <div class="content">
      <div class="goldband"></div>
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
  </div></div>
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
  .content {{ position:absolute; inset:0; padding:34px 42px 30px;
              font-family:'Outfit', Arial, sans-serif; color:{T_BODY}; }}
  .goldband {{ position:absolute; top:0; left:0; right:0; height:12px; background:{GOLD}; }}
  .goldband-b {{ position:absolute; bottom:0; left:0; right:0; height:12px; background:{GOLD}; }}
  h2 {{ font-family:'Playfair Display', Georgia, serif; font-weight:700; font-size:29px;
       margin:0; color:{NAVY}; }}
  h2 em {{ font-style:italic; font-weight:500; color:{GOLD_DEEP}; }}
  .panel {{ margin-top:20px; background:{PANEL}; border-radius:10px;
            padding:22px 28px 20px; border:1px solid rgba(184,148,44,.28); }}
  .scope h3, .steps h3, .terms h3 {{ font-family:'Marcellus', 'Times New Roman', serif;
       font-size:11.5px; letter-spacing:2.8px; color:{GOLD_DEEP}; margin:0 0 10px; }}
  .cols {{ column-count:2; column-gap:30px; }}
  .grp {{ break-inside:avoid; margin-bottom:13px; }}
  .gl {{ font-family:'Marcellus', 'Times New Roman', serif; font-size:11.5px;
        letter-spacing:2.4px; color:{NAVY}; border-bottom:1px solid {GOLD};
        padding-bottom:3px; margin-bottom:6px; }}
  ul {{ list-style:none; margin:0; padding:0; }}
  li {{ display:flex; align-items:baseline; font-size:12.5px; line-height:1.62;
       font-weight:300; color:{T_BODY}; }}
  .nm {{ white-space:nowrap; }}
  .dots {{ flex:1; border-bottom:1px dotted #B8AE9A; margin:0 6px;
          transform:translateY(-3px); min-width:14px; }}
  .pr {{ font-weight:600; white-space:nowrap; color:{NAVY}; }}
  .note {{ margin-top:12px; font-size:11px; color:{T_MUTE}; letter-spacing:1.4px;
          text-align:center; }}
  .steps-row {{ margin-top:18px; display:flex; flex-wrap:wrap; gap:14px;
                justify-content:space-between; }}
  .step {{ flex:1 1 auto; min-width:110px; max-width:100%; text-align:center; }}
  .step .no {{ font-family:'Marcellus', 'Times New Roman', serif; font-size:23px;
              color:{GOLD_DEEP}; letter-spacing:2px; }}
  .step .lb {{ font-size:11px; letter-spacing:1.8px; color:{NAVY}; margin-top:3px;
              line-height:1.4; font-weight:500; }}
  .termsbox {{ margin-top:18px; border:1.5px solid {GOLD}; border-radius:10px;
               padding:16px 24px 14px; background:{PANEL}; }}
  .termsbox td {{ font-size:11.5px; line-height:1.55; padding:4px 0;
                  vertical-align:top; }}
  .termsbox td.k {{ font-family:'Marcellus', 'Times New Roman', serif;
                    font-size:10.5px; letter-spacing:1.8px; color:{NAVY};
                    white-space:nowrap; padding-right:16px; width:1%; }}
  .foot {{ margin-top:18px; border-top:1px solid rgba(184,148,44,.45);
          padding-top:16px; display:flex; align-items:center; gap:20px; }}
  .qr {{ width:86px; height:86px; background:#FFFFFF; padding:3px;
        border-radius:4px; border:1px solid rgba(184,148,44,.4); flex-shrink:0; }}
  .foot .cta {{ font-family:'Marcellus', 'Times New Roman', serif; color:{GOLD_DEEP};
               font-size:12.5px; letter-spacing:2.2px; line-height:1.45; }}
  .foot .addr {{ font-size:10.5px; line-height:1.5; color:{T_MUTE}; margin-left:auto;
                text-align:right; letter-spacing:.5px; }}
"""
    body = f"""
<div class="poster">
  <div class="bleedbox"><div class="trim">
    <div class="content">
      <div class="goldband"></div>
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
      <div class="goldband-b"></div>
    </div>
  </div></div>
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
    print('GOLD CORPORATE series built')


if __name__ == '__main__':
    main()
