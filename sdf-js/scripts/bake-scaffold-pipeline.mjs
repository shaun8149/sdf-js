#!/usr/bin/env node
// =============================================================================
// bake-scaffold-pipeline.mjs — 2-call scaffold pipeline E2E baker
// -----------------------------------------------------------------------------
// Sprint 16 — End-to-end PDF → scaffolded deck.
//
// Stage 0: Pick scaffold (deterministic v1 from text content)
// Stage 1: Map source slides → scaffold slots (heuristic or LLM judge)
// Stage 2: For each slot, call lift LLM with slot context injected:
//          - slot purpose
//          - recommended atoms (positive constraint)
//          - forbidden atoms (negative constraint)
//          - theme (bg / accent / colors[])
//
// Output: screens/scaffold-pipeline/<deck>/deck.json + per-slot lift JSONs
//
// Usage:
//   ANTHROPIC_API_KEY=sk-... node sdf-js/scripts/bake-scaffold-pipeline.mjs
//   --slidedata PATH      source slidedata.json (default: PD sphere-fill deck)
//   --deck-name NAME      output dir name (default: derived from slidedata)
//   --force               re-bake existing outputs
//   --dry-run             skip Stage 2 LLM calls (just print scaffold+slot mapping)
//   --key-file PATH       read API key from file instead of env
//   --mapper llm|heuristic|auto  Stage 1 mapper mode (default: auto)
// =============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename } from 'node:path';
import { pickScaffold, distributeSources } from '../src/present/scaffolds/picker.js';
import { getScaffold, getThemeAffinity } from '../src/present/scaffolds/registry.js';
import {
  buildLiftSystemPrompt,
  buildSlotUserMessage,
  parseSceneJson,
} from '../src/present/scaffolds/lift-slot-llm.js';
import { pickScaffoldLLM } from '../src/present/scaffolds/picker-llm.js';
import { mapSlidesToSlotsLLM } from '../src/present/scaffolds/mapper-llm.js';
import { getTheme } from '../src/present/themes.js';
import { buildIconCatalogString } from '../src/icons/index.js';
import { buildAtomCatalogString } from '../src/present/atoms-2d/catalog.js';

// --- args ---
const args = process.argv.slice(2);
function arg(name, fallback = null) {
  const i = args.indexOf(name);
  return i > -1 ? args[i + 1] : fallback;
}
const REPO = new URL('../..', import.meta.url).pathname;
const SLIDEDATA_PATH = arg('--slidedata') || `${REPO}sdf-js/examples/pdf-demo/slidedata.json`;
const DECK_NAME = arg('--deck-name') || basename(SLIDEDATA_PATH).replace(/\.json$/, '');
const FORCE = args.includes('--force');
const DRY_RUN = args.includes('--dry-run');
const KEY_FILE = arg('--key-file', null);
// Picker mode: 'llm' (v2 Claude-wrapped), 'v1' (deterministic keyword), 'auto'
// (v2 with v1 fallback on error). Default: auto.
const PICKER_MODE = arg('--picker', 'auto');
// Mapper mode: 'llm' (LLM judge, throw on fail), 'heuristic' (keyword-only),
// 'auto' (LLM with heuristic fallback on error). Default: auto.
const MAPPER_MODE = arg('--mapper', 'auto');

// --- API key ---
let API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY && KEY_FILE && existsSync(KEY_FILE)) {
  const raw = readFileSync(KEY_FILE, 'utf8').trim();
  API_KEY = raw.startsWith('ANTHROPIC_API_KEY=') ? raw.slice('ANTHROPIC_API_KEY='.length) : raw;
}
if (!API_KEY && !DRY_RUN) {
  console.error('ERROR: set ANTHROPIC_API_KEY or pass --key-file PATH (or use --dry-run)');
  process.exit(2);
}

const MODEL = 'claude-sonnet-4-5-20250929';
// Output lives inside sdf-js so dev-server can serve deck.json + lifts to the
// browser viewer. (screens/ is outside sdf-js and not web-accessible.)
const OUT_DIR = `${REPO}sdf-js/examples/scaffold-pipeline/${DECK_NAME}`;
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(`${OUT_DIR}/slots`, { recursive: true });

const slides = JSON.parse(readFileSync(SLIDEDATA_PATH, 'utf8'));

// Sprint 32: the lift prompt (system + per-slot user message + parser) lives
// in src/present/scaffolds/lift-slot-llm.js — shared verbatim with the
// browser's author-2d full-deck mode. Change rules THERE, never re-inline.
const systemPrompt = await buildLiftSystemPrompt();

console.log(
  `\n══ Scaffold Pipeline ══\nSource: ${SLIDEDATA_PATH.replace(REPO, '')}\nSlides: ${slides.length}\nOutput: ${OUT_DIR.replace(REPO, '')}/\nSystem prompt: ${systemPrompt.length} chars\n`,
);

// ---------------------------------------------------------------------------
// Stage 0 — Pick scaffold from deck-level content
// ---------------------------------------------------------------------------
console.log('── Stage 0: scaffold pick ──');

const allTitles = slides.map((s) => s.title).filter(Boolean);
const bodyTextsAll = [];
for (const slide of slides) {
  if (!slide.body) continue;
  for (const b of slide.body) {
    const t = typeof b === 'string' ? b : b.text || '';
    if (t.trim()) bodyTextsAll.push(t.trim());
  }
}

// Deck title = first slide title; body = all titles + all bodies concatenated
const deckTitle = allTitles[0] || DECK_NAME;
const deckCombinedBody = [...allTitles, ...bodyTextsAll];

async function pickStage0() {
  const baseInput = { title: deckTitle, bodyTexts: deckCombinedBody };
  // --scaffold <id>: skip the picker entirely (Sprint 30 — news-to-deck pins
  // news-briefing so page count doesn't ride on picker variance).
  const forcedId = arg('--scaffold', null);
  if (forcedId) {
    const forced = getScaffold(forcedId);
    if (!forced) throw new Error(`--scaffold ${forcedId}: unknown scaffold id`);
    return {
      scaffold: forced,
      theme: getThemeAffinity(forced)[0],
      score: 1,
      signals: [`forced via --scaffold ${forcedId}`],
      method: 'forced',
    };
  }
  if (PICKER_MODE === 'v1') {
    const r = pickScaffold(baseInput);
    return { ...r, method: r.fallback ? 'fallback' : 'v1' };
  }
  // 'llm' or 'auto' — both use picker-llm; the difference is what we do on
  // error. picker-llm.js silently falls back when fallbackToV1=true (default).
  // 'llm' mode disables fallback so errors are loud.
  return await pickScaffoldLLM(baseInput, {
    apiKey: API_KEY,
    fallbackToV1: PICKER_MODE !== 'llm',
    log: (...m) => console.log(' ', ...m),
  });
}

const picked = await pickStage0();
const scaffold = picked.scaffold;
const theme = picked.theme;
const pickerMethod = picked.method || 'unknown';

console.log(
  `  picked: ${scaffold.id} (${scaffold.label})\n` +
    `  score:  ${picked.score}${picked.fallback ? ' [FALLBACK]' : ''}\n` +
    `  method: ${pickerMethod}\n` +
    `  signals: ${picked.signals.slice(0, 6).join(' | ')}\n` +
    `  theme:  ${theme.id} (${theme.label})\n` +
    `  slots:  ${scaffold.slots.length}\n`,
);

// ---------------------------------------------------------------------------
// Stage 1 — Map source slides → scaffold slots
//
// 'llm'       — call mapper-llm, throw on fail (fallbackToHeuristic: false)
// 'heuristic' — skip mapper-llm, use keyword-overlap scoring
// 'auto'      — call mapper-llm with heuristic fallback on error (default)
// ---------------------------------------------------------------------------

async function runStage1() {
  if (MAPPER_MODE === 'heuristic') {
    console.log('── Stage 1: slot mapping (heuristic) ──');
    return _heuristicMapping();
  }
  // 'llm' or 'auto'
  console.log('── Stage 1: LLM mapping ──');
  const mapperResult = await mapSlidesToSlotsLLM(
    { slides, scaffold },
    {
      apiKey: API_KEY,
      fallbackToHeuristic: MAPPER_MODE !== 'llm',
      log: (...m) => console.log(' ', ...m),
    },
  );

  if (mapperResult.method === 'llm') {
    // Per-slot pretty print
    for (const a of mapperResult.assignments) {
      if (a.slideIdx === -1) {
        console.log(
          `    ${String(a.slotIdx).padStart(2)}. ${a.slotName.padEnd(20)} [EMPTY] (no slide fits)`,
        );
      } else {
        const reasonSnip = (a.reason || '').slice(0, 50);
        console.log(
          `    ${String(a.slotIdx).padStart(2)}. ${a.slotName.padEnd(20)} ← slide ${String(a.slideIdx).padStart(2)} "${(slides[a.slideIdx]?.title || '').slice(0, 40)}" (conf ${a.confidence}, ${reasonSnip})`,
        );
      }
    }
    console.log(`  LLM mapper cost: $${mapperResult.cost.usdEstimate.toFixed(4)}`);
  } else {
    // Heuristic fallback path — same print as the old code
    console.log(`  [heuristic fallback: ${mapperResult.fallbackReason}]`);
    _printHeuristicAssignments(mapperResult.assignments);
  }

  // Convert mapper-llm assignments shape → internal shape used by Stage 2
  return mapperResult.assignments.map((a) => ({
    slot: scaffold.slots[a.slotIdx],
    slotIdx: a.slotIdx,
    slideIdx: a.slideIdx,
    score: a.confidence,
    fallback: a.reason?.startsWith('heuristic:') && a.slideIdx >= 0 && a.confidence === 0,
    empty: a.slideIdx === -1,
    mapperMethod: mapperResult.method,
    mapperReason: a.reason,
    mapperConfidence: a.confidence,
  }));
}

function _heuristicMapping() {
  const consumedSlides = new Set();
  const assignments = scaffold.slots.map((slot, slotIdx) => {
    let bestIdx = -1;
    let bestScore = -1;
    if (slotIdx === 0 && slot.name === 'cover') {
      for (let i = 0; i < slides.length; i++) {
        if (!consumedSlides.has(i)) {
          bestIdx = i;
          bestScore = 0;
          break;
        }
      }
    } else {
      for (let i = 0; i < slides.length; i++) {
        if (consumedSlides.has(i)) continue;
        const s = _scoreSlide(slides[i], slot);
        if (s > bestScore) {
          bestScore = s;
          bestIdx = i;
        }
      }
    }
    if (bestIdx >= 0 && bestScore > 0) {
      consumedSlides.add(bestIdx);
      return { slot, slotIdx, slideIdx: bestIdx, score: bestScore };
    }
    for (let i = 0; i < slides.length; i++) {
      if (!consumedSlides.has(i)) {
        consumedSlides.add(i);
        return { slot, slotIdx, slideIdx: i, score: 0, fallback: true };
      }
    }
    return { slot, slotIdx, slideIdx: -1, score: 0, empty: true };
  });
  _printHeuristicAssignments(assignments);
  return assignments;
}

function _scoreSlide(slide, slot) {
  const slideText = (
    String(slide.title || '') +
    ' ' +
    (slide.body || []).map((b) => (typeof b === 'string' ? b : b.text || '')).join(' ')
  ).toLowerCase();
  const slotKeywords = (slot.purpose + ' ' + slot.title)
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length >= 4);
  let score = 0;
  for (const kw of slotKeywords) {
    if (slideText.includes(kw)) score += 1;
  }
  return score;
}

function _printHeuristicAssignments(assignments) {
  console.log('  slot → slide mapping:');
  for (const a of assignments) {
    const tag = a.empty
      ? '[EMPTY]'
      : a.fallback
        ? '[FALLBACK]'
        : `score ${a.score ?? a.confidence}`;
    const slideTitle =
      a.slideIdx >= 0 ? slides[a.slideIdx]?.title || a.sourceTitle || '(untitled)' : '—';
    const slotName = a.slot ? a.slot.name : a.slotName;
    console.log(
      `    ${String(a.slotIdx).padStart(2)}. ${slotName.padEnd(20)} ← slide ${String(a.slideIdx).padStart(2)}: ${tag.padEnd(15)} ${slideTitle.slice(0, 60)}`,
    );
  }
}

const slotAssignments = await runStage1();

// ---------------------------------------------------------------------------
// Stage 1.5 — ORPHAN RESCUE (Sprint 25 round 3)
//
// When the source has a slide that fits NO slot semantically (e.g. a "$24M
// ARR" KPI highlight inside a change-roadmap-shaped deck), the mapper
// correctly leaves it unmapped — and its facts silently vanish from the
// deck. Prompt nudging can't fix this: the mapper's judgment is right, the
// scaffold just has no home for it.
//
// Deterministic rescue: attach each orphaned content slide to the assigned
// slot whose purpose scores highest (keyword heuristic), as extraSlides.
// Stage 2 passes the extra content to the lift with instructions to carry
// its data values. Every source slide's facts land SOMEWHERE, guaranteed.
// ---------------------------------------------------------------------------
{
  const mappedIdx = new Set(slotAssignments.filter((a) => !a.empty).map((a) => a.slideIdx));
  const orphans = slides
    .map((s, i) => ({ slide: s, idx: i }))
    .filter(({ idx }) => !mappedIdx.has(idx));
  const filled = slotAssignments.filter((a) => !a.empty && a.slot.name !== 'cover');
  if (orphans.length && filled.length) {
    console.log('\n── Stage 1.5: orphan rescue ──');
    for (const { slide, idx } of orphans) {
      let best = null;
      let bestScore = -1;
      for (const a of filled) {
        const s = _scoreSlide(slide, a.slot);
        if (s > bestScore) {
          bestScore = s;
          best = a;
        }
      }
      if (best) {
        best.extraSlides = best.extraSlides || [];
        best.extraSlides.push(idx);
        console.log(
          `  orphan slide ${idx} "${(slide.title || '').slice(0, 40)}" → merged into slot ${best.slotIdx} (${best.slot.name})`,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Stage 1.6 — PAGE FLOOR (Sprint 30)
//
// --min-pages N: when the mapper concentrates several slides into one slot
// (legitimate judgment) the delivered page count can fall below the target
// band. Deterministic redistribution: promote extraSlides out of the most
// loaded slot into empty slots until N pages are delivered or no donor
// remains. Same philosophy as orphan rescue — a pipeline floor, not prompt
// persuasion. No content is duplicated or invented: only slides that were
// going to be crammed into a shared slot get their own page back.
// ---------------------------------------------------------------------------
{
  const MIN_PAGES = Number(arg('--min-pages', 0));
  if (MIN_PAGES > 0) {
    const delivered = () => slotAssignments.filter((a) => !a.empty).length;
    if (delivered() < MIN_PAGES) console.log('\n── Stage 1.6: page floor ──');
    for (const empty of slotAssignments.filter((a) => a.empty)) {
      if (delivered() >= MIN_PAGES) break;
      let donor = null;
      for (const a of slotAssignments) {
        if (
          !a.empty &&
          Array.isArray(a.extraSlides) &&
          a.extraSlides.length > 0 &&
          (!donor || a.extraSlides.length > donor.extraSlides.length)
        )
          donor = a;
      }
      if (!donor) {
        console.log(`  page floor: no donor slots left (delivered ${delivered()}/${MIN_PAGES})`);
        break;
      }
      empty.empty = false;
      empty.slideIdx = donor.extraSlides.pop();
      empty.score = 'floor';
      console.log(
        `  page floor: slot ${empty.slotIdx} (${empty.slot.name}) ← slide ${empty.slideIdx} (from slot ${donor.slotIdx}'s extras)`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Stage 2 — Lift each slot with scaffold context
// ---------------------------------------------------------------------------
async function callAnthropic(userMessage) {
  const t0 = Date.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16384,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return { text: data.content[0].text, usage: data.usage, elapsed };
}

console.log('\n── Stage 2: slot lift ──');

if (DRY_RUN) {
  console.log('  [DRY RUN] skipping LLM calls');
}

const slotLifts = [];
let totalCost = 0;

for (const a of slotAssignments) {
  if (a.empty) {
    slotLifts.push({ slotIdx: a.slotIdx, empty: true });
    console.log(`  slot ${a.slotIdx} (${a.slot.name}): EMPTY — no slide assigned`);
    continue;
  }

  const slide = slides[a.slideIdx];
  const outFile = `${OUT_DIR}/slots/slot-${String(a.slotIdx).padStart(2, '0')}-${a.slot.name}.json`;

  if (!FORCE && existsSync(outFile) && !DRY_RUN) {
    console.log(`  ↳ skip slot ${a.slotIdx} (${a.slot.name}) — exists, use --force`);
    slotLifts.push({ slotIdx: a.slotIdx, cached: true, outFile });
    continue;
  }

  const userMessage = buildSlotUserMessage({
    scaffold,
    slot: a.slot,
    slotIdx: a.slotIdx,
    slideIdx: a.slideIdx,
    theme,
    slide,
    slides,
    extraSlides: a.extraSlides || [],
  });

  if (DRY_RUN) {
    slotLifts.push({
      slotIdx: a.slotIdx,
      slotName: a.slot.name,
      slideIdx: a.slideIdx,
      dryRun: true,
      promptChars: userMessage.length,
    });
    console.log(
      `  slot ${a.slotIdx} (${a.slot.name}): [DRY] prompt ${userMessage.length} chars, recommends ${a.slot.recommended_atoms.length} atoms`,
    );
    continue;
  }

  console.log(`  slot ${a.slotIdx} (${a.slot.name}): lifting from slide ${a.slideIdx}...`);
  try {
    const { text, usage, elapsed } = await callAnthropic(userMessage);
    const sceneData = parseSceneJson(text);
    const inCost = (usage.input_tokens * 3) / 1_000_000;
    const cacheCreateCost = ((usage.cache_creation_input_tokens || 0) * 3.75) / 1_000_000;
    const cacheReadCost = ((usage.cache_read_input_tokens || 0) * 0.3) / 1_000_000;
    const outCost = (usage.output_tokens * 15) / 1_000_000;
    const costUSD = inCost + cacheCreateCost + cacheReadCost + outCost;
    totalCost += costUSD;

    const entry = {
      slotIdx: a.slotIdx,
      slotName: a.slot.name,
      slotTitle: a.slot.title,
      slotPurpose: a.slot.purpose,
      sourceSlideIdx: a.slideIdx,
      sourceSlideTitle: slide.title || '',
      sceneData,
      meta: {
        scaffold: scaffold.id,
        theme: theme.id,
        recommendedAtoms: a.slot.recommended_atoms,
        forbiddenAtoms: a.slot.forbidden_atoms || [],
        tokenUsage: usage,
        costUSD,
        elapsedSec: parseFloat(elapsed),
        generatedAt: new Date().toISOString(),
        model: MODEL,
      },
    };
    writeFileSync(outFile, JSON.stringify(entry, null, 2));

    const subjectTypes = (sceneData.subjects || []).map((s) => s.type);
    console.log(`    ✓ ${elapsed}s $${costUSD.toFixed(4)} subjects=[${subjectTypes.join(', ')}]`);
    slotLifts.push({
      slotIdx: a.slotIdx,
      slotName: a.slot.name,
      sceneData,
      subjectTypes,
      costUSD,
      outFile,
    });
  } catch (e) {
    console.error(`    ✗ failed: ${e.message}`);
    slotLifts.push({ slotIdx: a.slotIdx, error: e.message });
  }
}

// ---------------------------------------------------------------------------
// Write deck.json manifest
// ---------------------------------------------------------------------------
const deckManifest = {
  deckName: DECK_NAME,
  sourceFile: SLIDEDATA_PATH.replace(REPO, ''),
  scaffold: {
    id: scaffold.id,
    label: scaffold.label,
    description: scaffold.description,
    pickScore: picked.score,
    pickSignals: picked.signals,
    fallback: picked.fallback,
    pickerMethod,
  },
  theme: {
    id: theme.id,
    label: theme.label,
    macroCluster: theme.macroCluster,
    bg: theme.bg,
    accent: theme.accent,
    colors: theme.colors,
    font: theme.font,
  },
  // Sprint 24 iter2 (contract A, user-approved 2026-07-05): slots[] contains
  // ONLY filled slots — the played deck has no holes. Unfillable slots are
  // recorded in droppedSlots[] for transparency (eval fill_rate = delivered /
  // (delivered + dropped), same meaning as before). slotIdx keeps the original
  // scaffold position (sparse is fine; consumers iterate the array).
  slots: slotAssignments
    .filter((a) => !a.empty)
    .map((a) => {
      const lift = slotLifts.find((l) => l.slotIdx === a.slotIdx) || {};
      return {
        slotIdx: a.slotIdx,
        slotName: a.slot.name,
        slotTitle: a.slot.title,
        slotPurpose: a.slot.purpose,
        sourceSlideIdx: a.slideIdx,
        sourceSlideTitle: a.slideIdx >= 0 ? slides[a.slideIdx].title || '' : null,
        mappingScore: a.score,
        mappingFallback: !!a.fallback,
        mappingEmpty: false,
        liftFile: lift.outFile ? lift.outFile.replace(`${OUT_DIR}/`, '') : null,
        cached: !!lift.cached,
        dryRun: !!lift.dryRun,
        error: lift.error || null,
        subjectTypes: lift.subjectTypes || [],
      };
    }),
  droppedSlots: slotAssignments
    .filter((a) => a.empty)
    .map((a) => ({
      slotIdx: a.slotIdx,
      slotName: a.slot.name,
      slotTitle: a.slot.title,
      reason: 'no-source-content',
    })),
  totals: {
    slotsBaked: slotLifts.filter((l) => l.sceneData || l.cached || l.dryRun).length,
    slotsEmpty: slotLifts.filter((l) => l.empty).length,
    slotsErrored: slotLifts.filter((l) => l.error).length,
    totalCostUSD: totalCost,
  },
  meta: {
    generatedAt: new Date().toISOString(),
    model: MODEL,
    pipelineVersion: 'sprint-16-v1',
  },
};

writeFileSync(`${OUT_DIR}/deck.json`, JSON.stringify(deckManifest, null, 2));

console.log(`\n══ Summary ══`);
console.log(`  Scaffold: ${scaffold.id}`);
console.log(`  Theme: ${theme.id}`);
console.log(`  Slots baked: ${deckManifest.totals.slotsBaked}/${scaffold.slots.length}`);
console.log(`  Slots empty: ${deckManifest.totals.slotsEmpty}`);
console.log(`  Errors: ${deckManifest.totals.slotsErrored}`);
console.log(`  Total cost: $${totalCost.toFixed(4)}`);
console.log(`  Manifest: ${OUT_DIR.replace(REPO, '')}/deck.json`);

// Helper for getTheme — silence unused-import lint
void getTheme;
void distributeSources;

process.exit(deckManifest.totals.slotsErrored > 0 ? 1 : 0);
