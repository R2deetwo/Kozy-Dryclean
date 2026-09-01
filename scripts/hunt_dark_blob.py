#!/usr/bin/env python3
"""Hunt for the 'dark blob' the VLM sees: luminance deviations below the serif.
Also build A/B comparison image (original vs v2) for a blind VLM test."""
from PIL import Image
import numpy as np

A = np.asarray(Image.open('/home/z/my-project/work/image-rev5/carrier-k-final-nodot3.png').convert('RGB')).astype(np.float32)
O = np.asarray(Image.open('/home/z/Kozy-Dryclean/public/brand/images/laundry-handover.png').convert('RGB')).astype(np.float32)
OUT = '/home/z/my-project/work/image-rev5'

L = A.mean(axis=2)
# scan below-serif zone for dark deviations vs local mean
zone_y, zone_x0, zone_x1 = 692, 435, 505
print('dark-spot scan (pixel lum vs 9x9 local mean, deviations < -4):')
sub = L[zone_y:726, zone_x0:zone_x1]
from scipy import ndimage
loc = ndimage.uniform_filter(sub, size=9)
dev = sub - loc
dark = dev < -4
ys, xs = np.where(dark)
print(f'  dark-deviation px: {len(ys)}')
if len(ys):
    for yy in sorted(set(ys))[:12]:
        row = xs[ys == yy]
        print(f'  y={yy+zone_y}: x {row.min()+zone_x0}-{row.max()+zone_x0} ({len(row)}px) dev min {dev[yy].min():.1f}')

# luminance min in ring around former dot
print('\nmin lum in y695-715, x445-485:', L[695:715, 445:486].min(), '| mean:', L[695:715, 445:486].mean())

# A/B comparison: stack original (top) and v2 (bottom), both same crop
crop_box = (400, 440, 700, 770)
o_img = Image.fromarray(O.astype(np.uint8)).crop(crop_box)
a_img = Image.fromarray(A.astype(np.uint8)).crop(crop_box)
w, h = o_img.size
gap = 24
canvas = Image.new('RGB', (w, h * 2 + gap), (255, 255, 255))
canvas.paste(o_img, (0, 0))
canvas.paste(a_img, (0, h + gap))
canvas = canvas.resize((canvas.width * 2, canvas.height * 2), Image.LANCZOS)
canvas.save(f'{OUT}/ab-original-vs-v2.png')
print('saved ab-original-vs-v2.png')
