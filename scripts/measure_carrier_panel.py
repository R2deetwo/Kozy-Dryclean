#!/usr/bin/env python3
"""Measure the garment carrier's front panel geometry in carrier-v4-fix1.png
(1152x864). The bag hangs vertically center-frame; rider's navy polo is at
left, woman's arm at right. Output: edge fits + debug overlay."""
from PIL import Image, ImageDraw
import numpy as np
import math

DIR = '/home/z/my-project/work/image-rev5'
img = Image.open(f'{DIR}/carrier-v4-fix1.png').convert('RGB')
a = np.asarray(img).astype(np.float32)
H, W = a.shape[:2]
print('image', W, 'x', H)

r, g, b = a[..., 0], a[..., 1], a[..., 2]
# navy fabric: blue-dominant dark pixels
mask = (b > r + 6) & (b > 20) & (r < 130) & (b < 170) & (g < 120)

# zone: center of frame where the bag lives (exclude rider polo left, bg right)
zone = np.zeros_like(mask)
zone[330:860, 260:820] = True
mz = mask & zone

col_sums = mz.sum(axis=0)
xs = np.where(col_sums > 30)[0]
print('strong navy columns:', xs.min() if len(xs) else None, '..', xs.max() if len(xs) else None)

# per-row extents within a tighter x-window to avoid sleeves
rows = []
for y in range(340, H - 2):
    seg = mz[y, 280:800]
    xs_r = np.where(seg)[0]
    if len(xs_r) > 150:
        rows.append((y, 280 + xs_r.min(), 280 + xs_r.max()))

if rows:
    ys = np.array([q[0] for q in rows])
    lefts = np.array([q[1] for q in rows])
    rights = np.array([q[2] for q in rows])
    ml, cl = np.polyfit(ys, lefts, 1)
    mr, cr = np.polyfit(ys, rights, 1)
    print(f'rows analyzed: {len(rows)}, y {ys.min()}..{ys.max()}')
    print(f'left  edge: x = {ml:.3f}*y + {cl:.1f} (lean {math.degrees(math.atan(ml)):.2f} deg)')
    print(f'right edge: x = {mr:.3f}*y + {cr:.1f} (lean {math.degrees(math.atan(mr)):.2f} deg)')
    for yy in (400, 500, 600, 700, 800, 860):
        print(f'  y={yy}: panel x {int(ml*yy+cl)} .. {int(mr*yy+cr)}  width {int(mr*yy+cr)-int(ml*yy+cl)}')
else:
    print('no rows found — adjust zone')

# debug overlay
dbg = img.copy()
d = ImageDraw.Draw(dbg)
if rows:
    for yy in range(340, H, 20):
        xl, xr = int(ml*yy+cl), int(mr*yy+cr)
        d.line([(xl, yy), (xl+6, yy)], fill=(255, 0, 0), width=2)
        d.line([(xr-6, yy), (xr, yy)], fill=(255, 0, 0), width=2)
dbg.save(f'{DIR}/panel-debug.png')
print('saved panel-debug.png')
