import { diamond3dSDF } from '../src/scene/components/shapes/diamond-3d.js';
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
console.log('=== diamond-3d unit test ===\n');
{
  const sdf = diamond3dSDF(); // width 0.9 (girdleR 0.45), crown 0.3, pavilion 0.7
  // probe slightly off y=0: the girdle plane is the shared cap of crown+pavilion
  // (SDF≈0 there); just inside either frustum is strictly negative.
  ok(sdf.f([0, 0.05, 0]) < 0, 'just above girdle (crown interior) inside');
  ok(sdf.f([0.4, 0.02, 0]) < 0, 'near girdle widest point inside');
  ok(sdf.f([0, 0.28, 0]) < 0, 'crown / table region inside');
  ok(sdf.f([0, -0.65, 0]) < 0, 'near bottom pavilion point inside');
  ok(sdf.f([0.6, 0, 0]) > 0, 'beyond girdle radius outside');
  ok(sdf.f([0, 0.5, 0]) > 0, 'above the table outside');
  ok(sdf.f([0, -0.9, 0]) > 0, 'below the point outside');
}
{
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0.4, pitch: 0.2, distance: 6, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.6, distance: 8, intensity: 1.1 },
    },
    subjects: [{ type: 'diamond-3d', id: 'd', args: {}, region: 'object' }],
  };
  const compiled = compile(scene);
  ok(compiled.sdf.f([0, 0.05, 0]) < 0, 'compiled diamond inside (just above girdle)');
  const glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
  const s = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
  ok(s.includes('sdCappedCone'), 'GLSL emit has sdCappedCone (crown+pavilion)');
}
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
