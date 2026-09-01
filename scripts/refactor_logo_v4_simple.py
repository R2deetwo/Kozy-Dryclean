"""Redraw the Kozy logo with the SAME simple, flat, non-flashy style as the old chevron logo.

User feedback:
  - The current logo (the photo-based one I refactored) is "unnecessarily flashy"
  - The old logo (the chevron SVG) was simple and they liked that
  - They want the NEW logo to have the SAME texture and colors as the OLD logo
  - Keep the K+hanger shape from the photo, but render it as a flat icon

Art direction (per VLM analysis):
  1. Background: solid deep navy (same as old logo: #0A192F)
  2. Gold mark: single solid flat color (#D4AF37), no metallic gradient, no shine
  3. NO border, NO drop shadow, NO 3D bevel
  4. Uniform stroke weight (thick, bold — like the old chevron's 2.4px @ 40px = ~30px @ 512px)
  5. Rounded line caps/joins (matching the old chevron style)
  6. Render as vector SVG → rasterize via cairosvg, but render at exact 512×512 viewBox
     so there are no transparent corners from non-integer scaling.
"""
import os
from PIL import Image
import numpy as np
import cairosvg
import io

BRAND_DIR = "/home/z/my-project/public/brand"
PUBLIC_DIR = "/home/z/my-project/public"
APP_DIR = "/home/z/my-project/src/app"

# viewBox 512×512 (NOT 40×40) so the SVG rasterizes at exact 1:1 with no scaling.
# This eliminates the transparent corners that appear when cairosvg scales 40→512.
# All proportions match the old chevron logo:
# - Background: #0A192F solid navy, rounded corners rx=115 (≈ 9/40 * 512 = 115.2)
# - Mark: #D4AF37 solid gold
# - Stroke width 30.7px (≈ 2.4/40 * 512 = 30.72) — matches old chevron's chunky bold look
# - Rounded caps + joins (same as old)

LOGO_SVG = '''<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Solid navy background with rounded corners (proportions match old chevron logo exactly) -->
  <rect width="512" height="512" rx="115" fill="#0A192F"/>
  <!-- K + hanger mark — flat solid gold, uniform stroke, rounded caps -->
  <g stroke="#D4AF37" stroke-width="31" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <!-- Vertical stem of K (scaled from 15,13 → 15,27 in 40px viewBox) -->
    <line x1="192" y1="166" x2="192" y2="346"/>
    <!-- Upper diagonal arm of K -->
    <line x1="192" y1="256" x2="333" y2="166"/>
    <!-- Lower diagonal arm of K -->
    <line x1="192" y1="256" x2="333" y2="346"/>
    <!-- Hanger hook (small inverted-U at top of stem) -->
    <path d="M 192 166 L 192 141 Q 192 115 218 115 Q 243 115 243 141 L 243 166"/>
    <!-- Sweeping hanger base (convex curve from bottom-left to bottom-right) -->
    <path d="M 141 294 Q 256 358 371 294"/>
  </g>
</svg>
'''

# Save SVG
svg_path = f"{BRAND_DIR}/kozy-mark.svg"
with open(svg_path, "w", encoding="utf-8") as f:
    f.write(LOGO_SVG)
print(f"✓ Saved SVG: {svg_path}")

def render_png(size):
    png_bytes = cairosvg.svg2png(
        bytestring=LOGO_SVG.encode("utf-8"),
        output_width=size,
        output_height=size,
    )
    return Image.open(io.BytesIO(png_bytes)).convert("RGBA")

# Save master + favicons
master = render_png(512)
master.save(f"{BRAND_DIR}/kozy-mark.png")
print(f"✓ {BRAND_DIR}/kozy-mark.png (512×512)")

for size in [16, 32, 48, 64, 180, 192, 512]:
    render_png(size).save(f"{PUBLIC_DIR}/favicon-{size}.png")
render_png(32).save(f"{PUBLIC_DIR}/favicon.png")
render_png(180).save(f"{PUBLIC_DIR}/apple-touch-icon.png")
render_png(32).save(f"{APP_DIR}/icon.png")
render_png(180).save(f"{APP_DIR}/apple-icon.png")
print(f"✓ All favicons + apple-touch-icon + app/icon.png + app/apple-icon.png saved")

# === Verification ===
arr = np.array(master)
print(f"\nVerification:")
print(f"  Image: {master.size}")
unique_alphas = np.unique(arr[:, :, 3])
print(f"  Unique alpha values: {unique_alphas} (should be [255] — fully opaque, no transparency)")

# Quantize RGB to check distinct color buckets
rgb = arr[:, :, :3]
quantized = (rgb // 32) * 32
unique_colors, counts = np.unique(quantized.reshape(-1, 3), axis=0, return_counts=True)
sorted_idx = np.argsort(-counts)
print(f"\n  Top color buckets (quantized to 32-step):")
for i in sorted_idx[:5]:
    print(f"    RGB ({unique_colors[i,0]:3d}, {unique_colors[i,1]:3d}, {unique_colors[i,2]:3d}) — {counts[i]} pixels ({100*counts[i]/(512*512):.1f}%)")

# Corner check — should all be solid navy
print(f"\n  Corner pixels (should all be navy ~(10, 25, 47)):")
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
preview.alpha_composite(master, ((preview_w - 512) // 2, 80))
preview.save(f"{PREVIEW_DIR}/logo_simple_flat_preview.png")
print(f"\n✓ Preview saved: {PREVIEW_DIR}/logo_simple_flat_preview.png")

