'use strict';

// Remembers the window's size, place, maximised state, zoom and look between launches, in a small JSON file in
// the app's data folder. Placement is a pure function so the tests can run it with made-up screens.

const fs = require('node:fs');
const path = require('node:path');

function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

function validBounds(b) {
  return (
    b && isFiniteNumber(b.x) && isFiniteNumber(b.y) && isFiniteNumber(b.width) && isFiniteNumber(b.height) && b.width > 0 && b.height > 0
  );
}

/** Reads the saved state; a missing or damaged file gives an empty state. */
function loadState(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return {};
    const out = {};
    if (validBounds(parsed.bounds)) out.bounds = pick(parsed.bounds);
    if (typeof parsed.maximized === 'boolean') out.maximized = parsed.maximized;
    if (isFiniteNumber(parsed.zoom) && Math.abs(parsed.zoom) <= 5) out.zoom = parsed.zoom;
    if (typeof parsed.look === 'string') out.look = parsed.look;
    return out;
  } catch {
    return {};
  }
}

/** Writes the state through a temporary file, so a crash mid-write never leaves half a file behind. */
function saveState(file, state) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, file);
    return true;
  } catch {
    return false;
  }
}

function pick(b) {
  return { x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) };
}

function overlap(a, b) {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** The minimum size, shrunk on screens smaller than it so the window never outgrows the screen. */
function minimumFor(workArea, min) {
  return { width: Math.min(min.width, workArea.width), height: Math.min(min.height, workArea.height) };
}

/**
 * Where to open the window. Saved bounds are kept when enough of the window (its title bar included) is still
 * on a connected screen; otherwise, or on first launch, the default size is centred on the primary screen.
 *
 * @param saved      bounds from the last session, or undefined
 * @param workAreas  each connected screen's work area (screen.getAllDisplays()[i].workArea)
 * @param primary    the primary screen's work area
 * @param sizes      { min, preferred } sizes
 */
function placeWindow(saved, workAreas, primary, sizes) {
  if (validBounds(saved)) {
    const b = pick(saved);
    let home = null;
    let shown = 0;
    for (const wa of workAreas) {
      const o = overlap(b, wa);
      if (o > shown) {
        shown = o;
        home = wa;
      }
    }
    const titleBar = { x: b.x, y: b.y, width: b.width, height: Math.min(40, b.height) };
    const visible = home && shown >= Math.min(b.width * b.height, 160 * 120) && workAreas.some((wa) => overlap(titleBar, wa) > 0);
    if (visible) {
      const min = minimumFor(home, sizes.min);
      const width = Math.min(Math.max(b.width, min.width), home.width);
      const height = Math.min(Math.max(b.height, min.height), home.height);
      const x = Math.min(Math.max(b.x, home.x), home.x + home.width - width);
      const y = Math.min(Math.max(b.y, home.y), home.y + home.height - height);
      return { x, y, width, height };
    }
  }
  const min = minimumFor(primary, sizes.min);
  const width = Math.max(min.width, Math.min(sizes.preferred.width, Math.round(primary.width * 0.92)));
  const height = Math.max(min.height, Math.min(sizes.preferred.height, Math.round(primary.height * 0.92)));
  return {
    x: primary.x + Math.round((primary.width - width) / 2),
    y: primary.y + Math.round((primary.height - height) / 2),
    width,
    height,
  };
}

module.exports = { loadState, saveState, placeWindow, minimumFor };
