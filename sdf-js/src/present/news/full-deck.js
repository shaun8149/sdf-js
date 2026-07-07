// =============================================================================
// full-deck.js — Sprint 32: browser-side "article → 10-20 page deck"
// orchestrator. Composes the SAME modules the CLI bake uses — expand-core
// (Stage -1), mapper-llm (Stage 1), lift-slot-llm (Stage 2) — plus the
// orphan-rescue (Sprint 25) and page-floor (Sprint 30) passes, so author-2d
// produces the same decks as `node scripts/news-to-deck.mjs`. Do NOT fork
// pipeline logic here; extend the shared modules.
//
// ~16 LLM calls per run (1 expand + 1 map + ~14 lifts), ≈$0.5, ~90s.
// =============================================================================
import { expandNews } from './expand-core.js';
import { getScaffold, getThemeAffinity } from '../scaffolds/registry.js';
import { mapSlidesToSlotsLLM, scoreSlideForSlot } from '../scaffolds/mapper-llm.js';
import { buildLiftSystemPrompt, liftSlotLLM } from '../scaffolds/lift-slot-llm.js';

/**
 * newsToFullDeck(text, opts) → exporter-ready deck
 *   {title, theme, scaffold, slots: [{slotIdx, slotName, slotTitle, sceneData}], errors}
 *
 * @param {string} text — the raw article (~500 chars)
 * @param {object} opts — { apiKey, minPages=10, maxPages=20, onProgress(msg, pct) }
 */
export async function newsToFullDeck(
  text,
  { apiKey, minPages = 10, maxPages = 20, onProgress = () => {} } = {},
) {
  if (!apiKey) throw new Error('newsToFullDeck: apiKey required');

  onProgress('expanding article → outline…', 2);
  const slides = await expandNews(text, { apiKey, min: Math.max(12, minPages + 2), max: maxPages });

  const scaffold = getScaffold('news-briefing');
  const theme = getThemeAffinity(scaffold)[0];

  onProgress(`mapping ${slides.length} outline slides → ${scaffold.slots.length} slots…`, 8);
  const { assignments: raw } = await mapSlidesToSlotsLLM(
    { slides, scaffold },
    { apiKey, fallbackToHeuristic: true },
  );
  const assignments = raw.map((a) => ({
    ...a,
    slot: scaffold.slots[a.slotIdx],
    empty: !(typeof a.slideIdx === 'number' && a.slideIdx >= 0),
  }));

  // Orphan rescue (Sprint 25): every unmapped outline slide's facts land in
  // the best-scoring filled slot as extra material.
  const mapped = new Set(assignments.filter((a) => !a.empty).map((a) => a.slideIdx));
  const filled = assignments.filter((a) => !a.empty && a.slot.name !== 'cover');
  slides.forEach((slide, idx) => {
    if (mapped.has(idx) || filled.length === 0) return;
    let best = null;
    let bestScore = -1;
    for (const a of filled) {
      const s = scoreSlideForSlot(slide, a.slot);
      if (s > bestScore) {
        bestScore = s;
        best = a;
      }
    }
    if (best) (best.extraSlides = best.extraSlides || []).push(idx);
  });

  // Page floor (Sprint 30): promote extraSlides out of loaded slots into
  // empty slots until minPages delivered or no donor remains.
  const delivered = () => assignments.filter((a) => !a.empty).length;
  for (const empty of assignments.filter((a) => a.empty)) {
    if (delivered() >= minPages) break;
    let donor = null;
    for (const a of assignments) {
      if (
        !a.empty &&
        Array.isArray(a.extraSlides) &&
        a.extraSlides.length > 0 &&
        (!donor || a.extraSlides.length > donor.extraSlides.length)
      )
        donor = a;
    }
    if (!donor) break;
    empty.empty = false;
    empty.slideIdx = donor.extraSlides.pop();
  }

  onProgress('building lift prompt…', 12);
  const systemPrompt = await buildLiftSystemPrompt();

  const live = assignments.filter((a) => !a.empty);
  const slots = [];
  const errors = [];
  for (let i = 0; i < live.length; i++) {
    const a = live[i];
    onProgress(`lifting ${i + 1}/${live.length} (${a.slot.name})…`, 15 + (i / live.length) * 80);
    try {
      const { sceneData } = await liftSlotLLM(
        {
          scaffold,
          slot: a.slot,
          slotIdx: a.slotIdx,
          slideIdx: a.slideIdx,
          theme,
          slide: slides[a.slideIdx],
          slides,
          extraSlides: a.extraSlides || [],
        },
        { apiKey, systemPrompt },
      );
      slots.push({
        slotIdx: a.slotIdx,
        slotName: a.slot.name,
        slotTitle: a.slot.title,
        sceneData,
      });
    } catch (e) {
      errors.push({ slot: a.slot.name, message: e.message });
    }
  }

  onProgress('done', 100);
  return {
    title: slides[0]?.title || 'News Deck',
    theme,
    scaffold: { id: scaffold.id, label: scaffold.label },
    slots,
    errors,
  };
}
