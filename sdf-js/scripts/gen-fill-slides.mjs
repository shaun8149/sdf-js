#!/usr/bin/env node
// =============================================================================
// gen-fill-slides.mjs — generate vision-authored 3D scenes for the
// "D0961 3D Spheres Fill Levels" PDF deck (Atlas image→3D, scenario 2).
// -----------------------------------------------------------------------------
// Each fill sphere is rendered as a glossy TWO-TONE ball (studio glass is not
// truly see-through), so we tile the sphere at the waterline:
//   - liquid (bottom, y ≤ waterline): sphere-fill-3d cage:false  → blue
//   - empty  (top,    y ≥ waterline): cut-sphere(r, r*(2f-1))    → porcelain
// Fill fraction f → blue covers the bottom f of the ball, crisp waterline seam.
//
// Define each slide's sphere layout in SLIDES, run this to (re)write the demo
// JSONs + register them in demo-lifts/index.json. Renderer: studio (auto-frame).
//
// Usage: node sdf-js/scripts/gen-fill-slides.mjs
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../examples/compositor/demo-lifts');

const LIQUID = { hue: 0.58, sat: 0.85, value: 0.72, metal: 0.3, glow: 0 }; // vivid glossy azure fill
const EMPTY = 'porcelain'; // clean white upper cap

// ---- Per-slide sphere layouts (vision-authored from each PDF page) ----------
// sphere = { x, y, z, r, f }  (f = fill fraction 0..1)
// extras = optional array of raw subjects (arrows / rings) appended as-is.
const SLIDES = {
  'fill-slide-01': {
    title: 'Fill Levels · Cover (20/40/80)',
    pattern: 'kpi-hero',
    prompt: 'Cover — three glass fill spheres at 20/40/80%, increasing in size.',
    spheres: [
      { x: -1.75, y: 0.9, z: 0, r: 0.46, f: 0.2 },
      { x: -0.35, y: 0.9, z: 0, r: 0.64, f: 0.4 },
      { x: 1.5, y: 0.9, z: 0, r: 0.92, f: 0.8 },
    ],
  },
  'fill-slide-02': {
    title: 'Fill Levels · Row of 4 (20/60/80/90)',
    pattern: 'compare',
    prompt: 'A row of four fill spheres at 20/60/80/90%.',
    spheres: rowOf([0.2, 0.6, 0.8, 0.9], { r: 0.55, spacing: 0.5, y: 0.9 }),
  },
  'fill-slide-03': {
    title: 'Fill Levels · Framed row + arrows (10/60/50)',
    pattern: 'sequence',
    prompt: 'Three framed fill spheres 10/60/50% connected left-to-right by arrows.',
    spheres: rowOf([0.1, 0.6, 0.5], { r: 0.7, spacing: 1.0, y: 0.9 }),
    extras: arrowsBetween(3, { r: 0.7, spacing: 1.0, y: 0.9 }),
  },
  'fill-slide-04': {
    title: 'Fill Levels · Hero 60%',
    pattern: 'kpi-hero',
    prompt: 'A single large fill sphere at 60% with two callout text blocks.',
    spheres: [{ x: 0, y: 1.0, z: 0, r: 1.05, f: 0.6 }],
  },
  'fill-slide-05': {
    title: 'Fill Levels · Hero 100% + legend',
    pattern: 'kpi-hero',
    prompt: 'A single full (100%) fill sphere with a side legend.',
    spheres: [{ x: 0, y: 1.0, z: 0, r: 1.05, f: 1.0 }],
  },
  'fill-slide-06': {
    title: 'Fill Levels · Cluster of 5 (50/20/100/40/80)',
    pattern: 'compare',
    prompt: 'Five varied-size fill spheres clustered around a large 100% sphere.',
    spheres: [
      { x: 0, y: 0.95, z: 0, r: 0.95, f: 1.0 },
      { x: -2.15, y: 0.7, z: 0.2, r: 0.6, f: 0.5 },
      { x: -1.05, y: 1.35, z: -0.3, r: 0.42, f: 0.2 },
      { x: 1.05, y: 1.35, z: -0.3, r: 0.42, f: 0.4 },
      { x: 2.15, y: 0.7, z: 0.2, r: 0.6, f: 0.8 },
    ],
  },
  'fill-slide-07': {
    title: 'Fill Levels · Row of 3 (50/100/80)',
    pattern: 'compare',
    prompt: 'A row of three fill spheres 50/100/80%, the middle one largest.',
    spheres: [
      { x: -1.9, y: 0.85, z: 0, r: 0.62, f: 0.5 },
      { x: 0, y: 1.0, z: 0, r: 0.85, f: 1.0 },
      { x: 1.9, y: 0.85, z: 0, r: 0.62, f: 0.8 },
    ],
  },
  'fill-slide-08': {
    title: 'Fill Levels · Cluster of 3 (60/50/80)',
    pattern: 'compare',
    prompt: 'Three overlapping varied-size fill spheres 60/50/80%.',
    spheres: [
      { x: -1.35, y: 0.95, z: 0, r: 0.78, f: 0.6 },
      { x: 0.1, y: 0.7, z: 0.25, r: 0.55, f: 0.5 },
      { x: 1.4, y: 1.0, z: -0.1, r: 0.72, f: 0.8 },
    ],
  },
  'fill-slide-09': {
    title: 'Fill Levels · Row of 5 (10..90)',
    pattern: 'compare',
    prompt: 'A row of five small fill spheres rising 10/30/50/70/90%.',
    spheres: rowOf([0.1, 0.3, 0.5, 0.7, 0.9], { r: 0.45, spacing: 0.35, y: 0.8 }),
  },
  'fill-slide-10': {
    title: 'Fill Levels · Grid of 6 (framed)',
    pattern: 'list',
    prompt: 'A grid of six framed fill spheres at mixed levels.',
    spheres: gridOf([0.55, 0.75, 0.6, 0.2, 0.4, 0.65], {
      cols: 3,
      r: 0.5,
      gapX: 0.5,
      gapY: 0.6,
      y: 1.0,
    }),
  },
  'fill-slide-11': {
    title: 'Fill Levels · Hero 30% + list',
    pattern: 'kpi-hero',
    prompt: 'A single large fill sphere at 30% with a 4-item side list.',
    spheres: [{ x: 0, y: 1.0, z: 0, r: 1.05, f: 0.3 }],
  },
  'fill-slide-12': {
    title: 'Fill Levels · Row of 5 + captions',
    pattern: 'compare',
    prompt: 'A row of five fill spheres 20/40/60/50/80% over caption columns.',
    spheres: rowOf([0.2, 0.4, 0.6, 0.5, 0.8], { r: 0.5, spacing: 0.4, y: 0.85 }),
  },
  'fill-slide-13': {
    title: 'Fill Levels · Hero 90% + list',
    pattern: 'kpi-hero',
    prompt: 'A single large fill sphere at 90% with a side list.',
    spheres: [{ x: 0, y: 1.0, z: 0, r: 1.05, f: 0.9 }],
  },
  'fill-slide-14': {
    title: 'Fill Levels · Bullet list of 4',
    pattern: 'list',
    prompt: 'A vertical list of four items, each marked by a small fill sphere.',
    spheres: columnOf([0.4, 0.6, 0.5, 0.7], { r: 0.34, gap: 0.45, x: -1.6, y: 0.9 }),
  },
  'fill-slide-15': {
    title: 'Fill Levels · Hero 100% + 4 labels',
    pattern: 'kpi-hero',
    prompt: 'A single full fill sphere with four surrounding labels.',
    spheres: [{ x: 0, y: 1.0, z: 0, r: 1.1, f: 1.0 }],
  },
  'fill-slide-16': {
    title: 'Fill Levels · Vertical 3 (30/80/70)',
    pattern: 'list',
    prompt: 'Three fill spheres stacked vertically 30/80/70% with connector lines.',
    spheres: columnOf([0.3, 0.8, 0.7], { r: 0.5, gap: 0.4, x: -1.8, y: 0.95 }),
  },
  'fill-slide-17': {
    title: 'Fill Levels · Two heroes (80/90)',
    pattern: 'compare',
    prompt: 'Two large fill spheres 80% and 90% stacked with side text.',
    spheres: [
      { x: -1.4, y: 1.45, z: 0, r: 0.7, f: 0.8 },
      { x: -1.4, y: -0.05, z: 0, r: 0.75, f: 0.9 },
    ],
  },
  'fill-slide-18': {
    title: 'Fill Levels · Progression grid 2×4',
    pattern: 'sequence',
    prompt: 'Two rows of four spheres showing a fill progression up to 100%.',
    spheres: gridOf([0.15, 0.25, 0.35, 0.45, 0.6, 0.8, 0.9, 1.0], {
      cols: 4,
      r: 0.42,
      gapX: 0.45,
      gapY: 0.55,
      y: 1.0,
    }),
  },
  'fill-slide-19': {
    title: 'Fill Levels · Row of 5 (20..100)',
    pattern: 'sequence',
    prompt: 'A clean row of five fill spheres rising 20/40/60/80/100%.',
    spheres: rowOf([0.2, 0.4, 0.6, 0.8, 1.0], { r: 0.5, spacing: 0.4, y: 0.85 }),
  },
  'fill-slide-20': {
    title: 'Fill Levels · Grid 2×5',
    pattern: 'list',
    prompt: 'Two rows of five fill spheres at mixed levels.',
    spheres: gridOf([0.1, 0.3, 0.5, 0.7, 0.9, 0.2, 0.45, 0.65, 0.8, 1.0], {
      cols: 5,
      r: 0.4,
      gapX: 0.35,
      gapY: 0.5,
      y: 0.95,
    }),
  },
};

// Helper: grid of fill spheres (row-major, centered both axes).
function gridOf(levels, { cols = 3, r = 0.5, gapX = 0.4, gapY = 0.4, y = 0.9, z = 0 } = {}) {
  const N = levels.length;
  const rows = Math.ceil(N / cols);
  const sx = 2 * r + gapX;
  const sy = 2 * r + gapY;
  const offX = ((cols - 1) / 2) * sx;
  const offY = ((rows - 1) / 2) * sy;
  return levels.map((f, i) => {
    const c = i % cols;
    const rw = Math.floor(i / cols);
    return { x: c * sx - offX, y: y + offY - rw * sy, z, r, f };
  });
}

// Helper: vertical column of fill spheres (top to bottom).
function columnOf(levels, { r = 0.4, gap = 0.3, x = 0, y = 0.9, z = 0 } = {}) {
  const N = levels.length;
  const s = 2 * r + gap;
  const off = ((N - 1) / 2) * s;
  return levels.map((f, i) => ({ x, y: y + off - i * s, z, r, f }));
}

// Helper: evenly spaced row of fill spheres.
function rowOf(levels, { r = 0.55, spacing = 0.5, y = 0.9, z = 0 } = {}) {
  const N = levels.length;
  const stride = 2 * r + spacing;
  const off = ((N - 1) / 2) * stride;
  return levels.map((f, i) => ({ x: i * stride - off, y, z, r, f }));
}

// Helper: right-pointing arrows in the gaps between N row spheres.
function arrowsBetween(n, { r = 0.7, spacing = 1.0, y = 0.9, z = 0 } = {}) {
  const stride = 2 * r + spacing;
  const off = ((n - 1) / 2) * stride;
  const out = [];
  for (let i = 0; i < n - 1; i++) {
    const x = i * stride - off + stride / 2;
    out.push({
      id: `arrow${i}`,
      type: 'arrow-3d',
      args: {
        length: spacing * 0.9,
        shaftWidth: 0.1,
        headLength: 0.28,
        headWidth: 0.34,
        depth: 0.18,
      },
      transform: { translate: [x, y, z] },
      material: 'silver',
    });
  }
  return out;
}

// ---- Build one sphere → 1-2 subjects (liquid cap + empty cap) ----------------
function sphereSubjects(s, idx) {
  const subs = [];
  const f = Math.max(0, Math.min(1, s.f));
  // liquid (bottom cap) — sphere-fill-3d with no cage, liquid fills to radius
  if (f > 0) {
    subs.push({
      id: `liq${idx}`,
      type: 'sphere-fill-3d',
      args: { levels: [f], radius: s.r, cage: false, fillScale: 1.0 },
      transform: { translate: [s.x, s.y, s.z] },
      material: LIQUID,
    });
  }
  // empty (top cap) — cut-sphere keeps y ≥ waterline; skip when full
  if (f < 1) {
    subs.push({
      id: `emp${idx}`,
      type: 'cut-sphere',
      args: { radius: s.r, h: s.r * (2 * f - 1) },
      transform: { translate: [s.x, s.y, s.z] },
      material: EMPTY,
    });
  }
  return subs;
}

function buildScene(id, def) {
  const subjects = [];
  def.spheres.forEach((s, i) => subjects.push(...sphereSubjects(s, i)));
  if (def.extras) subjects.push(...def.extras);
  // camera target ~ mean sphere y; auto-frame overrides distance anyway
  const ys = def.spheres.map((s) => s.y);
  const ty = ys.reduce((a, b) => a + b, 0) / ys.length;
  return {
    id,
    title: def.title,
    prompt: `${def.pattern}: ${def.prompt}`,
    code2d: `// vision-authored from PDF slide (D0961 3D Spheres Fill Levels).`,
    sceneData: {
      v: 1,
      name: `${def.pattern}: ${def.title}`,
      source: { format: 'vision-authored', prompt: def.prompt },
      subjects,
      defaults: {
        camera: {
          yaw: 0.5,
          pitch: 0.28,
          distance: 10,
          focal: 1.5,
          targetX: 0,
          targetY: ty,
          targetZ: 0,
        },
        light: { azimuth: 0.6, altitude: 0.55, distance: 25, intensity: 1.2 },
        shadow: { enabled: true, mode: 'darken', strength: 0.4 },
        studioBg: 'dark', // dramatic showcase background (matches the source deck)
      },
    },
    meta: { generatedAt: '2026-06-21', model: 'vision-authored', pattern: def.pattern, costUSD: 0 },
  };
}

// ---- Write demos + register in index.json -----------------------------------
const indexPath = `${OUT_DIR}/index.json`;
const index = JSON.parse(readFileSync(indexPath, 'utf8'));
let wrote = 0;
for (const [id, def] of Object.entries(SLIDES)) {
  const entry = buildScene(id, def);
  writeFileSync(`${OUT_DIR}/${id}.json`, JSON.stringify(entry, null, 2) + '\n');
  wrote++;
  if (!index.demos.some((d) => d.id === id)) {
    index.demos.push({
      id,
      title: def.title,
      thesisPoint:
        'Vision-authored lift of PDF chart slide (D0961 3D Spheres Fill Levels) — two-tone fill spheres, studio auto-framed.',
      category: 'presentation-slide',
      status: 'ready',
      file: `${id}.json`,
      renderer: 'studio',
      prompt: def.title,
    });
  }
}
writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
console.log(`wrote ${wrote} fill-slide scenes; index now ${index.demos.length} demos`);
