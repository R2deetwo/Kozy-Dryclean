#!/usr/bin/env python3
"""Final composite: brand K onto handover-cleanwall.png (door-free, clean
wall, plain bag). Bag panel measured numerically: x ~390..890, y ~530..850,
tilt ~5 deg counter-clockwise (top leans left). Output: handover-final2.png"""
from PIL import Image, ImageFilter
import numpy as np

DIR = '/home/z/my-project/work/image-rev4'

img = Image.open(f'{DIR}/handover-cleanwall.png').convert('RGBA')
W, H = img.size

# Bag front panel (numeric edge fit + clamps)
PANEL_L, PANEL_R, PANEL_T, PANEL_B = 395, 890, 535, 850
panel_w = PANEL_R - PANEL_L
panel_cx = (PANEL_L + PANEL_R) // 2

k = Image.open(f'{DIR}/brand-k-alpha.png').convert('RGBA')

# size: ~34% of panel width
target_w = int(panel_w * 0.34)
k = k.resize((target_w, int(k.height * target_w / k.width)), Image.LANCZOS)

# rotate to match bag tilt: 5 deg counter-clockwise (top of bag leans left)
k = k.rotate(5, resample=Image.BICUBIC, expand=True)

kw, kh = k.size

# lighting modulation sampled from the panel
panel_crop = img.crop((PANEL_L, PANEL_T, PANEL_R, PANEL_B)).convert('L')
lum = panel_crop.filter(ImageFilter.GaussianBlur(30)).resize((kw, kh), Image.LANCZOS)
lum_np = np.asarray(lum).astype(np.float32) / 255.0
mod = 0.82 + lum_np * 0.24

k_np = np.asarray(k).astype(np.float32)
k_np[..., :3] = np.clip(k_np[..., :3] * mod[..., None], 0, 255)
k_np[..., 3] = np.clip(k_np[..., 3] * 0.93, 0, 236)
k = Image.fromarray(k_np.astype(np.uint8))
k = k.filter(ImageFilter.GaussianBlur(0.5))

# position: panel center, biased slightly up from the frame edge
paste_x = panel_cx - kw // 2
paste_y = int(PANEL_T + (PANEL_B - PANEL_T) * 0.45) - kh // 2
paste_x = max(PANEL_L + 15, min(paste_x, PANEL_R - kw - 15))
paste_y = max(PANEL_T + 15, min(paste_y, PANEL_B - kh - 25))

out = img.copy()
out.alpha_composite(k, (paste_x, paste_y))
out.convert('RGB').save(f'{DIR}/handover-final2.png')
print(f'K {kw}x{kh} at ({paste_x},{paste_y}) -> handover-final2.png')
