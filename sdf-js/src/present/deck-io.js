// =============================================================================
// deck-io.js — Sprint 62: deck persistence (save / open / autosave).
//
// deck.json is the MACHINE CONTRACT (two-ends lock: the 2D end renders it,
// the 3D end eats it) — so "save" is not a UI convenience, it is the handoff
// artifact made user-visible.
//
// The in-memory deck duplicates heavy shared state per slot (each slot's
// liftParams carries the FULL scaffold + the FULL outline slides array +
// theme, so a 15-slot deck holds 15 copies). serializeDeck hoists them into
// one `shared` block; deserializeDeck rehydrates every liftParams with the
// same references — round-trip identical in structure, ~10× smaller on disk.
// =============================================================================

import { validateDeck, DECK_FORMAT, DECK_FORMAT_VERSION } from './deck-spec.js';

// re-exported so existing importers keep working; deck-spec.js is the
// single source of truth for the contract (docs/atlas-deck-contract.md)
export { DECK_FORMAT, DECK_FORMAT_VERSION };

export function serializeDeck(deck) {
  if (!deck || !Array.isArray(deck.slots)) throw new Error('serializeDeck: not a deck');
  const first = deck.slots.find((s) => s.liftParams);
  const shared = first
    ? {
        scaffold: first.liftParams.scaffold,
        slides: first.liftParams.slides,
        theme: first.liftParams.theme,
      }
    : null;
  return {
    format: DECK_FORMAT,
    version: DECK_FORMAT_VERSION,
    title: deck.title,
    theme: deck.theme,
    scaffold: deck.scaffold,
    decor: deck.decor,
    // Sprint 97: 装裱溯源随契约走 — 3D 端由此知道装裱的存在
    artMount: deck.artMount,
    shared,
    slots: deck.slots.map((s) => ({
      ...s,
      liftParams: s.liftParams
        ? {
            ...s.liftParams,
            scaffold: undefined,
            slides: undefined,
            theme: undefined,
          }
        : undefined,
    })),
  };
}

export function deserializeDeck(data) {
  if (typeof data === 'string') data = JSON.parse(data);
  // Sprint 66: the full contract validator gates every open — structural
  // errors are rejected with the exact contract violation, not a late crash
  const v = validateDeck(data);
  if (!v.ok)
    throw new Error(
      `deserializeDeck: ${v.errors[0]}${v.errors.length > 1 ? ` (+${v.errors.length - 1} more)` : ''}`,
    );
  const shared = data.shared || null;
  return {
    title: data.title,
    theme: data.theme,
    scaffold: data.scaffold,
    decor: data.decor,
    artMount: data.artMount,
    slots: (data.slots || []).map((s) => ({
      ...s,
      liftParams: s.liftParams
        ? {
            ...s.liftParams,
            scaffold: shared?.scaffold,
            slides: shared?.slides,
            theme: shared?.theme,
          }
        : undefined,
    })),
    errors: [],
  };
}
