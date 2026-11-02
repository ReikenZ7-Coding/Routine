# Symphony OS for Windows

The Windows app is the same code as the phone app: the Expo web export (`npx expo export --platform web`, the
repo's `dist/`) inside an Electron window. At 1024 wide and up the app draws its desktop layout; the phone keeps
its own. GitHub Actions builds an installer on every push (`.github/workflows/windows-desktop.yml`), installs it,
opens it twice to check it, and publishes it as a prerelease named "Symphony OS for Windows N".

## Build it yourself (on Windows)

```bash
npm ci                                  # in the repo root
npx expo export --platform web          # writes dist/
cd desktop
npm ci
npm start                               # opens the app, served straight from ../dist
npm test                                # the wrapper's own tests (no window needed)
npm run dist                            # release/Symphony-OS-Setup-<version>.exe, with dist/ copied in as web/
node scripts/smoke.mjs "release/win-unpacked/Symphony OS.exe"
```

`npm run web:export` runs the export and checks it in one go. Building the installer on Linux needs Wine (64- and
32-bit); the unpacked app (`npm run dist:dir`) does not.

## How it fits together

- `src/main.js` opens one window and serves the export on `app://symphony/` (`src/serve.js`). Unknown page paths
  such as `/library` get `index.html`, so expo-router's deep links work; a missing file is a 404.
- The page has no Node access: context isolation, no node integration, a sandboxed renderer and a strict
  Content-Security-Policy (`CSP` in `src/serve.js`). Web, mail and Spotify links open outside the window
  (`src/links.js`); everything else is dropped.
- Saved data is the page's localStorage, under `%APPDATA%\Symphony OS`. The scheme, host, data folder and app id
  in `src/config.js` must never change, or saved routines would look gone, the same rule as the Android package
  id and the `routine.*.v1` keys.
- The title bar is dark on the dark looks (Lavender, Stone, Pine) and light on Paper. `src/preload.js` notices
  when the saved look changes; the page can also call `window.symphonyDesktop.setLook(name)`.
- The window remembers its size, place, maximised state and zoom (Ctrl+=, Ctrl+-, Ctrl+0). F11 is full screen.
  Right-click gives cut, copy, paste and spelling suggestions.
- `--smoke-test=<report.json>` (`src/smoke.js`) proves a build works end to end and quits.

## Icon

`build/icon.ico` comes from `assets/icon.png`: `python3 -B desktop/scripts/make-icon.py`.
