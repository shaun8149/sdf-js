// =============================================================================
// world/rng.js — counter-based seeded PRNG (M7 §2.2)
//
// Determinism contract: given (seed, ruleId, tick), makeRng() returns a function
// whose stream is a fixed mathematical function of those three inputs and the
// in-call counter. No closure-over-Date, no closure-over-Math.random.
//
// Why per-(rule, tick) instead of one global stream that advances:
// - A global cursor would couple rules through ordering — Rule B's rng output
//   would depend on how many values Rule A pulled before it, breaking the
//   "rules are independently auditable" property.
// - Per-(rule, tick) streams are independent: enabling/disabling a rule changes
//   only that rule's particles, not the rest of the world.
//
// world.rng.{seed, n}: seed is the master, n is reserved for cross-tick streams
// (e.g. a persistent respawn cursor) — unused in the M7 minimal slice.
// =============================================================================

// 32-bit SplitMix variant. Produces float in [0, 1).
function splitmix32(x) {
  x = (x + 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

// FNV-1a 32-bit. Stable across runs, no Date dependency.
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Per-call stream keyed to (seed, ruleId, tick). Pull as many values as you like
// inside a single rule.apply(); the next tick gets a fresh stream.
export function makeRng(seed, ruleId, tick) {
  const base = (seed ^ hashStr(ruleId) ^ Math.imul(tick + 1, 2654435761)) >>> 0;
  let n = 0;
  return () => splitmix32((base + n++) >>> 0);
}

// Direct positional access — useful for cross-tick streams that need to be
// indexed by some counter held in the world (e.g. spawn ids).
export function rngAt(seed, n) {
  return splitmix32((seed + n) >>> 0);
}

// Convenience: random float in [lo, hi).
export function rngRange(rng, lo, hi) {
  return lo + (hi - lo) * rng();
}

// Convenience: random integer in [lo, hi] inclusive.
export function rngInt(rng, lo, hi) {
  return lo + Math.floor((hi - lo + 1) * rng());
}
