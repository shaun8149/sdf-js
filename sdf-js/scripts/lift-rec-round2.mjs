// lift-rec-round2.mjs — PL "recommendations" round 2 (5 templates). Data → twin map.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { liftSceneData2dTo3d } from '../src/scene/lift-2d-to-3d.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENES = resolve(__dirname, '../scenes');

const DECKS = [
  {
    id: 'consulting', name: 'Consulting Toolbox', slides: [
      { title: 'Toolbox', type: 'radial-spoke', args: { title: 'Consulting Toolbox', values: [1, 1, 1, 1, 1, 1], labels: ['SWOT', 'Porter 5F', 'BCG', 'Value Chain', 'McKinsey 7S', 'Ansoff'] } },
      { title: '2x2 Matrix', type: 'matrix-grid', args: { title: 'Priority Matrix', rows: 2, cols: 2 } },
      { title: 'Value Chain', type: 'progression', args: { title: 'Value Chain', steps: [{ label: 'Inbound' }, { label: 'Operations' }, { label: 'Outbound' }, { label: 'Marketing' }, { label: 'Service' }] } },
      { title: 'Pyramid Principle', type: 'pyramid', args: { title: 'Pyramid Principle', layers: [{ label: 'Recommendation' }, { label: 'Arguments' }, { label: 'Evidence' }] } },
      { title: 'Engagement Plan', type: 'timeline', args: { title: 'Engagement Plan', events: [{ label: 'Scope' }, { label: 'Analyze' }, { label: 'Recommend' }, { label: 'Implement' }] } },
    ],
  },
  {
    id: 'cyber', name: 'Cybersecurity', slides: [
      { title: 'Threat Landscape', type: 'sphere-network', args: { title: 'Cybersecurity', hub: 'Assets', satellites: [{ label: 'Malware' }, { label: 'Phishing' }, { label: 'Ransomware' }, { label: 'Insider' }, { label: 'DDoS' }] } },
      { title: 'Defense in Depth', type: 'layer-stack', args: { title: 'Defense in Depth', layers: [{ label: 'Perimeter' }, { label: 'Network' }, { label: 'Endpoint' }, { label: 'Application' }, { label: 'Data' }] } },
      { title: 'Threat Funnel', type: 'funnel', args: { title: 'Attack Funnel', stages: [{ label: 'Attempts' }, { label: 'Detected' }, { label: 'Contained' }, { label: 'Breached' }] } },
      { title: 'Maturity', type: 'pyramid', args: { title: 'Security Maturity', layers: [{ label: 'Adaptive' }, { label: 'Proactive' }, { label: 'Reactive' }, { label: 'Initial' }] } },
      { title: 'Incident Response', type: 'progression', args: { title: 'Incident Response', steps: [{ label: 'Identify' }, { label: 'Contain' }, { label: 'Eradicate' }, { label: 'Recover' }] } },
    ],
  },
  {
    id: 'bizplan', name: 'Business Plan', slides: [
      { title: 'Strategy Pyramid', type: 'pyramid', args: { title: 'Business Plan', layers: [{ label: 'Vision' }, { label: 'Strategy' }, { label: 'Tactics' }, { label: 'Operations' }] } },
      { title: 'Milestones', type: 'timeline', args: { title: 'Milestones', events: [{ label: 'Found' }, { label: 'MVP' }, { label: 'Launch' }, { label: 'Scale' }, { label: 'Exit' }] } },
      { title: 'Revenue Plan', type: 'bar', args: { title: 'Revenue Plan', values: [20, 45, 80, 130, 200], labels: ['Y1', 'Y2', 'Y3', 'Y4', 'Y5'], format: 'currency' } },
      { title: 'Market Mix', type: 'pie', args: { title: 'Market Segments', values: [45, 30, 25], labels: ['Enterprise', 'SMB', 'Consumer'], format: 'percent' } },
      { title: 'Sales Funnel', type: 'funnel', args: { title: 'Sales Funnel', stages: [{ label: 'Leads' }, { label: 'Qualified' }, { label: 'Proposal' }, { label: 'Closed' }] } },
    ],
  },
  {
    id: 'journey', name: 'Customer Journey / Experience Map', slides: [
      { title: 'Journey', type: 'timeline', args: { title: 'Customer Journey', events: [{ label: 'Awareness' }, { label: 'Consideration' }, { label: 'Purchase' }, { label: 'Retention' }, { label: 'Advocacy' }] } },
      { title: 'Stages', type: 'progression', args: { title: 'Experience Stages', steps: [{ label: 'Discover' }, { label: 'Evaluate' }, { label: 'Buy' }, { label: 'Use' }, { label: 'Recommend' }] } },
      { title: 'Touchpoints', type: 'radial-spoke', args: { title: 'Touchpoints', values: [1, 1, 1, 1, 1], labels: ['Web', 'Social', 'Store', 'Support', 'Email'] } },
      { title: 'Satisfaction', type: 'bar', args: { title: 'Satisfaction by Stage', values: [70, 65, 85, 80, 90], labels: ['Aware', 'Eval', 'Buy', 'Use', 'Refer'], format: 'percent' } },
      { title: 'Conversion Funnel', type: 'funnel', args: { title: 'Conversion', stages: [{ label: 'Visitors' }, { label: 'Leads' }, { label: 'Customers' }, { label: 'Advocates' }] } },
    ],
  },
  {
    id: 'pitch', name: 'Startup Pitch Deck', slides: [
      { title: 'Ecosystem', type: 'sphere-network', args: { title: 'Startup Pitch', hub: 'Product', satellites: [{ label: 'Customers' }, { label: 'Market' }, { label: 'Team' }, { label: 'Investors' }, { label: 'Partners' }] } },
      { title: 'Problem → Solution', type: 'funnel', args: { title: 'Problem → Solution', stages: [{ label: 'Pain' }, { label: 'Insight' }, { label: 'Solution' }, { label: 'Wedge' }] } },
      { title: 'Market Size', type: 'circle-stack', args: { title: 'TAM / SAM / SOM', layers: [{ label: 'TAM' }, { label: 'SAM' }, { label: 'SOM' }] } },
      { title: 'Traction', type: 'bar', args: { title: 'Traction', values: [10, 25, 60, 120], labels: ['Q1', 'Q2', 'Q3', 'Q4'], format: 'number' } },
      { title: 'Roadmap', type: 'timeline', args: { title: 'Roadmap', events: [{ label: 'Seed' }, { label: 'Series A' }, { label: 'Scale' }, { label: 'Series B' }] } },
    ],
  },
];

const TAGLINES = {
  consulting: 'Frameworks that turn analysis into action',
  cyber: 'Defending the enterprise, layer by layer',
  bizplan: 'The roadmap from vision to value',
  journey: 'Every step of the customer experience',
  pitch: 'The story investors want to hear',
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
