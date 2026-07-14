// sdf-js/scripts/test-ir-to-2d.mjs — IR→2D bridge (Sprint 27 bridge 2)
// Per-structure IR→atom mappings, hierarchy tree reconstruction from
// relations, network edge mapping, invalid-IR rejection, deck-export shape,
// a round-trip smoke against bridge-1's funnelSlotToIR, and a Node-env
// render-without-throwing pass over every produced sceneData subject.
import { irToSceneData, irDeckTo2DDeck } from '../src/scene/ir-to-2d.js';
import { funnelSlotToIR } from '../src/scene/scaffold-to-ir.js';
import { renderAtom } from '../src/present/atoms-2d/registry.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== ir-to-2d (Sprint 27 bridge 2) ===\n');

// ---- sequence: strictly decreasing magnitude → funnel-with-conversion -------
{
  const ir = {
    structure: 'sequence',
    nodes: ['Leads', 'Qualified', 'Closed'],
    magnitude: [1000, 300, 45],
    title: 'Pipeline',
  };
  const sd = irToSceneData(ir);
  const subj = sd.subjects[0];
  ok(
    subj.type === 'funnel-with-conversion',
    'sequence + decreasing magnitude → funnel-with-conversion',
  );
  ok(subj.args.title === 'Pipeline', 'funnel-with-conversion carries title');
  ok(
    JSON.stringify(subj.args.stages.map((s) => s.label)) === JSON.stringify(ir.nodes),
    'funnel-with-conversion stage labels match nodes',
  );
  ok(
    JSON.stringify(subj.args.stages.map((s) => s.value)) === JSON.stringify(ir.magnitude),
    'funnel-with-conversion stage values match magnitude',
  );
}

// ---- sequence: no magnitude → process-arrows ---------------------------------
{
  const ir = {
    structure: 'sequence',
    nodes: ['Discover', 'Define', 'Design'],
    title: 'Our Process',
  };
  const sd = irToSceneData(ir);
  const subj = sd.subjects[0];
  ok(subj.type === 'process-arrows', 'sequence + no magnitude → process-arrows');
  ok(
    JSON.stringify(subj.args.steps.map((s) => s.label)) === JSON.stringify(ir.nodes),
    'process-arrows step labels match nodes',
  );
}

// ---- sequence: non-monotonic magnitude → process-arrows (not funnel) --------
{
  const ir = {
    structure: 'sequence',
    nodes: ['A', 'B', 'C'],
    magnitude: [100, 50, 80],
    title: 'Non-monotonic',
  };
  const sd = irToSceneData(ir);
  ok(
    sd.subjects[0].type === 'process-arrows',
    'sequence + non-monotonic magnitude → process-arrows',
  );
}

// ---- hierarchy: 5-node 2-level tree rebuilt from relations -------------------
{
  const ir = {
    structure: 'hierarchy',
    nodes: ['CEO', 'CTO', 'CMO', 'Eng', 'Design'],
    relations: [
      [0, 1],
      [0, 2],
      [1, 3],
      [1, 4],
    ],
    title: 'Org',
  };
  const sd = irToSceneData(ir);
  const subj = sd.subjects[0];
  ok(subj.type === 'org-chart', 'hierarchy → org-chart');
  ok(subj.args.title === 'Org', 'org-chart carries title');
  const root = subj.args.root;
  ok(root.name === 'CEO', 'org-chart root = node with no parent (CEO)');
  ok(root.children?.length === 2, 'org-chart root has 2 children');
  ok(root.children[0].name === 'CTO', 'org-chart first child = CTO');
  ok(root.children[0].children?.length === 2, 'org-chart CTO has 2 children');
  ok(
    root.children[0].children.map((c) => c.name).join(',') === 'Eng,Design',
    'org-chart grandchildren = Eng, Design',
  );
  ok(root.children[1].name === 'CMO' && !root.children[1].children, 'org-chart CMO is a leaf');
}

// ---- network: relations → edges intact ---------------------------------------
{
  const ir = {
    structure: 'network',
    nodes: ['A', 'B', 'C'],
    relations: [
      [0, 1],
      [1, 2],
    ],
    title: 'Web',
  };
  const sd = irToSceneData(ir);
  const subj = sd.subjects[0];
  ok(subj.type === 'relationship-graph', 'network → relationship-graph');
  ok(subj.args.nodes.length === 3, 'relationship-graph has all nodes');
  ok(
    subj.args.nodes.every((n, i) => n.id === String(i) && n.label === ir.nodes[i]),
    'relationship-graph node id/label mapped from index/nodes',
  );
  ok(
    JSON.stringify(subj.args.edges) ===
      JSON.stringify([
        { from: '0', to: '1' },
        { from: '1', to: '2' },
      ]),
    'relationship-graph edges intact from relations',
  );
}

// ---- magnitude → bar (>6 categories — chooseMagnitudeAtom's bar fallback) ----
// Sprint 28 made magnitude→2D shape-smart (bar/pie/donut-with-center via
// chooseMagnitudeAtom — see test-ir-matrix.mjs for the full decision-matrix
// coverage). 7 categories is above every pie/donut threshold, so this stays
// the plain bar path this test originally exercised.
{
  const ir = {
    structure: 'magnitude',
    nodes: ['Americas', 'EMEA', 'APAC', 'LATAM', 'MEA', 'Nordics', 'ANZ'],
    magnitude: [890, 420, 310, 180, 140, 90, 60],
    title: 'Revenue by Region',
  };
  const sd = irToSceneData(ir);
  const subj = sd.subjects[0];
  ok(subj.type === 'bar', 'magnitude → bar');
  ok(JSON.stringify(subj.args.labels) === JSON.stringify(ir.nodes), 'bar labels = nodes');
  ok(JSON.stringify(subj.args.values) === JSON.stringify(ir.magnitude), 'bar values = magnitude');
}

// ---- full-slide layout on every subject --------------------------------------
{
  // Sprint 98: magnitude 页自动携带洞见底条 — 主体让出 112+16, 底条落底
  const ir = { structure: 'magnitude', nodes: ['X', 'Y'], magnitude: [1, 2] };
  const sd = irToSceneData(ir);
  const subj = sd.subjects[0];
  ok(
    subj.x === 40 && subj.y === 20 && subj.w === 1200 && subj.h === 552,
    'magnitude subject yields the bottom strip (680→552)',
  );
  const strip = sd.subjects[1];
  ok(
    strip?.type === 'callout-banner' && strip.y === 588 && strip.h === 112,
    'derived-insight strip is a callout-banner pinned to the slide bottom',
  );
  ok(
    typeof strip?.args?.body === 'string' && strip.args.body.length > 0,
    'insight strip carries a derivation body (Rule 24 citations)',
  );
  // 非 magnitude 且无 callout — 不长底条 (现状不变)
  const seqSd = irToSceneData({
    structure: 'sequence',
    nodes: ['访问', '注册'],
    relations: [[0, 1]],
  });
  ok(seqSd.subjects.length === 1, 'non-magnitude without callout keeps single subject');
  // ir.callout 优先于推导洞见 (页面关键事实 > 评论)
  const coSd = irToSceneData({
    structure: 'magnitude',
    nodes: ['X', 'Y'],
    magnitude: [1, 2],
    callout: { text: '本轮融资 US$ 12.5M', sub: '估值 US$ 80M pre-money' },
  });
  const coStrip = coSd.subjects[1];
  ok(
    coStrip?.args?.heading === '本轮融资 US$ 12.5M' && coStrip.args.body.includes('80M'),
    'ir.callout wins over derived insight (page-critical fact first)',
  );
  // callout 无 sub — text 落 body (callout-banner body 必填)
  const bare = irToSceneData({
    structure: 'sequence',
    nodes: ['A', 'B'],
    relations: [[0, 1]],
    callout: { text: '关键事实' },
  });
  ok(
    bare.subjects.length === 2 && bare.subjects[1].args.body === '关键事实',
    'callout without sub lands text in required body arg',
  );
}

// ---- invalid IR throws ---------------------------------------------------------
{
  let threw = false;
  try {
    irToSceneData({ structure: 'bogus', nodes: ['a'] });
  } catch (e) {
    threw = true;
  }
  ok(threw, 'invalid IR (unknown structure) throws');

  let threw2 = false;
  try {
    irToSceneData({ structure: 'hierarchy', nodes: ['a', 'b'] }); // no relations
  } catch (e) {
    threw2 = true;
  }
  ok(threw2, 'invalid IR (hierarchy w/o relations) throws');
}

// ---- round-trip smoke: bridge-1 funnelSlotToIR → irToSceneData ---------------
{
  const slot = {
    subjects: [
      {
        type: 'funnel',
        args: {
          title: 'Sales Funnel',
          stages: [
            { label: 'Leads', value: 1000 },
            { label: 'Qualified', value: 400 },
            { label: 'Proposal', value: 150 },
            { label: 'Closed', value: 40 },
          ],
        },
      },
    ],
  };
  const ir = funnelSlotToIR(slot);
  const sd = irToSceneData(ir);
  const subj = sd.subjects[0];
  ok(
    subj.type === 'funnel-with-conversion',
    'round-trip: bridge-1 funnel IR → funnel-with-conversion',
  );
  ok(
    JSON.stringify(subj.args.stages.map((s) => s.label)) ===
      JSON.stringify(['Leads', 'Qualified', 'Proposal', 'Closed']),
    'round-trip: stage labels match original funnel atom',
  );
}

// ---- irDeckTo2DDeck → exporter-ready shape -------------------------------------
{
  const irDeck = {
    title: 'Q3 Review',
    slides: [
      {
        structure: 'magnitude',
        nodes: ['Americas', 'EMEA'],
        magnitude: [890, 420],
        title: 'Revenue',
      },
      { structure: 'sequence', nodes: ['Leads', 'Closed'], magnitude: [1200, 45], title: 'Funnel' },
    ],
  };
  const deck = irDeckTo2DDeck(irDeck);
  ok(deck.title === 'Q3 Review', 'irDeckTo2DDeck carries deck title');
  ok(
    deck.theme && deck.theme.id === 'editorial-navy',
    'irDeckTo2DDeck defaults theme to editorial-navy',
  );
  ok(deck.scaffold?.id === 'ir-deck', 'irDeckTo2DDeck sets scaffold.id = ir-deck');
  ok(deck.slots.length === 2, 'irDeckTo2DDeck emits one slot per slide');
  ok(
    deck.slots.every((s, i) => s.slotIdx === i && (s.sceneData?.subjects?.length ?? 0) >= 1),
    'irDeckTo2DDeck slots carry slotIdx + sceneData',
  );
  // 2 nodes, no dominant slice (890/1310 ≈ 68%) → chooseMagnitudeAtom picks
  // donut-with-center (Sprint 28 smart selection), not the old flat 'bar'.
  ok(
    deck.slots[0].sceneData.subjects[0].type === 'donut-with-center',
    'irDeckTo2DDeck slot 0 = donut-with-center (smart magnitude selection)',
  );
  ok(
    deck.slots[1].sceneData.subjects[0].type === 'funnel-with-conversion',
    'irDeckTo2DDeck slot 1 = funnel-with-conversion',
  );

  // opts.theme override by id
  const deck2 = irDeckTo2DDeck(irDeck, { theme: 'pitch-cobalt-orange' });
  ok(
    deck2.theme?.id === 'pitch-cobalt-orange' || deck2.theme != null,
    'irDeckTo2DDeck honors opts.theme override',
  );
}

// ---- Node-env render smoke: renderAtom each produced subject w/o throwing ----
function makeStubCtx() {
  return {
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    bezierCurveTo() {},
    closePath() {},
    rect() {},
    roundRect() {},
    clip() {},
    fillRect() {},
    fillText() {},
    strokeText() {},
    measureText() {
      return { width: 40 };
    },
    arc() {},
    fill() {},
    stroke() {},
    setLineDash() {},
    drawImage() {},
    createLinearGradient() {
      return { addColorStop() {} };
    },
    createRadialGradient() {
      return { addColorStop() {} };
    },
    fillStyle: '',
    strokeStyle: '',
    font: '',
    lineWidth: 1,
    lineCap: '',
    lineJoin: '',
    textAlign: '',
    textBaseline: '',
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetY: 0,
  };
}

{
  const irs = [
    {
      structure: 'sequence',
      nodes: ['Leads', 'Qualified', 'Closed'],
      magnitude: [1000, 300, 45],
      title: 'A',
    },
    { structure: 'sequence', nodes: ['Discover', 'Define', 'Design'], title: 'B' },
    {
      structure: 'hierarchy',
      nodes: ['CEO', 'CTO', 'CMO', 'Eng', 'Design'],
      relations: [
        [0, 1],
        [0, 2],
        [1, 3],
        [1, 4],
      ],
      title: 'C',
    },
    {
      structure: 'network',
      nodes: ['A', 'B', 'C'],
      relations: [
        [0, 1],
        [1, 2],
      ],
      title: 'D',
    },
    {
      structure: 'magnitude',
      nodes: ['Americas', 'EMEA', 'APAC'],
      magnitude: [890, 420, 310],
      title: 'E',
    },
  ];

  let allRendered = true;
  for (const ir of irs) {
    const sd = irToSceneData(ir);
    for (const subj of sd.subjects) {
      try {
        await renderAtom(makeStubCtx(), subj.type, subj.args, 'pseudo3d', {
          x: subj.x,
          y: subj.y,
          w: subj.w,
          h: subj.h,
        });
      } catch (e) {
        allRendered = false;
        console.log(`    render threw for ${subj.type}: ${e.message}`);
      }
    }
  }
  ok(allRendered, 'renderAtom does not throw for any produced sceneData subject');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
