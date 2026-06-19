// =============================================================================
// test-compositor-api.mjs — L1 unit tests for extracted compositor APIs
// =============================================================================

import '../src/sdf/index.js';
import * as api from '../src/compositor-api.js';

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

console.log('=== compositor-api smoke test ===\n');

ok(api.DEFAULT_LIFT_MODEL === 'claude-sonnet-4-6', 'DEFAULT_LIFT_MODEL exported');

// sphericalToCamState
{
  const cam = { targetX: 0, targetY: 0, targetZ: 0, yaw: 0, pitch: 0, distance: 5 };
  const state = api.sphericalToCamState(cam);
  ok(state.position.length === 3, 'sphericalToCamState: returns position vec3');
  ok(
    Math.abs(state.position[2] - -5) < 1e-9,
    `sphericalToCamState: yaw=0 pitch=0 → z=-distance (got ${state.position[2]})`,
  );
  ok(state.yaw === 0 && state.pitch === 0, 'sphericalToCamState: passes through yaw/pitch');
}
{
  const cam = { targetX: 1, targetY: 2, targetZ: 3, yaw: Math.PI / 2, pitch: 0, distance: 5 };
  const state = api.sphericalToCamState(cam);
  ok(
    Math.abs(state.position[0] - -4) < 1e-6,
    `sphericalToCamState: yaw=π/2 → x=targetX-distance (got ${state.position[0]})`,
  );
}

// compileScene
{
  const scene = {
    v: 1,
    name: 'compileScene smoke',
    subjects: [
      {
        id: 'box',
        type: 'box',
        args: { size: 0.5 },
        transform: { translate: [0, 0, 0] },
        material: 'silver',
      },
    ],
    defaults: {
      camera: { yaw: 0, pitch: 0, distance: 5, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.5, distance: 50, intensity: 1.0 },
    },
  };
  const compiled = api.compileScene(scene);
  ok(compiled.sdf !== null && compiled.sdf !== undefined, 'compileScene: returns non-null SDF');
  ok(typeof compiled.sdf.f === 'function', 'compileScene: SDF has .f method');
  ok(
    compiled.sdf.f([0, 0, 0]) < 0,
    `compileScene: box center inside (got ${compiled.sdf.f([0, 0, 0])})`,
  );
  ok(compiled.sdf.f([10, 10, 10]) > 0, 'compileScene: far point outside');
}

// compileScene: handles seed for Generator-S variants
{
  const sceneNoVariants = {
    v: 1,
    name: 'no variants',
    subjects: [
      {
        id: 'b',
        type: 'box',
        args: { size: 0.5 },
        transform: { translate: [0, 0, 0] },
        material: 'silver',
      },
    ],
    defaults: {
      camera: { yaw: 0, pitch: 0, distance: 5, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.5, distance: 50, intensity: 1.0 },
    },
  };
  const compiledA = api.compileScene(sceneNoVariants, { sceneHash: 1 });
  const compiledB = api.compileScene(sceneNoVariants, { sceneHash: 1 });
  ok(
    compiledA.sdf.f([0, 0, 0]) === compiledB.sdf.f([0, 0, 0]),
    'compileScene: deterministic same-seed',
  );
}

// [More tests added in Tasks 1.4-1.6]

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
