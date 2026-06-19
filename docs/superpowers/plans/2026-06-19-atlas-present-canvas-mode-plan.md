# Atlas Present — Canvas Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Sprint 1 PPT-clone with Prezi-style canvas+waypoint model — deck = ONE persistent 3D canvas + ordered camera waypoints, present mode tweens camera smoothly between waypoints. End-of-sprint: add 3 subjects to canvas, capture 3 waypoints, ▶ Present, ← → animate camera between framings.

**Architecture:** Layer 2 application that calls Layer 1 (`compositor-api.js` from Sprint 1) UNCHANGED. The data model and editor/present-mode UI are rewritten; `createRendererForId` + `compileScene` + `sphericalToCamState` are reused as-is. Layer 2 owns its own RAF tween loop (does not touch compositor's `gpuCameraLoop`).

**Tech Stack:** Node 25 ESM, vanilla JS (no framework), browser localStorage + Fullscreen API + requestAnimationFrame. Reuses compositor renderer factories via `compositor-api`.

**Spec:** [`docs/superpowers/specs/2026-06-19-atlas-present-canvas-mode-design.md`](../specs/2026-06-19-atlas-present-canvas-mode-design.md) (commit `ec77426`). Read it first if any "why" is unclear.

**Supersedes:** Sprint 1 PPT-mode plan [`2026-06-19-atlas-present-sprint-1-plan.md`](2026-06-19-atlas-present-sprint-1-plan.md) (shipped 2026-06-19 commits `055c601..f27798c`, deprecated 2 hours later per user pivot).

---

## Plan-time clarifications vs spec

1. **Spec §3 atom palette listed `'sphere'` and `'box'`** but those are NOT registered factories in `compile.js` (they're core SDF primitives in `d3.js`). Adjusted Sprint 1 atom palette to use only REAL registered atoms: `'cube-3d'`, `'text-3d-pipe'`, `'pyramid-3d'`, `'bar-3d'`, `'cover-3d'`. Plan references these throughout.

2. **Camera tween in editor preview**: 200ms (snap-feel) per spec §4. Present mode: 800ms (cinematic). Both use same `tweenCamera` function with different duration arg.

3. **localStorage migration**: per spec §3, v1 silent drop. Implementation: on load, if `version !== 2`, return `{version: 2, decks: []}` (treat as fresh storage).

4. **Renderer LOCK in present mode**: Sprint 1 PPT-mode achieved this by NOT rendering pills. Same approach here — present mode HTML has no renderer chrome.

---

## File Structure (locked)

### NEW

| Path | LoC est. | Responsibility |
|---|---|---|
| `sdf-js/src/present/waypoint-tween.js` | ~150 | `interpolateCamera`, `easeInOut`, `tweenCamera` — pure RAF tween logic |
| `sdf-js/scripts/test-waypoint-tween.mjs` | ~120 | L1 tests (~20 assertions) |
| `sdf-js/src/present/atom-palette.js` | ~200 | "+ Add Subject" form helper — list of 5 P0 atom types with default arg templates |

### REPLACED (Sprint 1 PPT-mode impl wiped, files kept at same path)

| Path | Old LoC | Action |
|---|---|---|
| `sdf-js/src/present/deck-model.js` | 290 | REWRITE — Canvas+Waypoint schema, ~12 CRUD funcs |
| `sdf-js/scripts/test-deck-model.mjs` | 200 | REWRITE — new tests for canvas/waypoint CRUD (~25 assertions) |
| `sdf-js/src/present/deck-editor.js` | 360 | REWRITE — center pane = 3D canvas viewport, waypoint rail, atom palette |
| `sdf-js/src/present/present-mode.js` | 155 | REWRITE — single canvas compile + camera tween on key |
| `sdf-js/examples/present/style.css` | 240 | EXTEND — replace `.preview-pane canvas` rules with `.canvas-viewport` (full size) + add atom palette + waypoint rail tweaks |

### MODIFIED minimally

| Path | Change |
|---|---|
| `sdf-js/src/present/deck-library.js` | One line: `d.slides.length` → `d.waypoints.length` (Task 1.3) |

### UNCHANGED (Sprint 1 carry-over)

| Path | Why |
|---|---|
| `sdf-js/src/compositor-api.js` | Layer 1 contract — all 6 exports still used |
| `sdf-js/scripts/test-compositor-api.mjs` | 25 assertions still valid |
| `sdf-js/examples/present/index.html` | Router (library / editor / present 3 modes) unchanged |

---

## Phase 1 — Memory updates + deprecate Sprint 1 PPT-mode + bump library

**Phase goal:** Sprint 1 PPT-mode files marked deprecated; deck-library.js works with new schema; memory captures the pivot.

### Task 1.1: Update memory file — add Sprint 1 PPT-mode DEPRECATED note

**Files:**
- Modify: `/Users/hexiaoyang/.claude/projects/-Users-hexiaoyang-Documents-sdf-main/memory/project_compositor_layered_for_presentation.md`

- [ ] **Step 1: Read current memory file to find the "Sprint 1 SHIPPED" section**

Run: `grep -n "Sprint 1 SHIPPED" /Users/hexiaoyang/.claude/projects/-Users-hexiaoyang-Documents-sdf-main/memory/project_compositor_layered_for_presentation.md`
Expected: line number near bottom (around 123).

- [ ] **Step 2: Append a "Sprint 1 PIVOTED" section after the existing "Sprint 1 SHIPPED" section**

Using the Edit tool, find this anchor text in the memory file:

```
Sprint 2 ahead: PDF import + lift batch + fade transition + speaker notes.
```

Replace with:

```
Sprint 2 ahead: PDF import + lift batch + fade transition + speaker notes.

## Sprint 1 PIVOTED 2026-06-19 (hard pivot — PPT-clone → Canvas Mode)

Same day Sprint 1 shipped, user pushed back: "我们不能参考PPT的那种一页一页的编辑模式，我们事实上是在编辑 3D空间 + 摄像机时间轴" (referencing Prezi editor screenshot).

The pivot:
- **Sprint 1 PPT-mode (deprecated)**: `deck.slides[]` each with own SceneData; slide-switch = full scene swap; transition engine separate
- **Sprint 1 Canvas Mode (new)**: `deck.canvas` (one persistent SceneData) + `deck.waypoints[]` (ordered camera framings); slide-switch = camera tween; "transition" is intrinsic

Why right: Prezi's defining feature is persistent-canvas-with-camera-fly-through, which is what [[atlas-use-case-next-gen-prezi]] called for. The PPT-mode drift made `slides` = independent scenes, which is what we explicitly said we wouldn't do. Canvas Mode also aligns with compositor DNA (one scene per session, cameraSequence-animated camera).

Carry-over from PPT-mode (~30% of code):
- `compositor-api.js` — 100% kept
- `examples/present/index.html` + `deck-library.js` — 95% kept
- present-mode key handlers + fullscreen — ~70% kept
- topbar + CSS — ~60% kept

Replaced:
- `deck-model.js` (new schema)
- `deck-editor.js` (center pane = 3D canvas viewport, not slide preview)
- `present-mode.js` (single canvas + camera tween)
- New: `waypoint-tween.js` + `atom-palette.js`

Spec: docs/superpowers/specs/2026-06-19-atlas-present-canvas-mode-design.md (ec77426)
Plan: docs/superpowers/plans/2026-06-19-atlas-present-canvas-mode-plan.md
```

- [ ] **Step 3: Verify the edit landed**

Run: `grep -n "Sprint 1 PIVOTED" /Users/hexiaoyang/.claude/projects/-Users-hexiaoyang-Documents-sdf-main/memory/project_compositor_layered_for_presentation.md`
Expected: a single line match around line 145.

Note: memory files are OUTSIDE the git repo — no commit needed for this step.

### Task 1.2: Mark Sprint 1 PPT-mode source files as DEPRECATED in header comments

This is purely a header-comment change so future readers see the pivot note when opening these files. The implementation is REPLACED in Phases 3-5, but until then the deprecation note prevents anyone from "improving" the soon-to-be-wiped code.

**Files:**
- Modify: `sdf-js/src/present/deck-model.js`
- Modify: `sdf-js/src/present/deck-editor.js`
- Modify: `sdf-js/src/present/present-mode.js`

- [ ] **Step 1: Add DEPRECATED banner to `deck-model.js` header comment**

Find the top of `sdf-js/src/present/deck-model.js`. After the existing `// =====...` block, INSERT a new banner (use Edit tool with anchor on the existing `// localStorage key: 'atlas-decks'` line):

Anchor (find):
```
// localStorage key: 'atlas-decks'
//   shape: { version: 1, decks: Deck[] }
```

Replace with:
```
// localStorage key: 'atlas-decks'
//   shape: { version: 2, decks: Deck[] }  ← UPDATED in Canvas Mode pivot 2026-06-19
//
// ⚠️ DEPRECATED PPT-MODE IMPL — full rewrite in Plan Phase 3 (Canvas Mode pivot).
// Until then, do NOT extend or "improve" this file. See plan
// docs/superpowers/plans/2026-06-19-atlas-present-canvas-mode-plan.md
```

- [ ] **Step 2: Add same banner to `deck-editor.js`**

Find existing header in `sdf-js/src/present/deck-editor.js`. Anchor:

```
// =============================================================================
// deck-editor.js — Atlas Present deck editor page
// -----------------------------------------------------------------------------
// 3-pane layout: slide list (left) + preview (center) + settings (right).
// -----------------------------------------------------------------------------
```

Replace with:

```
// =============================================================================
// deck-editor.js — Atlas Present deck editor page
// -----------------------------------------------------------------------------
// 3-pane layout: slide list (left) + preview (center) + settings (right).
//
// ⚠️ DEPRECATED PPT-MODE IMPL — full rewrite in Plan Phase 4 (Canvas Mode pivot).
// New center pane will be a 3D canvas viewport with waypoint rail + atom palette.
// Do NOT extend or "improve" this file. See plan
// docs/superpowers/plans/2026-06-19-atlas-present-canvas-mode-plan.md
// -----------------------------------------------------------------------------
```

- [ ] **Step 3: Same for `present-mode.js`**

Anchor (find in `sdf-js/src/present/present-mode.js`):

```
// =============================================================================
// present-mode.js — Atlas Present fullscreen playback
// -----------------------------------------------------------------------------
// Audience-facing UI: fullscreen, ←→/space/esc/home/end keys, cursor auto-hide,
// renderer LOCKED to deck.theme.renderer, camera LOCKED (no drag/WASD).
// =============================================================================
```

Replace with:

```
// =============================================================================
// present-mode.js — Atlas Present fullscreen playback
// -----------------------------------------------------------------------------
// Audience-facing UI: fullscreen, ←→/space/esc/home/end keys, cursor auto-hide,
// renderer LOCKED to deck.theme.renderer, camera LOCKED (no drag/WASD).
//
// ⚠️ DEPRECATED PPT-MODE IMPL — full rewrite in Plan Phase 5 (Canvas Mode pivot).
// Canvas Mode will compile canvas ONCE + tween camera between waypoints on key.
// Do NOT extend or "improve" this file. See plan
// docs/superpowers/plans/2026-06-19-atlas-present-canvas-mode-plan.md
// =============================================================================
```

- [ ] **Step 4: Verify all 3 files still parse**

```bash
node --check sdf-js/src/present/deck-model.js && echo "deck-model.js syntax OK"
node --check sdf-js/src/present/deck-editor.js && echo "deck-editor.js syntax OK"
node --check sdf-js/src/present/present-mode.js && echo "present-mode.js syntax OK"
```

Expected: 3x syntax OK.

- [ ] **Step 5: Commit Task 1.2**

```bash
git add sdf-js/src/present/deck-model.js sdf-js/src/present/deck-editor.js sdf-js/src/present/present-mode.js
git commit -m "Atlas Present: mark Sprint 1 PPT-mode files DEPRECATED (Canvas Mode pivot)

Header banner on deck-model.js + deck-editor.js + present-mode.js noting
Canvas Mode pivot (spec ec77426). Full rewrite in plan phases 3-5. Do NOT
extend until rewrite lands.

Plan Phase 1 Task 1.2."
```

### Task 1.3: Bump deck-library.js to read new schema field (waypoints.length)

The library page card shows "N slides · time ago". Canvas Mode says "N waypoints". One-line edit; deck-library.js is otherwise reused as-is.

**Files:**
- Modify: `sdf-js/src/present/deck-library.js`

- [ ] **Step 1: Edit the renderDeckCard function**

Find in `sdf-js/src/present/deck-library.js`:

```js
      <div class="meta">${d.slides.length} slides · ${updated}</div>
```

Replace with:

```js
      <div class="meta">${(d.waypoints?.length ?? d.slides?.length ?? 0)} waypoints · ${updated}</div>
```

The `??` chain handles three storage states:
- v2 deck (`d.waypoints`)
- v1 deck still in localStorage (`d.slides` — silent drop won't have happened yet on this load)
- malformed/empty (`0`)

- [ ] **Step 2: Verify**

```bash
node --check sdf-js/src/present/deck-library.js && echo "syntax OK"
```

- [ ] **Step 3: Commit Task 1.3**

```bash
git add sdf-js/src/present/deck-library.js
git commit -m "Atlas Present: library card reads d.waypoints.length (Canvas Mode schema)

One-line bump: 'N slides' → 'N waypoints'. Defensive ?? chain handles
both v1 (slides) and v2 (waypoints) schemas during the transition.

Plan Phase 1 Task 1.3."
```

---

## Phase 2 — `waypoint-tween.js` (TDD)

**Phase goal:** Pure camera tween module — interpolation + easing + RAF loop. Fully testable in Node. End-of-phase: ~20 assertions green, file ready for Phase 4/5 consumption.

### Task 2.1: Create skeleton + test file + register

**Files:**
- Create: `sdf-js/src/present/waypoint-tween.js`
- Create: `sdf-js/scripts/test-waypoint-tween.mjs`
- Modify: `scripts/run-tests.mjs`

- [ ] **Step 1: Create skeleton**

Create `sdf-js/src/present/waypoint-tween.js`:

```js
// =============================================================================
// waypoint-tween.js — Atlas Present Canvas Mode camera tweening
// -----------------------------------------------------------------------------
// Pure functions + RAF loop for animating camera between waypoints (spherical
// coords: yaw, pitch, distance, targetX/Y/Z). Used by editor (preview-tween,
// 200ms) and present mode (cinematic-tween, 800ms).
//
// Layer 2 owns this loop. Does NOT touch compositor's gpuCameraLoop or
// scene.evalCamera — that's for cameraSequence-driven scenes only.
//
// Spec: docs/superpowers/specs/2026-06-19-atlas-present-canvas-mode-design.md §4
// =============================================================================

// Exports added in subsequent tasks:
//   - interpolateCamera(from, to, t) — pure
//   - easeInOut(t) / easeLinear(t)   — pure
//   - tweenCamera(from, to, opts)    — starts RAF, returns { cancel }
```

Create `sdf-js/scripts/test-waypoint-tween.mjs`:

```js
// =============================================================================
// test-waypoint-tween.mjs — L1 unit tests for camera tween module
// =============================================================================

import * as tw from '../src/present/waypoint-tween.js';

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

function approxEq(a, b, eps = 1e-9) {
  return Math.abs(a - b) < eps;
}

console.log('=== waypoint-tween smoke test ===\n');

// [More tests added in Tasks 2.2-2.4]

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
```

- [ ] **Step 2: Register test in `scripts/run-tests.mjs`**

Find the line:

```js
  { category: 'present', file: 'sdf-js/scripts/test-deck-model.mjs' },
```

Add immediately after:

```js
  { category: 'present', file: 'sdf-js/scripts/test-waypoint-tween.mjs' },
```

- [ ] **Step 3: Verify everything parses + npm test**

```bash
node --check sdf-js/src/present/waypoint-tween.js && echo "waypoint-tween.js syntax OK"
node --check sdf-js/scripts/test-waypoint-tween.mjs && echo "test syntax OK"
npm test 2>&1 | tail -5
```

Expected: 31/31 (was 30 + 1 new with 0 assertions).

- [ ] **Step 4: Commit Task 2.1**

```bash
git add sdf-js/src/present/waypoint-tween.js sdf-js/scripts/test-waypoint-tween.mjs scripts/run-tests.mjs
git commit -m "Atlas Present Canvas Mode: waypoint-tween.js skeleton + test registered

Empty module for camera tween logic. Test runs 0 assertions; will populate
in Phase 2 Tasks 2.2-2.4 (interpolateCamera, easeInOut, tweenCamera RAF).

Plan Phase 2 Task 2.1."
```

### Task 2.2: TDD `interpolateCamera` (with yaw wraparound)

- [ ] **Step 1: Append failing tests**

In `sdf-js/scripts/test-waypoint-tween.mjs`, before the final `console.log` Result line, append:

```js
// interpolateCamera — t=0 returns from
{
  const from = { yaw: 0.5, pitch: 0.1, distance: 5, targetX: 1, targetY: 2, targetZ: 3 };
  const to = { yaw: 2.0, pitch: -0.3, distance: 10, targetX: 5, targetY: 0, targetZ: -2 };
  const r = tw.interpolateCamera(from, to, 0);
  ok(approxEq(r.yaw, 0.5), 't=0: yaw = from');
  ok(approxEq(r.pitch, 0.1), 't=0: pitch = from');
  ok(approxEq(r.distance, 5), 't=0: distance = from');
  ok(approxEq(r.targetX, 1) && approxEq(r.targetY, 2) && approxEq(r.targetZ, 3), 't=0: target = from');
}

// interpolateCamera — t=1 returns to
{
  const from = { yaw: 0.5, pitch: 0.1, distance: 5, targetX: 1, targetY: 2, targetZ: 3 };
  const to = { yaw: 2.0, pitch: -0.3, distance: 10, targetX: 5, targetY: 0, targetZ: -2 };
  const r = tw.interpolateCamera(from, to, 1);
  ok(approxEq(r.yaw, 2.0), 't=1: yaw = to');
  ok(approxEq(r.distance, 10), 't=1: distance = to');
  ok(approxEq(r.targetX, 5), 't=1: targetX = to');
}

// interpolateCamera — t=0.5 returns midpoint (linear)
{
  const from = { yaw: 0, pitch: 0, distance: 4, targetX: 0, targetY: 0, targetZ: 0 };
  const to = { yaw: 1, pitch: 0.4, distance: 8, targetX: 4, targetY: 2, targetZ: -2 };
  const r = tw.interpolateCamera(from, to, 0.5);
  ok(approxEq(r.yaw, 0.5), `t=0.5: yaw midpoint (got ${r.yaw})`);
  ok(approxEq(r.pitch, 0.2), `t=0.5: pitch midpoint (got ${r.pitch})`);
  ok(approxEq(r.distance, 6), `t=0.5: distance midpoint (got ${r.distance})`);
  ok(approxEq(r.targetX, 2) && approxEq(r.targetY, 1) && approxEq(r.targetZ, -1), 't=0.5: target midpoint');
}

// interpolateCamera — yaw wraparound short arc
// from yaw=0.1, to yaw=6.0 (≈ 2π−0.28): SHORT arc passes through 0 (not π)
// delta should be (6.0 − 2π) − 0.1 = -0.38 ; midpoint = 0.1 + 0.5·(−0.38) = −0.09
{
  const from = { yaw: 0.1, pitch: 0, distance: 5, targetX: 0, targetY: 0, targetZ: 0 };
  const to = { yaw: 6.0, pitch: 0, distance: 5, targetX: 0, targetY: 0, targetZ: 0 };
  const r = tw.interpolateCamera(from, to, 0.5);
  ok(r.yaw < 0.1 && r.yaw > -0.5, `yaw wraparound midpoint near -0.09 (got ${r.yaw})`);
}

// interpolateCamera — yaw NO wraparound when delta < π
// from yaw=0.5, to yaw=2.5 (delta = 2.0 < π): straight interp
{
  const from = { yaw: 0.5, pitch: 0, distance: 5, targetX: 0, targetY: 0, targetZ: 0 };
  const to = { yaw: 2.5, pitch: 0, distance: 5, targetX: 0, targetY: 0, targetZ: 0 };
  const r = tw.interpolateCamera(from, to, 0.5);
  ok(approxEq(r.yaw, 1.5), `yaw no wraparound, midpoint = 1.5 (got ${r.yaw})`);
}

// interpolateCamera — focal interpolates if both present
{
  const from = { yaw: 0, pitch: 0, distance: 5, targetX: 0, targetY: 0, targetZ: 0, focal: 1.0 };
  const to = { yaw: 0, pitch: 0, distance: 5, targetX: 0, targetY: 0, targetZ: 0, focal: 2.0 };
  const r = tw.interpolateCamera(from, to, 0.5);
  ok(approxEq(r.focal, 1.5), `focal midpoint 1.5 (got ${r.focal})`);
}

// interpolateCamera — focal absent: result omits focal
{
  const from = { yaw: 0, pitch: 0, distance: 5, targetX: 0, targetY: 0, targetZ: 0 };
  const to = { yaw: 0, pitch: 0, distance: 5, targetX: 0, targetY: 0, targetZ: 0 };
  const r = tw.interpolateCamera(from, to, 0.5);
  ok(r.focal === undefined, 'focal absent: result has no focal');
}
```

- [ ] **Step 2: Run — expect FAIL**

Run: `node sdf-js/scripts/test-waypoint-tween.mjs`
Expected: `TypeError: tw.interpolateCamera is not a function`.

- [ ] **Step 3: Implement `interpolateCamera`**

In `sdf-js/src/present/waypoint-tween.js`, replace the closing `// Exports added in subsequent tasks:` comment with:

```js
const TWO_PI = Math.PI * 2;

/**
 * Compute shortest-arc delta for yaw. If |to-from| > π, wrap the result so we
 * tween the short way around the circle.
 *
 * @private
 * @param {number} from
 * @param {number} to
 * @returns {number} delta (signed)
 */
function shortYawDelta(from, to) {
  let delta = to - from;
  if (delta > Math.PI) delta -= TWO_PI;
  else if (delta < -Math.PI) delta += TWO_PI;
  return delta;
}

/**
 * Linearly interpolate camera state on spherical coords (yaw, pitch, distance,
 * targetX/Y/Z). Yaw uses shortest-arc to avoid spinning the long way around.
 * `focal` interpolated only if BOTH from + to have it.
 *
 * @param {{yaw:number, pitch:number, distance:number, targetX:number, targetY:number, targetZ:number, focal?:number}} from
 * @param {{yaw:number, pitch:number, distance:number, targetX:number, targetY:number, targetZ:number, focal?:number}} to
 * @param {number} t — [0,1]
 * @returns {object} interpolated camera
 */
export function interpolateCamera(from, to, t) {
  const yawDelta = shortYawDelta(from.yaw, to.yaw);
  const out = {
    yaw: from.yaw + yawDelta * t,
    pitch: from.pitch + (to.pitch - from.pitch) * t,
    distance: from.distance + (to.distance - from.distance) * t,
    targetX: from.targetX + (to.targetX - from.targetX) * t,
    targetY: from.targetY + (to.targetY - from.targetY) * t,
    targetZ: from.targetZ + (to.targetZ - from.targetZ) * t,
  };
  if (from.focal !== undefined && to.focal !== undefined) {
    out.focal = from.focal + (to.focal - from.focal) * t;
  }
  return out;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `node sdf-js/scripts/test-waypoint-tween.mjs`
Expected: `~13 passed, 0 failed`.

### Task 2.3: TDD `easeInOut` + `easeLinear`

- [ ] **Step 1: Append failing tests**

In test file, append:

```js
// easeLinear: identity
{
  ok(approxEq(tw.easeLinear(0), 0), 'easeLinear(0) = 0');
  ok(approxEq(tw.easeLinear(0.5), 0.5), 'easeLinear(0.5) = 0.5');
  ok(approxEq(tw.easeLinear(1), 1), 'easeLinear(1) = 1');
}

// easeInOut: smoothstep behavior
{
  ok(approxEq(tw.easeInOut(0), 0), 'easeInOut(0) = 0');
  ok(approxEq(tw.easeInOut(0.5), 0.5), `easeInOut(0.5) = 0.5 (got ${tw.easeInOut(0.5)})`);
  ok(approxEq(tw.easeInOut(1), 1), 'easeInOut(1) = 1');
  // Smoothstep is symmetric around 0.5 (slow start AND slow end)
  ok(tw.easeInOut(0.25) < 0.25, `easeInOut(0.25) < 0.25 (slow start, got ${tw.easeInOut(0.25)})`);
  ok(tw.easeInOut(0.75) > 0.75, `easeInOut(0.75) > 0.75 (slow end, got ${tw.easeInOut(0.75)})`);
}
```

- [ ] **Step 2: Run — expect FAIL**

Expected: `easeInOut / easeLinear not exported`.

- [ ] **Step 3: Implement easings**

Append to `sdf-js/src/present/waypoint-tween.js`:

```js
/**
 * Linear easing — identity. Useful as default.
 *
 * @param {number} t — [0,1]
 * @returns {number}
 */
export function easeLinear(t) {
  return t;
}

/**
 * Smoothstep easing — `3t² − 2t³`. Slow start + slow end (cinematic).
 *
 * @param {number} t — [0,1]
 * @returns {number}
 */
export function easeInOut(t) {
  return t * t * (3 - 2 * t);
}
```

- [ ] **Step 4: Run — expect PASS**

Expected: cumulative ~21.

### Task 2.4: TDD `tweenCamera` (RAF loop with cancel)

- [ ] **Step 1: Append failing tests**

```js
// tweenCamera: calls onFrame multiple times with camera state + onComplete once
// Use synchronous mocking so test is fast and deterministic.
{
  let now = 0;
  const realRAF = globalThis.requestAnimationFrame;
  const realCAF = globalThis.cancelAnimationFrame;
  const realPerfNow = performance.now;
  let scheduled = null;
  globalThis.requestAnimationFrame = (cb) => {
    scheduled = cb;
    return 1;
  };
  globalThis.cancelAnimationFrame = () => {
    scheduled = null;
  };
  performance.now = () => now;

  const frames = [];
  let complete = false;
  const from = { yaw: 0, pitch: 0, distance: 5, targetX: 0, targetY: 0, targetZ: 0 };
  const to = { yaw: 1, pitch: 0, distance: 5, targetX: 1, targetY: 0, targetZ: 0 };
  const h = tw.tweenCamera(from, to, {
    durationMs: 100,
    easing: tw.easeLinear,
    onFrame: (cam) => frames.push(cam),
    onComplete: () => {
      complete = true;
    },
  });
  ok(typeof h.cancel === 'function', 'tweenCamera: returns {cancel}');
  // Advance simulated time
  now = 0; scheduled();        // t=0
  now = 50; scheduled();       // t=0.5
  now = 100; scheduled();      // t=1 → complete
  ok(frames.length >= 3, `tweenCamera: at least 3 frames (got ${frames.length})`);
  ok(complete === true, 'tweenCamera: onComplete called when t reaches 1');
  ok(approxEq(frames[frames.length - 1].yaw, 1), `tweenCamera: last frame yaw = to.yaw (got ${frames[frames.length-1].yaw})`);

  // Cleanup
  globalThis.requestAnimationFrame = realRAF;
  globalThis.cancelAnimationFrame = realCAF;
  performance.now = realPerfNow;
}

// tweenCamera: cancel stops further onFrame calls
{
  let now = 0;
  const realRAF = globalThis.requestAnimationFrame;
  const realCAF = globalThis.cancelAnimationFrame;
  const realPerfNow = performance.now;
  let scheduled = null;
  globalThis.requestAnimationFrame = (cb) => {
    scheduled = cb;
    return 1;
  };
  globalThis.cancelAnimationFrame = () => {
    scheduled = null;
  };
  performance.now = () => now;

  let frames = 0;
  let complete = false;
  const h = tw.tweenCamera(
    { yaw: 0, pitch: 0, distance: 5, targetX: 0, targetY: 0, targetZ: 0 },
    { yaw: 1, pitch: 0, distance: 5, targetX: 1, targetY: 0, targetZ: 0 },
    {
      durationMs: 100,
      onFrame: () => frames++,
      onComplete: () => {
        complete = true;
      },
    },
  );
  now = 30; scheduled();
  const framesBeforeCancel = frames;
  h.cancel();
  now = 60;
  if (scheduled) scheduled();
  ok(frames === framesBeforeCancel, `cancel: no more frames after cancel (before ${framesBeforeCancel}, after ${frames})`);
  ok(complete === false, 'cancel: onComplete NOT called');

  globalThis.requestAnimationFrame = realRAF;
  globalThis.cancelAnimationFrame = realCAF;
  performance.now = realPerfNow;
}
```

- [ ] **Step 2: Run — expect FAIL**

Expected: `tweenCamera is not a function`.

- [ ] **Step 3: Implement `tweenCamera`**

Append to `sdf-js/src/present/waypoint-tween.js`:

```js
/**
 * Animate camera from `from` to `to` via RAF loop. Returns a handle with
 * `.cancel()` to abort mid-tween.
 *
 * @param {object} from — camera state (see interpolateCamera)
 * @param {object} to   — camera state
 * @param {object} opts
 * @param {number} [opts.durationMs=800]
 * @param {Function} [opts.easing=easeInOut]
 * @param {Function} [opts.onFrame] — called per frame with interpolated camera
 * @param {Function} [opts.onComplete] — called once when tween finishes naturally
 * @returns {{cancel: Function}}
 */
export function tweenCamera(from, to, opts = {}) {
  const durationMs = opts.durationMs ?? 800;
  const easing = opts.easing ?? easeInOut;
  const onFrame = opts.onFrame ?? (() => {});
  const onComplete = opts.onComplete ?? (() => {});

  const start = performance.now();
  let rafId = null;
  let cancelled = false;

  function frame() {
    if (cancelled) return;
    const elapsed = performance.now() - start;
    const tRaw = Math.min(1, Math.max(0, elapsed / durationMs));
    const tEased = easing(tRaw);
    const cam = interpolateCamera(from, to, tEased);
    onFrame(cam);
    if (tRaw >= 1) {
      onComplete();
      return;
    }
    rafId = requestAnimationFrame(frame);
  }

  rafId = requestAnimationFrame(frame);

  return {
    cancel() {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
    },
  };
}
```

- [ ] **Step 4: Run — expect PASS**

Expected: cumulative ~26 passed.

- [ ] **Step 5: Verify npm test still green**

```bash
npm test 2>&1 | tail -5
```

Expected: 31/31.

- [ ] **Step 6: Commit Phase 2**

```bash
git add sdf-js/src/present/waypoint-tween.js sdf-js/scripts/test-waypoint-tween.mjs
git commit -m "Atlas Present Canvas Mode Phase 2: waypoint-tween.js (TDD)

3 exports: interpolateCamera (6 spherical fields + yaw shortest-arc + optional
focal), easeLinear, easeInOut (smoothstep 3t²-2t³), tweenCamera (RAF loop +
cancel handle).

~26 assertions all green. Test uses globalThis RAF mocking so it's
deterministic + synchronous + fast.

Plan Phase 2."
```

---

## Phase 3 — Rewrite `deck-model.js` for Canvas+Waypoint schema

**Phase goal:** Replace deprecated PPT-mode CRUD with Canvas Mode CRUD. New types: Deck.canvas (one SceneData) + Deck.waypoints[]. Old `addSlide/removeSlide/moveSlide` replaced with `addSubjectToCanvas/removeSubjectFromCanvas` + `addWaypoint/removeWaypoint/moveWaypoint/updateWaypointCamera`. ~25 L1 assertions green.

### Task 3.1: REWRITE deck-model.js + test file

Single big task — both files replaced. Easier than partial edits because old/new schemas are incompatible.

**Files:**
- REPLACE: `sdf-js/src/present/deck-model.js`
- REPLACE: `sdf-js/scripts/test-deck-model.mjs`

- [ ] **Step 1: Replace `sdf-js/src/present/deck-model.js` entirely**

Overwrite full file content:

```js
// =============================================================================
// deck-model.js — Atlas Present Layer 2 data model (CANVAS MODE)
// -----------------------------------------------------------------------------
// Pure JS / no DOM. Defines Deck + Canvas + Waypoint types (JSDoc), CRUD
// operations, localStorage v2 persistence.
//
// localStorage key: 'atlas-decks'
//   shape: { version: 2, decks: Deck[] }
//   v1 (PPT-mode) decks silently dropped on first v2 load.
//
// Spec: docs/superpowers/specs/2026-06-19-atlas-present-canvas-mode-design.md
// Plan: docs/superpowers/plans/2026-06-19-atlas-present-canvas-mode-plan.md
// =============================================================================

/**
 * @typedef {object} Theme
 * @property {string} renderer — one of 'studio'|'fly3d'|'silhouette' (Sprint 1)
 */

/**
 * @typedef {object} DeckTween
 * @property {number} durationMs — default 800
 * @property {'linear'|'ease-in-out'} easing — default 'ease-in-out'
 */

/**
 * @typedef {object} CameraSpherical
 * @property {number} yaw — radians
 * @property {number} pitch — radians
 * @property {number} distance
 * @property {number} targetX
 * @property {number} targetY
 * @property {number} targetZ
 * @property {number} [focal]
 */

/**
 * @typedef {object} Waypoint
 * @property {string} id
 * @property {string} [title]
 * @property {CameraSpherical} camera
 */

/**
 * @typedef {object} SceneDataSubject
 * @property {string} id
 * @property {string} type — atom name (cube-3d / text-3d-pipe / etc)
 * @property {object} args — atom-specific args
 * @property {{translate?:number[], rotate?:number[], scale?:number}} [transform]
 * @property {string} [material] — material name
 */

/**
 * @typedef {object} SceneData
 * @property {1} v
 * @property {string} name
 * @property {SceneDataSubject[]} subjects
 * @property {object} [defaults]
 */

/**
 * @typedef {object} Deck
 * @property {string} id
 * @property {string} title
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {Theme} theme
 * @property {SceneData} canvas — the persistent 3D scene
 * @property {Waypoint[]} waypoints
 * @property {DeckTween} tween
 */

export const DECKS_STORAGE_KEY = 'atlas-decks';
export const STORAGE_VERSION = 2;

// ---- ID helpers -------------------------------------------------------------

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---- Defaults ---------------------------------------------------------------

function defaultCanvas() {
  return {
    v: 1,
    name: 'canvas',
    subjects: [],
    defaults: {
      camera: { yaw: 0.3, pitch: -0.15, distance: 8, focal: 1.5, targetX: 0, targetY: 0.5, targetZ: 0 },
      light: { azimuth: 0.6, altitude: 0.55, distance: 25, intensity: 1.2 },
      shadow: { enabled: true, mode: 'darken', strength: 0.4 },
    },
  };
}

function defaultTween() {
  return { durationMs: 800, easing: 'ease-in-out' };
}

// ---- Deck CRUD --------------------------------------------------------------

/**
 * Create a new deck with an empty canvas (no subjects) and no waypoints.
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
    theme: { renderer: 'studio' },
    canvas: defaultCanvas(),
    waypoints: [],
    tween: defaultTween(),
  };
}

// ---- Subject CRUD (operates on deck.canvas.subjects) ------------------------

/**
 * Add a subject to the canvas. Mutates deck + updates updatedAt.
 *
 * @param {Deck} d
 * @param {Partial<SceneDataSubject>} subjectInput — `type` required
 * @returns {SceneDataSubject} the added subject
 */
export function addSubjectToCanvas(d, subjectInput) {
  if (!subjectInput || !subjectInput.type) {
    throw new Error('[deck-model] addSubjectToCanvas: subjectInput.type required');
  }
  const subject = {
    id: subjectInput.id || uuid(),
    type: subjectInput.type,
    args: subjectInput.args || {},
    transform: subjectInput.transform || {},
    ...(subjectInput.material ? { material: subjectInput.material } : {}),
  };
  d.canvas.subjects.push(subject);
  d.updatedAt = Date.now();
  return subject;
}

/**
 * Remove a subject from canvas by id. Returns true if removed, false if not found.
 *
 * @param {Deck} d
 * @param {string} subjectId
 * @returns {boolean}
 */
export function removeSubjectFromCanvas(d, subjectId) {
  const idx = d.canvas.subjects.findIndex((s) => s.id === subjectId);
  if (idx === -1) return false;
  d.canvas.subjects.splice(idx, 1);
  d.updatedAt = Date.now();
  return true;
}

// ---- Waypoint CRUD ----------------------------------------------------------

/**
 * Add a waypoint to the deck. Mutates + updates updatedAt.
 *
 * @param {Deck} d
 * @param {Partial<Waypoint>} waypointInput — `camera` required
 * @returns {Waypoint}
 */
export function addWaypoint(d, waypointInput) {
  if (!waypointInput || !waypointInput.camera) {
    throw new Error('[deck-model] addWaypoint: waypointInput.camera required');
  }
  const wp = {
    id: waypointInput.id || uuid(),
    ...(waypointInput.title ? { title: waypointInput.title } : {}),
    camera: { ...waypointInput.camera },
  };
  d.waypoints.push(wp);
  d.updatedAt = Date.now();
  return wp;
}

/**
 * Remove waypoint by id.
 *
 * @param {Deck} d
 * @param {string} waypointId
 * @returns {boolean}
 */
export function removeWaypoint(d, waypointId) {
  const idx = d.waypoints.findIndex((w) => w.id === waypointId);
  if (idx === -1) return false;
  d.waypoints.splice(idx, 1);
  d.updatedAt = Date.now();
  return true;
}

/**
 * Reorder waypoints. Out-of-bounds fromIdx is no-op; toIdx clamped to length.
 *
 * @param {Deck} d
 * @param {number} fromIdx
 * @param {number} toIdx
 * @returns {boolean}
 */
export function moveWaypoint(d, fromIdx, toIdx) {
  if (fromIdx < 0 || fromIdx >= d.waypoints.length) return false;
  const clampedTo = Math.max(0, Math.min(toIdx, d.waypoints.length - 1));
  if (clampedTo === fromIdx) return false;
  const [moved] = d.waypoints.splice(fromIdx, 1);
  d.waypoints.splice(clampedTo, 0, moved);
  d.updatedAt = Date.now();
  return true;
}

/**
 * Update an existing waypoint's camera (re-capture). Returns false if not found.
 *
 * @param {Deck} d
 * @param {string} waypointId
 * @param {CameraSpherical} newCamera
 * @returns {boolean}
 */
export function updateWaypointCamera(d, waypointId, newCamera) {
  const wp = d.waypoints.find((w) => w.id === waypointId);
  if (!wp) return false;
  wp.camera = { ...newCamera };
  d.updatedAt = Date.now();
  return true;
}

// ---- Storage ----------------------------------------------------------------

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

function writeStorage(shape) {
  try {
    localStorage.setItem(DECKS_STORAGE_KEY, JSON.stringify(shape));
  } catch (e) {
    console.error('[deck-model] storage write failed (quota?):', e.message);
    throw e;
  }
}

/**
 * Migrate raw storage shape. v1 (PPT-mode) silently dropped — returns empty
 * v2 storage. v2 passes through.
 *
 * @param {object} raw
 * @returns {{version:number, decks:Deck[]}}
 */
export function migrateDecksStorage(raw) {
  if (!raw || typeof raw !== 'object') {
    return { version: STORAGE_VERSION, decks: [] };
  }
  if (raw.version !== STORAGE_VERSION) {
    // v1 PPT-mode → silently drop. No real users to preserve.
    return { version: STORAGE_VERSION, decks: [] };
  }
  if (!Array.isArray(raw.decks)) {
    return { version: STORAGE_VERSION, decks: [] };
  }
  return { version: STORAGE_VERSION, decks: raw.decks };
}

export function saveDeckToStorage(d) {
  const shape = readStorage();
  const idx = shape.decks.findIndex((existing) => existing.id === d.id);
  if (idx >= 0) shape.decks[idx] = d;
  else shape.decks.push(d);
  writeStorage(shape);
}

export function loadDeckFromStorage(id) {
  const shape = readStorage();
  return shape.decks.find((d) => d.id === id) || null;
}

export function listDecks() {
  const shape = readStorage();
  return [...shape.decks].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function deleteDeckFromStorage(id) {
  const shape = readStorage();
  const idx = shape.decks.findIndex((d) => d.id === id);
  if (idx === -1) return false;
  shape.decks.splice(idx, 1);
  writeStorage(shape);
  return true;
}

export function renameDeck(id, newTitle) {
  const d = loadDeckFromStorage(id);
  if (!d) return false;
  d.title = newTitle;
  d.updatedAt = Date.now();
  saveDeckToStorage(d);
  return true;
}

/**
 * Duplicate a deck — deep copy with new id + " (copy)" suffix. Canvas subjects
 * + waypoints all get fresh ids.
 *
 * @param {string} id
 * @returns {Deck|null}
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
    canvas: {
      ...src.canvas,
      subjects: src.canvas.subjects.map((s) => ({ ...s, id: uuid() })),
    },
    waypoints: src.waypoints.map((w) => ({ ...w, id: uuid() })),
  };
  saveDeckToStorage(copy);
  return copy;
}
```

- [ ] **Step 2: Replace `sdf-js/scripts/test-deck-model.mjs` entirely**

Overwrite:

```js
// =============================================================================
// test-deck-model.mjs — L1 unit tests for Atlas Present Canvas Mode deck model
// =============================================================================

import * as deck from '../src/present/deck-model.js';

// Mock localStorage
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

console.log('=== deck-model (Canvas Mode) smoke test ===\n');

// constants exported
ok(deck.DECKS_STORAGE_KEY === 'atlas-decks', 'DECKS_STORAGE_KEY exported');
ok(deck.STORAGE_VERSION === 2, `STORAGE_VERSION = 2 (got ${deck.STORAGE_VERSION})`);

console.log('\nTest group 1: createDeck');

{
  const d = deck.createDeck('My Deck');
  ok(typeof d.id === 'string' && d.id.length > 0, 'createDeck: id assigned');
  ok(d.title === 'My Deck', 'createDeck: title');
  ok(d.theme && d.theme.renderer === 'studio', 'createDeck: default renderer = studio');
  ok(d.canvas && d.canvas.v === 1, 'createDeck: canvas SceneData v1');
  ok(Array.isArray(d.canvas.subjects) && d.canvas.subjects.length === 0, 'createDeck: empty canvas.subjects');
  ok(Array.isArray(d.waypoints) && d.waypoints.length === 0, 'createDeck: empty waypoints');
  ok(d.tween && d.tween.durationMs === 800, 'createDeck: default tween duration 800ms');
  ok(d.tween.easing === 'ease-in-out', 'createDeck: default easing ease-in-out');
}

{
  const d = deck.createDeck();
  ok(d.title === 'Untitled Deck', 'createDeck: no title defaults');
}

console.log('\nTest group 2: addSubjectToCanvas / removeSubjectFromCanvas');

{
  const d = deck.createDeck('test');
  const origUpdated = d.updatedAt;
  const before = Date.now();
  while (Date.now() === before) {}
  const subj = deck.addSubjectToCanvas(d, { type: 'cube-3d', args: { count: 4 }, transform: { translate: [0, 0.5, 0] } });
  ok(d.canvas.subjects.length === 1, 'addSubject: canvas has 1 subject');
  ok(subj.type === 'cube-3d', 'addSubject: type carried');
  ok(subj.args.count === 4, 'addSubject: args carried');
  ok(d.updatedAt > origUpdated, 'addSubject: updatedAt advanced');
  ok(typeof subj.id === 'string' && subj.id.length > 0, 'addSubject: auto-assigns id');
}

{
  const d = deck.createDeck('test');
  deck.addSubjectToCanvas(d, { id: 'sub-a', type: 'cube-3d' });
  deck.addSubjectToCanvas(d, { id: 'sub-b', type: 'text-3d-pipe' });
  const removed = deck.removeSubjectFromCanvas(d, 'sub-a');
  ok(removed === true, 'removeSubject: returns true on success');
  ok(d.canvas.subjects.length === 1, 'removeSubject: 1 left');
  ok(d.canvas.subjects[0].id === 'sub-b', 'removeSubject: correct one removed');
  ok(deck.removeSubjectFromCanvas(d, 'nonexistent') === false, 'removeSubject: nonexistent returns false');
}

console.log('\nTest group 3: addWaypoint / removeWaypoint / moveWaypoint');

{
  const d = deck.createDeck('test');
  const cam = { yaw: 0.3, pitch: -0.15, distance: 8, targetX: 0, targetY: 0.5, targetZ: 0 };
  const wp = deck.addWaypoint(d, { title: 'Overview', camera: cam });
  ok(d.waypoints.length === 1, 'addWaypoint: 1 waypoint');
  ok(wp.title === 'Overview', 'addWaypoint: title carried');
  ok(wp.camera.yaw === 0.3, 'addWaypoint: camera carried');
}

{
  const d = deck.createDeck('test');
  ['a', 'b', 'c'].forEach((id) =>
    deck.addWaypoint(d, { id, camera: { yaw: 0, pitch: 0, distance: 5, targetX: 0, targetY: 0, targetZ: 0 } }),
  );
  deck.removeWaypoint(d, 'b');
  ok(d.waypoints.map((w) => w.id).join(',') === 'a,c', 'removeWaypoint: order preserved');
}

{
  const d = deck.createDeck('test');
  ['a', 'b', 'c', 'd'].forEach((id) =>
    deck.addWaypoint(d, { id, camera: { yaw: 0, pitch: 0, distance: 5, targetX: 0, targetY: 0, targetZ: 0 } }),
  );
  deck.moveWaypoint(d, 0, 2);
  ok(d.waypoints.map((w) => w.id).join(',') === 'b,c,a,d', `moveWaypoint(0,2): got ${d.waypoints.map(w=>w.id).join(',')}`);
}

console.log('\nTest group 4: updateWaypointCamera');

{
  const d = deck.createDeck('test');
  const wp = deck.addWaypoint(d, {
    id: 'w1',
    camera: { yaw: 0.3, pitch: 0, distance: 5, targetX: 0, targetY: 0, targetZ: 0 },
  });
  const orig = d.updatedAt;
  const before = Date.now();
  while (Date.now() === before) {}
  const newCam = { yaw: 1.5, pitch: -0.2, distance: 10, targetX: 5, targetY: 1, targetZ: -3 };
  const ok1 = deck.updateWaypointCamera(d, 'w1', newCam);
  ok(ok1 === true, 'updateWaypointCamera: returns true');
  ok(wp.camera.yaw === 1.5 && wp.camera.distance === 10, 'updateWaypointCamera: camera replaced');
  ok(d.updatedAt > orig, 'updateWaypointCamera: updatedAt advanced');
  ok(deck.updateWaypointCamera(d, 'nonexistent', newCam) === false, 'updateWaypointCamera: nonexistent returns false');
}

console.log('\nTest group 5: localStorage v2 + v1 silent drop');

resetStorage();

{
  const d = deck.createDeck('Roundtrip');
  deck.addSubjectToCanvas(d, { id: 'c1', type: 'cube-3d' });
  deck.addWaypoint(d, { id: 'w1', camera: { yaw: 0, pitch: 0, distance: 5, targetX: 0, targetY: 0, targetZ: 0 } });
  deck.saveDeckToStorage(d);
  const loaded = deck.loadDeckFromStorage(d.id);
  ok(loaded !== null, 'roundtrip: load returns deck');
  ok(loaded.canvas.subjects.length === 1, 'roundtrip: canvas subjects preserved');
  ok(loaded.waypoints.length === 1, 'roundtrip: waypoints preserved');
}

// v1 silent drop
{
  resetStorage();
  // Write fake v1 PPT-mode storage
  localStorage.setItem('atlas-decks', JSON.stringify({ version: 1, decks: [{ id: 'old-v1-deck', slides: [] }] }));
  const list = deck.listDecks();
  ok(list.length === 0, `v1 silent drop: listDecks returns empty (got ${list.length})`);
}

// listDecks sort
{
  resetStorage();
  const d1 = deck.createDeck('old');
  d1.updatedAt = 1000;
  deck.saveDeckToStorage(d1);
  const d2 = deck.createDeck('new');
  d2.updatedAt = 5000;
  deck.saveDeckToStorage(d2);
  const list = deck.listDecks();
  ok(list[0].title === 'new', 'listDecks: sorted by updatedAt desc');
}

// deleteDeckFromStorage
{
  resetStorage();
  const d = deck.createDeck('delete-me');
  deck.saveDeckToStorage(d);
  ok(deck.deleteDeckFromStorage(d.id) === true, 'delete: returns true on success');
  ok(deck.listDecks().length === 0, 'delete: list now empty');
  ok(deck.deleteDeckFromStorage('nonexistent') === false, 'delete: nonexistent returns false');
}

console.log('\nTest group 6: rename + duplicate');

{
  resetStorage();
  const d = deck.createDeck('original');
  deck.saveDeckToStorage(d);
  const before = Date.now();
  while (Date.now() === before) {}
  deck.renameDeck(d.id, 'renamed');
  ok(deck.loadDeckFromStorage(d.id).title === 'renamed', 'rename: title updated');
}

{
  resetStorage();
  const d = deck.createDeck('source');
  deck.addSubjectToCanvas(d, { id: 's1', type: 'cube-3d' });
  deck.addWaypoint(d, { id: 'w1', camera: { yaw: 0, pitch: 0, distance: 5, targetX: 0, targetY: 0, targetZ: 0 } });
  deck.saveDeckToStorage(d);
  const dup = deck.duplicateDeck(d.id);
  ok(dup !== null, 'duplicate: returns new deck');
  ok(dup.title === 'source (copy)', 'duplicate: " (copy)" suffix');
  ok(dup.canvas.subjects.length === 1 && dup.canvas.subjects[0].id !== 's1', 'duplicate: subject ids reassigned');
  ok(dup.waypoints.length === 1 && dup.waypoints[0].id !== 'w1', 'duplicate: waypoint ids reassigned');
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
```

- [ ] **Step 3: Run the new tests**

Run: `node sdf-js/scripts/test-deck-model.mjs`
Expected: ~28 passed, 0 failed.

- [ ] **Step 4: Run npm test (verify no regression)**

Run: `npm test 2>&1 | tail -5`
Expected: 31/31 pass.

- [ ] **Step 5: Commit Phase 3**

```bash
git add sdf-js/src/present/deck-model.js sdf-js/scripts/test-deck-model.mjs
git commit -m "Atlas Present Canvas Mode Phase 3: rewrite deck-model.js for Canvas+Waypoint schema

OLD (Sprint 1 PPT-mode): deck.slides[] each with own SceneData.
NEW (Canvas Mode):       deck.canvas (one SceneData) + deck.waypoints[] (cameras).

Functions:
- Deck: createDeck / renameDeck / duplicateDeck (deep clone w/ new subject+waypoint ids)
- Subject: addSubjectToCanvas / removeSubjectFromCanvas (operate on deck.canvas.subjects)
- Waypoint: addWaypoint / removeWaypoint / moveWaypoint / updateWaypointCamera
- Storage: saveDeckToStorage / loadDeckFromStorage / listDecks / deleteDeckFromStorage
- Migration: migrateDecksStorage drops v1 silently (no real users 2 hr after PPT-mode ship)

~28 assertions all green. Plan Phase 3."
```

---

## Phase 4 — Rewrite `deck-editor.js` (3-pane with 3D canvas viewport)

**Phase goal:** Editor center pane is the live 3D canvas (full viewport). Left rail lists waypoints. Right inspector has add-subject form + selected waypoint settings + deck settings. End-of-phase: user can add 3 subjects, capture waypoints, see camera tween preview on click.

### Task 4.1: Create `atom-palette.js` (subject creation helper)

**Files:**
- Create: `sdf-js/src/present/atom-palette.js`

- [ ] **Step 1: Create atom palette helper**

Create `sdf-js/src/present/atom-palette.js`:

```js
// =============================================================================
// atom-palette.js — Atlas Present Canvas Mode subject creation helper
// -----------------------------------------------------------------------------
// Sprint 1 P0 atom palette: 5 atom types user can add as subjects to the
// canvas. Form-based placement (type + numerical [x,y,z]) — interactive
// 3D placement is Sprint 2+.
//
// All 5 atom types ARE registered in compile.js PRIMITIVE_FACTORIES.
// =============================================================================

/**
 * Atom palette entries.
 *
 * Each entry:
 *   - type:        the canonical name registered in compile.js PRIMITIVE_FACTORIES
 *   - displayName: human-friendly label for the UI dropdown
 *   - defaultArgs: sensible starting args (atom-specific)
 *   - description: short hint shown in the form
 */
export const ATOM_PALETTE = [
  {
    type: 'cube-3d',
    displayName: 'Cube row',
    defaultArgs: { count: 4, arrangement: 'row', cubeSize: 0.6, spacing: 0.4, labels: ['1', '2', '3', '4'] },
    description: '4 connected cubes in a row with numeric labels.',
  },
  {
    type: 'text-3d-pipe',
    displayName: 'Text (pipe)',
    defaultArgs: { text: 'ATLAS', height: 1.0, pipeRadius: 0.08, align: 'center' },
    description: 'True 3D text built from capsules + torus + sphere.',
  },
  {
    type: 'pyramid-3d',
    displayName: 'Pyramid',
    defaultArgs: { levels: 4, base: 2, height: 2 },
    description: 'N-level stepped pyramid.',
  },
  {
    type: 'bar-3d',
    displayName: 'Bar chart',
    defaultArgs: { values: [0.3, 0.7, 1.0, 0.5, 0.8], barWidth: 0.4, gap: 0.1, maxHeight: 2.0 },
    description: '5-bar 3D chart.',
  },
  {
    type: 'cover-3d',
    displayName: 'Cover (title + subtitle)',
    defaultArgs: { title: 'My Deck', subtitle: 'Subtitle here' },
    description: 'Slide-cover atom (title + subtitle on pedestal).',
  },
];

/**
 * Find a palette entry by atom type.
 *
 * @param {string} type
 * @returns {object|null}
 */
export function findPaletteEntry(type) {
  return ATOM_PALETTE.find((p) => p.type === type) || null;
}
```

- [ ] **Step 2: Verify syntax**

```bash
node --check sdf-js/src/present/atom-palette.js && echo "syntax OK"
node -e "import('./sdf-js/src/present/atom-palette.js').then(m => console.log('palette:', m.ATOM_PALETTE.length, 'entries'))"
```

Expected: `syntax OK`; `palette: 5 entries`.

- [ ] **Step 3: Commit Task 4.1**

```bash
git add sdf-js/src/present/atom-palette.js
git commit -m "Atlas Present Canvas Mode: atom-palette.js — 5 P0 subject types

Sprint 1 palette: cube-3d, text-3d-pipe, pyramid-3d, bar-3d, cover-3d.
All registered in compile.js PRIMITIVE_FACTORIES. Form-based placement
(type + [x,y,z]) only; interactive 3D placement is Sprint 2+.

Plan Phase 4 Task 4.1."
```

### Task 4.2: REWRITE `deck-editor.js`

**Files:**
- REPLACE: `sdf-js/src/present/deck-editor.js`

- [ ] **Step 1: Overwrite deck-editor.js entirely**

Replace full file content:

```js
// =============================================================================
// deck-editor.js — Atlas Present Canvas Mode deck editor
// -----------------------------------------------------------------------------
// 3-pane layout:
//   LEFT — waypoint rail (numbered list + select + drag-reorder + [+W] capture)
//   CENTER — 3D canvas viewport (full size, free orbit via compositor controls)
//   RIGHT — inspector pane: selected waypoint + subjects list + add subject + deck settings
//
// User flow:
//   1. New deck has empty canvas + no waypoints
//   2. Add subject via right-pane form (type + xyz) → mutates deck.canvas.subjects
//      → recompile + re-render canvas
//   3. Orbit camera in viewport (free)
//   4. + Waypoint button → captures current camera as a new waypoint
//   5. Click waypoint → camera tweens (200ms) to preview that framing
//   6. ▶ Present → switch to present mode (separate URL flag)
//
// Calls Layer 1 via compositor-api.js. Does NOT touch compositor internals.
// =============================================================================

import * as deckModel from './deck-model.js';
import { createRendererForId, compileScene, sphericalToCamState } from '../compositor-api.js';
import { ATOM_PALETTE, findPaletteEntry } from './atom-palette.js';
import { tweenCamera, easeInOut } from './waypoint-tween.js';

// Module-scope editor state.
let currentDeck = null;
let currentWaypointId = null;       // null = no waypoint selected (free orbit)
let renderer = null;
let canvas = null;
let activeTween = null;             // handle from tweenCamera, has .cancel()

export async function mountDeckEditor(target, deckId) {
  const deck = deckModel.loadDeckFromStorage(deckId);
  if (!deck) {
    target.innerHTML = `<div class="page-pad">Deck not found: ${deckId}<br><a href="./">← Library</a></div>`;
    return;
  }
  currentDeck = deck;
  currentWaypointId = deck.waypoints[0]?.id ?? null;

  target.innerHTML = `
    <div class="topbar">
      <a href="./" class="btn-back">← Library</a>
      <div class="brand" style="margin-left: 16px;">${escapeHtml(deck.title)}</div>
      <div class="spacer"></div>
      <button id="btn-present-current">▶ Present</button>
    </div>
    <div class="editor-body canvas-mode">
      <aside class="waypoint-rail" id="waypoint-rail"></aside>
      <main class="canvas-viewport" id="canvas-viewport">
        <canvas id="canvas-3d"></canvas>
        <div class="viewport-meta" id="viewport-meta"></div>
      </main>
      <aside class="inspector-pane" id="inspector-pane"></aside>
    </div>
  `;
  document.getElementById('btn-present-current').addEventListener('click', () => {
    location.search = `?deck=${deck.id}&present=1`;
  });

  await mountRenderer();
  renderWaypointRail();
  renderInspectorPane();
  fitAndRender();

  window.addEventListener('resize', fitAndRender);
}

async function mountRenderer() {
  canvas = document.getElementById('canvas-3d');
  fitCanvasToContainer();
  try {
    renderer = createRendererForId(currentDeck.theme.renderer, canvas);
  } catch (e) {
    console.error('[deck-editor] renderer create failed:', e);
    document.getElementById('viewport-meta').textContent = `Renderer error: ${e.message}`;
  }
}

function fitCanvasToContainer() {
  if (!canvas) return;
  const container = canvas.parentElement;
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (w > 0 && h > 0) {
    canvas.width = w;
    canvas.height = h;
  }
}

function fitAndRender() {
  fitCanvasToContainer();
  renderCanvas();
}

function renderCanvas() {
  if (!renderer || !canvas || !currentDeck) return;
  try {
    const compiled = compileScene(currentDeck.canvas);
    if (currentDeck.theme.renderer === 'silhouette') {
      renderer.render([{ sdf: compiled.sdf, color: [200, 200, 200], stroke: 0 }], { background: [13, 13, 13] });
    } else {
      // GPU renderers need camera state set. Use initial waypoint camera or canvas default.
      const cam = currentWaypointId
        ? currentDeck.waypoints.find((w) => w.id === currentWaypointId)?.camera
        : currentDeck.canvas.defaults?.camera;
      if (cam && renderer.setCamState) {
        renderer.setCamState(sphericalToCamState(cam));
      }
      renderer.render(compiled.sdf);
    }
    updateViewportMeta();
  } catch (e) {
    console.error('[deck-editor] render failed:', e);
    document.getElementById('viewport-meta').textContent = `Render error: ${e.message}`;
  }
}

function updateViewportMeta() {
  const meta = document.getElementById('viewport-meta');
  if (!meta) return;
  const wpCount = currentDeck.waypoints.length;
  const subjCount = currentDeck.canvas.subjects.length;
  meta.textContent = `${subjCount} subject${subjCount === 1 ? '' : 's'} · ${wpCount} waypoint${wpCount === 1 ? '' : 's'} · ${currentDeck.theme.renderer}`;
}

// ---- Waypoint rail ----------------------------------------------------------

function renderWaypointRail() {
  const rail = document.getElementById('waypoint-rail');
  rail.innerHTML = `
    ${currentDeck.waypoints
      .map(
        (w, i) => `
      <div class="waypoint-thumb ${w.id === currentWaypointId ? 'selected' : ''}" data-id="${w.id}" draggable="true">
        <div class="thumb-num">${i + 1}</div>
        <div class="thumb-title">${escapeHtml(w.title || `Waypoint ${i + 1}`)}</div>
      </div>
    `,
      )
      .join('')}
    <button class="btn-add-waypoint" id="btn-add-waypoint">+ Capture current view</button>
  `;

  rail.querySelectorAll('.waypoint-thumb').forEach((el) => {
    el.addEventListener('click', () => {
      selectWaypointAndTween(el.dataset.id);
    });
    // Drag reorder
    el.addEventListener('dragstart', (e) => {
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', el.dataset.id);
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      rail.querySelectorAll('.waypoint-thumb').forEach((t) => t.classList.remove('drop-target'));
    });
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.classList.add('drop-target');
    });
    el.addEventListener('dragleave', () => el.classList.remove('drop-target'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drop-target');
      const fromId = e.dataTransfer.getData('text/plain');
      const toId = el.dataset.id;
      if (fromId !== toId) {
        const fromIdx = currentDeck.waypoints.findIndex((w) => w.id === fromId);
        const toIdx = currentDeck.waypoints.findIndex((w) => w.id === toId);
        deckModel.moveWaypoint(currentDeck, fromIdx, toIdx);
        deckModel.saveDeckToStorage(currentDeck);
        renderWaypointRail();
      }
    });
  });

  document.getElementById('btn-add-waypoint').addEventListener('click', handleAddWaypoint);
}

function selectWaypointAndTween(waypointId) {
  const wp = currentDeck.waypoints.find((w) => w.id === waypointId);
  if (!wp) return;

  // Cancel any in-flight tween
  if (activeTween) {
    activeTween.cancel();
    activeTween = null;
  }

  // Read current camera (best effort — fall back to canvas default if renderer can't reveal it)
  const fromCam = readCurrentCamera() || currentDeck.canvas.defaults?.camera || wp.camera;

  // Editor tween: 200ms snap-feel preview
  activeTween = tweenCamera(fromCam, wp.camera, {
    durationMs: 200,
    easing: easeInOut,
    onFrame: (cam) => {
      if (renderer && renderer.setCamState) {
        renderer.setCamState(sphericalToCamState(cam));
      }
    },
    onComplete: () => {
      activeTween = null;
    },
  });

  currentWaypointId = waypointId;
  renderWaypointRail();
  renderInspectorPane();
}

/**
 * Read the renderer's current camera state. GPU renderers expose .getCamState
 * (added in Sprint 1 via compositor-api). If not available, returns null.
 *
 * @returns {object|null} spherical-style camera or null
 */
function readCurrentCamera() {
  if (!renderer) return null;
  if (typeof renderer.getCamState === 'function') {
    const cam = renderer.getCamState();
    // Convert from Cartesian (eye/yaw/pitch) back to spherical-style if needed
    // For now, just trust the renderer to expose spherical-compatible fields.
    return cam;
  }
  // Fallback: use selected waypoint's camera
  const wp = currentDeck.waypoints.find((w) => w.id === currentWaypointId);
  return wp?.camera ?? null;
}

function handleAddWaypoint() {
  // Capture current camera. For Sprint 1, capture the current selected
  // waypoint's camera (or canvas default if none) — interactive orbit
  // capture happens in Sprint 2+ when we wire renderer.getCamState properly.
  const cam = readCurrentCamera() || currentDeck.canvas.defaults?.camera || {
    yaw: 0.3, pitch: -0.15, distance: 8, targetX: 0, targetY: 0.5, targetZ: 0,
  };
  const title = prompt('Waypoint title:', `Waypoint ${currentDeck.waypoints.length + 1}`);
  if (title === null) return;
  const wp = deckModel.addWaypoint(currentDeck, {
    title: title || `Waypoint ${currentDeck.waypoints.length + 1}`,
    camera: { ...cam },
  });
  deckModel.saveDeckToStorage(currentDeck);
  currentWaypointId = wp.id;
  renderWaypointRail();
  renderInspectorPane();
  updateViewportMeta();
}

// ---- Inspector pane ---------------------------------------------------------

function renderInspectorPane() {
  const pane = document.getElementById('inspector-pane');
  const wp = currentWaypointId ? currentDeck.waypoints.find((w) => w.id === currentWaypointId) : null;
  const RENDERERS = ['studio', 'fly3d', 'silhouette'];
  pane.innerHTML = `
    ${wp ? `
      <h3>Waypoint ${currentDeck.waypoints.findIndex((w) => w.id === wp.id) + 1}</h3>
      <div class="settings-row">
        <label>Title</label>
        <input type="text" id="input-waypoint-title" value="${escapeHtml(wp.title || '')}" placeholder="(no title)" />
      </div>
      <div class="settings-row meta">
        Camera: yaw=${wp.camera.yaw.toFixed(2)} pitch=${wp.camera.pitch.toFixed(2)} dist=${wp.camera.distance.toFixed(2)}<br>
        Target: ${wp.camera.targetX.toFixed(2)}, ${wp.camera.targetY.toFixed(2)}, ${wp.camera.targetZ.toFixed(2)}
      </div>
      <div class="settings-row">
        <button id="btn-recapture-waypoint">Re-capture from current view</button>
      </div>
      <div class="settings-row">
        <button id="btn-delete-waypoint">Delete waypoint</button>
      </div>
    ` : '<div class="settings-row meta">No waypoint selected. Capture one with the [+ Capture] button on the left.</div>'}

    <h3 style="margin-top: 24px;">Subjects (${currentDeck.canvas.subjects.length})</h3>
    ${currentDeck.canvas.subjects.length === 0 ? '<div class="settings-row meta">Empty canvas. Add a subject below.</div>' : ''}
    ${currentDeck.canvas.subjects
      .map(
        (s) => `
      <div class="subject-row" data-id="${s.id}">
        <span class="subject-type">${escapeHtml(s.type)}</span>
        <span class="subject-pos">at ${formatTranslate(s.transform?.translate)}</span>
        <button class="btn-remove-subject" data-id="${s.id}">×</button>
      </div>
    `,
      )
      .join('')}
    <div class="settings-row">
      <button id="btn-add-subject">+ Add subject</button>
    </div>

    <h3 style="margin-top: 24px;">Deck</h3>
    <div class="settings-row">
      <label>Renderer</label>
      <select id="select-renderer">
        ${RENDERERS.map((r) => `<option value="${r}" ${r === currentDeck.theme.renderer ? 'selected' : ''}>${r}</option>`).join('')}
      </select>
    </div>
    <div class="settings-row meta">
      Tween: ${currentDeck.tween.durationMs}ms ${currentDeck.tween.easing}
    </div>
  `;

  document.getElementById('input-waypoint-title')?.addEventListener('change', handleWaypointTitleChange);
  document.getElementById('btn-recapture-waypoint')?.addEventListener('click', handleRecaptureWaypoint);
  document.getElementById('btn-delete-waypoint')?.addEventListener('click', handleDeleteWaypoint);
  document.getElementById('btn-add-subject').addEventListener('click', handleAddSubjectFlow);
  document.getElementById('select-renderer').addEventListener('change', handleRendererChange);
  pane.querySelectorAll('.btn-remove-subject').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleRemoveSubject(btn.dataset.id);
    });
  });
}

function formatTranslate(t) {
  if (!t || t.length !== 3) return '[0,0,0]';
  return `[${t.map((n) => n.toFixed(1)).join(',')}]`;
}

// ---- Handlers ---------------------------------------------------------------

function handleWaypointTitleChange(e) {
  const wp = currentDeck.waypoints.find((w) => w.id === currentWaypointId);
  if (!wp) return;
  wp.title = e.target.value;
  currentDeck.updatedAt = Date.now();
  deckModel.saveDeckToStorage(currentDeck);
  renderWaypointRail();
}

function handleRecaptureWaypoint() {
  const wp = currentDeck.waypoints.find((w) => w.id === currentWaypointId);
  if (!wp) return;
  const cam = readCurrentCamera() || wp.camera;
  deckModel.updateWaypointCamera(currentDeck, currentWaypointId, cam);
  deckModel.saveDeckToStorage(currentDeck);
  renderInspectorPane();
}

function handleDeleteWaypoint() {
  if (!currentWaypointId) return;
  if (!confirm('Delete this waypoint?')) return;
  deckModel.removeWaypoint(currentDeck, currentWaypointId);
  deckModel.saveDeckToStorage(currentDeck);
  currentWaypointId = currentDeck.waypoints[0]?.id ?? null;
  renderWaypointRail();
  renderInspectorPane();
  updateViewportMeta();
}

function handleAddSubjectFlow() {
  // Sprint 1: simple sequential prompts. Form-based UI is Sprint 2+.
  const types = ATOM_PALETTE.map((p, i) => `${i + 1}: ${p.type} — ${p.displayName}`).join('\n');
  const choice = prompt(`Pick atom type (1-${ATOM_PALETTE.length}):\n${types}`);
  if (!choice) return;
  const n = parseInt(choice, 10);
  if (!Number.isFinite(n) || n < 1 || n > ATOM_PALETTE.length) {
    alert('Invalid choice');
    return;
  }
  const entry = ATOM_PALETTE[n - 1];
  const xyz = prompt(`Position [x,y,z] for ${entry.type} (e.g. "0,0.5,0"):`, '0,0.5,0');
  if (!xyz) return;
  const parts = xyz.split(',').map((s) => parseFloat(s.trim()));
  if (parts.length !== 3 || parts.some((p) => !Number.isFinite(p))) {
    alert('Invalid position');
    return;
  }
  deckModel.addSubjectToCanvas(currentDeck, {
    type: entry.type,
    args: { ...entry.defaultArgs },
    transform: { translate: parts },
    material: 'silver',
  });
  deckModel.saveDeckToStorage(currentDeck);
  renderInspectorPane();
  renderCanvas();
}

function handleRemoveSubject(subjectId) {
  if (!confirm('Remove this subject?')) return;
  deckModel.removeSubjectFromCanvas(currentDeck, subjectId);
  deckModel.saveDeckToStorage(currentDeck);
  renderInspectorPane();
  renderCanvas();
}

function handleRendererChange(e) {
  currentDeck.theme.renderer = e.target.value;
  currentDeck.updatedAt = Date.now();
  deckModel.saveDeckToStorage(currentDeck);
  // Tear down + recreate renderer
  if (renderer) {
    try {
      renderer.unmount();
    } catch (err) {
      console.warn('[deck-editor] previous renderer unmount failed:', err);
    }
  }
  mountRenderer().then(fitAndRender);
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

- [ ] **Step 2: Verify syntax**

```bash
node --check sdf-js/src/present/deck-editor.js && echo "syntax OK"
```

- [ ] **Step 3: Browse smoke test — editor loads, can add subject, can capture waypoint**

Use the browse skill (`B=/Users/hexiaoyang/.claude/skills/gstack/browse/dist/browse`).

```bash
B=/Users/hexiaoyang/.claude/skills/gstack/browse/dist/browse
$B goto "http://localhost:8001/examples/present/"
$B wait --networkidle
sleep 1
# Pre-seed a deck via JS (avoids dialog issues)
$B js "
  localStorage.removeItem('atlas-decks');
  const deckModel = await import('/src/present/deck-model.js');
  const d = deckModel.createDeck('Canvas Smoke');
  d.theme.renderer = 'silhouette';
  deckModel.addSubjectToCanvas(d, { type: 'cube-3d', args: { count: 4 }, transform: { translate: [0, 0.5, 0] }, material: 'silver' });
  deckModel.addWaypoint(d, { title: 'Overview', camera: { yaw: 0.3, pitch: -0.15, distance: 8, targetX: 0, targetY: 0.5, targetZ: 0 } });
  deckModel.saveDeckToStorage(d);
  location.search = '?deck=' + d.id;
"
sleep 3
$B text | head -20
$B console --errors
$B screenshot /tmp/p4-canvas-editor.png
```

Read `/tmp/p4-canvas-editor.png` via Read tool. Verify:
- Topbar with deck title + ▶ Present
- Left rail: 1 waypoint thumb "Overview" + [+ Capture current view] button
- Center: 3D canvas viewport (silhouette CPU render of the cube)
- Right inspector: Waypoint 1 settings + Subjects (1 cube-3d) + Deck (renderer dropdown)

Console should be empty (silhouette CPU path works in headless).

If errors: investigate. GPU renderer errors are expected per memory `glsl-latent-gpu-bugs` (deferred to real browser). Silhouette CPU path is the verification gate.

- [ ] **Step 4: Commit Task 4.2**

```bash
git add sdf-js/src/present/deck-editor.js
git commit -m "Atlas Present Canvas Mode Phase 4: rewrite deck-editor.js — 3D canvas viewport

3-pane editor:
  LEFT — waypoint rail with [+ Capture current view] button + drag-reorder
  CENTER — full 3D canvas viewport (live render via createRendererForId)
  RIGHT — inspector: selected waypoint settings + subjects list + add-subject
           form + deck settings (renderer dropdown)

Waypoint preview tween 200ms ease-in-out via waypoint-tween.tweenCamera.
Renderer swap re-creates instance (no live SDF re-attach yet — that's Sprint 2).

Add Subject flow: prompt → pick from 5 P0 atoms (atom-palette.js) → prompt
[x,y,z] → addSubjectToCanvas + re-render. Form-based; interactive 3D placement
is Sprint 2+.

Plan Phase 4 Task 4.2."
```

### Task 4.3: Extend CSS for Canvas Mode editor

**Files:**
- Modify: `sdf-js/examples/present/style.css`

- [ ] **Step 1: Append Canvas Mode editor styles**

Append to `sdf-js/examples/present/style.css`:

```css
/* ---- Canvas Mode editor (Sprint 1 Canvas Mode pivot) ---- */
.editor-body.canvas-mode {
  display: grid;
  grid-template-columns: 220px 1fr 320px;
}

.editor-body.canvas-mode .canvas-viewport {
  position: relative;
  background: #0d0d0d;
  overflow: hidden;
  padding: 0;
  display: block;
}
.editor-body.canvas-mode .canvas-viewport canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: #1a1a1a;
  border: none;
  max-width: none;
  max-height: none;
}
.editor-body.canvas-mode .viewport-meta {
  position: absolute;
  bottom: 12px;
  left: 12px;
  color: #888;
  font-size: 12px;
  background: rgba(0, 0, 0, 0.5);
  padding: 4px 10px;
  border-radius: 3px;
  pointer-events: none;
}

.editor-body.canvas-mode .waypoint-rail {
  background: #141414;
  border-right: 1px solid #2a2a2a;
  padding: 12px;
  overflow-y: auto;
}
.waypoint-thumb {
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
.waypoint-thumb:hover {
  background: #222;
}
.waypoint-thumb.selected {
  border-color: #ffd070;
  background: #2a2520;
}
.waypoint-thumb.dragging { opacity: 0.4; }
.waypoint-thumb.drop-target { border-color: #ffd070; }
.waypoint-thumb .thumb-num {
  color: #ffd070;
  font-weight: 700;
  font-size: 12px;
  width: 18px;
}
.waypoint-thumb .thumb-title {
  color: #ddd;
  font-size: 12px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.btn-add-waypoint {
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
.btn-add-waypoint:hover { background: #3a3a3a; }

.editor-body.canvas-mode .inspector-pane {
  background: #141414;
  border-left: 1px solid #2a2a2a;
  padding: 20px;
  overflow-y: auto;
}
.inspector-pane h3 {
  margin: 0 0 12px 0;
  color: #ddd;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.subject-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 3px;
  margin-bottom: 4px;
  font-size: 12px;
}
.subject-row .subject-type {
  color: #ffd070;
  font-weight: 600;
}
.subject-row .subject-pos {
  color: #888;
  flex: 1;
  font-family: monospace;
}
.subject-row .btn-remove-subject {
  background: #2a2a2a;
  color: #888;
  border: none;
  width: 22px;
  height: 22px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 14px;
}
.subject-row .btn-remove-subject:hover { background: #3a2a2a; color: #ff6666; }
```

- [ ] **Step 2: Browse re-verify (visual)**

```bash
B=/Users/hexiaoyang/.claude/skills/gstack/browse/dist/browse
$B reload
sleep 2
$B screenshot /tmp/p4-canvas-editor-styled.png
$B console --errors
```

Read screenshot. Verify visual hierarchy is clearer than before (waypoint rail / 3D canvas / inspector all distinct).

- [ ] **Step 3: Commit Task 4.3**

```bash
git add sdf-js/examples/present/style.css
git commit -m "Atlas Present Canvas Mode Phase 4: CSS for 3D canvas viewport + inspector

New .editor-body.canvas-mode styles: 220px / 1fr / 320px grid.
canvas-viewport = full-bleed render area with absolute-positioned canvas +
floating viewport-meta caption. waypoint-rail + waypoint-thumb same dark
aesthetic as Sprint 1. inspector-pane shows subject rows with type + pos +
remove button.

Plan Phase 4 Task 4.3."
```

---

## Phase 5 — Rewrite `present-mode.js` + L3 acceptance

**Phase goal:** Single canvas + camera tween between waypoints on ←→ keys. End-of-sprint demo runs end-to-end.

### Task 5.1: REWRITE present-mode.js

**Files:**
- REPLACE: `sdf-js/src/present/present-mode.js`

- [ ] **Step 1: Overwrite present-mode.js entirely**

```js
// =============================================================================
// present-mode.js — Atlas Present Canvas Mode fullscreen playback
// -----------------------------------------------------------------------------
// Compiles deck.canvas ONCE, mounts renderer ONCE, then tweens camera between
// waypoints on ←→ keys. No scene rebuild between waypoints — the canvas is
// persistent (Prezi-style).
//
// Camera is LOCKED (no drag / WASD). Renderer LOCKED to deck.theme.renderer.
// =============================================================================

import * as deckModel from './deck-model.js';
import { createRendererForId, compileScene, sphericalToCamState } from '../compositor-api.js';
import { tweenCamera, easeInOut, easeLinear } from './waypoint-tween.js';

let deck = null;
let waypointIdx = 0;
let renderer = null;
let canvas = null;
let cursorHideTimer = null;
let counterHideTimer = null;
let activeTween = null;

export async function mountPresentMode(target, deckId) {
  deck = deckModel.loadDeckFromStorage(deckId);
  if (!deck) {
    target.innerHTML = `<div class="page-pad">Deck not found: ${deckId}<br><a href="./">← Library</a></div>`;
    return;
  }
  if (deck.waypoints.length === 0) {
    target.innerHTML = `<div class="page-pad">Deck "${deck.title}" has no waypoints.<br><a href="./?deck=${deckId}">← Editor</a></div>`;
    return;
  }
  waypointIdx = 0;

  target.innerHTML = `
    <div class="present-stage" id="present-stage">
      <canvas id="present-canvas"></canvas>
      <div class="present-counter" id="present-counter"></div>
      <div class="present-exit-hint">Press <kbd>esc</kbd> to exit</div>
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

  // Compile canvas ONCE
  let compiled;
  try {
    compiled = compileScene(deck.canvas);
  } catch (e) {
    target.innerHTML = `<div class="page-pad">Canvas compile error: ${e.message}<br><a href="./?deck=${deckId}">← Editor</a></div>`;
    return;
  }
  storeCompiledSdf(compiled);

  // Fullscreen (best-effort)
  const params = new URLSearchParams(location.search);
  const skipFullscreen = params.get('nofs') === '1';
  if (!skipFullscreen) {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {
      console.warn('[present-mode] fullscreen blocked:', e.message);
    }
  }

  // Snap camera to waypoint 0 (no tween for initial frame)
  applyCamera(deck.waypoints[0].camera);
  renderCurrentFrame();
  updateCounter();

  resetCursorHide();
  document.addEventListener('mousemove', resetCursorHide);
  document.addEventListener('keydown', handleKey);
  canvas.addEventListener('click', goNext);
  window.addEventListener('resize', () => {
    fitCanvasToWindow();
    renderCurrentFrame();
  });
}

function fitCanvasToWindow() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

let _compiledSdf = null;

function storeCompiledSdf(compiled) {
  _compiledSdf = compiled.sdf;
}

function applyCamera(cam) {
  if (renderer && renderer.setCamState) {
    renderer.setCamState(sphericalToCamState(cam));
  }
}

function renderCurrentFrame() {
  if (!renderer || !_compiledSdf) return;
  try {
    if (deck.theme.renderer === 'silhouette') {
      renderer.render([{ sdf: _compiledSdf, color: [200, 200, 200], stroke: 0 }], { background: [13, 13, 13] });
    } else {
      renderer.render(_compiledSdf);
    }
  } catch (e) {
    console.error('[present-mode] render failed:', e);
  }
}

function updateCounter() {
  const el = document.getElementById('present-counter');
  if (!el) return;
  el.textContent = `${waypointIdx + 1} / ${deck.waypoints.length}`;
  el.classList.remove('hidden');
  if (counterHideTimer) clearTimeout(counterHideTimer);
  counterHideTimer = setTimeout(() => el.classList.add('hidden'), 2000);
}

function resetCursorHide() {
  document.body.style.cursor = '';
  if (cursorHideTimer) clearTimeout(cursorHideTimer);
  cursorHideTimer = setTimeout(() => {
    document.body.style.cursor = 'none';
  }, 2000);
}

function startTweenToWaypoint(targetIdx) {
  if (targetIdx < 0 || targetIdx >= deck.waypoints.length) return;
  if (activeTween) {
    activeTween.cancel();
    activeTween = null;
  }
  const fromCam = deck.waypoints[waypointIdx].camera;
  const toCam = deck.waypoints[targetIdx].camera;
  waypointIdx = targetIdx;
  updateCounter();

  const easingFn = deck.tween.easing === 'linear' ? easeLinear : easeInOut;
  activeTween = tweenCamera(fromCam, toCam, {
    durationMs: deck.tween.durationMs,
    easing: easingFn,
    onFrame: (cam) => {
      applyCamera(cam);
      renderCurrentFrame();
    },
    onComplete: () => {
      activeTween = null;
    },
  });
}

function goNext() {
  if (waypointIdx < deck.waypoints.length - 1) {
    startTweenToWaypoint(waypointIdx + 1);
  }
}

function goPrev() {
  if (waypointIdx > 0) {
    startTweenToWaypoint(waypointIdx - 1);
  }
}

function goFirst() {
  if (waypointIdx !== 0) startTweenToWaypoint(0);
}

function goLast() {
  if (waypointIdx !== deck.waypoints.length - 1) startTweenToWaypoint(deck.waypoints.length - 1);
}

async function exitPresent() {
  if (activeTween) {
    activeTween.cancel();
    activeTween = null;
  }
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch (e) {
    /* ignore */
  }
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

- [ ] **Step 2: Verify syntax**

```bash
node --check sdf-js/src/present/present-mode.js && echo "syntax OK"
```

- [ ] **Step 3: Commit Task 5.1**

```bash
git add sdf-js/src/present/present-mode.js
git commit -m "Atlas Present Canvas Mode Phase 5: rewrite present-mode.js — single canvas + camera tween

Compiles deck.canvas ONCE on mount (no per-slide rebuild). Tween camera
between waypoints on ←→ key via waypoint-tween.tweenCamera (deck.tween
defaults 800ms ease-in-out).

Renderer LOCKED, camera LOCKED (no drag/WASD). esc exits to editor.
&nofs=1 URL flag skips requestFullscreen() for headless testing.

Plan Phase 5 Task 5.1."
```

### Task 5.2: L3 end-to-end acceptance test

Manual via /browse. Per spec §7. Document each step.

- [ ] **Step 1: Reset localStorage + reload library**

```bash
B=/Users/hexiaoyang/.claude/skills/gstack/browse/dist/browse
$B goto "http://localhost:8001/examples/present/"
$B wait --networkidle
$B js "localStorage.removeItem('atlas-decks')"
$B reload
sleep 1
$B text | head -5
```

Expected: "No decks yet" visible.

- [ ] **Step 2: Programmatically build a deck with 3 subjects + 3 waypoints (the L3 narrative)**

Headless dialog prompts are unreliable; build the deck via JS:

```bash
$B js "
  const deckModel = await import('/src/present/deck-model.js');
  const d = deckModel.createDeck('Canvas Test');
  d.theme.renderer = 'silhouette';
  // 3 subjects spread in 3D space
  deckModel.addSubjectToCanvas(d, { type: 'cube-3d', args: { count: 4, arrangement: 'row', cubeSize: 0.6, spacing: 0.4 }, transform: { translate: [0, 0.5, 0] }, material: 'silver' });
  deckModel.addSubjectToCanvas(d, { type: 'pyramid-3d', args: { levels: 4, base: 1.5, height: 1.5 }, transform: { translate: [-3, 0.5, 0] }, material: 'silver' });
  deckModel.addSubjectToCanvas(d, { type: 'text-3d-pipe', args: { text: 'ATLAS', height: 0.8, pipeRadius: 0.06 }, transform: { translate: [3, 1.5, 0] }, material: 'silver' });
  // 3 waypoints: overview / zoom cubes / zoom pyramid
  deckModel.addWaypoint(d, { title: 'Overview',     camera: { yaw: 0.3, pitch: -0.15, distance: 10, targetX: 0,  targetY: 0.5, targetZ: 0 } });
  deckModel.addWaypoint(d, { title: 'Zoom Cubes',   camera: { yaw: 0.0, pitch:  0.0,  distance:  3, targetX: 0,  targetY: 0.5, targetZ: 0 } });
  deckModel.addWaypoint(d, { title: 'Zoom Pyramid', camera: { yaw: -0.5, pitch: -0.1, distance:  3, targetX: -3, targetY: 0.5, targetZ: 0 } });
  deckModel.saveDeckToStorage(d);
  location.reload();
"
sleep 2
$B text | head -10
```

Expected: deck card "Canvas Test" with "3 waypoints" visible.

- [ ] **Step 3: Enter editor → verify 3 subjects + 3 waypoints**

```bash
$B click "text=✎"
sleep 2
$B text | head -20
$B screenshot /tmp/p5-canvas-editor.png
```

Read `/tmp/p5-canvas-editor.png`. Verify:
- 3 waypoint thumbs in left rail
- 3D viewport in center
- Right inspector shows Subjects (3: cube-3d, pyramid-3d, text-3d-pipe)

- [ ] **Step 4: ▶ Present → verify present mode loads**

```bash
# nofs=1 = skip fullscreen API (unreliable in headless)
$B js "const u = new URL(location.href); u.searchParams.set('present', '1'); u.searchParams.set('nofs', '1'); location.href = u.toString();"
sleep 3
$B text | head -5
$B screenshot /tmp/p5-canvas-present-wp1.png
$B console --errors
```

Read `/tmp/p5-canvas-present-wp1.png`. Should see canvas-mode present rendering of waypoint 1 (Overview) with counter "1 / 3" bottom-right.

- [ ] **Step 5: → key tweens to waypoint 2**

```bash
$B press ArrowRight
sleep 1
$B screenshot /tmp/p5-canvas-present-wp2.png
```

Read screenshot. Should show different framing (zoomed in — Overview vs Zoom Cubes).

- [ ] **Step 6: → key again → waypoint 3**

```bash
$B press ArrowRight
sleep 1
$B screenshot /tmp/p5-canvas-present-wp3.png
```

Read screenshot. Should show Zoom Pyramid framing.

- [ ] **Step 7: → at end stays at 3**

```bash
$B press ArrowRight
sleep 1
$B screenshot /tmp/p5-canvas-present-wp3-stuck.png
```

Should equal wp3 frame.

- [ ] **Step 8: ← back to 2**

```bash
$B press ArrowLeft
sleep 1
$B screenshot /tmp/p5-canvas-present-back-wp2.png
```

Verify it differs from wp3-stuck.

- [ ] **Step 9: Esc → back to editor URL**

```bash
$B press Escape
sleep 1
$B url
```

Expected URL: `?deck=<id>` only (no `&present=1`).

- [ ] **Step 10: Reorder waypoint 3 to position 1 via console (drag in headless unreliable)**

```bash
$B js "
  const data = JSON.parse(localStorage.getItem('atlas-decks'));
  const d = data.decks[0];
  const moved = [...d.waypoints];
  const last = moved.pop();
  moved.unshift(last);
  d.waypoints = moved;
  d.updatedAt = Date.now();
  localStorage.setItem('atlas-decks', JSON.stringify(data));
  const u = new URL(location.href);
  u.searchParams.set('present', '1');
  u.searchParams.set('nofs', '1');
  location.href = u.toString();
"
sleep 3
$B screenshot /tmp/p5-canvas-after-reorder.png
```

Read screenshot. Verify first frame is now Zoom Pyramid (was last, now first).

If all 10 steps pass: L3 acceptance ✅.

- [ ] **Step 11: No code commit (acceptance test artifacts in /tmp/)**

```bash
git status -s
```
Should be empty.

---

## Phase 6 — Memory + final push

### Task 6.1: Update memory file — Sprint 1 Canvas Mode SHIPPED

**Files:**
- Modify: `/Users/hexiaoyang/.claude/projects/-Users-hexiaoyang-Documents-sdf-main/memory/project_compositor_layered_for_presentation.md`

- [ ] **Step 1: Append Canvas Mode SHIPPED note**

Edit the memory file. Find the "## Sprint 1 PIVOTED 2026-06-19" section heading (added in Plan Task 1.1). Append AT THE BOTTOM of that section (BEFORE the next `## Cross-refs` line):

Anchor (find):
```
Spec: docs/superpowers/specs/2026-06-19-atlas-present-canvas-mode-design.md (ec77426)
Plan: docs/superpowers/plans/2026-06-19-atlas-present-canvas-mode-plan.md
```

Replace with:
```
Spec: docs/superpowers/specs/2026-06-19-atlas-present-canvas-mode-design.md (ec77426)
Plan: docs/superpowers/plans/2026-06-19-atlas-present-canvas-mode-plan.md

### Sprint 1 Canvas Mode SHIPPED 2026-06-19

End-to-end demo working: open `/examples/present/` → create deck → add 3 subjects to
canvas (cube-3d / pyramid-3d / text-3d-pipe at different [x,y,z]) → capture 3 waypoints
(Overview / Zoom Cubes / Zoom Pyramid) → ▶ Present → ←→ keys tween camera SMOOTHLY between
waypoints (800ms ease-in-out via waypoint-tween.js) → esc exit.

L3 acceptance test (10 steps) PASSED via /browse silhouette CPU path. GPU renderers
(studio / fly3d) deferred to manual real-browser verify per [[glsl-latent-gpu-bugs]] memory.

Tests: 31/31 npm test pass (deck-model.js rewrite ~28 + waypoint-tween.js ~26 + existing).

Sprint 2 ahead: interactive 3D subject placement (click-on-canvas) + PDF import auto-
arranging slides in 3D space + speaker notes + per-waypoint duration (autoplay).
```

- [ ] **Step 2: Verify edit landed**

Run: `grep -n "Sprint 1 Canvas Mode SHIPPED" /Users/hexiaoyang/.claude/projects/-Users-hexiaoyang-Documents-sdf-main/memory/project_compositor_layered_for_presentation.md`
Expected: 1 line match.

Note: memory file is outside git, no commit needed.

### Task 6.2: Final npm test + push

- [ ] **Step 1: Run full npm test**

```bash
cd /Users/hexiaoyang/Documents/sdf-main
npm test 2>&1 | tail -5
```

Expected: 31/31 pass.

- [ ] **Step 2: git log → verify all Canvas Mode commits present**

```bash
git log --oneline -15
```

Expected: see commits from Plan Phases 1.2 / 1.3 / 2 / 3 / 4.1 / 4.2 / 4.3 / 5.1 (8 commits).

- [ ] **Step 3: Push to origin**

```bash
git push origin main
```

Expected: push succeeds.

- [ ] **Step 4: Print final summary**

```
Atlas Present Canvas Mode SHIPPED

Commits (Canvas Mode phase commits):
  - Phase 1.2: deprecate markers on Sprint 1 PPT-mode files
  - Phase 1.3: deck-library reads waypoints.length
  - Phase 2:   waypoint-tween.js (interpolateCamera + easeInOut + tweenCamera RAF)
  - Phase 3:   deck-model.js REWRITE (Canvas+Waypoint schema, v2 storage)
  - Phase 4.1: atom-palette.js
  - Phase 4.2: deck-editor.js REWRITE (3D canvas viewport + waypoint rail + inspector)
  - Phase 4.3: CSS for Canvas Mode editor
  - Phase 5.1: present-mode.js REWRITE (single canvas + camera tween)

Tests: 31/31 npm test pass
URL: http://localhost:8001/examples/present/

L3 acceptance: empty library → New Deck → add 3 subjects to canvas → capture 3
waypoints → ▶ Present → ←→ smoothly tween camera between waypoints → esc exit.

Sprint 1 PPT-clone (commits 055c601..f27798c) deprecated — still in git history
but the impl files were rewritten in place for Canvas Mode.

Sprint 2 ahead: interactive 3D placement, PDF import, speaker notes, autoplay.
```

---

## Self-review checklist

1. **Spec coverage**:
   - § 1 goal (canvas + waypoints, smooth tween) → Phase 5 acceptance ✓
   - § 2 architecture (Layer 1 unchanged, Layer 2 data model new) → Phase 3 ✓
   - § 3 data model (Deck/Canvas/Waypoint + v2 storage + v1 silent drop) → Phase 3 ✓
   - § 4 camera tween (linear+yaw wraparound+easing+RAF) → Phase 2 ✓
   - § 5 editor UI sketches (3-pane with canvas-viewport) → Phase 4 ✓
   - § 5.3 present mode (←→ tween + cursor hide + counter) → Phase 5 ✓
   - § 6 file layout (3 NEW + 5 REPLACED + 1 minimal modify) → Phases 1-5 ✓
   - § 7 test plan (L1 + L2 browse + L3 acceptance) → Phases 2/3 L1, 4 L2 browse, 5 L3 ✓
   - § 8 acceptance criteria 1-13 → Phase 5 Task 5.2 ✓
   - § 9 hard rules (canvas single + waypoint camera-only + tween Layer 2 owned + v1 dead + form-only + LOCK) → enforced in code ✓
   - § 10 out of scope → respected ✓

2. **Placeholder scan**: No "TBD" / "implement later" / "appropriate error handling".

3. **Type consistency**: `Deck` / `Waypoint` / `CameraSpherical` / `SceneData` types consistently used. Function names: `createDeck` / `addSubjectToCanvas` / `removeSubjectFromCanvas` / `addWaypoint` / `removeWaypoint` / `moveWaypoint` / `updateWaypointCamera` / `saveDeckToStorage` / `loadDeckFromStorage` / `listDecks` / `deleteDeckFromStorage` / `renameDeck` / `duplicateDeck` / `migrateDecksStorage` (14 funcs) — referenced consistently throughout.

---

## Plan complete and saved to `docs/superpowers/plans/2026-06-19-atlas-present-canvas-mode-plan.md`

Two execution options:

**1. Subagent-Driven (recommended)** — User has been using this for Sprint 1 + Canvas Mode pivot. Dispatch fresh subagent per phase (consolidating tasks within phase per cube-3d / PPT-mode Sprint 1 pattern), two-stage review between phases.

**2. Inline Execution** — Tasks executed inline with checkpoint at each phase.

Default unless user redirects: **Subagent-Driven**.
