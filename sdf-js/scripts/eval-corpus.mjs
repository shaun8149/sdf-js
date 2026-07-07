#!/usr/bin/env node
// =============================================================================
// eval-corpus.mjs — Sprint 24 P2 eval harness: corpus-wide runner
// -----------------------------------------------------------------------------
// Scores (and optionally bakes) the full 10-fixture eval corpus, producing a
// ranked table + sdf-js/scripts/eval-results/summary.json — the trackable
// baseline for "近似自动化的迭代" (near-automated iteration): bake corpus →
// measure → fix biggest issue → re-bake → PR with before/after metrics.
//
// Usage:
//   node sdf-js/scripts/eval-corpus.mjs                          # score existing baked decks
//   node sdf-js/scripts/eval-corpus.mjs --bake --key-file key.txt  # bake all 10 + score
//   node sdf-js/scripts/eval-corpus.mjs --only vc-pitch           # single fixture (score or bake)
// =============================================================================

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { scoreDeckQuality } from './eval-deck-quality.mjs';

const REPO = new URL('../..', import.meta.url).pathname;
const FIXTURES_DIR = `${REPO}sdf-js/scripts/scaffold-pipeline-fixtures`;
const DECKS_DIR = `${REPO}sdf-js/examples/scaffold-pipeline`;
const RESULTS_DIR = `${REPO}sdf-js/scripts/eval-results`;

// The 10-fixture corpus (hardcoded — see sprint24-p2-report.md for rationale).
const CORPUS = [
  'antfun-company.json',
  'qbr-q3-2026.json',
  'strategy-batch2-validation.json',
  'strategy-swot-portfolio.json',
  'swot-portfolio-2026.json',
  'vc-pitch.json',
  'yosemite-trip-2026.json',
  'edu-course-intro.json',
  'nonprofit-annual-report.json',
  'product-eng-retro.json',
  'econ-news-2026.json', // Sprint 29: Chinese real-news fixture — CJK numbers/entities regression
  // Sprint 32: article entries — raw text baked through the FULL news chain
  // (expand → news-briefing → page floor) via news-to-deck.mjs, so the
  // 10-20-page capability regresses with the corpus, not only in the
  // stability harness.
  { article: 'econ-news-excerpt.txt', id: 'news-econ' },
  { article: 'policy-news-excerpt.txt', id: 'news-policy' },
];

function stemOf(fixture) {
  return typeof fixture === 'string' ? fixture.replace(/\.json$/, '') : fixture.id;
}
function deckNameOf(fixture) {
  return `eval-${stemOf(fixture)}`;
}

// --- args ---
const args = process.argv.slice(2);
function arg(name, fallback = null) {
  const i = args.indexOf(name);
  return i > -1 ? args[i + 1] : fallback;
}
const DO_BAKE = args.includes('--bake');
const KEY_FILE = arg('--key-file', null);
const ONLY = arg('--only', null);

let corpus = CORPUS;
if (ONLY) {
  corpus = CORPUS.filter((f) => stemOf(f) === ONLY || deckNameOf(f) === ONLY || f === ONLY);
  if (corpus.length === 0) {
    console.error(
      `--only "${ONLY}" matched no corpus fixture. Corpus stems: ${CORPUS.map(stemOf).join(', ')}`,
    );
    process.exit(2);
  }
}

if (DO_BAKE && !KEY_FILE) {
  console.error('ERROR: --bake requires --key-file PATH');
  process.exit(2);
}

// -----------------------------------------------------------------------------
// Bake (optional)
// -----------------------------------------------------------------------------
if (DO_BAKE) {
  console.log(`\n══ eval-corpus: baking ${corpus.length} deck(s) ══\n`);
  for (const fixture of corpus) {
    const deckName = deckNameOf(fixture);
    console.log(`── bake: ${deckName} ──`);
    const cmd =
      typeof fixture === 'string'
        ? [
            'sdf-js/scripts/bake-scaffold-pipeline.mjs',
            '--slidedata',
            join(FIXTURES_DIR, fixture),
            '--deck-name',
            deckName,
            '--picker',
            'llm',
            '--mapper',
            'llm',
            '--key-file',
            KEY_FILE,
            '--force',
          ]
        : [
            'sdf-js/scripts/news-to-deck.mjs',
            '--text',
            join(FIXTURES_DIR, fixture.article),
            '--deck-name',
            deckName,
            '--key-file',
            KEY_FILE,
          ];
    const result = spawnSync('node', cmd, { cwd: REPO, stdio: 'inherit' });
    if (result.status !== 0) {
      console.error(`  ✗ bake failed for ${deckName} (exit ${result.status}) — continuing`);
    }
  }
}

// -----------------------------------------------------------------------------
// Score
// -----------------------------------------------------------------------------
console.log(`\n══ eval-corpus: scoring ${corpus.length} deck(s) ══\n`);

const rows = [];
const skipped = [];

for (const fixture of corpus) {
  const deckName = deckNameOf(fixture);
  const deckDir = join(DECKS_DIR, deckName);
  if (!existsSync(join(deckDir, 'deck.json'))) {
    console.warn(`  ⚠ skip ${deckName} — not baked yet (no deck.json in ${deckDir})`);
    skipped.push(deckName);
    continue;
  }
  try {
    const result = await scoreDeckQuality(deckDir);
    writeFileSync(join(deckDir, 'eval.json'), JSON.stringify(result, null, 2));
    rows.push(result);
    console.log(`  ✓ ${deckName}: ${result.score.total}/100`);
  } catch (e) {
    console.error(`  ✗ ${deckName}: scoring failed — ${e.message}`);
    skipped.push(deckName);
  }
}

// -----------------------------------------------------------------------------
// Ranked table
// -----------------------------------------------------------------------------
rows.sort((a, b) => b.score.total - a.score.total);

function pad(str, n) {
  return String(str).padEnd(n, ' ');
}
function padNum(str, n) {
  return String(str).padStart(n, ' ');
}

console.log(
  `\n${pad('deck', 26)}${padNum('score', 6)}  ${pad('fill', 6)}${padNum('types', 6)}${padNum('unk', 5)}${padNum('twin%', 7)}  ${pad('lift', 6)}${padNum('chars/slot', 11)}${padNum('facts%', 8)}${padNum('ents%', 7)}`,
);

for (const r of rows) {
  const fillStr = `${r.structure.slots_baked}/${r.structure.slots_total}`;
  const liftStr = `${r.threeDReadiness.lift_success}/${r.structure.slots_baked}`;
  const factsStr = r.fidelity ? Math.round(r.fidelity.number_recall * 100) + '%' : '—';
  const entsStr =
    r.fidelity && r.fidelity.entity_recall != null
      ? Math.round(r.fidelity.entity_recall * 100) + '%'
      : '—';
  console.log(
    `${pad(r.deckName, 26)}${padNum(r.score.total, 6)}  ${pad(fillStr, 6)}${padNum(r.atomQuality.atom_types_distinct, 6)}${padNum(r.atomQuality.unknown_atom_count, 5)}${padNum(Math.round(r.threeDReadiness.twin_coverage * 100) + '%', 7)}  ${pad(liftStr, 6)}${padNum(Math.round(r.textBudget.chars_per_slot), 11)}${padNum(factsStr, 8)}${padNum(entsStr, 7)}`,
  );
}

const corpusMean = rows.length > 0 ? rows.reduce((s, r) => s + r.score.total, 0) / rows.length : 0;
const fidelityRows = rows.filter((r) => r.fidelity);
const fidelityMean =
  fidelityRows.length > 0
    ? fidelityRows.reduce((s, r) => s + r.fidelity.number_recall, 0) / fidelityRows.length
    : null;
const entityRows = rows.filter((r) => r.fidelity && r.fidelity.entity_recall != null);
const entityMean =
  entityRows.length > 0
    ? entityRows.reduce((s, r) => s + r.fidelity.entity_recall, 0) / entityRows.length
    : null;
console.log(
  `\n${pad('CORPUS MEAN', 26)}${padNum(corpusMean.toFixed(1), 6)}${fidelityMean != null ? `   facts recall mean: ${(fidelityMean * 100).toFixed(1)}%` : ''}${entityMean != null ? `   entity recall mean: ${(entityMean * 100).toFixed(1)}%` : ''}`,
);
if (skipped.length) console.log(`\nskipped (not baked): ${skipped.join(', ')}`);

// -----------------------------------------------------------------------------
// summary.json
// -----------------------------------------------------------------------------
mkdirSync(RESULTS_DIR, { recursive: true });
const summary = {
  generatedAt: new Date().toISOString(),
  corpusSize: corpus.length,
  scored: rows.length,
  skipped,
  corpusMean: Math.round(corpusMean * 10) / 10,
  factsRecallMean: fidelityMean != null ? Math.round(fidelityMean * 1000) / 1000 : null,
  entityRecallMean: entityMean != null ? Math.round(entityMean * 1000) / 1000 : null,
  decks: rows.map((r) => ({
    deckName: r.deckName,
    score: r.score.total,
    scoreBreakdown: r.score.breakdown,
    fillRate: r.structure.fill_rate,
    scaffoldId: r.structure.scaffold_id,
    themeId: r.structure.theme_id,
    pickMethod: r.structure.pick_method,
    atomTypesDistinct: r.atomQuality.atom_types_distinct,
    unknownAtomCount: r.atomQuality.unknown_atom_count,
    unknownAtomTypes: r.atomQuality.unknown_atom_types,
    argViolations: r.atomQuality.arg_violations,
    argViolationsTopOffenders: r.atomQuality.arg_violations_top_offenders,
    twinCoverage: r.threeDReadiness.twin_coverage,
    untwinnedTypes: r.threeDReadiness.untwinned_types,
    liftSuccess: r.threeDReadiness.lift_success,
    liftAttempted: r.threeDReadiness.lift_attempted,
    liftedSubjectRate: r.threeDReadiness.lifted_subject_rate,
    charsPerSlot: r.textBudget.chars_per_slot,
    maxSlotChars: r.textBudget.max_slot_chars,
    numberRecall: r.fidelity ? r.fidelity.number_recall : null,
    entityRecall: r.fidelity && r.fidelity.entity_recall != null ? r.fidelity.entity_recall : null,
    missingEntities: r.fidelity ? r.fidelity.missing_entities || [] : [],
    missingNumbers: r.fidelity ? r.fidelity.missing_numbers : [],
  })),
};
writeFileSync(join(RESULTS_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(`\nWrote ${join(RESULTS_DIR, 'summary.json').replace(REPO, '')}`);
