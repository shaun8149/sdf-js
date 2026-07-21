// lift-sprint22-b3-demo.mjs — Sprint 22 B3: lift 4 new PL-rec atoms + mountain-path re-lift.
//
// Run: node sdf-js/scripts/lift-sprint22-b3-demo.mjs  (from repo root)

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { liftSceneData2dTo3d } from '../src/scene/lift-2d-to-3d.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENES = resolve(__dirname, '../scenes');

const SAMPLES = [
  {
    name: 'lifted-risk-heatmap',
    subjects: [
      {
        type: 'risk-heatmap',
        args: {
          title: 'Cybersecurity Risk Assessment',
          xAxis: 'Likelihood',
          yAxis: 'Impact',
          risks: [
            { label: 'Data breach', likelihood: 4, impact: 5 },
            { label: 'Compliance fine', likelihood: 2, impact: 4 },
            { label: 'Vendor delay', likelihood: 5, impact: 2 },
            { label: 'DDoS attack', likelihood: 3, impact: 4 },
          ],
        },
      },
    ],
  },
  {
    name: 'lifted-org-vs-org',
    subjects: [
      {
        type: 'org-vs-org-matrix',
        args: {
          title: 'Competitive Positioning',
          xAxis: 'Completeness of Vision',
          yAxis: 'Ability to Execute',
          orgs: [
            { name: 'Atlas (us)', x: 0.78, y: 0.84, isUs: true },
            { name: 'Tableau', x: 0.72, y: 0.65 },
            { name: 'Looker', x: 0.6, y: 0.58 },
            { name: 'PowerBI', x: 0.55, y: 0.7 },
          ],
          quadrantLabels: {
            tl: 'Visionaries',
            tr: 'Leaders',
            bl: 'Niche Players',
            br: 'Challengers',
          },
        },
      },
    ],
  },
  {
    name: 'lifted-kanban',
    subjects: [
      {
        type: 'kanban-board',
        args: {
          title: 'Sprint 22 Engineering Board',
          columns: [
            { label: 'Backlog', cards: [{ label: 'Task A' }, { label: 'Task B' }] },
            {
              label: 'In Progress',
              accent: 'warning',
              cards: [{ label: 'Feature X', sublabel: 'Alice' }],
            },
            { label: 'Review', cards: [{ label: 'PR review' }] },
            {
              label: 'Done',
              accent: 'success',
              cards: [{ label: 'B1 atoms', sublabel: 'merged' }],
            },
          ],
        },
      },
    ],
  },
  {
    name: 'lifted-donut-center',
    subjects: [
      {
        type: 'donut-with-center',
        args: {
          title: 'Annual Recurring Revenue',
          centerValue: '$24M',
          centerLabel: 'Total ARR',
          segments: [
            { label: 'Enterprise', value: 12 },
            { label: 'Mid-market', value: 8 },
            { label: 'SMB', value: 4 },
          ],
          showPct: true,
        },
      },
    ],
  },
  {
    name: 'lifted-mountain-path',
    subjects: [
      {
        type: 'mountain-path',
        args: {
          title: 'Path to Series A',
          summit: 'Series A Close',
          milestones: [
            { label: '$500K ARR' },
            { label: '1K customers' },
            { label: 'PMF confirmed' },
            { label: 'Term sheet' },
          ],
        },
      },
    ],
  },
];

let allOk = true;
for (const s of SAMPLES) {
  const lifted = liftSceneData2dTo3d(s);
  const path = resolve(SCENES, `${s.name}.json`);
  writeFileSync(path, `${JSON.stringify(lifted, null, 2)}\n`);
  const subject3dType = lifted.subjects[0].type;
  const verdict =
    s.name === 'lifted-mountain-path'
      ? subject3dType === 'mountain-3d'
        ? '✓ mountain-3d (upgraded)'
        : `✗ WRONG: ${subject3dType}`
      : `✓ ${subject3dType}`;
  if (verdict.startsWith('✗')) allOk = false;
  console.log(`  ${verdict}  →  scenes/${s.name}.json  (${s.subjects[0].type} → ${subject3dType})`);
}
console.log(`\n${SAMPLES.length} scenes lifted. ${allOk ? 'All OK.' : 'ERRORS detected.'}`);
if (!allOk) process.exit(1);
