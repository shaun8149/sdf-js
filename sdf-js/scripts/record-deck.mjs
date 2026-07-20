#!/usr/bin/env node
// =============================================================================
// record-deck.mjs — play a deck in headless Chrome and capture BOTH:
//   • gate stills every N seconds (the recording-gate audit frames)
//   • a full-run MP4 via CDP screencast + ffmpeg-static (raw stun footage)
// CDP screencast captures the COMPOSITED page — WebGL canvas AND the DOM
// subtitle system together (canvas.captureStream alone would drop every word).
//
// Usage:
//   node sdf-js/scripts/record-deck.mjs --deck bytedance-bp-2015-auto \
//     --out <dir> [--layout theater] [--seconds 372] [--fps 18] [--width 1920]
// =============================================================================
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const REPO = fileURLToPath(new URL('../..', import.meta.url));
const arg = (f, d = null) => {
  const i = process.argv.indexOf(f);
  return i > 0 ? process.argv[i + 1] : d;
};
const DECK = arg('--deck');
const OUT = arg('--out');
const LAYOUT = arg('--layout', 'theater');
const SECONDS = parseFloat(arg('--seconds', '372'));
const FPS = parseInt(arg('--fps', '18'), 10);
const WIDTH = parseInt(arg('--width', '1920'), 10);
const HEIGHT = Math.round((WIDTH * 9) / 16);
const STILL_EVERY = parseFloat(arg('--still-every', '10'));
if (!DECK || !OUT) {
  console.error('✗ required: --deck <name> --out <dir>');
  process.exit(1);
}
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => existsSync(p));
if (!CHROME) {
  console.error('✗ no Chrome executable found');
  process.exit(1);
}

const loadFfmpeg = async () => {
  try {
    const ffmpegPath = (await import('ffmpeg-static')).default;
    if (!ffmpegPath) throw new Error('ffmpeg-static did not return a binary path');
    return ffmpegPath;
  } catch (e) {
    console.error('✗ ffmpeg-static is required before capture starts');
    console.error(`  ${e && e.message ? e.message : String(e)}`);
    console.error('  Run: npm install');
    process.exit(1);
  }
};
const ffmpeg = await loadFfmpeg();

const FRAMES = resolve(OUT, 'frames');
const STILLS = resolve(OUT, 'gate');
mkdirSync(FRAMES, { recursive: true });
mkdirSync(STILLS, { recursive: true });

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.glb': 'model/gltf-binary',
};
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
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
let rejectReady = null;
const pageReadyFailed = new Promise((_, reject) => {
  rejectReady = reject;
});
page.on('pageerror', (e) => {
  console.error('  [page]', String(e).slice(0, 160));
  if (rejectReady) rejectReady(e);
});

const url = `http://127.0.0.1:${PORT}/sdf-js/apps/present/figure.html?deck=${DECK}&layout=${LAYOUT}&fps=0`;
console.log(`▶ ${url}`);
console.log(`  ${SECONDS}s @ ~${FPS}fps screencast + stills every ${STILL_EVERY}s → ${OUT}`);

await page.goto(url, { waitUntil: 'domcontentloaded' });
// The deck HOLDS its clock during shader warm-up (holdDuringWarmup) and the
// boot overlay gets .done on the first real frame — capture must not start
// until then, or the film opens on minutes of "warming shaders n/122".
console.log('  waiting for shader warm-up…');
await Promise.race([page.waitForSelector('#loading.done', { timeout: 600000 }), pageReadyFailed]);
await page.evaluate(() => {
  window.__figStudio?.setSequenceTime?.(0);
});
await page.waitForTimeout(100);
console.log('  warm-up complete, capture begins');

const cdp = await page.context().newCDPSession(page);
let n = 0;
let captureStart = 0;
cdp.on('Page.screencastFrame', async ({ data, sessionId }) => {
  if (!captureStart) captureStart = Date.now();
  writeFileSync(
    resolve(FRAMES, `f-${String(n++).padStart(6, '0')}.jpg`),
    Buffer.from(data, 'base64'),
  );
  try {
    await cdp.send('Page.screencastFrameAck', { sessionId });
  } catch {
    /* teardown race */
  }
});
await cdp.send('Page.startScreencast', {
  format: 'jpeg',
  quality: 82,
  maxWidth: WIDTH,
  maxHeight: HEIGHT,
});

const t0 = Date.now();
let still = 0;
while ((Date.now() - t0) / 1000 < SECONDS) {
  const t = (Date.now() - t0) / 1000;
  const nextStill = still * STILL_EVERY;
  if (t >= nextStill) {
    await page.screenshot({
      path: resolve(STILLS, `t${String(Math.round(nextStill)).padStart(3, '0')}.jpg`),
      type: 'jpeg',
      quality: 85,
    });
    still++;
    process.stdout.write(`  still t=${Math.round(nextStill)}s (${n} frames)\r`);
  }
  await new Promise((r) => setTimeout(r, 250));
}
await cdp.send('Page.stopScreencast').catch(() => {});
await page.waitForTimeout(400);
const captureSecs = (Date.now() - captureStart) / 1000;
await browser.close();
server.close();
console.log(`\n✓ ${n} frames over ${captureSecs.toFixed(1)}s, ${still} stills`);

// assemble mp4 at the REAL capture rate (frames ÷ elapsed) so playback runs
// at true speed — CDP delivers at compositor rate and ignores ack pacing
const realFps = (n / Math.max(captureSecs, 1)).toFixed(3);
const mp4 = resolve(OUT, `${DECK}-${LAYOUT}.mp4`);
const r = spawnSync(
  ffmpeg,
  [
    '-y',
    '-framerate',
    String(realFps),
    '-i',
    resolve(FRAMES, 'f-%06d.jpg'),
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '20',
    '-movflags',
    '+faststart',
    mp4,
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
);
if (r.status === 0) {
  const frames = readdirSync(FRAMES).length;
  console.log(`✓ ${mp4} (${frames} frames @ ${realFps}fps ≈ ${captureSecs.toFixed(0)}s real-time)`);
} else {
  console.error(`✗ ffmpeg failed: ${String(r.stderr).slice(-400)}`);
  process.exit(1);
}
