#!/usr/bin/env python3
"""Compare localstd of the patched zone vs SAME-HEIGHT neighbor fabric
(right of the dot, left of the dot) in the v2 result."""
from PIL import Image
import numpy as np

A = np.asarray(Image.open('/home/z/my-project/work/image-rev5/carrier-k-final-nodot3.png').convert('RGB')).astype(np.float32)
O = np.asarray(Image.open('/home/z/Kozy-Dryclean/public/brand/images/laundry-handover.png').convert('RGB')).astype(np.float32)

def localstd(z):
    vals = [z[i:i+6, j:j+6].std() for i in range(0, z.shape[0]-6, 6) for j in range(0, z.shape[1]-6, 6)]
    return np.mean(vals)

L = A.mean(axis=2)
LO = O.mean(axis=2)
zones = {
    'patched (dot area)   y696-720 x450-488': L[696:720, 450:488],
    'right neighbor sameH y696-720 x500-545': L[696:720, 500:545],
    'left neighbor sameH  y696-720 x400-440': L[696:720, 400:440],
    'below strip          y730-754 x450-488': L[730:754, 450:488],
    'above (gap zone)     y660-684 x490-540': L[660:684, 490:540],
}
print('=== v2 result (patched) ===')
for k, z in zones.items():
    print(f'  {k}: localstd={localstd(z):.2f} mean={z.mean():.1f}')

print('\n=== original (for reference) ===')
zonesO = {
    'right neighbor sameH y696-720 x500-545': LO[696:720, 500:545],
    'left neighbor sameH  y696-720 x400-440': LO[696:720, 400:440],
    'below strip          y730-754 x450-488': LO[730:754, 450:488],
}
for k, z in zonesO.items():
    print(f'  {k}: localstd={localstd(z):.2f} mean={z.mean():.1f}')

# row-wise luminance profile through the patch: check for a brightness step at mask edge
print('\nrow mean luminance x450-488, y 688-730 (patched):')
for y in range(688, 731, 3):
    print(f'  y={y}: {L[y, 450:488].mean():.1f}')
