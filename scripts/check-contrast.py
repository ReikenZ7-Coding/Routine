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
Desktop frame (gate_desktop): the wide world (<look>-bg-wide.jpg and its lens) at 1440x900 dp, with the 1280x800
  and 1024x768 windows cropped from it as the app crops them (looks.json wide.anchor). Every glass tier over every
  pixel of the wide lens and its light; the sidebar as chrome (the world live-blurred, then its glass and
  chromeTint, and over a pane passing under it); the hover light on pane and chrome; sheet glass over the dim
  (palette, side panels, popovers); the kbd hint (inset in control glass); a kind's soft wash on pane at DESK_WASH
  (calendar blocks, the gym's New best); breadcrumbs, page titles, subtitles and page notes on the bare world right
  of the sidebar; marks at 3:1 (the now line, chart bars, the day line's nodes on its band,
  the rail's dots) and the focus ring against the world and the glass; the New pill's hover light; Pine's slab and
  Paper's mountains behind the page header at each window (desk_canopy, desk_crag).
Thresholds: text, muted, faint, label, link, danger and every kind's text 4.5:1; onKind on every kind fill,
  onPrimary on both primary stops and onDone on both done stops 4.5:1; controlBorder against the glass, kind fills and the accent
  against their track 3:1, and the accent on the player's lit toggle disc 3:1. Today's trail (node, walked path, waypoint
  rings, the lit node's ring) 3:1 on the world in the rail, and onNode on node 4.5:1. Pine also checks its canopy slab
  (check_canopy).
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
DESK_WASH = 0.4  # SHELL.wash: the share of a kind's translucent soft wash drawn on desktop glass
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

    def text(self, look, surface, token_name, token, bg, origin=(0, 0), dims=None):
        """A text check that can also propose the nearest passing colour (python3 scripts/check-contrast.py --suggest)."""
        values = text_on(bg, token)
        self.check(look, surface, token_name, values, TEXT, origin, dims)
        if not self.rows[-1][5]:
            worst_bg = lum(bg).reshape(-1)[int(np.argmin(values))]
            self.rows[-1] = self.rows[-1][:7] + (suggest(token, worst_bg, TEXT),)

    def check(self, look, surface, token_name, values, need, origin=(0, 0), dims=None):
        """origin: the region's top-left in frame pixels, so the worst pixel can be reported in frame units."""
        values = np.asarray(values)
        v = float(np.min(values))
        where = ''
        fw, fh = dims or (FW, FH)
        if values.ndim == 2 and values.size > 1:
            y, x = np.unravel_index(int(np.argmin(values)), values.shape)
            where = f'x {(x + origin[0]) / fw:.2f} y {(y + origin[1]) / fh:.2f}'
        self.rows.append((look, surface, token_name, v, need, v >= need, where, None))


def gate_look(look, theme, g):
    colors, kinds = theme['colors'], theme['kinds']
    mat = colors['material']
    worse_light = colors['statusBar'] != 'dark'  # light text worsens on lighter glass; dark ink (Paper) on darker
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
    # Where text sits straight on the world. A look's Today header art (Paper's crag) shares only its left side
    # with text (greeting, date, the trail heading): its ridges sit behind the round buttons and the cards.
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
    if mat.get('canopy'):
        zones.pop('title zone')  # titles sit on the canopy slab, checked below
    for zname, (x0, x1, za, zb, *only) in zones.items():
        ox, oy = int(x0 * FW), int(za * FH)
        bg = sharp[oy:int(zb * FH), ox:int(x1 * FW)]
        for tname in (only[0] if only else ('text', 'muted', 'link')):
            g.text(look, zname, tname, colors[tname], bg, (ox, oy))

    # Today's trail, the same object in every look, drawn straight on the world in the rail at the left of the
    # content (12 to 68 dp across, below the header). 3:1 as marks: the walked dots, the filled node and the lit
    # node's ring against the world; a waypoint's ring against the world and against its own fill; the lit ring
    # against the fill inside it. The way ahead is deliberately faint and carries no state of its own (the
    # waypoints do), so it is not gated. The done check and the count badge (onNode on node) are 4.5:1.
    rx0, rx1 = int(12 / FRAME_W_DP * FW), int(68 / FRAME_W_DP * FW)
    ry0 = int(FH * 0.22)
    rail = sharp[ry0:int(0.92 * FH), rx0:rx1]
    rail_l = lum(rail)
    for tname in ('node', 'trailWalked', 'nodeAhead'):
        c, a = col(colors[tname])
        g.check(look, 'trail on world', tname, ratio(lum(over(rail, c, a)), rail_l), NONTEXT, (rx0, ry0))
    fc, fa = col(colors['nodeAheadFill'])
    waypoint = over(rail, fc, fa)
    c, a = col(colors['nodeAhead'])
    g.check(look, 'trail waypoint fill', 'nodeAhead', ratio(lum(over(waypoint, c, a)), lum(waypoint)), NONTEXT, (rx0, ry0))
    fc, fa = col(colors['nodeCurrentFill'])
    lit_fill = over(rail, fc, fa)
    c, a = col(colors['node'])
    g.check(look, 'trail lit node fill', 'node', ratio(lum(over(lit_fill, c, a)), lum(lit_fill)), NONTEXT, (rx0, ry0))
    node_fill = np.broadcast_to(col(colors['node'])[0], (1, 1, 3)).astype(float)
    g.check(look, 'node fill', 'onNode', text_on(node_fill, colors['onNode']), TEXT)

    # The player's shuffle and repeat when on: the glyph and a dot under it in the accent, over the lit inset disc.
    # The player is the same full-screen page in every look, its controls bare glyphs on the world (the middle of
    # the screen, where the transport row sits). 3:1 there, as a state indicator.
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


# ---------------------------------------------------------------------------------------------------------------
# The desktop frame: the wide world behind the desktop shell.

DESK_W_DP, DESK_H_DP = 1440, 900
GW, GH = 960, 600  # gate grid for the wide world: 0.67 px per dp (the lens is soft; text zones average a glyph)
GDP = GW / DESK_W_DP
DESK = (GW, GH)
# Windows: (width, height, sidebar inset, content's left edge, page padding). Comfortable windows dock the 264 dp
# sidebar; a compact one keeps the 72 dp rail (its labelled sidebar opens over the content, checked as chrome).
WINDOWS = [(1440, 900, 16, 16 + 264 + 32, 32), (1280, 800, 16, 16 + 264 + 32, 32), (1024, 768, 12, 12 + 72 + 24, 24)]
FOCUS_HALO = 'rgba(20,22,48,0.85)'
# layout.ts primaryHover: the primary pill's hover light deepens it under light ink and lifts it under dark ink
PRIMARY_HOVER = {True: 'rgba(0,0,0,0.16)', False: 'rgba(255,255,255,0.16)'}
# The header art on a desktop page (src/components/desktop/HeaderArt.tsx), in window dp. The page header's text
# starts 12 dp under the page's top (80 dp, 76 compact); the header's foot is where the page's header ends.
PAGE_TOP = {False: 80, True: 76}
TITLE_LINE = {False: 44, True: 40}
HEADER_FEET = (166, 210)  # one-line and two-line subtitles under the title
SUB_LINE = 22
TITLE_MAX = 720  # the header's title and subtitle column is at most this wide (Page.tsx TITLE_MAX)
SLAB = {'under': 16, 'stop': 140, 'moon': (118, 44, 112)}  # moon: centre in from the right, down, and its reach
CRAG = {'width': 600, 'compactWidth': 520, 'share': 0.45, 'peak': 24, 'peakAt': 100 / 900, 'fade': 96}  # HeaderArt.tsx CRAG


def place_wide(light, p, alpha_img):
    """Where a wide light layer's alpha lands on the wide world at clock value p (looks.json wide)."""
    box, m = light['box'], light['motion']
    if box in ('world', 'frame'):
        w, h, cx, cy = GW, GH, GW / 2, GH / 2
    else:
        w, h = int(round(box['w'] * GH)), int(round(box['h'] * GH))
        ax, ay = light.get('at', [0.5, 0.5])
        cx, cy = ax * GW, ay * GH
    src = Image.fromarray((alpha_img * 255).astype(np.uint8), 'L').resize((w, h), Image.BILINEAR)
    tx = ty = rot = 0.0
    scale = 1.0
    s = np.sin(2 * np.pi * p)
    if m['type'] == 'orbit':
        th = np.radians(m['phase'] + m['dir'] * 360 * p)
        tx, ty = m['radius'] * GH * np.cos(th), m['radius'] * GH * np.sin(th)
    elif m['type'] == 'sway':
        tx, rot = m['dx'] * GDP * s, m['rotate'] * s
    elif m['type'] == 'drift':
        tx, ty, scale = m['ax'] * GDP * s, -m['ay'] * GDP * np.cos(2 * np.pi * p), 1 + m['s'] * s
    elif m['type'] == 'slide':
        tx = (m['x0'] - m['ax'] * s) * GDP
    r = np.radians(rot)
    cos, sin = np.cos(r) / scale, np.sin(r) / scale
    ox, oy = cx + tx, cy + ty
    a_, b_, d_, e_ = cos, sin, -sin, cos
    c_ = w / 2 - a_ * ox - b_ * oy
    f_ = h / 2 - d_ * ox - e_ * oy
    out = src.transform((GW, GH), Image.AFFINE, (a_, b_, c_, d_, e_, f_), resample=Image.BILINEAR)
    return np.asarray(out).astype(float) / 255


def light_states_wide(look):
    """light_states for the wide world: every moment of its light, layers on one clock sampled together."""
    lights = META['looks'][look]['wide']['lights']
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
            peak = np.zeros((GH, GW))
            for p in np.linspace(0, 1, SAMPLES, endpoint=False):
                peak = np.maximum(peak, place_wide(light, p, a))
            fixed.append((rgb, peak * light.get('opacity', 1.0), light))
    return [[(rgb, place_wide(light, p, a) * light.get('opacity', 1.0), light) for rgb, a, light in loaded
             if light['motion']['period'] == clock] + fixed for p in np.linspace(0, 1, SAMPLES, endpoint=False)]


def window_zone(look, win, x0_dp, x1_dp, y0_dp, y1_dp):
    """A window-space rectangle (dp) as grid pixels of the wide world, cropped the way worldBox crops it."""
    wd, hd = win
    width = max(wd, hd * 1.6)
    height = width / 1.6
    ax, ay = META['looks'][look]['wide']['anchor']
    left, top = (wd - width) * ax, (hd - height) * ay
    gx = lambda x: int(round((x - left) / width * GW))
    gy = lambda y: int(round((y - top) / height * GH))
    return gx(x0_dp), gx(x1_dp), gy(y0_dp), gy(y1_dp)


def saturate(img, s):
    luma = (img * np.array([0.2126, 0.7152, 0.0722])).sum(-1, keepdims=True)
    return np.clip(luma + (img - luma) * s, 0, 1)


def gate_desktop(look, theme, g):
    colors, kinds = theme['colors'], theme['kinds']
    mat = colors['material']
    worse_light = colors['statusBar'] != 'dark'
    wide = META['looks'][look]['wide']
    lens = load(f'{look}-bg-wide-blur.jpg', DESK)
    fields = light_states_wide(look)
    L = f'{look} desktop'

    text_tokens = {k: colors[k] for k in ('text', 'muted', 'faint', 'label', 'link', 'danger')}
    text_tokens.update({f'kind.{k}.text': v['text'] for k, v in kinds.items()})
    every = list(text_tokens)

    pane = glass(lens, mat, fields, mat['body'], worse_light)
    control = glass(lens, mat, fields, mat['control']['body'], worse_light)
    receded = glass(lens, mat, fields, mat['receded']['body'], worse_light)
    ic, ia = col(mat['inset']['fill'])
    inset = over(pane, ic, ia)
    hc, ha = col(mat['hover']['fill'])
    bk, bka = col(colors['backdrop'])
    sheets = []
    for stop in mat['sheet']['body']:
        c, a = col(stop)
        sheets.append(over(over(lens, bk, bka), c, a))
    if mat['sheet'].get('band'):
        c, a = col(mat['sheet']['band'][0])
        sheets.append(over(sheets[0], c, a * max(0.0, 1 - TEXT_TOP / mat['sheet']['band'][1])))
    sheet = pick_worse(sheets, worse_light)

    # The sidebar is chrome: the browser blurs the world (and its light) live behind it, then its glass and tint.
    sharp = ra.ambience(load(f'{look}-bg-wide.jpg', DESK), look, wide)
    sharp_lit = lit(sharp, fields, 1.0, worse_light)
    live = mat['live']
    seen = saturate(ra.gblur(sharp_lit, live['webBlur'] * GDP), live['webSaturate'])
    tc, ta = col(mat['chromeTint'])
    chrome = over(glass(seen, mat, [[]], mat['body'], worse_light), tc, ta)
    # The compact sidebar opens over the content: a pane passing under it, at its worst.
    chrome_over = over(glass(pane, mat, [[]], mat['body'], worse_light), tc, ta)
    side = chrome[:, : int((16 + 264) * GDP)]
    side_over = chrome_over[:, : int((12 + 264) * GDP)]

    surfaces = {
        'pane': (pane, every),
        'control': (control, ['text', 'muted']),
        'receded': (receded, ['text', 'muted', 'faint', 'label']),
        'inset': (inset, every),
        'sheet': (sheet, every),
        'sheet inset': (over(sheet, ic, ia), every),
        'pane hover': (over(pane, hc, ha), every),
        # The search field's shortcut: text ink (the New menu's letters sit on the sheet, as 'sheet inset').
        'control kbd': (over(control, ic, ia), ['text']),
        'sidebar': (side, ['text', 'muted', 'label']),
        'sidebar hover': (over(side, hc, ha), ['text', 'muted']),
        'sidebar count': (over(side, ic, ia), ['text', 'muted']),
        'sidebar over pane': (side_over, ['text', 'muted', 'label']),
    }
    # A kind's soft wash on pane: the calendar's routine blocks (title and time) and the gym's "New best" pill. A
    # translucent wash is drawn at SHELL.wash of its alpha on desktop glass (src/components/desktop/layout.ts).
    for k, names in (('routines', ['text', 'muted', 'kind.routines.text']), ('gym', ['text', 'kind.gym.text'])):
        sc, sa = col(kinds[k]['soft'])
        surfaces[f'pane {k} soft'] = (over(pane, sc, sa * DESK_WASH if sa < 1 else sa), names)
    # A calendar block cascading over an earlier one is raised on the sheet's last stop (no dim under it), with the
    # routines wash over that.
    rc, ra_ = col(mat['sheet']['body'][-1])
    sc, sa = col(kinds['routines']['soft'])
    raised = over(lens, rc, ra_)
    surfaces['block raised'] = (raised, ['text', 'muted'])
    surfaces['block raised routines soft'] = (over(raised, sc, sa * DESK_WASH if sa < 1 else sa), ['text', 'muted', 'kind.routines.text'])
    if mat.get('bloom'):
        bm = re.search(r'radial-gradient\(\s*([\d.]+% [\d.]+%) at ([\d.]+% [\d.]+%)\s*,\s*(rgba?\([^)]*\))', mat['bloom'])
        bc, ba = col(bm.group(3))
        surfaces['hero'] = (over(pane, bc, ba * radial_alpha_at_text(bm.group(2), bm.group(1))), ['text', 'muted', 'faint', 'label', 'link'])
    for sname, (bg, names) in surfaces.items():
        for tname in names:
            g.text(L, sname, tname, text_tokens[tname], bg, dims=DESK)

    # The current page's drop in the sidebar (its sidebar fill where the look has one): its ink on both stops,
    # over the chrome.
    drop = mat['drop']
    for i, stop in enumerate(drop.get('side') or drop['fill']):
        c, a = col(stop)
        g.text(L, f'sidebar drop {i}', 'drop.ink', drop['ink'], over(side, c, a), dims=DESK)

    # Bare world: breadcrumbs, titles, subtitles and page notes, right of the sidebar, in each window.
    sharp_seen = ra.gblur(sharp_lit, GLYPH * GDP)
    for wd, hd, inset_dp, left_dp, pad in WINDOWS:
        x0, x1, y0, y1 = window_zone(look, (wd, hd), left_dp, wd - pad, 16, 200)
        zone = sharp_seen[max(0, y0):y1, max(0, x0):x1]
        for tname in ('text', 'muted', 'onSlabMuted', 'link'):
            g.text(L, f'title zone {wd}x{hd}', tname, colors[tname], zone, (x0, y0), DESK)
        x0, x1, y0, y1 = window_zone(look, (wd, hd), left_dp, wd - pad, 200, hd - 16)
        zone = sharp_seen[max(0, y0):y1, max(0, x0):x1]
        g.text(L, f'page notes {wd}x{hd}', 'onSlabMuted', colors['onSlabMuted'], zone, (x0, y0), DESK)

    # Marks at 3:1: the now line on pane (the calendar draws it under its blocks, so it never lies on inset), chart
    # bars on their track, the day line's nodes and now marker (text ink) on the hero, the rail's dots on chrome.
    ac, aa = col(colors['accent'])
    g.check(L, 'pane', 'now line (accent)', ratio(lum(over(pane, ac, aa)), lum(pane)), NONTEXT, dims=DESK)
    trc, tra = col(colors['track'])
    track = over(pane, trc, tra)
    for k in ('routines', 'gym', 'chinese'):
        fc, fa = col(kinds[k]['color'])
        g.check(L, 'chart track', f'kind.{k} bar', ratio(lum(over(pane, fc, fa)), lum(track)), NONTEXT, dims=DESK)
    hero = surfaces.get('hero', (pane,))[0]
    # The day line is a band of the track over the hero, the hours already gone a second layer of it; its nodes and
    # the now marker sit on both. Steps sharing a node show their count inside it.
    tc2, ta2 = col(colors['text'])
    # Pine's band is its slab trough (its track is a light tint); every other look's is its track.
    bc_, ba_ = col(mat['canopy']['inset']['fill']) if mat.get('canopy') else (trc, tra)
    band = over(hero, bc_, ba_)
    past = over(band, bc_, ba_)
    for bname, bg in (('day line band', band), ('day line past', past)):
        for tname in ('node', 'nodeAhead'):
            c, a = col(colors[tname])
            g.check(L, bname, tname, ratio(lum(over(bg, c, a)), lum(bg)), NONTEXT, dims=DESK)
        g.check(L, bname, 'now (text)', ratio(lum(over(bg, tc2, ta2)), lum(bg)), NONTEXT, dims=DESK)
        for fill in ('nodeAheadFill', 'nodeCurrentFill'):
            c, a = col(colors[fill])
            g.text(L, f'{bname} {fill}', 'count (text)', colors['text'], over(bg, c, a), dims=DESK)
    g.check(L, 'sidebar', 'rail dot (accent)', ratio(lum(over(side, ac, aa)), lum(side)), NONTEXT, dims=DESK)

    # The focus ring: a white ring with a dark halo. On Paper's light world the halo carries it; on the darker
    # worlds the ring does.
    ring = FOCUS_HALO if look == 'paper' else '#FFFFFF'
    for sname, bg in (('world', sharp_seen), ('pane', pane), ('sidebar', side)):
        c, a = col(ring)
        g.check(L, sname, 'focus ring', ratio(lum(over(bg, c, a)), lum(bg)), NONTEXT, dims=DESK)

    # The New pill under the pointer: its ink through the white hover light, on both primary stops.
    hv, hva = col(PRIMARY_HOVER[bool(lum(col(colors['onPrimary'])[0][None, None])[0, 0] > 0.5)])
    for i, stop in enumerate(colors['primaryGradient']):
        c, a = col(stop)
        g.text(L, f'New hover stop {i}', 'onPrimary', colors['onPrimary'], over(over(pane, c, a), hv, hva), dims=DESK)

    if mat.get('canopy'):
        desk_canopy(look, colors, mat, g, L)
    if META['looks'][look].get('header') and look == 'paper':
        desk_crag(look, colors, mat, sharp_lit, g, L)


def desk_slab(look, canopy, w, h):
    """Pine's slab on a desktop window, at 1 px per dp: from the gap right of the sidebar to the window's right
    edge, h dp tall. The gradient's middle stop sits 140 dp down; the pines stand at the bottom right at the slab's
    height up to canopy.maxArt dp; the moon glow behind the bell and New, taken at its peak over its whole drift."""
    spec = META['looks'][look]['canopy']
    stops = [col(c)[0] for c in canopy['gradient']]
    y = np.arange(h, dtype=float)[:, None, None]
    top = stops[0] + (stops[1] - stops[0]) * np.clip(y / SLAB['stop'], 0, 1)
    low = stops[1] + (stops[2] - stops[1]) * np.clip((y - SLAB['stop']) / max(1, h - SLAB['stop']), 0, 1)
    slab = np.broadcast_to(np.where(y < SLAB['stop'], top, low), (h, w, 3)).astype(float).copy()
    ah = int(min(h, canopy['maxArt']))
    full_w = int(round(ah / spec['ratio']))
    aw = min(w, full_w)
    art = np.asarray(Image.open(f"{ART}/{spec['file']}.png").convert('RGBA').resize((full_w, ah), Image.LANCZOS)).astype(float) / 255
    art = art[:, -aw:]
    slab[h - ah:, w - aw:] = over(slab[h - ah:, w - aw:], art[..., :3], art[..., 3] * canopy['art'])
    mc, ma = col(canopy['moon'])
    m = META['looks'][look]['lights'][0]['motion']
    right, down, reach = SLAB['moon']
    yy, xx = np.mgrid[:h, :w].astype(float)
    peak = np.zeros((h, w))
    for p in np.linspace(0, 1, SAMPLES, endpoint=False):
        sn, cs = np.sin(2 * np.pi * p), np.cos(2 * np.pi * p)
        tx, ty, sc = m['ax'] * sn, -m['ay'] * cs, 1 + m['s'] * sn
        d = np.hypot(xx - (w - right + tx), yy - (down + ty))
        peak = np.maximum(peak, np.clip(1 - d / (reach * sc), 0, 1))
    return over(slab, mc, ma * peak)


def header_rows(compact, foot):
    """A page header's rows in window dp: the title's (text) and the subtitle's (onSlabMuted, its figures in text),
    for a subtitle of one line (foot 166) or two."""
    sub = (1 if foot <= HEADER_FEET[0] else 2) * SUB_LINE
    top = PAGE_TOP[compact] + 12
    return (top, top + TITLE_LINE[compact]), (foot - sub, foot)


# Where the top bar's search field sits, from the content's right edge: its placeholder (muted) left of the look,
# bell and New buttons and its own shortcut.
SEARCH_CLEAR = 40 + 8 + 40 + 8 + 96 + 8 + 48


def desk_canopy(look, colors, mat, g, L):
    """Pine's slab behind each desktop page's header and the top bar. The breadcrumbs (onSlabMuted, the current page
    in text) sit at the left of the top bar; the title (text) and the subtitle (onSlabMuted, its figures in text) in
    the title's column, at most TITLE_MAX dp from the content's left edge, over the pines on a narrow window. Glass
    on the slab becomes canopy.inset: the round buttons and the header buttons (text) anywhere on the slab, over the
    pines and the moon; the search field's placeholder (muted) left of the buttons; a header's segmented labels
    (muted) in the header's rows; the search field's shortcut sits on material.inset inside it."""
    canopy = mat['canopy']
    ic, ia = col(canopy['inset']['fill'])
    kc, ka = col(mat['inset']['fill'])
    for wd, hd, inset_dp, left_dp, pad in WINDOWS:
        compact = wd < 1280
        x0 = inset_dp * 2 + (72 if compact else 264)
        w = wd - x0
        for foot in HEADER_FEET:
            h = foot + SLAB['under']
            slab = desk_slab(look, canopy, w, h)
            name = f'slab {wd}x{hd} {h}'
            cl, cr = left_dp - x0, min(left_dp - x0 + TITLE_MAX, w - pad)
            (t0, t1), (s0, s1) = header_rows(compact, foot)
            crumbs = slab[28:68, cl:cl + 400]
            for tname in ('text', 'onSlabMuted'):
                g.text(L, f'{name} crumbs', tname, colors[tname], crumbs, (cl, 28), (w, h))
                g.text(L, f'{name} subtitle', tname, colors[tname], slab[s0:s1, cl:cr], (cl, s0), (w, h))
            g.text(L, f'{name} title', 'text', colors['text'], slab[t0:t1, cl:cr], (cl, t0), (w, h))
            trough = over(slab, ic, ia)
            g.text(L, f'{name} trough', 'text', colors['text'], trough, dims=(w, h))
            sx = w - pad - SEARCH_CLEAR
            g.text(L, f'{name} trough search', 'muted', colors['muted'], trough[28:68, :sx], (0, 28), (w, h))
            g.text(L, f'{name} trough header', 'muted', colors['muted'], trough[t0:foot], (0, t0), (w, h))
            g.text(L, f'{name} trough kbd', 'text', colors['text'], over(trough, kc, ka), dims=(w, h))


def desk_crag(look, colors, mat, sharp_lit, g, L):
    """Paper's mountains behind the right of the Overview and Today headers, on the lit world, at each window: the
    picture is the header's width share wide (600 dp at most, 520 compact), its peak 24 dp under the window's top,
    cut at the header's foot and faded over its last 72 dp. Glass doesn't see it (the lens is the world's), so only
    bare text and inset discs sit on it: the title and subtitle where the title's column reaches over it, and the
    day arrows' glyphs (text on material.inset) beside them."""
    spec = META['looks'][look]['header']
    full = Image.open(f"{ART}/{spec['file']}.png").convert('RGBA')
    ic, ia = col(mat['inset']['fill'])
    ax, ay = META['looks'][look]['wide']['anchor']
    for wd, hd, inset_dp, left_dp, pad in WINDOWS:
        compact = wd < 1280
        width = max(wd, hd * 1.6)
        height = width / 1.6
        left, top = (wd - width) * ax, (hd - height) * ay
        s = GW / width  # grid px per dp
        cw = min(CRAG['compactWidth'] if compact else CRAG['width'], round(wd * CRAG['share']))
        ih = round(cw * spec['ratio'])
        mt = round(CRAG['peak'] - CRAG['peakAt'] * ih)
        gx0, gw = int(round((wd - cw - left) * s)), int(round(cw * s))
        art = np.asarray(full.resize((gw, int(round(ih * s))), Image.LANCZOS)).astype(float) / 255
        for foot in HEADER_FEET:
            # rows of the window from 0 to the foot, in the grid, and where each sits in the picture
            gy0, gy1 = int(round((0 - top) * s)), int(round((foot - top) * s))
            rows = np.arange(gy0, gy1)
            wy = rows / s + top  # window dp
            src = np.clip(np.round((wy - mt) * s).astype(int), 0, art.shape[0] - 1)
            inside = (wy >= mt) & (wy < mt + ih)
            fade = np.clip((foot - wy) / CRAG['fade'], 0, 1) * inside
            layer = art[src]
            img = sharp_lit.copy()
            img[gy0:gy1, gx0:gx0 + gw] = over(img[gy0:gy1, gx0:gx0 + gw], layer[..., :3], layer[..., 3] * fade[:, None])
            seen = ra.gblur(img, GLYPH * s)
            name = f'crag {wd}x{hd} {foot}'
            # The title's column: from where the picture starts to TITLE_MAX dp from the content's left edge.
            (t0, t1), (s0, s1) = header_rows(compact, foot)
            right = min(left_dp + TITLE_MAX, wd - pad)
            if right > wd - cw:
                for (y0_, y1_), names, part in (((t0, t1), ('text',), 'title'), ((s0, s1), ('text', 'onSlabMuted'), 'subtitle')):
                    zx0, zx1, zy0, zy1 = window_zone(look, (wd, hd), wd - cw, right, y0_, y1_)
                    zone = seen[max(0, zy0):zy1, max(0, zx0):zx1]
                    for tname in names:
                        g.text(L, f'{name} {part}', tname, colors[tname], zone, (zx0, zy0), DESK)
            zx0, zx1, zy0, zy1 = window_zone(look, (wd, hd), wd - cw, wd - pad, PAGE_TOP[compact] + 12, foot)
            disc = over(seen[max(0, zy0):zy1, max(0, zx0):zx1], ic, ia)
            g.text(L, f'{name} disc', 'text', colors['text'], disc, (zx0, zy0), DESK)


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
        if '--phone' not in flags:
            gate_desktop(look, themes[look], g)
    failed = [r for r in g.rows if not r[5]]
    width = max(len(f'{r[1]} / {r[2]}') for r in g.rows)
    for look in [n for look in looks for n in (look, f'{look} desktop')]:
        rows = [r for r in g.rows if r[0] == look]
        if not rows:
            continue
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
