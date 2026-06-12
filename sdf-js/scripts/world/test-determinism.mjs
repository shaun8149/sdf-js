// =============================================================================
// test-determinism.mjs — M7 §2.4 determinism CI
//
// Builds a small world (a 1D bouncing ball with gravity, rng-driven jitter, and
// user kicks at known ticks), runs it forward N ticks, serializes the log,
// cold-replays from the serialized log, and asserts the final world is
// deep-equal to the live world.
//
// Runs three sub-tests:
//   1. live vs replay, log mode "full"     (patches recorded — easy mode)
//   2. live vs replay, log mode "lean"     (actions only — proves determinism
//                                           is in the math, not in stored
//                                           answers; this is the real test)
//   3. fork at tick K, continue both halves separately, verify the union
//      matches the original full run     (savegame-native is structural, not
//                                           a feature to add later)
//
// Plus a sanity check that the rng is per-(rule, tick) independent — toggling
// one rng-using rule off doesn't change another rng-using rule's stream.
// =============================================================================

import { step } from '../../src/world/runtime.js';
import { newLog, serialize, deserialize, replay, fork } from '../../src/world/log.js';
import { makeRule } from '../../src/world/rules.js';
import { makeRng } from '../../src/world/rng.js';

// -----------------------------------------------------------------------------
// Rules
// -----------------------------------------------------------------------------

const gravity = makeRule({
  id: 'gravity',
  apply: (world, _actions, dt) => {
    const vy = world.params.ball.vel[1];
    return { patches: [{ path: 'params.ball.vel.1', value: vy - 9.8 * dt }] };
  },
});

const jitter = makeRule({
  id: 'jitter',
  apply: (world, _actions, dt) => {
    const rng = makeRng(world.rng.seed, 'jitter', world.clock.tick);
    const dx = (rng() - 0.5) * 0.05;
    const vx = world.params.ball.vel[0];
    return { patches: [{ path: 'params.ball.vel.0', value: vx + dx * dt }] };
  },
});

const kick = makeRule({
  id: 'kick',
  apply: (world, actions) => {
    const patches = [];
    for (const a of actions) {
      if (a.type === 'kick') {
        const vy = world.params.ball.vel[1];
        patches.push({ path: 'params.ball.vel.1', value: vy + a.payload.dv });
      }
    }
    return { patches };
  },
});

const integrate = makeRule({
  id: 'integrate',
  apply: (world, _actions, dt) => {
    const v = world.params.ball.vel;
    const p = world.scene.subjects.ball.translate;
    return {
      patches: [
        { path: 'scene.subjects.ball.translate.0', value: p[0] + v[0] * dt },
        { path: 'scene.subjects.ball.translate.1', value: p[1] + v[1] * dt },
      ],
    };
  },
});

const rules = [gravity, jitter, kick, integrate];

// -----------------------------------------------------------------------------
// World factory
// -----------------------------------------------------------------------------

function makeWorld({ seed = 0xA710A5, mode = 'full' } = {}) {
  const initial = {
    scene: {
      subjects: {
        ball: { translate: [0, 5, 0] },
      },
    },
    params: {
      ball: { vel: [0, 0, 0], mass: 1 },
    },
    particles: null,
    fields: null,
    clock: { t: 0, dt: 1 / 60, tick: 0 },
    rng: { seed, n: 0 },
  };
  return {
    ...JSON.parse(JSON.stringify(initial)),
    rules,
    log: newLog({ seed, initial, mode }),
  };
}

// -----------------------------------------------------------------------------
// Driver
// -----------------------------------------------------------------------------

const KICKS = [
  { tick: 60,  type: 'kick', payload: { dv: 4.5 } },
  { tick: 180, type: 'kick', payload: { dv: 3.0 } },
  { tick: 350, type: 'kick', payload: { dv: 7.2 } },
];

function runForward(world, ticks) {
  for (let i = 0; i < ticks; i++) {
    const actionsThisTick = KICKS
      .filter((a) => a.tick === world.clock.tick)
      .map((a) => ({ ...a, tick: world.clock.tick }));
    world = step(world, actionsThisTick);
  }
  return world;
}

// -----------------------------------------------------------------------------
// Comparison helpers
// -----------------------------------------------------------------------------

function deepEqual(a, b, path = '') {
  if (a === b) return { eq: true };
  if (typeof a !== typeof b) return { eq: false, where: path, a, b };
  if (a === null || b === null) return { eq: false, where: path, a, b };
  if (typeof a !== 'object') {
    // numbers: bitwise equal is what determinism actually requires
    if (typeof a === 'number') {
      const ba = new Float64Array([a]);
      const bb = new Float64Array([b]);
      const u8a = new Uint8Array(ba.buffer);
      const u8b = new Uint8Array(bb.buffer);
      for (let i = 0; i < 8; i++) if (u8a[i] !== u8b[i]) return { eq: false, where: path, a, b };
      return { eq: true };
    }
    return { eq: false, where: path, a, b };
  }
  if (Array.isArray(a) !== Array.isArray(b)) return { eq: false, where: path, a, b };
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (keysA.length !== keysB.length) return { eq: false, where: path + ' (key count)', a: keysA, b: keysB };
  for (let i = 0; i < keysA.length; i++) {
    if (keysA[i] !== keysB[i]) return { eq: false, where: path + ' (key)', a: keysA, b: keysB };
    const r = deepEqual(a[keysA[i]], b[keysA[i]], `${path}.${keysA[i]}`);
    if (!r.eq) return r;
  }
  return { eq: true };
}

// We strip world.rules before comparing (function refs aren't comparable, and
// they're identical by construction on both sides).
function stripRules(world) {
  const { rules: _, ...rest } = world;
  return rest;
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

const TICKS = 600;          // 10 seconds at dt=1/60
const FORK_AT = 300;

let pass = 0, fail = 0;
function report(name, ok, detail = '') {
  if (ok) {
    console.log(`  PASS  ${name}`);
    pass++;
  } else {
    console.log(`  FAIL  ${name}`);
    if (detail) console.log(`        ${detail}`);
    fail++;
  }
}

console.log(`\nM7 §2.4 — determinism CI`);
console.log(`========================`);

// ---------- Test 1: full-mode replay round-trip ----------
console.log(`\n[1] log mode "full" — ${TICKS} ticks, ${KICKS.length} interventions`);
{
  let live = makeWorld({ mode: 'full' });
  live = runForward(live, TICKS);

  const json = serialize(live.log);
  const reloaded = deserialize(json);
  const replayed = replay(reloaded, rules, step);

  const cmp = deepEqual(stripRules(live), stripRules(replayed));
  report('live ≡ replay (deep-equal)', cmp.eq, cmp.eq ? '' : `at ${cmp.where}: ${JSON.stringify(cmp.a)} vs ${JSON.stringify(cmp.b)}`);

  // sanity: confirm something actually happened
  const pos = live.scene.subjects.ball.translate;
  const moved = pos[0] !== 0 || pos[1] !== 5;
  report('world actually evolved (ball moved)', moved, `final translate = ${JSON.stringify(pos)}`);

  // log size for the record
  console.log(`        log size: ${(json.length / 1024).toFixed(2)} KB (${live.log.ticks.length} ticks recorded)`);
}

// ---------- Test 2: lean-mode replay round-trip ----------
console.log(`\n[2] log mode "lean" — ${TICKS} ticks, patches NOT recorded`);
{
  let live = makeWorld({ mode: 'lean' });
  live = runForward(live, TICKS);

  const json = serialize(live.log);
  const reloaded = deserialize(json);
  const replayed = replay(reloaded, rules, step);

  const cmp = deepEqual(stripRules(live), stripRules(replayed));
  report('live ≡ replay (deep-equal) under lean log', cmp.eq, cmp.eq ? '' : `at ${cmp.where}: ${JSON.stringify(cmp.a)} vs ${JSON.stringify(cmp.b)}`);

  console.log(`        log size: ${(json.length / 1024).toFixed(2)} KB (${live.log.ticks.length} ticks recorded, actions only)`);
}

// ---------- Test 3: fork at tick K ----------
console.log(`\n[3] fork at tick ${FORK_AT}, replay both halves`);
{
  let live = makeWorld({ mode: 'lean' });
  live = runForward(live, TICKS);

  // Fork the original log at FORK_AT; this gives us a log of the first FORK_AT+1 ticks.
  const headLog = fork(live.log, FORK_AT - 1);   // 0..FORK_AT-1 inclusive
  const head = replay(headLog, rules, step);

  report(`head ends at tick ${FORK_AT}`, head.clock.tick === FORK_AT, `got tick ${head.clock.tick}`);

  // Continue from the head, replaying the *remaining* actions from the original.
  // (This is what "branch from here" would do — the UI's fork button.)
  let tail = head;
  for (let i = FORK_AT; i < TICKS; i++) {
    const tickEntry = live.log.ticks[i];
    tail = step(tail, tickEntry.actions);
  }

  const cmp = deepEqual(stripRules(live), stripRules(tail));
  report('fork-then-resume ≡ original full run', cmp.eq, cmp.eq ? '' : `at ${cmp.where}: ${JSON.stringify(cmp.a)} vs ${JSON.stringify(cmp.b)}`);
}

// ---------- Test 4: rng independence across rules ----------
console.log(`\n[4] rng independence — disabling 'kick' doesn't change 'jitter' stream`);
{
  // Baseline: all rules on, but no kicks scheduled (so kick rule fires but produces no patches).
  const noKicks = [];
  function runNoKicks(world) {
    for (let i = 0; i < TICKS; i++) world = step(world, []);
    return world;
  }

  let withKickRule = makeWorld({ mode: 'lean' });
  withKickRule = runNoKicks(withKickRule);

  const noKickRules = rules.filter((r) => r.id !== 'kick');
  let withoutKickRule = {
    ...makeWorld({ mode: 'lean' }),
    rules: noKickRules,
  };
  withoutKickRule = runNoKicks(withoutKickRule);

  const vx1 = withKickRule.params.ball.vel[0];
  const vx2 = withoutKickRule.params.ball.vel[0];

  // jitter's stream is keyed to (seed, 'jitter', tick) — independent of which
  // other rules ran. So vx (jitter's only output) must be bit-identical.
  const eq = deepEqual({ vx: vx1 }, { vx: vx2 });
  report("jitter's accumulated vx unchanged when 'kick' rule removed", eq.eq, eq.eq ? '' : `${vx1} vs ${vx2}`);
}

// ---------- Summary ----------
console.log(`\n========================`);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
