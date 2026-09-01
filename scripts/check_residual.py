#!/usr/bin/env python3
"""Map residual faint ink around the former dot zone in the PATCHED image."""
from PIL import Image
import numpy as np

P = '/home/z/my-project/work/image-rev5/carrier-k-final-nodot.png'
a = np.asarray(Image.open(P).convert('RGB')).astype(np.float32)

print('--- residual column profile x=462..470, y 684..700 (r-b) ---')
for y in range(684, 701):
    vals = [int(a[y, x, 0] - a[y, x, 2]) for x in range(462, 471)]
    print(f'y={y}: ' + ' '.join(f'{v:4d}' for v in vals))

print('\n--- horizontal ink profile (r-b) at rows y=686..696, x 440..500 ---')
for y in range(686, 697, 2):
    vals = [int(a[y, x, 0] - a[y, x, 2]) for x in range(440, 501, 4)]
    print(f'y={y}: ' + ' '.join(f'{v:3d}' for v in vals))

# where is residual medium ink (r-b 15..80) in x 440-500, y 685-700?
zone = a[685:701, 440:501]
r, b = zone[..., 0], zone[..., 2]
med = (r - b > 15) & (r - b <= 80) & (r > 55)
ys, xs = np.where(med)
if len(ys):
    print(f'\nfaint ink zone: x {xs.min()+440}-{xs.max()+440}, y {ys.min()+685}-{ys.max()+685}, px={len(ys)}')
    for yy in sorted(set(ys)):
        row = xs[ys == yy]
        print(f'  y={yy+685}: x {row.min()+440}-{row.max()+440} ({len(row)} px)')
