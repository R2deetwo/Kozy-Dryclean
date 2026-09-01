#!/usr/bin/env python3
"""Flyer A — Services & Pricing (A5, double-sided). Print frame: trim+bleed+slug+marks."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from print_frame import PrintFrame, px, NAVY, GOLD, CREAM

WORK = "/home/z/my-project/work/kozy-brand"
LOGO = "/home/z/my-project/download/kozy-brand/logo"

qr_b64 = open(os.path.join(WORK, "qr-navy.b64")).read()
logo_h = open(os.path.join(LOGO, "kozy-logo-horizontal.svg")).read()
logo_h = logo_h.replace("<svg ", '<svg style="width:220px;display:block" ', 1)
icon = open(os.path.join(LOGO, "kozy-icon.svg")).read()
icon = icon.replace("<svg ", '<svg style="height:78px;display:block" ', 1)

F = PrintFrame(148, 210)  # A5 trim

# ---------------- FRONT ----------------
front_css = f"""
  .content {{ position:absolute; inset:0; padding:{px(11)}px {px(11)}px {px(10)}px;
             display:flex; flex-direction:column; align-items:center;
             font-family:'Outfit', Arial, sans-serif; color:#E7EDF5; }}
  .deco {{ position:absolute; top:-{px(38)}px; right:-{px(52)}px; opacity:.5; }}
  .logo-row {{ margin-top:{px(6)}; }}
  .kicker {{ font-family:'Marcellus', 'Times New Roman', serif; color:{GOLD};
            font-size:11.5px; letter-spacing:5px; margin-top:{px(9)}; }}
  h1 {{ font-family:'Playfair Display', Georgia, serif; font-weight:700;
       font-size:57px; line-height:1.12; margin:{px(10)} 0 0; text-align:center;
       letter-spacing:.5px; }}
  h1 em {{ font-style:italic; font-weight:500; color:{GOLD}; }}
  .rule {{ width:{px(30)}px; height:1px; background:{GOLD}; opacity:.85; margin:{px(7)} 0 {px(6)}; }}
  .sub {{ font-weight:300; font-size:15.5px; line-height:1.55; text-align:center;
         max-width:{px(96)}px; color:#C9D5E6; margin:0; }}
  .offer {{ margin-top:{px(12)}; background:{GOLD}; color:{NAVY}; width:100%;
           border-radius:6px; padding:{px(6.5)} {px(8)}; text-align:center; }}
  .offer .big {{ font-family:'Playfair Display', Georgia, serif; font-weight:800;
                font-size:24px; letter-spacing:.6px; }}
  .offer .small {{ font-family:'Outfit', Arial, sans-serif; font-weight:500; font-size:12px;
                  letter-spacing:2.6px; margin-top:5px; }}
  .spacer {{ flex:1; }}
  .footer {{ width:100%; border-top:1px solid rgba(212,175,55,.45);
            padding-top:{px(5.5)}; display:flex; justify-content:space-between;
            align-items:center; font-size:12.5px; letter-spacing:1.1px;
            color:#C9D5E6; flex-wrap:wrap; gap:8px; }}
  .footer b {{ color:{GOLD}; font-weight:600; letter-spacing:1.6px; }}
"""
front_body = f"""
    <div class="content">
      <svg class="deco" width="290" height="290" viewBox="0 0 290 290" fill="none">
        <circle cx="150" cy="140" r="118" stroke="{GOLD}" stroke-width="0.7" opacity="0.22"/>
        <circle cx="163" cy="150" r="118" stroke="{GOLD}" stroke-width="0.7" opacity="0.13"/>
        <circle cx="196" cy="96" r="4.5" fill="{GOLD}" opacity="0.5"/>
        <circle cx="214" cy="120" r="2.2" fill="{GOLD}" opacity="0.3"/>
      </svg>
      <div class="logo-row">{logo_h}</div>
      <div class="kicker">LAGOS · PREMIUM DRY CLEANING &amp; LAUNDRY</div>
      <h1>Immaculate clothes.<br><em>Zero effort.</em></h1>
      <div class="rule"></div>
      <p class="sub">Free pickup and delivery across Lagos. Expert dry cleaning,
        wash &amp; fold, and shoe care — back at your door in 48 hours.</p>
      <div class="spacer"></div>
      <div class="offer">
        <div class="big">15% OFF YOUR FIRST ORDER</div>
        <div class="small">BOOK AT KOZYCARE.NG — TAKES 2 MINUTES</div>
      </div>
      <div class="footer">
        <span><b>CALL / WHATSAPP</b>&nbsp; +234 803 175 5230</span>
        <span><b>KOZYCARE.NG</b></span>
      </div>
    </div>"""

# ---------------- BACK ----------------
GROUPS = [
    ("SHIRTS &amp; TOPS", [("Shirt", 500), ("Long-Sleeve Shirt", 600), ("Singlet", 300)]),
    ("TROUSERS", [("Trousers", 700), ("Jeans", 800)]),
    ("SUITS &amp; JACKETS", [("Suit (2-Piece)", 4500), ("Suit (3-Piece)", 5500), ("Blazer", 2500)]),
    ("TRADITIONAL", [("Agbada", 3500), ("Kaftan", 1500), ("Ankara Gown", 1800), ("Iro &amp; Buba", 2000)]),
    ("HOUSEHOLD", [("Bedsheet", 1200), ("Duvet", 2500), ("Curtain (per panel)", 1800)]),
    ("SHOES &amp; CARE", [("Sneakers (White)", 1000), ("Sneakers (Coloured)", 1200),
                          ("Leather Shoes", 1000), ("Suede Shoes", 2000)]),
]
rows = []
for label, items in GROUPS:
    lis = "".join(
        f'<li><span class="nm">{n}</span><span class="dots"></span>'
        f'<span class="pr">₦{p:,}</span></li>'
        for n, p in items)
    rows.append(f'<div class="grp"><div class="gl">{label}</div><ul>{lis}</ul></div>')
price_html = "\n        ".join(rows)

back_css = f"""
  .content {{ position:absolute; inset:0; padding:{px(9)}px {px(11)}px {px(8)}px;
             font-family:'Outfit', Arial, sans-serif; color:#E7EDF5; }}
  .head {{ display:flex; align-items:flex-end; justify-content:space-between; }}
  h2 {{ font-family:'Playfair Display', Georgia, serif; font-weight:700; font-size:31px;
      margin:0; color:#F2F6FB; }}
  h2 em {{ font-style:italic; font-weight:500; color:{GOLD}; }}
  .head .icon {{ opacity:.95; }}
  .pricepanel {{ margin-top:{px(6)}; background:{CREAM}; border-radius:10px;
                padding:{px(7)}px {px(9)}px; color:{NAVY}; }}
  .cols {{ column-count:2; column-gap:{px(10)}px; }}
  .grp {{ break-inside:avoid; margin-bottom:{px(4.5)}px; }}
  .gl {{ font-family:'Marcellus', 'Times New Roman', serif; font-size:12px;
        letter-spacing:2.6px; color:{NAVY}; border-bottom:1px solid {GOLD};
        padding-bottom:3px; margin-bottom:6px; }}
  ul {{ list-style:none; margin:0; padding:0; }}
  li {{ display:flex; align-items:baseline; font-size:13.5px; line-height:1.62;
       font-weight:400; }}
  .nm {{ white-space:nowrap; }}
  .dots {{ flex:1; border-bottom:1px dotted #B8AE9A; margin:0 6px;
          transform:translateY(-3px); min-width:14px; }}
  .pr {{ font-weight:600; white-space:nowrap; }}
  .note {{ margin-top:{px(3.4)}; font-size:11.5px; color:#9FB0C6;
          letter-spacing:1.4px; text-align:center; }}
  .steps {{ margin-top:{px(5.5)}; display:flex; flex-wrap:wrap; gap:{px(4)}px;
           justify-content:space-between; }}
  .step {{ flex:1 1 auto; min-width:{px(30)}px; max-width:100%; text-align:center; }}
  .step .no {{ font-family:'Marcellus', 'Times New Roman', serif; font-size:25px;
              color:{GOLD}; letter-spacing:2px; }}
  .step .lb {{ font-size:11.5px; letter-spacing:1.8px; color:#C9D5E6;
              margin-top:3px; line-height:1.4; }}
  .step .sep {{ color:rgba(212,175,55,.4); }}
  .foot {{ margin-top:{px(5)}; border-top:1px solid rgba(212,175,55,.45);
          padding-top:{px(4.5)}; display:flex; align-items:center; gap:{px(6)}px; }}
  .qr {{ width:{px(24)}px; height:{px(24)}px; background:#FFFFFF; padding:3px;
        border-radius:4px; flex-shrink:0; }}
  .foot .cta {{ font-family:'Marcellus', 'Times New Roman', serif; color:{GOLD};
               font-size:13px; letter-spacing:2.2px; line-height:1.45; }}
  .foot .addr {{ font-size:10.5px; line-height:1.5; color:#9FB0C6; margin-left:auto;
                text-align:right; letter-spacing:.5px; }}
"""
back_body = f"""
    <div class="content">
      <div class="head">
        <h2>Straightforward <em>pricing.</em></h2>
        <div class="icon">{icon}</div>
      </div>
      <div class="pricepanel">
        <div class="cols">
        {price_html}
        </div>
      </div>
      <div class="note">WASH &amp; FOLD FROM ₦800/KG · BULK &amp; BUSINESS PLANS AVAILABLE · FULL MENU AT KOZYCARE.NG</div>
      <div class="steps">
        <div class="step"><div class="no">01</div><div class="lb">BOOK A PICKUP</div></div>
        <div class="step"><div class="no">02</div><div class="lb">WE COLLECT &amp; CLEAN</div></div>
        <div class="step"><div class="no">03</div><div class="lb">DELIVERED IN 48H</div></div>
      </div>
      <div class="foot">
        <img class="qr" src="data:image/png;base64,{qr_b64}" alt="QR">
        <div class="cta">SCAN TO BOOK<br>INSTANTLY</div>
        <div class="addr">Kozy Care Drycleaning &amp; Laundry Services<br>
          No 20, Westsyde Drive, Ogombo, Lagos<br>
          kozygarmentcare@gmail.com · +234 803 175 5230</div>
      </div>
    </div>"""

for side, css, body in [("front", front_css, front_body), ("back", back_css, back_body)]:
    note = f"KOZY · FLYER A5 {side.upper()} · TRIM 148 x 210 MM · BLEED 3 MM · KOZYCARE.NG"
    html = F.wrap(body, note, css)
    out = os.path.join(WORK, f"flyer-a-{side}.html")
    with open(out, "w") as f:
        f.write(html)
    print("✓", out)
    html_d = F.wrap(body, note, css, digital=True)
    out_d = os.path.join(WORK, f"flyer-a-{side}-digital.html")
    with open(out_d, "w") as f:
        f.write(html_d)
    print("✓", out_d)
print(f"page: {F.pw}x{F.ph}mm = {F.W}x{F.H}px | trim inset {F.trim_in}px | bleed inset {F.bleed_in}px")
