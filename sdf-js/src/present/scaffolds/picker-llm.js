// =============================================================================
// scaffolds/picker-llm.js — LLM-wrapped scaffold picker (v2)
// -----------------------------------------------------------------------------
// Sprint 16 v2 — wraps `pickScaffold()` (deterministic v1) with a Claude call
// that sees the 10 scaffold menu + the deck text and picks the best fit.
//
// Why v2: v1 scores by keyword overlap, which falls back to company-overview
// on fuzzy inputs (e.g. PD sphere-fill deck has no business keywords so all
// scaffolds tie at 0). v2 lets Claude reason about deck intent vs scaffold
// purpose at a semantic level.
//
// Returns same shape as pickScaffold() + a `method` field for telemetry:
//   { scaffold, theme, score, signals, fallback, method: 'llm'|'v1'|'fallback' }
//
// On any error (network / parse / unknown id) the picker falls back to v1
// silently — pipelines that ship v2 should still complete on API outages.
// =============================================================================

import { SCAFFOLDS, getScaffold, getThemeAffinity } from './registry.js';
import { pickScaffold as pickScaffoldV1 } from './picker.js';

/**
 * @typedef {object} PickerLLMResult
 * @property {import('./registry.js').Scaffold} scaffold
 * @property {import('../themes.js').ThemePreset} theme
 * @property {number} score — Claude's confidence (0-10)
 * @property {string[]} signals — Claude's reasoning bullets
 * @property {boolean} fallback — true if we fell back to v1 deterministic
 * @property {'llm'|'v1'|'fallback'} method
 * @property {string} [rawReasoning] — full LLM reasoning (debug)
 */

const PICKER_MODEL = 'claude-sonnet-4-5-20250929';

/**
 * LLM-wrapped scaffold picker. See file header for design notes.
 *
 * @param {object} input
 * @param {string} [input.title]
 * @param {string[]} [input.bodyTexts]
 * @param {string} [input.audienceHint]
 * @param {object} opts
 * @param {string} opts.apiKey — Anthropic API key (REQUIRED)
 * @param {string} [opts.model] — override Claude model
 * @param {boolean} [opts.fallbackToV1=true] — silently fall back on error
 * @param {(...args: any[]) => void} [opts.log] — optional logger
 * @returns {Promise<PickerLLMResult>}
 */
export async function pickScaffoldLLM(input, opts = {}) {
  const { apiKey, model = PICKER_MODEL, fallbackToV1 = true, log = () => {} } = opts;

  if (!apiKey) {
    if (!fallbackToV1) throw new Error('pickScaffoldLLM: apiKey required');
    log('[picker-llm] no apiKey → fallback to v1');
    return _fallback(input, 'no-api-key');
  }

  const menu = SCAFFOLDS.map(
    (s) =>
      `- **${s.id}** — ${s.label}: ${s.description}\n` +
      `  Audience: ${s.audience}\n` +
      `  Slots (${s.slots.length}): ${s.slots.map((sl) => sl.name).join(' → ')}\n` +
      `  Keywords: ${s.keywords.slice(0, 6).join(', ')}`,
  ).join('\n\n');

  const title = input.title || '(untitled deck)';
  const body = (input.bodyTexts || []).slice(0, 40).join('\n');
  const audienceHint = input.audienceHint || '';

  const systemPrompt = `You are a scaffold picker for Atlas Present. Atlas decks are built from "scaffolds" — slot-sequence templates (e.g. a VC pitch deck has slots for problem, market-size, solution, traction, team, ask).

Given a deck's title + body text, you pick the SINGLE best-fit scaffold from a fixed menu. You may not invent new scaffolds.

OUTPUT: respond with ONLY a JSON object:
{
  "scaffoldId": "<exact id from the menu>",
  "confidence": <0-10 integer; 0=guess, 10=perfect fit>,
  "reasoning": ["<bullet 1>", "<bullet 2>", "<bullet 3>"],
  "themeHint": "<theme id from scaffold's theme_affinity[]>" (optional, omit if unsure)
}

Pick on SEMANTIC intent, not just keyword surface.

TWO HARD RULES (Sprint 24 — empty slots are the #1 quality drag):
1. **Escape hatch**: if the best specialized scaffold would score confidence ≤ 4, pick \`generic-deck\` instead (a flexible any-topic scaffold). A well-filled generic deck beats a force-fit specialized one — force-fits leave slots empty because the source has no matching content.
2. **Slot-count fit**: prefer scaffolds whose slot count is close to the source slide count. A 7-slide source fills an 8-slot scaffold well; it leaves a 10-slot scaffold 30% empty.`;

  const userMessage = `## Available scaffolds (${SCAFFOLDS.length} total)

${menu}

## Deck to classify

**Title**: ${title}

**Body (first 40 paragraphs)**:
${body || '(empty)'}

${audienceHint ? `**Audience hint**: ${audienceHint}\n\n` : ''}## Your pick

Return JSON only. No prose outside the object.`;

  try {
    const t0 = Date.now();
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 800,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
    if (!res.ok) {
      const errText = (await res.text()).slice(0, 200);
      log(`[picker-llm] HTTP ${res.status}: ${errText} → fallback`);
      return _fallback(input, `http-${res.status}`);
    }
    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    log(`[picker-llm] ${elapsed}s — usage: ${JSON.stringify(data.usage)}`);

    // Parse JSON object from response
    const parsed = _parseLLMResponse(text);
    if (!parsed) {
      log('[picker-llm] parse failed → fallback');
      return _fallback(input, 'parse-failed');
    }

    const scaffold = getScaffold(parsed.scaffoldId);
    if (!scaffold) {
      log(`[picker-llm] unknown scaffoldId '${parsed.scaffoldId}' → fallback`);
      return _fallback(input, 'unknown-id');
    }

    // Resolve theme
    const themes = getThemeAffinity(scaffold);
    let theme = themes[0];
    if (parsed.themeHint) {
      const hinted = themes.find((t) => t.id === parsed.themeHint);
      if (hinted) theme = hinted;
    }

    return {
      scaffold,
      theme,
      score: Number(parsed.confidence) || 0,
      signals: Array.isArray(parsed.reasoning) ? parsed.reasoning.slice(0, 5) : [],
      fallback: false,
      method: 'llm',
      rawReasoning: text,
    };
  } catch (e) {
    log(`[picker-llm] threw '${e.message}' → fallback`);
    return _fallback(input, e.message);
  }
}

/**
 * Extract a JSON object from an LLM response (handles ```json fences,
 * leading/trailing prose).
 *
 * @param {string} text
 * @returns {object|null}
 */
function _parseLLMResponse(text) {
  // Try fenced block first
  const m = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  let s = m ? m[1] : text.trim();
  if (!m) {
    const i = s.indexOf('{');
    const j = s.lastIndexOf('}');
    if (i >= 0 && j > i) s = s.slice(i, j + 1);
  }
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/**
 * Internal: fall back to v1 deterministic picker. Annotates method='fallback'
 * with the fallback reason in signals[].
 *
 * @param {object} input
 * @param {string} reason
 * @returns {PickerLLMResult}
 */
function _fallback(input, reason) {
  const v1 = pickScaffoldV1(input);
  return {
    scaffold: v1.scaffold,
    theme: v1.theme,
    score: v1.score,
    signals: [`v1-fallback-reason:${reason}`, ...v1.signals],
    fallback: true,
    method: 'fallback',
  };
}
