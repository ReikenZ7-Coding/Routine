'use strict';

// The frame's idea of each look has to match the app's: src/theme.ts (colors.bg, colors.statusBar) and the
// settings key and default look in src/lib/store.tsx.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { DEFAULT_LOOK, LOOKS, SETTINGS_KEY, isLook, lookFromSettings } = require('../src/looks');

const repo = path.resolve(__dirname, '..', '..');
const theme = fs.readFileSync(path.join(repo, 'src', 'theme.ts'), 'utf8');
const store = fs.readFileSync(path.join(repo, 'src', 'lib', 'store.tsx'), 'utf8');

test('the same four looks as src/theme.ts', () => {
  const m = /export type ThemeName = ([^;]+);/.exec(theme);
  assert.ok(m, 'ThemeName not found in src/theme.ts');
  const names = [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]).sort();
  assert.deepEqual(Object.keys(LOOKS).sort(), names);
});

test('each look has the backdrop colour and title bar of its palette in src/theme.ts', () => {
  const start = theme.indexOf('const PALETTES');
  assert.ok(start >= 0, 'PALETTES not found in src/theme.ts');
  for (const [name, look] of Object.entries(LOOKS)) {
    const at = theme.indexOf(`\n  ${name}: {`, start);
    assert.ok(at >= 0, `${name} palette not found`);
    const block = theme.slice(at, at + 4000);
    const bg = /\bbg: '(#[0-9A-Fa-f]{6})'/.exec(block);
    const bar = /\bstatusBar: '(light|dark)'/.exec(block);
    assert.ok(bg && bar, `${name}: bg or statusBar not found`);
    assert.equal(look.bg.toUpperCase(), bg[1].toUpperCase(), `${name} bg`);
    assert.equal(look.dark, bar[1] === 'light', `${name}: statusBar '${bar[1]}' means dark=${bar[1] === 'light'}`);
  }
});

test('the settings key and default look match src/lib/store.tsx', () => {
  assert.ok(store.includes(`SETTINGS_KEY = '${SETTINGS_KEY}'`), 'SETTINGS_KEY differs');
  assert.ok(new RegExp(`DEFAULT_SETTINGS[^\\n]*theme: '${DEFAULT_LOOK}'`).test(store), 'default look differs');
});

test('reading the look from saved settings', () => {
  assert.equal(lookFromSettings('{"theme":"pine","name":"Matthew"}'), 'pine');
  assert.equal(lookFromSettings('{"theme":"neon"}'), null);
  assert.equal(lookFromSettings('{"theme":"constructor"}'), null);
  assert.equal(lookFromSettings('not json'), null);
  assert.equal(lookFromSettings(''), null);
  assert.equal(lookFromSettings(null), null);
  assert.ok(isLook('paper'));
  assert.ok(!isLook('toString'));
});
