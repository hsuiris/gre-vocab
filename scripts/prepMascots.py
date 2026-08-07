"""Turn the raw ChatGPT mascot art into sprites the app can actually use.

Run:  python3 scripts/prepMascots.py
In:   assets/mascots/raw/*.png
Out:  assets/mascots/*.png

Three things go wrong with generated sticker art, and this fixes all three:

1. The background remover punched holes THROUGH the character. On the girl
   sheet her face is alpha 0 and her hair sits at alpha 190, so on anything but
   a white screen she shows up as a ghost. Flood-filling from the corners finds
   the real background; everything the flood cannot reach is the character and
   gets flattened onto white at full opacity.
2. That same removal drained the warmth out of her hair, leaving it grey-olive.
   Olive pixels are re-mapped onto a chestnut ramp that keeps the original
   shading.
3. Every drawing floats in a mostly empty 1024px canvas. Cropping to the
   subject means a sprite rendered at 120pt is 120pt of character, not 30pt of
   character and a lot of nothing.
"""

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets" / "mascots" / "raw"
OUT = ROOT / "assets" / "mascots"

TRANSPARENT = 8  # alpha at or below this counts as background
OUT_SIZE = 512  # plenty for a 150pt sprite on a 3x screen
PAD = 0.04  # breathing room around the subject, as a fraction of its size

SKIN = (250, 222, 202)
# Face, arms and hands were erased along with the background, and so were the
# white knee socks. Measured on the source sheet, every skin hole starts above
# 74% of the figure's height and every sock hole starts below it, so one line
# separates "paint this skin" from "leave this white".
SOCK_LINE = 0.74


KEY_SOLID = 60  # at this distance from the key colour a pixel is pure background
KEY_EDGE = 200  # beyond this it is pure character; between the two it is an edge


def despill(r: int, g: int, b: int, key: tuple[int, int, int]) -> tuple[int, int, int]:
    """Drain leftover key colour from a pixel without touching real colours.

    Magenta spill shows up as red AND blue both running well above green. Her
    coral blush keeps blue below green and her open mouth keeps red far ahead of
    blue, so neither trips this.
    """
    channels = [r, g, b]
    high = [i for i, v in enumerate(key) if v > 127]  # magenta keys on red+blue
    low = [i for i in range(3) if i not in high]
    if not low:
        return r, g, b
    floor = min(channels[i] for i in low)
    if min(channels[i] for i in high) - floor <= 40:
        return r, g, b
    for i in high:
        channels[i] = min(channels[i], floor + 40)
    return channels[0], channels[1], channels[2]


def chroma_key(im: Image.Image) -> Image.Image:
    """Cut a solid-colour background out, keeping the character untouched.

    This is the path to prefer. Art generated straight onto transparency loses
    whatever inside the character resembled the background — mouth interiors,
    blush, the line between a thigh and a sock — and no amount of repair brings
    those back, because the pixels are simply gone. Art generated on a solid
    colour that appears nowhere in the character keeps all of it.

    The cut is soft: an antialiased edge pixel is part background, so it becomes
    part transparent rather than being kept whole (a coloured halo) or dropped
    whole (a jagged outline).
    """
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    key = px[0, 0][:3]

    def distance(x: int, y: int) -> int:
        r, g, b, _ = px[x, y]
        return abs(r - key[0]) + abs(g - key[1]) + abs(b - key[2])

    # Flood from the corners so a background-coloured detail inside the
    # character is never cut out. Edge pixels are walkable, so the flood reaches
    # right up to the outline.
    background = bytearray(w * h)
    queue = deque()
    for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        if distance(x, y) < KEY_EDGE and not background[y * w + x]:
            background[y * w + x] = 1
            queue.append((x, y))
    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not background[ny * w + nx]:
                if distance(nx, ny) < KEY_EDGE:
                    background[ny * w + nx] = 1
                    queue.append((nx, ny))

    for y in range(h):
        row = y * w
        for x in range(w):
            r, g, b, _ = px[x, y]
            if not background[row + x]:
                px[x, y] = (*despill(r, g, b, key), 255)
                continue
            d = distance(x, y)
            if d <= KEY_SOLID:
                px[x, y] = (0, 0, 0, 0)
            else:
                coverage = (d - KEY_SOLID) / (KEY_EDGE - KEY_SOLID)
                px[x, y] = (*despill(r, g, b, key), round(coverage * 255))
    return im


def mostly_opaque(im: Image.Image) -> bool:
    """True when the art arrived on a solid background rather than alpha."""
    alpha = im.convert("RGBA").getchannel("A")
    lo, hi = alpha.getextrema()
    return lo > 8  # nothing transparent anywhere


def solidify(im: Image.Image, skin: bool = False) -> Image.Image:
    """Make the character fully opaque and the true background fully clear.

    With ``skin`` set, holes the flood cannot reach are painted as skin rather
    than left white — everything below SOCK_LINE stays white, being socks.
    """
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()

    # Flood from all four corners. Only genuine background is reachable; a
    # transparent face is walled in by the character's outline.
    outside = bytearray(w * h)
    queue = deque()
    for start in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        x, y = start
        if px[x, y][3] <= TRANSPARENT and not outside[y * w + x]:
            outside[y * w + x] = 1
            queue.append(start)
    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not outside[ny * w + nx]:
                if px[nx, ny][3] <= TRANSPARENT:
                    outside[ny * w + nx] = 1
                    queue.append((nx, ny))

    skin_rows = set()
    if skin:
        body = [y for y in range(h) if any(not outside[y * w + x] for x in range(w))]
        if body:
            top, bottom = body[0], body[-1]
            cutoff = top + (bottom - top) * SOCK_LINE
            skin_rows = {y for y in range(h) if y < cutoff}

    for y in range(h):
        row = y * w
        for x in range(w):
            r, g, b, a = px[x, y]
            if outside[row + x]:
                px[x, y] = (0, 0, 0, 0)
            elif a <= TRANSPARENT:
                # An erased part of the character, not a colour to recover.
                px[x, y] = (*SKIN, 255) if y in skin_rows else (255, 255, 255, 255)
            elif a < 255:
                # Composite over white, which is what the artwork assumed.
                blend = a / 255
                px[x, y] = (
                    round(r * blend + 255 * (1 - blend)),
                    round(g * blend + 255 * (1 - blend)),
                    round(b * blend + 255 * (1 - blend)),
                    255,
                )
    return im


def warm_hair(im: Image.Image) -> Image.Image:
    """Re-map the drained olive hair onto chestnut, shading and all.

    Only olive qualifies: red and green close together, blue clearly lower,
    mid luminance. The blue dress (blue highest), the white skin and cat (no
    channel spread) and the near-black shoes (too dark) are all left alone.
    """
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if abs(r - g) < 25 and r - b >= 10 and 70 <= r <= 215:
                lum = 0.299 * r + 0.587 * g + 0.114 * b
                px[x, y] = (
                    min(255, round(lum * 1.16)),
                    min(255, round(lum * 0.80)),
                    min(255, round(lum * 0.58)),
                    a,
                )
    return im


def columns_with_content(im: Image.Image) -> list[tuple[int, int]]:
    """Column ranges holding a subject, so a multi-pose sheet can be split."""
    alpha = im.getchannel("A")
    w, h = im.size
    filled = [any(alpha.getpixel((x, y)) > 0 for y in range(0, h, 4)) for x in range(w)]
    spans, start = [], None
    for x, has in enumerate(filled):
        if has and start is None:
            start = x
        elif not has and start is not None:
            spans.append((start, x))
            start = None
    if start is not None:
        spans.append((start, w))
    # Ignore stray specks; a real pose is a wide band.
    return [s for s in spans if s[1] - s[0] > w * 0.08]


def crop_to_subject(im: Image.Image) -> Image.Image:
    """Trim the empty canvas, then centre the subject on a square."""
    box = im.getchannel("A").getbbox()
    if box is None:
        return im
    im = im.crop(box)
    side = round(max(im.size) * (1 + PAD * 2))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    return canvas.resize((OUT_SIZE, OUT_SIZE), Image.LANCZOS)


def save(im: Image.Image, name: str) -> None:
    path = OUT / f"{name}.png"
    crop_to_subject(im).save(path, optimize=True)
    print(f"  {path.relative_to(ROOT)}")


def prepare(path: Path, girl: bool = False) -> Image.Image:
    """Clean one source image, whichever way it was produced."""
    im = Image.open(path)
    if mostly_opaque(im):
        return chroma_key(im)  # solid-background art: nothing to repair
    im = solidify(im, skin=girl)
    return warm_hair(im) if girl else im


def main() -> None:
    sheet_path = RAW / "chibi-girl-poses.png"
    if sheet_path.exists():
        print("girl sheet:")
        sheet = prepare(sheet_path, girl=True)
        spans = columns_with_content(sheet)
        names = ["girl-idle", "girl-happy", "girl-sad"]
        if len(spans) != len(names):
            raise SystemExit(f"expected {len(names)} poses on the sheet, found {len(spans)}")
        for (left, right), name in zip(spans, names):
            save(sheet.crop((left, 0, right, sheet.height)), name)

    print("animals:")
    for path in sorted(RAW.glob("*.png")):
        if path.name == sheet_path.name:
            continue
        save(prepare(path), path.stem)


if __name__ == "__main__":
    main()
