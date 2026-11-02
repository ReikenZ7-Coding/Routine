'use strict';

// Runs src/main.js under plain Node with a stand-in for the electron module, and checks the promises the window
// makes: an isolated, sandboxed page with no Node access, the app:// scheme, links handed to the system, the
// permissions it refuses, and the look reaching the title bar. The real thing runs in `--smoke-test` (smoke.js).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { test, before, after } = require('node:test');

const calls = { opened: [], schemes: null, handled: [], windows: [], ipc: {}, appEvents: {}, contentsCreated: null, exits: [] };
const nativeTheme = { themeSource: 'system' };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'symphony-main-'));

class FakeEmitter {
  constructor() {
    this.handlers = {};
  }
  on(name, fn) {
    (this.handlers[name] = this.handlers[name] || []).push(fn);
    return this;
  }
  once(name, fn) {
    return this.on(name, fn);
  }
  off() {
    return this;
  }
  emit(name, ...args) {
    for (const fn of this.handlers[name] || []) fn(...args);
  }
}

class FakeWebContents extends FakeEmitter {
  constructor() {
    super();
    this.zoom = 0;
  }
  setWindowOpenHandler(fn) {
    this.openHandler = fn;
  }
  getZoomLevel() {
    return this.zoom;
  }
  setZoomLevel(z) {
    this.zoom = z;
  }
}

class FakeBrowserWindow extends FakeEmitter {
  constructor(options) {
    super();
    this.options = options;
    this.webContents = new FakeWebContents();
    this.background = options.backgroundColor;
    calls.windows.push(this);
    calls.contentsCreated && calls.contentsCreated({}, this.webContents);
  }
  loadURL(url) {
    this.loaded = url;
    return Promise.resolve();
  }
  setBackgroundColor(c) {
    this.background = c;
  }
  isDestroyed() {
    return false;
  }
  isMinimized() {
    return false;
  }
  isFullScreen() {
    return false;
  }
  isMaximized() {
    return false;
  }
  maximize() {
    this.maximized = true;
  }
  show() {
    this.shownCount = (this.shownCount || 0) + 1;
  }
  getNormalBounds() {
    return { x: 10, y: 20, width: 1300, height: 800 };
  }
}

const session = {
  defaultSession: {
    flushStorageData() {},
    setPermissionRequestHandler(fn) {
      this.request = fn;
    },
    setPermissionCheckHandler(fn) {
      this.check = fn;
    },
  },
};

const fakeElectron = {
  app: {
    isPackaged: false,
    setName() {},
    setAppUserModelId(id) {
      calls.appUserModelId = id;
    },
    paths: {},
    getPath(name) {
      return this.paths[name] || path.join(tmp, name);
    },
    setPath(name, value) {
      this.paths[name] = value;
      if (name === 'userData') calls.userData = value;
    },
    requestSingleInstanceLock() {
      calls.lock = true;
      return true;
    },
    on(name, fn) {
      calls.appEvents[name] = fn;
      if (name === 'web-contents-created') calls.contentsCreated = fn;
    },
    whenReady: () => Promise.resolve(),
    quit() {},
    exit(code) {
      calls.exits.push(code);
    },
    getVersion: () => '1.0.0',
  },
  BrowserWindow: FakeBrowserWindow,
  Menu: {
    setApplicationMenu(m) {
      calls.menu = m;
    },
  },
  ipcMain: {
    on(channel, fn) {
      calls.ipc[channel] = fn;
    },
  },
  nativeTheme,
  protocol: {
    registerSchemesAsPrivileged(schemes) {
      calls.schemes = schemes;
    },
    handle(scheme, fn) {
      calls.handled.push({ scheme, fn });
    },
  },
  screen: {
    getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }),
    getAllDisplays: () => [{ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }],
  },
  session,
  shell: {
    openExternal(url) {
      calls.opened.push(url);
      return url.startsWith('spotify:') ? Promise.reject(new Error('no app')) : Promise.resolve();
    },
  },
  dialog: {
    showErrorBox(title, message) {
      calls.errorBox = message;
    },
  },
  clipboard: { writeText() {} },
};

const mainPath = path.join(__dirname, '..', 'src', 'main.js');
const webIndex = path.join(__dirname, '..', '..', 'dist', 'index.html');
let originalLoad;
let originalExists;
let win;

before(async () => {
  originalLoad = Module._load;
  Module._load = function load(request, ...rest) {
    return request === 'electron' ? fakeElectron : originalLoad.call(this, request, ...rest);
  };
  originalExists = fs.existsSync;
  fs.existsSync = (p) => (p === webIndex ? true : originalExists(p));
  require(mainPath);
  await new Promise((resolve) => setImmediate(resolve));
  win = calls.windows[0];
});

after(() => {
  Module._load = originalLoad;
  fs.existsSync = originalExists;
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('one window, loading the app from app://symphony/', () => {
  assert.equal(calls.windows.length, 1);
  assert.equal(win.loaded, 'app://symphony/');
  assert.ok(calls.lock, 'single-instance lock requested');
  assert.equal(calls.menu, null, 'no menu bar');
  assert.equal(calls.exits.length, 0);
});

test('the window shows once the page has painted, and only once', () => {
  assert.equal(win.shownCount, undefined);
  win.emit('ready-to-show');
  win.emit('ready-to-show');
  assert.equal(win.shownCount, 1);
});

test('the page is isolated, sandboxed and has no Node', () => {
  const wp = win.options.webPreferences;
  assert.equal(wp.contextIsolation, true);
  assert.equal(wp.nodeIntegration, false);
  assert.equal(wp.sandbox, true);
  assert.equal(wp.webviewTag, false);
  assert.ok(fs.existsSync(wp.preload), 'preload file exists');
});

test('the window has the desktop minimum size and opens hidden until painted', () => {
  assert.equal(win.options.minWidth, 1024);
  assert.equal(win.options.minHeight, 700);
  assert.equal(win.options.show, false);
  assert.equal(win.options.width, 1440);
  assert.equal(win.options.title, 'Symphony OS');
});

test('the app:// scheme is standard and secure, so localStorage persists', () => {
  assert.equal(calls.schemes.length, 1);
  const [{ scheme, privileges }] = calls.schemes;
  assert.equal(scheme, 'app');
  assert.equal(privileges.standard, true);
  assert.equal(privileges.secure, true);
  assert.ok(!privileges.bypassCSP);
  assert.deepEqual(
    calls.handled.map((h) => h.scheme),
    ['app'],
  );
});

test('data lives in a fixed "Symphony OS" folder', () => {
  assert.equal(calls.userData, path.join(tmp, 'appData', 'Symphony OS'));
});

test('new windows are refused and their links go to the system', async () => {
  const wc = win.webContents;
  assert.deepEqual(wc.openHandler({ url: 'https://open.spotify.com/playlist/x' }), { action: 'deny' });
  assert.deepEqual(wc.openHandler({ url: 'file:///C:/Windows/System32/calc.exe' }), { action: 'deny' });
  assert.deepEqual(wc.openHandler({ url: 'spotify:playlist:abc' }), { action: 'deny' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls.opened, ['https://open.spotify.com/playlist/x', 'spotify:playlist:abc', 'https://open.spotify.com/playlist/abc']);
});

test('navigation away from the app is stopped', () => {
  const wc = win.webContents;
  const nav = (url) => {
    let prevented = false;
    wc.emit('will-frame-navigate', { url, preventDefault: () => (prevented = true) });
    return prevented;
  };
  assert.equal(nav('app://symphony/library'), false);
  assert.equal(nav('https://example.com/'), true);
  assert.equal(nav('file:///etc/passwd'), true);
  let attached = false;
  wc.emit('will-attach-webview', { preventDefault: () => (attached = true) });
  assert.ok(attached, 'webviews are blocked');
});

test('permissions: clipboard writes and full screen yes; camera, microphone and location no', () => {
  const ses = session.defaultSession;
  const ask = (permission, requestingUrl = 'app://symphony/') =>
    new Promise((resolve) => ses.request(null, permission, resolve, { requestingUrl }));
  return Promise.all([
    ask('clipboard-sanitized-write').then((v) => assert.equal(v, true)),
    ask('fullscreen').then((v) => assert.equal(v, true)),
    ask('media').then((v) => assert.equal(v, false)),
    ask('geolocation').then((v) => assert.equal(v, false)),
    ask('clipboard-read').then((v) => assert.equal(v, false)),
    ask('clipboard-sanitized-write', 'https://example.com/').then((v) => assert.equal(v, false)),
  ]).then(() => {
    assert.equal(ses.check(null, 'media', 'app://symphony'), false);
    assert.equal(ses.check(null, 'fullscreen', 'app://symphony'), true);
  });
});

test('the look sets the title bar and the window colour, from the app only', () => {
  const send = (name, url = 'app://symphony/') => calls.ipc['symphony:look']({ senderFrame: { url } }, name);
  send('paper');
  assert.equal(nativeTheme.themeSource, 'light');
  assert.equal(win.background, '#F1F1EC');
  send('pine');
  assert.equal(nativeTheme.themeSource, 'dark');
  assert.equal(win.background, '#071D19');
  send('paper', 'https://example.com/');
  assert.equal(nativeTheme.themeSource, 'dark', 'ignored from another origin');
  send('neon');
  assert.equal(nativeTheme.themeSource, 'dark', 'unknown looks are ignored');
  const saved = JSON.parse(fs.readFileSync(path.join(calls.userData, 'window-state.json'), 'utf8'));
  assert.equal(saved.look, 'pine');
});

test('zoom shortcuts step and reset, other keys reach the page', () => {
  const wc = win.webContents;
  const press = (key, mods = {}) => {
    let prevented = false;
    wc.emit(
      'before-input-event',
      { preventDefault: () => (prevented = true) },
      { type: 'keyDown', key, control: false, meta: false, shift: false, alt: false, ...mods },
    );
    return prevented;
  };
  assert.equal(press('=', { control: true }), true);
  assert.equal(wc.zoom, 0.5);
  assert.equal(press('-', { control: true }), true);
  assert.equal(press('-', { control: true }), true);
  assert.equal(wc.zoom, -0.5);
  assert.equal(press('0', { control: true }), true);
  assert.equal(wc.zoom, 0);
  assert.equal(press('k', { control: true }), false, 'Ctrl+K belongs to the app');
  assert.equal(press('a'), false);
});

test('closing remembers where the window was', () => {
  win.emit('close');
  const saved = JSON.parse(fs.readFileSync(path.join(calls.userData, 'window-state.json'), 'utf8'));
  assert.deepEqual(saved.bounds, { x: 10, y: 20, width: 1300, height: 800 });
  assert.equal(saved.maximized, false);
});
