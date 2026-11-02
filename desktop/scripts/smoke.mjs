// Starts the app twice with --smoke-test (see src/smoke.js), checks both reports, and checks that localStorage
// written by the first launch was there for the second.
//
//   node scripts/smoke.mjs                                   the development app (electron .)
//   node scripts/smoke.mjs "release/win-unpacked/Symphony OS.exe"
//   node scripts/smoke.mjs <executable> -- --no-sandbox      extra switches for the app (Linux as root needs this)
//
// Reports and screenshots land in release/smoke/.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(desktop, 'release', 'smoke');

const args = process.argv.slice(2);
const dashes = args.indexOf('--');
const extra = dashes >= 0 ? args.slice(dashes + 1) : [];
const target = (dashes >= 0 ? args.slice(0, dashes) : args)[0];

let command;
let base;
if (target) {
  command = path.resolve(target);
  base = [];
} else {
  command = createRequire(import.meta.url)('electron');
  base = [desktop];
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const reports = [];
for (const run of [1, 2]) {
  const reportFile = path.join(outDir, `run${run}.json`);
  console.log(`smoke: launch ${run} of 2`);
  const result = spawnSync(command, [...base, ...extra, `--smoke-test=${reportFile}`], {
    cwd: desktop,
    stdio: ['ignore', 'ignore', 'pipe'],
    timeout: 180000,
    windowsHide: false,
  });
  if (!fs.existsSync(reportFile)) {
    console.error(String(result.stderr || '').slice(-4000));
    console.error(`smoke: launch ${run} wrote no report (exit ${result.status}, ${result.error ? result.error.message : 'no error'})`);
    process.exit(1);
  }
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  reports.push(report);
  for (const [name, c] of Object.entries(report.checks)) console.log(`  ${c.pass ? 'pass' : 'FAIL'}  ${name}`);
  if (!report.ok) {
    console.error(`smoke: launch ${run} failed: ${report.problems.join(', ')}`);
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
}

const [first, second] = reports;
if (second.storage.before !== first.storage.now) {
  console.error(`smoke: localStorage did not survive a restart (wrote ${first.storage.now}, found ${second.storage.before})`);
  process.exit(1);
}
console.log('  pass  localStorageSurvivesRestart');
console.log(
  `smoke: all good (Electron ${second.electron}, ${second.platform}, app ${second.version}). Screenshots in ${path.relative(desktop, outDir)}`,
);
