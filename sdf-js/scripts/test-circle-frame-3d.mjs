import { circleFrame3dSDF } from '../src/scene/components/shapes/circle-frame-3d.js';
import { compile } from '../src/scene/compile.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';
let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== circle-frame-3d ===\n');
{
  const sdf = circleFrame3dSDF(); // radius 0.7, frame 0.12, backing on
  ok(sdf.f([0.7, 0, 0]) < 0, 'ring centreline (XY) inside');
  ok(sdf.f([0, 0, 0]) < 0, 'centre on backing disk inside');
  ok(sdf.f([2, 0, 0]) > 0, 'far outside');
  const open = circleFrame3dSDF({ back: false });
  ok(open.f([0, 0, 0]) > 0, 'back=false → centre is open (outside)');
  ok(open.f([0.7, 0, 0]) < 0, 'back=false → ring still solid');
}
{
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0.4, pitch: 0.2, distance: 6, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.6, distance: 8, intensity: 1.1 },
    },
    subjects: [{ type: 'circle-frame-3d', id: 'cf', args: {}, region: 'object' }],
  };
  const compiled = compile(scene);
  ok(compiled.sdf.f([0, 0, 0]) < 0, 'compiled frame backing inside');
  const glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
  const s = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
  ok(s.includes('sdTorus'), 'GLSL has sdTorus (ring)');
}
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
