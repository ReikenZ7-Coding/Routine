"""Renders every look's artwork into assets/art.

Per look (export_look):
  <look>-bg.jpg        the sharp backdrop, 1080x2340
  <look>-bg-blur.jpg   the lens: the backdrop with the scrim and top veil composited exactly as Ambience draws
                       them (values from assets/art/looks.json), Gaussian sigma 24 at 540x1170, saturation per look
  <light>.png          the look's moving light layers, alpha PNGs (see looks.json for their boxes and motion)
plus the look's own pieces (Stone's magnolia, Paper's header, mist and header lens) and scene sets for
SceneArt and Now Playing: portal-* (Lavender), stones-* (Stone), paper-* (Paper), pine-* (Pine).

Usage: python3 scripts/render-art.py [target ...]   (needs numpy and Pillow)
Targets: lavender stone paper pine (export_look), grain, scenes-lavender, scenes-stone, scenes-paper,
scenes-pine, or any function name. No target renders everything.
"""
import json
import sys
import zlib

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = 'assets/art'
W, H = 1080, 2340
LENS_W, LENS_H = 540, 1170
LOOKS = json.load(open(f'{OUT}/looks.json'))['looks']
rng = np.random.default_rng(3)


def reseed(name):
    """Every artwork draws from its own seeded generator, so re-rendering one never changes another."""
    global rng
    rng = np.random.default_rng(zlib.crc32(name.encode()))


def hexc(h):
    return np.array([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)])


def rgba(s):
    """'#RRGGBB' or 'rgba(r,g,b,a)' -> (rgb 0..1, alpha)."""
    s = s.strip()
    if s.startswith('#'):
        return hexc(s), 1.0
    r, g, b, a = [float(v) for v in s[s.index('(') + 1:s.index(')')].split(',')]
    return np.array([r, g, b]) / 255, a


def gradient(stops, w=W, h=H, tilt=0.15):
    y = np.linspace(0, 1, h)[:, None]
    x = np.linspace(0, 1, w)[None, :]
    t = np.clip(y * (1 - tilt) + x * tilt, 0, 1)
    img = np.zeros((h, w, 3))
    for (p0, c0), (p1, c1) in zip(stops, stops[1:]):
        m = (t >= p0) & (t <= p1)
        tt = (t - p0) / (p1 - p0)
        for k in range(3):
            img[..., k] = np.where(m, c0[k] + (c1[k] - c0[k]) * tt, img[..., k])
    return img


def glow(img, cx, cy, r, color, strength):
    h, w = img.shape[:2]
    y, x = np.ogrid[:h, :w]
    g = np.exp(-(((x - cx) ** 2 + (y - cy) ** 2) / r ** 2) * 2.2) * strength
    for k in range(3):
        img[..., k] = img[..., k] * (1 - g) + color[k] * g


def screen(img, rgba_layer):
    a = np.asarray(rgba_layer).astype(float) / 255
    return 1 - (1 - img) * (1 - a[..., :3] * a[..., 3:4])


def bokeh(img, n, rmin, rmax, color, alpha, blur, ymax=1.0):
    h, w = img.shape[:2]
    layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for _ in range(n):
        x, y, r = rng.uniform(0, w), rng.uniform(0, h * ymax), rng.uniform(rmin, rmax)
        a = int(255 * alpha * rng.uniform(0.4, 1))
        d.ellipse([x - r, y - r, x + r, y + r], fill=(*color, a))
        d.ellipse([x - r, y - r, x + r, y + r], outline=(*color, min(255, a + 40)), width=max(1, int(r * 0.08)))
    return screen(img, layer.filter(ImageFilter.GaussianBlur(blur)))


def beams(specs, angle, blur, w=W, h=H):
    layer = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(layer)
    dx = np.tan(np.radians(angle)) * h
    for x0, bw, a in specs:
        d.polygon([(x0, 0), (x0 + bw, 0), (x0 + bw + dx, h), (x0 + dx, h)], fill=int(255 * a))
    return (np.asarray(layer.filter(ImageFilter.GaussianBlur(blur))).astype(float) / 255)[..., None]


def grain(img, amount):
    return np.clip(img + rng.normal(0, amount, img.shape[:2] + (1,)), 0, 1)


def gblur(a, sigma):
    """Gaussian blur in float (no banding), edges reflected. Works on HxW or HxWxC."""
    flat = a.ndim == 2
    if flat:
        a = a[..., None]
    pad = int(3 * sigma) + 2
    p = np.pad(a, ((pad, pad), (pad, pad), (0, 0)), mode='reflect')
    h, w = p.shape[:2]
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.rfftfreq(w)[None, :]
    k = np.exp(-2 * (np.pi * sigma) ** 2 * (fx ** 2 + fy ** 2))[..., None]
    out = np.fft.irfft2(np.fft.rfft2(p, axes=(0, 1)) * k, s=(h, w), axes=(0, 1))[pad:-pad, pad:-pad]
    return out[..., 0] if flat else out


def saturate(img, s):
    luma = (img * np.array([0.2126, 0.7152, 0.0722])).sum(-1, keepdims=True)
    return np.clip(luma + (img - luma) * s, 0, 1)


def resize(img, w, h):
    """Resize a float image (any channel count) with Lanczos, keeping float precision."""
    chans = [np.asarray(Image.fromarray(img[..., k].astype(np.float32), 'F').resize((w, h), Image.LANCZOS)) for k in range(img.shape[2])]
    return np.dstack(chans).astype(float)


def to8(img, dither=0.6):
    """Quantise to 8 bits with a little dither, so soft gradients never band."""
    noise = rng.uniform(-dither, dither, img.shape) / 255
    return (np.clip(img + noise, 0, 1) * 255 + 0.5).astype(np.uint8)


def save(img, name, quality=88):
    Image.fromarray(to8(img)).save(f'{OUT}/{name}.jpg', quality=quality, optimize=True, progressive=True)


def save_png(rgba_img, name, dither_rgb=True):
    """Save straight (not premultiplied) RGBA. Fully transparent pixels are zeroed so they compress to nothing."""
    out = to8(rgba_img) if dither_rgb else np.dstack([(np.clip(rgba_img[..., :3], 0, 1) * 255 + 0.5).astype(np.uint8), to8(rgba_img[..., 3:])])
    out[out[..., 3] == 0] = 0
    Image.fromarray(out, 'RGBA').save(f'{OUT}/{name}.png', optimize=True)


def ambience(img, look):
    """Composite the scrim and the top veil exactly as Art.tsx Ambience draws them: an even scrim,
    then a vertical gradient from topVeil[0] at the top to topVeil[1] at veilEnd of the height."""
    spec = LOOKS[look]
    h = img.shape[0]
    c, a = rgba(spec['scrim'])
    img = img * (1 - a) + c * a
    (c0, a0), (c1, a1) = rgba(spec['topVeil'][0]), rgba(spec['topVeil'][1])
    t = np.clip(np.linspace(0, 1, h) / spec['veilEnd'], 0, 1)[:, None, None]
    a = a0 + (a1 - a0) * t
    # premultiplied interpolation, as both web and Android draw gradients
    col = (c0 * a0 * (1 - t) + c1 * a1 * t) / np.maximum(a, 1e-6)
    return img * (1 - a) + col * a


def lens(img, look):
    """The pre-blurred backdrop every glass surface shows through itself."""
    small = resize(ambience(img, look), LENS_W, LENS_H)
    out = saturate(gblur(small, 24), LOOKS[look]['lensSaturation'])
    save(out, f'{look}-bg-blur', quality=86)


def falloff(d, r):
    """Smooth light falloff that reaches exactly zero at r."""
    return np.clip(1 - (d / r) ** 2, 0, 1) ** 2


def light_png(name, w, h, color, alpha):
    """A light layer: one colour, with the light carried in the alpha channel."""
    rgba_img = np.dstack([np.broadcast_to(hexc(color), (h, w, 3)), alpha])
    save_png(rgba_img, name, dither_rgb=False)


# ---------------------------------------------------------------------------------------------
# Lavender: luxury through illumination.


def lavender_backdrop():
    """A lit violet world. A periwinkle wash pours in from the top left; a magenta pool glows
    on the right, an azure pool on the left, violet and blue pools lower down, and the floor stays violet (no
    navy band), with soft bokeh and star specks. The light lives in hue, not brightness: luminance_budget keeps
    the world, as the lens sees it, inside what white type on the frost needs (scripts/check-contrast.py)."""
    reseed('lavender-bg')
    k = LAV
    img = gradient([(0, hexc(k['g0'])), (0.12, hexc(k['g1'])), (0.34, hexc(k['g2'])), (0.66, hexc(k['g3'])), (1, hexc(k['g4']))], tilt=0.12)
    glow(img, W * 0.0, H * -0.04, W * 0.95, hexc('#9D8BFF'), k['top'])
    glow(img, W * 1.05, H * 0.17, W * 0.58, hexc('#9A58FF'), k['lilac'])
    glow(img, W * 1.02, H * 0.45, W * 0.66, hexc(k['pink_c']), k['pink'])
    glow(img, W * -0.12, H * 0.62, W * 0.66, hexc('#2F5CFF'), k['blue'])
    glow(img, W * 0.10, H * 0.90, W * 0.66, hexc('#8B2CFF'), k['violet'])
    glow(img, W * 1.0, H * 0.97, W * 0.55, hexc('#3550FF'), k['blue2'])
    img = bokeh(img, 14, 30, 90, (226, 200, 255), k['bokeh'], 10)
    img = luminance_budget(img, k['cap'], k['cap_top'], 0.18)
    img = bokeh(img, 60, 2, 6, (255, 255, 255), 0.5, 1.0)
    return grain(img, 0.014)


def to_linear(img):
    return np.where(img <= 0.04045, img / 12.92, ((img + 0.055) / 1.055) ** 2.4)


def to_srgb(lin):
    lin = np.clip(lin, 0, 1)
    return np.where(lin <= 0.0031308, lin * 12.92, 1.055 * lin ** (1 / 2.4) - 0.055)


def luminance_budget(img, cap, cap_top, top_end):
    """Keep the world's light inside the budget white type needs: wherever the world, blurred the way the lens
    sees it, is brighter than `cap` (relative luminance), scale that region's light down in linear light. Hue
    and chroma survive, so a pool of light stays a pool of colour. Above `top_end` of the height the cap eases
    up to `cap_top` (the status bar and greeting sit on the bare world, not on glass)."""
    lin = to_linear(img)
    h, w = img.shape[:2]
    lum = (lin * np.array([0.2126, 0.7152, 0.0722])).sum(-1)
    seen = gblur(lum, 24 * w / LENS_W)
    t = np.clip(np.linspace(0, 1, h) / top_end, 0, 1)[:, None]
    limit = cap_top + (cap - cap_top) * (t * t * (3 - 2 * t))
    gain = gblur(np.clip(limit / np.maximum(seen, 1e-6), 0, 1), 12 * w / LENS_W)
    return to_srgb(lin * gain[..., None])


# Tuned against the contrast gate (white type on the frost at 4.5:1 or better). The plan's starting world
# (#8C7EF2 at 0.30, #DCE2FF glow 0.65, pink #FF8AD8 0.55) put white type at about 2:1; these keep its hues and
# move its light into hue rather than brightness.
LAV = {'g0': '#8F7BFF', 'g1': '#5A3EE0', 'g2': '#4A26C8', 'g3': '#4220B8', 'g4': '#3A1CA8', 'top': 0.30, 'lilac': 0.30,
       'pink_c': '#E034C8', 'pink': 0.50, 'blue': 0.45, 'violet': 0.40, 'blue2': 0.34, 'bokeh': 0.12,
       'cap': 0.055, 'cap_top': 0.13}


def lavender_lights():
    # The orbs are 1.2 frame widths square; rendered at half the backdrop's resolution (they are pure falloff).
    s = int(LENS_W * 1.2)
    y, x = np.mgrid[:s, :s].astype(float)
    d = np.hypot(x - s / 2, y - s / 2)
    # a gaussian orb (sigma 0.17 of the frame width), brought to exactly zero at the square's inscribed circle
    sigma, edge = 0.17 * LENS_W, np.exp(-0.5 * (0.6 / 0.17) ** 2)
    orb = np.clip((np.exp(-0.5 * (d / sigma) ** 2) - edge) / (1 - edge), 0, 1)
    light_png('lavender-orb-pink', s, s, '#FF86DC', orb * LAV_ORBS[0])
    light_png('lavender-orb-blue', s, s, '#8FA8FF', orb * LAV_ORBS[1])


LAV_ORBS = (0.22, 0.20)  # centre alphas; the plan started at 0.38 and 0.32


# ---------------------------------------------------------------------------------------------
# Stone: luxury through restraint.


def window_light(specs, angle, blur, fade_at, w=W, h=H, gaps=(28, 40)):
    """Sun through a window: diagonal shafts split by mullions, fading out lower down the room."""
    split = []
    for x0, bw, a in specs:
        x = x0
        while x < x0 + bw:
            pane = rng.uniform(60, 120) if bw > 120 else bw
            split.append((x, min(pane, x0 + bw - x), a))
            x += pane + rng.uniform(*gaps)
    fade = np.clip(1 - np.linspace(0, 1, h) / fade_at, 0, 1)[:, None, None] ** 1.2
    return beams(split, angle, blur, w, h) * fade


def stone_backdrop():
    """A quiet olive room crossed by crisp diagonal window light, a sun glow in the top-left corner,
    and a warm bounce off the floor. All warm, no bokeh. The shafts are crisp but low in amplitude, so the
    ivory type that sits straight on the room keeps 4.5:1 (scripts/check-contrast.py)."""
    reseed('stone-bg')
    img = gradient([(0, hexc(STONE['top'])), (0.45, hexc(STONE['mid'])), (1, hexc('#33332B'))], tilt=0.22)
    glow(img, -W * 0.16, -H * 0.10, W * STONE['sun_r'], hexc('#F6E9C8'), STONE['sun'])
    glow(img, W * 0.15, H * 1.0, W * 0.7, hexc('#8C8467'), 0.18)
    k = STONE['beams']
    light = window_light([(-300, 300, 0.30 * k), (60, 150, 0.24 * k), (260, 70, 0.16 * k)], 32, 22, 0.70)
    img = 1 - (1 - img) * (1 - light * hexc('#FFF0CC'))
    return grain(img, 0.018)


# Tuned against the contrast gate (the plan's starting values were #6E6C5A/#4F4E43, sun 0.45, beams 1.0).
STONE = {'top': '#56544A', 'mid': '#43423A', 'sun': 0.50, 'sun_r': 0.55, 'beams': 0.50}


def stone_lights():
    """One extra window beam that sways very slowly over the room."""
    w, h = LENS_W, LENS_H
    layer = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(layer)
    dx = np.tan(np.radians(32)) * h
    x0, bw = w * 0.08, w * 0.16
    d.polygon([(x0, 0), (x0 + bw, 0), (x0 + bw + dx, h), (x0 + dx, h)], fill=255)
    a = np.asarray(layer.filter(ImageFilter.GaussianBlur(11))).astype(float) / 255
    a *= np.clip(1 - np.linspace(0, 1, h) / 1.4, 0, 1)[:, None] * 0.07
    light_png('stone-light-beam', w, h, '#FFF0CD', a)


def petal_layer(w, h, base, length, width, angle, tone, lift=0.0, cup=0.0):
    """One magnolia petal: a pointed cup-shaped blade rooted at `base`, lit from the top left.
    Returns (rgb, alpha) arrays the size of the canvas."""
    yy, xx = np.mgrid[:h, :w].astype(float)
    a = np.radians(angle)
    ux, uy = np.sin(a), -np.cos(a)  # along the petal (upwards when angle is 0)
    vx, vy = -uy, ux  # across
    rx, ry = xx - base[0], yy - base[1]
    t = (rx * ux + ry * uy) / length  # 0 at the base, 1 at the tip
    s = (rx * vx + ry * vy) / width  # -1..1 across
    half = np.where((t > 0) & (t < 1), np.sin(np.pi * np.clip(t, 0, 1) ** 0.85) ** 0.75 * (1 - 0.25 * t), 0)
    inside = np.abs(s) < half
    edge = np.clip((half - np.abs(s)) * width / 3.0, 0, 1)  # anti-aliased edge, 3px wide
    # light: a cylinder curving away across the petal, lit from the top left
    nx = s / np.maximum(half, 1e-3) * 0.9
    lam = np.clip(0.58 - 0.32 * nx + 0.3 * t - 0.25 * nx ** 2, 0, 1)  # brighter on the left, rolling off at both rims
    ivory, shade, blush = hexc('#FFFDF6'), hexc('#C9C0A6'), hexc('#E8D5C6')
    col = shade + (ivory - shade) * lam[..., None]
    col = col * (1 - 0.2 * (1 - t)[..., None] * tone) + blush * 0.2 * (1 - t)[..., None] * tone
    col = col * (0.74 + 0.26 * np.clip(t, 0, 1) ** 0.5)[..., None]  # the cup's base sits in its own shadow
    col = col * (1 - 0.14 * tone)  # petals further back catch less light
    vein = np.exp(-(s / 0.06) ** 2) * (t > 0.05) * (t < 0.85) * 0.025
    col = col - vein[..., None]
    rim = np.clip(1 - (half - np.abs(s)) * width / 8.0, 0, 1) * inside
    col = col + rim[..., None] * 0.035  # light caught along the translucent edge
    alpha = edge * inside * (0.9 - 0.12 * t + lift)
    return np.clip(col, 0, 1), np.clip(alpha, 0, 1)


def leaf_layer(w, h, base, length, width, angle, dark=False):
    yy, xx = np.mgrid[:h, :w].astype(float)
    a = np.radians(angle)
    ux, uy = np.sin(a), -np.cos(a)
    vx, vy = -uy, ux
    rx, ry = xx - base[0], yy - base[1]
    t = (rx * ux + ry * uy) / length
    s = (rx * vx + ry * vy) / width
    half = np.where((t > 0) & (t < 1), np.sin(np.pi * np.clip(t, 0, 1)) ** 0.9, 0)
    edge = np.clip((half - np.abs(s)) * width / 2.5, 0, 1)
    lam = np.clip(0.5 - 0.35 * s + 0.2 * (1 - t), 0, 1) * (0.85 + 0.3 * noise(w, h, 60, 3, int(angle) % 97))
    lo, hi = hexc('#262B1C'), hexc('#717857')
    col = lo + (hi - lo) * lam[..., None] * (0.75 if dark else 1)
    rib = np.exp(-(s / 0.04) ** 2) * (t > 0.02) * (t < 0.95)
    col = col + rib[..., None] * 0.05
    return np.clip(col, 0, 1), edge * (np.abs(s) < half)


def over(dst_rgb, dst_a, rgb, a):
    a = a[..., None]
    out_a = a + dst_a[..., None] * (1 - a)
    out = (rgb * a + dst_rgb * dst_a[..., None] * (1 - a)) / np.maximum(out_a, 1e-6)
    return out, out_a[..., 0]


def magnolia(name, open_flower=False):
    """A white magnolia on its stem, lit from the top left, petals translucent at their rims and
    the lower leaves out of focus. Drawn at 2x and reduced to 420x700."""
    reseed(name)
    w, h = 840, 1400
    rgb, a = np.zeros((h, w, 3)), np.zeros((h, w))
    # out-of-focus lower leaves first, blurred as their own layer
    lrgb, la = np.zeros((h, w, 3)), np.zeros((h, w))
    for base, length, width, ang in [((420, 1230), 430, 120, -58), ((440, 1120), 380, 100, 62), ((430, 1390), 360, 110, 30)]:
        c, al = leaf_layer(w, h, base, length, width, ang, dark=True)
        lrgb, la = over(lrgb, la, c, al)
    pm = np.dstack([lrgb * la[..., None], la])
    pm = gblur(pm, 9)
    la = np.clip(pm[..., 3], 0, 1)
    lrgb = pm[..., :3] / np.maximum(la[..., None], 1e-6)
    rgb, a = over(rgb, a, lrgb, la)
    # stem
    stem = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(stem)
    pts = [(430 + 14 * np.sin(k / 9), 600 + k * 9) for k in range(90)]
    d.line(pts, fill=255, width=13, joint='curve')
    sa = gblur(np.asarray(stem).astype(float) / 255, 1.2)
    rgb, a = over(rgb, a, np.broadcast_to(hexc('#4A4A33'), (h, w, 3)), np.clip(sa, 0, 1))
    # one sharp leaf near the flower
    c, al = leaf_layer(w, h, (436, 760), 330, 92, 48)
    rgb, a = over(rgb, a, c, al)
    # petals: back ones first, a little darker; front ones lit
    base = (430, 640)
    if open_flower:
        petals = [(-62, 360, 120, 0.9, -0.05), (60, 350, 120, 0.9, -0.05), (-34, 420, 135, 0.6, 0.0), (32, 410, 130, 0.6, 0.0),
                  (-12, 440, 140, 0.3, 0.05), (14, 430, 128, 0.2, 0.06)]
    else:
        petals = [(-26, 430, 120, 0.9, -0.06), (24, 420, 118, 0.9, -0.06), (-12, 470, 128, 0.5, 0.0), (12, 460, 124, 0.5, 0.0),
                  (-3, 490, 132, 0.25, 0.06)]
    for ang, length, width, tone, lift in petals:
        c, al = petal_layer(w, h, base, length, width, ang, tone, lift)
        rgb, a = over(rgb, a, c, al)
    # a soft calyx where the petals meet the stem
    cal = np.zeros((h, w))
    yy, xx = np.mgrid[:h, :w].astype(float)
    cal = np.exp(-(((xx - 430) / 40) ** 2 + ((yy - 650) / 26) ** 2) * 2)
    rgb, a = over(rgb, a, np.broadcast_to(hexc('#6F7449'), (h, w, 3)), np.clip(cal * 0.9, 0, 1))
    pm = gblur(np.dstack([rgb * a[..., None], a]), 1.1)  # a touch of lens softness, like the photographs
    out = resize(pm, 420, 700)
    al = np.clip(out[..., 3], 0, 1)
    col = np.clip(out[..., :3] / np.maximum(al[..., None], 1e-6), 0, 1)
    col = np.clip(col + rng.normal(0, 0.008, col.shape[:2] + (1,)), 0, 1)
    save_png(np.dstack([col, al]), name)
    return np.dstack([col * al[..., None], al])


def stone_magnolias():
    pm = magnolia('stone-magnolia')
    blurred = gblur(pm, 18 / 2)  # sigma 18 at the 2x drawing size
    al = np.clip(blurred[..., 3], 0, 1)
    save_png(np.dstack([np.clip(blurred[..., :3] / np.maximum(al[..., None], 1e-6), 0, 1), al]), 'stone-magnolia-blur')
    magnolia('stone-magnolia-open', open_flower=True)


# ---------------------------------------------------------------------------------------------
# Paper: milk glass on morning mist.


def noise(w, h, scale, octaves=4, seed=7):
    """Soft value noise in 0..1 for fog and mist."""
    r = np.random.default_rng(seed)
    out = np.zeros((h, w))
    amp, total = 1.0, 0.0
    for o in range(octaves):
        sw, sh = max(2, int(w / scale) * 2 ** o), max(2, int(h / scale) * 2 ** o)
        layer = Image.fromarray((r.random((sh, sw)) * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        out += np.asarray(layer).astype(float) / 255 * amp
        total += amp
        amp *= 0.5
    return out / total


def ridge(w, y0, amp, freqs, seed):
    """A mountain ridge line: height per column, in pixels from the top."""
    r = np.random.default_rng(seed)
    x = np.linspace(0, 1, w)
    y = np.full(w, float(y0))
    for f, a in freqs:
        y += np.sin(x * f * np.pi * 2 + r.uniform(0, 6.3)) * amp * a
    return y


def fill_below(img, line, color, soft=2, alpha=1.0):
    h, w = img.shape[:2]
    yy = np.arange(h)[:, None]
    m = np.clip((yy - line[None, :]) / soft + 0.5, 0, 1)[..., None] * alpha
    return img * (1 - m) + np.asarray(color) * m


def pines(img, spots, color, seed=11, tiers=5, blur=0.8):
    """Pine silhouettes: stacked triangles on a trunk, drawn with Pillow then blended."""
    h, w = img.shape[:2]
    layer = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(layer)
    r = np.random.default_rng(seed)
    for x, base, height in spots:
        for t in range(tiers):
            top = base - height + t * height / tiers * 0.78
            bottom = top + height / tiers * 1.5
            half = (t + 1.3) / tiers * height * 0.26 * r.uniform(0.9, 1.1)
            d.polygon([(x, top), (x - half, bottom), (x + half, bottom)], fill=255)
        d.rectangle([x - height * 0.015, base - height * 0.1, x + height * 0.015, base], fill=255)
    m = np.asarray(layer.filter(ImageFilter.GaussianBlur(blur))).astype(float)[..., None] / 255
    return img * (1 - m) + np.asarray(color) * m


def mountain_header(name, w, h, sky_top, sky_bottom, ridges, pine_color, fog_color, fog_strength, light=None,
                    pine_blur=0.8, pine_tiers=5, keep=None, scale=0.75, tilt=0.0, ceiling=0.0):
    """A misty ridge with pines whose alpha fades it into the page along the left and the bottom, so it sits
    behind a header without any masking in the app. Returns the premultiplied RGBA at full size."""
    img = np.zeros((h, w, 3))
    t = np.linspace(0, 1, h)[:, None, None]
    img[:] = np.asarray(sky_top) * (1 - t) + np.asarray(sky_bottom) * t
    if light:
        glow(img, light[0] * w, light[1] * h, light[2] * w, hexc(light[3]), light[4])
    for y0, amp, color, seed in ridges:
        line = ridge(w, y0 * h, amp * h, [(1.3, 1), (3.1, 0.45), (7, 0.18), (17, 0.06)], seed)
        # tilt > 0 lifts the ridges on the right, where the header buttons sit, and lowers them under the
        # greeting on the left; ceiling keeps every peak below that fraction of the height.
        line = np.maximum(line + tilt * h * (0.5 - np.linspace(0, 1, w)), ceiling * h)
        img = fill_below(img, line, hexc(color))
        mist = noise(w, h, 90, 3, seed + 1) * np.exp(-((np.arange(h)[:, None] - (y0 * h + amp * h * 0.9)) / (h * 0.09)) ** 2)
        img = img * (1 - mist[..., None] * fog_strength) + hexc(fog_color) * mist[..., None] * fog_strength
    r = np.random.default_rng(5)
    spots = [(w * (0.58 + 0.42 * k / 7) + r.uniform(-20, 20), h * r.uniform(0.86, 0.98), h * r.uniform(0.22, 0.42)) for k in range(8)]
    img = pines(img, spots, hexc(pine_color), tiers=pine_tiers, blur=pine_blur)
    fog = noise(w, h, 140, 4, 21)
    img = img * (1 - fog[..., None] * fog_strength * 0.45) + hexc(fog_color) * fog[..., None] * fog_strength * 0.45
    x = np.linspace(0, 1, w)[None, :]
    y = np.linspace(0, 1, h)[:, None]
    alpha = keep(x, y) if keep else np.clip((x - 0.08) / 0.5, 0, 1) ** 1.4 * np.clip((0.95 - y) / 0.4, 0, 1) ** 1.2
    alpha = np.broadcast_to(alpha, (h, w))
    img = np.clip(grain(img, 0.01), 0, 1)
    out = resize(np.dstack([img * alpha[..., None], alpha]), int(w * scale), int(h * scale))
    al = np.clip(out[..., 3], 0, 1)
    save_png(np.dstack([np.clip(out[..., :3] / np.maximum(al[..., None], 1e-6), 0, 1), al]), name)
    return np.dstack([img * alpha[..., None], alpha])


def paper_backdrop():
    """A bright, cool daylight page: a warm dawn glow top right, a sage bounce lower left, and a far
    ridge drowned in mist, so the hub screens also sit in the mountains."""
    reseed('paper-bg')
    img = gradient([(0, hexc('#F8F7F3')), (0.45, hexc('#EEEFEA')), (1, hexc('#E4E7E1'))], tilt=0.1)
    glow(img, W * 0.82, H * 0.04, W * 0.75, hexc('#FFF3DC'), 0.55)
    glow(img, W * 0.1, H * 0.62, W * 0.6, hexc('#DCE6DC'), 0.30)
    glow(img, W * 0.9, H * 0.86, W * 0.5, hexc('#F1E6D6'), 0.25)
    line = ridge(W, H * 0.18, H * 0.06, [(1.1, 1), (2.9, 0.4), (6.5, 0.15), (15, 0.05)], 41)
    ridge_img = fill_below(img.copy(), line, hexc('#B9B6AE'), soft=3)
    mist = noise(W, H, 140, 4, 43)[..., None]
    fade = np.clip(1 - (np.arange(H)[:, None, None] - H * 0.18) / (H * 0.35), 0, 1)  # the ridge sinks into the fog
    m = 0.18 * fade * (1 - 0.6 * mist)
    img = img * (1 - m) + ridge_img * m
    return grain(img, 0.012)


def paper_header():
    """Warm, photographic ridges and pines in morning fog behind the Today trail."""
    def keep(x, y):
        return np.clip((x - 0.06) / 0.5, 0, 1) ** 1.3 * np.clip((1.0 - y) / 0.45, 0, 1) ** 1.1
    pm = mountain_header('paper-header', 1080, 1200, hexc('#F8F7F3'), hexc('#EEEFEA'),
                         [(0.30, 0.12, '#A7A39A', 3), (0.44, 0.11, '#8C887F', 4), (0.58, 0.10, '#6F6C64', 6)],
                         '#4E5149', '#F4F3EF', 0.85, light=(0.8, 0.05, 0.45, '#FFF1D6', 0.4),
                         pine_blur=2.2, pine_tiers=7, keep=keep, tilt=0.12, ceiling=0.12)
    # The header seen through glass: the same art, blurred as much as the lens (sigma 24 at half size).
    small = resize(pm, 540, 600)
    small = gblur(small, 24)
    al = np.clip(small[..., 3], 0, 1)
    save_png(np.dstack([np.clip(small[..., :3] / np.maximum(al[..., None], 1e-6), 0, 1), al]), 'paper-header-blur')


def paper_lights():
    w, h = LENS_W, LENS_H
    y, x = np.mgrid[:h, :w].astype(float)
    d = np.hypot(x - 0.82 * w, y - 0.04 * h)
    light_png('paper-light-sun', w, h, '#FFF1D6', falloff(d, 0.6 * w) * 0.35)
    # Mist over the header: soft noise, 1080x600 at half size.
    mw, mh = 540, 300
    n = noise(mw, mh, 70, 4, 77)
    vy = np.linspace(0, 1, mh)[:, None]
    vx = np.linspace(0, 1, mw)[None, :]
    env = np.clip(vy / 0.25, 0, 1) * np.clip((1 - vy) / 0.35, 0, 1) * np.clip((1 - np.abs(vx - 0.6) * 1.4), 0.25, 1)
    light_png('paper-mist', mw, mh, '#FBFAF6', np.clip((n - 0.35) / 0.5, 0, 1) * env * 0.5)


# ---------------------------------------------------------------------------------------------
# Pine: a night training hub in a pine forest.


def pine_backdrop():
    """Night in the pines: a deep evergreen floor, a mint moon glow top right, a low aurora band,
    mint mist and a pine ridge along the foot."""
    reseed('pine-bg')
    img = gradient([(0, hexc('#0B2A24')), (0.45, hexc('#071D19')), (1, hexc('#03110E'))], tilt=0.12)
    glow(img, W * 0.84, H * 0.02, W * 0.6, hexc('#2E8F74'), 0.22)
    glow(img, W * 0.04, H * 0.46, W * 0.55, hexc('#114A3C'), 0.45)
    # aurora: a soft band from (0, 0.30H) up to (W, 0.18H)
    yy, xx = np.mgrid[:H, :W].astype(float)
    centre = H * 0.30 + (H * 0.18 - H * 0.30) * xx / W
    band = np.exp(-((yy - centre) / (H * 0.035)) ** 2)
    band = gblur(band, 60)
    img = img * (1 - band[..., None] * 0.12) + hexc('#1F6E5A') * band[..., None] * 0.12
    for yc in (0.30, 0.70):
        mist = np.exp(-((yy - H * yc) / (H * 0.05)) ** 2) * noise(W, H, 200, 3, int(yc * 100))
        img = img * (1 - mist[..., None] * 0.12) + hexc('#2C7A66') * mist[..., None] * 0.12
    # the ridge along the foot, with a mist band above it
    line = ridge(W, H * 0.86, H * 0.025, [(1.7, 1), (4.3, 0.4), (11, 0.15)], 61)
    mist = np.exp(-((yy - H * 0.85) / (H * 0.03)) ** 2)
    img = img * (1 - mist[..., None] * 0.22) + hexc('#1A5547') * mist[..., None] * 0.22
    r = np.random.default_rng(63)
    spots = [(W * k / 13 + r.uniform(-30, 30), H * 0.9 + r.uniform(-10, 30), H * r.uniform(0.06, 0.1)) for k in range(14)]
    img = fill_below(img, line, hexc('#03100C'), soft=4)
    img = pines(img, spots, hexc('#03100C'), seed=64, blur=1.5)
    m = noise(W, H, 260, 3, 31)[..., None]
    img = img * (1 - m * 0.03) + hexc('#2C7A66') * m * 0.03
    return grain(img, 0.006)


def pine_lights():
    w, h = LENS_W, LENS_H
    y, x = np.mgrid[:h, :w].astype(float)
    d = np.hypot(x - 0.84 * w, y - 0.05 * h)
    light_png('pine-light-moon', w, h, '#7CE3BC', falloff(d, 210 / 2) * 0.12)


def pine_header():
    mountain_header('pine-header', 1080, 900, hexc('#1B5A4C'), hexc('#0A2B25'),
                    [(0.3, 0.16, '#164A3F', 3), (0.46, 0.14, '#0F3A31', 4), (0.62, 0.11, '#0B2E27', 6)],
                    '#04170F', '#2A6A58', 0.5, light=(0.78, 0.12, 0.3, '#7CE3BC', 0.28))


# ---------------------------------------------------------------------------------------------
# Lens export.

BACKDROPS = {'lavender': lavender_backdrop, 'stone': stone_backdrop, 'paper': paper_backdrop, 'pine': pine_backdrop}
LIGHTS = {'lavender': lavender_lights, 'stone': stone_lights, 'paper': paper_lights, 'pine': pine_lights}
EXTRAS = {'stone': [stone_magnolias], 'paper': [paper_header], 'pine': [pine_header]}


def export_look(name):
    """The sharp backdrop, its lens and its lights, plus the look's own pieces."""
    img = BACKDROPS[name]()
    save(img, f'{name}-bg')
    lens(img, name)
    LIGHTS[name]()
    for extra in EXTRAS.get(name, []):
        extra()


def glass_grain():
    """A 128x128 tileable satin grain for Stone's matte glass: light and dark specks, mean alpha 0.5."""
    reseed('glass-grain')
    n = rng.random((128, 128))
    # blur with wrap-around, so the tile repeats without seams
    f = np.fft.fft2(n) * np.exp(-2 * (np.pi * 0.7) ** 2 * (np.fft.fftfreq(128)[:, None] ** 2 + np.fft.fftfreq(128)[None, :] ** 2))
    n = np.real(np.fft.ifft2(f))
    n = (n - n.mean()) / (n.std() * 3.2) + 0.5
    v = np.clip(n, 0, 1)
    light = v > 0.5
    col = np.where(light[..., None], 1.0, 0.0) * np.ones(3)
    alpha = np.abs(v - 0.5) * 2
    alpha = np.clip(alpha * (0.5 / alpha.mean()), 0, 1)
    Image.fromarray((np.dstack([col, alpha]) * 255 + 0.5).astype(np.uint8), 'RGBA').save(f'{OUT}/glass-grain.png', optimize=True)


# ---------------------------------------------------------------------------------------------
# Scenes for SceneArt and Now Playing.


def portal(name, top, mid, horizon, glow_color, figure, size=1000):
    """A glowing ring over still water, reflected, with an optional small figure."""
    reseed(name)
    w = h = size
    hz = int(0.64 * h)
    y = np.linspace(0, 1, h)[:, None]
    sky = np.clip(y / 0.64, 0, 1)
    img = np.zeros((h, w, 3))
    for k in range(3):
        img[..., k] = np.where(sky < 0.55, top[k] + (mid[k] - top[k]) * (sky / 0.55),
                               mid[k] + (horizon[k] - mid[k]) * ((sky - 0.55) / 0.45))
    cx, cy, r = 0.6 * w, hz - 0.2 * h, 0.24 * w
    yy, xx = np.mgrid[:h, :w].astype(float)
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    edge = np.abs(dist - r)
    light = (np.exp(-(edge / 3.5) ** 2) + np.exp(-(edge / 18) ** 2) * 0.55 + np.exp(-(edge / 60) ** 2) * 0.3
             + np.exp(-(dist / r) ** 2 * 1.5) * 0.18
             + np.exp(-(((xx - cx) / (w * 0.5)) ** 2 + ((yy - hz) / (h * 0.12)) ** 2)) * 0.6)
    img = 1 - (1 - img) * (1 - np.clip(light[..., None] * glow_color, 0, 1))
    for _ in range(70):
        sx, sy, s, a = rng.uniform(0, w), rng.uniform(0, hz * 0.8), rng.uniform(0.6, 1.8), rng.uniform(0.3, 0.9)
        star = np.exp(-((xx - sx) ** 2 + (yy - sy) ** 2) / (s ** 2 * 2)) * a
        img = 1 - (1 - img) * (1 - star[..., None])
    refl = img[hz - 1::-1][:h - hz].copy()
    for i in range(h - hz):
        refl[i] = np.roll(refl[i], int(6 * np.sin(i * 0.25) * (i / (h - hz) + 0.2)), axis=0)
    refl = gblur(refl, 3)
    dark = np.linspace(0.75, 0.35, h - hz)[:, None, None]
    img[hz:] = refl * dark + top * (1 - dark) * 0.5
    for i in range(0, h - hz, 9):
        shimmer = np.exp(-((np.arange(w) - cx) / (r * 1.1)) ** 2) * 0.5 * np.exp(-i / 120)
        img[hz + i] = np.clip(img[hz + i] + shimmer[:, None] * glow_color * 0.6, 0, 1)
    if figure:
        im = Image.fromarray(to8(img))
        d = ImageDraw.Draw(im)
        d.ellipse([cx - 90, hz - 6, cx + 90, hz + 10], fill=(30, 18, 60))
        d.polygon([(cx - 9, hz - 2), (cx - 7, hz - 62), (cx + 7, hz - 62), (cx + 9, hz - 2)], fill=(22, 12, 45))
        d.ellipse([cx - 9, hz - 82, cx + 9, hz - 64], fill=(22, 12, 45))
        img = np.asarray(im).astype(float) / 255
    save(grain(img, 0.015), name, quality=86)


def scenes_lavender(only=None):
    specs = {
        'portal-dusk': (hexc('#251660'), hexc('#7C47C8'), hexc('#F59AD2'), hexc('#FFD6F6'), True),
        'portal-rain': (hexc('#1C1660'), hexc('#5A4BD0'), hexc('#B9A8FF'), hexc('#EAD8FF'), False),
        'portal-waves': (hexc('#28155A'), hexc('#A148B6'), hexc('#FFA8C3'), hexc('#FFE2EE'), False),
        'portal-brown': (hexc('#2A183C'), hexc('#894769'), hexc('#F2AF78'), hexc('#FFE6C4'), False),
    }
    for name, args in specs.items():
        if only is None or name in only:
            portal(name, *args)


def portal_rain():
    """Only the re-coloured rain portal (violet-blue); the other portals are unchanged."""
    scenes_lavender(only={'portal-rain'})


def stones_scene(name, variant, size=1000):
    """Smooth stones in still water with a silk ribbon, softly lit from the top left: the water mirrors
    the stones, the silk is translucent with specular folds, and each variant changes the water and the light."""
    reseed(name)
    w = h = size
    yy, xx = np.mgrid[:h, :w].astype(float)
    tops = {'calm': ('#B7B29B', '#77735F', '#3D3B30'), 'rain': ('#A9AEA6', '#6A6F66', '#33372F'),
            'waves': ('#B9B49B', '#7A7660', '#3B3A2E'), 'brown': ('#C9B08E', '#7C6A50', '#3A3024')}[variant]
    img = gradient([(0, hexc(tops[0])), (0.5, hexc(tops[1])), (1, hexc(tops[2]))], w, h, tilt=0.3)
    if variant == 'brown':
        glow(img, 1.05 * w, 0.32 * h, 0.7 * w, hexc('#FFC98A'), 0.55)  # a low warm sun
    if variant == 'waves':
        swell = np.sin(yy / 14 + np.sin(xx / 90) * 2.2) * np.exp(-((yy - 0.75 * h) / (0.4 * h)) ** 2)
        img = np.clip(img + swell[..., None] * 0.035, 0, 1)
    light = np.array([-0.55, -0.65, 0.52])
    light /= np.linalg.norm(light)
    stones_rgb = np.zeros((h, w, 3))
    mask = np.zeros((h, w))
    refl_rgb, refl_a = np.zeros((h, w, 3)), np.zeros((h, w))
    for cx, cy, rx, ry, tone in [(0.72, 0.42, 0.15, 0.1, 0.95), (0.38, 0.5, 0.27, 0.17, 1.0), (0.62, 0.72, 0.3, 0.15, 0.9)]:
        cx, cy, rx, ry = cx * w, cy * h, rx * w, ry * h
        nx, ny = (xx - cx) / rx, (yy - cy) / ry
        inside = nx ** 2 + ny ** 2 < 1
        nz = np.sqrt(np.clip(1 - nx ** 2 - ny ** 2, 0, 1))
        lam = np.clip(nx * light[0] + ny * light[1] + nz * light[2], 0, 1)
        spec = lam ** 18 * 0.35
        base = hexc('#9C9580') * tone
        shade = base * (0.28 + 0.85 * lam)[..., None] + spec[..., None]
        if variant == 'brown':
            shade = shade + np.clip(nx, 0, 1)[..., None] * hexc('#FFB866') * 0.18  # warm rim from the sun on the right
        sh = np.exp(-(((xx - cx) / (rx * 1.05)) ** 2 + ((yy - cy - ry * 0.9) / (ry * 0.45)) ** 2) * 2)
        img *= (1 - 0.40 * sh)[..., None]
        # the reflection: the stone mirrored about its waterline
        wl = cy + ry * 0.85
        src = np.clip((2 * wl - yy).astype(int), 0, h - 1)
        rin = inside[src, xx.astype(int)] & (yy > wl)
        refl_rgb = np.where(rin[..., None], shade[src, xx.astype(int)], refl_rgb)
        refl_a = np.maximum(refl_a, rin.astype(float))
        stones_rgb = np.where(inside[..., None], shade, stones_rgb)
        mask = np.maximum(mask, inside.astype(float))
    # reflections first (under the stones), softened by the water
    ra = gblur(refl_a, 6) * 0.35
    rr = gblur(refl_rgb * refl_a[..., None], 6) / np.maximum(gblur(refl_a, 6)[..., None], 1e-3)
    img = img * (1 - ra[..., None]) + rr * ra[..., None]
    if variant == 'rain':
        for _ in range(26):
            px, py, rr0 = rng.uniform(0, w), rng.uniform(0.25 * h, h), rng.uniform(10, 46)
            d = np.hypot((xx - px), (yy - py) * 2.6)
            ring = np.exp(-((d - rr0) / 1.6) ** 2) * 0.10 + np.exp(-((d - rr0 * 0.6) / 1.4) ** 2) * 0.06
            img = np.clip(img + ring[..., None], 0, 1)
    m = gblur(mask, 3)[..., None]
    img = img * (1 - m) + stones_rgb * m
    # silk: a translucent ribbon along a curve, with specular folds
    silk = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(silk)
    t = np.linspace(0, 1, 220)
    px = (0.22 + 0.62 * t) * w
    py = (0.36 + 0.08 * np.sin(t * 5.5) + 0.12 * t) * h
    for i in range(len(t) - 1):
        width = int(70 * np.sin(np.pi * t[i]) ** 0.7 + 12)
        d.line([(px[i], py[i]), (px[i + 1], py[i + 1])], fill=255, width=width)
    sa = gblur(np.asarray(silk).astype(float) / 255, 4)[..., None]
    folds = 0.5 + 0.5 * np.sin(xx / 22 + yy / 40 + np.sin(xx / 70) * 1.5)
    spec = (folds ** 6 * 0.25)[..., None]
    silk_col = hexc('#F7F3E8') * (0.86 + 0.14 * folds[..., None]) + spec
    img = img * (1 - sa * 0.78) + silk_col * sa * 0.78
    glow(img, -0.1 * w, -0.1 * h, 0.9 * w, hexc('#FFF6DC'), 0.30 if variant != 'brown' else 0.15)
    save(grain(img, 0.016), name, quality=86)


def scenes_stone():
    for v in ('calm', 'rain', 'waves', 'brown'):
        stones_scene(f'stones-{v}', v)


def landscape(name, sky, ridges, fog, pine_color=None, light=None, water=None, rain=0, size=1000, grain_amt=0.012,
              stars=0, moon=None, ember=None):
    """A square scene in the mountains: sky, a sun or moon glow, misty ridges, pines, and optionally
    a lake that mirrors it all or rain falling through it."""
    reseed(name)
    w = h = size
    img = gradient([(0, hexc(sky[0])), (1, hexc(sky[1]))], w, h, tilt=0.0)
    yy, xx = np.mgrid[:h, :w].astype(float)
    for _ in range(stars):
        sx, sy, s, a = rng.uniform(0, w), rng.uniform(0, h * 0.45), rng.uniform(0.5, 1.4), rng.uniform(0.2, 0.7)
        img = 1 - (1 - img) * (1 - (np.exp(-((xx - sx) ** 2 + (yy - sy) ** 2) / (s ** 2 * 2)) * a)[..., None])
    if light:
        glow(img, light[0] * w, light[1] * h, light[2] * w, hexc(light[3]), light[4])
    if moon:
        mx, my, mr, mc = moon
        dd = np.hypot(xx - mx * w, yy - my * h)
        disc = np.clip((mr * w - dd) / 2.0, 0, 1)
        halo = np.exp(-(dd / (mr * w * 3.2)) ** 2) * 0.45
        img = 1 - (1 - img) * (1 - np.clip(disc * 0.95 + halo, 0, 1)[..., None] * hexc(mc))
    horizon = water if water else 1.0
    for y0, amp, color, seed in ridges:
        line = ridge(w, y0 * h, amp * h, [(1.3, 1), (3.1, 0.45), (7, 0.18), (17, 0.06)], seed)
        line = np.minimum(line, horizon * h)
        img = fill_below(img, line, hexc(color))
        mist = noise(w, h, 80, 3, seed + 1) * np.exp(-((yy - (y0 * h + amp * h * 0.9)) / (h * 0.07)) ** 2)
        img = img * (1 - mist[..., None] * fog[1]) + hexc(fog[0]) * mist[..., None] * fog[1]
    if pine_color:
        r = np.random.default_rng(zlib.crc32(name.encode()) % 1000)
        base_y = horizon * h if water else h * 0.98
        spots = [(w * (0.02 + 0.96 * k / 11) + r.uniform(-25, 25), base_y + r.uniform(-6, 10), h * r.uniform(0.14, 0.32))
                 for k in range(12) if not (0.35 < k / 11 < 0.62)]
        img = pines(img, spots, hexc(pine_color), seed=zlib.crc32(name.encode()) % 997, tiers=7, blur=1.4)
    if ember:
        ex, ey, er, ec, es = ember
        dd = np.hypot((xx - ex * w), (yy - ey * h) * 1.6)
        img = 1 - (1 - img) * (1 - (np.exp(-(dd / (er * w)) ** 2 * 2.2) * es)[..., None] * hexc(ec))
    if water:
        hz = int(water * h)
        refl = img[hz - 1::-1][:h - hz].copy()
        for i in range(h - hz):
            refl[i] = np.roll(refl[i], int(4 * np.sin(i * 0.3) * (i / (h - hz) + 0.2)), axis=0)
        refl = gblur(refl, 3)
        depth = np.linspace(0.82, 0.55, h - hz)[:, None, None]
        img[hz:] = refl * depth + hexc(sky[1]) * (1 - depth) * 0.4
        for i in range(0, h - hz, 7):
            img[hz + i] = np.clip(img[hz + i] + 0.025 * np.exp(-i / 160), 0, 1)
    if rain:
        layer = Image.new('L', (w, h), 0)
        d = ImageDraw.Draw(layer)
        for _ in range(rain):
            x, y, ln = rng.uniform(-50, w), rng.uniform(-50, h), rng.uniform(18, 46)
            d.line([(x, y), (x + ln * 0.18, y + ln)], fill=int(rng.uniform(60, 150)), width=1)
        streaks = gblur(np.asarray(layer).astype(float) / 255, 0.7)[..., None]
        img = 1 - (1 - img) * (1 - streaks * 0.35)
    fogn = noise(w, h, 140, 4, 21)[..., None]
    img = img * (1 - fogn * fog[1] * 0.25) + hexc(fog[0]) * fogn * fog[1] * 0.25
    save(grain(img, grain_amt), name, quality=86)


def scenes_paper():
    landscape('paper-rain', ('#DDE1DC', '#9BA39C'), [(0.40, 0.12, '#AFB5AE', 3), (0.55, 0.10, '#8D958E', 4), (0.70, 0.08, '#6E766F', 6)],
              ('#E9ECE7', 0.6), pine_color='#4E5650', rain=900)
    landscape('paper-waves', ('#F3F1EC', '#A9B4B2'), [(0.38, 0.10, '#C4C7C1', 7), (0.50, 0.08, '#A2A8A3', 8)],
              ('#F4F3EF', 0.6), pine_color='#5A615C', light=(0.72, 0.22, 0.4, '#FFF1D6', 0.45), water=0.62)
    landscape('paper-focus', ('#F6EEE2', '#8C887F'), [(0.34, 0.14, '#C9BFAE', 11), (0.50, 0.12, '#A79F90', 12), (0.66, 0.10, '#837D72', 13)],
              ('#F6F1E8', 0.65), pine_color='#4E5149', light=(0.3, 0.2, 0.5, '#FFE7C2', 0.6))


def scenes_pine():
    landscape('pine-rain', ('#0B2A24', '#071D19'), [(0.48, 0.10, '#0E3A31', 3), (0.62, 0.08, '#0A2D26', 5)], ('#1E5C4D', 0.35),
              pine_color='#03100C', moon=(0.72, 0.2, 0.045, '#BFF5DF'), rain=1100, grain_amt=0.008, stars=0)
    landscape('pine-waves', ('#0C2E28', '#0A2620'), [(0.40, 0.09, '#0F3A31', 7), (0.50, 0.07, '#0B2E27', 8)], ('#1E5C4D', 0.3),
              pine_color='#03100C', moon=(0.30, 0.18, 0.04, '#BFF5DF'), water=0.6, grain_amt=0.008, stars=60)
    landscape('pine-brown', ('#0A231E', '#06140F'), [(0.46, 0.10, '#0D3129', 11), (0.60, 0.08, '#08221C', 12)], ('#1A5547', 0.3),
              pine_color='#020C09', ember=(0.5, 0.95, 0.35, '#F2B061', 0.75), grain_amt=0.008, stars=40)
    landscape('pine-dusk', ('#1F5A4C', '#9FD9C2'), [(0.42, 0.12, '#2A6A58', 13), (0.56, 0.10, '#164D41', 14), (0.70, 0.08, '#0E3A31', 15)],
              ('#7CC9AE', 0.35), pine_color='#04170F', light=(0.5, 0.55, 0.6, '#C8F5E2', 0.5), grain_amt=0.008)


TARGETS = {
    'lavender': lambda: export_look('lavender'), 'stone': lambda: export_look('stone'),
    'paper': lambda: export_look('paper'), 'pine': lambda: export_look('pine'),
    'grain': glass_grain, 'scenes-lavender': scenes_lavender, 'scenes-stone': scenes_stone,
    'scenes-paper': scenes_paper, 'scenes-pine': scenes_pine,
}


def main(targets):
    for t in targets or list(TARGETS):
        fn = TARGETS.get(t) or globals().get(t)
        if not fn:
            raise SystemExit(f'unknown target {t}')
        print('rendering', t, flush=True)
        fn()


if __name__ == '__main__':
    main(sys.argv[1:])
