#!/usr/bin/env node
// =============================================================================
// gen-product-pixel.mjs — pixel-aligned 3D recreations of 7 PresentationLoad
// product covers (user-selected 2026-06-21). Each scene targets that deck's
// hero look with Atlas atoms + the dark dramatic studio mode.
//   1 diamond-charts      → diamond-3d ×3 (green/red/blue, increasing size)
//   2 3d-cubes-flow       → cube row + arrow connectors (process)
//   3 3d-cubes-semicircle → cubes along a semicircle arc (+ accent)
//   4 3d-spheres-sliced   → nested spheres with a quadrant wedge removed
//   5 3d-cubes-shapes     → 3×3×3 grid (dark) + blue accent cubes
//   6 3d-puzzle           → interlocking colour pieces + one lifted
//   7 arrow-toolbox-3d    → big blue rising arrow + grey supporting arrows
//
// Usage: node sdf-js/scripts/gen-product-pixel.mjs
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../examples/compositor/demo-lifts');

const M = {
  grey: { hue: 0.6, sat: 0.04, value: 0.46, metal: 0.5, glow: 0 },
  darkgrey: { hue: 0.6, sat: 0.06, value: 0.26, metal: 0.4, glow: 0 },
  blue: { hue: 0.58, sat: 0.85, value: 0.75, metal: 0.35, glow: 0 },
  blueBright: { hue: 0.57, sat: 0.9, value: 0.98, metal: 0.3, glow: 0.35 },
  teal: { hue: 0.5, sat: 0.72, value: 0.7, metal: 0.3, glow: 0 },
  green: { hue: 0.3, sat: 0.75, value: 0.6, metal: 0.25, glow: 0 },
  red: { hue: 0.0, sat: 0.8, value: 0.62, metal: 0.25, glow: 0 },
  orange: { hue: 0.07, sat: 0.88, value: 0.85, metal: 0.25, glow: 0 },
  emerald: { hue: 0.4, sat: 0.72, value: 0.6, metal: 0.25, glow: 0 },
  crimson: { hue: 0.98, sat: 0.78, value: 0.62, metal: 0.25, glow: 0 },
  gold: { hue: 0.13, sat: 0.85, value: 0.9, metal: 0.9, glow: 0 },
  chrome: { hue: 0.6, sat: 0.02, value: 0.85, metal: 0.98, glow: 0 },
};

const P2 = Math.PI / 2;
const S = (type, args, translate, material, rotate) => ({
  type,
  args,
  transform: rotate ? { translate, rotate } : { translate },
  material,
});

// Sliced shell: difference(sphere(r), wedge box that removes the −x,−z quadrant
// facing the camera) → reveals the cross-section / nested layers.
// "Sliced sphere": an outer dark shell with a camera-facing quadrant removed
// (difference with a box), revealing a smaller BRIGHT-BLUE inner sphere also
// quadrant-cut → the notch reads as a cross-section / divided sphere. Two high-
// contrast shells (skip mid-greys that would occlude the blue). Wedge removes
// the −x,−z quadrant (toward the camera at −x,−z).
function slicedSphere(center) {
  const wedge = (i) => ({
    id: `wedge${i}`,
    type: 'box',
    args: { size: [3, 6, 3] },
    transform: { translate: [-1.5, 0, -1.5] },
  });
  return [
    {
      id: 'slice-outer',
      type: 'difference',
      material: M.darkgrey,
      transform: { translate: center },
      children: [{ id: 'so', type: 'sphere', args: { radius: 1.3 } }, wedge(0)],
    },
    // inner = FULL blue sphere (uncut) so the outer's notch reveals its curved
    // surface as a glowing blue core (coplanar cuts would z-fight to grey).
    S('sphere', { radius: 0.92 }, center, M.blueBright),
  ];
}

// Cubes along a semicircle arc in the XZ plane.
function cubeArc(n, { R = 2.2, y = 0.45, size = 0.5, accent = -1 } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (0.12 + 0.76 * (i / (n - 1))); // 0.12π .. 0.88π
    out.push(
      S(
        'cube-3d',
        { count: 1, cubeSize: size },
        [R * Math.cos(a), y, -R * Math.sin(a) + R * 0.4],
        i === accent ? M.blue : M.grey,
        [0, a, 0],
      ),
    );
  }
  return out;
}

const SCENES = {
  'product-diamond': {
    title: 'Diamond Charts · 3 gems',
    cat: 'diamonds',
    subjects: [
      S(
        'diamond-3d',
        { width: 0.9, crownHeight: 0.32, pavilionHeight: 0.82, tableRatio: 0.45 },
        [-1.75, 1.05, -0.5],
        M.green,
      ),
      S(
        'diamond-3d',
        { width: 1.2, crownHeight: 0.42, pavilionHeight: 1.05, tableRatio: 0.45 },
        [-0.5, 0.95, -0.1],
        M.red,
      ),
      S(
        'diamond-3d',
        { width: 1.6, crownHeight: 0.55, pavilionHeight: 1.35, tableRatio: 0.45 },
        [1.2, 1.0, 0.35],
        M.blue,
      ),
    ],
  },
  'product-cubes-flow': {
    title: 'Cubes Flow · Process row',
    cat: 'cubes',
    subjects: [
      ...[-2.4, -0.8, 0.8, 2.4].map((x, i) =>
        S('cube-3d', { count: 1, cubeSize: 0.62 }, [x, 0.6, 0], i === 3 ? M.blue : M.teal),
      ),
      ...[-1.6, 0, 1.6].map((x) =>
        S(
          'arrow-3d',
          { length: 0.7, shaftWidth: 0.14, headLength: 0.3, headWidth: 0.4, depth: 0.2 },
          [x, 0.6, 0],
          M.orange,
        ),
      ),
    ],
  },
  'product-cubes-arc': {
    title: 'Cubes Semi-Circle · Arc of 7',
    cat: 'cubes',
    subjects: cubeArc(7, { R: 2.3, y: 0.45, size: 0.5, accent: 3 }),
  },
  'product-spheres-sliced': {
    title: 'Spheres Sliced · Nested cross-section',
    cat: 'spheres',
    subjects: slicedSphere([0, 1.1, 0]),
  },
  'product-cubes-grid': {
    title: 'Cubes Shapes · 3×3×3 + accents',
    cat: 'cubes',
    subjects: [
      S(
        'cube-3d',
        { count: 27, arrangement: 'grid3d', cubeSize: 0.42, spacing: 0.14 },
        [0, 1.1, 0],
        M.darkgrey,
      ),
      // blue accent cubes occupying a few grid cells (stride = 0.42 + 0.14 = 0.56)
      S('cube-3d', { count: 1, cubeSize: 0.42 }, [0.56, 1.66, 0.56], M.blue),
      S('cube-3d', { count: 1, cubeSize: 0.42 }, [-0.56, 0.54, 0.56], M.blue),
      S('cube-3d', { count: 1, cubeSize: 0.42 }, [0.56, 1.1, -0.56], M.blue),
    ],
  },
  'product-puzzle': {
    title: 'Puzzle 3D · Interlocking + lifted',
    cat: 'puzzles',
    subjects: [
      S('puzzle-piece-3d', { size: 1.0, depth: 0.32, knob: 0.24 }, [-1.5, 0.7, 0], M.blue),
      S('puzzle-piece-3d', { size: 1.0, depth: 0.32, knob: 0.24 }, [-0.5, 0.7, 0], M.orange),
      S('puzzle-piece-3d', { size: 1.0, depth: 0.32, knob: 0.24 }, [0.5, 0.7, 0], M.emerald),
      // the 4th piece lifted up out of its slot (solution / missing-piece motif)
      S('puzzle-piece-3d', { size: 1.0, depth: 0.32, knob: 0.24 }, [1.5, 1.55, 0.15], M.gold),
    ],
  },
  'product-arrow': {
    title: 'Arrow Toolbox · Rising arrow',
    cat: 'arrows',
    subjects: [
      S(
        'arrow-3d',
        { length: 1.1, shaftWidth: 0.22, headLength: 0.5, headWidth: 0.7, depth: 0.3 },
        [-0.7, 0.5, -0.5],
        M.grey,
        [0, 0, 0.5],
      ),
      S(
        'arrow-3d',
        { length: 1.5, shaftWidth: 0.3, headLength: 0.6, headWidth: 0.95, depth: 0.34 },
        [-0.3, 0.8, -0.2],
        M.darkgrey,
        [0, 0, 0.5],
      ),
      S(
        'arrow-3d',
        { length: 2.4, shaftWidth: 0.42, headLength: 0.95, headWidth: 1.3, depth: 0.42 },
        [0.2, 1.2, 0.2],
        M.blue,
        [0, 0, 0.52],
      ),
    ],
  },
  // ---- Round 2: remaining 3D shape products (2026-06-21) ----
  'product-gearwheels': {
    title: 'Gear Wheels 3D · Meshing (grey + blue)',
    cat: 'gear wheels',
    subjects: [
      S(
        'gear-3d',
        {
          teeth: 16,
          radius: 0.95,
          thickness: 0.3,
          toothDepth: 0.18,
          toothWidth: 0.2,
          holeRadius: 0.32,
        },
        [0, 1.0, 0],
        M.grey,
        [P2, 0, 0],
      ),
      S(
        'gear-3d',
        {
          teeth: 11,
          radius: 0.66,
          thickness: 0.3,
          toothDepth: 0.16,
          toothWidth: 0.18,
          holeRadius: 0.24,
        },
        [1.5, 1.55, 0],
        M.blue,
        [P2, 0, 0],
      ),
      S(
        'gear-3d',
        {
          teeth: 9,
          radius: 0.55,
          thickness: 0.3,
          toothDepth: 0.15,
          toothWidth: 0.17,
          holeRadius: 0.2,
        },
        [-1.2, 0.45, 0],
        M.grey,
        [P2, 0, 0],
      ),
    ],
  },
  'product-chrome-spheres': {
    title: 'Chrome Spheres · Receding row',
    cat: 'spheres',
    subjects: [
      S('sphere', { radius: 0.68 }, [1.3, 0.75, 0.5], M.green),
      S('sphere', { radius: 0.54 }, [0.3, 0.85, 0.0], M.chrome),
      S('sphere', { radius: 0.44 }, [-0.5, 0.92, -0.4], M.chrome),
      S('sphere', { radius: 0.35 }, [-1.1, 1.0, -0.8], M.chrome),
      S('sphere', { radius: 0.28 }, [-1.6, 1.05, -1.1], M.chrome),
      S('sphere', { radius: 0.22 }, [-2.0, 1.1, -1.4], M.chrome),
    ],
  },
  'product-spheres': {
    title: '3D Spheres · Colour cluster',
    cat: 'spheres',
    subjects: [
      S('sphere', { radius: 0.85 }, [0, 1.0, 0], M.blue),
      S('sphere', { radius: 0.6 }, [-1.5, 0.78, 0.2], M.green),
      S('sphere', { radius: 0.55 }, [1.4, 0.82, -0.1], M.orange),
      S('sphere', { radius: 0.42 }, [0.6, 1.5, -0.3], M.grey),
      S('sphere', { radius: 0.4 }, [-0.8, 1.45, -0.2], M.teal),
    ],
  },
  'product-spheres-network': {
    title: '3D Spheres · Network',
    cat: 'spheres',
    subjects: [
      S(
        'sphere-network-3d',
        { count: 6, hubRadius: 0.45, satelliteRadius: 0.26, radius: 1.5, linkThickness: 0.05 },
        [0, 1.3, 0],
        M.blue,
      ),
    ],
  },
  'product-spheres-tree': {
    title: '3D Spheres · Tree structure',
    cat: 'spheres',
    subjects: [
      S(
        'sphere-tree-3d',
        { levels: 3, branching: 2, rootRadius: 0.4, levelHeight: 1.0, spread: 3.0 },
        [0, 1.6, 0],
        M.blue,
      ),
    ],
  },
  'product-circles-segmented': {
    title: '3D Circles · Segmented ring',
    cat: 'circles',
    subjects: [
      S(
        'circle-segmented-3d',
        { segments: 6, radius: 1.05, innerRatio: 0.5, thickness: 0.28, gapWidth: 0.14 },
        [0, 1.0, 0],
        M.blue,
        [P2, 0, 0],
      ),
    ],
  },
  'product-circle-shapes': {
    title: '3D Circle Shapes · Layered stack',
    cat: 'circles',
    subjects: [
      S(
        'circle-stack-3d',
        { count: 5, radius: 0.95, taper: 0.82, diskHeight: 0.18, gap: 0.12 },
        [0, 0.6, 0],
        M.teal,
      ),
    ],
  },
  'product-cubes-segmented': {
    title: '3D Cubes · Segmented',
    cat: 'cubes',
    subjects: [
      S('cube-segmented-3d', { segments: 5, size: 1.6, gap: 0.12, axis: 'x' }, [0, 0.9, 0], M.blue),
    ],
  },
  'product-puzzle-toolbox': {
    title: 'Puzzle Toolbox 3D · Row of 5',
    cat: 'puzzles',
    subjects: ['blue', 'orange', 'emerald', 'crimson', 'gold'].map((c, i) =>
      S('puzzle-piece-3d', { size: 1.0, depth: 0.3, knob: 0.24 }, [(i - 2) * 1.0, 0.8, 0], M[c]),
    ),
  },
  'product-circle-looping': {
    title: 'Circle Charts · Looping cycle',
    cat: 'circles',
    subjects: [
      S(
        'circle-loop-3d',
        { segments: 5, radius: 1.0, tube: 0.08, headLength: 0.36, headRadius: 0.18 },
        [0, 1.0, 0],
        M.blue,
        [P2, 0, 0],
      ),
    ],
  },
};

// ---- build + write + register -----------------------------------------------
const indexPath = `${OUT_DIR}/index.json`;
const index = JSON.parse(readFileSync(indexPath, 'utf8'));
let wrote = 0;
for (const [id, def] of Object.entries(SCENES)) {
  const ys = def.subjects.map((s) => s.transform.translate[1]);
  const ty = ys.reduce((a, b) => a + b, 0) / ys.length;
  const entry = {
    id,
    title: def.title,
    prompt: `${def.cat}: ${def.title}`,
    code2d: `// vision-authored pixel-align of a PresentationLoad product cover ("${def.cat}").`,
    sceneData: {
      v: 1,
      name: def.title,
      source: { format: 'vision-authored', prompt: `${def.cat} product cover pixel-align` },
      subjects: def.subjects.map((s, i) => ({ id: `s${i}`, ...s })),
      defaults: {
        camera: {
          yaw: 0.5,
          pitch: 0.3,
          distance: 10,
          focal: 1.5,
          targetX: 0,
          targetY: ty,
          targetZ: 0,
        },
        light: { azimuth: 0.6, altitude: 0.55, distance: 25, intensity: 1.2 },
        shadow: { enabled: true, mode: 'darken', strength: 0.4 },
        studioBg: 'dark',
      },
    },
    meta: { generatedAt: '2026-06-21', model: 'vision-authored', pattern: def.cat, costUSD: 0 },
  };
  writeFileSync(`${OUT_DIR}/${id}.json`, JSON.stringify(entry, null, 2) + '\n');
  wrote++;
  if (!index.demos.some((d) => d.id === id)) {
    index.demos.push({
      id,
      title: def.title,
      thesisPoint: `Pixel-align recreation of PresentationLoad "${def.cat}" product cover — Atlas atoms + dark studio.`,
      category: 'product-pixel-align',
      status: 'ready',
      file: `${id}.json`,
      renderer: 'studio',
      prompt: def.title,
    });
  }
}
writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
console.log(`wrote ${wrote} product scenes; index now ${index.demos.length} demos`);
