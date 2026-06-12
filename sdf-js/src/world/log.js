// =============================================================================
// world/log.js — TickLog: savegame / replay / fork (M7 §4)
//
// A TickLog stores the world's initial snapshot + every tick's actions (and in
// "full" mode, the patches each rule emitted). Replay re-executes step() from
// the snapshot. Fork truncates the tail at tick k.
//
// "full" mode → readable per-tick diff, for low-cardinality worlds (rocket).
// "lean" mode → actions only, for particle worlds where the determinism contract
//               makes trajectories derivable from (seed + rules + actions).
//
// IMPORTANT: rules are NOT in the snapshot — they're code, not data. The caller
// is responsible for supplying the same rules array (in the same order, with the
// same `enabled` config) at replay time. The log stores what *happened*; rules
// describe the *laws*. Mixing the two would break the LLM-rules-are-code claim.
// =============================================================================

// Strip non-serializable + non-state fields (rules, log) and JSON-clone the rest.
// This is the snapshot taken at tick 0 to seed replay.
function snapshotState(world) {
  const { rules, log, ...rest } = world;
  // structuredClone would preserve typed arrays but isn't available in older
  // Node; for the M7 minimal slice we have no typed arrays in the test world,
  // so JSON-clone is fine. Particle blocks will need a typed-array-aware clone
  // path when A1 lands.
  return JSON.parse(JSON.stringify(rest));
}

export function newLog({ seed, initial, mode = 'full' }) {
  return {
    v: 2,
    mode,
    seed,
    initial: snapshotState(initial),
    ticks: [],
  };
}

export function appendTick(log, { tick, actions, patches }) {
  const entry = log.mode === 'full'
    ? { tick, actions, patches }
    : { tick, actions };
  return { ...log, ticks: [...log.ticks, entry] };
}

// Take a log and a rules array; return the final world by re-executing every
// tick. `stepFn` is injected to avoid an import cycle between log.js and
// runtime.js.
export function replay(log, rules, stepFn) {
  const initialState = JSON.parse(JSON.stringify(log.initial));
  let world = {
    ...initialState,
    rules,
    log: newLog({ seed: log.seed, initial: initialState, mode: log.mode }),
  };
  for (let i = 0; i < log.ticks.length; i++) {
    world = stepFn(world, log.ticks[i].actions);
  }
  return world;
}

// Truncate at tick k (inclusive). Returns a new log; original is untouched.
export function fork(log, kTick) {
  const cutoff = Math.max(0, Math.min(kTick + 1, log.ticks.length));
  return {
    ...log,
    ticks: log.ticks.slice(0, cutoff),
  };
}

export function serialize(log) {
  return JSON.stringify(log);
}

export function deserialize(json) {
  const parsed = typeof json === 'string' ? JSON.parse(json) : json;
  if (parsed.v !== 2) {
    throw new Error(`Unsupported log version: ${parsed.v} (expected 2)`);
  }
  return parsed;
}
