#!/usr/bin/env node
// =============================================================================
// bake-scaffold-pipeline.mjs — 2-call scaffold pipeline E2E baker
// -----------------------------------------------------------------------------
// Sprint 16 — End-to-end PDF → scaffolded deck.
//
// Stage 0: Pick scaffold (deterministic v1 from text content)
// Stage 1: Map source slides → scaffold slots (heuristic by purpose-keyword match)
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
// =============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename } from 'node:path';
import { pickScaffold, distributeSources } from '../src/present/scaffolds/picker.js';
import { pickScaffoldLLM } from '../src/present/scaffolds/picker-llm.js';
import { getTheme } from '../src/present/themes.js';

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
const SYSTEM_PROMPT_PATH = `${REPO}sdf-js/examples/compositor/system-prompt-lift-3d.md`;
const COMPOSITOR_API_PATH = `${REPO}sdf-js/src/compositor-api.js`;
// Output lives inside sdf-js so dev-server can serve deck.json + lifts to the
// browser viewer. (screens/ is outside sdf-js and not web-accessible.)
const OUT_DIR = `${REPO}sdf-js/examples/scaffold-pipeline/${DECK_NAME}`;
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(`${OUT_DIR}/slots`, { recursive: true });

// Extract MODE_2D_ADDENDUM from compositor-api.js (same as bake-pdf-lifts-2d.mjs)
function extractAddendum() {
  const text = readFileSync(COMPOSITOR_API_PATH, 'utf8');
  const start = text.indexOf('const MODE_2D_ADDENDUM = `');
  if (start === -1) return '';
  let i = start + 'const MODE_2D_ADDENDUM = `'.length;
  while (i < text.length) {
    if (text[i] === '`' && text[i - 1] !== '\\')
      return text.slice(start + 'const MODE_2D_ADDENDUM = `'.length, i);
    i++;
  }
  return '';
}

const slides = JSON.parse(readFileSync(SLIDEDATA_PATH, 'utf8'));
const systemPromptBase = readFileSync(SYSTEM_PROMPT_PATH, 'utf8');
const mode2dAddendum = extractAddendum();
const systemPrompt = systemPromptBase + mode2dAddendum;

console.log(
  `\n══ Scaffold Pipeline ══\nSource: ${SLIDEDATA_PATH.replace(REPO, '')}\nSlides: ${slides.length}\nOutput: ${OUT_DIR.replace(REPO, '')}/\n`,
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
// Heuristic: for each slot, score each unconsumed slide by purpose-keyword
// overlap. Pick the best match. If no slide scores > 0, leave slot empty.
// First slide is biased toward 'cover' slot.
// ---------------------------------------------------------------------------
console.log('── Stage 1: slot mapping ──');

function scoreSlideForSlot(slide, slot) {
  const slideText = (
    String(slide.title || '') +
    ' ' +
    (slide.body || []).map((b) => (typeof b === 'string' ? b : b.text || '')).join(' ')
  ).toLowerCase();
  const slotKeywords = (slot.purpose + ' ' + slot.title)
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length >= 4); // skip short words
  let score = 0;
  for (const kw of slotKeywords) {
    if (slideText.includes(kw)) score += 1;
  }
  return score;
}

const consumedSlides = new Set();
const slotAssignments = scaffold.slots.map((slot, slotIdx) => {
  let bestIdx = -1;
  let bestScore = -1;

  // Special-case slot 0 = cover → first unconsumed slide
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
      const s = scoreSlideForSlot(slides[i], slot);
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
  // Fallback: assign next unconsumed slide if any remain (so we don't skip)
  for (let i = 0; i < slides.length; i++) {
    if (!consumedSlides.has(i)) {
      consumedSlides.add(i);
      return { slot, slotIdx, slideIdx: i, score: 0, fallback: true };
    }
  }
  return { slot, slotIdx, slideIdx: -1, score: 0, empty: true };
});

console.log('  slot → slide mapping:');
for (const a of slotAssignments) {
  const tag = a.empty ? '[EMPTY]' : a.fallback ? '[FALLBACK]' : `score ${a.score}`;
  const slideTitle = a.slideIdx >= 0 ? slides[a.slideIdx].title || '(untitled)' : '—';
  console.log(
    `    ${a.slotIdx.toString().padStart(2)}. ${a.slot.name.padEnd(20)} ← slide ${a.slideIdx.toString().padStart(2)}: ${tag.padEnd(15)} ${slideTitle.slice(0, 60)}`,
  );
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

function parseSceneJson(text) {
  const m = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  let s = m ? m[1] : text.trim();
  if (!m && s.startsWith('{') === false) {
    const i = s.indexOf('{');
    const j = s.lastIndexOf('}');
    if (i >= 0 && j > i) s = s.slice(i, j + 1);
  }
  return JSON.parse(s);
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

  const bodyTexts = (slide.body || [])
    .map((b) => (typeof b === 'string' ? b : b.text || ''))
    .filter((t) => t && t.length > 0);

  const slotContext =
    `## SCAFFOLD CONTEXT\n\n` +
    `You are filling slot **${a.slotIdx + 1}/${scaffold.slots.length}** ` +
    `of a **${scaffold.label}** deck.\n\n` +
    `**Slot purpose**: ${a.slot.purpose}\n` +
    `**Slot title**: "${a.slot.title}" (this is the section header)\n\n` +
    `**Recommended atoms** (pick from this menu, in priority order):\n` +
    a.slot.recommended_atoms.map((t, i) => `  ${i + 1}. \`${t}\``).join('\n') +
    '\n\n' +
    (a.slot.forbidden_atoms && a.slot.forbidden_atoms.length > 0
      ? `**Forbidden atoms** (do NOT emit these in this slot):\n` +
        a.slot.forbidden_atoms.map((t) => `  - \`${t}\``).join('\n') +
        '\n\n'
      : '') +
    `**Theme** (use these colors):\n` +
    `  - bg: rgb(${theme.bg.join(', ')})\n` +
    `  - silhouetteColor: rgb(${theme.silhouetteColor.join(', ')})\n` +
    `  - accent: rgb(${theme.accent.join(', ')})\n` +
    `  - colors[]: ${theme.colors.map((c) => `rgb(${c.join(',')})`).join(' / ')}\n\n`;

  const userMessage =
    slotContext +
    `## SOURCE MATERIAL (slide ${a.slideIdx} from input deck)\n\n` +
    `**Title**: ${slide.title || '(untitled)'}\n\n` +
    `**Body**:\n` +
    bodyTexts.map((t) => `  - "${t}"`).join('\n') +
    '\n\n' +
    `## OUTPUT\n\n` +
    `Canvas: **1280×720**. Emit SceneData JSON for ONE slot:\n\n` +
    '```json\n' +
    `{\n` +
    `  "name": "${scaffold.id}/${a.slot.name}",\n` +
    `  "layout": "row|grid|hierarchy|stage|cover",\n` +
    `  "subjects": [\n` +
    `    { "type": "<atom-name>", "x": <px>, "y": <px>, "w": <px>, "h": <px>, "args": { ... } }\n` +
    `  ]\n` +
    `}\n` +
    '```\n\n' +
    `Rules (Sprint 17 polish — read CAREFULLY):\n` +
    `0. **Canvas bounds**: Every subject: x+w ≤ 1240, y+h ≤ 700.\n` +
    `1. **EVERY subject MUST have explicit x/y/w/h** in canvas pixels.\n` +
    `2. **Atom selection**: pick ONLY from the recommended_atoms menu (priority order). Fall back to cover+bullet-list ONLY if no recommended atom fits.\n` +
    `3. **Density — fill the canvas, don't leave 60% empty**. Aim for 3-6 subjects per slot (not 1). If source has 3 description blocks → emit 3 bullet-list / kpi-card / icon-badge atoms. If only 1, pair it with a cover top-strip + supporting context.\n` +
    `4. **Slot 0 (cover)** = single cover atom, h=720 full (deck cover, not used mid-deck).\n` +
    `5. **Cover atom when used mid-deck** (e.g. section header): h=120 TOP STRIP (x=0, y=0, w=1280). NEVER full-canvas cover unless slot 0.\n` +
    `6. **Theme**: pass \`color\` args as theme accent or colors[]. Don't invent colors.\n` +
    `7. **Body text preservation**: every body line lands in an atom's args. Acceptable shapes:\n` +
    `   - \`bullet-list\` args.items = \`[{label: "body line 1"}, {label: "body line 2"}]\` — use \`label\` key explicitly, NOT \`text\` or plain strings.\n` +
    `   - \`kpi-card\` args = \`{value: "HEADLINE", label: "Subtitle", sublabel: "Context"}\`. Keep value 1-3 words (e.g. "$3M", "1-2 Months", "Prototype Ready"); long phrases → .label or .sublabel.\n` +
    `   - \`icon-badge\` args = \`{name: "<phosphor-name>", label: "Caption"}\`. Pick semantic icon: briefcase / chart-bar / users / shield / lightning / globe / mail / phone / calendar / target / trophy / brain / building / wallet / chat-circle / device-mobile / wrench / rocket. NEVER default to "star".\n` +
    `8. **Empty bullets are a bug** — if items list is empty or only \`[{}]\` objects, you've failed. Populate every items[].label with actual text from source body.\n`;

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
  slots: slotAssignments.map((a) => {
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
      mappingEmpty: !!a.empty,
      liftFile: lift.outFile ? lift.outFile.replace(`${OUT_DIR}/`, '') : null,
      cached: !!lift.cached,
      dryRun: !!lift.dryRun,
      error: lift.error || null,
      subjectTypes: lift.subjectTypes || [],
    };
  }),
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
