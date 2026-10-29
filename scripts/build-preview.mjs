// Builds a single self-contained HTML file of the web version, for sharing a quick preview.
// Usage: node scripts/build-preview.mjs <expo web export dir> <output.html>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [dir, out] = process.argv.slice(2);
let html = readFileSync(join(dir, 'index.html'), 'utf8');

const scripts = [...html.matchAll(/<script src="([^"]+)" defer><\/script>/g)];
let inlined = '';
for (const [tag, src] of scripts) {
  html = html.replace(tag, '');
  let js = readFileSync(join(dir, src), 'utf8');
  // Inline the one icon font the app uses.
  js = js.replace(/"\/(assets\/[^"]*Ionicons\.[a-f0-9]+\.ttf)"/g, (_, p) => {
    const b64 = readFileSync(join(dir, p)).toString('base64');
    return `"data:font/ttf;base64,${b64}"`;
  });
  inlined += `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`;
}

// The router reads the URL path; start every preview on the Today screen.
const boot = `<script>try{history.replaceState(null,'','/')}catch(e){}</script>`;
html = html.replace('<link rel="icon" href="/favicon.ico"/>', '');
html = html.replace('</body>', () => `${boot}${inlined}</body>`);
writeFileSync(out, html);
console.log(`Wrote ${out} (${(html.length / 1024 / 1024).toFixed(1)} MB)`);

// Optional second output: the same page as a body fragment for hosts that supply their own <html>/<head>.
const fragmentOut = process.argv[4];
if (fragmentOut) {
  const style = html.match(/<style id="expo-reset">[\s\S]*?<\/style>/)[0].replace('</style>', 'body{background:#F6F7F5}</style>');
  const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
  writeFileSync(fragmentOut, `<title>Routine</title>\n${style}\n${body}`);
  console.log(`Wrote ${fragmentOut}`);
}
