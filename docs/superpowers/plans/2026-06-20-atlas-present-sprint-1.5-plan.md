# Atlas Present Sprint 1.5 Implementation Plan — Variant Generation + Quality Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lift Sprint 1 v4 output from "barely usable" to "consistently usable" — fix silhouette auto-fit + `rng.random_dec` error class + prompt caching + add per-section 3-variant picker (Napkin AI Suggestions pattern).

**Architecture:** Same layered architecture as Sprint 1 v4. Layer 2 (Atlas Present) consumes Layer 1 (compositor-api) only. Only one Layer 1 change: `callLiftLLM` system prompt format → array+cache_control. Schema bumps v3 → v4 (silent drop v3, per user lock 2026-06-20).

**Tech Stack:** Same as Sprint 1 v4. No new dependencies. ESM Node 25, vanilla browser JS, Canvas2D, localStorage, pdf.js.

**Branch:** `sprint-1.5-variant-quality` (already created from `main` at commit `5cc75c1`).

**Spec:** [`docs/superpowers/specs/2026-06-20-atlas-present-sprint-1.5-design.md`](../specs/2026-06-20-atlas-present-sprint-1.5-design.md)

---

## File structure

### Modified files

| Path | LoC delta | Responsibility | Phase |
|---|---|---|---|
| `sdf-js/src/present/info-graphic-render.js` | +15/-3 | `drawSliceThumbnail` reads variants[selectedVariantIndex].sceneData + auto-fits view from bbox | 1 + 6 |
| `sdf-js/src/scene/sanity.js` OR `<atom>.js` | TBD by Phase 2 investigation | Fix rng error root cause | 2 |
| `sdf-js/examples/compositor/system-prompt-lift-3d.md` | possibly +5 lines | Document rng/random API surface if missing | 2 |
| `sdf-js/src/compositor-api.js` | +5/-1 | `system` field → array with `cache_control: ephemeral` | 3 |
| `sdf-js/src/present/deck-model.js` | ~+40/-20 | v4 schema with `variants[3]` + `selectedVariantIndex` | 4 |
| `sdf-js/scripts/test-deck-model.mjs` | ~+50/-30 | New assertions for variant CRUD | 4 |
| `sdf-js/src/present/pipeline.js` | ~+50/-15 | Inner variant loop + style hint suffix | 5 |
| `sdf-js/scripts/test-pipeline.mjs` | +30 | 3-variant lift assertions | 5 |
| `sdf-js/src/present/deck-view.js` | ~+80/-5 | Variant picker UI (click thumb → 3-thumb panel) | 6 |
| `sdf-js/src/present/library-page.js` | +3/-3 | Progress label tweak | 6 |
| `sdf-js/scripts/test-info-graphic-render.mjs` | +10/-2 | Update for variants[selectedVariantIndex] shape | 6 |
| `sdf-js/examples/present/style.css` | +30 | Variant picker styles | 6 |

No new files. No deletes. All Sprint 1 v4 deferred files (`waypoint-tween.js`) stay deferred.

### Layer 1 vs Layer 2

- **Layer 1 (sdf-js engine):** Only 2 touches — `compositor-api.js` (prompt caching), `sanity.js` or atom factory (Phase 2 fix). Both small, both backward-compat for compositor demo.
- **Layer 2 (Atlas Present app):** All Sprint 1.5 v4 schema + UI changes here.

---

## Phase 0 — Pre-flight verification

Confirm clean working tree, correct branch, baseline test count, fresh main pulled.

### Task 0.1: Verify pre-conditions

- [ ] **Step 1: Confirm branch + clean tree**

Run:
```bash
cd /Users/hexiaoyang/Documents/sdf-main
git branch --show-current
git status -s
```

Expected:
- branch: `sprint-1.5-variant-quality`
- status: clean (no uncommitted changes)

If on `main` instead: `git checkout sprint-1.5-variant-quality` (branch exists, created already).
If dirty: investigate, do NOT proceed.

- [ ] **Step 2: Verify npm test baseline**

Run: `npm test 2>&1 | tail -5`

Expected: `34/34 test files passed`. If less, investigate before proceeding.

- [ ] **Step 3: Verify spec exists**

Run: `ls -la docs/superpowers/specs/2026-06-20-atlas-present-sprint-1.5-design.md`

Expected: file exists.

- [ ] **Step 4: Commit spec + plan to branch**

Both spec + plan should already be on this branch from the writing-plans skill that wrote them. If not, commit now:
```bash
git add docs/superpowers/specs/2026-06-20-atlas-present-sprint-1.5-design.md docs/superpowers/plans/2026-06-20-atlas-present-sprint-1.5-plan.md
git commit -m "Sprint 1.5 spec + plan: variant generation + quality fixes

Locked 4 deliverables: silhouette auto-fit / rng error fix / prompt caching /
per-section 3-variant picker (Napkin AI Suggestions pattern).

Schema v3 -> v4 silent drop. PR workflow via sprint-1.5-variant-quality branch.

Spec: docs/superpowers/specs/2026-06-20-atlas-present-sprint-1.5-design.md
Plan: docs/superpowers/plans/2026-06-20-atlas-present-sprint-1.5-plan.md"
```

If spec/plan already committed (writing-plans skill did so), skip.

---

## Phase 1 — Silhouette auto-fit view

Smallest, highest-ROI fix. ~6/13 black-blob pages should become legible after this single change.

### Task 1.1: Add `computeView()` helper to `linear-layout.js`

Encapsulate the "bbox → silhouette view" logic where bbox lives, not in render code.

**Files:**
- Modify: `sdf-js/src/present/linear-layout.js` — add `computeView(sceneData)` export

- [ ] **Step 1: Write failing test in `test-linear-layout.mjs`**

Open `sdf-js/scripts/test-linear-layout.mjs`. Find the existing test block (look for `function test_computeBoundingBox` or similar). Append a new test block at the bottom (before `process.exit(...)` if there is one, else end-of-file):

```js
// computeView tests (added Sprint 1.5 Phase 1)
{
  // Empty sceneData → min view 0.5
  const view = computeView({ v: 1, subjects: [] });
  console.assert(
    view === 0.75,
    `empty sceneData view: expected 0.75 (min 0.5 * 1.5 margin), got ${view}`,
  );
  console.log('  ✓ computeView empty sceneData');
}
{
  // Single small subject → view scales to bbox * 1.5
  const view = computeView({
    v: 1,
    subjects: [{ id: 'a', type: 'cube-3d', args: { dims: [2, 2, 2] }, transform: { translate: [0, 0, 0] } }],
  });
  // bbox.halfWidth/halfHeight = ~1.0 from {translate:[0,0,0]} only (computeBoundingBox uses translate, not dims, in current impl)
  // 0.5 (min from min-halfWidth in computeBoundingBox) * 1.5 = 0.75
  console.assert(view === 0.75, `small subject view: expected 0.75, got ${view}`);
  console.log('  ✓ computeView small subject');
}
{
  // Wide subject spread → view = halfWidth * 1.5
  const view = computeView({
    v: 1,
    subjects: [
      { id: 'a', type: 'cube-3d', args: {}, transform: { translate: [-10, 0, 0] } },
      { id: 'b', type: 'cube-3d', args: {}, transform: { translate: [10, 0, 0] } },
    ],
  });
  // halfWidth = (10 - (-10)) / 2 = 10; view = 10 * 1.5 = 15
  console.assert(view === 15, `wide subject view: expected 15, got ${view}`);
  console.log('  ✓ computeView wide subject');
}
{
  // Extreme outlier → capped at 50
  const view = computeView({
    v: 1,
    subjects: [
      { id: 'a', type: 'cube-3d', args: {}, transform: { translate: [-100, 0, 0] } },
      { id: 'b', type: 'cube-3d', args: {}, transform: { translate: [100, 0, 0] } },
    ],
  });
  // halfWidth = 100; would be 150; capped at 50
  console.assert(view === 50, `outlier subject view: expected cap=50, got ${view}`);
  console.log('  ✓ computeView outlier capped');
}
{
  // Tall subject → view from halfHeight
  const view = computeView({
    v: 1,
    subjects: [
      { id: 'a', type: 'cube-3d', args: {}, transform: { translate: [0, -5, 0] } },
      { id: 'b', type: 'cube-3d', args: {}, transform: { translate: [0, 5, 0] } },
    ],
  });
  // halfHeight = 5; view = 7.5
  console.assert(view === 7.5, `tall subject view: expected 7.5, got ${view}`);
  console.log('  ✓ computeView tall subject');
}
```

Also at the top of the file, find the existing import line `import { computeBoundingBox, computeRegions } from '../src/present/linear-layout.js';` (or similar — actual import is in the existing test file) and add `computeView` to the import list:

```js
import { computeBoundingBox, computeRegions, computeView } from '../src/present/linear-layout.js';
```

(If file uses different import style, adapt accordingly.)

- [ ] **Step 2: Run failing test**

Run: `node sdf-js/scripts/test-linear-layout.mjs`

Expected: errors mentioning `computeView is not a function` or `Cannot read properties of undefined`.

- [ ] **Step 3: Implement `computeView` in `linear-layout.js`**

Open `sdf-js/src/present/linear-layout.js`. At end of file (after existing exports), add:

```js
/**
 * Compute auto-fit silhouette view radius from sceneData bbox.
 *
 * `view` defines silhouette renderer's half-extent in world units (canvas
 * maps to [-view, +view]² square). Too small → content overflows (black
 * blob); too large → content shrinks to dot.
 *
 * Strategy: 1.5× max(halfWidth, halfHeight) for 50% margin around content.
 * Clamped to [0.5, 50] to prevent degenerate or stray-outlier views.
 *
 * @param {object} sceneData
 * @returns {number}
 */
export function computeView(sceneData) {
  const bbox = computeBoundingBox(sceneData);
  const raw = Math.max(bbox.halfWidth, bbox.halfHeight) * 1.5;
  return Math.min(50, Math.max(0.5, raw));
}
```

- [ ] **Step 4: Run test, expect green**

Run: `node sdf-js/scripts/test-linear-layout.mjs`

Expected: all 5 new ✓ lines plus all preexisting tests pass. No assertion failures.

- [ ] **Step 5: Run full npm test**

Run: `npm test 2>&1 | tail -5`

Expected: `34/34 test files passed` (no regressions).

- [ ] **Step 6: Commit**

```bash
git add sdf-js/src/present/linear-layout.js sdf-js/scripts/test-linear-layout.mjs
git commit -m "Sprint 1.5 Phase 1: add computeView() helper for silhouette auto-fit

Replaces hard-coded view=2.5 in info-graphic-render.js (Phase 1 Task 1.2).
Strategy: 1.5x max(halfWidth, halfHeight), clamped [0.5, 50].

5 new assertions in test-linear-layout.mjs."
```

### Task 1.2: Apply `computeView` in `drawSliceThumbnail`

**Files:**
- Modify: `sdf-js/src/present/info-graphic-render.js`

- [ ] **Step 1: Import `computeView`**

At the top of `sdf-js/src/present/info-graphic-render.js`, find the existing import block. Add `computeView` to the existing `linear-layout` import (if there is one) or add a new import:

Find:
```js
// existing imports...
```

Add (or modify if `linear-layout` already imported):
```js
import { computeView } from './linear-layout.js';
```

- [ ] **Step 2: Replace `view: 2.5` with computed value**

Find lines 156-171 of `info-graphic-render.js`:

```js
function drawSliceThumbnail(ctx, sceneData, x, y, size) {
  try {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = size;
    tempCanvas.height = size;
    const renderer = createRendererForId('silhouette', tempCanvas);
    const compiled = compileScene(sceneData);
    renderer.render([{ sdf: compiled.sdf, color: [60, 60, 60] }], {
      background: [245, 245, 245],
      view: 2.5,
    });
    ctx.drawImage(tempCanvas, x, y);
  } catch (e) {
    // Fallback: render an error placeholder
    drawPlaceholder(ctx, x, y, size, 'error', e.message);
  }
}
```

Replace with:

```js
function drawSliceThumbnail(ctx, sceneData, x, y, size) {
  try {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = size;
    tempCanvas.height = size;
    const renderer = createRendererForId('silhouette', tempCanvas);
    const compiled = compileScene(sceneData);
    const view = computeView(sceneData);
    renderer.render([{ sdf: compiled.sdf, color: [60, 60, 60] }], {
      background: [245, 245, 245],
      view,
    });
    ctx.drawImage(tempCanvas, x, y);
  } catch (e) {
    // Fallback: render an error placeholder
    drawPlaceholder(ctx, x, y, size, 'error', e.message);
  }
}
```

- [ ] **Step 3: Verify file parses**

Run: `node --check sdf-js/src/present/info-graphic-render.js`

Expected: no output (syntax OK).

- [ ] **Step 4: Run full test suite (no test directly covers this change since render needs DOM)**

Run: `npm test 2>&1 | tail -5`

Expected: `34/34 test files passed`. The `test-info-graphic-render.mjs` exports-only assertions still pass since signature unchanged.

- [ ] **Step 5: Commit**

```bash
git add sdf-js/src/present/info-graphic-render.js
git commit -m "Sprint 1.5 Phase 1: silhouette auto-fit in drawSliceThumbnail

Replaces hard-coded view=2.5 with computeView(sceneData) from
linear-layout.js. Fixes 'black blob thumbnail' problem when lift LLM
emits sceneData with objects larger than 2.5 world units.

Aether AI 13-page deck: 6 black-blob pages → expected to become legible
after this change. Visual verification deferred to L3 manual re-test."
```

---

## Phase 2 — Fix `rng.random_dec is not a function` error class

Investigation-driven. Do not guess the fix; find the root cause first.

### Task 2.1: Investigate root cause

- [ ] **Step 1: Confirm rng is a real method on Random class**

Run:
```bash
grep -nE "random_dec" sdf-js/src/util/random.js
```

Expected: shows `random_dec()` defined as method on class around line 58.

- [ ] **Step 2: Find all rng injection points**

Run:
```bash
grep -rnE "rng\s*=|let rng|const rng|new Random" sdf-js/src/ 2>/dev/null
```

Note the actual files. Likely candidates:
- `sdf-js/src/scene/compile.js:774` — `rng = new Random(hash)` (primary)
- `sdf-js/src/scene/generator-s.js` — receives rng as arg
- `sdf-js/src/scene/components/community/rune-erosion-filter.js` — receives rng

- [ ] **Step 3: Find all `rng.random_dec()` call sites**

Run:
```bash
grep -rnE "rng\.random_dec" sdf-js/src/ 2>/dev/null
```

For each call site, examine which function call it appears in, and trace backward: where does the function get its `rng` argument? Is it always the real `Random` instance, or could it be a stub/mock/partial object?

- [ ] **Step 4: Check if there's a code path where rng is a partial/stub**

Search for patterns like `rng: {` (stubbing) or `rng = {` (overriding) in the codebase:
```bash
grep -rnE "rng:\s*\{|rng\s*=\s*\{" sdf-js/src/ sdf-js/scripts/ 2>/dev/null
```

Also check test files:
```bash
grep -rnE "rng:|mock.*rng|stub.*rng" sdf-js/scripts/ 2>/dev/null
```

- [ ] **Step 5: Reproduce the bug (if possible)**

If the lift output that triggered the error is cached (localStorage in browser), it's gone now (we don't have user's deck). Best-effort reproduction:

```bash
# Search for the exact error text in any test fixture or recorded lift output
grep -rn "random_dec is not a function" sdf-js/ docs/ 2>/dev/null
```

If empty (no recorded fixture), document this and proceed to **document the most likely cause** (see Step 6).

- [ ] **Step 6: Document findings + decide fix strategy**

Open a file `sdf-js/docs/sprint-1.5-phase-2-investigation.md` (will be deleted after this phase — investigation notes only) and write:

```markdown
# Phase 2 Investigation — `rng.random_dec is not a function`

## Findings

- `rng` IS a real instance of class `Random` in `sdf-js/src/util/random.js:58`
- `rng` IS injected at `sdf-js/src/scene/compile.js:<actual line>` as `new Random(hash)`
- `rng.random_dec()` IS called at:
  - <list call sites with file:line>
- <If found> A partial rng object is constructed at:
  - <file:line>
- <If not found> No partial rng object found in codebase grep. The error likely
  comes from one of these scenarios:
  1. Lift LLM emitted a SceneData primitive type that has its own factory which
     receives a non-`Random` value as rng
  2. Some code path bypasses the rng injection (e.g., a top-level scene constant
     that's evaluated before rng is set up)

## Decision

<Pick one based on findings:>
- A) Fix root cause: <specific file + change>
- B) Add sanity rule: detect this primitive type in `sanity.js` and reject
- C) Document API surface: update lift system prompt with `rng.random_*` API list

## Selected: <A | B | C>
```

Fill in actual findings.

- [ ] **Step 7: Commit investigation notes**

```bash
git add sdf-js/docs/sprint-1.5-phase-2-investigation.md
git commit -m "Sprint 1.5 Phase 2.1: rng error investigation notes

Document findings + decision for fix strategy. Notes deleted in Task 2.3
after fix verified."
```

### Task 2.2: Apply the chosen fix

Based on Phase 2.1 investigation. Steps below are templates — adapt to your specific finding.

- [ ] **Step 1: Apply the fix in the chosen file**

If Strategy A (root cause fix): edit the offending file. Show the diff inline in your commit message body so reviewer understands.

If Strategy B (sanity rule): add new rule to `sdf-js/src/scene/sanity.js`. The structure for new rules:

```js
// In sanity.js, find the rule list (likely an array or function with rule
// functions). Add new function:

function rngApiHallucinationRule(scene) {
  const errors = [];
  // <recursively walk scene.subjects, look for the offending construct>
  // <push to errors with details>
  return errors;
}

// Add to the rule registry where other rules are listed.
```

Then update `sdf-js/scripts/test-sanity.mjs` (likely exists) with a test case for the new rule. Or if rule tests live elsewhere, follow existing convention.

If Strategy C (system prompt update): edit `sdf-js/examples/compositor/system-prompt-lift-3d.md`. Add a new section documenting available random APIs:

```markdown
## Random number generation

Atlas SDF runtime provides a deterministic `rng` instance (seeded from scene
hash) inside primitive factories. Available methods:

- `rng.random_dec()` → number in [0, 1)
- `rng.random_num(a, b)` → number in [a, b)
- `rng.random_int(a, b)` → integer in [a, b]
- `rng.random_bool(p)` → bool, true with probability p
- `rng.random_choice(list)` → uniform pick from array
- `rng.random_angle()` → number in [0, 2π)

Do NOT use `Math.random()` — it breaks determinism. Do NOT call `rng.*` from
emitted SceneData JSON directly — `rng` is only available inside primitive
factory functions registered at engine compile time.
```

Adapt the wording based on actual findings (e.g., if the error is "LLM emitted JSON that references `rng.random_dec` as a string value" then say "Do NOT use `rng.*` as a JSON value — pre-compute values when emitting SceneData").

- [ ] **Step 2: Add a focused unit test for the fix**

Where the fix lives, add a test that would have caught the original error:

If Strategy A: add to `sdf-js/scripts/test-sanity.mjs` (or appropriate test file) a case that constructs the problematic input and verifies the fix prevents the error.

If Strategy B: add to `sdf-js/scripts/test-sanity.mjs` a case that constructs a scene with the hallucinated construct and asserts the rule produces an error.

If Strategy C: no unit test (system prompt is documentation). Instead add a smoke note: "Verified rng API now in system prompt at line X via grep."

Run: `node sdf-js/scripts/test-sanity.mjs` (or whichever test file). Expected: pass.

- [ ] **Step 3: Run full test suite**

Run: `npm test 2>&1 | tail -5`

Expected: still green (34/34 or +1 if you added a new test file).

- [ ] **Step 4: Commit fix**

```bash
git add <files changed>
git commit -m "Sprint 1.5 Phase 2: fix 'rng.random_dec is not a function' error class

Root cause: <one-sentence summary from investigation>
Strategy: <A|B|C — root cause fix | sanity rule | system prompt doc>

Files: <list>

Prevents Aether AI page 4 error class. See investigation notes in
sdf-js/docs/sprint-1.5-phase-2-investigation.md (deleted in Task 2.3)."
```

### Task 2.3: Cleanup investigation notes

- [ ] **Step 1: Delete the investigation notes file**

```bash
git rm sdf-js/docs/sprint-1.5-phase-2-investigation.md
git commit -m "Sprint 1.5 Phase 2.3: remove investigation notes (fix committed)"
```

(The notes were a Phase 2 work-tracking artifact. The fix's commit message captures the conclusion permanently.)

---

## Phase 3 — Anthropic prompt caching

Layer 1 change. Verify compositor demo still works.

### Task 3.1: Add `cache_control` to system prompt block

**Files:**
- Modify: `sdf-js/src/compositor-api.js`

- [ ] **Step 1: Find current `system` field**

Open `sdf-js/src/compositor-api.js`. Find `callLiftLLM` function body (around line 256). The relevant section:

```js
body: JSON.stringify({
  model,
  max_tokens: 8192,
  system: CACHED_SYSTEM_PROMPT_LIFT,
  messages: [{ role: 'user', content: userMessage }],
}),
```

- [ ] **Step 2: Replace with array form**

Change `system: CACHED_SYSTEM_PROMPT_LIFT,` to:

```js
system: [
  {
    type: 'text',
    text: CACHED_SYSTEM_PROMPT_LIFT,
    cache_control: { type: 'ephemeral' },
  },
],
```

- [ ] **Step 3: Verify file parses**

Run: `node --check sdf-js/src/compositor-api.js`

Expected: no output (syntax OK).

- [ ] **Step 4: Run full test suite**

Run: `npm test 2>&1 | tail -5`

Expected: still `34/34 test files passed`. `test-compositor-api.mjs` does not actually hit the Anthropic API (mocked or stubbed), so the change is structural and should pass.

If `test-compositor-api.mjs` tests serialization of the body, the test might need updating. Read the test file first:

```bash
cat sdf-js/scripts/test-compositor-api.mjs | head -80
```

If the test asserts on the body structure, update it to expect the array form. If it just smoke-tests the function exists with a mock fetch, no change needed.

- [ ] **Step 5: Commit**

```bash
git add sdf-js/src/compositor-api.js sdf-js/scripts/test-compositor-api.mjs
git commit -m "Sprint 1.5 Phase 3: enable Anthropic prompt caching for callLiftLLM

system: <string> -> system: [{ type: 'text', text, cache_control: ephemeral }]

Expected ~75% cost savings on cached input tokens after first call within
5-minute TTL. With 39 lift calls per Aether AI deck (3 variants x 13 pages),
saves ~\$1.50/deck at \$3/MTok input rate.

Layer 1 change. Compositor demo verified in Task 3.2."
```

### Task 3.2: Verify compositor demo not broken

- [ ] **Step 1: Start dev server (if not running)**

```bash
# Check if already running
lsof -i :8001 2>&1 | head -3
```

If empty, start:
```bash
cd sdf-js && python3 dev-server.py 8001 &
sleep 2
```

- [ ] **Step 2: Browse to compositor demo**

Setup browse tool:
```bash
B=~/.claude/skills/gstack/browse/dist/browse
[ -x "$B" ] && echo "READY" || echo "NEEDS_SETUP"
```

If READY:
```bash
$B goto http://localhost:8001/examples/compositor/
$B wait --networkidle 2>&1 | tail -3
$B console --errors 2>&1 | head -20
$B screenshot /tmp/sprint-1.5-phase-3-compositor.png
```

- [ ] **Step 3: Read screenshot, verify compositor renders without errors**

Use Read tool on `/tmp/sprint-1.5-phase-3-compositor.png`. Visual check:
- Compositor UI loads (pill bar, prompt input, canvas)
- No red error banner
- No JavaScript console errors

If errors present: revert Phase 3 changes (`git revert HEAD~1`) and re-investigate. The `cache_control` field is Anthropic-API-level; it should not affect compositor UI. If it does, something else is going on.

- [ ] **Step 4: No commit needed for verification — just confirm**

Browse screenshot is verification only, not committed.

---

## Phase 4 — deck-model v4 schema REWRITE

Single big REWRITE (one commit) since old/new schemas are incompatible (per Sprint 1 v4 Phase 3 pattern).

### Task 4.1: REWRITE deck-model.js to v4 schema

**Files:**
- Modify (REWRITE relevant sections): `sdf-js/src/present/deck-model.js`

- [ ] **Step 1: Read current deck-model.js to understand exact shape**

Read full file:
```bash
wc -l sdf-js/src/present/deck-model.js
```

Note line count. If <400, read entire file with Read tool. If larger, read in chunks.

Note the existing exports — at minimum:
- `STORAGE_VERSION` (currently 3)
- `createDeck()`
- `loadDeckFromStorage()`
- `saveDeckToStorage()`
- `addSection()` or similar
- `updateSectionStatus()` or similar
- `migrateDecksStorage()` (silent drop logic)

- [ ] **Step 2: Update `STORAGE_VERSION` to 4**

Find:
```js
export const STORAGE_VERSION = 3;
```

Replace with:
```js
export const STORAGE_VERSION = 4;
```

(Existing `migrateDecksStorage` already silent-drops non-matching versions, so v3 deck loads will return empty just like v1/v2 did before. Per spec §3.4: silent drop locked.)

- [ ] **Step 3: Update `@typedef SectionEntry` JSDoc**

Find the JSDoc block for `SectionEntry` (around line 59). Replace it with:

```js
/**
 * @typedef {object} SectionVariant
 * @property {'minimal'|'abstract'|'dense'} styleHint
 * @property {'pending'|'lifting'|'ready'|'error'} status
 * @property {object} [sceneData] — present when status === 'ready'
 * @property {object} [region] — present when status === 'ready'
 * @property {string} [liftError] — present when status === 'error'
 */

/**
 * @typedef {object} SectionEntry
 * @property {string} id
 * @property {number} pageIndex
 * @property {'pending'|'lifting'|'ready'|'error'} status — derived from variants (see deriveStatus)
 * @property {object} slideData
 * @property {string} code2d
 * @property {string} prompt
 * @property {SectionVariant[]} variants — always exactly 3 entries
 * @property {number} selectedVariantIndex — 0..2
 */
```

- [ ] **Step 4: Add `STYLE_HINTS` constant and `deriveStatus` helper**

After existing constants near top of file, add:

```js
export const STYLE_HINTS = ['minimal', 'abstract', 'dense'];

/**
 * Derive a section's aggregated status from its variants.
 *
 * Rules:
 *   - 'pending' if all 3 variants pending
 *   - 'lifting' if any variant lifting
 *   - 'ready' if at least 1 variant ready (and none lifting)
 *   - 'error' if all 3 variants error
 *
 * @param {SectionVariant[]} variants
 * @returns {'pending'|'lifting'|'ready'|'error'}
 */
export function deriveStatus(variants) {
  if (variants.some((v) => v.status === 'lifting')) return 'lifting';
  if (variants.some((v) => v.status === 'ready')) return 'ready';
  if (variants.every((v) => v.status === 'error')) return 'error';
  return 'pending';
}
```

- [ ] **Step 5: Update section construction (where sections are created)**

Find the function that creates new sections (likely `addSection`, `addSections`, or inline in `createDeck`). The existing shape is:

```js
{
  id: <uuid>,
  pageIndex: <n>,
  status: 'pending',
  slideData: <data>,
  code2d: <str>,
  prompt: <str>,
}
```

Update to:

```js
{
  id: <uuid>,
  pageIndex: <n>,
  status: 'pending',
  slideData: <data>,
  code2d: <str>,
  prompt: <str>,
  variants: STYLE_HINTS.map((styleHint) => ({
    styleHint,
    status: 'pending',
  })),
  selectedVariantIndex: 0,
}
```

(Three variants, each with its own pending status. `selectedVariantIndex` defaults to 0 = the "minimal" variant.)

- [ ] **Step 6: Update `updateSectionStatus` → split into `updateVariantStatus` + auto-derive section status**

Find existing `updateSectionStatus(deck, sectionId, status, payload)`. Replace with:

```js
/**
 * Update a single variant's status + optionally merge payload. After variant
 * update, derive and apply the section's aggregated status.
 *
 * @param {object} deck
 * @param {string} sectionId
 * @param {number} variantIndex — 0..2
 * @param {'pending'|'lifting'|'ready'|'error'} status
 * @param {object} [payload] — merged into the variant: { sceneData, region, liftError }
 * @returns {boolean} true if update succeeded
 */
export function updateVariantStatus(deck, sectionId, variantIndex, status, payload = {}) {
  const section = deck.sections.find((s) => s.id === sectionId);
  if (!section) return false;
  if (variantIndex < 0 || variantIndex >= section.variants.length) return false;
  const variant = section.variants[variantIndex];
  variant.status = status;
  if (payload.sceneData !== undefined) variant.sceneData = payload.sceneData;
  if (payload.region !== undefined) variant.region = payload.region;
  if (payload.liftError !== undefined) variant.liftError = payload.liftError;
  section.status = deriveStatus(section.variants);
  deck.updatedAt = Date.now();
  return true;
}

/**
 * Switch a section's selectedVariantIndex (UI: user picks a variant).
 *
 * @param {object} deck
 * @param {string} sectionId
 * @param {number} variantIndex — 0..2
 * @returns {boolean}
 */
export function selectVariant(deck, sectionId, variantIndex) {
  const section = deck.sections.find((s) => s.id === sectionId);
  if (!section) return false;
  if (variantIndex < 0 || variantIndex >= section.variants.length) return false;
  section.selectedVariantIndex = variantIndex;
  deck.updatedAt = Date.now();
  return true;
}
```

If existing `updateSectionStatus` is referenced elsewhere (pipeline.js, library-page.js, etc.), keep it exported as a thin wrapper for backward compat:

```js
/**
 * @deprecated — Sprint 1 v4 entry. Sprint 1.5+ use updateVariantStatus.
 *   This wrapper updates variants[0] only. Kept temporarily for migration.
 *   To remove after pipeline.js Phase 5 + library-page.js Phase 6 fully migrate.
 */
export function updateSectionStatus(deck, sectionId, status, payload = {}) {
  return updateVariantStatus(deck, sectionId, 0, status, payload);
}
```

Pipeline.js (Phase 5) and library-page.js (Phase 6) will migrate off this. Once migrated (verify with grep), delete the wrapper in Phase 6 Task 6.3.

- [ ] **Step 7: Add `getSelectedVariant` helper**

After existing exports, add:

```js
/**
 * Convenience accessor for a section's currently selected variant.
 *
 * @param {object} section
 * @returns {SectionVariant | null} null if no variants array (corrupt)
 */
export function getSelectedVariant(section) {
  if (!section || !Array.isArray(section.variants)) return null;
  const idx = Number.isInteger(section.selectedVariantIndex) ? section.selectedVariantIndex : 0;
  return section.variants[idx] || section.variants[0] || null;
}
```

- [ ] **Step 8: Verify file parses + CI grep clean**

Run:
```bash
node --check sdf-js/src/present/deck-model.js
```

Expected: no output.

Then run mode-agnostic CI grep:
```bash
grep -nE "\b(camera|yaw|pitch|distance|focal|waypoint|cameraSequence|tween|easing)\b" sdf-js/src/present/deck-model.js | grep -vE "MUST NOT contain|NOT contain 3D vocabulary"
echo "EXIT: $?"
```

Expected: empty output, EXIT: 1 (no matches → clean).

If matches: review and fix (likely accidentally added a 3D vocabulary word in a new comment).

- [ ] **Step 9: No commit yet — test file rewrite in Task 4.2 lands with this**

### Task 4.2: REWRITE `test-deck-model.mjs` for v4 schema

**Files:**
- Modify (REWRITE): `sdf-js/scripts/test-deck-model.mjs`

- [ ] **Step 1: Read current test file**

```bash
wc -l sdf-js/scripts/test-deck-model.mjs
```

Read entire file. Identify which tests cover:
- `createDeck`
- `addSection`/`addSections`
- `updateSectionStatus`
- `loadDeckFromStorage` / `saveDeckToStorage`
- `migrateDecksStorage` (silent drop)

- [ ] **Step 2: Update imports**

At top of `sdf-js/scripts/test-deck-model.mjs`, find the import line:
```js
import {
  STORAGE_VERSION,
  createDeck,
  // ...
} from '../src/present/deck-model.js';
```

Add new exports:
```js
import {
  STORAGE_VERSION,
  STYLE_HINTS,
  createDeck,
  // ... (existing imports)
  deriveStatus,
  updateVariantStatus,
  selectVariant,
  getSelectedVariant,
} from '../src/present/deck-model.js';
```

- [ ] **Step 3: Update `STORAGE_VERSION` assertion**

Find:
```js
console.assert(STORAGE_VERSION === 3, ...);
```

Replace with:
```js
console.assert(STORAGE_VERSION === 4, `STORAGE_VERSION should be 4, got ${STORAGE_VERSION}`);
console.log('  ✓ STORAGE_VERSION = 4');
```

- [ ] **Step 4: Update section creation tests for v4 shape**

Find tests that assert section shape after creation. Existing pattern likely:
```js
const section = deck.sections[0];
console.assert(section.status === 'pending', ...);
console.assert(section.sceneData === undefined, ...);
```

Replace with:
```js
const section = deck.sections[0];
console.assert(section.status === 'pending', `section.status should be 'pending', got ${section.status}`);
console.log('  ✓ section.status defaults to pending');

console.assert(Array.isArray(section.variants), 'section.variants should be an array');
console.assert(section.variants.length === 3, `section should have 3 variants, got ${section.variants.length}`);
console.log('  ✓ section has 3 variants');

console.assert(
  section.variants[0].styleHint === 'minimal' &&
  section.variants[1].styleHint === 'abstract' &&
  section.variants[2].styleHint === 'dense',
  `variant style hints should be minimal/abstract/dense, got ${section.variants.map((v) => v.styleHint).join('/')}`,
);
console.log('  ✓ variants have style hints minimal/abstract/dense');

console.assert(section.selectedVariantIndex === 0, `selectedVariantIndex default should be 0, got ${section.selectedVariantIndex}`);
console.log('  ✓ selectedVariantIndex defaults to 0');

console.assert(
  section.variants.every((v) => v.status === 'pending'),
  'all variants should start as pending',
);
console.log('  ✓ all variants start pending');
```

- [ ] **Step 5: Add tests for `deriveStatus`**

After existing tests, add new block:

```js
console.log('\n--- deriveStatus tests (Sprint 1.5) ---');

{
  const variants = [{ status: 'pending' }, { status: 'pending' }, { status: 'pending' }];
  console.assert(deriveStatus(variants) === 'pending', 'all pending → pending');
  console.log('  ✓ all pending → pending');
}
{
  const variants = [{ status: 'lifting' }, { status: 'pending' }, { status: 'pending' }];
  console.assert(deriveStatus(variants) === 'lifting', 'any lifting → lifting');
  console.log('  ✓ any lifting → lifting');
}
{
  const variants = [{ status: 'ready' }, { status: 'pending' }, { status: 'pending' }];
  console.assert(deriveStatus(variants) === 'ready', 'any ready (none lifting) → ready');
  console.log('  ✓ any ready → ready');
}
{
  const variants = [{ status: 'ready' }, { status: 'lifting' }, { status: 'error' }];
  console.assert(deriveStatus(variants) === 'lifting', 'lifting trumps ready');
  console.log('  ✓ lifting trumps ready');
}
{
  const variants = [{ status: 'error' }, { status: 'error' }, { status: 'error' }];
  console.assert(deriveStatus(variants) === 'error', 'all error → error');
  console.log('  ✓ all error → error');
}
{
  const variants = [{ status: 'error' }, { status: 'error' }, { status: 'ready' }];
  console.assert(deriveStatus(variants) === 'ready', 'some error + some ready → ready');
  console.log('  ✓ some error + some ready → ready');
}
```

- [ ] **Step 6: Add tests for `updateVariantStatus`**

```js
console.log('\n--- updateVariantStatus tests (Sprint 1.5) ---');

{
  const deck = createDeck('Test', { type: 'pdf', fileName: 'a.pdf', pageCount: 1 });
  // <use existing addSection / addSections function to add 1 section — adapt name>
  // Assume `addSections` takes (deck, [{slideData, code2d, prompt}]) — adjust to real signature
  addSections(deck, [{ slideData: {}, code2d: '// code', prompt: 'page 1' }]);

  const sectionId = deck.sections[0].id;
  const ok = updateVariantStatus(deck, sectionId, 0, 'lifting');
  console.assert(ok === true, 'updateVariantStatus returns true');
  console.assert(deck.sections[0].variants[0].status === 'lifting', 'variant 0 status = lifting');
  console.assert(deck.sections[0].status === 'lifting', 'section status derived = lifting');
  console.log('  ✓ updateVariantStatus updates variant + derives section status');

  // Update with payload
  updateVariantStatus(deck, sectionId, 0, 'ready', {
    sceneData: { v: 1, subjects: [] },
    region: { centerX: 0, centerY: 0, halfWidth: 0.5, halfHeight: 0.5 },
  });
  console.assert(deck.sections[0].variants[0].sceneData !== undefined, 'sceneData merged into variant');
  console.assert(deck.sections[0].variants[0].region !== undefined, 'region merged into variant');
  console.assert(deck.sections[0].status === 'ready', 'section status = ready (1 of 3 ready)');
  console.log('  ✓ updateVariantStatus merges payload + re-derives status');

  // Invalid variant index
  const bad = updateVariantStatus(deck, sectionId, 99, 'ready');
  console.assert(bad === false, 'invalid variantIndex returns false');
  console.log('  ✓ invalid variantIndex rejected');

  // Invalid section id
  const bad2 = updateVariantStatus(deck, 'nonexistent', 0, 'ready');
  console.assert(bad2 === false, 'invalid sectionId returns false');
  console.log('  ✓ invalid sectionId rejected');
}
```

(Adapt `addSections` to the actual function name in deck-model.js. Read the file if unsure.)

- [ ] **Step 7: Add tests for `selectVariant`**

```js
console.log('\n--- selectVariant tests (Sprint 1.5) ---');

{
  const deck = createDeck('Test', { type: 'pdf', fileName: 'a.pdf', pageCount: 1 });
  addSections(deck, [{ slideData: {}, code2d: '// code', prompt: 'page 1' }]);
  const sectionId = deck.sections[0].id;

  const ok = selectVariant(deck, sectionId, 2);
  console.assert(ok === true, 'selectVariant returns true');
  console.assert(deck.sections[0].selectedVariantIndex === 2, 'selectedVariantIndex updated to 2');
  console.log('  ✓ selectVariant updates index');

  const bad = selectVariant(deck, sectionId, 99);
  console.assert(bad === false, 'out-of-range variant index rejected');
  console.assert(deck.sections[0].selectedVariantIndex === 2, 'index unchanged after rejected select');
  console.log('  ✓ out-of-range rejected');
}
```

- [ ] **Step 8: Add tests for `getSelectedVariant`**

```js
console.log('\n--- getSelectedVariant tests (Sprint 1.5) ---');

{
  const deck = createDeck('Test', { type: 'pdf', fileName: 'a.pdf', pageCount: 1 });
  addSections(deck, [{ slideData: {}, code2d: '// code', prompt: 'page 1' }]);
  const section = deck.sections[0];

  const v = getSelectedVariant(section);
  console.assert(v !== null, 'getSelectedVariant returns non-null');
  console.assert(v.styleHint === 'minimal', 'default variant is minimal');
  console.log('  ✓ getSelectedVariant returns selectedVariantIndex variant');

  selectVariant(deck, section.id, 2);
  const v2 = getSelectedVariant(section);
  console.assert(v2.styleHint === 'dense', 'after select, returns new variant');
  console.log('  ✓ getSelectedVariant tracks selectedVariantIndex');

  const bad = getSelectedVariant({});
  console.assert(bad === null, 'empty object returns null');
  console.log('  ✓ corrupt section returns null');
}
```

- [ ] **Step 9: Update silent-drop migration test**

Find existing test for `migrateDecksStorage` (likely tests v1 and v2 drop). Add v3 to the list:

```js
{
  // v3 (Sprint 1 v4 schema) is now also silent-dropped (Sprint 1.5 = v4)
  const v3Raw = { version: 3, decks: [{ id: 'old', title: 'v3 deck' }] };
  const migrated = migrateDecksStorage(v3Raw);
  console.assert(migrated.version === 4, 'v3 raw → version 4');
  console.assert(migrated.decks.length === 0, 'v3 decks dropped');
  console.log('  ✓ v3 silent-dropped (Sprint 1.5 spec lock)');
}
```

- [ ] **Step 10: Run test file**

Run: `node sdf-js/scripts/test-deck-model.mjs`

Expected: all ✓ lines, no assertion errors. Output should end with something like "All tests passed" if file has summary, or just no errors thrown.

- [ ] **Step 11: Run full test suite**

Run: `npm test 2>&1 | tail -5`

Expected: still `34/34 test files passed`. (We didn't add new files, just updated existing.)

- [ ] **Step 12: Verify CI grep on deck-model.js**

```bash
grep -nE "\b(camera|yaw|pitch|distance|focal|waypoint|cameraSequence|tween|easing)\b" sdf-js/src/present/deck-model.js | grep -vE "MUST NOT contain|NOT contain 3D vocabulary"
echo "EXIT: $?"
```

Expected: EXIT: 1 (no matches outside enforcement banner).

- [ ] **Step 13: Commit Phase 4**

```bash
git add sdf-js/src/present/deck-model.js sdf-js/scripts/test-deck-model.mjs
git commit -m "Sprint 1.5 Phase 4: deck-model v4 schema (variants[] + selectedVariantIndex)

Schema v3 -> v4: section.sceneData/region/liftError migrated into
section.variants[3]. Each variant carries styleHint (minimal/abstract/dense)
+ its own status + optional sceneData/region/liftError.

New exports: STYLE_HINTS, deriveStatus, updateVariantStatus, selectVariant,
getSelectedVariant.

Deprecated (kept temporarily): updateSectionStatus wrapper -> variants[0].
To remove in Phase 6 after pipeline.js + library-page.js fully migrate.

Migration: v3 silent drop (per spec §3.4 lock 2026-06-20, consistent with
v1/v2 silent drop policy from Sprint 1 v4).

CI grep clean (no 3D vocabulary outside banner)."
```

---

## Phase 5 — pipeline.js variant loop

### Task 5.1: Inner variant loop in pipeline.js

**Files:**
- Modify: `sdf-js/src/present/pipeline.js`

- [ ] **Step 1: Read pipeline.js current structure**

```bash
wc -l sdf-js/src/present/pipeline.js
```

Read full file. Identify:
- Where the outer per-section loop is (line ~85)
- Where lift is called (line ~104-108)
- Where status updates happen (lines ~100, ~112-118)
- What events are emitted

- [ ] **Step 2: Update imports**

At top of `sdf-js/src/present/pipeline.js`, find current imports. Add `STYLE_HINTS` + `updateVariantStatus`:

```js
import {
  STYLE_HINTS,
  updateVariantStatus,
  addSections,        // or whatever the existing name is
  // ... (existing imports)
} from './deck-model.js';
```

(Adjust based on actual existing imports.)

- [ ] **Step 3: Replace outer-only loop with nested section × variant loop**

Find the existing loop (around lines 90-130). Pattern is:

```js
for (const section of deck.sections) {
  if (cancelled) {
    onEvent({ type: 'cancelled' });
    running = false;
    return;
  }
  if (section.status !== 'pending') continue;

  onEvent({ type: 'lift-start', sectionId: section.id, pageIndex: section.pageIndex });
  deckModel.updateSectionStatus(deck, section.id, 'lifting');
  deps.saveDeck(deck);

  try {
    const llmResult = await deps.callLiftLLM(section.prompt, section.code2d, apiKey);
    // ...
    const region = regions[section.pageIndex];
    deckModel.updateSectionStatus(deck, section.id, 'ready', { sceneData, region });
    deps.saveDeck(deck);
    onEvent({ type: 'lift-ready', sectionId: section.id, pageIndex: section.pageIndex });
  } catch (e) {
    // ...
  }
}
```

Replace with:

```js
for (const section of deck.sections) {
  if (cancelled) {
    onEvent({ type: 'cancelled' });
    running = false;
    return;
  }
  // Skip whole section if all variants already done (resume support)
  if (section.variants.every((v) => v.status === 'ready' || v.status === 'error')) continue;

  for (let variantIndex = 0; variantIndex < section.variants.length; variantIndex++) {
    if (cancelled) {
      onEvent({ type: 'cancelled' });
      running = false;
      return;
    }
    const variant = section.variants[variantIndex];
    if (variant.status !== 'pending') continue; // skip already-done variant

    const styleHint = variant.styleHint;
    const styledPrompt = `${section.prompt} — Style: ${styleHintDescription(styleHint)}`;

    onEvent({
      type: 'lift-start',
      sectionId: section.id,
      pageIndex: section.pageIndex,
      variantIndex,
      styleHint,
    });
    updateVariantStatus(deck, section.id, variantIndex, 'lifting');
    deps.saveDeck(deck);

    try {
      const llmResult = await deps.callLiftLLM(styledPrompt, section.code2d, apiKey);
      if (cancelled) {
        onEvent({ type: 'cancelled' });
        running = false;
        return;
      }
      const sceneData = deps.parseLiftResponse(llmResult.text);

      // Compute region for this variant. Use the section's selected variant's
      // sceneData for already-ready siblings to keep linear-layout stable.
      const regions = computeRegions(
        deck.sections.map((s, i) => {
          if (i === section.pageIndex) {
            return { sceneData, title: section.prompt };
          }
          const sel = s.variants[s.selectedVariantIndex];
          return {
            sceneData: sel?.sceneData ?? { v: 1, subjects: [] },
            title: s.prompt,
          };
        }),
        deck.layout.spacing,
      );
      const region = regions[section.pageIndex];

      updateVariantStatus(deck, section.id, variantIndex, 'ready', { sceneData, region });
      deps.saveDeck(deck);
      onEvent({
        type: 'lift-ready',
        sectionId: section.id,
        pageIndex: section.pageIndex,
        variantIndex,
        styleHint,
      });
    } catch (e) {
      updateVariantStatus(deck, section.id, variantIndex, 'error', { liftError: e.message });
      deps.saveDeck(deck);
      onEvent({
        type: 'lift-error',
        sectionId: section.id,
        pageIndex: section.pageIndex,
        variantIndex,
        styleHint,
        error: e.message,
      });
      // Continue to next variant (don't abort whole section on 1 variant error)
    }
  } // end variants loop
} // end sections loop
```

- [ ] **Step 4: Add the `styleHintDescription` helper**

After the createPipeline function (or wherever helpers go in this file), add:

```js
/**
 * Human-friendly suffix appended to the section prompt for variant lift.
 * Matches the 3 styleHints defined in deck-model.js STYLE_HINTS.
 *
 * @param {'minimal'|'abstract'|'dense'} styleHint
 * @returns {string}
 */
function styleHintDescription(styleHint) {
  switch (styleHint) {
    case 'minimal':
      return 'minimal, focus on the core concept with few large objects';
    case 'abstract':
      return 'abstract, use geometric shapes that suggest the idea metaphorically';
    case 'dense':
      return 'dense, include multiple objects showing all key entities';
    default:
      return styleHint;
  }
}
```

- [ ] **Step 5: Verify file parses**

```bash
node --check sdf-js/src/present/pipeline.js
```

Expected: no output.

- [ ] **Step 6: Update `test-pipeline.mjs` for variant events**

Read existing `sdf-js/scripts/test-pipeline.mjs`. Find existing tests for `lift-start` / `lift-ready` events.

Update the import block to include the new variant-aware functions if needed:
```js
import { createDeck, addSections } from '../src/present/deck-model.js';
```

(No new imports needed for `createPipeline`; only deck-model needs `STYLE_HINTS` exposed for the tests.)

Update event assertion tests to expect variant-aware events:

```js
// In existing happy path test, find assertions like:
//   const liftStartEvents = events.filter(e => e.type === 'lift-start');
//   console.assert(liftStartEvents.length === 1, '1 lift-start for 1 section');

// Change to expect 3 (one per variant):
const liftStartEvents = events.filter((e) => e.type === 'lift-start');
console.assert(
  liftStartEvents.length === 3,
  `1 section × 3 variants = 3 lift-start events, got ${liftStartEvents.length}`,
);
console.log('  ✓ 3 lift-start events (one per variant)');

console.assert(
  liftStartEvents.every((e) => typeof e.variantIndex === 'number'),
  'lift-start events have variantIndex',
);
console.log('  ✓ lift-start events carry variantIndex');

console.assert(
  liftStartEvents.every((e) => ['minimal', 'abstract', 'dense'].includes(e.styleHint)),
  'lift-start events have valid styleHint',
);
console.log('  ✓ lift-start events carry styleHint');

// Similar updates for lift-ready / lift-error events
const liftReadyEvents = events.filter((e) => e.type === 'lift-ready');
console.assert(
  liftReadyEvents.length === 3,
  `3 lift-ready events (all variants ready), got ${liftReadyEvents.length}`,
);
console.log('  ✓ 3 lift-ready events');
```

Also add a new test block for "1 of 3 variants errors, others succeed":

```js
console.log('\n--- variant error tolerance test (Sprint 1.5) ---');

{
  // Mock that errors only on variant 1 (abstract)
  const deck = createDeck('Test', { type: 'pdf', fileName: 'a.pdf', pageCount: 1 });
  addSections(deck, [{ slideData: { title: 'page 1' }, code2d: '// code', prompt: 'page 1' }]);

  let callCount = 0;
  const mockDeps = {
    callLiftLLM: async (prompt) => {
      callCount++;
      // Variant 1 (abstract) is the 2nd call (0=minimal, 1=abstract, 2=dense)
      if (callCount === 2) throw new Error('mock variant error');
      return { text: '{ "v": 1, "subjects": [] }' };
    },
    parseLiftResponse: (text) => JSON.parse(text),
    saveDeck: () => {},
  };

  const events = [];
  const pipeline = createPipeline(deck, new Uint8Array(0), 'fake-key', mockDeps, {
    onEvent: (e) => events.push(e),
  });
  // Skip parse (no PDF bytes); fast-forward state to having a section ready for lift
  // Simulate by setting parsed already... actually pipeline starts with parsePDF, need to mock that too:
  mockDeps.parsePDFFromBytes = async () => [{ title: 'page 1' }];
  mockDeps.emitSlide2dCode = () => '// code';

  await pipeline.start();

  const errorEvents = events.filter((e) => e.type === 'lift-error');
  const readyEvents = events.filter((e) => e.type === 'lift-ready');

  console.assert(errorEvents.length === 1, `1 variant error, got ${errorEvents.length}`);
  console.assert(errorEvents[0].styleHint === 'abstract', `error was for abstract variant`);
  console.assert(readyEvents.length === 2, `2 variants ready, got ${readyEvents.length}`);
  console.assert(
    deck.sections[0].status === 'ready',
    `section status = ready (1 of 3 ready, not all error), got ${deck.sections[0].status}`,
  );
  console.log('  ✓ variant error does not abort section; section status correctly derived');
}
```

- [ ] **Step 7: Run pipeline tests**

Run: `node sdf-js/scripts/test-pipeline.mjs`

Expected: all ✓ lines, no errors.

If errors: likely cause is the test's existing assumptions about event count or shape don't match the new 3× variant lift. Read errors carefully and update assertions to match. The test mocks (callLiftLLM, parseLiftResponse, saveDeck) should still work as long as they don't assume single-variant behavior.

- [ ] **Step 8: Run full test suite**

```bash
npm test 2>&1 | tail -5
```

Expected: still `34/34 test files passed`.

- [ ] **Step 9: Commit Phase 5**

```bash
git add sdf-js/src/present/pipeline.js sdf-js/scripts/test-pipeline.mjs
git commit -m "Sprint 1.5 Phase 5: pipeline variant generation (3 variants per section)

Inner loop runs 3 variants per section serial. Each variant gets a different
style hint suffix appended to the section prompt:
  - minimal: focus on core concept with few large objects
  - abstract: geometric shapes suggesting the idea metaphorically
  - dense: multiple objects showing all key entities

Variant errors are tolerated — pipeline continues to next variant. Section
status derived via deriveStatus from variants array (ready if any ready).

Events extended with variantIndex + styleHint fields. Cancel checkpoint
moved inside variant loop (cancellation is per-variant-granular).

Pipeline test updated for 3× event count + new variant-error tolerance test."
```

---

## Phase 6 — UI variant picker + info-graphic adaptation + browse smoke

Three parallel sub-tasks within this phase. Each commits separately.

### Task 6.1: info-graphic-render.js reads variants[selectedVariantIndex]

**Files:**
- Modify: `sdf-js/src/present/info-graphic-render.js`
- Modify: `sdf-js/scripts/test-info-graphic-render.mjs`

- [ ] **Step 1: Update imports**

At top of `sdf-js/src/present/info-graphic-render.js`, find the existing deck-model import (if any) or add:

```js
import { getSelectedVariant } from './deck-model.js';
```

- [ ] **Step 2: Update where sceneData is read from section**

Find every place in `info-graphic-render.js` where the code does `section.sceneData` or `section.region`. The change is:

```js
// Before:
const sceneData = section.sceneData;
const region = section.region;

// After:
const variant = getSelectedVariant(section);
const sceneData = variant?.sceneData;
const region = variant?.region;
```

Likely call sites:
- Wherever the main render walks `deck.sections` and reads each section's sceneData for placement
- Wherever `drawSliceThumbnail` is called

Use grep to find all sites:

```bash
grep -nE "section\.(sceneData|region|status)" sdf-js/src/present/info-graphic-render.js
```

For each `section.sceneData` reference, replace with the variant-aware accessor. For `section.status`, keep as-is (section.status is still computed by `deriveStatus`).

- [ ] **Step 3: Update `test-info-graphic-render.mjs` to use v4 schema**

Read the existing test file. Find the deck creation block (likely creates a fake deck with sections).

Update fixtures to use v4 shape:

```js
// Before (v3-style):
deck.sections.push({
  id: 'sec-1',
  pageIndex: 0,
  status: 'ready',
  slideData: {},
  code2d: '',
  prompt: 'page 1',
  sceneData: { v: 1, subjects: [] },
  region: { centerX: 0, centerY: 0, halfWidth: 0.5, halfHeight: 0.5 },
});

// After (v4-style):
deck.sections.push({
  id: 'sec-1',
  pageIndex: 0,
  status: 'ready',
  slideData: {},
  code2d: '',
  prompt: 'page 1',
  variants: [
    {
      styleHint: 'minimal',
      status: 'ready',
      sceneData: { v: 1, subjects: [] },
      region: { centerX: 0, centerY: 0, halfWidth: 0.5, halfHeight: 0.5 },
    },
    { styleHint: 'abstract', status: 'pending' },
    { styleHint: 'dense', status: 'pending' },
  ],
  selectedVariantIndex: 0,
});
```

Or, better, refactor to use the deck-model APIs (createDeck + addSections + updateVariantStatus) so the test isn't tightly coupled to internal shape.

- [ ] **Step 4: Run test**

Run: `node sdf-js/scripts/test-info-graphic-render.mjs`

Expected: passes.

- [ ] **Step 5: Run full test suite**

Run: `npm test 2>&1 | tail -5`

Expected: still `34/34 test files passed`.

- [ ] **Step 6: Commit Task 6.1**

```bash
git add sdf-js/src/present/info-graphic-render.js sdf-js/scripts/test-info-graphic-render.mjs
git commit -m "Sprint 1.5 Phase 6.1: info-graphic-render reads variants[selectedVariantIndex]

Uses getSelectedVariant() helper. When user picks a different variant
(Phase 6.2 UI), this renderer is called again with the same deck but
gets the newly selected variant's sceneData/region.

Test fixtures updated to v4 schema (variants[] + selectedVariantIndex)."
```

### Task 6.2: deck-view.js variant picker UI

**Files:**
- Modify: `sdf-js/src/present/deck-view.js`
- Modify: `sdf-js/examples/present/style.css`

- [ ] **Step 1: Read current deck-view.js**

```bash
wc -l sdf-js/src/present/deck-view.js
```

Read full file. Understand the render flow: which canvas elements are created, where the main info graphic canvas is mounted, where click handlers attach.

- [ ] **Step 2: Plan picker UI structure**

Layout (text mockup):

```
┌────────────────────────────────────────┐
│ Main canvas (full info graphic)        │
│                                        │
│  [1] [2] [3] [4] [5] ... [13]          │
│                                        │
└────────────────────────────────────────┘
[click any section thumbnail above]
  ↓
Variant picker panel appears below:
┌────────────────────────────────────────┐
│ Section 4 — page 4                     │
│  ┌──────┐  ┌──────┐  ┌──────┐          │
│  │ min  │  │ abs  │  │dense │          │
│  │      │  │ (sel)│  │      │          │
│  └──────┘  └──────┘  └──────┘          │
│  [Close]                               │
└────────────────────────────────────────┘
```

- [ ] **Step 3: Add picker DOM structure on mount**

In `deck-view.js`, find where the main canvas element is appended to the deck-view container. After it, append a hidden picker panel:

```js
const pickerPanel = document.createElement('div');
pickerPanel.id = 'variant-picker-panel';
pickerPanel.style.display = 'none';
pickerPanel.innerHTML = `
  <div class="variant-picker-header">
    <span id="variant-picker-title">Variant picker</span>
    <button id="variant-picker-close" aria-label="Close picker">✕</button>
  </div>
  <div id="variant-picker-thumbs"></div>
`;
deckViewContainer.appendChild(pickerPanel);

// Close button handler
document.getElementById('variant-picker-close').addEventListener('click', () => {
  pickerPanel.style.display = 'none';
});
```

(Adjust `deckViewContainer` to the actual variable name in deck-view.js.)

- [ ] **Step 4: Add canvas click handler that maps clicks to sections**

In `deck-view.js`, after the main info-graphic canvas is rendered, add a click listener that determines which section was clicked based on x-coordinate. The info-graphic layout is linear sections placed along x — section width is computed from `linear-layout.js`.

```js
mainCanvas.addEventListener('click', (e) => {
  const rect = mainCanvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (mainCanvas.width / rect.width);
  const y = (e.clientY - rect.top) * (mainCanvas.height / rect.height);

  // Compute which section the click hit. Sections are placed at regular
  // intervals along x — use `deck.sections` and their region.centerX (which
  // is derived from `deck.layout.spacing`).
  const sectionIndex = findSectionAtX(deck, x, mainCanvas.width);
  if (sectionIndex !== null) {
    openVariantPicker(deck, sectionIndex);
  }
});

function findSectionAtX(deck, canvasX, canvasWidth) {
  // Map canvas x to world x: canvas spans [-totalView, +totalView] in world coords
  // where totalView is implicitly the deck's full span.
  // Simpler: divide canvasWidth into N equal section bands.
  const N = deck.sections.length;
  if (N === 0) return null;
  const sectionWidth = canvasWidth / N;
  const idx = Math.floor(canvasX / sectionWidth);
  if (idx < 0 || idx >= N) return null;
  return idx;
}
```

(The mapping from click x to section index is a simplification — true mapping depends on info-graphic-render's layout logic. If accuracy matters, refactor `info-graphic-render.js` to also export section bounds, then deck-view uses that.)

- [ ] **Step 5: Implement `openVariantPicker`**

```js
function openVariantPicker(deck, sectionIndex) {
  const section = deck.sections[sectionIndex];
  if (!section) return;

  const titleEl = document.getElementById('variant-picker-title');
  titleEl.textContent = `Section ${sectionIndex + 1} — ${section.prompt || 'untitled'}`;

  const thumbsEl = document.getElementById('variant-picker-thumbs');
  thumbsEl.innerHTML = ''; // clear

  section.variants.forEach((variant, variantIdx) => {
    const thumbWrapper = document.createElement('div');
    thumbWrapper.className = 'variant-thumb';
    if (variantIdx === section.selectedVariantIndex) {
      thumbWrapper.classList.add('selected');
    }

    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 120;
    thumbCanvas.height = 120;
    thumbWrapper.appendChild(thumbCanvas);

    const label = document.createElement('div');
    label.className = 'variant-thumb-label';
    label.textContent = variant.styleHint;
    if (variant.status === 'error') {
      label.textContent += ' (error)';
    } else if (variant.status === 'pending' || variant.status === 'lifting') {
      label.textContent += ` (${variant.status})`;
    }
    thumbWrapper.appendChild(label);

    // Render variant if ready
    if (variant.status === 'ready' && variant.sceneData) {
      // Reuse drawSliceThumbnail logic — import or extract
      drawVariantThumb(thumbCanvas, variant.sceneData);
    } else {
      const ctx = thumbCanvas.getContext('2d');
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);
      ctx.fillStyle = '#888';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const placeholderText =
        variant.status === 'error'
          ? '⚠'
          : variant.status === 'lifting'
            ? '...'
            : '—';
      ctx.fillText(placeholderText, thumbCanvas.width / 2, thumbCanvas.height / 2);
    }

    // Click handler: select this variant
    thumbWrapper.addEventListener('click', () => {
      handleVariantSelect(deck, section.id, variantIdx);
    });

    thumbsEl.appendChild(thumbWrapper);
  });

  document.getElementById('variant-picker-panel').style.display = 'block';
}

function handleVariantSelect(deck, sectionId, variantIdx) {
  // Use deck-model.selectVariant to update state
  import('./deck-model.js').then(({ selectVariant, saveDeckToStorage }) => {
    if (selectVariant(deck, sectionId, variantIdx)) {
      saveDeckToStorage(deck);
      // Re-render main info graphic with new selection
      renderInfoGraphic();
      // Close picker
      document.getElementById('variant-picker-panel').style.display = 'none';
    }
  });
}
```

(`renderInfoGraphic()` is the existing function that re-renders the main canvas — find its actual name in deck-view.js and use it. `import('./deck-model.js')` uses dynamic import to avoid circular dependency; if static import is fine, prefer that and move the call out of the handler.)

- [ ] **Step 6: Extract `drawVariantThumb` helper**

Define `drawVariantThumb(canvas, sceneData)` in deck-view.js — mirror the structure of `drawSliceThumbnail` from info-graphic-render but with smaller canvas (120×120):

```js
async function drawVariantThumb(canvas, sceneData) {
  try {
    const { compileScene, createRendererForId } = await import('../compositor-api.js');
    const { computeView } = await import('./linear-layout.js');
    const ctx = canvas.getContext('2d');
    const renderer = createRendererForId('silhouette', canvas);
    const compiled = compileScene(sceneData);
    const view = computeView(sceneData);
    renderer.render([{ sdf: compiled.sdf, color: [60, 60, 60] }], {
      background: [245, 245, 245],
      view,
    });
  } catch (e) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fee';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#a55';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('render error', canvas.width / 2, canvas.height / 2);
  }
}
```

- [ ] **Step 7: Add CSS for picker panel**

Open `sdf-js/examples/present/style.css`. At end of file, append:

```css
/* Variant picker (Sprint 1.5) */
#variant-picker-panel {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  border-top: 1px solid #ddd;
  padding: 16px;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.08);
  z-index: 100;
  max-height: 300px;
  overflow-y: auto;
}

.variant-picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-weight: 600;
}

#variant-picker-close {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #888;
  padding: 0 8px;
}

#variant-picker-thumbs {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.variant-thumb {
  border: 2px solid transparent;
  border-radius: 4px;
  padding: 4px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.variant-thumb:hover {
  border-color: #ccc;
}

.variant-thumb.selected {
  border-color: #3b82f6;
}

.variant-thumb canvas {
  display: block;
  background: #f5f5f5;
}

.variant-thumb-label {
  text-align: center;
  font-size: 12px;
  color: #666;
  margin-top: 4px;
  text-transform: capitalize;
}
```

- [ ] **Step 8: Verify deck-view.js parses**

```bash
node --check sdf-js/src/present/deck-view.js
```

Expected: no output.

- [ ] **Step 9: Run full test suite**

```bash
npm test 2>&1 | tail -5
```

Expected: still `34/34 test files passed`. (Deck-view has no headless-runnable tests; browse smoke is the verification.)

- [ ] **Step 10: Commit Task 6.2**

```bash
git add sdf-js/src/present/deck-view.js sdf-js/examples/present/style.css
git commit -m "Sprint 1.5 Phase 6.2: deck-view variant picker UI (Napkin-style)

Click any section thumbnail in the main info graphic -> picker panel
slides up showing 3 variant thumbnails (minimal/abstract/dense). Click
a variant -> updates section.selectedVariantIndex, saves deck, re-renders
main info graphic with new selection.

Selected variant has blue border. Pending/lifting/error variants show
placeholder with status text.

CSS: variant-picker-panel slides up from bottom, scrollable on overflow."
```

### Task 6.3: library-page.js progress label + remove deprecated wrapper

**Files:**
- Modify: `sdf-js/src/present/library-page.js`
- Modify: `sdf-js/src/present/deck-model.js` (remove deprecated `updateSectionStatus` wrapper)

- [ ] **Step 1: Update library card progress label**

Open `sdf-js/src/present/library-page.js`. Find where each deck card displays its lift progress (likely a `card.querySelector('.lifting-status')` or similar pattern).

The existing logic likely counts sections in `lifting`/`ready`/`error` states. With v4 schema, section.status is derived from variants, so the counting logic still works — just verify it reads `section.status` not `section.variants[].status`.

If the label says "Lifting 5/13" — that's already what we want (per-section granularity). No change needed.

If the label says something like "Lifting 5/39" (counting all variants), update to count per-section:

```js
const total = deck.sections.length;
const ready = deck.sections.filter((s) => s.status === 'ready').length;
const lifting = deck.sections.filter((s) => s.status === 'lifting').length;
const error = deck.sections.filter((s) => s.status === 'error').length;

let label;
if (ready === total) label = `Ready (${total} sections)`;
else if (lifting > 0) label = `Lifting ${ready}/${total} sections`;
else if (error === total) label = `All sections errored`;
else label = `${ready}/${total} sections ready`;
```

- [ ] **Step 2: Grep for remaining `updateSectionStatus` callers**

```bash
grep -rnE "updateSectionStatus" sdf-js/src/ sdf-js/scripts/ 2>/dev/null
```

Expected after Phase 5: only `deck-model.js` (deprecated wrapper definition) and possibly tests. If pipeline.js and library-page.js still reference it, finish migrating them now.

If a caller wants to update "the section" (without picking a variant), it should call `updateVariantStatus(deck, sectionId, 0, ...)` explicitly. Migrate any such callers.

- [ ] **Step 3: Delete deprecated `updateSectionStatus` wrapper**

Open `sdf-js/src/present/deck-model.js`. Find and delete:

```js
/**
 * @deprecated — Sprint 1 v4 entry. Sprint 1.5+ use updateVariantStatus.
 *   ...
 */
export function updateSectionStatus(deck, sectionId, status, payload = {}) {
  return updateVariantStatus(deck, sectionId, 0, status, payload);
}
```

Also if `test-deck-model.mjs` still imports or tests `updateSectionStatus`, remove those imports/tests.

- [ ] **Step 4: Run full test suite**

```bash
npm test 2>&1 | tail -5
```

Expected: still `34/34 test files passed`. If a test fails for "updateSectionStatus is not exported", you missed a test reference — remove it.

- [ ] **Step 5: Commit Task 6.3**

```bash
git add sdf-js/src/present/library-page.js sdf-js/src/present/deck-model.js sdf-js/scripts/test-deck-model.mjs
git commit -m "Sprint 1.5 Phase 6.3: library progress label + remove deprecated wrapper

library-page: progress label now reads 'Lifting N/total sections' (section
granularity; section ready when ≥1 variant ready — derived via deriveStatus).

deck-model: removed deprecated updateSectionStatus wrapper now that
pipeline.js (Phase 5) and library-page.js (Phase 6.3) migrated to
updateVariantStatus."
```

### Task 6.4: Browse smoke verify

- [ ] **Step 1: Ensure dev server running**

```bash
lsof -i :8001 2>&1 | head -3
# If empty:
cd sdf-js && python3 dev-server.py 8001 &
sleep 2
```

- [ ] **Step 2: Browse to library page, inject a 3-variant test deck**

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B goto http://localhost:8001/examples/present/
$B wait --networkidle 2>&1 | tail -3
```

Inject a synthetic deck with 3 variants per section via JS in the page console:

```bash
$B js '
const deckModel = await import("./src/present/deck-model.js");
const deck = deckModel.createDeck("Sprint 1.5 Smoke Deck", { type: "pdf", fileName: "smoke.pdf", pageCount: 2 });
deckModel.addSections(deck, [
  { slideData: {}, code2d: "// code 1", prompt: "page 1" },
  { slideData: {}, code2d: "// code 2", prompt: "page 2" },
]);
// Fill all variants of both sections with a minimal sceneData (so silhouette renders something)
for (const section of deck.sections) {
  for (let i = 0; i < 3; i++) {
    deckModel.updateVariantStatus(deck, section.id, i, "ready", {
      sceneData: { v: 1, name: "test", subjects: [{ id: "a", type: "cube-3d", args: { dims: [1+i, 1+i, 1+i] }, transform: { translate: [0, 0, 0] } }] },
      region: { centerX: section.pageIndex * 6, centerY: 0, centerZ: 0, halfWidth: 1+i, halfHeight: 1+i, halfDepth: 1+i },
    });
  }
}
deckModel.saveDeckToStorage(deck);
location.reload();
'
```

(Adjust import path if `./src/present/deck-model.js` doesn't resolve — try the absolute path used by `index.html` in the present example.)

- [ ] **Step 3: Verify deck appears in library**

```bash
$B screenshot /tmp/sprint-1.5-phase-6-library.png
```

Read the screenshot. Expected:
- Library shows "Sprint 1.5 Smoke Deck" card
- Progress label: "Ready (2 sections)" or similar
- View button enabled

- [ ] **Step 4: Open deck-view, click a section thumbnail**

```bash
$B click "View"  # or whatever the View button text/selector is
$B wait --networkidle 2>&1 | tail -3
$B screenshot /tmp/sprint-1.5-phase-6-deckview.png
```

Read screenshot. Expected:
- Main info graphic shows 2 section thumbnails (silhouette of cubes, no longer black blobs thanks to Phase 1)
- No console errors

- [ ] **Step 5: Click first thumbnail → variant picker appears**

```bash
$B js 'document.querySelector("canvas").click()'  # or simulate click at section coord
$B screenshot /tmp/sprint-1.5-phase-6-picker.png
```

Read screenshot. Expected:
- Picker panel slides up from bottom
- 3 variant thumbnails visible (minimal/abstract/dense labels)
- First thumbnail has blue border (selected = 0)
- All 3 show different cube sizes (1, 2, 3) since we used `dims: [1+i, 1+i, 1+i]`

- [ ] **Step 6: Click 3rd variant → main re-renders with dense**

```bash
$B click ".variant-thumb:nth-child(3)"
sleep 1
$B screenshot /tmp/sprint-1.5-phase-6-after-select.png
```

Read screenshot. Expected:
- Picker panel closes
- Main info graphic re-renders with section 1 now showing the "dense" variant (larger cube)
- Console: no errors

- [ ] **Step 7: Verify console clean throughout**

```bash
$B console --errors 2>&1 | head -10
```

Expected: empty or only warnings (no errors).

- [ ] **Step 8: Commit a verification log (not the screenshots themselves)**

No commit needed — verification is for confirming correctness before opening PR. If you found bugs, fix them in another commit before proceeding.

---

## Phase 7 — Open PR for user review

### Task 7.1: Push branch + open PR

- [ ] **Step 1: Verify all commits look clean**

```bash
cd /Users/hexiaoyang/Documents/sdf-main
git log --oneline main..HEAD
```

Expected: ~10-12 commits on the branch, all with clear "Sprint 1.5 Phase N..." prefixes.

If any commit has a typo or wrong content, this is the last chance to fix (e.g., `git rebase -i main` to squash/edit — but per CLAUDE.md never use `-i` interactive flags; instead, accept the history as-is and let the squash merge clean it up).

- [ ] **Step 2: Push branch**

```bash
git push -u origin sprint-1.5-variant-quality 2>&1 | tail -5
```

Expected: branch pushed, remote tracking set up.

- [ ] **Step 3: Open PR**

```bash
gh pr create --title "Sprint 1.5: variant generation + quality fixes" --body "$(cat <<'EOF'
## Summary

Sprint 1.5 = refinement sprint on top of Sprint 1 v4 (PDF → 2D Info Graphic MVP shipped 2026-06-19).

4 deliverables (all locked in spec):

1. **Silhouette auto-fit view** — replaces hard-coded `view: 2.5` with bbox-derived value. Fixes 6/13 black-blob pages in Aether AI test deck.
2. **Fix `rng.random_dec` error class** — Phase 2 investigated root cause and applied targeted fix. (See investigation notes from Phase 2.1 commit message for details.)
3. **Anthropic prompt caching** — `system: <string>` → `system: [{ cache_control: ephemeral }]`. ~75% input token savings after first call within 5-minute TTL.
4. **Per-section variant generation** — 3 variants per section (minimal/abstract/dense style hints). Schema v3 → v4 (silent drop v3, per user lock 2026-06-20). User clicks section thumbnail → picker panel shows 3 variants → click to select.

## Test plan

- [ ] `npm test` passes (target 34+/34)
- [ ] CI grep mode-agnostic check on `deck-model.js` clean
- [ ] Browse smoke verified end-to-end (Phase 6.4):
  - Library shows deck card with correct progress label
  - Deck-view shows main info graphic with auto-fit silhouettes
  - Click section → picker panel shows 3 variants
  - Click variant → main re-renders with selected variant
  - Console clean
- [ ] User manual L3 (post-merge): re-import Aether AI 13-page PDF, verify page 4 no longer errors + most thumbnails legible + per-page variant picker works

## Merge strategy

Per locked PR workflow: `gh pr merge <#> --squash --delete-branch`.

Spec: [`docs/superpowers/specs/2026-06-20-atlas-present-sprint-1.5-design.md`](docs/superpowers/specs/2026-06-20-atlas-present-sprint-1.5-design.md)
Plan: [`docs/superpowers/plans/2026-06-20-atlas-present-sprint-1.5-plan.md`](docs/superpowers/plans/2026-06-20-atlas-present-sprint-1.5-plan.md)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" 2>&1 | tail -5
```

Expected: PR URL printed.

- [ ] **Step 4: Verify PR exists**

```bash
gh pr view --web
```

Or just print the URL for the user. Tell user explicitly:
- PR URL
- What to do next: review the diff, then `gh pr merge <PR#> --squash --delete-branch`

---

## Self-review (writing-plans skill)

**1. Spec coverage check**

For each spec section, point to plan task(s):

- Spec §3.1 (Silhouette auto-fit) → Plan Phase 1 (Task 1.1 + 1.2) ✓
- Spec §3.2 (Fix rng error) → Plan Phase 2 (Task 2.1 investigate, 2.2 fix, 2.3 cleanup) ✓
- Spec §3.3 (Prompt caching) → Plan Phase 3 (Task 3.1 + 3.2 verify) ✓
- Spec §3.4 (Per-section variant) → Plan Phase 4 (schema) + Phase 5 (pipeline) + Phase 6.1 (render) + Phase 6.2 (UI) + Phase 6.3 (library) ✓
- Spec §4 (File map) → Plan File structure matches ✓
- Spec §5 (Acceptance criteria) → Plan Phase 6.4 (browse smoke) + Phase 7.1 (PR) covers all checkboxes ✓
- Spec §6 (Hard rules) → Plan respects all (PR workflow, mode-agnostic, no new deps, TDD, browse smoke) ✓

No spec gaps. All deliverables have plan tasks.

**2. Placeholder scan**

Searched plan for placeholder patterns. Found and noted:
- Phase 2 Task 2.2 has "Strategy A/B/C" conditional steps — this is intentional (investigation-driven), not a placeholder. Each branch has full implementation guidance.
- "TBD by investigation" appears in Phase 2 — explicit acknowledgment that the fix path depends on what Phase 2.1 finds. This is correct (investigation-driven phase).
- All other code blocks contain actual runnable code.

No real placeholders found.

**3. Type consistency check**

Function/property names used across phases:
- `computeView(sceneData) → number` — defined Phase 1.1, used Phase 1.2 ✓
- `STYLE_HINTS: ['minimal', 'abstract', 'dense']` — defined Phase 4.4, used Phase 5.3 ✓
- `deriveStatus(variants)` — defined Phase 4.4, used Phase 4.6, 5.3 (indirectly via updateVariantStatus) ✓
- `updateVariantStatus(deck, sectionId, variantIndex, status, payload)` — defined Phase 4.6, used Phase 5.3, 6.4 ✓
- `selectVariant(deck, sectionId, variantIndex)` — defined Phase 4.6, used Phase 6.2 ✓
- `getSelectedVariant(section)` — defined Phase 4.7, used Phase 6.1, 6.2 ✓
- `styleHintDescription(styleHint)` — defined Phase 5.4 (local helper, no cross-task use needed) ✓
- v4 schema shape: `section.variants[].styleHint/status/sceneData/region/liftError` + `section.selectedVariantIndex` — consistent across Phase 4, 5, 6.1, 6.2 ✓

Type consistency clean.

---

**Plan complete. Saved to `docs/superpowers/plans/2026-06-20-atlas-present-sprint-1.5-plan.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — Same pattern as Sprint 1 v4. Dispatch fresh subagent per phase, controller verifies between phases. Branch `sprint-1.5-variant-quality` already set up. Final commit opens PR (user merges manually with `--squash --delete-branch`).

**2. Inline Execution** — Execute tasks in this session via executing-plans, checkpoint between phases.

Which approach?
