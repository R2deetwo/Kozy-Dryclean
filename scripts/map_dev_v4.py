#!/usr/bin/env python3
"""Map the remaining dark/bright deviations in v4 (nodot5)."""
from PIL import Image
import numpy as np
from scipy import ndimage

A = np.asarray(Image.open('/home/z/my-project/work/image-rev5/carrier-k-final-nodot5.png').convert('RGB')).astype(np.float32)
O = np.asarray(Image.open('/home/z/Kozy-Dryclean/public/brand/images/laundry-handover.png').convert('RGB')).astype(np.float32)

Ln = A.mean(axis=2)
sub = Ln[690:728, 435:505]
loc = ndimage.uniform_filter(sub, size=9)
dev = sub - loc

print('dark deviations < -6 map (y 690-727, x 435-504; # = < -10, + = -10..-6, . = rest):')
for y in range(0, 38, 2):
    row = ''
    for x in range(0, 70, 2):
        d = dev[y:y+2, x:x+2].min()
        row += '#' if d < -10 else ('+' if d < -6 else '.')
    print(f'y={y+690:3d} {row}')

print('\nbright deviations > +6 map (o = > +10, + = 6..10, . = rest):')
for y in range(0, 38, 2):
    row = ''
    for x in range(0, 70, 2):
        d = dev[y:y+2, x:x+2].max()
        row += 'o' if d > 10 else ('+' if d > 6 else '.')
    print(f'y={y+690:3d} {row}')

# also compare against ORIGINAL deviations in the same zone (is it pre-existing fabric structure?)
On = O.mean(axis=2)
subO = On[690:728, 435:505]
locO = ndimage.uniform_filter(subO, size=9)
devO = subO - locO
print('\nORIGINAL dark deviations < -6 in same zone:')
for y in range(0, 38, 2):
    row = ''
    for x in range(0, 70, 2):
        d = devO[y:y+2, x:x+2].min()
        row += '#' if d < -10 else ('+' if d < -6 else '.')
    print(f'y={y+690:3d} {row}')
