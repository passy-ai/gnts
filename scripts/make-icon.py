#!/usr/bin/env python3
"""Render the gnts.dev app icon (black field, white wordmark, sharp corners).

    python3 scripts/make-icon.py            # writes build/icon.png + build/icon.iconset
    iconutil -c icns build/icon.iconset -o build/icon.icns

The wordmark uses Geist (SemiBold) — the same face the web brand loads — when it
can be fetched, otherwise the best monospace/grotesk this machine has. Pass a
path to reuse a local font: `python3 scripts/make-icon.py /path/Geist-SemiBold.ttf`.
"""
import os
import subprocess
import sys
import tempfile
import urllib.request

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "..", "build")
SIZE = 1024
BG = (10, 10, 10)          # the app's own black, so the icon matches its window
FG = (255, 255, 255)
WORDMARK = "gnts"
SIDE_MARGIN = 0.07         # fraction of the icon width, left and right
GEIST_URL = "https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/geist-sans/Geist-SemiBold.woff2"

FALLBACK_FONTS = [
    "/System/Library/Fonts/Supplemental/Menlo.ttc",
    "/System/Library/Fonts/SFNSMono.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
]


def geist_ttf():
    """Geist as a TTF: from a local file, the repo cache, or the CDN (needs fontTools)."""
    if len(sys.argv) > 1 and os.path.exists(sys.argv[1]):
        return sys.argv[1]
    cache = os.path.join(BUILD, "Geist-SemiBold.ttf")
    if os.path.exists(cache):
        return cache
    try:
        woff2 = os.path.join(tempfile.gettempdir(), "Geist-SemiBold.woff2")
        urllib.request.urlretrieve(GEIST_URL, woff2)
        from fontTools.ttLib import TTFont
        font = TTFont(woff2)
        font.flavor = None
        font.save(cache)
        return cache
    except Exception as error:  # offline, or fontTools/brotli missing
        print("  (Geist unavailable: %s)" % error)
        return None


def pick_font(size):
    path = geist_ttf()
    if path:
        print("  font: Geist (%s)" % os.path.basename(path))
        return ImageFont.truetype(path, size)
    for candidate in FALLBACK_FONTS:
        if os.path.exists(candidate):
            print("  font: %s" % candidate)
            return ImageFont.truetype(candidate, size)
    raise SystemExit("no usable font found")


def fit_font(text, target_width, probe=200):
    """Largest size whose rendered width stays inside target_width."""
    size = probe
    while size > 8:
        font = pick_font(size) if size == probe else ImageFont.truetype(LAST_FONT[0], size)
        width = font.getbbox(text)[2] - font.getbbox(text)[0]
        if width <= target_width:
            return font
        size -= 4
    return font


LAST_FONT = [None]


def main():
    os.makedirs(BUILD, exist_ok=True)
    image = Image.new("RGB", (SIZE, SIZE), BG)
    draw = ImageDraw.Draw(image)

    font = pick_font(200)
    LAST_FONT[0] = getattr(font, "path", None)
    # grow until the wordmark fills the width minus the margins
    target = SIZE * (1 - 2 * SIDE_MARGIN)
    best = font
    for size in range(120, 460, 4):
        candidate = ImageFont.truetype(font.path, size)
        box = candidate.getbbox(WORDMARK)
        if box[2] - box[0] <= target:
            best = candidate
        else:
            break

    box = best.getbbox(WORDMARK)
    width = box[2] - box[0]
    # Centre on the cap box, not the full box: the descender of the "g" would
    # otherwise push the wordmark up and off the optical middle.
    caps = best.getbbox("GNTSDEV")
    x = (SIZE - width) / 2 - box[0]
    y = SIZE / 2 - (caps[1] + caps[3]) / 2
    draw.text((x, y), WORDMARK, font=best, fill=FG)

    png = os.path.join(BUILD, "icon.png")
    image.save(png)
    print("  wrote %s (%dx%d, wordmark %dpx)" % (png, SIZE, SIZE, width))

    iconset = os.path.join(BUILD, "icon.iconset")
    os.makedirs(iconset, exist_ok=True)
    for size in (16, 32, 64, 128, 256, 512, 1024):
        scaled = image.resize((size, size), Image.LANCZOS)
        scaled.save(os.path.join(iconset, "icon_%dx%d.png" % (size, size)))
        if size <= 512:
            scaled.resize((size * 2, size * 2), Image.LANCZOS).save(
                os.path.join(iconset, "icon_%dx%d@2x.png" % (size, size)))
    print("  wrote %s (run iconutil to build icon.icns)" % iconset)


if __name__ == "__main__":
    main()
