// =============================================================================
// L1 unit tests for the filtering / texturing toolkit (IQ texturing & filtering
// articles). Wave 3 of the IQ-shader program.
// -----------------------------------------------------------------------------
// Recipe-only ports of Inigo Quilez:
//   filterable / band-limited procedurals  https://iquilezles.org/articles/filterableprocedurals/
//   (improved) analytic checker filtering   https://iquilezles.org/articles/checkerfiltering/
//   ray differentials                       https://iquilezles.org/articles/filtering/
//   texture repetition (no-tile)            https://iquilezles.org/articles/texturerepetition/
//   biplanar mapping                        https://iquilezles.org/articles/biplanar/
//   improved bilinear / hardware interp     https://iquilezles.org/articles/bilinear/ , /hwinterpolation/
//   premultiplied alpha                     https://iquilezles.org/articles/premultipliedalpha/
//   gamma-correct blurring                  https://iquilezles.org/articles/gamma/
//
// Core property of every band-limited pattern: as the filter width w → 0 it
// reduces to the hard pattern; as w → large it converges to the pattern's mean.
// =============================================================================

import {
  filterWidth,
  triWave,
  triWaveFiltered,
  checkersFiltered,
  gridFiltered,
  stripesFiltered,
  noTile,
  biplanarWeights,
  srgbToLinear,
  linearToSrgb,
  premultOver,
  improvedBilinearUV,
  FILTER_GLSL,
} from '../src/sdf/filter.js';

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
const near = (a, b, eps = 2e-3) => Math.abs(a - b) < eps;

console.log('=== filtering / texturing toolkit ===\n');

console.log('filterWidth (ray-differential footprint)');
ok(filterWidth(10, 900, 0.5) > filterWidth(2, 900, 0.5), 'footprint grows with distance');
ok(filterWidth(5, 900, 0.1) > filterWidth(5, 900, 0.9), 'footprint grows at grazing angle');
ok(filterWidth(5, 1800, 0.5) < filterWidth(5, 900, 0.5), 'footprint shrinks at higher resolution');

console.log('\ntriangle wave + band-limited triangle');
ok(near(triWave(0), 1) && near(triWave(0.5), 0) && near(triWave(1), 1), 'triWave shape [1,0,1]');
ok(near(triWaveFiltered(0.3, 1e-4), triWave(0.3), 5e-3), 'triWaveFiltered(w→0) ≈ triWave');
ok(near(triWaveFiltered(0.3, 50), 0.5, 1e-2), 'triWaveFiltered(w→∞) → mean 0.5');
ok(
  triWaveFiltered(0.3, 0.2) > 0 && triWaveFiltered(0.3, 0.2) < 1,
  'triWaveFiltered partial in (0,1)',
);

console.log('\nanalytic checker filtering');
// hard checker at a tiny footprint: integer-cell parity → ~0 or ~1
ok(
  checkersFiltered(0.5, 0.5, 1e-4, 1e-4) < 0.05,
  'checkersFiltered tight → near a tile (cell (0,0))',
);
ok(
  checkersFiltered(1.5, 0.5, 1e-4, 1e-4) > 0.95,
  'checkersFiltered tight → opposite tile (cell (1,0))',
);
ok(near(checkersFiltered(0.5, 0.5, 100, 100), 0.5, 2e-2), 'checkersFiltered wide → grey 0.5');

console.log('\ngrid + stripes (filtered)');
ok(gridFiltered(0.0, 0.0, 0.05, 1e-4, 1e-4) > 0.5, 'gridFiltered on a line → high');
ok(gridFiltered(0.5, 0.5, 0.05, 1e-4, 1e-4) < 0.5, 'gridFiltered between lines → low');
ok(
  near(stripesFiltered(0.25, 1e-4), 0) || near(stripesFiltered(0.25, 1e-4), 1),
  'stripesFiltered tight → 0/1',
);
ok(near(stripesFiltered(0.25, 50), 0.5, 2e-2), 'stripesFiltered wide → 0.5');

console.log('\ntexture no-tile + biplanar weights');
ok(noTile(2.1, 3.4, (x, y) => 0.42) === 0.42, 'noTile of a constant field is that constant');
ok(
  noTile(2.1, 3.4, (x, y) => Math.sin(x) * 0.5 + 0.5) ===
    noTile(2.1, 3.4, (x, y) => Math.sin(x) * 0.5 + 0.5),
  'noTile deterministic',
);
{
  const w = biplanarWeights(0.1, 0.95, 0.05, 8); // mostly +Y
  ok(near(w[0] + w[1] + w[2], 1, 1e-5), 'biplanar weights sum to 1');
  ok(w[1] > w[0] && w[1] > w[2], 'biplanar dominant axis (Y) has largest weight');
}

console.log('\ngamma (sRGB ↔ linear)');
ok(near(srgbToLinear(0), 0) && near(srgbToLinear(1), 1), 'srgbToLinear endpoints');
ok(srgbToLinear(0.5) < 0.5, 'srgbToLinear darkens midtones (decoding)');
for (const c of [0.05, 0.2, 0.5, 0.8])
  ok(near(linearToSrgb(srgbToLinear(c)), c, 1e-4), `gamma round-trip ${c}`);

console.log('\npremultiplied-alpha over');
{
  // opaque src over anything → src color, alpha 1
  const r = premultOver([1, 0, 0], 1, [0, 0, 1], 1);
  ok(near(r[0], 1) && near(r[1], 0) && near(r[2], 0) && near(r[3], 1), 'opaque src wins');
  // zero-alpha src over dst → dst
  const r2 = premultOver([1, 1, 1], 0, [0.2, 0.4, 0.6], 1);
  ok(near(r2[0], 0.2) && near(r2[1], 0.4) && near(r2[2], 0.6), 'transparent src → dst shows');
}

console.log('\nimproved bilinear UV');
{
  const uv = improvedBilinearUV(2.5, 3.5, 64);
  ok(Math.abs(uv[0] - 2.5) < 0.02 && Math.abs(uv[1] - 3.5) < 0.02, 'improvedBilinearUV near input');
  // at an exact texel center the correction is ~0
  const uv2 = improvedBilinearUV(2.0, 3.0, 64);
  ok(near(uv2[0], 2.0, 1e-3) && near(uv2[1], 3.0, 1e-3), 'no correction at texel center');
}

console.log('\nGLSL mirror present');
ok(typeof FILTER_GLSL === 'string' && FILTER_GLSL.length > 300, 'FILTER_GLSL exported');
for (const fn of [
  'checkersFiltered',
  'gridFiltered',
  'triWaveFiltered',
  'biplanarWeights',
  'srgbToLinear',
]) {
  ok(FILTER_GLSL.includes(fn), `FILTER_GLSL defines ${fn}`);
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
