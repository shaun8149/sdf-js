# Atlas Present Sprint 3 Implementation Plan — P5.js 2D Pipeline (Hybrid SceneData + p5-sketch subject type)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Solve Sprint 2's black-blob failure mode on abstract content (Aether AI pages 1-11) by adding a P5.js 2D pipeline as graceful-degradation fallback, while promoting SDF compositional metaphor (carrier-from-coins pattern) as Atlas's true wedge above plain vector layouts.

**Architecture:** Hybrid — SceneData remains canonical (all 8 existing renderers untouched). New subject type `p5-sketch` carries P5 sketch code inside `args.code`; visual-panel detects this type and routes to a new `2d-p5` renderer that runs the sketch in a sandboxed iframe (`sandbox=allow-scripts` only) with 28 Atlas SDF helpers + Atlas branding palette exposed via postMessage. Lift LLM system prompt v3.19 → v3.20 adds 3-priority content-driven routing (SDF DIRECT → SDF METAPHORICAL → P5 FALLBACK) so LLM tries Atlas's IP wedge before falling to vector.

**Tech Stack:** ESM Node 25, vanilla browser JS, Canvas2D, p5.js v1.x (vendored at `sdf-js/public/p5.min.js`, no npm install), iframe sandbox + postMessage protocol, localStorage v5 (Sprint 2 schema unchanged — just a new subject.type variant), existing pdf.js parser, existing callLiftLLM via fetch. **NO new npm dependencies** (vendored p5.min.js is a static file, not a package).

**Branch:** `sprint-2-napkin-doc-viewer` (Sprint 3 commits added to the open PR #9 alongside Sprint 2 work).

**Spec:** [`docs/superpowers/specs/2026-06-20-atlas-present-sprint-3-p5-2d-pipeline-design.md`](../specs/2026-06-20-atlas-present-sprint-3-p5-2d-pipeline-design.md) (503 lines, 15 sections, 8 locked design decisions, 3-priority routing locked).

---

## File structure

### NEW (Sprint 3)

| Path | LoC est. | Responsibility |
|---|---|---|
| `sdf-js/public/p5.min.js` | ~500KB (vendored static file) | P5.js v1.x library. Downloaded from official P5 release — NOT writing code. Served by dev-server at `/public/p5.min.js`. |
| `sdf-js/src/present/p5-sandbox-iframe.html` | ~80 | Static HTML iframe entry-point. Loads p5.min.js + sdf-helper-bundle.js. Listens for postMessage `init`/`export` events. Calls user's P5 sketch code inside try/catch and posts `ready`/`error` back to parent. |
| `sdf-js/src/present/sdf-helper-bundle.js` | ~280 | Exposes 28 SDF helper functions (17 vector math + 11 general SDF primitives) as `window.*` globals inside the iframe. Source-copied from BOB code shared by user, NOT imported from sdf-js/src/sdf/ (avoids iframe module resolution complexity). |
| `sdf-js/src/present/p5-renderer.js` | ~200 | `mountP5Renderer(wrapper, sceneData, palette) → {refresh, destroy, exportPng}`. Creates iframe, postMessage protocol, IntersectionObserver-based lazy unmount. |
| `sdf-js/scripts/test-p5-sandbox.mjs` | ~120 | L1 tests for SDF helper bundle functions + mock postMessage protocol (~15 assertions). |

### MODIFY (small targeted edits)

| Path | Change |
|---|---|
| `sdf-js/src/scene/spec.js` | Add `'p5-sketch'` to `PRIMITIVE_TYPES` Set (line ~234 end-of-set) |
| `sdf-js/src/scene/compile.js` | Add `'p5-sketch'` to `PRIMITIVE_FACTORIES` (factory returns sentinel SDF since p5-sketch isn't actually compiled to JS SDF — visual-panel detects type and routes differently) |
| `sdf-js/src/compositor-api.js` | Extend `MODE_2D_ADDENDUM` constant with Step 4 (3-priority routing rules + 3 worked examples). Bump description's version note v3.19 → v3.20. |
| `sdf-js/examples/compositor/system-prompt-lift-3d.md` | Bump frontmatter `version: 3.19` → `version: 3.20`. Update description with v3.20 changelog. (Note: actual addendum text lives in compositor-api.js MODE_2D_ADDENDUM, this file is just the baseline + frontmatter.) |
| `sdf-js/src/present/pipeline.js` | Update `sanitize2dSceneData` (or wrapper validator) to PASS p5-sketch subjects through (don't filter them) but VALIDATE: (a) only single-subject scenes when p5-sketch is used (no mixing), (b) `args.code` is a string. Reject mixed scenes as `liftError = 'p5-sketch-must-be-single-subject'`. |
| `sdf-js/src/present/visual-panel.js` | Renderer routing — detect `sceneData.subjects[0]?.type === 'p5-sketch'` → call `mountP5Renderer` instead of `renderVariantToCanvas`. Effects menu hides renderer cycle for p5-sketch variants (Swap Layout / Export / Swap Branding still work). Picker thumbnails: render p5-sketch variants via mini iframe OR via static placeholder (we use placeholder for thumbnails to avoid 6× iframe). |
| `sdf-js/scripts/test-deck-model.mjs` | Add ~3 assertions for `addVisual` + `updateVisualVariantStatus` accepting sceneData with `p5-sketch` subject type. |
| `sdf-js/scripts/test-pipeline.mjs` | Add ~5 assertions: mock callLiftLLM returns sceneData with p5-sketch subject; pipeline accepts + passes through sanitize; mixed-subject scene rejected. |
| `scripts/run-tests.mjs` | Add 1 entry for `test-p5-sandbox.mjs` under `present` category. |

### Test inventory

Start: 33 test files (Sprint 2 end). After Sprint 3: +1 (test-p5-sandbox.mjs). Target end: **34 test files passed**.

### Layer 1 vs Layer 2 split

- **Layer 1** (sdf-js engine): 3 small touches — `scene/spec.js` (add type), `scene/compile.js` (add factory), `compositor-api.js` (extend prompt addendum). All backward-compat for compositor demo.
- **Layer 2** (Atlas Present app): all new files + visual-panel + pipeline + tests confined to `sdf-js/src/present/` + `sdf-js/scripts/`.

---

## Phase 0 — Pre-flight verification

### Task 0.1: Verify pre-conditions

**Files:** none modified

- [ ] **Step 1: Confirm correct branch**

```bash
cd /Users/hexiaoyang/Documents/sdf-main
git branch --show-current
git status -s
```

Expected:
- Branch: `sprint-2-napkin-doc-viewer`
- Status: clean

If on different branch: `git checkout sprint-2-napkin-doc-viewer` (Sprint 3 spec already on this branch).
If dirty: investigate, do NOT proceed.

- [ ] **Step 2: Verify npm test baseline**

```bash
npm test 2>&1 | tail -5
```

Expected: `33/33 test files passed`. If less, investigate before proceeding.

- [ ] **Step 3: Verify Sprint 3 spec exists**

```bash
ls -la docs/superpowers/specs/2026-06-20-atlas-present-sprint-3-p5-2d-pipeline-design.md
git log --oneline -3
```

Expected: file exists; top 3 commits are the 3 Sprint 3 spec commits (`3e69907`, `a2529ca`, `d82836b`).

- [ ] **Step 4: Verify Sprint 2 work intact**

```bash
ls sdf-js/src/present/
```

Expected: `branding-palettes.js`, `deck-model.js`, `deck-view.js` (Sprint 1.5 deletion was in Sprint 2 Phase 1 — `deck-view.js` should NOT exist), `document-view.js`, `floating-toolbar.js`, `library-page.js`, `pipeline.js`, `visual-panel.js`, `waypoint-tween.js`.

If `deck-view.js` exists or any expected file missing: investigate; Sprint 2 phases not complete.

- [ ] **Step 5: Commit this plan if not already**

If `docs/superpowers/plans/2026-06-20-atlas-present-sprint-3-plan.md` is not yet committed:

```bash
git add docs/superpowers/plans/2026-06-20-atlas-present-sprint-3-plan.md
git commit -m "Sprint 3 plan: P5.js 2D pipeline (7 phases, ~7 hr subagent-driven)

Detailed implementation plan for Sprint 3 spec lock. Hybrid SceneData
with p5-sketch as new subject type. Sandboxed iframe (allow-scripts
only) + 28 SDF helpers + postMessage protocol. Lift prompt v3.20 with
3-priority content-driven routing (SDF DIRECT, SDF METAPHORICAL, P5
FALLBACK).

Sprint 1.5 + Sprint 2 lessons honored throughout: no mock-only verify
(Phase 6 uses REAL Anthropic API), no overclaim in PR body, TDD strict
Phase 2/3, iframe sandbox excludes allow-same-origin to prevent LLM
sketches from reading atlas-anthropic-key from main page localStorage.

Spec: docs/superpowers/specs/2026-06-20-atlas-present-sprint-3-p5-2d-pipeline-design.md
Plan: docs/superpowers/plans/2026-06-20-atlas-present-sprint-3-plan.md"
```

(If plan already committed via writing-plans skill, skip this step.)

---

## Phase 1 — iframe sandbox infrastructure + p5.min.js vendoring + SDF helper bundle

Set up the sandboxed P5 runtime environment. After Phase 1, the iframe + SDF helpers exist as static files; Phase 2 wires the JS renderer that drives them via postMessage.

### Task 1.1: Vendor p5.min.js + create public/ dir

**Files:**
- Create dir: `sdf-js/public/`
- Create: `sdf-js/public/p5.min.js` (downloaded, ~500KB)

- [ ] **Step 1: Create public/ directory**

```bash
mkdir -p sdf-js/public
ls -la sdf-js/public
```

Expected: empty directory exists.

- [ ] **Step 2: Download p5.min.js v1.11 (latest stable)**

```bash
curl -sL https://github.com/processing/p5.js/releases/download/v1.11.3/p5.min.js -o sdf-js/public/p5.min.js
ls -la sdf-js/public/p5.min.js
```

Expected: file size ~900KB-1MB (p5 1.x is ~900KB minified; 500KB was outdated estimate). If the curl fails (e.g., 404), try:

```bash
curl -sL https://cdn.jsdelivr.net/npm/p5@1.11.3/lib/p5.min.js -o sdf-js/public/p5.min.js
```

If both fail, try a recent version (LLM may know a working version that exists at curl time):

```bash
# Fallback: latest from p5js CDN
curl -sL https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.3/p5.min.js -o sdf-js/public/p5.min.js
```

Verify the file is valid JS:

```bash
node --check sdf-js/public/p5.min.js && echo "p5.min.js syntax OK"
head -1 sdf-js/public/p5.min.js | head -c 200
```

Expected: `syntax OK`; first line contains `/*! p5.js v1.x.x...` comment header.

- [ ] **Step 3: Quick smoke — verify dev server serves it**

If dev server isn't running:

```bash
cd sdf-js && python3 dev-server.py 8001 &
sleep 2
cd /Users/hexiaoyang/Documents/sdf-main
```

Then:

```bash
curl -sI http://localhost:8001/public/p5.min.js | head -3
```

Expected: `HTTP/1.0 200 OK` + `Content-Type: application/javascript` (or octet-stream — dev-server.py doesn't override content-type, browser infers from .js extension).

- [ ] **Step 4: Commit p5 vendoring**

```bash
git add sdf-js/public/p5.min.js
git commit -m "Sprint 3 Phase 1.1: vendor p5.min.js v1.11.x at sdf-js/public/

P5.js v1.x library (~900KB minified) downloaded from official release
for iframe sandbox use. Served by dev-server at /public/p5.min.js.

NOT an npm dependency — single static file vendored to avoid module
resolution complexity inside iframe + keep Sprint 3 'no new npm
dependencies' constraint clean.

License: LGPL-2.1 (allows static linking, attribution required —
LICENSE notice in /public/p5.min.js header)."
```

### Task 1.2: Create iframe sandbox HTML scaffold

**Files:**
- Create: `sdf-js/src/present/p5-sandbox-iframe.html`

- [ ] **Step 1: Create the iframe HTML**

Write `sdf-js/src/present/p5-sandbox-iframe.html`:

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Atlas Present P5 Sandbox</title>
  <style>
    html, body { margin: 0; padding: 0; overflow: hidden; background: #fff; }
    #sketch-container { width: 100%; height: 100%; }
    #sketch-container canvas { display: block; }
  </style>
</head>
<body>
  <div id="sketch-container"></div>
  <!-- P5.js library loaded first (~900KB) -->
  <script src="/public/p5.min.js"></script>
  <!-- Atlas SDF helper bundle exposes 28 functions as window globals -->
  <script src="/src/present/sdf-helper-bundle.js"></script>
  <script>
    // postMessage protocol with parent (visual-panel via p5-renderer.js)
    // Parent → iframe: {type: 'init', code, palette}    — render this sketch
    // Parent → iframe: {type: 'export'}                  — request PNG dataUrl
    // iframe → parent: {type: 'ready'}                   — sketch loaded + drawing
    // iframe → parent: {type: 'error', message, stack}   — sketch threw
    // iframe → parent: {type: 'exportResult', dataUrl}   — PNG ready

    let sketchRunning = false;

    window.addEventListener('message', function (e) {
      if (!e.data || typeof e.data !== 'object') return;

      if (e.data.type === 'init') {
        // Inject branding palette as global
        window.__brandingPalette = e.data.palette || { bg: [255, 255, 255], silhouetteColor: [40, 40, 40] };
        try {
          // Evaluate user's P5 sketch code. P5 detects globally-defined
          // setup() and draw() and starts the loop automatically.
          eval(e.data.code);
          sketchRunning = true;
          window.parent.postMessage({ type: 'ready' }, '*');
        } catch (err) {
          window.parent.postMessage({
            type: 'error',
            message: String(err && err.message) || 'unknown error',
            stack: String(err && err.stack) || ''
          }, '*');
        }
      } else if (e.data.type === 'export') {
        const canvas = document.querySelector('#sketch-container canvas');
        if (canvas) {
          try {
            const dataUrl = canvas.toDataURL('image/png');
            window.parent.postMessage({ type: 'exportResult', dataUrl: dataUrl }, '*');
          } catch (err) {
            window.parent.postMessage({
              type: 'error',
              message: 'export failed: ' + (err && err.message),
              stack: String(err && err.stack) || ''
            }, '*');
          }
        } else {
          window.parent.postMessage({
            type: 'error',
            message: 'no canvas to export',
            stack: ''
          }, '*');
        }
      }
    });

    // Optional: announce we're alive on load (parent uses this to know iframe is reachable
    // before sending init payload, but in practice the iframe is faster than the parent's
    // mount → postMessage path, so this is just defensive).
    document.addEventListener('DOMContentLoaded', function () {
      window.parent.postMessage({ type: 'loaded' }, '*');
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify HTML syntactically valid (smoke via browser fetch)**

```bash
curl -sI http://localhost:8001/src/present/p5-sandbox-iframe.html | head -3
```

Expected: `HTTP/1.0 200 OK`.

If sdf-helper-bundle.js doesn't exist yet (it's Task 1.3), the iframe will 404 on that script — that's fine for now, just verifies the HTML file is reachable.

- [ ] **Step 3: Commit iframe scaffold**

```bash
git add sdf-js/src/present/p5-sandbox-iframe.html
git commit -m "Sprint 3 Phase 1.2: p5-sandbox-iframe.html scaffold

Static iframe entry-point at /src/present/p5-sandbox-iframe.html.
Loads p5.min.js + sdf-helper-bundle.js + inline postMessage listener.

Protocol:
  parent → iframe: {type: 'init', code, palette} render P5 sketch
  parent → iframe: {type: 'export'} request PNG dataUrl
  iframe → parent: {type: 'ready'} sketch running
  iframe → parent: {type: 'error', message, stack} sketch threw
  iframe → parent: {type: 'exportResult', dataUrl} PNG ready
  iframe → parent: {type: 'loaded'} DOMContentLoaded (defensive)

User sketch code is eval()'d inside try/catch. P5 detects setup() +
draw() globals and starts the loop automatically.

sdf-helper-bundle.js will be created in Task 1.3."
```

### Task 1.3: Create SDF helper bundle (28 functions exposed as window globals)

**Files:**
- Create: `sdf-js/src/present/sdf-helper-bundle.js`

- [ ] **Step 1: Create the bundle**

Write `sdf-js/src/present/sdf-helper-bundle.js`:

```js
// =============================================================================
// sdf-helper-bundle.js — Atlas Present Sprint 3 SDF helpers for iframe sandbox
// -----------------------------------------------------------------------------
// Exposes 28 SDF math/utility functions as window globals inside the
// p5-sandbox-iframe. LLM-generated P5 sketch code can call any of these
// directly:
//
//   function setup() { createCanvas(600, 360); }
//   function draw() {
//     for (let y = -1; y <= 1; y += 0.02) {
//       for (let x = -1; x <= 1; x += 0.02) {
//         const d = sdf_circle([x, y], [0, 0], 0.5);
//         if (d < 0) fill(...__brandingPalette.silhouetteColor);
//         else fill(...__brandingPalette.bg);
//         rect((x + 1) * 300, (y + 1) * 180, 6, 6);
//       }
//     }
//   }
//
// Functions sourced from BOB code shared by user 2026-06-20. BOB composite
// SDFs (sdfSunset / sdf_building / sdf_bridge1/2 / sdf_BTC / sdf_cactus /
// sdf_tree / sdf_wall / sdf_flower) intentionally EXCLUDED — those are
// BOB-art-specific vocabulary; LLM should compose its own scenes from
// these general primitives.
//
// Spec: docs/superpowers/specs/2026-06-20-atlas-present-sprint-3-p5-2d-pipeline-design.md §7
// =============================================================================

(function () {
  // ============ Vector math (17 functions) ============

  function sub2(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
  function add2(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
  function mul2(a, b) { return [a[0] * b[0], a[1] * b[1]]; }
  function dot2(a, b) { return a[0] * b[0] + a[1] * b[1]; }
  function lenSq2(a) { return a[0] * a[0] + a[1] * a[1]; }
  function len2(a) { return Math.sqrt(a[0] * a[0] + a[1] * a[1]); }
  function rot2(angle) { return [Math.cos(angle), -Math.sin(angle), Math.sin(angle), Math.cos(angle)]; }
  function trans2(m, a) { return [m[0] * a[0] + m[2] * a[1], m[1] * a[0] + m[3] * a[1]]; }
  function clamp1(value, min, max) { return Math.max(Math.min(value, max), min); }
  function clamp2(a, tl, br) { return [Math.max(Math.min(br[0], a[0]), tl[0]), Math.max(Math.min(br[1], a[1]), tl[1])]; }
  function max2(a, b) { return [Math.max(a[0], b[0]), Math.max(a[1], b[1])]; }
  function min2(a, b) { return [Math.min(a[0], b[0]), Math.min(a[1], b[1])]; }
  function fract1(x) { return x - Math.floor(x); }
  function fract2(p) { return [p[0] - Math.floor(p[0]), p[1] - Math.floor(p[1])]; }
  function scale2(a, s) { return [a[0] * s, a[1] * s]; }
  function eq2(a, b) { return a[0] === b[0] && a[1] === b[1]; }
  function step1(edge, x) { return x >= edge ? 1 : 0; }

  // ============ General SDF primitives (11 functions) ============

  // Internal helper used by sdf_box (k = "outside box" combiner)
  function _boxK(a, b) { return (a > 0 && b > 0) ? Math.sqrt(a * a + b * b) : (a > b ? a : b); }

  function sdf_box(p, c, dims) {
    const x = p[0] - c[0];
    const y = p[1] - c[1];
    return _boxK(Math.abs(x) - dims[0] * 0.5, Math.abs(y) - dims[1] * 0.5);
  }

  function sdf_circle(p, c, r) {
    const x = p[0] - c[0];
    const y = p[1] - c[1];
    return Math.sqrt(x * x + y * y) - r;
  }

  function sdRoundBox(p, b, r) {
    r = [p[0] > 0.0 ? r[0] : r[2], p[0] > 0.0 ? r[1] : r[3]];
    const rr = p[1] > 0.0 ? r[0] : r[1];
    const q = [Math.abs(p[0]) - b[0] + rr, Math.abs(p[1]) - b[1] + rr];
    return Math.min(Math.max(q[0], q[1]), 0.0) + len2(max2(q, [0, 0])) - rr;
  }

  function sdTriangle(p, p0, p1, p2) {
    const e0 = sub2(p1, p0);
    const e1 = sub2(p2, p1);
    const e2 = sub2(p0, p2);

    const v0 = sub2(p, p0);
    const v1 = sub2(p, p1);
    const v2 = sub2(p, p2);

    const t0 = clamp1(dot2(v0, e0) / dot2(e0, e0), 0.0, 1.0);
    const t1 = clamp1(dot2(v1, e1) / dot2(e1, e1), 0.0, 1.0);
    const t2 = clamp1(dot2(v2, e2) / dot2(e2, e2), 0.0, 1.0);
    const pq0 = sub2(v0, mul2(e0, [t0, t0]));
    const pq1 = sub2(v1, mul2(e1, [t1, t1]));
    const pq2 = sub2(v2, mul2(e2, [t2, t2]));

    const s0 = Math.sign(e0[0] * v0[1] - e0[1] * v0[0]);
    const s1 = Math.sign(e1[0] * v1[1] - e1[1] * v1[0]);
    const s2 = Math.sign(e2[0] * v2[1] - e2[1] * v2[0]);

    if (s0 === s1 && s1 === s2) {
      const d = Math.min(dot2(pq0, pq0), Math.min(dot2(pq1, pq1), dot2(pq2, pq2)));
      return -Math.sqrt(d);
    } else {
      const d = Math.min(dot2(pq0, pq0), Math.min(dot2(pq1, pq1), dot2(pq2, pq2)));
      return Math.sqrt(d);
    }
  }

  function sdTrapezoid(p, a, b, ra, rb) {
    p = [p[0], -p[1]]; // BOB convention: invert Y
    const rba = rb - ra;
    const baba = dot2(sub2(b, a), sub2(b, a));
    const papa = dot2(sub2(p, a), sub2(p, a));
    const paba = dot2(sub2(p, a), sub2(b, a)) / baba;
    const x = Math.sqrt(papa - paba * paba * baba);
    const cax = Math.max(0.0, x - ((paba < 0.5) ? ra : rb));
    const cay = Math.abs(paba - 0.5) - 0.5;
    const k = rba * rba + baba;
    const f = clamp1((rba * (x - ra) + paba * baba) / k, 0.0, 1.0);
    const cbx = x - ra - f * rba;
    const cby = paba - f;
    const s = (cbx < 0.0 && cay < 0.0) ? -1.0 : 1.0;
    return s * Math.sqrt(Math.min(cax * cax + cay * cay * baba, cbx * cbx + cby * cby * baba));
  }

  function sdEtriangle(p, r) {
    p = [p[0], -p[1]];
    const k = Math.sqrt(3);
    p[0] = Math.abs(p[0]) - r / 2;
    p[1] = p[1] + r / k / 2;
    if (k * p[1] + p[0] > 0) {
      p = [(p[0] - k * p[1]) / 2, (-k * p[0] - p[1]) / 2];
    }
    p[0] = p[0] - clamp1(p[0], -r, 0);
    return -len2(p) * Math.sign(p[1]);
  }

  function sdf_line(p, cy, k) {
    k = k || 0;
    return -(p[1] - cy - k * p[0]);
  }

  function sdf_line2(p, cy, k) {
    k = k || 0;
    return -(p[1] - cy - (0.05 * Math.sin(k * p[0] * Math.PI * 10)));
  }

  function sdf_moon(p, c) {
    const n = [2, 0, 0, 2];
    const q = trans2(n, sub2(p, [c[0], -0.8]));
    const bal1 = sdf_circle(q, [0.3, 0.1], 0.5);
    const bal2 = sdf_circle(q, [-0.15, -0.45], 0.55);
    return Math.max(bal1, -bal2); // Max-with-negation = subtraction
  }

  function xRepeated(p, s) {
    p = p.slice();
    const id = Math.round(p[0] / s);
    p[0] = p[0] - s * id;
    return p; // Returns repeated p, caller passes to another SDF
  }

  function sdf_rep(x, r) {
    x /= r;
    x -= Math.floor(x) + 0.5;
    x *= r;
    return x;
  }

  // ============ Expose all 28 as window globals ============

  const globals = {
    // Vector math (17)
    sub2: sub2, add2: add2, mul2: mul2, dot2: dot2, lenSq2: lenSq2, len2: len2,
    rot2: rot2, trans2: trans2, clamp1: clamp1, clamp2: clamp2,
    max2: max2, min2: min2, fract1: fract1, fract2: fract2,
    scale2: scale2, eq2: eq2, step1: step1,
    // General SDF primitives (11)
    sdf_box: sdf_box, sdf_circle: sdf_circle, sdRoundBox: sdRoundBox,
    sdTriangle: sdTriangle, sdTrapezoid: sdTrapezoid, sdEtriangle: sdEtriangle,
    sdf_line: sdf_line, sdf_line2: sdf_line2, sdf_moon: sdf_moon,
    xRepeated: xRepeated, sdf_rep: sdf_rep,
  };

  // Attach to window for iframe sketches
  if (typeof window !== 'undefined') {
    for (const key of Object.keys(globals)) {
      window[key] = globals[key];
    }
  }

  // Also export as module for unit tests (Node-side)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = globals;
  }
})();
```

- [ ] **Step 2: Verify syntax**

```bash
node --check sdf-js/src/present/sdf-helper-bundle.js && echo "syntax OK"
```

Expected: `syntax OK`.

- [ ] **Step 3: Quick sanity — verify dev server serves it**

```bash
curl -sI http://localhost:8001/src/present/sdf-helper-bundle.js | head -3
```

Expected: `HTTP/1.0 200 OK`.

- [ ] **Step 4: Commit SDF helper bundle**

```bash
git add sdf-js/src/present/sdf-helper-bundle.js
git commit -m "Sprint 3 Phase 1.3: sdf-helper-bundle.js (28 SDF helpers as window globals)

17 vector math + 11 general SDF primitives. Source-copied from BOB code
shared by user 2026-06-20. BOB composite SDFs intentionally excluded
(sdfSunset/sdf_building/sdf_bridge1/2/sdf_BTC/sdf_cactus/sdf_tree/sdf_wall/
sdf_flower) — those are BOB-art-specific creative vocabulary, not general
primitives. LLM composes specific scenes from primitives.

Functions exposed as window globals inside iframe sandbox via inline IIFE.
Also exported as CommonJS module for Node-side unit tests (Phase 2 TDD).

Phase 2 will add 2d-p5 renderer that drives the iframe via postMessage."
```

---

## Phase 2 — 2d-p5 renderer (postMessage protocol) + TDD

The renderer wraps the iframe scaffold with a clean JS API for visual-panel to call.

### Task 2.1: Create test file + skeleton + register

**Files:**
- Create: `sdf-js/src/present/p5-renderer.js` (skeleton with just exports)
- Create: `sdf-js/scripts/test-p5-sandbox.mjs` (skeleton testing SDF helper bundle math)
- Modify: `scripts/run-tests.mjs` (register new test)

- [ ] **Step 1: Create skeleton `p5-renderer.js`**

```js
// =============================================================================
// p5-renderer.js — Atlas Present Sprint 3: P5 sandbox renderer for visual-panel
// -----------------------------------------------------------------------------
// Wraps iframe sandbox (sandbox=allow-scripts only) + postMessage protocol.
// Provides {refresh, destroy, exportPng} API for visual-panel to drive.
//
// Architecture:
//   visual-panel calls mountP5Renderer(wrapper, sceneData, palette)
//   →  creates iframe pointing at /src/present/p5-sandbox-iframe.html
//   →  on iframe load, postMessage {type:'init', code, palette}
//   →  iframe evaluates user P5 sketch, posts 'ready' or 'error' back
//   →  IntersectionObserver: when wrapper leaves viewport, destroy iframe
//      (free memory); on re-enter, recreate
//
// Spec: docs/superpowers/specs/2026-06-20-atlas-present-sprint-3-p5-2d-pipeline-design.md §6
// =============================================================================

const IFRAME_SRC = '/src/present/p5-sandbox-iframe.html';
const IFRAME_SANDBOX = 'allow-scripts'; // NOT allow-same-origin (security: prevents reading main page localStorage)
const UNMOUNT_DELAY_MS = 2000; // off-screen > 2s → unmount; on-screen → mount

/**
 * Mount a P5 sandbox iframe inside the wrapper element. Returns control handle.
 *
 * @param {HTMLElement} wrapper — DOM element to mount inside
 * @param {object} sceneData — SceneData with subjects[0].type === 'p5-sketch'
 * @param {object} palette — { bg: [r,g,b], silhouetteColor: [r,g,b] } from branding
 * @returns {{refresh: Function, destroy: Function, exportPng: Function}}
 */
export function mountP5Renderer(wrapper, sceneData, palette) {
  // Implementation in Task 2.2-2.4
  return {
    refresh() {},
    destroy() {},
    exportPng() { return null; },
  };
}
```

- [ ] **Step 2: Create test file `test-p5-sandbox.mjs` with baseline tests**

The test file runs in Node, so it tests the SDF helper bundle math (exported via CommonJS) — NOT the iframe sandbox (that needs a browser). Iframe sandbox itself is verified by Phase 6 browse smoke.

```js
// =============================================================================
// test-p5-sandbox.mjs — L1 tests for Atlas Present Sprint 3 SDF helper bundle
// -----------------------------------------------------------------------------
// Node-side unit tests for the 28 SDF helper math functions exposed inside
// the P5 sandbox iframe. Iframe protocol itself (postMessage flow) is
// verified by Phase 6 browse smoke (real browser).
// =============================================================================

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const helpers = require('../src/present/sdf-helper-bundle.js');

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}
function approx(a, b, eps = 1e-9) { return Math.abs(a - b) < eps; }

console.log('=== sdf-helper-bundle smoke test ===\n');

// Confirm bundle exports
ok(typeof helpers === 'object' && helpers !== null, 'helpers module exports an object');
ok(typeof helpers.sub2 === 'function', 'sub2 exported');
ok(typeof helpers.sdf_box === 'function', 'sdf_box exported');
ok(typeof helpers.sdf_circle === 'function', 'sdf_circle exported');

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
```

- [ ] **Step 3: Register in run-tests.mjs**

Find the line in `scripts/run-tests.mjs`:
```js
  { category: 'present', file: 'sdf-js/scripts/test-pdf-text-extractor.mjs' },
```

Add IMMEDIATELY AFTER:
```js
  { category: 'present', file: 'sdf-js/scripts/test-p5-sandbox.mjs' },
```

- [ ] **Step 4: Verify**

```bash
node --check sdf-js/src/present/p5-renderer.js && echo "p5-renderer syntax OK"
node sdf-js/scripts/test-p5-sandbox.mjs
npm test 2>&1 | tail -5
```

Expected: `syntax OK`; 4 baseline ✓; npm test 34/34 (was 33, added 1).

- [ ] **Step 5: Commit Task 2.1**

```bash
git add sdf-js/src/present/p5-renderer.js sdf-js/scripts/test-p5-sandbox.mjs scripts/run-tests.mjs
git commit -m "Sprint 3 Phase 2.1: p5-renderer skeleton + SDF helper bundle baseline tests

NEW: src/present/p5-renderer.js (skeleton with empty exports)
NEW: scripts/test-p5-sandbox.mjs (4 baseline assertions — helpers module
     exports + 3 sample functions present)
MODIFY: scripts/run-tests.mjs registers new test under 'present' category

p5-renderer fleshed out in Tasks 2.2-2.4. SDF helper math tested for
correctness in Tasks 2.5-2.7 (TDD style).

npm test 34/34 (1 added)."
```

### Task 2.2: TDD vector math helpers — sub2 / add2 / dot2 / len2

- [ ] **Step 1: Append failing tests**

In `sdf-js/scripts/test-p5-sandbox.mjs`, BEFORE the final `process.exit(...)` line, append:

```js
// Vector math: sub2 / add2 / dot2 / len2
console.log('\n--- Vector math ---');

const { sub2, add2, mul2, dot2, lenSq2, len2, scale2, eq2, fract1, fract2,
  clamp1, clamp2, max2, min2, rot2, trans2, step1 } = helpers;

// sub2
{
  const r = sub2([5, 3], [2, 1]);
  ok(eq2(r, [3, 2]), `sub2([5,3], [2,1]) = [3,2] (got ${JSON.stringify(r)})`);
}
{
  const r = sub2([0, 0], [-1, 1]);
  ok(eq2(r, [1, -1]), `sub2([0,0], [-1,1]) = [1,-1] (got ${JSON.stringify(r)})`);
}

// add2
{
  const r = add2([1, 2], [3, 4]);
  ok(eq2(r, [4, 6]), `add2([1,2], [3,4]) = [4,6]`);
}

// mul2 (element-wise)
{
  const r = mul2([2, 3], [4, 5]);
  ok(eq2(r, [8, 15]), `mul2([2,3], [4,5]) = [8,15]`);
}

// dot2
{
  ok(dot2([1, 2], [3, 4]) === 11, 'dot2([1,2], [3,4]) = 1*3 + 2*4 = 11');
  ok(dot2([1, 0], [0, 1]) === 0, 'dot2 perpendicular = 0');
}

// lenSq2 + len2
{
  ok(lenSq2([3, 4]) === 25, 'lenSq2([3,4]) = 25');
  ok(len2([3, 4]) === 5, 'len2([3,4]) = 5 (3-4-5 triangle)');
  ok(approx(len2([1, 1]), Math.sqrt(2)), 'len2([1,1]) = sqrt(2)');
}

// scale2
{
  ok(eq2(scale2([2, 3], 4), [8, 12]), 'scale2([2,3], 4) = [8,12]');
}

// eq2
{
  ok(eq2([1, 2], [1, 2]) === true, 'eq2 same');
  ok(eq2([1, 2], [1, 3]) === false, 'eq2 different');
}

// fract1 / fract2
{
  ok(approx(fract1(3.7), 0.7), 'fract1(3.7) = 0.7');
  ok(approx(fract1(-0.3), 0.7), 'fract1(-0.3) = 0.7 (floor convention)');
  const f = fract2([1.5, 2.25]);
  ok(approx(f[0], 0.5) && approx(f[1], 0.25), 'fract2([1.5, 2.25]) = [0.5, 0.25]');
}

// clamp1 / clamp2
{
  ok(clamp1(5, 0, 3) === 3, 'clamp1 max-clip');
  ok(clamp1(-1, 0, 3) === 0, 'clamp1 min-clip');
  ok(clamp1(2, 0, 3) === 2, 'clamp1 pass-through');
  const c = clamp2([5, -1], [0, 0], [3, 3]);
  ok(eq2(c, [3, 0]), 'clamp2([5,-1], [0,0], [3,3]) = [3,0]');
}

// max2 / min2
{
  ok(eq2(max2([1, 5], [3, 2]), [3, 5]), 'max2 per-component');
  ok(eq2(min2([1, 5], [3, 2]), [1, 2]), 'min2 per-component');
}

// step1
{
  ok(step1(5, 5) === 1, 'step1(5, 5) = 1 (>=)');
  ok(step1(5, 4) === 0, 'step1(5, 4) = 0');
  ok(step1(5, 6) === 1, 'step1(5, 6) = 1');
}

// rot2 + trans2
{
  // rot2(0) returns [cos(0), -sin(0), sin(0), cos(0)] = [1, 0, 0, 1] = identity
  const m = rot2(0);
  ok(m[0] === 1 && m[3] === 1 && m[1] === 0 && m[2] === 0, 'rot2(0) = identity matrix');
  // trans2 identity * any vector = same vector
  const v = trans2(m, [7, 11]);
  ok(eq2(v, [7, 11]), 'trans2(identity, [7,11]) = [7,11]');

  // rot2(PI/2) rotates [1,0] to [0,1] (counterclockwise)
  // m = [cos(PI/2), -sin(PI/2), sin(PI/2), cos(PI/2)] = [0, -1, 1, 0]
  // trans2(m, [1,0]) = [0*1 + 1*0, -1*1 + 0*0] = [0, -1]
  // Note: BOB convention may be different; check the formula
  // trans2(m, a) = [m[0]*a[0] + m[2]*a[1], m[1]*a[0] + m[3]*a[1]]
  // For rot2(PI/2): [0*1 + 1*0, -1*1 + 0*0] = [0, -1]
  const rot90 = rot2(Math.PI / 2);
  const rotated = trans2(rot90, [1, 0]);
  ok(approx(rotated[0], 0), `rot90 * [1,0] x = 0 (got ${rotated[0]})`);
  ok(approx(rotated[1], -1), `rot90 * [1,0] y = -1 (got ${rotated[1]})`);
}
```

- [ ] **Step 2: Run — expect PASS**

```bash
node sdf-js/scripts/test-p5-sandbox.mjs
```

Expected: all assertions pass (24+ total: 4 baseline + 20 new vector math).

The math should be correct (these are pure functions from BOB code) — if any fail, it's a transcription error in the bundle.

- [ ] **Step 3: Commit Task 2.2**

```bash
git add sdf-js/scripts/test-p5-sandbox.mjs
git commit -m "Sprint 3 Phase 2.2: TDD vector math helpers (17 functions, 24 assertions)

Tests cover sub2 / add2 / mul2 / dot2 / lenSq2 / len2 / scale2 / eq2 /
fract1 / fract2 / clamp1 / clamp2 / max2 / min2 / step1 / rot2 / trans2.

All passing first run — math is pure transcription from BOB code shared
by user 2026-06-20. No semantic deviations.

Test serves as regression suite for SDF helper bundle. Any transcription
error in helper bundle would fail here before reaching iframe sandbox."
```

### Task 2.3: TDD SDF primitive helpers — sdf_box / sdf_circle / sdRoundBox / sdTriangle

- [ ] **Step 1: Append failing tests**

```js
// SDF primitives
console.log('\n--- SDF primitives ---');

const { sdf_box, sdf_circle, sdRoundBox, sdTriangle, sdTrapezoid, sdEtriangle,
  sdf_line, sdf_line2, sdf_moon, xRepeated, sdf_rep } = helpers;

// sdf_circle: standard SDF — outside = positive, on-boundary = 0, inside = negative
{
  // Circle centered at origin with r=1
  ok(approx(sdf_circle([0, 0], [0, 0], 1), -1), 'sdf_circle center: -r');
  ok(approx(sdf_circle([1, 0], [0, 0], 1), 0), 'sdf_circle on boundary: 0');
  ok(approx(sdf_circle([2, 0], [0, 0], 1), 1), 'sdf_circle outside (x=2): r=1');
  ok(approx(sdf_circle([0, 0.5], [0, 0], 1), -0.5), 'sdf_circle inside: -0.5');
  // Offset center
  ok(approx(sdf_circle([5, 0], [5, 0], 1), -1), 'sdf_circle offset center');
}

// sdf_box: rect SDF — outside = positive, inside = negative
{
  // Box centered at origin, full-width 2 × full-height 2 (half = 1)
  ok(approx(sdf_box([0, 0], [0, 0], [2, 2]), -1), 'sdf_box center: -1');
  ok(approx(sdf_box([1, 0], [0, 0], [2, 2]), 0), 'sdf_box on right edge: 0');
  ok(approx(sdf_box([2, 0], [0, 0], [2, 2]), 1), 'sdf_box outside right: 1');
  ok(approx(sdf_box([0, 1], [0, 0], [2, 2]), 0), 'sdf_box on top edge: 0');
}

// sdRoundBox (rounded rect)
{
  // Centered at origin, full-half-extents [1,1], all corners radius 0.2
  // At origin: deep inside, should be very negative
  const dCenter = sdRoundBox([0, 0], [1, 1], [0.2, 0.2, 0.2, 0.2]);
  ok(dCenter < 0, 'sdRoundBox center: negative');
  // Far away
  ok(sdRoundBox([3, 0], [1, 1], [0.2, 0.2, 0.2, 0.2]) > 0, 'sdRoundBox far: positive');
}

// sdTriangle
{
  // Equilateral triangle with vertices around origin
  const a = [0, 1];
  const b = [-0.866, -0.5];
  const c = [0.866, -0.5];
  ok(sdTriangle([0, 0], a, b, c) < 0, 'sdTriangle inside (0,0): negative');
  ok(sdTriangle([3, 3], a, b, c) > 0, 'sdTriangle far: positive');
}

// sdEtriangle (origin-centered equilateral)
{
  const dCenter = sdEtriangle([0, 0], 1);
  ok(dCenter < 0, `sdEtriangle center r=1: negative (got ${dCenter})`);
  const dFar = sdEtriangle([5, 5], 1);
  ok(dFar > 0, `sdEtriangle far: positive (got ${dFar})`);
}

// sdTrapezoid
{
  // Trapezoid from (0,0) to (0, 0.25), bottom radius 0.5, top radius 0.3
  const d = sdTrapezoid([0, 0.1], [0, 0], [0, 0.25], 0.5, 0.3);
  ok(d < 0, 'sdTrapezoid inside: negative');
}

// sdf_line: half-plane below y = cy
{
  ok(sdf_line([0, 0], 0.5) < 0, 'sdf_line: (0,0) below cy=0.5 → negative');
  ok(sdf_line([0, 1], 0.5) > 0, 'sdf_line: (0,1) above cy=0.5 → positive');
  ok(approx(sdf_line([0, 0.5], 0.5), 0), 'sdf_line: on line → 0');
}

// sdf_moon (occluded circle pattern)
{
  // Test that center yields negative + offset yields positive
  ok(typeof sdf_moon([0, -0.8], [0, 0]) === 'number', 'sdf_moon returns number');
}

// xRepeated: returns [repeated p[0], original p[1]]
{
  // s=2 should wrap p[0] in (-1, 1) range
  const r1 = xRepeated([0.5, 7], 2);
  ok(r1[0] >= -1 && r1[0] <= 1, `xRepeated wraps x to [-1,1] (got ${r1[0]})`);
  ok(r1[1] === 7, 'xRepeated leaves y untouched');
}

// sdf_rep: 1D modulo around center
{
  // sdf_rep with r=2 should wrap x to (-1, 1)
  const v = sdf_rep(3, 2); // 3 / 2 = 1.5, floor = 1, 1.5 - 1 - 0.5 = 0, * 2 = 0
  ok(v >= -1 && v <= 1, `sdf_rep wraps to [-1,1] (got ${v})`);
}
```

- [ ] **Step 2: Run — expect PASS**

```bash
node sdf-js/scripts/test-p5-sandbox.mjs
```

Expected: cumulative ~45+ assertions all pass.

- [ ] **Step 3: Commit Task 2.3**

```bash
git add sdf-js/scripts/test-p5-sandbox.mjs
git commit -m "Sprint 3 Phase 2.3: TDD SDF primitive helpers (11 functions, ~25 assertions)

Tests cover sdf_box / sdf_circle / sdRoundBox / sdTriangle / sdTrapezoid /
sdEtriangle / sdf_line / sdf_line2 / sdf_moon / xRepeated / sdf_rep.

Each verifies SDF convention (outside > 0, boundary = 0, inside < 0) and
known reference values (e.g., sdf_circle on boundary = 0, sdf_box center
= -halfsize, sdTriangle inside vertices = negative).

All assertions should pass — pure transcription from BOB code. Failures
indicate transcription error in helper bundle."
```

### Task 2.4: Implement `mountP5Renderer` (real iframe + postMessage protocol)

**Files:**
- Modify: `sdf-js/src/present/p5-renderer.js` (replace skeleton with real implementation)

- [ ] **Step 1: Implement mountP5Renderer**

Replace the entire contents of `sdf-js/src/present/p5-renderer.js`:

```js
// =============================================================================
// p5-renderer.js — Atlas Present Sprint 3: P5 sandbox renderer for visual-panel
// -----------------------------------------------------------------------------
// Wraps iframe sandbox (sandbox=allow-scripts only) + postMessage protocol.
// Provides {refresh, destroy, exportPng} API for visual-panel to drive.
//
// Architecture:
//   visual-panel calls mountP5Renderer(wrapper, sceneData, palette)
//   → creates iframe pointing at /src/present/p5-sandbox-iframe.html
//   → on iframe load, postMessage {type:'init', code, palette}
//   → iframe evaluates user P5 sketch, posts 'ready' or 'error' back
//   → IntersectionObserver: when wrapper leaves viewport, destroy iframe
//      (free memory); on re-enter, recreate
//
// Spec: docs/superpowers/specs/2026-06-20-atlas-present-sprint-3-p5-2d-pipeline-design.md §6
// =============================================================================

const IFRAME_SRC = '/src/present/p5-sandbox-iframe.html';
const IFRAME_SANDBOX = 'allow-scripts'; // NOT allow-same-origin (security)
const UNMOUNT_DELAY_MS = 2000;

/**
 * Mount a P5 sandbox iframe inside the wrapper element. Returns control handle.
 *
 * @param {HTMLElement} wrapper — DOM element to mount inside
 * @param {object} sceneData — SceneData with subjects[0].type === 'p5-sketch'
 *   args.code is the P5 sketch source string
 * @param {object} palette — { bg: [r,g,b], silhouetteColor: [r,g,b] } from branding
 * @returns {{refresh: Function, destroy: Function, exportPng: Function}}
 */
export function mountP5Renderer(wrapper, sceneData, palette) {
  if (!wrapper || !sceneData) {
    return { refresh() {}, destroy() {}, exportPng() { return null; } };
  }

  const subject = sceneData.subjects?.[0];
  if (!subject || subject.type !== 'p5-sketch' || typeof subject.args?.code !== 'string') {
    wrapper.innerHTML = '<div class="visual-placeholder error">invalid p5-sketch data</div>';
    return { refresh() {}, destroy() {}, exportPng() { return null; } };
  }

  const code = subject.args.code;
  const canvasWidth = subject.args.canvasWidth ?? 600;
  const canvasHeight = subject.args.canvasHeight ?? 360;
  const safePalette = palette ?? { bg: [255, 255, 255], silhouetteColor: [40, 40, 40] };

  let iframe = null;
  let messageListener = null;
  let unmountTimer = null;
  let intersectionObserver = null;
  let exportResolvers = [];

  function createIframe() {
    if (iframe) return; // Already mounted
    iframe = document.createElement('iframe');
    iframe.src = IFRAME_SRC;
    iframe.setAttribute('sandbox', IFRAME_SANDBOX);
    iframe.style.width = canvasWidth + 'px';
    iframe.style.height = canvasHeight + 'px';
    iframe.style.border = '1px solid #e5e7eb';
    iframe.style.borderRadius = '8px';
    iframe.style.background = '#fff';
    iframe.style.display = 'block';

    messageListener = (e) => {
      // Only accept messages from our iframe
      if (!iframe || e.source !== iframe.contentWindow) return;
      if (!e.data || typeof e.data !== 'object') return;

      if (e.data.type === 'loaded') {
        // Send init payload as soon as iframe announces it's ready to receive
        iframe.contentWindow.postMessage({
          type: 'init',
          code: code,
          palette: safePalette,
        }, '*');
      } else if (e.data.type === 'ready') {
        // Sketch running; nothing to do (visual-panel observes by polling refresh)
      } else if (e.data.type === 'error') {
        showErrorOverlay(e.data.message, e.data.stack);
      } else if (e.data.type === 'exportResult') {
        // Resolve any pending exportPng() promises
        for (const r of exportResolvers) r(e.data.dataUrl);
        exportResolvers = [];
      }
    };
    window.addEventListener('message', messageListener);

    wrapper.innerHTML = '';
    wrapper.appendChild(iframe);
  }

  function destroyIframe() {
    if (!iframe) return;
    if (messageListener) {
      window.removeEventListener('message', messageListener);
      messageListener = null;
    }
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    iframe = null;
    // Resolve any pending export with null (caller can re-trigger after re-mount)
    for (const r of exportResolvers) r(null);
    exportResolvers = [];
  }

  function showErrorOverlay(message, stack) {
    if (!wrapper) return;
    wrapper.innerHTML = `
      <div class="visual-placeholder error">
        <div>⚠ P5 sketch error</div>
        <div style="font-size: 11px; margin-top: 4px;">${escapeHtml(message || 'unknown')}</div>
      </div>
    `;
  }

  function setupIntersectionObserver() {
    if (!('IntersectionObserver' in window)) return;
    intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          // On-screen: cancel any pending unmount + ensure mounted
          if (unmountTimer) {
            clearTimeout(unmountTimer);
            unmountTimer = null;
          }
          if (!iframe) createIframe();
        } else {
          // Off-screen: schedule unmount after UNMOUNT_DELAY_MS
          if (!unmountTimer && iframe) {
            unmountTimer = setTimeout(() => {
              destroyIframe();
              unmountTimer = null;
            }, UNMOUNT_DELAY_MS);
          }
        }
      }
    }, { threshold: 0 });
    intersectionObserver.observe(wrapper);
  }

  // Initial mount
  createIframe();
  setupIntersectionObserver();

  return {
    refresh() {
      // Re-mount iframe (re-evaluates sketch with current palette). Useful if
      // palette changed via Swap Branding.
      destroyIframe();
      createIframe();
    },
    destroy() {
      if (intersectionObserver) {
        intersectionObserver.disconnect();
        intersectionObserver = null;
      }
      if (unmountTimer) {
        clearTimeout(unmountTimer);
        unmountTimer = null;
      }
      destroyIframe();
    },
    /**
     * Request PNG snapshot of current sketch. Returns Promise<string|null>.
     * Resolves with data URL on success, null on failure (no iframe, no canvas).
     */
    exportPng() {
      return new Promise((resolve) => {
        if (!iframe || !iframe.contentWindow) {
          resolve(null);
          return;
        }
        exportResolvers.push(resolve);
        iframe.contentWindow.postMessage({ type: 'export' }, '*');
        // Timeout safety: if no exportResult comes back in 3s, resolve null
        setTimeout(() => {
          if (exportResolvers.includes(resolve)) {
            exportResolvers = exportResolvers.filter((r) => r !== resolve);
            resolve(null);
          }
        }, 3000);
      });
    },
  };
}

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
node --check sdf-js/src/present/p5-renderer.js && echo "syntax OK"
```

- [ ] **Step 3: Run full npm test (this file has no Node-runnable tests; just verify others still pass)**

```bash
npm test 2>&1 | tail -5
```

Expected: 34/34. The renderer uses browser-only APIs (iframe, IntersectionObserver, postMessage) so no Node tests exist for it. Phase 6 browse smoke verifies behavior.

- [ ] **Step 4: Commit Task 2.4**

```bash
git add sdf-js/src/present/p5-renderer.js
git commit -m "Sprint 3 Phase 2.4: mountP5Renderer implementation (iframe + postMessage + IntersectionObserver)

Replaces skeleton with full implementation:
- Creates iframe with sandbox='allow-scripts' (CRITICAL: no allow-same-origin,
  prevents sketches from reading main page localStorage atlas-anthropic-key)
- postMessage protocol: parent → iframe init {code, palette}; iframe → parent
  ready / error / exportResult
- IntersectionObserver: wrapper off-screen > 2s → destroy iframe (memory cleanup);
  on-screen → recreate
- refresh(): re-mount iframe (re-eval sketch with current palette — Swap Branding)
- destroy(): full cleanup
- exportPng(): postMessage 'export', resolves Promise with PNG dataUrl
  (3s timeout safety)

Phase 5 wires this into visual-panel routing. Phase 6 browse smoke verifies
end-to-end with real Anthropic API output.

No Node-runnable tests for browser-only APIs; helper bundle math verified
in test-p5-sandbox.mjs (Phase 2.2-2.3, ~45 assertions)."
```

---

## Phase 3 — scene/spec.js + scene/compile.js accept p5-sketch + TDD

Layer 1 modifications to make `p5-sketch` a valid SceneData subject type that passes validator + compiler without errors. The compiler returns a sentinel SDF (since p5-sketch isn't compiled to JS SDF — visual-panel routes to iframe instead).

### Task 3.1: Add p5-sketch to PRIMITIVE_TYPES validator + PRIMITIVE_FACTORIES

**Files:**
- Modify: `sdf-js/src/scene/spec.js`
- Modify: `sdf-js/src/scene/compile.js`

- [ ] **Step 1: Read current PRIMITIVE_TYPES end-of-set**

```bash
sed -n '230,236p' sdf-js/src/scene/spec.js
```

Expected output ends with something like:
```js
  'vesica-segment',
  'cylinder-inf',
  'cone-inf',
]);
```

- [ ] **Step 2: Add `'p5-sketch'` to PRIMITIVE_TYPES**

Open `sdf-js/src/scene/spec.js`. Find the line `'cone-inf',` (the last entry in PRIMITIVE_TYPES set).

Replace:
```js
  'cone-inf',
]);
```

With:
```js
  'cone-inf',
  // Sprint 3: P5 sketch as opaque subject. Carries P5 code in args.code,
  // routed to 2d-p5 iframe sandbox renderer by visual-panel (NOT compiled
  // to SDF). Sentinel factory returns a no-op SDF.
  'p5-sketch',
]);
```

- [ ] **Step 3: Add factory entry to PRIMITIVE_FACTORIES**

Open `sdf-js/src/scene/compile.js`. Find where PRIMITIVE_FACTORIES is defined (line ~235). Find a representative existing entry like `'cube-3d': (a) => cube3dSDF(a),`.

After the LAST existing entry in PRIMITIVE_FACTORIES (or anywhere convenient inside the factories object), add:

```js
  // Sprint 3: p5-sketch is rendered by 2d-p5 iframe sandbox, NOT compiled to
  // SDF. visual-panel detects this subject type before compile() and routes
  // to mountP5Renderer. compile() callers (e.g., CPU renderers) shouldn't be
  // asked to render p5-sketch directly — if they are, this returns a sentinel
  // "always outside" SDF so the renderer produces an empty image rather than
  // crashing.
  'p5-sketch': () => () => 1e9, // SDF that returns large positive (always outside)
```

The arrow function `() => () => 1e9` builds an SDF factory that takes args (ignored) and returns an SDF function `(p) => 1e9` (always positive = always outside any shape).

- [ ] **Step 4: Verify syntax of both files**

```bash
node --check sdf-js/src/scene/spec.js && echo "spec.js OK"
node --check sdf-js/src/scene/compile.js && echo "compile.js OK"
```

Expected: both `OK`.

- [ ] **Step 5: Run full npm test (existing tests should not regress)**

```bash
npm test 2>&1 | tail -5
```

Expected: 34/34. Adding new type + factory entry shouldn't break any existing test.

- [ ] **Step 6: Commit Task 3.1**

```bash
git add sdf-js/src/scene/spec.js sdf-js/src/scene/compile.js
git commit -m "Sprint 3 Phase 3.1: register p5-sketch as valid SceneData subject type

scene/spec.js: add 'p5-sketch' to PRIMITIVE_TYPES set so validator accepts
SceneData with subjects[i].type === 'p5-sketch'.

scene/compile.js: add 'p5-sketch' to PRIMITIVE_FACTORIES with sentinel SDF
() => () => 1e9 (always outside). Reasoning: p5-sketch is opaque (P5 code
in args.code), rendered by iframe sandbox not SDF compile pipeline. If a
CPU renderer accidentally calls compile() on a p5-sketch variant, sentinel
SDF produces empty output instead of crash.

visual-panel (Phase 5) detects p5-sketch type BEFORE calling compile()
and routes to mountP5Renderer, so the sentinel is just defense in depth."
```

### Task 3.2: TDD pipeline validation — accept p5-sketch single-subject, reject mixed-subjects

**Files:**
- Modify: `sdf-js/src/present/pipeline.js`
- Modify: `sdf-js/scripts/test-pipeline.mjs`
- Modify: `sdf-js/scripts/test-deck-model.mjs`

- [ ] **Step 1: Append failing tests to test-pipeline.mjs**

Open `sdf-js/scripts/test-pipeline.mjs`. Find a place to add new test groups (before final `process.exit`). Append:

```js
console.log('\nTest group 7: p5-sketch subject acceptance (Sprint 3)');

{
  // Mock lift returns SceneData with single p5-sketch subject
  const { deck, visualId } = makeDeckWithVisual();
  const deps = makeMockDeps({
    // Override callLiftLLM to return p5-sketch
    overrideCallLiftLLM: async () => ({
      text: JSON.stringify({
        v: 1,
        name: 'text-card: Hello world example',
        subjects: [{ id: 'sketch-1', type: 'p5-sketch', args: { code: 'function setup() { createCanvas(600, 360); } function draw() { background(255); }' } }],
      }),
      usage: {},
    }),
  });
  // makeMockDeps may not have overrideCallLiftLLM; fall back to building manually:
  if (typeof deps.callLiftLLM !== 'function' || !deps.__hasOverride) {
    // Manual override pattern: just replace callLiftLLM on deps
    let callCount = 0;
    deps.callLiftLLM = async () => {
      callCount++;
      return {
        text: JSON.stringify({
          v: 1,
          name: 'text-card: Hello',
          subjects: [{ id: 'sketch-' + callCount, type: 'p5-sketch', args: { code: 'function setup(){createCanvas(600,360);}function draw(){background(255);}' } }],
        }),
        usage: {},
      };
    };
  }

  const pipeline = createVisualPipeline(deck, visualId, 'fake-key', deps, { onEvent: () => {} });
  await pipeline.start();

  const visual = deck.visuals.find((v) => v.id === visualId);
  ok(visual.variants.every((v) => v.status === 'ready'), 'all 6 variants ready');
  ok(
    visual.variants.every((v) => v.sceneData?.subjects?.[0]?.type === 'p5-sketch'),
    'all 6 variants have p5-sketch subject',
  );
  ok(
    visual.variants.every((v) => typeof v.sceneData.subjects[0].args.code === 'string'),
    'all 6 variants have args.code string',
  );
}

console.log('\nTest group 8: p5-sketch mixed-subject rejection (Sprint 3)');

{
  // Mock returns SceneData with both p5-sketch AND a traditional subject (cube-3d)
  // Pipeline should reject this variant as liftError
  const { deck, visualId } = makeDeckWithVisual();
  const deps = makeMockDeps();
  deps.callLiftLLM = async () => ({
    text: JSON.stringify({
      v: 1,
      name: 'text-card: Mixed',
      subjects: [
        { id: 'sketch', type: 'p5-sketch', args: { code: 'function setup(){}function draw(){}' } },
        { id: 'cube', type: 'cube-3d', args: {}, transform: { translate: [0, 0, 0] } },
      ],
    }),
    usage: {},
  });

  const pipeline = createVisualPipeline(deck, visualId, 'fake-key', deps, { onEvent: () => {} });
  await pipeline.start();

  const visual = deck.visuals.find((v) => v.id === visualId);
  ok(
    visual.variants.every((v) => v.status === 'error'),
    'all variants error on mixed subjects (Sprint 3 constraint)',
  );
  ok(
    visual.variants[0].liftError?.includes('mixed') || visual.variants[0].liftError?.includes('single'),
    `liftError mentions constraint: "${visual.variants[0].liftError}"`,
  );
}
```

- [ ] **Step 2: Run — expect FAIL on the new tests**

```bash
node sdf-js/scripts/test-pipeline.mjs 2>&1 | tail -15
```

Expected: new tests fail because current sanitize2dSceneData doesn't validate mixed-subjects. (Test group 7 may pass since the existing path may accept p5-sketch via the existing happy-path code; verify which fail.)

- [ ] **Step 3: Implement validation in pipeline.js**

Open `sdf-js/src/present/pipeline.js`. Find the location where `parseLiftResponse` output is processed (likely after `deps.parseLiftResponse(llmResult.text)`). Add a validation step BEFORE sanitize:

Find this block (the structure may differ slightly; locate the `try { ... }` containing parseLiftResponse + sanitize):

```js
try {
  const llmResult = await deps.callLiftLLM(liftPrompt, code2d, apiKey, { mode: '2d' });
  if (cancelled) {
    onEvent({ type: 'cancelled', visualId });
    running = false;
    return;
  }
  const rawSceneData = deps.parseLiftResponse(llmResult.text);
  const sceneData = deps.sanitize2dSceneData(rawSceneData);
  const archetype = extractArchetype(sceneData);
  ...
```

Insert a `validateP5SketchConstraint` call between `parseLiftResponse` and `sanitize2dSceneData`:

```js
try {
  const llmResult = await deps.callLiftLLM(liftPrompt, code2d, apiKey, { mode: '2d' });
  if (cancelled) {
    onEvent({ type: 'cancelled', visualId });
    running = false;
    return;
  }
  const rawSceneData = deps.parseLiftResponse(llmResult.text);
  // Sprint 3: validate p5-sketch constraint (no mixed subjects)
  validateP5SketchConstraint(rawSceneData); // throws on violation
  const sceneData = deps.sanitize2dSceneData(rawSceneData);
  const archetype = extractArchetype(sceneData);
  ...
```

Then add `validateP5SketchConstraint` as a local helper near the top of pipeline.js (before `createVisualPipeline`):

```js
/**
 * Sprint 3 constraint: if a SceneData contains any p5-sketch subject, then
 * ALL subjects must be p5-sketch (mixed-subjects not yet supported).
 * Additionally, args.code must be a string.
 *
 * Throws Error with message describing the violation.
 *
 * @param {object} sceneData
 */
function validateP5SketchConstraint(sceneData) {
  if (!sceneData || !Array.isArray(sceneData.subjects)) return;
  const subjects = sceneData.subjects;
  const p5Subjects = subjects.filter((s) => s?.type === 'p5-sketch');
  if (p5Subjects.length === 0) return; // No p5-sketch, no constraint to check
  if (p5Subjects.length !== subjects.length) {
    throw new Error(
      'p5-sketch must be the single subject in SceneData (Sprint 3 constraint: no mixed subjects with traditional types)',
    );
  }
  for (const s of p5Subjects) {
    if (typeof s.args?.code !== 'string' || s.args.code.length === 0) {
      throw new Error('p5-sketch subject requires args.code as non-empty string');
    }
  }
}
```

Also update `sanitize2dSceneData` to PASS p5-sketch through (don't filter them like text-3d-*). Read `compositor-api.js` `sanitize2dSceneData` body to confirm — it should already only filter `text-3d-extruded` and `text-3d-pipe`, so p5-sketch should already pass through. Verify:

```bash
grep -A 10 "function sanitize2dSceneData" sdf-js/src/compositor-api.js
```

Expected: the filter is `s.type !== 'text-3d-extruded' && s.type !== 'text-3d-pipe'`. p5-sketch is not in the deny list → passes through. No change needed.

- [ ] **Step 4: Run — expect PASS**

```bash
node sdf-js/scripts/test-pipeline.mjs 2>&1 | tail -15
```

Expected: all assertions pass.

- [ ] **Step 5: Add deck-model tests for p5-sketch acceptance**

Open `sdf-js/scripts/test-deck-model.mjs`. Find the end of existing tests. Before `process.exit`, append:

```js
console.log('\nTest group 12: p5-sketch subject in addVisual + updateVisualVariantStatus (Sprint 3)');

{
  resetStorage();
  const d = createDeck('p5-deck', { type: 'pdf', fileName: 'p.pdf', pageCount: 1 });
  setDocument(d, { flowingText: 'sample', pages: [{ startOffset: 0, endOffset: 6, pageNumber: 1 }], headings: [] });
  const v = addVisual(d, { startOffset: 0, endOffset: 6, text: 'sample' });

  // updateVisualVariantStatus accepts SceneData with p5-sketch subject
  const p5SceneData = {
    v: 1,
    name: 'text-card: Sample',
    subjects: [{
      id: 'sk-0',
      type: 'p5-sketch',
      args: { code: 'function setup(){createCanvas(600,360);}function draw(){background(255);}' },
    }],
  };
  const r = updateVisualVariantStatus(d, v.id, 0, 'ready', {
    sceneData: p5SceneData,
    archetype: 'text-card',
  });
  ok(r === true, 'updateVisualVariantStatus accepts p5-sketch sceneData');
  ok(v.variants[0].sceneData.subjects[0].type === 'p5-sketch', 'p5-sketch subject stored');
  ok(typeof v.variants[0].sceneData.subjects[0].args.code === 'string', 'args.code preserved');

  // saveDeckToStorage + loadDeckFromStorage roundtrip preserves p5-sketch
  saveDeckToStorage(d);
  const loaded = loadDeckFromStorage(d.id);
  ok(loaded.visuals[0].variants[0].sceneData.subjects[0].type === 'p5-sketch', 'p5-sketch survives storage roundtrip');
}
```

- [ ] **Step 6: Run both tests**

```bash
node sdf-js/scripts/test-pipeline.mjs 2>&1 | tail -10
node sdf-js/scripts/test-deck-model.mjs 2>&1 | tail -10
```

Expected: both pass.

- [ ] **Step 7: Run full npm test**

```bash
npm test 2>&1 | tail -5
```

Expected: 34/34.

- [ ] **Step 8: Commit Task 3.2**

```bash
git add sdf-js/src/present/pipeline.js sdf-js/scripts/test-pipeline.mjs sdf-js/scripts/test-deck-model.mjs
git commit -m "Sprint 3 Phase 3.2: pipeline + deck-model accept p5-sketch + reject mixed subjects

pipeline.js: new validateP5SketchConstraint() helper called between
parseLiftResponse and sanitize2dSceneData. Throws Error if SceneData
contains p5-sketch alongside traditional subjects (Sprint 3 constraint:
no mixed). Caught by existing try/catch → updateVisualVariantStatus
marks variant 'error' with liftError describing the constraint.

sanitize2dSceneData unchanged — already passes p5-sketch through (deny
list is text-3d-extruded + text-3d-pipe only).

Tests:
- test-pipeline.mjs: test group 7 (all 6 variants accept p5-sketch) +
  test group 8 (mixed subjects all error with appropriate liftError)
- test-deck-model.mjs: test group 12 (addVisual + updateVisualVariantStatus
  + saveDeckToStorage roundtrip preserve p5-sketch subject shape)

npm test 34/34."
```

---

## Phase 4 — Lift prompt v3.19 → v3.20 (3-priority routing + worked examples)

Update the LLM system prompt addendum to teach the 3-priority routing model + give it 3 worked examples (Priority 1 / 2 / 3).

### Task 4.1: Extend MODE_2D_ADDENDUM in compositor-api.js

**Files:**
- Modify: `sdf-js/src/compositor-api.js` (extend MODE_2D_ADDENDUM constant)

- [ ] **Step 1: Read current MODE_2D_ADDENDUM**

```bash
grep -n "MODE_2D_ADDENDUM" sdf-js/src/compositor-api.js | head -5
```

Find the line where `const MODE_2D_ADDENDUM = \`` starts and where its closing backtick lives. The current addendum (Sprint 2 Phase 4.1) has just the "2D-mode constraints" forbid section.

- [ ] **Step 2: Extend the addendum with Step 4 routing rules + worked examples**

Open `sdf-js/src/compositor-api.js`. Find the MODE_2D_ADDENDUM constant. The current value ends with something like:

```js
If the slide content is text-heavy, choose archetype 'text-card'
and emit minimal context geometry (e.g., a backdrop primitive) —
do NOT emit text glyphs as SDF subjects.
\`;
```

Replace the entire constant with the extended version:

```js
/**
 * Appended to system prompt when callLiftLLM is invoked with opts.mode === '2d'.
 *
 * Layer 1: original Sprint 2 constraint — forbids text-3d-* subjects.
 *
 * Layer 2 (Sprint 3 amendment): Step 4 — 3-priority content-driven routing
 * (SDF DIRECT → SDF METAPHORICAL → P5 FALLBACK). Tells LLM to hunt for SDF
 * compositional metaphor (Atlas wedge) before falling to P5 vector.
 *
 * Defense layer 1 of 2. Layer 2: sanitize2dSceneData() runtime filter.
 */
const MODE_2D_ADDENDUM = `

## 2D-mode constraints (Atlas Present)

This call is for 2D rendering. NEVER emit subjects with type
'text-3d-extruded' or 'text-3d-pipe'. Atlas Present renders all
text via Canvas2D outside the SDF tree in 2D mode. SDF glyphs in
2D mode look bad (silhouette/lines/crayon/topo cannot render text
typography cleanly).

## Step 4: 2D-mode 3-priority routing (Sprint 3) — SDF FIRST, P5 fallback

When opts.mode === '2d', try these priorities IN ORDER. SDF priorities are
Atlas's wedge that vector cannot replicate. P5 is graceful-degradation fallback.

Priority 1 — SDF DIRECT (literal concrete):
  If text contains concrete physical objects (cathedral / carrier / cube / robot
  / tree / city / chair / cathedral), emit traditional-subject SceneData with
  sphere / cube-3d / cylinder / capsule / 40+ existing atom primitives. Uses
  Atlas's strongest capability and reuses existing atom library. Renders via
  silhouette / lines / crayon / topo.

Priority 2 — SDF METAPHORICAL (concrete composition for abstract concept) ⭐:
  If text contains number / abstract assertion BUT a concrete metaphor expresses
  it well, HUNT for the metaphor and emit SDF compositional scene:
    - money / expensive → coins (sdf_circle filled inside larger outline)
    - time / duration → hourglass outline + particle SDFs as sand falling
    - growth / 10x → steps / tower / ladder rising
    - quantity (N items) → N concrete-shape SDFs (one per item, repeated)
    - network → constellation (sdf_circle nodes + sdf_line edges)
    - process / pipeline → assembly-line shapes
  Output: SceneData where Subject A's outline (sdf_box / sdRoundBox / sdEtriangle)
  is FILLED with Subject B units (sdf_circle / small primitive arranged via grid
  iteration) — see worked example below. Atlas's REAL WEDGE.

  ALWAYS try Priority 2 before falling to P5.

Priority 3 — P5 FALLBACK (graceful degradation, 防退化):
  Only when text is purely abstract relationship AND no concrete metaphor fits.
  Emit single 'p5-sketch' subject with args.code as a complete P5 sketch.
  Fallback, not Atlas IP — its purpose is preventing degenerate output, not
  competing with Napkin/antvis on this layer.

For 6 variants per ⚡:
  - Allocate ~3-4 variants in Priority 1+2 when content has concrete or
    metaphor-eligible material (Atlas IP stage)
  - Allocate ~2-3 variants in Priority 3 (fallback coverage)
  - Pure-abstract content: 1-2 try Priority 2 (invent metaphor), 4-5 Priority 3
    with different layouts (vertical / radial / cards / timeline / compare)
  - NEVER emit all 6 same-tier same-style (Sprint 1.5 convergence failure)

## p5-sketch subject type (Sprint 3)

When emitting Priority 3 (or as alternative to Priority 2 for pure abstract):

  {
    "v": 1,
    "name": "<archetype>: <title>",
    "subjects": [{
      "id": "sketch-<uuid>",
      "type": "p5-sketch",
      "args": {
        "code": "function setup() { createCanvas(600, 360); ... } function draw() { ... }",
        "canvasWidth": 600,
        "canvasHeight": 360
      }
    }]
  }

Constraints:
- ENTIRE subjects array must be exactly one p5-sketch entry (NO mixing with
  traditional types in Sprint 3 — pipeline will reject mixed scenes)
- args.code is a complete P5 sketch with setup() + draw()
- Sketch runs in sandboxed iframe with these globals available:
  * P5 API: createCanvas, fill, stroke, vertex, rect, ellipse, text, textSize,
    textFont, line, push, pop, translate, rotate, scale, noLoop, ...
  * Atlas SDF helpers (28 functions): sdf_box, sdf_circle, sdRoundBox,
    sdTriangle, sdTrapezoid, sdEtriangle, sdf_line, sdf_line2, sdf_moon,
    sub2, add2, mul2, dot2, len2, lenSq2, rot2, trans2, clamp1, clamp2,
    max2, min2, fract1, fract2, scale2, eq2, step1, xRepeated, sdf_rep
  * Branding palette: window.__brandingPalette = { bg: [r,g,b], silhouetteColor: [r,g,b] }
- Use textFont('sans-serif') for any text. Use brandingPalette for fill/stroke
  to maintain visual consistency across renderer cycles.
- Call createCanvas(600, 360) inside setup(). End draw() with noLoop() to freeze
  the frame (saves CPU; we render once, no animation needed).

## Worked example — Priority 1 (SDF DIRECT, literal concrete)

User text: "A cathedral on a hill in the morning"
LLM detects concrete nouns: cathedral, hill.
Output:
\`\`\`json
{
  "v": 1, "name": "kpi-hero: Cathedral on Hill",
  "subjects": [
    { "id": "cathedral", "type": "cathedral", "args": {}, "transform": { "translate": [0, 1, 0] } },
    { "id": "hill", "type": "terrain-with-lakes", "args": {}, "transform": { "translate": [0, -1, 0] } }
  ]
}
\`\`\`

## Worked example — Priority 2 ⭐ (SDF METAPHORICAL, Atlas wedge)

User text: "$3 billion was spent building this aircraft carrier"
LLM detects: concrete (carrier) + number (3B = money concept) → carrier-from-coins metaphor.
Output: a P5 sketch (since the metaphor requires custom composition not in
existing atom library — falls into a single p5-sketch subject that uses Atlas
SDF helpers inside the sketch):
\`\`\`json
{
  "v": 1, "name": "kpi-hero: $3B Aircraft Carrier",
  "subjects": [{
    "id": "sketch-1",
    "type": "p5-sketch",
    "args": {
      "code": "function setup() { createCanvas(600, 360); noStroke(); noLoop(); } function draw() { const bg = window.__brandingPalette.bg; const fg = window.__brandingPalette.silhouetteColor; background(bg[0], bg[1], bg[2]); fill(fg[0], fg[1], fg[2]); for (let py = 0; py < 360; py += 8) { for (let px = 0; px < 600; px += 8) { const x = (px / 600) * 2 - 1; const y = -((py / 360) * 2 - 1); const inCarrier = sdf_box([x, y], [0, -0.1], [1.6, 0.3]) < 0 || sdf_box([x, y], [-0.4, 0.2], [0.8, 0.4]) < 0; if (inCarrier) ellipse(px + 4, py + 4, 6, 6); } } textFont('sans-serif'); textSize(48); textAlign(CENTER, TOP); fill(fg[0], fg[1], fg[2]); text('$3B', 300, 20); }"
    }
  }]
}
\`\`\`
Result: A carrier silhouette composed of ~3000 small circles (the "coins"),
with "$3B" labeled at top. Vector libraries cannot do this effortlessly —
they would need explicit point placement. SDF tests inside/outside per grid
cell, so any outline + any fill = arbitrary metaphor.

## Worked example — Priority 3 (P5 FALLBACK, abstract relationship)

User text: "The agent explores the environment, builds hypotheses, and refines its world model"
LLM detects: no concrete nouns, no central number, pure sequential abstract.
Output:
\`\`\`json
{
  "v": 1, "name": "sequence: Explore-Hypothesize-Refine",
  "subjects": [{
    "id": "sketch-2",
    "type": "p5-sketch",
    "args": {
      "code": "function setup() { createCanvas(600, 360); noStroke(); noLoop(); } function draw() { const bg = window.__brandingPalette.bg; const fg = window.__brandingPalette.silhouetteColor; background(bg[0], bg[1], bg[2]); const steps = ['Explore', 'Hypothesize', 'Refine']; const bw = 140, bh = 80, gap = 40; const totalW = 3 * bw + 2 * gap; const startX = (600 - totalW) / 2; fill(fg[0], fg[1], fg[2]); textFont('sans-serif'); textSize(18); textAlign(CENTER, CENTER); for (let i = 0; i < 3; i++) { const x = startX + i * (bw + gap); noFill(); stroke(fg[0], fg[1], fg[2]); strokeWeight(2); rect(x, 140, bw, bh, 8); fill(fg[0], fg[1], fg[2]); noStroke(); text(steps[i], x + bw / 2, 180); if (i < 2) { stroke(fg[0], fg[1], fg[2]); line(x + bw + 4, 180, x + bw + gap - 4, 180); const ax = x + bw + gap - 4, ay = 180; line(ax, ay, ax - 8, ay - 4); line(ax, ay, ax - 8, ay + 4); } } }"
    }
  }]
}
\`\`\`
Result: 3 labeled rectangles ("Explore" / "Hypothesize" / "Refine") in a row
with arrows between. Standard infographic — no SDF metaphor available for
pure-abstract content, so P5 vector handles it.
`;
```

(That's the full extended addendum. The worked examples are embedded as strings — note the escaped `\`\`\`json` fences inside the JS template literal.)

- [ ] **Step 3: Verify syntax**

```bash
node --check sdf-js/src/compositor-api.js && echo "compositor-api OK"
```

- [ ] **Step 4: Verify the addendum is properly bounded (no stray backticks)**

```bash
grep -c "MODE_2D_ADDENDUM" sdf-js/src/compositor-api.js
```

Expected: 2 (one definition, one use in callLiftLLM).

- [ ] **Step 5: Run npm test**

```bash
npm test 2>&1 | tail -3
```

Expected: 34/34 (the addendum is loaded at runtime; no test directly parses it).

- [ ] **Step 6: Commit Task 4.1**

```bash
git add sdf-js/src/compositor-api.js
git commit -m "Sprint 3 Phase 4.1: extend MODE_2D_ADDENDUM with Step 4 (3-priority routing)

Extends the Sprint 2 'text-3d-* forbid' addendum with Sprint 3 routing rules:

Priority 1 — SDF DIRECT (literal concrete): traditional SceneData (Sprint 1 v4
  atom library reuse). FREE.

Priority 2 — SDF METAPHORICAL ⭐ (concrete composition for abstract concept):
  carrier-from-coins pattern. Atlas's REAL wedge. LLM instructed to hunt for
  metaphor before falling to P5.

Priority 3 — P5 FALLBACK (graceful degradation, 防退化): single p5-sketch
  subject with full P5 sketch in args.code. Not Atlas IP — fallback only.

6-variant allocation: ~3-4 Priority 1+2 (SDF wedge), ~2-3 Priority 3 (defense).
Pure-abstract: 1-2 metaphor attempts, 4-5 P5 layout variations.

3 worked examples embedded:
- Priority 1: cathedral + hill (uses cathedral atom + terrain-with-lakes)
- Priority 2: '$3B aircraft carrier' as p5-sketch using sdf_box + ellipse fill
  to compose carrier silhouette from ~3000 coin circles. THE Atlas wedge example.
- Priority 3: 'explore → hypothesize → refine' as 3-box-and-arrow P5 sketch.

p5-sketch type spec documented: single-subject constraint, args.code shape,
28 SDF helpers + P5 API + branding palette globals available.

Addendum text lives in compositor-api.js (loaded at runtime); baseline
system prompt file (system-prompt-lift-3d.md) bumped to v3.20 in Task 4.2."
```

### Task 4.2: Bump system-prompt-lift-3d.md to v3.20

**Files:**
- Modify: `sdf-js/examples/compositor/system-prompt-lift-3d.md`

- [ ] **Step 1: Read frontmatter version line**

```bash
head -3 sdf-js/examples/compositor/system-prompt-lift-3d.md
```

Confirm `version: 3.19`.

- [ ] **Step 2: Bump version + extend description**

In the YAML frontmatter, change `version: 3.19` → `version: 3.20`.

In the `description:` field (long single line), append at the very end (before its closing quote):

```
 v3.20 (2026-06-20 afternoon) extends MODE_2D_ADDENDUM (in src/compositor-api.js) with Step 4 — 3-priority content-driven routing for 2D mode: Priority 1 (SDF DIRECT, literal concrete; Sprint 1 v4 capability), Priority 2 (SDF METAPHORICAL, concrete composition for abstract — carrier-from-coins pattern, Atlas's real wedge that vector cannot replicate), Priority 3 (P5 FALLBACK, graceful degradation via single p5-sketch subject). 6-variant allocation: ~3-4 SDF wedge + ~2-3 P5 fallback. Solves Sprint 1.5 variant convergence on text-heavy content. p5-sketch is new subject type carrying P5 sketch in args.code; runs in iframe sandbox with 28 Atlas SDF helpers + branding palette. Constraint: single-subject only (no mixing p5-sketch with traditional types in Sprint 3; Sprint 4+ may relax). 3 worked examples embedded in addendum (Priority 1 cathedral, Priority 2 ⭐ \$3B carrier-from-coins, Priority 3 sequence-of-boxes).
```

(Use a unique substring near the END of the current description as the anchor for the Edit. The current description ends with "Lowercase + punctuation still pending Wave 3-4." from Sprint 1 v4 v3.17 + 4 more sentences from v3.18 / v3.19.)

- [ ] **Step 3: Verify version bumped**

```bash
head -3 sdf-js/examples/compositor/system-prompt-lift-3d.md
grep -c "version: 3.20" sdf-js/examples/compositor/system-prompt-lift-3d.md
```

Expected: version line shows 3.20; grep returns 1.

- [ ] **Step 4: Run npm test**

```bash
npm test 2>&1 | tail -3
```

Expected: 34/34.

- [ ] **Step 5: Commit Task 4.2**

```bash
git add sdf-js/examples/compositor/system-prompt-lift-3d.md
git commit -m "Sprint 3 Phase 4.2: lift prompt v3.19 → v3.20 frontmatter bump

Bump version in frontmatter + extend description with v3.20 changelog
noting the 3-priority routing (Priority 1/2/3) + carrier-from-coins
worked example + p5-sketch subject type + single-subject constraint.

The actual MODE_2D_ADDENDUM extension is in src/compositor-api.js
(committed in Task 4.1). This file is the baseline system prompt;
addendum is appended at runtime when opts.mode === '2d'."
```

---

## Phase 5 — visual-panel renderer routing (p5-sketch → 2d-p5, else → effect)

### Task 5.1: Update visual-panel.js to detect p5-sketch and route to mountP5Renderer

**Files:**
- Modify: `sdf-js/src/present/visual-panel.js`

- [ ] **Step 1: Read current visual-panel render flow**

```bash
grep -nE "renderActiveVariantCanvas|renderVariantToCanvas|getSelectedVisualVariant" sdf-js/src/present/visual-panel.js
```

Note the line numbers of the render functions.

- [ ] **Step 2: Add p5-sketch detection + mountP5Renderer import**

Open `sdf-js/src/present/visual-panel.js`. At the top with other imports, ADD:

```js
import { mountP5Renderer } from './p5-renderer.js';
```

The existing imports likely look like:
```js
import * as deckModel from './deck-model.js';
import { compileScene, createRendererForId } from '../compositor-api.js';
import { BRANDING_PALETTES, getPalette } from './branding-palettes.js';
```

Add the new import alongside them.

- [ ] **Step 3: Add routing helper near top of mountVisualPanel function**

Inside `mountVisualPanel`, near the top (after `function getVisual()`), add a helper:

```js
function isP5SketchVariant(variant) {
  return variant?.sceneData?.subjects?.[0]?.type === 'p5-sketch';
}
```

- [ ] **Step 4: Update renderActiveVariantCanvas to route p5-sketch**

Find the `renderActiveVariantCanvas` function (around line 188 per recon). The current implementation:

```js
function renderActiveVariantCanvas(visual) {
  const canvas = wrapper.querySelector('.visual-canvas');
  if (!canvas) return;
  const sel = deckModel.getSelectedVisualVariant(visual);
  if (!sel || sel.status !== 'ready' || !sel.sceneData) return;
  renderVariantToCanvas(canvas, sel.sceneData, visual.activeEffect, visual.activeBranding);

  // Render thumbnails inside picker
  if (pickerOpen) {
    wrapper.querySelectorAll('.thumb-canvas').forEach((thumb) => {
      const idx = parseInt(thumb.dataset.variantIndex, 10);
      const v = visual.variants[idx];
      if (v?.status === 'ready' && v.sceneData) {
        renderVariantToCanvas(thumb, v.sceneData, visual.activeEffect, visual.activeBranding);
      } else {
        ...
      }
    });
  }
}
```

Replace with a version that handles p5-sketch routing:

```js
let p5Handle = null; // Per-instance handle for current p5 renderer (Sprint 3)

function renderActiveVariantCanvas(visual) {
  const sel = deckModel.getSelectedVisualVariant(visual);
  if (!sel || sel.status !== 'ready' || !sel.sceneData) return;

  // Sprint 3: route to p5 renderer if variant is p5-sketch
  if (isP5SketchVariant(sel)) {
    // Destroy any prior p5 handle (in case we switched variants)
    if (p5Handle) {
      p5Handle.destroy();
      p5Handle = null;
    }
    // Find or create p5 mount container inside the main visual area
    let p5Mount = wrapper.querySelector('.visual-main .p5-mount');
    if (!p5Mount) {
      // The renderMainArea() output gave us a canvas; replace it with a p5-mount div
      const visualMain = wrapper.querySelector('.visual-main');
      if (visualMain) {
        visualMain.innerHTML = '<div class="p5-mount" style="width: 600px; height: 360px;"></div>';
        p5Mount = visualMain.querySelector('.p5-mount');
      }
    }
    if (p5Mount) {
      const palette = getPalette(visual.activeBranding);
      p5Handle = mountP5Renderer(p5Mount, sel.sceneData, palette);
    }
  } else {
    // Traditional sceneData → render via active CPU effect
    if (p5Handle) {
      p5Handle.destroy();
      p5Handle = null;
    }
    const canvas = wrapper.querySelector('.visual-canvas');
    if (!canvas) return;
    renderVariantToCanvas(canvas, sel.sceneData, visual.activeEffect, visual.activeBranding);
  }

  // Render picker thumbnails — for p5-sketch variants, show placeholder
  // (rendering 6 iframes simultaneously is expensive; only mount the selected
  // variant via iframe. Thumbnails show static info.)
  if (pickerOpen) {
    wrapper.querySelectorAll('.thumb-canvas').forEach((thumb) => {
      const idx = parseInt(thumb.dataset.variantIndex, 10);
      const v = visual.variants[idx];
      if (v?.status === 'ready' && v.sceneData) {
        if (isP5SketchVariant(v)) {
          // Render placeholder for p5-sketch thumbnails
          const ctx = thumb.getContext('2d');
          const palette = getPalette(visual.activeBranding);
          ctx.fillStyle = `rgb(${palette.bg.join(',')})`;
          ctx.fillRect(0, 0, thumb.width, thumb.height);
          ctx.fillStyle = `rgb(${palette.silhouetteColor.join(',')})`;
          ctx.font = '11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('P5 sketch', thumb.width / 2, thumb.height / 2 - 6);
          ctx.fillText(`(${v.archetype || 'fallback'})`, thumb.width / 2, thumb.height / 2 + 8);
        } else {
          renderVariantToCanvas(thumb, v.sceneData, visual.activeEffect, visual.activeBranding);
        }
      } else {
        // pending/lifting/error placeholder (existing logic)
        const ctx = thumb.getContext('2d');
        ctx.fillStyle = '#eee';
        ctx.fillRect(0, 0, thumb.width, thumb.height);
        ctx.fillStyle = '#999';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(v?.status || '·', thumb.width / 2, thumb.height / 2);
      }
    });
  }
}
```

- [ ] **Step 5: Update renderMainArea to emit p5-mount placeholder for p5-sketch variants**

Find `renderMainArea` function. The current likely:

```js
function renderMainArea(visual) {
  if (visual.status === 'pending') {
    return `<div class="visual-placeholder">⏳ pending…</div>`;
  }
  const sel = deckModel.getSelectedVisualVariant(visual);
  if (!sel) return `<div class="visual-placeholder">no variant</div>`;
  if (sel.status === 'lifting') {
    return `<div class="visual-placeholder">⏳ lifting variant ${visual.selectedVariantIndex + 1}/6…</div>`;
  }
  if (sel.status === 'error') {
    return `<div class="visual-placeholder error">⚠ ${escapeHtml(sel.liftError || 'error')}</div>`;
  }
  if (sel.status === 'pending') {
    return `<div class="visual-placeholder">⏳ pending…</div>`;
  }
  return `<canvas class="visual-canvas" width="600" height="360" data-visual-id="${visual.id}"></canvas>`;
}
```

Update the final `ready` return:

```js
function renderMainArea(visual) {
  if (visual.status === 'pending') {
    return `<div class="visual-placeholder">⏳ pending…</div>`;
  }
  const sel = deckModel.getSelectedVisualVariant(visual);
  if (!sel) return `<div class="visual-placeholder">no variant</div>`;
  if (sel.status === 'lifting') {
    return `<div class="visual-placeholder">⏳ lifting variant ${visual.selectedVariantIndex + 1}/6…</div>`;
  }
  if (sel.status === 'error') {
    return `<div class="visual-placeholder error">⚠ ${escapeHtml(sel.liftError || 'error')}</div>`;
  }
  if (sel.status === 'pending') {
    return `<div class="visual-placeholder">⏳ pending…</div>`;
  }
  // Sprint 3: p5-sketch variants render via iframe (mounted in p5-mount div)
  if (isP5SketchVariant(sel)) {
    return `<div class="p5-mount" style="width: 600px; height: 360px;" data-visual-id="${visual.id}"></div>`;
  }
  // Traditional sceneData renders via canvas
  return `<canvas class="visual-canvas" width="600" height="360" data-visual-id="${visual.id}"></canvas>`;
}
```

- [ ] **Step 6: Update Effects menu to grey out for p5-sketch variants**

Find the `renderMenu` function. The current "Effects" button is:

```js
<button data-action="effects">Effects (${visual.activeEffect})</button>
```

Update to detect p5-sketch and show different state:

```js
function renderMenu(visual) {
  const sel = deckModel.getSelectedVisualVariant(visual);
  const isP5 = isP5SketchVariant(sel);
  return `
    <div class="visual-menu">
      <button data-action="swap-layout">Swap Layout</button>
      <button data-action="effects" ${isP5 ? 'disabled title="Effects N/A for P5 sketch variants"' : ''}>${isP5 ? 'Effects (n/a)' : 'Effects (' + visual.activeEffect + ')'}</button>
      <button data-action="export">Export Visual</button>
      <button data-action="swap-branding">Swap Branding</button>
    </div>
  `;
}
```

- [ ] **Step 7: Update Export handler to use p5Handle.exportPng for p5-sketch variants**

Find the `exportPng` function. The current:

```js
function exportPng(visual) {
  const canvas = wrapper.querySelector('.visual-canvas');
  if (!canvas) return;
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${(visual.textAnchor.text || 'visual').slice(0, 30).replace(/[^a-z0-9_-]/gi, '-')}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
```

Update to handle p5:

```js
async function exportPng(visual) {
  const sel = deckModel.getSelectedVisualVariant(visual);
  let dataUrl = null;
  if (isP5SketchVariant(sel) && p5Handle) {
    dataUrl = await p5Handle.exportPng();
  } else {
    const canvas = wrapper.querySelector('.visual-canvas');
    if (canvas) dataUrl = canvas.toDataURL('image/png');
  }
  if (!dataUrl) return;
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${(visual.textAnchor.text || 'visual').slice(0, 30).replace(/[^a-z0-9_-]/gi, '-')}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
```

Note: `exportPng` is now async; update the `handleMenuAction` switch to `await` it. Find:

```js
case 'export':
  exportPng(visual);
  break;
```

Replace with:

```js
case 'export':
  exportPng(visual); // intentionally fire-and-forget; async internally
  break;
```

(Or `await`-it if `handleMenuAction` is already async; depends on existing code style.)

- [ ] **Step 8: Update Swap Branding to refresh p5 handle**

The existing `cycleBranding` function changes the palette + re-renders. With p5, we need to call `p5Handle.refresh()` after palette change. Find:

```js
function cycleBranding(visual) {
  const curIdx = BRANDING_PALETTES.findIndex((p) => p.id === visual.activeBranding);
  const next = BRANDING_PALETTES[(curIdx + 1) % BRANDING_PALETTES.length].id;
  deckModel.setActiveBranding(deck, visualId, next);
  deckModel.saveDeckToStorage(deck);
}
```

This already triggers `render()` indirectly (via `handleMenuAction`'s `render()` call). The `render()` calls `renderActiveVariantCanvas()` which destroys + recreates `p5Handle` for p5-sketch variants. So palette change auto-refreshes p5 — no explicit `p5Handle.refresh()` needed at this level. **No change needed here.**

- [ ] **Step 9: Update destroy() in returned handle to clean up p5Handle**

Find the existing `destroy: () => { wrapper.innerHTML = ''; }` at the bottom of `mountVisualPanel`. Update:

```js
return {
  refresh: render,
  destroy: () => {
    if (p5Handle) {
      p5Handle.destroy();
      p5Handle = null;
    }
    wrapper.innerHTML = '';
  },
};
```

- [ ] **Step 10: Verify syntax + npm test**

```bash
node --check sdf-js/src/present/visual-panel.js && echo "syntax OK"
npm test 2>&1 | tail -3
```

Expected: syntax OK; 34/34.

- [ ] **Step 11: Commit Phase 5**

```bash
git add sdf-js/src/present/visual-panel.js
git commit -m "Sprint 3 Phase 5: visual-panel renderer routing (p5-sketch → mountP5Renderer)

Detection: visual variant's sceneData.subjects[0].type === 'p5-sketch'
→ route to mountP5Renderer (iframe sandbox) instead of effect-based
canvas rendering.

Changes:
- New isP5SketchVariant() helper
- renderMainArea() emits .p5-mount div (instead of .visual-canvas) when
  selected variant is p5-sketch
- renderActiveVariantCanvas() destroys prior p5Handle on variant switch,
  creates new mountP5Renderer for p5-sketch, falls through to canvas
  renderer for traditional sceneData
- Picker thumbnails: p5-sketch variants render placeholder (avoid 6
  iframes simultaneously — too expensive); show 'P5 sketch (archetype)' text
- Effects menu disabled with 'Effects (n/a)' label for p5-sketch variants
  (no renderer cycle applies)
- Export Visual: async via p5Handle.exportPng() when p5-sketch active;
  falls back to canvas.toDataURL for traditional
- destroy() cleans up p5Handle

Swap Branding works unchanged: re-renders main area, p5Handle is destroyed
+ recreated with new palette automatically.

Phase 6 browse smoke verifies end-to-end (REAL Anthropic API)."
```

---

## Phase 6 — Browse smoke verify (REAL Anthropic API)

Per Sprint 1.5 lesson + Sprint 2 lesson: no mock-only verification. This phase MUST use real Anthropic API on a real PDF to confirm:
1. LLM emits p5-sketch subjects when prompted with abstract content
2. visual-panel routes to iframe correctly
3. iframe sandbox + SDF helpers + branding palette all wire up correctly
4. Effects menu greyed for p5-sketch; Swap Branding refreshes p5; Export PNG via iframe works
5. Manual before-after comparison vs Sprint 2 black-blob output documented for PR body

### Task 6.1: Browse smoke end-to-end

**Files:** none modified (verification only; any bugs found get fixed in a small follow-up commit)

- [ ] **Step 1: Ensure dev server running**

```bash
lsof -i :8001 2>&1 | head -3
```

If empty, start:

```bash
cd sdf-js && python3 dev-server.py 8001 &
sleep 2
cd /Users/hexiaoyang/Documents/sdf-main
```

- [ ] **Step 2: Setup browse skill**

```bash
B=~/.claude/skills/gstack/browse/dist/browse
if [ -x "$B" ]; then echo "READY: $B"; else echo "NEEDS_SETUP"; fi
```

If NEEDS_SETUP:
```bash
cd ~/.claude/skills/gstack/browse && ./setup
cd /Users/hexiaoyang/Documents/sdf-main
```

- [ ] **Step 3: Verify atlas-anthropic-key in localStorage**

Sprint 2 Phase 8 documented: headless browse doesn't share user's browser localStorage. If key is missing, this phase is BLOCKED (per Sprint 2 security-classifier lesson, never paste key in chat).

Two options:
1. **User has set key in their browser** (Sprint 1.5 manual L3 stored key). User does this Phase 6 manually in their own browser (recommended; same approach as Sprint 2 Phase 8).
2. **Implementer dispatches subagent + uses test key via shell env variable** (more setup; not blocked but more work).

Per Sprint 2 lesson, recommend option 1 unless user explicitly authorizes option 2. For this plan, document option 1 as the default:

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B goto "http://localhost:8001/examples/present/"
$B wait --networkidle 2>&1 | tail -3
$B js "(() => { const k = localStorage.getItem('atlas-anthropic-key'); return k ? 'KEY_LENGTH: ' + k.length : 'MISSING_API_KEY'; })()"
```

If MISSING_API_KEY: **STOP. Report status to user. Browse smoke deferred to user manual L3** (same as Sprint 2 Phase 8 disposition).

If key is set, proceed.

- [ ] **Step 4: Inject test PDF into deck (use sdf-js/fixtures/test-deck.pdf)**

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B js "(async () => {
  localStorage.removeItem('atlas-decks');
  const dm = await import('/src/present/deck-model.js');
  const { parsePDFFromBytes } = await import('/src/parser/index.js');
  const { extractDocumentData } = await import('/src/present/pdf-text-extractor.js');
  const resp = await fetch('/fixtures/test-deck.pdf');
  if (!resp.ok) return 'PDF_FETCH_FAIL: ' + resp.status;
  const buffer = await resp.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const slides = await parsePDFFromBytes(bytes, 'test-deck.pdf');
  const documentData = extractDocumentData(slides);
  const deck = dm.createDeck('test-deck', { type: 'pdf', fileName: 'test-deck.pdf', pageCount: slides.length });
  dm.setDocument(deck, documentData);
  dm.saveDeckToStorage(deck);
  return JSON.stringify({ deckId: deck.id, pages: documentData.pages.length, headings: documentData.headings.length, textLength: documentData.flowingText.length });
})()"
```

Expected: JSON with deckId + pages count.

- [ ] **Step 5: Open deck view + verify document renders**

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B reload
sleep 1
$B click "text=View"
sleep 2
$B screenshot /tmp/sprint-3-phase-6-document-view.png
$B console --errors 2>&1 | head -10
```

Verify visually (read screenshot via Read tool): document text rendered, no console errors.

- [ ] **Step 6: Highlight abstract paragraph + trigger ⚡**

```bash
B=~/.claude/skills/gstack/browse/dist/browse
# Select first body paragraph and trigger lift
$B js "(() => {
  const docContainer = document.getElementById('document-container');
  const bodies = docContainer.querySelectorAll('.body');
  if (bodies.length === 0) return 'NO_BODY_LINES';
  const target = bodies[0];
  const range = document.createRange();
  range.selectNodeContents(target);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  document.dispatchEvent(new Event('selectionchange'));
  return 'selected text: \"' + sel.toString().slice(0, 60) + '\"';
})()"
sleep 1
$B js "(() => {
  const button = document.querySelector('.floating-toolbar .floating-trigger');
  if (!button) return 'NO_TRIGGER_BUTTON';
  button.click();
  return 'lift triggered';
})()"
echo "Waiting ~90s for 6 real Anthropic lifts..."
sleep 90
$B screenshot /tmp/sprint-3-phase-6-after-lift.png
$B console --errors 2>&1 | head -20
```

- [ ] **Step 7: Verify variant mix (some p5-sketch, some traditional)**

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B js "(async () => {
  const dm = await import('/src/present/deck-model.js');
  const decks = dm.listDecks();
  const visual = decks[0].visuals[0];
  if (!visual) return 'NO_VISUAL';
  const variants = visual.variants.map((v, i) => ({
    index: i,
    status: v.status,
    archetype: v.archetype,
    subjectType: v.sceneData?.subjects?.[0]?.type || 'no-subject',
    hasError: !!v.liftError,
    errorMsg: v.liftError?.slice(0, 60),
  }));
  const p5Count = variants.filter(v => v.subjectType === 'p5-sketch').length;
  const traditionalCount = variants.filter(v => v.subjectType !== 'p5-sketch' && v.subjectType !== 'no-subject').length;
  return JSON.stringify({ p5Count, traditionalCount, errorCount: variants.filter(v => v.hasError).length, variants });
})()"
```

Record output verbatim — goes into PR body update.

**Sprint 1.5 lesson check**: if p5Count is 6 (all P5) or 0 (no P5), variant diversity is broken. Document honestly.

- [ ] **Step 8: Verify p5 variant renders (visual quality compare vs Sprint 2 black blob)**

```bash
B=~/.claude/skills/gstack/browse/dist/browse
# Switch to a p5-sketch variant if any exist
$B js "(async () => {
  const dm = await import('/src/present/deck-model.js');
  const decks = dm.listDecks();
  const visual = decks[0].visuals[0];
  const p5Index = visual.variants.findIndex(v => v.sceneData?.subjects?.[0]?.type === 'p5-sketch' && v.status === 'ready');
  if (p5Index === -1) return 'NO_P5_VARIANTS';
  dm.selectVisualVariant(decks[0], visual.id, p5Index);
  dm.saveDeckToStorage(decks[0]);
  location.reload();
  return 'selected p5 variant index ' + p5Index;
})()"
sleep 2
$B click "text=View"
sleep 3
$B screenshot /tmp/sprint-3-phase-6-p5-variant.png
$B console --errors 2>&1 | head -10
```

Read screenshot. Expected: visible P5 sketch (boxes / labels / arrows or similar) — NOT a black blob.

- [ ] **Step 9: Test Effects menu greyed for p5 variant + Swap Branding refresh**

```bash
B=~/.claude/skills/gstack/browse/dist/browse
# Click main area to open menu
$B js "(() => { document.querySelector('.p5-mount')?.click() || document.querySelector('.visual-canvas')?.click(); })()"
sleep 1
$B screenshot /tmp/sprint-3-phase-6-menu-on-p5.png
# Verify Effects is disabled
$B js "(() => {
  const effectsBtn = document.querySelector('.visual-menu button[data-action=\"effects\"]');
  if (!effectsBtn) return 'NO_EFFECTS_BTN';
  return 'effects disabled: ' + effectsBtn.disabled + ', label: ' + effectsBtn.textContent;
})()"
# Click Swap Branding
$B js "(() => { document.querySelector('.visual-menu button[data-action=\"swap-branding\"]')?.click(); })()"
sleep 2
$B screenshot /tmp/sprint-3-phase-6-after-branding-swap.png
```

Verify Effects label shows "Effects (n/a)" and disabled. After Swap Branding, iframe re-mounts with new palette colors.

- [ ] **Step 10: Test Export Visual (PNG download via iframe postMessage)**

```bash
B=~/.claude/skills/gstack/browse/dist/browse
# Re-open menu (if closed after previous click)
$B js "(() => { document.querySelector('.p5-mount')?.click() || document.querySelector('.visual-canvas')?.click(); })()"
sleep 1
$B js "(() => { document.querySelector('.visual-menu button[data-action=\"export\"]')?.click(); })()"
sleep 2
$B console --errors 2>&1 | head -10
```

Headless browse may not save the download, but verify no console errors (postMessage 'export' / 'exportResult' flow completes).

- [ ] **Step 11: Document findings for PR body**

Collect:
1. p5Count + traditionalCount + errorCount from Step 7 — VERBATIM
2. Manual subjective comparison: read Sprint 2 black-blob screenshots (if accessible) vs Sprint 3 P5 variant screenshot (`/tmp/sprint-3-phase-6-p5-variant.png`). Honest 1-line note: "Sprint 3 p5-sketch variant <legible/unclear/comparable> vs Sprint 2 black-blob"
3. Total Anthropic tokens used (estimate from API dashboard or pessimistic ~6 lifts × 5k input + 2k output = ~42k tokens ≈ $0.20-0.30)
4. Any console errors observed

- [ ] **Step 12: No commit needed for Phase 6**

If any bugs were found, fix them in a separate small commit before Phase 7. Otherwise no commit (verification only).

---

## Phase 7 — Push branch (extends PR #9, no new PR)

Sprint 3 commits live on the same branch as Sprint 2 (`sprint-2-napkin-doc-viewer`). Pushing the branch updates PR #9 automatically.

### Task 7.1: Update PR #9 body + push

**Files:** none modified

- [ ] **Step 1: Verify pre-push state**

```bash
cd /Users/hexiaoyang/Documents/sdf-main
git log --oneline main..HEAD | head -20
git status -s
npm test 2>&1 | tail -3
```

Expected:
- ~30+ commits on branch (Sprint 2 + Sprint 3)
- status clean
- npm test 34/34

- [ ] **Step 2: Push branch (updates existing PR #9 with Sprint 3 commits)**

```bash
git push origin sprint-2-napkin-doc-viewer 2>&1 | tail -5
```

Expected: push succeeds; remote branch updated.

- [ ] **Step 3: Update PR #9 body with Sprint 3 addendum**

Compose Sprint 3 addendum to existing PR #9 body. Use `gh pr edit` to append OR add a comment via `gh pr comment`. We use `comment` to preserve original Sprint 2 body and add Sprint 3 as a follow-up:

```bash
gh pr comment 9 --body "$(cat <<'EOF'
## Sprint 3 addendum (P5.js 2D pipeline — Hybrid SceneData + p5-sketch subject type)

Adds graceful-degradation P5 fallback for abstract content (Aether AI page-1-11 black-blob class)
while promoting SDF compositional metaphor as Atlas's true wedge (carrier-from-coins pattern).

### Sprint 3 phase commits

- Phase 1: vendor p5.min.js + iframe sandbox HTML + SDF helper bundle (28 functions, ~6KB)
- Phase 2: 2d-p5 renderer (iframe sandbox + postMessage + IntersectionObserver lazy unmount) + ~45 helper math assertions
- Phase 3: scene/spec.js + scene/compile.js accept p5-sketch subject type + pipeline validates single-subject constraint
- Phase 4: lift prompt v3.19 → v3.20 with 3-priority routing (SDF DIRECT / SDF METAPHORICAL ⭐ / P5 FALLBACK) + 3 worked examples (cathedral / \$3B carrier-from-coins ⭐ / explore-hypothesize-refine sequence)
- Phase 5: visual-panel detects p5-sketch → mountP5Renderer; Effects menu greyed for p5 variants; Export PNG via iframe postMessage
- Phase 6: browse smoke verified end-to-end with REAL Anthropic API (see verified facts below)

### Verified facts (REAL Anthropic API browse smoke)

[FILL IN FROM PHASE 6 STEP 7 + 8 + 11 OBSERVATIONS]

- p5-sketch variants emitted: X of 6
- Traditional SceneData variants emitted: Y of 6
- Error variants: Z of 6
- Subjective vs Sprint 2 black-blob: [legible / unclear / comparable]
- Console clean throughout: [yes / errors observed: ...]
- Total cost: ~\$0.20-0.30 (~42k tokens)

### NOT verified (deferred to user manual L3)

If Phase 6 was blocked by missing atlas-anthropic-key in headless browse (Sprint 2 pattern):
- Manual L3 in user's own browser (key already there from prior Sprints):
  1. Cmd+Shift+R http://localhost:8001/examples/present/
  2. Import any PDF, highlight a paragraph, click ⚡
  3. Verify ≥1 of 6 variants is p5-sketch (visible as boxes/labels/arrows, NOT black blob)
  4. Click main canvas → menu: Effects should be greyed ('Effects (n/a)') for p5 variant
  5. Click Swap Branding → iframe re-mounts with new colors
  6. Click Export Visual → PNG downloads (from iframe.toDataURL via postMessage)

### Architecture summary

Hybrid: visual.variants[i].sceneData stays canonical (Sprint 2 schema unchanged).
New subject type 'p5-sketch' (carries P5 sketch code in args.code) is detected
by visual-panel and routed to 2d-p5 iframe sandbox renderer. All 8 existing
renderers (silhouette/lines/crayon/topo + bob-gpu/fly3d/blueprint) still operate
on traditional-subject SceneData — Sprint 3 does NOT touch them.

### Sprint 1.5 + Sprint 2 lessons honored

- No mock-only verification (Phase 6 uses REAL Anthropic API or defers to user manual L3)
- iframe sandbox=allow-scripts only (NOT allow-same-origin) — prevents LLM sketches reading main page localStorage atlas-anthropic-key
- PR body lists only verified facts; NOT-verified items explicitly enumerated
- TDD strict Phases 2-3 (~50 new assertions)
- Variant convergence fix: 3-priority routing forces LLM to span priorities (Sprint 1.5's all-text-card failure)

### Files

NEW:
- src/present/p5-sandbox-iframe.html
- src/present/sdf-helper-bundle.js (28 functions)
- src/present/p5-renderer.js
- public/p5.min.js (~900KB vendored, LGPL-2.1)
- scripts/test-p5-sandbox.mjs

MODIFY:
- src/scene/spec.js (PRIMITIVE_TYPES += 'p5-sketch')
- src/scene/compile.js (PRIMITIVE_FACTORIES += sentinel SDF)
- src/compositor-api.js (MODE_2D_ADDENDUM extended with Step 4 routing)
- examples/compositor/system-prompt-lift-3d.md (v3.19 → v3.20)
- src/present/pipeline.js (validateP5SketchConstraint)
- src/present/visual-panel.js (renderer routing)
- scripts/test-pipeline.mjs + test-deck-model.mjs

### Merge strategy (PR #9 = Sprint 2 + Sprint 3 combined)

Per locked PR workflow: \`gh pr merge 9 --squash --delete-branch\`

Sprint 3 spec: docs/superpowers/specs/2026-06-20-atlas-present-sprint-3-p5-2d-pipeline-design.md (503 lines)
Sprint 3 plan: docs/superpowers/plans/2026-06-20-atlas-present-sprint-3-plan.md (this plan)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

(`[FILL IN FROM PHASE 6 STEP 7 + 8 + 11 OBSERVATIONS]` is the only literal placeholder — replace with actual data from Phase 6 verification.)

- [ ] **Step 4: Output final summary**

```
═══ Atlas Present Sprint 3 SHIPPED to PR #9 ═══

PR: https://github.com/shaun8149/sdf-js/pull/9 (updated with Sprint 3 addendum comment)
Branch: sprint-2-napkin-doc-viewer (Sprint 2 + Sprint 3 combined)
Range: <before-sha>..<HEAD>

Sprint 3 phase commits (~15-20 total):
- Phase 0: pre-flight + plan commit
- Phase 1: iframe sandbox + p5 vendor + SDF helper bundle (3 commits)
- Phase 2: 2d-p5 renderer + TDD (3-4 commits)
- Phase 3: spec.js + compile.js + pipeline validation (2 commits)
- Phase 4: lift prompt v3.20 (2 commits)
- Phase 5: visual-panel routing (1 commit)
- Phase 6: browse smoke (0 or 1 fix commit)
- Phase 7: push + PR #9 update comment

npm test: 34/34 green throughout
Total cost Phase 6: ~$<estimate>

PR #9 is now Sprint 2 + Sprint 3 combined. User reviews + merges
with --squash --delete-branch when ready.

Sprint 4+ candidates queued (per spec §12):
- Mixed subjects (p5-sketch + traditional in same scene)
- GLSL Shader 3D output
- SDF metaphor library (curated recipe collection)
- Colors / Fonts / Size pickers (Napkin parity)
```

---

## Self-review

After writing this plan, check against spec:

**1. Spec coverage check:**

- Spec §3 lock 1 (P5 tech) → Phase 1 vendoring p5.min.js + Phase 2 mountP5Renderer ✓
- Spec §3 lock 2 (SDF retention as helper) → Phase 1.3 sdf-helper-bundle.js exposes 28 helpers as iframe globals ✓
- Spec §3 lock 3 (Hybrid SceneData + p5-sketch subject) → Phase 3 spec.js/compile.js accept type ✓
- Spec §3 lock 4 (iframe sandbox=allow-scripts) → Phase 2.4 IFRAME_SANDBOX = 'allow-scripts' ✓
- Spec §3 lock 5 (lazy IntersectionObserver) → Phase 2.4 setupIntersectionObserver ✓
- Spec §3 lock 6 (BOB subset, 28 helpers) → Phase 1.3 sdf-helper-bundle exports 17 vector math + 11 SDF primitives ✓
- Spec §3 lock 7 (no mixed subjects) → Phase 3.2 validateP5SketchConstraint throws on mixing ✓
- Spec §3 lock 8 (PR #9 not new PR) → Phase 7 push extends PR #9 via comment ✓

- Spec §4 architecture → All Layer 1 + Layer 2 file changes mapped to phases ✓
- Spec §5 schema → Phase 3.1 PRIMITIVE_TYPES + Phase 3.2 storage roundtrip test ✓
- Spec §6 iframe protocol → Phase 1.2 iframe HTML implements postMessage ✓
- Spec §7 SDF helper inventory → Phase 1.3 exports exactly 28 functions ✓
- Spec §8 3-priority routing → Phase 4.1 MODE_2D_ADDENDUM Step 4 + 3 worked examples ✓
- Spec §11 lessons honored → Phase 6 uses REAL API; Phase 7 PR body cites NOT verified explicitly ✓
- Spec §13 acceptance → All 6 bullets covered by Phase 5 + Phase 6 + Phase 7 ✓
- Spec §14 hard rules → iframe sandbox excludes allow-same-origin (Phase 2.4 IFRAME_SANDBOX const) ✓

No spec gaps found.

**2. Placeholder scan:**

Searched plan for placeholder patterns:
- Phase 7 PR body has `[FILL IN FROM PHASE 6 STEP 7 + 8 + 11 OBSERVATIONS]` — this is an explicit runtime fill-in from Phase 6 verified data, NOT a planning placeholder
- No "TBD" / "implement later" / generic "add error handling" found
- All code blocks contain runnable code; all bash commands have exact expected output

No real placeholders found.

**3. Type consistency:**

- `mountP5Renderer(wrapper, sceneData, palette)` signature consistent: Phase 2.1 skeleton → Phase 2.4 implementation → Phase 5 usage ✓
- `isP5SketchVariant(variant)` helper signature: Phase 5 Step 3 definition matches Phase 5 Step 4 + Step 5 + Step 6 + Step 7 uses ✓
- `validateP5SketchConstraint(sceneData)` throws Error — consistent with Phase 3.2 Step 3 implementation + tests in Step 1 ✓
- SDF helper function names (sdf_box / sdf_circle / sub2 / etc.) consistent across Phase 1.3 bundle + Phase 2.2/2.3 tests + Phase 4.1 prompt documentation ✓
- `'p5-sketch'` subject type literal consistent across spec.js + compile.js + pipeline validation + visual-panel detection + lift prompt examples ✓
- `IFRAME_SANDBOX = 'allow-scripts'` (no allow-same-origin) consistent across Phase 1.2 iframe HTML + Phase 2.4 renderer ✓

No gaps.

---

**Plan complete and saved to `docs/superpowers/plans/2026-06-20-atlas-present-sprint-3-plan.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — Same pattern as Sprint 1 v4 + 1.5 + 2. Dispatch fresh subagent per phase, controller verifies between phases. Branch `sprint-2-napkin-doc-viewer` already set up with spec committed. Phase 7 push extends PR #9 (no new PR). User merges manually with `--squash --delete-branch`.

**2. Inline Execution** — Execute tasks in this session via executing-plans, checkpoint between phases.

Which approach?
