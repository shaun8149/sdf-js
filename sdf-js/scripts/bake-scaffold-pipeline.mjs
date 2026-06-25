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

const systemPrompt =
  `You are the Atlas Present scaffold-mode lift LLM. Emit a single JSON ` +
  `SceneData object inside a \`\`\`json fence with no prose. Atoms are 2D ` +
  `Canvas primitives — no 3D, no text-3d-pipe.\n\n` +
  `# CORE GOAL: Atlas decks are 3D theatrical presentations. TEXT MUST BE MINIMAL. ` +
  `Use icons + charts to replace verbose phrases. Audience reads a slide in ` +
  `≤3 seconds; long prose disappears in 3D space.\n\n` +
  (await buildAtomCatalogString()) +
  '\n\n' +
  buildIconCatalogString();

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

  const workedExamples =
    `## WORKED EXAMPLES (study these patterns)\n\n` +
    `### Example A — values slide:\n` +
    `Source body: "We believe in Trust, Quality, Speed, Customer Focus"\n` +
    `GOOD output:\n` +
    '```json\n' +
    `{ "subjects": [\n` +
    `  { "type": "cover", "x": 0, "y": 0, "w": 1280, "h": 120,\n` +
    `    "args": {"title": "Our Values"} },\n` +
    `  { "type": "icon-row", "x": 40, "y": 160, "w": 1200, "h": 480,\n` +
    `    "args": {\n` +
    `      "items": [\n` +
    `        {"icon": "shield", "label": "Trust"},\n` +
    `        {"icon": "sparkle", "label": "Quality"},\n` +
    `        {"icon": "lightning", "label": "Speed"},\n` +
    `        {"icon": "heart", "label": "Customer Focus"}\n` +
    `      ]\n` +
    `    }\n` +
    `  }\n` +
    `]}\n` +
    '```\n' +
    `BAD: bullet-list with "We believe in Trust" etc.\n\n` +
    `### Example B — KPI dashboard:\n` +
    `Source body: "Q3 results: Revenue $3.4M (+27%), MAU 12,450, Churn 2.1%"\n` +
    `GOOD: 3× \`kpi-card\` atoms with value=$3.4M / 12.4K / 2.1% — no prose.\n\n` +
    `### Example C — time series:\n` +
    `Source body: "ARR: Q1 $0, Q2 $120K, Q3 $740K, Q4F $2.4M"\n` +
    `GOOD: { "type": "line", "args": {"values":[0,0.12,0.74,2.4],"labels":["Q1","Q2","Q3","Q4F"],"format":"currency","title":"ARR Growth"} }\n\n` +
    `### Example D — feature list with inline icons (bullet-list with icons):\n` +
    `Source body: "Mobile wallet / AI co-pilot / E2E encryption / Cross-chain"\n` +
    `GOOD: { "type": "bullet-list", "args": {"items":[\n` +
    `  {"icon": "device-mobile", "label": "Mobile-first wallet"},\n` +
    `  {"icon": "brain", "label": "AI co-pilot"},\n` +
    `  {"icon": "lock-key", "label": "End-to-end encryption"},\n` +
    `  {"icon": "link", "label": "Cross-chain liquidity"}\n` +
    `]} }\n\n`;

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
    workedExamples +
    `Rules (Sprint 18 v5 — aggressive text minimization + atom variety):\n` +
    `0. **CANVAS BOUNDS**: Every subject: x+w ≤ 1240, y+h ≤ 700.\n` +
    `1. **EVERY subject MUST have explicit x/y/w/h** in canvas pixels.\n` +
    `2. **Atom selection**: pick from recommended_atoms (priority order). Use forbidden_atoms as hard negative.\n` +
    `3. **HARD TEXT BUDGET (this is a 3D theater, not a document!)**:\n` +
    `   - icon-row / icon-grid items[].label: **≤ 2 words** (e.g. 'Trust', 'Self-Custodial', 'Cross-Chain' — NOT 'Self-custodial trading approach')\n` +
    `   - bullet-list items[].label: **≤ 5 words** (was unlimited; now hard cap — strip verbs / articles / fluff)\n` +
    `   - kpi-card.value: **1-3 words** (e.g. '$3M', '92%', '1-2 Months')\n` +
    `   - cover.title: **≤ 3 words** for section strips; deck-cover allowed full title\n` +
    `   - Any label exceeding budget gets the meaning compressed by you BEFORE emit\n` +
    `4. **NUMBERS → CHART, never prose**:\n` +
    `   - 3+ KPI values → multiple \`kpi-card\` or 1 \`dashboard-multi-kpi-composite\`\n` +
    `   - Time series (4+ points) → \`line\` or \`bar\`\n` +
    `   - Proportions/shares → \`pie\` or \`waterfall\`\n` +
    `   - Funnel/pipeline → \`funnel\`\n` +
    `   - Single percentage → \`sphere-fill\` or \`kpi-card\` or \`kpi-water-drop\`\n` +
    `   - NEVER describe numbers in bullet-list when a chart fits\n` +
    `5. **VARIETY rule**: Look at adjacent slots' emit history. If the previous slot used \`icon-row\`, prefer \`icon-grid\` / \`bullet-list\` / chart atom THIS slot. Goal: ≥ 6 distinct atom types across deck (cover excluded). Atoms you should rotate through: cover / icon-row / icon-grid / bullet-list / kpi-card / agenda-list / progression / pyramid / pie / line / bar / funnel / waterfall / scatter / sphere-fill / venn / matrix-grid / nine-field-matrix / dashboard-multi-kpi-composite / fishbone / mindmap / org-chart / tree-diagram / circle-image-hub-spoke / device-mockup-row / isotype-people-grid.\n` +
    `6. **SHORT CONCEPTS → icon + 1-2 word label**, not phrase:\n` +
    `   - "Values: Trust, Quality, Speed, Customer Focus" → \`icon-row\` with [{icon:'shield',label:'Trust'},{icon:'sparkle',label:'Quality'},...]\n` +
    `   - Single-word bullets → \`icon-row\` (4-6 items) or \`icon-grid\` (6-12 items)\n` +
    `   - NEVER \`bullet-list\` with all 1-2-word items — use icon-row/grid\n` +
    `7. **bullet-list MUST have inline icons** unless content is truly paragraph-like:\n` +
    `   - Every \`items[*]\` should have \`icon: '<name>'\` from the catalog above\n` +
    `   - Empty bullets (no icon, no real label) = a bug\n` +
    `8. **Cover atom**:\n` +
    `   - Slot 0 deck cover → h=720 full, style: 'gradient'\n` +
    `   - Mid-deck title strip → h=120 TOP STRIP\n` +
    `   - Section divider slot → h=720 full + style: 'section'\n` +
    `   - **Section divider slot detected (slot name = 'section-divider')**: emit a SINGLE cover atom at x=0/y=0/w=1280/h=720 with \`args.style: 'section'\` (deep accent + box-behind-title). Title should be ≤ 3 words (e.g. 'PRODUCT', 'TEAM', 'VISION').\n` +
    `9. **icon-row / icon-grid args**:\n` +
    `   - items: [{icon: '<phosphor-name | brand:slug | flag:code>', label: '1-2 words MAX', sublabel?: '3-5 words'}]\n` +
    `   - icon-row: 2-8 items horizontally (auto wraps to 2 rows when ≥7)\n` +
    `   - icon-grid: 4-16 items (cols auto-picks)\n` +
    `   - colorMode default 'auto' (brand icons keep brand color; Phosphor uses theme accent)\n` +
    `   - **iconSize: 'small'|'medium'|'large'** (Sprint 18 Tier 1) — default 'medium'. Use 'large' for hero slots (vision/values with only 3-4 items at h≥360). 'small' only for dense 12+ item grids.\n` +
    `   - iconStyle: 'circle' (default; icon in pseudo-3D badge) | 'card' (item is white card with icon + label + sublabel; PL services 4-up pattern, use for services/features slots) | 'square'|'plain'\n` +
    `10. **kpi-card.style variants** (Sprint 18 Tier 1):\n` +
    `    - \`style: 'dark'\` (default): dark bg + white text — single hero KPI (e.g. one big number per slot)\n` +
    `    - \`style: 'light'\`: white bg + dark text + accent edge — dashboard grids of 3-6 KPIs (cleaner, less heavy)\n` +
    `    - \`style: 'accent-border'\`: white bg + thick left accent border — single sidebar KPI (e.g. "30% retention" callout next to bullet content)\n` +
    `    - Mix styles within a deck: hero KPI dark + dashboard KPIs light. Don't use all-dark for 6-card grid (overwhelming).\n` +
    `11. **Theme color**: pass theme accent or colors[] for non-brand icons. Don't invent colors.\n` +
    `12. **Undeclared args = bug**: don't add accentColor / iconColor / fontSize / anything not in the atom spec — atoms silently ignore unknown args, you're wasting tokens.\n` +
    `13. **Semantic atom selection (Sprint 18 Tier 3 A.2)** — when slot purpose matches a specialized atom, USE IT instead of falling back to bullet-list:\n` +
    `    - cause-analysis slots (Challenges / Risks / Blockers / Problems / Root Cause) → \`fishbone\` (effect=problem statement, branches=cause categories with sub-causes)\n` +
    `    - dated action items / roadmap slots (Next Steps / Milestones / Roadmap / Action Items with due dates) → \`timeline\` (events: array of {date, label, sublabel?})\n` +
    `    - time-series numeric slots (Growth / Traction / Trend) → \`line\` or \`column\`\n` +
    `    - process / workflow slots (How It Works / Pipeline) → \`flow-chart\` or \`progression\`\n` +
    `    - 2-set comparison slots (Before/After / Us vs Them) → \`venn\` or side-by-side kpi-cards\n` +
    `    Specialized atoms communicate semantics in 3D theatrical playback — bullet-list reads as "they had no better atom".\n` +
    `14. **NEVER emit \`type: "text"\`** — there is NO text atom. For corner attribution (author / date / version) use cover's \`author\`/\`date\`/\`version\` args. For floating labels INSIDE a chart, set the chart atom's title/labels args. If you can't express something via an atom + its args, omit it.\n` +
    `15. **Image atoms (Sprint 18 Tier 3 C)** — strictly bound to images that were ALREADY embedded in the user's source document. We do NOT call image-generation models, we do NOT search the internet for stock photos:\n` +
    `    - Use ONLY when slide.body contains an explicit src for an image the user already had (look for "image:" lines pointing to data: URIs, OR relative paths the parser emitted from embedded images).\n` +
    `    - If no such src exists in source, OMIT image atoms entirely. NEVER fabricate URLs. NEVER add picsum / unsplash / any internet host. NEVER write "image: https://..." that isn't in the source.\n` +
    `    - When you DO have a valid src: hero slot with one dominant image + title/body/bullets → \`image-split\`; full-bleed photo with caption → \`image\` (fit:'cover').\n` +
    `    - DO NOT use image atoms for purely numeric / list / process content — specialized atoms (kpi-card / fishbone / timeline / flow-chart) are better.\n` +
    `16. **Prefer specialized Sprint 19 atoms when content matches their semantic** — these atoms communicate meaning in 3D theatrical playback better than generic alternatives:\n` +
    `    - "N core values / strategic pillars / principles" with 3-8 items → \`radial-wheel-segmented\` (NOT \`icon-grid\`)\n` +
    `    - Hero quote / testimonial / founder statement → \`quote-pull\` (NOT raw \`bullet-list\`)\n` +
    `    - Headline single metric ("$24M ARR ↑117%") → \`stat-banner\` (NOT a kpi-card on full canvas)\n` +
    `    - Section break ("01 Findings") between major slot groups → \`section-number-divider\` (NOT cover-only)\n` +
    `    - 2x2 strategic analysis (Strengths/Weaknesses/Opportunities/Threats or similar) → \`swot\` (NOT \`matrix-grid\`)\n` +
    `    - Porter-style primary+support activity chain → \`value-chain-diagram\` (NOT \`flow-chart\`)\n` +
    `    - N-tier feature comparison ("Free vs Pro vs Enterprise") → \`comparison-table\` (NOT side-by-side \`kpi-card\`s)\n` +
    `    - Transformation S-curve (Kübler-Ross / journey phases) → \`change-curve-chart\` (NOT \`line\` chart with annotations)\n` +
    `17. **PL-recommendations atoms (Sprint 22 B1)** — when content matches PL signature patterns, prefer the specialized PL atom:\n` +
    `    - Goal-progression with named milestones / "climb to X" / "path to Y" narrative → \`mountain-path\` (NOT \`progression\`)\n` +
    `    - Kaplan/Norton balanced scorecard / 4-perspective strategy / Financial-Customer-Process-Learning grouping → \`strategy-map\` (NOT \`matrix-grid\`)\n` +
    `    - Multi-axis capability/competency assessment ("AI maturity radar", "skill profile") with 3-9 axes → \`radar-chart\` (NOT \`radial-spoke\`)\n` +
    `    - OKR slide (1 Objective + N Key Results with progress %) → \`okr-tree\` (NOT generic \`tree-diagram\`)\n`;

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
