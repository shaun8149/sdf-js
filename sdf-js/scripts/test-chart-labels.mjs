import { expandChartLabels, barAnchors } from '../src/scene/chart-labels.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== chart-labels (expandChartLabels connector) ===\n');

// bar-3d carrying args.labels → N text-3d-pipe labels appended at bar tops
{
  const BAR = { barWidth: 0.5, barDepth: 0.5, gap: 0.45, maxHeight: 2.2 };
  const values = [0.4, 0.66, 1.0];
  const labels = ['$1.2M', '$2.0M', '$3.4M'];
  const scene = {
    v: 1,
    subjects: [
      {
        id: 'bars',
        type: 'bar-3d',
        args: { values, labels, ...BAR },
        transform: { translate: [0, 0, 0] },
      },
    ],
  };
  const out = expandChartLabels(scene);
  const added = out.subjects.filter((s) => s.type === 'text-3d-pipe');
  ok(out.subjects.length === 1 + values.length, `appended ${values.length} label subjects`);
  ok(added.length === values.length, 'all added are text-3d-pipe');
  ok(
    added.every((s, i) => s.args.text === labels[i]),
    'label texts match args.labels in order',
  );
  // positions match barAnchors (offset by translate [0,0,0])
  const anch = barAnchors(values, BAR);
  ok(
    added.every((s, i) => Math.abs(s.transform.translate[0] - anch[i].x) < 1e-9),
    'label x positions match bar anchors',
  );
  ok(
    added.every((s, i) => Math.abs(s.transform.translate[1] - anch[i].y) < 1e-9),
    'label y positions sit above bar tops',
  );
  ok(
    added.every((s) => /^lbl_bars_/.test(s.id)),
    'label ids are globally unique (prefixed by subject id)',
  );
}

// translate offset is applied
{
  const scene = {
    v: 1,
    subjects: [
      {
        id: 'b',
        type: 'bar-3d',
        args: { values: [1], labels: ['x'], barWidth: 0.5, barDepth: 0.5, gap: 0, maxHeight: 2 },
        transform: { translate: [10, 0, -3] },
      },
    ],
  };
  const lab = expandChartLabels(scene).subjects.find((s) => s.type === 'text-3d-pipe');
  ok(
    Math.abs(lab.transform.translate[0] - 10) < 1e-9,
    'single bar centred → label x offset by translate.x',
  );
  ok(
    Math.abs(lab.transform.translate[2] - (-3 - 0.25 - 0.1)) < 1e-9,
    'label z offset by translate.z',
  );
}

// no-op cases
{
  const noLabels = { v: 1, subjects: [{ id: 'b', type: 'bar-3d', args: { values: [0.5, 0.7] } }] };
  ok(expandChartLabels(noLabels).subjects.length === 1, 'no args.labels → no-op');
  const notChart = {
    v: 1,
    subjects: [{ id: 's', type: 'sphere', args: { radius: 1, labels: ['x'] } }],
  };
  ok(expandChartLabels(notChart).subjects.length === 1, 'non-chart type with labels → no-op');
  ok(expandChartLabels({ v: 1, subjects: [] }).subjects.length === 0, 'empty scene → no-op');
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
