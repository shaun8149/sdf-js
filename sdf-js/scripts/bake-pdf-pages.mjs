#!/usr/bin/env node
// =============================================================================
// bake-pdf-pages.mjs — render a fixture PDF's pages to PNGs (vision fodder)
// -----------------------------------------------------------------------------
// The slides→IR extractor's vision mode needs page images; node has no canvas,
// so we render in headless Chrome via pdfjs (same pattern as batch-decks.mjs:
// embedded static server + playwright-core driving the system browser).
//
// Usage:
//   node sdf-js/scripts/bake-pdf-pages.mjs --pdf sdf-js/fixtures/Bytedance_BP_2015.pdf \
//        --out sdf-js/fixtures/pages/bp2015 [--width 1024]
// Output: <out>/page-01.png … page-NN.png (1-based, zero-padded)
// Idempotent: existing files are kept; --force re-renders.
// =============================================================================

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const REPO = fileURLToPath(new URL('../..', import.meta.url));
const arg = (flag, dflt = null) => {
  const i = process.argv.indexOf(flag);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const PDF = arg('--pdf');
const OUT = arg('--out');
const WIDTH = parseInt(arg('--width', '1568'), 10); // Claude vision long-edge budget ≈1568px — 1024 wastes it and thin chart connectors vanish (p9 milestone mispair root cause)
const FORCE = process.argv.includes('--force');
if (!PDF || !OUT) {
  console.error('✗ required: --pdf <path> --out <dir>');
  process.exit(1);
}
mkdirSync(resolve(REPO, OUT), { recursive: true });

// Chrome executable per platform (batch-decks.mjs hardcoded the macOS path —
// this one actually looks).
const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
];
const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) {
  console.error('✗ no Chrome executable found');
  process.exit(1);
}

const MIME = { '.html': 'text/html', '.pdf': 'application/pdf', '.mjs': 'text/javascript' };
const server = createServer((req, res) => {
  try {
    const file = resolve(REPO, decodeURIComponent(req.url.split('?')[0]).slice(1));
    if (!file.startsWith(resolve(REPO))) throw new Error('path escape');
    res.setHeader('Content-Type', MIME[extname(file)] || 'application/octet-stream');
    res.end(readFileSync(file));
  } catch {
    res.statusCode = 404;
    res.end('404');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: WIDTH + 40, height: 1400 } });
page.on('pageerror', (e) => console.error('  [page]', String(e).slice(0, 120)));

// A blank host page; we drive pdfjs from the node side via evaluate.
await page.goto(`http://127.0.0.1:${PORT}/sdf-js/fixtures/pdf-render.html?file=__none__`, {
  waitUntil: 'domcontentloaded',
});

const pdfUrl = '/' + PDF.replaceAll('\\', '/');
const numPages = await page.evaluate(async (url) => {
  const pdfjs = await import('https://unpkg.com/pdfjs-dist@4.0.379/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc =
    'https://unpkg.com/pdfjs-dist@4.0.379/legacy/build/pdf.worker.mjs';
  window.__pdf = await pdfjs.getDocument(url).promise;
  return window.__pdf.numPages;
}, pdfUrl);
console.log(`${PDF}: ${numPages} pages → ${OUT} (width ${WIDTH})`);

for (let n = 1; n <= numPages; n++) {
  const outFile = resolve(REPO, OUT, `page-${String(n).padStart(2, '0')}.png`);
  if (existsSync(outFile) && !FORCE) {
    console.log(`  [${n}] exists, skip`);
    continue;
  }
  const dataUrl = await page.evaluate(
    async ({ n, cellW }) => {
      const pg = await window.__pdf.getPage(n);
      const base = pg.getViewport({ scale: 1 });
      const vp = pg.getViewport({ scale: cellW / base.width });
      const c = document.createElement('canvas');
      c.width = Math.round(vp.width);
      c.height = Math.round(vp.height);
      await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      return c.toDataURL('image/png');
    },
    { n, cellW: WIDTH },
  );
  writeFileSync(outFile, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(`  [${n}] ✓ ${outFile.split(/[\\/]/).pop()}`);
}

await browser.close();
server.close();
console.log('done.');
