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

// compileScene: ground-only scenes return a renderable SDF instead of union(null, ground)
{
  const scene = {
    v: 1,
    name: 'ground only',
    subjects: [],
    ground: { y: -1, region: 'floor' },
    defaults: {
      camera: { yaw: 0, pitch: 0, distance: 5, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.5, distance: 50, intensity: 1.0 },
    },
  };
  const compiled = api.compileScene(scene);
  ok(compiled.sdf !== null && compiled.sdf !== undefined, 'compileScene: ground-only returns SDF');
  ok(typeof compiled.sdf.f === 'function', 'compileScene: ground-only SDF has .f method');
}

// compileScene: subjectMotion injection is isolated from caller-owned SceneData
{
  const scene = {
    v: 1,
    name: 'motion isolation',
    subjects: [
      {
        id: 'moving-box',
        type: 'box',
        args: { size: 0.5 },
        transform: { translate: [1, 2, 3] },
        material: 'silver',
      },
    ],
    defaults: {
      camera: { yaw: 0.1, pitch: 0.2, distance: 8, focal: 2.25, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.6, azimuth: 0.4, distance: 40, intensity: 1.0 },
    },
    cameraSequence: {
      loop: true,
      shots: [{ duration: 1, pos: [0, 1, -5], target: [0, 0, 0], fov: 35 }],
      subjectMotion: [
        {
          subjectId: 'moving-box',
          axis: 'y',
          phases: [{ duration: 1, v0: 0, a: 1 }],
        },
      ],
    },
  };
  const before = JSON.stringify(scene);
  const compiled = api.compileScene(scene);
  ok(JSON.stringify(scene) === before, 'compileScene: does not mutate caller SceneData');
  ok(compiled.motionSlots['moving-box'] === 0, 'compileScene: returns subject motion slots');

  const controls = api.rendererControlsForCompiledScene(compiled);
  ok(controls.fov === 2.25, `rendererControlsForCompiledScene: uses scene focal (got ${controls.fov})`);
  ok(controls.lightAzim === 0.4, 'rendererControlsForCompiledScene: uses scene light azimuth');

  const calls = [];
  const renderer = {
    setCamState: (v) => calls.push(['cam', v]),
    setPostFx: (sceneArg, camArg) => calls.push(['postfx', sceneArg, camArg]),
    setSequence: (seq) => calls.push(['sequence', seq]),
    setVolumes: (volumes) => calls.push(['volumes', volumes]),
    setMotionSlots: (slots) => calls.push(['motion', slots]),
    setSubjectBaseTargets: (targets) => calls.push(['targets', targets]),
  };
  api.applyCompiledSceneToRenderer(renderer, compiled, scene);
  ok(calls.some((c) => c[0] === 'cam'), 'applyCompiledSceneToRenderer: applies camera state');
  ok(calls.some((c) => c[0] === 'sequence' && c[1] === scene.cameraSequence), 'applyCompiledSceneToRenderer: applies cameraSequence');
  ok(
    calls.some((c) => c[0] === 'targets' && c[1]['moving-box']?.join(',') === '1,2,3'),
    'applyCompiledSceneToRenderer: applies numeric subject base targets',
  );
}

// parseLiftResponse: strips markdown fence
{
  const raw = '```json\n{"v": 1, "subjects": []}\n```';
  const parsed = api.parseLiftResponse(raw);
  ok(
    parsed.v === 1 && Array.isArray(parsed.subjects),
    `parseLiftResponse: strips markdown fence (got ${JSON.stringify(parsed)})`,
  );
}

// parseLiftResponse: strips trailing comma
{
  const raw = '{"a": 1, "b": 2,}';
  const parsed = api.parseLiftResponse(raw);
  ok(parsed.a === 1 && parsed.b === 2, 'parseLiftResponse: strips trailing comma');
}

// parseLiftResponse: strips // comments
{
  const raw = '{"a": 1, // this is a comment\n"b": 2}';
  const parsed = api.parseLiftResponse(raw);
  ok(parsed.a === 1 && parsed.b === 2, 'parseLiftResponse: strips // comments');
}

// parseLiftResponse: strips /* */ comments
{
  const raw = '{"a": 1, /* block comment */ "b": 2}';
  const parsed = api.parseLiftResponse(raw);
  ok(parsed.a === 1 && parsed.b === 2, 'parseLiftResponse: strips /* */ comments');
}

// parseLiftResponse: preserves comment-like sequences inside strings
{
  const raw = '{"url": "http://example.com/path"}';
  const parsed = api.parseLiftResponse(raw);
  ok(
    parsed.url === 'http://example.com/path',
    'parseLiftResponse: preserves // inside string values',
  );
}

// loadSystemPromptLift: function exists with correct arity
ok(typeof api.loadSystemPromptLift === 'function', 'loadSystemPromptLift: function exported');
ok(
  api.loadSystemPromptLift.length === 1,
  `loadSystemPromptLift: arity 1 (got ${api.loadSystemPromptLift.length})`,
);

// callLiftLLM: function exists with correct arity
ok(typeof api.callLiftLLM === 'function', 'callLiftLLM: function exported');
ok(api.callLiftLLM.length === 3, `callLiftLLM: arity 3 (got ${api.callLiftLLM.length})`);

// callLiftLLM: throws without apiKey
await (async () => {
  try {
    await api.callLiftLLM('test prompt', '// 2d code', null);
    ok(false, 'callLiftLLM: should throw without apiKey');
  } catch (e) {
    ok(/api[\s-]*key/i.test(e.message), `callLiftLLM: error mentions api key (got: ${e.message})`);
  }
})();

// createRendererForId: known renderer ids return an object with .render and .unmount
{
  const fakeCanvas = { getContext: () => ({}) };
  for (const id of ['studio', 'fly3d', 'silhouette']) {
    try {
      const r = api.createRendererForId(id, fakeCanvas);
      ok(typeof r.render === 'function', `createRendererForId('${id}'): has .render`);
      ok(typeof r.unmount === 'function', `createRendererForId('${id}'): has .unmount`);
    } catch (e) {
      if (id === 'silhouette') {
        ok(false, `createRendererForId('${id}'): threw on fake canvas (${e.message})`);
      } else {
        ok(
          true,
          `createRendererForId('${id}'): threw on fake canvas (expected — no WebGL in Node)`,
        );
      }
    }
  }
}

// createRendererForId: unknown id throws
{
  let threw = false;
  try {
    api.createRendererForId('bogus', {});
  } catch (e) {
    threw = /unknown.*renderer/i.test(e.message);
  }
  ok(threw, 'createRendererForId: throws on unknown id');
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
