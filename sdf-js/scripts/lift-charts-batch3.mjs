// lift-charts-batch3.mjs — finish the remaining PresentationLoad "Charts & Diagrams"
// 3D templates *semi-automatically*: each template is authored as 2D structure+data
// only, and the deterministic twin map (lift-2d-to-3d.js) produces the 3D scene.
//
// This is the payoff of the twin map: no hand-authored scene JSON — just data in.
//
// Run: node sdf-js/scripts/lift-charts-batch3.mjs   (from repo root)

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { liftSceneData2dTo3d } from '../src/scene/lift-2d-to-3d.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENES = resolve(__dirname, '../scenes');

// PL template :: its 2D structure (atom type + data). Nothing geometric here.
const TEMPLATES = [
  {
    name: 'step-diagram', // PL: "Step Diagram 3D" / "3D Stairs"
    subjects: [{ type: 'progression', args: {
      title: 'Step Diagram 3D',
      steps: [{ label: 'Plan' }, { label: 'Build' }, { label: 'Test' }, { label: 'Ship' }, { label: 'Scale' }],
    } }],
  },
  {
    name: 'round-plates', // PL: "3D Round Plates"
    subjects: [{ type: 'circle-stack', args: {
      title: '3D Round Plates',
      layers: [{ label: 'Tier 1' }, { label: 'Tier 2' }, { label: 'Tier 3' }, { label: 'Tier 4' }],
    } }],
  },
  {
    name: 'layer-objects', // PL: "3D Layer Objects"
    subjects: [{ type: 'layer-stack', args: {
      title: '3D Layer Objects',
      layers: [{ label: 'UI' }, { label: 'Logic' }, { label: 'Data' }, { label: 'Infra' }],
    } }],
  },
  {
    name: 'circle-segments', // PL: "Circle Segments 3D"
    subjects: [{ type: 'circle-segmented', args: {
      title: 'Circle Segments 3D',
      segments: 6, labels: ['A', 'B', 'C', 'D', 'E', 'F'],
    } }],
  },
  {
    name: 'graphs', // PL: "3D Graphs" — vertical bars read clearest front-on (+ value labels)
    subjects: [{ type: 'bar', args: {
      title: '3D Graphs', values: [50, 75, 40, 90, 65], labels: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'], format: 'number',
    } }],
  },
  {
    name: 'timeline-spheres', // PL: "Timelines - 3D Spheres"
    subjects: [{ type: 'timeline', args: {
      title: 'Timelines — 3D Spheres',
      events: [{ label: 'Kickoff' }, { label: 'Alpha' }, { label: 'Beta' }, { label: 'GA' }, { label: 'V2' }, { label: 'Scale' }],
    } }],
  },
];

const lifted = [];
for (const t of TEMPLATES) {
  const scene = liftSceneData2dTo3d(t);
  writeFileSync(resolve(SCENES, `lifted-charts-${t.name}.json`), `${JSON.stringify(scene, null, 2)}\n`);
  console.log(`  ✓ ${t.subjects[0].type.padEnd(18)} (2D data) → ${scene.subjects[0].type.padEnd(20)} → scenes/lifted-charts-${t.name}.json`);
  lifted.push(t.name);
}

// also write the deck stringing them together
const deck = {
  id: 'deck-charts-3d-3',
  name: '3D Charts & Diagrams — PresentationLoad (batch 3, lifted from data)',
  segments: [
    { file: 'lifted-charts-step-diagram.json', title: 'Step Diagram 3D', kind: 'slide', durationSec: 7 },
    { file: 'lifted-charts-round-plates.json', title: '3D Round Plates', kind: 'slide', durationSec: 7 },
    { file: 'lifted-charts-layer-objects.json', title: '3D Layer Objects', kind: 'slide', durationSec: 7 },
    { file: 'lifted-charts-circle-segments.json', title: 'Circle Segments 3D', kind: 'slide', durationSec: 7 },
    { file: 'lifted-charts-graphs.json', title: '3D Graphs', kind: 'slide', durationSec: 7 },
    { file: 'lifted-charts-timeline-spheres.json', title: 'Timelines — 3D Spheres', kind: 'slide', durationSec: 7 },
  ],
};
writeFileSync(resolve(SCENES, 'deck-charts-3d-3.json'), `${JSON.stringify(deck, null, 2)}\n`);
console.log(`\n${lifted.length} templates lifted + deck-charts-3d-3.json. View: ?deck=deck-charts-3d-3`);
