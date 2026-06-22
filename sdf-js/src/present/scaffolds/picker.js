// =============================================================================
// scaffolds/picker.js — Deterministic scaffold picker (v1, no LLM)
// -----------------------------------------------------------------------------
// Sprint 15E v1: simple keyword + content-shape scoring. Given input text
// (titles + body), return ranked scaffolds with scores. A v2 LLM-wrapped
// picker can land later — this v1 is the deterministic fallback (and the
// guidance the v2 prompt builds on top of).
//
// Scoring:
//   - Keyword match (substring on lowercase) — each hit = 3
//   - Title match (any of scaffold.label or scaffold.id parts in title) = 5
//   - Slot-count fit (#paragraphs vs scaffold.slots.length, prefer ±2) = 2
// =============================================================================

import { SCAFFOLDS, getScaffold, getThemeAffinity } from './registry.js';

/**
 * Score a scaffold against input text content.
 *
 * @param {object} input
 * @param {string} [input.title] — deck title or first-paragraph heading
 * @param {string[]} [input.bodyTexts] — paragraph texts (one per slide-source)
 * @param {string} [input.audienceHint] — optional explicit audience hint
 * @returns {{id: string, label: string, score: number, signals: string[]}[]} ranked
 */
export function rankScaffolds(input) {
  const title = (input.title || '').toLowerCase();
  const bodyJoined = (input.bodyTexts || []).join(' ').toLowerCase();
  const sourceCount = (input.bodyTexts || []).length;
  const audienceHint = (input.audienceHint || '').toLowerCase();

  const ranked = SCAFFOLDS.map((s) => {
    const signals = [];
    let score = 0;

    // Title direct match
    const labelParts = s.label.toLowerCase().split(/\s+/);
    if (labelParts.some((p) => p.length > 3 && title.includes(p))) {
      score += 5;
      signals.push(`title-match:${s.label}`);
    }

    // Keyword match in title+body
    for (const kw of s.keywords) {
      if (title.includes(kw) || bodyJoined.includes(kw)) {
        score += 3;
        signals.push(`keyword:${kw}`);
      }
    }

    // Slot-count fit: distance penalty
    if (sourceCount > 0) {
      const diff = Math.abs(s.slots.length - sourceCount);
      if (diff <= 2) {
        score += 2;
        signals.push(`slot-fit:±${diff}`);
      } else if (diff <= 5) {
        score += 1;
      }
    }

    // Audience hint match
    if (audienceHint && s.audience.toLowerCase().includes(audienceHint)) {
      score += 4;
      signals.push(`audience:${audienceHint}`);
    }

    return { id: s.id, label: s.label, score, signals };
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

/**
 * Convenience: pick the top scaffold for given input. Returns the scaffold
 * object + recommended theme + matched signals. Falls back to 'company-overview'
 * if no scaffold scored > 0 (a benign default).
 *
 * @param {object} input — see rankScaffolds
 * @returns {{scaffold: import('./registry.js').Scaffold, theme: import('../themes.js').ThemePreset, score: number, signals: string[], fallback: boolean}}
 */
export function pickScaffold(input) {
  const ranked = rankScaffolds(input);
  const top = ranked[0];
  const fallback = !top || top.score === 0;
  const chosenId = fallback ? 'company-overview' : top.id;
  const scaffold = getScaffold(chosenId);
  const themes = getThemeAffinity(scaffold);
  return {
    scaffold,
    theme: themes[0],
    score: top ? top.score : 0,
    signals: top ? top.signals : [],
    fallback,
  };
}

/**
 * Distribute N source paragraphs across scaffold slots. Deterministic v1:
 * - Always assigns first source to first slot (cover).
 * - Then maps remaining proportionally by index ratio.
 * If sourceCount < slotCount, leaves trailing slots unassigned (returns null
 * for those).
 *
 * @param {import('./registry.js').Scaffold} scaffold
 * @param {Array<{title?: string, body?: string[]}>} sources
 * @returns {Array<{slot: import('./registry.js').ScaffoldSlot, source: object|null, slotIndex: number}>}
 */
export function distributeSources(scaffold, sources) {
  if (!scaffold || !Array.isArray(sources)) return [];
  const slots = scaffold.slots;
  const result = [];
  const N = sources.length;
  const S = slots.length;

  for (let i = 0; i < S; i++) {
    let src = null;
    if (N === 0) {
      src = null;
    } else if (N >= S) {
      // More sources than slots — pick proportional index
      const idx = Math.min(N - 1, Math.round((i / (S - 1 || 1)) * (N - 1)));
      src = sources[idx] || null;
    } else {
      // Fewer sources than slots — assign by ratio, leave gaps
      const expectedIdx = Math.round((i / (S - 1 || 1)) * (N - 1));
      src = sources[expectedIdx] || null;
    }
    result.push({ slot: slots[i], source: src, slotIndex: i });
  }
  return result;
}
