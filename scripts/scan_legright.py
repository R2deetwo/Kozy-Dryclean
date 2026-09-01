#!/usr/bin/env python3
"""Ultra-sensitive scan for faint gold residue in the lower-right zone
(where the phase-18 dot was removed): x 590-700, y 620-710."""
from PIL import Image
import numpy as np
from scipy import ndimage

V = np.asarray(Image.open('/home/z/my-project/work/image-rev5/carrier-k-final-nodot6.png').convert('RGB')).astype(np.float32)
O = np.asarray(Image.open('/home/z/Kozy-Dryclean/public/brand/images/laundry-handover.png').convert('RGB')).astype(np.float32)

for name, A in [('PATCHED(v5)', V), ('ORIGINAL', O)]:
    r, g, b = A[..., 0], A[..., 1], A[..., 2]
    # very loose: any warm pixel
    faint = (r - b > 8) & (r > 45)
    zone = np.zeros_like(faint)
    zone[620:710, 590:700] = True
    zone[620:690, 590:660] = False   # exclude glyph+leg serif area
    s = faint & zone
    lbl, n = ndimage.label(s)
    print(f'{name}: {n} faint-warm components in x590-700 y620-710 (excl. glyph)')
    for i in range(1, n + 1):
        ys, xs = np.where(lbl == i)
        if len(xs) < 4:
            continue
        print(f'  id={i}: x {xs.min()}-{xs.max()}, y {ys.min()}-{ys.max()}, px={len(xs)}')

# luminance anomaly scan: bright spots vs local mean in that zone
Ln = V.mean(axis=2)
from scipy import ndimage as nd
sub = Ln[620:710, 560:700]
loc = nd.uniform_filter(sub, size=11)
dev = sub - loc
bright = dev > 7
lbl, n = nd.label(bright)
print(f'\nbright anomalies (dev>+7) in x560-700 y620-710: {n}')
for i in range(1, n + 1):
    ys, xs = np.where(lbl == i)
    if len(xs) < 6:
        continue
    print(f'  id={i}: x {xs.min()+560}-{xs.max()+560}, y {ys.min()+620}-{ys.max()+620}, px={len(xs)}, maxdev={dev[ys, xs].max():.1f}')

# high-res zoom of the leg + right area, 3x
img = Image.open('/home/z/my-project/work/image-rev5/carrier-k-final-nodot6.png').convert('RGB')
z = img.crop((560, 600, 700, 720)).resize((420, 360), Image.LANCZOS)
z.save('/home/z/my-project/work/image-rev5/zoom-legright-hires.png')
print('saved zoom-legright-hires.png')
