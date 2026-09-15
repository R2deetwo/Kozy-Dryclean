#!/usr/bin/env python3
"""Extract all embedded raster data-URIs from current-set HTML sources,
save them as PNGs, and report dimensions so we can spot photos vs QR codes."""
import os, re, base64, struct

ROOT = '/home/z/my-project/download/kozy-brand'
OUT = '/home/z/my-project/work/kozy-brand/finger-audit/extracted'
os.makedirs(OUT, exist_ok=True)

# Folders that make up the CURRENT set (v5.1 kit + v6 + v9.1)
CURRENT = [
    'v5.1-hotel-corporate-update',
    'v6-name-and-series-update',
    'v9.1-bag-social-and-owambe-fix',
]

def png_size(data):
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        w, h = struct.unpack('>II', data[16:24])
        return w, h
    if data[:2] == b'\xff\xd8':  # jpeg
        i = 2
        while i < len(data):
            if data[i] != 0xFF:
                i += 1; continue
            marker = data[i+1]
            if marker in (0xC0, 0xC1, 0xC2, 0xC3):
                h, w = struct.unpack('>HH', data[i+5:i+9])
                return w, h
            seglen = struct.unpack('>H', data[i+2:i+4])[0]
            i += 2 + seglen
    return None, None

results = []
for folder in CURRENT:
    for root, dirs, files in os.walk(os.path.join(ROOT, folder)):
        for fn in files:
            if not fn.endswith('.html'):
                continue
            p = os.path.join(root, fn)
            rel = os.path.relpath(p, ROOT)
            with open(p, 'r', errors='ignore') as f:
                html = f.read()
            for m in re.finditer(r'data:image/(png|jpeg);base64,([A-Za-z0-9+/=]+)', html):
                kind, b64 = m.group(1), m.group(2)
                try:
                    data = base64.b64decode(b64)
                except Exception:
                    continue
                w, h = png_size(data)
                idx = len(results)
                ext = 'png' if kind == 'png' else 'jpg'
                out = os.path.join(OUT, f'img{idx:02d}_{w}x{h}.{ext}')
                with open(out, 'wb') as f:
                    f.write(data)
                results.append((rel, out, w, h, len(data)))

for rel, out, w, h, sz in results:
    print(f'{w}x{h}  {sz//1024}KB  {rel}  ->  {os.path.basename(out)}')
print(f'\nTotal: {len(results)} embedded images')
