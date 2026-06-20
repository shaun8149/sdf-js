import { cubeSegmented3dSDF } from '../src/scene/components/shapes/cube-segmented-3d.js';
import { compile } from '../src/scene/compile.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';

let pass = 0,
  fail = 0;
function ok(c, n) {
  if (c) {
    pass++;
    console.log(`  ✓ ${n}`);
  } else {
    fail++;
    console.log(`  ✗ ${n}`);
  }
}
console.log('=== cube-segmented-3d unit test ===\n');
{
  // segments 4, size 1.2, gap 0.08 → slabThick 0.24, stride 0.32, x = ±0.48, ±0.16
  const sdf = cubeSegmented3dSDF();
  ok(sdf.f([-0.48, 0, 0]) < 0, 'slab 0 centre inside');
  ok(sdf.f([0.48, 0, 0]) < 0, 'slab 3 centre inside');
  ok(sdf.f([-0.32, 0, 0]) > 0, 'gap between slab 0 and 1 outside');
  ok(sdf.f([2, 0, 0]) > 0, 'far outside');
}
{
  const sdfY = cubeSegmented3dSDF({ segments: 3, axis: 'y', size: 1.2, gap: 0.1 });
  // 3 slabs along Y: stride = (1.2-0.2)/3 + 0.1 = 0.333+0.1=0.433; y = ±0.433, 0
  ok(sdfY.f([0, 0, 0]) < 0, 'axis=y: middle slab centre inside');
  ok(sdfY.f([0, 0.2167, 0]) > 0, 'axis=y: gap between slabs outside');
}
{
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0.4, pitch: 0.2, distance: 6, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.6, distance: 8, intensity: 1.1 },
    },
    subjects: [{ type: 'cube-segmented-3d', id: 'cs', args: { segments: 4 }, region: 'object' }],
  };
  const compiled = compile(scene);
  ok(compiled.sdf.f([-0.48, 0, 0]) < 0, 'compiled slab inside');
  const glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
  const s = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
  ok(s.includes('sdBox'), 'GLSL emit has sdBox (slabs)');
}
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
