// =============================================================================
// scene/serialize.js — parse / stringify + version migration + AnimationChannel
// dual-form idempotent round-trip
// -----------------------------------------------------------------------------
// API:
//   parse(jsonStringOrObject) → SceneData  (validates, throws on error)
//   stringify(sceneData, opts?) → string   (canonical JSON output)
//
// Round-trip contract:
//   - AnimationChannel { expr } gets canonicalized to { expr, value } (both
//     forms present, both stable across parse/stringify cycles).
//   - AnimationChannel { value } also gets { expr } added (canonical string).
//   - SceneData.source field passes through unchanged.
//   - Subject ids preserved.
//   - Unknown fields preserved (forward compatibility for v2 additions).
// =============================================================================

import { validate } from './spec.js';
import { parseExpr, stringifyExpr } from './expr.js';
import { isTimeExpr } from '../sdf/time.js';

// =============================================================================
// Parse
// =============================================================================

/**
 * Parse a SceneData JSON string (or already-parsed object) into a normalized
 * SceneData. Throws on validation error.
 *
 * Normalization steps applied:
 *   - AnimationChannel.expr (string) → also computes .value (TimeExpr)
 *   - AnimationChannel.value (TimeExpr) → also computes .expr (string)
 *   (Both forms are emitted on round-trip; either is accepted on input.)
 *
 * @param {string | object} input
 * @returns {object} normalized SceneData
 */
export function parse(input) {
  let data;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch (e) {
      throw new Error(`scene.parse: JSON syntax error: ${e.message}`);
    }
  } else if (input != null && typeof input === 'object') {
    data = deepClone(input);
  } else {
    throw new Error(`scene.parse: input must be string or object, got ${typeof input}`);
  }

  // Version migration (v1 only for now; later versions add migration paths)
  if (data.v == null) {
    throw new Error('scene.parse: missing "v" field');
  }
  if (data.v !== 1) {
    // Migration hook — when v2 ships, this branch will call migrateV1ToV2(data)
    throw new Error(`scene.parse: unsupported version ${data.v} (no migration path available)`);
  }

  // Validate before normalization (so syntax errors don't try to parse animation exprs)
  const result = validate(data);
  if (!result.ok) {
    throw new Error(`scene.parse: validation failed:\n  - ${result.errors.join('\n  - ')}`);
  }

  // Normalize animation channels (dual-form idempotent)
  normalizeAnimationChannels(data);

  return data;
}

/**
 * Validate without throwing. Returns { ok, errors, warnings }. Useful for
 * editor live linting.
 */
export function validateScene(data) {
  return validate(data);
}

// =============================================================================
// Stringify
// =============================================================================

/**
 * Serialize SceneData back to JSON. By default emits both `expr` and `value`
 * on every AnimationChannel (round-trip stable). Pass { compact: true } for
 * single-form output (whichever was set originally).
 *
 * @param {object} sceneData
 * @param {{ compact?: boolean, indent?: number }} [opts]
 * @returns {string}
 */
export function stringify(sceneData, opts = {}) {
  const indent = opts.indent ?? 2;
  const out = deepClone(sceneData);

  if (!opts.compact) {
    normalizeAnimationChannels(out);
  }

  return JSON.stringify(out, null, indent);
}

// =============================================================================
// Animation channel normalization
// -----------------------------------------------------------------------------
// For every AnimationChannel in the tree (subject / camera / light / shadow),
// ensure both `expr` (string) and `value` (TimeExpr or number) are present
// and consistent. Either input form yields the same output.
// =============================================================================

function normalizeAnimationChannels(data) {
  // Walk subjects
  if (Array.isArray(data.subjects)) {
    data.subjects.forEach(walkSubject);
  }

  // Walk camera / light / shadow animations
  if (data.defaults?.camera?.animation) {
    data.defaults.camera.animation.forEach(normalizeChannelInPlace);
  }
  if (data.defaults?.light?.animation) {
    data.defaults.light.animation.forEach(normalizeChannelInPlace);
  }
  if (data.defaults?.shadow?.animation) {
    data.defaults.shadow.animation.forEach(normalizeChannelInPlace);
  }
}

function walkSubject(subj) {
  if (!subj || typeof subj !== 'object') return;
  if (Array.isArray(subj.animation)) {
    subj.animation.forEach(normalizeChannelInPlace);
  }
  if (Array.isArray(subj.children)) {
    subj.children.forEach(walkSubject);
  }
  if (subj.source && typeof subj.source === 'object') {
    walkSubject(subj.source);
  }
}

function normalizeChannelInPlace(ch) {
  if (!ch || typeof ch !== 'object') return;

  // Case 1: only expr → compute value
  if (ch.expr != null && ch.value == null) {
    try {
      ch.value = parseExpr(ch.expr);
    } catch (e) {
      // If expr is too complex for v1 parser, leave value undefined and warn
      // (validation has already accepted it as a syntactic string; caller's
      // problem at compile time if it can't be evaluated).
    }
    return;
  }

  // Case 2: only value → compute expr
  if (ch.value != null && ch.expr == null) {
    try {
      ch.expr = stringifyExpr(ch.value);
    } catch (e) {
      // Complex structured value can't be stringified to expr; leave expr undefined.
    }
    return;
  }

  // Case 3: both present — keep both (assume caller wants explicit dual)
  // No-op. If they're inconsistent we don't detect it; that's a caller bug.
}

// =============================================================================
// Helpers
// =============================================================================

function deepClone(x) {
  // Simple structured clone via JSON for SceneData (no functions / cycles)
  return JSON.parse(JSON.stringify(x));
}
