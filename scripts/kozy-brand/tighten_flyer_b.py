#!/usr/bin/env python3
"""Tighten flyer B v5 layout so ALL content (model row, hotel strip, CTA,
QR + contact, fine print) fits inside the fixed A5 trim frame.
Run after build_v5.py."""
from pathlib import Path

W = Path('/home/z/my-project/work/kozy-brand')

def fix(fname):
    s = (W / fname).read_text()

    # Model frame: fixed height, top-anchored crop (keeps the gold arch + face,
    # crops the dress at the waist like a standard portrait)
    s = s.replace(
        "  .model { flex:0 0 168px; width:168px; border-radius:84px 84px 6px 6px; overflow:hidden;\n"
        "           border:1.5px solid rgba(212,175,55,.55); }",
        "  .model { flex:0 0 160px; width:160px; height:200px; border-radius:80px 80px 6px 6px;\n"
        "           overflow:hidden; border:1.5px solid rgba(212,175,55,.55); }\n"
        "  .model img { width:100%; height:100%; object-fit:cover; object-position:top center; display:block; }")
    s = s.replace("  .model img { width:100%; height:auto; display:block; }\n", "")

    # Content padding: a touch tighter top/bottom
    s = s.replace(".content { position:absolute; inset:0; padding:41.57px 41.57px 37.8px;",
                  ".content { position:absolute; inset:0; padding:32px 41.57px 26px;")

    # Rhythm: headline block
    s = s.replace("font-size:96px; line-height:1; color:#D4AF37; margin:26px 0 0;",
                  "font-size:84px; line-height:1; color:#D4AF37; margin:20px 0 0;")
    s = s.replace(".pct sup { font-size:44px;", ".pct sup { font-size:40px;")
    s = s.replace("font-size:33px; color:#F2F6FB; margin:10px 0 0; line-height:1.25; }",
                  "font-size:29px; color:#F2F6FB; margin:8px 0 0; line-height:1.25; }")
    s = s.replace("max-width:330px; color:#C9D5E6; margin:14px 0 0; }",
                  "max-width:330px; color:#C9D5E6; margin:12px 0 0; }")
    s = s.replace(".props { margin-top:18px;", ".props { margin-top:14px;")

    # Quote inside the duo row: compact
    s = s.replace("  .quote { flex:1; text-align:left; margin:0; }",
                  "  .quote { flex:1; text-align:left; margin:0; min-width:0; }")
    s = s.replace("  .quote .qrule { margin:12px 0; width:96px; }",
                  "  .quote .qrule { margin:10px 0; width:88px; }")
    s = s.replace("  .qtext { font-size:19px; line-height:1.45; }",
                  "  .qtext { font-size:18px; line-height:1.42; }")
    s = s.replace("  .qsub { font-size:11.5px; line-height:1.55; color:#C9D5E6; letter-spacing:.6px;\n          margin-top:10px; font-weight:300; }",
                  "  .qsub { font-size:11px; line-height:1.5; color:#C9D5E6; letter-spacing:.5px;\n          margin-top:8px; font-weight:300; }")

    # Hotel strip + CTA + foot: compact
    s = s.replace("  .hotel-strip { width:100%; margin-top:16px; border:1.2px solid rgba(212,175,55,.55);\n                 border-radius:6px; padding:12px 16px; text-align:center; }",
                  "  .hotel-strip { width:100%; margin-top:12px; border:1.2px solid rgba(212,175,55,.55);\n                 border-radius:6px; padding:9px 14px; text-align:center; }")
    s = s.replace("  .cta { width:100%; background:#D4AF37; border-radius:6px; text-align:center;\n         padding:22.68px 22.68px; color:#0A192F; }",
                  "  .cta { width:100%; background:#D4AF37; border-radius:6px; text-align:center;\n         padding:15px 22.68px; color:#0A192F; margin-top:12px; }")
    s = s.replace("  .cta .big { font-family:'Playfair Display', Georgia, serif; font-weight:800;\n              font-size:27px; letter-spacing:1px; }",
                  "  .cta .big { font-family:'Playfair Display', Georgia, serif; font-weight:800;\n              font-size:24px; letter-spacing:1px; }")
    s = s.replace("  .foot { width:100%; margin-top:18.9; display:flex; align-items:center;\n          gap:18.9px; }",
                  "  .foot { width:100%; margin-top:14px; display:flex; align-items:center;\n          gap:16px; }")
    s = s.replace("  .qr { width:86.93px; height:86.93px; background:#FFFFFF; padding:4px;\n        border-radius:4px; flex-shrink:0; }",
                  "  .qr { width:76px; height:76px; background:#FFFFFF; padding:4px;\n        border-radius:4px; flex-shrink:0; }")

    (W / fname).write_text(s)
    print(f'✓ {fname} tightened')

for f in ['flyer-b.html', 'flyer-b-digital.html']:
    fix(f)
print('done')
