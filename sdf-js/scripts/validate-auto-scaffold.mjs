#!/usr/bin/env node
// =============================================================================
// validate-auto-scaffold.mjs — Sprint 64: end-to-end REAL-LLM validation of
// the auto-scaffold path (Sprint 63) on a non-news article.
//
// Usage: node sdf-js/scripts/validate-auto-scaffold.mjs <article.txt> <deckName>
//
// Runs newsToFullDeck({ scaffoldId: 'auto' }) on the article, then writes a
// baked-deck directory in the scaffold-pipeline convention so the standing
// eval instrument (eval-deck-quality.mjs five axes) scores it exactly like
// the news-briefing corpus — same ruler, new path.
// =============================================================================
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { newsToFullDeck } from '../src/present/news/full-deck.js';

const REPO = resolve(new URL('../..', import.meta.url).pathname);
const articlePath = process.argv[2];
const deckName = process.argv[3] || 'auto-scaffold-validation';
const minPages = Number(process.argv[4] || 10);
const maxPages = Number(process.argv[5] || 20);
if (!articlePath) {
  console.error('usage: validate-auto-scaffold.mjs <article.txt> <deckName>');
  process.exit(1);
}

const apiKey = readFileSync(join(REPO, 'key.txt'), 'utf8')
  .trim()
  .replace(/^ANTHROPIC_API_KEY=/, '');
const article = readFileSync(articlePath, 'utf8');

const outDir = join(REPO, 'sdf-js/examples/scaffold-pipeline', deckName);
mkdirSync(join(outDir, 'slots'), { recursive: true });

console.log(`[validate] article: ${articlePath} (${article.length} chars)`);
const t0 = Date.now();
let plan = null;
const deck = await newsToFullDeck(article, {
  apiKey,
  scaffoldId: 'auto',
  minPages,
  maxPages,
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
const slidedataRel = `sdf-js/examples/scaffold-pipeline/${deckName}-slidedata.json`;
const outline = deck.slots[0]?.liftParams?.slides || [];
writeFileSync(join(REPO, slidedataRel), JSON.stringify(outline, null, 1));

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
const manifest = {
  deckName,
  sourceFile: slidedataRel,
  scaffold: deck.scaffold,
  theme: deck.theme?.id || deck.theme,
  slots: manifestSlots,
  droppedSlots: deck.errors.map((e) => ({ slotName: e.slot, error: e.message })),
  totals: { delivered: deck.slots.length, errors: deck.errors.length, seconds: Number(secs) },
  meta: { path: 'auto-scaffold (Sprint 63)', article: articlePath, plan },
};
writeFileSync(join(outDir, 'deck.json'), JSON.stringify(manifest, null, 1));
console.log(`[validate] baked → ${outDir}`);
