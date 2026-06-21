import { matrixGrid3dSDF } from '../src/scene/components/charts/matrix/matrix-grid-3d.js';
import { compile } from '../src/scene/compile.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';
let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== matrix-grid-3d ===\n');
{
  // 2×2, cardW 0.9 gap 0.18 → cards at (±0.54, ±0.44)
  const sdf = matrixGrid3dSDF();
  ok(sdf.f([-0.54, 0.44, 0]) < 0, 'top-left card inside');
  ok(sdf.f([0.54, -0.44, 0]) < 0, 'bottom-right card inside');
  ok(sdf.f([0, 0, 0]) > 0, 'gap between the 4 cards outside');
  ok(sdf.f([3, 0, 0]) > 0, 'far outside');
}
{
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0.4, pitch: 0.2, distance: 6, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.6, distance: 8, intensity: 1.1 },
    },
    subjects: [{ type: 'matrix-grid-3d', id: 'mg', args: { rows: 2, cols: 2 }, region: 'object' }],
  };
  const compiled = compile(scene);
  ok(compiled.sdf.f([-0.54, 0.44, 0]) < 0, 'compiled card inside');
  const glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
  const s = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
  ok(s.includes('sdBox'), 'GLSL has sdBox');
}
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
