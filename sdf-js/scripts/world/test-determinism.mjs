// =============================================================================
// test-determinism.mjs — M7 §2.4 determinism CI (v2.1)
//
// v2.1 additions:
//   - Test rules now declare phase + reads + writes
//   - Test 5 verifies load-time conflict lint catches same-phase write overlap
//   - Test 6 verifies declaration check rejects undeclared writes at runtime
//
// Original tests (1-4) still verify the determinism contract: serialize the
// log, cold-replay, assert bit-equal final world. The point of v2.1 is that
// adding phase + declaration discipline must NOT compromise determinism.
// =============================================================================

import { step } from '../../src/world/runtime.js';
import { newLog, serialize, deserialize, replay, fork } from '../../src/world/log.js';
import { makeRule, lintConflicts } from '../../src/world/rules.js';
import { makeRng } from '../../src/world/rng.js';

// -----------------------------------------------------------------------------
// Rules — each declares phase + reads + writes (v2.1 contract)
// -----------------------------------------------------------------------------

const kick = makeRule({
  id: 'kick',
  phase: 'input',
  reads: ['actions', 'params.ball.vel'],
  writes: ['params.ball.vel.1'],
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

const gravity = makeRule({
  id: 'gravity',
  phase: 'forces',
  reads: ['params.ball.vel'],
  writes: ['params.ball.vel.1'],
  apply: (world, _actions, dt) => {
    const vy = world.params.ball.vel[1];
    return { patches: [{ path: 'params.ball.vel.1', value: vy - 9.8 * dt }] };
  },
});

const jitter = makeRule({
  id: 'jitter',
  phase: 'forces',
  reads: ['params.ball.vel', 'rng', 'clock.tick'],
  writes: ['params.ball.vel.0'],
  apply: (world, _actions, dt) => {
    const rng = makeRng(world.rng.seed, 'jitter', world.clock.tick);
    const dx = (rng() - 0.5) * 0.05;
    const vx = world.params.ball.vel[0];
    return { patches: [{ path: 'params.ball.vel.0', value: vx + dx * dt }] };
  },
});

const integrate = makeRule({
  id: 'integrate',
  phase: 'integrate',
  reads: ['params.ball.vel', 'scene.subjects.ball.translate'],
  writes: ['scene.subjects.ball.translate.0', 'scene.subjects.ball.translate.1'],
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

const rules = [kick, gravity, jitter, integrate];

// -----------------------------------------------------------------------------
// World factory
// -----------------------------------------------------------------------------

function makeWorld({ seed = 0xa710a5, mode = 'full' } = {}) {
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
  { tick: 60, type: 'kick', payload: { dv: 4.5 } },
  { tick: 180, type: 'kick', payload: { dv: 3.0 } },
  { tick: 350, type: 'kick', payload: { dv: 7.2 } },
];

function runForward(world, ticks) {
  for (let i = 0; i < ticks; i++) {
    const actionsThisTick = KICKS.filter((a) => a.tick === world.clock.tick).map(
      (a) => ({ ...a, tick: world.clock.tick }),
    );
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
    if (typeof a === 'number') {
      const ba = new Float64Array([a]);
      const bb = new Float64Array([b]);
      const u8a = new Uint8Array(ba.buffer);
      const u8b = new Uint8Array(bb.buffer);
      for (let i = 0; i < 8; i++)
        if (u8a[i] !== u8b[i]) return { eq: false, where: path, a, b };
      return { eq: true };
    }
    return { eq: false, where: path, a, b };
  }
  if (Array.isArray(a) !== Array.isArray(b)) return { eq: false, where: path, a, b };
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (keysA.length !== keysB.length)
    return { eq: false, where: path + ' (key count)', a: keysA, b: keysB };
  for (let i = 0; i < keysA.length; i++) {
    if (keysA[i] !== keysB[i])
      return { eq: false, where: path + ' (key)', a: keysA, b: keysB };
    const r = deepEqual(a[keysA[i]], b[keysA[i]], `${path}.${keysA[i]}`);
    if (!r.eq) return r;
  }
  return { eq: true };
}

function stripRules(world) {
  const { rules: _, ...rest } = world;
  return rest;
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

const TICKS = 600;
const FORK_AT = 300;

let pass = 0,
  fail = 0;
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

console.log(`\nM7 §2.4 — determinism CI (v2.1)`);
console.log(`================================`);

// ---------- Test 1: full-mode replay round-trip ----------
console.log(`\n[1] log mode "full" — ${TICKS} ticks, ${KICKS.length} interventions`);
{
  let live = makeWorld({ mode: 'full' });
  live = runForward(live, TICKS);

  const json = serialize(live.log);
  const reloaded = deserialize(json);
  const replayed = replay(reloaded, rules, step);

  const cmp = deepEqual(stripRules(live), stripRules(replayed));
  report(
    'live ≡ replay (deep-equal)',
    cmp.eq,
    cmp.eq ? '' : `at ${cmp.where}: ${JSON.stringify(cmp.a)} vs ${JSON.stringify(cmp.b)}`,
  );

  const pos = live.scene.subjects.ball.translate;
  const moved = pos[0] !== 0 || pos[1] !== 5;
  report('world actually evolved (ball moved)', moved, `final translate = ${JSON.stringify(pos)}`);

  console.log(
    `        log size: ${(json.length / 1024).toFixed(2)} KB (${live.log.ticks.length} ticks recorded)`,
  );
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
  report(
    'live ≡ replay (deep-equal) under lean log',
    cmp.eq,
    cmp.eq ? '' : `at ${cmp.where}: ${JSON.stringify(cmp.a)} vs ${JSON.stringify(cmp.b)}`,
  );

  console.log(
    `        log size: ${(json.length / 1024).toFixed(2)} KB (${live.log.ticks.length} ticks recorded, actions only)`,
  );
}

// ---------- Test 3: fork at tick K ----------
console.log(`\n[3] fork at tick ${FORK_AT}, replay both halves`);
{
  let live = makeWorld({ mode: 'lean' });
  live = runForward(live, TICKS);

  const headLog = fork(live.log, FORK_AT - 1);
  const head = replay(headLog, rules, step);

  report(
    `head ends at tick ${FORK_AT}`,
    head.clock.tick === FORK_AT,
    `got tick ${head.clock.tick}`,
  );

  let tail = head;
  for (let i = FORK_AT; i < TICKS; i++) {
    const tickEntry = live.log.ticks[i];
    tail = step(tail, tickEntry.actions);
  }

  const cmp = deepEqual(stripRules(live), stripRules(tail));
  report(
    'fork-then-resume ≡ original full run',
    cmp.eq,
    cmp.eq ? '' : `at ${cmp.where}: ${JSON.stringify(cmp.a)} vs ${JSON.stringify(cmp.b)}`,
  );
}

// ---------- Test 4: rng independence across rules ----------
console.log(`\n[4] rng independence — disabling 'kick' doesn't change 'jitter' stream`);
{
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

  const eq = deepEqual({ vx: vx1 }, { vx: vx2 });
  report(
    "jitter's accumulated vx unchanged when 'kick' rule removed",
    eq.eq,
    eq.eq ? '' : `${vx1} vs ${vx2}`,
  );
}

// ---------- Test 5: v2.1 — conflict lint at load time ----------
console.log(`\n[5] conflict lint — two same-phase rules writing same path`);
{
  const r1 = makeRule({
    id: 'r1',
    phase: 'forces',
    reads: [],
    writes: ['params.ball.vel.1'],
    apply: () => ({ patches: [] }),
  });
  const r2 = makeRule({
    id: 'r2',
    phase: 'forces',
    reads: [],
    writes: ['params.ball.vel.1'],
    apply: () => ({ patches: [] }),
  });
  const conflicts = lintConflicts([r1, r2]);
  report(
    'lintConflicts detects same-phase exact-path overlap',
    conflicts.length === 1 &&
      conflicts[0].ruleA === 'r1' &&
      conflicts[0].ruleB === 'r2' &&
      conflicts[0].phase === 'forces',
    `got ${conflicts.length} conflicts: ${JSON.stringify(conflicts)}`,
  );

  // Wildcard / prefix overlap: 'params.ball.*' vs 'params.ball.vel.1' should clash
  const wide = makeRule({
    id: 'wide',
    phase: 'forces',
    reads: [],
    writes: ['params.ball.*'],
    apply: () => ({ patches: [] }),
  });
  const narrow = makeRule({
    id: 'narrow',
    phase: 'forces',
    reads: [],
    writes: ['params.ball.vel.1'],
    apply: () => ({ patches: [] }),
  });
  const c2 = lintConflicts([wide, narrow]);
  report(
    'lintConflicts detects wildcard-prefix overlap',
    c2.length === 1 && c2[0].ruleA === 'wide' && c2[0].ruleB === 'narrow',
    `got ${c2.length} conflicts: ${JSON.stringify(c2)}`,
  );

  // Different phases must NOT conflict (kick=input, gravity=forces both write vel.1)
  const c3 = lintConflicts([kick, gravity]);
  report(
    "different phases don't conflict (kick:input vs gravity:forces)",
    c3.length === 0,
    `got ${c3.length} conflicts: ${JSON.stringify(c3)}`,
  );

  // Production ruleset must lint clean
  const prod = lintConflicts(rules);
  report(
    'production ruleset lints clean',
    prod.length === 0,
    `got ${prod.length} conflicts: ${JSON.stringify(prod)}`,
  );
}

// ---------- Test 6: v2.1 — declaration check rejects undeclared writes ----------
console.log(`\n[6] declaration check — runtime rejects patches outside declared writes`);
{
  const cheater = makeRule({
    id: 'cheater',
    phase: 'forces',
    reads: [],
    writes: ['params.foo'],
    apply: () => ({
      patches: [{ path: 'params.bar.baz', value: 1 }], // not under "params.foo"
    }),
  });
  const w = makeWorld({ mode: 'lean' });
  w.rules = [cheater];

  let caught = null;
  try {
    step(w, []);
  } catch (e) {
    caught = e;
  }
  report(
    'undeclared patch path throws at runtime',
    caught != null && caught.message.includes('cheater') && caught.message.includes('params.bar.baz'),
    caught ? `error: ${caught.message}` : 'no error thrown',
  );

  // Honest rule (writes under declaration) does NOT throw
  const honest = makeRule({
    id: 'honest',
    phase: 'forces',
    reads: [],
    writes: ['params.foo'],
    apply: () => ({
      patches: [{ path: 'params.foo.x', value: 1 }], // under "params.foo"
    }),
  });
  const w2 = makeWorld({ mode: 'lean' });
  w2.rules = [honest];

  let ok = true;
  try {
    step(w2, []);
  } catch (_e) {
    ok = false;
  }
  report('declared patch path passes', ok);
}

// ---------- Summary ----------
console.log(`\n================================`);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
