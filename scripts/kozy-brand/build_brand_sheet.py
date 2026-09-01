#!/usr/bin/env python3
"""Brand sheet A4 — logo variants, clearspace, colour, typography, rules."""
import os

WORK = "/home/z/my-project/work/kozy-brand"
LOGO = "/home/z/my-project/download/kozy-brand/logo"

NAVY, GOLD, CREAM = "#0A192F", "#D4AF37", "#F5F1E8"

def rd(name):
    return open(os.path.join(LOGO, name)).read()

def sized(name, h, extra=""):
    return rd(name).replace("<svg ", f'<svg style="height:{h}px;display:block;{extra}" ', 1)

def sized_w(name, w, extra=""):
    return rd(name).replace("<svg ", f'<svg style="width:{w}px;display:block;{extra}" ', 1)

primary_n = sized_w("kozy-logo-primary-navy.svg", 196)
horiz_n = sized_w("kozy-logo-horizontal-navy.svg", 186)
icon_n = sized("kozy-icon-navy.svg", 72)
icon_gold = sized("kozy-icon.svg", 72)
header_logo = sized_w("kozy-logo-horizontal-navy.svg", 170)

# A4 @ 96dpi = 794 x 1123px
css = f"""
  body {{ margin:0; background:{CREAM}; }}
  .poster {{ width:794px; height:1123px; background:{CREAM}; position:relative;
           font-family:'Outfit', Arial, sans-serif; color:{NAVY};
           padding:30px 52px 26px; display:flex; flex-direction:column; }}
  .hd {{ display:flex; justify-content:space-between; align-items:center;
        padding-bottom:11px; border-bottom:2px solid {NAVY}; }}
  .hd .rt {{ text-align:right; }}
  .hd .t1 {{ font-family:'Marcellus', 'Times New Roman', serif; font-size:17px;
            letter-spacing:5px; }}
  .hd .t2 {{ font-size:11px; color:#5A6B80; letter-spacing:2.5px; margin-top:4px; }}
  .sec {{ margin-top:8px; }}
  .sn {{ font-family:'Marcellus', 'Times New Roman', serif; font-size:13px;
        letter-spacing:3.5px; color:{NAVY}; display:flex; align-items:center;
        gap:12px; margin-bottom:10px; }}
  .sn::after {{ content:''; flex:1; height:1px; background:rgba(10,25,47,.18); }}
  .sn b {{ color:{GOLD}; font-weight:400; }}
  .variants {{ display:flex; gap:18px; align-items:stretch; }}
  .vcard {{ flex:1; background:#FFFFFF; border:1px solid rgba(10,25,47,.10);
           border-radius:10px; padding:14px 16px; text-align:center; }}
  .vcard .lbl {{ font-size:10.5px; letter-spacing:2.6px; color:#5A6B80; margin-top:10px; }}
  .vcard .use {{ font-size:10px; color:#8A97A8; margin-top:3px; letter-spacing:.6px; }}
  .chip {{ display:flex; align-items:center; justify-content:center; height:84px; }}
  .chip.navy {{ background:{NAVY}; border-radius:8px; }}
  .duo {{ display:flex; gap:18px; }}
  .clearbox {{ flex:1.1; background:#FFFFFF; border:1px solid rgba(10,25,47,.10);
              border-radius:10px; padding:12px; display:flex; gap:18px;
              align-items:center; }}
  .cs-wrap {{ position:relative; padding:15px; }}
  .cs-dashed {{ position:absolute; inset:8px; border:1px dashed {GOLD}; }}
  .cs-note {{ font-size:10.5px; color:#5A6B80; line-height:1.65; letter-spacing:.4px; }}
  .cs-note b {{ color:{NAVY}; }}
  .swatches {{ display:flex; gap:18px; }}
  .sw {{ flex:1; border-radius:10px; overflow:hidden; border:1px solid rgba(10,25,47,.10);
        background:#FFFFFF; }}
  .sw .col {{ height:52px; }}
  .sw .meta {{ padding:10px 14px; }}
  .sw .nm {{ font-family:'Marcellus', 'Times New Roman', serif; font-size:13px;
            letter-spacing:2px; }}
  .sw .cd {{ font-size:10px; color:#5A6B80; margin-top:4px; line-height:1.5;
            letter-spacing:.5px; }}
  .type {{ display:flex; flex-direction:column; gap:10px; }}
  .trow {{ display:flex; align-items:baseline; gap:22px; background:#FFFFFF;
          border:1px solid rgba(10,25,47,.10); border-radius:10px; padding:6px 20px; }}
  .trow .aa {{ font-size:26px; width:104px; }}
  .trow .fi {{ font-family:'Playfair Display', Georgia, serif; font-weight:700; }}
  .trow .fm {{ font-family:'Marcellus', 'Times New Roman', serif; letter-spacing:4px; }}
  .trow .fo {{ font-family:'Outfit', Arial, sans-serif; font-weight:300; }}
  .trow .tn {{ font-size:10.5px; color:#5A6B80; letter-spacing:1.8px; }}
  .trow .tv {{ margin-left:auto; text-align:right; font-size:10px; color:#8A97A8;
              letter-spacing:.4px; line-height:1.5; }}
  .rules {{ display:flex; gap:18px; }}
  .rcol {{ flex:1; background:#FFFFFF; border:1px solid rgba(10,25,47,.10);
          border-radius:10px; padding:12px 16px; }}
  .rcol h4 {{ margin:0 0 8px; font-family:'Marcellus', 'Times New Roman', serif;
             font-size:12px; letter-spacing:2.6px; }}
  .rcol.do h4 {{ color:#1E6B4F; }}
  .rcol.dont h4 {{ color:#9C2F2F; }}
  .rcol ul {{ margin:0; padding-left:16px; font-size:10.5px; line-height:1.62;
             color:#3A4A5E; }}
  .ft {{ margin-top:auto; padding-top:12px; border-top:1px solid rgba(10,25,47,.18);
        display:flex; justify-content:space-between; font-size:10px;
        letter-spacing:1.6px; color:#5A6B80; }}
"""

body = f"""
<div class="poster">
  <div class="hd">
    {header_logo}
    <div class="rt"><div class="t1">BRAND GUIDELINES</div>
      <div class="t2">KOZY CARE · PREMIUM DRY CLEANING · 2026</div></div>
  </div>

  <div class="sec">
    <div class="sn"><b>01</b> THE LOGO — THREE LOCKUPS</div>
    <div class="variants">
      <div class="vcard"><div class="chip">{primary_n}</div>
        <div class="lbl">PRIMARY · [K]OZY WORDMARK</div>
        <div class="use">Covers, posters, signage, bags</div></div>
      <div class="vcard"><div class="chip">{horiz_n}</div>
        <div class="lbl">COMPACT</div>
        <div class="use">Flyers, headers, navbar, documents</div></div>
      <div class="vcard"><div class="chip navy">{icon_gold}</div>
        <div class="lbl">MONOGRAM</div>
        <div class="use">Avatars, favicons, embroidery,<br>corner anchor &amp; watermark</div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sn"><b>02</b> CLEARSPACE &amp; MINIMUM SIZE</div>
    <div class="duo">
      <div class="clearbox">
        <div class="cs-wrap"><div class="cs-dashed"></div>{icon_n}</div>
        <div class="cs-note">
          Keep a clear margin of <b>X</b> on all sides, where <b>X = the diameter
          of the hanger-wire ball terminal</b>.<br><br>
          Minimum size — print: <b>12&nbsp;mm</b> monogram height · screen:
          <b>32&nbsp;px</b>. Below 48&nbsp;px use the plain-K favicon variant.
        </div>
      </div>
    </div>
  </div>

  <div class="sec">
    <div class="sn"><b>03</b> COLOUR</div>
    <div class="swatches">
      <div class="sw"><div class="col" style="background:{NAVY}"></div>
        <div class="meta"><div class="nm">KOZY NAVY</div>
        <div class="cd">HEX #0A192F · RGB 10 25 47<br>Print build C100 M78 Y32 K40<br>Dominant surfaces &amp; backgrounds</div></div></div>
      <div class="sw"><div class="col" style="background:{GOLD}"></div>
        <div class="meta"><div class="nm">KOZY GOLD</div>
        <div class="cd">HEX #D4AF37 · RGB 212 175 55<br>Print C0 M17 Y74 K17 · Spot: Pantone 871 C<br>Accents, hairlines &amp; CTAs only (max ~10% area)</div></div></div>
      <div class="sw"><div class="col" style="background:{CREAM}; border-bottom:1px solid rgba(10,25,47,.08)"></div>
        <div class="meta"><div class="nm">KOZY CREAM</div>
        <div class="cd">HEX #F5F1E8 · RGB 245 241 232<br>Print C0 M2 Y5 K4<br>Light panels &amp; price lists on navy</div></div></div>
    </div>
  </div>

  <div class="sec">
    <div class="sn"><b>04</b> TYPOGRAPHY</div>
    <div class="type">
      <div class="trow"><span class="aa fi">Aa</span>
        <span class="tn">HEADLINES — PLAYFAIR DISPLAY 600–800</span>
        <span class="tv">Luxury Didone serif.<br>Pairs with italic for emphasis.</span></div>
      <div class="trow"><span class="aa fm">Aa</span>
        <span class="tn">LABELS &amp; KICKERS — MARCELLUS, TRACKED +300</span>
        <span class="tv">Trajan-style Roman caps.<br>Always letterspaced.</span></div>
      <div class="trow"><span class="aa fo">Aa</span>
        <span class="tn">BODY &amp; PRICES — OUTFIT 300–600</span>
        <span class="tv">Clean geometric sans.<br>Digits align in price tables.</span></div>
    </div>
  </div>

  <div class="sec">
    <div class="sn"><b>05</b> RULES</div>
    <div class="rules">
      <div class="rcol do"><h4>DO</h4><ul>
        <li>Use gold on navy, or navy on cream/white</li>
        <li>Keep the clearspace margin around every lockup</li>
        <li>Use supplied vector files (SVG / PDF) for print</li>
        <li>Set descriptors in tracked caps, never lowercase</li></ul></div>
      <div class="rcol dont"><h4>DON'T</h4><ul>
        <li>Don't stretch, rotate, skew or re-colour the mark</li>
        <li>Don't add shadows, gradients or outlines to the logo</li>
        <li>Don't set gold text on white — use navy instead</li>
        <li>Don't recreate the wordmark in another typeface</li></ul></div>
    </div>
  </div>

  <div class="ft">
    <span>V1.1 · KOZYCARE.NG · KOZYGARMENTCARE@GMAIL.COM · +234 803 175 5230</span>
    <span>NO 20, WESTSYDE DRIVE, OGOMBO, LAGOS</span>
  </div>
</div>"""

html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;0,800;1,500&family=Marcellus&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  html, body {{ margin:0; padding:0; background:{CREAM}; }}
  * {{ box-sizing:border-box; }}{css}
</style></head><body>{body}</body></html>"""

out = os.path.join(WORK, "brand-sheet.html")
with open(out, "w") as f:
    f.write(html)
print("✓", out)
