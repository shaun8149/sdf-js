import { bulletList3dSDF } from '../src/scene/components/charts/lists/bullet-list-3d.js';
import { compile } from '../src/scene/compile.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';
let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== bullet-list-3d ===\n');
{
  // 5 items, rowHeight 0.45 → top row y=0.9; bullet at x≈-1.08
  const sdf = bulletList3dSDF();
  ok(sdf.f([0, 0.9, 0]) < 0, 'top content bar inside');
  ok(sdf.f([-1.08, 0.9, 0]) < 0, 'top bullet inside');
  ok(sdf.f([0, 0.675, 0]) > 0, 'gap between rows outside');
  ok(sdf.f([0, 3, 0]) > 0, 'far outside');
}
{
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0.4, pitch: 0.2, distance: 6, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.6, distance: 8, intensity: 1.1 },
    },
    subjects: [{ type: 'bullet-list-3d', id: 'bl', args: { items: 5 }, region: 'object' }],
  };
  const compiled = compile(scene);
  ok(compiled.sdf.f([-1.08, 0.9, 0]) < 0, 'compiled bullet inside');
  const glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
  const s = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
  ok(s.includes('sdSphere') && s.includes('sdBox'), 'GLSL has sdSphere + sdBox');
}
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
