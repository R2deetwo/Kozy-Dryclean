#!/usr/bin/env python3
"""Crop the model (in her gold arch frame, holding the KOZY garment bag) out of
the edited flyer image for reuse in the v5 flyer layout."""
from PIL import Image

src = Image.open('/home/z/my-project/work/kozy-brand/flyer-model-garmentbag.png')
W, H = src.size  # 864 x 1152
print('source:', src.size)

# Model + arch frame bounding box (VLM estimate with margin)
# left 15% .. right 84%, top 5% .. bottom 100%
box = (int(W * 0.15), int(H * 0.05), int(W * 0.84), H)
crop = src.crop(box)
crop.save('/home/z/my-project/work/kozy-brand/model-crop.png')
print('cropped:', crop.size, '->', '/home/z/my-project/work/kozy-brand/model-crop.png')

# Also a tight square-ish card crop for previews
box2 = (int(W * 0.14), int(H * 0.04), int(W * 0.85), int(H * 0.99))
src.crop(box2).save('/home/z/my-project/work/kozy-brand/model-crop-wide.png')
print('wide crop saved')
