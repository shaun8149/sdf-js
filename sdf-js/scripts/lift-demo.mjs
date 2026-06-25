// lift-demo.mjs — end-to-end demo of the 2D→3D twin lift.
//
// Feeds a handful of *structure/data only* 2D scenes (exactly what the 2D scaffold
// end emits: an atom type + its data args, no geometry) through liftSceneData2dTo3d
// and writes the resulting 3D studio scenes to scenes/lifted-*.json — renderable at
//   ?scene=lifted-<name>
//
// Run: node sdf-js/scripts/lift-demo.mjs   (from repo root)

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { liftSceneData2dTo3d } from '../src/scene/lift-2d-to-3d.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENES = resolve(__dirname, '../scenes');

// ── 2D input: pure structure + data (no positions, no geometry) ──
const SAMPLES = [
  {
    name: 'sales-funnel',
    subjects: [{
      type: 'funnel',
      args: {
        title: 'Sales Funnel',
        stages: [
          { label: 'Awareness' }, { label: 'Interest' },
          { label: 'Decision' }, { label: 'Action' },
        ],
      },
    }],
  },
  {
    name: 'cloud-share',
    subjects: [{
      type: 'pie',
      args: {
        title: 'Cloud Market Share',
        values: [35, 25, 22, 18], labels: ['AWS', 'Azure', 'GCP', 'Other'], format: 'percent',
      },
    }],
  },
  {
    name: 'quarterly',
    subjects: [{
      type: 'bar',
      args: { title: 'Quarterly Revenue', values: [40, 65, 85, 55, 90], format: 'percent' },
    }],
  },
  {
    name: 'roadmap',
    subjects: [{
      type: 'timeline',
      args: {
        title: 'Product Roadmap',
        events: [{ label: '2021' }, { label: '2022' }, { label: '2023' }, { label: '2024' }, { label: '2025' }],
      },
    }],
  },
];

for (const s of SAMPLES) {
  const lifted = liftSceneData2dTo3d(s);
  const path = resolve(SCENES, `lifted-${s.name}.json`);
  writeFileSync(path, `${JSON.stringify(lifted, null, 2)}\n`);
  console.log(`  ✓ ${s.subjects[0].type} (2D) → ${lifted.subjects[0].type} (3D)  →  scenes/lifted-${s.name}.json`);
}
console.log(`\n${SAMPLES.length} scenes lifted. View: ?scene=lifted-sales-funnel  (etc.)`);
