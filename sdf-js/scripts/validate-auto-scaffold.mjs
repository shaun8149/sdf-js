#!/usr/bin/env node
// =============================================================================
// validate-auto-scaffold.mjs — Sprint 64: end-to-end REAL-LLM validation of
// the auto-scaffold path (Sprint 63) on a non-news article.
//
// Usage:
//   node sdf-js/scripts/validate-auto-scaffold.mjs <article.txt> <deckName> [--force]
//
// Runs newsToFullDeck({ scaffoldId: 'auto' }) on the article, then writes a
// baked-deck directory in the scaffold-pipeline convention so the standing
// eval instrument (eval-deck-quality.mjs five axes) scores it exactly like
// the news-briefing corpus — same ruler, new path.
// =============================================================================
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { newsToFullDeck } from '../src/present/news/full-deck.js';
import { getScaffold } from '../src/present/scaffolds/registry.js';

const REPO = resolve(new URL('../..', import.meta.url).pathname);

export function parseArgs(argv) {
  const force = argv.includes('--force');
  const positional = argv.filter((arg) => arg !== '--force');
  return {
    articlePath: positional[0],
    deckName: positional[1] || 'auto-scaffold-validation',
    force,
  };
}

export function isSafeDeckName(deckName) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(deckName);
}

export function buildDroppedSlots(scaffold, manifestSlots, errors = []) {
  const delivered = new Set(manifestSlots.map((s) => s.slotIdx));
  const errorsBySlotName = new Map(errors.map((e) => [e.slot, e]));
  return (scaffold.slots || [])
    .map((slot, slotIdx) => {
      if (delivered.has(slotIdx)) return null;
      const error = errorsBySlotName.get(slot.name);
      return {
        slotIdx,
        slotName: slot.name,
        slotTitle: slot.title,
        ...(error
          ? { reason: 'lift-error', error: error.message }
          : { reason: 'no-source-content' }),
      };
    })
    .filter(Boolean);
}

async function main(argv) {
  const { articlePath, deckName, force } = parseArgs(argv);
  if (!articlePath) {
    console.error('usage: validate-auto-scaffold.mjs <article.txt> <deckName> [--force]');
    process.exit(1);
  }
  if (!isSafeDeckName(deckName)) {
    console.error(
      `validate-auto-scaffold: unsafe deckName "${deckName}" (use letters, numbers, dot, dash, underscore only)`,
    );
    process.exit(1);
  }

  const outDir = join(REPO, 'sdf-js/examples/scaffold-pipeline', deckName);
  const slidedataRel = `sdf-js/examples/scaffold-pipeline/${deckName}-slidedata.json`;
  const slidedataPath = join(REPO, slidedataRel);
  if (!force && (existsSync(outDir) || existsSync(slidedataPath))) {
    console.error(
      `validate-auto-scaffold: output "${deckName}" already exists; choose a new deckName or pass --force`,
    );
    process.exit(1);
  }
  if (force) {
    rmSync(outDir, { recursive: true, force: true });
    rmSync(slidedataPath, { force: true });
  }

  mkdirSync(join(outDir, 'slots'), { recursive: true });

  const apiKey = readFileSync(join(REPO, 'key.txt'), 'utf8')
    .trim()
    .replace(/^ANTHROPIC_API_KEY=/, '');
  const article = readFileSync(articlePath, 'utf8');

  console.log(`[validate] article: ${articlePath} (${article.length} chars)`);
  const t0 = Date.now();
  let plan = null;
  const deck = await newsToFullDeck(article, {
    apiKey,
    scaffoldId: 'auto',
    onProgress: (msg, pct) => console.log(`  ${String(Math.round(pct)).padStart(3)}%  ${msg}`),
    onPlan: (p, meta) => {
      plan = { slots: p, theme: meta.theme?.id };
    },
  });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `[validate] done in ${secs}s — scaffold: ${deck.scaffold.id} · ${deck.slots.length} slots · ${deck.errors.length} errors`,
  );

  // bake in the scaffold-pipeline convention (deck.json manifest + slots/*.json)
  // so eval-deck-quality.mjs reads it like any corpus deck
  const outline = deck.slots[0]?.liftParams?.slides || [];
  writeFileSync(slidedataPath, JSON.stringify(outline, null, 1));

  const manifestSlots = deck.slots.map((s) => {
    const liftFile = `slots/slot-${String(s.slotIdx).padStart(2, '0')}-${s.slotName}.json`;
    writeFileSync(
      join(outDir, liftFile),
      JSON.stringify(
        {
          slotIdx: s.slotIdx,
          slotName: s.slotName,
          slotTitle: s.slotTitle,
          sourceSlideIdx: s.liftParams?.slideIdx,
          sceneData: s.sceneData,
          meta: { bakedBy: 'validate-auto-scaffold', model: 'live' },
        },
        null,
        1,
      ),
    );
    return {
      slotIdx: s.slotIdx,
      slotName: s.slotName,
      slotTitle: s.slotTitle,
      sourceSlideIdx: s.liftParams?.slideIdx,
      liftFile,
      error: null,
      mappingEmpty: false,
      subjectTypes: (s.sceneData?.atoms || s.sceneData?.subjects || []).map((a) => a.type),
    };
  });
  const scaffold = getScaffold(deck.scaffold.id);
  const droppedSlots = buildDroppedSlots(scaffold, manifestSlots, deck.errors);
  const manifest = {
    deckName,
    sourceFile: slidedataRel,
    scaffold: deck.scaffold,
    theme: deck.theme?.id || deck.theme,
    slots: manifestSlots,
    droppedSlots,
    totals: {
      delivered: deck.slots.length,
      errors: droppedSlots.filter((s) => s.reason === 'lift-error').length,
      empty: droppedSlots.filter((s) => s.reason === 'no-source-content').length,
      seconds: Number(secs),
    },
    meta: { path: 'auto-scaffold (Sprint 63)', article: articlePath, plan },
  };
  writeFileSync(join(outDir, 'deck.json'), JSON.stringify(manifest, null, 1));
  console.log(`[validate] baked → ${outDir}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main(process.argv.slice(2));
}
