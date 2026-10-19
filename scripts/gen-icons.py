#!/usr/bin/env python3
"""Regenerates the PWA/home-screen icons (icons/icon-192.png, icon-512.png,
apple-touch-icon.png). The checkmark color is deliberately tied to the app's
accent color (--accent in css/styles.css, currently #0a84ff) — if that CSS
variable ever changes, update ACCENT below to match and re-run this script.

Usage: python3 scripts/gen-icons.py
"""
import os
from PIL import Image, ImageDraw

ACCENT = (10, 132, 255, 255)  # keep in sync with --accent in css/styles.css

ICONS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")


def make_icon(size, path, radius_ratio=0.22, bg=(255, 255, 255, 255)):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if radius_ratio > 0:
        draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=bg)
    else:
        draw.rectangle([0, 0, size - 1, size - 1], fill=bg)

    sw = max(round(size * 0.10), 3)
    p1 = (size * 0.26, size * 0.52)
    p2 = (size * 0.43, size * 0.70)
    p3 = (size * 0.76, size * 0.30)
    draw.line([p1, p2], fill=ACCENT, width=sw, joint="curve")
    draw.line([p2, p3], fill=ACCENT, width=sw, joint="curve")
    for pt in (p1, p2, p3):
        draw.ellipse([pt[0] - sw / 2, pt[1] - sw / 2, pt[0] + sw / 2, pt[1] + sw / 2], fill=ACCENT)

    img.save(path)


if __name__ == "__main__":
    os.makedirs(ICONS_DIR, exist_ok=True)
    make_icon(192, os.path.join(ICONS_DIR, "icon-192.png"))
    make_icon(512, os.path.join(ICONS_DIR, "icon-512.png"))
    make_icon(180, os.path.join(ICONS_DIR, "apple-touch-icon.png"), radius_ratio=0)
    print("Icons regenerated in", ICONS_DIR)
