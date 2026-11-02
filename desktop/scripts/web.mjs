// Checks the Expo web export in the repo's dist/ is ready to be the Windows app: it exists, every script it loads
// is there, and it has no inline script (the app's Content-Security-Policy only runs the bundle's own files).
// electron-builder copies dist/ into the app as web/ at build time; `npm start` serves it straight from dist/.
//
//   node scripts/web.mjs            check dist/
//   node scripts/web.mjs --export   run `npx expo export --platform web` in the repo first, then check

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(desktop, '..');
const dist = path.join(repo, 'dist');

function fail(message) {
  console.error(`web: ${message}`);
  process.exit(1);
}

if (process.argv.includes('--export')) {
  const result = spawnSync('npx', ['expo', 'export', '--platform', 'web'], {
    cwd: repo,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) fail('the web export failed.');
}

const index = path.join(dist, 'index.html');
if (!fs.existsSync(index)) fail('no web export in dist/. Run "npx expo export --platform web" in the repo first (or npm run web:export).');
const html = fs.readFileSync(index, 'utf8');
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
if (scripts.length === 0) fail('dist/index.html loads no script; is this an Expo web export?');
for (const src of scripts) {
  if (!src.startsWith('/')) fail(`expected root-relative script paths, found ${src}.`);
  if (!fs.existsSync(path.join(dist, ...src.split('/')))) fail(`dist/index.html loads ${src}, which is missing from the export.`);
}
if (/<script(?![^>]*\bsrc=)[^>]*>\s*\S/.test(html)) {
  fail("dist/index.html has an inline script, which the app's Content-Security-Policy blocks (script-src 'self').");
}

let files = 0;
let bytes = 0;
(function count(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) count(full);
    else {
      files += 1;
      bytes += fs.statSync(full).size;
    }
  }
})(dist);
console.log(`web: dist/ is ready (${files} files, ${(bytes / 1048576).toFixed(1)} MB)`);
