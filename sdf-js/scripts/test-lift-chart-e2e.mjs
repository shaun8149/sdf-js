#!/usr/bin/env node
// =============================================================================
// test-lift-chart-e2e.mjs — REAL end-to-end lift test for the chart-label chain.
// Calls the Anthropic API with the actual lift system prompt (base + MODE_3D
// addendum) on a couple of chart prompts, then reports WHICH label path the LLM
// emits — the only link in the chain still verified by assumption, not a real
// model run. Then it runs the #89 connector (expandChartLabels) + compiles, to
// see whether the output is render-ready and whether the connector fires.
//
// Usage: ANTHROPIC_API_KEY=sk-ant-... node sdf-js/scripts/test-lift-chart-e2e.mjs
//   optional: MODEL=claude-sonnet-4-5 (default)
// BYOK — the key is read from the environment and only sent to api.anthropic.com.
// =============================================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { MODE_3D_ADDENDUM, parseLiftResponse } from '../src/compositor-api.js';
import { expandChartLabels } from '../src/scene/chart-labels.js';
import { compile } from '../src/scene/index.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('✗ ANTHROPIC_API_KEY env var required (BYOK).');
  console.error('  ANTHROPIC_API_KEY=sk-ant-... node sdf-js/scripts/test-lift-chart-e2e.mjs');
  process.exit(1);
}
const MODEL = process.env.MODEL || 'claude-sonnet-4-5';
const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_PROMPT = readFileSync(
  resolve(__dirname, '../examples/compositor/system-prompt-lift-3d.md'),
  'utf8',
);
const SYSTEM = BASE_PROMPT + MODE_3D_ADDENDUM;

const CASES = [
  {
    name: 'bar chart (quarterly revenue, $ labels)',
    prompt: 'Quarterly revenue bar chart: Q1 $1.2M, Q2 $2.0M, Q3 $3.4M, Q4 $2.6M',
    code2d:
      '// 2D bar chart: 4 bars heights [1.2,2.0,3.4,2.6], labels ["$1.2M","$2.0M","$3.4M","$2.6M"]',
  },
  {
    name: 'pie chart (market share, % labels)',
    prompt: 'Market share donut: AWS 35%, Azure 25%, GCP 22%, Other 18%',
    code2d: '// 2D donut: values [35,25,22,18], labels ["35%","25%","22%","18%"]',
  },
];

async function lift(c) {
  const userMessage = `## Original user prompt\n\n${c.prompt}\n\n## 2D SDF code\n\n\`\`\`js\n${c.code2d}\n\`\`\``;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      system: SYSTEM,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return { text: data.content[0].text, usage: data.usage };
}

const CHART_TYPES = new Set([
  'bar-3d',
  'column-3d',
  'line-3d',
  'pie-3d',
  'sphere-fill-3d',
  'matrix-grid-3d',
]);

for (const c of CASES) {
  console.log(`\n=== ${c.name} ===`);
  try {
    const { text, usage } = await lift(c);
    const scene = parseLiftResponse(text);
    const subs = scene.subjects || [];
    const types = subs.map((s) => s.type);
    const chart = subs.find((s) => CHART_TYPES.has(s.type));
    const pipeLabels = subs.filter((s) => s.type === 'text-3d-pipe');
    const hasArgsLabels = !!(chart && chart.args && Array.isArray(chart.args.labels));
    const hasAnnotations = Array.isArray(scene.annotations) && scene.annotations.length > 0;
    const hasOverlay = !!scene.overlay;

    console.log(`  tokens: in ${usage.input_tokens} / out ${usage.output_tokens}`);
    console.log(`  subjects (${subs.length}): ${types.join(', ')}`);
    console.log(`  chart atom: ${chart ? chart.type : '(NONE — LLM hand-rolled?)'}`);
    console.log(`  LABEL PATH →`);
    console.log(
      `    • args.labels on chart atom: ${hasArgsLabels ? 'YES (connector path #89)' : 'no'}`,
    );
    console.log(`    • separate text-3d-pipe subjects: ${pipeLabels.length} (Path A)`);
    console.log(
      `    • annotations[] overlay: ${hasAnnotations ? scene.annotations.length : 0} (Path B)`,
    );
    console.log(`    • overlay narrative field: ${hasOverlay ? 'YES' : 'no'}`);

    // run the #89 connector — does it inject anything? (only if LLM used args.labels)
    const expanded = expandChartLabels(scene);
    const injected = expanded.subjects.length - subs.length;
    console.log(`  connector expandChartLabels injected: ${injected} label subjects`);

    // compile (CPU) — render-ready?
    try {
      const comp = compile(expanded);
      const g = compileSDF3ToGLSL(comp.sdf, {
        sceneFnName: 'sceneSDF',
        includeLibrary: true,
        emitObjectIndex: true,
      });
      const glsl = typeof g === 'string' ? g : g.glsl;
      const e = comp.sanityResult ? comp.sanityResult.errors.length : 0;
      console.log(
        `  compile: E${e}, GLSL ${glsl.length} chars (CPU-clean; GPU check needs browser)`,
      );
    } catch (e) {
      console.log(`  compile FAILED: ${e.message.slice(0, 120)}`);
    }
  } catch (e) {
    console.log(`  ✗ lift failed: ${e.message}`);
  }
}
console.log('\n=== done ===');
