#!/usr/bin/env python3
"""Scan the ENTIRE area around/below/right of the K glyph for stray gold marks
in the v5 image (excluding the glyph itself)."""
from PIL import Image
import numpy as np
from scipy import ndimage

V = np.asarray(Image.open('/home/z/my-project/work/image-rev5/carrier-k-final-nodot6.png').convert('RGB')).astype(np.float32)

# glyph bbox: x 448-643, y 487-719 (from component analysis). Search zone: panel area
# x 420-700, y 480-770, EXCLUDING the glyph core (x 445-650, y 485-695)
r, g, b = V[..., 0], V[..., 1], V[..., 2]
gold = (r > 70) & (g > 55) & (r > b + 18)

zone = np.zeros_like(gold)
zone[480:770, 420:700] = True
# exclude glyph
zone[487:690, 448:645] = False
# exclude the bottom trim gold elements (y > 758)
zone[758:, :] = False

search = gold & zone
lbl, n = ndimage.label(search)
print(f'gold components outside glyph in panel zone: {n}')
for i in range(1, n + 1):
    ys, xs = np.where(lbl == i)
    if len(xs) < 5:
        continue
    print(f'  id={i}: x {xs.min()}-{xs.max()}, y {ys.min()}-{ys.max()}, px={len(xs)}')

# also check BELOW the glyph specifically (y 690-758)
zone2 = np.zeros_like(gold)
zone2[690:758, 420:700] = True
zone2[690:758, 445:645] = False  # below glyph but outside its x-core? no - below glyph there's nothing to exclude
search2 = gold & zone2
lbl2, n2 = ndimage.label(search2)
print(f'\ngold components below glyph (y690-758): {n2}')
for i in range(1, n2 + 1):
    ys, xs = np.where(lbl2 == i)
    if len(xs) < 5:
        continue
    print(f'  id={i}: x {xs.min()}-{xs.max()}, y {ys.min()}-{ys.max()}, px={len(xs)}')

# zoom crop of the lower-right leg area for VLM
img = Image.open('/home/z/my-project/work/image-rev5/carrier-k-final-nodot6.png').convert('RGB')
z = img.crop((560, 600, 700, 760)).resize((560, 640), Image.LANCZOS)
z.save('/home/z/my-project/work/image-rev5/zoom-leg-right.png')
print('saved zoom-leg-right.png')
