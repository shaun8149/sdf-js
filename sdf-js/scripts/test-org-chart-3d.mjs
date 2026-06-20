import { orgChart3dSDF } from '../src/scene/components/charts/diagrams/org-chart-3d.js';
import { compile } from '../src/scene/compile.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';
let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== org-chart-3d ===\n');
{
  const sdf = orgChart3dSDF(); // levels 3, branching 2, levelHeight 0.9 → topY 0.9
  ok(sdf.f([0, 0.9, 0]) < 0, 'root card (top centre) inside');
  // level 1, node 0: nodeX(0,2) = (0.25-0.5)*3.4 = -0.85, y = 0
  ok(sdf.f([-0.85, 0, 0]) < 0, 'level-1 card inside');
  ok(sdf.f([-0.425, 0.45, 0]) < 0, 'root→child connector midpoint inside');
  ok(sdf.f([5, 5, 5]) > 0, 'far outside');
}
{
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0.4, pitch: 0.2, distance: 6, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.6, distance: 8, intensity: 1.1 },
    },
    subjects: [
      { type: 'org-chart-3d', id: 'org', args: { levels: 3, branching: 2 }, region: 'object' },
    ],
  };
  const compiled = compile(scene);
  ok(compiled.sdf.f([0, 0.9, 0]) < 0, 'compiled root inside');
  const glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
  const s = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
  ok(s.includes('sdBox') && s.includes('sdCapsule'), 'GLSL has sdBox + sdCapsule');
}
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
