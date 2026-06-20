# Atlas Present Sprint 3 — P5.js 2D Pipeline (Hybrid: SceneData canonical + p5-sketch subject type)

**Date:** 2026-06-20 (afternoon)
**Status:** Spec locked (all 8 design decisions confirmed via inline Q&A 2026-06-20)
**Branch:** `sprint-2-napkin-doc-viewer` (Sprint 3 commits added to the open PR #9, per Sprint 2 final decision "不 merge, Sprint 3 同分支加 commits")
**Predecessor:** Sprint 2 (Napkin document viewer + visual generation), 17 commits on branch, PR #9 open
**Successor candidates (Sprint 4+):** lift 2D variant to 3D via SceneData reuse; expand iframe SDF helper library; mixed-subject SceneData (p5-sketch + traditional in same scene)

---

## 1. Goal

Solve the **black-blob failure mode** observed in Sprint 2 manual L3 testing on abstract-content paragraphs (Aether AI deck pages 1-11 except 12/13). Root cause confirmed: SDF silhouette projection of 3D primitives cannot represent abstract concepts (list / sequence / compare / text-card); information density requires text labels + arrows + colored regions that vector primitives handle natively but SDF distance fields do not.

**Strategic reframe (locked 2026-06-20 afternoon):**
- Atlas Present's differentiation is NOT "SDF generative art". It is **"LLM + Agentic Coding writes code that drives any rendering framework"**.
- 2D → P5.js (LLM strong at JS code, P5 native to abstract vector + can host SDF math as helpers).
- 3D → GLSL Shader (Sprint 4+, same code-generative pattern).
- SDF stays as a tool subset, available where it shines.

**Atlas's TRUE strategic SDF advantage (locked 2026-06-20 afternoon, last lesson)**:
- Not just "draw concrete objects literally"
- **"Concrete composition for ANY concept" (metaphorical SDF)** — SDF can take an outline of one concrete thing (carrier) and FILL it with units of another concrete thing (coins) to express an abstract assertion ("expensive"). Vector primitives cannot do this effortlessly.
- This is the BOB pattern: SDF as spatial classifier (`sdf(x,y) < threshold` for any shape) + grid cells colored by membership = arbitrary outline filled with arbitrary contents.
- LLM should HUNT for metaphorical SDF opportunities even on abstract content (numbers, relationships), not jump to P5 vector immediately.
- P5 is **fallback / 防退化 (graceful degradation)** — when no concrete metaphor available for the content, P5 vector + textbox guarantees a legible output. Not the main IP stage.

**Concrete user-visible promise:** when user selects an abstract paragraph and clicks ⚡, at least 4 of 6 generated variants render as legible 2D infographics (boxes / labels / arrows / icons rendered via P5 vector primitives in iframe sandbox), not solid black silhouette blobs.

## 2. Non-goals (explicit)

- NOT abandoning SDF — 8 existing renderers + 40+ SDF primitives stay intact and are still used for concrete content (sphere / cube / cathedral / carrier types)
- NOT using image generation models (DALL-E / Imagen / Stable Diffusion) — explicitly rejected by user. ian-xiaohei-illustrations skill was reference for "alternative to SDF exists", not "use image_gen for Atlas"
- NOT introducing reveal.js (Sprint 2 spec §8 deferred)
- NOT changing the document viewer UX from Sprint 2 (still selection-driven, ⚡ trigger, inline visual panel, side picker, image context menu)
- NOT changing schema fundamentally — visual.variants[i].sceneData remains the canonical output. P5 code lives INSIDE sceneData as a new subject type, NOT as a parallel field
- NOT supporting mixed subjects (p5-sketch + traditional in same SceneData) — Sprint 4+ if needed
- NOT implementing GLSL shader code generation for 3D — Sprint 4+
- NOT changing CPU 2D renderers (silhouette / lines / crayon / topo) — they continue to render traditional-subject SceneData

## 3. Locked design decisions (8 user-confirmed via inline Q&A 2026-06-20 afternoon)

| # | Decision | User choice |
|---|---|---|
| 1 | Tech approach for 2D abstract content | **P5.js (NOT image generation, NOT SVG vector lib, NOT antvis)** — P5 is code-accepting framework + LLM trained on it + SDF can live inside P5 |
| 2 | Scope of SDF retention | **SDF stays for concrete objects + as helper library inside P5 sandbox** — per-content-type choice, not per-mode |
| 3 | Sprint 3 architecture pattern | **Hybrid: SceneData canonical, `p5-sketch` is new subject type** carrying P5 code in args.code |
| 4 | iframe sandbox security model | **iframe sandbox=`allow-scripts`** + postMessage protocol (isolated from main page DOM/localStorage) |
| 5 | iframe mount strategy | **Lazy per-visual iframe** + IntersectionObserver-based unmount when off-screen |
| 6 | SDF helper bundle exposure | **BOB primitives subset** — ~28 general-purpose math + SDF functions. **BOB composites REMOVED** (sdfSunset / sdf_building / sdf_bridge1/2 / sdf_BTC / sdf_cactus / sdf_tree / sdf_wall / sdf_flower) — those are BOB-art-specific creative vocabulary; LLM should compose its own from primitives. See §7 for final inventory. |
| 7 | Mixed-subject SceneData (p5-sketch + traditional) | **NOT supported in Sprint 3** — LLM must emit either all p5-sketch OR all traditional in single variant. Mixed handling Sprint 4+ |
| 8 | PR strategy | **Add to Sprint 2's PR #9** (same branch `sprint-2-napkin-doc-viewer`), not new PR |

## 4. Architecture overview

```
┌────────────────────────────────────────────────────────────────────┐
│                          Browser (BYOK)                             │
│                                                                      │
│  ┌──────────────────┐    ┌──────────────────┐                       │
│  │ library / doc     │ →  │ pipeline.js      │                       │
│  │ view (Sprint 2)   │    │ (selection →     │                       │
│  └──────────────────┘    │  6 lifts)        │                       │
│                          └──────────────────┘                       │
│                                   ↓                                  │
│                          ┌──────────────────┐                       │
│                          │ callLiftLLM      │                       │
│                          │ (opts.mode='2d', │                       │
│                          │  v3.20 prompt)   │                       │
│                          └──────────────────┘                       │
│                                   ↓                                  │
│                  SceneData (canonical)                              │
│                                   ↓                                  │
│                  visual-panel routing per variant:                  │
│                                   │                                  │
│           ┌───────────────────────┴──────────────────────┐         │
│           ↓                                              ↓         │
│  has p5-sketch subject?               all traditional subjects?    │
│           ↓                                              ↓         │
│  ┌─────────────────┐                          ┌──────────────────┐ │
│  │ NEW 2d-p5       │                          │ existing 4 CPU 2D │ │
│  │ renderer        │                          │ renderers:        │ │
│  │ (iframe sandbox │                          │ silhouette/lines/ │ │
│  │  + p5.min.js    │                          │ crayon/topo       │ │
│  │  + SDF helpers) │                          │ (Sprint 2 ship)   │ │
│  └─────────────────┘                          └──────────────────┘ │
│                                                                      │
│  (GPU renderers bob-gpu/fly3d/blueprint reserved for Sprint 4+      │
│   3D Play mode; same SceneData input)                               │
└────────────────────────────────────────────────────────────────────┘
```

### Layer 1 (sdf-js engine) changes — small

- Modify: `sdf-js/src/scene/spec.js` — add `'p5-sketch'` to PRIMITIVE_TYPES validator allowlist
- Modify: `sdf-js/src/scene/compile.js` — add `'p5-sketch'` factory entry that produces a sentinel SDF (since p5-sketch isn't rendered via SDF compile, the factory returns a placeholder; visual-panel detects this type and routes differently)
- Modify: `sdf-js/examples/compositor/system-prompt-lift-3d.md` v3.19 → v3.20 — document `p5-sketch` subject type + routing rules + SDF helper inventory available inside sandbox

### Layer 2 (Atlas Present app) changes — substantial

- NEW: `sdf-js/src/present/p5-renderer.js` — `mountP5Renderer(wrapper, sceneData, branding) → {refresh, destroy, exportPng}`. Creates iframe with sandbox attribute, postMessage protocol to inject p5Code from sceneData.subjects[0].args.code + 40 SDF helpers + branding palette. Uses IntersectionObserver to unmount iframe DOM when wrapper is off-screen (memory cleanup).
- NEW: `sdf-js/src/present/p5-sandbox-iframe.html` — the iframe entry-point. Static HTML loading p5.min.js + Atlas SDF helper bundle. Listens for postMessage `{type:'init', code, helpers, palette}` and `{type:'export'}`.
- NEW: `sdf-js/src/present/sdf-helper-bundle.js` — exports the 40-function subset as a single object `{ sdf_box, sdf_circle, ... }` for iframe injection. Source-copied (NOT imported) from sdf-js/src/sdf/ to avoid iframe import resolution complexity.
- NEW: `sdf-js/public/p5.min.js` — vendored P5.js library (~500KB), served from dev server, loaded by iframe. (License: LGPL-2.1, attribution in NOTICE.)
- Modify: `sdf-js/src/present/visual-panel.js` — renderer routing logic: detect `sceneData.subjects[0].type === 'p5-sketch'` → use `mountP5Renderer` instead of effect-based renderer. Image context menu Effects sub-panel hides renderer cycle for p5-sketch variants (Swap Layout / Export / Swap Branding still work).
- Modify: `sdf-js/src/present/pipeline.js` — parseLiftResponse: validate p5-sketch subjects (args.code is string, etc.). sanitize2dSceneData: leave p5-sketch alone (don't filter; but DO validate args.code doesn't try to escape sandbox via `window.parent` / `top` references).
- NEW: `sdf-js/scripts/test-p5-sandbox.mjs` — L1 unit tests for SDF helper bundle + mock postMessage protocol (~12 assertions).
- Modify: `sdf-js/scripts/test-deck-model.mjs` — add ~5 assertions for p5-sketch subject acceptance.
- Modify: `sdf-js/scripts/test-pipeline.mjs` — add ~5 assertions for p5-sketch variant handling in pipeline.

### Renderer routing decision (visual-panel)

```js
function chooseRenderer(visual) {
  const variant = getSelectedVisualVariant(visual);
  if (!variant || !variant.sceneData) return null;
  const subjects = variant.sceneData.subjects ?? [];
  if (subjects.length > 0 && subjects[0].type === 'p5-sketch') {
    return { kind: 'p5', code: subjects[0].args.code };
  }
  return { kind: 'effect', effect: visual.activeEffect };
}
```

## 5. Schema (incremental — visual.variants[i].sceneData stays canonical)

No schema-bump (still v5). New subject type added:

```js
// New traditional-subjects-side:
sceneData.subjects[i] = {
  id: string,
  type: 'cube-3d' | 'sphere' | 'cylinder' | ... existing types ...
  args: { ... },
  transform: { translate, rotate, scale }
}

// New p5-sketch-side (Sprint 3):
sceneData.subjects[i] = {
  id: string,
  type: 'p5-sketch',
  args: {
    code: string,  // Full P5 sketch as JS source: function setup(){...} function draw(){...}
    canvasWidth?: number,  // default 600
    canvasHeight?: number  // default 360
  },
  transform?: undefined  // ignored for p5-sketch
}
```

Constraint (Sprint 3 only): in a single variant's sceneData.subjects, either ALL are p5-sketch (typically just 1 since the sketch IS the whole visual) or NONE are. LLM prompt v3.20 enforces this. Pipeline.parseLiftResponse validates this constraint and rejects mixed scenes as `liftError = 'mixed-subjects-not-supported'`.

## 6. iframe sandbox protocol

### iframe HTML scaffold (`sdf-js/src/present/p5-sandbox-iframe.html`)

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>html,body { margin:0; padding:0; overflow:hidden; }</style>
</head>
<body>
  <div id="sketch-container"></div>
  <script src="/p5.min.js"></script>
  <script src="/src/present/sdf-helper-bundle.js"></script>
  <script>
    // (inline) postMessage listener — receives p5Code + branding + sdf helpers exposed as globals
    window.addEventListener('message', (e) => {
      if (e.data.type === 'init') {
        // Inject 40 SDF helpers as window globals (already loaded by sdf-helper-bundle.js)
        // Inject branding palette as window.__brandingPalette
        window.__brandingPalette = e.data.palette;
        // Evaluate user's P5 code
        try {
          eval(e.data.code);
          // P5 should call createCanvas + start drawing; intercept canvas creation to mount inside #sketch-container
          // (P5 uses document.body by default; we override window.parent / sandbox prevents that risk)
          window.parent.postMessage({ type: 'ready' }, '*');
        } catch (err) {
          window.parent.postMessage({ type: 'error', message: err.message, stack: err.stack }, '*');
        }
      } else if (e.data.type === 'export') {
        const canvas = document.querySelector('canvas');
        if (canvas) {
          window.parent.postMessage({ type: 'exportResult', dataUrl: canvas.toDataURL('image/png') }, '*');
        }
      }
    });
  </script>
</body>
</html>
```

### iframe attributes (set by p5-renderer.js)

```js
iframe.src = '/src/present/p5-sandbox-iframe.html';
iframe.setAttribute('sandbox', 'allow-scripts');  // critically: NOT allow-same-origin, NOT allow-top-navigation
iframe.style.width = '600px';
iframe.style.height = '360px';
iframe.style.border = '1px solid #e5e7eb';
iframe.style.borderRadius = '8px';
```

`sandbox=allow-scripts` only: iframe can run JS but cannot access main-page localStorage / cookies / DOM / cross-origin requests with credentials. The Anthropic API key (`atlas-anthropic-key` in main page localStorage) is unreadable from inside iframe.

### postMessage messages

| Direction | type | payload | meaning |
|---|---|---|---|
| main → iframe | `init` | `{code, palette, helpers}` | Render this p5 sketch |
| iframe → main | `ready` | `{}` | Sketch loaded + started drawing |
| iframe → main | `error` | `{message, stack}` | Sketch threw; main displays error placeholder |
| main → iframe | `export` | `{}` | Request PNG export |
| iframe → main | `exportResult` | `{dataUrl}` | PNG data URL ready |

## 7. SDF helper bundle inventory (~28 functions, ~6KB minified payload)

Sourced from BOB code shared by user 2026-06-20. **BOB-specific composite SDFs REMOVED** (Sprint 3 amendment 2026-06-20 afternoon): sdfSunset / sdf_building / sdf_bridge1 / sdf_bridge2 / sdf_BTC / sdf_cactus / sdf_tree / sdf_wall / sdf_flower are BOB-art creative vocabulary, not general primitives. LLM should compose specific scenes from general primitives, not be limited to BOB's specific imagery library.

**Vector math (17)**: `sub2`, `add2`, `mul2`, `dot2`, `len2`, `lenSq2`, `rot2`, `trans2`, `clamp1`, `clamp2`, `max2`, `min2`, `fract1`, `fract2`, `scale2`, `eq2`, `step1`

**General SDF primitives (11)**: `sdf_box`, `sdf_circle`, `sdRoundBox`, `sdTriangle`, `sdTrapezoid`, `sdEtriangle`, `sdf_line`, `sdf_line2`, `sdf_moon`, `xRepeated`, `sdf_rep`

`sdf_moon` kept because it's the general "occluded circle" idiom (Math.max(circle1, -circle2)) useful for any crescent/cutout shape, not just moons. `xRepeated` + `sdf_rep` kept as useful repetition idioms for grid/array layouts.

Helpers are exposed as `window.*` globals inside iframe via `sdf-helper-bundle.js`. LLM-generated P5 sketch can call them directly:

```js
function setup() {
  createCanvas(600, 360);
  noStroke();
}
function draw() {
  background(255);
  for (let y = -1; y <= 1; y += 0.02) {
    for (let x = -1; x <= 1; x += 0.02) {
      const d = sdf_circle([x, y], [0, 0], 0.5);
      if (d < 0) {
        fill(...__brandingPalette.silhouetteColor);
      } else {
        fill(...__brandingPalette.bg);
      }
      drawShape(...);  // Or just rect()
    }
  }
}
```

## 8. Lift LLM routing — 3-priority preference (SDF first, P5 fallback) (system prompt v3.19 → v3.20)

**Major Sprint 3 amendment (2026-06-20 afternoon, final lesson)**: routing is NOT 3 equal tiers. **SDF gets first 2 priorities (literal + metaphorical); P5 is fallback (graceful degradation) for content where no concrete metaphor lands.** SDF metaphor is Atlas's real wedge that vector primitives cannot replicate.

### The 3-priority routing

For each user-selected paragraph, the LLM tries priorities in order:

**Priority 1 — SDF DIRECT (literal concrete)** (Atlas Sprint 1 v4 capability, FREE):
- Trigger: text contains concrete nouns ("robot", "cube", "cathedral", "carrier", "tree")
- Output: traditional-subjects SceneData using existing 40+ atom primitives
- Renderer: existing 4 CPU 2D renderers (silhouette / lines / crayon / topo)
- Example: "The cathedral on the hill" → SceneData with `cathedral-atom` + `terrain-with-lakes`

**Priority 2 — SDF METAPHORICAL (concrete composition for abstract concept)** ⭐ Atlas's real wedge:
- Trigger: text contains numbers / abstract assertion BUT a concrete metaphor expresses it well
- LLM hunts for metaphor: money→coins / time→hourglass+sand / growth→steps+tower / quantity→N-of-something / network→constellation+stars
- Output: BOB-style SceneData — outline of one concrete (carrier) FILLED with units of another concrete (coins) via SDF compositional pattern
- Renderer: existing CPU 2D renderers (silhouette is enough — the meaning is in the composition, not surface detail)
- **This is what vector primitives CANNOT do effortlessly.** Vector needs you to manually place each coin along carrier path. SDF tests `sdf(x,y) < threshold` per grid cell and fills with whatever — arbitrary outline + arbitrary fill = arbitrary metaphor.
- Example: "$3B to build a carrier" → SceneData with carrier outline + grid cells inside filled with `sdf_circle` (coin)
- Example: "time is running out" → hourglass outline + grid cells inside filled with falling-particle SDF

**Priority 3 — P5 FALLBACK (graceful degradation, 防退化)**:
- Trigger: text is purely abstract relationship AND no concrete metaphor fits (LLM cannot conjure one)
- Output: p5-sketch SceneData with vector primitives (boxes / arrows / lines / textboxes)
- Renderer: new 2d-p5 iframe sandbox
- **This is NOT Atlas's IP stage.** It's a fallback so users never get a degenerate black blob. It exists to make the product complete, not to compete with Napkin/antvis on this layer.
- Example: "X depends on Y depends on Z" with no other concrete content → p5-sketch with 3 boxes + arrows

### How 6 variants exploit the priority hierarchy

Sprint 1.5's variant convergence failure (all 6 = text-card) is addressed by SDF metaphor exploration:

Default 6-variant allocation (when content has concrete + numbers + abstract):
- **~3-4 variants in Priority 1 + 2 (SDF, literal + metaphorical)** — Atlas IP stage
- **~2-3 variants in Priority 3 (P5, fallback)** — defensive coverage

When content has only abstract (no concrete nouns, no number-with-metaphor):
- 1-2 variants in Priority 2 (LLM tries to invent metaphor — may succeed)
- 4-5 variants in Priority 3 (different P5 layouts: vertical list / radial / cards / timeline / compare)

### Worked example — "$3 billion to build an aircraft carrier"

LLM detects:
- Concrete noun: "aircraft carrier" → Priority 1 available
- Number: "$3 billion" → Priority 2 metaphor: coins / dollar bills as fill of carrier outline
- Pure abstract relations: minimal here (the assertion IS "concrete + price")

Optimal 6 variants:
- **v1: Priority 1** — SDF SceneData: literal carrier + literal ground + literal sky (Sprint 1 v4 standard) → silhouette renderer = carrier silhouette
- **v2: Priority 2** ⭐ wedge — SDF SceneData: outline of carrier composed of ~1000 `sdf_circle` (coin) grid → silhouette = carrier-shape made of coins. **VECTOR CANNOT DO THIS easily**
- **v3: Priority 2** ⭐ wedge — SDF SceneData: digit "3" (using existing `text-3d-extruded` outline) filled with dollar-bill-shape primitives (sdRoundBox arrays) → silhouette = giant "3" made of money
- **v4: Priority 1 variation** — SDF SceneData: just the carrier + faint coin scattering around (less aggressive metaphor)
- **v5: Priority 3 fallback** — p5-sketch: large text "$3B" + small "carrier program" label + minimal context shape
- **v6: Priority 3 fallback** — p5-sketch: timeline showing budget growth or compare ($3B vs hospitals/schools)

User picks whichever fits narrative. **v2 + v3 are Atlas's real differentiation** — Napkin and antvis cannot produce them; their vector pipeline gives flat numbers/text but no compositional metaphor.

Convergence problem solved AND wedge highlighted: LLM is INSTRUCTED to attempt SDF metaphor when numeric/abstract content is present, before falling back to P5.

### System prompt v3.20 content (replaces my earlier archetype-only Step 4)

Added to `examples/compositor/system-prompt-lift-3d.md` (replaces old Step 4 section ~80 lines):

```markdown
## Step 4: 2D-mode 3-priority routing (Sprint 3) — SDF FIRST, P5 fallback

When opts.mode === '2d', try these priorities IN ORDER. SDF priorities are
Atlas's wedge that vector cannot replicate. P5 is graceful-degradation fallback.

Priority 1 — SDF DIRECT (literal concrete):
  If text contains concrete physical objects (cathedral / carrier / cube / robot
  / tree / city / chair), emit traditional-subject SceneData with sphere /
  cube-3d / cylinder / 40+ existing atom primitives. This uses Atlas's
  strongest capability and reuses Sprint 1 v4 atom library. Renders via
  silhouette / lines / crayon / topo.

Priority 2 — SDF METAPHORICAL (concrete composition for abstract concept) ⭐:
  If text contains number / abstract assertion BUT a concrete metaphor expresses
  it well, HUNT for the metaphor and emit SDF compositional scene:
    - money / expensive → coins (sdf_circle) filling carrier outline (sdRoundBox + composition)
    - time / duration → hourglass outline + particle SDFs as sand falling
    - growth / 10x → steps / tower / ladder rising
    - quantity (N items) → N concrete-shape SDFs (one per item, repeated via xRepeated)
    - network → constellation (sdf_circle stars + sdf_line connections)
    - process / pipeline → assembly-line shapes
  Output: SceneData where Subject A's outline (defined by sdf_box / sdRoundBox /
  sdEtriangle outline shape) is FILLED with Subject B units (sdf_circle / small
  primitive arranged via xRepeated or grid). Uses Atlas's compositional pattern
  that vector primitives cannot replicate.

  This is Atlas's REAL WEDGE. Always try Priority 2 before falling to P5.

Priority 3 — P5 FALLBACK (graceful degradation, 防退化):
  Only when text is purely abstract relationship AND no concrete metaphor fits
  (you genuinely cannot conjure one). Emit p5-sketch with vector primitives
  (boxes / arrows / lines / textboxes). This is fallback, not Atlas IP — its
  purpose is preventing degenerate output, not competing with Napkin/antvis on
  this layer.

For 6 variants per ⚡:
  - Allocate ~3-4 variants in Priority 1+2 when content has concrete or
    metaphorical-eligible material (Atlas IP stage)
  - Allocate ~2-3 variants in Priority 3 (fallback coverage)
  - Pure-abstract content: 1-2 try Priority 2 (invent metaphor), 4-5 Priority 3
    with different layouts (vertical / radial / cards / timeline / compare)
  - NEVER emit all 6 same-tier same-style (Sprint 1.5 convergence failure)

When emitting p5-sketch, ENTIRE sceneData.subjects must be exactly one element of
type 'p5-sketch'. NO mixing p5-sketch with traditional subjects in single variant
(Sprint 4+ may allow).

When emitting p5-sketch, args.code is a complete P5 sketch with setup() and draw().
Runs in sandboxed iframe with these globals available:

- P5 standard API (createCanvas, fill, stroke, vertex, rect, ellipse, text, textSize, textFont, ...)
- Atlas SDF helpers: sdf_box, sdf_circle, sdRoundBox, sdTriangle, sdTrapezoid, sdEtriangle,
  sdf_line, sdf_line2, sdf_moon, xRepeated, sdf_rep
- Vector math: sub2, add2, mul2, dot2, len2, lenSq2, rot2, trans2, clamp1, clamp2,
  max2, min2, fract1, fract2, scale2, eq2, step1
- Atlas branding palette as window.__brandingPalette: { bg: [r,g,b], silhouetteColor: [r,g,b] }

Use textFont('sans-serif'). Use brandingPalette for fill/stroke. Call createCanvas(600, 360).
Complete drawing in single draw() then noLoop() to freeze.
```

Plus 3 worked examples in the prompt:
- Priority 1 example: a literal-concrete prompt (e.g., "a cathedral on a hill") → SceneData with cathedral atom
- **Priority 2 example (CRITICAL — Atlas wedge)**: "$3 billion to build a carrier" → SceneData with carrier outline + coin-fill grid (BOB pattern). LLM needs explicit example of compositional metaphor or it won't try.
- Priority 3 example: "X depends on Y depends on Z" → p5-sketch with 3 boxes + arrows

## 9. Data flow (happy path, Sprint 3-specific)

```
1. user highlights paragraph + clicks ⚡ (Sprint 2 mechanism, unchanged)
2. pipeline.startVisualLift(visualId)
3. callLiftLLM(textAnchor.text, code2d, apiKey, {mode: '2d'})
   → system prompt v3.20 + MODE_2D_ADDENDUM + Step 4 routing
4. parseLiftResponse(text) → SceneData JSON
5. If sceneData.subjects[0].type === 'p5-sketch':
   - validate constraint (all subjects must be p5-sketch, only 1 in Sprint 3)
   - sanitize: keep p5-sketch as-is (no text-3d-* to filter, p5 code is opaque)
6. updateVisualVariantStatus(deck, visualId, variantIndex, 'ready', {sceneData, archetype})
7. saveDeck(deck) + fire lift-ready event
8. visual-panel.refresh() →
   - chooseRenderer(visual) detects p5-sketch in selected variant's sceneData
   - mountP5Renderer(wrapper, sceneData, branding)
   - p5-renderer creates iframe with sandbox=allow-scripts
   - postMessage init {code, palette, helpers}
   - iframe evals p5 code, calls createCanvas + draw, posts 'ready'
   - visual-panel hides loading placeholder, iframe is visible
9. IntersectionObserver watches wrapper; if scrolled off-screen >2 seconds, destroy iframe (free memory). On re-enter viewport, recreate.
10. User clicks image → menu appears. Effects sub-panel is GREYED OUT for p5-sketch variants (no renderer cycle). Swap Layout / Export Visual / Swap Branding work normally:
    - Export Visual: postMessage iframe 'export' → receives PNG dataUrl → downloads
    - Swap Branding: re-mount iframe with new palette in init payload
    - Swap Layout: cycle through 6 cached variants (each may be p5-sketch OR traditional; renderer auto-chosen)
```

## 10. File map

### NEW (Sprint 3)

| Path | LoC est. | Responsibility |
|---|---|---|
| `sdf-js/src/present/p5-renderer.js` | ~180 | iframe sandbox lifecycle + postMessage protocol + IntersectionObserver unmount + exportPng |
| `sdf-js/src/present/p5-sandbox-iframe.html` | ~60 | iframe entry point. Static HTML loading p5.min.js + helper bundle + postMessage listener |
| `sdf-js/src/present/sdf-helper-bundle.js` | ~600 | 40 SDF helper functions exposed as window globals (verbatim from BOB code) |
| `sdf-js/public/p5.min.js` | ~500KB (vendored) | P5.js library — NOT writing, downloading from p5js.org official |
| `sdf-js/scripts/test-p5-sandbox.mjs` | ~80 | L1 unit tests for SDF helpers + mock postMessage |

### MODIFY (small)

| Path | Change |
|---|---|
| `sdf-js/src/scene/spec.js` | Add `'p5-sketch'` to PRIMITIVE_TYPES validator allowlist |
| `sdf-js/src/scene/compile.js` | Add factory entry for `'p5-sketch'` that returns a sentinel SDF (since p5-sketch isn't compiled to SDF; visual-panel detects and routes elsewhere) |
| `sdf-js/examples/compositor/system-prompt-lift-3d.md` | v3.19 → v3.20. Add ~60 lines: Step 4 routing rules + p5-sketch type spec + helper inventory + 2-3 worked examples |
| `sdf-js/src/present/visual-panel.js` | Detect p5-sketch in selected variant; route to mountP5Renderer instead of effect-based renderer. Grey out Effects menu for p5-sketch variants. Swap Branding re-init iframe with new palette. Export PNG via iframe postMessage. |
| `sdf-js/src/present/pipeline.js` | parseLiftResponse: validate p5-sketch constraint (all subjects must be p5-sketch, only 1 in Sprint 3). Add to extractArchetype: if subject[0].type === 'p5-sketch', archetype from sceneData.name still works. |
| `sdf-js/scripts/test-deck-model.mjs` | Add ~5 assertions for p5-sketch subject acceptance in visual.variants[i].sceneData |
| `sdf-js/scripts/test-pipeline.mjs` | Add ~5 assertions for p5-sketch variant handling (mock returns p5-sketch type) |
| `scripts/run-tests.mjs` | Add 1 entry for new test-p5-sandbox.mjs |

### Test inventory

Start: 33 test files (Sprint 2 end). New: +1 (test-p5-sandbox.mjs). End: **34 test files**.

## 11. Sprint 1.5 + Sprint 2 lessons honored

| Lesson | Honor in Sprint 3 by |
|---|---|
| Sprint 1.5: SDF text in 2D = ugly | Sprint 3 introduces p5-sketch type which renders text via Canvas2D inside P5 sketch (system fonts) — no SDF text. MODE_2D_ADDENDUM + sanitize2dSceneData from Sprint 2 Phase 4 still active for traditional subjects. |
| Sprint 1.5: variant convergence on text-heavy content | Sprint 3 directly addresses via §8 3-priority routing: LLM is INSTRUCTED to span Priority 1 (literal SDF) / Priority 2 (metaphorical SDF) / Priority 3 (P5 fallback) across 6 variants. Convergence happens only when content has truly no concrete material AND no metaphor lands (then 4-5 Priority 3 with layout variation). This is the load-bearing fix for Sprint 1.5's variant-divergence failure on Aether AI page 4. |
| 2026-06-20 final reframe (afternoon): SDF metaphor is Atlas wedge | Sprint 3 promotes "metaphorical SDF" (Priority 2) above "P5 vector" in routing hierarchy. P5 is explicitly framed as fallback / 防退化, not equal partner. The carrier-from-coins example is locked into v3.20 worked-example library so LLM tries metaphor before falling to P5. **Without this routing, LLM would default to vector for any non-literal content and Atlas's real IP would never show up in output.** |
| Sprint 1.5: PR body over-claimed | Sprint 3 PR body amendment will document: "p5-sketch path verified end-to-end with real Anthropic API on at least 1 abstract paragraph; subjective quality of P5-sketch variants vs traditional SDF variants honestly compared in PR body" — concrete observations, not "should work" |
| Sprint 1.5: TDD discipline | Sprint 3 Phase 2 (test-p5-sandbox.mjs) + Phase 3 (deck-model p5-sketch acceptance tests) precede implementation |
| Sprint 2: Phase 8 real-API smoke blocked by API key in chat | Sprint 3 Phase 6 browse smoke will use SAME pattern: rely on user having key already in headless browse OR user manually testing post-merge. No more pasting keys in chat. |

## 12. Sprint 4+ deferrals (locked for reference)

- **Mixed subjects** (p5-sketch + traditional in same sceneData) — would allow scenes like "concrete object + label callout via P5 text overlay"
- **GLSL Shader 3D output** — Atlas Present 3D Play mode (Sprint 4+) follows same pattern: LLM emits shader code as subject.type === 'glsl-shader' with args.code = GLSL source
- **SDF metaphor library** (Sprint 5+) — curated collection of "metaphor recipes" LLM can pull from: money→coins, time→hourglass, growth→steps, network→constellation, etc. Each recipe = (outline-shape, fill-unit, composition-pattern). Sprint 3 ships v3.20 prompt with 1-2 metaphor worked examples; library expansion is Sprint 5+ work as we learn which metaphors LLM produces well vs poorly
- **Per-element coloring** (Napkin Colors menu) — currently Branding swap is whole-palette; individual color picker is Sprint 5+
- **Font picker** (Napkin Fonts menu) — currently system-ui only; choice library Sprint 5+
- **Size aspect-ratio picker** (Napkin Size menu) — currently fixed 600×360; choice 1:1/16:9/4:5 Sprint 5+
- **Sync with text** (Napkin Sync menu) — N/A since PDF is immutable; future docx/markdown inputs may revisit
- **POC step** (visualize a single hand-written P5 sketch first) — user opted to skip POC; build full Sprint 3 + iterate based on real LLM output

## 13. Acceptance criteria

- [ ] `npm test` green (34/34, was 33 at Sprint 2 end + new test-p5-sandbox.mjs)
- [ ] Mode-agnostic CI grep on `deck-model.js` v5 still clean (no 3D vocabulary outside enforcement banner)
- [ ] `node --check` syntax OK on all 7 new/modified files
- [ ] Browse smoke verified end-to-end with REAL Anthropic API:
  - Import real PDF (sdf-js/fixtures/test-deck.pdf works)
  - Highlight abstract paragraph (e.g. text-only sentence) → click ⚡
  - Wait ~60-90s for 6 sequential lifts
  - At least 4 of 6 variants render via 2d-p5 renderer (NOT all silhouette black blobs)
  - Click main canvas → menu appears; Effects greyed for p5-sketch variants, Swap Layout / Export / Swap Branding work
  - Export PNG via iframe postMessage works
  - Page reload → state persists (selected variant + branding)
- [ ] **Manual subjective comparison** (PR body): pick same abstract paragraph from Sprint 2 manual L3 (black-blob case). Capture before-after screenshots. Document whether the p5-sketch variant is "more legible than Sprint 2 black blob" — yes/no, honest.
- [ ] PR body lists ONLY verified facts. No "should" / "expected" claims about LLM behavior.

## 14. Hard rules (carried + new)

- **PR workflow** — Sprint 3 commits go on branch `sprint-2-napkin-doc-viewer` (same as PR #9). Push extends PR #9. User merges with `--squash --delete-branch` after Sprint 3 verified.
- **Mode-agnostic schema** — deck-model.js v5 still cannot contain 3D vocabulary outside enforcement banner. New p5-sketch type does not introduce 3D vocab.
- **Atlas IP boundary** — Canvas2D + system fonts for all main-page chrome AND for text inside P5 sandbox (LLM-generated sketches must use textFont('sans-serif') / similar, not import web fonts).
- **iframe sandbox** — sandbox attribute MUST include only `allow-scripts`. NOT `allow-same-origin` (would let iframe read main-page localStorage). NOT `allow-top-navigation` (would let iframe redirect main page).
- **No new dependencies beyond P5** — Sprint 3 adds p5.min.js (~500KB) vendored. NO additional npm packages. No reveal.js, no antvis, no Mermaid.
- **TDD strict** — Phase 2 (p5-sandbox tests) + Phase 3 (schema tests) precede implementation.
- **Browse smoke uses REAL API** — Phase 6 cannot use mock injection only. Real lift end-to-end verification of p5-sketch path.
- **No overclaim in PR body** — Sprint 1.5 + Sprint 2 lesson lock-in.
- **Sprint 3 simplification: no mixed-subjects** — LLM prompt v3.20 + pipeline validation reject sceneData with subjects[] containing both p5-sketch and traditional types.

## 15. Open implementation questions (plan-time)

These are flagged for plan-time decision (not blocking spec approval):

- Where exactly do the 600 LoC of SDF helpers live? (One bundle file `sdf-helper-bundle.js`, or split per category?)
- How does iframe access p5.min.js? Vendored at `sdf-js/public/p5.min.js`, served by dev server, or CDN with SRI? (Vendoring removes external dependency but +500KB to repo.)
- IntersectionObserver threshold: 0 (any pixel off-screen) or 0.5 (half off)? Unmount delay: immediate or 2 seconds?
- Branding palette swap: re-mount iframe (clean but slow) or postMessage palette-update (faster but iframe sketch must support live palette change)? Sprint 3 MVP = re-mount.
- Error handling: when iframe sketch fails (eval error), show what in visual-panel? Spec says "error placeholder"; plan should define the exact placeholder content.
- p5 instance mode vs global mode: iframe uses global mode (window-scoped P5 functions) — confirm plan-time.

---

**Spec status:** Locked 2026-06-20 afternoon. Branch `sprint-2-napkin-doc-viewer` ready for Sprint 3 commits. Awaiting user review of this spec before invoking writing-plans skill to produce the implementation plan.
