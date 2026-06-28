// lift-sprint22-b4-demo.mjs — Sprint 22 B4: lift 4 new PL-rec atoms.
//
// Run: node sdf-js/scripts/lift-sprint22-b4-demo.mjs  (from repo root)

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { liftSceneData2dTo3d } from '../src/scene/lift-2d-to-3d.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENES = resolve(__dirname, '../scenes');

const SAMPLES = [
  {
    name: 'lifted-funnel-with-conversion',
    subjects: [
      {
        type: 'funnel-with-conversion',
        args: {
          title: 'SaaS Conversion Funnel',
          stages: [
            { label: 'Website Visitors', value: 100000 },
            { label: 'Free Signups', value: 12000 },
            { label: 'Trial Active', value: 4200 },
            { label: 'Paid Customers', value: 760 },
          ],
          showAbsolute: true,
          showConversion: true,
        },
      },
    ],
  },
  {
    name: 'lifted-pillar-3up',
    subjects: [
      {
        type: 'pillar-3up',
        args: {
          title: 'Our Three Pillars',
          pillars: [
            {
              icon: 'lightning',
              heading: 'Speed',
              body: 'Sub-100ms response across all queries, globally distributed edge.',
            },
            {
              icon: 'shield-check',
              heading: 'Security',
              body: 'SOC 2 Type II + zero-trust + encryption at rest and in transit.',
            },
            {
              icon: 'globe',
              heading: 'Scale',
              body: '100+ regions, auto-scaling infrastructure, no operational burden.',
            },
          ],
          accentLine: true,
        },
      },
    ],
  },
  {
    name: 'lifted-testimonial-wall',
    subjects: [
      {
        type: 'testimonial-wall',
        args: {
          title: 'What Our Customers Say',
          testimonials: [
            {
              quote: 'Cut our deployment time from 2 weeks to 2 hours.',
              name: 'Sarah Chen',
              role: 'VP Engineering, Acme Corp',
            },
            {
              quote: 'The dashboard is the first thing my team opens every morning.',
              name: 'Marcus Johnson',
              role: 'CFO, BrightWave',
            },
            {
              quote: "Onboarding was the easiest we've ever done. 3 days to value.",
              name: 'Priya Sharma',
              role: 'COO, Meridian',
            },
          ],
        },
      },
    ],
  },
  {
    name: 'lifted-balance-scale',
    subjects: [
      {
        type: 'balance-scale',
        args: {
          title: 'Build vs Buy Analysis',
          leftLabel: 'BUILD',
          rightLabel: 'BUY',
          leftItems: ['Full control', 'IP retention', 'Custom fit', 'No vendor lock-in'],
          rightItems: ['Faster to market', 'Lower upfront cost', 'Vendor SLA', 'Proven at scale'],
          verdict: 'Recommendation: Buy for v1, Build for v2',
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
  const verdict = `✓ ${subject3dType}`;
  console.log(`  ${verdict}  →  scenes/${s.name}.json  (${s.subjects[0].type} → ${subject3dType})`);
}
console.log(`\n${SAMPLES.length} scenes lifted. ${allOk ? 'All OK.' : 'ERRORS detected.'}`);
if (!allOk) process.exit(1);
