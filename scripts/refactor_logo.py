"""Refactor the attached Kozy logo image for production use:
  1. Strip the white border / soft white halo → make it transparent
  2. Keep the navy background + gold mark as opaque content
  3. Crop tightly to content
  4. Pad to square + upscale to 512×512 (master) and standard favicon sizes
  5. Save into public/brand/ and public/ as the new logo / favicon assets
"""
import os
from PIL import Image
import numpy as np

SRC = "/home/sync/upload/Generated Image August 25, 2026 - 2_41PM.png"
BRAND_DIR = "/home/z/my-project/public/brand"
PUBLIC_DIR = "/home/z/my-project/public"

os.makedirs(BRAND_DIR, exist_ok=True)
os.makedirs(PUBLIC_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# 1. Load source, strip white background → transparent
# ---------------------------------------------------------------------------
img = Image.open(SRC).convert("RGBA")
arr = np.array(img)
rgb = arr[:, :, :3]
alpha = arr[:, :, 3].astype(np.int16)

# Any pixel whose RGB is "near-white" (all channels ≥ 230) is treated as
# background and made transparent. This catches pure white (255) AND the soft
# anti-aliased halo (247-252) around the logo.
WHITE_THRESHOLD = 230
is_bg = np.all(rgb >= WHITE_THRESHOLD, axis=2)
new_alpha = np.where(is_bg, 0, alpha).clip(0, 255).astype(np.uint8)

# For pixels that are PARTIALLY background (anti-aliased edges), feather the
# alpha based on how white they are. This gives clean edges instead of jaggies.
# Compute "whiteness" = average RGB value (0..255). Map whiteness ≥ 230 → 0 alpha,
# whiteness ≤ 200 → full alpha, linear between.
whiteness = rgb.mean(axis=2)
feathered_alpha = np.clip(
    (230 - whiteness) / (230 - 200) * 255,
    0, 255
).astype(np.uint8)
# Use the feathered alpha ONLY where it's less than the original alpha (i.e., background-ish pixels)
final_alpha = np.minimum(new_alpha, feathered_alpha)

out = np.dstack([rgb, final_alpha])
out_img = Image.fromarray(out, mode="RGBA")

# ---------------------------------------------------------------------------
# 2. Crop tightly to non-transparent content
# ---------------------------------------------------------------------------
arr2 = np.array(out_img)
non_empty_rows = np.where(np.any(arr2[:, :, 3] > 0, axis=1))[0]
non_empty_cols = np.where(np.any(arr2[:, :, 3] > 0, axis=0))[0]
top, bot = non_empty_rows[0], non_empty_rows[-1]
left, right = non_empty_cols[0], non_empty_cols[-1]
print(f"Content bbox: rows [{top}..{bot}], cols [{left}..{right}] → {right-left+1}×{bot-top+1}px")

# Add 2px transparent padding (so the logo isn't flush against the image edge)
pad = 2
top = max(0, top - pad)
bot = min(out_img.height - 1, bot + pad)
left = max(0, left - pad)
right = min(out_img.width - 1, right + pad)
cropped = out_img.crop((left, top, right + 1, bot + 1))
print(f"Cropped: {cropped.size[0]}×{cropped.size[1]}px (with {pad}px transparent padding)")

# ---------------------------------------------------------------------------
# 3. Pad to square (so it works at any favicon aspect ratio)
# ---------------------------------------------------------------------------
side = max(cropped.size)
square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
square.alpha_composite(cropped, ((side - cropped.size[0]) // 2, (side - cropped.size[1]) // 2))

# ---------------------------------------------------------------------------
# 4. Save the master 512×512 PNG (the brand logo mark, transparent bg)
# ---------------------------------------------------------------------------
MASTER = 512
master = square.resize((MASTER, MASTER), Image.LANCZOS)
master_path = f"{BRAND_DIR}/kozy-mark.png"
master.save(master_path)
print(f"✓ Saved master logo mark → {master_path} ({MASTER}×{MASTER}px, transparent bg)")

# ---------------------------------------------------------------------------
# 5. Generate favicon variants at standard sizes
# ---------------------------------------------------------------------------
# Next.js convention: app/icon.png (auto-detected by Next 13+ for favicon)
# Plus the legacy public/ paths the current layout.tsx references.
FAV_SIZES = [16, 32, 48, 64, 180, 192, 512]
for size in FAV_SIZES:
    favicon = square.resize((size, size), Image.LANCZOS)
    favicon_path = f"{PUBLIC_DIR}/favicon-{size}.png"
    favicon.save(favicon_path)
    print(f"✓ Saved favicon {size}×{size} → {favicon_path}")

# Also save a single canonical favicon.png at 32px (most browsers)
square.resize((32, 32), Image.LANCZOS).save(f"{PUBLIC_DIR}/favicon.png")
print(f"✓ Updated /public/favicon.png (32×32, replaces generic)")

# Apple touch icon (180×180 — apple spec)
square.resize((180, 180), Image.LANCZOS).save(f"{PUBLIC_DIR}/apple-touch-icon.png")
print(f"✓ Saved /public/apple-touch-icon.png (180×180)")

# ---------------------------------------------------------------------------
# 6. Also drop a copy into src/app/icon.png so Next.js auto-detects it
#    (Next.js metadata API: app/icon.png → favicon; app/apple-icon.png → apple touch)
# ---------------------------------------------------------------------------
APP_DIR = "/home/z/my-project/src/app"
square.resize((32, 32), Image.LANCZOS).save(f"{APP_DIR}/icon.png")
print(f"✓ Saved /src/app/icon.png (32×32, Next.js auto-detected favicon)")
square.resize((180, 180), Image.LANCZOS).save(f"{APP_DIR}/apple-icon.png")
print(f"✓ Saved /src/app/apple-icon.png (180×180, Next.js auto-detected apple-touch-icon)")

# ---------------------------------------------------------------------------
# 7. Save a preview contact sheet so we can confirm visually
# ---------------------------------------------------------------------------
PREVIEW_DIR = "/home/z/my-project/download/icon-verification"
os.makedirs(PREVIEW_DIR, exist_ok=True)
preview_w = sum(FAV_SIZES) + (len(FAV_SIZES) + 1) * 16
preview = Image.new("RGBA", (preview_w, MASTER + 64 + 80), (250, 247, 242, 255))
x = 16
for size in FAV_SIZES:
    f = square.resize((size, size), Image.LANCZOS)
    preview.alpha_composite(f, (x, 16))
    x += size + 16
# Add the master mark at the bottom for reference
preview.alpha_composite(master, ((preview_w - MASTER) // 2, 80))
preview.save(f"{PREVIEW_DIR}/logo_refactor_preview.png")
print(f"✓ Saved preview sheet → {PREVIEW_DIR}/logo_refactor_preview.png")

print("\nDone. Logo refactored: white border stripped, navy+gold content preserved, favicons generated at all standard sizes.")
