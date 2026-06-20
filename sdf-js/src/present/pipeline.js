// =============================================================================
// pipeline.js — Atlas Present Sprint 1 v4 PDF → 2D code → lift pipeline
// -----------------------------------------------------------------------------
// Orchestrates:
//   1. parsePDFFromBytes(uint8Array) → SlideData[]
//   2. emitSlide2dCode(slideData) → code2d per slide (sync)
//   3. Sequential lift queue: callLiftLLM(prompt, code2d, apiKey) per section
//      → update section.sceneData + section.region via deck-model.updateSectionStatus
//   4. Save deck to storage after each section status change
//
// NO streaming UX (Sprint 1 waits for all lifted before render). Sprint 2+
// adds streaming for 3D Play mode.
//
// Mode-agnostic: this file deals with sections + regions, not 3D-view state.
//
// Spec: docs/superpowers/specs/2026-06-19-atlas-present-sprint-1-v4-design.md §4
// =============================================================================

import * as deckModel from './deck-model.js';
import { computeRegions } from './linear-layout.js';

/**
 * Create a pipeline state machine. Returns handle with start/cancel methods +
 * event emitter for status changes.
 *
 * Pipeline contract:
 *   - deps.parsePDFFromBytes(uint8Array) → Promise<SlideData[]>
 *   - deps.emitSlide2dCode(slideData) → string OR {prompt, code2d}
 *   - deps.callLiftLLM(prompt, code2d, apiKey) → Promise<{text: string, usage: object}>
 *   - deps.parseLiftResponse(text) → object (sceneData)
 *   - deps.saveDeck(deck) → void (called after each status change)
 *
 * Events emitted via opts.onEvent({type, ...details}):
 *   - {type: 'parse-start'}
 *   - {type: 'parse-done', sectionCount: number}
 *   - {type: 'parse-error', error: Error}
 *   - {type: 'lift-start', sectionId: string, pageIndex: number}
 *   - {type: 'lift-ready', sectionId: string, pageIndex: number}
 *   - {type: 'lift-error', sectionId: string, pageIndex: number, error: string}
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
      const emitted = deps.emitSlide2dCode(slideData);
      const code2d = typeof emitted === 'string' ? emitted : (emitted.code2d ?? '');
      const fallbackPrompt = slideData.title || `Page ${slideIndex(slideData) + 1}`;
      return {
        slideData,
        code2d,
        prompt: typeof emitted === 'string' ? fallbackPrompt : (emitted.prompt || fallbackPrompt),
      };
    });

    // 3. Add to deck as pending sections
    deckModel.addPendingSections(deck, sectionInputs);
    deps.saveDeck(deck);

    // 4. Sequential lift queue
    for (const section of deck.sections) {
      if (cancelled) {
        onEvent({ type: 'cancelled' });
        running = false;
        return;
      }
      if (section.status !== 'pending') continue; // skip already-lifted (resume support)

      onEvent({ type: 'lift-start', sectionId: section.id, pageIndex: section.pageIndex });
      deckModel.updateSectionStatus(deck, section.id, 'lifting');
      deps.saveDeck(deck);

      try {
        const llmResult = await deps.callLiftLLM(section.prompt, section.code2d, apiKey);
        if (cancelled) {
          deckModel.updateSectionStatus(deck, section.id, 'pending');
          deps.saveDeck(deck);
          onEvent({ type: 'cancelled' });
          running = false;
          return;
        }
        const sceneData = deps.parseLiftResponse(llmResult.text);
        // Compute region for this section (Linear archetype, derive from sceneData bbox)
        const regions = computeRegions(
          deck.sections.map((s, i) =>
            i === section.pageIndex
              ? { sceneData, title: section.prompt }
              : { sceneData: s.sceneData ?? { v: 1, subjects: [] }, title: s.prompt },
          ),
          deck.layout.spacing,
        );
        const region = regions[section.pageIndex];
        deckModel.updateSectionStatus(deck, section.id, 'ready', { sceneData, region });
        deps.saveDeck(deck);
        onEvent({ type: 'lift-ready', sectionId: section.id, pageIndex: section.pageIndex });
      } catch (e) {
        deckModel.updateSectionStatus(deck, section.id, 'error', { liftError: e.message });
        deps.saveDeck(deck);
        onEvent({
          type: 'lift-error',
          sectionId: section.id,
          pageIndex: section.pageIndex,
          error: e.message,
        });
        // Continue to next section
      }
    }

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

function slideIndex(slideData) {
  if (Number.isFinite(slideData.index)) return slideData.index;
  if (Number.isFinite(slideData.pageIndex)) return slideData.pageIndex;
  return 0;
}
