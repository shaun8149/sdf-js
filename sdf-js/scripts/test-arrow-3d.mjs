import { arrow3dSDF } from '../src/scene/components/shapes/arrow-3d.js';
import { compile } from '../src/scene/compile.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';

let pass = 0,
  fail = 0;
function ok(c, n) {
  if (c) {
    pass++;
    console.log(`  ✓ ${n}`);
  } else {
    fail++;
    console.log(`  ✗ ${n}`);
  }
}
console.log('=== arrow-3d unit test ===\n');
{
  const sdf = arrow3dSDF(); // length 1.6 → half 0.8, head at +X
  ok(sdf.f([0, 0, 0]) < 0, 'shaft midpoint inside');
  ok(sdf.f([0.78, 0, 0]) < 0, 'near +X tip (cone axis) inside');
  ok(sdf.f([0, 0.3, 0]) > 0, 'off to the side (above shaft, not on head) outside');
  ok(sdf.f([3, 0, 0]) > 0, 'far outside');
  ok(sdf.f([-0.78, 0, 0]) < 0, 'single arrow: solid flat shaft tail inside');
  ok(sdf.f([-0.95, 0, 0]) > 0, 'single arrow: past the −X tail outside');
}
{
  const dbl = arrow3dSDF({ double: true });
  ok(dbl.f([-0.78, 0, 0]) < 0, 'double arrow: −X tip inside');
  ok(dbl.f([0.78, 0, 0]) < 0, 'double arrow: +X tip inside');
}
{
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0.4, pitch: 0.2, distance: 6, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.6, distance: 8, intensity: 1.1 },
    },
    subjects: [{ type: 'arrow-3d', id: 'a', args: { double: true }, region: 'object' }],
  };
  const compiled = compile(scene);
  ok(compiled.sdf.f([0, 0, 0]) < 0, 'compiled arrow inside at centre');
  const glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
  const s = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
  ok(s.includes('sdCappedCone'), 'GLSL emit has sdCappedCone (head)');
  ok(s.includes('sdBox'), 'GLSL emit has sdBox (shaft)');
}
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
