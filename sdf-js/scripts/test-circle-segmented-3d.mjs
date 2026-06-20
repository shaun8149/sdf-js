import { circleSegmented3dSDF } from '../src/scene/components/shapes/circle-segmented-3d.js';
import { compile } from '../src/scene/compile.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';
let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== circle-segmented-3d ===\n');
{
  // segments 6, outer 0.8, inner 0.44, slots at angles 0,60,…
  const sdf = circleSegmented3dSDF();
  ok(sdf.f([0.52, 0, 0.3]) < 0, 'segment body (≈30°, between slots) inside');
  ok(sdf.f([0.6, 0, 0]) > 0, 'on a radial slot (angle 0) → gap, outside');
  ok(sdf.f([0, 0, 0]) > 0, 'centre hole outside');
  ok(sdf.f([2, 0, 0]) > 0, 'far outside');
}
{
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0.4, pitch: 0.2, distance: 6, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.6, distance: 8, intensity: 1.1 },
    },
    subjects: [
      { type: 'circle-segmented-3d', id: 'cseg', args: { segments: 6 }, region: 'object' },
    ],
  };
  const compiled = compile(scene);
  ok(compiled.sdf.f([0.52, 0, 0.3]) < 0, 'compiled segment body inside');
  ok(compiled.sdf.f([0, 0, 0]) > 0, 'compiled centre hole outside');
  const glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
  const s = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
  ok(s.includes('opDifference'), 'GLSL has opDifference (slots/hole)');
}
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
