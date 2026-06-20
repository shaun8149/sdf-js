import { puzzlePiece3dSDF } from '../src/scene/components/shapes/puzzle-piece-3d.js';
import { compile } from '../src/scene/compile.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';
let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== puzzle-piece-3d ===\n');
{
  // size 1, knob 0.24 → tab on +X at x=0.5 (protrudes to ~0.74), blank carved at -X edge
  const sdf = puzzlePiece3dSDF();
  ok(sdf.f([0, 0, 0]) < 0, 'body centre inside');
  ok(sdf.f([0.62, 0, 0]) < 0, 'tab (protruding +X) inside');
  ok(sdf.f([-0.5, 0, 0]) > 0, 'blank notch (-X edge) carved → outside');
  ok(sdf.f([5, 0, 0]) > 0, 'far outside');
}
{
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0.4, pitch: 0.2, distance: 6, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.6, distance: 8, intensity: 1.1 },
    },
    subjects: [{ type: 'puzzle-piece-3d', id: 'pp', args: {}, region: 'object' }],
  };
  const compiled = compile(scene);
  ok(compiled.sdf.f([0, 0, 0]) < 0, 'compiled body inside');
  ok(compiled.sdf.f([-0.5, 0, 0]) > 0, 'compiled blank notch outside');
  const glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
  const s = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
  ok(s.includes('sdBox') && s.includes('opDifference'), 'GLSL has sdBox + opDifference');
}
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
