import { progression3dSDF } from '../src/scene/components/charts/progression/progression-3d.js';
import { compile } from '../src/scene/compile.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';
let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== progression-3d ===\n');
{
  // 5 steps, run 0.5, stepRise 0.3 → step0 at x=-1, h=0.3; step4 at x=1, h=1.5
  const sdf = progression3dSDF();
  ok(sdf.f([-1.0, 0.15, 0]) < 0, 'first (shortest) step inside');
  ok(sdf.f([1.0, 0.75, 0]) < 0, 'last (tallest) step inside');
  ok(sdf.f([1.0, 2.0, 0]) > 0, 'above last step outside');
  ok(sdf.f([-1.0, 1.2, 0]) > 0, 'above first step outside');
  ok(sdf.f([5, 0, 0]) > 0, 'far outside');
}
{
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0.4, pitch: 0.2, distance: 6, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.6, distance: 8, intensity: 1.1 },
    },
    subjects: [{ type: 'progression-3d', id: 'pg', args: { steps: 5 }, region: 'object' }],
  };
  const compiled = compile(scene);
  ok(compiled.sdf.f([1.0, 0.75, 0]) < 0, 'compiled tallest step inside');
  const glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
  const s = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
  ok(s.includes('sdBox'), 'GLSL has sdBox');
}
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
