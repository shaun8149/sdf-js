// =============================================================================
// scaffolds/mapper-llm.js — LLM-wrapped slide↔slot mapper (Stage 1)
// -----------------------------------------------------------------------------
// Sprint 18 Tier 2 B — replaces the heuristic slide↔slot matcher with a Claude
// judge call that sees the full source slide list + scaffold slot menu and
// assigns the best-fit slide to each slot at a semantic level.
//
// Why LLM: heuristic scoring relies on keyword overlap between slot purpose
// and slide body text. This fails when the source language diverges from the
// slot vocabulary (e.g. "ANTFUN — On-Chain Trading Super App" doesn't match
// the "cover" keyword, but Claude knows it's a cover).
//
// Returns assignments in SAME ORDER as scaffold.slots (length === slots.length).
// For empty slots: slideIdx: -1 + sourceTitle: null + reason: 'no source…'.
//
// On any error (network / parse / validation) the mapper falls back to the
// built-in heuristic silently — pipelines that ship LLM mode still complete
// on API outages.
// =============================================================================

const MAPPER_MODEL = 'claude-sonnet-4-5-20250929';

/**
 * Score a single slide against a single slot using keyword overlap.
 * Exported so that the fallback inside this module and the bake script can
 * share the exact same logic without cross-importing from a script file.
 *
 * @param {{ title?: string, body?: (string|{text:string})[], bodyTexts?: string[] }} slide
 * @param {{ purpose: string, title: string }} slot
 * @returns {number}
 */
export function scoreSlideForSlot(slide, slot) {
  // Accept both bake-script shape (body[]) and scaffold-view shape (bodyTexts[])
  const bodyParts = slide.body
    ? slide.body.map((b) => (typeof b === 'string' ? b : b.text || ''))
    : slide.bodyTexts || [];
  const slideText = (String(slide.title || '') + ' ' + bodyParts.join(' ')).toLowerCase();
  const slotKeywords = (slot.purpose + ' ' + slot.title)
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length >= 4); // skip short words
  let score = 0;
  for (const kw of slotKeywords) {
    if (slideText.includes(kw)) score += 1;
  }
  return score;
}

/**
 * Map source slides to scaffold slots via LLM judge.
 *
 * @param {object} input
 * @param {{title?: string, body?: (string|{text:string})[], bodyTexts?: string[]}[]} input.slides
 * @param {{slots: {name: string, title: string, purpose: string}[]}} input.scaffold
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {string} [opts.model]
 * @param {boolean} [opts.fallbackToHeuristic=true]
 * @param {((...args: any[]) => void)} [opts.log]
 * @returns {Promise<{
 *   assignments: {slotIdx: number, slotName: string, slideIdx: number, sourceTitle: string|null, confidence: number, reason: string}[],
 *   method: 'llm'|'heuristic-fallback',
 *   fallbackReason?: string,
 *   cost: {usdEstimate: number, tokens: object}
 * }>}
 */
export async function mapSlidesToSlotsLLM(input, opts = {}) {
  const { apiKey, model = MAPPER_MODEL, fallbackToHeuristic = true, log = () => {} } = opts;

  if (!apiKey) {
    if (!fallbackToHeuristic) throw new Error('mapSlidesToSlotsLLM: apiKey required');
    log('[mapper-llm] no apiKey → fallback to heuristic');
    return _fallback(input, 'no-api-key');
  }

  const { slides, scaffold } = input;
  const slots = scaffold.slots;

  // Build slot menu (0-indexed, one line per slot)
  const slotMenu = slots.map((s, i) => `${i}. ${s.name} — ${s.title} — ${s.purpose}`).join('\n');

  // Build slide list (0-indexed, title + first ~120 chars of body)
  const slideList = slides
    .map((s, i) => {
      const bodyParts = s.body
        ? s.body.map((b) => (typeof b === 'string' ? b : b.text || ''))
        : s.bodyTexts || [];
      const bodySnippet = bodyParts.join(' / ').slice(0, 120);
      return `[${i}] Title: "${s.title || '(untitled)'}" — Body: "${bodySnippet}"`;
    })
    .join('\n');

  const systemPrompt =
    `You are a slot-mapping judge. Given source slides and scaffold slots, ` +
    `return a JSON array of optimal slot→slide assignments. Each slot gets at ` +
    `most ONE slide (no splits, no merges in this v1). If no source slide fits ` +
    `a slot well, return slideIdx: -1 for that slot.`;

  const userMessage =
    `## Scaffold (${slots.length} slots in order)\n` +
    slotMenu +
    `\n\n## Source slides (${slides.length} total)\n` +
    slideList +
    `\n\n## Output\n\nReturn JSON:\n` +
    `{\n` +
    `  "assignments": [\n` +
    `    {"slotIdx": 0, "slideIdx": 0, "confidence": 10, "reason": "Title slide → cover"},\n` +
    `    {"slotIdx": 1, "slideIdx": 1, "confidence": 9, "reason": "..."},\n` +
    `    ...\n` +
    `  ]\n` +
    `}\n\n` +
    `Rules:\n` +
    `- Return exactly ${slots.length} entries in assignments[], one per slot, in slot order\n` +
    `- Each entry MUST have slotIdx equal to its position (0, 1, 2, ...)\n` +
    `- A slide may fill up to TWO slots — but ONLY when its content genuinely covers both slot purposes (e.g. a "Wins & Challenges" slide feeding both the wins slot and the challenges slot; the per-slot lift extracts the relevant half for each). Never stretch a slide across two slots just to avoid -1.\n` +
    `- COVERAGE FIRST: never double-map a slide while another content slide goes unmapped — every source slide's content should land somewhere before any slide is used twice. (An orphaned slide's facts are lost from the deck entirely.)\n` +
    `- slideIdx is 0..${slides.length - 1} or -1 for empty (no matching slide)\n` +
    `- Prefer assignment over -1 unless no slide fits (e.g. scaffold has ${slots.length} slots but only ${slides.length} source slides cover them)\n` +
    `- confidence 0-10: how well does this slide match this slot's purpose\n` +
    `- reason: ≤ 12 words explaining the match (or why -1)\n` +
    `Return JSON only. No prose outside the object.`;

  try {
    const t0 = Date.now();
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
    if (!res.ok) {
      const errText = (await res.text()).slice(0, 200);
      log(`[mapper-llm] HTTP ${res.status}: ${errText} → fallback`);
      return _fallback(input, `http-${res.status}`);
    }
    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const usage = data.usage || {};
    log(`[mapper-llm] ${elapsed}s — usage: ${JSON.stringify(usage)}`);

    // Parse JSON object from response
    const parsed = _parseLLMResponse(text);
    if (!parsed || !Array.isArray(parsed.assignments)) {
      log('[mapper-llm] parse failed → fallback');
      return _fallback(input, 'parse-failed');
    }

    // Validate: must have exactly slots.length entries
    if (parsed.assignments.length !== slots.length) {
      log(
        `[mapper-llm] length mismatch: expected ${slots.length} got ${parsed.assignments.length} → fallback`,
      );
      return _fallback(input, 'validation-length-mismatch');
    }

    // Validate: slotIdx must match position
    for (let i = 0; i < parsed.assignments.length; i++) {
      if (parsed.assignments[i].slotIdx !== i) {
        log(`[mapper-llm] slotIdx mismatch at position ${i} → fallback`);
        return _fallback(input, 'validation-slotIdx-mismatch');
      }
    }

    // Cost estimate (Sonnet 4.5 pricing: $3/$15 per M in/out, cache $3.75/$0.30)
    const inCost = ((usage.input_tokens || 0) * 3) / 1_000_000;
    const cacheCreateCost = ((usage.cache_creation_input_tokens || 0) * 3.75) / 1_000_000;
    const cacheReadCost = ((usage.cache_read_input_tokens || 0) * 0.3) / 1_000_000;
    const outCost = ((usage.output_tokens || 0) * 15) / 1_000_000;
    const usdEstimate = inCost + cacheCreateCost + cacheReadCost + outCost;

    // Shape final assignments
    const assignments = parsed.assignments.map((a) => ({
      slotIdx: a.slotIdx,
      slotName: slots[a.slotIdx].name,
      slideIdx: typeof a.slideIdx === 'number' ? a.slideIdx : -1,
      sourceTitle:
        typeof a.slideIdx === 'number' && a.slideIdx >= 0 && slides[a.slideIdx]
          ? slides[a.slideIdx].title || null
          : null,
      confidence: typeof a.confidence === 'number' ? a.confidence : 0,
      reason: String(a.reason || ''),
    }));

    return {
      assignments,
      method: 'llm',
      cost: { usdEstimate, tokens: usage },
    };
  } catch (e) {
    log(`[mapper-llm] threw '${e.message}' → fallback`);
    return _fallback(input, e.message);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract a JSON object from an LLM response (handles ```json fences,
 * leading/trailing prose). Same pattern as picker-llm.js.
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
 * Heuristic fallback — replicates the scoring logic from bake-scaffold-pipeline.mjs
 * using the exported scoreSlideForSlot function so both sides stay in sync.
 *
 * @param {object} input
 * @param {string} reason
 * @returns {{ assignments, method, fallbackReason, cost }}
 */
function _fallback(input, reason) {
  const { slides, scaffold } = input;
  const slots = scaffold.slots;
  const consumed = new Set();

  const assignments = slots.map((slot, slotIdx) => {
    let bestIdx = -1;
    let bestScore = -1;

    // Special-case slot 0 = cover → first unconsumed slide
    if (slotIdx === 0 && slot.name === 'cover') {
      for (let i = 0; i < slides.length; i++) {
        if (!consumed.has(i)) {
          bestIdx = i;
          bestScore = 0;
          break;
        }
      }
    } else {
      for (let i = 0; i < slides.length; i++) {
        if (consumed.has(i)) continue;
        const s = scoreSlideForSlot(slides[i], slot);
        if (s > bestScore) {
          bestScore = s;
          bestIdx = i;
        }
      }
    }

    if (bestIdx >= 0 && bestScore > 0) {
      consumed.add(bestIdx);
      return {
        slotIdx,
        slotName: slot.name,
        slideIdx: bestIdx,
        sourceTitle: slides[bestIdx].title || null,
        confidence: Math.min(10, bestScore * 2), // scale heuristic score to 0-10
        reason: `heuristic: keyword score ${bestScore}`,
      };
    }

    // Fallback: assign next unconsumed slide if any remain
    for (let i = 0; i < slides.length; i++) {
      if (!consumed.has(i)) {
        consumed.add(i);
        return {
          slotIdx,
          slotName: slot.name,
          slideIdx: i,
          sourceTitle: slides[i].title || null,
          confidence: 0,
          reason: 'heuristic: next unconsumed slide (no keyword match)',
        };
      }
    }

    return {
      slotIdx,
      slotName: slot.name,
      slideIdx: -1,
      sourceTitle: null,
      confidence: 0,
      reason: 'no source content matches this slot purpose',
    };
  });

  return {
    assignments,
    method: 'heuristic-fallback',
    fallbackReason: reason,
    cost: { usdEstimate: 0, tokens: {} },
  };
}
