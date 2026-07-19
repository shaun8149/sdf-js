// test-slide-digest.mjs — the deterministic anti-fabrication layer, no LLM.
// Locks the behaviors bought by the first slides→IR supervisor audit:
//   1. tick-ladder detection (axis ticks must be named, data runs must not)
//   2. spatial label↔value pairing (bbox-driven, heading-priority)
//   3. digest assembly (warning + pairing notes present)
// Real-corpus cases use D0961 slidedata pages whose ground truth was settled
// by rendering the source pages during the 2026-07-19 audits.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { detectTickLadders, spatialPairs, slideDigest } from '../src/mapping/slide-digest.js';

const REPO = fileURLToPath(new URL('../..', import.meta.url));

let pass = 0;
let fail = 0;
const ok = (cond, msg) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.error(`  ✗ ${msg}`);
  }
};

console.log('=== slide-digest: deterministic anti-fabrication layer ===\n');

// ---- 1. tick-ladder detection ------------------------------------------------
{
  // p16-style axis: 0 / 62.5M / 125M / 187.5M / 250M — must be caught
  const l1 = detectTickLadders([0, 62500000, 125000000, 187500000, 250000000]);
  ok(l1.length === 1 && l1[0].length === 5, 'axis ladder with 0 detected (p16 激活用户轴)');

  // p17-style axis without 0: 4/7/10/13/16 (length ≥4 rule)
  const l2 = detectTickLadders([4, 7, 10, 13, 16]);
  ok(l2.length === 1, 'axis ladder without 0 detected when ≥4 items (p17 阅读数轴)');

  // Real DATA series must NOT be flagged: p3's 2014 values
  const l3 = detectTickLadders([78.4, 77.5, 73.6, 67.5, 61.0, 57.6]);
  ok(l3.length === 0, 'irregular data series not flagged (p3 需求占比)');

  // D0961 fill levels 20/50/80/90 — irregular, not a ladder
  const l4 = detectTickLadders([20, 50, 80, 90]);
  ok(l4.length === 0, 'D0961 20/50/80/90 not flagged');

  // Trap: 10..100 by 10 IS equally spaced but IS the data on D0961 p18/19.
  // The detector flags it — the LLM rules allow keeping it when the numbers
  // are the page's PROMINENT content (fs-large), so here we only lock the
  // detector's raw behavior.
  const l5 = detectTickLadders([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  ok(l5.length === 1, 'uniform 10..100 run is (correctly) suspicious to the detector');
}

// ---- 2. spatial pairing on the real D0961 corpus ------------------------------
{
  const slides = JSON.parse(readFileSync(`${REPO}sdf-js/examples/pdf-demo/slidedata.json`, 'utf8'));

  // Page 7 (index 6): three spheres 50/100/80 under DESCRIPTION 1/2/3.
  // Ground truth settled by rendering the page: D1=50, D2=100, D3=80.
  const p6 = Object.fromEntries(spatialPairs(slides[6]).map((p) => [p.num, p.label]));
  ok(p6['50%'] === 'DESCRIPTION 1', 'D0961 p7: 50% ↔ DESCRIPTION 1');
  ok(p6['100%'] === 'DESCRIPTION 2', 'D0961 p7: 100% ↔ DESCRIPTION 2');
  ok(p6['80%'] === 'DESCRIPTION 3', 'D0961 p7: 80% ↔ DESCRIPTION 3');

  // Page 6 (index 5): five gauges. Audit ground truth: D3=50, D4=100, D5=80.
  const p5 = Object.fromEntries(spatialPairs(slides[5]).map((p) => [p.num, p.label]));
  ok(p5['50'] === 'DESCRIPTION 3', 'D0961 p6: 50 ↔ DESCRIPTION 3');
  ok(p5['100'] === 'DESCRIPTION 4', 'D0961 p6: 100 ↔ DESCRIPTION 4');
  ok(p5['80'] === 'DESCRIPTION 5', 'D0961 p6: 80 ↔ DESCRIPTION 5');
}

// ---- 3. digest assembly --------------------------------------------------------
{
  const slide = {
    title: 'T',
    layout: 'chart',
    body: [
      { text: '0%', bbox: { x: 10, y: 10, w: 20, h: 10 }, fontSize: 10 },
      { text: '50%', bbox: { x: 10, y: 60, w: 20, h: 10 }, fontSize: 10 },
      { text: '100%', bbox: { x: 10, y: 110, w: 20, h: 10 }, fontSize: 10 },
      { text: 'REVENUE', bbox: { x: 200, y: 20, w: 80, h: 12 }, fontSize: 16 },
      { text: '73%', bbox: { x: 210, y: 60, w: 40, h: 20 }, fontSize: 30 },
    ],
  };
  const d = slideDigest(slide, 0);
  ok(d.includes('WARNING'), 'digest carries tick-ladder warning');
  ok(d.includes('[0, 50, 100]'), 'warning names the ladder run');
  ok(/73% ↔ "REVENUE"/.test(d), 'digest carries the spatial pairing note');
  ok(d.includes('PAGE 1'), 'digest is 1-based paged');
}

// ---- 3b. ladder escalation rules (eval round 4: interpolation attack) -----------
{
  const { pageLadders } = await import('../src/mapping/slide-digest.js');
  const mk = (vals, fs) =>
    vals.map((v, k) => ({
      text: String(v),
      bbox: { x: 10, y: 10 + k * 20, w: 20, h: 10 },
      fontSize: fs,
    }));
  // p16-style: two zero-anchored axes, ticks ARE the page's biggest numbers
  const p16 = {
    title: 't',
    body: [
      ...mk([0, 62500000, 125000000, 187500000, 250000000], 20),
      ...mk([0, 8450000, 16900000, 25350000, 33800000], 20),
    ],
  };
  const L16 = pageLadders(p16);
  ok(
    L16.strong.length >= 2 && L16.ambiguous.length === 0,
    'zero-anchored ladders escalate to strong (p16)',
  );
  // p17-style: two non-zero axes → multi-axis escalation
  const p17 = {
    title: 't',
    body: [
      ...mk([4, 7, 10, 13, 16], 20),
      ...mk(
        [15, 21, 28, 34, 40].map((x) => x + 0.001),
        20,
      ),
    ],
  };
  const L17 = pageLadders(p17);
  ok(
    L17.strong.length >= 2 && L17.ambiguous.length === 0,
    'two ambiguous ladders escalate to strong (p17)',
  );
  // D0961 p19-style: a single prominent uniform data ladder stays ambiguous
  const p19 = { title: 't', body: mk([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 28) };
  const L19 = pageLadders(p19);
  ok(
    L19.strong.length === 0 && L19.ambiguous.length === 1,
    'single prominent data ladder stays ambiguous (D0961 p19)',
  );
}

// ---- 3c. JSON salvage + arity repair (slide-to-ir) --------------------------------
{
  const { parseJsonLoose, repairArity } = await import('../src/mapping/slide-to-ir.js');
  // p21-style naked embedded quotes inside a string literal
  const bad = '{"title": ""头条号"平台", "n": [1, 2]}';
  const fixed = parseJsonLoose(bad);
  ok(
    fixed.title === '"头条号"平台' && fixed.n.length === 2,
    'naked embedded quotes salvaged (p21)',
  );
  // clean JSON untouched
  ok(parseJsonLoose('x {"a": "b\\"c", "d": 1} y').a === 'b"c', 'escaped quotes still parse');
  // arity: 11 values, 6 labels → labels padded, values sacred
  const r = repairArity({ structure: 'magnitude', nodes: ['a', 'b'], magnitude: [1, 2, 3, 4] });
  ok(
    r.nodes.length === 4 && r.magnitude.length === 4 && r.nodes[2] === '③',
    'arity repair pads labels',
  );
  const r2 = repairArity({ structure: 'magnitude', nodes: ['a', 'b', 'c'], magnitude: [1, 2] });
  ok(r2.nodes.length === 2, 'arity repair trims surplus labels');
}

// ---- 3d. series arity + unit mismatch (final-showdown validators) ---------------
{
  const { repairArity, flagUnitMismatch } = await import('../src/mapping/slide-to-ir.js');
  const { validateIR } = await import('../src/scene/ir.js');
  // series 一致但 nodes 短 → pad
  const r1 = repairArity({
    structure: 'magnitude',
    form: 'grouped',
    nodes: ['a'],
    series: [
      { label: 'x', values: [1, 2, 3] },
      { label: 'y', values: [4, 5, 6] },
    ],
    magnitude: [1],
  });
  ok(
    r1.nodes.length === 3 && r1.magnitude.length === 3,
    'series-aligned arity repair pads nodes+magnitude',
  );
  // series 互不一致 → 不修,交给校验
  const r2 = repairArity({
    structure: 'magnitude',
    nodes: ['a'],
    series: [{ values: [1, 2] }, { values: [1, 2, 3] }],
  });
  ok(r2.nodes.length === 1, 'disagreeing series left for the validator');
  const v = validateIR({
    structure: 'magnitude',
    nodes: ['a', 'b'],
    magnitude: [1, 2],
    series: [{ label: 's', values: [1, 2, 3] }],
  });
  ok(
    !v.ok && v.errors.some((e) => /series .* length/.test(e)),
    'IR contract rejects series/nodes mismatch',
  );
  // 混单位标记
  const f1 = flagUnitMismatch({ series: [{ values: [38, 31] }, { values: [900000, 675000] }] });
  ok(f1.unitMismatch === true, 'incommensurable grouped series flagged');
  const f2 = flagUnitMismatch({ series: [{ values: [71, 77] }, { values: [78, 61] }] });
  ok(!f2.unitMismatch, 'commensurable series untouched');
}

// ---- 4. anti-fabrication gates (slide-to-ir) -----------------------------------
{
  const { antiFabricationGate, ladderOverlap } = await import('../src/mapping/slide-to-ir.js');
  const ladders = [[0, 50, 100, 150, 200]];
  // gate 2: silent ladder copy (no needsReview) still demoted
  const g1 = antiFabricationGate(
    { structure: 'magnitude', title: 't', nodes: ['a', 'b', 'c'], magnitude: [50, 100, 150] },
    { ladders },
  );
  ok(g1.structure === 'hold' && g1.demoted === true, 'gate 2: silent tick-ladder copy demoted');
  // clean data passes untouched
  const g2 = antiFabricationGate(
    { structure: 'magnitude', title: 't', nodes: ['a', 'b', 'c'], magnitude: [73, 27, 42] },
    { ladders },
  );
  ok(g2.structure === 'magnitude' && !g2.demoted, 'gate 2: real data untouched');
  // zero-padding fabrication demoted
  const g3 = antiFabricationGate(
    { structure: 'magnitude', title: 't', nodes: ['a'], magnitude: [3380, 0, 0, 0, 0, 0] },
    { ladders: [] },
  );
  ok(g3.demoted === true, 'gate 2: zero-padded series demoted');
  // vision mode stands down entirely
  const g4 = antiFabricationGate(
    {
      structure: 'magnitude',
      title: 't',
      nodes: ['a'],
      magnitude: [50, 100, 150],
      needsReview: true,
    },
    { hadImage: true, ladders },
  );
  ok(g4.structure === 'magnitude', 'gates stand down in vision mode');
  ok(ladderOverlap([50, 100, 150], ladders) === 1, 'ladderOverlap computes hit rate');
}

console.log(`\n${pass}/${pass + fail} passed`);
if (fail) process.exit(1);
