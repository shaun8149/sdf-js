// sdf-js/scripts/test-webgl2-gate.mjs — Present WebGL2 fallback notice.
import { hasWebGL2, requireWebGL2OrNotice } from '../apps/present/webgl2-gate.js';

let pass = 0;
let fail = 0;
const ok = (condition, name) =>
  condition ? (pass++, console.log(`  ✓ ${name}`)) : (fail++, console.log(`  ✗ ${name}`));

console.log('=== present WebGL2 gate ===\n');

function fakeLoading() {
  const removed = [];
  return {
    innerHTML: '',
    style: {},
    removed,
    classList: {
      remove: (name) => removed.push(name),
    },
  };
}

{
  ok(
    hasWebGL2(() => ({ getContext: (kind) => (kind === 'webgl2' ? {} : null) })),
    'hasWebGL2 accepts a real webgl2 context',
  );
  ok(
    !hasWebGL2(() => ({ getContext: () => null })),
    'hasWebGL2 rejects a missing webgl2 context',
  );
}

{
  const loading = fakeLoading();
  const okToBoot = requireWebGL2OrNotice({
    loadingEl: loading,
    createCanvas: () => ({ getContext: () => ({}) }),
  });
  ok(okToBoot, 'available WebGL2 allows boot');
  ok(loading.innerHTML === '', 'available WebGL2 leaves fallback empty');
}

{
  const loading = fakeLoading();
  const okToBoot = requireWebGL2OrNotice({
    loadingEl: loading,
    createCanvas: () => ({ getContext: () => null }),
  });
  ok(!okToBoot, 'missing WebGL2 stops boot');
  ok(loading.innerHTML.includes('WebGL2'), 'missing WebGL2 writes an explicit notice');
  ok(loading.removed.includes('done'), 'missing WebGL2 unhides the loading layer');
  ok(loading.style.pointerEvents === 'auto', 'missing WebGL2 keeps the notice interactive');
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
