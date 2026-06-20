// =============================================================================
// test-info-graphic-render.mjs — L1 unit tests for info graphic renderer
// =============================================================================

import { computeCanvasSize, renderInfoGraphic } from '../src/present/info-graphic-render.js';
import { createDeck, addPendingSections } from '../src/present/deck-model.js';

// Mock localStorage
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
};

let pass = 0,
  fail = 0;
function ok(cond, name) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`);
  }
}

console.log('=== info-graphic-render smoke test ===\n');

console.log('Test group 1: computeCanvasSize');

{
  const d = createDeck('empty', { type: 'pdf', fileName: 'e.pdf', pageCount: 0 });
  const size = computeCanvasSize(d);
  ok(size.width === 600, `empty deck: width = 600 (min) (got ${size.width})`);
  ok(size.height > 0, `empty deck: height > 0 (got ${size.height})`);
}

{
  const d = createDeck('one', { type: 'pdf', fileName: 'o.pdf', pageCount: 1 });
  addPendingSections(d, [{ slideData: { title: 'A' }, code2d: '// A' }]);
  const size = computeCanvasSize(d);
  ok(size.width === 600, `1 section: width = 600 (min) (got ${size.width})`);
}

{
  const d = createDeck('five', { type: 'pdf', fileName: 'f.pdf', pageCount: 5 });
  addPendingSections(
    d,
    [1, 2, 3, 4, 5].map((i) => ({ slideData: { title: `S${i}` }, code2d: `// S${i}` })),
  );
  const size = computeCanvasSize(d);
  ok(size.width === 1080, `5 sections: width = 5*200 + 80 padding = 1080 (got ${size.width})`);
}

{
  const d = createDeck('ten', { type: 'pdf', fileName: 't.pdf', pageCount: 10 });
  addPendingSections(
    d,
    Array.from({ length: 10 }, (_, i) => ({ slideData: { title: `S${i + 1}` }, code2d: '' })),
  );
  const size = computeCanvasSize(d);
  ok(size.width === 2080, `10 sections: width = 10*200 + 80 = 2080 (got ${size.width})`);
  ok(size.height === 460, `height = 80 header + 300 section + 80 padding = ${size.height}`);
}

console.log('\nTest group 2: renderInfoGraphic export shape');

// Note: renderInfoGraphic requires Canvas2DRenderingContext + document. In Node
// it requires node-canvas or jsdom. We skip the full render test in Node and
// rely on the L2 browse smoke test (Task 5.4) for visual verification.
// Here we just verify the function exists with correct arity.

ok(typeof renderInfoGraphic === 'function', 'renderInfoGraphic: function exported');
ok(renderInfoGraphic.length === 2, `renderInfoGraphic: arity 2 (got ${renderInfoGraphic.length})`);

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
