'use strict';

// `Symphony OS.exe --smoke-test=<report.json>` proves a build works end to end, then quits: the app renders from
// app://symphony/, a deep route loads, files and byte ranges are served, the page has no Node access, nothing
// trips the Content-Security-Policy, the look reaches the title bar, and localStorage survives a restart (run it
// twice: the second report's storage.before is the first one's storage.now). It writes a screenshot next to the
// report. main.js points the data folder at a throwaway place first, so real saved data is never touched.

const fs = require('node:fs');
const path = require('node:path');
const { app, nativeTheme, session } = require('electron');

const MARKER = 'symphony.desktop.smoke';
const SETTINGS_KEY = 'routine.settings.v1';
const TIMEOUT_MS = 120000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function loaded(wc) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      wc.off('did-finish-load', ok);
      wc.off('did-fail-load', fail);
    };
    const ok = () => {
      cleanup();
      resolve();
    };
    const fail = (_e, code, description, url, isMainFrame) => {
      if (!isMainFrame) return;
      cleanup();
      reject(new Error(`load failed: ${code} ${description} ${url}`));
    };
    wc.on('did-finish-load', ok);
    wc.on('did-fail-load', fail);
  });
}

async function waitFor(wc, expression, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await wc.executeJavaScript(expression).catch(() => false)) return true;
    await delay(250);
  }
  return false;
}

const RENDERED = `(() => { const r = document.getElementById('root'); return !!r && r.children.length > 0 && document.body.innerText.trim().length > 0; })()`;

function findFile(dir, test) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const hit = findFile(full, test);
      if (hit) return hit;
    } else if (test(entry.name)) {
      return full;
    }
  }
  return null;
}

async function run({ win, reportFile, webRoot, origin }) {
  const wc = win.webContents;
  const report = {
    ok: false,
    when: new Date().toISOString(),
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    platform: `${process.platform}-${process.arch}`,
    packaged: app.isPackaged,
    checks: {},
    problems: [],
    console: [],
  };
  const check = (name, pass, detail) => {
    report.checks[name] = { pass: !!pass, ...(detail === undefined ? {} : { detail }) };
    if (!pass) report.problems.push(name);
  };

  wc.on('console-message', (event) => {
    if (event.level !== 'error' && event.level !== 'warning') return;
    report.console.push({ level: event.level, message: String(event.message).slice(0, 500), source: event.sourceId });
  });

  let finished = false;
  const finish = async (fatal) => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    if (fatal) report.problems.push(`fatal: ${fatal}`);
    const csp = report.console.filter((m) => /Content Security Policy|Refused to (load|execute|apply|connect|evaluate)/i.test(m.message));
    check('noContentSecurityPolicyViolations', csp.length === 0, csp.slice(0, 5));
    report.ok = report.problems.length === 0;
    fs.mkdirSync(path.dirname(reportFile), { recursive: true });
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    session.defaultSession.flushStorageData();
    await delay(1500);
    app.exit(report.ok ? 0 : 1);
  };
  const timer = setTimeout(() => finish(`timed out after ${TIMEOUT_MS / 1000}s`), TIMEOUT_MS);

  try {
    await loaded(wc);
    check('homeRendered', await waitFor(wc, RENDERED, 45000));
    await delay(2500);

    const page = await wc.executeJavaScript(`(() => ({
      href: location.href,
      title: document.title,
      size: [innerWidth, innerHeight],
      text: document.body.innerText.replace(/\\s+/g, ' ').trim().slice(0, 240),
      // The web bundle defines its own small process.env, so look for the real Node runtime instead.
      nodeInPage: typeof require === 'function' || !!(globalThis.process && globalThis.process.versions && globalThis.process.versions.node),
      bridge: typeof window.symphonyDesktop === 'object' ? window.symphonyDesktop.platform : null,
    }))()`);
    report.page = page;
    check('servedFromAppOrigin', page.href === `${origin}/`, page.href);
    check('noNodeInPage', !page.nodeInPage);
    check('desktopBridge', page.bridge === process.platform, page.bridge);

    const shot = reportFile.replace(/\.json$/i, '') + '-home.png';
    fs.writeFileSync(shot, (await wc.capturePage()).toPNG());
    report.screenshots = [shot];

    report.storage = await wc.executeJavaScript(`(() => {
      const before = localStorage.getItem('${MARKER}');
      const now = new Date().toISOString();
      localStorage.setItem('${MARKER}', now);
      return { before, now, readBack: localStorage.getItem('${MARKER}') === now };
    })()`);
    check('localStorageWrites', report.storage.readBack);

    const audio = findFile(webRoot, (n) => /\.(wav|mp3|m4a|ogg)$/i.test(n));
    const audioPath = audio ? '/' + path.relative(webRoot, audio).split(path.sep).map(encodeURIComponent).join('/') : null;
    const served = await wc.executeJavaScript(`(async () => {
      const route = await fetch('/library');
      const routeText = await route.text();
      const missing = await fetch('/assets/does-not-exist.png');
      const out = {
        route: { status: route.status, type: route.headers.get('content-type'), csp: !!route.headers.get('content-security-policy'), isIndex: routeText.includes('id="root"') },
        missing: missing.status,
      };
      const audioPath = ${JSON.stringify(audioPath)};
      if (audioPath) {
        const r = await fetch(audioPath, { headers: { Range: 'bytes=0-99' } });
        out.range = { status: r.status, contentRange: r.headers.get('content-range'), bytes: (await r.arrayBuffer()).byteLength, type: r.headers.get('content-type') };
      }
      return out;
    })()`);
    report.served = served;
    check('deepRouteServesIndex', served.route.status === 200 && served.route.isIndex && served.route.csp, served.route);
    check('missingFileIs404', served.missing === 404, served.missing);
    if (audioPath) check('audioByteRanges', served.range.status === 206 && served.range.bytes === 100, served.range);

    // The look reaches the frame: through the saved settings (no page code involved), then through the bridge.
    const original = await wc.executeJavaScript(`localStorage.getItem('${SETTINGS_KEY}')`);
    const startLook = nativeTheme.themeSource;
    await wc.executeJavaScript(`(() => {
      const s = JSON.parse(localStorage.getItem('${SETTINGS_KEY}') || '{}');
      s.theme = 'paper';
      localStorage.setItem('${SETTINGS_KEY}', JSON.stringify(s));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }));
    })()`);
    await delay(900);
    const afterPaper = nativeTheme.themeSource;
    await wc.executeJavaScript(`window.symphonyDesktop.setLook('pine')`);
    await delay(400);
    const afterPine = nativeTheme.themeSource;
    await wc.executeJavaScript(`(() => {
      const original = ${JSON.stringify(original)};
      if (original === null) localStorage.removeItem('${SETTINGS_KEY}');
      else localStorage.setItem('${SETTINGS_KEY}', original);
    })()`);
    report.look = { startLook, afterPaper, afterPine };
    check('lookFollowsSavedSettings', afterPaper === 'light', afterPaper);
    check('lookFollowsBridge', afterPine === 'dark', afterPine);

    const navigated = loaded(wc);
    wc.loadURL(`${origin}/library`).catch(() => {});
    await navigated;
    check('deepRouteRendered', await waitFor(wc, RENDERED, 30000));
    await delay(2000);
    report.deep = await wc.executeJavaScript(
      `({ path: location.pathname, text: document.body.innerText.replace(/\\s+/g, ' ').trim().slice(0, 240) })`,
    );
    check('deepRouteKeepsPath', report.deep.path === '/library', report.deep.path);
    const deepShot = reportFile.replace(/\.json$/i, '') + '-library.png';
    fs.writeFileSync(deepShot, (await wc.capturePage()).toPNG());
    report.screenshots.push(deepShot);

    await finish();
  } catch (err) {
    await finish(err && err.stack ? err.stack : String(err));
  }
}

module.exports = { run };
