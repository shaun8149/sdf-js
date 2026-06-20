import { scatter3dSDF, scatterHash } from '../src/scene/components/charts/data/scatter-3d.js';
import { compile } from '../src/scene/compile.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';
let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== scatter-3d ===\n');
{
  const spread = 1.4;
  const sdf = scatter3dSDF();
  ok(sdf.f([0, -spread, 0]) < 0, 'x-axis midpoint inside');
  ok(sdf.f([-spread, 0, 0]) < 0, 'y-axis midpoint inside');
  // dot 0 at the documented deterministic position
  const px = (scatterHash(1) * 2 - 1) * spread;
  const py = (scatterHash(2) * 2 - 1) * spread;
  ok(sdf.f([px, py, 0]) < 0, 'dot 0 (deterministic position) inside');
  ok(sdf.f([5, 5, 5]) > 0, 'far outside');
}
{
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0.4, pitch: 0.2, distance: 6, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.6, distance: 8, intensity: 1.1 },
    },
    subjects: [{ type: 'scatter-3d', id: 'sc', args: { count: 12 }, region: 'object' }],
  };
  const compiled = compile(scene);
  ok(compiled.sdf.f([0, -1.4, 0]) < 0, 'compiled x-axis inside');
  const glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
  const s = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
  ok(s.includes('sdSphere') && s.includes('sdCapsule'), 'GLSL has sdSphere + sdCapsule');
}
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
