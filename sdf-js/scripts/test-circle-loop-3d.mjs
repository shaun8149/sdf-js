import { circleLoop3dSDF } from '../src/scene/components/shapes/circle-loop-3d.js';
import { compile } from '../src/scene/compile.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';
let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== circle-loop-3d ===\n');
{
  // segments 4, radius 0.7, tube 0.07; ring in XZ, arrows tangential
  const sdf = circleLoop3dSDF();
  ok(sdf.f([0, 0, 0.7]) < 0, 'ring centreline (angle 90°) inside');
  ok(sdf.f([0.7, 0, 0.1]) < 0, 'arrowhead near +X tip inside');
  ok(sdf.f([0, 0, 0]) > 0, 'centre (loop hole) outside');
  ok(sdf.f([0, 1, 0]) > 0, 'above the loop outside');
  ok(sdf.f([3, 0, 0]) > 0, 'far outside');
}
{
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0.4, pitch: 0.2, distance: 6, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.6, distance: 8, intensity: 1.1 },
    },
    subjects: [{ type: 'circle-loop-3d', id: 'cl', args: { segments: 4 }, region: 'object' }],
  };
  const compiled = compile(scene);
  ok(compiled.sdf.f([0, 0, 0.7]) < 0, 'compiled loop ring inside');
  const glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
  const s = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
  ok(s.includes('sdTorus'), 'GLSL has sdTorus (ring)');
}
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
