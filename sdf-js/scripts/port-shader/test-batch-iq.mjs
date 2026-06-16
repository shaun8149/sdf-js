// Batch end-to-end test: 7 IQ primitives ported on 2026-05-18.
// Each: SceneData → JS SDF probes (sign correctness) → GLSL emit verification.

import { compile } from '../../src/scene/index.js';
import { compileSDF3ToGLSL } from '../../src/sdf/sdf3.compile.js';

const TESTS = [
  // [scene-type, args, probes: [[label, [x,y,z], sign-expectation], ...], glslCallSubstring]
  [
    'capped-torus',
    { capAngle: Math.PI / 2, majorR: 0.4, minorR: 0.1 },
    [
      ['on arc body (x=R, y=0)', [0.4, 0, 0], -1],
      ['far above arc', [0, 2, 0], +1],
      ['inside ring at (R,0,0)', [0.4, 0, 0.05], -1],
    ],
    'sdCappedTorus',
  ],
  [
    'hex-prism',
    { apothem: 0.3, halfHeight: 0.5 },
    [
      ['inside center', [0, 0, 0], -1],
      ['outside (far X)', [1, 0, 0], +1],
      ['inside vertical bound', [0.2, 0, 0.3], -1],
      ['outside Z bound', [0, 0, 1], +1],
    ],
    'sdHexPrism',
  ],
  [
    'octagon-prism',
    { apothem: 0.3, halfHeight: 0.5 },
    [
      ['inside center', [0, 0, 0], -1],
      ['outside (far X)', [1, 0, 0], +1],
      ['inside near edge', [0.2, 0, 0.3], -1],
    ],
    'sdOctogonPrism',
  ],
  [
    'round-cone',
    { baseRadius: 0.3, topRadius: 0.1, height: 0.6 },
    [
      ['inside base sphere (0,0,0)', [0, 0, 0], -1],
      ['inside mid-cone', [0, 0.3, 0], -1],
      ['inside top sphere', [0, 0.6, 0], -1],
      ['outside far', [1, 0, 0], +1],
    ],
    'sdRoundCone',
  ],
  [
    'rhombus',
    { la: 0.4, lb: 0.2, h: 0.05, cornerR: 0.02 },
    [
      ['inside center', [0, 0, 0], -1],
      ['inside along la axis', [0.3, 0, 0], -1],
      ['outside la axis', [0.6, 0, 0], +1],
      ['outside Y', [0, 0.2, 0], +1],
    ],
    'sdRhombus',
  ],
  [
    'horseshoe',
    { openAngle: Math.PI / 3, radius: 0.4, length: 0.1, halfWidth: 0.08, halfDepth: 0.04 },
    [
      ['far origin Y high (outside)', [0, 1, 0], +1],
      ['inside the bar body', [0, -0.4, 0], -1],
      ['far Z (outside depth)', [0, -0.4, 0.5], +1],
    ],
    'sdHorseshoe',
  ],
  [
    'u-shape',
    { radius: 0.3, legLength: 0.2, halfWidth: 0.06, halfDepth: 0.04 },
    [
      ['inside arc top center', [0.3, 0.1, 0], -1],
      ['inside leg', [0.3, -0.1, 0], -1],
      ['far origin', [0, 1, 0], +1],
      ['outside Z', [0.3, 0.1, 0.5], +1],
    ],
    'sdU',
  ],
];

const sceneFor = (type, args) => ({
  v: 1,
  name: `test-${type}`,
  source: { format: 'llm-lift', prompt: 'test' },
  subjects: [{ id: 'x', type, args }],
  ground: null,
  defaults: {
    camera: { yaw: 0, pitch: 0, distance: 2, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
    light: { azimuth: 0.5, altitude: 0.7, distance: 20 },
    shadow: { enabled: false, mode: 'darken', strength: 0.3 },
  },
});

let pass = 0,
  fail = 0;
const failures = [];

for (const [type, args, probes, glslSub] of TESTS) {
  const scene = sceneFor(type, args);
  let compiled;
  try {
    compiled = compile(scene);
  } catch (e) {
    failures.push(`${type}: compile() failed: ${e.message}`);
    fail++;
    continue;
  }

  let allProbesOK = true;
  for (const [label, pt, expectedSign] of probes) {
    const d = compiled.sdf.f(pt);
    const actualSign = d < 0 ? -1 : d > 0 ? +1 : 0;
    const ok = expectedSign === actualSign || (expectedSign === 0 && Math.abs(d) < 0.001);
    const tag = ok ? '✓' : '✗';
    console.log(
      `  ${tag} ${type} :: ${label} = ${d.toFixed(4)} (expect ${expectedSign > 0 ? '>0' : '<0'})`,
    );
    if (!ok) {
      allProbesOK = false;
      failures.push(`${type} :: ${label} returned ${d.toFixed(4)}, expected sign ${expectedSign}`);
    }
  }

  const glsl = compileSDF3ToGLSL(compiled.sdf, { sceneFnName: 'sceneSDF', includeLibrary: false });
  const hasCall = !glsl.error && glsl.glsl.includes(glslSub);
  const glslTag = hasCall ? '✓' : '✗';
  console.log(`  ${glslTag} ${type} :: GLSL emits ${glslSub}(...)`);
  if (!hasCall) {
    failures.push(
      `${type}: GLSL output missing "${glslSub}". Error: ${glsl.error ?? '(no error)'}`,
    );
    allProbesOK = false;
  }

  if (allProbesOK) pass++;
  else fail++;
  console.log();
}

console.log(`═══ Batch result: ${pass}/${TESTS.length} primitives passed all checks ═══`);
if (failures.length) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
