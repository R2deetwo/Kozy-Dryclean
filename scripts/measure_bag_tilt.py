#!/usr/bin/env python3
"""Measure the laundry bag's tilt + panel extents in handover-cleanwall.png
by masking dark navy pixels in the lower-center region, then composite the
brand K with matching rotation. Output: handover-final2.png"""
from PIL import Image, ImageFilter
import numpy as np

DIR = '/home/z/my-project/work/image-rev4'
img = Image.open(f'{DIR}/handover-cleanwall.png').convert('RGB')
a = np.asarray(img).astype(np.float32)
H, W = a.shape[:2]

# Navy bag mask: blue-dominant dark pixels
r, g, b = a[..., 0], a[..., 1], a[..., 2]
mask = (b > r + 8) & (b > 25) & (r < 120) & (b < 160) & (g < 110)
# restrict to lower half + bag x-zone (exclude the rider's navy uniform at left)
zone = np.zeros_like(mask)
zone[470:, 320:980] = True
mask = mask & zone

# left edge of the bag per row: first x where mask is True for a run
rows = []
for y in range(480, H - 4):
    xs = np.where(mask[y])[0]
    if len(xs) > 120:  # substantial dark run in this row
        rows.append((y, xs.min(), xs.max()))
if rows:
    ys = np.array([r_[0] for r_ in rows])
    lefts = np.array([r_[1] for r_ in rows])
    rights = np.array([r_[2] for r_ in rows])
    # fit left edge line: x = m*y + c
    m, c = np.polyfit(ys, lefts, 1)
    mr, cr = np.polyfit(ys, rights, 1)
    import math
    ang_l = math.degrees(math.atan(m))    # dy->dx: positive m means edge leans right going down
    print(f'rows analyzed: {len(rows)}, y {ys.min()}..{ys.max()}')
    print(f'left edge: x = {m:.3f}*y + {c:.1f}  (lean angle {ang_l:.2f} deg, +ve = bottom shifted right)')
    print(f'right edge: x = {mr:.3f}*y + {cr:.1f} (lean angle {math.degrees(math.atan(mr)):.2f} deg)')
    print(f'bag x-range at y=650: {int(m*650+c)} .. {int(mr*650+cr)}')
    print(f'bag x-range at y=560: {int(m*560+c)} .. {int(mr*560+cr)}')
else:
    print('no bag rows found')
