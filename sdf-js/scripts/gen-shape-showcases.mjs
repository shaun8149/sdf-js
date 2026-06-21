#!/usr/bin/env node
// =============================================================================
// gen-shape-showcases.mjs — quality 3D showcases across PresentationLoad shape
// categories (Arrows / Circles / Cubes / Pyramids / Puzzles / Gear Wheels),
// using Atlas atoms with category-appropriate materials + composition.
// "质感 first": metallic gears, glossy arrows, layered pyramids, multi-color
// puzzles, chrome rings. Studio auto-frames each scene.
//
// Usage: node sdf-js/scripts/gen-shape-showcases.mjs
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../examples/compositor/demo-lifts');
const P2 = Math.PI / 2;

// ---- material palette (inline HSV+metal for full control) -------------------
const M = {
  steel: { hue: 0.6, sat: 0.04, value: 0.62, metal: 0.95, glow: 0 },
  chrome: { hue: 0.6, sat: 0.02, value: 0.82, metal: 0.98, glow: 0 },
  gold: { hue: 0.13, sat: 0.85, value: 0.9, metal: 0.95, glow: 0 },
  copper: { hue: 0.06, sat: 0.7, value: 0.62, metal: 0.9, glow: 0 },
  azure: { hue: 0.58, sat: 0.85, value: 0.72, metal: 0.3, glow: 0 },
  teal: { hue: 0.48, sat: 0.7, value: 0.7, metal: 0.25, glow: 0 },
  orange: { hue: 0.07, sat: 0.88, value: 0.88, metal: 0.2, glow: 0 },
  emerald: { hue: 0.38, sat: 0.72, value: 0.62, metal: 0.2, glow: 0 },
  violet: { hue: 0.75, sat: 0.55, value: 0.64, metal: 0.2, glow: 0 },
  crimson: { hue: 0.0, sat: 0.78, value: 0.7, metal: 0.2, glow: 0 },
  white: 'porcelain',
};

const S = (type, args, translate, material, rotate) => ({
  type,
  args,
  transform: rotate ? { translate, rotate } : { translate },
  material,
});

// ---- scenes (category → composed subjects) ----------------------------------
const SCENES = {
  // ---------- GEAR WHEELS ----------
  'shape-gear-mechanism': {
    title: 'Gears · Meshing mechanism',
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
        M.steel,
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
        M.gold,
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
        M.copper,
        [P2, 0, 0],
      ),
    ],
  },
  'shape-gear-hero': {
    title: 'Gears · Single hero gear',
    cat: 'gear wheels',
    subjects: [
      S(
        'gear-3d',
        {
          teeth: 18,
          radius: 1.1,
          thickness: 0.34,
          toothDepth: 0.2,
          toothWidth: 0.2,
          holeRadius: 0.4,
        },
        [0, 1.0, 0],
        M.chrome,
        [P2, 0, 0],
      ),
    ],
  },
  // ---------- ARROWS ----------
  'shape-arrows-cycle': {
    title: 'Arrows · Cycle (4 stage)',
    cat: 'arrows',
    subjects: [
      S(
        'circle-loop-3d',
        { segments: 4, radius: 0.95, tube: 0.09, headLength: 0.4, headRadius: 0.2 },
        [0, 1.0, 0],
        M.azure,
        [P2, 0, 0],
      ),
    ],
  },
  'shape-arrows-row': {
    title: 'Arrows · Process row',
    cat: 'arrows',
    subjects: [
      S(
        'arrow-3d',
        { length: 1.3, shaftWidth: 0.26, headLength: 0.5, headWidth: 0.66, depth: 0.3 },
        [-1.5, 0.9, 0],
        M.azure,
      ),
      S(
        'arrow-3d',
        { length: 1.3, shaftWidth: 0.26, headLength: 0.5, headWidth: 0.66, depth: 0.3 },
        [0, 0.9, 0],
        M.teal,
      ),
      S(
        'arrow-3d',
        { length: 1.3, shaftWidth: 0.26, headLength: 0.5, headWidth: 0.66, depth: 0.3 },
        [1.5, 0.9, 0],
        M.orange,
      ),
    ],
  },
  // ---------- CUBES ----------
  'shape-cubes-row': {
    title: 'Cubes · Connected row',
    cat: 'cubes',
    subjects: [
      S(
        'cube-3d',
        { count: 4, arrangement: 'row', cubeSize: 0.62, spacing: 0.5, connector: 'pipe-through' },
        [0, 0.6, 0],
        M.azure,
      ),
    ],
  },
  'shape-cubes-grid': {
    title: 'Cubes · 3×3×3 grid',
    cat: 'cubes',
    subjects: [
      S(
        'cube-3d',
        { count: 27, arrangement: 'grid3d', cubeSize: 0.42, spacing: 0.12 },
        [0, 1.0, 0],
        M.chrome,
      ),
    ],
  },
  // ---------- PYRAMIDS ----------
  'shape-pyramid-stepped': {
    title: 'Pyramids · Stepped 5-level',
    cat: 'pyramids',
    subjects: [
      S(
        'pyramid-3d',
        { levels: 5, baseWidth: 2.2, topWidth: 0.4, layerHeight: 0.34, gap: 0.1, depth: 0.7 },
        [0, 0.1, 0],
        M.gold,
      ),
    ],
  },
  'shape-pyramid-smooth': {
    title: 'Pyramids · Smooth 4-level',
    cat: 'pyramids',
    subjects: [
      S(
        'pyramid-3d',
        { levels: 4, baseWidth: 2.0, topWidth: 0.3, layerHeight: 0.4, gap: 0.04, depth: 0.6 },
        [0, 0.1, 0],
        M.azure,
      ),
    ],
  },
  // ---------- PUZZLES ----------
  'shape-puzzle-row': {
    title: 'Puzzles · Interlocking row of 4',
    cat: 'puzzles',
    subjects: [
      S('puzzle-piece-3d', { size: 1.0, depth: 0.3, knob: 0.24 }, [-1.5, 0.9, 0], M.azure),
      S('puzzle-piece-3d', { size: 1.0, depth: 0.3, knob: 0.24 }, [-0.5, 0.9, 0], M.orange),
      S('puzzle-piece-3d', { size: 1.0, depth: 0.3, knob: 0.24 }, [0.5, 0.9, 0], M.emerald),
      S('puzzle-piece-3d', { size: 1.0, depth: 0.3, knob: 0.24 }, [1.5, 0.9, 0], M.crimson),
    ],
  },
  'shape-puzzle-pair': {
    title: 'Puzzles · Two-piece fit',
    cat: 'puzzles',
    subjects: [
      S('puzzle-piece-3d', { size: 1.3, depth: 0.36, knob: 0.3 }, [-0.65, 0.95, 0], M.azure),
      S('puzzle-piece-3d', { size: 1.3, depth: 0.36, knob: 0.3 }, [0.65, 0.95, 0], M.gold),
    ],
  },
  // ---------- CIRCLES ----------
  'shape-circles-dial': {
    title: 'Circles · Segmented dial (6)',
    cat: 'circles',
    subjects: [
      S(
        'circle-segmented-3d',
        { segments: 6, radius: 1.0, innerRatio: 0.5, thickness: 0.26, gapWidth: 0.14 },
        [0, 1.0, 0],
        M.azure,
        [P2, 0, 0],
      ),
    ],
  },
  'shape-circles-frames': {
    title: 'Circles · Avatar frames (3)',
    cat: 'circles',
    subjects: [
      S(
        'circle-frame-3d',
        { radius: 0.62, frameWidth: 0.14, backDepth: 0.08 },
        [-1.5, 1.0, 0],
        M.steel,
      ),
      S(
        'circle-frame-3d',
        { radius: 0.62, frameWidth: 0.14, backDepth: 0.08 },
        [0, 1.0, 0],
        M.gold,
      ),
      S(
        'circle-frame-3d',
        { radius: 0.62, frameWidth: 0.14, backDepth: 0.08 },
        [1.5, 1.0, 0],
        M.steel,
      ),
    ],
  },
  'shape-circles-stack': {
    title: 'Circles · Tiered stack',
    cat: 'circles',
    subjects: [
      S(
        'circle-stack-3d',
        { count: 4, radius: 0.85, taper: 0.8, diskHeight: 0.2, gap: 0.1 },
        [0, 0.5, 0],
        M.teal,
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
    code2d: `// vision-authored showcase — PresentationLoad shape category "${def.cat}".`,
    sceneData: {
      v: 1,
      name: def.title,
      source: { format: 'vision-authored', prompt: `${def.cat} shape showcase` },
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
        studioBg: 'dark', // dramatic showcase background (matches the source deck)
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
      thesisPoint: `Atlas shape showcase — PresentationLoad "${def.cat}" category, quality material + composition, studio auto-framed.`,
      category: 'shape-showcase',
      status: 'ready',
      file: `${id}.json`,
      renderer: 'studio',
      prompt: def.title,
    });
  }
}
writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
console.log(`wrote ${wrote} shape showcases; index now ${index.demos.length} demos`);
