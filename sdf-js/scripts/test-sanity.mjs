// =============================================================================
// scripts/test-sanity.mjs — synthetic positive tests for sanity.js (Track 5.1)
// -----------------------------------------------------------------------------
// Each test fabricates a SceneData containing exactly one LLM-style mistake
// and asserts the matching rule fires. Run after editing src/scene/sanity.js.
//
// Usage:
//   node sdf-js/scripts/test-sanity.mjs
// =============================================================================

import { sanityCheck } from '../src/scene/sanity.js';

const baseScene = {
  v: 1, name: 'sanity-test',
  defaults: {
    camera: { yaw: 0.5, pitch: 0.3, distance: 30, focal: 1.0, targetX: 0, targetY: 1, targetZ: 0 },
    light:  { azimuth: 0.5, altitude: 0.4, distance: 50, intensity: 1.0 },
  },
  subjects: [],
};

const tests = [
  { name: 'rule 1 large-position',
    scene: { ...baseScene, subjects: [
      { id: 'x', type: 'box', args: { dims: [1,1,1] }, transform: { translate: [0, 0, 500] } },
    ] },
    expect: 'large-position' },
  { name: 'rule 2 large-arg (radius)',
    scene: { ...baseScene, subjects: [{ id: 'x', type: 'sphere', args: { radius: 200 } }] },
    expect: 'large-arg' },
  { name: 'rule 2 tiny-arg (radius)',
    scene: { ...baseScene, subjects: [{ id: 'x', type: 'sphere', args: { radius: 0.0001 } }] },
    expect: 'tiny-arg' },
  { name: 'rule 3 non-finite (NaN)',
    scene: { ...baseScene, subjects: [{ id: 'x', type: 'sphere', args: { radius: NaN } }] },
    expect: 'non-finite' },
  { name: 'rule 4 duplicate-id',
    scene: { ...baseScene, subjects: [
      { id: 'dup', type: 'sphere', args: { radius: 1 } },
      { id: 'dup', type: 'box',    args: { dims: [1,1,1] } },
    ] },
    expect: 'duplicate-id' },
  { name: 'rule 5 camera-target-out',
    scene: { ...baseScene,
      defaults: { ...baseScene.defaults,
        camera: { yaw: 0.5, pitch: 0.3, distance: 30, focal: 1.0,
                  targetX: 1000, targetY: 0, targetZ: 0 } },
      subjects: [{ id: 'x', type: 'sphere', args: { radius: 1 } }] },
    expect: 'camera-target-out' },
  { name: 'rule 6 camera-inside-subject',
    scene: { ...baseScene,
      defaults: { ...baseScene.defaults,
        camera: { yaw: 0, pitch: 0, distance: 0.5, focal: 1.0,
                  targetX: 0, targetY: 0, targetZ: 0 } },
      subjects: [{ id: 'big-box', type: 'box', args: { dims: [100, 100, 100] } }] },
    expect: 'camera-inside-subject' },
  { name: 'rule 7 light-altitude-out',
    scene: { ...baseScene,
      defaults: { ...baseScene.defaults,
        light: { azimuth: 0.5, altitude: 3.0, distance: 50, intensity: 1.0 } },
      subjects: [{ id: 'x', type: 'sphere', args: { radius: 1 } }] },
    expect: 'light-altitude-out' },
];

let passed = 0, failed = 0;
for (const t of tests) {
  const fakeCompiled = { cameraStatic: t.scene.defaults.camera };
  const r = sanityCheck(t.scene, fakeCompiled);
  const ruleFired = r.all.some(i => i.rule === t.expect);
  if (ruleFired) {
    console.log(`✓ ${t.name}`);
    passed++;
  } else {
    console.log(`✗ ${t.name} — expected "${t.expect}" but got: ${r.summary}`);
    for (const i of r.all) console.log(`    ${i.rule}: ${i.message.slice(0, 100)}`);
    failed++;
  }
}
console.log(`\n${passed}/${passed + failed} rules verified positive`);
if (failed > 0) process.exit(1);
