#!/usr/bin/env python3
"""Phase 17 — composite the EXACT brand K (from kozy-mark.svg) onto the
laundry bag in handover-cropped.png, so the bag carries the real brand
glyph (serif K + hanger-wire flourish) instead of an approximation.

Technique:
  - scale K to ~180px tall, rotate -3deg to match the bag panel tilt
  - modulate K brightness by a heavily-blurred luminance map sampled from
    the bag panel (picks up the soft daylight falloff on the canvas)
  - cap alpha at ~236 so the canvas weave shows through like a print
  - 0.5px blur so edges aren't vector-crisp against fabric
  - alpha-composite centered on the panel (biased up off the frame edge)
"""
from PIL import Image, ImageFilter
import numpy as np

DIR = '/home/z/my-project/work/image-rev4'

img = Image.open(f'{DIR}/handover-cropped.png').convert('RGBA')
W, H = img.size  # 1152x864

# Bag front panel (from VLM measurement): x 351..899, y 543..864
PANEL_L, PANEL_R, PANEL_T, PANEL_B = 351, 899, 543, 864
panel_w = PANEL_R - PANEL_L
panel_cx = (PANEL_L + PANEL_R) // 2

k = Image.open(f'{DIR}/brand-k-alpha.png').convert('RGBA')

# --- size the K: ~33% of panel width ---
target_w = int(panel_w * 0.33)
ratio = target_w / k.width
target_h = int(k.height * ratio)
k = k.resize((target_w, target_h), Image.LANCZOS)

# --- rotate to match panel tilt (-3 deg) ---
k = k.rotate(3, resample=Image.BICUBIC, expand=True)  # PIL rotates CCW for positive angles

# --- lighting modulation from the bag panel ---
kw, kh = k.size
panel_crop = img.crop((PANEL_L, PANEL_T, PANEL_R, PANEL_B)).convert('L')
lum = panel_crop.filter(ImageFilter.GaussianBlur(30)).resize((kw, kh), Image.LANCZOS)
lum_np = np.asarray(lum).astype(np.float32) / 255.0
# map luminance to a 0.82..1.06 multiplier (darker areas dim the gold slightly)
mod = 0.82 + lum_np * 0.24

k_np = np.asarray(k).astype(np.float32)
k_np[..., :3] = np.clip(k_np[..., :3] * mod[..., None], 0, 255)
# cap alpha so the weave reads through
k_np[..., 3] = np.clip(k_np[..., 3] * 0.93, 0, 236)
k = Image.fromarray(k_np.astype(np.uint8), 'RGBA')

# soften edges half a pixel (print-on-canvas look)
k = k.filter(ImageFilter.GaussianBlur(0.5))

# --- position: centered on panel horizontally, biased up from frame edge ---
paste_x = panel_cx - kw // 2
paste_y = int(PANEL_T + (PANEL_B - PANEL_T) * 0.42) - kh // 2
# clamp inside the panel
paste_x = max(PANEL_L + 18, min(paste_x, PANEL_R - kw - 18))
paste_y = max(PANEL_T + 18, min(paste_y, PANEL_B - kh - 26))

out = img.copy()
out.alpha_composite(k, (paste_x, paste_y))
out = out.convert('RGB')
out.save(f'{DIR}/handover-final.png')
print(f'K {kw}x{kh} pasted at ({paste_x},{paste_y}) -> handover-final.png')
