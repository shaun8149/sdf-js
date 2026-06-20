import { treeDiagram3dSDF } from '../src/scene/components/charts/diagrams/tree-diagram-3d.js';
import { compile } from '../src/scene/compile.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';
let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== tree-diagram-3d ===\n');
{
  // levels 3, branching 2, levelWidth 0.95 → leftX -0.95; widest level (l=2) at x=0.95
  const sdf = treeDiagram3dSDF();
  ok(sdf.f([-0.95, 0, 0]) < 0, 'root (left) inside');
  ok(sdf.f([0.95, 0, -0.975]) < 0, 'leaf (right, level 2) inside');
  ok(sdf.f([-0.475, 0, -0.325]) < 0, 'root→child connector midpoint inside');
  ok(sdf.f([5, 0, 0]) > 0, 'far outside');
}
{
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0.4, pitch: 0.2, distance: 6, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.6, distance: 8, intensity: 1.1 },
    },
    subjects: [
      { type: 'tree-diagram-3d', id: 'td', args: { levels: 3, branching: 2 }, region: 'object' },
    ],
  };
  const compiled = compile(scene);
  ok(compiled.sdf.f([-0.95, 0, 0]) < 0, 'compiled root inside');
  const glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
  const s = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
  ok(s.includes('sdSphere') && s.includes('sdCapsule'), 'GLSL has sdSphere + sdCapsule');
}
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
