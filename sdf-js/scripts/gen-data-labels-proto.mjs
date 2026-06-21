#!/usr/bin/env node
// =============================================================================
// gen-data-labels-proto.mjs — PROTOTYPE for the "data labels via SDF" half of
// the two-text-systems plan (the other half — narrative text — is the overlay
// caption, already shipped). Validates two things WITHOUT waiting for the 2D
// args data-model rewrite:
//   1. PLACEMENT — a helper that, given a bar chart's values + labels, emits a
//      text-3d-pipe label above each bar, centred + facing the −z camera.
//   2. SHADER COST — measures the added GLSL per label so we can set a hard
//      "max N labels per chart" budget (SDF glyphs are the heaviest atom; the
//      two-text-systems note warns this can re-hit the shader wall).
// Labels are HARDCODED here; when the data model lands, swap in real labels —
// mechanical.
//
// Usage: node sdf-js/scripts/gen-data-labels-proto.mjs
// =============================================================================

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { compile } from '../src/scene/index.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../examples/compositor/demo-lifts');

const M = {
  blue: { hue: 0.58, sat: 0.85, value: 0.75, metal: 0.3, glow: 0 },
  label: { hue: 0, sat: 0, value: 1, metal: 0, glow: 0.28 },
};

// a bar chart from values, with a value label above each bar.
const VALUES = [0.4, 0.66, 1.0, 0.6, 0.78];
const LABELS = ['$1.2M', '$2.0M', '$3.4M', '$1.8M', '$2.6M'];
const BW = 0.5,
  STEP = 0.95,
  MID = (VALUES.length - 1) / 2;

// PLACEMENT HELPER — bars + (up to `nLabels`) data labels.
function chartWithLabels(nLabels) {
  const subjects = [];
  VALUES.forEach((v, i) => {
    const x = (i - MID) * STEP;
    const h = 0.4 + v * 2.2; // bar height
    subjects.push({
      id: `bar${i}`,
      type: 'box',
      args: { size: [BW, h, BW] },
      transform: { translate: [x, h / 2, 0] },
      material: M.blue,
    });
    if (i < nLabels) {
      // label sits just above the bar, on the −z (camera-facing) front, centred
      // on the bar; no rotate (rotating a pipe-glyph mirrors it). height = cap.
      subjects.push({
        id: `lbl${i}`,
        type: 'text-3d-pipe',
        args: { text: LABELS[i], height: 0.34, pipeRadius: 0.05, align: 'center' },
        transform: { translate: [x, h + 0.12, -BW / 2 - 0.1] },
        material: M.label,
      });
    }
  });
  return subjects;
}

// ---- 1. measure shader cost per label ---------------------------------------
const sd = (subjects) => ({
  v: 1,
  defaults: {
    camera: {
      yaw: 0.4,
      pitch: 0.18,
      distance: 9,
      focal: 1.5,
      targetX: 0,
      targetY: 1.4,
      targetZ: 0,
    },
    light: { altitude: 0.55, azimuth: 0.6, distance: 25, intensity: 1.2 },
  },
  subjects,
});
const glslLen = (subjects) => {
  const c = compile(sd(subjects));
  const g = compileSDF3ToGLSL(c.sdf, {
    sceneFnName: 'sceneSDF',
    includeLibrary: true,
    emitObjectIndex: true,
  });
  return (typeof g === 'string' ? g : g.glsl).length;
};
const base = glslLen(chartWithLabels(0));
console.log(`bars only (0 labels): ${base} chars`);
let prev = base;
for (let nLabels = 1; nLabels <= LABELS.length; nLabels++) {
  const len = glslLen(chartWithLabels(nLabels));
  console.log(
    `  +label ${nLabels} ("${LABELS[nLabels - 1]}"): +${len - prev} chars  (total +${len - base} over bars)`,
  );
  prev = len;
}

// ---- 2. write the full labeled chart as a viewable demo scene ---------------
const entry = {
  id: 'data-labels-proto',
  title: 'Data labels (SDF) — prototype',
  prompt: 'data-labels prototype: bar chart with SDF value labels',
  code2d: '// data-labels SDF prototype (placement + cost).',
  sceneData: {
    v: 1,
    name: 'Data labels prototype',
    source: { format: 'authored', prompt: 'data labels proto' },
    subjects: chartWithLabels(LABELS.length),
    defaults: {
      camera: {
        yaw: 0.4,
        pitch: 0.18,
        distance: 9,
        focal: 1.5,
        targetX: 0,
        targetY: 1.4,
        targetZ: 0,
      },
      light: { azimuth: 0.6, altitude: 0.55, distance: 25, intensity: 1.2 },
      shadow: { enabled: true, mode: 'darken', strength: 0.4 },
      studioBg: 'dark',
    },
  },
  meta: { generatedAt: '2026-06-21', model: 'authored', pattern: 'data-labels-proto', costUSD: 0 },
};
writeFileSync(`${OUT}/data-labels-proto.json`, JSON.stringify(entry, null, 2) + '\n');
console.log(`\nwrote data-labels-proto.json (${VALUES.length} bars + ${LABELS.length} labels)`);
