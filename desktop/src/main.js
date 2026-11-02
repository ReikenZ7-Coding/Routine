'use strict';

// Symphony OS for Windows: one window around the Expo web export.
//
// The export (the repo's dist/, packaged into the app as web/) is served on app://symphony/ by serve.js. A real
// origin keeps localStorage (where the app saves everything) between launches, and lets expo-router's deep paths
// such as /library load index.html. The page gets no Node access: context isolation, no node integration, a
// sandboxed renderer and a strict Content-Security-Policy. Links to the web and to other apps open outside the
// window.

const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, Menu, ipcMain, nativeTheme, protocol, screen, session, shell } = require('electron');

const { APP_HOST, APP_ID, APP_ORIGIN, APP_SCHEME, DATA_FOLDER, DEFAULT_SIZE, MIN_SIZE, PRODUCT_NAME } = require('./config');
const { createHandler } = require('./serve');
const { externalUrl, isAppUrl, webFallback } = require('./links');
const { DEFAULT_LOOK, LOOKS, isLook } = require('./looks');
const { loadState, minimumFor, placeWindow, saveState } = require('./windowState');

const LOOK_CHANNEL = 'symphony:look';
// The Expo web export: inside the installed app it is web/ (electron-builder copies the repo's dist/ there);
// while developing it is served straight from the repo's dist/.
const WEB_ROOT = app.isPackaged ? path.join(__dirname, '..', 'web') : path.join(__dirname, '..', '..', 'dist');

// `--smoke-test=<report.json>` loads the app, checks it, writes a report and quits (see smoke.js). It keeps its
// data in a throwaway folder so it never touches anyone's saved routines.
const smokeArg = process.argv.find((a) => a.startsWith('--smoke-test='));
const smokeReport = smokeArg ? path.resolve(smokeArg.slice('--smoke-test='.length)) : null;

app.setName(PRODUCT_NAME);
app.setPath('userData', smokeReport ? path.join(app.getPath('temp'), 'symphony-os-smoke') : path.join(app.getPath('appData'), DATA_FOLDER));
if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

// Must run before the app is ready. standard + secure give the scheme a real origin with localStorage and
// secure-context APIs; stream lets audio play while it loads; codeCache keeps start-up quick.
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true },
  },
]);

const stateFile = path.join(app.getPath('userData'), 'window-state.json');
const state = loadState(stateFile);
let mainWindow = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app.on('web-contents-created', (_event, contents) => guardContents(contents));
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', flushStorage);
  app.whenReady().then(start);
}

function start() {
  Menu.setApplicationMenu(null);
  protocol.handle(APP_SCHEME, createHandler({ root: WEB_ROOT, host: APP_HOST }));
  lockDownPermissions(session.defaultSession);
  ipcMain.on(LOOK_CHANNEL, (event, name) => {
    if (!event.senderFrame || !isAppUrl(event.senderFrame.url) || !isLook(name)) return;
    applyLook(name);
  });

  if (!fs.existsSync(path.join(WEB_ROOT, 'index.html'))) {
    const message = `The app files are missing from ${WEB_ROOT}. Run "npx expo export --platform web" in the repo, then start again.`;
    if (smokeReport) {
      fs.mkdirSync(path.dirname(smokeReport), { recursive: true });
      fs.writeFileSync(smokeReport, JSON.stringify({ ok: false, checks: {}, problems: [message] }, null, 2));
    } else {
      require('electron').dialog.showErrorBox(PRODUCT_NAME, message);
    }
    app.exit(1);
    return;
  }

  mainWindow = createWindow();
  if (smokeReport) require('./smoke').run({ win: mainWindow, reportFile: smokeReport, webRoot: WEB_ROOT, origin: APP_ORIGIN });
}

// ---------------------------------------------------------------------------------------------------------------
// The window

function createWindow() {
  const look = isLook(state.look) ? state.look : DEFAULT_LOOK;
  nativeTheme.themeSource = LOOKS[look].dark ? 'dark' : 'light';

  const primary = screen.getPrimaryDisplay().workArea;
  const workAreas = screen.getAllDisplays().map((d) => d.workArea);
  const bounds = placeWindow(state.bounds, workAreas, primary, { min: MIN_SIZE, preferred: DEFAULT_SIZE });
  const min = minimumFor(primary, MIN_SIZE);

  const win = new BrowserWindow({
    ...bounds,
    minWidth: min.width,
    minHeight: min.height,
    title: PRODUCT_NAME,
    show: false,
    backgroundColor: LOOKS[look].bg,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      navigateOnDragDrop: false,
      spellcheck: true,
      // The focus timer and focus sounds keep time while the window is minimised.
      backgroundThrottling: false,
    },
  });

  // Shown once the page has painted, so it never flashes white; the timer is a backstop for a page that can't.
  let shown = false;
  const reveal = () => {
    if (shown || win.isDestroyed()) return;
    shown = true;
    if (state.maximized) win.maximize();
    win.show();
  };
  win.once('ready-to-show', reveal);
  setTimeout(reveal, 6000).unref();

  // The page's <title> changes per route on the web; the window keeps the app's name.
  win.on('page-title-updated', (event) => event.preventDefault());

  win.webContents.on('dom-ready', () => {
    if (typeof state.zoom === 'number') win.webContents.setZoomLevel(state.zoom);
  });
  win.webContents.on('before-input-event', (event, input) => handleShortcut(win, event, input));
  win.webContents.on('context-menu', (_event, params) => showContextMenu(win, params));

  let lastReload = 0;
  win.webContents.on('render-process-gone', (_event, details) => {
    if (details.reason === 'clean-exit' || Date.now() - lastReload < 10000) return;
    lastReload = Date.now();
    win.reload();
  });

  let saveTimer = null;
  const rememberSoon = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => remember(win), 600);
  };
  win.on('resize', rememberSoon);
  win.on('move', rememberSoon);
  win.on('maximize', rememberSoon);
  win.on('unmaximize', rememberSoon);
  win.on('blur', flushStorage);
  win.on('close', () => {
    clearTimeout(saveTimer);
    remember(win);
    flushStorage();
  });
  win.on('session-end', () => {
    remember(win);
    flushStorage();
  });
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  win.loadURL(`${APP_ORIGIN}/`);
  return win;
}

function remember(win) {
  if (win.isDestroyed()) return;
  if (!win.isMinimized() && !win.isFullScreen()) {
    state.bounds = win.getNormalBounds();
    state.maximized = win.isMaximized();
  }
  state.zoom = win.webContents.getZoomLevel();
  saveState(stateFile, state);
}

/** Writes any localStorage changes to disk now, rather than when Chromium next gets round to it. */
function flushStorage() {
  try {
    session.defaultSession.flushStorageData();
  } catch {
    // Nothing to flush before the app is ready.
  }
}

/** Matches the frame to the look: a dark title bar and scrollbars on the dark looks, its colour behind the page. */
function applyLook(name) {
  const look = LOOKS[name];
  nativeTheme.themeSource = look.dark ? 'dark' : 'light';
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setBackgroundColor(look.bg);
  if (state.look !== name) {
    state.look = name;
    saveState(stateFile, state);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Keys and menus. There is no menu bar; the few desktop shortcuts are handled here, and every other key goes to
// the page (Ctrl+K and the app's own shortcuts included).

const ZOOM_STEPS = [-3, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 3];

function handleShortcut(win, event, input) {
  if (input.type !== 'keyDown') return;
  const ctrl = input.control || input.meta;
  const wc = win.webContents;
  const key = input.key;

  if (ctrl && !input.alt && (key === '=' || key === '+')) {
    event.preventDefault();
    stepZoom(win, 1);
  } else if (ctrl && !input.alt && key === '-') {
    event.preventDefault();
    stepZoom(win, -1);
  } else if (ctrl && !input.alt && key === '0') {
    event.preventDefault();
    wc.setZoomLevel(0);
    remember(win);
  } else if (key === 'F11' && !ctrl && !input.alt) {
    event.preventDefault();
    win.setFullScreen(!win.isFullScreen());
  } else if (!app.isPackaged && ctrl && input.shift && key.toLowerCase() === 'i') {
    event.preventDefault();
    wc.toggleDevTools();
  } else if (!app.isPackaged && ctrl && !input.shift && key.toLowerCase() === 'r') {
    event.preventDefault();
    wc.reload();
  }
}

function stepZoom(win, direction) {
  const wc = win.webContents;
  const current = wc.getZoomLevel();
  const next = direction > 0 ? ZOOM_STEPS.find((z) => z > current + 0.01) : [...ZOOM_STEPS].reverse().find((z) => z < current - 0.01);
  if (next === undefined) return;
  wc.setZoomLevel(next);
  remember(win);
}

/** Right-click: spelling suggestions and cut/copy/paste in text fields, copy on selected text, links. */
function showContextMenu(win, params) {
  const items = [];
  if (params.misspelledWord) {
    for (const word of params.dictionarySuggestions.slice(0, 4)) {
      items.push({ label: word, click: () => win.webContents.replaceMisspelling(word) });
    }
    items.push({
      label: 'Add to dictionary',
      click: () => win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
    });
    items.push({ type: 'separator' });
  }
  const link = params.linkURL ? externalUrl(params.linkURL) : null;
  if (link) {
    items.push({ label: 'Open link', click: () => openOutside(link) });
    items.push({ label: 'Copy link', click: () => require('electron').clipboard.writeText(link) });
    items.push({ type: 'separator' });
  }
  if (params.isEditable) {
    const f = params.editFlags;
    items.push(
      { role: 'undo', enabled: f.canUndo },
      { role: 'redo', enabled: f.canRedo },
      { type: 'separator' },
      { role: 'cut', enabled: f.canCut },
      { role: 'copy', enabled: f.canCopy },
      { role: 'paste', enabled: f.canPaste },
      { type: 'separator' },
      { role: 'selectAll', enabled: f.canSelectAll },
    );
  } else if (params.selectionText && params.selectionText.trim()) {
    items.push({ role: 'copy' });
  }
  while (items.length && items[items.length - 1].type === 'separator') items.pop();
  if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
}

// ---------------------------------------------------------------------------------------------------------------
// Security: what the page may open, load and ask for.

/** Hands a link to the system: the browser for web links, Spotify for spotify: links (or the web player). */
function openOutside(raw) {
  const url = externalUrl(raw);
  if (!url) return;
  shell.openExternal(url).catch(() => {
    const web = webFallback(url);
    if (web) shell.openExternal(web).catch(() => {});
  });
}

function guardContents(contents) {
  contents.on('will-attach-webview', (event) => event.preventDefault());
  contents.setWindowOpenHandler(({ url }) => {
    openOutside(url);
    return { action: 'deny' };
  });
  // will-frame-navigate covers the main frame and any subframe (will-navigate would see the main frame twice).
  const keepInside = (event) => {
    if (isAppUrl(event.url)) return;
    event.preventDefault();
    openOutside(event.url);
  };
  contents.on('will-frame-navigate', keepInside);
  contents.on('will-redirect', (event) => {
    if (!isAppUrl(event.url)) event.preventDefault();
  });
}

// Clipboard writes for copy buttons, full screen for media, notifications for reminders later. Everything else
// (camera, microphone, location, USB, ...) is refused until a module needs it and says why.
const ALLOWED_PERMISSIONS = new Set(['clipboard-sanitized-write', 'fullscreen', 'notifications']);

function lockDownPermissions(ses) {
  ses.setPermissionRequestHandler((_contents, permission, callback, details) => {
    callback(ALLOWED_PERMISSIONS.has(permission) && isAppUrl(details.requestingUrl));
  });
  ses.setPermissionCheckHandler((_contents, permission, requestingOrigin) => {
    return ALLOWED_PERMISSIONS.has(permission) && isAppUrl(`${requestingOrigin}/`);
  });
}
