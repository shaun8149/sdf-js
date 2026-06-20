import { gear3dSDF } from '../src/scene/components/shapes/gear-3d.js';
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
console.log('=== gear-3d unit test ===\n');
{
  const sdf = gear3dSDF(); // radius 0.7, hole 0.22, 12 teeth, tooth0 at +X
  ok(sdf.f([0.45, 0, 0]) < 0, 'body ring (between hole and rim) inside');
  ok(sdf.f([0, 0, 0]) > 0, 'centre is the hole → outside');
  ok(sdf.f([0.82, 0, 0]) < 0, 'tooth-0 (+X) tip inside');
  ok(sdf.f([1.5, 0, 0]) > 0, 'far past the teeth outside');
  ok(sdf.f([0, 1, 0]) > 0, 'above the gear (Y) outside');
}
{
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0.4, pitch: 0.2, distance: 6, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.6, distance: 8, intensity: 1.1 },
    },
    subjects: [{ type: 'gear-3d', id: 'g', args: { teeth: 10 }, region: 'object' }],
  };
  const compiled = compile(scene);
  ok(compiled.sdf.f([0.45, 0, 0]) < 0, 'compiled gear body inside');
  ok(compiled.sdf.f([0, 0, 0]) > 0, 'compiled gear centre hole outside');
  const glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
  const s = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
  ok(s.includes('sdCylinder'), 'GLSL emit has sdCylinder (body/hole)');
  ok(s.includes('opDifference'), 'GLSL emit has opDifference (centre hole)');
}
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
