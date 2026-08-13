"""Turn one drawing into every icon the phone home screen asks for.

Run:  python3 scripts/prepAppIcon.py
In:   assets/app-icon-source.png   (any size, transparent or white background)
Out:  public/  — the sizes iOS and Android each want

Three things matter and are easy to get wrong:

1. iOS home-screen icons must be OPAQUE. A transparent PNG comes out with a
   black background on the home screen, which is why the source is flattened
   onto a solid colour here rather than left as-is.
2. iOS applies its own rounded-corner mask. The source must be a full square
   with no corners of its own, or the corners get rounded twice.
3. A drawing that touches the edge looks cropped once the mask is applied, so
   the subject is trimmed to its true bounds and re-inset with real padding.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "app-icon-source.png"
OUT = ROOT / "public"

# The app's tinted surface. A white character on a white icon disappears into a
# pale home screen; this gives the outline something to sit on.
BACKGROUND = (234, 241, 245)
INSET = 0.12  # padding around the subject, as a fraction of the icon

SIZES = {
    "apple-touch-icon.png": 180,  # iOS "add to home screen"
    "icon-192.png": 192,  # Android / Chrome install
    "icon-512.png": 512,  # Android splash and store listing
    "favicon.png": 64,  # browser tab
}


def flatten(im: Image.Image) -> Image.Image:
    """Trim to the drawing, inset it, and place it on an opaque square."""
    im = im.convert("RGBA")

    # A scan or an export often arrives on white rather than on alpha, so treat
    # near-white as background for the purpose of finding the subject.
    alpha = im.getchannel("A")
    if alpha.getextrema()[0] == 255:  # nothing transparent — find the ink instead
        grey = im.convert("L")
        mask = grey.point(lambda v: 255 if v < 240 else 0)
        box = mask.getbbox()
    else:
        box = alpha.getbbox()
    if box:
        im = im.crop(box)

    side = round(max(im.size) / (1 - INSET * 2))
    canvas = Image.new("RGBA", (side, side), (*BACKGROUND, 255))
    canvas.alpha_composite(im, ((side - im.width) // 2, (side - im.height) // 2))
    return canvas.convert("RGB")  # RGB, not RGBA: opaque is the whole point


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"put the drawing at {SOURCE.relative_to(ROOT)} first")

    OUT.mkdir(exist_ok=True)
    square = flatten(Image.open(SOURCE))
    for name, size in SIZES.items():
        square.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)
        print(f"  public/{name}  {size}x{size}")

    # The native app icons live in assets/ and want the same square.
    square.resize((1024, 1024), Image.LANCZOS).save(ROOT / "assets" / "icon.png", optimize=True)
    print("  assets/icon.png  1024x1024")


if __name__ == "__main__":
    main()
