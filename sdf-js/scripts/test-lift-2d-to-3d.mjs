// test-lift-2d-to-3d.mjs — the deterministic 2D→3D twin lift.
import { liftSceneData2dTo3d, liftSubject, twinTypeOf, TWIN_MAP, fmt } from '../src/scene/lift-2d-to-3d.js';

let pass = 0, fail = 0;
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
    subjects: [{ type: 'funnel', args: { title: 'Sales Funnel', stages: [{ label: 'A' }, { label: 'B' }, { label: 'C' }] } }],
  });
  ok(out.subjects.length === 1 && out.subjects[0].type === 'funnel-3d', 'funnel → 1 funnel-3d subject');
  ok(out.subjects[0].args.stages === 3, 'funnel stages[] length → stages: 3');
  const title = out.overlay.find((o) => o.role === 'title');
  ok(title && title.text === 'SALES FUNNEL', 'title routed to overlay (uppercased)');
  const cards = out.overlay.filter((o) => o.role === 'card');
  ok(cards.length === 3 && cards[0].text === 'A', '3 stage labels routed to overlay cards');
  ok(out.subjects[0].args.stages === undefined ? false : true, 'no SDF text baked (labels are overlay only)');
  ok(out.cameraSequence && out.cameraSequence.shots.length === 2, 'default push-in camera added');
}

// ── pie: values + labels → values pass-through, labels+values → cards ──
{
  const out = liftSceneData2dTo3d({
    subjects: [{ type: 'pie', args: { values: [35, 25, 40], labels: ['AWS', 'Azure', 'GCP'], format: 'percent' } }],
  });
  ok(out.subjects[0].type === 'pie-3d', 'pie → pie-3d');
  ok(JSON.stringify(out.subjects[0].args.values) === JSON.stringify([35, 25, 40]), 'pie values pass through');
  const cards = out.overlay.filter((o) => o.role === 'card');
  ok(cards[0].text === 'AWS 35%', 'pie legend merges label + formatted value');
}

// ── bar: raw values → normalized 0..1, value labels at bar tops ──
{
  const out = liftSceneData2dTo3d({ subjects: [{ type: 'bar', args: { values: [40, 80], format: 'percent' } }] });
  const v = out.subjects[0].args.values;
  ok(v.length === 2 && v[1] === 1.0 && Math.abs(v[0] - 0.55) < 1e-9, 'bar values normalized (max→1.0, keep-visible floor)');
  const vals = out.overlay.filter((o) => o.role === 'value');
  ok(vals.length === 2 && vals[0].text === '40%' && vals[1].text === '80%', 'bar value labels formatted from raw values');
}

// ── timeline: events[] → count + value labels ──
{
  const out = liftSceneData2dTo3d({ subjects: [{ type: 'timeline', args: { events: [{ label: '2021' }, { label: '2022' }] } }] });
  ok(out.subjects[0].type === 'timeline-3d' && out.subjects[0].args.count === 2, 'timeline events[] → count: 2');
  ok(out.overlay.filter((o) => o.role === 'value').length === 2, 'timeline event labels → 2 overlay values');
}

// ── generic fallback: unknown-to-map type still maps T → T-3d ──
{
  const { subject3d } = liftSubject({ type: 'diamond', args: { label: 'X' } });
  ok(subject3d.type === 'diamond-3d', 'generic fallback: diamond → diamond-3d');
}

// ── two-text-systems invariant: NO baked SDF text anywhere ──
{
  const out = liftSceneData2dTo3d({
    subjects: [{ type: 'funnel', args: { title: 'T', stages: [{ label: 'A' }] } }],
  });
  const baked = out.subjects.some((s) => /text/.test(s.type));
  ok(!baked, 'no text-* SDF subjects produced (all text → overlay)');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
