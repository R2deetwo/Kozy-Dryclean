#!/bin/bash
# Kozy-Dryclean logo concept exploration — 6 AI directions
# All: deep navy #0A192F background, flat champagne gold mark, no gradients, no text
# Goal: explore icon executions; final production logo will be rebuilt as true vector.
set -e
OUT=/home/z/my-project/download/kozy-brand/logo/concepts
mkdir -p "$OUT"

z-ai image -p "Minimalist luxury logo mark for a premium dry-cleaning brand: one elegant high-contrast serif capital letter K in flat champagne gold, perfectly centered inside a single thin gold circular ring, solid deep navy blue background, flat vector logo design, no gradients, no shadows, no text, no words, generous negative space, refined fashion-house monogram emblem style" -o "$OUT/concept-1-ring-monogram.png" -s 1024x1024
echo "done 1"

z-ai image -p "Minimalist flat logo mark: a wire clothes hanger silhouette cleverly forming the shape of the letter K, drawn as one continuous thin gold line, luxury dry cleaning brand, solid deep navy blue background, flat vector design, no gradients, no text, no words, simple, clean, iconic" -o "$OUT/concept-2-hanger-k.png" -s 1024x1024
echo "done 2"

z-ai image -p "Elegant serif capital letter K where the upper diagonal arm curls at its tip into a subtle clothes-hanger hook curve, thin refined flat gold strokes on a solid deep navy blue background, flat minimal vector logo, no text, no words, luxury brand mark, lots of negative space, high contrast serif typography form" -o "$OUT/concept-3-k-hook.png" -s 1024x1024
echo "done 3"

z-ai image -p "Classic premium laundry emblem: one minimal thin-line gold clothes hanger centered inside a thin double-line circular frame, two tiny gold sparkle accents, flat champagne gold on solid deep navy blue background, flat vector emblem logo, no gradients, no text, no words, timeless and classy" -o "$OUT/concept-4-emblem.png" -s 1024x1024
echo "done 4"

z-ai image -p "Ultra-minimal abstract logo: a single flowing golden calligraphic line that forms both a clothes hanger and the letter K in one continuous gesture, thin elegant stroke, luxury minimalism, flat gold on solid deep navy blue background, flat vector, no gradients, no text, no words" -o "$OUT/concept-5-calligraphic.png" -s 1024x1024
echo "done 5"

z-ai image -p "Geometric minimal luxury logo: a stylized gold clothes hanger built from clean straight lines, where the hanger hook and shoulders create the letter K silhouette through clever negative space, flat champagne gold on solid deep navy blue, flat vector logo, no gradients, no text, no words, architectural precision" -o "$OUT/concept-6-geometric.png" -s 1024x1024
echo "done 6"

ls -la "$OUT"
