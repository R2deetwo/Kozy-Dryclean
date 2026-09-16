#!/bin/bash
# gen_newsletter_banners.sh — 13 brand email-header banners (1440x720),
# NO text/letters/logos (the wordmark is HTML text in the email wrapper,
# never AI-rendered). Sequential z-ai calls — background jobs die silently.
set -e
OUT=/home/z/my-project/work/kozy-brand/newsletter-banners
mkdir -p "$OUT"
cd "$OUT"

P() { z-ai image -p "$2" -o "$OUT/$1.png" -s 1440x720 >/dev/null 2>&1 && echo "OK $1" || echo "FAIL $1"; }

P hero-navy-gold "Luxury email header banner background, wide horizontal composition, deep navy blue backdrop with an elegant diagonal sweep of champagne gold silk fabric folds on the right side, soft golden light glow from the top left corner, subtle gold dust particles, premium drycleaning brand aesthetic, calm generous negative space across the centre, photorealistic fabric texture, absolutely no text, no letters, no words, no numbers, no logos, no watermark"

P promo-gold "Festive luxury email header banner background, wide horizontal composition, deep navy blue backdrop with champagne gold confetti pieces gently falling, tiny gold ribbons and shimmering gold bokeh dots, celebration mood, premium brand aesthetic, calm negative space in the centre, soft studio lighting, absolutely no text, no letters, no words, no numbers, no logos, no watermark"

P tips-fabric "Luxury email header banner background, wide horizontal composition, close-up of crisp white cotton shirt fabric with elegant soft folds and a single thin champagne gold thread accent, gentle top light, tailor shop craftsmanship feel, deep navy blue border fading at the edges, calm negative space, photorealistic macro fabric texture, absolutely no text, no letters, no words, no numbers, no logos, no watermark"

P service-express "Luxury email header banner background, wide horizontal composition, deep navy blue backdrop with smooth flowing champagne gold light streaks moving horizontally from left to right suggesting speed and swift motion, gentle steam wisps curling elegantly at the right edge, dynamic yet calm premium aesthetic, generous negative space in the centre, absolutely no text, no letters, no words, no numbers, no logos, no watermark"

P service-pickup "Luxury email header banner background, wide horizontal composition, deep navy blue backdrop with an elegant row of clothes hangers in silhouette with freshly cleaned garments hanging in a row along the bottom edge, soft champagne gold rim light on each garment edge, premium wardrobe feel, generous negative space above, minimal and clean, absolutely no text, no letters, no words, no numbers, no logos, no watermark"

P corporate-navy "Luxury email header banner background, wide horizontal composition, deep navy blue backdrop with an elegant crisp white business shirt collar and dark suit lapel abstract arrangement at the lower right, subtle champagne gold tie stripe accent, corporate premium aesthetic, calm negative space on the left, soft directional studio lighting, photorealistic fabric detail, absolutely no text, no letters, no words, no numbers, no logos, no watermark"

P seasonal-newyear "Luxury email header banner background, wide horizontal composition, deep navy blue night sky with elegant champagne gold fireworks bokeh far in the distance, soft gold shimmer particles rising, hopeful new year celebration mood, premium brand aesthetic, generous calm negative space in the centre, absolutely no text, no letters, no words, no numbers, no logos, no watermark"

P seasonal-valentine "Luxury email header banner background, wide horizontal composition, deep burgundy cranberry red backdrop with an elegant champagne gold satin ribbon draped in a soft curve, one subtle small gold heart outline accent, romantic yet refined premium aesthetic, gentle bokeh, generous negative space, absolutely no text, no letters, no words, no numbers, no logos, no watermark"

P seasonal-easter "Luxury email header banner background, wide horizontal composition, warm cream ivory backdrop with elegant champagne gold decorative festive pattern of thin lines and dots in the corners, fresh spring brightness, subtle soft yellow light glow, premium celebration aesthetic, generous negative space in the centre, absolutely no text, no letters, no words, no numbers, no logos, no watermark"

P seasonal-eid "Luxury email header banner background, wide horizontal composition, deep emerald green backdrop with elegant gold crescent moon ornament and hanging golden Moroccan lanterns at the upper right, delicate gold stars and geometric arabesque pattern fading into the dark, festive mubarak celebration mood, premium aesthetic, generous negative space, absolutely no text, no letters, no words, no numbers, no logos, no watermark"

P seasonal-independence "Luxury email header banner background, wide horizontal composition, deep green backdrop with elegant flowing vertical ribbons in white and gold sweeping gently upward, festive Nigerian independence celebration mood, refined premium aesthetic, soft gold bokeh, generous calm negative space in the centre, absolutely no text, no letters, no words, no numbers, no logos, no watermark"

P seasonal-christmas "Luxury email header banner background, wide horizontal composition, deep navy blue backdrop with elegant champagne gold and cranberry red Christmas ornaments, thin gold ribbon and a few pine branch needles arranged along the bottom edge, warm gentle bokeh lights, refined holiday premium aesthetic, generous negative space above, absolutely no text, no letters, no words, no numbers, no logos, no watermark"

P seasonal-owambe "Luxury email header banner background, wide horizontal composition, deep navy blue backdrop with vibrant champagne gold Nigerian aso-oke lace fabric texture sweeping diagonally, traditional cowrie and gold bead accents, falling gold confetti celebration mood, festive owambe party aesthetic, generous negative space in the upper area, photorealistic fabric detail, absolutely no text, no letters, no words, no numbers, no logos, no watermark"

echo "ALL DONE"; ls -la "$OUT"/*.png | wc -l
