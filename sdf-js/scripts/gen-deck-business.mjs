#!/usr/bin/env node
// =============================================================================
// gen-deck-business.mjs — the CONVERGENCE demo: real-data charts (args.labels,
// auto-labelled by the #89 connector at load) strung into a spatial-narrative
// deck (deck-player.js sequences + caption + fade). A quarterly business review:
// each segment is ONE chart atom carrying args.labels + ZERO manual labels — the
// connector injects the SDF value labels when the deck loads the scene. A gentle
// pan keeps each slide alive; the deck player shows the segment title caption.
//
// Launch: ?deck=deck-business    Usage: node sdf-js/scripts/gen-deck-business.mjs
// =============================================================================

import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../examples/compositor/demo-lifts');
const BLUE = { hue: 0.58, sat: 0.85, value: 0.75, metal: 0.3, glow: 0 };

// gentle left→right pan framing a chart centred at `target`, fov in degrees.
const panSeq = (target, dur = 6) => ({
  loop: false,
  shots: [
    {
      duration: 0.01,
      pos: [target[0] - 2.6, target[1] + 1.0, -7.8],
      target,
      fov: 33,
      transition: 'cut',
    },
    {
      duration: dur,
      pos: [target[0] + 2.6, target[1] + 1.0, -7.8],
      target,
      fov: 33,
      ease: 'smooth',
      transition: 'blend',
    },
  ],
});

function scene(id, name, subject, target) {
  return {
    id,
    title: name,
    prompt: name,
    code2d: `// ${name} — chart atom + args.labels; connector auto-labels at load.`,
    sceneData: {
      v: 1,
      name,
      source: { format: 'authored', prompt: name },
      subjects: [subject],
      cameraSequence: panSeq(target),
      defaults: {
        camera: {
          yaw: 0.4,
          pitch: 0.22,
          distance: 9,
          focal: 1.5,
          targetX: 0,
          targetY: target[1],
          targetZ: 0,
        },
        light: { azimuth: 0.6, altitude: 0.55, distance: 25, intensity: 1.2 },
        shadow: { enabled: true, mode: 'darken', strength: 0.4 },
        studioBg: 'dark',
      },
    },
    meta: { generatedAt: '2026-06-22', model: 'authored', pattern: 'data-deck', costUSD: 0 },
  };
}
const S = (type, args, translate) => ({
  id: type,
  type,
  args,
  transform: { translate },
  material: BLUE,
});

const SEGMENTS = [
  {
    seg: scene(
      'deck-biz-revenue',
      'Revenue by quarter',
      S(
        'bar-3d',
        {
          values: [0.5, 0.7, 0.85, 1.0],
          labels: ['$1.2M', '$1.8M', '$2.4M', '$3.4M'],
          barWidth: 0.5,
          barDepth: 0.5,
          gap: 0.45,
          maxHeight: 2.4,
        },
        [0, 0, 0],
      ),
      [0, 1.2, 0],
    ),
    durationSec: 6.5,
  },
  {
    seg: scene(
      'deck-biz-share',
      'Market share',
      S(
        'pie-3d',
        {
          values: [0.35, 0.25, 0.22, 0.18],
          labels: ['35%', '25%', '22%', '18%'],
          outerRadius: 1.1,
          innerRadius: 0.4,
          thickness: 0.35,
        },
        [0, 1.4, 0],
      ),
      [0, 1.4, 0],
    ),
    durationSec: 6.5,
  },
  {
    seg: scene(
      'deck-biz-trend',
      'Growth trend',
      S(
        'line-3d',
        {
          values: [0.3, 0.45, 0.5, 0.7, 0.85, 1.0],
          labels: ['12', '18', '20', '28', '34', '40'],
          pointSpacing: 0.95,
          maxHeight: 2.2,
        },
        [0, 0, 0],
      ),
      [0, 1.1, 0],
    ),
    durationSec: 6.5,
  },
  {
    seg: scene(
      'deck-biz-swot',
      'SWOT',
      S(
        'matrix-grid-3d',
        {
          rows: 2,
          cols: 2,
          labels: ['S', 'W', 'O', 'T'],
          cardW: 1.1,
          cardH: 0.85,
          cardD: 0.2,
          gap: 0.22,
        },
        [0, 1.3, 0],
      ),
      [0, 1.3, 0],
    ),
    durationSec: 6.5,
  },
];

const idxPath = `${OUT}/index.json`;
const index = JSON.parse(readFileSync(idxPath, 'utf8'));
for (const { seg } of SEGMENTS) {
  writeFileSync(`${OUT}/${seg.id}.json`, JSON.stringify(seg, null, 2) + '\n');
}
const deck = {
  id: 'deck-business',
  name: 'Quarterly business review (real-data charts + spatial narrative)',
  segments: SEGMENTS.map(({ seg, durationSec }) => ({
    file: `${seg.id}.json`,
    title: seg.title,
    kind: 'slide',
    durationSec,
  })),
};
writeFileSync(`${OUT}/deck-business.json`, JSON.stringify(deck, null, 2) + '\n');
if (!index.demos.some((d) => d.id === 'deck-business')) {
  index.demos.push({
    id: 'deck-business',
    title: 'Quarterly business review (data deck)',
    thesisPoint:
      'Convergence: connector-labelled real-data charts strung into a spatial-narrative deck.',
    category: 'data-deck',
    status: 'ready',
    file: 'deck-business.json',
    renderer: 'studio',
    prompt: 'business data deck',
  });
}
writeFileSync(idxPath, JSON.stringify(index, null, 2) + '\n');
console.log(
  `wrote deck-business (${SEGMENTS.length} chart slides) + segment scenes; index now ${index.demos.length}`,
);
