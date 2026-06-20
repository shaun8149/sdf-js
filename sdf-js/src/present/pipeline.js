// =============================================================================
// pipeline.js — Atlas Present Sprint 1.5 v4 PDF → 2D code → lift pipeline
// -----------------------------------------------------------------------------
// Orchestrates:
//   1. parsePDFFromBytes(uint8Array) → SlideData[]
//   2. emitSlide2dCode(slideData) → code2d per slide (sync)
//   3. Sequential lift queue: for each section, run VARIANT_COUNT (3) lifts
//      serially. All 3 calls use the IDENTICAL prompt — divergence comes from
//      Anthropic default temperature (~1.0) + the archetype-first system
//      prompt v3.18 (LLM picks one of 7 archetypes per call, stochasticity
//      produces 2-3 different archetypes across 3 calls for most slides).
//   4. extractArchetype(sceneData) parses sceneData.name prefix
//      ("<archetype>: <title>") into variant.archetype.
//   5. Save deck to storage after each variant status change.
//
// NO streaming UX (Sprint 1 waits for all lifted before render). Sprint 2+
// adds streaming for 3D Play mode.
//
// Mode-agnostic: this file deals with sections + variants + regions, not
// 3D-view state.
//
// Spec: docs/superpowers/specs/2026-06-19-atlas-present-sprint-1-v4-design.md §4
// =============================================================================

import { VARIANT_COUNT, addPendingSections, updateVariantStatus } from './deck-model.js';

// -----------------------------------------------------------------------------
// Inlined region computation (was linear-layout.js, deleted in Sprint 2).
// Sprint 2 document viewer no longer uses regions for layout, but pipeline
// still attaches a region to each variant for backwards-compat with the
// SceneData shape consumed downstream. Kept minimal — no auto-fit/view logic.
// -----------------------------------------------------------------------------

const DEFAULT_SPACING = 6;

function computeBoundingBox(sceneData) {
  const subjects = sceneData?.subjects ?? [];
  if (subjects.length === 0) {
    return {
      centerX: 0,
      centerY: 0,
      centerZ: 0,
      halfWidth: 0.5,
      halfHeight: 0.5,
      halfDepth: 0.5,
    };
  }
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (const s of subjects) {
    const t = s.transform?.translate ?? [0, 0, 0];
    if (t[0] < minX) minX = t[0];
    if (t[1] < minY) minY = t[1];
    if (t[2] < minZ) minZ = t[2];
    if (t[0] > maxX) maxX = t[0];
    if (t[1] > maxY) maxY = t[1];
    if (t[2] > maxZ) maxZ = t[2];
  }
  return {
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    centerZ: (minZ + maxZ) / 2,
    halfWidth: Math.max(0.5, (maxX - minX) / 2),
    halfHeight: Math.max(0.5, (maxY - minY) / 2),
    halfDepth: Math.max(0.5, (maxZ - minZ) / 2),
  };
}

function computeRegions(sections, spacing = DEFAULT_SPACING) {
  return sections.map((section, i) => {
    const bbox = computeBoundingBox(section.sceneData);
    return {
      centerX: i * spacing,
      centerY: bbox.centerY,
      centerZ: bbox.centerZ,
      halfWidth: bbox.halfWidth,
      halfHeight: bbox.halfHeight,
      halfDepth: bbox.halfDepth,
      title: section.title || `Page ${i + 1}`,
    };
  });
}

/** Archetypes recognized by extractArchetype (matches system-prompt-lift-3d.md v3.18). */
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
 * Extract archetype label from sceneData.name (format: "<archetype>: <title>").
 * Falls back to 'unknown' if name is missing, not a string, lacks a colon,
 * or carries an unrecognized archetype.
 *
 * Matches the 7 archetypes locked in system-prompt-lift-3d.md v3.18.
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
 * Create a pipeline state machine. Returns handle with start/cancel methods +
 * event emitter for status changes.
 *
 * Pipeline contract:
 *   - deps.parsePDFFromBytes(uint8Array) → Promise<SlideData[]>
 *   - deps.emitSlide2dCode(slideData) → string (code2d)
 *   - deps.callLiftLLM(prompt, code2d, apiKey) → Promise<{text: string, usage: object}>
 *   - deps.parseLiftResponse(text) → object (sceneData)
 *   - deps.saveDeck(deck) → void (called after each status change)
 *
 * Events emitted via opts.onEvent({type, ...details}):
 *   - {type: 'parse-start'}
 *   - {type: 'parse-done', sectionCount: number}
 *   - {type: 'parse-error', error: Error}
 *   - {type: 'lift-start', sectionId: string, pageIndex: number, variantIndex: number}
 *   - {type: 'lift-ready', sectionId: string, pageIndex: number, variantIndex: number, archetype: string}
 *   - {type: 'lift-error', sectionId: string, pageIndex: number, variantIndex: number, error: string}
 *   - {type: 'all-done'}
 *   - {type: 'cancelled'}
 *
 * @param {Deck} deck — must have source + sections (will be mutated by pipeline)
 * @param {Uint8Array} pdfBytes
 * @param {string} apiKey — Anthropic API key
 * @param {object} deps — dependency injection (for testability)
 * @param {object} opts
 * @param {Function} opts.onEvent
 * @returns {{start: Function, cancel: Function, isRunning: Function}}
 */
export function createPipeline(deck, pdfBytes, apiKey, deps, opts = {}) {
  let cancelled = false;
  let running = false;
  const onEvent = opts.onEvent ?? (() => {});

  async function start() {
    if (running) return;
    running = true;

    // 1. Parse PDF
    onEvent({ type: 'parse-start' });
    let slides;
    try {
      slides = await deps.parsePDFFromBytes(pdfBytes, deck.source.fileName);
    } catch (e) {
      onEvent({ type: 'parse-error', error: e });
      running = false;
      return;
    }
    if (cancelled) {
      onEvent({ type: 'cancelled' });
      running = false;
      return;
    }
    onEvent({ type: 'parse-done', sectionCount: slides.length });

    // 2. Emit 2D code per slide
    const sectionInputs = slides.map((slideData) => {
      const code2d = deps.emitSlide2dCode(slideData);
      return {
        slideData,
        code2d: typeof code2d === 'string' ? code2d : (code2d.code2d ?? ''),
        prompt: slideData.title || `Page ${slideData.pageIndex + 1}`,
      };
    });

    // 3. Add to deck as pending sections (each gets VARIANT_COUNT=3 pending variants)
    addPendingSections(deck, sectionInputs);
    deps.saveDeck(deck);

    // 4. Sequential lift queue — outer: sections, inner: variants
    for (const section of deck.sections) {
      if (cancelled) {
        onEvent({ type: 'cancelled' });
        running = false;
        return;
      }
      // Skip whole section if all variants already terminal (resume support)
      if (section.variants.every((v) => v.status === 'ready' || v.status === 'error')) continue;

      for (let variantIndex = 0; variantIndex < section.variants.length; variantIndex++) {
        if (cancelled) {
          onEvent({ type: 'cancelled' });
          running = false;
          return;
        }
        const variant = section.variants[variantIndex];
        if (variant.status !== 'pending') continue;

        onEvent({
          type: 'lift-start',
          sectionId: section.id,
          pageIndex: section.pageIndex,
          variantIndex,
        });
        updateVariantStatus(deck, section.id, variantIndex, 'lifting');
        deps.saveDeck(deck);

        try {
          // v2: identical prompt across all 3 variants. Divergence comes from
          // Anthropic default temperature (~1.0) + archetype-first system prompt
          // v3.18 — LLM picks one of 7 archetypes per call, stochasticity
          // produces 2-3 different archetypes across 3 calls.
          const llmResult = await deps.callLiftLLM(section.prompt, section.code2d, apiKey);
          if (cancelled) {
            onEvent({ type: 'cancelled' });
            running = false;
            return;
          }
          const sceneData = deps.parseLiftResponse(llmResult.text);
          const archetype = extractArchetype(sceneData);

          // Compute region for this variant using the *selected* variant's
          // sceneData for already-ready siblings (keeps linear-layout stable
          // when later variants land first).
          const regions = computeRegions(
            deck.sections.map((s, i) => {
              if (i === section.pageIndex) {
                return { sceneData, title: section.prompt };
              }
              const sel = s.variants[s.selectedVariantIndex];
              return {
                sceneData: sel?.sceneData ?? { v: 1, subjects: [] },
                title: s.prompt,
              };
            }),
            deck.layout.spacing,
          );
          const region = regions[section.pageIndex];

          updateVariantStatus(deck, section.id, variantIndex, 'ready', {
            sceneData,
            region,
            archetype,
          });
          deps.saveDeck(deck);
          onEvent({
            type: 'lift-ready',
            sectionId: section.id,
            pageIndex: section.pageIndex,
            variantIndex,
            archetype,
          });
        } catch (e) {
          updateVariantStatus(deck, section.id, variantIndex, 'error', { liftError: e.message });
          deps.saveDeck(deck);
          onEvent({
            type: 'lift-error',
            sectionId: section.id,
            pageIndex: section.pageIndex,
            variantIndex,
            error: e.message,
          });
          // Continue to next variant (don't abort whole section on 1 variant error)
        }
      } // end variants loop
    } // end sections loop

    if (!cancelled) {
      onEvent({ type: 'all-done' });
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

// VARIANT_COUNT re-exported for convenience (callers can use it for UI labels).
export { VARIANT_COUNT };
