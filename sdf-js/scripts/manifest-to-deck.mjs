#!/usr/bin/env node
// =============================================================================
// manifest-to-deck.mjs — Sprint 66: bake-manifest → atlas-deck converter.
//
// The CLI bake pipeline writes the manifest dialect (deck.json + slots/*.json
// with liftFile pointers); the machine contract for handoff is atlas-deck
// (docs/atlas-deck-contract.md, sceneData inline). This converter bridges
// them — used to build the 3D end's e2e ammo pack from the eval corpus.
//
// Usage:
//   node sdf-js/scripts/manifest-to-deck.mjs <bakedDeckDir> [outFile]
//   node sdf-js/scripts/manifest-to-deck.mjs --ammo    # all eval-* corpus decks
// =============================================================================
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { validateDeck, DECK_FORMAT, DECK_FORMAT_VERSION } from '../src/present/deck-spec.js';
import { getTheme } from '../src/present/themes.js';

const REPO = resolve(new URL('../..', import.meta.url).pathname);

export function manifestDirToDeck(dir) {
  const manifest = JSON.parse(readFileSync(join(dir, 'deck.json'), 'utf8'));
  const slots = [];
  for (const s of manifest.slots || []) {
    if (!s.liftFile || s.error || s.mappingEmpty) continue;
    const slotFile = JSON.parse(readFileSync(join(dir, s.liftFile), 'utf8'));
    slots.push({
      slotIdx: s.slotIdx,
      slotName: s.slotName,
      slotTitle: s.slotTitle,
      sceneData: slotFile.sceneData,
    });
  }
  const themeId = typeof manifest.theme === 'string' ? manifest.theme : manifest.theme?.id;
  let theme = themeId;
  try {
    theme = getTheme(themeId) || themeId;
  } catch {
    /* keep the id string — consumers resolve with their own table */
  }
  return {
    format: DECK_FORMAT,
    version: DECK_FORMAT_VERSION,
    title: manifest.deckName,
    theme,
    scaffold:
      typeof manifest.scaffold === 'object'
        ? { id: manifest.scaffold.id, label: manifest.scaffold.label }
        : { id: manifest.scaffold },
    decor: null, // handoff fixtures carry no 2D style layer by default
    shared: null,
    slots,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  if (args[0] === '--ammo') {
    const src = join(REPO, 'sdf-js/examples/scaffold-pipeline');
    const out = join(REPO, 'sdf-js/examples/deck-handoff/ammo');
    mkdirSync(out, { recursive: true });
    let n = 0;
    for (const name of readdirSync(src)) {
      if (!name.startsWith('eval-') || name.endsWith('.json')) continue;
      const dir = join(src, name);
      if (!existsSync(join(dir, 'deck.json'))) continue;
      const deck = manifestDirToDeck(dir);
      const v = validateDeck(deck);
      if (!v.ok) {
        console.error(`  ✗ ${name}: ${v.errors.join('; ')}`);
        continue;
      }
      writeFileSync(join(out, `${name}.json`), JSON.stringify(deck, null, 1));
      console.log(
        `  ✓ ${name}: ${deck.slots.length} slots${v.warnings.length ? ` (${v.warnings.length} warnings)` : ''}`,
      );
      n++;
    }
    console.log(`ammo pack: ${n} atlas-decks → ${out}`);
  } else if (args[0]) {
    const dir = resolve(args[0]);
    const deck = manifestDirToDeck(dir);
    const v = validateDeck(deck);
    if (!v.ok) {
      console.error(`invalid: ${v.errors.join('; ')}`);
      process.exit(1);
    }
    const out = args[1] || `${basename(dir)}.atlas-deck.json`;
    writeFileSync(out, JSON.stringify(deck, null, 1));
    console.log(`wrote ${out} (${deck.slots.length} slots)`);
  } else {
    console.error('usage: manifest-to-deck.mjs <bakedDeckDir> [outFile] | --ammo');
    process.exit(2);
  }
}
