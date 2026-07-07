// =============================================================================
// retheme.js — Sprint 39: switch a generated deck's theme with ZERO LLM cost.
//
// Atoms take their palette at render time, so most color comes free with a
// re-render. But the lift prompt hands the LLM the theme's rgb values and
// some land inside args (iconColor: "rgb(38, 70, 130)", pillars[].accent:
// [38,70,130] — see the Sprint 33 color-leak audit). Left alone they'd
// produce a mixed-theme deck. Deterministic remap: any arg color that
// EXACTLY matches one of the old theme's colors is rewritten to the new
// theme's counterpart (accent→accent, colors[i]→colors[i], bg→bg,
// silhouette→silhouette). Colors the LLM invented (not from the theme
// block) are left untouched — they were a deliberate choice.
// =============================================================================
import { getTheme } from './themes.js';

const SLOT_KEYS = ['accent', 'bg', 'silhouetteColor'];

function tripleOf(v) {
  if (Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number')) return v;
  return null;
}

// old-color → new-color pairs, position-aligned across the two themes
function colorPairs(oldTheme, newTheme) {
  const pairs = [];
  for (const k of SLOT_KEYS) {
    if (tripleOf(oldTheme[k]) && tripleOf(newTheme[k])) pairs.push([oldTheme[k], newTheme[k]]);
  }
  const oc = oldTheme.colors || [];
  const nc = newTheme.colors || [];
  for (let i = 0; i < oc.length; i++) {
    if (tripleOf(oc[i]) && tripleOf(nc[i % Math.max(1, nc.length)]))
      pairs.push([oc[i], nc[i % nc.length]]);
  }
  return pairs;
}

function sameTriple(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

// every rgb()/rgba() spelling the lift is known to emit for a triple
function stringForms([r, g, b]) {
  return [
    [`rgb(${r}, ${g}, ${b})`, (nr, ng, nb) => `rgb(${nr}, ${ng}, ${nb})`],
    [`rgb(${r},${g},${b})`, (nr, ng, nb) => `rgb(${nr},${ng},${nb})`],
  ];
}

function remapString(s, pairs) {
  let out = s;
  for (const [oldC, newC] of pairs) {
    for (const [form, make] of stringForms(oldC)) {
      if (out.includes(form)) out = out.split(form).join(make(...newC));
    }
    // rgba(r, g, b, a) — keep the alpha
    out = out.replace(
      new RegExp(
        `rgba\\(\\s*${oldC[0]}\\s*,\\s*${oldC[1]}\\s*,\\s*${oldC[2]}\\s*,\\s*([\\d.]+)\\s*\\)`,
        'g',
      ),
      (m, a) => `rgba(${newC[0]}, ${newC[1]}, ${newC[2]}, ${a})`,
    );
  }
  return out;
}

function remapNode(node, pairs) {
  if (node == null) return node;
  if (typeof node === 'string') return remapString(node, pairs);
  if (Array.isArray(node)) {
    const t = tripleOf(node);
    if (t) {
      for (const [oldC, newC] of pairs) {
        if (sameTriple(t, oldC)) return [...newC];
      }
      return node;
    }
    return node.map((el) => remapNode(el, pairs));
  }
  if (typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = remapNode(v, pairs);
    return out;
  }
  return node;
}

/**
 * rethemeDeck(deck, newThemeId) — mutates the deck in place (same contract
 * as reliftSlot: exports and re-renders follow with no bookkeeping).
 * Returns the new theme. Works for quick-mode and full-deck decks alike.
 */
export function rethemeDeck(deck, newThemeId) {
  const newTheme = getTheme(newThemeId);
  if (!newTheme) throw new Error(`rethemeDeck: unknown theme "${newThemeId}"`);
  const oldTheme = deck.theme;
  if (oldTheme?.id === newTheme.id) return newTheme;
  const pairs = colorPairs(oldTheme || {}, newTheme);

  for (const slot of deck.slots || []) {
    if (!slot.sceneData?.subjects) continue;
    slot.sceneData.subjects = slot.sceneData.subjects.map((subj) => ({
      ...subj,
      args: remapNode(subj.args || {}, pairs),
    }));
    // future re-rolls should lift with the new theme
    if (slot.liftParams) slot.liftParams.theme = newTheme;
  }
  deck.theme = newTheme;
  return newTheme;
}
