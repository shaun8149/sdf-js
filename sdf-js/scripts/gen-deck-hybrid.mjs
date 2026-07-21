#!/usr/bin/env node
// =============================================================================
// gen-deck-hybrid.mjs — a HYBRID Atlas Present deck (the model the user chose):
//   • one LIGHT chapter  — cover/bars/cubes/peaks as stations in ONE continuous
//     world + a touring cameraSequence (camera flies between them). One shader.
//   • two HEAVY slides   — a gear mechanism and a pyramid, each a RICH atom in
//     its OWN scene/shader (single-slide shaders always fit), with a slow pan.
// The Layer-2 deck-player.js (launched via ?deck=deck-hybrid) sequences these,
// fading between segments. Light stays one-world; heavy splits into its scene.
//
// Usage: node sdf-js/scripts/gen-deck-hybrid.mjs
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../examples/compositor/demo-lifts');
const P2 = Math.PI / 2;

const M = {
  grey: { hue: 0.6, sat: 0.05, value: 0.45, metal: 0.6, glow: 0 },
  blue: { hue: 0.58, sat: 0.85, value: 0.75, metal: 0.3, glow: 0 },
  green: { hue: 0.33, sat: 0.8, value: 0.6, metal: 0.2, glow: 0 },
  red: { hue: 0.0, sat: 0.82, value: 0.62, metal: 0.2, glow: 0 },
  gold: { hue: 0.13, sat: 0.85, value: 0.9, metal: 0.9, glow: 0 },
  teal: { hue: 0.5, sat: 0.72, value: 0.7, metal: 0.28, glow: 0 },
};
const S = (type, args, translate, material, rotate) => ({
  type,
  args,
  transform: rotate ? { translate, rotate } : { translate },
  material,
});
const at = (dx, subs) =>
  subs.map((s) => ({
    ...s,
    transform: {
      ...s.transform,
      translate: [
        s.transform.translate[0] + dx,
        s.transform.translate[1],
        s.transform.translate[2],
      ],
    },
  }));

const defaults = (ty, seq) => ({
  camera: { yaw: 0.5, pitch: 0.3, distance: 8, focal: 1.5, targetX: 0, targetY: ty, targetZ: 0 },
  light: { azimuth: 0.6, altitude: 0.55, distance: 25, intensity: 1.2 },
  shadow: { enabled: true, mode: 'darken', strength: 0.4 },
  studioBg: 'dark',
});

function wrap(id, title, sceneData) {
  return {
    id,
    title,
    prompt: title,
    code2d: '// hybrid-deck segment (Atlas Present spatial narrative).',
    sceneData,
    meta: {
      generatedAt: '2026-06-21',
      model: 'vision-authored',
      pattern: 'deck-segment',
      costUSD: 0,
    },
  };
}

// ---- segment 1: LIGHT chapter (continuous world + touring camera) -----------
const GAP = 7;
const LIGHT = [
  [
    S('sphere', { radius: 0.4 }, [-1.2, 0.7, 0], M.green),
    S('sphere', { radius: 0.55 }, [0, 0.85, 0], M.red),
    S('sphere', { radius: 0.72 }, [1.35, 1.0, 0], M.blue),
  ],
  [0.6, 1.0, 1.45, 0.85].map((h, i) =>
    S('box', { size: [0.42, h, 0.42] }, [(i - 1.5) * 0.6, h / 2, 0], M.blue),
  ),
  [
    S('box', { size: [0.7, 0.7, 0.7] }, [-0.7, 0.35, 0.2], M.teal),
    S('box', { size: [0.7, 0.7, 0.7] }, [0.5, 0.5, -0.1], M.teal),
    S('box', { size: [0.7, 0.7, 0.7] }, [0, 1.1, 0], M.blue),
  ],
  [
    S('cone', { height: 1.7, baseRadius: 0.9 }, [0, 0.85, 0], M.gold),
    S('cone', { height: 1.1, baseRadius: 0.6 }, [1.2, 0.55, 0.2], M.grey),
  ],
];
const lightSubjects = [];
const lightShots = [];
LIGHT.forEach((subs, i) => {
  const Xi = i * GAP;
  at(Xi, subs).forEach((s, j) => lightSubjects.push({ id: `s${i}_${j}`, ...s }));
  const fr = { pos: [Xi - 1.3, 2.0, -6.6], target: [Xi, 0.85, 0], fov: 32, ease: 'smooth' };
  lightShots.push({ duration: 2.4, ...fr, transition: i === 0 ? 'cut' : 'blend' });
  lightShots.push({ duration: 1.8, ...fr, transition: 'blend' });
});
const segLight = wrap('deck-seg-light', 'Chapter · light continuous world', {
  v: 1,
  name: 'Chapter · light',
  source: { format: 'vision-authored', prompt: 'light chapter' },
  subjects: lightSubjects,
  cameraSequence: { loop: false, shots: lightShots },
  defaults: defaults(0.85),
});

// ---- segment 2: HEAVY slide — gear mechanism (own shader) --------------------
const panShots = (target, dur = 6) => [
  {
    duration: 0.01,
    pos: [target[0] - 3.2, target[1] + 1.3, -6.8],
    target,
    fov: 32,
    transition: 'cut',
  },
  {
    duration: dur,
    pos: [target[0] + 3.2, target[1] + 1.3, -6.8],
    target,
    fov: 32,
    ease: 'smooth',
    transition: 'blend',
  },
];
const segGears = wrap('deck-seg-gears', 'Slide · gear mechanism (heavy)', {
  v: 1,
  name: 'Slide · gears',
  source: { format: 'vision-authored', prompt: 'gear mechanism' },
  subjects: [
    {
      id: 'g1',
      ...S(
        'gear-3d',
        {
          teeth: 16,
          radius: 0.95,
          thickness: 0.3,
          toothDepth: 0.18,
          toothWidth: 0.2,
          holeRadius: 0.3,
        },
        [-0.6, 1.1, 0],
        M.grey,
        [P2, 0, 0],
      ),
    },
    {
      id: 'g2',
      ...S(
        'gear-3d',
        {
          teeth: 11,
          radius: 0.66,
          thickness: 0.3,
          toothDepth: 0.16,
          toothWidth: 0.18,
          holeRadius: 0.22,
        },
        [1.05, 1.45, 0],
        M.blue,
        [P2, 0, 0],
      ),
    },
  ],
  cameraSequence: { loop: false, shots: panShots([0.2, 1.2, 0], 6) },
  defaults: defaults(1.2),
});

// ---- segment 3: HEAVY slide — pyramid (own shader) ---------------------------
const segPyramid = wrap('deck-seg-pyramid', 'Slide · pyramid (heavy)', {
  v: 1,
  name: 'Slide · pyramid',
  source: { format: 'vision-authored', prompt: 'pyramid' },
  subjects: [
    {
      id: 'p',
      ...S(
        'pyramid-3d',
        { levels: 5, baseWidth: 2.2, topWidth: 0.3, layerHeight: 0.38, gap: 0.05, depth: 0.7 },
        [0, 0.1, 0],
        M.gold,
      ),
    },
  ],
  cameraSequence: {
    loop: false,
    shots: [
      { duration: 0.01, pos: [0, 3.0, -8.5], target: [0, 1.0, 0], fov: 32, transition: 'cut' },
      {
        duration: 6,
        pos: [-1.6, 1.6, -5.2],
        target: [0, 1.0, 0],
        fov: 32,
        ease: 'smooth',
        transition: 'blend',
      },
    ],
  },
  defaults: defaults(1.0),
});

// ---- write segment scenes + the deck playlist -------------------------------
for (const seg of [segLight, segGears, segPyramid]) {
  writeFileSync(`${OUT}/${seg.id}.json`, JSON.stringify(seg, null, 2) + '\n');
}
const deck = {
  id: 'deck-hybrid',
  name: 'Hybrid spatial deck (light chapter + heavy slides)',
  segments: [
    { file: 'deck-seg-light.json', title: segLight.title, kind: 'chapter', durationSec: 17 },
    { file: 'deck-seg-gears.json', title: segGears.title, kind: 'slide', durationSec: 6.5 },
    { file: 'deck-seg-pyramid.json', title: segPyramid.title, kind: 'slide', durationSec: 6.5 },
  ],
};
writeFileSync(`${OUT}/deck-hybrid.json`, JSON.stringify(deck, null, 2) + '\n');
console.log(`wrote deck-hybrid (${deck.segments.length} segments) + 3 segment scenes`);
