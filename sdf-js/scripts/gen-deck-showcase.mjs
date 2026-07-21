#!/usr/bin/env node
// =============================================================================
// gen-deck-showcase.mjs — a curated "hero" deck that strings the WHOLE Step-2
// system into one ~50s narrative reel: an arc chapter (intro) → a heavy gear
// slide → a grid chapter → a heavy pyramid slide. It writes NO new scene files —
// it's a curated PLAYLIST that REUSES existing segment scenes and supplies the
// narrative captions (the deck player reads titles/stationTitles from the
// playlist entry, not the scene). Station t's are derived from each referenced
// scene's own cameraSequence, so captions stay in sync.
//
// Launch: ?deck=deck-showcase
// Usage:  node sdf-js/scripts/gen-deck-showcase.mjs
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../examples/compositor/demo-lifts');

const readScene = (file) => JSON.parse(readFileSync(`${OUT}/${file}`, 'utf8')).sceneData;
const totalDur = (sd) =>
  (sd.cameraSequence?.shots || []).reduce((a, s) => a + (s.duration || 0), 0);

// station start times for a chapter scene: stations are (travel + dwell) pairs,
// so station k starts at the cumulative duration before its travel shot.
function stationStarts(sd) {
  const shots = sd.cameraSequence?.shots || [];
  const starts = [];
  let t = 0;
  for (let i = 0; i < shots.length; i += 2) {
    starts.push(Math.round(t * 100) / 100);
    t += (shots[i]?.duration || 0) + (shots[i + 1]?.duration || 0);
  }
  return starts;
}

// pair narrative titles with a chapter scene's station start times
function chapterSeg(file, titles) {
  const sd = readScene(file);
  const starts = stationStarts(sd);
  const stationTitles = starts.map((t, i) => ({ t, title: titles[i] ?? `Station ${i + 1}` }));
  return { file, title: titles[0], kind: 'chapter', stationTitles, durationSec: totalDur(sd) };
}
function slideSeg(file, title) {
  const sd = readScene(file);
  return { file, title, kind: 'slide', durationSec: Math.max(5, totalDur(sd)) };
}

const segments = [
  chapterSeg('deck-lay-arc.json', [
    'Atlas Present',
    'Describe your idea',
    'AI builds the scene',
    'Fly through it',
    'Not slides — a world',
  ]),
  slideSeg('deck-seg-gears.json', 'Rich detail gets its own scene'),
  chapterSeg('deck-lay-grid.json', [
    'Arrange in any layout',
    'Linear rows',
    'Sweeping arcs',
    'Grids you weave through',
    'Your structure, in space',
  ]),
  slideSeg('deck-seg-pyramid.json', 'Hierarchies, monumental'),
];

const deck = {
  id: 'deck-showcase',
  name: 'Atlas Present — showcase reel',
  note: 'Curated playlist reusing existing segment scenes + narrative captions.',
  segments,
};
writeFileSync(`${OUT}/deck-showcase.json`, JSON.stringify(deck, null, 2) + '\n');
console.log(
  `wrote deck-showcase (${segments.length} segments, ${segments.reduce((a, s) => a + s.durationSec, 0)}s total) — reuses existing scenes`,
);
