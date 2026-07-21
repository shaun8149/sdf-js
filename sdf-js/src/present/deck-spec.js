// =============================================================================
// deck-spec.js — Sprint 66: THE atlas-deck contract validator.
//
// deck.json is the machine contract between the two ends (two-ends lock:
// the 2D end produces and renders it, the 3D end eats it). Until now the
// contract lived implicitly in three code paths; this module is the single
// executable source of truth. It is deliberately DEPENDENCY-FREE (no
// renderer, no canvas, no registry imports) so the 3D end — or any consumer
// — can run it as-is in node or browser.
//
// Contract doc: docs/atlas-deck-contract.md (field-by-field, plus the map of
// the three deck dialects). Golden fixtures: sdf-js/examples/deck-handoff/.
//
// Verdicts: ERRORS make a deck unconsumable (reject it); WARNINGS mean a
// consumer can proceed but should log (e.g. unknown atom type — renderers
// no-op unknowns by design, decks stay playable across versions).
// =============================================================================

export const DECK_FORMAT = 'atlas-deck';
export const DECK_FORMAT_VERSION = 1;

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string';
const isInt = (v) => Number.isInteger(v);
const isRgb = (v) =>
  Array.isArray(v) && v.length === 3 && v.every((c) => Number.isFinite(c) && c >= 0 && c <= 255);

/**
 * validateDeck(data, opts) → { ok, errors: string[], warnings: string[] }
 *
 * @param {object|string} data — parsed atlas-deck JSON (or a JSON string)
 * @param {object} [opts]
 * @param {Set<string>} [opts.knownAtomTypes] — when provided, atom types not
 *   in the set are reported as warnings (pass the consumer's own registry;
 *   the validator itself stays registry-free)
 */
export function validateDeck(data, { knownAtomTypes = null } = {}) {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);

  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (e) {
      return { ok: false, errors: [`not JSON: ${e.message}`], warnings };
    }
  }
  if (!isObj(data)) return { ok: false, errors: ['root must be an object'], warnings };

  // ── envelope ──
  if (data.format !== DECK_FORMAT)
    err(`format must be "${DECK_FORMAT}" (got ${JSON.stringify(data.format)})`);
  if (!isInt(data.version)) err('version must be an integer');
  else if (data.version > DECK_FORMAT_VERSION)
    err(`version ${data.version} is newer than this validator (reads ≤ ${DECK_FORMAT_VERSION})`);
  if (data.title != null && !isStr(data.title)) err('title must be a string when present');

  // ── theme: id string or a palette object carrying at least bg+accent ──
  const t = data.theme;
  if (t == null) warn('theme missing — consumers will fall back to their default palette');
  else if (!isStr(t)) {
    if (!isObj(t)) err('theme must be a string id or an object');
    else {
      if (!isStr(t.id)) warn('theme.id missing');
      if (t.bg != null && !isRgb(t.bg)) err('theme.bg must be [r,g,b] 0-255');
      if (t.accent != null && !isRgb(t.accent)) err('theme.accent must be [r,g,b] 0-255');
    }
  }

  // ── scaffold (optional descriptor) ──
  if (data.scaffold != null) {
    if (!isObj(data.scaffold)) err('scaffold must be an object');
    else if (!isStr(data.scaffold.id)) err('scaffold.id must be a string');
  }

  // ── decor (optional artifact — the 2D style layer; 3D consumers may
  // ignore it entirely, but if present it must be well-formed so a 2D
  // re-open reproduces the exact artifact) ──
  const d = data.decor;
  if (d != null) {
    if (!isObj(d)) err('decor must be an object');
    else {
      if (!isStr(d.family)) err('decor.family must be a string');
      if (d.seed != null && !isInt(d.seed)) err('decor.seed must be an integer');
      if (d.hash != null && !isStr(String(d.hash))) err('decor.hash must be stringable');
      if (d.v != null && !isInt(d.v)) err('decor.v must be an integer');
      if (d.serial != null && !isInt(d.serial)) err('decor.serial must be an integer');
    }
  }

  // ── artMount (optional provenance — Sprint 97 批量产品化): the deck was
  // dressed in an authentic generative artwork. 3D consumers can re-voice
  // from the prebaked palette / re-load the piece by id; images themselves
  // never enter the contract. ──
  const am = data.artMount;
  if (am != null) {
    if (!isObj(am)) err('artMount must be an object when present');
    else {
      if (!isStr(am.id)) err('artMount.id must be a string');
      if (am.name != null && !isStr(am.name)) err('artMount.name must be a string when present');
      if (am.license != null && !isStr(am.license))
        err('artMount.license must be a string when present');
      if (am.palette != null) {
        if (!isObj(am.palette)) err('artMount.palette must be an object when present');
        else if (am.palette.accent != null && !isRgb(am.palette.accent))
          err('artMount.palette.accent must be [r,g,b] 0-255');
      }
    }
  }

  // ── shared block (hoisted liftParams state; see deck-io.js) ──
  if (data.shared != null && !isObj(data.shared)) err('shared must be an object when present');

  // ── slots ──
  if (!Array.isArray(data.slots)) {
    err('slots must be an array');
    return { ok: errors.length === 0, errors, warnings };
  }
  if (data.slots.length === 0) warn('deck has zero slots');
  const seenIdx = new Set();
  data.slots.forEach((s, i) => {
    const at = `slots[${i}]`;
    if (!isObj(s)) return err(`${at} must be an object`);
    if (s.slotIdx != null) {
      if (!isInt(s.slotIdx)) err(`${at}.slotIdx must be an integer`);
      else if (seenIdx.has(s.slotIdx)) warn(`${at}.slotIdx ${s.slotIdx} duplicated`);
      seenIdx.add(s.slotIdx);
    }
    if (s.slotName != null && !isStr(s.slotName)) err(`${at}.slotName must be a string`);
    if (s.slotTitle != null && !isStr(s.slotTitle)) err(`${at}.slotTitle must be a string`);
    // sceneData is the payload — a slot without one is unrenderable
    if (!isObj(s.sceneData)) return err(`${at}.sceneData must be an object`);
    const subjects = s.sceneData.subjects ?? s.sceneData.atoms;
    if (!Array.isArray(subjects))
      return err(`${at}.sceneData.subjects (or .atoms) must be an array`);
    subjects.forEach((a, j) => {
      const aat = `${at}.sceneData.subjects[${j}]`;
      if (!isObj(a)) return err(`${aat} must be an object`);
      if (!isStr(a.type)) return err(`${aat}.type must be a string`);
      if (knownAtomTypes && !knownAtomTypes.has(a.type))
        warn(`${aat}.type "${a.type}" not in consumer registry (renderers no-op unknowns)`);
      for (const k of ['x', 'y', 'w', 'h']) {
        if (a[k] != null && !Number.isFinite(a[k])) err(`${aat}.${k} must be a number`);
      }
      if (a.args != null && !isObj(a.args)) err(`${aat}.args must be an object`);
    });
  });

  return { ok: errors.length === 0, errors, warnings };
}
