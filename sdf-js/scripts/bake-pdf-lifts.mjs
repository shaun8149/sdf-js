#!/usr/bin/env node
// =============================================================================
// bake-pdf-lifts.mjs — one-shot lift baker for the 20-slide PDF demo deck
// -----------------------------------------------------------------------------
// Reads sdf-js/examples/pdf-demo/slidedata.json (baked SlideData), runs the
// emitter per slide to get {prompt, code2d}, calls Anthropic with lift v3.17
// system prompt, writes each result to
// sdf-js/examples/compositor/demo-lifts/pdf-slide-N.json (format matches
// _template.json), then updates demo-lifts/index.json with 20 new entries.
//
// Cost: ~$0.21 per slide × 20 = ~$4.20 (measured 2026-06-19 with v3.16).
//
// Usage: ANTHROPIC_API_KEY=sk-ant-... node sdf-js/scripts/bake-pdf-lifts.mjs
// Idempotent: skips a slide if its output file already exists.
// Pass --force to re-bake everything.
// Pass --slide N to bake only slide N (e.g. --slide 3 for testing).
// =============================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { emitSlide2dCode } from '../src/mapping/slide-to-2d-code.js';

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('✗ ANTHROPIC_API_KEY env var required.');
  console.error('  ANTHROPIC_API_KEY=sk-ant-... node sdf-js/scripts/bake-pdf-lifts.mjs');
  process.exit(1);
}
const MODEL = process.env.MODEL || 'claude-sonnet-4-5';
const FORCE = process.argv.includes('--force');
const slideArg = process.argv.indexOf('--slide');
const ONLY_SLIDE = slideArg > 0 ? parseInt(process.argv[slideArg + 1], 10) : null;

const REPO = new URL('../..', import.meta.url).pathname;
const SLIDEDATA = `${REPO}sdf-js/examples/pdf-demo/slidedata.json`;
const LIFT_PROMPT_PATH = `${REPO}sdf-js/examples/compositor/system-prompt-lift-3d.md`;
const OUT_DIR = `${REPO}sdf-js/examples/compositor/demo-lifts`;
const INDEX_PATH = `${OUT_DIR}/index.json`;

const slides = JSON.parse(readFileSync(SLIDEDATA, 'utf8'));
const systemPrompt = readFileSync(LIFT_PROMPT_PATH, 'utf8');

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
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  if (res.ok === false) {
    throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
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

const results = [];
let totalCost = 0;

const slidesToBake = ONLY_SLIDE !== null ? [ONLY_SLIDE] : slides.map((_, i) => i);
console.log(`Baking ${slidesToBake.length} slide(s) via ${MODEL}…\n`);

for (const i of slidesToBake) {
  const slide = slides[i];
  const id = `pdf-slide-${i}`;
  const outFile = `${OUT_DIR}/${id}.json`;

  if (FORCE === false && existsSync(outFile)) {
    console.log(`  ↳ skip ${id} (exists; use --force to re-bake)`);
    results.push({ id, skipped: true });
    continue;
  }

  const { prompt, code2d, pattern } = emitSlide2dCode(slide);
  const userMessage = `## Original user prompt\n\n${prompt}\n\n## 2D SDF code\n\n\`\`\`js\n${code2d}\n\`\`\``;

  console.log(`[${i + 1}/${slides.length}] lifting ${id} (${pattern})...`);
  try {
    const { text, usage, elapsed } = await callAnthropic(userMessage);
    const sceneData = parseSceneJson(text);
    const costUSD = (usage.input_tokens * 3 + usage.output_tokens * 15) / 1_000_000;
    totalCost += costUSD;
    const entry = {
      id,
      title: `Slide ${i}: ${(slide.title || '(untitled)').slice(0, 40)}`,
      prompt,
      code2d,
      sceneData,
      meta: {
        generatedAt: new Date().toISOString().slice(0, 10),
        model: MODEL,
        promptVersion: 'v3.17',
        pattern,
        slideIndex: i,
        tokenUsageLift: usage,
        costUSD,
        elapsedSec: parseFloat(elapsed),
      },
    };
    writeFileSync(outFile, JSON.stringify(entry, null, 2));
    console.log(`  ✓ wrote ${outFile.replace(REPO, '')} (${elapsed}s, $${costUSD.toFixed(4)})`);
    results.push({ id, ok: true, costUSD, pattern });
  } catch (e) {
    console.error(`  ✗ ${id} failed: ${e.message}`);
    results.push({ id, error: e.message });
  }
}

// Update index.json with new entries (idempotent — replace existing pdf-slide-* entries)
console.log('\nUpdating demo-lifts/index.json…');
const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
const keep = index.demos.filter((d) => d.id.startsWith('pdf-slide-') === false);
const allBakedIds = slides.map((_, i) => `pdf-slide-${i}`);
const newEntries = allBakedIds
  .filter((id) => existsSync(`${OUT_DIR}/${id}.json`))
  .map((id) => {
    const e = JSON.parse(readFileSync(`${OUT_DIR}/${id}.json`, 'utf8'));
    return {
      id: e.id,
      title: e.title,
      thesisPoint: `M1.5 Step 2b — PDF deck slide ${e.meta.slideIndex} lifted via v3.17 prompt. Pattern: ${e.meta.pattern}. End-to-end PDF→2D→lift→3D pipeline.`,
      category: 'presentation-slide',
      status: 'ready',
      file: `${e.id}.json`,
      prompt: e.prompt,
    };
  });
index.demos = [...keep, ...newEntries].sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
console.log(
  `  ✓ updated ${INDEX_PATH.replace(REPO, '')} (${newEntries.length} pdf-slide-* entries)`,
);

// Audit: how many used text-3d-pipe correctly?
console.log('\n--- audit: which atom types did v3.17 emit? ---');
let pipeCount = 0,
  extCount = 0,
  anyTextCount = 0;
for (const r of results) {
  if (!r.ok) continue;
  const sd = JSON.parse(readFileSync(`${OUT_DIR}/${r.id}.json`, 'utf8')).sceneData;
  const types = JSON.stringify(sd.subjects.map((s) => s.type));
  const hasPipe = types.includes('text-3d-pipe');
  const hasExt = types.includes('text-3d-extruded');
  if (hasPipe) pipeCount++;
  if (hasExt) extCount++;
  if (hasPipe || hasExt) anyTextCount++;
  console.log(
    `  ${r.id} (${r.pattern}): ${hasPipe ? 'pipe' : ''}${hasPipe && hasExt ? '+' : ''}${hasExt ? 'extruded' : ''}${!hasPipe && !hasExt ? '(no text-3d atom)' : ''}`,
  );
}

console.log(`\nFinal:`);
console.log(`  pipe-used:     ${pipeCount}/${results.length} slides`);
console.log(`  extruded-used: ${extCount}/${results.length} slides`);
console.log(`  any-text:      ${anyTextCount}/${results.length} slides`);
console.log(`  total cost:    $${totalCost.toFixed(4)}`);
