// lift-hero-cyber.mjs — Sprint 23 hero deck: "Cybersecurity Brief"
//
// Run: node sdf-js/scripts/lift-hero-cyber.mjs  (from repo root)

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { liftSceneData2dTo3d } from '../src/scene/lift-2d-to-3d.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENES = resolve(__dirname, '../scenes');

const slots = [
  {
    key: '0',
    title: 'Risks',
    subject: {
      type: 'risk-heatmap',
      args: {
        title: 'Risk Assessment',
        risks: [
          { label: 'Data breach', likelihood: 4, impact: 5 },
          { label: 'Compliance', likelihood: 2, impact: 4 },
          { label: 'Vendor delay', likelihood: 5, impact: 2 },
          { label: 'Insider threat', likelihood: 2, impact: 5 },
          { label: 'DDoS', likelihood: 3, impact: 3 },
          { label: 'Phishing', likelihood: 4, impact: 3 },
        ],
      },
    },
  },
  {
    key: '1',
    title: 'Landscape',
    subject: {
      type: 'org-vs-org-matrix',
      args: {
        title: 'Vendor Landscape',
        xAxis: 'Completeness of Vision',
        yAxis: 'Ability to Execute',
        orgs: [
          { name: 'Us', x: 0.7, y: 0.8, isUs: true },
          { name: 'CrowdStrike', x: 0.85, y: 0.85 },
          { name: 'Palo Alto', x: 0.8, y: 0.75 },
          { name: 'SentinelOne', x: 0.6, y: 0.55 },
          { name: 'Fortinet', x: 0.7, y: 0.4 },
        ],
        quadrantLabels: { tl: 'Visionaries', tr: 'Leaders', bl: 'Niche', br: 'Challengers' },
      },
    },
  },
  {
    key: '2',
    title: 'Response',
    subject: {
      type: 'journey-flow-curve',
      args: {
        title: 'Incident Response Curve',
        touchpoints: [
          { label: 'Detection', sublabel: 'SIEM alert', emotion: -0.4 },
          { label: 'Analysis', sublabel: 'triage', emotion: -0.2 },
          { label: 'Containment', sublabel: 'isolate', emotion: 0.0 },
          { label: 'Eradication', sublabel: 'remove', emotion: 0.3 },
          { label: 'Recovery', sublabel: 'restore', emotion: 0.6 },
          { label: 'Lessons Learned', sublabel: 'post-mortem', emotion: 0.8 },
        ],
        xAxis: 'Time',
        yAxis: 'Impact',
      },
    },
  },
  {
    key: '3',
    title: 'Workflow',
    subject: {
      type: 'kanban-board',
      args: {
        title: 'Q3 Remediation Board',
        columns: [
          { label: 'Backlog', cards: [{ label: 'IAM audit' }, { label: 'Log retention' }] },
          {
            label: 'In Progress',
            accent: 'warning',
            cards: [
              { label: 'Zero trust rollout', sublabel: 'security' },
              { label: 'MFA enforcement', sublabel: 'IT' },
            ],
          },
          { label: 'Review', cards: [{ label: 'Vuln scan report' }] },
          { label: 'Done', accent: 'success', cards: [{ label: 'SOC2 audit', sublabel: 'passed' }] },
        ],
      },
    },
  },
  {
    key: '4',
    title: 'Pillars',
    subject: {
      type: 'pillar-3up',
      args: {
        title: 'Security Framework',
        pillars: [
          {
            icon: 'shield-check',
            heading: 'Detect',
            body: '24/7 SOC monitoring across cloud + endpoint + network',
          },
          {
            icon: 'lock-key',
            heading: 'Protect',
            body: 'Zero-trust + encryption + IAM + MFA baseline',
          },
          {
            icon: 'arrows-clockwise',
            heading: 'Recover',
            body: 'Automated backup + rehearsal + <1h RTO on tier-1 systems',
          },
        ],
      },
    },
  },
];

const segments = [];
for (const slot of slots) {
  const scene2d = { subjects: [slot.subject] };
  const scene3d = liftSceneData2dTo3d(scene2d);
  scene3d.name = `(lifted) hero-cyber-${slot.key}`;
  const file = `hero-cyber-${slot.key}.json`;
  writeFileSync(`${SCENES}/${file}`, `${JSON.stringify(scene3d, null, 2)}\n`);
  const type3d = scene3d.subjects[0].type;
  console.log(`  ✓ ${slot.subject.type} → ${type3d}  →  scenes/${file}`);
  segments.push({ file, title: slot.title, kind: 'slide', durationSec: 7 });
}

const deck = {
  id: 'deck-cybersecurity-brief',
  name: 'Cybersecurity Brief 2027',
  segments,
};
const deckFile = `${SCENES}/deck-cybersecurity-brief.json`;
writeFileSync(deckFile, `${JSON.stringify(deck, null, 2)}\n`);
console.log(`\n✓ deck-cybersecurity-brief: ${slots.length} scenes + manifest`);
