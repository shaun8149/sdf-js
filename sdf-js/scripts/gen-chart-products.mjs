#!/usr/bin/env node
// =============================================================================
// gen-chart-products.mjs — dark dramatic product covers for the PresentationLoad
// "Charts & Diagrams" category. Nearly every product maps to an existing Atlas
// chart atom; this sweeps the category like the shapes one. Plus the new
// gauge-3d atom (cockpit) + a few multi-subject compositions.
//
// Usage: node sdf-js/scripts/gen-chart-products.mjs
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../examples/compositor/demo-lifts');
const P2 = Math.PI / 2;

const M = {
  grey: { hue: 0.6, sat: 0.05, value: 0.4, metal: 0.5, glow: 0 },
  blue: { hue: 0.58, sat: 0.85, value: 0.75, metal: 0.3, glow: 0 },
  teal: { hue: 0.5, sat: 0.72, value: 0.7, metal: 0.28, glow: 0 },
  green: { hue: 0.33, sat: 0.8, value: 0.62, metal: 0.2, glow: 0.1 },
  red: { hue: 0.0, sat: 0.82, value: 0.62, metal: 0.2, glow: 0.1 },
  amber: { hue: 0.11, sat: 0.9, value: 0.85, metal: 0.2, glow: 0.1 },
  orange: { hue: 0.07, sat: 0.88, value: 0.85, metal: 0.25, glow: 0 },
  gold: { hue: 0.13, sat: 0.85, value: 0.9, metal: 0.9, glow: 0 },
};

const S = (type, args, translate, material, rotate) => ({
  type,
  args,
  transform: rotate ? { translate, rotate } : { translate },
  material,
});

const SCENES = {
  // ---- direct single-atom maps ----
  'chart-data-bars': {
    title: 'Data Driven · 3D Bars',
    cat: 'data',
    subjects: [
      S(
        'bar-3d',
        { values: [0.4, 0.7, 1.0, 0.55, 0.85], barWidth: 0.45, gap: 0.18 },
        [0, 0.1, 0],
        M.blue,
      ),
    ],
  },
  'chart-data-columns': {
    title: 'Data Driven · Columns',
    cat: 'data',
    subjects: [
      S(
        'column-3d',
        { values: [0.4, 0.6, 0.85, 0.5, 0.75], barWidth: 0.36, gap: 0.16 },
        [0, 0.9, 0],
        M.teal,
      ),
    ],
  },
  'chart-pie': {
    title: 'Pie / Donut Chart',
    cat: 'data',
    subjects: [
      S(
        'pie-3d',
        {
          values: [0.32, 0.24, 0.2, 0.14, 0.1],
          outerRadius: 1.1,
          innerRadius: 0.4,
          thickness: 0.4,
        },
        [0, 0.8, 0],
        M.blue,
        [P2, 0, 0],
      ),
    ],
  },
  'chart-line': {
    title: 'Line / Trend Chart',
    cat: 'data',
    subjects: [
      S(
        'line-3d',
        { values: [0.3, 0.5, 0.45, 0.7, 0.6, 0.9], pointSpacing: 0.6 },
        [0, 0.1, 0],
        M.blue,
      ),
    ],
  },
  'chart-bcg-matrix': {
    title: 'BCG Matrix (2×2)',
    cat: 'matrix',
    subjects: [
      S('matrix-grid-3d', { rows: 2, cols: 2, cardW: 0.95, cardH: 0.75 }, [0, 0.95, 0], M.blue),
    ],
  },
  'chart-nine-field': {
    title: 'Nine-Field Matrix (3×3)',
    cat: 'matrix',
    subjects: [
      S('matrix-grid-3d', { rows: 3, cols: 3, cardW: 0.7, cardH: 0.6 }, [0, 1.05, 0], M.teal),
    ],
  },
  'chart-fishbone': {
    title: 'Fishbone / Ishikawa',
    cat: 'diagrams',
    subjects: [S('fishbone-3d', { ribs: 6 }, [0, 0.9, 0], M.blue)],
  },
  'chart-radial': {
    title: 'Radial Diagram',
    cat: 'diagrams',
    subjects: [S('radial-spoke-3d', { spokes: 8 }, [0, 1.2, 0], M.blue)],
  },
  'chart-scatter': {
    title: 'Scatter Plot',
    cat: 'data',
    subjects: [S('scatter-3d', { count: 16, spread: 1.5 }, [0, 1.5, 0], M.blue)],
  },
  'chart-waterfall': {
    title: 'Waterfall Diagram',
    cat: 'data',
    subjects: [S('waterfall-3d', { count: 6 }, [0, 0.1, 0], M.blue)],
  },
  'chart-gantt': {
    title: 'Gantt Chart',
    cat: 'data',
    subjects: [S('gantt-3d', { tasks: 5 }, [0, 0.9, 0], M.blue)],
  },
  'chart-venn': {
    title: 'Venn Diagram',
    cat: 'diagrams',
    subjects: [S('venn-3d', { sets: 3 }, [0, 1.1, 0], M.blue)],
  },
  'chart-tree': {
    title: 'Tree Diagram',
    cat: 'diagrams',
    subjects: [S('tree-diagram-3d', { levels: 3, branching: 2 }, [0, 0.9, 0], M.blue)],
  },
  'chart-timeline': {
    title: 'Project Timeline',
    cat: 'timelines',
    subjects: [S('timeline-3d', { count: 5 }, [0, 0.9, 0], M.blue)],
  },
  'chart-org': {
    title: 'Org Chart 3D',
    cat: 'hierarchy',
    subjects: [S('org-chart-3d', { levels: 3, branching: 2 }, [0, 1.1, 0], M.blue)],
  },
  'chart-layers': {
    title: '3D Layers Parallel',
    cat: 'layers',
    subjects: [S('layer-stack-3d', { layers: 5, layerW: 2.0, layerD: 1.3 }, [0, 0.8, 0], M.teal)],
  },
  'chart-list': {
    title: 'List Templates',
    cat: 'lists',
    subjects: [S('bullet-list-3d', { items: 5 }, [0, 1.1, 0], M.blue)],
  },
  'chart-7s': {
    title: '7-S Model',
    cat: 'diagrams',
    subjects: [S('relationship-graph-3d', { count: 7, radius: 1.4 }, [0, 1.2, 0], M.blue)],
  },
  'chart-gauge': {
    title: 'KPI Gauge',
    cat: 'data',
    subjects: [S('gauge-3d', { value: 0.72 }, [0, 1.0, 0], M.blue)],
  },

  // ---- multi-subject compositions ----
  'chart-traffic-light': {
    title: 'Traffic Light Chart',
    cat: 'data',
    subjects: [
      S('box', { size: [0.7, 1.7, 0.35] }, [0, 1.0, 0], M.grey),
      S('sphere', { radius: 0.22 }, [0, 1.5, -0.18], M.red),
      S('sphere', { radius: 0.22 }, [0, 1.0, -0.18], M.amber),
      S('sphere', { radius: 0.22 }, [0, 0.5, -0.18], M.green),
    ],
  },
  'chart-cockpit': {
    title: 'Cockpit Dashboard · gauges',
    cat: 'data',
    subjects: [
      S(
        'gauge-3d',
        { value: 0.45, radius: 0.7, tube: 0.08, needleLen: 0.6 },
        [-1.9, 1.0, 0],
        M.teal,
      ),
      S('gauge-3d', { value: 0.7, radius: 0.7, tube: 0.08, needleLen: 0.6 }, [0, 1.0, 0], M.blue),
      S(
        'gauge-3d',
        { value: 0.92, radius: 0.7, tube: 0.08, needleLen: 0.6 },
        [1.9, 1.0, 0],
        M.green,
      ),
    ],
  },
  'chart-multiple-arrows': {
    title: 'Multiple Arrows',
    cat: 'arrows',
    subjects: [
      S(
        'arrow-3d',
        { length: 1.1, shaftWidth: 0.22, headLength: 0.45, headWidth: 0.6, depth: 0.28 },
        [0.95, 1.0, 0],
        M.blue,
        [0, 0, 0],
      ),
      S(
        'arrow-3d',
        { length: 1.1, shaftWidth: 0.22, headLength: 0.45, headWidth: 0.6, depth: 0.28 },
        [0, 1.95, 0],
        M.teal,
        [0, 0, P2],
      ),
      S(
        'arrow-3d',
        { length: 1.1, shaftWidth: 0.22, headLength: 0.45, headWidth: 0.6, depth: 0.28 },
        [-0.95, 1.0, 0],
        M.orange,
        [0, 0, Math.PI],
      ),
      S(
        'arrow-3d',
        { length: 1.1, shaftWidth: 0.22, headLength: 0.45, headWidth: 0.6, depth: 0.28 },
        [0, 0.05, 0],
        M.green,
        [0, 0, -P2],
      ),
    ],
  },
  'chart-break-even': {
    title: 'Break-Even Analysis',
    cat: 'data',
    subjects: [
      // L-shaped axes
      S('box', { size: [3.0, 0.05, 0.05] }, [0, 0.2, 0], M.grey),
      S('box', { size: [0.05, 2.0, 0.05] }, [-1.5, 1.2, 0], M.grey),
      // revenue rising / cost falling — two crossing diagonal bars
      S('box', { size: [3.2, 0.08, 0.12] }, [0, 1.15, 0], M.blue, [0, 0, 0.5]),
      S('box', { size: [3.2, 0.08, 0.12] }, [0, 1.15, 0.04], M.orange, [0, 0, -0.5]),
      // break-even point marker at the crossing
      S('sphere', { radius: 0.16 }, [0, 1.15, 0.12], M.green),
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
    code2d: `// vision-authored chart-product cover (PresentationLoad Charts & Diagrams).`,
    sceneData: {
      v: 1,
      name: def.title,
      source: { format: 'vision-authored', prompt: `${def.cat} chart product` },
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
      thesisPoint: `Charts & Diagrams category cover — Atlas chart atom + dark studio.`,
      category: 'chart-product',
      status: 'ready',
      file: `${id}.json`,
      renderer: 'studio',
      prompt: def.title,
    });
  }
}
writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
console.log(`wrote ${wrote} chart-product scenes; index now ${index.demos.length} demos`);
