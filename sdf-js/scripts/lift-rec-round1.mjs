// lift-rec-round1.mjs — reproduce PresentationLoad "recommendations" templates as
// Atlas 3D narrative decks. Each template → a themed multi-slide deck, every slide
// authored as 2D structure+data and lifted by the deterministic twin map.
//
// Round 1: 4 templates. Run: node sdf-js/scripts/lift-rec-round1.mjs (from repo root)

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { liftSceneData2dTo3d } from '../src/scene/lift-2d-to-3d.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENES = resolve(__dirname, '../scenes');

// each deck = { id, name, slides:[{title, type, args}] }. title is the slide caption
// in the deck; the per-scene heading comes from args.title.
const DECKS = [
  {
    id: 'ai',
    name: 'Artificial Intelligence',
    slides: [
      { title: 'AI Landscape', type: 'sphere-network', args: { title: 'Artificial Intelligence', hub: 'AI', satellites: [{ label: 'Machine Learning' }, { label: 'Deep Learning' }, { label: 'NLP' }, { label: 'Computer Vision' }, { label: 'Robotics' }] } },
      { title: 'ML Pipeline', type: 'progression', args: { title: 'Machine Learning Pipeline', steps: [{ label: 'Collect' }, { label: 'Train' }, { label: 'Validate' }, { label: 'Deploy' }, { label: 'Monitor' }] } },
      { title: 'Model Types', type: 'pie', args: { title: 'Model Types', values: [40, 35, 25], labels: ['Supervised', 'Unsupervised', 'Reinforcement'], format: 'percent' } },
      { title: 'AI Roadmap', type: 'timeline', args: { title: 'AI Roadmap', events: [{ label: 'Research' }, { label: 'Pilot' }, { label: 'Scale' }, { label: 'Production' }] } },
      { title: 'Value Funnel', type: 'funnel', args: { title: 'Data → Decision', stages: [{ label: 'Raw Data' }, { label: 'Features' }, { label: 'Model' }, { label: 'Prediction' }, { label: 'Decision' }] } },
    ],
  },
  {
    id: 'status',
    name: 'Project Status Report',
    slides: [
      { title: 'Status Overview', type: 'traffic-light', args: { title: 'Project Status Report', lights: [{ label: 'Scope' }, { label: 'Budget' }, { label: 'Schedule' }] } },
      { title: 'Milestones', type: 'timeline', args: { title: 'Milestones', events: [{ label: 'Kickoff' }, { label: 'Design' }, { label: 'Build' }, { label: 'Test' }, { label: 'Launch' }] } },
      { title: 'Workstreams', type: 'gantt', args: { title: 'Workstreams', tasks: [{ label: 'Discovery' }, { label: 'Development' }, { label: 'QA' }, { label: 'Rollout' }] } },
      { title: 'KPIs', type: 'bar', args: { title: 'Key Metrics', values: [92, 78, 85, 88], labels: ['On-time', 'Budget', 'Quality', 'Scope'], format: 'percent' } },
      { title: 'Phase Plan', type: 'progression', args: { title: 'Phase Plan', steps: [{ label: 'Plan' }, { label: 'Execute' }, { label: 'Review' }, { label: 'Close' }] } },
    ],
  },
  {
    id: 'okr',
    name: 'Objectives & Key Results',
    slides: [
      { title: 'OKR Overview', type: 'radial-spoke', args: { title: 'Objectives & Key Results', values: [1, 1, 1, 1], labels: ['Grow Revenue', 'Delight Users', 'Scale Ops', 'Build Team'] } },
      { title: 'Key Results', type: 'bar', args: { title: 'Key Result Progress', values: [75, 60, 90, 45], labels: ['KR1', 'KR2', 'KR3', 'KR4'], format: 'percent' } },
      { title: 'Alignment', type: 'org-chart', args: { title: 'OKR Alignment', root: { label: 'Company', children: [{ label: 'Product', children: [{ label: 'Team A' }, { label: 'Team B' }] }, { label: 'GTM', children: [{ label: 'Sales' }, { label: 'Marketing' }] }] } } },
      { title: 'Cadence', type: 'timeline', args: { title: 'Quarterly Cadence', events: [{ label: 'Q1 Set' }, { label: 'Q2 Check' }, { label: 'Q3 Adjust' }, { label: 'Q4 Score' }] } },
      { title: 'Maturity', type: 'pyramid', args: { title: 'OKR Maturity', layers: [{ label: 'Aspirational' }, { label: 'Committed' }, { label: 'Tracked' }, { label: 'Foundational' }] } },
    ],
  },
  {
    id: 'digital',
    name: 'Digital Transformation',
    slides: [
      { title: 'Transformation Stack', type: 'layer-stack', args: { title: 'Digital Transformation', layers: [{ label: 'Strategy' }, { label: 'Process' }, { label: 'Technology' }, { label: 'Culture' }] } },
      { title: 'Roadmap', type: 'timeline', args: { title: 'Transformation Roadmap', events: [{ label: 'Assess' }, { label: 'Design' }, { label: 'Pilot' }, { label: 'Scale' }, { label: 'Optimize' }] } },
      { title: 'Maturity Model', type: 'pyramid', args: { title: 'Digital Maturity', layers: [{ label: 'Optimized' }, { label: 'Integrated' }, { label: 'Defined' }, { label: 'Initial' }] } },
      { title: 'Pillars', type: 'radial-spoke', args: { title: 'Transformation Pillars', values: [1, 1, 1, 1, 1], labels: ['Customer', 'Data', 'Cloud', 'Agility', 'Talent'] } },
      { title: 'Value Funnel', type: 'funnel', args: { title: 'Value Realization', stages: [{ label: 'Vision' }, { label: 'Capability' }, { label: 'Adoption' }, { label: 'Value' }] } },
    ],
  },
];

const TAGLINES = {
  ai: 'From data to intelligent decisions',
  status: 'Where the project stands today',
  okr: 'Aligning ambition with measurable results',
  digital: 'Reinventing the business for the digital age',
};

const links = [];
for (const deck of DECKS) {
  const segments = [];
  deck.slides.forEach((slide, i) => {
    const scene = liftSceneData2dTo3d({
      name: `${deck.id}-${slide.title}`,
      cover: i === 0,
      subtitle: i === 0 ? TAGLINES[deck.id] : undefined,
      subjects: [{ type: slide.type, args: slide.args }],
    });
    const file = `rec-${deck.id}-${i + 1}.json`;
    writeFileSync(resolve(SCENES, file), `${JSON.stringify(scene, null, 2)}\n`);
    segments.push({ file, title: slide.title, kind: 'slide', durationSec: 7 });
  });
  const deckFile = `deck-rec-${deck.id}.json`;
  writeFileSync(resolve(SCENES, deckFile), `${JSON.stringify({ id: `deck-rec-${deck.id}`, name: deck.name, segments }, null, 2)}\n`);
  links.push({ id: deck.id, name: deck.name, n: deck.slides.length });
  console.log(`  ✓ ${deck.name.padEnd(32)} ${deck.slides.length} slides → ?deck=deck-rec-${deck.id}`);
}
console.log(`\n${links.length} decks generated.`);
