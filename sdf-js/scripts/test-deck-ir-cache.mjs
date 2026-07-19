// gen-deck-ir cache invariants: cached slide IRs must be bound to the exact
// source deck and extraction mode, not just to the output deck name.
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildSlideCacheSource,
  cacheSourceMatches,
  readSlideCache,
} from '../src/mapping/deck-ir-cache.js';

let pass = 0;
let fail = 0;
const ok = (cond, msg) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.error(`  ✗ ${msg}`);
  }
};

console.log('=== deck-ir cache source binding ===\n');

const dir = mkdtempSync(join(tmpdir(), 'deck-ir-cache-'));
try {
  const sourceA = join(dir, 'a.slides.json');
  const sourceB = join(dir, 'b.slides.json');
  const cachePath = join(dir, 'out.slides-cache.json');
  writeFileSync(sourceA, JSON.stringify([{ title: 'A' }]));
  writeFileSync(sourceB, JSON.stringify([{ title: 'B' }]));

  const fpA1 = buildSlideCacheSource({ kind: 'slidedata', sourcePath: sourceA, slideCount: 1 });
  const fpA2 = buildSlideCacheSource({ kind: 'slidedata', sourcePath: sourceA, slideCount: 1 });
  const fpB = buildSlideCacheSource({ kind: 'slidedata', sourcePath: sourceB, slideCount: 1 });
  ok(cacheSourceMatches(fpA1, fpA2), 'same source file matches');
  ok(!cacheSourceMatches(fpA1, fpB), 'different source bytes invalidate the cache');

  writeFileSync(
    cachePath,
    JSON.stringify({ __source: fpA1, 0: { structure: 'hold', title: 'cached A', nodes: [] } }),
  );
  const reused = readSlideCache(cachePath, fpA2);
  ok(reused[0]?.title === 'cached A', 'matching cache entries are reused');

  let logLine = '';
  const changed = readSlideCache(cachePath, fpB, { log: (line) => (logLine = line) });
  ok(!changed[0] && changed.__source.sha256 === fpB.sha256, 'changed source starts a fresh cache');
  ok(/source changed/.test(logLine), 'changed source is logged');

  writeFileSync(cachePath, JSON.stringify({ 0: { structure: 'hold', title: 'legacy', nodes: [] } }));
  const legacy = readSlideCache(cachePath, fpA1);
  ok(!legacy[0], 'legacy caches without a source fingerprint are not reused');

  const imagesDir = join(dir, 'pages');
  mkdirSync(imagesDir);
  writeFileSync(join(imagesDir, 'page-01.png'), 'png-a');
  const textMode = buildSlideCacheSource({ kind: 'slidedata', sourcePath: sourceA, slideCount: 1 });
  const visionMode = buildSlideCacheSource({
    kind: 'slidedata',
    sourcePath: sourceA,
    slideCount: 1,
    imagesDir,
  });
  ok(!cacheSourceMatches(textMode, visionMode), 'vision mode does not reuse text-only cache');

  writeFileSync(join(imagesDir, 'page-01.png'), 'png-b');
  const visionModeB = buildSlideCacheSource({
    kind: 'slidedata',
    sourcePath: sourceA,
    slideCount: 1,
    imagesDir,
  });
  ok(!cacheSourceMatches(visionMode, visionModeB), 'changed page render invalidates vision cache');
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${pass}/${pass + fail} passed`);
if (fail) process.exit(1);
