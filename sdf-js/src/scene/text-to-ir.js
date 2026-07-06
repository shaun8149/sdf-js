// sdf-js/src/scene/text-to-ir.js
// The text → IR input adapter: natural language in, a validated deck of IRs
// out. This is the seam the IR architecture promised — the renderers never
// change; a prompt front-end just plugs in. BYOK, browser-direct Anthropic
// call (same pattern + localStorage key as the compositor's lift).
//
// Contract: the model ALWAYS returns a deck shape {title, slides: [IR...]} —
// a single topic is a one-slide deck — so the caller has exactly one path
// (assembleDeck). Every slide is validated with validateIR; on failure we
// retry ONCE, feeding the validator errors back to the model.
import { validateIR, STRUCTURES } from './ir.js';

export const TEXT_TO_IR_MODEL = 'claude-sonnet-4-6';

// Kept deliberately SHORT (repo rule): schema + one example per structure.
export const TEXT_TO_IR_SYSTEM = `You convert presentation ideas into Atlas IR JSON.

Output ONLY JSON, no prose/fences: {"title": string, "slides": [IR, ...]}
One slide per distinct point. 1-5 slides.

IR = {"structure": S, "nodes": [names], "magnitude"?: [numbers, same length],
      "relations"?: [[i,j],...], "emphasis"?: [index], "order"?: [indices], "title": string,
      "axes"?: [[xCats],[yCats]], "cells"?: [[xi,yi],...]}

Structures (pick per slide by the SHAPE of the point):
- "sequence": ordered stages / conversion / pipeline. magnitude = per-stage size. emphasis = the outcome stage.
- "hierarchy": tree (org / taxonomy / breakdown). relations = [parent,child] index pairs, exactly one root.
- "network": web of relationships / ecosystem / dependencies. relations = undirected edges, no self-loops.
- "magnitude": comparing quantities (revenue by X / market share). magnitude REQUIRED. emphasis = the winner or the point.
- "matrix": 2-axis classification (SWOT / risk likelihood×impact / cost-benefit). axes REQUIRED [xCats,yCats]; cells REQUIRED, one [xi,yi] index pair per node.

Rules: indices are integers into nodes. Numbers real if given, plausible if not.
emphasis = what the narrative punches. Node names <= 3 words.

Example: "our funnel: 1200 leads to 45 closed, focus on the close"
{"title":"Pipeline","slides":[{"structure":"sequence","nodes":["Leads","Qualified","Proposal","Closed"],"magnitude":[1200,400,150,45],"emphasis":[3],"title":"Sales Funnel"}]}`;

/** Strip fences/prose and parse the model's reply into a validated deck. */
export function parseIRResponse(text) {
  let s = String(text).trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  // tolerate leading prose before the JSON object
  const start = s.indexOf('{');
  if (start > 0) s = s.slice(start);
  const end = s.lastIndexOf('}');
  if (end >= 0) s = s.slice(0, end + 1);

  let deck;
  try {
    deck = JSON.parse(s);
  } catch (e) {
    throw new Error(`text-to-ir: reply is not JSON (${e.message}): ${s.slice(0, 120)}…`);
  }
  if (!deck || !Array.isArray(deck.slides) || deck.slides.length === 0)
    throw new Error('text-to-ir: reply must be {title, slides:[IR...]} with ≥1 slide');

  const errors = [];
  deck.slides.forEach((ir, i) => {
    const v = validateIR(ir);
    if (!v.ok) errors.push(`slide ${i} (${ir?.structure}): ${v.errors.join('; ')}`);
    if (ir && !STRUCTURES.includes(ir.structure))
      errors.push(`slide ${i}: unknown structure '${ir?.structure}'`);
  });
  if (errors.length) {
    const err = new Error(`text-to-ir: invalid IR — ${errors.join(' | ')}`);
    err.validationErrors = errors;
    err.deck = deck;
    throw err;
  }
  return deck;
}

async function callModel(messages, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: TEXT_TO_IR_MODEL,
      max_tokens: 4096,
      system: TEXT_TO_IR_SYSTEM,
      messages,
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${errText.slice(0, 300)}`);
  }
  const data = await response.json();
  return data.content[0].text;
}

/**
 * textToIR(text, apiKey) → {title, slides:[IR...]} (validated).
 * One retry on validation failure, feeding the errors back to the model.
 */
export async function textToIR(text, apiKey) {
  if (!apiKey) throw new Error('text-to-ir: Anthropic API key required (BYOK)');
  const messages = [{ role: 'user', content: String(text) }];
  const first = await callModel(messages, apiKey);
  try {
    return parseIRResponse(first);
  } catch (e) {
    if (!e.validationErrors) throw e; // not-JSON etc. — retrying rarely helps
    messages.push({ role: 'assistant', content: first });
    messages.push({
      role: 'user',
      content: `Your JSON failed validation:\n${e.validationErrors.join('\n')}\nReturn the corrected JSON only.`,
    });
    return parseIRResponse(await callModel(messages, apiKey));
  }
}
