"""Makes desktop/build/icon.ico (the Windows app, installer and shortcut icon) from the app icon, assets/icon.png.

Windows draws app icons as they are, so the square app icon gets softly rounded corners; each size is resampled
from the full-size art. Run from anywhere: python3 -B desktop/scripts/make-icon.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

DESKTOP = Path(__file__).resolve().parent.parent
SOURCE = DESKTOP.parent / "assets" / "icon.png"
TARGET = DESKTOP / "build" / "icon.ico"
SIZES = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]
CORNER = 0.18  # corner radius as a share of the side
SUPERSAMPLE = 4

art = Image.open(SOURCE).convert("RGBA")
side = 256 * SUPERSAMPLE
art = art.resize((side, side), Image.LANCZOS)
mask = Image.new("L", (side, side), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, side - 1, side - 1), radius=round(side * CORNER), fill=255)
art.putalpha(mask)
big = art.resize((256, 256), Image.LANCZOS)

TARGET.parent.mkdir(parents=True, exist_ok=True)
big.save(TARGET, format="ICO", sizes=[(s, s) for s in SIZES])
print(f"wrote {TARGET.relative_to(DESKTOP.parent)} ({TARGET.stat().st_size // 1024} KB, {len(SIZES)} sizes)")
