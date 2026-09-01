"""Render true actual-size (28px) thumbnails of every catalogue icon
so it's possible to confirm at a glance that the icons still read
correctly at the exact size they appear in the booking wizard
(h-7 w-7 = 28px in Tailwind).
"""
import os
import cairosvg
from PIL import Image, ImageDraw, ImageFont
import io

BASE = "/home/z/my-project"
ICON_DIR = f"{BASE}/public/icons/services"
OUT_DIR = f"{BASE}/download/icon-verification"

NAVY = (10, 25, 47)
NAVY_300 = (109, 132, 158)
GOLD = (212, 175, 55)
LINEN_BG = (250, 247, 242)
WHITE = (255, 255, 255)

CATALOG = [
    ("shirt", "Shirt"),
    ("longsleeve", "Long-Sleeve"),
    ("trouser", "Trousers"),
    ("jeans", "Jeans"),
    ("suit", "Suit 2pc"),
    ("suit-3pc", "Suit 3pc"),
    ("blazer", "Blazer"),
    ("agbada", "Agbada"),
    ("iro-buba", "Iro & Buba"),
    ("kaftan", "Kaftan"),
    ("ankara-gown", "Ankara Gown"),
    ("bedsheet", "Bedsheet"),
    ("duvet", "Duvet"),
    ("curtain", "Curtain"),
    ("towel", "Towel"),
    ("native-cap", "Native Cap"),
    ("tie", "Tie"),
    ("singlet", "Singlet"),
    ("underwear", "Underwear"),
    ("socks", "Socks"),
    ("hats", "Hat"),
    ("sneakers-white", "Sneakers W"),
    ("sneakers-coloured", "Sneakers C"),
    ("leather-shoes", "Leather"),
    ("suede-shoes", "Suede"),
]

def load_font(size: int):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    ]
    for c in candidates:
        if os.path.exists(c):
            try:
                return ImageFont.truetype(c, size)
            except Exception:
                pass
    return ImageFont.load_default()


FONT_LABEL = load_font(11)
FONT_HEAD = load_font(18)
FONT_SMALL = load_font(12)

TRUE_PX = 28  # exact size used in booking-wizard (h-7 w-7)
PAD = 8
CELL = TRUE_PX + PAD * 2  # 44px per cell
LABEL_H = 18
COLS = 5
ROWS = (len(CATALOG) + COLS - 1) // COLS
HEADER_H = 60
W = COLS * CELL + 40
H = ROWS * CELL + HEADER_H + LABEL_H + 40

sheet = Image.new("RGBA", (W, H), LINEN_BG + (255,))
draw = ImageDraw.Draw(sheet)
draw.text((20, 14), "Actual display size — 28px (h-7 w-7 in booking wizard)", fill=NAVY, font=FONT_HEAD)
draw.text((20, 38), "Each icon rendered at exactly 28px, the size customers see.", fill=NAVY_300, font=FONT_SMALL)

for idx, (svg_id, name) in enumerate(CATALOG):
    row = idx // COLS
    col = idx % COLS
    x = 20 + col * CELL
    y = HEADER_H + row * CELL + LABEL_H

    # white card background
    draw.rounded_rectangle([x + 1, y + 1, x + CELL - 1, y + CELL - 1], radius=4, fill=WHITE + (255,), outline=NAVY_300 + (80,), width=1)

    svg_path = f"{ICON_DIR}/{svg_id}.svg"
    if not os.path.exists(svg_path):
        continue
    with open(svg_path, "r", encoding="utf-8") as f:
        svg = f.read().replace("currentColor", "#0A192F")
    png_bytes = cairosvg.svg2png(bytestring=svg.encode("utf-8"), output_width=TRUE_PX, output_height=TRUE_PX)
    icon = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    sheet.alpha_composite(icon, (x + PAD, y + PAD))

    # tiny label below
    draw.text((x + 1, y + CELL + 1), name, fill=NAVY, font=FONT_LABEL)

out_path = f"{OUT_DIR}/actual_size_28px_all_25.png"
sheet.save(out_path)
print(f"✓ {out_path}")
