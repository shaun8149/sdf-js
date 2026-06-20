import { timeline3dSDF } from '../src/scene/components/charts/diagrams/timeline-3d.js';
import { compile } from '../src/scene/compile.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';
let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== timeline-3d ===\n');
{
  // count 5, axisLength 3.4 → half 1.7; marker 0 at x=-1.7, up (+y) stem 0.45
  const sdf = timeline3dSDF();
  ok(sdf.f([0, 0, 0]) < 0, 'axis midpoint inside');
  ok(sdf.f([-1.7, 0.45, 0]) < 0, 'milestone 0 marker (above) inside');
  ok(sdf.f([-0.85, -0.45, 0]) < 0, 'milestone 1 marker (below) inside');
  ok(sdf.f([5, 0, 0]) > 0, 'far along axis outside');
  ok(sdf.f([0, 2, 0]) > 0, 'high above outside');
}
{
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0.4, pitch: 0.2, distance: 6, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.6, distance: 8, intensity: 1.1 },
    },
    subjects: [{ type: 'timeline-3d', id: 'tl', args: { count: 5 }, region: 'object' }],
  };
  const compiled = compile(scene);
  ok(compiled.sdf.f([0, 0, 0]) < 0, 'compiled axis inside');
  const glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
  const s = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
  ok(s.includes('sdSphere') && s.includes('sdCapsule'), 'GLSL has sdSphere + sdCapsule');
}
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
