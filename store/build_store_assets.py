"""
Builds the Google Play graphics from raw app captures in store/raw/ (1080x2400 emulator screenshots).

  python3 store/build_store_assets.py

Writes to store/play/:
  01-*.png ... 08-*.png   phone screenshots, 1080x1920 (9:16), framed phone + English/Urdu caption
  feature-graphic.png     1024x500
  icon-512.png            512x512, 32-bit PNG
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
RAW = ROOT / 'raw'
OUT = ROOT / 'play'
FONTS = ROOT.parent / 'node_modules/@expo-google-fonts/plus-jakarta-sans'
BOLD = str(FONTS / '800ExtraBold/PlusJakartaSans_800ExtraBold.ttf')
SEMI = str(FONTS / '600SemiBold/PlusJakartaSans_600SemiBold.ttf')
URDU = '/System/Library/Fonts/NotoNastaliq.ttc'
ICON = ROOT.parent / 'assets/images/icon.png'

LIME = (200, 255, 77)
WHITE = (244, 255, 246)
TOP = (11, 61, 31)
BOTTOM = (2, 8, 5)

SHOTS = [
    ('01-home', 'Your whole shop,\nin one app', 'پوری دکان کا حساب، ایک ایپ میں'),
    ('04-sale', 'Make a bill\nin seconds', 'سیکنڈوں میں بل بنائیں'),
    ('07-whatsapp', 'Send bills on\nWhatsApp', 'بل سیدھا واٹس ایپ پر بھیجیں'),
    ('12-recovery', 'Never miss\na payment', 'ادھار کی وصولی اب آسان'),
    ('02-products', 'Stock & expiry\nunder control', 'اسٹاک اور ایکسپائری پر پوری نظر'),
    ('10-reports', 'Know your\nprofit every day', 'روزانہ منافع کا حساب'),
    ('11-bank', 'Cash, bank\n& cheques', 'نقد، بینک اور چیک ایک جگہ'),
    ('13-urdu-home', 'Works in\nUrdu & English', 'اردو اور انگریزی دونوں میں'),
]


def gradient(w: int, h: int) -> Image.Image:
    """Deep green vertical gradient with two soft glows (lime top-right, emerald bottom-left)."""
    img = Image.new('RGB', (w, h))
    px = img.load()
    for y in range(h):
        t = y / (h - 1)
        c = tuple(round(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3))
        for x in range(w):
            px[x, y] = c
    glow = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    r = int(w * 0.55)
    g.ellipse((w - r * 1.1, -r * 0.6, w + r * 0.6, r * 0.9), fill=(200, 255, 77, 70))
    g.ellipse((-r * 0.7, h - r * 1.1, r * 0.9, h + r * 0.5), fill=(16, 185, 129, 60))
    glow = glow.filter(ImageFilter.GaussianBlur(w // 8))
    img.paste(glow, (0, 0), glow)
    return img


def rounded(img: Image.Image, radius: int) -> Image.Image:
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, img.size[0] - 1, img.size[1] - 1), radius, fill=255)
    out = img.convert('RGBA')
    out.putalpha(mask)
    return out


def phone(shot: Image.Image, height: int) -> Image.Image:
    """Screenshot inside a slim dark phone frame with a soft shadow (transparent background)."""
    sw = round(shot.width * height / shot.height)
    screen = rounded(shot.resize((sw, height), Image.LANCZOS), 46)
    bezel = 14
    fw, fh = sw + bezel * 2, height + bezel * 2
    pad = 60
    canvas = Image.new('RGBA', (fw + pad * 2, fh + pad * 2), (0, 0, 0, 0))
    shadow = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((pad, pad + 24, pad + fw, pad + fh + 24), 62, fill=(0, 0, 0, 170))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(28)))
    frame = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
    d = ImageDraw.Draw(frame)
    d.rounded_rectangle((0, 0, fw - 1, fh - 1), 60, fill=(14, 18, 15, 255), outline=(70, 95, 76, 255), width=3)
    frame.alpha_composite(screen, (bezel, bezel))
    canvas.alpha_composite(frame, (pad, pad))
    return canvas


def text_center(d: ImageDraw.ImageDraw, w: int, y: int, text: str, font, fill, spacing=10, **kw) -> int:
    box = d.multiline_textbbox((0, 0), text, font=font, spacing=spacing, align='center', **kw)
    tw, th = box[2] - box[0], box[3] - box[1]
    d.multiline_text(((w - tw) / 2 - box[0], y - box[1]), text, font=font, fill=fill, spacing=spacing, align='center', **kw)
    return y + th


def screenshot(name: str, title: str, urdu: str, i: int) -> None:
    W, H = 1080, 1920
    img = gradient(W, H).convert('RGBA')
    d = ImageDraw.Draw(img)
    y = text_center(d, W, 92, title, ImageFont.truetype(BOLD, 82), WHITE, spacing=14)
    text_center(d, W, y + 34, urdu, ImageFont.truetype(URDU, 46), LIME, direction='rtl', language='ur')
    ph = phone(Image.open(RAW / f'{name}.png').convert('RGB'), 1390)
    img.alpha_composite(ph, ((W - ph.width) // 2, H - ph.height + 70))
    img.convert('RGB').save(OUT / f'{i:02d}-{name.split("-", 1)[1]}.png', optimize=True)


def feature_graphic() -> None:
    W, H = 1024, 500
    img = gradient(W, H).convert('RGBA')
    d = ImageDraw.Draw(img)
    icon = rounded(Image.open(ICON).convert('RGB').resize((132, 132), Image.LANCZOS), 30)
    img.alpha_composite(icon, (64, 92))
    d.text((64, 250), 'ZaraiBook', font=ImageFont.truetype(BOLD, 74), fill=WHITE)
    d.text((66, 344), 'Stock · Bills · Khata · Roznamcha', font=ImageFont.truetype(SEMI, 27), fill=LIME)
    d.text((66, 384), 'زرعی دکان کا مکمل حساب کتاب', font=ImageFont.truetype(URDU, 30), fill=(210, 230, 214), direction='rtl', language='ur')
    ph = phone(Image.open(RAW / '01-home.png').convert('RGB'), 760).rotate(-8, resample=Image.BICUBIC, expand=True)
    img.alpha_composite(ph, (W - ph.width + 40, 40))
    img.convert('RGB').save(OUT / 'feature-graphic.png', optimize=True)


def icon_512() -> None:
    Image.open(ICON).convert('RGBA').resize((512, 512), Image.LANCZOS).save(OUT / 'icon-512.png', optimize=True)


if __name__ == '__main__':
    OUT.mkdir(exist_ok=True)
    for i, (name, title, urdu) in enumerate(SHOTS, 1):
        screenshot(name, title, urdu, i)
    feature_graphic()
    icon_512()
    for p in sorted(OUT.iterdir()):
        im = Image.open(p)
        print(f'{p.name:28} {im.size[0]}x{im.size[1]}  {p.stat().st_size // 1024} KB')
