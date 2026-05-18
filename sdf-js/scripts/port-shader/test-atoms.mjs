// Batch test: 9 Atlas scene atoms (composite components).
// Verify SceneData compile + SDF probes + GLSL emit each contain expected
// primitive calls (since atoms compose existing primitives).

import { compile } from '../../src/scene/index.js';
import { compileSDF3ToGLSL } from '../../src/sdf/sdf3.compile.js';

const TESTS = [
  // [type, args, expectInsidePoint, expectOutsidePoint, glslPrimitivesExpected]
  ['moon',
    { radius: 0.4 },
    [0, 0, 0], [10, 0, 0],
    ['sdSphere'],
  ],
  ['star',
    { radius: 0.1, shape: 'octahedron' },
    [0, 0, 0], [1, 1, 1],
    ['sdOctahedron'],
  ],
  ['sun',
    { radius: 0.4, haloThickness: 0.06 },
    [0, 0, 0], [10, 0, 0],
    ['sdSphere'],
  ],
  ['cloud-puff',
    { width: 1, height: 0.45, depth: 0.6 },
    [0, 0, 0], [10, 10, 10],
    ['sdEllipsoid'],
  ],
  ['tree-pine',
    { trunkHeight: 0.5, trunkRadius: 0.1, foliageHeight: 1.4, foliageBaseR: 0.55, layers: 3 },
    [0, 0.25, 0],  // inside trunk
    [10, 10, 10],
    ['sdCylinder', 'sdCappedCone'],  // trunk + cone foliage (cone emits as capped_cone)
  ],
  ['tree-broadleaf',
    { trunkHeight: 0.7, trunkRadius: 0.09, foliageR: 0.55 },
    [0, 0.35, 0],  // inside trunk
    [10, 10, 10],
    ['sdCylinder', 'sdSphere'],
  ],
  ['cottage',
    { width: 0.8, height: 0.6, roofHeight: 0.45 },
    [0, 0.3, 0],   // inside wall
    [10, 10, 10],
    ['sdBox', 'sdPyramid'],
  ],
  ['flag-on-pole',
    { poleHeight: 2.0, poleRadius: 0.04, flagWidth: 0.5, flagHeight: 0.3 },
    [0, 1.0, 0],   // inside pole
    [10, 10, 10],
    ['sdCylinder', 'sdBox'],
  ],
  ['bird-silhouette',
    { bodyLength: 0.2, bodyRadius: 0.03, wingSpan: 0.5, wingRise: 0.1 },
    [0, 0, 0],     // inside body
    [10, 10, 10],
    ['sdCapsule', 'sdEllipsoid'],
  ],
];

const sceneFor = (type, args) => ({
  v: 1, name: `test-${type}`,
  source: { format: 'llm-lift', prompt: 'test' },
  subjects: [{ id: 'x', type, args }],
  ground: null,
  defaults: {
    camera: { yaw: 0, pitch: 0, distance: 3, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
    light:  { azimuth: 0.5, altitude: 0.7, distance: 20 },
    shadow: { enabled: false, mode: 'darken', strength: 0.3 },
  },
});

let pass = 0, fail = 0;
const failures = [];

for (const [type, args, inside, outside, expectedPrims] of TESTS) {
  let allOK = true;
  const scene = sceneFor(type, args);
  let compiled;
  try { compiled = compile(scene); }
  catch (e) { failures.push(`${type}: compile failed: ${e.message}`); fail++; console.log(`  ✗ ${type}: compile error`); continue; }

  // Probes
  const dIn = compiled.sdf.f(inside);
  const dOut = compiled.sdf.f(outside);
  const insideOK = dIn < 0;
  const outsideOK = dOut > 0;
  console.log(`  ${insideOK ? '✓' : '✗'} ${type} inside  d=${dIn.toFixed(4)}  (expect <0)`);
  console.log(`  ${outsideOK ? '✓' : '✗'} ${type} outside d=${dOut.toFixed(4)}  (expect >0)`);
  if (!insideOK) { failures.push(`${type}: inside probe ${inside} returned ${dIn.toFixed(4)}`); allOK = false; }
  if (!outsideOK) { failures.push(`${type}: outside probe ${outside} returned ${dOut.toFixed(4)}`); allOK = false; }

  // GLSL emit
  const glsl = compileSDF3ToGLSL(compiled.sdf, { sceneFnName: 'sceneSDF', includeLibrary: false });
  if (glsl.error) {
    console.log(`  ✗ ${type} GLSL emit failed: ${glsl.error}`);
    failures.push(`${type}: GLSL error: ${glsl.error}`);
    allOK = false;
  } else {
    for (const prim of expectedPrims) {
      const hit = glsl.glsl.includes(prim);
      console.log(`  ${hit ? '✓' : '✗'} ${type} GLSL contains ${prim}(...)`);
      if (!hit) { failures.push(`${type}: GLSL missing ${prim}`); allOK = false; }
    }
  }
  if (allOK) pass++; else fail++;
  console.log();
}

console.log(`═══ Atoms batch: ${pass}/${TESTS.length} passed ═══`);
if (failures.length) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  - ${f}`));
  process.exit(1);
}
