// sdf-js/scripts/test-glsl-prune.mjs — GLSL library dead-code elimination.
import { pruneGLSL } from '../src/sdf/glsl-prune.js';
import { NOISE_GLSL } from '../src/sdf/noise.glsl.js';
import { VORONOI_GLSL } from '../src/sdf/voronoi.glsl.js';
import { SDF3_GLSL } from '../src/sdf/sdf3.glsl.js';
import { SDF2_GLSL } from '../src/sdf/sdf2.glsl.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== glsl-prune (library dead-code elimination) ===\n');

// ---- synthetic library: chains + overloads + non-function chunks ----
const LIB = `
uniform float u_time;
#define TAU 6.2831853

float helperA(float x) { return x * 2.0; }

// overload pair — must live or die together
float dup(vec2 v) { return v.x; }
float dup(vec3 v) { return v.x + helperA(v.y); }

// unused chain
float deadInner(float x) { return x + 1.0; }
float deadOuter(float x) { return deadInner(x) * 3.0; }

// used chain: root -> mid -> leaf
float leaf(float x) { return x - 1.0; }
float mid(float x) { return leaf(x) * 0.5; }
`;

{
  const out = pruneGLSL(LIB, 'void main(){ float a = mid(dup(vec3(1.0))); }');
  ok(out.includes('float mid('), 'directly-referenced fn kept');
  ok(out.includes('float leaf('), 'transitive dep kept (mid -> leaf)');
  ok(out.includes('float helperA('), 'transitive dep through overload kept (dup(vec3) -> helperA)');
  ok(out.includes('dup(vec2 v)') && out.includes('dup(vec3 v)'), 'overloads kept together');
  ok(!out.includes('deadOuter') && !out.includes('deadInner'), 'unused chain dropped');
  ok(out.includes('uniform float u_time;'), 'non-function chunks (uniforms) always kept');
  ok(out.includes('#define TAU'), 'defines always kept');
}

{
  // nothing referenced -> only non-function chunks remain
  const out = pruneGLSL(LIB, 'void main(){}');
  ok(!out.includes('float mid(') && !out.includes('dup('), 'no roots -> all fns dropped');
}

// ---- the real library: prune for a simple sphere scene ----
{
  const FULL = [NOISE_GLSL, VORONOI_GLSL, SDF3_GLSL, SDF2_GLSL].join('\n');
  const roots = 'float scene(vec3 p){ return sdSphere(p, 1.0); } void main(){ scene(vec3(0.0)); }';
  const out = pruneGLSL(FULL, roots);
  ok(out.includes('float sdSphere('), 'real lib: sdSphere kept');
  ok(!out.includes('sdArchBridge'), 'real lib: arch-bridge dropped');
  ok(!out.includes('sdTerrainElevated'), 'real lib: terrain dropped');
  ok(!out.includes('sdProceduralCity'), 'real lib: city dropped');
  ok(out.length < FULL.length * 0.35, `real lib: >65% smaller (${out.length} vs ${FULL.length})`);
  // definition-completeness: every called identifier that looks like a lib fn is defined
  const defined = new Set(
    [...out.matchAll(/^\s*(?:float|vec[234]|int|bool|void|mat[234])\s+(\w+)\s*\(/gm)].map(
      (m) => m[1],
    ),
  );
  const BUILTINS = new Set(
    'length,dot,cross,normalize,abs,min,max,clamp,mix,step,smoothstep,floor,fract,ceil,mod,sign,pow,exp,exp2,log,log2,sqrt,inversesqrt,sin,cos,tan,asin,acos,atan,radians,degrees,vec2,vec3,vec4,mat2,mat3,mat4,texture2D,textureLod,reflect,refract,ivec2,ivec3,int,float,bool,any,all,not,lessThan,greaterThan,equal'.split(
      ',',
    ),
  );
  const code = out.replace(/\/\/[^\n]*/g, ''); // strip comments — prose like "offset (" is not a call
  const called = new Set(
    [...code.matchAll(/\b(\w+)\s*\(/g)].map((m) => m[1]).filter((n) => !BUILTINS.has(n)),
  );
  const missing = [...called].filter(
    (n) => !defined.has(n) && !new RegExp(`#define\\s+${n}\\b`).test(out) && n !== 'scene',
  );
  ok(
    missing.length === 0,
    `real lib: no dangling calls (missing: ${missing.slice(0, 5).join(',') || 'none'})`,
  );
}

// ---- terrain scene keeps the noise chain across library files ----
{
  const FULL = [NOISE_GLSL, VORONOI_GLSL, SDF3_GLSL, SDF2_GLSL].join('\n');
  const out = pruneGLSL(
    FULL,
    'float scene(vec3 p){ return sdTerrainElevated(p, 35.0, 0.035, 2.0, 0.3); }',
  );
  ok(out.includes('sdTerrainElevated'), 'terrain scene: terrain kept');
  ok(
    /atlasNoised|noised|atlasFbm|fbm/.test(out),
    'terrain scene: noise chain kept (cross-file dep)',
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
