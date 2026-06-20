import { relationshipGraph3dSDF } from '../src/scene/components/charts/diagrams/relationship-graph-3d.js';
import { compile } from '../src/scene/compile.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';
let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== relationship-graph-3d ===\n');
{
  const sdf = relationshipGraph3dSDF(); // 6 nodes, radius 1.3
  ok(sdf.f([1.3, 0, 0]) < 0, 'node 0 (+X) inside');
  // ring edge node0→node1 midpoint
  const p1 = [1.3 * Math.cos((2 * Math.PI) / 6), 0, 1.3 * Math.sin((2 * Math.PI) / 6)];
  ok(sdf.f([(1.3 + p1[0]) / 2, 0, p1[2] / 2]) < 0, 'ring edge 0→1 midpoint inside');
  ok(sdf.f([0, 0, 0]) > 0, 'centre (no node, edges on perimeter) outside');
  ok(sdf.f([3, 0, 0]) > 0, 'far outside');
}
{
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0.4, pitch: 0.2, distance: 6, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.6, distance: 8, intensity: 1.1 },
    },
    subjects: [{ type: 'relationship-graph-3d', id: 'rg', args: { count: 6 }, region: 'object' }],
  };
  const compiled = compile(scene);
  ok(compiled.sdf.f([1.3, 0, 0]) < 0, 'compiled node inside');
  const glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
  const s = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
  ok(s.includes('sdSphere') && s.includes('sdCapsule'), 'GLSL has sdSphere + sdCapsule');
}
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
