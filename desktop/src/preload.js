'use strict';

// Runs before the page in its own isolated world, sandboxed: it can only reach the page's DOM and storage, and
// main over IPC. A sandboxed preload can't load the other files in src/, so it carries its two constants itself
// (test/config.test.js checks they match looks.js and main.js).

const { contextBridge, ipcRenderer } = require('electron');

const SETTINGS_KEY = 'routine.settings.v1';
const LOOK_CHANNEL = 'symphony:look';

let lastLook = null;

function sendLook(name) {
  if (typeof name !== 'string' || name === lastLook) return;
  lastLook = name;
  ipcRenderer.send(LOOK_CHANNEL, name);
}

/** Reads the look the app last saved (AsyncStorage on the web is localStorage under the same key). */
function readSavedLook() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return 'lavender';
    const theme = JSON.parse(raw).theme;
    return typeof theme === 'string' ? theme : 'lavender';
  } catch {
    return null;
  }
}

// The look only changes when someone picks one in Settings or restores a backup, so the saved settings are read
// again shortly after each click, key press or file choice, and when the window comes back to the front. The
// second read covers saves that land after an animation or a file read.
let timers = [];
function checkSoon() {
  for (const t of timers) clearTimeout(t);
  timers = [250, 1500].map((ms) => setTimeout(() => sendLook(readSavedLook()), ms));
}

window.addEventListener('DOMContentLoaded', () => sendLook(readSavedLook()));
for (const type of ['pointerup', 'keyup', 'change']) window.addEventListener(type, checkSoon, { capture: true, passive: true });
window.addEventListener('focus', checkSoon);

// A small, fixed surface for the page: which platform it runs on, and a direct way to report a look change.
contextBridge.exposeInMainWorld(
  'symphonyDesktop',
  Object.freeze({
    platform: process.platform,
    // The page said which look it chose, so the reads still pending (of settings it may not have saved yet)
    // would only put the old look back.
    setLook: (name) => {
      for (const t of timers) clearTimeout(t);
      timers = [];
      sendLook(name);
    },
  }),
);
