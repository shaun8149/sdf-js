#!/usr/bin/env node
// =============================================================================
// gen-autolabel-charts.mjs — verify the #84 expandChartLabels connector across
// the remaining chart types (pie / line / column). Each demo is ONE chart atom
// carrying args.labels and ZERO manual label subjects — the connector injects
// the SDF labels at load (loadDemoScene → expandChartLabels). The bar case ships
// as chart-autolabel-bar; this covers the other three anchor families.
//
// Usage: node sdf-js/scripts/gen-autolabel-charts.mjs
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../examples/compositor/demo-lifts');
const BLUE = { hue: 0.58, sat: 0.85, value: 0.75, metal: 0.3, glow: 0 };

const cam = (ty, dist) => ({
  yaw: 0.4,
  pitch: 0.2,
  distance: dist,
  focal: 1.5,
  targetX: 0,
  targetY: ty,
  targetZ: 0,
});

function wrap(id, title, name, subject, camera) {
  return {
    id,
    title,
    prompt: title,
    code2d: `// ${title} — one chart atom + args.labels; connector injects labels.`,
    sceneData: {
      v: 1,
      name,
      source: { format: 'authored', prompt: title },
      subjects: [subject],
      defaults: {
        camera,
        light: { azimuth: 0.6, altitude: 0.55, distance: 25, intensity: 1.2 },
        shadow: { enabled: true, mode: 'darken', strength: 0.4 },
        studioBg: 'dark',
      },
    },
    meta: { generatedAt: '2026-06-21', model: 'authored', pattern: 'chart-autolabel', costUSD: 0 },
  };
}

const DEMOS = [
  wrap(
    'chart-autolabel-pie',
    'Pie chart · auto-labels (#84 connector)',
    'compare: Market share',
    {
      id: 'pie',
      type: 'pie-3d',
      args: {
        values: [0.35, 0.25, 0.22, 0.18],
        labels: ['35%', '25%', '22%', '18%'],
        outerRadius: 1.1,
        innerRadius: 0.4,
        thickness: 0.35,
      },
      transform: { translate: [0, 1.4, 0] },
      material: BLUE,
    },
    cam(1.4, 8),
  ),
  wrap(
    'chart-autolabel-line',
    'Line chart · auto-labels (#84 connector)',
    'sequence: Monthly trend',
    {
      id: 'line',
      type: 'line-3d',
      args: {
        values: [0.3, 0.5, 0.45, 0.7, 0.6, 0.9],
        labels: ['30', '50', '45', '70', '60', '90'],
        pointSpacing: 0.95,
        maxHeight: 2.2,
      },
      transform: { translate: [0, 0, 0] },
      material: BLUE,
    },
    cam(1.3, 9),
  ),
  wrap(
    'chart-autolabel-column',
    'Column chart · auto-labels (#84 connector)',
    'compare: Quarterly figures',
    {
      id: 'col',
      type: 'column-3d',
      args: {
        values: [0.4, 0.66, 1.0, 0.6],
        labels: ['Q1', 'Q2', 'Q3', 'Q4'],
        barWidth: 0.5,
        barDepth: 0.5,
        gap: 0.45,
        maxHeight: 2.2,
      },
      transform: { translate: [0, 1.4, 0] },
      material: BLUE,
    },
    cam(1.4, 9),
  ),
];

const idxPath = `${OUT}/index.json`;
const index = JSON.parse(readFileSync(idxPath, 'utf8'));
for (const d of DEMOS) {
  writeFileSync(`${OUT}/${d.id}.json`, JSON.stringify(d, null, 2) + '\n');
  if (!index.demos.some((x) => x.id === d.id)) {
    index.demos.push({
      id: d.id,
      title: d.title,
      thesisPoint:
        '#84 connector verified across chart types — one atom + args.labels, labels auto-injected.',
      category: 'data-labels',
      status: 'ready',
      file: `${d.id}.json`,
      renderer: 'studio',
      prompt: d.title,
    });
  }
}
writeFileSync(idxPath, JSON.stringify(index, null, 2) + '\n');
console.log(
  `wrote ${DEMOS.length} auto-label demos (pie/line/column); index now ${index.demos.length} demos`,
);
