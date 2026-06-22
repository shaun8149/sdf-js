// =============================================================================
// test-stage.mjs — expandStage connector (defaults.stage → studio room).
// =============================================================================

import { expandStage } from '../src/scene/stage.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));

console.log('=== expandStage connector ===\n');

const baseScene = () => ({
  v: 1,
  name: 't',
  subjects: [
    { id: 'ball', type: 'sphere', args: { r: 0.9 }, transform: { translate: [0, 0.9, 0] } },
  ],
  defaults: {},
});

// no stage → untouched (same reference)
{
  const s = baseScene();
  ok(expandStage(s) === s, 'no defaults.stage → returns scene unchanged');
}

// stage:true → room geometry + lights + bg + cameras injected
{
  const s = baseScene();
  s.defaults.stage = true;
  const out = expandStage(s);
  const ids = out.subjects.map((x) => x.id);
  const stageBoxes = ids.filter((i) => i.startsWith('__stage_'));
  ok(
    stageBoxes.length === 7,
    `injects 7 room boxes (floor/ceil/3 walls/2 panels) — got ${stageBoxes.length}`,
  );
  ok(
    out.subjects.some((x) => x.id === 'ball'),
    'keeps the original subject',
  );
  ok(
    out.subjects[out.subjects.length - 1].id === 'ball',
    'original subject after the room (room prepended)',
  );
  ok(
    Array.isArray(out.defaults.lights) && out.defaults.lights.length === 2,
    'declares 2 panel area lights',
  );
  ok(out.defaults.studioBg === 'dark', 'sets dark studio bg');
  ok(
    out.defaults.camera && typeof out.defaults.camera === 'object',
    'supplies defaults.camera (validator needs it)',
  );
  ok(
    out.cameraSequence && out.cameraSequence.shots.length === 1,
    'supplies a default interior cameraSequence',
  );
  // panels are emissive (glow > 0)
  const panels = out.subjects.filter((x) => x.id.includes('panel'));
  ok(
    panels.every((p) => p.material && p.material.glow > 0),
    'panels are emissive',
  );
}

// immutability — input scene not mutated
{
  const s = baseScene();
  s.defaults.stage = true;
  const before = s.subjects.length;
  expandStage(s);
  ok(s.subjects.length === before, 'does not mutate input subjects');
  ok(s.defaults.lights === undefined, 'does not mutate input defaults');
}

// authored cameraSequence is preserved (not overwritten)
{
  const s = baseScene();
  s.defaults.stage = true;
  s.cameraSequence = { loop: false, shots: [{ duration: 1, pos: [0, 0, 9], target: [0, 0, 0] }] };
  const out = expandStage(s);
  ok(out.cameraSequence.shots[0].pos[2] === 9, 'keeps a scene-authored cameraSequence');
}

// object config: custom size widens the room
{
  const s = baseScene();
  s.defaults.stage = { size: [20, 6, 20] };
  const out = expandStage(s);
  const floor = out.subjects.find((x) => x.id === '__stage_floor');
  ok(floor.args.dims[0] > 18, `custom size respected (floor width ${floor.args.dims[0]})`);
}

// facing:'-z' (for chart slides whose connector labels face -z) → solid back
// wall on +z and default camera yaw flipped to π.
{
  const dPos = expandStage({ ...baseScene(), defaults: { stage: true } });
  const backPos = dPos.subjects.find((x) => x.id === '__stage_wall_back').transform.translate[2];
  ok(backPos < 0, `default facing +z → back wall on -z (z=${backPos})`);

  const dNeg = expandStage({ ...baseScene(), defaults: { stage: { facing: '-z' } } });
  const backNeg = dNeg.subjects.find((x) => x.id === '__stage_wall_back').transform.translate[2];
  ok(backNeg > 0, `facing -z → back wall flips to +z (z=${backNeg})`);
  ok(Math.abs(dNeg.defaults.camera.yaw - Math.PI) < 1e-6, 'facing -z → default camera yaw = π');
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
