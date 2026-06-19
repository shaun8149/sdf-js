# M1.5 Step 2b — PDF Lift Bake + Compositor Auto-load Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the 20-slide PDF demo grid into the compositor's existing 8-renderer + Lift infrastructure by pre-baking 3D lifts and adding a 10-line URL handler to compositor.

**Architecture:** Pure Path A from `project_m15_lift_pipeline_architecture.md` — bake all 20 slide lifts via `callAnthropic` into `examples/compositor/demo-lifts/pdf-slide-N.json`, register them in `demo-lifts/index.json`, then add a tiny `?demo=<id>` URL handler in compositor.js so the PDF grid's "Open in Compositor →" button jumps straight to the loaded scene. Before baking, ship a lift system prompt v3.16 that teaches the LLM the `text-3d` primitive — without that update, the LLM has no way to render the text2dSDF calls in our emitter's output and we'd waste $0.40 on lifts that strip the text layers.

**Tech Stack:** Node 25, ESM, Anthropic Messages API, existing `sdf-js/scripts/regression/lift-regression.mjs` pattern, existing `sdf-js/examples/compositor/` infrastructure.

---

## File Structure (decomposition)

**Created**:
- `sdf-js/scripts/regression/system-prompt-v3.16.md` — frozen archive copy of v3.16 prompt (regression test infrastructure tradition; every version gets archived)
- `sdf-js/scripts/bake-pdf-lifts.mjs` — one-shot lift baker (loops 20 slides, calls Anthropic, writes JSON files)
- `sdf-js/examples/compositor/demo-lifts/pdf-slide-0.json` ... `pdf-slide-19.json` — 20 generated lift outputs

**Modified**:
- `sdf-js/examples/compositor/system-prompt-lift-3d.md` — bumped from v3.15 to v3.16 with text-3d primitive doc + worked example
- `sdf-js/examples/compositor/demo-lifts/index.json` — 20 new entries with category `presentation-slide`
- `sdf-js/examples/compositor/compositor.js` — ~10 lines for `?demo=<id>` URL handler at bootstrap
- `sdf-js/examples/pdf-demo/pdf-demo.js` — add "Open in Compositor →" anchor per panel

---

## Phase 1: Lift system prompt v3.16 — teach text-3d primitive

### Task 1.1: Locate the primitive args registry section in v3.15

**Files:**
- Read: `sdf-js/examples/compositor/system-prompt-lift-3d.md:236-275` (primitive args registry + 2D→3D pseudo-primitives section)

- [ ] **Step 1: Read the section**

Run: `sed -n '236,280p' sdf-js/examples/compositor/system-prompt-lift-3d.md`
Expected: shows the `## Primitive args registry (most common)` table and `## 2D→3D pseudo-primitives` section. Note the exact line numbers of the closing fences — Task 1.2 inserts between them.

- [ ] **Step 2: Confirm v3.15 has zero text mentions**

Run: `grep -n "text-3d\|text2d\|extruded letter\|extruded text" sdf-js/examples/compositor/system-prompt-lift-3d.md`
Expected: 1-2 matches at most, all in incidental contexts (e.g. line 1830 mentions "extruded letter" in a semantic mapping table — but no first-class primitive doc).

### Task 1.2: Add text-3d to args registry + worked example + version bump

**Files:**
- Modify: `sdf-js/examples/compositor/system-prompt-lift-3d.md` (header version + args registry block + new Example 18)

- [ ] **Step 1: Update the version field in the frontmatter**

Edit `sdf-js/examples/compositor/system-prompt-lift-3d.md` line 3:

OLD: `version: 3.15`

NEW: `version: 3.16`

- [ ] **Step 2: Append v3.16 release note to the `description` field on line 4**

Append (at the very end of the existing long description string, before the closing quote):

```
 v3.16 (2026-06-19) adds the `text-3d` first-class primitive — extruded SDF text composed from IQ 2D primitives (segment/arc/ring/circle). Unlocks lift of presentation slides (KPI numbers, titles, axis labels). Args: `{ "text": string, "strokeWidth"?: number, "height"?: number, "depth"?: number, "letterSpacing"?: number, "align"?: "left"|"center"|"right" }`. Worked Example 18 shows a KPI slide (big "90%" + caption) using text-3d alongside cover-3d and bar-3d.
```

- [ ] **Step 3: Add text-3d to the args registry table**

In the `## Primitive args registry (most common)` code block (around line 237-254), append before the closing ``` fence:

```
text-3d:        { "text": string, "strokeWidth"?: number, "height"?: number, "depth"?: number, "letterSpacing"?: number, "align"?: "left"|"center"|"right" }
                  // Extruded SDF text. `height` = cap height in scene units (1.0 default).
                  // `depth` = Z thickness (0.2 default). `strokeWidth` = stroke
                  // thickness in unit cap-height space (0.12 default = monoline grotesk).
                  // Currently supports digits 0-9 + symbols (% . - + $ space). Letters
                  // (A-Z, a-z) drop gracefully — unknown chars silently skipped.
                  // Use for KPI displays, chart axis labels, slide titles where text is
                  // a hero subject. The 3D bounds are roughly [-textWidth/2, +textWidth/2]
                  // × [0, height] × [-depth/2, +depth/2], centered at x=0 by default.
```

- [ ] **Step 4: Add Worked Example 18 (KPI slide) after Example 17**

First locate where Example 17 ends:

Run: `grep -n "^### Example 1[78]\|^### Example 1[89]\|^## " sdf-js/examples/compositor/system-prompt-lift-3d.md | head -10`
Expected: Example 17 header line + next `### Example` or `## ` section header.

Then insert this new section just BEFORE the next `## ` (or `### Example 19` if it exists; new content lives between Example 17 and the section that follows it):

```markdown
### Example 18: KPI presentation slide (v3.16 — text-3d primitive) ⭐⭐⭐

**Prompt**: `Presentation slide 3: "3D SPHERES". A single hero KPI value of 90%. Lift to a 3D scene where the number itself is the monumental subject — extruded text on a pedestal, dramatic single-light cinematic feel, title hovering above. Keynote / TED-stage aesthetic.`

**2D code key signals**:
- `text2dSDF({ text: '90%', height: 0.7, strokeWidth: 0.08, align: 'center' }).translate([0, 0.05])` — big hero value
- `rounded_rectangle([1.6, 0.06], 0.03, [0, -0.45])` — flat pedestal below
- `// SEMANTIC HINT for lift: this is a PRESENTATION SCENE — favor regular geometric shapes` — comment in header

**Output** (target shape):

```json
{
  "v": 1,
  "name": "kpi-90-percent",
  "source": { "format": "llm-lift", "prompt": "...", "from2dCode": true },
  "subjects": [
    {
      "id": "hero-value",
      "type": "text-3d",
      "args": { "text": "90%", "height": 1.8, "strokeWidth": 0.22, "depth": 0.5, "align": "center" },
      "transform": { "translate": [0, 1.0, 0] },
      "material": "white-paint"
    },
    {
      "id": "pedestal",
      "type": "rounded_box",
      "args": { "dims": [4, 0.2, 1.5], "cornerR": 0.05 },
      "transform": { "translate": [0, 0.0, 0] },
      "material": "polished-stone"
    },
    {
      "id": "title-strip",
      "type": "rounded_box",
      "args": { "dims": [3.5, 0.06, 0.04], "cornerR": 0.02 },
      "transform": { "translate": [0, 3.0, -0.5] },
      "material": "white-paint"
    }
  ],
  "ground": { "y": -0.1, "region": "ground" },
  "defaults": {
    "camera": { "yaw": 0.3, "pitch": 0.2, "distance": 8, "focal": 1.5, "targetX": 0, "targetY": 1.2, "targetZ": 0, "aperture": 0.04, "focalDistance": 8 },
    "light": { "azimuth": 0.7, "altitude": 0.5, "distance": 30, "intensity": 1.3 },
    "shadow": { "enabled": true, "mode": "darken", "strength": 0.45 },
    "postFx": { "exposure": 1.1, "bloomMix": 0.22, "bloomThreshold": 0.8, "vignetteStrength": 0.4 }
  }
}
```

**Why this composition wins**:
- `text-3d` becomes the visual hero — keep `height` large (1.5-2.0) and `depth` substantial (0.4-0.6) so it reads as a monument, not a label.
- Pedestal stays simple geometry (`rounded_box`) — text-3d does the storytelling.
- Cinematic block (`postFx + aperture + DoF distance matching camera distance`) cues "keynote / TED-stage" without needing volumes.
- Title strip is just a horizontal rectangle floating above — placeholder for the actual title (Wave 1 typography lacks letters; once Wave 2 ships, replace with `text-3d({ text: slide.title })`).
- Avoid scattering peer subjects (v3.11 Scene Completion). Presentation slides are SINGULAR-FOCUS by design — the prompt says "the number itself is the monumental subject."

**Trap to avoid**: do NOT emit `text-3d` with text containing only letters (e.g. `{ "text": "FILL LEVELS" }`) — Wave 1 supports digits + %./-+$ only. Letters silently drop to empty, leaving a phantom subject. If the 2D code has a `rectangle(...)` where you'd expect text, that's the deliberate placeholder — keep it as a `rounded_box` in 3D, don't try to re-add text.

```

- [ ] **Step 5: Archive v3.16 to scripts/regression/ (matches the convention used for every prior version)**

Run: `cp sdf-js/examples/compositor/system-prompt-lift-3d.md sdf-js/scripts/regression/system-prompt-v3.16.md`
Expected: file copied with no errors.

- [ ] **Step 6: Verify the prompt is still well-formed**

Run: `grep -c "^### Example " sdf-js/examples/compositor/system-prompt-lift-3d.md`
Expected: 1 more than v3.15. If v3.15 had N examples, v3.16 has N+1.

Run: `wc -l sdf-js/examples/compositor/system-prompt-lift-3d.md`
Expected: line count grew by ~50 (the new Example 18 block).

### Task 1.3: Spot-test v3.16 on one slide

**Files:**
- Read: `sdf-js/examples/pdf-demo/slidedata.json` (slide 3 — the 90% KPI slide)

- [ ] **Step 1: Generate slide 3's 2D code via the emitter**

Run:
```bash
node -e "
import('./sdf-js/src/mapping/slide-to-2d-code.js').then(async ({ emitSlide2dCode }) => {
  const fs = await import('node:fs');
  const slides = JSON.parse(fs.readFileSync('./sdf-js/examples/pdf-demo/slidedata.json'));
  const r = emitSlide2dCode(slides[3]);
  console.log('---PROMPT---'); console.log(r.prompt);
  console.log('---CODE2D---'); console.log(r.code2d);
});
"
```
Expected: prints the prompt + the full code2d for slide 3 (the 90% KPI).

- [ ] **Step 2: Spot-test the v3.16 prompt with a single live API call**

Save the output of Step 1 to `/tmp/slide3-prompt.txt` and `/tmp/slide3-code2d.txt`. Then call:

```bash
ANTHROPIC_API_KEY=sk-ant-... node -e "
const fs = require('node:fs');
const prompt = fs.readFileSync('/tmp/slide3-prompt.txt', 'utf8').trim();
const code2d = fs.readFileSync('/tmp/slide3-code2d.txt', 'utf8');
const systemPrompt = fs.readFileSync('./sdf-js/examples/compositor/system-prompt-lift-3d.md', 'utf8');
const userMessage = '## Original user prompt\n\n' + prompt + '\n\n## 2D SDF code\n\n\`\`\`js\n' + code2d + '\n\`\`\`';
fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
  body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 16384, system: systemPrompt, messages: [{ role: 'user', content: userMessage }] }),
}).then(r => r.json()).then(j => {
  fs.writeFileSync('/tmp/slide3-lifted.json', j.content[0].text);
  console.log('saved → /tmp/slide3-lifted.json');
  console.log('tokens in/out:', j.usage.input_tokens, '/', j.usage.output_tokens);
});
"
```

Expected output: `saved → /tmp/slide3-lifted.json` and a token count line (likely ~10000/2000 → ~$0.02 cost).

- [ ] **Step 3: Verify the lift output uses text-3d**

Run: `grep -o '"type": "text-3d"' /tmp/slide3-lifted.json | wc -l`
Expected: ≥ 1 (the lift LLM emitted at least one text-3d subject for the "90%" hero value).

If 0: the prompt update didn't land. Re-read Example 18 — make sure the JSON-fenced "Output" block uses the exact key shape (`"args": { "text": "90%", "height": ..., ... }`).

- [ ] **Step 4: Verify the lift output compiles**

Run:
```bash
node -e "
import('./sdf-js/src/scene/compile.js').then(async ({ compile }) => {
  const fs = await import('node:fs');
  let text = fs.readFileSync('/tmp/slide3-lifted.json', 'utf8');
  // strip optional code fence
  const m = text.match(/\`\`\`(?:json)?\\s*\\n([\\s\\S]*?)\\n\`\`\`/);
  if (m) text = m[1];
  const scene = JSON.parse(text);
  const result = compile(scene, { sanity: false });
  console.log('compile OK · subjects:', result.subjects.length, '· sdf:', !!result.sdf);
});
"
```
Expected: `compile OK · subjects: N · sdf: true` where N matches the lifted subject count.

If compile fails: print the error, then iterate Task 1.2 Step 3-4 (probably a wrong arg shape in the Example 18 block).

### Task 1.4: Commit Phase 1

- [ ] **Step 1: Commit**

```bash
git add sdf-js/examples/compositor/system-prompt-lift-3d.md sdf-js/scripts/regression/system-prompt-v3.16.md
git commit -m "Lift prompt v3.16 — teach text-3d primitive

Adds first-class doc for the text-3d primitive (shipped 2026-06-18, commit
117915d) so the lift LLM can emit extruded text subjects instead of
ignoring the text2dSDF calls in our presentation-slide 2D code. Unlocks
the PDF demo's per-slide Lift flow.

- args registry: text-3d entry with stroke/height/depth/align fields
- Worked Example 18: KPI slide (big '90%' + pedestal + title strip)
- archive: scripts/regression/system-prompt-v3.16.md

Spot-tested live on slide 3 (90% KPI): lift output includes text-3d
subject + compiles cleanly via scene/compile.js.

Step 2b.1 of [[m15-lift-pipeline-architecture]]."
```
Expected: commit succeeds. lint-staged auto-runs prettier on the .md file (cosmetic).

---

## Phase 2: Bake 20 PDF slide lifts

### Task 2.1: Write bake-pdf-lifts.mjs

**Files:**
- Create: `sdf-js/scripts/bake-pdf-lifts.mjs`
- Reference (pattern source): `sdf-js/scripts/regression/lift-regression.mjs:400-423` (callAnthropic pattern)
- Reference (cost preflight): `sdf-js/scripts/regression/lift-regression.mjs:48-90`

- [ ] **Step 1: Write the bake script**

Create `sdf-js/scripts/bake-pdf-lifts.mjs`:

```js
#!/usr/bin/env node
// =============================================================================
// bake-pdf-lifts.mjs — one-shot lift baker for the 20-slide PDF demo deck
// -----------------------------------------------------------------------------
// Reads sdf-js/examples/pdf-demo/slidedata.json (baked SlideData), runs the
// emitter per slide to get {prompt, code2d}, calls Anthropic with lift v3.16
// system prompt, writes each result to
// sdf-js/examples/compositor/demo-lifts/pdf-slide-N.json (format matches
// _template.json — id/title/prompt/code2d/sceneData/meta), then updates
// demo-lifts/index.json with 20 new entries.
//
// Cost: ~$0.02 per slide × 20 = ~$0.40 one-shot.
//
// Usage: ANTHROPIC_API_KEY=sk-ant-... node sdf-js/scripts/bake-pdf-lifts.mjs
// Idempotent: skips a slide if its output file already exists (use --force to
// re-bake).
// =============================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { emitSlide2dCode } from '../src/mapping/slide-to-2d-code.js';

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('✗ ANTHROPIC_API_KEY env var required.');
  process.exit(1);
}
const MODEL = process.env.MODEL || 'claude-sonnet-4-5';
const FORCE = process.argv.includes('--force');

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
  if (!res.ok) {
    throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  return { text: data.content[0].text, usage: data.usage, elapsed };
}

function parseSceneJson(text) {
  const m = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  let s = m ? m[1] : text.trim();
  if (!m && !s.startsWith('{')) {
    const i = s.indexOf('{');
    const j = s.lastIndexOf('}');
    if (i >= 0 && j > i) s = s.slice(i, j + 1);
  }
  return JSON.parse(s);
}

const results = [];
let totalCost = 0;
for (let i = 0; i < slides.length; i++) {
  const slide = slides[i];
  const id = `pdf-slide-${i}`;
  const outFile = `${OUT_DIR}/${id}.json`;

  if (!FORCE && existsSync(outFile)) {
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
        promptVersion: 'v3.16',
        pattern,
        slideIndex: i,
        tokenUsageLift: usage,
        costUSD,
        elapsedSec: parseFloat(elapsed),
      },
    };
    writeFileSync(outFile, JSON.stringify(entry, null, 2));
    console.log(`  ✓ wrote ${outFile} (${elapsed}s, $${costUSD.toFixed(4)})`);
    results.push({ id, ok: true, costUSD });
  } catch (e) {
    console.error(`  ✗ ${id} failed: ${e.message}`);
    results.push({ id, error: e.message });
  }
}

// Update demo-lifts/index.json — add (or replace) entries for pdf-slide-*
const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
const keep = index.demos.filter((d) => !d.id.startsWith('pdf-slide-'));
const newEntries = results
  .filter((r) => r.ok || (existsSync(`${OUT_DIR}/${r.id}.json`)))
  .map((r) => {
    const e = JSON.parse(readFileSync(`${OUT_DIR}/${r.id}.json`, 'utf8'));
    return {
      id: e.id,
      title: e.title,
      thesisPoint: `M1.5 Step 2b — PDF deck slide ${e.meta.slideIndex} lifted via v3.16 prompt. Pattern: ${e.meta.pattern}. Demonstrates the PDF→2D→lift→compositor pipeline end-to-end without parallel infrastructure.`,
      category: 'presentation-slide',
      status: 'ready',
      file: `${e.id}.json`,
      prompt: e.prompt,
    };
  });
index.demos = [...keep, ...newEntries].sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
console.log(`\n✓ updated ${INDEX_PATH} (added ${newEntries.length} entries)`);
console.log(`✓ total cost: $${totalCost.toFixed(4)}`);
```

- [ ] **Step 2: Sanity-check the script (without spending money)**

Run: `node sdf-js/scripts/bake-pdf-lifts.mjs 2>&1 | head -5`
Expected (no API key set): `✗ ANTHROPIC_API_KEY env var required.` and exit code 1.

If anything else (syntax error, missing import): fix before proceeding to Task 2.2.

### Task 2.2: Run the bake — live $0.40 spend

- [ ] **Step 1: Confirm cost preflight in user terminal**

The user will run this in their own terminal (script needs their API key). Prepare them with the exact command:

```bash
ANTHROPIC_API_KEY=$YOUR_KEY node sdf-js/scripts/bake-pdf-lifts.mjs
```

Expected output: 20 lines like `[N/20] lifting pdf-slide-N (pattern)... ✓ wrote .../pdf-slide-N.json (~3s, $0.02)`, then final `✓ total cost: $0.40` line.

If any slide fails (status code 4xx, malformed JSON, etc.), the script continues to the next; failed slides won't get an index.json entry.

- [ ] **Step 2: Verify 20 new JSON files exist**

Run: `ls sdf-js/examples/compositor/demo-lifts/pdf-slide-*.json | wc -l`
Expected: `20`.

If fewer: identify which slide(s) failed, re-run with `--force` after debugging (might need a v3.16 prompt tweak).

- [ ] **Step 3: Spot-check one slide's sceneData**

Run: `python3 -c "
import json
d = json.load(open('sdf-js/examples/compositor/demo-lifts/pdf-slide-3.json'))
print('subjects:', len(d['sceneData']['subjects']))
print('text-3d count:', sum(1 for s in d['sceneData']['subjects'] if s.get('type') == 'text-3d'))
print('first subject:', d['sceneData']['subjects'][0])
"`
Expected: at least 1 text-3d subject (the 90% hero value).

- [ ] **Step 4: Verify all 20 compile**

Run:
```bash
node -e "
import('./sdf-js/src/scene/compile.js').then(async ({ compile }) => {
  const fs = await import('node:fs');
  let ok = 0, fail = 0;
  for (let i = 0; i < 20; i++) {
    try {
      const d = JSON.parse(fs.readFileSync('./sdf-js/examples/compositor/demo-lifts/pdf-slide-' + i + '.json'));
      compile(d.sceneData, { sanity: false });
      ok++;
    } catch (e) {
      console.error('slide ' + i + ': ' + e.message);
      fail++;
    }
  }
  console.log('compile:', ok, 'OK,', fail, 'failed');
});
"
```
Expected: `compile: 20 OK, 0 failed`.

If any fail: log which slides, decide whether to re-bake those individually (`--force` + slide-id filter is a follow-up enhancement if needed) or hand-fix the JSON.

### Task 2.3: Verify index.json is well-formed

- [ ] **Step 1: Validate JSON**

Run: `python3 -m json.tool sdf-js/examples/compositor/demo-lifts/index.json > /dev/null && echo "OK"`
Expected: `OK`.

- [ ] **Step 2: Count new entries**

Run: `python3 -c "
import json
d = json.load(open('sdf-js/examples/compositor/demo-lifts/index.json'))
total = len(d['demos'])
pdf = sum(1 for x in d['demos'] if x['category'] == 'presentation-slide')
print(f'total: {total}, pdf-slide: {pdf}')
"`
Expected: `pdf-slide: 20` (and `total` = original count + 20).

- [ ] **Step 3: Browse-verify compositor gallery shows new cards**

Make sure dev server is running:
```bash
lsof -ti:8001 >/dev/null 2>&1 && echo "server up" || (cd sdf-js && python3 dev-server.py 8001 &)
```

Then use /browse skill:
```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B goto http://localhost:8001/examples/compositor/
sleep 4
$B js "Array.from(document.querySelectorAll('[data-bundled^=\"pdf-slide-\"]')).map(e => e.dataset.bundled).join(',')"
```
Expected: returns comma-list of 20 `pdf-slide-N` ids.

- [ ] **Step 4: Click one and verify it renders**

```bash
$B js "document.querySelector('[data-bundled=\"pdf-slide-18\"]').click()"
sleep 3
$B console --errors
$B screenshot /tmp/pdf-slide-18-in-compositor.png
```
Expected: console clean, screenshot shows a 3D render of slide 18 (the 10-bar percent-list).

Use `Read /tmp/pdf-slide-18-in-compositor.png` to view.

### Task 2.4: Commit Phase 2

- [ ] **Step 1: Commit**

```bash
git add sdf-js/scripts/bake-pdf-lifts.mjs sdf-js/examples/compositor/demo-lifts/
git commit -m "Bake 20 PDF slide lifts → compositor demo gallery

One-shot \$0.40 bake via lift v3.16 prompt. Each slide of the test deck
gets a pdf-slide-N.json entry in demo-lifts/, registered in index.json
with category=presentation-slide. The compositor's existing
loadDemoScene + 8-renderer pill bar handles them with zero modification.

scripts/bake-pdf-lifts.mjs is idempotent (skip-if-exists; --force to
re-bake). Cost meta tracked per entry in the JSON for future audit.

Step 2b.2 of [[m15-lift-pipeline-architecture]]."
```

---

## Phase 3: Compositor auto-load + PDF panel button

### Task 3.1: Add `?demo=<id>` URL handler to compositor.js

**Files:**
- Modify: `sdf-js/examples/compositor/compositor.js` (insert ~10 lines after demo manifest loads)

- [ ] **Step 1: Find the right insertion point**

Run: `grep -n "loadDemoManifest\|state.demos = " sdf-js/examples/compositor/compositor.js | head -5`
Expected: shows where `loadDemoManifest` is defined and where `state.demos` is set. We need to insert AFTER the manifest has loaded (so `state.demos` is populated) but BEFORE the user has interacted.

Run: `sed -n '539,570p' sdf-js/examples/compositor/compositor.js`
Expected: shows the body of `loadDemoManifest`. Find where it assigns `state.demos = manifest.demos` (or equivalent).

- [ ] **Step 2: Insert auto-load logic at the end of loadDemoManifest**

After the line that sets `state.demos = ...` and after `renderDemoGallery()` is called inside `loadDemoManifest`, add:

```js
  // ?demo=<id> URL auto-load — used by external demo grids (e.g. PDF demo)
  // to deep-link directly to a pre-lifted scene. Match by id; ignore if
  // missing. Does NOT replace history (so back-button works).
  const autoLoadId = new URLSearchParams(window.location.search).get('demo');
  if (autoLoadId) {
    const target = state.demos.find((d) => d.id === autoLoadId);
    if (target) {
      loadDemoScene(target);
      switchToTab('text');  // make the canvas visible immediately
    } else {
      console.warn(`[compositor] ?demo=${autoLoadId} not found in manifest`);
    }
  }
```

- [ ] **Step 3: Verify the URL handler works**

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B goto 'http://localhost:8001/examples/compositor/?demo=pdf-slide-18'
sleep 5
$B console --errors
$B js "state.textLiftScene?.meta?.name || state.textLiftSceneJSON?.name || activeDemoId"
$B screenshot /tmp/compositor-auto-load.png
```
Expected: console clean, `activeDemoId` evaluates to `"pdf-slide-18"`, screenshot shows slide 18's 3D scene rendered.

- [ ] **Step 4: Verify an invalid demo id warns gracefully**

```bash
$B goto 'http://localhost:8001/examples/compositor/?demo=nonexistent'
sleep 3
$B console
```
Expected: a `[compositor] ?demo=nonexistent not found in manifest` warning in the console, page still loads normally (no crash).

### Task 3.2: Add "Open in Compositor →" button to PDF demo panels

**Files:**
- Modify: `sdf-js/examples/pdf-demo/pdf-demo.js`

- [ ] **Step 1: Read the current panel template**

Run: `sed -n '50,75p' sdf-js/examples/pdf-demo/pdf-demo.js`
Expected: shows the `panel.innerHTML = ...` template literal.

- [ ] **Step 2: Add the anchor link to the panel template**

Find the `panel.innerHTML = ...` template in `renderSlide` and edit it to add a link below the `.prompt-line`:

OLD:
```js
  panel.innerHTML = `
    <h2>Slide ${idx}: ${titleEsc}</h2>
    <span class="pattern-tag tag-${pattern}">${pattern} ${(confidence * 100).toFixed(0)}%</span>
    <canvas id="${panelId}" width="${W}" height="${H}"></canvas>
    <div class="prompt-line">${prompt.replace(/</g, '&lt;')}</div>
  `;
```

NEW:
```js
  panel.innerHTML = `
    <h2>Slide ${idx}: ${titleEsc}</h2>
    <span class="pattern-tag tag-${pattern}">${pattern} ${(confidence * 100).toFixed(0)}%</span>
    <canvas id="${panelId}" width="${W}" height="${H}"></canvas>
    <div class="prompt-line">${prompt.replace(/</g, '&lt;')}</div>
    <a class="open-compositor" href="../compositor/?demo=pdf-slide-${idx}" target="_blank" rel="noopener">Open in Compositor →</a>
  `;
```

- [ ] **Step 3: Add styles for the anchor link in `examples/pdf-demo/index.html`**

In the `<style>` block in `sdf-js/examples/pdf-demo/index.html`, append:

```css
      .open-compositor {
        display: inline-block;
        margin-top: 8px;
        padding: 4px 10px;
        background: #2a60b2;
        color: #fff;
        text-decoration: none;
        border-radius: 3px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.03em;
      }
      .open-compositor:hover { background: #1c4378; }
```

### Task 3.3: Verify end-to-end via /browse

- [ ] **Step 1: Reload PDF demo + screenshot to confirm buttons appear**

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B goto http://localhost:8001/examples/pdf-demo/
sleep 18
$B js "document.querySelectorAll('.open-compositor').length"
$B screenshot /tmp/pdf-demo-with-buttons.png
```
Expected: returns `20` (one button per panel); screenshot shows blue "Open in Compositor →" buttons on each panel.

- [ ] **Step 2: Click one button and verify it lands in compositor**

```bash
$B js "document.querySelectorAll('.open-compositor')[18].click()"
sleep 1
# clicking opens a new tab; navigate to verify
$B goto 'http://localhost:8001/examples/compositor/?demo=pdf-slide-18'
sleep 5
$B console --errors
$B screenshot /tmp/end-to-end-slide-18.png
```
Expected: console clean, screenshot shows slide 18's 3D scene in the compositor.

- [ ] **Step 3: Swap renderer and verify it still works**

```bash
$B js "document.querySelector('[data-renderer=\"blueprint\"]').click()"
sleep 3
$B console --errors
$B screenshot /tmp/end-to-end-slide-18-blueprint.png
```
Expected: console clean, screenshot shows slide 18 in Blueprint 4-view ortho.

### Task 3.4: Commit Phase 3

- [ ] **Step 1: Commit**

```bash
git add sdf-js/examples/compositor/compositor.js sdf-js/examples/pdf-demo/
git commit -m "Compositor ?demo=<id> URL handler + PDF panel Open-in-Compositor button

Closes the loop on M1.5 Step 2b. From the PDF demo grid, each panel now
has an 'Open in Compositor →' link that deep-links to the corresponding
pre-baked lift in compositor's gallery — instant 3D render + access to
all 8 swappable renderers + Lift / Save / Share controls.

- compositor.js: ~10 lines to handle ?demo=<id> on bootstrap (reuses
  existing loadDemoScene + switchToTab). Invalid id warns + no-ops.
- pdf-demo: panel anchor + styles. target='_blank' opens compositor in
  a new tab so the PDF grid stays scrollable.

Step 2b.3 of [[m15-lift-pipeline-architecture]]. M1.5 lift pipeline now
end-to-end: PDF → SlideData → emit → 2D preview grid → click → compositor
3D render → 8 renderers + re-lift / save / share."
```

---

## Phase 4: Memory update + retrospective

### Task 4.1: Update memory

**Files:**
- Modify: `/Users/hexiaoyang/.claude/projects/-Users-hexiaoyang-Documents-sdf-main/memory/project_m15_lift_pipeline_architecture.md`
- Modify: `/Users/hexiaoyang/.claude/projects/-Users-hexiaoyang-Documents-sdf-main/memory/MEMORY.md`

- [ ] **Step 1: Update m15-lift-pipeline memory to mark Step 2b shipped**

In `project_m15_lift_pipeline_architecture.md`, change the "Shipped 2026-06-19" section to include the new commits and remove the "Next (Step 2b)" section (replace it with a "Step 2b shipped" line).

- [ ] **Step 2: MEMORY.md index already references project_m15_lift_pipeline_architecture.md**

No change needed unless adding a new memory file. The existing entry's one-liner can stay.

- [ ] **Step 3: Add a feedback memory if any new gotcha surfaced**

Examples: lift v3.16 hit a weird edge case, the bake script's preflight needed adjustment, the compositor's ?demo handler interacted oddly with #scene= hash. Only write a memory if the lesson is non-obvious.

---

## Verification (end-to-end)

After all phases:

1. `npm test` (or `node scripts/run-tests.mjs`) → 26/26 passing.
2. `ls sdf-js/examples/compositor/demo-lifts/pdf-slide-*.json | wc -l` → 20.
3. `http://localhost:8001/examples/pdf-demo/` → 20 panels with 2D previews AND blue "Open in Compositor →" buttons.
4. Click panel button → opens `http://localhost:8001/examples/compositor/?demo=pdf-slide-N` → instant 3D render with 8-pill renderer bar visible.
5. Try slide 18 (10-bar percent-list), slide 3 (90% KPI), slide 13 (fallback / title-only) — all 3 should compile and render in BOB GPU + FLY 3D + Blueprint.

Total cost: ~$0.42 (20 lifts × $0.02 + 1 spot-test × $0.02).
Total LoC: ~250 new (mostly bake script + v3.16 worked example) + ~12 modified in compositor.js + ~3 modified in pdf-demo.

---

## Self-Review (done by plan author)

**Spec coverage**:
- ✅ Pure Path A: covered by Phase 2 (bake + index.json registration; zero compositor logic change beyond ?demo handler — which arguably IS still pure A since it's just a URL deep-link convenience, not a parallel renderer)
- ✅ Lift prompt v3.15 → v3.16: Phase 1 (Task 1.1-1.4)
- ✅ "Open in Compositor →" button on each panel: Phase 3 (Task 3.2)
- ✅ Cost budget ~$0.40 respected: Phase 2 verifies $0.40 total

**Placeholders**:
- All "TODO" / "TBD" sweep: clean.
- All test code present: yes (smoke commands, /browse verify commands, compile-check inline scripts).
- All file paths exact: yes.

**Type consistency**:
- `pdf-slide-N` id format used consistently across bake script + index.json + URL anchor + URL handler — confirmed.
- `category: 'presentation-slide'` used consistently — confirmed (introduced in Task 2.1 bake script, no other refs needed).
- `loadDemoScene` + `switchToTab` referenced as existing functions (no signature mismatch since we don't define them).

Plan ready for execution.
