#!/usr/bin/env python3
"""Remove the hallucinated bottom-right dot from carrier-k-hybrid4.png.
Dot: component 2 at x 629-656, y 653-679. Patch by copying fabric from
directly below (same x, y+40 — preserves weave/lighting), feathered mask."""
from PIL import Image, ImageFilter
import numpy as np

DIR = '/home/z/my-project/work/image-rev5'
img = Image.open(f'{DIR}/carrier-k-hybrid4.png').convert('RGB')
a = np.asarray(img).astype(np.float32)
H, W = a.shape[:2]

# dot bbox
DX0, DX1, DY0, DY1 = 629, 657, 653, 680  # inclusive-exclusive
SHIFT = 40  # fabric source offset (down)

# build dot mask from gold pixels in bbox, then dilate + feather
reg = a[DY0 - 4:DY1 + 4, DX0 - 4:DX1 + 4]
r, g, b = reg[..., 0], reg[..., 1], reg[..., 2]
gold = (r > 70) & (g > 55) & (r > b + 18)
mask_img = Image.fromarray((gold * 255).astype(np.uint8))
mask_img = mask_img.filter(ImageFilter.MaxFilter(7))      # cover AA edge
mask_img = mask_img.filter(ImageFilter.GaussianBlur(2.0))  # feather
mask = np.asarray(mask_img).astype(np.float32) / 255.0

# source fabric from below
sy0, sy1 = DY0 - 4 + SHIFT, DY1 + 4 + SHIFT
assert sy1 <= H, 'source out of bounds'
src = a[sy0:sy1, DX0 - 4:DX1 + 4]

# blend
dst = a[DY0 - 4:DY1 + 4, DX0 - 4:DX1 + 4]
# add tiny grain to the copied patch so it doesn't look cloned-flat
rng = np.random.default_rng(7)
grain = rng.normal(0, 1.2, dst.shape)
patch = np.clip(src + grain * (mask[..., None] > 0.1), 0, 255)

out = a.copy()
region = out[DY0 - 4:DY1 + 4, DX0 - 4:DX1 + 4]
out[DY0 - 4:DY1 + 4, DX0 - 4:DX1 + 4] = region * (1 - mask[..., None]) + patch * mask[..., None]

Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(f'{DIR}/carrier-k-final.png')
print('saved carrier-k-final.png')

# QA crops
zoom = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).crop((420, 460, 680, 730))
zoom = zoom.resize((zoom.width * 2, zoom.height * 2), Image.LANCZOS)
zoom.save(f'{DIR}/k-final-zoom2.png')
print('saved k-final-zoom2.png')
