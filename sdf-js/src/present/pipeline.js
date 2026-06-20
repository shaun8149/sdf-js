// =============================================================================
// pipeline.js — Atlas Present Sprint 2 visual generation pipeline
// -----------------------------------------------------------------------------
// Per-selection (not per-section) 6-lift queue. Called when user clicks ⚡
// on a text selection. Each visual gets VARIANT_COUNT (6) independent lift
// calls in serial. Identical prompts; divergence relies on LLM stochasticity
// at default Anthropic temperature.
//
// Lift contract opts.mode = '2d' enforced (per spec Decision 11 + Phase 4).
// Runtime sanitize2dSceneData applied to each lift output before persistence.
//
// Events emitted via opts.onEvent({type, ...}):
//   - {type: 'lift-start', visualId, variantIndex}
//   - {type: 'lift-ready', visualId, variantIndex, archetype}
//   - {type: 'lift-error', visualId, variantIndex, error}
//   - {type: 'all-done', visualId}
//   - {type: 'cancelled', visualId}
//
// Spec: docs/superpowers/specs/2026-06-20-atlas-present-sprint-2-napkin-paragraph-design.md §6
// =============================================================================

import { updateVisualVariantStatus, VARIANT_COUNT } from './deck-model.js';

const VALID_ARCHETYPES = [
  'sequence',
  'list',
  'compare',
  'hierarchy',
  'relation',
  'kpi-hero',
  'text-card',
];

/**
 * Sprint 3 constraint: if a SceneData contains any p5-sketch subject, then
 * ALL subjects must be p5-sketch (mixed-subjects not yet supported).
 * Additionally, args.code must be a non-empty string.
 *
 * Throws Error with message describing the violation.
 *
 * @param {object} sceneData
 */
function validateP5SketchConstraint(sceneData) {
  if (!sceneData || !Array.isArray(sceneData.subjects)) return;
  const subjects = sceneData.subjects;
  const p5Subjects = subjects.filter((s) => s?.type === 'p5-sketch');
  if (p5Subjects.length === 0) return; // No p5-sketch, no constraint to check
  if (p5Subjects.length !== subjects.length) {
    throw new Error(
      'p5-sketch must be the single subject in SceneData (Sprint 3 constraint: no mixed subjects with traditional types)',
    );
  }
  for (const s of p5Subjects) {
    if (typeof s.args?.code !== 'string' || s.args.code.length === 0) {
      throw new Error('p5-sketch subject requires args.code as non-empty string');
    }
  }
}

/**
 * Extract archetype label from sceneData.name prefix ("<archetype>: <title>").
 * Falls back to 'unknown' if missing/malformed/unrecognized.
 *
 * @param {object} sceneData
 * @returns {string}
 */
export function extractArchetype(sceneData) {
  const name = sceneData?.name;
  if (typeof name !== 'string') return 'unknown';
  const colonIdx = name.indexOf(':');
  if (colonIdx === -1) return 'unknown';
  const candidate = name.slice(0, colonIdx).trim().toLowerCase();
  return VALID_ARCHETYPES.includes(candidate) ? candidate : 'unknown';
}

/**
 * Create a visual-pipeline state machine. Returns handle with start/cancel.
 *
 * Pipeline contract:
 *   deps.callLiftLLM(prompt, code2d, apiKey, opts) → {text, usage}
 *   deps.parseLiftResponse(text) → object (sceneData)
 *   deps.sanitize2dSceneData(sceneData) → sanitized sceneData
 *   deps.saveDeck(deck) → void (called after each status change)
 *
 * @param {object} deck
 * @param {string} visualId — visual must already exist in deck.visuals
 * @param {string} apiKey
 * @param {object} deps
 * @param {object} [opts]
 * @param {Function} [opts.onEvent]
 * @returns {{start: Function, cancel: Function, isRunning: Function}}
 */
export function createVisualPipeline(deck, visualId, apiKey, deps, opts = {}) {
  let cancelled = false;
  let running = false;
  const onEvent = opts.onEvent ?? (() => {});

  async function start() {
    if (running) return;
    running = true;

    const visual = deck.visuals.find((v) => v.id === visualId);
    if (!visual) {
      onEvent({ type: 'lift-error', visualId, variantIndex: -1, error: 'visual not found' });
      running = false;
      return;
    }

    // Compose the lift prompt from the textAnchor
    const liftPrompt = visual.textAnchor.text;
    // 2D pipeline doesn't have a separate 2D-code intermediate. Pass the
    // textAnchor.text as code2d arg so the LLM has the raw user-selected text
    // for context. The lift system prompt + MODE_2D_ADDENDUM is generic enough.
    const code2d = `// User selected text:\n// ${visual.textAnchor.text.replace(/\n/g, '\n// ')}`;

    for (let variantIndex = 0; variantIndex < visual.variants.length; variantIndex++) {
      if (cancelled) {
        onEvent({ type: 'cancelled', visualId });
        running = false;
        return;
      }
      const variant = visual.variants[variantIndex];
      if (variant.status !== 'pending') continue; // skip already-done variant

      onEvent({ type: 'lift-start', visualId, variantIndex });
      updateVisualVariantStatus(deck, visualId, variantIndex, 'lifting');
      deps.saveDeck(deck);

      try {
        const llmResult = await deps.callLiftLLM(liftPrompt, code2d, apiKey, { mode: '2d' });
        if (cancelled) {
          onEvent({ type: 'cancelled', visualId });
          running = false;
          return;
        }
        const rawSceneData = deps.parseLiftResponse(llmResult.text);
        // Sprint 3: validate p5-sketch constraint (no mixed subjects)
        validateP5SketchConstraint(rawSceneData); // throws on violation
        const sceneData = deps.sanitize2dSceneData(rawSceneData);
        const archetype = extractArchetype(sceneData);

        updateVisualVariantStatus(deck, visualId, variantIndex, 'ready', { sceneData, archetype });
        deps.saveDeck(deck);
        onEvent({ type: 'lift-ready', visualId, variantIndex, archetype });
      } catch (e) {
        updateVisualVariantStatus(deck, visualId, variantIndex, 'error', { liftError: e.message });
        deps.saveDeck(deck);
        onEvent({ type: 'lift-error', visualId, variantIndex, error: e.message });
        // Continue to next variant (don't abort on single variant error)
      }
    }

    if (!cancelled) {
      onEvent({ type: 'all-done', visualId });
    }
    running = false;
  }

  function cancel() {
    cancelled = true;
  }
  function isRunning() {
    return running;
  }

  return { start, cancel, isRunning };
}

export { VARIANT_COUNT };
