'use strict';

// Which addresses stay inside the app window and which go to the system (the browser, Spotify, the mail app).

const { APP_HOST, APP_SCHEME } = require('./config');

/** Addresses the system may open. Everything else (file:, javascript:, data:, other apps' schemes) is dropped. */
const EXTERNAL_PROTOCOLS = new Set(['https:', 'http:', 'mailto:', 'spotify:']);

function parse(raw) {
  try {
    return new URL(String(raw));
  } catch {
    return null;
  }
}

/** True for the app's own pages and files (app://symphony/...). URL.origin is "null" for custom schemes. */
function isAppUrl(raw) {
  const url = parse(raw);
  return url !== null && url.protocol === `${APP_SCHEME}:` && url.host.toLowerCase() === APP_HOST;
}

/** The address to hand to the system, or null when it isn't one the app should open outside. */
function externalUrl(raw) {
  const url = parse(raw);
  if (!url || !EXTERNAL_PROTOCOLS.has(url.protocol)) return null;
  if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.hostname) return null;
  if (url.username || url.password) return null;
  return url.href;
}

/**
 * The web address for a spotify: link, for computers without the Spotify app (the same rule as webFallback in
 * src/lib/music.ts). Other links are already web links, so they have none.
 */
function webFallback(raw) {
  const m = /^spotify:([a-z]+):([A-Za-z0-9]+)/i.exec(String(raw).trim());
  return m ? `https://open.spotify.com/${m[1].toLowerCase()}/${m[2]}` : null;
}

module.exports = { EXTERNAL_PROTOCOLS, isAppUrl, externalUrl, webFallback };
