'use strict';

// The four looks, as far as the window frame is concerned: the colour shown before the page paints, and whether
// the Windows title bar should be dark. Mirrors colors.bg and colors.statusBar in src/theme.ts (statusBar
// 'light' means light text on a dark look); test/looks.test.js fails when the two drift apart.

const LOOKS = {
  lavender: { bg: '#5563C2', dark: true },
  stone: { bg: '#4F4E43', dark: true },
  paper: { bg: '#F1F1EC', dark: false },
  pine: { bg: '#071D19', dark: true },
};

/** The look a new install starts in (DEFAULT_SETTINGS in src/lib/store.tsx). */
const DEFAULT_LOOK = 'lavender';

/** Where the app saves its settings, look included (SETTINGS_KEY in src/lib/store.tsx). */
const SETTINGS_KEY = 'routine.settings.v1';

function isLook(name) {
  return typeof name === 'string' && Object.prototype.hasOwnProperty.call(LOOKS, name);
}

/** The look named in the saved settings JSON, or null when there is none or it can't be read. */
function lookFromSettings(raw) {
  if (typeof raw !== 'string' || raw === '') return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && isLook(parsed.theme) ? parsed.theme : null;
  } catch {
    return null;
  }
}

module.exports = { LOOKS, DEFAULT_LOOK, SETTINGS_KEY, isLook, lookFromSettings };
