// lift-rec-round5.mjs — PL "recommendations" round 5 (final 4 templates). Data → twin map.
// Note: Mountain Path (metaphor graphic) and Line Icons (icon set) have no dedicated
// atom — represented with the closest structural analogs (climb=progression/pyramid,
// icons=grid tiles). This is the real-world test surfacing a coverage gap, on purpose.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { liftSceneData2dTo3d } from '../src/scene/lift-2d-to-3d.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENES = resolve(__dirname, '../scenes');

const DECKS = [
  {
    id: 'flowchart', name: 'Flow Chart Toolbox', slides: [
      { title: 'Process Flow', type: 'flow-chart', args: { title: 'Flow Chart Toolbox', steps: [{ label: 'Start' }, { label: 'Process' }, { label: 'Decision' }, { label: 'End' }] } },
      { title: 'Workflow', type: 'flow-chart', args: { title: 'Workflow', steps: [{ label: 'Intake' }, { label: 'Review' }, { label: 'Approve' }, { label: 'Execute' }, { label: 'Close' }] } },
      { title: 'Decision Tree', type: 'tree-diagram', args: { title: 'Decision Tree', root: { label: 'Q', children: [{ label: 'Yes', children: [{ label: 'A1' }, { label: 'A2' }] }, { label: 'No', children: [{ label: 'B1' }, { label: 'B2' }] }] } } },
      { title: 'Stages', type: 'progression', args: { title: 'Stages', steps: [{ label: 'Define' }, { label: 'Map' }, { label: 'Analyze' }, { label: 'Improve' }] } },
      { title: 'Cycle', type: 'circle-loop', args: { title: 'Process Cycle', segments: 4, labels: ['Plan', 'Do', 'Check', 'Act'] } },
    ],
  },
  {
    id: 'timelines', name: 'Project Timelines 2026', slides: [
      { title: '2026 Timeline', type: 'timeline', args: { title: 'Project Timelines 2026', events: [{ label: 'Q1' }, { label: 'Q2' }, { label: 'Q3' }, { label: 'Q4' }] } },
      { title: 'Roadmap', type: 'timeline', args: { title: 'Roadmap', events: [{ label: 'Jan' }, { label: 'Apr' }, { label: 'Jul' }, { label: 'Oct' }, { label: 'Dec' }] } },
      { title: 'Gantt', type: 'gantt', args: { title: 'Gantt 2026', tasks: [{ label: 'Phase 1' }, { label: 'Phase 2' }, { label: 'Phase 3' }, { label: 'Phase 4' }] } },
      { title: 'Milestones', type: 'progression', args: { title: 'Milestones', steps: [{ label: 'Plan' }, { label: 'Build' }, { label: 'Ship' }, { label: 'Scale' }] } },
      { title: 'Phases', type: 'layer-stack', args: { title: 'Program Phases', layers: [{ label: 'Discovery' }, { label: 'Delivery' }, { label: 'Adoption' }, { label: 'Value' }] } },
    ],
  },
  {
    id: 'mountain', name: 'Mountain Path – Graphics', slides: [
      { title: 'The Summit', type: 'mountain', args: { title: 'Mountain Path', stages: [{ label: 'Summit' }, { label: 'Ridge' }, { label: 'Ascent' }, { label: 'Base Camp' }] } },
      { title: 'The Climb', type: 'progression', args: { title: 'The Climb', steps: [{ label: 'Base Camp' }, { label: 'Ascent' }, { label: 'Ridge' }, { label: 'Summit' }] } },
      { title: 'Milestones', type: 'timeline', args: { title: 'Journey Milestones', events: [{ label: 'Start' }, { label: 'Camp 1' }, { label: 'Camp 2' }, { label: 'Peak' }] } },
      { title: 'Elevation Tiers', type: 'circle-stack', args: { title: 'Elevation', layers: [{ label: 'Peak' }, { label: 'High' }, { label: 'Mid' }, { label: 'Foot' }] } },
      { title: 'Goal Path', type: 'funnel', args: { title: 'Focus to Summit', stages: [{ label: 'Vision' }, { label: 'Plan' }, { label: 'Effort' }, { label: 'Summit' }] } },
    ],
  },
  {
    id: 'icons', name: 'Line Icons - Business', slides: [
      { title: 'Categories', type: 'radial-spoke', args: { title: 'Business Icons', values: [1, 1, 1, 1, 1, 1], labels: ['Finance', 'People', 'Growth', 'Tech', 'Strategy', 'Ops'] } },
      { title: 'Icon Grid', type: 'cube-grid', args: { title: 'Icon Set', size: 3 } },
      { title: 'Concept Tiles', type: 'matrix-grid', args: { title: 'Concept Tiles', rows: 2, cols: 4 } },
      { title: 'Themes', type: 'circle-segmented', args: { title: 'Themes', segments: 6, labels: ['$', '%', '↑', '★', '✓', '◆'] } },
      { title: 'Toolkit', type: 'radial-spoke', args: { title: 'Toolkit', values: [1, 1, 1, 1], labels: ['Charts', 'Flows', 'Maps', 'KPIs'] } },
    ],
  },
];

const TAGLINES = {
  flowchart: 'Mapping how work actually flows',
  timelines: 'Plotting the year ahead',
  mountain: 'The climb from base camp to summit',
  icons: 'A visual language for business',
};

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
  writeFileSync(resolve(SCENES, `deck-rec-${deck.id}.json`), `${JSON.stringify({ id: `deck-rec-${deck.id}`, name: deck.name, segments }, null, 2)}\n`);
  console.log(`  ✓ ${deck.name.padEnd(34)} → ?deck=deck-rec-${deck.id}`);
}
