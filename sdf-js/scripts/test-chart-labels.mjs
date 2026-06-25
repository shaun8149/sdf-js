import { expandChartLabels, barAnchors, sphereFillAnchors } from '../src/scene/chart-labels.js';

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

// sphere-fill-3d: labels parallel to `levels` (not `values`)
{
  const scene = {
    v: 1,
    subjects: [
      {
        id: 'sf',
        type: 'sphere-fill-3d',
        args: { levels: [0.2, 0.5, 0.8], labels: ['20%', '50%', '80%'], radius: 0.6, spacing: 0.3 },
      },
    ],
  };
  const added = expandChartLabels(scene).subjects.filter((s) => s.type === 'text-3d-pipe');
  ok(added.length === 3, 'sphere-fill: 3 labels from levels[] (not values)');
  ok(
    added.every((s, i) => s.args.text === ['20%', '50%', '80%'][i]),
    'sphere-fill label texts match',
  );
  // middle sphere centred at x=0 (N=3 symmetric)
  ok(Math.abs(added[1].transform.translate[0]) < 1e-9, 'sphere-fill middle label at x=0');
  // +z = near side (camera at +z): label sits in FRONT of the sphere, not behind
  // it (occluded). Mirrored via rotate 180°/Y so the pipe glyph reads correctly.
  ok(added[0].transform.translate[2] > 0, 'sphere-fill label on +z near face (not occluded)');
  ok(
    Math.abs((added[0].transform.rotate || [0, 0, 0])[1] - Math.PI) < 1e-9,
    'sphere-fill label mirrored (rotate 180°/Y) to face the +z camera',
  );
}

// matrix-grid-3d: row-major flat array, row 0 on top
{
  const scene = {
    v: 1,
    subjects: [
      {
        id: 'm',
        type: 'matrix-grid-3d',
        args: {
          rows: 2,
          cols: 2,
          labels: ['TL', 'TR', 'BL', 'BR'],
          cardW: 0.9,
          cardH: 0.7,
          cardD: 0.18,
          gap: 0.18,
        },
      },
    ],
  };
  const added = expandChartLabels(scene).subjects.filter((s) => s.type === 'text-3d-pipe');
  ok(added.length === 4, 'matrix: 4 labels for 2×2 (rows*cols)');
  // index 0 = top-left: x<0 (left col), y>0 (top row, since y=(R-1-r)*strideY-offY, r=0 → +)
  ok(
    added[0].transform.translate[0] < 0 && added[0].transform.translate[1] > 0,
    'matrix label[0] = top-left',
  );
  ok(
    added[1].transform.translate[0] > 0 && added[1].transform.translate[1] > 0,
    'matrix label[1] = top-right',
  );
  ok(added[2].transform.translate[1] < 0, 'matrix label[2] = bottom row');
  ok(
    added.every((s) => s.transform.translate[2] < 0),
    'matrix labels on −z front',
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

// sphere-fill gauge: SDF labels are OPT-IN (value % defaults to overlay now)
{
  // No args.labels → NO SDF text (the % goes to the DOM overlay instead).
  const noLabel = {
    v: 1,
    subjects: [{ id: 'g', type: 'sphere-fill-3d', args: { levels: [0.8, 0.4, 0.2] } }],
  };
  ok(expandChartLabels(noLabel).subjects.length === 1, 'sphere-fill: no args.labels → no SDF text');

  // Explicit args.labels → still engraves SDF labels (opt-in embedded path).
  const explicit = {
    v: 1,
    subjects: [
      { id: 'g', type: 'sphere-fill-3d', args: { levels: [0.8, 0.2], labels: ['80%', '20%'] } },
    ],
  };
  const labels = expandChartLabels(explicit).subjects.filter((s) => s.type === 'text-3d-pipe');
  ok(labels.length === 2, 'sphere-fill: explicit args.labels → 2 SDF labels');
  ok(labels[0].args.text === '80%', 'explicit label text preserved');

  // radii-aware anchors: surfaces stay `spacing` apart, row centred. radii
  // [1.0,0.5] spacing 0.3 → centres at -0.9 / +0.9 (matches the atom layout).
  const an = sphereFillAnchors({ levels: [0.5, 0.5], radii: [1.0, 0.5], spacing: 0.3 });
  ok(Math.abs(an[0].x - -0.9) < 1e-6, 'radii anchor 0 at x=-0.9');
  ok(Math.abs(an[1].x - 0.9) < 1e-6, 'radii anchor 1 at x=+0.9');
  ok(Math.abs(an[0].z - 1.1) < 1e-6, 'radii anchor 0 z = +(1.0+0.1) (near side, not occluded)');
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
