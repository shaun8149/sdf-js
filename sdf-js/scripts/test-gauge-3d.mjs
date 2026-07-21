import { gauge3dSDF } from '../src/scene/components/charts/data/gauge-3d.js';
import { compile } from '../src/scene/compile.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';
let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== gauge-3d ===\n');
{
  const sdf = gauge3dSDF({ value: 0.7 }); // arc radius 0.9 tube 0.1, top half
  ok(sdf.f([0, 0.9, 0]) < 0, 'arc top centreline inside');
  ok(sdf.f([0, 0, 0]) < 0, 'hub at centre inside');
  const ang = Math.PI * 0.3; // value 0.7
  ok(sdf.f([Math.cos(ang) * 0.4, Math.sin(ang) * 0.4, 0]) < 0, 'needle midpoint inside');
  ok(sdf.f([0, -0.9, 0]) > 0, 'lower half removed (outside)');
  ok(sdf.f([3, 0, 0]) > 0, 'far outside');
}
{
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0.4, pitch: 0.2, distance: 6, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.6, distance: 8, intensity: 1.1 },
    },
    subjects: [{ type: 'gauge-3d', id: 'g', args: { value: 0.7 }, region: 'object' }],
  };
  const compiled = compile(scene);
  ok(compiled.sdf.f([0, 0, 0]) < 0, 'compiled hub inside');
  const glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
  const s = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
  ok(s.includes('sdTorus'), 'GLSL has sdTorus (arc)');
}
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
