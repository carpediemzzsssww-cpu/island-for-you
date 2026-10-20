"""The island's pictures: generated artwork, painted placeholders, or your own pictures.

  python3 scripts/photos.py artworks path/to/folder import generated artwork (same category folders)
  python3 scripts/photos.py placeholders          paint the optional placeholder set
  python3 scripts/photos.py import path/to/folder  use your own pictures

For `import`, sort the pictures into one folder per category (any you leave out are simply not used):

  folder/sunset/     skies: the desk, table and beach postcards (at least one)
  folder/food/       folder/flowers/   folder/journal/   folder/street/   folder/daily/
  folder/portrait/   folder/together/  optional categories for your own edition
  folder/video.mp4   optional: a short video at the end of the gallery

Files in each folder are used in name order. Pictures are resized for the web (1440 px, and 320 px thumbnails) and
saved without EXIF, so camera, time and GPS data never reach the site. Originals are never modified.
Needs Pillow (pip install pillow); HEIC pictures also need ffmpeg.
"""
from pathlib import Path
from io import BytesIO
import json, math, random, shutil, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'public' / 'photos'
CAPTIONS = {'portrait': '我眼睛里的你。', 'together': '很普通的一天，也很好。', 'sunset': '把这一刻的天色留下来。',
            'food': '下次还一起吃。', 'flowers': '花已经替我们说了一点。', 'journal': '认真保存生活的人。',
            'street': '沿着街道，慢慢走。', 'daily': '这些小事，都记得。'}
ORDER = list(CAPTIONS)


def save(im, name):
    display = im.copy(); display.thumbnail((1440, 1440))
    display.save(DEST / f'{name}.webp', 'WEBP', quality=84, method=6, exif=b'')
    thumb = im.copy(); thumb.thumbnail((320, 320))
    thumb.save(DEST / f'{name}_thumb.webp', 'WEBP', quality=76, method=6, exif=b'')
    return {'id': name, 'category': name.rsplit('-', 1)[0], 'width': im.width, 'height': im.height,
            'caption': CAPTIONS[name.rsplit('-', 1)[0]], 'src': f'/photos/{name}.webp', 'thumbnail': f'/photos/{name}_thumb.webp'}


def write_manifest(photos, video, placeholder, artwork=False):
    manifest = {'version': 2, 'placeholder': placeholder, 'photos': photos, 'video': video}
    if artwork:
        manifest['artwork'] = {'generator': 'imagegen', 'style': 'white-background-mouse-doodle', 'referenceImagesIncluded': False}
    (ROOT / 'assets-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + '\n')
    size = sum(p.stat().st_size for p in DEST.iterdir()) / 1024 ** 2
    print(f'{len(photos)} photos{" and a video" if video else ""} in public/photos ({size:.1f} MB); assets-manifest.json updated.')


def fresh_dest():
    if DEST.exists(): shutil.rmtree(DEST)
    DEST.mkdir(parents=True)


# ---------------------------------------------------------------------------------------------------------------
# Your own pictures

def load(path):
    if path.suffix.lower() == '.heic':
        data = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-'],
                              check=True, capture_output=True).stdout
        return Image.open(BytesIO(data)).convert('RGB')
    return ImageOps.exif_transpose(Image.open(path)).convert('RGB')


def import_folder(source, artwork=False):
    source = Path(source).expanduser()
    if not source.is_dir(): sys.exit(f'Not a folder: {source}')
    # Validate the input before replacing the current gallery.
    extensions = {'.jpg', '.jpeg', '.png', '.webp', '.heic'}
    for required in ('sunset',):
        if not any(p.suffix.lower() in extensions for p in (source / required).glob('*')):
            sys.exit(f'Add at least one picture to {required}/.')
    fresh_dest(); photos = []
    for category in ORDER:
        files = sorted(p for p in (source / category).glob('*') if p.suffix.lower() in {'.jpg', '.jpeg', '.png', '.webp', '.heic'}) if (source / category).is_dir() else []
        for n, path in enumerate(files, 1): photos.append(save(load(path), f'{category}-{n:02d}'))
    if not any(p['category'] == 'sunset' for p in photos): sys.exit('Add at least one picture to sunset/.')
    video = None
    clip = None if artwork else next((p for p in source.glob('*') if p.suffix.lower() in {'.mp4', '.mov', '.m4v'}), None)
    if clip:
        # Re-encoded without metadata (no location or device tags), at most 1280 px wide.
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(clip), '-map_metadata', '-1', '-vf', "scale='min(1280,iw)':-2",
                        '-c:v', 'libx264', '-crf', '24', '-preset', 'slow', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
                        str(DEST / 'video.mp4')], check=True)
        video = {'src': '/photos/video.mp4', 'caption': '一小段时间。'}
    write_manifest(photos, video, False, artwork)


# ---------------------------------------------------------------------------------------------------------------
# Painted placeholders: soft little scenes in the island's colours, one kind per category, so the demo looks
# finished while making it obvious where real photographs go. Each carries a small film-edge number.

S = 2  # paint at twice the size, then downsample for smooth edges
INK = (62, 86, 76)


def hexc(h, a=255):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (a,)


def gradient(w, h, stops):
    """A vertical gradient through (position, colour) stops."""
    im = Image.new('RGB', (1, h)); px = im.load()
    for y in range(h):
        t = y / max(1, h - 1)
        for (p0, c0), (p1, c1) in zip(stops, stops[1:]):
            if p0 <= t <= p1:
                k = (t - p0) / max(1e-6, p1 - p0); k = k * k * (3 - 2 * k)
                px[0, y] = tuple(round(a + (b - a) * k) for a, b in zip(hexc(c0)[:3], hexc(c1)[:3])); break
    return im.resize((w, h))


def glow(base, xy, r, colour, blur):
    layer = Image.new('RGBA', base.size, (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    x, y = xy; d.ellipse((x - r, y - r, x + r, y + r), fill=colour)
    base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))


def grain(im, rnd, amount=7):
    noise = Image.effect_noise(im.size, 40).convert('L').point(lambda v: 128 + (v - 128) * amount // 40)
    return Image.blend(im.convert('RGB'), Image.merge('RGB', [noise] * 3), .06).convert('RGBA')


def font(size):
    for path in ['/System/Library/Fonts/Supplemental/Courier New.ttf', '/System/Library/Fonts/Menlo.ttc', 'DejaVuSansMono.ttf']:
        try: return ImageFont.truetype(path, size)
        except OSError: pass
    return ImageFont.load_default(size=size)


def mark(im, label, light):
    """A film-edge number in the corner, so you can tell which picture a real photo should replace."""
    d = ImageDraw.Draw(im); f = font(im.width // 42)
    d.text((im.width * .04, im.height - im.width * .04 - f.size), label, font=f, fill=(255, 250, 240, 150) if light else INK[:3] + (110,))


def sky(w, h, rnd, palette, sunrise=False):
    top, mid, low, sun, sea, sea2 = palette
    horizon = int(h * rnd.uniform(.56, .64))
    im = gradient(w, h, [(0, top), (.42, mid), (horizon / h, low), (horizon / h + .001, sea), (1, sea2)]).convert('RGBA')
    sx = int(w * rnd.uniform(.32, .68)); sr = int(w * .055)
    glow(im, (sx, horizon), int(sr * 3.2), hexc(sun, 120), sr * 1.6)
    # Clouds: a few soft, flat bands lit from below.
    clouds = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(clouds)
    for _ in range(rnd.randint(3, 5)):
        cx, cy = rnd.uniform(-.1, 1.1) * w, rnd.uniform(.12, .48) * h; cw, ch = rnd.uniform(.18, .38) * w, rnd.uniform(.014, .03) * h
        for k in range(4):  # a few overlapping puffs make one soft band
            ox = rnd.uniform(-.5, .5) * cw; r = rnd.uniform(.35, .6)
            d.ellipse((cx + ox - cw * r, cy - ch * rnd.uniform(.8, 1.6), cx + ox + cw * r, cy + ch), fill=hexc(low if not sunrise else '#fff6ea', 70))
    im.alpha_composite(clouds.filter(ImageFilter.GaussianBlur(w * .014)))
    # The sun, half in the sea, and its path across the water.
    disc = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(disc)
    d.ellipse((sx - sr, horizon - sr, sx + sr, horizon + sr), fill=hexc(sun))
    d.rectangle((0, horizon, w, h), fill=(0, 0, 0, 0))
    im.alpha_composite(disc)
    path = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(path)
    for i in range(26):
        y = horizon + (i + 1) ** 1.45 * h * .0065; spread = sr * (.6 + i * .16) * rnd.uniform(.7, 1.3)
        d.rounded_rectangle((sx - spread, y, sx + spread, y + h * .004 + i * .25), radius=4, fill=hexc(sun, max(30, 190 - i * 6)))
    im.alpha_composite(path.filter(ImageFilter.GaussianBlur(2)))
    if not sunrise and rnd.random() < .5: d = ImageDraw.Draw(im); x, y = w * rnd.uniform(.12, .3), h * rnd.uniform(.1, .2); d.ellipse((x - 4, y - 4, x + 4, y + 4), fill=(255, 250, 235, 220))
    return im


def person(d, x, base, scale, colour, hair):
    """A simple figure seen from the front: long hair falling to the shoulders, a face, shoulders."""
    hw = 150 * scale; face = tuple(min(255, c + 22) for c in colour[:3]) + (255,)
    d.rounded_rectangle((x - 92 * scale, base - 412 * scale, x + 92 * scale, base - 150 * scale), radius=int(90 * scale), fill=hair)
    d.rounded_rectangle((x - hw, base - 210 * scale, x + hw, base + 40 * scale), radius=int(120 * scale), fill=colour)
    d.rectangle((x - 24 * scale, base - 250 * scale, x + 24 * scale, base - 190 * scale), fill=face)
    d.ellipse((x - 68 * scale, base - 384 * scale, x + 68 * scale, base - 222 * scale), fill=face)
    d.chord((x - 74 * scale, base - 400 * scale, x + 74 * scale, base - 290 * scale), 180, 360, fill=hair)


def portrait(w, h, rnd, i):
    bg = [('#f6dcd6', '#efc2bd'), ('#dcebe1', '#bfd9cb'), ('#f6e9c6', '#efd59e'), ('#dde7ef', '#bdd0de'), ('#e8e0f0', '#cfc3e2'), ('#f7e1cc', '#efc4a2')][i % 6]
    im = gradient(w, h, [(0, bg[0]), (1, bg[1])]).convert('RGBA')
    glow(im, (int(w * rnd.uniform(.2, .8)), int(h * .25)), int(w * .45), (255, 252, 240, 130), w * .12)
    layer = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    tone = hexc(bg[1]); body = tuple(max(0, c - 34) for c in tone[:3]) + (255,); hair = tuple(max(0, c - 70) for c in tone[:3]) + (255,)
    person(d, w * rnd.uniform(.44, .56), h * 1.0, w / 560, body, hair)
    im.alpha_composite(layer.filter(ImageFilter.GaussianBlur(w * .004)))
    # A sprig of flowers or a few sparkles, so each placeholder feels like a picture rather than an icon.
    d = ImageDraw.Draw(im)
    for _ in range(rnd.randint(5, 9)):
        x, y, r = rnd.uniform(.06, .94) * w, rnd.uniform(.06, .5) * h, rnd.uniform(.006, .012) * w
        d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 250, 170))
    return im


def together(w, h, rnd, i):
    sets = [('#cfe4dd', '#f3e7cf', '#9fc4c0'), ('#f3d5cc', '#f6ead6', '#d8a8a0'), ('#dfe2f0', '#f4ecdf', '#aab6d3'), ('#f5e6c4', '#f8f0dd', '#c9b98e')]
    a, b, c = sets[i % 4]
    im = gradient(w, h, [(0, a), (.62, b), (.621, c), (1, b)]).convert('RGBA')
    glow(im, (int(w * .7), int(h * .3)), int(w * .3), (255, 248, 230, 140), w * .1)
    layer = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    tone = hexc(c); body = tuple(max(0, v - 40) for v in tone[:3]) + (255,); hair = tuple(max(0, v - 80) for v in tone[:3]) + (255,)
    person(d, w * .38, h * 1.02, w / 980, body, hair); person(d, w * .62, h * 1.04, w / 900, tuple(max(0, v - 20) for v in body[:3]) + (255,), hair)
    im.alpha_composite(layer.filter(ImageFilter.GaussianBlur(w * .003)))
    return im


def food(w, h, rnd, i):
    cloth = ['#e6a9a3', '#9fc7b5', '#e8c77e'][i % 3]
    im = Image.new('RGBA', (w, h), (250, 245, 236, 255)); step = w // 11
    for vertical in (True, False):  # gingham: two layers of translucent bands
        bands = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(bands)
        for k in range(0, max(w, h), step): d.rectangle((k, 0, k + step // 2, h) if vertical else (0, k, w, k + step // 2), fill=hexc(cloth, 70))
        im.alpha_composite(bands)
    d = ImageDraw.Draw(im)
    cx, cy, r = w * .5, h * .52, min(w, h) * .3
    shadow = Image.new('RGBA', im.size, (0, 0, 0, 0)); ImageDraw.Draw(shadow).ellipse((cx - r + 14, cy - r + 22, cx + r + 14, cy + r + 22), fill=(60, 50, 40, 70))
    im.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(18))); d = ImageDraw.Draw(im)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(253, 250, 243, 255)); d.ellipse((cx - r * .78, cy - r * .78, cx + r * .78, cy + r * .78), outline=(225, 215, 198, 255), width=5)
    dish = [('#f0c27a', '#e39a5c'), ('#f6f0e2', '#e8c9b3'), ('#f2d36f', '#e7b44c')][i % 3]
    for _ in range(7):
        a, q = rnd.uniform(0, 6.28), rnd.uniform(0, r * .42); x, y = cx + math.cos(a) * q, cy + math.sin(a) * q; s = r * rnd.uniform(.12, .2)
        d.ellipse((x - s, y - s * .8, x + s, y + s * .8), fill=hexc(dish[rnd.random() < .5]))
    for k in (-1, 1):  # chopsticks
        x = cx + r * 1.22 + k * 14; d.line((x, cy - r * .9, x + 10, cy + r * .9), fill=(176, 132, 92, 255), width=9)
    return im


def flowers(w, h, rnd, i):
    im = gradient(w, h, [(0, ['#f7e4e0', '#e3eee6'][i % 2]), (1, ['#efcfc8', '#cfe2d6'][i % 2])]).convert('RGBA'); d = ImageDraw.Draw(im)
    base = (w * .5, h * .92)
    heads = [(w * rnd.uniform(.22, .78), h * rnd.uniform(.16, .52)) for _ in range(9)]
    for x, y in heads: d.line((base, (x, y)), fill=(110, 145, 104, 255), width=8)
    colours = ['#e99aab', '#cf6680', '#fff6e4', '#a9bfdc', '#f0a7bd', '#f4f2ea', '#d64f8f']
    for x, y in heads:
        c = hexc(rnd.choice(colours)); r = w * rnd.uniform(.045, .075)
        for k in range(6):
            a = k / 6 * 6.283 + rnd.random(); px, py = x + math.cos(a) * r * .6, y + math.sin(a) * r * .6
            d.ellipse((px - r * .55, py - r * .55, px + r * .55, py + r * .55), fill=c)
        d.ellipse((x - r * .28, y - r * .28, x + r * .28, y + r * .28), fill=(243, 205, 120, 255))
    d.polygon([(w * .32, h * .62), (w * .68, h * .62), (w * .56, h * .98), (w * .44, h * .98)], fill=(226, 196, 166, 255))  # paper wrap
    return im


def journal(w, h, rnd, i):
    im = Image.new('RGBA', (w, h), hexc('#d9cdb8')); d = ImageDraw.Draw(im)
    page = (w * .1, h * .08, w * .9, h * .92); d.rounded_rectangle(page, radius=18, fill=(250, 245, 232, 255))
    for x in range(int(page[0]) + 40, int(page[2]) - 20, 34):
        for y in range(int(page[1]) + 40, int(page[3]) - 20, 34): d.ellipse((x - 2, y - 2, x + 2, y + 2), fill=(200, 190, 170, 255))
    for k, (c, y) in enumerate([('#e9b4a7', .2), ('#a9cf9b', .55)]):
        tape = Image.new('RGBA', im.size, (0, 0, 0, 0)); ImageDraw.Draw(tape).rectangle((w * .3, h * y, w * .7, h * y + h * .045), fill=hexc(c, 200))
        im.alpha_composite(tape.rotate(rnd.uniform(-6, 6), center=(w / 2, h * y)))
    d = ImageDraw.Draw(im)
    for y in (.32, .38, .44, .67, .73, .79): d.line((w * .2, h * y, w * rnd.uniform(.55, .8), h * y), fill=(150, 140, 125, 255), width=5)
    return im


def street(w, h, rnd, i):
    im = gradient(w, h, [(0, '#d7e8e8'), (1, '#f3ead8')]).convert('RGBA'); d = ImageDraw.Draw(im)
    d.rectangle((0, h * .22, w, h), fill=hexc('#f1d9b8'))
    for k in range(4):  # arcade arches
        x0 = w * (.04 + k * .25); d.rectangle((x0, h * .5, x0 + w * .19, h), fill=hexc('#c99e7c'))
        d.pieslice((x0, h * .41, x0 + w * .19, h * .59), 180, 360, fill=hexc('#c99e7c'))
    for k in range(5): d.rectangle((w * (.02 + k * .25), h * .22, w * (.045 + k * .25), h), fill=hexc('#e7c9a4'))
    d.rectangle((0, h * .9, w, h), fill=hexc('#d8c3a3'))
    return im


def daily(w, h, rnd, i):
    im = gradient(w, h, [(0, '#bfdbe0'), (.55, '#e9f1ea'), (.551, '#e6d3b3'), (1, '#d9c19c')]).convert('RGBA'); d = ImageDraw.Draw(im)
    d.rectangle((w * .08, h * .08, w * .92, h * .55), outline=(250, 246, 236, 255), width=14); d.line((w * .5, h * .08, w * .5, h * .55), fill=(250, 246, 236, 255), width=10)
    cx, cy = w * .5, h * .74
    d.rounded_rectangle((cx - w * .12, cy - h * .1, cx + w * .12, cy + h * .1), radius=30, fill=(250, 246, 238, 255))
    d.ellipse((cx + w * .1, cy - h * .05, cx + w * .2, cy + h * .05), outline=(250, 246, 238, 255), width=14)
    for k in (-1, 0, 1):
        x = cx + k * w * .05; d.arc((x - 20, cy - h * .3, x + 20, cy - h * .14), 100, 260, fill=(255, 255, 255, 200), width=6)
    return im


def placeholders():
    fresh_dest(); rnd = random.Random(11); photos = []
    skies = [('#f6d6c3', '#f1b7b1', '#f6c9a0', '#ffe2a8', '#c99aa6', '#8e7c9a'), ('#c9a7c7', '#f0a99a', '#f7c98e', '#fff0c0', '#b98a95', '#6f6587'),
             ('#bcd3e6', '#f3cfd4', '#f9e2b8', '#fff4d0', '#b7c3cf', '#8796ab'), ('#5d6c94', '#c98b9d', '#f2b48e', '#ffd9a0', '#7b6f8e', '#3f4a6b'),
             ('#cfe0ee', '#f5e3c8', '#fbeac0', '#fffbe2', '#a9c6d1', '#7c9fb2'), ('#d9cfe8', '#f6d2c4', '#fbe1b4', '#fff6dc', '#b3b6cf', '#8a8fb0')]
    plan = [('portrait', 6, (960, 1280)), ('together', 4, (1280, 960)), ('sunset', 6, (1440, 960)), ('food', 3, (1200, 960)),
            ('flowers', 2, (960, 1200)), ('journal', 1, (1000, 1250)), ('street', 1, (960, 1200)), ('daily', 1, (1080, 1080))]
    paint = {'portrait': portrait, 'together': together, 'food': food, 'flowers': flowers, 'journal': journal, 'street': street, 'daily': daily}
    for category, count, (w, h) in plan:
        for n in range(count):
            W, H = w * S, h * S
            im = sky(W, H, rnd, skies[n], sunrise=n >= 4) if category == 'sunset' else paint[category](W, H, rnd, n)
            im = grain(im, rnd).resize((w, h), Image.LANCZOS)
            mark(im, f'{category.upper()} {n + 1:02d}', category == 'sunset')
            photos.append(save(im.convert('RGB'), f'{category}-{n + 1:02d}'))
    write_manifest(photos, None, True)


if __name__ == '__main__':
    if len(sys.argv) >= 2 and sys.argv[1] == 'placeholders': placeholders()
    elif len(sys.argv) >= 3 and sys.argv[1] == 'import': import_folder(sys.argv[2])
    elif len(sys.argv) >= 3 and sys.argv[1] == 'artworks': import_folder(sys.argv[2], artwork=True)
    else: sys.exit(__doc__)
