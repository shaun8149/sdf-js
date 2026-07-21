#!/usr/bin/env node
// =============================================================================
// gen-labels-overlay.mjs — a bar chart labeled via the OVERLAY path instead of
// SDF. Two reasons the labels go to the overlay, not in-scene SDF:
//   (a) SDF text-3d on a loop chart atom overflows the shader (gen-data-labels-
//       charts.mjs), and
//   (b) the loop atoms (bar-3d/line-3d/column-3d) don't even render in the studio
//       GPU shader (WebGL1 can't index their float[32] by a loop var) — so the
//       bars here are PLAIN BOXES.
// The labels live as DOM annotations (data-label-overlay.js, ?labels=labels-bar-
// overlay) projected onto the bars — zero shader cost, tracking the panning camera.
//
// The scene carries `annotations:[{pos,text}]` (bar-top anchors from the shared
// helper) alongside sceneData. Usage: node sdf-js/scripts/gen-labels-overlay.mjs
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { barAnchors } from './lib/data-labels.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../examples/compositor/demo-lifts');
const BLUE = { hue: 0.58, sat: 0.85, value: 0.75, metal: 0.3, glow: 0 };

const VALUES = [0.4, 0.66, 1.0, 0.6, 0.78];
const LABELS = ['$1.2M', '$2.0M', '$3.4M', '$1.8M', '$2.6M'];
const BAR = { barWidth: 0.5, barDepth: 0.5, gap: 0.45, maxHeight: 2.2 };

// annotations = bar-top anchors (same helper that places SDF labels), as world
// points the overlay projects to screen.
const anchors = barAnchors(VALUES, { ...BAR, margin: 0.12 });
const annotations = anchors.map((a, i) => ({ pos: [a.x, a.y, a.z], text: LABELS[i] }));

// Bars are PLAIN BOXES, not the bar-3d atom: the loop atoms (bar-3d/line-3d/
// column-3d, float[32] loop) don't even render in the studio GPU shader (WebGL1
// can't index a uniform array by a loop var) — independent of labels. So a
// labeled "bar chart" uses boxes; the overlay path is what carries the labels.
const N = VALUES.length;
const totalX = N * BAR.barWidth + (N - 1) * BAR.gap;
const xStart = -totalX / 2 + BAR.barWidth / 2;
const barBoxes = VALUES.map((v, i) => {
  const h = v * BAR.maxHeight;
  return {
    id: `bar${i}`,
    type: 'box',
    args: { size: [BAR.barWidth, h, BAR.barDepth] },
    transform: { translate: [xStart + i * (BAR.barWidth + BAR.gap), h / 2, 0] },
    material: BLUE,
  };
});

const entry = {
  id: 'labels-bar-overlay',
  title: 'Bar chart · overlay labels (camera-tracked)',
  prompt: 'bar chart labeled via DOM overlay (no SDF text), labels track the camera',
  code2d: '// box bars + overlay DOM labels (data-label-overlay.js).',
  annotations,
  sceneData: {
    v: 1,
    name: 'Bar chart · overlay labels',
    source: { format: 'authored', prompt: 'overlay labels' },
    subjects: barBoxes,
    // gentle pan so the labels visibly track the moving camera
    cameraSequence: {
      loop: true,
      shots: [
        { duration: 0.01, pos: [-2.4, 2.2, -7.5], target: [0, 1.1, 0], fov: 32, transition: 'cut' },
        {
          duration: 5,
          pos: [2.4, 2.2, -7.5],
          target: [0, 1.1, 0],
          fov: 32,
          ease: 'smooth',
          transition: 'blend',
        },
        {
          duration: 5,
          pos: [-2.4, 2.2, -7.5],
          target: [0, 1.1, 0],
          fov: 32,
          ease: 'smooth',
          transition: 'blend',
        },
      ],
    },
    defaults: {
      camera: {
        yaw: 0.4,
        pitch: 0.2,
        distance: 9,
        focal: 1.5,
        targetX: 0,
        targetY: 1.1,
        targetZ: 0,
      },
      light: { azimuth: 0.6, altitude: 0.55, distance: 25, intensity: 1.2 },
      shadow: { enabled: true, mode: 'darken', strength: 0.4 },
      studioBg: 'dark',
    },
  },
  meta: { generatedAt: '2026-06-21', model: 'authored', pattern: 'overlay-labels', costUSD: 0 },
};

writeFileSync(`${OUT}/labels-bar-overlay.json`, JSON.stringify(entry, null, 2) + '\n');
console.log(`wrote labels-bar-overlay.json (box bars + ${annotations.length} overlay labels)`);
