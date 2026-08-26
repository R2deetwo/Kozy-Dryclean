"""Render Kozy catalogue icons at actual display size (28px = h-7 w-7 in booking wizard)
and produce:
  - before/after comparison image for each of the 14 changed icons
  - one combined contact sheet of all 25 catalogue icons (21 fixed + 4 new shoes)
    plus 4 shoe-only detail panel
"""
import os
import cairosvg
from PIL import Image, ImageDraw, ImageFont
import io

BASE = "/home/z/my-project"
BEFORE_DIR = f"{BASE}/download/icon-verification/before"
ICON_DIR = f"{BASE}/public/icons/services"
OUT_DIR = f"{BASE}/download/icon-verification"

# Brand colors used by the Kozy app (from src/app/globals.css)
NAVY = (10, 25, 47)          # #0A192F  — main brand navy (used on the booking wizard button bg)
NAVY_300 = (109, 132, 158)   # muted gray-blue (used for "Pick your garments" old label)
GOLD = (212, 175, 55)         # #D4AF37  — brand gold accent
LINEN_BG = (250, 247, 242)    # pale background used on customer landing
WHITE = (255, 255, 255)
TEXT = (20, 30, 50)

# The wizard renders icons at h-7 w-7 = 28px on a white-ish card.
# The landing renders at h-5 w-5 = 20px (also displayed via invert filter, but we keep navy here).
RENDER_PX = 28

# --- helper: render an SVG to a PIL Image at given px size, with currentColor substituted
def svg_to_png(svg_path: str, size_px: int, stroke_color: str, accent_color: str = "#D4AF37") -> Image.Image:
    """Render SVG with currentColor (outline) replaced by stroke_color, keep #D4AF37 as gold accent."""
    with open(svg_path, "r", encoding="utf-8") as f:
        svg = f.read()
    # Replace currentColor (the outline stroke) with the desired brand color.
    svg = svg.replace("currentColor", stroke_color)
    png_bytes = cairosvg.svg2png(bytestring=svg.encode("utf-8"), output_width=size_px, output_height=size_px)
    return Image.open(io.BytesIO(png_bytes)).convert("RGBA")


def paste_icon_on_canvas(img: Image.Image, bg: tuple, size_px: int, pad: int = 0) -> Image.Image:
    """Composite the icon over a flat background of given size."""
    canvas = Image.new("RGBA", (size_px + pad * 2, size_px + pad * 2), bg + (255,))
    canvas.alpha_composite(img, (pad, pad))
    return canvas


# Try to load a decent font
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


FONT_LABEL = load_font(16)
FONT_SMALL = load_font(13)
FONT_TINY = load_font(11)
FONT_HEAD = load_font(22)


# =====================================================================
# PART 1: before/after comparisons for the 14 changed icons
# =====================================================================
CHANGED = [
    ("agbada", "Agbada"),
    ("kaftan", "Kaftan"),
    ("iro-buba", "Iro & Buba"),
    ("blazer", "Blazer"),
    ("suit", "Suit (2-Piece)"),
    ("suit-3pc", "Suit (3-Piece)"),
    ("ankara-gown", "Ankara Gown"),
    ("bedsheet", "Bedsheet"),
    ("towel", "Towel"),
    ("trouser", "Trousers"),
    ("jeans", "Jeans"),
    ("hats", "Hat"),
    ("native-cap", "Native Cap"),
    ("socks", "Socks"),
]

# Render at 4x actual display size so the diff is visible (then save the PNG).
RENDER_BIG = RENDER_PX * 4  # 112px
PAD = 24
LABEL_H = 50

for svg_id, label in CHANGED:
    before_path = f"{BEFORE_DIR}/{svg_id}.svg"
    after_path = f"{ICON_DIR}/{svg_id}.svg"

    if not os.path.exists(before_path) or not os.path.exists(after_path):
        print(f"  SKIP {svg_id} — missing file")
        continue

    before_img = svg_to_png(before_path, RENDER_BIG, stroke_color="#0A192F")
    after_img = svg_to_png(after_path, RENDER_BIG, stroke_color="#0A192F")

    # composite each over a soft white-ish card background (matches booking wizard card)
    before_canvas = paste_icon_on_canvas(before_img, (255, 255, 255), RENDER_BIG, pad=PAD)
    after_canvas = paste_icon_on_canvas(after_img, (255, 255, 255), RENDER_BIG, pad=PAD)

    cell_w = RENDER_BIG + PAD * 2
    cell_h = RENDER_BIG + PAD * 2 + LABEL_H
    # left panel = before, middle = separator, right = after
    sheet = Image.new("RGBA", (cell_w * 2 + 40, cell_h + 30), LINEN_BG + (255,))
    draw = ImageDraw.Draw(sheet)

    # column headers
    draw.text((20, 6), "BEFORE", fill=NAVY_300, font=FONT_LABEL)
    draw.text((cell_w + 40 + 20, 6), "AFTER", fill=NAVY, font=FONT_LABEL)

    # paste icons
    sheet.alpha_composite(before_canvas, (20, 30))
    sheet.alpha_composite(after_canvas, (cell_w + 40 + 20, 30))

    # labels under each icon
    draw.text((20, cell_h - 4), f"{label} (old)", fill=NAVY_300, font=FONT_SMALL)
    draw.text((cell_w + 40 + 20, cell_h - 4), f"{label} (new)", fill=NAVY, font=FONT_SMALL)

    out_path = f"{OUT_DIR}/compare_{svg_id}.png"
    sheet.save(out_path)
    print(f"  ✓ {out_path}")


# =====================================================================
# PART 2: Contact sheet of all 25 catalogue icons (post-fix)
# Catalogue order matches GARMENT_CATALOG in src/lib/types.ts
# =====================================================================
CATALOG = [
    ("shirt", "Shirt", "Shirts & Tops"),
    ("longsleeve", "Long-Sleeve Shirt", "Shirts & Tops"),
    ("trouser", "Trousers", "Trousers"),
    ("jeans", "Jeans", "Trousers"),
    ("suit", "Suit (2-Piece)", "Suits & Blazers"),
    ("suit-3pc", "Suit (3-Piece)", "Suits & Blazers"),
    ("blazer", "Blazer", "Suits & Blazers"),
    ("agbada", "Agbada", "Traditional"),
    ("iro-buba", "Iro & Buba", "Traditional"),
    ("kaftan", "Kaftan", "Traditional"),
    ("ankara-gown", "Ankara Gown", "Traditional"),
    ("bedsheet", "Bedsheet", "Household"),
    ("duvet", "Duvet", "Household"),
    ("curtain", "Curtain", "Household"),
    ("towel", "Towel", "Household"),
    ("native-cap", "Native Cap", "Extras"),
    ("tie", "Tie", "Extras"),
    ("singlet", "Singlet", "Shirts & Tops"),
    ("underwear", "Men's Underwear", "Extras"),
    ("socks", "Socks (pair)", "Extras"),
    ("hats", "Hat", "Extras"),
    # NEW — shoes
    ("sneakers-white", "Sneakers (White)", "Shoes & Sneakers"),
    ("sneakers-coloured", "Sneakers (Coloured)", "Shoes & Sneakers"),
    ("leather-shoes", "Leather Shoes", "Shoes & Sneakers"),
    ("suede-shoes", "Suede Shoes", "Shoes & Sneakers"),
]

# Layout: 5 columns × 5 rows = 25 cells.
# Each cell: icon (rendered at 96px) + label + category.
CELL = 130
COLS = 5
ROWS = 5
HEADER_H = 60
LABEL_H = 50
W = COLS * CELL + 40
H = ROWS * CELL + HEADER_H + LABEL_H + 40

sheet = Image.new("RGBA", (W, H), LINEN_BG + (255,))
draw = ImageDraw.Draw(sheet)

# Header
draw.text((20, 18), "Kozy Dryclean — Catalogue contact sheet (post-fix)", fill=NAVY, font=FONT_HEAD)
draw.text((20, 44), "All 25 items rendered at 96px (≈3.4× the 28px wizard display size).", fill=NAVY_300, font=FONT_SMALL)

ICON_RENDER = 96
ICON_PAD = (CELL - ICON_RENDER) // 2

for idx, (svg_id, name, category) in enumerate(CATALOG):
    row = idx // COLS
    col = idx % COLS
    x = 20 + col * CELL
    y = HEADER_H + row * CELL

    # Cell background: rounded card with subtle border
    draw.rounded_rectangle([x + 4, y + 4, x + CELL - 4, y + CELL - 4], radius=8, fill=WHITE + (255,), outline=NAVY_300 + (120,), width=1)

    svg_path = f"{ICON_DIR}/{svg_id}.svg"
    if not os.path.exists(svg_path):
        draw.text((x + 12, y + 50), f"missing\n{svg_id}", fill=(200, 0, 0), font=FONT_TINY)
        continue

    # Render in navy outline (matches booking wizard "white card + navy icon" treatment)
    icon = svg_to_png(svg_path, ICON_RENDER, stroke_color="#0A192F")
    sheet.alpha_composite(icon, (x + ICON_PAD, y + 10))

    # Label + category below the icon
    draw.text((x + 10, y + CELL - 36), name, fill=NAVY, font=FONT_SMALL)
    draw.text((x + 10, y + CELL - 18), category, fill=GOLD, font=FONT_TINY)

out_path = f"{OUT_DIR}/contact_sheet_all_25.png"
sheet.save(out_path)
print(f"  ✓ {out_path}")


# =====================================================================
# PART 3: Shoes-only detail panel (so the 4 new shoe icons are easy to verify)
# =====================================================================
SHOES = [
    ("sneakers-white", "Sneakers (White)", "₦1,000"),
    ("sneakers-coloured", "Sneakers (Coloured)", "₦1,200"),
    ("leather-shoes", "Leather Shoes", "₦1,000"),
    ("suede-shoes", "Suede Shoes", "₦2,000"),
]

SHOE_CELL = 220
SHOE_COLS = 4
SHOE_ROWS = 1
SHOE_HEADER_H = 60
SHOE_LABEL_H = 80
SW = SHOE_CELL * SHOE_COLS + 40
SH = SHOE_CELL * SHOE_ROWS + SHOE_HEADER_H + SHOE_LABEL_H + 20

shoe_sheet = Image.new("RGBA", (SW, SH), LINEN_BG + (255,))
draw = ImageDraw.Draw(shoe_sheet)
draw.text((20, 18), "NEW — Shoes category (added to catalogue)", fill=NAVY, font=FONT_HEAD)
draw.text((20, 44), "Rendered at 128px so sneaker lace / loafer strap / suede texture detail is visible.", fill=NAVY_300, font=FONT_SMALL)

SHOE_RENDER = 128
SHOE_ICON_PAD = (SHOE_CELL - SHOE_RENDER) // 2

for idx, (svg_id, name, price) in enumerate(SHOES):
    x = 20 + idx * SHOE_CELL
    y = SHOE_HEADER_H
    draw.rounded_rectangle([x + 4, y + 4, x + SHOE_CELL - 4, y + SHOE_CELL - 4], radius=8, fill=WHITE + (255,), outline=GOLD + (180,), width=1)
    icon = svg_to_png(f"{ICON_DIR}/{svg_id}.svg", SHOE_RENDER, stroke_color="#0A192F")
    shoe_sheet.alpha_composite(icon, (x + SHOE_ICON_PAD, y + 10))
    draw.text((x + 12, y + SHOE_CELL + 8), name, fill=NAVY, font=FONT_SMALL)
    draw.text((x + 12, y + SHOE_CELL + 30), price, fill=GOLD, font=FONT_LABEL)

out_path = f"{OUT_DIR}/shoes_detail_panel.png"
shoe_sheet.save(out_path)
print(f"  ✓ {out_path}")

print("\nDone.")
