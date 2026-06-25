// lift-sprint22-demo.mjs — Sprint 22 B1: lift 4 new PL-rec atoms → 3D scenes.
//
// Run: node sdf-js/scripts/lift-sprint22-demo.mjs  (from repo root)

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { liftSceneData2dTo3d } from '../src/scene/lift-2d-to-3d.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENES = resolve(__dirname, '../scenes');

const SAMPLES = [
  {
    name: 'mountain-path',
    subjects: [
      {
        type: 'mountain-path',
        args: {
          title: 'Q4 Climb to Series A',
          summit: 'Series A · $15M',
          milestones: [
            { label: '$1M ARR', sublabel: 'Mar' },
            { label: '10K users', sublabel: 'Jun' },
            { label: 'PMF', sublabel: 'Sep' },
            { label: 'Term sheet', sublabel: 'Dec' },
          ],
        },
      },
    ],
  },
  {
    name: 'strategy-map',
    subjects: [
      {
        type: 'strategy-map',
        args: {
          title: 'Strategic Objectives 2026',
          perspectives: [
            { label: 'Financial', items: ['Revenue growth 30%', 'Margin expansion'] },
            { label: 'Customer', items: ['NPS 50+', 'Retention 95%'] },
            { label: 'Internal Process', items: ['Ops efficiency', 'Quality'] },
            { label: 'Learning & Growth', items: ['Talent', 'Skills'] },
          ],
        },
      },
    ],
  },
  {
    name: 'lifted-radar',
    subjects: [
      {
        type: 'radar-chart',
        args: {
          title: 'AI Capability Assessment',
          axes: ['Speed', 'Quality', 'Cost', 'Scalability', 'UX', 'Security'],
          series: [
            { label: 'Current', values: [0.7, 0.4, 0.6, 0.3, 0.8, 0.5] },
            { label: 'Target Q4', values: [0.9, 0.7, 0.8, 0.7, 0.9, 0.8] },
          ],
          showGrid: true,
        },
      },
    ],
  },
  {
    name: 'lifted-okr-tree',
    subjects: [
      {
        type: 'okr-tree',
        args: {
          objective: 'Become market leader in self-custodial trading',
          quarter: 'Q3 2026',
          keyResults: [
            { label: 'Cross $50M ARR', progress: 0.48, sublabel: '$24M / $50M' },
            { label: 'NPS > 70', progress: 0.86, sublabel: 'Current: 68' },
            { label: '24/7 support SLA', progress: 0.65, sublabel: '4h avg vs 2h target' },
          ],
        },
      },
    ],
  },
];

for (const s of SAMPLES) {
  const lifted = liftSceneData2dTo3d(s);
  const outName = s.name.startsWith('lifted-') ? s.name : `lifted-${s.name}`;
  const path = resolve(SCENES, `${outName}.json`);
  writeFileSync(path, `${JSON.stringify(lifted, null, 2)}\n`);
  console.log(
    `  ✓ ${s.subjects[0].type} (2D) → ${lifted.subjects[0].type} (3D)  →  scenes/${outName}.json`,
  );
}
console.log(`\n${SAMPLES.length} scenes lifted.`);
