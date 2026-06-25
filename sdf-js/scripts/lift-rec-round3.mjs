// lift-rec-round3.mjs — PL "recommendations" round 3 (5 templates). Data → twin map.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { liftSceneData2dTo3d } from '../src/scene/lift-2d-to-3d.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENES = resolve(__dirname, '../scenes');

const DECKS = [
  {
    id: 'pmtoolbox', name: 'Project Management Toolbox', slides: [
      { title: 'PM Toolbox', type: 'radial-spoke', args: { title: 'Project Management Toolbox', values: [1, 1, 1, 1, 1, 1], labels: ['Charter', 'WBS', 'Gantt', 'RACI', 'Risk', 'Budget'] } },
      { title: 'Schedule', type: 'gantt', args: { title: 'Project Schedule', tasks: [{ label: 'Initiate' }, { label: 'Plan' }, { label: 'Execute' }, { label: 'Monitor' }, { label: 'Close' }] } },
      { title: 'Phases', type: 'progression', args: { title: 'Project Phases', steps: [{ label: 'Initiate' }, { label: 'Plan' }, { label: 'Execute' }, { label: 'Close' }] } },
      { title: 'Milestones', type: 'timeline', args: { title: 'Milestones', events: [{ label: 'Charter' }, { label: 'Baseline' }, { label: 'Go-Live' }, { label: 'Handover' }] } },
      { title: 'Risk Matrix', type: 'matrix-grid', args: { title: 'Risk Matrix', rows: 3, cols: 3 } },
    ],
  },
  {
    id: 'leadership', name: 'Leadership Toolbox', slides: [
      { title: 'Styles', type: 'radial-spoke', args: { title: 'Leadership Toolbox', values: [1, 1, 1, 1, 1], labels: ['Visionary', 'Coaching', 'Affiliative', 'Democratic', 'Commanding'] } },
      { title: 'Situational', type: 'matrix-grid', args: { title: 'Situational Leadership', rows: 2, cols: 2 } },
      { title: 'Development', type: 'progression', args: { title: 'Leadership Development', steps: [{ label: 'Self' }, { label: 'Team' }, { label: 'Org' }, { label: 'Vision' }] } },
      { title: 'Maturity', type: 'pyramid', args: { title: 'Leadership Levels', layers: [{ label: 'Executive' }, { label: 'Manager' }, { label: 'Lead' }, { label: 'Contributor' }] } },
      { title: 'Team Network', type: 'sphere-network', args: { title: 'Team', hub: 'Leader', satellites: [{ label: 'Eng' }, { label: 'Design' }, { label: 'Product' }, { label: 'Ops' }] } },
    ],
  },
  {
    id: 'itstrategy', name: 'IT Strategy', slides: [
      { title: 'IT Stack', type: 'layer-stack', args: { title: 'IT Strategy', layers: [{ label: 'Applications' }, { label: 'Data' }, { label: 'Infrastructure' }, { label: 'Security' }] } },
      { title: 'Roadmap', type: 'timeline', args: { title: 'IT Roadmap', events: [{ label: 'Assess' }, { label: 'Modernize' }, { label: 'Migrate' }, { label: 'Optimize' }] } },
      { title: 'Capabilities', type: 'radial-spoke', args: { title: 'IT Capabilities', values: [1, 1, 1, 1, 1], labels: ['Cloud', 'Data', 'Security', 'DevOps', 'AI'] } },
      { title: 'Maturity', type: 'pyramid', args: { title: 'IT Maturity', layers: [{ label: 'Optimized' }, { label: 'Managed' }, { label: 'Defined' }, { label: 'Ad-hoc' }] } },
      { title: 'Portfolio', type: 'matrix-grid', args: { title: 'App Portfolio', rows: 2, cols: 2 } },
    ],
  },
  {
    id: 'marketing', name: 'Marketing Toolbox', slides: [
      { title: 'Marketing Mix', type: 'radial-spoke', args: { title: 'Marketing Toolbox', values: [1, 1, 1, 1], labels: ['Product', 'Price', 'Place', 'Promotion'] } },
      { title: 'AIDA Funnel', type: 'funnel', args: { title: 'AIDA', stages: [{ label: 'Attention' }, { label: 'Interest' }, { label: 'Desire' }, { label: 'Action' }] } },
      { title: 'Channel Mix', type: 'pie', args: { title: 'Channel Mix', values: [30, 25, 20, 15, 10], labels: ['Search', 'Social', 'Email', 'Content', 'Events'], format: 'percent' } },
      { title: 'Campaign', type: 'timeline', args: { title: 'Campaign Calendar', events: [{ label: 'Tease' }, { label: 'Launch' }, { label: 'Sustain' }, { label: 'Convert' }] } },
      { title: 'Segments', type: 'matrix-grid', args: { title: 'Segment Matrix', rows: 2, cols: 3 } },
    ],
  },
  {
    id: 'strategy', name: 'Strategy Toolbox', slides: [
      { title: 'Frameworks', type: 'radial-spoke', args: { title: 'Strategy Toolbox', values: [1, 1, 1, 1, 1, 1], labels: ['SWOT', 'PESTLE', 'Porter', 'Ansoff', 'BCG', 'Blue Ocean'] } },
      { title: 'SWOT', type: 'matrix-grid', args: { title: 'SWOT', rows: 2, cols: 2 } },
      { title: 'Growth Options', type: 'circle-segmented', args: { title: 'Ansoff Matrix', segments: 4, labels: ['Penetration', 'Development', 'Product', 'Diversify'] } },
      { title: 'Strategy Pyramid', type: 'pyramid', args: { title: 'Strategy Pyramid', layers: [{ label: 'Mission' }, { label: 'Objectives' }, { label: 'Strategy' }, { label: 'Tactics' }] } },
      { title: 'Roadmap', type: 'timeline', args: { title: 'Strategic Roadmap', events: [{ label: 'Now' }, { label: 'Next' }, { label: 'Later' }, { label: 'Vision' }] } },
    ],
  },
];

for (const deck of DECKS) {
  const segments = [];
  deck.slides.forEach((slide, i) => {
    const scene = liftSceneData2dTo3d({ name: `${deck.id}-${slide.title}`, subjects: [{ type: slide.type, args: slide.args }] });
    const file = `rec-${deck.id}-${i + 1}.json`;
    writeFileSync(resolve(SCENES, file), `${JSON.stringify(scene, null, 2)}\n`);
    segments.push({ file, title: slide.title, kind: 'slide', durationSec: 7 });
  });
  writeFileSync(resolve(SCENES, `deck-rec-${deck.id}.json`), `${JSON.stringify({ id: `deck-rec-${deck.id}`, name: deck.name, segments }, null, 2)}\n`);
  console.log(`  ✓ ${deck.name.padEnd(32)} → ?deck=deck-rec-${deck.id}`);
}
