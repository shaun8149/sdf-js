import { fishbone3dSDF } from '../src/scene/components/charts/diagrams/fishbone-3d.js';
import { compile } from '../src/scene/compile.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';
let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== fishbone-3d ===\n');
{
  // 6 ribs, spineLength 2.8 → half 1.4; rib0 base x=-1.0 up, tip [-1.35,0.7,0]
  const sdf = fishbone3dSDF();
  ok(sdf.f([0, 0, 0]) < 0, 'spine midpoint inside');
  ok(sdf.f([-1.175, 0.35, 0]) < 0, 'rib 0 midpoint inside');
  ok(sdf.f([1.55, 0, 0]) < 0, 'head cone inside');
  ok(sdf.f([5, 0, 0]) > 0, 'far outside');
}
{
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0.4, pitch: 0.2, distance: 6, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.6, distance: 8, intensity: 1.1 },
    },
    subjects: [{ type: 'fishbone-3d', id: 'fb', args: { ribs: 6 }, region: 'object' }],
  };
  const compiled = compile(scene);
  ok(compiled.sdf.f([0, 0, 0]) < 0, 'compiled spine inside');
  const glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
  const s = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
  ok(s.includes('sdCapsule'), 'GLSL has sdCapsule');
}
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
