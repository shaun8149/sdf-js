// =============================================================================
// Lift regression test — compare v1 vs v2 system prompt on all 8 demos.
//
// For each demo: re-lift its 2D code twice (once with v1 prompt, once with
// v2). Compare:
//   - how many new atoms used (moon/star/tree-pine/cottage/...)
//   - how many new IQ primitives used (solid-angle/link/horseshoe/...)
//   - total subject count
//   - input/output tokens, cost
//   - whether the SceneData compile()s
//
// Usage:
//   ANTHROPIC_API_KEY=sk-ant-... node sdf-js/scripts/regression/lift-regression.mjs [demo-id|all]
//
// Output:
//   sdf-js/scripts/regression/results/<demo-id>-v{1,2}.json  (full sceneData + metrics)
//   sdf-js/scripts/regression/results/summary.json           (cross-demo comparison table)
//
// Cost estimate: ~16 API calls × $0.10-0.30 each = $2-5 total.
// =============================================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { compile } from '../../src/scene/index.js';

const MODEL = 'claude-sonnet-4-6';
const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('✗ ANTHROPIC_API_KEY env var required.');
  console.error('  export ANTHROPIC_API_KEY=sk-ant-... && node sdf-js/scripts/regression/lift-regression.mjs');
  process.exit(1);
}

const REPO = '/Users/hexiaoyang/Documents/sdf-main';
const V1_PROMPT = readFileSync(`${REPO}/sdf-js/scripts/regression/system-prompt-v1.md`, 'utf-8');
const V2_PROMPT = readFileSync(`${REPO}/sdf-js/examples/compositor/system-prompt-lift-3d.md`, 'utf-8');
const RESULTS_DIR = `${REPO}/sdf-js/scripts/regression/results`;
if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });

const DEMOS = [
  'china-carrier', 'gothic-cathedral', 'spiral-vase', 'mountain-village',
  'clock-915', 'vintage-bicycle', 'dining-setting', 'coastal-lighthouse',
];

// New types ported in M3 (community + atoms) — what we want LLM to use in v2
const NEW_ATOMS = new Set([
  'moon', 'star', 'sun', 'cloud-puff',
  'tree-pine', 'tree-broadleaf', 'cottage', 'flag-on-pole', 'bird-silhouette',
]);
const NEW_IQ_TYPES = new Set([
  'solid-angle', 'link', 'capped-torus', 'hex-prism', 'octagon-prism',
  'round-cone', 'rhombus', 'horseshoe', 'u-shape',
]);

// Anthropic pricing for sonnet-4-6 (approximate, in USD per 1M tokens)
const PRICE_INPUT = 3.0;
const PRICE_OUTPUT = 15.0;
const PRICE_INPUT_CACHE_HIT = 0.30;

async function callAnthropic(systemPrompt, userMessage) {
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
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  return { text: data.content[0].text, usage: data.usage, elapsed };
}

function parseSceneJson(text) {
  const fenceMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  let jsonStr = fenceMatch ? fenceMatch[1] : text.trim();
  if (!fenceMatch && !jsonStr.startsWith('{')) {
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(jsonStr);
}

function collectTypes(subjects) {
  const out = [];
  for (const s of subjects || []) {
    if (s.type) out.push(s.type);
    if (Array.isArray(s.children)) out.push(...collectTypes(s.children));
  }
  return out;
}

function countSubjects(subjects) {
  let n = 0;
  for (const s of subjects || []) {
    n += 1;
    if (Array.isArray(s.children)) n += countSubjects(s.children);
  }
  return n;
}

async function liftOne(demoId, systemPrompt, version) {
  const demoFile = `${REPO}/sdf-js/examples/compositor/demo-lifts/${demoId}.json`;
  const demo = JSON.parse(readFileSync(demoFile, 'utf-8'));
  const userMessage = `## Original user prompt\n\n${demo.prompt}\n\n## 2D SDF code\n\n\`\`\`js\n${demo.code2d}\n\`\`\``;

  let raw, usage, elapsed;
  try {
    const r = await callAnthropic(systemPrompt, userMessage);
    raw = r.text; usage = r.usage; elapsed = r.elapsed;
  } catch (e) {
    return { demoId, version, error: `API: ${e.message}` };
  }

  let sceneData;
  try {
    sceneData = parseSceneJson(raw);
  } catch (e) {
    writeFileSync(`${RESULTS_DIR}/${demoId}-${version}-raw.txt`, raw);
    return { demoId, version, error: `parse: ${e.message}`, rawSavedTo: `${demoId}-${version}-raw.txt` };
  }

  const types = collectTypes(sceneData.subjects);
  const typeCounts = types.reduce((m, t) => (m[t] = (m[t] || 0) + 1, m), {});
  const newAtomsUsed = Object.entries(typeCounts).filter(([t]) => NEW_ATOMS.has(t));
  const newIQTypesUsed = Object.entries(typeCounts).filter(([t]) => NEW_IQ_TYPES.has(t));

  let compileOk = false, compileErr = null;
  try { compile(sceneData); compileOk = true; }
  catch (e) { compileErr = String(e.message || e).slice(0, 200); }

  const costUSD = (usage.input_tokens * PRICE_INPUT + usage.output_tokens * PRICE_OUTPUT) / 1e6;

  const result = {
    demoId, version, model: MODEL,
    elapsed: `${elapsed}s`,
    tokens: { input: usage.input_tokens, output: usage.output_tokens },
    costUSD: costUSD.toFixed(4),
    subjectCount: countSubjects(sceneData.subjects),
    newAtomsUsedCount: newAtomsUsed.reduce((s, [_, c]) => s + c, 0),
    newAtomsUsed,        // [[type, count], ...]
    newIQTypesUsedCount: newIQTypesUsed.reduce((s, [_, c]) => s + c, 0),
    newIQTypesUsed,
    typeCounts,
    compileOk, compileErr,
    sceneName: sceneData.name,
  };

  writeFileSync(`${RESULTS_DIR}/${demoId}-${version}.json`, JSON.stringify({ result, sceneData }, null, 2));
  return result;
}

async function main() {
  const target = process.argv[2] || 'all';
  const demos = (target === 'all') ? DEMOS : [target];

  console.log(`Lift regression: ${demos.length} demo(s) × 2 versions = ${demos.length * 2} API calls`);
  console.log(`Estimated cost: $${(demos.length * 2 * 0.15).toFixed(2)} (~$0.15 each)\n`);

  const summary = [];
  for (const id of demos) {
    console.log(`── ${id} ──`);
    process.stdout.write('  v1 lift…');
    const v1 = await liftOne(id, V1_PROMPT, 'v1');
    if (v1.error) {
      console.log(` ✗ ${v1.error}`);
    } else {
      console.log(` ✓ ${v1.subjectCount} subjects, ${v1.tokens.output}t out, $${v1.costUSD}`);
    }
    process.stdout.write('  v2 lift…');
    const v2 = await liftOne(id, V2_PROMPT, 'v2');
    if (v2.error) {
      console.log(` ✗ ${v2.error}`);
    } else {
      console.log(` ✓ ${v2.subjectCount} subjects, ${v2.tokens.output}t out, $${v2.costUSD}`);
    }

    const cmp = {
      demoId: id,
      v1: { subjects: v1.subjectCount, atoms: v1.newAtomsUsedCount, iq: v1.newIQTypesUsedCount, compile: v1.compileOk, cost: v1.costUSD },
      v2: { subjects: v2.subjectCount, atoms: v2.newAtomsUsedCount, iq: v2.newIQTypesUsedCount, compile: v2.compileOk, cost: v2.costUSD },
      delta: {
        subjects: (v2.subjectCount ?? 0) - (v1.subjectCount ?? 0),
        atoms:    (v2.newAtomsUsedCount ?? 0) - (v1.newAtomsUsedCount ?? 0),
        iq:       (v2.newIQTypesUsedCount ?? 0) - (v1.newIQTypesUsedCount ?? 0),
      },
      v2NewAtoms: v2.newAtomsUsed,
      v2NewIQ:    v2.newIQTypesUsed,
    };
    summary.push(cmp);
    console.log(`  Δ atoms ${cmp.delta.atoms >= 0 ? '+' : ''}${cmp.delta.atoms} · Δ IQ ${cmp.delta.iq >= 0 ? '+' : ''}${cmp.delta.iq} · Δ subjects ${cmp.delta.subjects >= 0 ? '+' : ''}${cmp.delta.subjects}\n`);
  }

  // Pretty summary
  console.log('═══ Summary ═══');
  console.table(summary.map(s => ({
    demo: s.demoId,
    'v1 subj': s.v1.subjects,
    'v2 subj': s.v2.subjects,
    'Δ subj': s.delta.subjects,
    'v1 atoms': s.v1.atoms,
    'v2 atoms': s.v2.atoms,
    'Δ atoms': s.delta.atoms,
    'Δ IQ': s.delta.iq,
    'v1 compile': s.v1.compile ? '✓' : '✗',
    'v2 compile': s.v2.compile ? '✓' : '✗',
  })));

  const totalCostV1 = summary.reduce((s, r) => s + parseFloat(r.v1.cost || 0), 0).toFixed(4);
  const totalCostV2 = summary.reduce((s, r) => s + parseFloat(r.v2.cost || 0), 0).toFixed(4);
  const totalAtomsV1 = summary.reduce((s, r) => s + (r.v1.atoms || 0), 0);
  const totalAtomsV2 = summary.reduce((s, r) => s + (r.v2.atoms || 0), 0);
  const totalIQV1 = summary.reduce((s, r) => s + (r.v1.iq || 0), 0);
  const totalIQV2 = summary.reduce((s, r) => s + (r.v2.iq || 0), 0);

  console.log(`\nTotals:`);
  console.log(`  cost: v1 $${totalCostV1} · v2 $${totalCostV2} · combined $${(parseFloat(totalCostV1) + parseFloat(totalCostV2)).toFixed(4)}`);
  console.log(`  new atom uses: v1=${totalAtomsV1}  →  v2=${totalAtomsV2}  (+${totalAtomsV2 - totalAtomsV1})`);
  console.log(`  new IQ uses:   v1=${totalIQV1}  →  v2=${totalIQV2}  (+${totalIQV2 - totalIQV1})`);

  writeFileSync(`${RESULTS_DIR}/summary.json`, JSON.stringify({
    ranAt: new Date().toISOString(),
    model: MODEL,
    totalCostV1, totalCostV2,
    totalAtomsV1, totalAtomsV2,
    totalIQV1, totalIQV2,
    demos: summary,
  }, null, 2));

  console.log(`\nResults saved to ${RESULTS_DIR}/`);
}

main().catch(e => { console.error(e); process.exit(1); });
