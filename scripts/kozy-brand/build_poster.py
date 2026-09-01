#!/usr/bin/env python3
"""Poster A3 — 'Three steps. Zero fuss.' brand poster."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from print_frame import PrintFrame, px, NAVY, GOLD, CREAM

WORK = "/home/z/my-project/work/kozy-brand"
LOGO = "/home/z/my-project/download/kozy-brand/logo"

qr_b64 = open(os.path.join(WORK, "qr-navy.b64")).read()
logo_h = open(os.path.join(LOGO, "kozy-logo-horizontal.svg")).read()
logo_h = logo_h.replace("<svg ", '<svg style="width:400px;display:block" ', 1)
icon = open(os.path.join(LOGO, "kozy-icon.svg")).read()
icon_big = icon.replace("<svg ", '<svg style="height:1700px;display:block" ', 1)

F = PrintFrame(297, 420)  # A3

STEPS = [
    ("01", "BOOK A PICKUP",
     "Choose a time that suits you — our rider comes straight to your door."),
    ("02", "WE COLLECT &amp; CLEAN",
     "Expert dry cleaning, wash &amp; fold, and shoe care for every garment."),
    ("03", "DELIVERED IN 48H",
     "Fresh, pressed, and returned in protective garment bags."),
]
steps_html = "\n        ".join(
    f'<div class="step"><div class="no">{no}</div><div class="lb">{lb}</div>'
    f'<p class="tx">{tx}</p></div>'
    for no, lb, tx in STEPS)

css = f"""
  .content {{ position:absolute; inset:0; padding:{px(18)}px {px(22)}px {px(16)}px;
             display:flex; flex-direction:column; align-items:center;
             font-family:'Outfit', Arial, sans-serif; color:#E7EDF5; }}
  .ghost {{ position:absolute; right:-{px(90)}px; top:{px(120)}px; opacity:.05;
           pointer-events:none; }}
  .deco {{ position:absolute; bottom:{px(150)}px; left:-{px(80)}px; opacity:.5; }}
  .logo-row {{ margin-top:{px(8)}; }}
  .kicker {{ font-family:'Marcellus', 'Times New Roman', serif; color:{GOLD};
            font-size:19px; letter-spacing:9px; margin-top:{px(14)}; }}
  h1 {{ font-family:'Playfair Display', Georgia, serif; font-weight:700;
       font-size:104px; line-height:1.06; margin:{px(12)} 0 0; text-align:center;
       color:#F2F6FB; }}
  h1 em {{ font-style:italic; font-weight:500; color:{GOLD}; }}
  .sub {{ font-weight:300; font-size:24px; line-height:1.5; text-align:center;
         max-width:{px(170)}px; color:#C9D5E6; margin:{px(8)} 0 0; }}
  .steps {{ margin-top:{px(16)}; display:flex; flex-wrap:wrap; gap:{px(8)}px;
           width:100%; }}
  .step {{ flex:1 1 0; min-width:{px(70)}px; text-align:center; position:relative; }}
  .step + .step::before {{ content:''; position:absolute; left:-{px(4)}px; top:12%;
                          height:76%; width:1px; background:rgba(212,175,55,.28); }}
  .no {{ font-family:'Marcellus', 'Times New Roman', serif; font-size:66px;
        color:{GOLD}; line-height:1; }}
  .lb {{ font-size:20px; font-weight:600; letter-spacing:3.4px; color:#F2F6FB;
        margin-top:{px(4)}; }}
  .tx {{ font-size:18px; font-weight:300; line-height:1.55; color:#C9D5E6;
        max-width:{px(78)}px; margin:{px(3)} auto 0; min-height:92px; }}
  .spacer {{ flex:1; }}
  .offer {{ width:100%; background:{GOLD}; border-radius:8px; text-align:center;
           padding:{px(8)}px {px(8)}px; color:{NAVY}; }}
  .offer .big {{ font-family:'Playfair Display', Georgia, serif; font-weight:800;
                font-size:44px; letter-spacing:1px; }}
  .offer .small {{ font-size:19px; font-weight:600; letter-spacing:4.5px; margin-top:8px; }}
  .foot {{ width:100%; margin-top:{px(9)}; border-top:1px solid rgba(212,175,55,.45);
          padding-top:{px(7)}; display:flex; align-items:center; gap:{px(8)}px; }}
  .qr {{ width:{px(34)}px; height:{px(34)}px; background:#FFFFFF; padding:4px;
        border-radius:5px; flex-shrink:0; }}
  .scan {{ font-family:'Marcellus', 'Times New Roman', serif; color:{GOLD};
          font-size:22px; letter-spacing:4px; line-height:1.4; }}
  .contact {{ margin-left:auto; text-align:right; font-size:19px; line-height:1.6;
             color:#C9D5E6; letter-spacing:1.6px; }}
  .contact b {{ color:{GOLD}; font-weight:600; letter-spacing:2.4px; }}
"""

body = f"""
    <div class="content">
      <div class="ghost">{icon_big}</div>
      <svg class="deco" width="520" height="520" viewBox="0 0 520 520" fill="none">
        <circle cx="260" cy="260" r="220" stroke="{GOLD}" stroke-width="0.8" opacity="0.2"/>
        <circle cx="280" cy="274" r="220" stroke="{GOLD}" stroke-width="0.8" opacity="0.11"/>
        <circle cx="120" cy="420" r="7" fill="{GOLD}" opacity="0.4"/>
        <circle cx="156" cy="452" r="3.5" fill="{GOLD}" opacity="0.25"/>
      </svg>
      <div class="logo-row">{logo_h}</div>
      <div class="kicker">PREMIUM DRY CLEANING &amp; LAUNDRY · LAGOS</div>
      <h1>Three steps.<br><em>Zero fuss.</em></h1>
      <p class="sub">Lagos, your wardrobe deserves better. We collect, we clean,
        we deliver — you simply look sharp.</p>
      <div class="steps">
        {steps_html}
      </div>
      <div class="spacer"></div>
      <div class="offer">
        <div class="big">15% OFF your first order</div>
        <div class="small">BOOK AT KOZYCARE.NG — TAKES 2 MINUTES</div>
      </div>
      <div class="foot">
        <img class="qr" src="data:image/png;base64,{qr_b64}" alt="QR">
        <div class="scan">SCAN · BOOK<br>· RELAX ·</div>
        <div class="contact"><b>CALL / WHATSAPP</b> +234 803 175 5230<br>
          <b>KOZYCARE.NG</b> · kozygarmentcare@gmail.com<br>
          No 20, Westsyde Drive, Ogombo, Lagos</div>
      </div>
    </div>"""

note = "KOZY · POSTER A3 · TRIM 297 x 420 MM · BLEED 3 MM · KOZYCARE.NG"
html = F.wrap(body, note, css)
out = os.path.join(WORK, "poster-a3.html")
with open(out, "w") as f:
    f.write(html)
print("✓", out)
html_d = F.wrap(body, note, css, digital=True)
out_d = os.path.join(WORK, "poster-a3-digital.html")
with open(out_d, "w") as f:
    f.write(html_d)
print("✓", out_d)
print(f"page: {F.pw}x{F.ph}mm = {F.W}x{F.H}px")
