'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { loadState, placeWindow, saveState, minimumFor } = require('../src/windowState');
const { DEFAULT_SIZE, MIN_SIZE } = require('../src/config');

const sizes = { min: MIN_SIZE, preferred: DEFAULT_SIZE };
const laptop = { x: 0, y: 0, width: 1920, height: 1040 };
const small = { x: 0, y: 0, width: 1366, height: 728 };
const tiny = { x: 0, y: 0, width: 960, height: 600 };
const second = { x: 1920, y: 0, width: 2560, height: 1400 };

test('first launch centres the preferred size on the primary screen', () => {
  assert.deepEqual(placeWindow(undefined, [laptop], laptop, sizes), { x: 240, y: 70, width: 1440, height: 900 });
});

test('first launch on a small screen shrinks to fit but keeps the minimum', () => {
  const b = placeWindow(undefined, [small], small, sizes);
  assert.ok(b.width <= small.width && b.height <= small.height);
  assert.ok(b.width >= MIN_SIZE.width && b.height >= MIN_SIZE.height);
  assert.ok(b.x >= 0 && b.y >= 0);
});

test('a screen smaller than the minimum gets a window that still fits', () => {
  const b = placeWindow(undefined, [tiny], tiny, sizes);
  assert.deepEqual(b, { x: 0, y: 0, width: 960, height: 600 });
  assert.deepEqual(minimumFor(tiny, MIN_SIZE), { width: 960, height: 600 });
});

test('saved bounds come back when the window is still on a screen', () => {
  const saved = { x: 2100, y: 100, width: 1600, height: 1000 };
  assert.deepEqual(placeWindow(saved, [laptop, second], laptop, sizes), saved);
});

test('a window left on an unplugged screen comes back to the primary one', () => {
  const saved = { x: 2100, y: 100, width: 1600, height: 1000 };
  assert.deepEqual(placeWindow(saved, [laptop], laptop, sizes), placeWindow(undefined, [laptop], laptop, sizes));
});

test('a window whose title bar is off screen is re-centred', () => {
  const saved = { x: 100, y: -900, width: 1200, height: 1000 };
  assert.deepEqual(placeWindow(saved, [laptop], laptop, sizes), placeWindow(undefined, [laptop], laptop, sizes));
});

test('saved bounds bigger than the screen are pulled inside it', () => {
  const b = placeWindow({ x: -50, y: 0, width: 3000, height: 2000 }, [laptop], laptop, sizes);
  assert.deepEqual(b, { x: 0, y: 0, width: 1920, height: 1040 });
});

test('saved bounds smaller than the minimum grow to it', () => {
  const b = placeWindow({ x: 100, y: 100, width: 500, height: 300 }, [laptop], laptop, sizes);
  assert.deepEqual(b, { x: 100, y: 100, width: MIN_SIZE.width, height: MIN_SIZE.height });
});

test('state round-trips, and a damaged file reads as empty', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'symphony-state-'));
  const file = path.join(dir, 'nested', 'window-state.json');
  assert.deepEqual(loadState(file), {});
  const state = { bounds: { x: 1, y: 2, width: 1100, height: 800 }, maximized: true, zoom: 0.5, look: 'pine' };
  assert.ok(saveState(file, state));
  assert.deepEqual(loadState(file), state);
  assert.ok(!fs.existsSync(`${file}.tmp`));

  fs.writeFileSync(file, '{"bounds": {"x": "a"}, "zoom": 99, "maximized": "yes"');
  assert.deepEqual(loadState(file), {});
  fs.writeFileSync(file, JSON.stringify({ bounds: { x: 0, y: 0, width: -5, height: 10 }, zoom: 99, maximized: 'yes', look: 'pine' }));
  assert.deepEqual(loadState(file), { look: 'pine' });
  fs.rmSync(dir, { recursive: true, force: true });
});
