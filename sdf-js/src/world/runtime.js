// =============================================================================
// world/runtime.js — step() + accumulator loop (M7 §1.3)
//
// step(world, actions) is the fold-over-rules. Each enabled rule's apply()
// returns an Effect ({ patches, particles }); patches accumulate, particles
// thread through. After the fold:
//   - applyPatches commits patches structurally onto the world
//   - clock advances by exactly dt (which is fixed at 1/60 throughout — never
//     read from the wall clock inside a rule)
//   - the tick is appended to world.log
//
// The runtime is pure: same (world, actions) → same next world. That is what
// makes the determinism CI (§2.4) possible.
// =============================================================================

import { applyPatches } from './patch.js';
import { appendTick } from './log.js';

export function step(world, actions = []) {
  let particles = world.particles;
  const patches = [];

  const rules = world.rules || [];
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (!rule || rule.enabled === false) continue;
    if (rule.applies && !rule.applies(world)) continue;

    // Rules see particles threaded through prior rules in the same tick.
    const view = particles === world.particles ? world : { ...world, particles };
    const fx = rule.apply(view, actions, world.clock.dt);

    if (!fx) continue;
    if (fx.patches && fx.patches.length) {
      for (let k = 0; k < fx.patches.length; k++) patches.push(fx.patches[k]);
    }
    if (fx.particles) particles = fx.particles;
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
