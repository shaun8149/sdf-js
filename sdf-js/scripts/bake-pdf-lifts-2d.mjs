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
  // Strip emitter's 3D-mode bias
  const cleanPrompt = rawPrompt
    .replace(/In 3D, lift to[^.]*\./gi, 'In 2D atoms-2d mode.')
    .replace(/corporate keynote aesthetic, not naturalistic\./gi, '');

  // Extract ALL body text from the slide (LLM should use as captions)
  const bodyTexts = (slide.body || [])
    .map((b) => (typeof b === 'string' ? b : b.text || ''))
    .filter((t) => t && t.length > 0);

  // Detect % values to suggest layout pattern
  const percentValues = [];
  const percentRe = /(\d+)\s*%/g;
  for (const t of bodyTexts) {
    let m;
    percentRe.lastIndex = 0;
    while ((m = percentRe.exec(t)) !== null) percentValues.push(parseInt(m[1], 10));
  }
  const uniqValues = [...new Set(percentValues)];
  let layoutHint = '';
  if (uniqValues.length === 0) {
    layoutHint = 'LAYOUT: single cover atom for title-only slide';
  } else if (uniqValues.length === 1) {
    layoutHint =
      'LAYOUT: SINGLE HERO — one big sphere centered (w=460, h=460, x=410, y=120), descriptive text wrapped around as multiple cover/text atoms';
  } else if (uniqValues.length === 2) {
    layoutHint =
      'LAYOUT: 2-up row — two spheres side-by-side, each w=380, h=380, at y=160. x positions: 200, 700';
  } else if (uniqValues.length === 3) {
    layoutHint =
      'LAYOUT: 3-up row — three spheres at y=180. If one value dominates (100%): make CENTER sphere larger (w=420, h=420, x=430, y=120) and side spheres smaller (w=240, h=240, x=80/x=960, y=210). Otherwise equal sizing w=300, h=300, evenly spaced.';
  } else if (uniqValues.length === 4) {
    layoutHint = 'LAYOUT: 4-up row — four spheres at y=160, each w=260, h=320. x=20+i*310';
  } else if (uniqValues.length === 5) {
    const sorted = [...uniqValues].sort((a, b) => a - b);
    const span = sorted[sorted.length - 1] - sorted[0];
    const hasOneDominant = sorted[sorted.length - 1] === 100 && sorted.length >= 3;
    if (hasOneDominant) {
      // PL "stage" composition: 100% sphere in CENTER big, smaller wings around
      layoutHint =
        'LAYOUT: STAGE composition (one value dominates, e.g. 100%). Center hero + wings. EXACT positions:\n' +
        '   - 100% sphere (biggest): x=480, y=200, w=320, h=320 (CENTER)\n' +
        '   - 2nd largest (e.g. 80%): x=920, y=260, w=240, h=240 (right wing)\n' +
        '   - 3rd (e.g. 50%): x=120, y=260, w=240, h=240 (left wing)\n' +
        '   - 4th (e.g. 40%): x=160, y=560, w=140, h=140 (behind-right small, partial)\n' +
        '   - 5th (e.g. 20%): x=380, y=120, w=120, h=120 (behind-left small)\n' +
        '   Each x+w ≤ 1240 strictly. NO sphere off canvas.';
    } else if (span >= 60) {
      layoutHint =
        'LAYOUT: SIZE-ENCODED row — 5 spheres at y=200 baseline. Each sphere size scales with value. EXACT coords:\n' +
        '   - smallest value: x=80,  w=140, h=180\n' +
        '   - 2nd:           x=260,  w=180, h=220\n' +
        '   - middle:        x=480,  w=220, h=260\n' +
        '   - 4th:           x=740,  w=240, h=280\n' +
        '   - largest:       x=1010, w=260, h=300\n' +
        '   All within 0-1240. Order spheres LEFT→RIGHT by value (ascending).';
    } else {
      layoutHint =
        'LAYOUT: 5-up uniform row at y=200 — each w=220, h=300, x=40+i*240 (so x: 40, 280, 520, 760, 1000). All x+w ≤ 1240.';
    }
  } else if (uniqValues.length >= 6 && uniqValues.length <= 10) {
    const sorted = [...uniqValues].sort((a, b) => a - b);
    const isProgression =
      sorted.length >= 5 && sorted.every((v, i) => i === 0 || v - sorted[i - 1] === 10);
    if (isProgression) {
      layoutHint =
        `LAYOUT: ${uniqValues.length} sphere SIZE-ENCODED PROGRESSION in **2 ROWS OF 5**.\n` +
        '   Row 1 (low values 10/20/30/40/50%): y_top = 80, sphere_h varies\n' +
        '   Row 2 (high values 60/70/80/90/100%): y_top = 400, sphere_h varies\n' +
        '   Within each row, 5 spheres evenly spaced left-to-right.\n' +
        '   Sphere SIZE: w = h = 100 + value * 1.4. Examples:\n' +
        '   - 10% → w=h=114, 20% → w=h=128, 30% → w=h=142, 40% → w=h=156, 50% → w=h=170\n' +
        '   - 60% → w=h=184, 70% → w=h=198, 80% → w=h=212, 90% → w=h=226, 100% → w=h=240\n' +
        '   x positions for each row (5 cells in canvas width 1280):\n' +
        '   - column centers: 152, 392, 632, 872, 1112 → x = center - w/2\n' +
        '   y positions: align bottoms to a baseline (so spheres "stand on a floor"):\n' +
        '   - Row 1 baseline y_bottom = 360. So y = 360 - h\n' +
        '   - Row 2 baseline y_bottom = 690. So y = 690 - h\n' +
        '   NO sphere extends past x=1240 or y=700.';
    } else {
      layoutHint = `LAYOUT: ${Math.ceil(uniqValues.length / 5)}×5 grid uniform size — each w=210, h=260. y row 1 = 60, row 2 = 380. x = 40 + col*250 (col 0..4).`;
    }
  } else {
    layoutHint = `LAYOUT: ${Math.ceil(uniqValues.length / 5)}×5 grid uniform size`;
  }

  const userMessage =
    `## Original user prompt\n\n${cleanPrompt}\n\n` +
    `## Slide body text (CARRY THESE INTO atom args.caption — do NOT discard)\n\n` +
    bodyTexts.map((t) => `  - "${t}"`).join('\n') +
    `\n\n` +
    `## Slide source 2D code\n\n\`\`\`js\n${code2d}\n\`\`\`\n\n` +
    `## REQUIRED OUTPUT — Atlas atoms-2d 2D mode\n\n` +
    `Canvas size: **1280×720**. Use the full space.\n\n` +
    `Emit SceneData JSON:\n` +
    '```json\n' +
    `{\n` +
    `  "name": "compose: <title>",\n` +
    `  "layout": "row|grid|hierarchy|size-encoded|stage|scatter|cover",\n` +
    `  "subjects": [\n` +
    `    { "type": "<atom-name>", "x": <px>, "y": <px>, "w": <px>, "h": <px>, "args": { ... } }\n` +
    `  ]\n` +
    `}\n` +
    '```\n\n' +
    `### MANDATORY rules:\n\n` +
    `0. **CANVAS BOUNDS HARD LIMIT**: Every subject's \`x + w ≤ 1240\` AND \`y + h ≤ 700\`. NO sphere may extend off canvas (right edge, bottom edge). Validate before emitting. If layout requires bigger spheres than fit, scale them down proportionally.\n` +
    `1. **EVERY subject MUST have explicit \`x\`, \`y\`, \`w\`, \`h\`** in canvas pixels. Missing positions → atoms overlap at full canvas. NO exceptions.\n` +
    `2. **Body captions**: sphere-fill atom now accepts \`args.caption: string\`. Pass the relevant body text (e.g. "Description 1: Placeholder for your text" → \`caption: "Description 1"\`). Match each sphere to its nearest body description; don't lose user text.\n` +
    `3. **Atom selection**:\n` +
    `   - Sphere with fill % → \`sphere-fill\` (args: \`value\` 0-100, \`label\` "20%", \`caption\` "Description 1", \`color\` rgb)\n` +
    `   - Title/cover slide → \`cover\` atom (args: \`title\`, \`subtitle\`)\n` +
    `   - NEVER emit \`text-3d-pipe\`, \`box\`, \`rounded_box\`\n` +
    `4. **${layoutHint}**\n` +
    `5. **Match PL visual style**: PL doesn't use uniform grids when values differ — they use SIZE encoding, stage composition, hierarchy. Follow the layout hint above; don't default to row-of-equals.\n` +
    `6. **Colors**: default \`[42, 96, 178]\` (blue). When slide shows colored variants (green/red/purple), use matching colors per sphere.\n`;
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
      prompt: cleanPrompt,
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
