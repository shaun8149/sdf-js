import { gantt3dSDF } from '../src/scene/components/charts/data/gantt-3d.js';
import { compile } from '../src/scene/compile.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';
let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== gantt-3d ===\n');
{
  // 4 tasks, starts 0/0.16/0.32/0.48, dur 0.34, trackLength 3 → task0 cx=-0.99, topY 0.63
  const sdf = gantt3dSDF();
  ok(sdf.f([-0.99, 0.63, 0]) < 0, 'task 0 bar inside');
  ok(sdf.f([-1.3, 0.21, 0]) > 0, 'before task 1 start (row 1) outside');
  ok(sdf.f([5, 5, 5]) > 0, 'far outside');
}
{
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0.4, pitch: 0.2, distance: 6, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.6, distance: 8, intensity: 1.1 },
    },
    subjects: [{ type: 'gantt-3d', id: 'gt', args: { tasks: 4 }, region: 'object' }],
  };
  const compiled = compile(scene);
  ok(compiled.sdf.f([-0.99, 0.63, 0]) < 0, 'compiled task 0 inside');
  const glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
  const s = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
  ok(s.includes('sdBox'), 'GLSL has sdBox');
}
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
