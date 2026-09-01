"""Refactor the new Kozy logo — v6 FINAL with truly hard edges.

User request: "ensure the favicon does not have borders. i also dont really want
gradient on the edges just the solid color in other places"

Strategy:
  1. Find the navy+gold box bbox (logo content) - TIGHT, no padding
  2. Crop to exact bbox (square if needed, centered)
  3. Strip background → transparent using HARD threshold (alpha=0 or 255 only)
  4. Snap washed-out edge pixels to nearest brand color (navy or gold)
  5. Use NEAREST neighbor for the final resize to 512×512 (preserves crisp edges,
     no anti-aliasing artifacts that LANCZOS would introduce)
  6. Save master + favicons
"""
import os
from PIL import Image
import numpy as np

SRC = "/home/sync/upload/Generated Image August 26, 2026 - 4_26PM (1).png"
BRAND_DIR = "/home/z/my-project/public/brand"
PUBLIC_DIR = "/home/z/my-project/public"
APP_DIR = "/home/z/my-project/src/app"

img = Image.open(SRC).convert("RGBA")
arr = np.array(img)
rgb = arr[:, :, :3]

# === STEP 1: Find the EXACT logo box bbox (navy+gold content) ===
is_navy = (rgb[:, :, 0] < 80) & (rgb[:, :, 1] < 80) & (rgb[:, :, 2] < 110)
is_gold = (rgb[:, :, 0] > 150) & (rgb[:, :, 1] > 110) & (rgb[:, :, 1] < 220) & (rgb[:, :, 2] < 180) & (rgb[:, :, 2] > 60)
is_logo = is_navy | is_gold

rows = np.where(np.any(is_logo, axis=1))[0]
cols = np.where(np.any(is_logo, axis=0))[0]
top, bot, left, right = rows[0], rows[-1], cols[0], cols[-1]
logo_w = right - left + 1
logo_h = bot - top + 1
print(f"Logo bbox: rows [{top}..{bot}] ({logo_h}px), cols [{left}..{right}] ({logo_w}px)")

# === STEP 2: Crop to a centered square with NO padding (box touches all 4 edges) ===
# Use the LARGER dimension as the crop side, then re-crop the resulting square tightly
# to ensure the box actually touches all 4 edges after the resize.
side = max(logo_w, logo_h)
cx = (left + right) // 2
cy = (top + bot) // 2

# Start with a generous crop centered on the logo
sq_left = max(0, cx - side // 2 - 4)
sq_right = min(arr.shape[1], sq_left + side + 8)
sq_top = max(0, cy - side // 2 - 4)
sq_bot = min(arr.shape[0], sq_top + side + 8)

square_crop = img.crop((sq_left, sq_top, sq_right, sq_bot))
crop_arr = np.array(square_crop)
crop_rgb = crop_arr[:, :, :3]
crop_h, crop_w = crop_arr.shape[:2]
print(f"Initial cropped: {crop_w}×{crop_h}px")

# === STEP 3: Hard threshold + color snapping ===
WHITE_THRESHOLD = 215
is_bg = np.all(crop_rgb >= WHITE_THRESHOLD, axis=2)

# Hard binary alpha: background → 0, anything else → 255
binary_alpha = np.where(is_bg, 0, 255).astype(np.uint8)

# Snap washed-out edge pixels to nearest brand color
NAVY = np.array([15, 25, 50])
GOLD = np.array([212, 175, 55])

final_rgb = crop_rgb.copy()
logo_mask = binary_alpha == 255
# Any "logo" pixel that's whitish (mean RGB > 180) gets snapped
whitish_logo = logo_mask & (crop_rgb.mean(axis=2) > 180)
if np.any(whitish_logo):
    whitish_pixels = crop_rgb[whitish_logo]
    dist_navy = np.sum((whitish_pixels.astype(int) - NAVY) ** 2, axis=1)
    dist_gold = np.sum((whitish_pixels.astype(int) - GOLD) ** 2, axis=1)
    closer_to_navy = dist_navy < dist_gold
    new_colors = np.where(closer_to_navy[:, None], NAVY, GOLD).astype(np.uint8)
    final_rgb[whitish_logo] = new_colors

# Also snap any logo pixel that's "between" navy and gold to its nearest brand color
# This cleans up the original image's anti-aliasing between navy bg and gold mark
logo_pixels_mask = binary_alpha == 255
logo_pixels_rgb = final_rgb[logo_pixels_mask]
# Distance to navy
dist_navy = np.sum((logo_pixels_rgb.astype(int) - NAVY) ** 2, axis=1)
# Distance to gold
dist_gold = np.sum((logo_pixels_rgb.astype(int) - GOLD) ** 2, axis=1)
# A pixel only gets snapped if it's significantly off from both colors
# (otherwise leave it alone — true brand-color pixels stay as they are)
# Threshold: if pixel's mean distance to nearest brand color > 50, snap it
nearest_dist = np.minimum(dist_navy, dist_gold)
snap_mask = nearest_dist > 5000  # squared distance threshold
if np.any(snap_mask):
    snap_indices = np.where(snap_mask)[0]
    snap_pixels = logo_pixels_rgb[snap_indices]
    snap_dist_navy = dist_navy[snap_indices]
    snap_dist_gold = dist_gold[snap_indices]
    snap_closer_to_navy = snap_dist_navy < snap_dist_gold
    snap_new_colors = np.where(snap_closer_to_navy[:, None], NAVY, GOLD).astype(np.uint8)
    # Update logo_pixels_rgb
    logo_pixels_rgb[snap_indices] = snap_new_colors
    # Write back to final_rgb
    final_rgb[logo_pixels_mask] = logo_pixels_rgb

# Build the final RGBA image
final = np.dstack([final_rgb, binary_alpha])
out_img = Image.fromarray(final)

# === STEP 3.5: RE-CROP tightly to the actual content (no transparent margins) ===
# After bg strip, find the bbox of non-transparent content and crop to it.
# This ensures the logo box touches all 4 edges of the final image.
out_arr = np.array(out_img)
out_alpha = out_arr[:, :, 3]
content_rows = np.where(np.any(out_alpha > 0, axis=1))[0]
content_cols = np.where(np.any(out_alpha > 0, axis=0))[0]
if len(content_rows) > 0:
    out_img = out_img.crop((content_cols[0], content_rows[0], content_cols[-1] + 1, content_rows[-1] + 1))
    print(f"Re-cropped tight to content: {out_img.size[0]}×{out_img.size[1]}px (NO transparent margins)")

# === STEP 4: Resize using NEAREST neighbor (preserves hard edges, no anti-aliasing) ===
MASTER = 512
master = out_img.resize((MASTER, MASTER), Image.NEAREST)
master.save(f"{BRAND_DIR}/kozy-mark.png")
print(f"✓ {BRAND_DIR}/kozy-mark.png ({MASTER}×{MASTER}px, NEAREST resize)")

for size in [16, 32, 48, 64, 180, 192, 512]:
    out_img.resize((size, size), Image.NEAREST).save(f"{PUBLIC_DIR}/favicon-{size}.png")
out_img.resize((32, 32), Image.NEAREST).save(f"{PUBLIC_DIR}/favicon.png")
out_img.resize((180, 180), Image.NEAREST).save(f"{PUBLIC_DIR}/apple-touch-icon.png")
out_img.resize((32, 32), Image.NEAREST).save(f"{APP_DIR}/icon.png")
out_img.resize((180, 180), Image.NEAREST).save(f"{APP_DIR}/apple-icon.png")
print(f"✓ All favicons saved (all NEAREST resize)")

# === STEP 5: Verify NO gradient edges ===
verify = np.array(master)
alpha = verify[:, :, 3]
print(f"\nVerification (master is {MASTER}×{MASTER}):")
transparent = np.sum(alpha == 0)
opaque = np.sum(alpha == 255)
gradient = np.sum((alpha > 0) & (alpha < 255))
print(f"  Fully transparent (alpha=0):       {transparent} pixels ({100*transparent/(512*512):.1f}%)")
print(f"  Fully opaque (alpha=255):          {opaque} pixels ({100*opaque/(512*512):.1f}%)")
print(f"  Gradient/feathered (0<alpha<255):  {gradient} pixels ({100*gradient/(512*512):.4f}%) — MUST be 0")
print(f"  Corner alphas (all should be 0):   TL={verify[0,0,3]} TR={verify[0,511,3]} BL={verify[511,0,3]} BR={verify[511,511,3]}")

# Verify solid colors — all opaque pixels should be either navy-ish OR gold-ish
opaque_pixels = verify[alpha == 255][:, :3]
navy_count = np.sum((opaque_pixels[:, 2] > opaque_pixels[:, 0]) & (opaque_pixels.mean(axis=1) < 100))
gold_count = np.sum((opaque_pixels[:, 0] > 150) & (opaque_pixels[:, 2] < 150))
other_count = len(opaque_pixels) - navy_count - gold_count
print(f"\n  Solid pixel colors:")
print(f"    Navy-ish: {navy_count} pixels")
print(f"    Gold-ish: {gold_count} pixels")
print(f"    Other:    {other_count} pixels (should be ~0)")

# Preview
preview = Image.new("RGBA", (sum([16, 32, 48, 64, 180, 192, 512]) + 8*16, MASTER + 80), (250, 247, 242, 255))
x = 16
for size in [16, 32, 48, 64, 180, 192, 512]:
    preview.alpha_composite(out_img.resize((size, size), Image.NEAREST), (x, 16))
    x += size + 16
preview.alpha_composite(master, ((preview.size[0] - MASTER) // 2, 80))
preview.save("/home/z/my-project/download/icon-verification/logo_refactor_v2_preview.png")
print(f"\n✓ Preview saved")
