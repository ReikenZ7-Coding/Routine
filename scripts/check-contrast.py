#!/usr/bin/env python3
"""Contrast gate for the four looks. Run from the repo root after every art or token change:

    python3 scripts/check-contrast.py            # all looks
    python3 scripts/check-contrast.py stone      # one look

It rebuilds, pixel by pixel, what each surface shows behind its text and checks the look's tokens
(src/theme.ts) against it. Exit status is non-zero when any check fails.

Glass (pane, control, receded, inset, sheet; each with the tokens it can carry), per pixel of the look's lens image with y >= 7% of the frame:
  lens (<look>-bg-blur.jpg, scrim and veil baked in; on Paper also the blurred header art)
  -> material.base -> the body stop that is worse for the text -> the worse caustic where text can sit
  -> topGlow 18px below the top edge (where the first glyphs start) -> the sheen peak -> the LightCatch peak (the most each light layer
  reaches at that pixel anywhere along its motion path, times material.light.catch) -> Stone's grain.
  Sheets: lens -> colors.backdrop -> material.sheet body (and its top band) instead.
  Hero (looks with a bloom): the pane plus the bloom at its peak, where it reaches the nearest text.
Bare backdrop (titles, section headings, hints): the sharp backdrop with scrim and veil, plus the LightField
  at full strength (every moment of its motion path), averaged over about a glyph (sigma 3 dp) so a
  single star speck doesn't count, in the zones where that text sits.
Thresholds: text, muted, faint, label, link, danger and every kind's text 4.5:1; onKind on every kind fill,
  onPrimary on both primary stops and onDone on both done stops 4.5:1; controlBorder against the glass, kind fills and the accent
  against their track 3:1, and the accent on the player's lit toggle disc 3:1. Pine also checks its canopy slab (check_canopy).
"""
import importlib.util
import json
import os
import re
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
spec = importlib.util.spec_from_file_location('render_art', os.path.join(ROOT, 'scripts', 'render-art.py'))
ra = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ra)

ART = 'assets/art'
META = json.load(open(f'{ART}/looks.json'))
FRAME_W_DP = META['frame']['widthDp']
FW, FH = ra.LENS_W, ra.LENS_H  # gate resolution: the lens image's own grid
DP = FW / FRAME_W_DP  # px per dp at that resolution
TEXT, NONTEXT = 4.5, 3.0
SAMPLES = 36  # positions sampled along each light's motion path
GLYPH = 3  # dp: bare-backdrop zones are averaged over about a glyph, so a star speck under one letter doesn't count
TEXT_TOP = 18  # px below a surface's top edge where the first glyphs start (16 padding plus the line's leading)


def load_themes():
    code = (
        "const m = await import(process.argv[1]);"
        "const out = {};"
        "for (const n of ['lavender','stone','paper','pine']) { const t = m.themeFor(n); out[n] = { colors: t.colors, kinds: t.kinds }; }"
        "console.log(JSON.stringify(out));"
    )
    url = 'file://' + os.path.join(ROOT, 'src', 'theme.ts')
    res = subprocess.run(['node', '--experimental-strip-types', '--no-warnings', '--input-type=module', '-e', code, url],
                         capture_output=True, text=True, check=True)
    return json.loads(res.stdout)


def col(s):
    """CSS colour -> (rgb float array, alpha). Accepts #RGB, #RRGGBB, rgba(), 'transparent'."""
    s = s.strip()
    if s == 'transparent':
        return np.zeros(3), 0.0
    if s.startswith('#') and len(s) == 4:
        s = '#' + ''.join(c * 2 for c in s[1:])
    return ra.rgba(s)


def over(dst, c, a):
    """Composite a colour (or per-pixel colour) with alpha `a` (scalar or per-pixel) over dst, in sRGB as the
    renderers do."""
    a = np.asarray(a, dtype=float)
    if a.ndim == 2:
        a = a[..., None]
    return dst * (1 - a) + np.asarray(c) * a


def lum(img):
    c = np.where(img <= 0.04045, img / 12.92, ((img + 0.055) / 1.055) ** 2.4)
    return (c * np.array([0.2126, 0.7152, 0.0722])).sum(-1)


def ratio(fg_lum, bg_lum):
    hi, lo = np.maximum(fg_lum, bg_lum), np.minimum(fg_lum, bg_lum)
    return (hi + 0.05) / (lo + 0.05)


def text_on(bg, token):
    """Contrast of a (possibly translucent) text colour over a per-pixel background."""
    c, a = col(token)
    fg = over(bg, c, a) if a < 1 else np.broadcast_to(c, bg.shape)
    return ratio(lum(fg), lum(bg))


def load(name, size=(FW, FH)):
    im = Image.open(f'{ART}/{name}')
    if im.size != size:
        im = im.resize(size, Image.LANCZOS)
    return np.asarray(im).astype(float) / 255


def place(light, p, alpha_img):
    """Where a light layer's alpha lands in the frame at clock value p (see looks.json for the motion)."""
    box, m = light['box'], light['motion']
    if box == 'frame':
        w, h = FW, FH
    else:
        w, h = int(round(box['w'] * FW)), int(round(box['h'] * FW))
    src = Image.fromarray((alpha_img * 255).astype(np.uint8), 'L').resize((w, h), Image.BILINEAR)
    cx, cy = FW / 2, (h / 2 if light.get('anchor') == 'top' else FH / 2)
    tx = ty = rot = 0.0
    scale = 1.0
    s = np.sin(2 * np.pi * p)
    if m['type'] == 'orbit':
        th = np.radians(m['phase'] + m['dir'] * 360 * p)
        tx, ty = m['radius'] * FW * np.cos(th), m['radius'] * FW * np.sin(th)
    elif m['type'] == 'sway':
        tx, rot = m['dx'] * DP * s, m['rotate'] * s
    elif m['type'] == 'drift':
        tx, ty, scale = m['ax'] * DP * s, -m['ay'] * DP * np.cos(2 * np.pi * p), 1 + m['s'] * s
    elif m['type'] == 'slide':
        tx = (m['x0'] - m['ax'] * s) * DP
    # inverse affine: frame (x, y) -> source (u, v), about the box centre placed at (cx + tx, cy + ty)
    r = np.radians(rot)
    cos, sin = np.cos(r) / scale, np.sin(r) / scale
    ox, oy = cx + tx, cy + ty
    a_, b_ = cos, sin
    d_, e_ = -sin, cos
    c_ = w / 2 - a_ * ox - b_ * oy
    f_ = h / 2 - d_ * ox - e_ * oy
    out = src.transform((FW, FH), Image.AFFINE, (a_, b_, c_, d_, e_, f_), resample=Image.BILINEAR)
    return np.asarray(out).astype(float) / 255


def light_states(look):
    """Every moment of the look's moving light, as lists of (colour, alpha map, layer) to composite in order.
    Layers that share a period move on one clock, so they are sampled together (Lavender's two orbs are never
    both at their brightest over the same pixel). A layer on a different period is taken at its maximum across
    its whole path in every state, which is the conservative bound."""
    lights = META['looks'][look]['lights']
    clock = lights[0]['motion']['period']
    loaded = []
    for light in lights:
        im = np.asarray(Image.open(f"{ART}/{light['name']}.png").convert('RGBA')).astype(float) / 255
        a = im[..., 3]
        rgb = im[..., :3][a > 0.01].mean(0) if (a > 0.01).any() else np.ones(3)
        loaded.append((rgb, a, light))
    fixed = []
    for rgb, a, light in loaded:
        if light['motion']['period'] != clock:
            peak = np.zeros((FH, FW))
            for p in np.linspace(0, 1, SAMPLES, endpoint=False):
                peak = np.maximum(peak, place(light, p, a))
            fixed.append((rgb, peak * light.get('opacity', 1.0), light))
    states = []
    for p in np.linspace(0, 1, SAMPLES, endpoint=False):
        state = [(rgb, place(light, p, a) * light.get('opacity', 1.0), light)
                 for rgb, a, light in loaded if light['motion']['period'] == clock]
        states.append(state + fixed)
    return states


def lit(img, states, strength=1.0, worse_light=True, skip_anchored=False):
    """The worst the moving light makes a background, per pixel, across all its states."""
    worst, worst_lum = None, None
    for state in states:
        x = img
        for rgb, alpha, light in state:
            if skip_anchored and light.get('anchor') == 'top':
                continue
            x = over(x, rgb, alpha * strength)
        xl = lum(x)
        if worst is None:
            worst, worst_lum = x, xl
        else:
            take = (xl > worst_lum) if worse_light else (xl < worst_lum)
            worst = np.where(take[..., None], x, worst)
            worst_lum = np.where(take, xl, worst_lum)
    return worst


def radial_alpha_at_text(at, size, stop=0.7):
    """How much of a corner caustic reaches the nearest place text can sit (inside 10%..90% x 15%..85%)."""
    (ax, ay), (sx, sy) = [float(v.strip('%')) / 100 for v in at.split()], [float(v.strip('%')) / 100 for v in size.split()]
    nx, ny = np.clip(ax, 0.1, 0.9), np.clip(ay, 0.15, 0.85)
    d = np.hypot((nx - ax) / sx, (ny - ay) / sy)
    return max(0.0, 1 - d / stop)


def glass(lens, mat, fields, body, worse_light, extra=None):
    """The glass stack over the lens for one body gradient; returns one image per body stop."""
    out = []
    bc, ba = col(mat['base'])
    for stop in body:
        img = over(lens, bc, ba)
        c, a = col(stop)
        img = over(img, c, a)
        variants = []
        for key in ('caustic', 'caustic2'):
            c, a = col(mat[key])
            variants.append(over(img, c, a * radial_alpha_at_text(mat[key + 'At'], mat[key + 'Size'])))
        img = pick_worse(variants, worse_light)
        c, a = col(mat['topGlow'])
        img = over(img, c, a * max(0.0, 1 - TEXT_TOP / mat['topGlowPx']))
        c, a = col(mat['sheen'])
        img = over(img, c, a)
        # LightCatch: glass catches the moving light at material.light.catch of its strength. Paper's header
        # mist is drawn in the world only, never caught by glass.
        img = lit(img, fields, mat['light']['catch'], worse_light, skip_anchored=True)
        if mat.get('grain'):
            img = over(img, np.ones(3), mat['grain'] * 0.5)
        if extra is not None:
            img = extra(img)
        out.append(img)
    return pick_worse(out, worse_light)


def pick_worse(imgs, worse_light):
    """Per pixel, keep the background that is worse for the text: lighter for light text, darker for ink."""
    stack = np.stack(imgs)
    lums = np.stack([lum(i) for i in imgs])
    idx = lums.argmax(0) if worse_light else lums.argmin(0)
    return np.take_along_axis(stack, idx[None, ..., None].repeat(3, -1), 0)[0]


class Gate:
    def __init__(self):
        self.rows = []

    def text(self, look, surface, token_name, token, bg, origin=(0, 0)):
        """A text check that can also propose the nearest passing colour (python3 scripts/check-contrast.py --suggest)."""
        values = text_on(bg, token)
        self.check(look, surface, token_name, values, TEXT, origin)
        if not self.rows[-1][5]:
            worst_bg = lum(bg).reshape(-1)[int(np.argmin(values))]
            self.rows[-1] = self.rows[-1][:7] + (suggest(token, worst_bg, TEXT),)

    def check(self, look, surface, token_name, values, need, origin=(0, 0)):
        """origin: the region's top-left in frame pixels, so the worst pixel can be reported in frame units."""
        values = np.asarray(values)
        v = float(np.min(values))
        where = ''
        if values.ndim == 2 and values.size > 1:
            y, x = np.unravel_index(int(np.argmin(values)), values.shape)
            where = f'x {(x + origin[0]) / FW:.2f} y {(y + origin[1]) / FH:.2f}'
        self.rows.append((look, surface, token_name, v, need, v >= need, where, None))


def gate_look(look, theme, g):
    colors, kinds = theme['colors'], theme['kinds']
    mat = colors['material']
    worse_light = look != 'paper'  # light text worsens on lighter glass; Paper's ink worsens on darker
    y0 = int(FH * 0.07)
    lens = load(f'{look}-bg-blur.jpg')
    lenses = [lens]
    header = META['looks'][look].get('header')
    if header and header.get('blur'):
        hb = np.asarray(Image.open(f"{ART}/{header['blur']}.png").convert('RGBA')).astype(float) / 255
        hh = int(round(header['ratio'] * FW))
        hb = np.asarray(Image.fromarray((hb * 255).astype(np.uint8), 'RGBA').resize((FW, hh), Image.LANCZOS)).astype(float) / 255
        with_header = lens.copy()
        with_header[:hh] = over(lens[:hh], hb[..., :3], hb[..., 3])
        lenses.append(with_header)
    lens = pick_worse(lenses, worse_light)
    fields = light_states(look)

    text_tokens = {k: colors[k] for k in ('text', 'muted', 'faint', 'label', 'link', 'danger')}
    text_tokens.update({f'kind.{k}.text': v['text'] for k, v in kinds.items()})

    pane = glass(lens, mat, fields, mat['body'], worse_light)
    control = glass(lens, mat, fields, mat['control']['body'], worse_light)
    receded = glass(lens, mat, fields, mat['receded']['body'], worse_light)
    ic, ia = col(mat['inset']['fill'])
    inset = over(pane, ic, ia)
    bk, bka = col(colors['backdrop'])

    def sheet_stack(stop):
        img = over(lens, bk, bka)
        c, a = col(stop)
        img = over(img, c, a)
        return img

    sheets = [sheet_stack(s) for s in mat['sheet']['body']]
    if mat.get('sheetOrb'):
        # Pine's moon orb in the sheet's top right corner, at its peak where it reaches the nearest text.
        om = re.search(r'radial-gradient\(\s*([\d.]+% [\d.]+%) at ([\d.]+% [\d.]+%)\s*,\s*(rgba?\([^)]*\))', mat['sheetOrb'])
        oc, oa = col(om.group(3))
        sheets = [over(sh, oc, oa * radial_alpha_at_text(om.group(2), om.group(1))) for sh in sheets]
    if mat['sheet'].get('band'):
        c, a = col(mat['sheet']['band'][0])
        sheets.append(over(sheets[0], c, a * max(0.0, 1 - TEXT_TOP / mat['sheet']['band'][1])))
    sheet = pick_worse(sheets, worse_light)
    sheet_inset = over(sheet, ic, ia)

    # Each tier is checked with the tokens that can sit on it: controls (search pills, inputs, composers)
    # carry typed text and secondary text (their labels sit above them, on the pane or the world); done rows
    # carry text, secondary and faint text.
    every = list(text_tokens)
    surfaces = {
        'pane': (pane, every),
        'control': (control, ['text', 'muted']),
        'receded': (receded, ['text', 'muted', 'faint', 'label']),
        'inset': (inset, every),
        'sheet': (sheet, every),
        'sheet inset': (sheet_inset, every),
    }
    if mat.get('bloom'):
        # Hero cards breathe a radial bloom over the pane body. Taken at its peak (opacity 1), reaching the
        # nearest place text can sit the way the caustics do. The hero carries its title, meta and label.
        bm = re.search(r'radial-gradient\(\s*([\d.]+% [\d.]+%) at ([\d.]+% [\d.]+%)\s*,\s*(rgba?\([^)]*\))', mat['bloom'])
        bc, ba = col(bm.group(3))
        reach = radial_alpha_at_text(bm.group(2), bm.group(1))
        surfaces['hero'] = (over(pane, bc, ba * reach), ['text', 'muted', 'faint', 'label', 'link'])
    for sname, (bg, names) in surfaces.items():
        region = bg[y0:]
        for tname in names:
            g.text(look, sname, tname, text_tokens[tname], region, (0, y0))

    # Non-text: unchecked outlines against the glass; fills against their track on the glass.
    region = pane[y0:]
    g.check(look, 'pane', 'controlBorder', text_on(region, colors['controlBorder']), NONTEXT, (0, y0))
    g.check(look, 'sheet', 'controlBorder', text_on(sheet[y0:], colors['controlBorder']), NONTEXT, (0, y0))
    tc, ta = col(colors['track'])
    track = over(region, tc, ta)
    for k, v in kinds.items():
        if k == 'calendar':
            continue
        fc, fa = col(v['color'])
        g.check(look, 'track', f'kind.{k} fill', ratio(lum(over(region, fc, fa)), lum(track)), NONTEXT, (0, y0))
    ac, aa = col(colors['accent'])
    g.check(look, 'track', 'accent fill', ratio(lum(over(region, ac, aa)), lum(track)), NONTEXT, (0, y0))

    if mat.get('orb'):
        # Pine's card orb: a disc of moonlight in the top-right corner that a card's title and meta can run under
        oc2, oa2 = col(mat['orb']['fill'])
        orbbed = over(pane[y0:], oc2, oa2)
        for tname in every:
            g.text(look, 'pane under orb', tname, text_tokens[tname], orbbed, (0, y0))
    if mat.get('tag'):
        # Pine's card tags: white capitals on a near-black pill, on any glass
        tc2, ta2 = col(mat['tag']['fill'])
        for sname, bg in (('pane', pane), ('hero', surfaces.get('hero', (pane,))[0]), ('receded', receded)):
            g.check(look, f'tag on {sname}', 'tag.ink', text_on(over(bg[y0:], tc2, ta2), mat['tag']['ink']), TEXT, (0, y0))

    # Ink on fills.
    for k, v in kinds.items():
        fill = np.broadcast_to(col(v['color'])[0], (1, 1, 3)).astype(float)
        g.check(look, f'kind.{k} fill', 'onKind', text_on(fill, colors['onKind']), TEXT)
    for i, stop in enumerate(colors['primaryGradient']):
        c, a = col(stop)
        fill = over(region, c, a)
        g.check(look, f'primary stop {i}', 'onPrimary', text_on(fill, colors['onPrimary']), TEXT)
    for i, stop in enumerate(colors['doneFill']):
        c, a = col(stop)
        fill = over(region, c, a)
        g.check(look, f'done stop {i}', 'onDone', text_on(fill, colors['onDone']), TEXT)

    # Bare backdrop: titles, section headings and hints sit straight on the world and its moving light.
    sharp = ra.ambience(load(f'{look}-bg.jpg'), look)
    if header:
        art = np.asarray(Image.open(f"{ART}/{header['file']}.png").convert('RGBA')).astype(float) / 255
        hh = int(round(header['ratio'] * FW))
        art = np.asarray(Image.fromarray((art * 255).astype(np.uint8), 'RGBA').resize((FW, hh), Image.LANCZOS)).astype(float) / 255
        sharp[:hh] = over(sharp[:hh], art[..., :3], art[..., 3])
    sharp = lit(sharp, fields, 1.0, worse_light)
    sharp = ra.gblur(sharp, GLYPH * DP)
    # Where text sits straight on the world. The Today header art (Paper, Pine) shares only its left side with
    # text (greeting, date, the trail heading): its ridges and pines sit behind the round buttons and the cards.
    art_bottom = (header['ratio'] * FW / FH) if header else 0.16
    if header:
        zones = {
            'title zone': (0.04, 0.45, 0.03, 0.13),
            # only the trail heading sits here, in the text colour
            'heading zone': (0.04, 0.40, 0.13, art_bottom, ('text',)),
            'page zone': (0.04, 0.55, art_bottom, 0.92),
            'right zone': (0.55, 0.96, art_bottom, 0.92),
        }
    else:
        zones = {
            # greeting, page title, subtitle and date: left of the header buttons
            'title zone': (0.04, 0.55, 0.03, 0.16),
            # section headings and their hints, left-aligned down the page
            'heading zone': (0.04, 0.55, 0.16, 0.92),
            # 'See all', counts and links at the right edge
            'right zone': (0.55, 0.96, 0.16, 0.92),
        }
    if look == 'pine':
        zones.pop('title zone')  # Pine's titles sit on the canopy slab, checked below
    for zname, (x0, x1, za, zb, *only) in zones.items():
        ox, oy = int(x0 * FW), int(za * FH)
        bg = sharp[oy:int(zb * FH), ox:int(x1 * FW)]
        for tname in (only[0] if only else ('text', 'muted', 'link')):
            g.text(look, zname, tname, colors[tname], bg, (ox, oy))

    # The player's shuffle and repeat when on: the glyph and a dot under it in the accent, over the lit inset disc.
    # The disc sits in its own glass circle on looks with controlsInGlass, on Paper's player sheet, and on the bare
    # world (the middle of the screen, where the transport row sits) elsewhere. 3:1 there, as a state indicator.
    if mat.get('controlsInGlass'):
        under = control[y0:]
    elif look == 'paper':
        under = sheet[y0:]
    else:
        under = sharp[int(0.40 * FH):int(0.85 * FH), int(0.04 * FW):int(0.96 * FW)]
    disc = over(under, ic, ia)
    g.check(look, 'player toggle on', 'accent', text_on(disc, colors['accent']), NONTEXT, (0, y0))

    canopy = mat.get('canopy')
    if canopy:
        check_canopy(look, colors, canopy, g)


def check_canopy(look, colors, canopy, g):
    """Pine's canopy slab, at the heights it takes (a title alone, and a title with a greeting or a segmented
    control under it): the slab gradient (stops at 0, 0.6, 1), the art drawn at the slab's height anchored bottom
    right at its opacity, and the moon glow behind the top-right buttons (at the edge of its drift toward the
    text). The title, subtitle, greeting and date sit in the left 62%; the segmented trough and the round buttons
    (glass on the slab becomes canopy.inset) sit anywhere, the segmented labels in the slab's lower part; the count badge (accent on a dark pill) sits right."""
    spec = META['looks'][look]['canopy']
    art_full = Image.open(f"{ART}/{spec['file']}.png").convert('RGBA')
    stops = [col(c)[0] for c in canopy['gradient']]
    mc, ma = col(canopy['moon'])
    ic, ia = col(canopy['inset']['fill'])
    for hdp in (100, 170, 230):
        hh = int(hdp * DP)
        t = np.linspace(0, 1, hh)[:, None, None]
        slab = np.where(t < 0.6, stops[0] + (stops[1] - stops[0]) * (t / 0.6), stops[1] + (stops[2] - stops[1]) * ((t - 0.6) / 0.4))
        slab = np.broadcast_to(slab, (hh, FW, 3)).astype(float).copy()
        # the art is drawn at the slab's height up to canopy.maxArt dp, anchored bottom right
        ah = int(min(hdp, canopy['maxArt']) * DP)
        full_w = int(round(ah / spec['ratio']))
        aw = min(FW, full_w)
        art = np.asarray(art_full.resize((full_w, ah), Image.LANCZOS)).astype(float) / 255
        art = art[:, -aw:]
        slab[hh - ah:, FW - aw:] = over(slab[hh - ah:, FW - aw:], art[..., :3], art[..., 3] * canopy['art'])
        yy, xx = np.mgrid[:hh, :FW].astype(float)
        d = np.hypot(xx - (FW - (70 + 14) * DP), yy - (20 + 10) * DP)
        slab = over(slab, mc, ma * np.clip(1 - d / (105 * DP), 0, 1))
        left = slab[:, : int(0.62 * FW)]
        for tname in ('text', 'onSlabMuted'):
            g.check(look, f'canopy {hdp} left', tname, text_on(left, colors[tname]).ravel(), TEXT)
        # glass on the slab: the round buttons' glyphs (text) up top, the segmented labels (muted when not chosen)
        # in the slab's lower part, under the title
        trough = over(slab, ic, ia)
        g.check(look, f'canopy {hdp} trough', 'text', text_on(trough, colors['text']).ravel(), TEXT)
        g.check(look, f'canopy {hdp} trough', 'muted', text_on(trough[int(hh * 0.55):], colors['muted']).ravel(), TEXT)
        bc, ba = col(canopy['badge'])
        pill = over(slab[:, int(0.62 * FW):], bc, ba)
        g.check(look, f'canopy {hdp} badge', 'accent', text_on(pill, colors['accent']).ravel(), TEXT)


def suggest(token, worst, need):
    """The nearest colour of the same hue that passes: mixed toward white (light text) or ink (dark text)."""
    c, _ = col(token)
    target = np.ones(3) if lum(c[None, None])[0, 0] > 0.18 else np.zeros(3)
    for t in np.linspace(0, 1, 201):
        m = c + (target - c) * t
        if ratio(lum(m[None, None])[0, 0], worst) >= need + 0.05:
            return '#%02X%02X%02X' % tuple(int(round(v * 255)) for v in m)
    return None


def main():
    flags = [a for a in sys.argv[1:] if a.startswith('--')]
    looks = [a for a in sys.argv[1:] if not a.startswith('--')] or ['lavender', 'stone', 'paper', 'pine']
    themes = load_themes()
    g = Gate()
    for look in looks:
        gate_look(look, themes[look], g)
    failed = [r for r in g.rows if not r[5]]
    width = max(len(f'{r[1]} / {r[2]}') for r in g.rows)
    for look in looks:
        rows = [r for r in g.rows if r[0] == look]
        print(f'\n{look}: {sum(r[5] for r in rows)}/{len(rows)} pass')
        # one line per check, worst first within each surface
        for r in sorted(rows, key=lambda r: (r[1], r[3])):
            mark = 'ok  ' if r[5] else 'FAIL'
            print(f'  {mark} {f"{r[1]} / {r[2]}":<{width}}  {r[3]:5.2f} (needs {r[4]}){"  worst at " + r[6] if r[6] and not r[5] else ""}')
    print(f'\n{len(g.rows) - len(failed)}/{len(g.rows)} checks pass')
    if failed and '--suggest' in flags:
        print('\nSuggested text tokens (same hue, nearest passing value against the worst background):')
        for r in failed:
            if r[7] is not None:
                print(f'  {r[0]} {r[1]} / {r[2]}: {r[7]}')
    if failed:
        print('FAILED:', ', '.join(f'{r[0]} {r[1]} / {r[2]} {r[3]:.2f}' for r in failed))
        sys.exit(1)


if __name__ == '__main__':
    main()
