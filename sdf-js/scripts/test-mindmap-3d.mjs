import { mindmap3dSDF } from '../src/scene/components/charts/diagrams/mindmap-3d.js';
import { compile } from '../src/scene/compile.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';
let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== mindmap-3d ===\n');
{
  // branches 5, mainDist 1.1; branch 0 at angle 0 → [1.1,0,0]
  const sdf = mindmap3dSDF();
  ok(sdf.f([0, 0, 0]) < 0, 'central node inside');
  ok(sdf.f([1.1, 0, 0]) < 0, 'branch 0 node inside');
  ok(sdf.f([0.55, 0, 0]) < 0, 'centre→branch edge midpoint inside');
  ok(sdf.f([4, 0, 0]) > 0, 'far outside');
}
{
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0.4, pitch: 0.2, distance: 6, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.6, distance: 8, intensity: 1.1 },
    },
    subjects: [{ type: 'mindmap-3d', id: 'mm', args: { branches: 5 }, region: 'object' }],
  };
  const compiled = compile(scene);
  ok(compiled.sdf.f([0, 0, 0]) < 0, 'compiled centre inside');
  const glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
  const s = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
  ok(s.includes('sdSphere') && s.includes('sdCapsule'), 'GLSL has sdSphere + sdCapsule');
}
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
