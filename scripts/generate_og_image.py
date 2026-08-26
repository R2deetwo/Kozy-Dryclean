#!/usr/bin/env python3
"""
Generate the Open Graph share image (1200x630) for Kozy Care.

Used as og:image / twitter:image in src/app/layout.tsx — this is the preview
card shown when the site link is shared on WhatsApp, Facebook, X, LinkedIn etc.

Output: public/brand/og-image.png

Design: navy #0A192F background with subtle gold radial glows, the Kozy mark
centered top, Playfair Display headline, Outfit body, gold pill CTA.

Run from the repo root:
    python3 scripts/generate_og_image.py
"""

from PIL import Image, ImageDraw, ImageFilter, ImageFont
import os

# ----- Paths -----
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO = os.path.join(ROOT, "public", "brand", "kozy-mark.png")
OUT = os.path.join(ROOT, "public", "brand", "og-image.png")
FONT_DIR = os.environ.get("KOZY_FONT_DIR", "/tmp/kozy-fonts")

# ----- Brand -----
NAVY = (10, 25, 47)        # #0A192F
NAVY_LIGHT = (27, 58, 95)  # #1B3A5F
GOLD = (212, 175, 55)      # #D4AF37
GOLD_LIGHT = (247, 235, 191)  # #F7EBBF
WHITE = (255, 255, 255)
OFFWHITE = (226, 232, 240)  # slate-100-ish for body text

W, H = 1200, 630


def radial_glow(size, color, alpha):
    """Soft radial glow layer."""
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    cx = size // 2
    for r in range(size // 2, 0, -2):
        a = int(alpha * (1 - r / (size / 2)) ** 2)
        d.ellipse([cx - r, cx - r, cx + r, cx + r], fill=color + (a,))
    return glow.filter(ImageFilter.GaussianBlur(40))


def load_font(filename, size):
    path = os.path.join(FONT_DIR, filename)
    if os.path.exists(path):
        return ImageFont.truetype(path, size)
    # Fallbacks if the brand fonts aren't available
    for fb in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]:
        if os.path.exists(fb):
            return ImageFont.truetype(fb, size)
    raise RuntimeError("No usable font found")


def draw_centered(draw, y, text, font, fill, letter_spacing=0):
    """Draw horizontally centered text. Returns the y baseline of the next line."""
    if letter_spacing:
        # Manual letter-spaced rendering
        widths = [draw.textlength(ch, font=font) for ch in text]
        total = sum(widths) + letter_spacing * (len(text) - 1)
        x = (W - total) / 2
        for ch, w in zip(text, widths):
            draw.text((x, y), ch, font=font, fill=fill)
            x += w + letter_spacing
        return y
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) / 2, y), text, font=font, fill=fill)
    return y


def main():
    # ----- Canvas -----
    img = Image.new("RGBA", (W, H), NAVY + (255,))

    # Subtle gold glows (top-right + bottom-left) for depth
    img.alpha_composite(radial_glow(900, GOLD, 26), (700, -350))
    img.alpha_composite(radial_glow(800, NAVY_LIGHT, 90), (-250, 300))

    # Thin gold border frame (inset) for a premium feel
    d = ImageDraw.Draw(img)
    d.rectangle([28, 28, W - 28, H - 28], outline=GOLD + (90,), width=1)

    # ----- Logo -----
    logo = Image.open(LOGO).convert("RGBA")
    logo_size = 130
    logo = logo.resize((logo_size, logo_size), Image.LANCZOS)
    img.alpha_composite(logo, ((W - logo_size) // 2, 78))

    # ----- Headline (Playfair Display Bold) -----
    h1_font = load_font("playfair.ttf", 64)
    h2_font = load_font("playfair-reg.ttf", 64)
    draw_centered(d, 248, "Uncompromising care.", h1_font, WHITE)
    draw_centered(d, 328, "Exceptional convenience.", h2_font, WHITE)

    # ----- Gold divider -----
    d.line([(W / 2 - 90, 442), (W / 2 + 90, 442)], fill=GOLD + (255,), width=2)
    d.ellipse([W / 2 - 3, 439, W / 2 + 3, 445], fill=GOLD + (255,))

    # ----- Subtext (Outfit Medium) -----
    sub_font = load_font("outfit.ttf", 27)
    draw_centered(
        d,
        470,
        "Premium Drycleaning & Laundry  ·  Pickup & Delivery Across Lagos",
        sub_font,
        OFFWHITE,
    )

    # ----- Gold pill CTA -----
    pill_font = load_font("outfit-bold.ttf", 24)
    pill_text = "Book your pickup  ·  kozycare.ng"
    tw = d.textlength(pill_text, font=pill_font)
    pw, ph = tw + 76, 58
    px, py = (W - pw) // 2, 526
    # Pill shadow + fill
    d.rounded_rectangle([px, py + 3, px + pw, py + ph + 3], radius=ph // 2,
                        fill=(0, 0, 0, 60))
    d.rounded_rectangle([px, py, px + pw, py + ph], radius=ph // 2, fill=GOLD)
    d.text(((W - tw) / 2, py + (ph - 30) / 2), pill_text, font=pill_font, fill=NAVY)

    # ----- Save -----
    img.convert("RGB").save(OUT, "PNG", optimize=True)
    kb = os.path.getsize(OUT) // 1024
    print(f"Saved {OUT} ({kb} KB, {W}x{H})")


if __name__ == "__main__":
    main()
