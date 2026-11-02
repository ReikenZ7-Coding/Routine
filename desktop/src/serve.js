'use strict';

// Serves the Expo web export (the repo's dist/, packaged into the app as web/) on app://symphony/.
//
// Plain Node only (fs, path, stream and the global Response), so the tests run it without Electron. Inside the
// packaged app the folder sits in app.asar, which Electron's fs reads transparently.

const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');

// The page may only run its own bundle. Inline styles stay allowed because react-native-web writes its styles
// at runtime. New modules that reach the network (maps, the assistant) widen connect-src and img-src here, one
// named host at a time.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' data: blob:",
  "connect-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

function mimeFor(file) {
  return MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function plain(status, text) {
  return new Response(text, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' } });
}

/**
 * Maps a URL path onto a file inside root. Returns null for anything that would leave root (an encoded "..", a
 * backslash, a drive letter or a Windows stream name) or can't be decoded.
 */
function resolveInside(root, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  const parts = decoded.split('/').filter((p) => p !== '' && p !== '.');
  if (parts.some((p) => p === '..' || p.includes(':'))) return null;
  const full = path.join(root, ...parts);
  const rel = path.relative(root, full);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return full;
}

async function fileStat(file) {
  try {
    const st = await fs.promises.stat(file);
    return st.isFile() ? st : null;
  } catch {
    return null;
  }
}

/** Parses a single "bytes=a-b" range. Returns null for no (or an unusable) range, false when it can't be met. */
function parseRange(header, size) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start;
  let end;
  if (m[1] === '') {
    const suffix = Number(m[2]);
    if (suffix === 0) return false;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) return false;
  return { start, end };
}

function streamBody(file, start, end) {
  return Readable.toWeb(fs.createReadStream(file, { start, end }));
}

/**
 * Builds the app:// request handler.
 *
 * - Files in the export are served as they are, with byte ranges for audio seeking.
 * - Any other path without a file extension is a page route (expo-router's /library, /gym, ...), so it gets
 *   index.html and the router takes it from there.
 * - A missing file with an extension is a real 404, never index.html served as an image or a script.
 */
function createHandler({ root, host }) {
  const indexFile = path.join(root, 'index.html');

  async function serveFile(request, file, st) {
    const isHtml = path.extname(file).toLowerCase() === '.html';
    const headers = {
      'Content-Type': mimeFor(file),
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': 'bytes',
    };
    if (isHtml) {
      headers['Content-Security-Policy'] = CSP;
      headers['Cache-Control'] = 'no-cache';
    }
    const head = request.method === 'HEAD';
    const range = isHtml ? null : parseRange(request.headers.get('range'), st.size);
    if (range === false) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${st.size}` } });
    }
    if (range) {
      headers['Content-Range'] = `bytes ${range.start}-${range.end}/${st.size}`;
      headers['Content-Length'] = String(range.end - range.start + 1);
      return new Response(head ? null : streamBody(file, range.start, range.end), { status: 206, headers });
    }
    headers['Content-Length'] = String(st.size);
    if (head || st.size === 0) return new Response(head ? null : '', { status: 200, headers });
    return new Response(streamBody(file, 0, st.size - 1), { status: 200, headers });
  }

  return async function handle(request) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return plain(405, 'Method not allowed');
    let url;
    try {
      url = new URL(request.url);
    } catch {
      return plain(400, 'Bad request');
    }
    if (url.host.toLowerCase() !== host) return plain(404, 'Not found');

    const file = resolveInside(root, url.pathname);
    if (!file) return plain(400, 'Bad request');

    const st = await fileStat(file);
    if (st) return serveFile(request, file, st);

    const last = url.pathname.split('/').pop() || '';
    if (path.extname(last) === '') {
      const indexStat = await fileStat(indexFile);
      if (indexStat) return serveFile(request, indexFile, indexStat);
    }
    return plain(404, 'Not found');
  };
}

module.exports = { CSP, createHandler, mimeFor, parseRange, resolveInside };
