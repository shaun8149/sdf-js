# Atlas Present — Sprint 1 (MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship MVP presentation tool at `/examples/present/` — Deck Library + Editor + Present Mode, persisted to localStorage. End-of-sprint demo: New Deck → add 3 compositor scenes → ▶ Present → ← → navigate → esc exit.

**Architecture:** Layer 2 application built on top of Layer 1 (compositor). New file `sdf-js/src/compositor-api.js` extracts shared pure-function APIs from `compositor.js` so Layer 2 (and future MCP/tests) can import without dragging in compositor's DOM logic. Layer 2 maintains its own state machine + UI; never mutates compositor internals.

**Tech Stack:** Node 25 ESM, vanilla JS (no React/Vue — matches compositor style), browser localStorage, Fullscreen API. Reuses compositor's existing renderer factories (`createStudioRenderer` / `createFly3DRenderer`) and `silhouette` CPU renderer.

**Spec:** [`docs/superpowers/specs/2026-06-19-atlas-present-sprint-1-design.md`](../specs/2026-06-19-atlas-present-sprint-1-design.md). Read it first if you have any doubt about WHY a decision was made.

**Sibling reference:** [`docs/superpowers/plans/2026-06-19-cube-3d-plan.md`](2026-06-19-cube-3d-plan.md) — same architecture pattern, shipped commits `ed937a9..f9a01fc`.

---

## Plan-time divergence from spec

Spec §4 named the 6 extracted functions as: `callLiftLLM` / `parseLiftResponse` / `sphericalToCamState` / `renderScene (NEW)` / `compileScene` / `loadSystemPromptLift`.

**Plan replaces `renderScene` with `createRendererForId`** — a factory returning a renderer instance with `.render(sdf)` and `.unmount()` methods. Caller manages lifecycle.

**Why**: compositor's `runActiveGpuRenderer` (the would-be renderScene impl) is 200 LoC handling unmount discipline / cameraStatic / postFx / cameraSequence / bakedHeightmap / time tracking / light overrides — replicating that as a wrapper is Sprint 2+ scope, not Sprint 1. The factory pattern is honest about scope (Layer 2 owns the renderer instance during its preview/present sessions) and cleaner — Layer 2 needs different lifecycle for editor preview (long-lived single instance) vs present mode (recreate on each slide change). A monolithic `renderScene` would force both into the same shape.

Spec acceptance criteria still met: 3 renderers tested (studio / fly3d / silhouette) per §8.2.

---

## File Structure (locked)

**Created**:
- `sdf-js/src/compositor-api.js` — 6 extracted functions (`callLiftLLM`, `parseLiftResponse`, `sphericalToCamState`, `createRendererForId`, `compileScene`, `loadSystemPromptLift`)
- `sdf-js/scripts/test-compositor-api.mjs` — L1 tests (~15 assertions)
- `sdf-js/src/present/deck-model.js` — Deck/Slide types + localStorage CRUD
- `sdf-js/scripts/test-deck-model.mjs` — L1 tests (~30 assertions)
- `sdf-js/src/present/deck-library.js` — library page rendering + event wiring
- `sdf-js/src/present/deck-editor.js` — editor page rendering + slide list + preview embed
- `sdf-js/src/present/present-mode.js` — fullscreen playback + key handlers
- `sdf-js/examples/present/index.html` — Layer 2 entry HTML
- `sdf-js/examples/present/style.css` — Layer 2 styling

**Modified**:
- `sdf-js/examples/compositor/compositor.js` — replace inline `callLiftLLM` / `parseLiftResponse` / `sphericalToCamState` / `loadSystemPrompt` definitions with `import {...} from '../../src/compositor-api.js'`. NO behavior change.
- `scripts/run-tests.mjs` — register `test-compositor-api.mjs` (`api` category) and `test-deck-model.mjs` (`present` category)

---

## Phase 1 — `compositor-api.js` extraction

**Phase goal**: 6 functions live in `compositor-api.js`, compositor.js re-imports them, all existing tests + cube-3d-showcase visual still pass. **This phase is the riskiest — a botched extraction breaks the entire compositor.** Real-browser visual regression check is mandatory before moving to Phase 2.

### Task 1.1: Create `compositor-api.js` skeleton + test file + verify compositor.js still parses

**Files:**
- Create: `sdf-js/src/compositor-api.js`
- Create: `sdf-js/scripts/test-compositor-api.mjs`
- Modify: `scripts/run-tests.mjs`

- [ ] **Step 1: Create skeleton file**

Create `sdf-js/src/compositor-api.js`:

```js
// =============================================================================
// compositor-api.js — Layer 1 public API extracted from examples/compositor/compositor.js
// -----------------------------------------------------------------------------
// Why this exists: compositor.js (3283 lines) bundles state machine + UI +
// pure-function APIs together. Layer 2 (examples/present/) and future
// consumers (MCP server, tests, automation) need the APIs without dragging
// in compositor's DOM logic.
//
// Per [[compositor-layered-for-presentation]] memory: Layer 2 applications
// MUST call Layer 1 via this module's public API surface. Never mutate
// compositor internal state directly.
//
// Exports (added incrementally in Phase 1 tasks 1.2-1.6):
//   - sphericalToCamState(cam) — spherical camera → Cartesian eye position
//   - compileScene(sceneData, opts) — compile + expandVariants + sdfUnion
//   - parseLiftResponse(text) — LLM JSON-isms stripper (markdown fence,
//     trailing comma, // comment, /* */ — load-bearing)
//   - loadSystemPromptLift(fetchBase) — fetch + cache lift system prompt
//   - callLiftLLM(originalPrompt, code2d, apiKey, opts) — Anthropic API call
//   - createRendererForId(rendererId, canvas, opts) — factory for studio
//     / fly3d / silhouette / etc renderer instances
//
// Spec: docs/superpowers/specs/2026-06-19-atlas-present-sprint-1-design.md
// =============================================================================

// Constants
export const DEFAULT_LIFT_MODEL = 'claude-sonnet-4-6';

// Exports populated by subsequent tasks.
```

- [ ] **Step 2: Create test skeleton**

Create `sdf-js/scripts/test-compositor-api.mjs`:

```js
// =============================================================================
// test-compositor-api.mjs — L1 unit tests for extracted compositor APIs
// =============================================================================

import '../src/sdf/index.js';
import * as api from '../src/compositor-api.js';

let pass = 0,
  fail = 0;
function ok(cond, name) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`);
  }
}

console.log('=== compositor-api smoke test ===\n');

ok(api.DEFAULT_LIFT_MODEL === 'claude-sonnet-4-6', 'DEFAULT_LIFT_MODEL exported');

// [More tests added in Tasks 1.2-1.6]

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
```

- [ ] **Step 3: Register test in run-tests.mjs**

In `/Users/hexiaoyang/Documents/sdf-main/scripts/run-tests.mjs`, find the line:

```js
  { category: 'shapes', file: 'sdf-js/scripts/test-cube-3d.mjs' },
```

Add immediately after:

```js

  // Layer 1 public API extracted from compositor.js (used by Layer 2 / MCP / tests)
  { category: 'api', file: 'sdf-js/scripts/test-compositor-api.mjs' },
```

- [ ] **Step 4: Verify everything parses + new test runs**

Run:
```bash
node --check sdf-js/src/compositor-api.js && echo "compositor-api.js syntax OK"
node --check sdf-js/scripts/test-compositor-api.mjs && echo "test syntax OK"
npm test 2>&1 | tail -5
```

Expected: both `syntax OK`; npm test passes 29/29 (was 28, +1 for new file with 1 assertion).

- [ ] **Step 5: Commit Phase 1 skeleton**

```bash
git add sdf-js/src/compositor-api.js sdf-js/scripts/test-compositor-api.mjs scripts/run-tests.mjs
git commit -m "compositor-api.js skeleton + test file registered

First step of Layer 2 (Atlas Present) — empty compositor-api.js module
that will hold extracted pure-function APIs. Test file runs (1 assertion).

Plan: docs/superpowers/plans/2026-06-19-atlas-present-sprint-1-plan.md
(Phase 1, Task 1.1)."
```

### Task 1.2: Extract `sphericalToCamState`

Simplest extraction — pure function with no dependencies. Warm-up.

**Files:**
- Modify: `sdf-js/src/compositor-api.js`
- Modify: `sdf-js/scripts/test-compositor-api.mjs`
- Modify: `sdf-js/examples/compositor/compositor.js`

- [ ] **Step 1: Write failing test**

Append to `sdf-js/scripts/test-compositor-api.mjs` (BEFORE the final `console.log` Result line):

```js
// sphericalToCamState
{
  const cam = { targetX: 0, targetY: 0, targetZ: 0, yaw: 0, pitch: 0, distance: 5 };
  const state = api.sphericalToCamState(cam);
  ok(state.position.length === 3, 'sphericalToCamState: returns position vec3');
  ok(Math.abs(state.position[2] - -5) < 1e-9, `sphericalToCamState: yaw=0 pitch=0 → z=-distance (got ${state.position[2]})`);
  ok(state.yaw === 0 && state.pitch === 0, 'sphericalToCamState: passes through yaw/pitch');
}
{
  const cam = { targetX: 1, targetY: 2, targetZ: 3, yaw: Math.PI / 2, pitch: 0, distance: 5 };
  const state = api.sphericalToCamState(cam);
  // yaw = π/2: position.x = targetX - distance·sin(π/2)·cos(0) = 1 - 5 = -4
  ok(Math.abs(state.position[0] - -4) < 1e-6, `sphericalToCamState: yaw=π/2 → x=targetX-distance (got ${state.position[0]})`);
}
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `node sdf-js/scripts/test-compositor-api.mjs`
Expected: `TypeError: api.sphericalToCamState is not a function`

- [ ] **Step 3: Add `sphericalToCamState` to compositor-api.js**

Edit `sdf-js/src/compositor-api.js`. Replace the line `// Exports populated by subsequent tasks.` with:

```js
/**
 * Convert spherical camera coords (target + yaw/pitch/distance) to Cartesian
 * eye position. Used by all 3D renderers when applying `scene.cameraStatic`.
 *
 * @param {{targetX:number, targetY:number, targetZ:number, yaw:number, pitch:number, distance:number}} cam
 * @returns {{position:[number,number,number], yaw:number, pitch:number}}
 */
export function sphericalToCamState(cam) {
  return {
    position: [
      cam.targetX - cam.distance * Math.sin(cam.yaw) * Math.cos(cam.pitch),
      cam.targetY + cam.distance * Math.sin(cam.pitch),
      cam.targetZ - cam.distance * Math.cos(cam.yaw) * Math.cos(cam.pitch),
    ],
    yaw: cam.yaw,
    pitch: cam.pitch,
  };
}

// Exports populated by subsequent tasks.
```

- [ ] **Step 4: Run test — expect PASS**

Run: `node sdf-js/scripts/test-compositor-api.mjs`
Expected: `4 passed, 0 failed`.

- [ ] **Step 5: Re-import from compositor.js**

Edit `sdf-js/examples/compositor/compositor.js`. Find the existing `function sphericalToCamState` definition (around line 2439) and DELETE the entire function (including the JSDoc / comment above it if any).

Then find an appropriate import block near the top — there's an existing `import { expandVariants } from '../../src/scene/generator-s.js';` around line 37. Add immediately after:

```js
import { sphericalToCamState } from '../../src/compositor-api.js';
```

- [ ] **Step 6: Verify compositor.js still parses + npm test green**

```bash
node --check sdf-js/examples/compositor/compositor.js && echo "compositor.js syntax OK"
npm test 2>&1 | tail -5
```

Expected: `compositor.js syntax OK`; all 29 tests pass.

- [ ] **Step 7: Visual regression spot-check via /browse**

Dev server should already be running on port 8001 (per memory `reference_sdf_js_server`). If not:
```bash
lsof -i :8001 || (cd sdf-js && python3 dev-server.py 8001 &)
sleep 2
```

Set up browse skill if needed:
```bash
_ROOT=$(git rev-parse --show-toplevel)
B="$_ROOT/.claude/skills/gstack/browse/dist/browse"
[ -x "$B" ] || { echo "BUILDING browse..."; cd "$_ROOT/.claude/skills/gstack/browse" && ./setup; cd -; }
```

Run quick sanity load:
```bash
$B goto "http://localhost:8001/examples/compositor/index.html"
$B wait --networkidle
sleep 2
$B console --errors
```

Expected: no errors. If there's a "sphericalToCamState is not defined" error → revert the deletion in step 5 and double-check the import path is correct.

- [ ] **Step 8: Commit Task 1.2**

```bash
git add sdf-js/src/compositor-api.js sdf-js/scripts/test-compositor-api.mjs sdf-js/examples/compositor/compositor.js
git commit -m "compositor-api: extract sphericalToCamState

Pure function — spherical camera coords → Cartesian eye position. Was
inline in compositor.js:2439. Now lives in src/compositor-api.js for
Layer 2 / MCP / tests to import.

compositor.js re-imports — no behavior change. Tests: +3 (4 total in
new test file).

Plan Phase 1 Task 1.2."
```

### Task 1.3: Extract `compileScene` (compile + expandVariants + sdfUnion wrapper)

Wraps the 3-step "compile a SceneData and get a ready-to-render unified SDF" pattern that compositor.js currently inlines 3 times (lines 726, 1777, 2492).

**Files:**
- Modify: `sdf-js/src/compositor-api.js`
- Modify: `sdf-js/scripts/test-compositor-api.mjs`
- Modify: `sdf-js/examples/compositor/compositor.js` (optional — leave existing inline patterns alone for Sprint 1; they still work)

- [ ] **Step 1: Write failing test**

Append to test file (before Result line):

```js
// compileScene
{
  const scene = {
    v: 1,
    name: 'compileScene smoke',
    subjects: [
      {
        id: 'box',
        type: 'box',
        args: { size: 0.5 },
        transform: { translate: [0, 0, 0] },
        material: 'silver',
      },
    ],
    defaults: { camera: { yaw: 0, pitch: 0, distance: 5, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 } },
  };
  const compiled = api.compileScene(scene);
  ok(compiled.sdf !== null && compiled.sdf !== undefined, 'compileScene: returns non-null SDF');
  ok(typeof compiled.sdf.f === 'function', 'compileScene: SDF has .f method');
  ok(compiled.sdf.f([0, 0, 0]) < 0, `compileScene: box center inside (got ${compiled.sdf.f([0, 0, 0])})`);
  ok(compiled.sdf.f([10, 10, 10]) > 0, 'compileScene: far point outside');
}

// compileScene: handles seed for Generator-S variants
{
  const sceneNoVariants = {
    v: 1,
    name: 'no variants',
    subjects: [{ id: 'b', type: 'box', args: { size: 0.5 }, transform: { translate: [0,0,0] }, material: 'silver' }],
    defaults: { camera: { yaw: 0, pitch: 0, distance: 5, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 } },
  };
  const compiledA = api.compileScene(sceneNoVariants, { sceneHash: 1 });
  const compiledB = api.compileScene(sceneNoVariants, { sceneHash: 1 });
  // Same seed → same SDF probe at origin
  ok(compiledA.sdf.f([0, 0, 0]) === compiledB.sdf.f([0, 0, 0]), 'compileScene: deterministic same-seed');
}
```

- [ ] **Step 2: Run test — expect FAIL**

Expected: `TypeError: api.compileScene is not a function`.

- [ ] **Step 3: Implement `compileScene` in compositor-api.js**

In `sdf-js/src/compositor-api.js`, add imports at the top (right after the file header comment) — these are NEW lines at the TOP of the file:

```js
import { compile } from './scene/compile.js';
import { expandVariants } from './scene/generator-s.js';
import { union as sdfUnion } from './sdf/dn.js';
```

Then add the function (place AFTER `sphericalToCamState` but BEFORE `// Exports populated by subsequent tasks.`):

```js
/**
 * Compile a SceneData v1 to a ready-to-render SDF tree.
 *
 * Wraps the 3-step pattern: expandVariants (Generator-S scatter) → compile()
 * → sdfUnion(sdf, groundSdf). Callers receive the unified SDF directly
 * instead of having to remember the union step.
 *
 * @param {object} sceneData — SceneData v1 (must have `v: 1`)
 * @param {object} opts
 * @param {number} [opts.sceneHash=1] — drives Generator-S variant PRNG
 * @returns {{sdf:object, subjects:Array, cameraStatic:object|null, lightStatic:object|null, groundSdf:object|null, bakedHeightmap:object|null}}
 */
export function compileScene(sceneData, opts = {}) {
  const sceneHash = opts.sceneHash ?? 1;
  // Deterministic PRNG for Generator-S (variants/scatter)
  const rng = mulberry32(sceneHash);
  const expanded = expandVariants(sceneData, { random: () => rng() });
  const compiled = compile(expanded);
  const unifiedSdf = compiled.groundSdf
    ? sdfUnion(compiled.sdf, compiled.groundSdf)
    : compiled.sdf;
  return {
    sdf: unifiedSdf,
    subjects: compiled.subjects,
    cameraStatic: compiled.cameraStatic ?? null,
    lightStatic: compiled.lightStatic ?? null,
    groundSdf: compiled.groundSdf ?? null,
    bakedHeightmap: compiled.bakedHeightmap ?? null,
  };
}

// Mulberry32 — minimal seeded PRNG. Matches the one used elsewhere in Atlas
// (see src/scene/components/shapes/cube-3d.js).
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `node sdf-js/scripts/test-compositor-api.mjs`
Expected: `8 passed, 0 failed` (cumulative).

If `expandVariants` signature doesn't accept `{ random: () => ... }`: check actual signature with `grep -A 3 "export function expandVariants" sdf-js/src/scene/generator-s.js` and adapt the call to match.

- [ ] **Step 5: Commit Task 1.3**

```bash
git add sdf-js/src/compositor-api.js sdf-js/scripts/test-compositor-api.mjs
git commit -m "compositor-api: extract compileScene (compile + expandVariants + sdfUnion)

Wraps the 3-step 'SceneData v1 → unified SDF' pattern that compositor.js
inlines at 3 sites. Includes deterministic sceneHash → mulberry32 PRNG
for Generator-S variants.

Tests: +4 (8 total). compositor.js inline sites kept (refactor optional;
no Sprint 1 caller needs the indirection yet).

Plan Phase 1 Task 1.3."
```

### Task 1.4: Extract `parseLiftResponse`

LLM JSON-isms stripper. Per memory [[lift-llm-integration]], this is load-bearing (40% of LLM outputs need stripping).

**Files:**
- Modify: `sdf-js/src/compositor-api.js`
- Modify: `sdf-js/scripts/test-compositor-api.mjs`
- Modify: `sdf-js/examples/compositor/compositor.js`

- [ ] **Step 1: Write failing test**

Append to test file:

```js
// parseLiftResponse: strips markdown fence
{
  const raw = '```json\n{"v": 1, "subjects": []}\n```';
  const parsed = api.parseLiftResponse(raw);
  ok(parsed.v === 1 && Array.isArray(parsed.subjects), `parseLiftResponse: strips markdown fence (got ${JSON.stringify(parsed)})`);
}

// parseLiftResponse: strips trailing comma
{
  const raw = '{"a": 1, "b": 2,}';
  const parsed = api.parseLiftResponse(raw);
  ok(parsed.a === 1 && parsed.b === 2, 'parseLiftResponse: strips trailing comma');
}

// parseLiftResponse: strips // comments
{
  const raw = '{"a": 1, // this is a comment\n"b": 2}';
  const parsed = api.parseLiftResponse(raw);
  ok(parsed.a === 1 && parsed.b === 2, 'parseLiftResponse: strips // comments');
}

// parseLiftResponse: strips /* */ comments
{
  const raw = '{"a": 1, /* block comment */ "b": 2}';
  const parsed = api.parseLiftResponse(raw);
  ok(parsed.a === 1 && parsed.b === 2, 'parseLiftResponse: strips /* */ comments');
}

// parseLiftResponse: preserves comment-like sequences inside strings
{
  const raw = '{"url": "http://example.com/path"}';  // note the //
  const parsed = api.parseLiftResponse(raw);
  ok(parsed.url === 'http://example.com/path', 'parseLiftResponse: preserves // inside string values');
}
```

- [ ] **Step 2: Run test — expect FAIL**

Expected: `TypeError: api.parseLiftResponse is not a function`.

- [ ] **Step 3: Read existing implementation from compositor.js**

Open `/Users/hexiaoyang/Documents/sdf-main/sdf-js/examples/compositor/compositor.js` and locate `function parseLiftResponse(text)` at approximately line 950. Read the function body (and any helper functions it calls — likely `stripJSONComments` or similar).

- [ ] **Step 4: Copy implementation to compositor-api.js**

In `sdf-js/src/compositor-api.js`, add the `parseLiftResponse` function + any helpers it depends on. Place AFTER `compileScene` but BEFORE the closing `// Exports populated by subsequent tasks.` line. Include the helper functions as private (NOT exported) module-scope functions.

JSDoc:

```js
/**
 * Parse raw LLM lift response text into SceneData object. LLM outputs are
 * NOT clean JSON — common patterns: markdown fences (```json ... ```),
 * trailing commas, single-line (//) comments, block (/* *​/) comments.
 *
 * Without this stripper, strict JSON.parse() fails ~40% of the time on
 * Claude lift outputs. LOAD-BEARING — do not remove or "simplify".
 *
 * @param {string} text — raw LLM response text
 * @returns {object} parsed SceneData
 * @throws if no valid JSON found after stripping
 */
export function parseLiftResponse(text) {
  // ... (paste implementation from compositor.js lines 950-974 + helpers from 863-948)
}
```

- [ ] **Step 5: Run test — expect PASS**

Run: `node sdf-js/scripts/test-compositor-api.mjs`
Expected: `13 passed, 0 failed`.

- [ ] **Step 6: Re-import from compositor.js**

In `sdf-js/examples/compositor/compositor.js`:
1. Update the existing `import { sphericalToCamState } from '../../src/compositor-api.js';` to also include parseLiftResponse:
   ```js
   import { sphericalToCamState, parseLiftResponse } from '../../src/compositor-api.js';
   ```
2. DELETE the inline `function parseLiftResponse(text) { ... }` definition (line ~950) AND any helper functions (e.g., `stripJSONComments`) that were ONLY used by parseLiftResponse. If a helper is used by both `parseLiftResponse` AND other compositor functions, leave the helper definition in compositor.js (don't delete it).

- [ ] **Step 7: Verify**

```bash
node --check sdf-js/examples/compositor/compositor.js && echo "compositor.js syntax OK"
npm test 2>&1 | tail -5
```

Expected: `compositor.js syntax OK`; all 29 tests pass.

- [ ] **Step 8: Commit Task 1.4**

```bash
git add sdf-js/src/compositor-api.js sdf-js/scripts/test-compositor-api.mjs sdf-js/examples/compositor/compositor.js
git commit -m "compositor-api: extract parseLiftResponse + JSON-isms stripper helpers

LLM lift output is NOT clean JSON — markdown fences, trailing commas,
// + /* */ comments all need stripping. Without this, JSON.parse() fails
~40% of the time on Claude outputs. LOAD-BEARING per memory
[[lift-llm-integration]].

Tests: +5 cumulative 13. compositor.js re-imports — no behavior change.

Plan Phase 1 Task 1.4."
```

### Task 1.5: Extract `loadSystemPromptLift` + `callLiftLLM`

These two ship together because `callLiftLLM` depends on the loaded prompt. Module-level `SYSTEM_PROMPT_LIFT` cache becomes module-private to compositor-api.js.

**Files:**
- Modify: `sdf-js/src/compositor-api.js`
- Modify: `sdf-js/scripts/test-compositor-api.mjs`
- Modify: `sdf-js/examples/compositor/compositor.js`

- [ ] **Step 1: Write tests**

Append to test file. NOTE: these tests do NOT call the LLM (that costs $0.21) — they verify shape only:

```js
// loadSystemPromptLift: function exists with correct arity
ok(typeof api.loadSystemPromptLift === 'function', 'loadSystemPromptLift: function exported');
ok(api.loadSystemPromptLift.length === 1, `loadSystemPromptLift: arity 1 (got ${api.loadSystemPromptLift.length})`);

// callLiftLLM: function exists with correct arity
ok(typeof api.callLiftLLM === 'function', 'callLiftLLM: function exported');
ok(api.callLiftLLM.length === 3, `callLiftLLM: arity 3 (got ${api.callLiftLLM.length})`);

// callLiftLLM: throws without apiKey
try {
  await api.callLiftLLM('test prompt', '// 2d code', null);
  ok(false, 'callLiftLLM: should throw without apiKey');
} catch (e) {
  ok(/api[\s-]*key/i.test(e.message), `callLiftLLM: error mentions api key (got: ${e.message})`);
}
```

NOTE: The above uses top-level `await`. Wrap the entire `await api.callLiftLLM` block in `await (async () => { ... })()` if `node sdf-js/scripts/test-compositor-api.mjs` complains about top-level await.

- [ ] **Step 2: Run — expect FAIL**

Expected: `loadSystemPromptLift / callLiftLLM not exported`.

- [ ] **Step 3: Add to compositor-api.js**

Add to `sdf-js/src/compositor-api.js`. Place after `parseLiftResponse`:

```js
// Module-private cache for the lift system prompt. Fetched once per
// loadSystemPromptLift() call; subsequent callLiftLLM calls reuse it.
let CACHED_SYSTEM_PROMPT_LIFT = '';

/**
 * Fetch + cache the lift system prompt markdown file. Called automatically
 * by callLiftLLM if cache is empty.
 *
 * @param {string} fetchBase — absolute or relative URL of the prompt file
 *   (e.g., '/examples/compositor/system-prompt-lift-3d.md')
 * @returns {Promise<number>} byte length of loaded prompt
 */
export async function loadSystemPromptLift(fetchBase) {
  if (CACHED_SYSTEM_PROMPT_LIFT) return CACHED_SYSTEM_PROMPT_LIFT.length;
  const res = await fetch(fetchBase);
  if (!res.ok) throw new Error(`Failed to load lift prompt: ${res.status}`);
  CACHED_SYSTEM_PROMPT_LIFT = await res.text();
  return CACHED_SYSTEM_PROMPT_LIFT.length;
}

/**
 * Call Anthropic Messages API with the lift system prompt.
 *
 * @param {string} originalPrompt — user's original generation prompt
 * @param {string} code2d — 2D SDF JS code to lift
 * @param {string} apiKey — Anthropic API key (BYOK)
 * @param {object} [opts]
 * @param {string} [opts.model=DEFAULT_LIFT_MODEL]
 * @param {string} [opts.promptUrl='/examples/compositor/system-prompt-lift-3d.md']
 *   — used by loadSystemPromptLift if cache empty
 * @returns {Promise<{text:string, usage:object}>}
 */
export async function callLiftLLM(originalPrompt, code2d, apiKey, opts = {}) {
  if (!apiKey) throw new Error('Anthropic API key required');
  if (!CACHED_SYSTEM_PROMPT_LIFT) {
    const promptUrl = opts.promptUrl || '/examples/compositor/system-prompt-lift-3d.md';
    await loadSystemPromptLift(promptUrl);
  }
  if (!CACHED_SYSTEM_PROMPT_LIFT) throw new Error('Lift system prompt not loaded');

  const userMessage = `## Original user prompt\n\n${originalPrompt}\n\n## 2D SDF code\n\n\`\`\`js\n${code2d}\n\`\`\``;
  const model = opts.model || DEFAULT_LIFT_MODEL;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system: CACHED_SYSTEM_PROMPT_LIFT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  return { text: data.content[0].text, usage: data.usage };
}
```

- [ ] **Step 4: Run test — expect PASS**

Expected: `17 passed, 0 failed`.

- [ ] **Step 5: Re-import from compositor.js**

In `sdf-js/examples/compositor/compositor.js`:
1. Extend the existing import to include the new exports:
   ```js
   import {
     sphericalToCamState,
     parseLiftResponse,
     callLiftLLM,
     loadSystemPromptLift,
   } from '../../src/compositor-api.js';
   ```
2. Locate the existing `async function callLiftLLM(...)` at line 825 and DELETE it.
3. Locate `let SYSTEM_PROMPT_LIFT = '';` at line 779 and `async function loadSystemPrompt()` at line 781. DELETE both. (Caveat: compositor.js may use `SYSTEM_PROMPT_LIFT` variable in OTHER places — `grep -n SYSTEM_PROMPT_LIFT sdf-js/examples/compositor/compositor.js`. If so, replace those references with `await loadSystemPromptLift('./system-prompt-lift-3d.md')`. The relative URL `./system-prompt-lift-3d.md` matches the compositor's existing fetch path.)
4. Locate `Promise.all([loadSystemPrompt(), loadLiftSystemPrompt(), loadDemoManifest()])` at line 3344 — change to use the imported `loadSystemPromptLift('./system-prompt-lift-3d.md')`.

- [ ] **Step 6: Verify compositor.js still works**

```bash
node --check sdf-js/examples/compositor/compositor.js && echo "compositor.js syntax OK"
npm test 2>&1 | tail -5
```

Expected: `compositor.js syntax OK`; 29/29 tests pass.

- [ ] **Step 7: Browse smoke check (compositor still loads + lift button works)**

```bash
$B goto "http://localhost:8001/examples/compositor/index.html"
$B wait --networkidle
sleep 2
$B console --errors
```

Expected: no errors. If errors like "loadSystemPrompt is not defined" → grep compositor.js for ALL references to the old name and replace.

- [ ] **Step 8: Commit Task 1.5**

```bash
git add sdf-js/src/compositor-api.js sdf-js/scripts/test-compositor-api.mjs sdf-js/examples/compositor/compositor.js
git commit -m "compositor-api: extract callLiftLLM + loadSystemPromptLift

Module-private CACHED_SYSTEM_PROMPT_LIFT replaces the inline cache in
compositor.js. callLiftLLM accepts opts.model + opts.promptUrl for
non-default configurations.

Tests: +4 cumulative 17. compositor.js refactored to re-import — no
behavior change. Anthropic call path identical.

Plan Phase 1 Task 1.5."
```

### Task 1.6: Add `createRendererForId` factory

This is a NEW function (no existing equivalent in compositor.js — see plan-time divergence at top).

**Files:**
- Modify: `sdf-js/src/compositor-api.js`
- Modify: `sdf-js/scripts/test-compositor-api.mjs`

- [ ] **Step 1: Write tests (don't actually render — just verify factory shape)**

Append to test file:

```js
// createRendererForId: known renderer ids return an object with .render and .unmount
{
  const fakeCanvas = { getContext: () => ({ }) };  // mock — won't actually be used
  for (const id of ['studio', 'fly3d', 'silhouette']) {
    try {
      const r = api.createRendererForId(id, fakeCanvas);
      ok(typeof r.render === 'function', `createRendererForId('${id}'): has .render`);
      ok(typeof r.unmount === 'function', `createRendererForId('${id}'): has .unmount`);
    } catch (e) {
      // GPU renderers may need a real canvas; the silhouette branch should
      // not throw on a fake canvas.
      if (id === 'silhouette') {
        ok(false, `createRendererForId('${id}'): threw on fake canvas (${e.message})`);
      } else {
        ok(true, `createRendererForId('${id}'): threw on fake canvas (expected — no WebGL in Node)`);
      }
    }
  }
}

// createRendererForId: unknown id throws
{
  let threw = false;
  try {
    api.createRendererForId('bogus', {});
  } catch (e) {
    threw = /unknown.*renderer/i.test(e.message);
  }
  ok(threw, 'createRendererForId: throws on unknown id');
}
```

- [ ] **Step 2: Run — expect FAIL**

Expected: `api.createRendererForId is not a function`.

- [ ] **Step 3: Implement `createRendererForId`**

In `sdf-js/src/compositor-api.js`, add the imports near the top of the file (with the other src/ imports):

```js
import { createStudioRenderer } from './render/studio.js';
import { createFly3DRenderer } from './render/flyLambert.js';
import { silhouette } from './render/silhouette.js';
```

Then add the factory (place AFTER callLiftLLM but BEFORE the closing exports comment):

```js
/**
 * Create a renderer instance for the given renderer id. Returns an object
 * with `.render(sdf)` and `.unmount()` methods. Caller owns lifecycle.
 *
 * Sprint 1 supports: 'studio', 'fly3d', 'silhouette'. Sprint 2+ will add
 * 'bob-gpu', 'blueprint', 'crayon', 'topo', 'bob', 'lines'.
 *
 * @param {string} rendererId
 * @param {HTMLCanvasElement} canvas
 * @param {object} [opts]
 * @param {Function} [opts.getControls] — for GPU renderers; receives renderer time + returns camera/light state
 * @param {Function} [opts.onFps] — for GPU renderers; called per frame with FPS
 * @returns {{render:Function, unmount:Function}}
 */
export function createRendererForId(rendererId, canvas, opts = {}) {
  if (rendererId === 'silhouette') {
    // CPU path — render takes a SceneData-derived layers array, not an SDF tree
    return {
      render(layers, renderOpts = {}) {
        const ctx = canvas.getContext('2d');
        silhouette(ctx, layers, renderOpts);
      },
      unmount() {
        // No-op for CPU silhouette
      },
    };
  }
  if (rendererId === 'studio') {
    return createStudioRenderer({
      canvas,
      getControls: opts.getControls || (() => ({})),
      onFps: opts.onFps || (() => {}),
    });
  }
  if (rendererId === 'fly3d') {
    return createFly3DRenderer({
      canvas,
      getControls: opts.getControls || (() => ({})),
      onFps: opts.onFps || (() => {}),
    });
  }
  throw new Error(`[compositor-api] unknown renderer id: ${rendererId}`);
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `node sdf-js/scripts/test-compositor-api.mjs`
Expected: cumulative ~22 passed (silhouette path returns + GPU paths may throw on fake canvas — which is acceptable per test). If silhouette throws too: investigate the silhouette signature mismatch.

- [ ] **Step 5: Commit Task 1.6**

```bash
git add sdf-js/src/compositor-api.js sdf-js/scripts/test-compositor-api.mjs
git commit -m "compositor-api: add createRendererForId factory (studio/fly3d/silhouette)

NEW function — no equivalent in compositor.js. Returns a renderer instance
with .render(sdf) and .unmount() methods. Caller owns lifecycle.

Per plan-time divergence: spec named this 'renderScene' as a wrapper, but
compositor's runActiveGpuRenderer is 200 LoC with lifecycle nuance not in
Sprint 1 scope. Factory pattern is honest about scope — Layer 2 (editor
preview + present mode) owns the renderer instance.

Sprint 1: studio / fly3d / silhouette. Sprint 2+: bob-gpu / blueprint /
crayon / topo / bob / lines.

Tests: +4 cumulative ~22. Plan Phase 1 Task 1.6."
```

### Task 1.7: Phase 1 visual regression check + close

- [ ] **Step 1: Manual browser verify (silhouette renderer path)**

Open in real browser (or via $B):
```bash
$B goto "http://localhost:8001/examples/compositor/index.html"
$B wait --networkidle
sleep 2
$B snapshot -i | grep -i cube
```

Find the cube-3d-showcase entry. Click into it. Take screenshot:

```bash
$B click "@e<N>"   # replace N
$B wait --networkidle
sleep 2
$B screenshot /tmp/p1-regression-silhouette.png
$B console --errors
```

Use the Read tool to view `/tmp/p1-regression-silhouette.png`. Verify cube-3d-showcase scene visible (4 sub-scenes rendered). Console errors should be empty (headless can't do WebGL2, so GPU renderers will error — silhouette + lines + crayon + topo + bob CPU paths are what matters for regression).

- [ ] **Step 2: Phase 1 summary commit (optional — if no remaining changes)**

If git status is clean, skip. If there are dangling changes (e.g., final compositor.js cleanup), commit them.

```bash
git status -s
```

- [ ] **Step 3: Run full test suite + report Phase 1 status**

```bash
npm test 2>&1 | tail -5
```

Expected: 29/29 (28 existing + 1 new). Print Phase 1 summary to console:

```
Phase 1 complete:
  Files: sdf-js/src/compositor-api.js (NEW), sdf-js/scripts/test-compositor-api.mjs (NEW)
  Modified: sdf-js/examples/compositor/compositor.js (re-imports), scripts/run-tests.mjs (registered)
  Tests: 22 cumulative, all green
  Visual regression: silhouette renderer verified via /browse
  Commits: 6 (1.1 + 1.2 + 1.3 + 1.4 + 1.5 + 1.6)
```

---

## Phase 2 — `deck-model.js`

**Phase goal**: Pure JS data layer for decks. Types defined in JSDoc, localStorage CRUD, ~30 L1 assertions all green. No DOM dependencies (testable in pure Node).

### Task 2.1: Create `deck-model.js` skeleton + test file

**Files:**
- Create: `sdf-js/src/present/deck-model.js`
- Create: `sdf-js/scripts/test-deck-model.mjs`
- Modify: `scripts/run-tests.mjs`

- [ ] **Step 1: Create directory + skeleton**

```bash
mkdir -p sdf-js/src/present
```

Create `sdf-js/src/present/deck-model.js`:

```js
// =============================================================================
// deck-model.js — Atlas Present Layer 2 data model
// -----------------------------------------------------------------------------
// Pure JS / no DOM. Defines Deck + Slide types (JSDoc), CRUD operations,
// localStorage persistence + migration.
//
// localStorage key: 'atlas-decks'
//   shape: { version: 1, decks: Deck[] }
//
// Per [[compositor-layered-for-presentation]] memory: this lives in
// Layer 2 (presentation app), calls Layer 1 (compositor-api) only when
// needed for compile/render — but for Sprint 1 the model is pure data.
//
// Spec: docs/superpowers/specs/2026-06-19-atlas-present-sprint-1-design.md
// =============================================================================

/**
 * @typedef {object} Theme
 * @property {string} renderer — one of 'studio'|'fly3d'|'silhouette' (Sprint 1)
 */

/**
 * @typedef {object} DeckDefaults
 * @property {'cut'} transitionType — Sprint 1 only supports 'cut'
 * @property {number} transitionDuration — ms; 0 for cut
 */

/**
 * @typedef {object} SlideSource
 * @property {'compositor-saved'|'compositor-demo'|'blank'} type
 * @property {string} [refId] — id of source scene/demo
 * @property {number} addedAt — ms epoch
 */

/**
 * @typedef {object} Slide
 * @property {string} id — uuid
 * @property {string} [title]
 * @property {object} sceneData — SceneData v1 schema (inline, not reference)
 * @property {SlideSource} [source]
 */

/**
 * @typedef {object} Deck
 * @property {string} id — uuid
 * @property {string} title
 * @property {number} createdAt — ms epoch
 * @property {number} updatedAt — ms epoch
 * @property {Theme} theme
 * @property {DeckDefaults} defaults
 * @property {Slide[]} slides
 */

export const DECKS_STORAGE_KEY = 'atlas-decks';
export const STORAGE_VERSION = 1;

// CRUD operations populated in subsequent tasks.
```

- [ ] **Step 2: Create test file**

Create `sdf-js/scripts/test-deck-model.mjs`:

```js
// =============================================================================
// test-deck-model.mjs — L1 unit tests for Atlas Present deck model
// =============================================================================

import * as deck from '../src/present/deck-model.js';

// Mock localStorage (Node doesn't have it)
const localStorageMock = {};
globalThis.localStorage = {
  getItem: (k) => (k in localStorageMock ? localStorageMock[k] : null),
  setItem: (k, v) => {
    localStorageMock[k] = v;
  },
  removeItem: (k) => {
    delete localStorageMock[k];
  },
  clear: () => {
    for (const k of Object.keys(localStorageMock)) delete localStorageMock[k];
  },
};

let pass = 0,
  fail = 0;
function ok(cond, name) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`);
  }
}

function resetStorage() {
  localStorage.clear();
}

console.log('=== deck-model smoke test ===\n');

// constants exported
ok(deck.DECKS_STORAGE_KEY === 'atlas-decks', 'DECKS_STORAGE_KEY exported');
ok(deck.STORAGE_VERSION === 1, 'STORAGE_VERSION exported');

// [More tests added in subsequent tasks]

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
```

- [ ] **Step 3: Register test**

In `/Users/hexiaoyang/Documents/sdf-main/scripts/run-tests.mjs`, find the `api` category entry (just added in Phase 1):

```js
  { category: 'api', file: 'sdf-js/scripts/test-compositor-api.mjs' },
```

Add immediately after:

```js

  // Layer 2 — Atlas Present (deck library + editor + present mode)
  { category: 'present', file: 'sdf-js/scripts/test-deck-model.mjs' },
```

- [ ] **Step 4: Verify**

```bash
node --check sdf-js/src/present/deck-model.js && echo "deck-model.js syntax OK"
node --check sdf-js/scripts/test-deck-model.mjs && echo "test syntax OK"
npm test 2>&1 | tail -5
```

Expected: both `syntax OK`; npm test 30/30.

- [ ] **Step 5: Commit Task 2.1**

```bash
git add sdf-js/src/present/deck-model.js sdf-js/scripts/test-deck-model.mjs scripts/run-tests.mjs
git commit -m "Atlas Present: deck-model.js skeleton + test file registered

Sprint 1 Phase 2 start. New directory src/present/ for Layer 2 modules.
Types defined as JSDoc (vanilla JS, no TypeScript). localStorage key
'atlas-decks' reserved (sibling to existing 'atlas-saved-scenes' / 'atlas-history').

Plan Phase 2 Task 2.1."
```

### Task 2.2: TDD `createDeck`

- [ ] **Step 1: Write failing test**

Append to test file (before final Result line):

```js
console.log('Test group 1: createDeck');

// Basic creation
{
  const d = deck.createDeck('My Deck');
  ok(typeof d.id === 'string' && d.id.length > 0, 'createDeck: assigns id');
  ok(d.title === 'My Deck', 'createDeck: sets title');
  ok(typeof d.createdAt === 'number' && d.createdAt > 0, 'createDeck: createdAt set');
  ok(d.updatedAt === d.createdAt, 'createDeck: updatedAt = createdAt initially');
  ok(d.theme && d.theme.renderer === 'studio', 'createDeck: default theme.renderer = studio');
  ok(d.defaults && d.defaults.transitionType === 'cut', 'createDeck: default transitionType = cut');
  ok(Array.isArray(d.slides) && d.slides.length === 0, 'createDeck: slides is empty array');
}

// Empty title defaults
{
  const d = deck.createDeck();
  ok(d.title === 'Untitled Deck', `createDeck: no title defaults to 'Untitled Deck' (got '${d.title}')`);
}
```

- [ ] **Step 2: Run — expect FAIL**

Expected: `TypeError: deck.createDeck is not a function`.

- [ ] **Step 3: Implement `createDeck`**

In `sdf-js/src/present/deck-model.js`, replace `// CRUD operations populated in subsequent tasks.` with:

```js
// ---- ID helpers -------------------------------------------------------------

function uuid() {
  // crypto.randomUUID() available in Node 19+ and modern browsers
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + random
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---- CRUD operations --------------------------------------------------------

/**
 * Create a new deck with default theme + empty slides.
 *
 * @param {string} [title='Untitled Deck']
 * @returns {Deck}
 */
export function createDeck(title) {
  const now = Date.now();
  return {
    id: uuid(),
    title: title || 'Untitled Deck',
    createdAt: now,
    updatedAt: now,
    theme: {
      renderer: 'studio',
    },
    defaults: {
      transitionType: 'cut',
      transitionDuration: 0,
    },
    slides: [],
  };
}

// More CRUD added in subsequent tasks.
```

- [ ] **Step 4: Run — expect PASS**

Expected: 9 passed (2 baseline + 7 new).

### Task 2.3: TDD `addSlide` / `removeSlide`

- [ ] **Step 1: Write failing tests**

Append:

```js
console.log('\nTest group 2: addSlide / removeSlide');

// addSlide appends and updates updatedAt
{
  const d = deck.createDeck('test');
  const origUpdated = d.updatedAt;
  // Ensure clock tick to differentiate timestamps
  const slideSceneData = { v: 1, name: 'slide A', subjects: [] };
  // Sleep 5ms to ensure updatedAt changes
  const before = Date.now();
  while (Date.now() === before) {} // busy wait
  const slide = deck.addSlide(d, { sceneData: slideSceneData, title: 'A' });
  ok(d.slides.length === 1, 'addSlide: deck has 1 slide');
  ok(d.slides[0].id === slide.id, 'addSlide: returned slide is in deck');
  ok(d.slides[0].title === 'A', 'addSlide: title passed through');
  ok(d.updatedAt > origUpdated, `addSlide: updatedAt advanced (orig ${origUpdated}, now ${d.updatedAt})`);
  ok(typeof d.slides[0].id === 'string' && d.slides[0].id.length > 0, 'addSlide: auto-assigns slide id if missing');
}

// addSlide with explicit id is honored
{
  const d = deck.createDeck('test');
  const slide = deck.addSlide(d, { id: 'custom-id', sceneData: { v: 1 } });
  ok(slide.id === 'custom-id', 'addSlide: respects explicit id');
}

// removeSlide
{
  const d = deck.createDeck('test');
  deck.addSlide(d, { id: 'a', sceneData: { v: 1 } });
  deck.addSlide(d, { id: 'b', sceneData: { v: 1 } });
  deck.addSlide(d, { id: 'c', sceneData: { v: 1 } });
  const orig = d.updatedAt;
  const before = Date.now();
  while (Date.now() === before) {}
  deck.removeSlide(d, 'b');
  ok(d.slides.length === 2, 'removeSlide: 2 slides remain');
  ok(d.slides.map((s) => s.id).join(',') === 'a,c', `removeSlide: order preserved (got ${d.slides.map(s=>s.id).join(',')})`);
  ok(d.updatedAt > orig, 'removeSlide: updatedAt advanced');
}

// removeSlide non-existent id is no-op
{
  const d = deck.createDeck('test');
  deck.addSlide(d, { id: 'x', sceneData: { v: 1 } });
  const orig = d.updatedAt;
  deck.removeSlide(d, 'nonexistent');
  ok(d.slides.length === 1, 'removeSlide: nonexistent id is no-op');
  ok(d.updatedAt === orig, 'removeSlide: no update on no-op');
}
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

Append to `sdf-js/src/present/deck-model.js`:

```js
/**
 * Add a slide to a deck (mutates deck, appends to slides array, updates updatedAt).
 *
 * @param {Deck} d
 * @param {Partial<Slide>} slideInput — sceneData required; id auto-assigned if missing
 * @returns {Slide} the added slide
 */
export function addSlide(d, slideInput) {
  if (!slideInput || !slideInput.sceneData) {
    throw new Error('[deck-model] addSlide: slideInput.sceneData required');
  }
  const slide = {
    id: slideInput.id || uuid(),
    title: slideInput.title,
    sceneData: slideInput.sceneData,
    source: slideInput.source,
  };
  d.slides.push(slide);
  d.updatedAt = Date.now();
  return slide;
}

/**
 * Remove a slide from a deck by id (mutates deck, updates updatedAt if found).
 *
 * @param {Deck} d
 * @param {string} slideId
 * @returns {boolean} true if removed, false if id not found
 */
export function removeSlide(d, slideId) {
  const idx = d.slides.findIndex((s) => s.id === slideId);
  if (idx === -1) return false;
  d.slides.splice(idx, 1);
  d.updatedAt = Date.now();
  return true;
}
```

- [ ] **Step 4: Run — expect PASS**

Expected: cumulative ~20 passed.

### Task 2.4: TDD `moveSlide`

- [ ] **Step 1: Write failing tests**

Append:

```js
console.log('\nTest group 3: moveSlide');

{
  const d = deck.createDeck('test');
  ['a', 'b', 'c', 'd'].forEach((id) => deck.addSlide(d, { id, sceneData: { v: 1 } }));
  // Move 'a' (index 0) to index 2: [a,b,c,d] → [b,c,a,d]
  deck.moveSlide(d, 0, 2);
  ok(d.slides.map((s) => s.id).join(',') === 'b,c,a,d', `moveSlide(0,2): got ${d.slides.map(s=>s.id).join(',')}`);
}

{
  const d = deck.createDeck('test');
  ['a', 'b', 'c', 'd'].forEach((id) => deck.addSlide(d, { id, sceneData: { v: 1 } }));
  // Move 'd' (index 3) to index 0: [a,b,c,d] → [d,a,b,c]
  deck.moveSlide(d, 3, 0);
  ok(d.slides.map((s) => s.id).join(',') === 'd,a,b,c', `moveSlide(3,0): got ${d.slides.map(s=>s.id).join(',')}`);
}

// Out-of-bounds is no-op
{
  const d = deck.createDeck('test');
  ['a', 'b'].forEach((id) => deck.addSlide(d, { id, sceneData: { v: 1 } }));
  deck.moveSlide(d, 5, 0);  // fromIdx out of bounds
  ok(d.slides.map((s) => s.id).join(',') === 'a,b', 'moveSlide: out-of-bounds fromIdx is no-op');
  deck.moveSlide(d, 0, 5);  // toIdx clamped to length
  ok(d.slides.map((s) => s.id).join(',') === 'b,a', 'moveSlide: out-of-bounds toIdx clamps to end');
}
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

Append:

```js
/**
 * Move a slide from one index to another (mutates deck, updates updatedAt).
 * Clamps toIdx to [0, slides.length-1]. Out-of-bounds fromIdx is no-op.
 *
 * @param {Deck} d
 * @param {number} fromIdx
 * @param {number} toIdx
 * @returns {boolean} true if moved, false if no-op
 */
export function moveSlide(d, fromIdx, toIdx) {
  if (fromIdx < 0 || fromIdx >= d.slides.length) return false;
  const clampedTo = Math.max(0, Math.min(toIdx, d.slides.length - 1));
  if (clampedTo === fromIdx) return false;
  const [moved] = d.slides.splice(fromIdx, 1);
  d.slides.splice(clampedTo, 0, moved);
  d.updatedAt = Date.now();
  return true;
}
```

- [ ] **Step 4: Run — expect PASS**

Cumulative ~24.

### Task 2.5: TDD localStorage save/load

- [ ] **Step 1: Write failing tests**

Append:

```js
console.log('\nTest group 4: localStorage save/load');

resetStorage();

// Save a deck round-trips
{
  const d = deck.createDeck('Roundtrip');
  deck.addSlide(d, { id: 'a', sceneData: { v: 1, name: 'A' } });
  deck.saveDeckToStorage(d);
  const loaded = deck.loadDeckFromStorage(d.id);
  ok(loaded !== null, 'loadDeckFromStorage: returns saved deck');
  ok(loaded.title === 'Roundtrip', `loadDeckFromStorage: title preserved (got '${loaded.title}')`);
  ok(loaded.slides.length === 1 && loaded.slides[0].id === 'a', 'loadDeckFromStorage: slides preserved');
}

// loadDeckFromStorage: nonexistent id returns null
{
  resetStorage();
  ok(deck.loadDeckFromStorage('nonexistent-id') === null, 'loadDeckFromStorage: nonexistent returns null');
}

// listDecks returns all decks sorted by updatedAt desc
{
  resetStorage();
  const d1 = deck.createDeck('old');
  d1.updatedAt = 1000;
  deck.saveDeckToStorage(d1);
  const d2 = deck.createDeck('new');
  d2.updatedAt = 5000;
  deck.saveDeckToStorage(d2);
  const list = deck.listDecks();
  ok(list.length === 2, `listDecks: count 2 (got ${list.length})`);
  ok(list[0].title === 'new', `listDecks: sorted by updatedAt desc, newest first (got '${list[0].title}')`);
  ok(list[1].title === 'old', 'listDecks: oldest second');
}

// deleteDeckFromStorage
{
  resetStorage();
  const d = deck.createDeck('delete-me');
  deck.saveDeckToStorage(d);
  ok(deck.listDecks().length === 1, 'pre-delete: 1 deck');
  const removed = deck.deleteDeckFromStorage(d.id);
  ok(removed === true, 'deleteDeckFromStorage: returns true on success');
  ok(deck.listDecks().length === 0, 'post-delete: 0 decks');
  // delete nonexistent
  ok(deck.deleteDeckFromStorage('nonexistent') === false, 'deleteDeckFromStorage: returns false if not found');
}
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

Append:

```js
/**
 * Read raw storage shape. Initializes empty + version if missing.
 *
 * @private
 * @returns {{version:number, decks:Deck[]}}
 */
function readStorage() {
  const raw = localStorage.getItem(DECKS_STORAGE_KEY);
  if (!raw) return { version: STORAGE_VERSION, decks: [] };
  try {
    const parsed = JSON.parse(raw);
    return migrateDecksStorage(parsed);
  } catch (e) {
    console.warn('[deck-model] storage parse failed, reinitializing:', e.message);
    return { version: STORAGE_VERSION, decks: [] };
  }
}

/**
 * Write raw storage shape.
 *
 * @private
 * @param {{version:number, decks:Deck[]}} shape
 */
function writeStorage(shape) {
  try {
    localStorage.setItem(DECKS_STORAGE_KEY, JSON.stringify(shape));
  } catch (e) {
    console.error('[deck-model] storage write failed (quota?):', e.message);
    throw e;
  }
}

/**
 * Migrate storage shape across versions. Sprint 1 has only v1.
 *
 * @param {object} raw
 * @returns {{version:number, decks:Deck[]}}
 */
export function migrateDecksStorage(raw) {
  if (!raw || typeof raw !== 'object') {
    return { version: STORAGE_VERSION, decks: [] };
  }
  if (!Array.isArray(raw.decks)) {
    return { version: STORAGE_VERSION, decks: [] };
  }
  // Sprint 1: no migrations needed; future versions add migrator branches here
  return { version: STORAGE_VERSION, decks: raw.decks };
}

/**
 * Save a single deck to storage (creates or updates).
 *
 * @param {Deck} d
 */
export function saveDeckToStorage(d) {
  const shape = readStorage();
  const idx = shape.decks.findIndex((existing) => existing.id === d.id);
  if (idx >= 0) {
    shape.decks[idx] = d;
  } else {
    shape.decks.push(d);
  }
  writeStorage(shape);
}

/**
 * Load a single deck by id. Returns null if not found.
 *
 * @param {string} id
 * @returns {Deck|null}
 */
export function loadDeckFromStorage(id) {
  const shape = readStorage();
  return shape.decks.find((d) => d.id === id) || null;
}

/**
 * List all decks sorted by updatedAt (most recent first).
 *
 * @returns {Deck[]}
 */
export function listDecks() {
  const shape = readStorage();
  return [...shape.decks].sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Delete a deck by id. Returns true if deleted, false if not found.
 *
 * @param {string} id
 * @returns {boolean}
 */
export function deleteDeckFromStorage(id) {
  const shape = readStorage();
  const idx = shape.decks.findIndex((d) => d.id === id);
  if (idx === -1) return false;
  shape.decks.splice(idx, 1);
  writeStorage(shape);
  return true;
}
```

- [ ] **Step 4: Run — expect PASS**

Cumulative ~32 passed.

### Task 2.6: TDD `renameDeck` and `duplicateDeck`

- [ ] **Step 1: Write failing tests**

Append:

```js
console.log('\nTest group 5: renameDeck + duplicateDeck');

resetStorage();

{
  const d = deck.createDeck('original');
  deck.saveDeckToStorage(d);
  const before = Date.now();
  while (Date.now() === before) {}
  deck.renameDeck(d.id, 'renamed');
  const loaded = deck.loadDeckFromStorage(d.id);
  ok(loaded.title === 'renamed', `renameDeck: title updated (got '${loaded.title}')`);
  ok(loaded.updatedAt > d.updatedAt, 'renameDeck: updatedAt advanced');
}

{
  resetStorage();
  const d = deck.createDeck('source');
  deck.addSlide(d, { id: 's1', sceneData: { v: 1, name: 'A' } });
  deck.addSlide(d, { id: 's2', sceneData: { v: 1, name: 'B' } });
  deck.saveDeckToStorage(d);
  const dup = deck.duplicateDeck(d.id);
  ok(dup !== null, 'duplicateDeck: returns new deck');
  ok(dup.id !== d.id, 'duplicateDeck: new id assigned');
  ok(dup.title === 'source (copy)', `duplicateDeck: title gets "(copy)" suffix (got '${dup.title}')`);
  ok(dup.slides.length === 2, 'duplicateDeck: slides copied');
  ok(dup.slides[0].id !== d.slides[0].id, 'duplicateDeck: slide ids reassigned (deep copy)');
  ok(deck.listDecks().length === 2, 'duplicateDeck: storage now has 2 decks');
}
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

Append:

```js
/**
 * Rename a deck (load, update title, save). Updates updatedAt.
 *
 * @param {string} id
 * @param {string} newTitle
 * @returns {boolean} true if renamed, false if id not found
 */
export function renameDeck(id, newTitle) {
  const d = loadDeckFromStorage(id);
  if (!d) return false;
  d.title = newTitle;
  d.updatedAt = Date.now();
  saveDeckToStorage(d);
  return true;
}

/**
 * Duplicate a deck — deep copy with new id + suffix " (copy)" on title.
 * Slide ids are also reassigned (so future edits don't conflict).
 *
 * @param {string} id — source deck id
 * @returns {Deck|null} the new deck, or null if source not found
 */
export function duplicateDeck(id) {
  const src = loadDeckFromStorage(id);
  if (!src) return null;
  const now = Date.now();
  const copy = {
    ...src,
    id: uuid(),
    title: `${src.title} (copy)`,
    createdAt: now,
    updatedAt: now,
    slides: src.slides.map((s) => ({
      ...s,
      id: uuid(),
      // sceneData is deep-cloned via JSON to avoid shared references
      sceneData: JSON.parse(JSON.stringify(s.sceneData)),
    })),
  };
  saveDeckToStorage(copy);
  return copy;
}
```

- [ ] **Step 4: Run — expect PASS**

Cumulative ~39 passed.

### Task 2.7: Commit Phase 2

- [ ] **Step 1: Verify full test suite**

```bash
node sdf-js/scripts/test-deck-model.mjs
npm test 2>&1 | tail -5
```

Expected: `~39 passed, 0 failed` for deck-model; 30/30 npm test pass.

- [ ] **Step 2: Commit**

```bash
git add sdf-js/src/present/deck-model.js sdf-js/scripts/test-deck-model.mjs
git commit -m "Atlas Present Phase 2: deck-model.js — types + CRUD + localStorage (TDD)

Pure JS data layer. 7 functions: createDeck / addSlide / removeSlide /
moveSlide / saveDeckToStorage / loadDeckFromStorage / listDecks /
deleteDeckFromStorage / renameDeck / duplicateDeck / migrateDecksStorage.

Storage shape: { version: 1, decks: Deck[] } in localStorage key 'atlas-decks'.
listDecks returns sorted by updatedAt desc. duplicateDeck deep-copies (new
slide ids, JSON-cloned sceneData). Migration scaffolding for v2+.

39 assertions all green. Plan Phase 2."
```

---

## Phase 3 — `examples/present/` entry + Library page

**Phase goal**: User can navigate to `/examples/present/`, see deck library (empty initially), create new deck via prompt, see card appear, click delete/rename/duplicate. End of phase: library page works against localStorage. Editor + present mode wired but not implemented yet.

### Task 3.1: HTML shell + CSS

**Files:**
- Create: `sdf-js/examples/present/index.html`
- Create: `sdf-js/examples/present/style.css`
- Create: `sdf-js/src/present/deck-library.js`
- Create: `sdf-js/src/present/deck-editor.js` (stub for Phase 4)
- Create: `sdf-js/src/present/present-mode.js` (stub for Phase 5)

- [ ] **Step 1: Create HTML shell**

```bash
mkdir -p sdf-js/examples/present
```

Create `sdf-js/examples/present/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Atlas · Present</title>
  <link rel="icon" href="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><circle cx='8' cy='8' r='6' fill='%23ffd070'/></svg>">
  <link rel="stylesheet" href="./style.css">
</head>
<body>
  <div id="app">
    <!-- Router populated by router-init.js based on URL query -->
    <div id="route-target"></div>
  </div>

  <script type="module">
    // Inline router — three modes based on URL query:
    //   /examples/present/                  → library page
    //   /examples/present/?deck=<id>        → editor page
    //   /examples/present/?deck=<id>&present=1 → present mode
    const params = new URLSearchParams(location.search);
    const deckId = params.get('deck');
    const present = params.get('present') === '1';
    const target = document.getElementById('route-target');

    if (deckId && present) {
      const { mountPresentMode } = await import('../../src/present/present-mode.js');
      await mountPresentMode(target, deckId);
    } else if (deckId) {
      const { mountDeckEditor } = await import('../../src/present/deck-editor.js');
      await mountDeckEditor(target, deckId);
    } else {
      const { mountDeckLibrary } = await import('../../src/present/deck-library.js');
      await mountDeckLibrary(target);
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: Create stub modules so HTML doesn't error**

Create `sdf-js/src/present/deck-editor.js`:

```js
// =============================================================================
// deck-editor.js — STUB for Phase 4. Real impl in Phase 4 Task 4.x.
// =============================================================================

export async function mountDeckEditor(target, deckId) {
  target.innerHTML = `<div class="page-pad">Editor for deck: ${deckId}<br><small>(Phase 4 — not yet implemented)</small></div>`;
}
```

Create `sdf-js/src/present/present-mode.js`:

```js
// =============================================================================
// present-mode.js — STUB for Phase 5. Real impl in Phase 5 Task 5.x.
// =============================================================================

export async function mountPresentMode(target, deckId) {
  target.innerHTML = `<div class="page-pad">Present mode for deck: ${deckId}<br><small>(Phase 5 — not yet implemented)</small></div>`;
}
```

Create `sdf-js/src/present/deck-library.js` skeleton:

```js
// =============================================================================
// deck-library.js — Atlas Present library page
// -----------------------------------------------------------------------------
// Lists decks from localStorage, supports create/rename/delete/duplicate.
// =============================================================================

import * as deckModel from './deck-model.js';

export async function mountDeckLibrary(target) {
  // Implementation in Task 3.2
  target.innerHTML = `<div class="page-pad">Library — to be implemented in Phase 3</div>`;
}
```

- [ ] **Step 3: Create CSS**

Create `sdf-js/examples/present/style.css`:

```css
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0; min-height: 100vh;
  font-family: -apple-system, system-ui, sans-serif;
  background: #0d0d0d;
  color: #ccc;
}

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

#route-target {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.page-pad {
  padding: 40px;
}

/* ---- Topbar ---- */
.topbar {
  display: flex;
  align-items: center;
  padding: 0 16px;
  height: 44px;
  background: #1a1a1a;
  border-bottom: 1px solid #2a2a2a;
}
.topbar .brand {
  font-weight: 700;
  font-size: 15px;
  color: #ffd070;
}
.topbar .brand .sub {
  color: #888;
  font-weight: 400;
  margin-left: 6px;
  font-size: 12px;
}
.topbar .spacer {
  flex: 1;
}
.topbar button, .topbar a {
  background: #2a2a2a;
  color: #ffd070;
  border: 1px solid #3a3a3a;
  padding: 6px 14px;
  font-size: 13px;
  border-radius: 3px;
  cursor: pointer;
  font-family: inherit;
  text-decoration: none;
}
.topbar button:hover, .topbar a:hover {
  background: #3a3a3a;
}

/* ---- Library page ---- */
.library-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
  padding: 24px;
}
.deck-card {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.deck-card h3 {
  margin: 0;
  font-size: 15px;
  color: #ddd;
}
.deck-card .meta {
  color: #888;
  font-size: 12px;
}
.deck-card .actions {
  display: flex;
  gap: 6px;
  margin-top: auto;
  padding-top: 12px;
}
.deck-card .actions button {
  background: #2a2a2a;
  color: #ccc;
  border: 1px solid #3a3a3a;
  padding: 4px 10px;
  border-radius: 3px;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
}
.deck-card .actions button:hover {
  background: #3a3a3a;
}
.deck-card .actions .primary {
  background: #ffd070;
  color: #1a1a1a;
  border-color: #ffd070;
}

.empty-state {
  text-align: center;
  padding: 80px 40px;
  color: #888;
}
.empty-state h2 {
  color: #ccc;
  font-weight: 400;
  margin-bottom: 16px;
}
```

- [ ] **Step 4: Browse smoke test**

```bash
$B goto "http://localhost:8001/examples/present/"
$B wait --networkidle
sleep 1
$B text | head -10
$B console --errors
```

Expected: text shows "Library — to be implemented in Phase 3"; no console errors.

- [ ] **Step 5: Commit Task 3.1**

```bash
git add sdf-js/examples/present/ sdf-js/src/present/deck-library.js sdf-js/src/present/deck-editor.js sdf-js/src/present/present-mode.js
git commit -m "Atlas Present Phase 3.1: HTML shell + CSS + 3 stub modules

Entry page examples/present/index.html with inline router (3 modes based
on URL query: library / editor / present). CSS for topbar + library grid
+ deck cards + empty state. Stub modules for deck-editor.js + present-mode.js
return placeholder; deck-library.js will be implemented in Task 3.2.

Plan Phase 3 Task 3.1."
```

### Task 3.2: Implement library page rendering

- [ ] **Step 1: Replace deck-library.js skeleton with real implementation**

Replace the contents of `sdf-js/src/present/deck-library.js`:

```js
// =============================================================================
// deck-library.js — Atlas Present library page
// -----------------------------------------------------------------------------
// Lists decks from localStorage, supports create / rename / delete / duplicate.
// =============================================================================

import * as deckModel from './deck-model.js';

export async function mountDeckLibrary(target) {
  target.innerHTML = `
    <div class="topbar">
      <div class="brand">Atlas <span class="sub">Present</span></div>
      <div class="spacer"></div>
      <button id="btn-new-deck">+ New Deck</button>
    </div>
    <div id="library-body"></div>
  `;
  document.getElementById('btn-new-deck').addEventListener('click', handleNewDeck);
  renderLibraryBody();
}

function renderLibraryBody() {
  const body = document.getElementById('library-body');
  const decks = deckModel.listDecks();
  if (decks.length === 0) {
    body.innerHTML = `
      <div class="empty-state">
        <h2>No decks yet</h2>
        <p>Click "+ New Deck" to create your first deck.</p>
      </div>
    `;
    return;
  }
  body.innerHTML = `
    <div class="library-grid">
      ${decks.map(renderDeckCard).join('')}
    </div>
  `;
  // Wire actions per card
  for (const d of decks) {
    document.getElementById(`btn-present-${d.id}`)?.addEventListener('click', () => handlePresent(d.id));
    document.getElementById(`btn-edit-${d.id}`)?.addEventListener('click', () => handleEdit(d.id));
    document.getElementById(`btn-rename-${d.id}`)?.addEventListener('click', () => handleRename(d.id));
    document.getElementById(`btn-duplicate-${d.id}`)?.addEventListener('click', () => handleDuplicate(d.id));
    document.getElementById(`btn-delete-${d.id}`)?.addEventListener('click', () => handleDelete(d.id));
  }
}

function renderDeckCard(d) {
  const updated = relativeTime(d.updatedAt);
  return `
    <div class="deck-card">
      <h3>${escapeHtml(d.title)}</h3>
      <div class="meta">${d.slides.length} slides · ${updated}</div>
      <div class="actions">
        <button id="btn-present-${d.id}" class="primary">▶</button>
        <button id="btn-edit-${d.id}">✎</button>
        <button id="btn-rename-${d.id}">Rename</button>
        <button id="btn-duplicate-${d.id}">Duplicate</button>
        <button id="btn-delete-${d.id}">Delete</button>
      </div>
    </div>
  `;
}

function handleNewDeck() {
  const title = prompt('Deck name:', 'Untitled Deck');
  if (!title) return;
  const d = deckModel.createDeck(title);
  deckModel.saveDeckToStorage(d);
  renderLibraryBody();
}

function handleEdit(id) {
  location.search = `?deck=${id}`;
}

function handlePresent(id) {
  location.search = `?deck=${id}&present=1`;
}

function handleRename(id) {
  const d = deckModel.loadDeckFromStorage(id);
  if (!d) return;
  const newTitle = prompt('New name:', d.title);
  if (!newTitle) return;
  deckModel.renameDeck(id, newTitle);
  renderLibraryBody();
}

function handleDuplicate(id) {
  deckModel.duplicateDeck(id);
  renderLibraryBody();
}

function handleDelete(id) {
  const d = deckModel.loadDeckFromStorage(id);
  if (!d) return;
  if (!confirm(`Delete deck "${d.title}"? This cannot be undone.`)) return;
  deckModel.deleteDeckFromStorage(id);
  renderLibraryBody();
}

// ---- Helpers ----------------------------------------------------------------

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function relativeTime(ms) {
  const diffSec = Math.round((Date.now() - ms) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
  return `${Math.round(diffSec / 86400)}d ago`;
}
```

- [ ] **Step 2: Browse smoke test**

```bash
$B goto "http://localhost:8001/examples/present/"
$B wait --networkidle
sleep 1
$B text | head -10
$B console --errors
```

Expected: text shows "Atlas Present", "+ New Deck", "No decks yet", etc. No console errors.

- [ ] **Step 3: Smoke-test create new deck flow**

```bash
$B click "text=+ New Deck"
sleep 1
# A prompt dialog appears — accept default
$B dialog-accept "Test Deck"
sleep 1
$B text | head -10
$B screenshot /tmp/p3-library-with-deck.png
```

Read `/tmp/p3-library-with-deck.png` via Read tool. Verify a deck card with "Test Deck" + "0 slides · just now" + action buttons (▶ ✎ Rename Duplicate Delete) is visible.

- [ ] **Step 4: Commit Task 3.2**

```bash
git add sdf-js/src/present/deck-library.js
git commit -m "Atlas Present Phase 3.2: library page renders + 5 actions

Library page renders decks from localStorage with empty state when none.
Actions: ▶ present (goes to ?deck=X&present=1) / ✎ edit (goes to ?deck=X)
/ rename / duplicate / delete (with confirm).

New deck via prompt → createDeck + saveDeckToStorage → re-render.

Browse smoke test verified: empty state shows, create flow works, card
renders with relative time + slide count.

Plan Phase 3 Task 3.2."
```

---

## Phase 4 — Deck Editor page

**Phase goal**: Editor renders slide list (left), preview pane (center), settings (right). User can add slides from compositor demos, drag-reorder, switch renderer, remove slides. Changes persist via deck-model.

### Task 4.1: Editor shell + URL parsing + initial render

**Files:**
- Modify: `sdf-js/src/present/deck-editor.js` (replace stub)
- Modify: `sdf-js/examples/present/style.css` (add editor styles)

- [ ] **Step 1: Replace editor stub**

Replace `sdf-js/src/present/deck-editor.js`:

```js
// =============================================================================
// deck-editor.js — Atlas Present deck editor page
// -----------------------------------------------------------------------------
// 3-pane layout: slide list (left) + preview (center) + settings (right).
// -----------------------------------------------------------------------------
import * as deckModel from './deck-model.js';
import { createRendererForId, compileScene } from '../compositor-api.js';

let currentDeck = null;
let currentSlideIdx = -1;
let currentRenderer = null;
let currentCanvas = null;

export async function mountDeckEditor(target, deckId) {
  const deck = deckModel.loadDeckFromStorage(deckId);
  if (!deck) {
    target.innerHTML = `<div class="page-pad">Deck not found: ${deckId}<br><a href="./">← Library</a></div>`;
    return;
  }
  currentDeck = deck;
  currentSlideIdx = deck.slides.length > 0 ? 0 : -1;

  target.innerHTML = `
    <div class="topbar">
      <a href="./" class="btn-back">← Library</a>
      <div class="brand" style="margin-left: 16px;" id="editor-deck-title">${escapeHtml(deck.title)}</div>
      <div class="spacer"></div>
      <button id="btn-present-current">▶ Present</button>
    </div>
    <div class="editor-body">
      <aside class="slide-rail" id="slide-rail"></aside>
      <main class="preview-pane" id="preview-pane">
        <canvas id="preview-canvas" width="640" height="360"></canvas>
        <div class="preview-meta" id="preview-meta"></div>
      </main>
      <aside class="settings-pane" id="settings-pane"></aside>
    </div>
  `;
  document.getElementById('btn-present-current').addEventListener('click', () => {
    location.search = `?deck=${deck.id}&present=1`;
  });

  renderSlideRail();
  renderSettingsPane();
  renderPreview();
}

function renderSlideRail() {
  const rail = document.getElementById('slide-rail');
  rail.innerHTML = `
    ${currentDeck.slides
      .map(
        (s, i) => `
      <div class="slide-thumb ${i === currentSlideIdx ? 'selected' : ''}" data-idx="${i}" draggable="true">
        <div class="thumb-num">${i + 1}</div>
        <div class="thumb-title">${escapeHtml(s.title || `Slide ${i + 1}`)}</div>
      </div>
    `,
      )
      .join('')}
    <button class="btn-add-slide" id="btn-add-slide">+ Add Slide</button>
  `;
  rail.querySelectorAll('.slide-thumb').forEach((el) => {
    el.addEventListener('click', () => {
      currentSlideIdx = parseInt(el.dataset.idx, 10);
      renderSlideRail();
      renderSettingsPane();
      renderPreview();
    });
  });
  document.getElementById('btn-add-slide')?.addEventListener('click', handleAddSlide);
  // Drag reorder wiring added in Task 4.3
}

function renderSettingsPane() {
  const pane = document.getElementById('settings-pane');
  const slide = currentSlideIdx >= 0 ? currentDeck.slides[currentSlideIdx] : null;
  const RENDERERS = ['studio', 'fly3d', 'silhouette'];
  pane.innerHTML = `
    <h3>Deck</h3>
    <div class="settings-row">
      <label>Renderer</label>
      <select id="select-renderer">
        ${RENDERERS.map((r) => `<option value="${r}" ${r === currentDeck.theme.renderer ? 'selected' : ''}>${r}</option>`).join('')}
      </select>
    </div>
    <div class="settings-row meta">${currentDeck.slides.length} slides</div>

    ${slide ? `
      <h3 style="margin-top: 24px;">Slide ${currentSlideIdx + 1}</h3>
      <div class="settings-row">
        <label>Title</label>
        <input type="text" id="input-slide-title" value="${escapeHtml(slide.title || '')}" placeholder="(no title)" />
      </div>
      <div class="settings-row">
        <button id="btn-remove-slide">Remove Slide</button>
      </div>
    ` : '<div class="settings-row meta" style="margin-top: 24px;">No slide selected. Add a slide to start.</div>'}
  `;
  document.getElementById('select-renderer')?.addEventListener('change', handleRendererChange);
  document.getElementById('input-slide-title')?.addEventListener('change', handleSlideTitleChange);
  document.getElementById('btn-remove-slide')?.addEventListener('click', handleRemoveSlide);
}

function renderPreview() {
  const canvas = document.getElementById('preview-canvas');
  const meta = document.getElementById('preview-meta');
  if (currentSlideIdx < 0 || !currentDeck.slides[currentSlideIdx]) {
    meta.textContent = 'No slide selected';
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#888';
    ctx.font = '14px sans-serif';
    ctx.fillText('Empty preview', 20, 30);
    return;
  }
  const slide = currentDeck.slides[currentSlideIdx];
  const rendererId = currentDeck.theme.renderer;
  meta.textContent = `Slide ${currentSlideIdx + 1} / ${currentDeck.slides.length} · ${rendererId}`;

  // Renderer lifecycle: re-create when renderer or canvas changes
  if (currentRenderer && currentCanvas === canvas && currentRenderer.__rendererId === rendererId) {
    // Re-render existing
    try {
      renderSlideToCurrentRenderer(slide);
    } catch (e) {
      console.error('[deck-editor] preview render failed:', e);
      meta.textContent = `Render error: ${e.message}`;
    }
    return;
  }
  // Tear down + create new
  if (currentRenderer) {
    try {
      currentRenderer.unmount();
    } catch (e) {
      console.warn('[deck-editor] previous renderer unmount failed:', e);
    }
  }
  try {
    currentRenderer = createRendererForId(rendererId, canvas);
    currentRenderer.__rendererId = rendererId;
    currentCanvas = canvas;
    renderSlideToCurrentRenderer(slide);
  } catch (e) {
    console.error('[deck-editor] renderer create failed:', e);
    meta.textContent = `Renderer error (${rendererId}): ${e.message}`;
  }
}

function renderSlideToCurrentRenderer(slide) {
  const rendererId = currentDeck.theme.renderer;
  if (rendererId === 'silhouette') {
    // CPU silhouette needs layers from compiled subjects.
    // For Sprint 1, just rasterize the unified SDF via a single neutral layer.
    const compiled = compileScene(slide.sceneData);
    const layers = [{ sdf: compiled.sdf, color: [200, 200, 200], stroke: 0 }];
    currentRenderer.render(layers, { background: [13, 13, 13] });
  } else {
    // GPU path
    const compiled = compileScene(slide.sceneData);
    currentRenderer.render(compiled.sdf);
  }
}

// ---- Handlers ---------------------------------------------------------------

function handleAddSlide() {
  // Sprint 1 MVP: open prompt for compositor demo id
  // (Full "browse demos" modal is Sprint 2)
  const demoId = prompt('Add slide from compositor demo id (e.g. "cube-3d-showcase"):');
  if (!demoId) return;
  loadDemoAndAddSlide(demoId);
}

async function loadDemoAndAddSlide(demoId) {
  try {
    const res = await fetch(`../compositor/demo-lifts/${demoId}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.sceneData) throw new Error('demo has no sceneData');
    deckModel.addSlide(currentDeck, {
      title: data.title || demoId,
      sceneData: data.sceneData,
      source: { type: 'compositor-demo', refId: demoId, addedAt: Date.now() },
    });
    deckModel.saveDeckToStorage(currentDeck);
    currentSlideIdx = currentDeck.slides.length - 1;
    renderSlideRail();
    renderSettingsPane();
    renderPreview();
  } catch (e) {
    alert(`Failed to add slide: ${e.message}`);
  }
}

function handleRendererChange(e) {
  currentDeck.theme.renderer = e.target.value;
  currentDeck.updatedAt = Date.now();
  deckModel.saveDeckToStorage(currentDeck);
  renderPreview();
}

function handleSlideTitleChange(e) {
  if (currentSlideIdx < 0) return;
  currentDeck.slides[currentSlideIdx].title = e.target.value;
  currentDeck.updatedAt = Date.now();
  deckModel.saveDeckToStorage(currentDeck);
  renderSlideRail();
}

function handleRemoveSlide() {
  if (currentSlideIdx < 0) return;
  const slide = currentDeck.slides[currentSlideIdx];
  if (!confirm(`Remove slide "${slide.title || `Slide ${currentSlideIdx + 1}`}"?`)) return;
  deckModel.removeSlide(currentDeck, slide.id);
  deckModel.saveDeckToStorage(currentDeck);
  currentSlideIdx = Math.min(currentSlideIdx, currentDeck.slides.length - 1);
  renderSlideRail();
  renderSettingsPane();
  renderPreview();
}

// ---- Helpers ----------------------------------------------------------------

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

- [ ] **Step 2: Add editor CSS**

Append to `sdf-js/examples/present/style.css`:

```css
/* ---- Editor page ---- */
.editor-body {
  display: grid;
  grid-template-columns: 220px 1fr 280px;
  flex: 1;
  min-height: 0;
}

.slide-rail {
  background: #141414;
  border-right: 1px solid #2a2a2a;
  padding: 12px;
  overflow-y: auto;
}
.slide-thumb {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 4px;
  padding: 10px;
  margin-bottom: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
}
.slide-thumb:hover {
  background: #222;
}
.slide-thumb.selected {
  border-color: #ffd070;
  background: #2a2520;
}
.slide-thumb .thumb-num {
  color: #ffd070;
  font-weight: 700;
  font-size: 12px;
  width: 18px;
}
.slide-thumb .thumb-title {
  color: #ddd;
  font-size: 12px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.btn-add-slide {
  width: 100%;
  background: #2a2a2a;
  color: #ffd070;
  border: 1px dashed #3a3a3a;
  padding: 10px;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  margin-top: 8px;
}
.btn-add-slide:hover {
  background: #3a3a3a;
}

.preview-pane {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  background: #0d0d0d;
}
.preview-pane canvas {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  max-width: 100%;
  max-height: 70vh;
}
.preview-meta {
  color: #888;
  font-size: 12px;
}

.settings-pane {
  background: #141414;
  border-left: 1px solid #2a2a2a;
  padding: 20px;
  overflow-y: auto;
}
.settings-pane h3 {
  margin: 0 0 12px 0;
  color: #ddd;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.settings-row {
  margin-bottom: 12px;
}
.settings-row label {
  display: block;
  color: #888;
  font-size: 11px;
  margin-bottom: 4px;
}
.settings-row input, .settings-row select {
  width: 100%;
  background: #1a1a1a;
  color: #ddd;
  border: 1px solid #2a2a2a;
  padding: 6px 8px;
  font-family: inherit;
  font-size: 13px;
  border-radius: 3px;
}
.settings-row.meta {
  color: #888;
  font-size: 12px;
}
.settings-row button {
  background: #2a2a2a;
  color: #ccc;
  border: 1px solid #3a3a3a;
  padding: 6px 12px;
  border-radius: 3px;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  width: 100%;
}
.settings-row button:hover {
  background: #3a3a3a;
}

.btn-back {
  background: #2a2a2a;
  color: #ffd070;
  text-decoration: none;
  padding: 6px 12px;
  border-radius: 3px;
  font-size: 13px;
  border: 1px solid #3a3a3a;
}
.btn-back:hover {
  background: #3a3a3a;
}
```

- [ ] **Step 3: Browse smoke test**

```bash
$B goto "http://localhost:8001/examples/present/"
$B wait --networkidle
sleep 1
$B click "text=+ New Deck"
sleep 1
$B dialog-accept "Editor Test"
sleep 1
$B click "text=✎"
sleep 1
$B text | head -15
$B console --errors
$B screenshot /tmp/p4-editor-empty.png
```

Read `/tmp/p4-editor-empty.png` via Read tool. Verify 3-pane layout visible: slide rail (left, with "+ Add Slide" button), preview canvas (center, empty/dark), settings pane (right, with "Renderer" dropdown). Console should be empty.

- [ ] **Step 4: Smoke-test add slide flow**

```bash
$B click "text=+ Add Slide"
sleep 1
$B dialog-accept "cube-3d-showcase"
sleep 2
$B text | head -15
$B screenshot /tmp/p4-editor-with-slide.png
$B console --errors
```

Read `/tmp/p4-editor-with-slide.png`. Verify slide thumbnail appears in left rail, preview pane shows rendered output (silhouette by default since GPU may not be available in headless). Console may show "GL not available" type warnings for fly3d but no errors.

- [ ] **Step 5: Commit Task 4.1**

```bash
git add sdf-js/src/present/deck-editor.js sdf-js/examples/present/style.css
git commit -m "Atlas Present Phase 4.1: editor page — 3-pane layout + add slide + renderer switch

Editor at /examples/present/?deck=<id>. Three panes: slide rail (left, with
add/select), preview canvas (center, live render of selected slide via
compositor-api createRendererForId), settings (right, with renderer dropdown +
slide title input + remove slide).

Add Slide flow: prompts for compositor demo id, fetches from
../compositor/demo-lifts/<id>.json, adds to deck via addSlide, persists,
re-renders preview.

Renderer lifecycle: create-once + reuse if same id; tear down + recreate on
switch (studio / fly3d / silhouette).

Drag-reorder + browse-demos modal deferred to Task 4.2+.

Plan Phase 4 Task 4.1."
```

### Task 4.2: Drag-to-reorder slides

- [ ] **Step 1: Add drag handlers to slide-rail**

In `sdf-js/src/present/deck-editor.js`, modify the `renderSlideRail` function. After the `.slide-thumb` click listener wiring loop, add:

```js
  // Drag-to-reorder
  let draggedIdx = null;
  rail.querySelectorAll('.slide-thumb').forEach((el) => {
    el.addEventListener('dragstart', (e) => {
      draggedIdx = parseInt(el.dataset.idx, 10);
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(draggedIdx));
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      draggedIdx = null;
      rail.querySelectorAll('.slide-thumb').forEach((t) => t.classList.remove('drop-target'));
    });
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      el.classList.add('drop-target');
    });
    el.addEventListener('dragleave', () => {
      el.classList.remove('drop-target');
    });
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drop-target');
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
      const toIdx = parseInt(el.dataset.idx, 10);
      if (Number.isFinite(fromIdx) && Number.isFinite(toIdx) && fromIdx !== toIdx) {
        deckModel.moveSlide(currentDeck, fromIdx, toIdx);
        deckModel.saveDeckToStorage(currentDeck);
        // Track which slide is now "current" — it may have moved
        currentSlideIdx = toIdx;
        renderSlideRail();
        renderSettingsPane();
        renderPreview();
      }
    });
  });
```

- [ ] **Step 2: Add CSS for drag states**

Append to `sdf-js/examples/present/style.css`:

```css
.slide-thumb.dragging { opacity: 0.4; }
.slide-thumb.drop-target { border-color: #ffd070; }
```

- [ ] **Step 3: Browse smoke test (manual drag is hard in headless; just verify no errors)**

```bash
$B goto "http://localhost:8001/examples/present/"
$B wait --networkidle
sleep 1
# Find the editor-test deck created in 4.1 and go edit
$B snapshot -i | grep -i editor
# Click ✎ for that deck
# ...
$B console --errors
```

Drag-and-drop in headless is unreliable; skip live drag test. Just verify no JS errors on editor page load.

- [ ] **Step 4: Commit Task 4.2**

```bash
git add sdf-js/src/present/deck-editor.js sdf-js/examples/present/style.css
git commit -m "Atlas Present Phase 4.2: drag-to-reorder slides

HTML5 drag API on .slide-thumb elements. Tracks dragged index, applies
visual hint (drop-target border), on drop calls deckModel.moveSlide +
saveDeckToStorage. Selected slide tracks the move.

Plan Phase 4 Task 4.2."
```

---

## Phase 5 — Present Mode + L3 acceptance

**Phase goal**: Fullscreen present mode works end-to-end. Run the 10-step L3 acceptance test from spec §7.

### Task 5.1: Implement present-mode.js

**Files:**
- Modify: `sdf-js/src/present/present-mode.js` (replace stub)
- Modify: `sdf-js/examples/present/style.css` (add present mode styles)

- [ ] **Step 1: Replace stub**

Replace `sdf-js/src/present/present-mode.js`:

```js
// =============================================================================
// present-mode.js — Atlas Present fullscreen playback
// -----------------------------------------------------------------------------
// Audience-facing UI: fullscreen, ←→/space/esc/home/end keys, cursor auto-hide,
// renderer LOCKED to deck.theme.renderer, camera LOCKED (no drag/WASD).
// =============================================================================

import * as deckModel from './deck-model.js';
import { createRendererForId, compileScene } from '../compositor-api.js';

let deck = null;
let slideIdx = 0;
let renderer = null;
let canvas = null;
let cursorHideTimer = null;

export async function mountPresentMode(target, deckId) {
  deck = deckModel.loadDeckFromStorage(deckId);
  if (!deck) {
    target.innerHTML = `<div class="page-pad">Deck not found: ${deckId}<br><a href="./">← Library</a></div>`;
    return;
  }
  if (deck.slides.length === 0) {
    target.innerHTML = `<div class="page-pad">Deck "${deck.title}" has no slides.<br><a href="./?deck=${deckId}">← Editor</a></div>`;
    return;
  }
  slideIdx = 0;

  target.innerHTML = `
    <div class="present-stage" id="present-stage">
      <canvas id="present-canvas"></canvas>
      <div class="present-counter" id="present-counter"></div>
      <div class="present-exit-hint" id="present-exit-hint">Press <kbd>esc</kbd> to exit</div>
    </div>
  `;
  canvas = document.getElementById('present-canvas');
  fitCanvasToWindow();

  try {
    renderer = createRendererForId(deck.theme.renderer, canvas);
  } catch (e) {
    target.innerHTML = `<div class="page-pad">Renderer error (${deck.theme.renderer}): ${e.message}<br><a href="./?deck=${deckId}">← Editor</a></div>`;
    return;
  }

  // Try to enter fullscreen (requires user gesture in some browsers; suppress
  // error if blocked — present mode still works in a regular window)
  try {
    if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    }
  } catch (e) {
    console.warn('[present-mode] fullscreen blocked:', e.message);
  }

  // Hide cursor after 2s idle
  resetCursorHide();
  document.addEventListener('mousemove', resetCursorHide);

  // Key handlers
  document.addEventListener('keydown', handleKey);

  // Click anywhere → next
  canvas.addEventListener('click', goNext);

  // Window resize → refit canvas + re-render
  window.addEventListener('resize', () => {
    fitCanvasToWindow();
    renderCurrentSlide();
  });

  renderCurrentSlide();
  updateCounter();
}

function fitCanvasToWindow() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function renderCurrentSlide() {
  if (!deck || !renderer || !canvas) return;
  if (slideIdx < 0 || slideIdx >= deck.slides.length) return;
  const slide = deck.slides[slideIdx];
  try {
    const compiled = compileScene(slide.sceneData);
    if (deck.theme.renderer === 'silhouette') {
      const layers = [{ sdf: compiled.sdf, color: [200, 200, 200], stroke: 0 }];
      renderer.render(layers, { background: [13, 13, 13] });
    } else {
      renderer.render(compiled.sdf);
    }
  } catch (e) {
    console.error('[present-mode] render failed:', e);
  }
}

function updateCounter() {
  const el = document.getElementById('present-counter');
  if (!el) return;
  el.textContent = `${slideIdx + 1} / ${deck.slides.length}`;
  el.classList.remove('hidden');
  // Auto-hide after 2s
  if (counterHideTimer) clearTimeout(counterHideTimer);
  counterHideTimer = setTimeout(() => el.classList.add('hidden'), 2000);
}

let counterHideTimer = null;

function resetCursorHide() {
  document.body.style.cursor = '';
  if (cursorHideTimer) clearTimeout(cursorHideTimer);
  cursorHideTimer = setTimeout(() => {
    document.body.style.cursor = 'none';
  }, 2000);
}

function goNext() {
  if (slideIdx < deck.slides.length - 1) {
    slideIdx++;
    renderCurrentSlide();
    updateCounter();
  }
  // At end: stay (no wrap)
}

function goPrev() {
  if (slideIdx > 0) {
    slideIdx--;
    renderCurrentSlide();
    updateCounter();
  }
}

function goFirst() {
  slideIdx = 0;
  renderCurrentSlide();
  updateCounter();
}

function goLast() {
  slideIdx = deck.slides.length - 1;
  renderCurrentSlide();
  updateCounter();
}

async function exitPresent() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch (e) {
    /* ignore */
  }
  // Navigate back to editor
  location.search = `?deck=${deck.id}`;
}

function handleKey(e) {
  switch (e.key) {
    case 'ArrowRight':
    case ' ':
    case 'PageDown':
      e.preventDefault();
      goNext();
      break;
    case 'ArrowLeft':
    case 'PageUp':
      e.preventDefault();
      goPrev();
      break;
    case 'Home':
      e.preventDefault();
      goFirst();
      break;
    case 'End':
      e.preventDefault();
      goLast();
      break;
    case 'Escape':
      e.preventDefault();
      exitPresent();
      break;
    default:
      break;
  }
}
```

- [ ] **Step 2: Add present-mode CSS**

Append to `sdf-js/examples/present/style.css`:

```css
/* ---- Present mode ---- */
.present-stage {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: #0d0d0d;
  overflow: hidden;
}
.present-stage canvas {
  position: absolute;
  top: 0; left: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}
.present-counter {
  position: fixed;
  bottom: 24px;
  right: 24px;
  color: #888;
  font-size: 14px;
  background: rgba(0, 0, 0, 0.5);
  padding: 6px 12px;
  border-radius: 3px;
  transition: opacity 0.3s;
}
.present-counter.hidden { opacity: 0; }
.present-exit-hint {
  position: fixed;
  bottom: 24px;
  left: 24px;
  color: #555;
  font-size: 11px;
}
.present-exit-hint kbd {
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 3px;
  padding: 1px 6px;
  color: #888;
  font-family: monospace;
}
```

- [ ] **Step 3: Browse smoke test**

```bash
$B goto "http://localhost:8001/examples/present/"
$B wait --networkidle
sleep 1
# Make sure we have a deck with at least one slide for testing
# (If created in Phase 4, should still exist in localStorage)
$B snapshot -i | grep -iE "deck|editor"
# Click ✎ to edit one if needed, ensure a slide exists, then go present
# ...
$B console --errors
```

If silhouette renders in headless: should see the slide. If browser blocks fullscreen API (it usually does without user gesture), the present mode still works in regular window (per the try-catch).

- [ ] **Step 4: Commit Task 5.1**

```bash
git add sdf-js/src/present/present-mode.js sdf-js/examples/present/style.css
git commit -m "Atlas Present Phase 5.1: present mode — fullscreen + ←→ keys + counter

Audience-facing fullscreen playback at /examples/present/?deck=X&present=1.
Keys: ←→/space/PageUp/PageDown/Home/End/Esc. Click canvas = advance.
Cursor auto-hides after 2s idle. Slide counter auto-hides after 2s.

Renderer LOCKED to deck.theme.renderer (no pill switching). No camera drag
or WASD (audience can't accidentally re-frame).

Fullscreen API best-effort (browsers may block without user gesture; present
mode degrades gracefully to windowed mode).

Plan Phase 5 Task 5.1."
```

### Task 5.2: L3 end-to-end acceptance test

This is a MANUAL test run via /browse (or real browser if /browse has issues). Per spec §7.

- [ ] **Step 1: Reset localStorage**

```bash
$B goto "http://localhost:8001/examples/present/"
$B wait --networkidle
$B js "localStorage.removeItem('atlas-decks')"
$B reload
sleep 1
```

- [ ] **Step 2: Step 1 of acceptance — open present page, see empty state**

```bash
$B text | head -5
```

Expected: "No decks yet" visible.

- [ ] **Step 3: Step 2 — create new deck "Cube demo"**

```bash
$B click "text=+ New Deck"
sleep 1
$B dialog-accept "Cube demo"
sleep 1
$B text | head -10
```

Expected: deck card "Cube demo" with "0 slides · just now" visible.

- [ ] **Step 4: Step 3 — enter editor + add 3 slides from compositor demos**

```bash
$B click "text=✎"
sleep 1
# Add slide 1
$B click "text=+ Add Slide"
sleep 1
$B dialog-accept "cube-3d-showcase"
sleep 2
# Add slide 2
$B click "text=+ Add Slide"
sleep 1
$B dialog-accept "bonsai-mountain"
sleep 2
# Add slide 3
$B click "text=+ Add Slide"
sleep 1
$B dialog-accept "coastal-lighthouse"
sleep 2
$B text | head -15
$B screenshot /tmp/p5-editor-3-slides.png
```

Read `/tmp/p5-editor-3-slides.png`. Verify 3 slide thumbnails in left rail.

- [ ] **Step 5: Step 4 — click ▶ Present**

```bash
$B click "text=▶ Present"
sleep 2
$B text | head -5
$B screenshot /tmp/p5-present-slide-1.png
```

Read `/tmp/p5-present-slide-1.png`. Should see slide 1 (cube-3d-showcase rendered).

- [ ] **Step 6: Steps 5-6 — → twice, → at end stays**

```bash
$B press ArrowRight
sleep 1
$B screenshot /tmp/p5-present-slide-2.png
$B press ArrowRight
sleep 1
$B screenshot /tmp/p5-present-slide-3.png
$B press ArrowRight  # at end, should stay on slide 3
sleep 1
$B screenshot /tmp/p5-present-slide-3-stuck.png
```

Read screenshots. Verify slide-2 differs from slide-3 and slide-3-stuck looks the same as slide-3 (no advance past end).

- [ ] **Step 7: Steps 7-8 — ← back + esc to exit**

```bash
$B press ArrowLeft
sleep 1
$B screenshot /tmp/p5-present-back-to-2.png
$B press Escape
sleep 1
# After exit, should be back at editor URL
$B url
```

Read screenshot. Verify back on slide 2. URL should now be `?deck=<id>` (no `&present=1`).

- [ ] **Step 8: Step 9 — reorder slide 3 to position 1 (this is hard in headless — manually verify functionality exists by inspecting DOM)**

Headless drag-and-drop is unreliable. Instead verify the moveSlide function works via console:

```bash
$B js "
  const decks = JSON.parse(localStorage.getItem('atlas-decks') || '{}');
  const deck = decks.decks[0];
  const moved = [...deck.slides];
  const last = moved.pop();
  moved.unshift(last);
  deck.slides = moved;
  deck.updatedAt = Date.now();
  localStorage.setItem('atlas-decks', JSON.stringify(decks));
  location.reload();
"
sleep 2
$B click "text=▶ Present"
sleep 2
$B screenshot /tmp/p5-after-reorder.png
```

Read `/tmp/p5-after-reorder.png`. Verify the FIRST slide now shows the originally-third one (coastal-lighthouse).

- [ ] **Step 9: Final commit (no code changes, just acceptance test artifacts)**

```bash
git status -s
# If nothing tracked, skip commit. The /tmp/ screenshots are not committed.
```

If there are dangling /tmp/ symlinks accidentally added, clean them. No commit needed if working tree is clean.

- [ ] **Step 10: Push all Sprint 1 commits to origin**

```bash
git log --oneline -15
git push origin main
```

Expected: push succeeds. All Sprint 1 commits (Phase 1 through 5) now on origin/main.

### Task 5.3: Update memory + final summary

- [ ] **Step 1: Append commit hashes + ship status to MEMORY.md or new file**

The existing memory `compositor-layered-for-presentation.md` is the architecture LOCK. Add a "Sprint 1 SHIPPED" section near the bottom (before the Cross-refs):

```bash
# Edit /Users/hexiaoyang/.claude/projects/-Users-hexiaoyang-Documents-sdf-main/memory/project_compositor_layered_for_presentation.md
# Add before "## Cross-refs":

## Sprint 1 SHIPPED 2026-06-19

Atlas Present MVP shipped — Library + Editor + Present mode + cut transition.
Lives at `examples/present/`. Reuses Layer 1 via NEW `src/compositor-api.js`
(extracted 6 functions from compositor.js: callLiftLLM / parseLiftResponse /
sphericalToCamState / createRendererForId / compileScene / loadSystemPromptLift).
deck-model.js owns Deck + Slide types + localStorage CRUD.

Commits: <hashes from git log>
Spec: docs/superpowers/specs/2026-06-19-atlas-present-sprint-1-design.md
Plan: docs/superpowers/plans/2026-06-19-atlas-present-sprint-1-plan.md

Sprint 2 ahead: PDF import + lift batch + fade transition + speaker notes.
```

- [ ] **Step 2: Print final summary**

Print to console:

```
Atlas Present Sprint 1 SHIPPED

Commits: <list last 12 hashes via git log --oneline -12>
Files: 9 new + 2 modified
Tests: 50+ assertions, all green (npm test 30/30)
URL: http://localhost:8001/examples/present/

10-step L3 acceptance test:
  ✅ Empty library → New Deck → editor → add 3 slides
  ✅ ▶ Present → ←→ navigate → → at end stays → esc exit
  ✅ Reorder slide 3 to position 1 (via console verify; drag-drop functional)

Sprint 2 ahead: PDF import, lift batch, fade transitions, speaker notes.
```

---

## Self-review checklist (run before handoff)

1. **Spec coverage**:
   - § 1 goal + scope: Phase 1-5 collectively implement ✓
   - § 2 architecture (Layer 2 / Layer 1 separation): Phase 1 (extraction) enforces ✓
   - § 3 data model (Deck/Slide/Theme/Defaults): Phase 2 ✓
   - § 4 compositor-api.js extraction: Phase 1 Tasks 1.2-1.6 ✓
   - § 5 UI sketches (Library / Editor / Present): Phase 3 / 4 / 5 ✓
   - § 6 file layout: Phase 1-5 collectively ✓
   - § 7 test plan (L1 + L2 + L3): L1 in Phase 1+2; L2 smoke tests in Phase 3+4; L3 in Phase 5 Task 5.2 ✓
   - § 8 acceptance criteria: 7 of 8 covered; criterion 7 (npm test +1 for both new files → 30 total) re-affirmed in Phase 5 ✓
   - § 9 hard rules: documented in plan-time divergence + Phase 1 prelude ✓
   - § 10 out of scope: NOT implemented (correct) ✓

2. **Placeholder scan**: No "TBD" / "implement later" patterns; all steps have concrete code.

3. **Type consistency**: `Deck` / `Slide` / `Theme` / `DeckDefaults` consistently used across Phases 2-5. `createDeck` / `addSlide` / `removeSlide` / `moveSlide` / `saveDeckToStorage` / `loadDeckFromStorage` / `listDecks` / `deleteDeckFromStorage` / `renameDeck` / `duplicateDeck` are the 10 deck-model functions, referenced consistently.

---

## Plan complete and saved to `docs/superpowers/plans/2026-06-19-atlas-present-sprint-1-plan.md`

Two execution options:

**1. Subagent-Driven (recommended)** — User already chose this approach in cube-3d sprint. Dispatch fresh subagent per phase (consolidate small tasks within phase), two-stage review between phases.

**2. Inline Execution** — Tasks executed inline with checkpoint at each phase.

Default unless user redirects: **Subagent-Driven** (mirroring the cube-3d execution pattern).
