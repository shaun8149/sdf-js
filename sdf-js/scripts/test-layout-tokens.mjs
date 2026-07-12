// sdf-js/scripts/test-layout-tokens.mjs — Layer B first cut: the module system.
// Two claims: (1) the operators are correct composition math; (2) render-
// magnitude actually CONSUMES the tokens — geometry re-derives when a token
// changes (the whole point of extraction; hardcoded copies would pass a
// byte-identity check but freeze the system).
import { MODULE, SCALE, stride, centeredRow, rowSpan } from '../src/scene/layout-tokens.js';
import { renderMagnitude } from '../src/scene/render-magnitude.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
const near = (a, b) => Math.abs(a - b) < 1e-9;
console.log('=== layout tokens (Layer B: module / rhythm / alignment) ===\n');

// ---- operator math -------------------------------------------------------------
ok(near(stride(), MODULE.unit + MODULE.gap), 'stride = module + breath');
ok(near(centeredRow(0, 1), 0), 'single item sits on the origin');
ok(near(centeredRow(0, 4) + centeredRow(3, 4), 0), 'row is symmetric about the origin');
ok(near(centeredRow(2, 5) - centeredRow(1, 5), stride()), 'neighbors are one stride apart');
ok(
  near(rowSpan(5), centeredRow(4, 5) - centeredRow(0, 5) + MODULE.unit),
  'rowSpan = outer edge to outer edge',
);
ok(SCALE.monumental / SCALE.intimate > 3, 'monumental vs intimate is a real contrast (>3×)');

// ---- render-magnitude consumes the tokens ---------------------------------------
const IR = {
  structure: 'magnitude',
  title: 'T',
  nodes: ['a', 'b', 'c'],
  magnitude: [1, 3, 2],
};
{
  const s = renderMagnitude(IR);
  const monos = s.subjects.filter((x) => /^mono-/.test(x.id));
  ok(
    monos.every((m) => near(m.args.dims[0], MODULE.unit)),
    'monolith footprint = MODULE.unit',
  );
  const xs = monos.map((m) => m.transform.translate[0]).sort((a, b) => a - b);
  ok(near(xs[1] - xs[0], stride()), 'monolith rhythm = stride token');
  const plinth = s.subjects.find((x) => /^plinth-/.test(x.id));
  ok(
    near(plinth.args.dims[0], MODULE.unit + MODULE.plinthPad) &&
      near(plinth.args.dims[1], MODULE.plinthH),
    'plinth derives from plinthPad/plinthH tokens',
  );
  const tallest = monos.reduce((a, b) => (a.args.dims[1] > b.args.dims[1] ? a : b));
  ok(near(tallest.args.dims[1], SCALE.monumental), 'champion height = SCALE.monumental');
}

// token change → geometry re-derives (mutate, render, restore)
{
  const orig = MODULE.gap;
  MODULE.gap = orig + 0.3;
  const s = renderMagnitude(IR);
  const xs = s.subjects
    .filter((x) => /^mono-/.test(x.id))
    .map((m) => m.transform.translate[0])
    .sort((a, b) => a - b);
  ok(near(xs[1] - xs[0], MODULE.unit + orig + 0.3), 'changing MODULE.gap re-derives the rhythm');
  MODULE.gap = orig;
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
