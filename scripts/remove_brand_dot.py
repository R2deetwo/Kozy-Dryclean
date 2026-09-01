#!/usr/bin/env python3
"""Remove the stray gold dot below the K stem on the suit carrier.
Dot core: x ~448-480, y 693-720. Stem AA fade ends ~y 691 — protect it.
Technique (proven in phase 18 for the other dot): per-pixel ink mask in the
dot region only, dilate + feather, patch with fabric copied from directly
below (x same, y+33), add fine grain so the patch isn't clone-flat."""
from PIL import Image, ImageFilter
import numpy as np

SRC = '/home/z/Kozy-Dryclean/public/brand/images/laundry-handover.png'
OUT = '/home/z/my-project/work/image-rev5'
DOT_X0, DOT_X1, DOT_Y0, DOT_Y1 = 444, 494, 692, 724   # inclusive-exclusive
STEM_PROTECT_Y = 692                                    # nothing above this is touched

img = Image.open(SRC).convert('RGB')
a = np.asarray(img).astype(np.float32)
H, W = a.shape[:2]

reg = a[DOT_Y0:DOT_Y1, DOT_X0:DOT_X1]
r, g, b = reg[..., 0], reg[..., 1], reg[..., 2]
# loose ink detector catches the dot core AND its anti-aliased halo
ink = (r - b > 12) & (r > 55)
print(f'ink px in dot region: {ink.sum()}')

# mask: dilate to cover AA fringe, then feather
m = Image.fromarray((ink * 255).astype(np.uint8))
m = m.filter(ImageFilter.MaxFilter(5))
m = m.filter(ImageFilter.GaussianBlur(1.6))
mask = np.asarray(m).astype(np.float32) / 255.0
print(f'mask coverage: {(mask > 0.5).sum()} px strong, max {mask.max():.2f}')

# fabric source: same x, 33px lower (verified clean: 0 gold px, flat weave)
SHIFT = 33
sy0, sy1 = DOT_Y0 + SHIFT, DOT_Y1 + SHIFT
assert sy1 <= H
src = a[sy0:sy1, DOT_X0:DOT_X1]

dst = a[DOT_Y0:DOT_Y1, DOT_X0:DOT_X1]
rng = np.random.default_rng(11)
grain = rng.normal(0, 1.1, dst.shape)
patch = np.clip(src + grain * (mask[..., None] > 0.1), 0, 255)

out = a.copy()
region = out[DOT_Y0:DOT_Y1, DOT_X0:DOT_X1]
out[DOT_Y0:DOT_Y1, DOT_X0:DOT_X1] = region * (1 - mask[..., None]) + patch * mask[..., None]

res = np.clip(out, 0, 255).astype(np.uint8)
Image.fromarray(res).save(f'{OUT}/carrier-k-final-nodot.png')
print('saved carrier-k-final-nodot.png')

# --- self-check: any ink left in the dot zone? ---
chk = out[DOT_Y0:DOT_Y1, DOT_X0:DOT_X1]
r2, b2 = chk[..., 0], chk[..., 2]
left = ((r2 - b2 > 40) & (r2 > 70)).sum()
print(f'residual ink px in dot zone (r-b>40): {left}')

# --- self-check: stem fade above y 692 untouched? ---
orig_stem = a[684:692, DOT_X0:DOT_X1]
new_stem = out[684:692, DOT_X0:DOT_X1]
print(f'stem region max change: {np.abs(orig_stem - new_stem).max():.2f} (must be 0)')

# QA zoom 1: the K stem bottom + former dot area, 4x
z1 = Image.fromarray(res).crop((420, 640, 540, 760))
z1 = z1.resize((z1.width * 4, z1.height * 4), Image.LANCZOS)
z1.save(f'{OUT}/nodot-zoom-stem-4x.png')

# QA zoom 2: whole K, 3x
z2 = Image.fromarray(res).crop((400, 450, 700, 760))
z2 = z2.resize((z2.width * 3, z2.height * 3), Image.LANCZOS)
z2.save(f'{OUT}/nodot-zoom-fullK-3x.png')
print('saved QA zooms')
