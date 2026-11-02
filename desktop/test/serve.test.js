'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, before, after } = require('node:test');

const { CSP, createHandler, parseRange, resolveInside } = require('../src/serve');

let root;
let handle;
const INDEX =
  '<!doctype html><html><head><title>Symphony OS</title></head><body><div id="root"></div><script src="/_expo/static/js/web/entry-abc.js" defer></script></body></html>';

before(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'symphony-serve-'));
  const put = (rel, body) => {
    const full = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  };
  put('index.html', INDEX);
  put('_expo/static/js/web/entry-abc.js', 'console.log("hi")');
  put('assets/assets/sounds/rain.0e18.wav', Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 256)));
  put('assets/node_modules/@expo-google-fonts/dm-sans/DMSans_400Regular.ttf', 'font');
  put('assets/with space/a b.png', 'png');
  put('empty.txt', '');
  fs.writeFileSync(path.join(os.tmpdir(), 'symphony-secret.txt'), 'secret');
  handle = createHandler({ root, host: 'symphony' });
});

after(() => fs.rmSync(root, { recursive: true, force: true }));

const get = (url, init) => handle(new Request(url, init));

test('serves index.html at the root with the Content-Security-Policy', async () => {
  const res = await get('app://symphony/');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(res.headers.get('content-security-policy'), CSP);
  assert.equal(await res.text(), INDEX);
});

test('page routes without a file fall back to index.html', async () => {
  for (const route of ['/library', '/gym', '/settings/look', '/library?tab=groceries', '/inbox#top']) {
    const res = await get(`app://symphony${route}`);
    assert.equal(res.status, 200, route);
    assert.equal(await res.text(), INDEX, route);
    assert.ok(res.headers.get('content-security-policy'), route);
  }
});

test('files are served with their own type', async () => {
  const js = await get('app://symphony/_expo/static/js/web/entry-abc.js');
  assert.equal(js.status, 200);
  assert.equal(js.headers.get('content-type'), 'text/javascript; charset=utf-8');
  assert.equal(js.headers.get('content-security-policy'), null);
  assert.equal(await js.text(), 'console.log("hi")');

  const font = await get('app://symphony/assets/node_modules/@expo-google-fonts/dm-sans/DMSans_400Regular.ttf');
  assert.equal(font.headers.get('content-type'), 'font/ttf');

  const spaced = await get('app://symphony/assets/with%20space/a%20b.png');
  assert.equal(spaced.status, 200);
  assert.equal(spaced.headers.get('content-type'), 'image/png');

  const empty = await get('app://symphony/empty.txt');
  assert.equal(empty.status, 200);
  assert.equal(await empty.text(), '');
});

test('a missing file with an extension is a 404, never index.html', async () => {
  const res = await get('app://symphony/assets/nope.png');
  assert.equal(res.status, 404);
  assert.notEqual(await res.text(), INDEX);
  assert.equal((await get('app://symphony/_expo/static/js/web/old-entry.js')).status, 404);
});

test('byte ranges for audio seeking', async () => {
  const url = 'app://symphony/assets/assets/sounds/rain.0e18.wav';
  const full = await get(url);
  assert.equal(full.status, 200);
  assert.equal(full.headers.get('accept-ranges'), 'bytes');
  assert.equal(full.headers.get('content-length'), '1000');
  assert.equal((await full.arrayBuffer()).byteLength, 1000);

  const part = await get(url, { headers: { Range: 'bytes=10-19' } });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('content-range'), 'bytes 10-19/1000');
  assert.deepEqual([...new Uint8Array(await part.arrayBuffer())], [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);

  const open = await get(url, { headers: { Range: 'bytes=990-' } });
  assert.equal(open.headers.get('content-range'), 'bytes 990-999/1000');
  assert.equal((await open.arrayBuffer()).byteLength, 10);

  const suffix = await get(url, { headers: { Range: 'bytes=-5' } });
  assert.equal(suffix.headers.get('content-range'), 'bytes 995-999/1000');

  const beyond = await get(url, { headers: { Range: 'bytes=5000-' } });
  assert.equal(beyond.status, 416);
  assert.equal(beyond.headers.get('content-range'), 'bytes */1000');
});

test('HEAD answers without a body; other methods are refused', async () => {
  const head = await get('app://symphony/assets/assets/sounds/rain.0e18.wav', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('content-length'), '1000');
  assert.equal(head.body, null);
  assert.equal((await get('app://symphony/', { method: 'POST', body: 'x' })).status, 405);
});

test('nothing outside the export can be reached', async () => {
  for (const bad of [
    'app://symphony/%2e%2e/symphony-secret.txt',
    'app://symphony/assets/%2E%2E%2F%2E%2E%2Fsymphony-secret.txt',
    'app://symphony/..%2f..%2fsymphony-secret.txt',
    'app://symphony/assets/..%5c..%5csymphony-secret.txt',
    'app://symphony/C:/Windows/win.ini',
    'app://symphony/index.html:stream',
    'app://symphony/%00.png',
    'app://symphony/%E0%A4%A.png',
  ]) {
    const res = await get(bad);
    assert.ok(res.status === 400 || res.status === 404 || (res.status === 200 && (await res.text()) === INDEX), `${bad} -> ${res.status}`);
    if (res.status === 200) continue;
    assert.notEqual(await res.text(), 'secret', bad);
  }
});

test('other hosts on the scheme are not served', async () => {
  assert.equal((await get('app://elsewhere/')).status, 404);
  assert.equal((await get('app://symphony.example/')).status, 404);
});

test('resolveInside keeps every path under the root', () => {
  const r = path.join(os.tmpdir(), 'web');
  assert.equal(resolveInside(r, '/'), r);
  assert.equal(resolveInside(r, '/a/b.js'), path.join(r, 'a', 'b.js'));
  assert.equal(resolveInside(r, '/a/%2e%2e/%2e%2e/x'), null);
  assert.equal(resolveInside(r, '/a\\..\\..\\x'), null);
  assert.equal(resolveInside(r, '/%zz'), null);
});

test('parseRange', () => {
  assert.equal(parseRange(null, 100), null);
  assert.equal(parseRange('items=1-2', 100), null);
  assert.equal(parseRange('bytes=0-1,4-5', 100), null);
  assert.deepEqual(parseRange('bytes=0-0', 100), { start: 0, end: 0 });
  assert.deepEqual(parseRange('bytes=50-500', 100), { start: 50, end: 99 });
  assert.deepEqual(parseRange('bytes=-500', 100), { start: 0, end: 99 });
  assert.equal(parseRange('bytes=100-', 100), false);
  assert.equal(parseRange('bytes=9-3', 100), false);
  assert.equal(parseRange('bytes=-0', 100), false);
});

test('the Content-Security-Policy only lets the app run its own code', () => {
  const directives = Object.fromEntries(
    CSP.split(';')
      .map((d) => d.trim().split(/\s+/))
      .map(([k, ...v]) => [k, v]),
  );
  assert.deepEqual(directives['script-src'], ["'self'"]);
  assert.deepEqual(directives['object-src'], ["'none'"]);
  assert.deepEqual(directives['base-uri'], ["'none'"]);
  assert.ok(!CSP.includes('unsafe-eval'));
  assert.ok(!/https?:|\*/.test(CSP), 'no remote hosts until a module needs one');
});
