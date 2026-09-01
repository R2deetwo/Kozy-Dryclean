#!/usr/bin/env python3
"""Kozy brand kit v5 (Phase 14) — client-directed offer + visual updates:

  1. General first-order discount on every piece: 15% -> 10% (the client
     kept 5% for picture uploads, so 10 + 5 replaces the old 15).
  2. NEW hotel-guest offer everywhere: 15% off first order + the 5% picture
     discount, redeemed with code HOTEL15 (the offer is live on the site).
  3. Flyer B: the model returns (client liked her) — now holding a navy KOZY
     garment bag with gold logo instead of the ribbon-tied bundle that read
     as a Christmas present. Model sits in her gold arch frame beside the
     brand quote; the giant percentage is re-set to 10%.
Applies to: flyer A front, flyer B (print + digital), poster A3 (print + digital).
"""
import base64
import re
from pathlib import Path

W = Path('/home/z/my-project/work/kozy-brand')

def load(p):  return (W / p).read_text()
def save(p, s): (W / p).write_text(s)

def b64(p):
    return base64.b64encode((W / p).read_bytes()).decode()

MODEL_B64 = b64('model-crop.png')

# ---------------------------------------------------------------------------
# 1. FLYER A FRONT — 10% offer + hotel-guest line in the gold band
# ---------------------------------------------------------------------------
fa = load('flyer-a-front.html')

old_offer = """      <div class="offer">
        <div class="big">15% OFF YOUR FIRST ORDER</div>
        <div class="small">BOOK AT KOZYCARE.NG — TAKES 2 MINUTES</div>
      </div>"""
new_offer = """      <div class="offer">
        <div class="big">10% OFF YOUR FIRST ORDER</div>
        <div class="hotel">HOTEL GUESTS: 15% OFF + 5% WITH CODE HOTEL15</div>
        <div class="small">BOOK AT KOZYCARE.NG — TAKES 2 MINUTES</div>
      </div>"""
assert old_offer in fa, 'flyer A offer block not found'
fa = fa.replace(old_offer, new_offer)

# CSS for the hotel line inside the gold band (navy text, sits between lines)
fa = fa.replace(
    "  .offer .small { font-family:'Outfit', Arial, sans-serif; font-weight:500; font-size:12px;\n                  letter-spacing:2.6px; margin-top:5px; }",
    "  .offer .small { font-family:'Outfit', Arial, sans-serif; font-weight:500; font-size:12px;\n                  letter-spacing:2.6px; margin-top:5px; }\n"
    "  .offer .hotel { font-family:'Outfit', Arial, sans-serif; font-weight:700; font-size:11.5px;\n"
    "                  letter-spacing:1.6px; margin-top:7px; color:#0A192F; opacity:.85; }")
save('flyer-a-front.html', fa)
print('✓ flyer-a-front.html — 10% + HOTEL15 line')

# Same content lives in the digital variant
fad = load('flyer-a-front-digital.html')
if '15% OFF YOUR FIRST ORDER' in fad:
    fad = fad.replace(old_offer, new_offer)
    fad = fad.replace(
        "  .offer .small { font-family:'Outfit', Arial, sans-serif; font-weight:500; font-size:12px;\n                  letter-spacing:2.6px; margin-top:5px; }",
        "  .offer .small { font-family:'Outfit', Arial, sans-serif; font-weight:500; font-size:12px;\n                  letter-spacing:2.6px; margin-top:5px; }\n"
        "  .offer .hotel { font-family:'Outfit', Arial, sans-serif; font-weight:700; font-size:11.5px;\n"
        "                  letter-spacing:1.6px; margin-top:7px; color:#0A192F; opacity:.85; }")
    save('flyer-a-front-digital.html', fad)
    print('✓ flyer-a-front-digital.html — 10% + HOTEL15 line')

# ---------------------------------------------------------------------------
# 2. POSTER A3 — 10% offer + hotel-guest line
# ---------------------------------------------------------------------------
po = load('poster-a3.html')
old_po = """      <div class="offer">
        <div class="big">15% OFF your first order</div>
        <div class="small">BOOK AT KOZYCARE.NG — TAKES 2 MINUTES</div>
      </div>"""
new_po = """      <div class="offer">
        <div class="big">10% OFF your first order</div>
        <div class="hotel">HOTEL GUESTS: 15% OFF + 5% WITH CODE HOTEL15</div>
        <div class="small">BOOK AT KOZYCARE.NG — TAKES 2 MINUTES</div>
      </div>"""
assert old_po in po, 'poster offer block not found'
po = po.replace(old_po, new_po)
# Poster styles its offer block similarly — find its .offer .small rule and add .hotel
po = re.sub(r"(\.offer \.small \{[^}]*\})",
            r"\1\n  .offer .hotel { font-family:'Outfit', Arial, sans-serif; font-weight:700; font-size:20px;\n                  letter-spacing:2.4px; margin-top:10px; color:#0A192F; opacity:.85; }",
            po, count=1)
save('poster-a3.html', po)
print('✓ poster-a3.html — 10% + HOTEL15 line')

pod = load('poster-a3-digital.html')
if '15% OFF your first order' in pod:
    pod = pod.replace(old_po, new_po)
    pod = re.sub(r"(\.offer \.small \{[^}]*\})",
                 r"\1\n  .offer .hotel { font-family:'Outfit', Arial, sans-serif; font-weight:700; font-size:20px;\n                  letter-spacing:2.4px; margin-top:10px; color:#0A192F; opacity:.85; }",
                 pod, count=1)
    save('poster-a3-digital.html', pod)
    print('✓ poster-a3-digital.html — 10% + HOTEL15 line')

# ---------------------------------------------------------------------------
# 3. FLYER B — the model returns (KOZY garment bag) + 10% + HOTEL15 strip
# ---------------------------------------------------------------------------
fb = load('flyer-b.html')

# 3a. Giant percentage: 15 -> 10
fb = fb.replace('<div class="pct">15<sup>%</sup> OFF</div>',
                '<div class="pct">10<sup>%</sup> OFF</div>')
assert '10<sup>%</sup> OFF' in fb

# 3b. Swap the standalone quote block for a model + quote row, and add the
#     hotel strip between the quote row and the CTA.
old_quote = """      <div class="spacer"></div>
      <div class="quote">
        <div class="qrule"></div>
        <div class="qtext">“Uncompromising care.<br>Exceptional convenience.”</div>
        <div class="qrule"></div>
      </div>
      <div class="spacer"></div>"""
new_quote = """      <div class="spacer"></div>
      <div class="duo">
        <div class="model"><img src="data:image/png;base64,__MODEL__" alt="Kozy customer holding her KOZY CARE garment bag"></div>
        <div class="quote">
          <div class="qrule"></div>
          <div class="qtext">“Uncompromising care.<br>Exceptional convenience.”</div>
          <div class="qrule"></div>
          <div class="qsub">Collected at your door, returned immaculate —<br>in our signature sealed garment bag.</div>
        </div>
      </div>
      <div class="spacer"></div>"""
assert old_quote in fb, 'flyer B quote block not found'
fb = fb.replace(old_quote, new_quote.replace('__MODEL__', MODEL_B64))

# 3c. Hotel-guest offer strip right above the CTA
old_cta = """      <div class="cta">
        <div class="big">Book at kozycare.ng</div>"""
new_cta = """      <div class="hotel-strip">
        <span class="hs-big">HOTEL GUESTS: 15% OFF</span>
        <span class="hs-small">your first order + 5% with pictures — use code <b>HOTEL15</b> at checkout</span>
      </div>
      <div class="cta">
        <div class="big">Book at kozycare.ng</div>"""
assert old_cta in fb
fb = fb.replace(old_cta, new_cta, 1)

# 3d. Slightly smaller giant percentage + tightened rhythm so the model fits
fb = fb.replace(
    ".pct { font-family:'Playfair Display', Georgia, serif; font-weight:800;\n"
    "         font-size:126px; line-height:1; color:#D4AF37; margin:34.02 0 0;\n"
    "         letter-spacing:1px; }",
    ".pct { font-family:'Playfair Display', Georgia, serif; font-weight:800;\n"
    "         font-size:96px; line-height:1; color:#D4AF37; margin:26px 0 0;\n"
    "         letter-spacing:1px; }")
fb = fb.replace(".pct sup { font-size:56px; vertical-align:super; letter-spacing:0; }",
                ".pct sup { font-size:44px; vertical-align:super; letter-spacing:0; }")
fb = fb.replace(".what { font-family:'Playfair Display', Georgia, serif; font-weight:600;\n"
                "          font-size:40px; color:#F2F6FB; margin:11.34 0 0; line-height:1.28; }",
                ".what { font-family:'Playfair Display', Georgia, serif; font-weight:600;\n"
                "          font-size:33px; color:#F2F6FB; margin:10px 0 0; line-height:1.25; }")
fb = fb.replace(".sub { font-weight:300; font-size:16px; line-height:1.55; text-align:center;\n"
                "         max-width:347.72px; color:#C9D5E6; margin:18.9 0 0; }",
                ".sub { font-weight:300; font-size:15px; line-height:1.5; text-align:center;\n"
                "         max-width:330px; color:#C9D5E6; margin:14px 0 0; }")
fb = fb.replace(".props { margin-top:26.46;", ".props { margin-top:18px;")

# 3e. CSS for the model row, hotel strip and quote tweaks
extra_css = """
  .duo { display:flex; align-items:center; gap:24px; width:100%; margin-top:6px; }
  .model { flex:0 0 168px; width:168px; border-radius:84px 84px 6px 6px; overflow:hidden;
           border:1.5px solid rgba(212,175,55,.55); }
  .model img { width:100%; height:auto; display:block; }
  .quote { flex:1; text-align:left; margin:0; }
  .quote .qrule { margin:12px 0; width:96px; }
  .qtext { font-size:19px; line-height:1.45; }
  .qsub { font-size:11.5px; line-height:1.55; color:#C9D5E6; letter-spacing:.6px;
          margin-top:10px; font-weight:300; }
  .hotel-strip { width:100%; margin-top:16px; border:1.2px solid rgba(212,175,55,.55);
                 border-radius:6px; padding:12px 16px; text-align:center; }
  .hs-big { display:block; font-family:'Playfair Display', Georgia, serif; font-weight:800;
            font-size:17px; color:#D4AF37; letter-spacing:.8px; }
  .hs-small { display:block; font-size:10.5px; color:#C9D5E6; letter-spacing:1.1px;
              margin-top:4px; font-weight:300; }
  .hs-small b { color:#D4AF37; font-weight:700; letter-spacing:1.4px; }
"""
fb = fb.replace("  .fineprint { font-size:8px;", extra_css + "\n  .fineprint { font-size:8px;")
save('flyer-b.html', fb)
print('✓ flyer-b.html — model w/ KOZY garment bag, 10%, HOTEL15 strip')

# ---------------------------------------------------------------------------
# 4. FLYER B DIGITAL — mirror the same changes on the digital variant
# ---------------------------------------------------------------------------
fbd = load('flyer-b-digital.html')
fbd = fbd.replace('<div class="pct">15<sup>%</sup> OFF</div>',
                  '<div class="pct">10<sup>%</sup> OFF</div>')
if old_quote in fbd:
    fbd = fbd.replace(old_quote, new_quote.replace('__MODEL__', MODEL_B64))
if old_cta in fbd:
    fbd = fbd.replace(old_cta, new_cta, 1)
fbd = fbd.replace(
    ".pct { font-family:'Playfair Display', Georgia, serif; font-weight:800;\n"
    "         font-size:126px; line-height:1; color:#D4AF37; margin:34.02 0 0;\n"
    "         letter-spacing:1px; }",
    ".pct { font-family:'Playfair Display', Georgia, serif; font-weight:800;\n"
    "         font-size:96px; line-height:1; color:#D4AF37; margin:26px 0 0;\n"
    "         letter-spacing:1px; }")
fbd = fbd.replace(".pct sup { font-size:56px; vertical-align:super; letter-spacing:0; }",
                  ".pct sup { font-size:44px; vertical-align:super; letter-spacing:0; }")
fbd = fbd.replace(".what { font-family:'Playfair Display', Georgia, serif; font-weight:600;\n"
                  "          font-size:40px; color:#F2F6FB; margin:11.34 0 0; line-height:1.28; }",
                  ".what { font-family:'Playfair Display', Georgia, serif; font-weight:600;\n"
                  "          font-size:33px; color:#F2F6FB; margin:10px 0 0; line-height:1.25; }")
fbd = fbd.replace(".sub { font-weight:300; font-size:16px; line-height:1.55; text-align:center;\n"
                  "         max-width:347.72px; color:#C9D5E6; margin:18.9 0 0; }",
                  ".sub { font-weight:300; font-size:15px; line-height:1.5; text-align:center;\n"
                  "         max-width:330px; color:#C9D5E6; margin:14px 0 0; }")
fbd = fbd.replace(".props { margin-top:26.46;", ".props { margin-top:18px;")
fbd = fbd.replace("  .fineprint { font-size:8px;", extra_css + "\n  .fineprint { font-size:8px;")
save('flyer-b-digital.html', fbd)
print('✓ flyer-b-digital.html — same treatment')
print('\nAll v5 content edits applied.')
