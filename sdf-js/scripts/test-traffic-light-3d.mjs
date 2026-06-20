import { trafficLight3dSDF } from '../src/scene/components/charts/data/traffic-light-3d.js';
import { compile } from '../src/scene/compile.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';
let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== traffic-light-3d ===\n');
{
  // 3 lights, spacing 0.55 depth 0.3 → light0 at [0,0.55,0.15]
  const sdf = trafficLight3dSDF();
  ok(sdf.f([0, 0, 0]) < 0, 'housing centre inside');
  ok(sdf.f([0, 0.55, 0.15]) < 0, 'top light (front face) inside');
  ok(sdf.f([0, -0.55, 0.15]) < 0, 'bottom light inside');
  ok(sdf.f([3, 0, 0]) > 0, 'far outside');
}
{
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0.4, pitch: 0.2, distance: 6, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.6, distance: 8, intensity: 1.1 },
    },
    subjects: [{ type: 'traffic-light-3d', id: 'tlt', args: { lights: 3 }, region: 'object' }],
  };
  const compiled = compile(scene);
  ok(compiled.sdf.f([0, 0, 0]) < 0, 'compiled housing inside');
  const glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
  const s = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
  ok(s.includes('sdSphere') && s.includes('sdBox'), 'GLSL has sdSphere + sdBox');
}
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
