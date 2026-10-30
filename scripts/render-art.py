"""Renders the glass looks' artwork into assets/art: soft-light backdrops and the glowing-ring scenes.

Usage: python3 scripts/render-art.py   (needs numpy and Pillow)
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = 'assets/art'
W, H = 1080, 2340
rng = np.random.default_rng(3)


def hexc(h):
    return np.array([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)])


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


def screen(img, rgba):
    a = np.asarray(rgba).astype(float) / 255
    return 1 - (1 - img) * (1 - a[..., :3] * a[..., 3:4])


def bokeh(img, n, rmin, rmax, color, alpha, blur, ymax=1.0):
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for _ in range(n):
        x, y, r = rng.uniform(0, W), rng.uniform(0, H * ymax), rng.uniform(rmin, rmax)
        a = int(255 * alpha * rng.uniform(0.4, 1))
        d.ellipse([x - r, y - r, x + r, y + r], fill=(*color, a))
        d.ellipse([x - r, y - r, x + r, y + r], outline=(*color, min(255, a + 40)), width=max(1, int(r * 0.08)))
    return screen(img, layer.filter(ImageFilter.GaussianBlur(blur)))


def beams(specs, angle, blur):
    layer = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(layer)
    dx = np.tan(np.radians(angle)) * H
    for x0, w, a in specs:
        d.polygon([(x0, 0), (x0 + w, 0), (x0 + w + dx, H), (x0 + dx, H)], fill=int(255 * a))
    return (np.asarray(layer.filter(ImageFilter.GaussianBlur(blur))).astype(float) / 255)[..., None]


def grain(img, amount):
    return np.clip(img + rng.normal(0, amount, img.shape[:2] + (1,)), 0, 1)


def save(img, name, quality=88):
    Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).save(
        f'{OUT}/{name}.jpg', quality=quality, optimize=True, progressive=True)


def lavender_backdrop():
    """Measured from the reference: a light lavender sky that deepens through periwinkle into cobalt,
    with orchid and a touch of hot pink in the light."""
    img = gradient([(0, hexc('#B4A8EE')), (0.3, hexc('#8494E3')), (0.62, hexc('#5B6BBC')), (1, hexc('#2C4790'))], tilt=0.08)
    glow(img, W * 0.1, H * 0.02, W * 0.6, hexc('#DBDCFD'), 0.6)
    glow(img, W * 1.0, H * 0.12, W * 0.55, hexc('#CD94E6'), 0.65)
    glow(img, W * 0.95, H * 0.45, W * 0.4, hexc('#F270C8'), 0.22)
    glow(img, W * 0.0, H * 0.55, W * 0.5, hexc('#8494E3'), 0.35)
    glow(img, W * 0.5, H * 1.05, W * 0.8, hexc('#233A73'), 0.6)
    img = 1 - (1 - img) * (1 - beams([(-200, 260, 0.12), (140, 90, 0.09)], 24, 50))
    img = bokeh(img, 22, 18, 64, (235, 235, 255), 0.16, 6)
    img = bokeh(img, 50, 3, 7, (255, 255, 255), 0.45, 1.2)
    save(grain(img, 0.016), 'lavender-bg')


def stone_backdrop():
    """Measured from the reference: warm olive-grey, sunlit at the top left, falling into shadow.
    All warm; no cool colours."""
    img = gradient([(0, hexc('#676755')), (0.45, hexc('#4B4B44')), (1, hexc('#31332B'))], tilt=0.2)
    glow(img, -W * 0.1, -H * 0.05, W * 1.0, hexc('#F3E6C4'), 0.45)
    glow(img, W * 0.5, H * 1.1, W * 0.9, hexc('#1B1A16'), 0.5)
    fade = np.clip(1.15 - np.linspace(0, 1, H) * 1.1, 0, 1)[:, None, None]  # sunlight fades lower down
    light = beams([(-300, 300, 0.28), (150, 120, 0.22), (380, 60, 0.16), (560, 26, 0.12)], 32, 50) * fade
    img = 1 - (1 - img) * (1 - light * hexc('#FFF1CF'))
    img = bokeh(img, 8, 8, 24, (255, 240, 205), 0.1, 4, ymax=0.5)
    save(grain(img, 0.02), 'stone-bg')


def portal(name, top, mid, horizon, glow_color, figure, size=1000):
    """A glowing ring over still water, reflected, with an optional small figure."""
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
    # Water: the sky mirrored, rippled, blurred and darkened.
    refl = img[hz - 1::-1][:h - hz].copy()
    for i in range(h - hz):
        refl[i] = np.roll(refl[i], int(6 * np.sin(i * 0.25) * (i / (h - hz) + 0.2)), axis=0)
    refl = np.asarray(Image.fromarray((refl * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))).astype(float) / 255
    dark = np.linspace(0.75, 0.35, h - hz)[:, None, None]
    img[hz:] = refl * dark + top * (1 - dark) * 0.5
    for i in range(0, h - hz, 9):
        shimmer = np.exp(-((np.arange(w) - cx) / (r * 1.1)) ** 2) * 0.5 * np.exp(-i / 120)
        img[hz + i] = np.clip(img[hz + i] + shimmer[:, None] * glow_color * 0.6, 0, 1)
    if figure:
        im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
        d = ImageDraw.Draw(im)
        d.ellipse([cx - 90, hz - 6, cx + 90, hz + 10], fill=(30, 18, 60))
        d.polygon([(cx - 9, hz - 2), (cx - 7, hz - 62), (cx + 7, hz - 62), (cx + 9, hz - 2)], fill=(22, 12, 45))
        d.ellipse([cx - 9, hz - 82, cx + 9, hz - 64], fill=(22, 12, 45))
        img = np.asarray(im).astype(float) / 255
    save(grain(img, 0.015), name, quality=86)


if __name__ == '__main__':
    lavender_backdrop()
    stone_backdrop()
    portal('portal-dusk', hexc('#251660'), hexc('#7C47C8'), hexc('#F59AD2'), hexc('#FFD6F6'), True)
    portal('portal-rain', hexc('#111D4A'), hexc('#3557B5'), hexc('#8DB4F2'), hexc('#D8E8FF'), False)
    portal('portal-waves', hexc('#28155A'), hexc('#A148B6'), hexc('#FFA8C3'), hexc('#FFE2EE'), False)
    portal('portal-brown', hexc('#2A183C'), hexc('#894769'), hexc('#F2AF78'), hexc('#FFE6C4'), False)


def stones(name='stones', size=1000):
    """Smooth stones in still water, softly lit from the top left, with a silk ribbon."""
    w = h = size
    yy, xx = np.mgrid[:h, :w].astype(float)
    img = gradient([(0, hexc('#B7B29B')), (0.5, hexc('#77735F')), (1, hexc('#3D3B30'))], w, h, tilt=0.3)
    light = np.array([-0.55, -0.65, 0.52])
    light /= np.linalg.norm(light)
    layer = np.zeros((h, w, 3))
    mask = np.zeros((h, w))
    for cx, cy, rx, ry, tone in [(0.72, 0.42, 0.15, 0.1, 0.95), (0.38, 0.5, 0.27, 0.17, 1.0), (0.62, 0.72, 0.3, 0.15, 0.9)]:
        cx, cy, rx, ry = cx * w, cy * h, rx * w, ry * h
        nx, ny = (xx - cx) / rx, (yy - cy) / ry
        inside = nx ** 2 + ny ** 2 < 1
        nz = np.sqrt(np.clip(1 - nx ** 2 - ny ** 2, 0, 1))
        lam = np.clip(nx * light[0] + ny * light[1] + nz * light[2], 0, 1)
        spec = lam ** 18 * 0.35
        base = hexc('#9C9580') * tone
        shade = base * (0.28 + 0.85 * lam)[..., None] + spec[..., None]
        # contact shadow on the water
        sh = np.exp(-(((xx - cx) / (rx * 1.05)) ** 2 + ((yy - cy - ry * 0.9) / (ry * 0.45)) ** 2) * 2)
        img *= (1 - 0.45 * sh)[..., None]
        layer = np.where(inside[..., None], shade, layer)
        mask = np.maximum(mask, inside.astype(float))
    m = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(float)[..., None] / 255
    img = img * (1 - m) + layer * m
    # silk ribbon: a soft wide stroke along a curve, lit on one side
    silk = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(silk)
    t = np.linspace(0, 1, 200)
    px = (0.22 + 0.62 * t) * w
    py = (0.36 + 0.08 * np.sin(t * 5.5) + 0.12 * t) * h
    for i in range(len(t) - 1):
        width = int(70 * np.sin(np.pi * t[i]) ** 0.7 + 12)
        d.line([(px[i], py[i]), (px[i + 1], py[i + 1])], fill=235, width=width)
    silk = np.asarray(silk.filter(ImageFilter.GaussianBlur(5))).astype(float)[..., None] / 255
    folds = 0.82 + 0.18 * np.sin(xx / 22 + yy / 40)[..., None]
    img = img * (1 - silk * 0.92) + (hexc('#F7F3E8') * folds) * silk * 0.92
    glow(img, -0.1 * w, -0.1 * h, 0.9 * w, hexc('#FFF6DC'), 0.35)
    save(grain(img, 0.02), name, quality=86)


if __name__ == '__main__':
    stones()
