"""Refactor the new Kozy logo — v4 final.
Crops to the EXACT navy+gold bbox with minimal padding so the logo box
touches all 4 edges of the image. No transparent margin.
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

# === Find the actual logo box (navy+gold content) ===
is_navy = (rgb[:, :, 0] < 80) & (rgb[:, :, 1] < 80) & (rgb[:, :, 2] < 110)
is_gold = (rgb[:, :, 0] > 150) & (rgb[:, :, 1] > 110) & (rgb[:, :, 1] < 220) & (rgb[:, :, 2] < 180) & (rgb[:, :, 2] > 60)
is_logo = is_navy | is_gold

rows = np.where(np.any(is_logo, axis=1))[0]
cols = np.where(np.any(is_logo, axis=0))[0]
top, bot, left, right = rows[0], rows[-1], cols[0], cols[-1]
logo_w = right - left + 1
logo_h = bot - top + 1
print(f"Logo bbox: rows [{top}..{bot}] ({logo_h}px), cols [{left}..{right}] ({logo_w}px)")

# === Make a SQUARE crop with the logo centered, minimal 3px padding for the gold border ===
side = max(logo_w, logo_h)
pad = 3  # very small padding so we don't clip the gold border
crop_side = side + pad * 2

cx = (left + right) // 2
cy = (top + bot) // 2

sq_left = max(0, cx - crop_side // 2)
sq_right = min(arr.shape[1], sq_left + crop_side)
sq_top = max(0, cy - crop_side // 2)
sq_bot = min(arr.shape[0], sq_top + crop_side)

print(f"Square crop: {crop_side}×{crop_side}px, centered on ({cx}, {cy})")
square_crop = img.crop((sq_left, sq_top, sq_right, sq_bot))

# === Strip background → transparent (hard threshold, no feathering, to keep the box touching edges) ===
crop_arr = np.array(square_crop)
crop_rgb = crop_arr[:, :, :3]
crop_alpha = crop_arr[:, :, 3].astype(np.int16)

# Hard threshold: anything with RGB > 215 (off-white) AND not navy/gold → transparent
WHITE_THRESHOLD = 215
is_bg = np.all(crop_rgb >= WHITE_THRESHOLD, axis=2) & (crop_alpha > 240)
new_alpha = np.where(is_bg, 0, crop_alpha).clip(0, 255).astype(np.uint8)

# Light feathering only on the OUTER edge of the box (where bg meets logo)
# This is a small feathering radius so it doesn't shift the content bbox
whiteness = crop_rgb.mean(axis=2)
# Only feather pixels that are "in-between" — close to white but not pure white
feather_mask = (whiteness >= 200) & (whiteness <= 230)
feathered_alpha = np.where(feather_mask, np.clip((230 - whiteness) / 30 * 255, 0, 255).astype(np.uint8), new_alpha)
final_alpha = np.minimum(new_alpha, feathered_alpha).astype(np.uint8)

out = np.dstack([crop_rgb, final_alpha])
out_img = Image.fromarray(out)

# === Save master + favicons (NO re-crop, NO padding — keep the centered crop) ===
MASTER = 512
master = out_img.resize((MASTER, MASTER), Image.LANCZOS)
master.save(f"{BRAND_DIR}/kozy-mark.png")
print(f"\n✓ {BRAND_DIR}/kozy-mark.png ({MASTER}×{MASTER}px)")

for size in [16, 32, 48, 64, 180, 192, 512]:
    out_img.resize((size, size), Image.LANCZOS).save(f"{PUBLIC_DIR}/favicon-{size}.png")
out_img.resize((32, 32), Image.LANCZOS).save(f"{PUBLIC_DIR}/favicon.png")
out_img.resize((180, 180), Image.LANCZOS).save(f"{PUBLIC_DIR}/apple-touch-icon.png")
out_img.resize((32, 32), Image.LANCZOS).save(f"{APP_DIR}/icon.png")
out_img.resize((180, 180), Image.LANCZOS).save(f"{APP_DIR}/apple-icon.png")
print(f"✓ All favicons + apple-touch-icon + app/icon.png + app/apple-icon.png saved")

# === Verify ===
verify = np.array(master)
print(f"\nVerification (master is {MASTER}×{MASTER}):")
print(f"  All 4 corners transparent: {all(verify[y, x, 3] == 0 for label, (y, x) in [('TL', (0,0)), ('TR', (0,511)), ('BL', (511,0)), ('BR', (511,511))])}")
# Check actual logo content (use high alpha threshold to find the solid box, not feathering)
opaque_rows = np.where(np.any(verify[:, :, 3] > 200, axis=1))[0]
opaque_cols = np.where(np.any(verify[:, :, 3] > 200, axis=0))[0]
if len(opaque_rows):
    print(f"  Solid content (alpha > 200): rows [{opaque_rows[0]}..{opaque_rows[-1]}], cols [{opaque_cols[0]}..{opaque_cols[-1]}]")
    margin_top = opaque_rows[0]
    margin_bottom = 511 - opaque_rows[-1]
    margin_left = opaque_cols[0]
    margin_right = 511 - opaque_cols[-1]
    print(f"  Transparent margins: top={margin_top}, bottom={margin_bottom}, left={margin_left}, right={margin_right}")
    # Check centering
    center_row = (opaque_rows[0] + opaque_rows[-1]) / 2
    center_col = (opaque_cols[0] + opaque_cols[-1]) / 2
    print(f"  Content center: ({center_col:.0f}, {center_row:.0f}) — image center: (256, 256)")
    print(f"  Offset: ({center_col-256:.0f}, {center_row-256:.0f})px")

# Preview
preview = Image.new("RGBA", (sum([16, 32, 48, 64, 180, 192, 512]) + 8*16, MASTER + 80), (250, 247, 242, 255))
x = 16
for size in [16, 32, 48, 64, 180, 192, 512]:
    preview.alpha_composite(out_img.resize((size, size), Image.LANCZOS), (x, 16))
    x += size + 16
preview.alpha_composite(master, ((preview.size[0] - MASTER) // 2, 80))
preview.save("/home/z/my-project/download/icon-verification/logo_refactor_v2_preview.png")
print(f"✓ Preview saved")
