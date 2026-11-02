'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const config = require('../src/config');
const pkg = require('../package.json');
const looks = require('../src/looks');

const repo = path.resolve(__dirname, '..', '..');
const appJson = JSON.parse(fs.readFileSync(path.join(repo, 'app.json'), 'utf8')).expo;

test('the Windows app id matches the installer and never reuses the Android package', () => {
  assert.equal(pkg.build.appId, config.APP_ID);
  assert.notEqual(config.APP_ID, appJson.android.package);
  assert.equal(appJson.android.package, 'com.reikenz7.routine');
});

test('one product name everywhere', () => {
  assert.equal(config.PRODUCT_NAME, appJson.name);
  assert.equal(pkg.productName, config.PRODUCT_NAME);
  assert.equal(pkg.build.productName, config.PRODUCT_NAME);
  assert.equal(pkg.build.nsis.shortcutName, config.PRODUCT_NAME);
});

test('the data folder and origin stay put (saved routines live under them)', () => {
  assert.equal(config.DATA_FOLDER, 'Symphony OS');
  assert.equal(config.APP_ORIGIN, 'app://symphony');
});

test('the installer keeps saved data on uninstall and upgrade', () => {
  assert.equal(pkg.build.nsis.deleteAppDataOnUninstall, false);
});

test('the packaged app carries only what it runs: its code and the web export as web/', () => {
  assert.deepEqual(pkg.build.files, ['src/**/*', 'package.json', { from: '../dist', to: 'web', filter: ['**/*'] }]);
  assert.equal(pkg.main, 'src/main.js');
  assert.ok(Object.keys(pkg.dependencies || {}).length === 0, 'runtime code uses only Node and Electron');
});

test('the preload carries the same constants it cannot import', () => {
  const preload = fs.readFileSync(path.join(__dirname, '..', 'src', 'preload.js'), 'utf8');
  const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
  assert.ok(preload.includes(`SETTINGS_KEY = '${looks.SETTINGS_KEY}'`));
  assert.ok(preload.includes(`'${looks.DEFAULT_LOOK}'`));
  const channel = /LOOK_CHANNEL = '([^']+)'/.exec(main)[1];
  assert.ok(preload.includes(`LOOK_CHANNEL = '${channel}'`));
});

test('the window never goes narrower than the page width where the app draws its desktop layout', () => {
  const context = fs.readFileSync(path.join(repo, 'src', 'components', 'desktop', 'context.ts'), 'utf8');
  const min = Number(/export const DESKTOP_MIN = (\d+);/.exec(context)[1]);
  assert.equal(config.DESKTOP_MIN, min);
  assert.ok(config.MIN_SIZE.width >= min);
  assert.ok(config.SMOKE_SIZE.width >= min);
});
