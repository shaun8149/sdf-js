// =============================================================================
// test-gbms-batch.mjs — smoke for Track 4 batch port (5 gbms primitives)
// -----------------------------------------------------------------------------
// 5 new 2D SDFs from gbms (MIT, IQ-credited):
//   pentagon / octogon / hexagram / chamfer-box / parabola
//
// Verifies for each:
//   - SDF compiles via SceneData → compile() pipeline
//   - Sign correctness at known probe points
//   - ASCII silhouette renders something recognizable
//
// Run:  node sdf-js/scripts/test-gbms-batch.mjs
// =============================================================================

import { compile } from '../src/scene/compile.js';
import { pentagonSDF } from '../src/scene/components/community/gbms-pentagon.js';
import { octogonSDF } from '../src/scene/components/community/gbms-octogon.js';
import { hexagramSDF } from '../src/scene/components/community/gbms-hexagram.js';
import { chamferBoxSDF } from '../src/scene/components/community/gbms-chamfer-box.js';
import { parabolaSDF } from '../src/scene/components/community/gbms-parabola.js';

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

function asciiSilhouette(sdfFn2arg, w = 50, h = 25, extent = 0.7) {
  const lines = [];
  for (let row = 0; row < h; row++) {
    let line = '';
    for (let col = 0; col < w; col++) {
      const x = (col / w) * 2 * extent - extent;
      const y = extent - (row / h) * 2 * extent;
      const d = sdfFn2arg(x, y); // matches probe-test f(x, y) convention
      if (d <= 0) line += '#';
      else if (d < 0.02) line += '·';
      else line += ' ';
    }
    lines.push('  ' + line);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// pentagon (radius=0.5 = apothem; outer vertex at radius * 1.236 ≈ 0.618)
// ---------------------------------------------------------------------------
console.log('\n[pentagon] radius=0.5 (apothem)');
{
  const sdf = pentagonSDF({ radius: 0.5 });
  const f = (x, y) => sdf.f([x, y]);
  ok(f(0, 0) < 0, `center (0,0) inside (got ${f(0, 0).toFixed(3)})`);
  // After y-negation fix, point-up means top vertex at y = +0.618 (circumradius)
  ok(
    f(0, 0.618) > -0.02 && f(0, 0.618) < 0.02,
    `top vertex (0, 0.618) ≈ on edge (got ${f(0, 0.618).toFixed(3)})`,
  );
  ok(f(0, 0.5) < 0, `(0, 0.5) inside (below top tip) (got ${f(0, 0.5).toFixed(3)})`);
  ok(f(0, 0.8) > 0, `(0, 0.8) outside above (got ${f(0, 0.8).toFixed(3)})`);
  ok(f(0.7, 0) > 0, `(0.7, 0) outside right (got ${f(0.7, 0).toFixed(3)})`);
  console.log(asciiSilhouette(f));
}

// ---------------------------------------------------------------------------
// octogon (radius=0.5)
// ---------------------------------------------------------------------------
console.log('\n[octogon] radius=0.5');
{
  const sdf = octogonSDF({ radius: 0.5 });
  const f = (x, y) => sdf.f([x, y]);
  ok(f(0, 0) < 0, `center inside (got ${f(0, 0).toFixed(3)})`);
  ok(f(0, 0.5) > -0.05 && f(0, 0.5) < 0.05, `(0, 0.5) ≈ on edge (got ${f(0, 0.5).toFixed(3)})`);
  ok(f(0.5, 0) > -0.05 && f(0.5, 0) < 0.05, `(0.5, 0) ≈ on edge (got ${f(0.5, 0).toFixed(3)})`);
  ok(f(0, 0.7) > 0, `(0, 0.7) outside`);
  console.log(asciiSilhouette(f));
}

// ---------------------------------------------------------------------------
// hexagram (radius=0.3) — 6-pointed star; r is folding-line distance.
// Outer tip extends to r * sqrt(k.w^2 + 1) ≈ r * 2 from center.
// ---------------------------------------------------------------------------
console.log('\n[hexagram] radius=0.3 (outer tip ≈ 0.6)');
{
  const sdf = hexagramSDF({ radius: 0.3 });
  const f = (x, y) => sdf.f([x, y]);
  ok(f(0, 0) < 0, `center inside (got ${f(0, 0).toFixed(3)})`);
  ok(
    f(0, 0.6) > -0.05 && f(0, 0.6) < 0.05,
    `top outer tip ≈ on edge (got ${f(0, 0.6).toFixed(3)})`,
  );
  ok(f(0, 1.2) > 0, `(0, 1.2) outside far (got ${f(0, 1.2).toFixed(3)})`);
  console.log(asciiSilhouette(f, 50, 25, 0.9));
}

// ---------------------------------------------------------------------------
// chamfer-box (dims=[0.4, 0.25], chamfer=0.06)
// ---------------------------------------------------------------------------
console.log('\n[chamfer-box] dims=[0.4, 0.25], chamfer=0.06');
{
  const sdf = chamferBoxSDF({ dims: [0.4, 0.25], chamfer: 0.06 });
  const f = (x, y) => sdf.f([x, y]);
  ok(f(0, 0) < 0, `center inside (got ${f(0, 0).toFixed(3)})`);
  ok(f(0.5, 0) > 0, `(0.5, 0) outside x (got ${f(0.5, 0).toFixed(3)})`);
  ok(f(0, 0.3) > 0, `(0, 0.3) outside y`);
  // Chamfered corner: (0.4, 0.25) WOULD be on a regular box corner but chamfered → cut away → outside
  ok(f(0.4, 0.25) > 0, `(0.4, 0.25) corner chamfered away (got ${f(0.4, 0.25).toFixed(3)})`);
  console.log(asciiSilhouette(f, 60, 25, 0.6));
}

// ---------------------------------------------------------------------------
// parabola (k=2.0)
// ---------------------------------------------------------------------------
console.log('\n[parabola] k=2.0 (curve y = 2x²)');
{
  const sdf = parabolaSDF({ k: 2.0 });
  const f = (x, y) => sdf.f([x, y]);
  // (0, 0) is ON the parabola → SDF ≈ 0
  ok(Math.abs(f(0, 0)) < 1e-6, `(0,0) on curve (got ${f(0, 0)})`);
  // (0.5, 0.5) should be ON the curve: y = 2 * (0.5)² = 0.5 ✓
  ok(Math.abs(f(0.5, 0.5)) < 0.01, `(0.5, 0.5) on curve (got ${f(0.5, 0.5).toFixed(4)})`);
  // (0, 0.5) is ABOVE curve → "inside" by our sign convention (px - x < 0)
  ok(f(0, 0.5) < 0, `(0, 0.5) above curve, negative sign (got ${f(0, 0.5).toFixed(3)})`);
  // (0.5, 0) is BELOW curve → positive
  ok(f(0.5, 0) > 0, `(0.5, 0) below curve, positive sign`);
  console.log(asciiSilhouette(f, 50, 25, 0.6));
}

// ---------------------------------------------------------------------------
// End-to-end via compile() pipeline
// ---------------------------------------------------------------------------
console.log('\n[e2e] All 5 types compile via SceneData:');
{
  for (const [type, args] of [
    ['pentagon', { radius: 0.4 }],
    ['octogon', { radius: 0.4 }],
    ['hexagram', { radius: 0.4 }],
    ['chamfer-box', { dims: [0.4, 0.25], chamfer: 0.06 }],
    ['parabola', { k: 1.5 }],
  ]) {
    const scene = {
      v: 1,
      defaults: {
        camera: { yaw: 0, pitch: 0.3, distance: 5, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
        light: { altitude: 0.5, azimuth: 0.5, distance: 50, intensity: 1.0 },
      },
      subjects: [{ id: `p-${type}`, type, args, transform: { translate: [0, 0, 0] } }],
    };
    let threw = null;
    try {
      compile(scene);
    } catch (e) {
      threw = e.message;
    }
    ok(!threw, `compile() succeeded for type='${type}' (err: ${threw})`);
  }
}

console.log(`\n${pass}/${pass + fail} tests passed`);
if (fail > 0) process.exit(1);
