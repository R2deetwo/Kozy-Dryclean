#!/usr/bin/env python3
"""build_qr_k_v91.py — Kozy Care branded QR (v8 recipe, rebuilt for v9.1).

Recipe (client-approved in v8, scan-verified):
  - encodes https://kozycare.ng, error correction H
  - navy modules on white
  - 6-module white K-pad in the centre carrying the K monogram (deep gold)
  - 2-module white quiet zone BAKED into the PNG (so it drops onto navy/cream
    surfaces with no extra padding needed)
  - rendered ~500px wide for a crisp camera frame
Outputs:
  work/kozy-brand/marketing-v9/qr-k-navy.png   (navy modules, gold K)
  work/kozy-brand/marketing-v9/qr-k-navy.b64  (data URI for inline HTML)
"""
import base64
import io
from pathlib import Path

import qrcode
from qrcode.constants import ERROR_CORRECT_H
from PIL import Image, ImageDraw

OUT = Path('/home/z/my-project/work/kozy-brand/marketing-v9')
OUT.mkdir(parents=True, exist_ok=True)

URL = 'https://kozycare.ng'
NAVY = (10, 25, 47)        # #0A192F
GOLD_DEEP = (184, 148, 44)  # #B8942C — the K mark (readable on white)
WHITE = (255, 255, 255)

M = 16                     # px per module (render scale -> ~528px camera frame)
PAD_MODULES = 6            # centre white K-pad, in modules
QUIET = 2                  # baked quiet zone, in modules

qr = qrcode.QRCode(error_correction=ERROR_CORRECT_H, box_size=M, border=0)
qr.add_data(URL)
qr.make(fit=True)
n = qr.modules_count
print(f'QR version: {qr.version}  ({n}x{n} modules)')

# ---- paint modules onto a clean canvas (skip the centre K-pad) ----
half = PAD_MODULES // 2
cx, cy = n // 2, n // 2

total = n + QUIET * 2
img = Image.new('RGB', (total * M, total * M), WHITE)
draw = ImageDraw.Draw(img)

for r in range(n):
    for c in range(n):
        if not qr.modules[r][c]:
            continue
        if abs(r - cy) < half and abs(c - cx) < half:
            continue  # cleared for the K-pad
        x = (c + QUIET) * M
        y = (r + QUIET) * M
        draw.rectangle([x, y, x + M - 1, y + M - 1], fill=NAVY)

# ---- K monogram inside the pad (deep gold), sized to the pad ----
# K-mark paths from the brand kit (861x896 viewBox, y-up).
K_PATHS = (
    'M689 708V689Q657 682 620.5 661.0Q584 640 544 593L356 369L414 452L652 81'
    'Q666 58 682.0 44.0Q698 30 724 20V0Q689 2 646.0 2.5Q603 3 568 3Q547 3 517.0 2.5'
    'Q487 2 441 0V20Q482 22 490.5 31.5Q499 41 483 65L338 300Q324 323 313.0 334.5'
    'Q302 346 291.0 350.5Q280 355 262 356V377Q306 378 340.5 401.0Q375 424 416 471'
    'L475 542Q513 587 519.5 619.5Q526 652 506.5 670.0Q487 688 447 689V708Q472 707 '
    '494.5 706.5Q517 706 541.5 705.5Q566 705 595 705Q624 705 647.5 706.0Q671 707 689 708Z'
    'M343 708V688Q311 687 294.5 680.5Q278 674 273.0 656.5Q268 639 268 602V106Q268 70 '
    '273.5 52.0Q279 34 295.0 28.0Q311 22 343 20V0Q316 2 275.0 2.5Q234 3 192 3Q144 3 '
    '101.5 2.5Q59 2 34 0V20Q66 22 82.0 28.0Q98 34 103.5 52.0Q109 70 109 106V602Q109 639 '
    '103.5 656.5Q98 674 81.5 680.5Q65 687 34 688V708Q59 707 101.5 706.0Q144 705 192 705'
    'Q234 705 275.0 706.0Q316 707 343 708Z'
)
K_WIRE = (
    'M 92.1 709.1 L 95.9 710.0 L 100.3 711.4 L 105.6 713.1 L 111.5 715.1 L 118.1 717.2 '
    'L 125.3 719.5 L 133.1 721.8 L 141.3 724.1 L 150.0 726.3 L 159.1 728.2 L 168.6 730.0 '
    'L 178.5 731.5 L 189.0 733.0 L 200.2 734.5 L 211.9 735.9 L 224.0 737.2 L 236.4 738.4 '
    'L 249.0 739.6 L 261.7 740.6 L 274.4 741.6 L 287.1 742.5 L 299.5 743.2 L 312.0 743.9 '
    'L 324.8 744.4 L 337.7 744.9 L 350.8 745.3 L 363.9 745.5 L 377.0 745.7 L 390.1 745.8 '
    'L 403.0 745.9 L 415.6 745.8 L 428.0 745.7 L 440.1 745.5 L 452.0 745.1 L 463.8 744.7 '
    'L 475.5 744.2 L 487.1 743.5 L 498.5 742.8 L 509.7 742.1 L 520.6 741.2 L 531.2 740.4 '
    'L 541.4 739.5 L 551.2 738.6 L 560.5 737.7 L 569.4 736.8 L 577.8 735.8 L 585.8 734.8 '
    'L 593.4 733.8 L 600.7 732.7 L 607.7 731.6 L 614.5 730.4 L 621.2 729.3 L 627.7 728.2 '
    'L 634.2 727.1 L 640.8 726.0 L 647.3 725.0 L 653.8 724.1 L 660.2 723.2 L 666.6 722.3 '
    'L 672.8 721.4 L 678.9 720.4 L 684.8 719.4 L 690.6 718.4 L 696.1 717.1 L 701.4 715.8 '
    'L 706.4 714.3 L 711.1 712.6 L 715.5 710.8 L 719.8 708.8 L 723.8 706.8 L 727.6 704.7 '
    'L 731.1 702.5 L 734.4 700.2 L 737.4 697.8 L 740.2 695.4 L 742.7 693.0 L 744.9 690.5 '
    'L 746.9 687.9 L 748.6 685.1 L 750.0 682.3 L 751.1 679.4 L 751.9 676.4 L 752.5 673.5 '
    'L 752.7 670.6 L 752.7 667.7 L 752.4 665.0 L 751.9 662.4 L 751.1 659.8 L 749.9 657.3 '
    'L 748.3 654.9 L 746.4 652.7 L 744.2 650.5 L 741.9 648.4 L 739.4 646.5 L 736.8 644.8 '
    'L 734.2 643.3 L 731.6 642.0 L 729.1 641.0 L 726.6 640.3 L 724.0 640.0 L 721.4 640.2 '
    'L 718.8 640.7 L 716.2 641.6 L 713.8 642.5 L 711.5 643.6 L 709.3 644.7 L 707.3 645.8 '
    'L 705.6 646.7 L 704.2 647.4 L 703.2 647.9 L 704.8 652.1 L 706.1 651.6 L 707.7 650.9 '
    'L 709.5 650.1 L 711.5 649.1 L 713.6 648.1 L 715.7 647.2 L 717.9 646.4 L 720.0 645.9 '
    'L 722.0 645.5 L 723.8 645.5 L 725.4 645.7 L 727.1 646.3 L 729.1 647.2 L 731.3 648.4 '
    'L 733.6 649.8 L 735.8 651.4 L 737.9 653.2 L 739.9 655.0 L 741.6 656.9 L 743.1 658.7 '
    'L 744.2 660.5 L 744.9 662.2 L 745.3 663.9 L 745.6 665.9 L 745.7 668.0 L 745.7 670.2 '
    'L 745.4 672.4 L 744.9 674.7 L 744.2 677.0 L 743.2 679.2 L 742.1 681.4 L 740.7 683.5 '
    'L 739.1 685.5 L 737.1 687.4 L 734.9 689.5 L 732.4 691.5 L 729.6 693.5 L 726.6 695.5 '
    'L 723.4 697.4 L 719.9 699.2 L 716.1 701.0 L 712.2 702.7 L 708.0 704.3 L 703.6 705.7 '
    'L 699.0 707.0 L 694.1 708.2 L 688.8 709.2 L 683.3 710.2 L 677.5 711.0 L 671.5 711.9 '
    'L 665.3 712.6 L 658.9 713.4 L 652.4 714.2 L 645.9 715.0 L 639.2 716.0 L 632.6 716.9 '
    'L 626.1 717.9 L 619.5 718.9 L 612.9 719.9 L 606.1 720.9 L 599.1 721.9 L 591.9 722.8 '
    'L 584.4 723.8 L 576.5 724.6 L 568.3 725.5 L 559.5 726.3 L 550.2 727.0 L 540.4 727.8 '
    'L 530.2 728.5 L 519.7 729.3 L 508.9 730.0 L 497.8 730.6 L 486.5 731.2 L 475.0 731.7 '
    'L 463.4 732.1 L 451.6 732.4 L 439.9 732.5 L 427.9 732.6 L 415.6 732.6 L 403.0 732.5 '
    'L 390.2 732.4 L 377.3 732.1 L 364.2 731.8 L 351.2 731.4 L 338.3 730.9 L 325.4 730.3 '
    'L 312.8 729.6 L 300.5 728.8 L 288.1 727.9 L 275.6 726.9 L 263.0 725.8 L 250.4 724.6 '
    'L 237.9 723.3 L 225.7 721.9 L 213.7 720.4 L 202.2 718.9 L 191.3 717.3 L 181.0 715.7 '
    'L 171.4 714.0 L 162.5 712.2 L 154.0 710.1 L 145.8 707.9 L 138.0 705.5 L 130.6 703.1 '
    'L 123.7 700.7 L 117.4 698.4 L 111.6 696.2 L 106.3 694.2 L 101.7 692.4 L 97.9 690.9 Z'
)

# rasterise the K via a temporary SVG -> PIL (cairosvg if present, else svglib)
def k_mark_png(size_px: int, fill_hex: str) -> Image.Image:
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-24 -838 861 896" '
        f'width="{size_px}" height="{size_px}">'
        f'<g transform="scale(1,-1)"><path d="{K_PATHS}" fill="{fill_hex}"/>'
        f'<path d="{K_WIRE}" fill="{fill_hex}"/>'
        f'<circle cx="95" cy="700" r="10.0" fill="{fill_hex}"/></g></svg>'
    )
    try:
        import cairosvg
        png = cairosvg.svg2png(bytestring=svg.encode(), output_width=size_px,
                               output_height=size_px)
        return Image.open(io.BytesIO(png)).convert('RGBA')
    except Exception:
        # fallback: draw through Playwright is overkill here; use simple
        # supersampled raster via qrcode's own tools is not possible —
        # so write the SVG and raster with node snap if cairosvg missing.
        tmp_svg = OUT / '_k_tmp.svg'
        tmp_svg.write_text(svg, encoding='utf-8')
        raise SystemExit(f'cairosvg unavailable — raster _k_tmp.svg manually: {tmp_svg}')

pad_px = PAD_MODULES * M
k_size = int(pad_px * 0.92)
k = k_mark_png(k_size, '#B8942C')
# centre it on the pad
kx = (total * M - k_size) // 2
ky = (total * M - k_size) // 2
img.paste(k, (kx, ky), k)

img.save(OUT / 'qr-k-navy.png')
print(f'QR PNG: {img.size[0]}x{img.size[1]}px  (pad {pad_px}px, quiet {QUIET*M}px)')

b64 = base64.b64encode((OUT / 'qr-k-navy.png').read_bytes()).decode()
(OUT / 'qr-k-navy.b64').write_text(f'data:image/png;base64,{b64}')
print(f'data URI: {len(b64)} chars -> qr-k-navy.b64')
