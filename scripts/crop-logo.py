#!/usr/bin/env python3
"""
Crop the logo/icon from the uploaded image and remove the near-white background.
The background is (243,243,243) — not pure white. The logo is in the center.
Output: transparent PNG to be used as the Kozy Care icon/logo mark.
"""
from PIL import Image
import numpy as np
import os

input_path = '/home/z/my-project/upload/Generated Image August 25, 2026 - 11_04AM.png'
output_path = '/home/z/my-project/public/kozy-icon.png'

# Load the image
img = Image.open(input_path).convert('RGBA')
arr = np.array(img)

print(f"Original size: {img.size}")

# The background is (243,243,243) — use threshold 230 to catch it
bg_threshold = 230
rgb = arr[:, :, :3]
alpha = arr[:, :, 3]

# Content = any pixel that's NOT near-white background
is_bg = np.all(rgb > bg_threshold, axis=2)
is_content = ~is_bg

# Find bounding box of content
rows = np.any(is_content, axis=1)
cols = np.any(is_content, axis=0)

rmin, rmax = np.where(rows)[0][[0, -1]]
cmin, cmax = np.where(cols)[0][[0, -1]]

print(f"Content bounding box: rows {rmin}-{rmax}, cols {cmin}-{cmax}")

# Add padding
padding = 10
rmin = max(0, rmin - padding)
rmax = min(arr.shape[0] - 1, rmax + padding)
cmin = max(0, cmin - padding)
cmax = min(arr.shape[1] - 1, cmax + padding)

print(f"With padding: rows {rmin}-{rmax}, cols {cmin}-{cmax}")

# Crop
cropped = img.crop((cmin, rmin, cmax + 1, rmax + 1))
print(f"Cropped size: {cropped.size}")

# Make it square
w, h = cropped.size
size = max(w, h)
square = Image.new('RGBA', (size, size), (0, 0, 0, 0))
offset = ((size - w) // 2, (size - h) // 2)
square.paste(cropped, offset)

# Make background transparent
arr2 = np.array(square)
rgb2 = arr2[:, :, :3]

# Hard threshold for background
is_bg2 = np.all(rgb2 > bg_threshold, axis=2)
arr2[is_bg2, 3] = 0  # fully transparent

# Feather edge: pixels that are "almost background" get reduced alpha
almost_bg = np.all(rgb2 > 210, axis=2) & ~is_bg2
arr2[almost_bg, 3] = 100  # semi-transparent

result = Image.fromarray(arr2, mode='RGBA')

# Resize to 512x512 for high quality
final = result.resize((512, 512), Image.LANCZOS)
final.save(output_path, 'PNG')

print(f"\nSaved to: {output_path}")
print(f"Final size: {final.size}")
print(f"File size: {os.path.getsize(output_path)} bytes")
