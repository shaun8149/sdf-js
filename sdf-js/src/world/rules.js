// =============================================================================
// world/rules.js — rule constructor + registry (M7 §1.3)
//
// A Rule is { id, enabled, applies, apply }. `apply(world, actions, dt)` must
// be pure: same inputs → same Effect ({ patches, particles }).
//
// LLM-emitted rule modules (rocket.rules.js, flow.rules.js, ...) export an
// array of Rule objects from this file. The sandbox + lint pass (M7 §3) is
// staged for a later slice — this file is the data structure today.
// =============================================================================

export function makeRule({ id, enabled = true, applies, apply }) {
  if (typeof id !== 'string' || !id) {
    throw new Error('rule.id must be a non-empty string');
  }
  if (typeof apply !== 'function') {
    throw new Error(`rule "${id}".apply must be a function`);
  }
  return {
    id,
    enabled,
    applies: applies || (() => true),
    apply,
  };
}

// Thin wrapper around an array — gives UI / debug code a stable handle to
// toggle laws by id. The world owns `rules` directly; the registry is a helper
// for code that mutates the live world (the canonical step() reads world.rules
// straight, not the registry).
export class RuleRegistry {
  constructor(rules = []) {
    this.rules = rules.slice();
  }

  add(rule) {
    this.rules.push(rule);
    return this;
  }

  get(id) {
    return this.rules.find((r) => r.id === id);
  }

  setEnabled(id, enabled) {
    const r = this.get(id);
    if (r) r.enabled = !!enabled;
    return this;
  }

  list() {
    return this.rules.slice();
  }

  ids() {
    return this.rules.map((r) => r.id);
  }
}
