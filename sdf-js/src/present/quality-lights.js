// =============================================================================
// quality-lights.js — Sprint 67: per-slide quality assessment for the BROWSER.
//
// The standing five-axis eval runs offline over baked decks; this module
// brings its two zero-LLM axes to author-2d so every generated page carries
// a quality light BEFORE it is exported or handed to the 3D end:
//   • visual audit  (scripts/visual-audit.mjs — instrumented ctx, catches
//     TEXT_OVERFLOW / SUBJECT_OVERLAP / OUT_OF_BOUNDS / TINY_FONT / …)
//   • number grounding (src/present/eval-core.js — the SAME functions the
//     offline scorer runs: literal grounding + Rule 24 derived citations)
//
// Verdict per slide:
//   'ok'   — no visual issues, no ungrounded numbers
//   'warn' — visual warnings only, or numbers ungrounded but derived-cited
//            elsewhere ambiguous (never blocks export)
//   'bad'  — visual errors (overflow/overlap/crash) or hallucinated numbers
//
// Pure functions, no DOM here — the app renders the badge.
// =============================================================================

import { auditSlotVisual } from '../../scripts/visual-audit.mjs';
import {
  deckNumberTokens,
  extractKeyNumbers,
  valueSetOf,
  extractDeckPayloadNumbers,
  extractDeckTextLeaves,
  verifiedDerivedTokens,
  numberGrounded,
} from './eval-core.js';

/**
 * buildSourceGrounding(texts) — precompute the source token sets once per
 * deck. `texts` is anything the user actually provided: the prompt/article
 * text, and (for full decks) the expanded outline slides.
 */
export function buildSourceGrounding(texts) {
  const srcText = (texts || [])
    .filter(Boolean)
    .map((t) =>
      typeof t === 'string' ? t : [t.title, ...(t.body || [])].filter(Boolean).join(' '),
    )
    .join(' ');
  if (!srcText.trim()) return null;
  const tokens = new Set([...deckNumberTokens(srcText), ...extractKeyNumbers(srcText)]);
  return { tokens, values: valueSetOf(tokens) };
}

/**
 * assessSlot(slot, { palette, grounding }) → {
 *   level: 'ok'|'warn'|'bad', visual: issues[], hallucinated: string[],
 *   derivedCited: number, summary: string }
 */
export async function assessSlot(slot, { palette, grounding = null } = {}) {
  const visual = await auditSlotVisual(slot.sceneData, { palette });
  const visualErrors = visual.filter((i) =>
    [
      'RENDER_CRASH',
      'TEXT_OVERFLOW',
      'SUBJECT_OVERLAP',
      'OUT_OF_BOUNDS',
      'TEXT_COLLISION',
    ].includes(i.kind),
  );

  let hallucinated = [];
  let derivedCited = 0;
  if (grounding) {
    const one = [{ sceneData: slot.sceneData }];
    const nums = extractDeckPayloadNumbers(one);
    const cited = verifiedDerivedTokens(
      extractDeckTextLeaves(one),
      grounding.tokens,
      grounding.values,
    );
    derivedCited = [...cited].filter((t) => nums.includes(t)).length;
    hallucinated = nums.filter(
      (n) => !numberGrounded(n, grounding.tokens, grounding.values) && !cited.has(n),
    );
  }

  const level = visualErrors.length || hallucinated.length ? 'bad' : visual.length ? 'warn' : 'ok';
  const bits = [];
  if (visual.length) bits.push(`视觉 ${visual.map((i) => i.kind).join(', ')}`);
  if (hallucinated.length) bits.push(`未接地数字 ${hallucinated.slice(0, 4).join(' ')}`);
  if (derivedCited) bits.push(`衍生已引用 ×${derivedCited}`);
  return {
    level,
    visual,
    hallucinated,
    derivedCited,
    summary: bits.join(' · ') || '视觉与数字检查全过',
  };
}

/**
 * assessDeck(deck, { sourceTexts }) → { bySlot: Map(slot→assessment), counts }
 * sourceTexts: array of strings/outline slides for grounding (optional —
 * without it only the visual axis runs).
 */
export async function assessDeck(deck, { sourceTexts = null } = {}) {
  const grounding = buildSourceGrounding(sourceTexts);
  const bySlot = new Map();
  const counts = { ok: 0, warn: 0, bad: 0 };
  for (const slot of deck.slots || []) {
    const a = await assessSlot(slot, { palette: deck.theme, grounding });
    bySlot.set(slot, a);
    counts[a.level]++;
  }
  return { bySlot, counts, grounded: !!grounding };
}
