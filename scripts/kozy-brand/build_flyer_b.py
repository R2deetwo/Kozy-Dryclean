#!/usr/bin/env python3
"""Flyer B — Intro/Offer (A5, single-sided, punchy street flyer)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from print_frame import PrintFrame, px, NAVY, GOLD, CREAM

WORK = "/home/z/my-project/work/kozy-brand"
LOGO = "/home/z/my-project/download/kozy-brand/logo"

qr_b64 = open(os.path.join(WORK, "qr-navy.b64")).read()
logo_h = open(os.path.join(LOGO, "kozy-logo-horizontal.svg")).read()
logo_h = logo_h.replace("<svg ", '<svg style="width:200px;display:block" ', 1)
icon = open(os.path.join(LOGO, "kozy-icon.svg")).read()
icon_big = icon.replace("<svg ", '<svg style="height:1000px;display:block" ', 1)

F = PrintFrame(148, 210)

css = f"""
  .content {{ position:absolute; inset:0; padding:{px(10)}px {px(11)}px {px(8)}px;
             display:flex; flex-direction:column; align-items:center;
             font-family:'Outfit', Arial, sans-serif; color:#E7EDF5; }}
  .ghost {{ position:absolute; right:-{px(46)}px; bottom:-{px(60)}px; opacity:.055;
           pointer-events:none; }}
  .deco {{ position:absolute; top:-{px(30)}px; left:-{px(44)}px; opacity:.55; }}
  .logo-row {{ margin-top:{px(4)}; }}
  .kicker {{ font-family:'Marcellus', 'Times New Roman', serif; color:{GOLD};
            font-size:12px; letter-spacing:5.5px; margin-top:{px(8)}; }}
  .pct {{ font-family:'Playfair Display', Georgia, serif; font-weight:800;
         font-size:126px; line-height:1; color:{GOLD}; margin:{px(9)} 0 0;
         letter-spacing:1px; }}
  .pct sup {{ font-size:56px; vertical-align:super; letter-spacing:0; }}
  .what {{ font-family:'Playfair Display', Georgia, serif; font-weight:600;
          font-size:40px; color:#F2F6FB; margin:{px(3)} 0 0; line-height:1.28; }}
  .what em {{ font-style:italic; font-weight:500; color:{GOLD}; }}
  .sub {{ font-weight:300; font-size:16px; line-height:1.55; text-align:center;
         max-width:{px(92)}px; color:#C9D5E6; margin:{px(5)} 0 0; }}
  .props {{ margin-top:{px(7)}; display:flex; flex-wrap:wrap; justify-content:center;
           gap:{px(3)}px {px(6)}px; width:100%; }}
  .prop {{ font-size:13px; letter-spacing:3.2px; color:{GOLD}; white-space:nowrap;
          display:flex; align-items:center; gap:{px(3)}px; }}
  .prop .dot {{ width:3px; height:3px; border-radius:50%; background:{GOLD};
               opacity:.6; }}
  .spacer {{ flex:1; }}
  .quote {{ text-align:center; margin:{px(4)} 0; }}
  .qrule {{ width:{px(34)}px; height:1px; background:{GOLD}; opacity:.5;
           margin:{px(4)} auto; }}
  .qtext {{ font-family:'Playfair Display', Georgia, serif; font-style:italic;
           font-weight:500; font-size:21px; color:#E7EDF5; line-height:1.4; }}
  .cta {{ width:100%; background:{GOLD}; border-radius:6px; text-align:center;
         padding:{px(6)}px {px(6)}px; color:{NAVY}; }}
  .cta .big {{ font-family:'Playfair Display', Georgia, serif; font-weight:800;
              font-size:27px; letter-spacing:1px; }}
  .cta .small {{ font-size:12px; font-weight:600; letter-spacing:2.8px; margin-top:5px; }}
  .foot {{ width:100%; margin-top:{px(5)}; display:flex; align-items:center;
          gap:{px(5)}px; }}
  .qr {{ width:{px(23)}px; height:{px(23)}px; background:#FFFFFF; padding:4px;
        border-radius:4px; flex-shrink:0; }}
  .scan {{ font-family:'Marcellus', 'Times New Roman', serif; color:{GOLD};
          font-size:13.5px; letter-spacing:2.6px; }}
  .contact {{ margin-left:auto; text-align:right; font-size:12px; line-height:1.55;
             color:#C9D5E6; letter-spacing:1.2px; }}
  .contact b {{ color:{GOLD}; font-weight:600; letter-spacing:1.8px; }}
"""

body = f"""
    <div class="content">
      <div class="ghost">{icon_big}</div>
      <svg class="deco" width="300" height="300" viewBox="0 0 300 300" fill="none">
        <circle cx="150" cy="150" r="126" stroke="{GOLD}" stroke-width="0.7" opacity="0.22"/>
        <circle cx="162" cy="158" r="126" stroke="{GOLD}" stroke-width="0.7" opacity="0.12"/>
        <circle cx="60" cy="230" r="4" fill="{GOLD}" opacity="0.45"/>
        <circle cx="84" cy="252" r="2" fill="{GOLD}" opacity="0.28"/>
      </svg>
      <div class="logo-row">{logo_h}</div>
      <div class="kicker">LAGOS · PREMIUM DRY CLEANING</div>
      <div class="pct">15<sup>%</sup> OFF</div>
      <div class="what">your first <em>premium clean</em></div>
      <p class="sub">Dry cleaning, wash &amp; fold, and shoe care — collected at your door
        and returned immaculate.</p>
      <div class="props">
        <span class="prop">FREE PICKUP &amp; DELIVERY<span class="dot"></span></span>
        <span class="prop">48-HOUR TURNAROUND<span class="dot"></span></span>
        <span class="prop">EXPERT GARMENT CARE</span>
      </div>
      <div class="spacer"></div>
      <div class="quote">
        <div class="qrule"></div>
        <div class="qtext">“Uncompromising care.<br>Exceptional convenience.”</div>
        <div class="qrule"></div>
      </div>
      <div class="spacer"></div>
      <div class="cta">
        <div class="big">Book at kozycare.ng</div>
        <div class="small">OR WHATSAPP +234 803 175 5230</div>
      </div>
      <div class="foot">
        <img class="qr" src="data:image/png;base64,{qr_b64}" alt="QR">
        <div class="scan">SCAN · BOOK · RELAX</div>
        <div class="contact"><b>KOZY CARE</b><br>
          No 20, Westsyde Drive, Ogombo, Lagos<br>
          kozygarmentcare@gmail.com</div>
      </div>
    </div>"""

note = "KOZY · FLYER B A5 OFFER · TRIM 148 x 210 MM · BLEED 3 MM · KOZYCARE.NG"
html = F.wrap(body, note, css)
out = os.path.join(WORK, "flyer-b.html")
with open(out, "w") as f:
    f.write(html)
print("✓", out)
html_d = F.wrap(body, note, css, digital=True)
out_d = os.path.join(WORK, "flyer-b-digital.html")
with open(out_d, "w") as f:
    f.write(html_d)
print("✓", out_d)
