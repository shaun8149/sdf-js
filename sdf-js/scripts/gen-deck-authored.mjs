#!/usr/bin/env node
// =============================================================================
// gen-deck-authored.mjs — AUTO-AUTHOR a real lifted deck into a hybrid spatial
// deck (the Step-2 payoff). Takes an ordered list of existing slide scenes
// (default: the 20 fill-slide-* presentation slides) and classifies each:
//
//   • SIMPLE + NARROW slide  → groupable into a continuous "chapter": several
//     slides become stations in ONE world + a touring cameraSequence.
//   • COMPLEX / WIDE / HEAVY → its own "slide" segment (own scene/shader),
//     framed by its own camera + a gentle lateral pan so it isn't frozen.
//
// Classification is measured, not guessed: per-slide added-GLSL weight (vs the
// studio library baseline) + x-extent. Output = a deck playlist + the chapter /
// solo segment scenes, played by deck-player.js via ?deck=deck-authored.
//
// Usage: node sdf-js/scripts/gen-deck-authored.mjs
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { compile } from '../src/scene/index.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../examples/compositor/demo-lifts');

// ---- tunables (validated by the browser GPU check after generation) ---------
const SOURCE_IDS = Array.from(
  { length: 20 },
  (_, i) => `fill-slide-${String(i + 1).padStart(2, '0')}`,
);
const CHAPTER_BUDGET = 2600; // max cumulative added-GLSL chars in one chapter shader
const SIMPLE_SUBJ = 2; // ≤ this many top subjects → chapterable
const SIMPLE_EXTENT = 2.6; // ≤ this x-extent (world units) → chapterable
const HEAVY_WEIGHT = 3000; // single-slide added chars above this → always solo
const STATION_GAP = 5.0;

const BASELINE = (() => {
  const c = compile({
    v: 1,
    defaults: {
      camera: { yaw: 0.4, pitch: 0.2, distance: 8, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.6, distance: 8, intensity: 1.1 },
    },
    subjects: [{ id: 's', type: 'sphere', args: { radius: 0.5 }, region: 'object' }],
  });
  const g = compileSDF3ToGLSL(c.sdf, {
    sceneFnName: 'sceneSDF',
    includeLibrary: true,
    emitObjectIndex: true,
  });
  return (typeof g === 'string' ? g : g.glsl).length;
})();

const clone = (o) => JSON.parse(JSON.stringify(o));

function loadSlide(id) {
  const d = JSON.parse(readFileSync(`${OUT}/${id}.json`, 'utf8'));
  const sd = d.sceneData;
  const xs = sd.subjects.map((s) => s.transform?.translate?.[0] ?? 0);
  const ys = sd.subjects.map((s) => s.transform?.translate?.[1] ?? 0);
  const zs = sd.subjects.map((s) => s.transform?.translate?.[2] ?? 0);
  const extent = Math.max(...xs) - Math.min(...xs) + 1.6; // + radius pad
  const c = compile(sd);
  const g = compileSDF3ToGLSL(c.sdf, {
    sceneFnName: 'sceneSDF',
    includeLibrary: true,
    emitObjectIndex: true,
  });
  const weight = (typeof g === 'string' ? g : g.glsl).length - BASELINE;
  const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
  const cz = zs.reduce((a, b) => a + b, 0) / zs.length;
  return { id, sd, extent, weight, n: sd.subjects.length, cx, cy, cz };
}

const DEFAULTS = (ty) => ({
  camera: { yaw: 0.5, pitch: 0.3, distance: 9, focal: 1.5, targetX: 0, targetY: ty, targetZ: 0 },
  light: { azimuth: 0.6, altitude: 0.55, distance: 25, intensity: 1.2 },
  shadow: { enabled: true, mode: 'darken', strength: 0.4 },
  studioBg: 'dark',
});

// lateral pan that frames a slide of half-width hw centred at (cx,cy,cz)
function panSeq(cx, cy, cz, hw, dur = 6) {
  const zback = -Math.max(6, 1.7 * hw + 2.5);
  const t = [cx, cy, cz];
  return {
    loop: false,
    shots: [
      { duration: 0.01, pos: [cx - 1.5, cy + 1.2, zback], target: t, fov: 34, transition: 'cut' },
      {
        duration: dur,
        pos: [cx + 1.5, cy + 1.2, zback],
        target: t,
        fov: 34,
        ease: 'smooth',
        transition: 'blend',
      },
    ],
  };
}

function wrap(id, title, sceneData) {
  return {
    id,
    title,
    prompt: title,
    code2d: '// auto-authored deck segment.',
    sceneData,
    meta: { generatedAt: '2026-06-21', model: 'authored', pattern: 'deck-segment', costUSD: 0 },
  };
}

// ---- classify + pack --------------------------------------------------------
const slides = SOURCE_IDS.map(loadSlide);
const segments = []; // {file, title, kind, durationSec}
const written = [];
let chapterBuf = [];
let chapterWeight = 0;
let chapterIdx = 0;
let segIdx = 0;

function flushChapter() {
  if (!chapterBuf.length) return;
  // lay each buffered slide at a station along +X, shift subjects, tour camera
  const subjects = [];
  const shots = [];
  chapterBuf.forEach((sl, i) => {
    const Xi = i * STATION_GAP;
    sl.sd.subjects.forEach((s, j) => {
      const c = clone(s);
      c.id = `c${chapterIdx}s${i}_${j}`;
      c.transform = c.transform || {};
      const tr = c.transform.translate || [0, 0, 0];
      c.transform.translate = [tr[0] - sl.cx + Xi, tr[1], tr[2]];
      subjects.push(c);
    });
    const hw = sl.extent / 2;
    const zback = -Math.max(6, 1.7 * hw + 2.5);
    const fr = {
      pos: [Xi - 1.2, sl.cy + 1.2, zback],
      target: [Xi, sl.cy, sl.cz],
      fov: 34,
      ease: 'smooth',
    };
    shots.push({ duration: 2.6, ...fr, transition: i === 0 ? 'cut' : 'blend' });
    shots.push({ duration: 1.8, ...fr, transition: 'blend' });
  });
  const id = `deck-auth-ch${chapterIdx}`;
  const cy = chapterBuf.reduce((a, b) => a + b.cy, 0) / chapterBuf.length;
  const seg = wrap(id, `Chapter ${chapterIdx + 1} · ${chapterBuf.length} slides`, {
    v: 1,
    name: `Chapter ${chapterIdx + 1}`,
    source: { format: 'authored', prompt: 'light chapter' },
    subjects,
    cameraSequence: { loop: false, shots },
    defaults: DEFAULTS(cy),
  });
  writeFileSync(`${OUT}/${id}.json`, JSON.stringify(seg, null, 2) + '\n');
  written.push(id);
  segments.push({
    file: `${id}.json`,
    title: seg.title,
    kind: 'chapter',
    durationSec: Math.round(shots.length * 2.2 * 10) / 10,
  });
  chapterIdx++;
  chapterBuf = [];
  chapterWeight = 0;
}

for (const sl of slides) {
  const chapterable = sl.n <= SIMPLE_SUBJ && sl.extent <= SIMPLE_EXTENT && sl.weight < HEAVY_WEIGHT;
  if (chapterable) {
    if (chapterWeight + sl.weight > CHAPTER_BUDGET || chapterBuf.length >= 5) flushChapter();
    chapterBuf.push(sl);
    chapterWeight += sl.weight;
  } else {
    flushChapter(); // close any open chapter before a solo
    // solo segment: keep the slide's own subjects + dark bg + a gentle pan
    const sd = clone(sl.sd);
    sd.defaults = { ...sd.defaults, studioBg: 'dark' };
    sd.cameraSequence = panSeq(sl.cx, sl.cy, sl.cz, sl.extent / 2, 6);
    const id = `deck-auth-solo-${sl.id}`;
    const seg = wrap(id, `${sl.sd.name || sl.id}`, sd);
    writeFileSync(`${OUT}/${id}.json`, JSON.stringify(seg, null, 2) + '\n');
    written.push(id);
    segments.push({ file: `${id}.json`, title: seg.title, kind: 'slide', durationSec: 6.5 });
  }
  segIdx++;
}
flushChapter();

const deck = {
  id: 'deck-authored',
  name: 'Auto-authored hybrid deck (20 fill slides)',
  source: 'fill-slide-01..20',
  segments,
};
writeFileSync(`${OUT}/deck-authored.json`, JSON.stringify(deck, null, 2) + '\n');

const nCh = segments.filter((s) => s.kind === 'chapter').length;
const nSolo = segments.filter((s) => s.kind === 'slide').length;
console.log(`baseline ${BASELINE} chars`);
console.log(
  `classified ${slides.length} slides → ${segments.length} segments (${nCh} chapters + ${nSolo} solo)`,
);
console.log(`wrote ${written.length} segment scenes + deck-authored.json`);
