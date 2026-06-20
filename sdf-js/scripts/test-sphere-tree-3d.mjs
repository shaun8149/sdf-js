// =============================================================================
// L1 unit tests for the sphere-tree-3d atom.
// -----------------------------------------------------------------------------
// A hierarchical tree of spheres: a root at the top, branching into children on
// each lower level, parent→child capsule links. Covers PresentationLoad "3D
// Spheres Tree Structures". Composite atom (sphere + capsule + union).
// =============================================================================

import { sphereTree3dSDF } from '../src/scene/components/shapes/sphere-tree-3d.js';
import { compile } from '../src/scene/compile.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';

let pass = 0,
  fail = 0;
function ok(cond, name) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`);
  }
}

// Mirror the atom's layout math so tests reference real node positions.
function nodeX(i, n, spread) {
  return ((i + 0.5) / n - 0.5) * spread;
}

console.log('=== sphere-tree-3d unit test ===\n');

// ---- Test group 1: defaults --------------------------------------------------
console.log('Test group 1: defaults (3 levels, binary)');
{
  const sdf = sphereTree3dSDF();
  ok(sdf != null, 'default sdf is non-null');
  // levels=3, levelHeight=1 → topY = (3-1)/2 = 1.0. Root centered at top.
  ok(sdf.f([0, 1.0, 0]) < 0, 'root node (top center) is inside');
  ok(sdf.f([0, 5, 0]) > 0, 'far above is outside');
}

// ---- Test group 2: leaves on the bottom level -------------------------------
console.log('\nTest group 2: bottom-level leaves placed and linked');
{
  // levels=3, branching=2, spread=3 → level 2 has 4 nodes at y = 1 - 2*1 = -1.
  const sdf = sphereTree3dSDF({ levels: 3, branching: 2, spread: 3, levelHeight: 1 });
  const xLeaf0 = nodeX(0, 4, 3); // -1.125
  ok(sdf.f([xLeaf0, -1.0, 0]) < 0, 'first bottom leaf is inside');
  // Level 1 has 2 nodes at y = 0. Link root→node0 midpoint inside.
  const xL1n0 = nodeX(0, 2, 3); // -0.75
  ok(sdf.f([(0 + xL1n0) / 2, (1.0 + 0) / 2, 0]) < 0, 'root→level1 link midpoint inside');
  ok(sdf.f([xL1n0, 0, 0]) < 0, 'level-1 node is inside');
}

// ---- Test group 3: branching factor -----------------------------------------
console.log('\nTest group 3: branching factor controls child count');
{
  // levels=2, branching=3 → 3 children on level 1 at y=0.
  const sdf = sphereTree3dSDF({ levels: 2, branching: 3, spread: 3, levelHeight: 1 });
  let hits = 0;
  for (let i = 0; i < 3; i++) {
    if (sdf.f([nodeX(i, 3, 3), -0.5, 0]) < 0) hits++; // topY=(2-1)/2=0.5, level1 y=-0.5
  }
  ok(hits === 3, `all 3 children inside (got ${hits})`);
}

// ---- Test group 4: edge cases -----------------------------------------------
console.log('\nTest group 4: edge cases');
{
  ok(sphereTree3dSDF({ levels: 0 }) === null, 'levels=0 returns null');
  const single = sphereTree3dSDF({ levels: 1 });
  ok(single != null && single.f([0, 0, 0]) < 0, 'levels=1 → single root at origin inside');
}

// ---- Test group 5: scene compile + GLSL emit --------------------------------
console.log('\nTest group 5: SceneData → compile → GLSL emit');
{
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0.4, pitch: 0.2, distance: 6, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.6, distance: 8, intensity: 1.1 },
    },
    subjects: [
      {
        type: 'sphere-tree-3d',
        id: 'test-tree',
        args: { levels: 3, branching: 2 },
        region: 'object',
      },
    ],
  };

  let compiled;
  try {
    compiled = compile(scene);
    ok(true, 'compile(scene) succeeded');
  } catch (e) {
    ok(false, `compile(scene) failed: ${e.message}`);
  }

  if (compiled && compiled.sdf) {
    ok(compiled.sdf.f([0, 1.0, 0]) < 0, 'compiled SDF: root inside');
    let glsl;
    try {
      glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
      ok(true, 'compileSDF3ToGLSL succeeded');
    } catch (e) {
      ok(false, `GLSL emit failed: ${e.message}`);
    }
    if (glsl) {
      const exprStr = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
      ok(exprStr.includes('sdSphere'), 'GLSL emit contains sdSphere (nodes)');
      ok(exprStr.includes('sdCapsule'), 'GLSL emit contains sdCapsule (links)');
    }
  }
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
