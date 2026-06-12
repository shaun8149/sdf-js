// =============================================================================
// world/runtime.js — step() + accumulator loop (M7 §1.4 — v2.1)
//
// step(world, actions) is the fold-over-phases-then-rules. In v2.1 phases are
// fixed: input → forces → integrate → constrain → sync. Within a phase, rules
// execute in array order; cross-phase, the order is always the phase order.
// This is the loop contract made explicit — the part game engines (Bevy, Unity,
// Unreal) got right.
//
// Each rule's apply() returns an Effect ({ patches, particles }):
//   - patches accumulate; assertDeclared enforces that emitted paths are
//     within the rule's declared writes set
//   - particles thread through in-tick (rules in later phases see the previous
//     rules' particle output)
//
// After the fold:
//   - applyPatches commits patches structurally onto the world
//   - clock advances by exactly dt (fixed 1/60, never read from wall clock)
//   - the tick is appended to world.log
// =============================================================================

import { applyPatches } from './patch.js';
import { appendTick } from './log.js';
import { PHASES, assertDeclared } from './rules.js';

export function step(world, actions = []) {
  let particles = world.particles;
  const patches = [];

  const rules = world.rules || [];

  for (let p = 0; p < PHASES.length; p++) {
    const phase = PHASES[p];
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (!rule || rule.enabled === false) continue;
      if (rule.phase !== phase) continue;
      if (rule.applies && !rule.applies(world)) continue;

      // Rules see particles threaded through prior rules in the same tick.
      const view = particles === world.particles ? world : { ...world, particles };
      const fx = rule.apply(view, actions, world.clock.dt);

      if (!fx) continue;
      if (fx.patches && fx.patches.length) {
        const checked = assertDeclared(rule, fx.patches);
        for (let k = 0; k < checked.length; k++) patches.push(checked[k]);
      }
      if (fx.particles) particles = fx.particles;
    }
  }

  let next = applyPatches(world, patches);
  if (particles !== world.particles) next.particles = particles;
  next.clock = advanceClock(world.clock);
  next.log = appendTick(world.log, {
    tick: next.clock.tick,
    actions,
    patches,
  });
  return next;
}

function advanceClock(clock) {
  return {
    t: clock.t + clock.dt,
    dt: clock.dt,
    tick: clock.tick + 1,
  };
}

// -----------------------------------------------------------------------------
// Browser tick loop. Fixed-dt accumulator pattern — render rate floats free of
// simulation rate so dropped frames don't change physics, and refocus-after-
// background doesn't time-warp the world.
// -----------------------------------------------------------------------------

export function makeLoop({
  getWorld,
  setWorld,
  drainActions,
  render,
  dt = 1 / 60,
  maxStep = 0.25, // cap the catch-up window after tab refocus
} = {}) {
  let lastT = 0;
  let acc = 0;
  let raf = null;
  let running = false;

  function frame(now) {
    const elapsed = (now - lastT) / 1000;
    lastT = now;
    acc += Math.min(elapsed, maxStep);

    while (acc >= dt) {
      const actions = drainActions ? drainActions() : [];
      setWorld(step(getWorld(), actions));
      acc -= dt;
    }
    if (render) render(getWorld());

    if (running) raf = requestAnimationFrame(frame);
  }

  return {
    start() {
      if (running) return;
      running = true;
      lastT = typeof performance !== 'undefined' ? performance.now() : Date.now();
      acc = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    },
    isRunning() {
      return running;
    },
  };
}

// -----------------------------------------------------------------------------
// FIFO action queue for UI → runtime handoff. Drained once per simulation tick
// inside makeLoop.
// -----------------------------------------------------------------------------

export function makeActionQueue() {
  let queue = [];
  return {
    push(action) {
      queue.push(action);
    },
    drain() {
      const out = queue;
      queue = [];
      return out;
    },
    peek() {
      return queue.slice();
    },
  };
}
