// lift-hero-cs.mjs — Sprint 23 hero deck 3: "Customer Success Q3 Review".
//
// Five slides exercising Sprint 22 B2/B3/B4 atoms end-to-end: journey-flow-curve,
// testimonial-wall, funnel-with-conversion, radar-chart, donut-with-center.
//
// Run: node sdf-js/scripts/lift-hero-cs.mjs  (from repo root)

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { liftSceneData2dTo3d } from '../src/scene/lift-2d-to-3d.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENES = resolve(__dirname, '../scenes');

const slots = [
  {
    key: '0',
    title: 'Journey',
    subject: {
      type: 'journey-flow-curve',
      args: {
        title: 'B2B Onboarding Journey',
        touchpoints: [
          { label: 'Discovery', sublabel: 'SEO/ads', emotion: 0.2 },
          { label: 'Signup', sublabel: 'free trial', emotion: 0.6 },
          { label: 'Onboard', sublabel: 'tutorial', emotion: -0.3 },
          { label: 'First Value', sublabel: 'aha moment', emotion: 0.8 },
          { label: 'Adoption', sublabel: 'daily use', emotion: 0.6 },
          { label: 'Renewal', sublabel: 'upsell', emotion: 0.7 },
        ],
      },
    },
  },
  {
    key: '1',
    title: 'Voice',
    subject: {
      type: 'testimonial-wall',
      args: {
        title: 'Customer Voice',
        testimonials: [
          {
            quote: 'Cut deployment from 2 weeks to 2 hours.',
            name: 'Sarah Chen',
            role: 'VP Eng, Acme',
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
  },
  {
    key: '2',
    title: 'Funnel',
    subject: {
      type: 'funnel-with-conversion',
      args: {
        title: 'Signup → Paid Funnel',
        stages: [
          { label: 'Visitors', value: 100000 },
          { label: 'Signups', value: 12000 },
          { label: 'Trials', value: 4200 },
          { label: 'Paid', value: 760 },
        ],
      },
    },
  },
  {
    key: '3',
    title: 'Radar',
    subject: {
      type: 'radar-chart',
      args: {
        title: 'CSAT Capability Radar',
        axes: ['Speed', 'Quality', 'Cost', 'Scalability', 'UX', 'Support'],
        series: [
          { label: 'Current', values: [0.7, 0.6, 0.5, 0.4, 0.75, 0.65] },
          { label: 'Target Q4', values: [0.9, 0.8, 0.7, 0.7, 0.9, 0.85] },
        ],
      },
    },
  },
  {
    key: '4',
    title: 'KPI',
    subject: {
      type: 'donut-with-center',
      args: {
        title: 'Annual Recurring Revenue Q3 2027',
        centerValue: '$24M',
        centerLabel: 'Total ARR',
        segments: [
          { label: 'Enterprise', value: 12 },
          { label: 'Mid-Market', value: 8 },
          { label: 'SMB', value: 3 },
          { label: 'Public Sector', value: 1 },
        ],
      },
    },
  },
];

const segments = [];
for (const slot of slots) {
  const scene2d = { subjects: [slot.subject] };
  const scene3d = liftSceneData2dTo3d(scene2d);
  scene3d.name = `(lifted) hero-cs-${slot.key}`;
  const file = `hero-cs-${slot.key}.json`;
  writeFileSync(resolve(SCENES, file), `${JSON.stringify(scene3d, null, 2)}\n`);
  segments.push({ file, title: slot.title, kind: 'slide', durationSec: 7 });
  console.log(`  ✓ ${slot.subject.type} → ${scene3d.subjects[0].type}  ·  scenes/${file}`);
}

const deck = {
  id: 'deck-customer-success-review',
  name: 'Customer Success Q3 Review',
  segments,
};
writeFileSync(
  resolve(SCENES, 'deck-customer-success-review.json'),
  `${JSON.stringify(deck, null, 2)}\n`,
);
console.log(`\n✓ deck-customer-success-review: ${slots.length} scenes + manifest`);
