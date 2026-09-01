#!/usr/bin/env python3
"""Phase 17 — handover image prep:
1. Crop the left 18% of handover-v1 (removes the far-left door frame entirely),
   re-crop to 4:3 and upscale back to 1152x864.
2. Render the exact brand K (public/brand/kozy-mark.svg, gold #D4AF37) to a
   high-res transparent PNG for compositing onto the laundry bag.
Outputs:
   work/image-rev4/handover-cropped.png  (1152x864, door-free, plain bag)
   work/image-rev4/brand-k-alpha.png     (gold K, transparent bg, 800px tall)
"""
from PIL import Image
import cairosvg

DIR = '/home/z/my-project/work/image-rev4'

# ---------- 1. Crop + upscale ----------
img = Image.open(f'{DIR}/handover-v1.png').convert('RGB')
w, h = img.size  # 1152x864
crop_frac = 0.18
new_w = int(w * (1 - crop_frac))  # ~945
img2 = img.crop((int(w * crop_frac), 0, w, h))  # 945x864
# re-crop to 4:3 (target aspect 1152/864 = 4/3)
target_ratio = 1152 / 864
cur_ratio = img2.width / img2.height  # 945/864 = 1.094 < 1.333 -> too tall, crop height
new_h = int(img2.width / target_ratio)
top = (img2.height - new_h) // 2
img3 = img2.crop((0, top, img2.width, top + new_h))  # 945x709
img3 = img3.resize((1152, 864), Image.LANCZOS)
img3.save(f'{DIR}/handover-cropped.png')
print('cropped ->', img3.size)

# ---------- 2. Brand K from SVG ----------
# kozy-mark.svg viewBox="-24 -838 861 896" (837 wide x 896 tall) with a
# scale(1,-1) flip; cairosvg handles the transform. Render at 800px height.
cairosvg.svg2png(
    url='/home/z/Kozy-Dryclean/public/brand/kozy-mark.svg',
    write_to=f'{DIR}/brand-k-alpha.png',
    output_height=800,
)
k = Image.open(f'{DIR}/brand-k-alpha.png')
print('brand K ->', k.size, k.mode)
# Trim transparent margins so the K fills the canvas predictably
alpha = k.split()[-1]
bbox = alpha.getbbox()
k2 = k.crop(bbox)
k2.save(f'{DIR}/brand-k-alpha.png')
print('trimmed brand K ->', k2.size)
