"""Generate a flat, solid-color version of the Kozy logo.

Per user request:
  - Remove the gold borders around the logo
  - Get rid of the gradient
  - No borders on the favicon
  - The K and the hanger should not be shiny either

Strategy: redraw as a flat SVG with exactly 2 solid colors (navy bg + gold mark),
no border, no gradient, no shine. The K+hanger structure follows the art direction:
  - Vertical stem with serifs
  - Upper diagonal arm (top-right)
  - Lower diagonal arm (bottom-right, shallower)
  - Small hook at top (inverted U)
  - Sweeping hanger base curve (left to right, convex)
"""
import os
from PIL import Image
import numpy as np
import cairosvg
import io

BRAND_DIR = "/home/z/my-project/public/brand"
PUBLIC_DIR = "/home/z/my-project/public"
APP_DIR = "/home/z/my-project/src/app"

# 512×512 viewBox. Logo mark occupies the full square (NO border, NO margin).
# All stroke widths uniform. Coordinates chosen so the mark is centered with ~15% padding.
LOGO_SVG = '''<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Solid navy background, fills entire square. NO border. -->
  <rect width="512" height="512" fill="#0A192F"/>

  <!-- Solid gold K+hanger mark. All strokes are flat solid #D4AF37, uniform width, no gradient, no shine. -->
  <g stroke="#D4AF37" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <!-- Segment A: Vertical stem of the K (with implied serifs via the horizontal caps) -->
    <line x1="200" y1="170" x2="200" y2="342"/>
    <!-- Top serif (horizontal cap at top of stem) -->
    <line x1="170" y1="170" x2="230" y2="170"/>
    <!-- Bottom serif (horizontal cap at bottom of stem) -->
    <line x1="170" y1="342" x2="230" y2="342"/>

    <!-- Segment B: Upper diagonal arm of K — from top of stem, extends up-right to mid-right -->
    <line x1="220" y1="180" x2="340" y2="170"/>

    <!-- Segment C: Lower diagonal arm of K — from center of stem, extends down-right (shallower angle) -->
    <line x1="220" y1="256" x2="345" y2="335"/>

    <!-- Hook at top — small inverted-U above the stem, mimicking a wire hanger hook -->
    <path d="M 200 170 L 200 150 Q 200 130 220 130 Q 240 130 240 150 L 240 170"/>

    <!-- Segment D: Sweeping hanger base — convex curve from bottom-left to bottom-right -->
    <path d="M 130 290 Q 256 380 382 290"/>
  </g>
</svg>
'''

# Save SVG
svg_path = f"{BRAND_DIR}/kozy-mark.svg"
with open(svg_path, "w", encoding="utf-8") as f:
    f.write(LOGO_SVG)
print(f"✓ Saved SVG: {svg_path}")

# Render to PNG at multiple sizes
def render_png(size):
    png_bytes = cairosvg.svg2png(
        bytestring=LOGO_SVG.encode("utf-8"),
        output_width=size,
        output_height=size,
    )
    return Image.open(io.BytesIO(png_bytes)).convert("RGBA")

# Master 512×512
master_img = render_png(512)
master_path = f"{BRAND_DIR}/kozy-mark.png"
master_img.save(master_path)
print(f"✓ Saved master PNG: {master_path}")

# All favicon variants
for size in [16, 32, 48, 64, 180, 192, 512]:
    render_png(size).save(f"{PUBLIC_DIR}/favicon-{size}.png")
print(f"✓ favicons (16, 32, 48, 64, 180, 192, 512) saved")

render_png(32).save(f"{PUBLIC_DIR}/favicon.png")
render_png(180).save(f"{PUBLIC_DIR}/apple-touch-icon.png")
render_png(32).save(f"{APP_DIR}/icon.png")
render_png(180).save(f"{APP_DIR}/apple-icon.png")
print(f"✓ favicon.png, apple-touch-icon.png, app/icon.png, app/apple-icon.png saved")

# === Verification: only 2 colors present (navy + gold), fully opaque, no border ===
arr = np.array(master_img)
print(f"\nVerification:")
print(f"  Image size: {master_img.size}")
unique_alphas = np.unique(arr[:, :, 3])
print(f"  Unique alpha values: {unique_alphas} (should be [255] — fully opaque, NO transparency)")

# Quantize RGB to find distinct color buckets
rgb = arr[:, :, :3]
quantized = (rgb // 16) * 16
unique_colors, counts = np.unique(quantized.reshape(-1, 3), axis=0, return_counts=True)
sorted_idx = np.argsort(-counts)
print(f"\n  Top colors (quantized to 16-step):")
for i in sorted_idx[:5]:
    print(f"    RGB ({unique_colors[i,0]:3d}, {unique_colors[i,1]:3d}, {unique_colors[i,2]:3d}) — {counts[i]} pixels ({100*counts[i]/(512*512):.1f}%)")

# Check corners — should all be navy (no transparent, no border)
print(f"\n  Corner pixels (should all be navy #0A192F = (10, 25, 47)):")
for label, (y, x) in [("TL", (0,0)), ("TR", (0,511)), ("BL", (511,0)), ("BR", (511,511))]:
    print(f"    {label}: RGB={tuple(arr[y, x, :3])}")

# Preview sheet
PREVIEW_DIR = "/home/z/my-project/download/icon-verification"
os.makedirs(PREVIEW_DIR, exist_ok=True)
preview_w = sum([16, 32, 48, 64, 180, 192, 512]) + 8*16
preview = Image.new("RGBA", (preview_w, 512 + 80), (250, 247, 242, 255))
x = 16
for size in [16, 32, 48, 64, 180, 192, 512]:
    preview.alpha_composite(render_png(size), (x, 16))
    x += size + 16
preview.alpha_composite(master_img, ((preview_w - 512) // 2, 80))
preview.save(f"{PREVIEW_DIR}/logo_flat_preview.png")
print(f"\n✓ Preview saved: {PREVIEW_DIR}/logo_flat_preview.png")
