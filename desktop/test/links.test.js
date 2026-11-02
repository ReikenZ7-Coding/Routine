'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { externalUrl, isAppUrl, webFallback } = require('../src/links');

test('the app origin stays inside the window', () => {
  assert.ok(isAppUrl('app://symphony/'));
  assert.ok(isAppUrl('app://symphony/library?x=1#y'));
  assert.ok(!isAppUrl('app://symphony.evil/'));
  assert.ok(!isAppUrl('app://other/'));
  assert.ok(!isAppUrl('https://symphony/'));
  assert.ok(!isAppUrl('not a url'));
  assert.ok(!isAppUrl(undefined));
});

test('web, mail and Spotify links go to the system', () => {
  assert.equal(externalUrl('https://open.spotify.com/playlist/37i9dQZF1DX'), 'https://open.spotify.com/playlist/37i9dQZF1DX');
  assert.equal(externalUrl('http://example.com/a b'), 'http://example.com/a%20b');
  assert.equal(externalUrl('mailto:someone@example.com'), 'mailto:someone@example.com');
  assert.equal(externalUrl('spotify:playlist:37i9dQZF1DX'), 'spotify:playlist:37i9dQZF1DX');
});

test('anything else is dropped', () => {
  for (const bad of [
    'javascript:alert(1)',
    'file:///C:/Windows/System32/calc.exe',
    'data:text/html,<script>1</script>',
    'app://symphony/library',
    'ms-msdt:/id PCWDiagnostic',
    'search-ms:query=x',
    'vbscript:x',
    'https://user:pass@example.com/',
    'https://',
    '',
    null,
  ]) {
    assert.equal(externalUrl(bad), null, String(bad));
  }
});

test('spotify: links have a web player fallback', () => {
  assert.equal(webFallback('spotify:playlist:37i9dQZF1DX'), 'https://open.spotify.com/playlist/37i9dQZF1DX');
  assert.equal(webFallback(' spotify:Album:abc123 '), 'https://open.spotify.com/album/abc123');
  assert.equal(webFallback('https://open.spotify.com/playlist/x'), null);
});
