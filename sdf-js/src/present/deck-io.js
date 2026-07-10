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

function sharedLiftParams(deck) {
  return [...deck.slots, ...(deck.errors || [])].find((entry) => entry.liftParams)?.liftParams;
}

function stripSharedLiftParams(entry) {
  return {
    ...entry,
    liftParams: entry.liftParams
      ? {
          ...entry.liftParams,
          scaffold: undefined,
          slides: undefined,
          theme: undefined,
        }
      : undefined,
  };
}

function rehydrateLiftParams(entry, shared) {
  return {
    ...entry,
    liftParams: entry.liftParams
      ? {
          ...entry.liftParams,
          scaffold: entry.liftParams.scaffold ?? shared?.scaffold,
          slides: entry.liftParams.slides ?? shared?.slides,
          theme: entry.liftParams.theme ?? shared?.theme,
        }
      : undefined,
  };
}

export function serializeDeck(deck) {
  if (!deck || !Array.isArray(deck.slots)) throw new Error('serializeDeck: not a deck');
  const first = sharedLiftParams(deck);
  const shared = first
    ? {
        scaffold: first.scaffold,
        slides: first.slides,
        theme: first.theme,
      }
    : null;
  return {
    format: DECK_FORMAT,
    version: DECK_FORMAT_VERSION,
    title: deck.title,
    theme: deck.theme,
    scaffold: deck.scaffold,
    decor: deck.decor,
    shared,
    slots: deck.slots.map(stripSharedLiftParams),
    errors: (deck.errors || []).map(stripSharedLiftParams),
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
    slots: (data.slots || []).map((s) => rehydrateLiftParams(s, shared)),
    errors: (data.errors || []).map((e) => rehydrateLiftParams(e, shared)),
  };
}
