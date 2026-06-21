#!/usr/bin/env node
// =============================================================================
// gen-data-labels-charts.mjs — labeled charts using the shared data-labels
// placement helper. Generalizes the bar prototype across chart types.
//
// HARD CONSTRAINT FOUND (real-browser GPU, 2026-06-21):
//   SDF text-3d-pipe labels DO NOT co-exist with the LOOP/array chart atoms
//   (bar-3d / line-3d / column-3d use a float[32] value loop). Even ONE label
//   on a bar-3d overflows the single studio shader — the loop's instruction
//   count + a glyph SDF together blow the GPU limit, though each renders fine
//   alone. NON-loop atoms (pie-3d = a plain disc formula) tolerate SDF labels.
// → Routing (matches the two-text-systems escape hatch):
//   • pie / radial / any non-loop atom → SDF labels OK (labels-pie).
//   • bar / column / line → build the bars from PLAIN BOXES (no loop atom) and
//     label those (labels-bar), OR send labels to the overlay layer.
// The anchor math in data-labels.mjs is correct for all four (validated); the
// constraint is purely the GPU shader budget of loop-atom + glyph.
//
// Usage: node sdf-js/scripts/gen-data-labels-charts.mjs
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { compile } from '../src/scene/index.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';
import { barAnchors, pieAnchors, placeLabels } from './lib/data-labels.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../examples/compositor/demo-lifts');
const BLUE = { hue: 0.58, sat: 0.85, value: 0.75, metal: 0.3, glow: 0 };

function wrap(id, title, subjects, camera) {
  return {
    id,
    title,
    prompt: title,
    code2d: `// ${title} (data-labels helper).`,
    sceneData: {
      v: 1,
      name: title,
      source: { format: 'authored', prompt: title },
      subjects,
      defaults: {
        camera,
        light: { azimuth: 0.6, altitude: 0.55, distance: 25, intensity: 1.2 },
        shadow: { enabled: true, mode: 'darken', strength: 0.4 },
        studioBg: 'dark',
      },
    },
    meta: { generatedAt: '2026-06-21', model: 'authored', pattern: 'data-labels', costUSD: 0 },
  };
}
const cam = (ty, dist) => ({
  yaw: 0.4,
  pitch: 0.2,
  distance: dist,
  focal: 1.5,
  targetX: 0,
  targetY: ty,
  targetZ: 0,
});

const REV = [0.4, 0.66, 1.0, 0.6, 0.78];
const REV_L = ['$1.2M', '$2.0M', '$3.4M', '$1.8M', '$2.6M'];
const PIE = [0.35, 0.25, 0.22, 0.18];
const PIE_L = ['35%', '25%', '22%', '18%'];

// ---- labels-bar: PLAIN BOXES (no loop atom) + labels (GPU-safe) -------------
const BAR = { barWidth: 0.5, barDepth: 0.5, gap: 0.45, maxHeight: 2.2 };
const N = REV.length;
const totalX = N * BAR.barWidth + (N - 1) * BAR.gap;
const xStart = -totalX / 2 + BAR.barWidth / 2;
const barBoxes = REV.map((v, i) => {
  const h = v * BAR.maxHeight;
  return {
    id: `bar${i}`,
    type: 'box',
    args: { size: [BAR.barWidth, h, BAR.barDepth] },
    transform: { translate: [xStart + i * (BAR.barWidth + BAR.gap), h / 2, 0] },
    material: BLUE,
  };
});
const barLabels = placeLabels(barAnchors(REV, BAR), REV_L, { height: 0.3, pipeRadius: 0.05 });

// ---- labels-pie: pie-3d ATOM (non-loop) + labels (GPU-safe) ------------------
const PIE_ARGS = { values: PIE, outerRadius: 1.1, innerRadius: 0.4, thickness: 0.35 };
const pieSubj = {
  id: 'pie',
  type: 'pie-3d',
  args: PIE_ARGS,
  transform: { translate: [0, 1.4, 0] },
  material: BLUE,
};
const pieLabels = placeLabels(
  pieAnchors(PIE, { outerRadius: 1.1, thickness: 0.35 }).map((a) => ({
    x: a.x,
    y: a.y + 1.4,
    z: a.z,
  })),
  PIE_L,
  { height: 0.3, pipeRadius: 0.05 },
);

const charts = [
  wrap(
    'labels-bar',
    'Bar chart · value labels (box bars)',
    [...barBoxes, ...barLabels],
    cam(1.4, 9),
  ),
  wrap('labels-pie', 'Pie chart · slice labels', [pieSubj, ...pieLabels], cam(1.4, 8)),
];

// build + measure + register
const idxPath = `${OUT}/index.json`;
const index = JSON.parse(readFileSync(idxPath, 'utf8'));
for (const c of charts) {
  const compiled = compile(c.sceneData);
  const g = compileSDF3ToGLSL(compiled.sdf, {
    sceneFnName: 'sceneSDF',
    includeLibrary: true,
    emitObjectIndex: true,
  });
  const len = (typeof g === 'string' ? g : g.glsl).length;
  const e = compiled.sanityResult ? compiled.sanityResult.errors.length : 0;
  console.log(`${c.id.padEnd(12)} ${c.sceneData.subjects.length} subj  GLSL ${len}  E${e}`);
  writeFileSync(`${OUT}/${c.id}.json`, JSON.stringify(c, null, 2) + '\n');
  if (!index.demos.some((d) => d.id === c.id)) {
    index.demos.push({
      id: c.id,
      title: c.title,
      thesisPoint:
        'Data labels bound to chart geometry → SDF (non-loop atoms / box charts only; loop atoms overflow).',
      category: 'data-labels',
      status: 'ready',
      file: `${c.id}.json`,
      renderer: 'studio',
      prompt: c.title,
    });
  }
}
writeFileSync(idxPath, JSON.stringify(index, null, 2) + '\n');
console.log(`wrote ${charts.length} labeled charts; index now ${index.demos.length} demos`);
