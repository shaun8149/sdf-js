// lift-sprint22-b2-demo.mjs — Sprint 22 B2: lift 4 new PL-rec atoms → 3D scenes.
//
// Run: node sdf-js/scripts/lift-sprint22-b2-demo.mjs  (from repo root)

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { liftSceneData2dTo3d } from '../src/scene/lift-2d-to-3d.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENES = resolve(__dirname, '../scenes');

const SAMPLES = [
  {
    name: 'decision-tree',
    subjects: [
      {
        type: 'decision-tree-3-arm',
        args: {
          title: 'Go-to-Market Strategy Decision',
          question: 'Which growth channel should we prioritize in Q4?',
          arms: [
            { label: 'Enterprise Sales', sublabel: 'Direct + high ACV' },
            { label: 'Product-Led Growth', sublabel: 'Freemium + virality' },
            { label: 'Channel Partnerships', sublabel: 'Resellers + integrations' },
          ],
        },
      },
    ],
  },
  {
    name: 'maturity-model',
    subjects: [
      {
        type: 'maturity-model',
        args: {
          title: 'Digital Transformation Maturity',
          stages: [
            { label: 'Ad Hoc', description: 'Siloed, manual processes' },
            { label: 'Managed', description: 'Basic tracking & reporting' },
            { label: 'Defined', description: 'Standardized workflows' },
            { label: 'Integrated', description: 'Cross-functional data flow' },
            { label: 'Optimizing', description: 'AI-driven improvement' },
          ],
          currentLevel: 3,
          label: 'Current: Level 3 — Defined',
        },
      },
    ],
  },
  {
    name: 'cost-benefit',
    subjects: [
      {
        type: 'cost-benefit-matrix',
        args: {
          title: '2026 Initiative Prioritization',
          xAxis: 'Implementation Cost',
          yAxis: 'Business Impact',
          items: [
            { label: 'AI Customer Support', cost: 'low', benefit: 'high' },
            { label: 'ERP Migration', cost: 'high', benefit: 'high' },
            { label: 'Email Automation', cost: 'low', benefit: 'low' },
            { label: 'Brand Refresh', cost: 'high', benefit: 'low' },
          ],
          quadrantLabels: {
            tl: 'Quick Wins',
            tr: 'Strategic Bets',
            bl: 'Low Priority',
            br: 'Question Marks',
          },
        },
      },
    ],
  },
  {
    name: 'journey',
    subjects: [
      {
        type: 'journey-flow-curve',
        args: {
          title: 'B2B Customer Onboarding Journey',
          touchpoints: [
            { label: 'Discovery', sublabel: 'Finds us via SEO', emotion: 0.2 },
            { label: 'Demo Request', sublabel: 'Books a call', emotion: 0.5 },
            { label: 'Negotiation', sublabel: 'Procurement friction', emotion: -0.3 },
            { label: 'Contract Signed', emotion: 0.8 },
            { label: 'Onboarding', sublabel: 'Setup complexity', emotion: -0.1 },
            { label: 'First Value', sublabel: 'Aha moment', emotion: 0.9 },
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
