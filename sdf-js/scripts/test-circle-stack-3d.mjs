import { circleStack3dSDF } from '../src/scene/components/shapes/circle-stack-3d.js';
import { compile } from '../src/scene/compile.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';
let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== circle-stack-3d ===\n');
{
  // count 4, diskHeight 0.18, gap 0.06 → stride 0.24, y = −0.36,−0.12,0.12,0.36
  const sdf = circleStack3dSDF();
  ok(sdf.f([0, -0.36, 0]) < 0, 'bottom disk centre inside');
  ok(sdf.f([0, 0.36, 0]) < 0, 'top disk centre inside');
  ok(sdf.f([0, -0.24, 0]) > 0, 'gap between disks 0 and 1 outside');
  ok(sdf.f([0, 2, 0]) > 0, 'far above outside');
}
{
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0.4, pitch: 0.2, distance: 6, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.6, distance: 8, intensity: 1.1 },
    },
    subjects: [{ type: 'circle-stack-3d', id: 'cs', args: { count: 3 }, region: 'object' }],
  };
  const compiled = compile(scene);
  ok(compiled.sdf.f([0, 0, 0]) < 0, 'compiled stack middle disk inside');
  const glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
  const s = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
  ok(s.includes('sdCylinder'), 'GLSL has sdCylinder (disks)');
}
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
