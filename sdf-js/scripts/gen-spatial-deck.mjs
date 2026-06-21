#!/usr/bin/env node
// =============================================================================
// gen-spatial-deck.mjs — Step 2: multiple slides laid out as STATIONS in ONE 3D
// world + a cameraSequence that flies the studio camera from slide to slide
// (travel → dwell → travel), looping. This is Atlas Present's spatial-narrative
// core: a deck isn't N images, it's one world you move through.
//
// Each slide's subjects are shifted to its station x (GAP apart). The camera
// frames each station from the −z front (studio camera convention), blending
// (dolly) between them. Studio plays scene.cameraSequence per-frame.
//
// Usage: node sdf-js/scripts/gen-spatial-deck.mjs
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../examples/compositor/demo-lifts');
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
// shift a slide's subjects to its station x
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

const GAP = 7;

// Each slide: { title, build(): subjects centred near x=0 }
const SLIDES = [
  {
    title: 'Cover',
    build: () => [
      S('sphere', { radius: 0.4 }, [-1.2, 0.7, 0], M.green),
      S('sphere', { radius: 0.55 }, [0, 0.85, 0], M.red),
      S('sphere', { radius: 0.72 }, [1.35, 1.0, 0], M.blue),
    ],
  },
  {
    // bars — plain boxes (keep the combined deck shader light; rich atoms like
    // bar-3d/gear-3d/pyramid overflow the single studio shader when many slides
    // share one scene).
    title: 'Bars',
    build: () =>
      [0.6, 1.0, 1.45, 0.85].map((h, i) =>
        S('box', { size: [0.42, h, 0.42] }, [(i - 1.5) * 0.6, h / 2, 0], M.blue),
      ),
  },
  {
    title: 'Cubes',
    build: () => [
      S('box', { size: [0.7, 0.7, 0.7] }, [-0.7, 0.35, 0.2], M.teal),
      S('box', { size: [0.7, 0.7, 0.7] }, [0.5, 0.5, -0.1], M.teal),
      S('box', { size: [0.7, 0.7, 0.7] }, [0, 1.1, 0], M.blue),
    ],
  },
  {
    title: 'Peaks',
    build: () => [
      S('cone', { height: 1.7, baseRadius: 0.9 }, [0, 0.85, 0], M.gold),
      S('cone', { height: 1.1, baseRadius: 0.6 }, [1.2, 0.55, 0.2], M.grey),
    ],
  },
];

// ---- compose one world + camera tour ----------------------------------------
const subjects = [];
const shots = [];
SLIDES.forEach((slide, i) => {
  const Xi = i * GAP;
  at(Xi, slide.build()).forEach((s, j) => subjects.push({ id: `s${i}_${j}`, ...s }));
  const fr = { pos: [Xi - 1.3, 2.0, -6.6], target: [Xi, 0.85, 0], fov: 32, ease: 'smooth' };
  shots.push({ duration: 2.4, ...fr, transition: i === 0 ? 'cut' : 'blend' }); // dolly in
  shots.push({ duration: 1.8, ...fr, transition: 'blend' }); // dwell on the slide
});

const entry = {
  id: 'deck-tour',
  title: 'Spatial Deck · camera tour (Step 2)',
  prompt: 'spatial-narrative: 4 slides as stations in one 3D world, camera flies between them.',
  code2d: '// Step 2 spatial-narrative demo — multi-slide deck in one world + cameraSequence.',
  sceneData: {
    v: 1,
    name: 'Spatial Deck · camera tour',
    source: { format: 'vision-authored', prompt: 'spatial deck tour' },
    subjects,
    cameraSequence: { loop: true, shots },
    defaults: {
      camera: {
        yaw: 0.5,
        pitch: 0.3,
        distance: 8,
        focal: 1.5,
        targetX: 0,
        targetY: 0.85,
        targetZ: 0,
      },
      light: { azimuth: 0.6, altitude: 0.55, distance: 25, intensity: 1.2 },
      shadow: { enabled: true, mode: 'darken', strength: 0.4 },
      studioBg: 'dark',
    },
  },
  meta: {
    generatedAt: '2026-06-21',
    model: 'vision-authored',
    pattern: 'spatial-deck',
    costUSD: 0,
  },
};

writeFileSync(`${OUT_DIR}/deck-tour.json`, JSON.stringify(entry, null, 2) + '\n');

const indexPath = `${OUT_DIR}/index.json`;
const index = JSON.parse(readFileSync(indexPath, 'utf8'));
if (!index.demos.some((d) => d.id === 'deck-tour')) {
  index.demos.push({
    id: 'deck-tour',
    title: entry.title,
    thesisPoint:
      'Step 2 — spatial narrative: multi-slide deck in one 3D world + cameraSequence tour.',
    category: 'spatial-deck',
    status: 'ready',
    file: 'deck-tour.json',
    renderer: 'studio',
    prompt: entry.title,
  });
}
writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
console.log(
  `wrote deck-tour (${subjects.length} subjects, ${shots.length} shots); index now ${index.demos.length} demos`,
);
