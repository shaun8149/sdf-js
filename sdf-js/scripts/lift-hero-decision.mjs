// lift-hero-decision.mjs — Sprint 23 hero deck: "Decision 2027 — Strategic Path"
//
// Run: node sdf-js/scripts/lift-hero-decision.mjs  (from repo root)

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { liftSceneData2dTo3d } from '../src/scene/lift-2d-to-3d.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENES = resolve(__dirname, '../scenes');

const slots = [
  {
    key: '0',
    title: 'Goal',
    subject: {
      type: 'mountain-path',
      args: {
        summit: 'Series A · $15M',
        milestones: [
          { label: '$1M ARR', sublabel: 'Q1' },
          { label: '10K users', sublabel: 'Q2' },
          { label: 'PMF', sublabel: 'Q3' },
          { label: 'Term Sheet', sublabel: 'Q4' },
        ],
        title: 'Q4 Path to Series A',
      },
    },
  },
  {
    key: '1',
    title: 'Framework',
    subject: {
      type: 'strategy-map',
      args: {
        perspectives: [
          { label: 'Financial', items: ['Revenue 30%', 'Margin'] },
          { label: 'Customer', items: ['NPS 50+', 'Retention 95%'] },
          { label: 'Process', items: ['Ops', 'Quality'] },
          { label: 'Learning', items: ['Talent', 'Skills'] },
        ],
        title: 'Balanced Scorecard',
      },
    },
  },
  {
    key: '2',
    title: 'Tradeoffs',
    subject: {
      type: 'cost-benefit-matrix',
      args: {
        title: '2027 Initiatives',
        xAxis: 'Cost',
        yAxis: 'Benefit',
        items: [
          { label: 'AI Support', cost: 'low', benefit: 'high' },
          { label: 'Mobile Rewrite', cost: 'high', benefit: 'high' },
          { label: 'Automation', cost: 'low', benefit: 'low' },
          { label: 'Rebrand', cost: 'high', benefit: 'low' },
        ],
      },
    },
  },
  {
    key: '3',
    title: 'Decision',
    subject: {
      type: 'decision-tree-3-arm',
      args: {
        question: 'Which channel Q4?',
        arms: [
          { label: 'Enterprise', sublabel: 'Direct + high ACV' },
          { label: 'PLG', sublabel: 'Freemium + virality' },
          { label: 'Partners', sublabel: 'Resellers' },
          { label: 'Content', sublabel: 'SEO' },
        ],
        title: 'Go-to-Market Decision',
      },
    },
  },
  {
    key: '4',
    title: 'Maturity',
    subject: {
      type: 'maturity-model',
      args: {
        stages: [
          { label: 'Ad Hoc', description: 'Siloed' },
          { label: 'Managed' },
          { label: 'Defined' },
          { label: 'Integrated' },
          { label: 'Optimizing' },
        ],
        currentLevel: 3,
        label: 'Current: Defined',
        title: 'Ops Maturity',
      },
    },
  },
  {
    key: '5',
    title: 'OKR',
    subject: {
      type: 'okr-tree',
      args: {
        objective: 'Become market leader in self-custodial trading',
        quarter: 'Q3 2027',
        keyResults: [
          { label: 'Cross $50M ARR', progress: 0.48, sublabel: '$24M / $50M' },
          { label: 'NPS > 70', progress: 0.86, sublabel: '68 now' },
          { label: '24/7 support', progress: 0.65, sublabel: '4h avg' },
        ],
      },
    },
  },
];

const segments = [];
for (const slot of slots) {
  const scene2d = { subjects: [slot.subject] };
  const scene3d = liftSceneData2dTo3d(scene2d);
  scene3d.name = `(lifted) hero-decision-${slot.key}`;
  const file = `hero-decision-${slot.key}.json`;
  writeFileSync(`${SCENES}/${file}`, `${JSON.stringify(scene3d, null, 2)}\n`);
  const type3d = scene3d.subjects[0].type;
  console.log(`  ✓ ${slot.subject.type} → ${type3d}  →  scenes/${file}`);
  segments.push({ file, title: slot.title, kind: 'slide', durationSec: 7 });
}

const deck = {
  id: 'deck-decision-2027-strategy',
  name: 'Decision 2027 — Strategic Path',
  segments,
};
const deckFile = `${SCENES}/deck-decision-2027-strategy.json`;
writeFileSync(deckFile, `${JSON.stringify(deck, null, 2)}\n`);
console.log(`\n✓ deck-decision-2027-strategy: ${slots.length} scenes + manifest`);
