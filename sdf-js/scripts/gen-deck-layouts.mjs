#!/usr/bin/env node
// =============================================================================
// gen-deck-layouts.mjs — chapter LAYOUTS beyond linear. A "chapter" lays its
// light slide-stations in 3D and the camera tours them. Same 5 light stations,
// three layouts so the difference is pure spatial arrangement:
//   • linear — stations along +X (the original)
//   • arc    — stations on a shallow fan; camera curves in front of each
//   • grid   — stations on an X/Z grid; camera weaves row by row
// Output: deck-layouts (3 chapter segments) played by deck-player.js via
// ?deck=deck-layouts. Each chapter is its own scene/shader (≈5 light stations
// fit comfortably — verified in-browser).
//
// Usage: node sdf-js/scripts/gen-deck-layouts.mjs
// =============================================================================

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildChapter } from './lib/chapter-layout.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../examples/compositor/demo-lifts');

const M = {
  grey: { hue: 0.6, sat: 0.05, value: 0.45, metal: 0.6, glow: 0 },
  blue: { hue: 0.58, sat: 0.85, value: 0.75, metal: 0.3, glow: 0 },
  green: { hue: 0.33, sat: 0.8, value: 0.6, metal: 0.2, glow: 0 },
  red: { hue: 0.0, sat: 0.82, value: 0.62, metal: 0.2, glow: 0 },
  gold: { hue: 0.13, sat: 0.85, value: 0.9, metal: 0.9, glow: 0 },
  teal: { hue: 0.5, sat: 0.72, value: 0.7, metal: 0.28, glow: 0 },
};
const S = (type, args, translate, material) => ({ type, args, transform: { translate }, material });

// 5 LIGHT station clusters (subjects centred near origin).
const STATIONS = [
  () => [
    S('sphere', { radius: 0.4 }, [-1.0, 0.7, 0], M.green),
    S('sphere', { radius: 0.55 }, [0, 0.85, 0], M.red),
    S('sphere', { radius: 0.68 }, [1.15, 1.0, 0], M.blue),
  ],
  () =>
    [0.6, 1.0, 1.4, 0.85].map((h, i) =>
      S('box', { size: [0.4, h, 0.4] }, [(i - 1.5) * 0.58, h / 2, 0], M.blue),
    ),
  () => [
    S('box', { size: [0.7, 0.7, 0.7] }, [-0.65, 0.35, 0.15], M.teal),
    S('box', { size: [0.7, 0.7, 0.7] }, [0.5, 0.5, -0.1], M.teal),
    S('box', { size: [0.7, 0.7, 0.7] }, [-0.05, 1.1, 0], M.blue),
  ],
  () => [
    S('cone', { height: 1.6, baseRadius: 0.85 }, [0, 0.8, 0], M.gold),
    S('cone', { height: 1.05, baseRadius: 0.55 }, [1.1, 0.52, 0.2], M.grey),
  ],
  () => [
    S('torus', { radius: 0.7, thickness: 0.18 }, [0, 0.85, 0], M.teal),
    S('sphere', { radius: 0.34 }, [0, 0.85, 0], M.gold),
  ],
];
const TY = 0.85;

function makeChapter(kind) {
  const stations = STATIONS.map((build) => ({ subjects: build(), cx: 0, cy: 0, cz: 0 }));
  const { subjects, shots } = buildChapter(stations, kind, TY, kind);
  const id = `deck-lay-${kind}`;
  return {
    id,
    title: `${kind[0].toUpperCase()}${kind.slice(1)} layout · 5 stations`,
    prompt: `chapter layout: ${kind}`,
    code2d: `// chapter layout demo (${kind}).`,
    sceneData: {
      v: 1,
      name: `${kind} layout`,
      source: { format: 'authored', prompt: `${kind} layout` },
      subjects,
      cameraSequence: { loop: false, shots },
      defaults: {
        camera: {
          yaw: 0.5,
          pitch: 0.3,
          distance: 9,
          focal: 1.5,
          targetX: 0,
          targetY: TY,
          targetZ: 0,
        },
        light: { azimuth: 0.6, altitude: 0.55, distance: 25, intensity: 1.2 },
        shadow: { enabled: true, mode: 'darken', strength: 0.4 },
        studioBg: 'dark',
      },
    },
    meta: { generatedAt: '2026-06-21', model: 'authored', pattern: 'deck-layout', costUSD: 0 },
  };
}

const chapters = ['linear', 'arc', 'grid'].map(makeChapter);
for (const ch of chapters)
  writeFileSync(`${OUT}/${ch.id}.json`, JSON.stringify(ch, null, 2) + '\n');
const deck = {
  id: 'deck-layouts',
  name: 'Chapter layouts (linear / arc / grid)',
  segments: chapters.map((ch) => ({
    file: `${ch.id}.json`,
    title: ch.title,
    kind: 'chapter',
    durationSec: 11,
  })),
};
writeFileSync(`${OUT}/deck-layouts.json`, JSON.stringify(deck, null, 2) + '\n');
console.log(`wrote deck-layouts (${chapters.length} chapters: linear/arc/grid) + playlist`);
