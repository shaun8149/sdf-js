// sdf-js/scripts/test-uniform-args.mjs — data-as-uniforms GLSL emission.
// Same scene SHAPE + different data must emit IDENTICAL GLSL (one compile per
// structure, forever); the data rides in result.sdfArgs (vec4-packed floats).
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';
import { compile } from '../src/scene/index.js';
import { expandStage } from '../src/scene/stage.js';
import { renderSequence } from '../src/scene/render-sequence.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== uniform-args (data → uniforms, zero-recompile) ===\n');

const OPTS = { sceneFnName: 'sceneSDF', emitObjectIndex: true, uniformArgs: true };

function funnelScene(magnitude) {
  const ir = {
    structure: 'sequence',
    nodes: ['A', 'B', 'C', 'D'],
    magnitude,
    emphasis: [3],
    title: 'T',
  };
  return compile(expandStage(renderSequence(ir)), {});
}

// ---- the headline invariant: same shape, different data → same source -------
{
  const a = compileSDF3ToGLSL(funnelScene([1000, 400, 150, 40]).sdf, OPTS);
  const b = compileSDF3ToGLSL(funnelScene([900, 600, 300, 10]).sdf, OPTS);
  ok(a.glsl != null && b.glsl != null, 'both compile');
  ok(a.glsl === b.glsl, 'IDENTICAL GLSL for different magnitudes (zero recompile)');
  ok(a.sdfArgs instanceof Float32Array && b.sdfArgs instanceof Float32Array, 'sdfArgs returned');
  ok(a.sdfArgs?.length === b.sdfArgs?.length, 'same slot count');
  ok(!!a.sdfArgs?.some((v, i) => v !== b.sdfArgs[i]), 'data differs in the args array');
  ok(/uniform vec4 u_sdfArgs\[\d+\];/.test(a.glsl), 'declares u_sdfArgs sized for the scene');
  ok(/u_sdfArgs\[\d+\]\.[xyzw]/.test(a.glsl), 'body references packed slots');
}

// ---- default path unchanged (no option → literals, no uniform decl) ---------
{
  const a = compileSDF3ToGLSL(funnelScene([1000, 400, 150, 40]).sdf, {
    sceneFnName: 'sceneSDF',
    emitObjectIndex: true,
  });
  ok(!/u_sdfArgs/.test(a.glsl), 'no option → literal emission (other renderers unchanged)');
  ok(a.sdfArgs == null, 'no option → no sdfArgs');
}

// ---- CPU-side SDF unaffected (JS closures carry real values) ----------------
{
  const c = funnelScene([1000, 400, 150, 40]);
  ok(c.sdf.f([0, 3, 0]) !== c.sdf.f([0, 99, 0]), 'CPU eval still works on real values');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
