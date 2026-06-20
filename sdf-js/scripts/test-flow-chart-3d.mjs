import { flowChart3dSDF } from '../src/scene/components/charts/diagrams/flow-chart-3d.js';
import { compile } from '../src/scene/compile.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';
let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== flow-chart-3d ===\n');
{
  // steps 4, nodeW 0.6, gap 0.55 → stride 1.15, offset 1.725; step0 at x=-1.725
  const sdf = flowChart3dSDF();
  ok(sdf.f([-1.725, 0, 0]) < 0, 'step 0 box inside');
  ok(sdf.f([-0.575, 0, 0]) < 0, 'step 1 box inside');
  ok(sdf.f([-1.15, 0, 0]) < 0, 'arrow connector between steps 0–1 inside');
  ok(sdf.f([5, 0, 0]) > 0, 'far outside');
  ok(sdf.f([0, 2, 0]) > 0, 'above the row outside');
}
{
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0.4, pitch: 0.2, distance: 6, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.6, distance: 8, intensity: 1.1 },
    },
    subjects: [{ type: 'flow-chart-3d', id: 'fc', args: { steps: 4 }, region: 'object' }],
  };
  const compiled = compile(scene);
  ok(compiled.sdf.f([-1.725, 0, 0]) < 0, 'compiled step inside');
  const glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
  const s = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
  ok(
    s.includes('sdBox') && s.includes('sdCapsule') && s.includes('sdCappedCone'),
    'GLSL has box+capsule+cone',
  );
}
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
