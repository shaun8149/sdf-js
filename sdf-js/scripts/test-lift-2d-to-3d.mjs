// test-lift-2d-to-3d.mjs — the deterministic 2D→3D twin lift.
import {
  liftSceneData2dTo3d,
  liftSubject,
  twinTypeOf,
  TWIN_MAP,
  fmt,
} from '../src/scene/lift-2d-to-3d.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== lift-2d-to-3d (twin map) ===\n');

// ── twin rule: T → T-3d ──
ok(twinTypeOf('funnel') === 'funnel-3d', 'twin rule: funnel → funnel-3d');
ok(twinTypeOf('arrow') === 'arrow-3d', 'twin rule: arrow → arrow-3d (no override needed)');
ok(twinTypeOf('gauge') === 'sphere-fill-3d', 'twin override: gauge → sphere-fill-3d');

// ── fmt ──
ok(fmt(35, 'percent') === '35%', 'fmt percent');
ok(fmt(1200, 'currency') === '$1200', 'fmt currency');
ok(fmt(7, 'number') === '7', 'fmt number');

// ── funnel: stages[] → count + cards, title → overlay title ──
{
  const out = liftSceneData2dTo3d({
    subjects: [
      {
        type: 'funnel',
        args: { title: 'Sales Funnel', stages: [{ label: 'A' }, { label: 'B' }, { label: 'C' }] },
      },
    ],
  });
  ok(
    out.subjects.length === 1 && out.subjects[0].type === 'funnel-3d',
    'funnel → 1 funnel-3d subject',
  );
  ok(out.subjects[0].args.stages === 3, 'funnel stages[] length → stages: 3');
  const title = out.overlay.find((o) => o.role === 'title');
  ok(title && title.text === 'SALES FUNNEL', 'title routed to overlay (uppercased)');
  const cards = out.overlay.filter((o) => o.role === 'card');
  ok(cards.length === 3 && cards[0].text === 'A', '3 stage labels routed to overlay cards');
  ok(
    out.subjects[0].args.stages === undefined ? false : true,
    'no SDF text baked (labels are overlay only)',
  );
  ok(out.cameraSequence && out.cameraSequence.shots.length === 2, 'default push-in camera added');
}

// ── pie: values + labels → values pass-through, labels+values → cards ──
{
  const out = liftSceneData2dTo3d({
    subjects: [
      {
        type: 'pie',
        args: { values: [35, 25, 40], labels: ['AWS', 'Azure', 'GCP'], format: 'percent' },
      },
    ],
  });
  ok(out.subjects[0].type === 'pie-3d', 'pie → pie-3d');
  ok(
    JSON.stringify(out.subjects[0].args.values) === JSON.stringify([35, 25, 40]),
    'pie values pass through',
  );
  const cards = out.overlay.filter((o) => o.role === 'card');
  ok(cards[0].text === 'AWS 35%', 'pie legend merges label + formatted value');
}

// ── bar: raw values → normalized 0..1, value labels at bar tops ──
{
  const out = liftSceneData2dTo3d({
    subjects: [{ type: 'bar', args: { values: [40, 80], format: 'percent' } }],
  });
  const v = out.subjects[0].args.values;
  ok(
    v.length === 2 && v[1] === 1.0 && Math.abs(v[0] - 0.55) < 1e-9,
    'bar values normalized (max→1.0, keep-visible floor)',
  );
  const vals = out.overlay.filter((o) => o.role === 'value');
  ok(
    vals.length === 2 && vals[0].text === '40%' && vals[1].text === '80%',
    'bar value labels formatted from raw values',
  );
}

// ── timeline: events[] → count + value labels ──
{
  const out = liftSceneData2dTo3d({
    subjects: [{ type: 'timeline', args: { events: [{ label: '2021' }, { label: '2022' }] } }],
  });
  ok(
    out.subjects[0].type === 'timeline-3d' && out.subjects[0].args.count === 2,
    'timeline events[] → count: 2',
  );
  ok(
    out.overlay.filter((o) => o.role === 'value').length === 2,
    'timeline event labels → 2 overlay values',
  );
}

// ── items family: array → count arg + legend cards ──
{
  const out = liftSceneData2dTo3d({ subjects: [{ type: 'pyramid', args: { layers: [{ label: 'Top' }, { label: 'Mid' }, { label: 'Base' }] } }] });
  ok(out.subjects[0].type === 'pyramid-3d' && out.subjects[0].args.levels === 3, 'pyramid layers[] → levels: 3 (2D key ≠ 3D key)');
  ok(out.overlay.filter((o) => o.role === 'card').length === 3, 'pyramid labels → 3 cards');
}
{
  const out = liftSceneData2dTo3d({ subjects: [{ type: 'agenda-list', args: { items: ['a', 'b'] } }] });
  ok(out.subjects[0].args.items === 2, 'agenda-list items[] → items: 2');
}

// ── tree family: {root:{children}} → levels + branching ──
{
  const root = { label: 'r', children: [{ label: 'a', children: [{ label: 'a1' }] }, { label: 'b' }] };
  const out = liftSceneData2dTo3d({ subjects: [{ type: 'org-chart', args: { root } }] });
  ok(out.subjects[0].type === 'org-chart-3d', 'org-chart → org-chart-3d');
  ok(out.subjects[0].args.levels === 3 && out.subjects[0].args.branching === 2, 'tree depth/fanout → levels:3, branching:2');
}

// ── venn: sets[] → sets count + cards ──
{
  const out = liftSceneData2dTo3d({ subjects: [{ type: 'venn', args: { sets: [{ label: 'A' }, { label: 'B' }, { label: 'C' }] } }] });
  ok(out.subjects[0].type === 'venn-3d' && out.subjects[0].args.sets === 3, 'venn sets[] → sets: 3');
}

// ── icon family: single label → centered caption card (not SDF) ──
{
  const out = liftSceneData2dTo3d({ subjects: [{ type: 'arrow', args: { label: 'Growth' } }] });
  const c = out.overlay.find((o) => o.role === 'card');
  ok(out.subjects[0].type === 'arrow-3d' && c && c.text === 'Growth' && c.align === 'center', 'arrow label → centered caption card');
}

// ── generic fallback: a type with no override still maps T → T-3d ──
{
  const { subject3d } = liftSubject({ type: 'some-unmapped-widget', args: {} });
  ok(subject3d.type === 'some-unmapped-widget-3d', 'generic fallback: unmapped type → type-3d');
}

// ── Sprint 24: previously dead-end atoms now have precise twins ──
{
  const cases = [
    ['swot', 'matrix-grid-3d'],
    ['value-chain-diagram', 'flow-chart-3d'],
    ['stat-banner', 'kpi-card-3d'],
    ['process-arrows', 'progression-3d'],
    ['circle-process-cycle', 'circle-loop-3d'],
    ['feature-card-grid', 'icon-grid-3d'],
    ['quote-pull', 'cube-3d'],
    ['number-list', 'agenda-list-3d'],
    ['vertical-timeline', 'timeline-3d'],
    ['comparison-table', 'matrix-grid-3d'],
  ];
  for (const [t2d, t3d] of cases) {
    const { subject3d } = liftSubject({ type: t2d, args: {} });
    ok(subject3d.type === t3d, `Sprint 24 twin: ${t2d} → ${t3d}`);
  }
}

// ── two-text-systems invariant: NO baked SDF text anywhere ──
{
  const out = liftSceneData2dTo3d({
    subjects: [{ type: 'funnel', args: { title: 'T', stages: [{ label: 'A' }] } }],
  });
  const baked = out.subjects.some((s) => /text/.test(s.type));
  ok(!baked, 'no text-* SDF subjects produced (all text → overlay)');
}

// ── Sprint 22 B1: mountain-path → mountain-3d (upgraded from progression-3d in B3) ──
{
  const out = liftSceneData2dTo3d({
    subjects: [
      {
        type: 'mountain-path',
        args: {
          title: 'Q4 Climb',
          summit: 'Series A',
          milestones: [
            { label: '$1M ARR' },
            { label: '10K users' },
            { label: 'PMF' },
            { label: 'Term sheet' },
          ],
        },
      },
    ],
  });
  ok(out.subjects[0].type === 'mountain-3d', 'mountain-path → mountain-3d (upgraded from progression-3d)');
  ok(out.subjects[0].args.pathMarkers === 4, 'mountain-path: pathMarkers = milestones.length (4)');
  const cards = out.overlay.filter((o) => o.role === 'card');
  ok(cards.length === 4, 'mountain-path: 4 milestone cards in overlay');
  const summitVal = out.overlay.find((o) => o.role === 'value');
  ok(summitVal && summitVal.text === 'Series A', 'mountain-path: summit → value overlay');
}

// ── Sprint 22 B1: strategy-map → layer-stack-3d ──
{
  const out = liftSceneData2dTo3d({
    subjects: [
      {
        type: 'strategy-map',
        args: {
          perspectives: [
            { label: 'Financial', items: ['Revenue'] },
            { label: 'Customer', items: ['NPS'] },
            { label: 'Process', items: ['Ops'] },
            { label: 'Learning', items: ['Talent'] },
          ],
        },
      },
    ],
  });
  ok(out.subjects[0].type === 'layer-stack-3d', 'strategy-map → layer-stack-3d');
  ok(out.subjects[0].args.layers === 4, 'strategy-map: layers = perspectives.length (4)');
  const cards = out.overlay.filter((o) => o.role === 'card');
  ok(cards.length === 4, 'strategy-map: 4 perspective cards in overlay');
}

// ── Sprint 22 B1: radar-chart → radial-spoke-3d ──
{
  const out = liftSceneData2dTo3d({
    subjects: [
      {
        type: 'radar-chart',
        args: {
          axes: ['Speed', 'Quality', 'Cost', 'Scalability', 'UX', 'Security'],
          series: [{ label: 'Current', values: [0.7, 0.4, 0.6, 0.3, 0.8, 0.5] }],
        },
      },
    ],
  });
  ok(out.subjects[0].type === 'radial-spoke-3d', 'radar-chart → radial-spoke-3d');
  ok(out.subjects[0].args.spokes === 6, 'radar-chart: spokes = axes.length (6)');
  const cards = out.overlay.filter((o) => o.role === 'card');
  ok(cards.length === 6, 'radar-chart: 6 axis+value cards in overlay');
  ok(cards[0].text.includes('70%'), 'radar-chart: first overlay card has percent value');
}

// ── Sprint 22 B1: okr-tree → tree-diagram-3d ──
{
  const out = liftSceneData2dTo3d({
    subjects: [
      {
        type: 'okr-tree',
        args: {
          objective: 'Become market leader',
          quarter: 'Q3 2026',
          keyResults: [
            { label: 'Cross $50M ARR', progress: 0.48, sublabel: '$24M / $50M' },
            { label: 'NPS > 70', progress: 0.86 },
            { label: '24/7 Support SLA', progress: 0.65 },
          ],
        },
      },
    ],
  });
  ok(out.subjects[0].type === 'tree-diagram-3d', 'okr-tree → tree-diagram-3d');
  ok(out.subjects[0].args.levels === 2, 'okr-tree: levels = 2 (objective + KRs)');
  ok(out.subjects[0].args.branching === 3, 'okr-tree: branching = keyResults.length (3)');
  const cards = out.overlay.filter((o) => o.role === 'card');
  ok(cards.length === 3, 'okr-tree: 3 KR cards in overlay');
  ok(cards[0].text.includes('48%'), 'okr-tree: first card has progress %');
  ok(cards[0].text.includes('$24M / $50M'), 'okr-tree: first card includes sublabel');
}

// ── Sprint 22 B2: decision-tree-3-arm → tree-diagram-3d ──
{
  const out = liftSceneData2dTo3d({
    subjects: [
      {
        type: 'decision-tree-3-arm',
        args: {
          title: 'Which Growth Strategy?',
          question: 'What is the best path forward?',
          arms: [
            { label: 'Expand Market', sublabel: 'New geographies' },
            { label: 'Deepen Product', sublabel: 'More features' },
            { label: 'Grow Team', sublabel: 'Scale headcount' },
          ],
        },
      },
    ],
  });
  ok(out.subjects[0].type === 'tree-diagram-3d', 'decision-tree-3-arm → tree-diagram-3d');
  ok(out.subjects[0].args.levels === 2, 'decision-tree-3-arm: levels = 2');
  ok(out.subjects[0].args.branching === 3, 'decision-tree-3-arm: branching = arms.length (3)');
  const cards = out.overlay.filter((o) => o.role === 'card');
  ok(cards.length >= 3, 'decision-tree-3-arm: at least 3 cards in overlay');
  ok(cards.some((c) => c.text.includes('Expand Market')), 'decision-tree-3-arm: arm label in overlay');
}

// ── Sprint 22 B2: maturity-model → pyramid-3d ──
{
  const out = liftSceneData2dTo3d({
    subjects: [
      {
        type: 'maturity-model',
        args: {
          title: 'AI Maturity',
          stages: [
            { label: 'Initial', description: 'Ad hoc' },
            { label: 'Managed', description: 'Tracked' },
            { label: 'Defined', description: 'Standardized' },
            { label: 'Quantitative', description: 'Data-driven' },
            { label: 'Optimizing', description: 'Continuous' },
          ],
          currentLevel: 3,
          label: 'Current: Level 3',
        },
      },
    ],
  });
  ok(out.subjects[0].type === 'pyramid-3d', 'maturity-model → pyramid-3d');
  ok(out.subjects[0].args.levels === 5, 'maturity-model: levels = stages.length (5)');
  const cards = out.overlay.filter((o) => o.role === 'card');
  ok(cards.length === 5, 'maturity-model: 5 stage cards in overlay');
  ok(cards[2].text.includes('▶'), 'maturity-model: currentLevel stage has marker');
}

// ── Sprint 22 B2: cost-benefit-matrix → matrix-grid-3d ──
{
  const out = liftSceneData2dTo3d({
    subjects: [
      {
        type: 'cost-benefit-matrix',
        args: {
          title: 'Initiative Prioritization',
          items: [
            { label: 'AI Chatbot', cost: 'low', benefit: 'high' },
            { label: 'ERP Upgrade', cost: 'high', benefit: 'high' },
            { label: 'Email Campaign', cost: 'low', benefit: 'low' },
          ],
          quadrantLabels: { tl: 'Quick Wins', tr: 'Major Projects', bl: 'Fill-ins', br: 'Hard Sells' },
        },
      },
    ],
  });
  ok(out.subjects[0].type === 'matrix-grid-3d', 'cost-benefit-matrix → matrix-grid-3d');
  ok(out.subjects[0].args.rows === 2 && out.subjects[0].args.cols === 2, 'cost-benefit-matrix: 2x2 args');
  const cards = out.overlay.filter((o) => o.role === 'card');
  ok(cards.some((c) => c.text === 'Quick Wins'), 'cost-benefit-matrix: quadrant label in overlay');
  ok(cards.some((c) => c.text.includes('AI Chatbot')), 'cost-benefit-matrix: item label in overlay');
  ok(cards.some((c) => c.text.includes('low cost')), 'cost-benefit-matrix: item cost in overlay');
}

// ── Sprint 22 B2: journey-flow-curve → timeline-3d ──
{
  const out = liftSceneData2dTo3d({
    subjects: [
      {
        type: 'journey-flow-curve',
        args: {
          title: 'Customer Onboarding Journey',
          touchpoints: [
            { label: 'Discovery', sublabel: 'Sees ad', emotion: 0.3 },
            { label: 'Sign-up', emotion: 0.6 },
            { label: 'Onboarding', emotion: -0.2 },
            { label: 'First Value', emotion: 0.9 },
          ],
        },
      },
    ],
  });
  ok(out.subjects[0].type === 'timeline-3d', 'journey-flow-curve → timeline-3d');
  ok(out.subjects[0].args.count === 4, 'journey-flow-curve: count = touchpoints.length (4)');
  const cards = out.overlay.filter((o) => o.role === 'card');
  ok(cards.length === 4, 'journey-flow-curve: 4 touchpoint cards in overlay');
  ok(cards[0].text.includes('+30%'), 'journey-flow-curve: positive emotion card has + sign');
  ok(cards[2].text.includes('-20%'), 'journey-flow-curve: negative emotion card has - sign');
}

// ── Sprint 22 B3: risk-heatmap → matrix-grid-3d ──
{
  const out = liftSceneData2dTo3d({
    subjects: [
      {
        type: 'risk-heatmap',
        args: {
          title: 'Security Risks',
          risks: [
            { label: 'Data breach', likelihood: 4, impact: 5 },
            { label: 'Compliance fine', likelihood: 2, impact: 4 },
            { label: 'Vendor delay', likelihood: 5, impact: 2 },
          ],
        },
      },
    ],
  });
  ok(out.subjects[0].type === 'matrix-grid-3d', 'risk-heatmap → matrix-grid-3d');
  ok(out.subjects[0].args.rows === 5 && out.subjects[0].args.cols === 5, 'risk-heatmap: 5x5 args');
  const cards = out.overlay.filter((o) => o.role === 'card');
  ok(cards.length === 3, 'risk-heatmap: 3 risk labels in overlay cards');
  ok(cards[0].text === 'Data breach', 'risk-heatmap: first risk label in overlay');
}

// ── Sprint 22 B3: org-vs-org-matrix → matrix-grid-3d ──
{
  const out = liftSceneData2dTo3d({
    subjects: [
      {
        type: 'org-vs-org-matrix',
        args: {
          title: 'Magic Quadrant',
          xAxis: 'Vision',
          yAxis: 'Execution',
          orgs: [
            { name: 'Us', x: 0.8, y: 0.9, isUs: true },
            { name: 'Rival A', x: 0.5, y: 0.5 },
            { name: 'Rival B', x: 0.7, y: 0.3 },
          ],
          quadrantLabels: { tl: 'Visionaries', tr: 'Leaders', bl: 'Niche', br: 'Challengers' },
        },
      },
    ],
  });
  ok(out.subjects[0].type === 'matrix-grid-3d', 'org-vs-org-matrix → matrix-grid-3d');
  ok(out.subjects[0].args.rows === 2 && out.subjects[0].args.cols === 2, 'org-vs-org-matrix: 2x2 args');
  const cards = out.overlay.filter((o) => o.role === 'card');
  ok(cards.some((c) => c.text === 'Visionaries'), 'org-vs-org-matrix: quadrant label in overlay');
  ok(cards.some((c) => c.text === 'Us'), 'org-vs-org-matrix: org name in overlay');
}

// ── Sprint 22 B3: kanban-board → flow-chart-3d ──
{
  const out = liftSceneData2dTo3d({
    subjects: [
      {
        type: 'kanban-board',
        args: {
          title: 'Sprint Board',
          columns: [
            { label: 'Backlog', cards: [{ label: 'Task A' }, { label: 'Task B' }] },
            { label: 'In Progress', cards: [{ label: 'Task C' }] },
            { label: 'Done', cards: [{ label: 'Task D' }] },
          ],
        },
      },
    ],
  });
  ok(out.subjects[0].type === 'flow-chart-3d', 'kanban-board → flow-chart-3d');
  ok(out.subjects[0].args.steps === 3, 'kanban-board: steps = columns.length (3)');
  const cards = out.overlay.filter((o) => o.role === 'card');
  ok(cards.length === 3, 'kanban-board: 3 column cards in overlay');
  ok(cards[0].text.includes('Backlog'), 'kanban-board: column label in first card');
}

// ── Sprint 22 B3: donut-with-center → circle-segmented-3d ──
{
  const out = liftSceneData2dTo3d({
    subjects: [
      {
        type: 'donut-with-center',
        args: {
          title: 'Revenue',
          centerValue: '$24M',
          centerLabel: 'Total ARR',
          segments: [
            { label: 'Enterprise', value: 12 },
            { label: 'Mid-market', value: 8 },
            { label: 'SMB', value: 4 },
          ],
        },
      },
    ],
  });
  ok(out.subjects[0].type === 'circle-segmented-3d', 'donut-with-center → circle-segmented-3d');
  ok(out.subjects[0].args.segments === 3, 'donut-with-center: segments = segments.length (3)');
  const vals = out.overlay.filter((o) => o.role === 'value');
  ok(vals.length === 1 && vals[0].text === '$24M', 'donut-with-center: centerValue → value overlay');
  const cards = out.overlay.filter((o) => o.role === 'card');
  ok(cards.some((c) => c.text === 'Total ARR'), 'donut-with-center: centerLabel → card overlay');
  ok(cards.some((c) => c.text === 'Enterprise'), 'donut-with-center: segment labels in overlay');
}

// ── Sprint 22 B4: funnel-with-conversion → funnel-3d ──
{
  const out = liftSceneData2dTo3d({
    subjects: [
      {
        type: 'funnel-with-conversion',
        args: {
          title: 'SaaS Funnel',
          stages: [
            { label: 'Visitors', value: 100000 },
            { label: 'Signups', value: 12000 },
            { label: 'Trials', value: 4200 },
            { label: 'Paid', value: 760 },
          ],
        },
      },
    ],
  });
  ok(out.subjects[0].type === 'funnel-3d', 'funnel-with-conversion → funnel-3d');
  ok(out.subjects[0].args.stages === 4, 'funnel-with-conversion: stages = stages.length (4)');
  const cards = out.overlay.filter((o) => o.role === 'card');
  ok(cards.some((c) => c.text.includes('Visitors')), 'funnel-with-conversion: stage labels in overlay');
  ok(cards.some((c) => c.text.includes('Paid')), 'funnel-with-conversion: last stage label in overlay');
}

// ── Sprint 22 B4: pillar-3up → column-3d ──
{
  const out = liftSceneData2dTo3d({
    subjects: [
      {
        type: 'pillar-3up',
        args: {
          title: 'Our Three Pillars',
          pillars: [
            { icon: 'lightning', heading: 'Speed', body: 'Fast.' },
            { icon: 'shield-check', heading: 'Security', body: 'Safe.' },
            { icon: 'globe', heading: 'Scale', body: 'Big.' },
          ],
        },
      },
    ],
  });
  ok(out.subjects[0].type === 'column-3d', 'pillar-3up → column-3d');
  ok(out.subjects[0].args.columns === 3, 'pillar-3up: columns = pillars.length (3)');
  const cards = out.overlay.filter((o) => o.role === 'card');
  ok(cards.some((c) => c.text === 'Speed'), 'pillar-3up: pillar heading in overlay');
}

// ── Sprint 22 B4: testimonial-wall → matrix-grid-3d ──
{
  const out = liftSceneData2dTo3d({
    subjects: [
      {
        type: 'testimonial-wall',
        args: {
          title: 'What Customers Say',
          testimonials: [
            { quote: 'Great product.', name: 'Alice', role: 'CEO, Corp A' },
            { quote: 'Loved it.', name: 'Bob', role: 'CTO, Corp B' },
            { quote: 'Best tool.', name: 'Carol', role: 'VP, Corp C' },
          ],
        },
      },
    ],
  });
  ok(out.subjects[0].type === 'matrix-grid-3d', 'testimonial-wall → matrix-grid-3d');
  ok(out.subjects[0].args.rows === 1 && out.subjects[0].args.cols === 3, 'testimonial-wall: rows=1 cols=3');
  const cards = out.overlay.filter((o) => o.role === 'card');
  ok(cards.some((c) => c.text.includes('Alice')), 'testimonial-wall: name in overlay');
}

// ── Sprint 22 B4: balance-scale → venn-3d ──
{
  const out = liftSceneData2dTo3d({
    subjects: [
      {
        type: 'balance-scale',
        args: {
          title: 'Build vs Buy',
          leftLabel: 'BUILD',
          rightLabel: 'BUY',
          leftItems: ['Full control', 'IP retention'],
          rightItems: ['Faster to market', 'Lower cost'],
          verdict: 'Buy for v1',
        },
      },
    ],
  });
  ok(out.subjects[0].type === 'venn-3d', 'balance-scale → venn-3d');
  ok(out.subjects[0].args.sets === 2, 'balance-scale: sets = 2');
  const cards = out.overlay.filter((o) => o.role === 'card');
  ok(cards.some((c) => c.text === 'BUILD'), 'balance-scale: leftLabel in overlay');
  ok(cards.some((c) => c.text === 'BUY'), 'balance-scale: rightLabel in overlay');
  const vals = out.overlay.filter((o) => o.role === 'value');
  ok(vals.some((v) => v.text === 'Buy for v1'), 'balance-scale: verdict → value overlay');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
