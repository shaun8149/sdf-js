import { venn3dSDF } from '../src/scene/components/charts/data/venn-3d.js';
import { compile } from '../src/scene/compile.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';
let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== venn-3d ===\n');
{
  // 3 sets, radius 0.7, overlap 0.45 → layoutR 0.385; ring0 centre at [0,-0.385,0]
  const sdf = venn3dSDF();
  ok(sdf.f([0.7, -0.385, 0]) < 0, 'ring 0 centreline inside');
  ok(sdf.f([0, 0, 0]) > 0, 'central hole (no tube) outside');
  ok(sdf.f([3, 0, 0]) > 0, 'far outside');
}
{
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0.4, pitch: 0.2, distance: 6, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.6, distance: 8, intensity: 1.1 },
    },
    subjects: [{ type: 'venn-3d', id: 'vn', args: { sets: 3 }, region: 'object' }],
  };
  const compiled = compile(scene);
  ok(compiled.sdf.f([0.7, -0.385, 0]) < 0, 'compiled ring inside');
  const glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
  const s = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
  ok(s.includes('sdTorus'), 'GLSL has sdTorus');
}
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
