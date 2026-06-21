#!/usr/bin/env node
// =============================================================================
// sprint11-13-l3-verify.mjs — Sprint 11/12/13 prompt v3.28 L3 verify harness
// -----------------------------------------------------------------------------
// 5 cases × 6 variants. Drives the actual Atlas Present pipeline (createVisualPipeline
// + callLiftLLM mode='2d'). Captures per-variant: ok/error, archetype, idiom
// adoption flags (Sprint 5-8), Sprint 12 typography flag (textFont('Inter') or
// 'IBM Plex Mono'), Sprint 13 iconography flag (drawAtlasIcon call), char-count
// of args.code, retry count if any.
//
// CLI-only — does NOT verify visual rendering. For that, separately load each
// JSON evidence file into the browser. Saves enough JSON to compare 11/12/13
// adoption vs Sprint 10 baseline.
//
// Usage: ANTHROPIC_API_KEY=$(cat /tmp/atlas-l3/key.txt) \
//          node sdf-js/scripts/sprint11-13-l3-verify.mjs [--case <id>] [--limit-variants N]
// =============================================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createVisualPipeline, VARIANT_COUNT } from '../src/present/pipeline.js';
import {
  callLiftLLM,
  parseLiftResponse,
  sanitize2dSceneData,
  loadSystemPromptLift,
} from '../src/compositor-api.js';
import { addVisual } from '../src/present/deck-model.js';

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('✗ ANTHROPIC_API_KEY env var required.');
  process.exit(1);
}
const ONLY_CASE = process.argv.includes('--case')
  ? process.argv[process.argv.indexOf('--case') + 1]
  : null;
const VARIANT_LIMIT = process.argv.includes('--limit-variants')
  ? parseInt(process.argv[process.argv.indexOf('--limit-variants') + 1], 10)
  : VARIANT_COUNT;

const PROMPT_URL = 'http://localhost:8001/examples/compositor/system-prompt-lift-3d.md';
const EVIDENCE_DIR = new URL(
  '../../docs/superpowers/manual-tests/2026-06-21-sprint-11-13-l3-verify/evidence/',
  import.meta.url,
).pathname;
mkdirSync(EVIDENCE_DIR, { recursive: true });

// ====== 5 L3 cases ======
// Mix: 3 re-runs from Sprint 10 (regression check) + 2 new (Sprint 12/13 specific)
const CASES = [
  {
    id: 'L_apparat',
    rerun: true,
    text: 'Our engineering org has 8 teams across 3 product lines: search, recommendations, and infrastructure.',
    expectedIdiom: 'generateApparatusGrid',
  },
  {
    id: 'L_voronoi',
    rerun: true,
    text: 'AWS holds 32% cloud market share, Azure 23%, GCP 11%, Alibaba 8%, others 26%.',
    expectedIdiom: 'voronoiCells',
  },
  {
    id: 'L_colon',
    rerun: true,
    text: 'The recommendation engine has 50 input features, branching through 20 transformation stages to 3 final scores: Relevance, Diversity, Freshness.',
    expectedIdiom: 'spaceColonization',
  },
  {
    id: 'L_iconic_NEW',
    rerun: false,
    text: 'Our 4 product teams collaborate with 3 cloud providers across 12 regions worldwide, processing 1.2 million events per second.',
    expectedSprint13Icons: ['users', 'cloud', 'globe', 'database'],
  },
  {
    id: 'L_typo_NEW',
    rerun: false,
    text: 'Q3 revenue reached $3.4M, growing 127% year over year — our strongest quarter on record.',
    expectedSprint12Font: ['Inter', 'IBM Plex Mono'],
  },
];

// ====== Helper: in-memory deck + dep stubs ======
function makeStubDeck(caseId) {
  return {
    id: `l3-deck-${caseId}`,
    paragraphs: [],
    visuals: [],
  };
}

function makeDeps() {
  return {
    callLiftLLM: async (prompt, code2d, apiKey, opts) =>
      callLiftLLM(prompt, code2d, apiKey, { ...opts, promptUrl: PROMPT_URL }),
    parseLiftResponse,
    sanitize2dSceneData,
    saveDeck: () => {}, // no-op for CLI
  };
}

// ====== Per-variant adoption flags ======
function analyzeVariant(variant, expectedCase) {
  const v = {
    status: variant.status,
    error: variant.liftError || null,
    archetype: variant.archetype || null,
    subjectTypes: [],
    p5CodeLen: 0,
    sprint12_usesInter: false,
    sprint12_usesIBMPlexMono: false,
    sprint13_drawAtlasIconCount: 0,
    sprint13_iconNames: [],
    sprint5_8_idioms: [],
  };
  const sceneData = variant.sceneData;
  if (!sceneData || !Array.isArray(sceneData.subjects)) return v;
  v.subjectTypes = sceneData.subjects.map((s) => s?.type || 'null');

  // Aggregate all p5-sketch code for analysis
  const p5Codes = sceneData.subjects
    .filter((s) => s?.type === 'p5-sketch')
    .map((s) => s?.args?.code || '');
  const allCode = p5Codes.join('\n');
  v.p5CodeLen = allCode.length;

  // Sprint 12: typography adoption — match textFont('Inter') OR
  // drawingContext.font escape hatch ("...Inter..." string anywhere)
  if (/textFont\(['"]Inter['"]\)/.test(allCode) || /\bInter\b/.test(allCode))
    v.sprint12_usesInter = true;
  if (/IBM Plex Mono/.test(allCode)) v.sprint12_usesIBMPlexMono = true;

  // Sprint 13: iconography adoption — count drawAtlasIcon calls + extract names
  const iconRe = /drawAtlasIcon\(['"]([\w-]+)['"]/g;
  let m;
  while ((m = iconRe.exec(allCode))) {
    v.sprint13_drawAtlasIconCount++;
    v.sprint13_iconNames.push(m[1]);
  }

  // Sprint 5-8: idiom name adoption (LLM verbatim usage)
  const idiomNames = [
    'generateApparatusGrid',
    'drawApparatusGrid',
    'voronoiCells',
    'delaunayTriangles',
    'springBrushStroke',
    'spaceColonization',
    'lSystemSegments',
    'weaveFlowDashes',
    'packCirclesInSDF',
    'irregularGridPack',
    'packShapes',
    'roundedPolyPath',
    'buildFlowField',
    'traceFlowLines',
    'chromotome',
  ];
  for (const n of idiomNames) {
    const re = new RegExp(`\\b${n}\\b`);
    if (re.test(allCode)) v.sprint5_8_idioms.push(n);
  }

  return v;
}

// ====== Main ======
async function main() {
  console.log('Sprint 11/12/13 L3 verify — prompt v3.28');
  console.log(`Cases: ${CASES.map((c) => c.id).join(', ')}`);
  if (ONLY_CASE) console.log(`(filtered to: ${ONLY_CASE})`);
  console.log(`Variants per case: ${VARIANT_LIMIT}/${VARIANT_COUNT}`);
  console.log(`Evidence dir: ${EVIDENCE_DIR}`);
  console.log();

  // Pre-load system prompt (CACHED_SYSTEM_PROMPT_LIFT inside compositor-api)
  console.log('Loading system prompt from dev server...');
  const len = await loadSystemPromptLift(PROMPT_URL);
  console.log(`  ✓ Loaded ${len} bytes`);
  console.log();

  const allResults = { startedAt: new Date().toISOString(), cases: {} };

  for (const tc of CASES) {
    if (ONLY_CASE && tc.id !== ONLY_CASE) continue;
    console.log(`\n=== ${tc.id} ===`);
    console.log(`text: "${tc.text.slice(0, 80)}${tc.text.length > 80 ? '...' : ''}"`);

    const deck = makeStubDeck(tc.id);
    const visual = addVisual(deck, { startOffset: 0, endOffset: tc.text.length, text: tc.text });

    // Limit variants for cheaper runs (dev iteration)
    if (VARIANT_LIMIT < VARIANT_COUNT) {
      visual.variants = visual.variants.slice(0, VARIANT_LIMIT);
    }

    const deps = makeDeps();
    const events = [];
    const handle = createVisualPipeline(deck, visual.id, API_KEY, deps, {
      onEvent: (e) => {
        events.push(e);
        if (e.type === 'lift-start') process.stdout.write(`  v${e.variantIndex}: ...`);
        else if (e.type === 'lift-ready') process.stdout.write(` ✓ ${e.archetype}\n`);
        else if (e.type === 'lift-error') process.stdout.write(` ✗ ${e.error.slice(0, 80)}\n`);
      },
    });

    const t0 = Date.now();
    await handle.start();
    const wallMs = Date.now() - t0;

    // Analyze variants
    const analyses = visual.variants.map((v, i) => ({
      idx: i,
      ...analyzeVariant(v, tc),
    }));

    const okCount = analyses.filter((a) => a.status === 'ready').length;
    const errCount = analyses.filter((a) => a.status === 'error').length;
    const interAdoption = analyses.filter((a) => a.sprint12_usesInter).length;
    const iconAdoption = analyses.filter((a) => a.sprint13_drawAtlasIconCount > 0).length;
    const totalIcons = analyses.reduce((s, a) => s + a.sprint13_drawAtlasIconCount, 0);

    console.log(`  → ${okCount}/${VARIANT_LIMIT} ok, ${errCount} err, ${wallMs}ms`);
    console.log(`  Sprint 12 typography: ${interAdoption}/${VARIANT_LIMIT} variants use Inter`);
    console.log(
      `  Sprint 13 icons: ${iconAdoption}/${VARIANT_LIMIT} variants use drawAtlasIcon (${totalIcons} total icons)`,
    );

    // Save raw variants to disk (for later browser-side visual verify)
    const caseEvidence = {
      id: tc.id,
      text: tc.text,
      rerun: tc.rerun,
      expectedIdiom: tc.expectedIdiom || null,
      expectedSprint12Font: tc.expectedSprint12Font || null,
      expectedSprint13Icons: tc.expectedSprint13Icons || null,
      wallMs,
      events,
      analyses,
      variants: visual.variants.map((v, i) => ({
        idx: i,
        status: v.status,
        archetype: v.archetype,
        liftError: v.liftError,
        sceneData: v.sceneData, // null on error
      })),
    };
    const outPath = `${EVIDENCE_DIR}${tc.id}.json`;
    writeFileSync(outPath, JSON.stringify(caseEvidence, null, 2));
    console.log(`  Saved ${outPath}`);

    allResults.cases[tc.id] = {
      ok: okCount,
      err: errCount,
      total: VARIANT_LIMIT,
      wallMs,
      sprint12_inter_count: interAdoption,
      sprint13_icon_count: iconAdoption,
      sprint13_total_icons: totalIcons,
      idioms_adopted: [...new Set(analyses.flatMap((a) => a.sprint5_8_idioms))],
    };
  }

  // ====== Summary ======
  console.log('\n\n=== SUMMARY ===');
  let totalOk = 0,
    totalErr = 0,
    totalLifts = 0,
    totalIcons = 0,
    totalInter = 0;
  for (const [id, r] of Object.entries(allResults.cases)) {
    totalOk += r.ok;
    totalErr += r.err;
    totalLifts += r.total;
    totalIcons += r.sprint13_total_icons;
    totalInter += r.sprint12_inter_count;
    console.log(
      `${id}: ${r.ok}/${r.total} ok, ${r.err} err, ${r.sprint12_inter_count}/${r.total} Inter, ${r.sprint13_total_icons} icons, idioms: [${r.idioms_adopted.join(', ')}]`,
    );
  }
  console.log();
  console.log(
    `Reliability: ${totalOk}/${totalLifts} (${Math.round((100 * totalOk) / totalLifts)}%) — Sprint 10 baseline was 22/30 (73%)`,
  );
  console.log(
    `Sprint 12 typography adoption: ${totalInter}/${totalLifts} (${Math.round((100 * totalInter) / totalLifts)}%)`,
  );
  console.log(`Sprint 13 iconography: ${totalIcons} total icon calls across all variants`);

  const summaryPath = `${EVIDENCE_DIR}_summary.json`;
  allResults.totalOk = totalOk;
  allResults.totalErr = totalErr;
  allResults.totalLifts = totalLifts;
  allResults.completedAt = new Date().toISOString();
  writeFileSync(summaryPath, JSON.stringify(allResults, null, 2));
  console.log(`\nSummary saved: ${summaryPath}`);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
