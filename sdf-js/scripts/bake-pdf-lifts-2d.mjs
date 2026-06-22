#!/usr/bin/env node
// =============================================================================
// bake-pdf-lifts-2d.mjs — 2D-mode lift baker for atoms-2d E2E demo
// -----------------------------------------------------------------------------
// Same shape as bake-pdf-lifts.mjs (3D variant) but invokes the lift LLM in
// 2D MODE — system prompt = base v3.34 + MODE_2D_ADDENDUM. Output SceneData
// is expected to contain atoms-2d subjects (kpi-card / sphere-fill / bar /
// dashboard-multi-kpi-composite / etc) instead of 3D primitives.
//
// Output: screens/e2e-sphere-fill/lifts/slide-N.json (one per slide)
//
// Usage: ANTHROPIC_API_KEY=sk-... node sdf-js/scripts/bake-pdf-lifts-2d.mjs
//        (or pass --key-file path/to/key.txt for env-less invocation)
//   --slide N    bake only slide N
//   --force      re-bake even if output exists
//   --max N      cap total slides (default all)
// =============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { emitSlide2dCode } from '../src/mapping/slide-to-2d-code.js';
// Import MODE_2D_ADDENDUM at runtime by reading compositor-api.js text
// (the constant is not exported); fallback: just rely on system prompt v3.34
// having the addendum baked-in via lift prompt — but our v3.34 has the
// addendum INLINE in the static .md, so we use that path.

// --- args ---
const args = process.argv.slice(2);
function arg(name, fallback = null) {
  const i = args.indexOf(name);
  return i > -1 ? args[i + 1] : fallback;
}
const ONLY_SLIDE = arg('--slide') !== null ? parseInt(arg('--slide'), 10) : null;
const FORCE = args.includes('--force');
const MAX = arg('--max') !== null ? parseInt(arg('--max'), 10) : null;
const KEY_FILE = arg('--key-file', null);

// --- API key resolution ---
let API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY && KEY_FILE && existsSync(KEY_FILE)) {
  const raw = readFileSync(KEY_FILE, 'utf8').trim();
  API_KEY = raw.startsWith('ANTHROPIC_API_KEY=') ? raw.slice('ANTHROPIC_API_KEY='.length) : raw;
}
if (!API_KEY) {
  console.error('ERROR: set ANTHROPIC_API_KEY env var or pass --key-file path');
  process.exit(2);
}

const MODEL = 'claude-sonnet-4-5-20250929';
const REPO = new URL('../..', import.meta.url).pathname;
const SLIDEDATA = `${REPO}sdf-js/examples/pdf-demo/slidedata.json`;
const LIFT_PROMPT_PATH = `${REPO}sdf-js/examples/compositor/system-prompt-lift-3d.md`;
const COMPOSITOR_API_PATH = `${REPO}sdf-js/src/compositor-api.js`;
const OUT_DIR = `${REPO}screens/e2e-sphere-fill/lifts`;
mkdirSync(OUT_DIR, { recursive: true });

// Extract MODE_2D_ADDENDUM by parsing compositor-api.js text
function extractAddendum() {
  const text = readFileSync(COMPOSITOR_API_PATH, 'utf8');
  const start = text.indexOf('const MODE_2D_ADDENDUM = `');
  if (start === -1) throw new Error('MODE_2D_ADDENDUM not found in compositor-api.js');
  // Find the matching closing backtick (template literal end). Walk forward.
  let i = start + 'const MODE_2D_ADDENDUM = `'.length;
  while (i < text.length) {
    if (text[i] === '`' && text[i - 1] !== '\\')
      return text.slice(start + 'const MODE_2D_ADDENDUM = `'.length, i);
    i++;
  }
  throw new Error('MODE_2D_ADDENDUM end backtick not found');
}

const slides = JSON.parse(readFileSync(SLIDEDATA, 'utf8'));
const systemPromptBase = readFileSync(LIFT_PROMPT_PATH, 'utf8');
const mode2dAddendum = extractAddendum();
const systemPrompt = systemPromptBase + mode2dAddendum;

console.log(
  `System prompt: ${systemPromptBase.length} + addendum ${mode2dAddendum.length} = ${systemPrompt.length} chars`,
);

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

const slidesToBake =
  ONLY_SLIDE !== null
    ? [ONLY_SLIDE]
    : MAX !== null
      ? slides.map((_, i) => i).slice(0, MAX)
      : slides.map((_, i) => i);

console.log(`Baking ${slidesToBake.length} slide(s) in 2D mode (atoms-2d) via ${MODEL}\n`);

const results = [];
let totalCost = 0;
let totalCacheReadTokens = 0;
let totalCacheCreateTokens = 0;

for (const i of slidesToBake) {
  const slide = slides[i];
  const id = `slide-${String(i).padStart(2, '0')}`;
  const outFile = `${OUT_DIR}/${id}.json`;

  if (!FORCE && existsSync(outFile)) {
    console.log(`  ↳ skip ${id} (exists; use --force)`);
    results.push({ id, skipped: true });
    continue;
  }

  const { prompt: rawPrompt, code2d, pattern } = emitSlide2dCode(slide);
  // The emitter's prompt explicitly instructs 3D lift ("In 3D, lift to a clean
  // bar/column chart on a stage..."). For 2D-mode atoms-2d testing we must
  // override that — replace the 3D directive with an atoms-2d directive so
  // the LLM doesn't follow the user prompt's 3D bias over the system addendum.
  const prompt = rawPrompt
    .replace(
      /In 3D, lift to[^.]*\./gi,
      'In 2D atoms-2d mode, route to an atoms-2d primitive per MODE_2D_ADDENDUM Priority 0.',
    )
    .replace(
      /corporate keynote aesthetic, not naturalistic\./gi,
      'Pick the canonical atoms-2d atom that fits the slide content (e.g. sphere-fill for "X% complete" / dashboard-multi-kpi-composite for grids of KPIs / bar+column for charts).',
    );
  const userMessage = `## Original user prompt\n\n${prompt}\n\n## Slide source 2D code\n\n\`\`\`js\n${code2d}\n\`\`\`\n\n## MODE\n\nThis is **2D mode (atoms-2d)**. Emit SceneData whose \`subjects[]\` consists of atoms-2d types (Priority 0). DO NOT emit \`text-3d-pipe\`, \`text-3d-extruded\`, \`box\`, \`rounded_box\`, or any SDF primitives — those are 3D-mode types. The output will be rendered via \`atoms-2d/renderer\` (Canvas2D, not GPU). Slide content describes spheres with fill-level percentages — STRONG signal to use \`sphere-fill\` atom (one per fill value).`;
  console.log(`[${i + 1}/${slides.length}] lifting ${id} (pattern=${pattern})...`);
  try {
    const { text, usage, elapsed } = await callAnthropic(userMessage);
    const sceneData = parseSceneJson(text);
    // Atoms-2d cost: cached system input is much cheaper; uncached is $3/M, cached $0.30/M
    const inCost = (usage.input_tokens * 3) / 1_000_000;
    const cacheCreateCost = ((usage.cache_creation_input_tokens || 0) * 3.75) / 1_000_000;
    const cacheReadCost = ((usage.cache_read_input_tokens || 0) * 0.3) / 1_000_000;
    const outCost = (usage.output_tokens * 15) / 1_000_000;
    const costUSD = inCost + cacheCreateCost + cacheReadCost + outCost;
    totalCost += costUSD;
    totalCacheReadTokens += usage.cache_read_input_tokens || 0;
    totalCacheCreateTokens += usage.cache_creation_input_tokens || 0;

    const entry = {
      id,
      title: `Slide ${i}: ${(slide.title || '(untitled)').slice(0, 60)}`,
      slideIndex: i,
      pattern,
      prompt,
      code2d,
      sceneData,
      meta: {
        generatedAt: new Date().toISOString(),
        model: MODEL,
        promptVersion: 'v3.34-2d',
        tokenUsage: usage,
        costUSD,
        elapsedSec: parseFloat(elapsed),
      },
    };
    writeFileSync(outFile, JSON.stringify(entry, null, 2));

    // Extract atom types from sceneData.subjects for quick visibility
    const subjectTypes = (sceneData.subjects || []).map((s) => s.type);
    console.log(
      `  ✓ ${id} ${elapsed}s $${costUSD.toFixed(4)} subjects=[${subjectTypes.join(', ')}]`,
    );
    results.push({ id, ok: true, costUSD, pattern, subjectTypes });
  } catch (e) {
    console.error(`  ✗ ${id} failed: ${e.message}`);
    results.push({ id, error: e.message });
  }
}

console.log('\n=== Summary ===');
console.log(`OK: ${results.filter((r) => r.ok).length}/${slidesToBake.length}`);
console.log(`Total cost: $${totalCost.toFixed(4)}`);
console.log(`Cache reads: ${totalCacheReadTokens} tokens, creates: ${totalCacheCreateTokens}`);
console.log(`Output: ${OUT_DIR.replace(REPO, '')}/`);

// Per-pattern stats
const patterns = {};
for (const r of results) {
  if (!r.ok) continue;
  patterns[r.pattern] = (patterns[r.pattern] || 0) + 1;
}
console.log(`Patterns:`, patterns);

// Per-atom usage count
const atomCount = {};
for (const r of results) {
  if (!r.subjectTypes) continue;
  for (const t of r.subjectTypes) atomCount[t] = (atomCount[t] || 0) + 1;
}
console.log(`Atom types emitted:`, atomCount);

process.exit(results.some((r) => r.error) ? 1 : 0);
