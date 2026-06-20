import { layerStack3dSDF } from '../src/scene/components/charts/layers/layer-stack-3d.js';
import { compile } from '../src/scene/compile.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';
let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== layer-stack-3d ===\n');
{
  // 4 layers, layerH 0.22 gap 0.12 → stride 0.34, totalH 1.24; layer0 y=-0.51, layer3 y=0.51
  const sdf = layerStack3dSDF();
  ok(sdf.f([0, -0.51, 0]) < 0, 'bottom layer inside');
  ok(sdf.f([0, 0.51, 0]) < 0, 'top layer inside');
  ok(sdf.f([0, -0.34, 0]) > 0, 'gap between layers outside');
  ok(sdf.f([0, 3, 0]) > 0, 'far above outside');
}
{
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0.4, pitch: 0.2, distance: 6, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.6, distance: 8, intensity: 1.1 },
    },
    subjects: [{ type: 'layer-stack-3d', id: 'ls', args: { layers: 4 }, region: 'object' }],
  };
  const compiled = compile(scene);
  ok(compiled.sdf.f([0, 0.51, 0]) < 0, 'compiled top layer inside');
  const glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
  const s = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
  ok(s.includes('sdBox'), 'GLSL has sdBox');
}
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
