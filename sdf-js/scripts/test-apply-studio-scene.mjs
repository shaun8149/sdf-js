// =============================================================================
// test-apply-studio-scene.mjs — src/runtime/apply-studio-scene.js
// Guards the single shared studio scene-load core (Phase 1 of studio-decoupling).
// =============================================================================

import '../src/sdf/index.js';
import {
  sceneHasTimeContent,
  pickRenderScale,
  expandAndCompile,
  wireStudioScene,
} from '../src/runtime/apply-studio-scene.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));

console.log('=== apply-studio-scene (shared studio runtime) ===\n');

const ball = (extra = {}) => ({
  v: 1,
  name: 't',
  subjects: [{ id: 'b', type: 'sphere', args: { r: 0.5 }, transform: { translate: [0, 0, 0] } }],
  defaults: {
    camera: { yaw: 0, pitch: 0, distance: 5, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
    light: { altitude: 0.5, azimuth: 0.5, distance: 50, intensity: 1 },
  },
  ...extra,
});

// ---- pickRenderScale (the heavy-detection that the seg2-black fix depends on) ----
ok(pickRenderScale(ball()) === 2.0, 'plain scene → 2× SSAA');
ok(pickRenderScale(ball({ volumes: [{ kind: 'fog' }] })) === 1.0, 'volumes → 1×');
ok(
  pickRenderScale({ ...ball(), defaults: { ...ball().defaults, stage: true } }) === 1.0,
  'staged scene → 1× (the seg2-black fix)',
);
ok(
  pickRenderScale({
    v: 1,
    subjects: Array.from({ length: 20 }, (_, i) => ({ id: `s${i}`, type: 'box' })),
  }) === 1.0,
  '>16 subjects → 1×',
);
ok(pickRenderScale(null) === 2.0, 'null scene → 2× (default)');

// ---- sceneHasTimeContent (idle-stop decision) ----
ok(sceneHasTimeContent(ball({ volumes: [{ kind: 'god-rays' }] })) === true, 'volumes animate');
ok(sceneHasTimeContent(ball()) === false, 'plain spheres are static');
{
  const sea = ball();
  sea.subjects[0].material = 'sea';
  ok(sceneHasTimeContent(sea) === true, 'sea material animates');
}
ok(sceneHasTimeContent(null) === false, 'null → not animating');

// ---- expandAndCompile (connectors → SDF) ----
{
  const { stagedScene, compiled, sdf } = expandAndCompile(ball(), {});
  ok(typeof sdf.f === 'function', 'returns a renderable SDF');
  ok(sdf.f([0, 0, 0]) < 0 && sdf.f([10, 10, 10]) > 0, 'SDF: inside negative, far positive');
  ok(stagedScene.subjects.length === 1, 'no stage → subjects unchanged');
  ok(compiled && compiled.sdf, 'returns the compiled result');
}
{
  // staged scene → room geometry injected
  const staged = { ...ball(), defaults: { ...ball().defaults, stage: true } };
  const { stagedScene } = expandAndCompile(staged, {});
  ok(
    stagedScene.subjects.some((s) => s.id && s.id.startsWith('__stage_')),
    'defaults.stage → room boxes injected before compile',
  );
}

// ---- wireStudioScene (the ONE place studio features get pushed) ----
{
  const calls = {};
  const mockStudio = {
    setPostFx: (s, c) => (calls.postFx = { s, c }),
    setRuneHeightmap: (h) => (calls.heightmap = h),
    setVolumes: (v) => (calls.volumes = v),
    setRenderScale: (r) => (calls.renderScale = r),
    setSequence: (q) => (calls.sequence = q),
    setAnimated: (a) => (calls.animated = a),
    render: (sdf) => ((calls.rendered = !!sdf), { bytes: 42 }),
  };
  const raw = {
    ...ball(),
    volumes: [{ kind: 'fog' }],
    cameraSequence: { shots: [{ duration: 1 }] },
    defaults: { ...ball().defaults, stage: true },
  };
  const res = wireStudioScene(mockStudio, raw, { bakedHeightmap: null }, { f: () => -1 });
  ok(calls.volumes && calls.volumes.length === 1, 'wires volumes');
  ok(calls.renderScale === 1.0, 'wires renderScale (stage → 1×)');
  ok(calls.sequence && calls.sequence.shots.length === 1, 'wires cameraSequence');
  ok(calls.animated === true, 'wires animated (volumes)');
  ok(calls.postFx && calls.postFx.c, 'wires postFx with the camera');
  ok(calls.rendered === true && res.bytes === 42, 'renders + returns render result');
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
