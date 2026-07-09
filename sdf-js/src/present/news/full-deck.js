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
import { buildLiftSystemPrompt, liftSlotsPool, liftSlotLLM } from '../scaffolds/lift-slot-llm.js';

// The lift system prompt is deterministic (atom+icon catalogs) — build once
// per browser session so per-slide re-rolls (Sprint 38) skip the rebuild and
// hit the Anthropic prompt cache from the original generation.
let systemPromptCache = null;
async function getSystemPrompt() {
  if (!systemPromptCache) systemPromptCache = await buildLiftSystemPrompt();
  return systemPromptCache;
}

/**
 * newsToFullDeck(text, opts) → exporter-ready deck
 *   {title, theme, scaffold, slots: [{slotIdx, slotName, slotTitle, sceneData}], errors}
 *
 * @param {string} text — the raw article (~500 chars)
 * @param {object} opts — { apiKey, minPages=10, maxPages=20, onProgress(msg, pct) }
 */
export async function newsToFullDeck(
  text,
  { apiKey, minPages = 10, maxPages = 20, onProgress = () => {}, lockedSlots = [] } = {},
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
  const systemPrompt = await getSystemPrompt();

  // Parallel lift (Sprint 34): warmup + bounded pool via liftSlotsPool —
  // 14 serial calls (~95s) become 1 warmup + 13 over 5 workers (~30-40s).
  // Locked slots (Sprint 40: user pinned these pages) are never re-lifted —
  // their lift calls are skipped entirely and the pinned slot objects are
  // merged back below.
  const lockedIdx = new Set(lockedSlots.map((s) => s.slotIdx));
  const live = assignments.filter((a) => !a.empty && !lockedIdx.has(a.slotIdx));
  let done = 0;
  const poolResults = await liftSlotsPool(
    live.map((a) => ({
      scaffold,
      slot: a.slot,
      slotIdx: a.slotIdx,
      slideIdx: a.slideIdx,
      theme,
      slide: slides[a.slideIdx],
      slides,
      extraSlides: a.extraSlides || [],
    })),
    {
      apiKey,
      systemPrompt,
      onSlotDone: () => {
        done++;
        onProgress(`lifted ${done}/${live.length} slots…`, 15 + (done / live.length) * 80);
      },
    },
  );
  const slots = [];
  const errors = [];
  for (let i = 0; i < live.length; i++) {
    const a = live[i];
    const r = poolResults[i];
    if (r && !r.error) {
      slots.push({
        slotIdx: a.slotIdx,
        slotName: a.slot.name,
        slotTitle: a.slot.title,
        sceneData: r.sceneData,
        // Kept for per-slide re-roll / revision (Sprint 38): re-lifting a
        // slot is just liftSlotLLM with these params again.
        liftParams: {
          scaffold,
          slot: a.slot,
          slotIdx: a.slotIdx,
          slideIdx: a.slideIdx,
          theme,
          slide: slides[a.slideIdx],
          slides,
          extraSlides: a.extraSlides || [],
        },
      });
    } else {
      errors.push({ slot: a.slot.name, message: r?.error || 'unknown' });
    }
  }

  onProgress('done', 100);
  return {
    title: slides[0]?.title || 'News Deck',
    theme,
    scaffold: { id: scaffold.id, label: scaffold.label },
    slots: mergeLockedSlots(slots, lockedSlots),
    errors,
  };
}

/**
 * mergeLockedSlots — splice pinned slot objects into a freshly generated
 * slot list, in slotIdx order (Sprint 40). A locked slot ALWAYS survives:
 * if the new run delivered a slide for the same slotIdx it is replaced by
 * the pinned one; if the new run dropped that slotIdx the pinned slide is
 * inserted anyway — the user chose to keep this page.
 */
export function mergeLockedSlots(newSlots, lockedSlots) {
  if (!lockedSlots?.length) return newSlots;
  const lockedIdx = new Set(lockedSlots.map((s) => s.slotIdx));
  const merged = newSlots.filter((s) => !lockedIdx.has(s.slotIdx));
  for (const locked of lockedSlots) merged.push({ ...locked, locked: true });
  merged.sort((a, b) => a.slotIdx - b.slotIdx);
  return merged;
}

/**
 * reliftSlot — Sprint 38 per-slide ⚡: re-run ONE slot's lift, optionally
 * with a presenter revision request ("换成柱状图"). Mutates deck.slots[i]
 * in place (sceneData swap) and returns the new sceneData, so exports and
 * re-renders pick it up with no further bookkeeping.
 *
 * @param {object} deck — a newsToFullDeck result
 * @param {number} slotIdx — the slot's slotIdx (not array index)
 * @param {object} opts — { apiKey, revision?, liftFn? (test injection) }
 */
export async function reliftSlot(
  deck,
  slotIdx,
  { apiKey, revision = null, liftFn = liftSlotLLM } = {},
) {
  const slot = deck.slots.find((s) => s.slotIdx === slotIdx);
  if (!slot) throw new Error(`reliftSlot: no slot with slotIdx ${slotIdx}`);
  if (slot.locked) throw new Error(`reliftSlot: slot ${slotIdx} is locked`);
  if (!slot.liftParams)
    throw new Error(
      'reliftSlot: slot has no liftParams (quick-mode decks cannot re-roll per slide)',
    );
  const systemPrompt = await getSystemPrompt();
  if (slot.locked) throw new Error(`reliftSlot: slot ${slotIdx} is locked`);
  const { sceneData } = await liftFn({ ...slot.liftParams, revision }, { apiKey, systemPrompt });
  if (slot.locked) throw new Error(`reliftSlot: slot ${slotIdx} is locked`);
  slot.sceneData = sceneData;
  return sceneData;
}
