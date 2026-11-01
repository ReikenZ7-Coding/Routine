"""Renders every look's artwork into assets/art.

Per look (export_look):
  <look>-bg.jpg        the sharp backdrop, 1080x2340
  <look>-bg-blur.jpg   the lens: the backdrop with the scrim and top veil composited exactly as Ambience draws
                       them (values from assets/art/looks.json), Gaussian sigma 24 at 540x1170, saturation per look
  <light>.png          the look's moving light layers, alpha PNGs (see looks.json for their boxes and motion)
plus the look's own pieces (Paper's header, mist and header lens; Pine's canopy) and scene sets for
SceneArt and Now Playing: lavender-* light studies (Lavender), stones-* (Stone), paper-* (Paper), pine-* (Pine).

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


def bokeh(img, n, rmin, rmax, color, alpha, blur, ymax=1.0, gutter=None):
    """Soft discs of light. With `gutter` (a fraction of the width), every disc keeps clear of the screen's side
    gutters, so none sits half hidden at a pane's edge."""
    h, w = img.shape[:2]
    layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for _ in range(n):
        if gutter is None:
            x, y, r = rng.uniform(0, w), rng.uniform(0, h * ymax), rng.uniform(rmin, rmax)
        else:
            r = rng.uniform(rmin, rmax)
            x, y = rng.uniform(w * gutter + r + blur * 2, w * (1 - gutter) - r - blur * 2), rng.uniform(0, h * ymax)
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
    """A lit periwinkle world. A pale periwinkle wash pours in from the top left; a rose pool glows on the
    right, an azure pool on the left, lilac and blue pools lower down, with soft bokeh (clear of the side
    gutters, so no disc sits half hidden at a pane's edge). No star specks: between panes they read as stray UI dots. The light lives in hue, not
    brightness: luminance_budget keeps the world, as the lens sees it, inside what white type on the frost
    needs (scripts/check-contrast.py), and lifts the dimmer pools up toward that budget so the floor never
    sinks into navy."""
    reseed('lavender-bg')
    k = LAV
    img = gradient([(0, hexc(k['g0'])), (0.12, hexc(k['g1'])), (0.34, hexc(k['g2'])), (0.66, hexc(k['g3'])), (1, hexc(k['g4']))], tilt=0.12)
    glow(img, W * 0.0, H * -0.04, W * 0.95, hexc(k['top_c']), k['top'])
    glow(img, W * 1.05, H * 0.17, W * 0.58, hexc(k['lilac_c']), k['lilac'])
    glow(img, W * 1.02, H * 0.45, W * 0.66, hexc(k['pink_c']), k['pink'])
    glow(img, W * -0.12, H * 0.62, W * 0.66, hexc(k['blue_c']), k['blue'])
    glow(img, W * 0.10, H * 0.90, W * 0.66, hexc(k['violet_c']), k['violet'])
    glow(img, W * 1.0, H * 0.97, W * 0.55, hexc(k['blue2_c']), k['blue2'])
    img = bokeh(img, 14, 30, 90, (214, 220, 255), k['bokeh'], 10, gutter=16 / 400)
    img = luminance_budget(img, k['cap'], k['cap_top'], k['top_end'], floor=k['floor'])
    return grain(img, 0.014)


def to_linear(img):
    return np.where(img <= 0.04045, img / 12.92, ((img + 0.055) / 1.055) ** 2.4)


def to_srgb(lin):
    lin = np.clip(lin, 0, 1)
    return np.where(lin <= 0.0031308, lin * 12.92, 1.055 * lin ** (1 / 2.4) - 0.055)


def luminance_budget(img, cap, cap_top, top_end, seen_sigma=24, floor=None):
    """Keep the world's light inside the budget white type needs: wherever the world, blurred the way the lens
    sees it, is brighter than `cap` (relative luminance), scale that region's light down in linear light. Hue
    and chroma survive, so a pool of light stays a pool of colour. Above `top_end` of the height the cap eases
    up to `cap_top` (the status bar and greeting sit on the bare world, not on glass). With `floor` (a fraction
    of the cap), regions the lens sees as dimmer than floor x cap are lifted toward it, at most 1.8x."""
    lin = to_linear(img)
    h, w = img.shape[:2]
    lum = (lin * np.array([0.2126, 0.7152, 0.0722])).sum(-1)
    seen = gblur(lum, seen_sigma * w / LENS_W)
    t = np.clip(np.linspace(0, 1, h) / top_end, 0, 1)[:, None]
    limit = cap_top + (cap - cap_top) * (t * t * (3 - 2 * t))
    hi = 1.0 if floor is None else 1.8
    target = limit if floor is None else np.maximum(np.minimum(seen, limit), cap * floor)
    gain = gblur(np.clip(target / np.maximum(seen, 1e-6), 0, hi), 12 * w / LENS_W)
    return to_srgb(lin * gain[..., None])


# Tuned against the contrast gate (white type on the frost at 4.5:1 or better). The hues sit on periwinkle
# (about 242 degrees) rather than violet, with rose and lilac pools for warmth; the light lives in hue and in an
# even floor rather than in brightness, because a world as bright as the reference (#7077BD) holds white type
# at about 4.2:1 on its own and under 3.5:1 under frost.
LAV = {'g0': '#A4A8FF', 'g1': '#6066F2', 'g2': '#4E50E2', 'g3': '#4846D4', 'g4': '#423EC6',
       'top_c': '#B8BCFF', 'top': 0.30, 'lilac_c': '#A08CFF', 'lilac': 0.30, 'pink_c': '#E04CC8', 'pink': 0.46,
       'blue_c': '#3F6CFF', 'blue': 0.40, 'violet_c': '#7C64FF', 'violet': 0.36, 'blue2_c': '#4A60FF', 'blue2': 0.30,
       'bokeh': 0.12, 'cap': 0.054, 'cap_top': 0.13, 'top_end': 0.12, 'floor': 0.92}


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


def window_light(specs, angle, blur, fade_at, w=W, h=H, gaps=(28, 40), panes=(70, 130)):
    """Sun through a window: diagonal shafts split by mullions, fading out lower down the room."""
    split = []
    for x0, bw, a in specs:
        x = x0
        while x < x0 + bw:
            pane = rng.uniform(*panes) if bw > panes[1] else bw
            split.append((x, min(pane, x0 + bw - x), a))
            x += pane + rng.uniform(*gaps)
    t = np.clip(np.linspace(0, 1, h) / fade_at, 0, 1)[:, None, None]
    fade = (1 - t * t * (3 - 2 * t))  # smoothstep: full at the window, gone by fade_at
    return beams(split, angle, blur, w, h) * fade


def stone_backdrop():
    """A quiet olive room crossed by crisp diagonal window light. The light lives in contrast, not brightness:
    the shafts are warm and well defined, the shadows between them sink to a cool olive, a sun haze sits in the
    top-left corner and a warm bounce comes off the floor. All warm, no bokeh. The brightest shaft stays inside
    what ivory type on the bare room needs (scripts/check-contrast.py)."""
    reseed('stone-bg')
    k = STONE
    img = gradient([(0, hexc(k['top'])), (0.45, hexc(k['mid'])), (1, hexc(k['low']))], tilt=0.22)
    # the shadow side of the room: cooler and deeper toward the right wall
    glow(img, W * 1.15, H * 0.30, W * 0.9, hexc('#2C2E27'), k['shade'])
    glow(img, -W * 0.10, -H * 0.06, W * k['sun_r'], hexc('#F6E9C8'), k['sun'])
    glow(img, W * 0.15, H * 1.0, W * 0.7, hexc('#8C8467'), k['bounce'])
    light = window_light([(-460, 520, 0.30), (150, 210, 0.24), (430, 90, 0.16)], 32, 18, 0.74, gaps=(30, 44), panes=(150, 230))
    # the floor picks up a little of the light, low on the left
    glow(img, W * 0.05, H * 0.86, W * 0.55, hexc('#6E6956'), k['floor'])
    lin = to_linear(img) + light * k['beams'] * to_linear(hexc('#FFF0CC'))
    img = to_srgb(lin)
    img = luminance_budget(img, k['cap'], k['cap_top'], 0.16, seen_sigma=3)
    return grain(img, 0.018)


# Tuned against the contrast gate. The plan's starting world (#6E6C5A/#4F4E43, sun 0.45, beams at full) puts
# ivory type on the bare room near 3:1; this keeps its hues and moves the light into contrast between shaft and
# shadow. Beam strength is in linear light.
STONE = {'top': '#56554A', 'mid': '#45443B', 'low': '#2E2F28', 'shade': 0.30, 'sun': 0.46, 'sun_r': 0.80, 'bounce': 0.16,
         'beams': 0.36, 'floor': 0.22, 'cap': 0.108, 'cap_top': 0.112}


def stone_lights():
    """One extra window shaft that sways very slowly over the room."""
    w, h = LENS_W, LENS_H
    layer = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(layer)
    dx = np.tan(np.radians(32)) * h
    x0, bw = w * 0.10, w * 0.14
    d.polygon([(x0, 0), (x0 + bw, 0), (x0 + bw + dx, h), (x0 + dx, h)], fill=255)
    a = np.asarray(layer.filter(ImageFilter.GaussianBlur(11))).astype(float) / 255
    t = np.clip(np.linspace(0, 1, h) / 0.72, 0, 1)[:, None]
    a *= (1 - t * t * (3 - 2 * t)) * STONE_BEAM
    light_png('stone-light-beam', w, h, '#FFF0CD', a)


STONE_BEAM = 0.095


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
    # two far ranges drowned in mist, the nearer one a touch firmer, sinking into the fog below
    for y0, amp, color, strength, seed in ((0.15, 0.05, '#C2BEB5', 0.16, 45), (0.19, 0.06, '#B3AFA6', 0.22, 41)):
        line = ridge(W, H * y0, H * amp, [(1.1, 1), (2.9, 0.4), (6.5, 0.15), (15, 0.05), (37, 0.015)], seed)
        ridge_img = fill_below(img.copy(), line, hexc(color), soft=3)
        mist = noise(W, H, 140, 4, seed + 2)[..., None]
        fade = np.clip(1 - (np.arange(H)[:, None, None] - H * y0) / (H * 0.30), 0, 1)
        m = strength * fade * (1 - 0.6 * mist)
        img = img * (1 - m) + ridge_img * m
    return grain(img, 0.012)


def smooth1d(v, sigma):
    """Gaussian smoothing of a 1D profile, edges reflected."""
    r = int(3 * sigma) + 1
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    return np.convolve(np.pad(v, r, mode='reflect'), k, mode='valid')


def streaks(w, h, sx, sy, seed, octaves=3):
    """Anisotropic value noise in 0..1: long in y, short in x, like gullies and couloirs on a rock face."""
    r = np.random.default_rng(seed)
    out = np.zeros((h, w))
    amp, total = 1.0, 0.0
    for o in range(octaves):
        cw, ch = max(2, int(w / sx) * 2 ** o), max(2, int(h / sy) * 2 ** o)
        layer = Image.fromarray(r.random((ch, cw)).astype(np.float32), 'F').resize((w, h), Image.BICUBIC)
        out += np.asarray(layer).astype(float) * amp
        total += amp
        amp *= 0.55
    return np.clip(out / total, 0, 1)


def granite(img, mask_acc, line, tones, fog, haze, seed, depth_fog=0.6, lit_gain=1.0):
    """Paints a granite face below a ridge line. Light comes from the upper right, so faces below a stretch of
    ridge that falls away to the right are lit and the rest sit in shade; gullies run down the face, sheared
    the way the face leans, and mist pools further down. tones = (shade, base, lit) hex; haze mixes the whole
    face toward the fog for distance. Returns the image and the union of the silhouettes."""
    h, w = img.shape[:2]
    shade, base, lit = (hexc(c) for c in tones)
    yy = np.arange(h)[:, None].astype(float)
    d = yy - line[None, :]
    slope = np.gradient(smooth1d(line, 6))
    facing = np.tanh(slope * 1.8)                      # +1 faces the light, -1 faces away
    # The facing carries down the face, blurring and drifting with depth, broken up by gullies.
    lean = np.clip(d, 0, None) * 0.3 * np.tanh(smooth1d(facing, 40) * 2.5)[None, :]
    # arêtes wander as they come down the face, instead of dropping plumb from each summit
    wander = (noise(w, h, 220, 2, seed + 7) - 0.5) * np.clip(d / (h * 0.12), 0, 1) * w * 0.10
    cols = np.clip((np.arange(w)[None, :] + lean + wander).astype(int), 0, w - 1)
    gcols = np.clip((np.arange(w)[None, :] + lean * 0.6).astype(int), 0, w - 1)
    far = smooth1d(facing, 30)
    f = np.take_along_axis(np.broadcast_to(far[None, :], (h, w)), cols, 1)
    near = np.take_along_axis(np.broadcast_to(facing[None, :], (h, w)), cols, 1)
    k = np.exp(-np.clip(d, 0, None) / (h * 0.10))
    face = near * k + f * (1 - k) * 0.7
    g = streaks(w, h, 7, 90, seed)
    g = np.take_along_axis(g, gcols, 1)
    fine = noise(w, h, 9, 3, seed + 3)
    t = np.clip(face * lit_gain + (g - 0.5) * 1.3 + (fine - 0.5) * 0.5, -1, 1)[..., None]
    col = np.where(t > 0, base + (lit - base) * t, base + (base - shade) * t)
    # a bright lip along lit stretches of the crest
    lip = np.clip(1 - np.abs(d - 2) / 5, 0, 1) * np.clip(near, 0, 1)
    col = col + lip[..., None] * 0.07
    # mist pooling lower on the face
    pool = np.clip((d - h * 0.03) / (h * 0.22), 0, 1) ** 0.9 * (0.55 + 0.45 * noise(w, h, 120, 3, seed + 5))
    col = col * (1 - pool[..., None] * depth_fog) + hexc(fog) * pool[..., None] * depth_fog
    col = col * (1 - haze) + hexc(fog) * haze
    m = np.clip(d / 1.6 + 0.5, 0, 1)[..., None]
    img = img * (1 - m) + col * m
    return img, np.maximum(mask_acc, m[..., 0])


def pine_tree(d, x, base, height, r):
    """One spruce: a trunk and stacked, ragged, drooping boughs that widen toward the foot."""
    d.line([(x, base - height), (x, base)], fill=255, width=max(1, int(height * 0.018)))
    n = int(np.clip(height / 6, 10, 26))
    for i in range(n):
        t = i / (n - 1)
        y = base - height * (0.97 - 0.9 * t)
        span = height * 0.25 * (0.06 + 0.94 * t ** 0.9)
        left, right = span * r.uniform(0.7, 1.15), span * r.uniform(0.7, 1.15)
        droop = height * (0.025 + 0.035 * t) * r.uniform(0.7, 1.3)
        lift = height * 0.045
        d.polygon([(x, y - lift), (x - left * 0.55, y + droop * 0.4), (x - left, y + droop),
                   (x - left * 0.62, y + droop * 0.85), (x, y + droop * 0.5),
                   (x + right * 0.62, y + droop * 0.85), (x + right, y + droop), (x + right * 0.55, y + droop * 0.4)], fill=255)
    d.polygon([(x, base - height * 1.04), (x - height * 0.02, base - height * 0.9), (x + height * 0.02, base - height * 0.9)], fill=255)


def spruce_stand(img, w, h, spots, color, blur, seed):
    layer = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(layer)
    r = np.random.default_rng(seed)
    for x, base, height in spots:
        pine_tree(d, x, base, height, r)
    m = np.asarray(layer.filter(ImageFilter.GaussianBlur(blur))).astype(float)[..., None] / 255
    return img * (1 - m) + hexc(color) * m, m[..., 0]


def paper_header():
    """Warm granite crags and spruce in morning fog behind the Today trail, lit from the upper right. The sky
    is left clear (alpha 0), so the world's dawn glow and the drifting sun show behind the peaks; the rock
    fades into the page along the left and the foot, and mist pools between the ridges."""
    reseed('paper-header')
    w, h = 1080, 1200
    fog = '#F1EFEA'
    img = np.zeros((h, w, 3)) + hexc(fog)
    mask = np.zeros((h, w))
    x = np.linspace(0, 1, w)
    jag = [(1.3, 1), (3.1, 0.45), (7, 0.2), (17, 0.08), (41, 0.035), (97, 0.012)]

    def crest(y0, amp, seed, peaks):
        line = ridge(w, y0 * h, amp * h, jag, seed)
        for px, py, pw in peaks:
            line -= py * h * np.exp(-((x - px) / pw) ** 2)
        return line

    layers = [
        # far range, deep in haze
        (crest(0.30, 0.05, 13, [(0.86, 0.09, 0.07), (0.40, 0.05, 0.10)]), ('#B3AEA5', '#C3BEB5', '#D3CEC4'), 0.42, 0.5, 23),
        # the main crag
        (crest(0.40, 0.06, 3, [(0.60, 0.25, 0.085), (0.72, 0.10, 0.05)]), ('#6C685F', '#8A857C', '#BAB4A9'), 0.05, 0.6, 31),
        # the middle ridge
        (crest(0.56, 0.05, 4, [(0.92, 0.10, 0.07)]), ('#706C64', '#838078', '#A8A398'), 0.12, 0.62, 37),
    ]
    for line, tones, haze, depth, seed in layers:
        img, mask = granite(img, mask, line, tones, fog, haze, seed, depth_fog=depth)
        band = noise(w, h, 90, 3, seed + 1) * np.exp(-((np.arange(h)[:, None] - (line.mean() + h * 0.10)) / (h * 0.07)) ** 2)
        img = img * (1 - band[..., None] * 0.75) + hexc(fog) * band[..., None] * 0.75
    r = np.random.default_rng(5)
    # distant spruce on the middle ridge, pale with haze
    mid = layers[2][0]
    far_spots = [(w * xx, mid[min(w - 1, int(w * xx))] + h * r.uniform(0.04, 0.10), h * r.uniform(0.07, 0.12))
                 for xx in np.linspace(0.70, 1.0, 9) + r.uniform(-0.015, 0.015, 9)]
    img, m1 = spruce_stand(img, w, h, far_spots, '#8F918A', 1.6, 51)
    mask = np.maximum(mask, m1)
    # the near shoulder and its stand of spruce
    near = crest(0.74, 0.04, 6, [(0.95, 0.06, 0.08)])
    img, mask = granite(img, mask, near, ('#66635C', '#77736B', '#948F86'), fog, 0.12, 41, depth_fog=0.7)
    spots = []
    for k in range(13):
        xx = 0.60 + 0.42 * k / 12 + r.uniform(-0.015, 0.015)
        spots.append((w * xx, h * r.uniform(0.90, 1.02), h * r.uniform(0.20, 0.40) * (0.75 + 0.25 * xx)))
    img, m2 = spruce_stand(img, w, h, spots, '#4E5149', 1.4, 53)
    mask = np.maximum(mask, m2)
    # drifting fog over everything, thicker low down
    fn = noise(w, h, 150, 4, 21)
    yy = np.linspace(0, 1, h)[:, None]
    fogamt = np.clip(fn * 1.3 - 0.25, 0, 1) * (0.25 + 0.55 * yy)
    img = img * (1 - fogamt[..., None]) + hexc(fog) * fogamt[..., None]
    img = np.clip(grain(img, 0.012), 0, 1)
    xg = x[None, :]
    keep = np.clip((xg - 0.08) / 0.5, 0, 1) ** 1.3 * np.clip((1.0 - yy) / 0.45, 0, 1) ** 1.1
    alpha = mask * keep
    full = np.dstack([img * alpha[..., None], alpha])
    out = resize(full, int(w * 0.75), int(h * 0.75))
    al = np.clip(out[..., 3], 0, 1)
    save_png(np.dstack([np.clip(out[..., :3] / np.maximum(al[..., None], 1e-6), 0, 1), al]), 'paper-header')
    # The header seen through glass: the same art, blurred as much as the lens (sigma 24 at half size).
    small = gblur(resize(full, 540, 600), 24)
    al = np.clip(small[..., 3], 0, 1)
    save_png(np.dstack([np.clip(small[..., :3] / np.maximum(al[..., None], 1e-6), 0, 1), al]), 'paper-header-blur')
    # Mist that drifts over the rock (drawn above the header art; the sky's mist is the world's paper-mist).
    mw, mh = 540, 600
    n = noise(mw, mh, 80, 4, 79)
    hm = resize(alpha[..., None], mw, mh)[..., 0]
    hm = gblur(hm, 6)
    vy = np.linspace(0, 1, mh)[:, None]
    band = np.clip(1 - np.abs(vy - 0.45) / 0.4, 0, 1)
    light_png('paper-header-mist', mw, mh, '#FBFAF7', np.clip((n - 0.38) / 0.45, 0, 1) * hm * band * 0.55)


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


def lowpoly_pines(w, h, spots, seed, tiers=3):
    """Turned pines, like the wooden trees on a training-hub poster: three stacked cones, each with a shadow side
    and a side lit from the upper right (the moon), and a soft occlusion band under every cone's bowed rim.
    Returns (body, lit, shade) masks in 0..1, drawn 4x supersampled."""
    s = 4
    body = Image.new('L', (w * s, h * s), 0)
    lit = Image.new('L', (w * s, h * s), 0)
    shade = Image.new('L', (w * s, h * s), 0)
    db, dl, ds = ImageDraw.Draw(body), ImageDraw.Draw(lit), ImageDraw.Draw(shade)
    r = np.random.default_rng(seed)
    for x, base, height in spots:
        x, base, height = x * s, base * s, height * s
        trunk = height * 0.09
        tw = height * 0.04
        db.rectangle([x - tw, base - trunk * 1.8, x + tw, base], fill=255)
        dl.rectangle([x + tw * 0.2, base - trunk * 1.8, x + tw, base], fill=90)
        crown = height - trunk
        spec = []
        for t in range(tiers):
            bottom = base - trunk * 1.2 - crown * 0.27 * t
            top = base - height if t == tiers - 1 else bottom - crown * (0.48 - 0.03 * t)
            half = crown * 0.31 * (1 - 0.24 * t) * r.uniform(0.95, 1.05)
            spec.append((bottom, top, half))
        for t, (bottom, top, half) in enumerate(spec):
            sag = half * 0.2
            # the cone's rim: a shallow arc, bowed toward the viewer
            us = np.linspace(-1, 1, 25)
            rim = [(x + u * half, bottom + sag * (1 - u * u) - sag * 0.3) for u in us]
            db.polygon([(x, top)] + rim, fill=255)
            # the lit side: from just right of the axis out to the right edge of the rim
            dl.polygon([(x + half * 0.05, top)] + rim[14:], fill=255)
            # occlusion: the cone above shades a narrow band just under its rim
            if t < tiers - 1:
                nb, _, nh = spec[t + 1]
                ds.ellipse([x - nh * 0.78, nb - nh * 0.04, x + nh * 0.78, nb + nh * 0.2], fill=255)
    out = []
    for m, blur in ((body, 0.45), (lit, 0.6), (shade, 3)):
        m = m.filter(ImageFilter.GaussianBlur(s * blur)).resize((w, h), Image.LANCZOS)
        out.append(np.asarray(m).astype(float) / 255)
    b, l, sh = out
    return b, np.minimum(l, b), np.minimum(sh, b)


def paint_pines(img, a, masks, body_col, lit_col, shade=0.45, lit_top=None):
    """Composite faceted pines: body colour, then the lit side (lighter toward the tips when lit_top is given),
    then the occlusion bands. a is the alpha to accumulate (or None)."""
    body, lit, sh = masks
    img = img * (1 - body[..., None]) + hexc(body_col) * body[..., None]
    if lit_top:
        hh = img.shape[0]
        v = np.linspace(0, 1, hh)[:, None, None]
        lc = hexc(lit_top) * (1 - v) + hexc(lit_col) * v
    else:
        lc = hexc(lit_col)
    img = img * (1 - lit[..., None]) + lc * lit[..., None]
    img = img * (1 - sh[..., None] * shade)
    if a is not None:
        a = a + body * (1 - a)
    return img, a


def pine_backdrop():
    """Night in the pines: a deep evergreen floor, a mint moon glow top right, a low aurora band, mint mist,
    and a stand of faceted pines along the foot, their moon-side faces just catching the light."""
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
    # a low ridge along the foot, a mist band above it, then the faceted stand in front
    line = ridge(W, H * 0.885, H * 0.02, [(1.7, 1), (4.3, 0.4), (11, 0.15)], 61)
    mist = np.exp(-((yy - H * 0.86) / (H * 0.035)) ** 2)
    img = img * (1 - mist[..., None] * 0.22) + hexc('#1A5547') * mist[..., None] * 0.22
    img = fill_below(img, line, hexc('#04150F'), soft=4)
    r = np.random.default_rng(63)
    far = [(W * (k + 0.5) / 16 + r.uniform(-25, 25), H * 0.905 + r.uniform(-8, 8), H * r.uniform(0.045, 0.07)) for k in range(16)]
    img, _ = paint_pines(img, None, lowpoly_pines(W, H, far, 65), '#061C16', '#0B2B24', shade=0.3)
    near = [(W * x, H * (0.985 + r.uniform(-0.01, 0.01)), H * hh) for x, hh in
            ((0.05, 0.11), (0.16, 0.08), (0.30, 0.095), (0.47, 0.07), (0.62, 0.10), (0.78, 0.085), (0.93, 0.12))]
    img, _ = paint_pines(img, None, lowpoly_pines(W, H, near, 66), '#03100C', '#0E352C', shade=0.4)
    m = noise(W, H, 260, 3, 31)[..., None]
    img = img * (1 - m * 0.03) + hexc('#2C7A66') * m * 0.03
    return grain(img, 0.006)


def pine_lights():
    """The moon's light: a soft mint pool that drifts behind the upper cards, below the canopy slab."""
    w, h = LENS_W, LENS_H
    y, x = np.mgrid[:h, :w].astype(float)
    cx, cy, rad = 0.80 * w, 0.30 * h, 230 / 2
    d = np.hypot(x - cx, y - cy)
    light_png('pine-light-moon', w, h, '#7CE3BC', falloff(d, rad) * 0.12)


def pine_header():
    """The canopy slab's art: far ridges in moonlit mist and a stand of faceted pines on the right, lit from the
    upper right. The sky is clear (alpha 0) so the slab's own teal shows, and the art fades out toward the left,
    where the title sits. Drawn inside the slab at its height, anchored bottom right."""
    reseed('pine-header')
    w, h = 1080, 540
    img = np.zeros((h, w, 3))
    a = np.zeros((h, w))
    yy, xx = np.mgrid[:h, :w].astype(float)
    for y0, amp, color, seed, alpha in ((0.42, 0.16, '#3A8C76', 3, 0.55), (0.60, 0.12, '#2A715F', 4, 0.75)):
        line = ridge(w, y0 * h, amp * h, [(1.1, 1), (2.9, 0.45), (6.5, 0.18), (15, 0.06)], seed)
        m = np.clip((yy - line[None, :]) / 2 + 0.5, 0, 1) * alpha
        img = img * (1 - m[..., None]) + hexc(color) * m[..., None]
        a = a + m * (1 - a)
        mist = noise(w, h, 90, 3, seed + 1) * np.exp(-((yy - (y0 * h + amp * h)) / (h * 0.10)) ** 2) * 0.45
        img = img * (1 - mist[..., None]) + hexc('#4FA48C') * mist[..., None]
        a = a + mist * 0.5 * (1 - a)
    spots = [(w * 0.60, h * 1.03, h * 0.62), (w * 0.69, h * 1.05, h * 0.86), (w * 0.79, h * 1.04, h * 0.70),
             (w * 0.885, h * 1.06, h * 0.96), (w * 0.975, h * 1.04, h * 0.66), (w * 0.535, h * 1.06, h * 0.42)]
    img, a = paint_pines(img, a, lowpoly_pines(w, h, spots, 71), '#123F35', '#24705D', shade=0.3, lit_top='#368C75')
    # the art fades out toward the left, where the title and greeting sit
    fade = np.clip((xx / w - 0.30) / 0.28, 0, 1) ** 1.3
    a = a * fade
    img = np.clip(grain(img, 0.008), 0, 1)
    save_png(np.dstack([img, np.clip(a, 0, 1)]), 'pine-header')


# ---------------------------------------------------------------------------------------------
# Lens export.

BACKDROPS = {'lavender': lavender_backdrop, 'stone': stone_backdrop, 'paper': paper_backdrop, 'pine': pine_backdrop}
LIGHTS = {'lavender': lavender_lights, 'stone': stone_lights, 'paper': paper_lights, 'pine': pine_lights}
EXTRAS = {'paper': [paper_header], 'pine': [pine_header]}


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


def light_study(name, top, bottom, fields, drops=0, ripples=(), size=1000):
    """An abstract study in soft light for Lavender's cards and sounds, made of the world's own orbs: a deep
    periwinkle ground (darker at the top left, where a card's words sit) with large out-of-focus fields of light
    blended in linear light, the way light adds. No figure, no horizon, no ring. `fields` are
    (cx, cy, rx, ry, colour, strength) in units of the size; `drops` adds that many soft out-of-focus drops;
    `ripples` are (y, thickness, amplitude, colour, strength): long swells of light, as on water seen out of focus."""
    reseed(name)
    w = h = size
    yy, xx = np.mgrid[:h, :w].astype(float) / size
    t = np.clip(yy * 0.8 + xx * 0.2, 0, 1)[..., None]
    lin = to_linear(hexc(top)) * (1 - t) + to_linear(hexc(bottom)) * t
    for cx, cy, rx, ry, colour, strength in fields:
        g = np.exp(-(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2) * 1.6)
        lin = lin + g[..., None] * to_linear(hexc(colour)) * strength
    for y0, th, amp, colour, strength in ripples:
        ph, f, ph2 = rng.uniform(0, 2 * np.pi), rng.uniform(0.7, 1.3), rng.uniform(0, 2 * np.pi)
        curve = y0 + amp * np.sin(2 * np.pi * xx * f + ph) + amp * 0.4 * np.sin(2 * np.pi * xx * f * 2.3 + ph2)
        g = np.exp(-((yy - curve) / th) ** 2) * (0.55 + 0.45 * np.sin(2 * np.pi * xx * 0.8 + ph2) ** 2)
        lin = lin + gblur(g, size * 0.022)[..., None] * to_linear(hexc(colour)) * strength
    if drops:
        layer = np.zeros((h, w))
        for _ in range(drops):
            x, y, r, a = rng.uniform(0.3, 1.0), rng.uniform(0.25, 1.0), rng.uniform(0.012, 0.05), rng.uniform(0.25, 0.7)
            d = np.hypot(xx - x, yy - y) / r
            # a drop out of focus: an even disc with a slightly brighter edge
            layer += np.clip(1 - d, 0, 1) ** 0.35 * a * (0.75 + 0.25 * np.exp(-((d - 0.9) / 0.12) ** 2))
        layer = gblur(layer, size * 0.004)
        lin = lin + layer[..., None] * to_linear(hexc('#C9D2FF')) * 0.10
    # a gentle lens falloff toward the corners
    v = 1 - 0.28 * np.clip(np.hypot(xx - 0.5, yy - 0.55) / 0.75, 0, 1) ** 2
    img = to_srgb(lin * v[..., None])
    save(grain(img, 0.012), name, quality=88)


# Lavender's scenes. Each variant answers its own job: the Today card (dusk), the finished day and Ocean Waves
# (waves), Soft Rain (rain) and Deep Focus (brown).
LAV_SCENES = {
    'lavender-dusk': ('#262A7A', '#4740B4', [
        (0.86, 0.30, 0.42, 0.34, '#8E9CFF', 0.55),
        (0.72, 0.92, 0.48, 0.30, '#FF86D2', 0.70),
        (0.10, 1.05, 0.40, 0.25, '#A890FF', 0.40),
    ]),
    'lavender-waves': ('#222A78', '#2B46A8', [
        (0.80, 0.22, 0.45, 0.32, '#7F8CFF', 0.40),
        (0.50, 1.00, 0.80, 0.30, '#7C9CFF', 0.30),
    ], 0, [
        (0.56, 0.030, 0.035, '#A8C4FF', 0.35),
        (0.66, 0.034, 0.040, '#FFA8DC', 0.32),
        (0.77, 0.040, 0.045, '#A8C4FF', 0.40),
        (0.90, 0.048, 0.050, '#FFB8E2', 0.36),
    ]),
    'lavender-rain': ('#20246A', '#30368C', [
        (0.65, 0.05, 0.55, 0.40, '#9AAAFF', 0.45),
        (0.85, 0.95, 0.35, 0.25, '#E08CFF', 0.30),
    ], 46),
    'lavender-brown': ('#271C5A', '#3A2468', [
        (0.58, 0.88, 0.40, 0.28, '#FFB08A', 0.75),
        (0.62, 0.80, 0.70, 0.45, '#FF7FC4', 0.35),
        (0.95, 0.20, 0.30, 0.30, '#6E6CFF', 0.25),
    ]),
}


def scenes_lavender(only=None):
    for name, spec in LAV_SCENES.items():
        if only is None or name in only:
            light_study(name, *spec)


# Stone's scenes are photographs, not drawings: a CC0 gravel texture ("Gravel04" from CC0Textures, now
# ambientCG, as bundled with scikit-image; Creative Commons CC0, no attribution required), laid into
# perspective as a gravel bed seen from low down, focused on one band with the rest falling out of focus, and
# graded to the room: olive shadows, warm stone mids, ivory highlights, window light from the top left.
GRAVEL = 'scripts/sources/gravel-cc0.png'

STONE_SCENES = {
    # shadows, mids, highlights, focus row, light direction (x, y), light strength, contrast, mirror
    'calm': ('#23241B', '#8A8470', '#ECE3CA', 0.60, (-0.6, -0.8), 0.60, 1.12, False),
    'rain': ('#191A16', '#64675C', '#E0E1D4', 0.52, (-0.3, -1.0), 0.45, 1.35, True),
    'waves': ('#1B211D', '#68715F', '#DEE4D0', 0.66, (0.0, -1.0), 0.50, 1.08, True),
    'brown': ('#271E15', '#8C7254', '#F2D8AE', 0.58, (1.0, -0.4), 0.75, 1.15, False),
}


def stones_scene(name, variant, size=1000):
    """A gravel bed photographed from low down in window light (see GRAVEL)."""
    reseed(name)
    shadows, mids, highs, focus, (lx, ly), light, contrast, mirror = STONE_SCENES[variant]
    tex = Image.open(GRAVEL).convert('L')
    if mirror:
        tex = tex.transpose(Image.FLIP_LEFT_RIGHT).rotate(90)
    tw, th = tex.size
    # the gravel as a plane: the far edge (top) shows the whole texture width, the near edge (bottom) a third
    # of it, so the stones grow toward the camera
    big = tex.resize((tw * 2, th * 2), Image.LANCZOS)  # sampled at 2x so the near stones stay smooth
    src = [(0, 0), (tw * 2, 0), (tw * 1.32, th * 2), (tw * 0.68, th * 2)]
    dst = [(0, 0), (size, 0), (size, size), (0, size)]
    g = np.asarray(big.transform((size, size), Image.PERSPECTIVE, _perspective(dst, src), Image.BICUBIC)).astype(float) / 255
    # depth of field: sharp on the focus row, softer away from it (faster toward the far edge)
    y = np.linspace(0, 1, size)
    blur_px = np.where(y < focus, (focus - y) * 26, (y - focus) * 16)
    levels = [0.0, 2.0, 4.0, 7.0, 11.0]
    stack = np.stack([g] + [gblur(g, s_) for s_ in levels[1:]])
    idx = np.interp(blur_px, levels, np.arange(len(levels)))
    i0 = np.minimum(np.floor(idx).astype(int), len(levels) - 2)
    f = (idx - i0)[:, None]
    rows = np.arange(size)
    g = stack[i0, rows] * (1 - f) + stack[i0 + 1, rows] * f
    # contrast about the mid, then the window light: a broad falloff from the light's side
    g = np.clip(0.5 + (g - 0.5) * contrast, 0, 1)
    yy, xx = np.mgrid[:size, :size].astype(float) / size
    lit = 0.5 + 0.5 * np.clip(((xx - 0.5) * lx + (yy - 0.5) * ly) * 1.4, -1, 1)
    g = g * (1 - light + light * (0.55 + 0.9 * lit))
    vign = 1 - 0.35 * np.clip(np.hypot(xx - 0.5, yy - 0.5) / 0.72, 0, 1) ** 2
    g = np.clip(g * vign, 0, 1)
    # tritone grade in linear light
    s0, m0, h0 = (to_linear(hexc(c)) for c in (shadows, mids, highs))
    t = g[..., None]
    lin = np.where(t < 0.5, s0 + (m0 - s0) * (t / 0.5), m0 + (h0 - m0) * ((t - 0.5) / 0.5))
    save(grain(to_srgb(lin), 0.010), name, quality=88)


def _perspective(dst, src):
    """PIL PERSPECTIVE coefficients mapping output points `dst` to input points `src`."""
    m = []
    for (x, y), (u, v) in zip(dst, src):
        m.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        m.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    return np.linalg.solve(np.array(m, float), np.array(src, float).reshape(8)).tolist()


def scenes_stone():
    for v in ('calm', 'rain', 'waves', 'brown'):
        stones_scene(f'stones-{v}', v)


def landscape(name, sky, ridges, fog, pine_color=None, light=None, water=None, rain=0, size=1000, grain_amt=0.012,
              stars=0, moon=None, ember=None, faceted=None):
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
        if faceted:
            # Pine's turned trees: a shadow side and a side lit by the moon (faceted = the lit side's colour)
            masks = lowpoly_pines(w, h, [(x, b, hh * 0.9) for x, b, hh in spots], zlib.crc32(name.encode()) % 997)
            img, _ = paint_pines(img, None, masks, pine_color, faceted, shade=0.35)
        else:
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
              pine_color='#03100C', moon=(0.72, 0.2, 0.045, '#BFF5DF'), rain=1100, grain_amt=0.008, stars=0, faceted='#14463A')
    landscape('pine-waves', ('#0C2E28', '#0A2620'), [(0.40, 0.09, '#0F3A31', 7), (0.50, 0.07, '#0B2E27', 8)], ('#1E5C4D', 0.3),
              pine_color='#03100C', moon=(0.30, 0.18, 0.04, '#BFF5DF'), water=0.6, grain_amt=0.008, stars=60, faceted='#123F35')
    landscape('pine-brown', ('#0A231E', '#06140F'), [(0.46, 0.10, '#0D3129', 11), (0.60, 0.08, '#08221C', 12)], ('#1A5547', 0.3),
              pine_color='#020C09', ember=(0.5, 0.95, 0.35, '#F2B061', 0.75), grain_amt=0.008, stars=40, faceted='#3A2A14')
    landscape('pine-dusk', ('#1F5A4C', '#9FD9C2'), [(0.42, 0.12, '#2A6A58', 13), (0.56, 0.10, '#164D41', 14), (0.70, 0.08, '#0E3A31', 15)],
              ('#7CC9AE', 0.35), pine_color='#04170F', light=(0.5, 0.55, 0.6, '#C8F5E2', 0.5), grain_amt=0.008, faceted='#1D5A4B')


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
