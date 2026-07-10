// test-stage-preset.mjs — the fighting-game stage preset (config-only stage v0).
// stagePreset(scene) adds: dark backdrop + interiorDark, a spotlight rig
// (defaults.lights), a platform subject under the structure, and per-shot DOF.
import { stagePreset } from '../src/scene/environments.js';
import { renderIR } from '../src/scene/render-ir.js';

let pass = 0, fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== stage-preset (fighting-game stage v0) ===\n');

const ir = {
  structure: 'sequence',
  nodes: ['Leads', 'Qualified', 'Proposal', 'Closed'],
  magnitude: [1000, 400, 150, 40],
  emphasis: [3],
  title: 'Sales Funnel',
};

const base = renderIR(ir);
const staged = stagePreset(base);

// (a) backdrop recedes: dark cyclorama + dimmed sky ambient
ok(staged.defaults.studioBg === 'dark', 'studioBg = dark');
ok(typeof staged.defaults.interiorDark === 'number' && staged.defaults.interiorDark < 1, 'interiorDark set (< 1)');

// (b) spotlight rig: at least a key spot (with dir) + a rim light
const lights = staged.defaults.lights || [];
ok(lights.length >= 2, 'at least 2 stage lights');
ok(lights.some((L) => Array.isArray(L.dir)), 'key light is a spotlight (has dir)');

// (c) platform under the structure
const platform = staged.subjects.find((s) => s.id === 'stage-platform');
ok(!!platform && platform.type === 'cylinder', 'platform subject added (cylinder)');
ok(platform.args.height <= 0.2, 'platform is a flat disc');
ok(platform.transform.translate[1] <= 0.1, 'platform sits at ground level');

// (d) every shot gets DOF unless it already has aperture
ok(staged.cameraSequence.shots.every((s) => s.aperture > 0 && s.focalDistance > 0), 'every shot has aperture + focalDistance');
{
  const custom = JSON.parse(JSON.stringify(base));
  custom.cameraSequence.shots[0].aperture = 0.42;
  const s2 = stagePreset(custom);
  ok(Math.abs(s2.cameraSequence.shots[0].aperture - 0.42) < 1e-9, 'a shot that already sets aperture keeps it');
}

// immutability: the input scene is not mutated
ok(base.subjects.every((s) => s.id !== 'stage-platform'), 'original scene not mutated (no platform)');
ok(!base.defaults.lights, 'original defaults not mutated (no lights)');

// renderIR opts.stage applies the preset
const viaOpts = renderIR(ir, { stage: true });
ok(viaOpts.subjects.some((s) => s.id === 'stage-platform'), 'renderIR(ir, {stage:true}) applies the preset');
const noStage = renderIR(ir, {});
ok(!noStage.subjects.some((s) => s.id === 'stage-platform'), 'renderIR without stage is unchanged');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
