#!/usr/bin/env python3
"""Compare weave texture statistics inside vs outside the patched zones.
Also detect the weave pattern period to check source-alignment (SHIFT=33)."""
from PIL import Image
import numpy as np

A = np.asarray(Image.open('/home/z/my-project/work/image-rev5/carrier-k-final-nodot2.png').convert('RGB')).astype(np.float32)
B = np.asarray(Image.open('/home/z/Kozy-Dryclean/public/brand/images/laundry-handover.png').convert('RGB')).astype(np.float32)

def lum(a): return a.mean(axis=2)

# patch zones (approx): pass1 x444-494 y692-724 ; pass2 x448-486 y690-694
def zone_stats(a, name):
    L = lum(a)
    inside = L[694:722, 448:490]     # core of former dot area
    below  = L[726:754, 448:490]     # untouched fabric below
    above  = L[660:688, 500:560]     # untouched fabric right of stem area (avoid glyph)
    for lbl, z in [('inside-patch', inside), ('below-fabric', below), ('fabric-right', above)]:
        print(f'  {name:8s} {lbl:14s} mean={z.mean():6.1f} std={z.std():5.2f} '
              f'localstd={np.mean([z[i:i+6, j:j+6].std() for i in range(0, z.shape[0]-6, 6) for j in range(0, z.shape[1]-6, 6)]):4.2f}')

print('=== texture stats (luminance) ===')
zone_stats(A, 'patched')
zone_stats(B, 'original')

# weave period detection: autocorrelation of a clean fabric strip
L = lum(A)
strip = L[700:760, 380:440] - L[700:760, 380:440].mean(axis=1, keepdims=True)
col = strip.mean(axis=0)
ac = np.correlate(col, col, 'full')[len(col)-1:]
ac /= ac[0]
peaks = [(d, ac[d]) for d in range(2, 40) if ac[d] > 0.35]
print('\nvertical-thread autocorr peaks (lag, corr):', [(d, round(float(c), 2)) for d, c in peaks[:8]])

strip2 = L[640:700, 380:440] - L[640:700, 380:440].mean(axis=0, keepdims=True)
row = strip2.mean(axis=1)
ac2 = np.correlate(row, row, 'full')[len(row)-1:]
ac2 /= ac2[0]
peaks2 = [(d, ac2[d]) for d in range(2, 40) if ac2[d] > 0.35]
print('horizontal-thread autocorr peaks:', [(d, round(float(c), 2)) for d, c in peaks2[:8]])

# diff map: where did patched image change vs original?
diff = np.abs(lum(A) - lum(B))
dy, dx = np.where(diff > 3)
print(f'\nchanged px (>3 lum): {len(dx)}  bbox x {dx.min()}-{dx.max()} y {dy.min()}-{dy.max()}')
