// =============================================================================
// world/rules.js — rule constructor + registry + declaration enforcement
//                  (M7 §1.3, §1.4 — v2.1)
//
// v2.1 additions: rules declare phase + reads + writes. This absorbs the ECS
// lesson from the Claude-Code + Bevy/Godot adjacency review:
//
// - phase orders rules into 5 fixed buckets (input → forces → integrate →
//   constrain → sync). Array order only breaks ties WITHIN a phase. A rule
//   declared in the wrong phase (e.g. a force rule trying to patch position)
//   fails the declaration check at runtime.
//
// - reads declares the rule's input data dependencies (for future change-
//   detection optimization + dataflow visualization).
//
// - writes declares the rule's output paths. The runtime enforces that the
//   rule's apply() ONLY emits patches under those paths — out-of-declaration
//   patches throw immediately. This is "the model must state its intent and
//   the runtime holds it to it" — free self-audit for LLM-emitted rules.
//
// - lintConflicts (called at load time) finds two enabled rules in the same
//   phase whose writes overlap. Same path written by two rules → silent last-
//   write-wins is what makes a 30-rule LLM-emitted ruleset undebuggable. Lint
//   catches it before tick 0.
// =============================================================================

export const PHASES = ['input', 'forces', 'integrate', 'constrain', 'sync'];
const PHASE_SET = new Set(PHASES);

export function makeRule({
  id,
  phase,
  reads = [],
  writes = [],
  enabled = true,
  applies,
  apply,
}) {
  if (typeof id !== 'string' || !id) {
    throw new Error('rule.id must be a non-empty string');
  }
  if (!PHASE_SET.has(phase)) {
    throw new Error(
      `rule "${id}".phase must be one of [${PHASES.join(', ')}], got: ${JSON.stringify(phase)}`,
    );
  }
  if (!Array.isArray(reads) || !Array.isArray(writes)) {
    throw new Error(`rule "${id}": reads/writes must be string[]`);
  }
  if (typeof apply !== 'function') {
    throw new Error(`rule "${id}".apply must be a function`);
  }
  return {
    id,
    phase,
    reads: reads.slice(),
    writes: writes.slice(),
    enabled,
    applies: applies || (() => true),
    apply,
  };
}

// -----------------------------------------------------------------------------
// Path matching — used by both declaration check and conflict lint.
//
// A declaration "params.rocket" covers any path under it ("params.rocket.vel"
// or "params.rocket.vel.1"). A trailing ".*" wildcard means the same thing
// explicitly; we accept both. Exact paths are exact only.
// -----------------------------------------------------------------------------

function normalize(decl) {
  return decl.endsWith('.*') ? decl.slice(0, -2) : decl;
}

function pathUnderDeclaration(path, decl) {
  const prefix = normalize(decl);
  return path === prefix || path.startsWith(prefix + '.');
}

function declarationsOverlap(a, b) {
  const ap = normalize(a);
  const bp = normalize(b);
  if (ap === bp) return true;
  if (ap.startsWith(bp + '.')) return true;
  if (bp.startsWith(ap + '.')) return true;
  return false;
}

// -----------------------------------------------------------------------------
// Runtime declaration check: every patch emitted by a rule must fall under one
// of its declared writes. Throws on violation — this is the LLM self-audit.
// -----------------------------------------------------------------------------

export function assertDeclared(rule, patches) {
  if (!patches || patches.length === 0) return patches;
  const writes = rule.writes || [];
  for (let i = 0; i < patches.length; i++) {
    const path = patches[i].path;
    let covered = false;
    for (let j = 0; j < writes.length; j++) {
      if (pathUnderDeclaration(path, writes[j])) {
        covered = true;
        break;
      }
    }
    if (!covered) {
      throw new Error(
        `rule "${rule.id}" emitted patch on path "${path}" but its writes ` +
          `declaration does not cover it: [${writes.join(', ')}]`,
      );
    }
  }
  return patches;
}

// -----------------------------------------------------------------------------
// Load-time conflict lint: find pairs of enabled rules in the same phase whose
// write declarations overlap. Returns a list of conflict descriptors; empty
// list means safe to load.
// -----------------------------------------------------------------------------

export function lintConflicts(rules) {
  const conflicts = [];
  const enabled = rules.filter((r) => r && r.enabled !== false);
  for (let i = 0; i < enabled.length; i++) {
    for (let j = i + 1; j < enabled.length; j++) {
      const a = enabled[i];
      const b = enabled[j];
      if (a.phase !== b.phase) continue;
      const aw = a.writes || [];
      const bw = b.writes || [];
      for (let p = 0; p < aw.length; p++) {
        for (let q = 0; q < bw.length; q++) {
          if (declarationsOverlap(aw[p], bw[q])) {
            conflicts.push({
              ruleA: a.id,
              ruleB: b.id,
              phase: a.phase,
              pathA: aw[p],
              pathB: bw[q],
            });
          }
        }
      }
    }
  }
  return conflicts;
}

export function assertNoConflicts(rules) {
  const conflicts = lintConflicts(rules);
  if (conflicts.length === 0) return;
  const msg = conflicts
    .map(
      (c) =>
        `  - phase "${c.phase}": rules "${c.ruleA}" and "${c.ruleB}" both write ` +
        `"${c.pathA}" / "${c.pathB}"`,
    )
    .join('\n');
  throw new Error(`Rule conflicts detected at load time:\n${msg}`);
}

// -----------------------------------------------------------------------------
// Registry — thin wrapper around an array, gives UI/debug code a stable handle
// to toggle laws by id. The canonical step() reads world.rules directly.
// -----------------------------------------------------------------------------

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

  // Sugar for the load-time safety check.
  validate() {
    assertNoConflicts(this.rules);
    return this;
  }
}
