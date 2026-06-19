// =============================================================================
// test-text-3d.mjs — smoke test for typography Wave 1 (digits + KPI symbols)
// =============================================================================

import '../src/sdf/index.js';
import { buildGlyph, supportedChars } from '../src/scene/components/typography/glyphs.js';
import { text2dSDF, text3dExtrudedSDF } from '../src/scene/components/typography/text-3d.js';

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

console.log('=== text-3d smoke test ===\n');

// -----------------------------------------------------------------------------
console.log('Test group 1: glyph coverage');
const expected = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '%', '.', '-', '+', '$', ' '];
const supported = supportedChars();
for (const ch of expected) {
  ok(supported.includes(ch), `glyph table includes '${ch}'`);
}
ok(
  supported.length === expected.length,
  `exactly ${expected.length} glyphs (got ${supported.length})`,
);

// -----------------------------------------------------------------------------
console.log('\nTest group 2: each glyph builds + probes finite');
for (const ch of supported) {
  const g = buildGlyph(ch);
  ok(g !== null, `'${ch}' builds`);
  ok(typeof g.advance === 'number' && g.advance > 0, `'${ch}' has positive advance (${g.advance})`);
  if (ch === ' ') continue; // space has no SDF
  const probe = g.sdf([0, 0.5]);
  ok(Number.isFinite(probe), `'${ch}' SDF at (0,0.5) is finite (got ${probe.toFixed(3)})`);
}

// -----------------------------------------------------------------------------
console.log('\nTest group 3: text2dSDF composition');
const t2 = text2dSDF({ text: '90%' });
ok(t2 !== null, 'text2dSDF("90%") returns a non-null SDF');
ok(Number.isFinite(t2([0, 0.5])), 'composed SDF at center is finite');

// Total advance: 9 (0.55) + 0 (0.6) + % (0.7) = 1.85, centered → x ∈ [-0.925, +0.925]
ok(t2([-2, 0.5]) > 0.5, 'far left point is well outside (got > 0.5)');
ok(t2([2, 0.5]) > 0.5, 'far right point is well outside (got > 0.5)');

// Unknown chars dropped, not crash
const t2unk = text2dSDF({ text: 'a90b' });
ok(t2unk !== null, 'unknown chars dropped, builds anyway');

// All-unknown returns null
const t2all = text2dSDF({ text: 'abc' });
ok(t2all === null, 'all-unknown chars returns null (not crash)');

// Empty string returns null
ok(text2dSDF({ text: '' }) === null, 'empty text returns null');

// Align variants don't crash
for (const align of ['left', 'center', 'right']) {
  ok(text2dSDF({ text: '100', align }) !== null, `align='${align}' builds`);
}

// -----------------------------------------------------------------------------
console.log('\nTest group 4: text3dExtrudedSDF extrusion');
const t3 = text3dExtrudedSDF({ text: '90%', depth: 0.2 });
ok(t3 !== null, 'text3dExtrudedSDF("90%") returns non-null');
ok(Number.isFinite(t3([0, 0.5, 0])), '3D SDF at (0,0.5,0) is finite');
// At z=0.5 (well outside ±depth/2 = ±0.1), should be positive ≈ |z|-0.1
const outside = t3([0, 0.5, 0.5]);
ok(outside > 0.3, `outside Z bounds is positive (got ${outside.toFixed(3)})`);

// Custom height should still compose correctly
const tBig = text3dExtrudedSDF({ text: '42', height: 2.0, depth: 0.4 });
ok(tBig !== null, 'larger height (2.0) builds');

// -----------------------------------------------------------------------------
console.log(
  '\nTest group 5: end-to-end SceneData → compile (text-3d-extruded — regression after rename)',
);
const { compile } = await import('../src/scene/compile.js');

const stdDefaults = {
  camera: { yaw: 0, pitch: 0, distance: 5, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
  light: { yaw: 0, pitch: 0, azimuth: 0.5, altitude: 0.6, distance: 5, intensity: 1 },
};

// text-3d-extruded compiles (regression: old type name 'text-3d' is gone)
const sceneExt = {
  v: 1,
  defaults: stdDefaults,
  subjects: [
    {
      type: 'text-3d-extruded',
      id: 'sign',
      args: { text: '90%', height: 1.0, depth: 0.2 },
      region: 'object',
    },
  ],
};
const cExt = compile(sceneExt, { sanity: false });
ok(cExt.sdf !== null, 'text-3d-extruded scene compiles');
ok(Number.isFinite(cExt.sdf.f([0, 0.5, 0])), 'extruded compiled SDF probe finite');

// -----------------------------------------------------------------------------
console.log('\nTest group 6: end-to-end SceneData → compile (text-3d-pipe — new atom)');

const scenePipe = {
  v: 1,
  defaults: stdDefaults,
  subjects: [
    {
      type: 'text-3d-pipe',
      id: 'kpi',
      args: { text: '90%', height: 2.0, pipeRadius: 0.15 },
      region: 'object',
    },
  ],
};
const cPipe = compile(scenePipe, { sanity: false });
ok(cPipe.sdf !== null, 'text-3d-pipe scene compiles');
ok(Number.isFinite(cPipe.sdf.f([0, 1.0, 0])), 'pipe compiled SDF probe finite at y=1.0');

// -----------------------------------------------------------------------------
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
