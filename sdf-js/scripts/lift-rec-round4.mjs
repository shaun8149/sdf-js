// lift-rec-round4.mjs — PL "recommendations" round 4 (5 templates). Data → twin map.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { liftSceneData2dTo3d } from '../src/scene/lift-2d-to-3d.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENES = resolve(__dirname, '../scenes');

const DECKS = [
  {
    id: 'stratmap', name: 'Strategy Map', slides: [
      { title: 'Perspectives', type: 'layer-stack', args: { title: 'Strategy Map', layers: [{ label: 'Financial' }, { label: 'Customer' }, { label: 'Process' }, { label: 'Learning' }] } },
      { title: 'Causal Chain', type: 'progression', args: { title: 'Cause & Effect', steps: [{ label: 'Learning' }, { label: 'Process' }, { label: 'Customer' }, { label: 'Financial' }] } },
      { title: 'Objective Links', type: 'relationship-graph', args: { title: 'Linked Objectives', nodes: [{ label: 'Skills' }, { label: 'Quality' }, { label: 'Loyalty' }, { label: 'Revenue' }, { label: 'Growth' }] } },
      { title: 'Scorecard', type: 'bar', args: { title: 'Balanced Scorecard', values: [82, 75, 68, 90], labels: ['Fin', 'Cust', 'Proc', 'Learn'], format: 'percent' } },
      { title: 'Cascade', type: 'pyramid', args: { title: 'Strategy Cascade', layers: [{ label: 'Vision' }, { label: 'Themes' }, { label: 'Objectives' }, { label: 'Measures' }] } },
    ],
  },
  {
    id: 'bizcase', name: 'Business Case', slides: [
      { title: 'Structure', type: 'pyramid', args: { title: 'Business Case', layers: [{ label: 'Recommendation' }, { label: 'Options' }, { label: 'Analysis' }] } },
      { title: 'Options', type: 'matrix-grid', args: { title: 'Options Matrix', rows: 2, cols: 2 } },
      { title: 'Cost vs Benefit', type: 'bar', args: { title: 'Cost / Benefit', values: [40, 90, 30, 110], labels: ['Cost A', 'Benefit A', 'Cost B', 'Benefit B'], format: 'currency' } },
      { title: 'Payback', type: 'timeline', args: { title: 'Payback Timeline', events: [{ label: 'Invest' }, { label: 'Pilot' }, { label: 'Break-even' }, { label: 'Return' }] } },
      { title: 'Decision', type: 'funnel', args: { title: 'Decision Funnel', stages: [{ label: 'Ideas' }, { label: 'Shortlist' }, { label: 'Evaluated' }, { label: 'Approved' }] } },
    ],
  },
  {
    id: 'grow', name: 'GROW Coaching Model', slides: [
      { title: 'GROW', type: 'circle-segmented', args: { title: 'GROW Model', segments: 4, labels: ['Goal', 'Reality', 'Options', 'Will'] } },
      { title: 'Sequence', type: 'progression', args: { title: 'Coaching Sequence', steps: [{ label: 'Goal' }, { label: 'Reality' }, { label: 'Options' }, { label: 'Will' }] } },
      { title: 'Coaching Cycle', type: 'circle-loop', args: { title: 'Coaching Cycle', segments: 4, labels: ['Goal', 'Reality', 'Options', 'Will'] } },
      { title: 'Key Questions', type: 'radial-spoke', args: { title: 'Key Questions', values: [1, 1, 1, 1], labels: ['What?', 'Where now?', 'What if?', 'What next?'] } },
      { title: 'Journey', type: 'timeline', args: { title: 'Coaching Journey', events: [{ label: 'Set Goal' }, { label: 'Explore' }, { label: 'Plan' }, { label: 'Act' }] } },
    ],
  },
  {
    id: 'comms', name: 'Communication Toolbox', slides: [
      { title: 'Channels', type: 'radial-spoke', args: { title: 'Communication Toolbox', values: [1, 1, 1, 1, 1], labels: ['Email', 'Meeting', 'Chat', 'Report', 'Town Hall'] } },
      { title: 'Comm Model', type: 'progression', args: { title: 'Communication Model', steps: [{ label: 'Sender' }, { label: 'Message' }, { label: 'Channel' }, { label: 'Receiver' }, { label: 'Feedback' }] } },
      { title: 'Stakeholders', type: 'matrix-grid', args: { title: 'Power / Interest', rows: 2, cols: 2 } },
      { title: 'Plan', type: 'timeline', args: { title: 'Communication Plan', events: [{ label: 'Announce' }, { label: 'Engage' }, { label: 'Reinforce' }, { label: 'Review' }] } },
      { title: 'Channel Mix', type: 'pie', args: { title: 'Channel Mix', values: [35, 25, 20, 20], labels: ['Email', 'Meetings', 'Chat', 'Docs'], format: 'percent' } },
    ],
  },
  {
    id: 'innovation', name: 'Innovation Management Toolbox', slides: [
      { title: 'Toolbox', type: 'radial-spoke', args: { title: 'Innovation Toolbox', values: [1, 1, 1, 1, 1], labels: ['Ideation', 'Design Thinking', 'Lean', 'Stage-Gate', 'Portfolio'] } },
      { title: 'Innovation Funnel', type: 'funnel', args: { title: 'Innovation Funnel', stages: [{ label: 'Ideas' }, { label: 'Concepts' }, { label: 'Prototypes' }, { label: 'Products' }] } },
      { title: 'Stage-Gate', type: 'progression', args: { title: 'Stage-Gate', steps: [{ label: 'Discover' }, { label: 'Scope' }, { label: 'Build' }, { label: 'Test' }, { label: 'Launch' }] } },
      { title: 'Portfolio', type: 'matrix-grid', args: { title: 'Innovation Portfolio', rows: 2, cols: 2 } },
      { title: 'Roadmap', type: 'timeline', args: { title: 'Innovation Roadmap', events: [{ label: 'Core' }, { label: 'Adjacent' }, { label: 'Transformational' }] } },
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
  console.log(`  ✓ ${deck.name.padEnd(34)} → ?deck=deck-rec-${deck.id}`);
}
