// =============================================================================
// Lift regression test — compare v1 vs v2 vs v2.1 system prompts on 8 demos.
//
// For each demo: re-lift its 2D code three times. Compare:
//   - new atoms used (moon/star/tree-pine/cottage/...) — M3 evidence
//   - new IQ primitives used (solid-angle/link/horseshoe/...) — M3 evidence
//   - material field usage on Subjects — v2.1 new
//   - pattern field usage on Subjects — v2.1 new
//   - boolean variant usage (unionChamfer/unionStairs/...) — v2.1 new
//   - Z-coordinate spread (variance of subject Z positions) — v2.1 new
//     fixes "flat cathedral" — higher spread = better volumetric lift
//   - total subject count
//   - input/output tokens, cost
//   - whether the SceneData compile()s
//
// Usage:
//   ANTHROPIC_API_KEY=sk-ant-... node sdf-js/scripts/regression/lift-regression.mjs [demo-id|all] [v1|v2|v2.1|all-versions]
//
// Default version: all-versions (3 runs per demo)
//
// Output:
//   sdf-js/scripts/regression/results/<demo-id>-v{1,2,2.1}.json  (full sceneData + metrics)
//   sdf-js/scripts/regression/results/summary.json               (cross-demo table)
//
// Cost estimate: ~24 API calls × $0.10-0.30 = $3-6 total for all-versions.
//                ~16 calls × $0.15 = $2-3 for v2-vs-v2.1 only.
// =============================================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { compile } from '../../src/scene/index.js';

// MODEL env var can override the default. Anthropic Messages API typically
// wants either a "latest" alias (e.g. claude-sonnet-4-5) or a dated id
// (e.g. claude-sonnet-4-5-20250929). The Compositor's value 'claude-sonnet-4-6'
// works in Claude Code's runtime; the public Messages API may require a
// dated suffix. If the default 401s/404s, try setting MODEL explicitly.
const MODEL = process.env.MODEL || 'claude-sonnet-4-5';
const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('✗ ANTHROPIC_API_KEY env var required.');
  console.error('  export ANTHROPIC_API_KEY=sk-ant-... && node sdf-js/scripts/regression/lift-regression.mjs');
  process.exit(1);
}

// Preflight: 1 minimal call to validate auth + model before burning $$ on 16 lifts
async function preflight() {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL, max_tokens: 8,
        messages: [{ role: 'user', content: 'reply with: ok' }],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error(`✗ Preflight failed (HTTP ${res.status}). Model="${MODEL}".`);
      console.error(`  Response: ${t.slice(0, 300)}`);
      console.error(`  Try: MODEL=claude-sonnet-4-5-20250929 ANTHROPIC_API_KEY=... node ...`);
      process.exit(1);
    }
    const data = await res.json();
    console.log(`✓ Preflight OK · model=${MODEL} · usage=${JSON.stringify(data.usage)}\n`);
  } catch (e) {
    console.error(`✗ Preflight network error: ${e.message}`);
    process.exit(1);
  }
}

const REPO = '/Users/hexiaoyang/Documents/sdf-main';
// v1   = M0 baseline (pre-atom-library port)
// v2   = M3 ship (9 atoms + 9 IQ types) — frozen
// v2.1 = material/pattern + boolean variants + facade-to-3D — frozen
// v2.2 = 5 new presets + variant push — frozen
// v2.3 = decision heuristic + bicycle Example 5 — frozen
// v3.0 = atom library 9 → 42 + deep-water preset — frozen
// v3.1 = MANDATORY scene contextual augmentation (16-row category table)
//        — read from LIVE file so future edits flow into next regression run
const V1_PROMPT  = readFileSync(`${REPO}/sdf-js/scripts/regression/system-prompt-v1.md`, 'utf-8');
const V2_PROMPT  = readFileSync(`${REPO}/sdf-js/scripts/regression/system-prompt-v2.md`, 'utf-8');
const V21_PROMPT = readFileSync(`${REPO}/sdf-js/scripts/regression/system-prompt-v2.1.md`, 'utf-8');
const V22_PROMPT = readFileSync(`${REPO}/sdf-js/scripts/regression/system-prompt-v2.2.md`, 'utf-8');
const V23_PROMPT = readFileSync(`${REPO}/sdf-js/scripts/regression/system-prompt-v2.3.md`, 'utf-8');
const V30_PROMPT = readFileSync(`${REPO}/sdf-js/scripts/regression/system-prompt-v3.0.md`, 'utf-8');
const V31_PROMPT = readFileSync(`${REPO}/sdf-js/examples/compositor/system-prompt-lift-3d.md`, 'utf-8');
const PROMPTS = {
  'v1': V1_PROMPT, 'v2': V2_PROMPT, 'v2.1': V21_PROMPT, 'v2.2': V22_PROMPT,
  'v2.3': V23_PROMPT, 'v3.0': V30_PROMPT, 'v3.1': V31_PROMPT,
};
const RESULTS_DIR = `${REPO}/sdf-js/scripts/regression/results`;
if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });

const DEMOS = [
  'china-carrier', 'gothic-cathedral', 'spiral-vase', 'mountain-village',
  'clock-915', 'vintage-bicycle', 'dining-setting', 'coastal-lighthouse',
];

// M3 atoms (v2-era): what we wanted LLM to use in v2 baseline
const NEW_ATOMS = new Set([
  'moon', 'star', 'sun', 'cloud-puff',
  'tree-pine', 'tree-broadleaf', 'cottage', 'flag-on-pole', 'bird-silhouette',
]);
const NEW_IQ_TYPES = new Set([
  'solid-angle', 'link', 'capped-torus', 'hex-prism', 'octagon-prism',
  'round-cone', 'rhombus', 'horseshoe', 'u-shape',
]);
// v3.0 expansion atoms: 33 new types across 7 categories
const V30_ATOMS = new Set([
  // animals
  'cow', 'horse', 'pig', 'dog', 'sheep', 'cat',
  // landscape
  'rock-boulder', 'fence-section', 'hill-mound', 'stream-segment',
  // architecture
  'tower-square', 'church-spire', 'gazebo', 'well', 'fountain',
  // vehicles
  'sailboat-small', 'car-simple', 'wagon', 'biplane',
  // furniture
  'chair', 'table-round', 'lamp-standing', 'bookshelf', 'wine-bottle',
  // mechanical
  'gear-flat', 'pipe-l-bend', 'smokestack', 'windmill',
  // plants
  'flower', 'mushroom', 'bush', 'vine', 'grass-tuft',
]);

// v2.1 boolean variants (hg_sdf-style joins)
const BOOLEAN_VARIANTS = new Set([
  'unionChamfer', 'intersectionChamfer', 'differenceChamfer',
  'unionRound',   'intersectionRound',   'differenceRound',
  'unionSoft',
  'unionStairs',  'intersectionStairs',  'differenceStairs',
  'unionColumns', 'intersectionColumns', 'differenceColumns',
  'pipe', 'engrave', 'groove', 'tongue',
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

// v2.1 metrics: count how many subjects carry material / pattern fields
function countMaterialUsage(subjects) {
  let n = 0;
  for (const s of subjects || []) {
    if (s.material != null) n += 1;
    if (Array.isArray(s.children)) n += countMaterialUsage(s.children);
  }
  return n;
}
function countPatternUsage(subjects) {
  let n = 0;
  for (const s of subjects || []) {
    if (s.pattern != null) n += 1;
    if (Array.isArray(s.children)) n += countPatternUsage(s.children);
  }
  return n;
}

// v2.1 facade-to-3D metric: spread of Z coordinates across all subjects.
// Low spread = "flat cathedral" failure mode (all subjects piled at one z).
// High spread = proper volumetric distribution.
function collectZCoords(subjects, acc = []) {
  for (const s of subjects || []) {
    const t = s.transform?.translate;
    if (Array.isArray(t) && typeof t[2] === 'number') acc.push(t[2]);
    if (Array.isArray(s.children)) collectZCoords(s.children, acc);
  }
  return acc;
}
function zSpread(subjects) {
  const zs = collectZCoords(subjects);
  if (zs.length < 2) return { count: zs.length, min: 0, max: 0, range: 0, stdev: 0 };
  const min = Math.min(...zs), max = Math.max(...zs);
  const mean = zs.reduce((s, z) => s + z, 0) / zs.length;
  const variance = zs.reduce((s, z) => s + (z - mean) ** 2, 0) / zs.length;
  return {
    count: zs.length, min, max, range: max - min,
    stdev: Math.sqrt(variance),
  };
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
    const errRecord = { demoId, version, error: `API: ${e.message}` };
    writeFileSync(`${RESULTS_DIR}/${demoId}-${version}-error.json`, JSON.stringify(errRecord, null, 2));
    return errRecord;
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
  const newAtomsUsed   = Object.entries(typeCounts).filter(([t]) => NEW_ATOMS.has(t));
  const newIQTypesUsed = Object.entries(typeCounts).filter(([t]) => NEW_IQ_TYPES.has(t));
  const variantsUsed   = Object.entries(typeCounts).filter(([t]) => BOOLEAN_VARIANTS.has(t));
  const v30AtomsUsed   = Object.entries(typeCounts).filter(([t]) => V30_ATOMS.has(t));

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
    // v2.1 metrics
    materialUsageCount: countMaterialUsage(sceneData.subjects),
    patternUsageCount:  countPatternUsage(sceneData.subjects),
    variantsUsedCount:  variantsUsed.reduce((s, [_, c]) => s + c, 0),
    variantsUsed,
    zSpread: zSpread(sceneData.subjects),  // {count, min, max, range, stdev}
    // v3.0 metrics — adoption of new 33-atom expansion
    v30AtomsUsedCount: v30AtomsUsed.reduce((s, [_, c]) => s + c, 0),
    v30AtomsUsed,
    typeCounts,
    compileOk, compileErr,
    sceneName: sceneData.name,
  };

  writeFileSync(`${RESULTS_DIR}/${demoId}-${version}.json`, JSON.stringify({ result, sceneData }, null, 2));
  return result;
}

async function main() {
  const target = process.argv[2] || 'all';
  const versionArg = process.argv[3] || 'all-versions';
  const demos = (target === 'all') ? DEMOS : [target];
  let versions;
  if (versionArg === 'all-versions') versions = ['v1', 'v2', 'v2.1', 'v2.2', 'v2.3', 'v3.0', 'v3.1'];
  else if (versionArg === 'v2-vs-v2.1') versions = ['v2', 'v2.1'];
  else if (versionArg === 'v2.1-vs-v2.2') versions = ['v2.1', 'v2.2'];
  else if (versionArg === 'v2.2-vs-v2.3') versions = ['v2.2', 'v2.3'];
  else if (versionArg === 'v2.3-vs-v3.0') versions = ['v2.3', 'v3.0'];
  else if (versionArg === 'v3.0-vs-v3.1') versions = ['v3.0', 'v3.1'];
  else if (PROMPTS[versionArg]) versions = [versionArg];
  else { console.error(`✗ unknown version: ${versionArg}`); process.exit(1); }

  const calls = demos.length * versions.length;
  console.log(`Lift regression: ${demos.length} demo(s) × ${versions.length} version(s) = ${calls} API calls`);
  console.log(`Versions: ${versions.join(', ')}`);
  console.log(`Estimated cost: $${(calls * 0.15).toFixed(2)} (~$0.15 each)`);
  console.log(`Model: ${MODEL}\n`);
  await preflight();

  const summary = [];
  for (const id of demos) {
    console.log(`── ${id} ──`);
    const runs = {};
    for (const v of versions) {
      process.stdout.write(`  ${v} lift…`);
      const r = await liftOne(id, PROMPTS[v], v);
      runs[v] = r;
      if (r.error) {
        console.log(` ✗ ${r.error}`);
      } else {
        console.log(` ✓ ${r.subjectCount} subj · atoms ${r.newAtomsUsedCount}+${r.v30AtomsUsedCount}v3 · ${r.materialUsageCount} mat · ${r.patternUsageCount} pat · ${r.variantsUsedCount} var · zR=${r.zSpread.range.toFixed(1)} · $${r.costUSD}`);
      }
    }
    const cmp = { demoId: id, runs };
    summary.push(cmp);
    console.log('');
  }

  // Pretty summary table — focused on v2.1's hypothesis metrics
  console.log('═══ Summary ═══');
  const rows = summary.map(s => {
    const row = { demo: s.demoId };
    for (const v of versions) {
      const r = s.runs[v];
      if (r.error) {
        row[`${v}`] = `✗ ${r.error.slice(0, 20)}`;
      } else {
        row[`${v} subj`] = r.subjectCount;
        row[`${v} mat`] = r.materialUsageCount;
        row[`${v} pat`] = r.patternUsageCount;
        row[`${v} var`] = r.variantsUsedCount;
        row[`${v} zR`] = r.zSpread.range.toFixed(1);
        row[`${v} ✓`] = r.compileOk ? '✓' : '✗';
      }
    }
    return row;
  });
  console.table(rows);

  // Totals + cost
  let totalCost = 0;
  const totals = {};
  for (const v of versions) totals[v] = { atoms: 0, iq: 0, mat: 0, pat: 0, var: 0, cost: 0 };
  for (const s of summary) {
    for (const v of versions) {
      const r = s.runs[v];
      if (r.error) continue;
      totals[v].atoms += r.newAtomsUsedCount;
      totals[v].iq    += r.newIQTypesUsedCount;
      totals[v].mat   += r.materialUsageCount;
      totals[v].pat   += r.patternUsageCount;
      totals[v].var   += r.variantsUsedCount;
      totals[v].cost  += parseFloat(r.costUSD);
    }
  }
  console.log(`\nTotals across all demos:`);
  for (const v of versions) {
    const t = totals[v];
    console.log(`  ${v.padEnd(5)} · atoms=${t.atoms.toString().padStart(3)} · iq=${t.iq.toString().padStart(3)} · materials=${t.mat.toString().padStart(3)} · patterns=${t.pat.toString().padStart(3)} · variants=${t.var.toString().padStart(3)} · cost=$${t.cost.toFixed(4)}`);
    totalCost += t.cost;
  }
  console.log(`  combined cost: $${totalCost.toFixed(4)}`);

  writeFileSync(`${RESULTS_DIR}/summary.json`, JSON.stringify({
    ranAt: new Date().toISOString(),
    model: MODEL,
    versions,
    totals,
    totalCost,
    demos: summary,
  }, null, 2));

  console.log(`\nResults saved to ${RESULTS_DIR}/`);
}

main().catch(e => { console.error(e); process.exit(1); });
