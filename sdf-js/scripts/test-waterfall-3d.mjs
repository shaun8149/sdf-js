import { waterfall3dSDF } from '../src/scene/components/charts/data/waterfall-3d.js';
import { compile } from '../src/scene/compile.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';
let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== waterfall-3d ===\n');
{
  // default deltas [0.7,0.35,-0.25,0.35,-0.25]; stride 0.62 off 1.24
  const sdf = waterfall3dSDF();
  ok(sdf.f([-1.24, 0.35, 0]) < 0, 'bar 0 (ground start) inside');
  ok(sdf.f([0, 0.925, 0]) < 0, 'bar 2 (floating) inside');
  ok(sdf.f([0, 0.4, 0]) > 0, 'below floating bar 2 outside');
  ok(sdf.f([5, 0, 0]) > 0, 'far outside');
}
{
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0.4, pitch: 0.2, distance: 6, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.6, distance: 8, intensity: 1.1 },
    },
    subjects: [{ type: 'waterfall-3d', id: 'wf', args: { count: 5 }, region: 'object' }],
  };
  const compiled = compile(scene);
  ok(compiled.sdf.f([-1.24, 0.35, 0]) < 0, 'compiled bar 0 inside');
  const glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
  const s = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
  ok(s.includes('sdBox'), 'GLSL has sdBox');
}
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
