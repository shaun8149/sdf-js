# Text-3D-Pipe Atom Design

**Date**: 2026-06-19
**Status**: Approved (brainstorming complete, ready for implementation plan)
**Scope**: Wave 1-pipe (digits 0-9 + KPI symbols `% . - + $` + space = 16 glyphs)
**Successor**: `docs/superpowers/plans/2026-06-19-text-3d-pipe-plan.md` (next, via writing-plans)

---

## Context

Atlas shipped `text-3d` Wave 1 on 2026-06-18 (commit `117915d`) using `extrude(text2dSDF, depth)` — a pseudo-3D path where each glyph is a 2D outline pushed along Z. The user identified this as an architectural gap: "2D 的文本的 SDF 跟 3D 的是完全不同的，就像 2D 的方形和 3D 完全不同一样". A `rectangle` extruded along Z is fundamentally not the same physical object as a `box`; similarly, an extruded 2D "1" (flat rectangular slab) is not the same physical object as a 3D "1" (rounded cylindrical stroke). Both have legitimate use cases, but they are different visual species.

This spec designs the **true 3D text atom** (`text-3d-pipe`) that complements (does not replace) the existing extruded path. After this ships, presentation slides can express:
- Hero KPI numbers, sculpted slide titles, neon-style brand text → `text-3d-pipe`
- Surface-flush watermarks, axis labels stuck to a floor, signage on a wall → `text-3d-extruded`

The lift LLM (v3.16) learns when to choose each via a clear decision heuristic.

Architectural lock memory: [[m15-lift-pipeline-architecture]]. Typography family memory: [[atlas-typography-waves]]. Naming principle established this session: **Atlas atom names are written for LLM coding agents, not human UI users. Implementation-technique names (`extruded`/`pipe`) are preferred over visual-result names (`flat`/`sculpted`) because LLMs reason more reliably on technical distinctions.**

---

## Section 1 — Architecture

### File organization

```
sdf-js/src/scene/components/typography/
├── glyphs.js              ← UNCHANGED (Wave 1 2D glyph builders, used by text2dSDF)
├── glyphs-pipe.js         ← NEW (Wave 1-pipe glyph builders, built from capsule/torus/sphere)
├── text-3d.js             ← MODIFIED (split into 2 exports — see below)
```

### Atom split (compile.js PRIMITIVE_FACTORIES)

```js
// REMOVED:
'text-3d': (a) => text3dSDF(a),

// ADDED (renamed):
'text-3d-extruded': (a) => text3dExtrudedSDF({
  text: a.text, strokeWidth: a.strokeWidth, height: a.height,
  depth: a.depth, letterSpacing: a.letterSpacing, align: a.align,
}),

// ADDED (new):
'text-3d-pipe': (a) => text3dPipeSDF({
  text: a.text, pipeRadius: a.pipeRadius, height: a.height,
  letterSpacing: a.letterSpacing, align: a.align,
}),
```

**No back-compat alias for the old `text-3d` name**. Rationale: shipped 1 day ago (commit `117915d`), zero downstream dependencies (only test page + Wave 1 demo HTML use it). Direct rename is clean. Visual test page (`text-3d-test.html`) updates to call the new atom names.

### Public exports from `text-3d.js`

```js
export function text2dSDF({ text, strokeWidth, letterSpacing, align }) → SDF2  // unchanged
export function text3dExtrudedSDF({ text, strokeWidth, height, depth, letterSpacing, align }) → SDF3
export function text3dPipeSDF({ text, pipeRadius, height, letterSpacing, align }) → SDF3
```

### Why parallel files (not unified) and not abstract stroke definition

- **Parallel files (chosen)**: `glyphs.js` imports from `d2.js`; `glyphs-pipe.js` imports from `d3.js`. Two import surfaces, two independent construction logics. Grep-friendly, no mental mode-switching when reading either file.
- **Unified single file (rejected)**: two glyph tables sharing one file mixes 2D vs 3D mental contexts unnecessarily.
- **Abstract stroke + 2 compilers (rejected as over-engineering)**: 2D `arc(R, halfAp, thickness)` does not have a clean 1:1 with 3D `cappedTorus(majorR, minorR, capAngle)` (different param semantics). A unifying abstraction would require a mapping layer that adds more code than it saves. Wave 1 = 16 glyphs makes the DRY win negligible. Revisit when Wave 2 (26 letters) ships.

---

## Section 2 — Glyph SDF Construction

### Primitive mapping table (2D → 3D pipe)

| Wave 1 (2D) primitive | Wave 1-pipe replacement | Notes |
|---|---|---|
| `segment([ax,ay], [bx,by], r)` | `capsule([ax,ay,0], [bx,by,0], r)` | Direct lift to z=0. `capsule` is exact 3D segment. |
| `ring(R, thickness)` | `torus(majorR=R, minorR=thickness/2)` + rotate π/2 around X | torus default lives in XZ plane; needs rotation to sit in XY (the glyph plane). |
| `arc(R, halfAp, thickness)` (open arc) | `cappedTorusSDF({ capAngle, majorR: R, minorR: thickness/2 }).rotate(...)` | Uses existing community-ported `cappedTorus`. Rotation orients the opening. |
| `circle(r)` (solid dot) | `sphere(r)` | Direct mapping. |

### Helper function

```js
// In glyphs-pipe.js — analogue to arcSpan() in glyphs.js
function pipeArcSpan(centerX, centerY, radius, a0, a1, pipeR) {
  const halfAp = Math.abs(a1 - a0) / 2;
  const mid = (a0 + a1) / 2;
  const rot = mid - Math.PI / 2;
  return cappedTorusSDF({ capAngle: halfAp, majorR: radius, minorR: pipeR })
    .rotate(Math.PI / 2, [1, 0, 0])   // torus → glyph plane
    .rotate(rot, [0, 0, 1])            // align opening
    .translate([centerX, centerY, 0]);
}
```

### Subtraction philosophy (pipe vs 2D)

Pipe versions of glyphs are **simpler** than 2D versions, not just "2D mapped to 3D". Capsule end-caps are rounded hemispheres (geometric closure), so the small visual-finishing strokes added to 2D glyphs (e.g. base serif of "1", bottom hook of "9", flag of "1") can be omitted in pipe versions. Expected: Wave 1-pipe averages ~30% fewer sub-primitives than Wave 1 (2D).

### Worked examples

**"0"** — single torus, no segments needed:
```js
'0': (r) => ({
  advance: 0.6,
  sdf: torus(0.22, r).rotate(Math.PI / 2, [1, 0, 0]).translate([0, 0.5, 0]),
}),
```

**"1"** — pure vertical capsule (base serif and top flag omitted; round capsule caps give natural finish):
```js
'1': (r) => ({
  advance: 0.35,
  sdf: capsule([0, 0, 0], [0, 1.0, 0], r),
}),
```

**"9"** — top loop (torus) + tail capsule pulled to baseline (bottom hook omitted):
```js
'9': (r) => ({
  advance: 0.55,
  sdf: union(
    torus(0.22, r).rotate(Math.PI / 2, [1, 0, 0]).translate([0, 0.7, 0]),
    capsule([0.22, 0.7, 0], [0.22, 0.0, 0], r),
  ),
}),
```

**"%"** — sphere dots + diagonal capsule (chose sphere over small-torus for the dots; in pipe aesthetic, solid spheres read better at small size):
```js
'%': (r) => ({
  advance: 0.7,
  sdf: union(
    sphere(r * 1.8).translate([-0.18, 0.78, 0]),
    sphere(r * 1.8).translate([0.18, 0.22, 0]),
    capsule([-0.3, 0.05, 0], [0.3, 0.95, 0], r),
  ),
}),
```

### API surface for text3dPipeSDF

```js
text3dPipeSDF({
  text,                  // string (required)
  pipeRadius = 0.06,     // tube radius — analogue to 2D strokeWidth/2; 0.06 = elegant, 0.15 = monumental
  height = 1.0,          // cap height in scene units
  letterSpacing = 0,     // additional gap between glyphs (unit space)
  align = 'center',      // 'left' | 'center' | 'right'
  // NOTE: no `depth` arg — pipe is fully 3D, no extrusion-thickness concept
})
```

The parameter list intentionally differs from `text3dExtrudedSDF` (which has `depth` + `strokeWidth`). The schema difference itself is a signal to the lift LLM: seeing `pipeRadius` confirms intent for pipe, seeing `depth` confirms intent for extruded.

### Implementation effort estimate

| Glyph group | Glyphs | Per-glyph time | Subtotal |
|---|---|---|---|
| Simplest (1-2 primitives) | `0 1 + - .` space | 5 min | 25 min |
| Medium (3-5 primitives) | `2 3 5 % $` | 10 min | 50 min |
| Mixed (round-cap decisions) | `4 6 7 8 9` | 8 min | 40 min |
| **Total** | **16 glyphs** | | **~2 hours** + 30 min smoke test + 30 min debug |

---

## Section 3 — Lift v3.16 LLM Integration

### Decision heuristic (top of v3.16 prompt)

```
Is the text a floating-in-space 3D object, or stuck to a surface as a texture?
  floating-in-space  →  text-3d-pipe       (sculpted, monumental, free-standing)
  stuck-to-surface   →  text-3d-extruded   (flat, surface-conformal, decal-like)
```

### Scene-signal → atom decision table

| Signal in prompt or 2D code | Choose |
|---|---|
| Prompt contains "hero / monument / 立体 / 雕塑 / neon / 霓虹 / 招牌字 / 立体 LOGO / 3D logo" | **pipe** |
| Prompt contains "carved / engraved / painted / 雕刻 / 印刷 / 贴上 / 海报 / sticker / decal / plaque" | **extruded** |
| 2D code: `text2dSDF({ height: ≥0.4 })` and appears among first 3 layers (= hero visual) | **pipe** |
| 2D code: `text2dSDF({ height: <0.15 })` near a large `rectangle` (= label attached to surface) | **extruded** with `depth: 0.02` |
| KPI single large number (90% / $1B / +47%) | **pipe** (always; this is monument by definition) |
| Chart data label floating above a bar | **pipe** |
| Chart axis label flush with floor or pedestal | **extruded** with `depth: 0.01` |
| Slide title floating in scene center | **pipe** |
| Slide subtitle on backdrop wall | **extruded** with `depth: 0.02` |
| Watermark / corner annotation | **extruded** with `depth: 0.01` |
| Cover slide hero TITLE | **pipe** with large `height` (1.5-2.5) and `pipeRadius` 0.12-0.18 |

### Args registry entries (full text for v3.16 insertion)

```
text-3d-pipe:     { "text": string, "pipeRadius"?: number,
                    "height"?: number, "letterSpacing"?: number,
                    "align"?: "left"|"center"|"right" }
                  // True 3D text composed from capsules + toruses + spheres.
                  // Each stroke is a 3D tube; round normals everywhere.
                  // pipeRadius = tube thickness (0.06 default for elegant
                  // Helvetica-like; 0.12-0.15 for monumental hero KPI).
                  // height = cap height in scene units (1.0 default).
                  // Currently supports digits 0-9 + symbols (% . - + $ space).
                  // Letters drop silently — fix by waiting for Wave 2/3.
                  // Use for HERO / MONUMENTAL / FLOATING text where the
                  // text is itself a 3D subject (KPI numbers, sculpted slide
                  // titles, freestanding brand logos, neon signs).

text-3d-extruded: { "text": string, "strokeWidth"?: number,
                    "height"?: number, "depth"?: number,
                    "letterSpacing"?: number, "align"?: "left"|"center"|"right" }
                  // 2D text outline pushed along Z. Faces are flat, edges
                  // are sharp. Best for text that lives ON a surface
                  // (painted, engraved, signage flush with a wall).
                  // depth = Z thickness — 0.01-0.05 for paint/decal,
                  // 0.10 for relief, 0.20+ for raised letters off a wall.
                  // strokeWidth = 2D stroke (0.12 default).
                  // Use for SURFACE-FLUSH text — chart axis labels stuck
                  // to the floor, watermarks, backdrop signage, plaque text.
```

### Worked Example 18a — extruded, chart axis label

```json
{
  "id": "axis-label-bottom-right",
  "type": "text-3d-extruded",
  "args": { "text": "90%", "height": 0.15, "depth": 0.02, "strokeWidth": 0.18 },
  "transform": { "translate": [1.2, 0.05, 0], "rotate": [-1.5708, 0, 0] },
  "material": "matte-paint"
}
```
- `rotate: [-π/2, 0, 0]` lays the text flat on the floor (XZ plane).
- `depth: 0.02` keeps it surface-flush — reads as "painted onto the pedestal".

### Worked Example 18b — pipe, hero KPI

```json
{
  "id": "hero-kpi",
  "type": "text-3d-pipe",
  "args": { "text": "90%", "height": 2.0, "pipeRadius": 0.18, "align": "center" },
  "transform": { "translate": [0, 1.5, 0] },
  "material": "polished-chrome"
}
```
- `height: 2.0` + `pipeRadius: 0.18` produces thick, neon-tube-like text.
- Floats at `y=1.5` as a 3D sculpture; reads as chrome sign / monument.
- `material: 'polished-chrome'` amplifies the pipe specular look.

### Trap section (common LLM failure modes)

- **❌ Trap 1**: `text-3d-pipe` with `pipeRadius < 0.04` → renders as thin wire that disappears at distance. **Fix**: KPI hero numbers use `pipeRadius >= 0.10`.
- **❌ Trap 2**: `text-3d-extruded` with `depth > 0.3` → looks like a stack of bricks, breaks the surface-flush semantic. **Fix**: extruded surface text uses `depth: 0.01-0.05`; only raised-signage text exceeds `0.1`.
- **❌ Trap 3**: pipe text laid flat on the floor (`rotate: [-π/2, X]`) → 3D tubes lying on the ground look anatomically wrong. **Fix**: flat-on-floor text always uses `text-3d-extruded`. Pipe is for upright text.
- **❌ Trap 4**: Text painted on a back-wall rendered with pipe → letters bulge off the wall like alien growths. **Fix**: wall-mounted text uses `text-3d-extruded` with `depth: 0.02`.

---

## Section 4 — Testing Strategy

### 4-layer testing pyramid

| Layer | Speed | Coverage | When |
|---|---|---|---|
| **L1: glyph SDF unit test** | < 1s | each glyph builds + probes correct + is SDF3 (not SDF2) | npm test (CI) |
| **L2: text3dPipeSDF integration test** | < 1s | multi-char layout + scene compile | npm test (CI) |
| **L3: visual showcase in compositor** | manual | 16 glyphs across 8 renderers | dev-local, /browse-verified |
| **L4: lift LLM regression (audit)** | ~$0.40 + 30s | v3.16 prompt actually picks pipe vs extruded correctly | merged into PDF bake step |

### L1 — `sdf-js/scripts/test-text-3d-pipe.mjs` (new file)

Pattern parallels `test-text-3d.mjs`. Required assertions:

```js
// Every glyph builds, has positive advance, is SDF3
for (const ch of supportedPipeChars()) {
  const g = buildPipeGlyph(ch);
  ok(g !== null, `'${ch}' builds`);
  ok(g.advance > 0, `'${ch}' advance positive`);
  if (ch === ' ') continue;
  ok(g.sdf !== null, `'${ch}' has SDF`);
  // probe at 3D point — confirms SDF3 not SDF2
  ok(Number.isFinite(g.sdf([0, 0.5, 0])), `'${ch}' is 3D-callable`);
}

// "0" center is hollow (inside the ring → positive distance)
const zero = buildPipeGlyph('0', 0.06);
const center = zero.sdf([0, 0.5, 0]);
ok(center > 0.10, `"0" center is hollow with margin > pipeRadius (got ${center})`);

// "0" exactly on the torus circle is inside
ok(zero.sdf([0.22, 0.5, 0]) < 0, '"0" on tube ring is inside');
ok(zero.sdf([0.22, 0.5, 0.10]) > 0, '"0" 0.10 outside ring (Z direction) is outside');

// "1" stroke center is inside
const one = buildPipeGlyph('1', 0.06);
ok(one.sdf([0, 0.5, 0]) < 0, '"1" stroke is inside');

// Pipe is fundamentally different from extruded — far above the cap height,
// extruded would be at distance ≈ y - 1.0 (still bounded by extrude depth),
// pipe is at distance to nearest tube (potentially larger for "1" with no
// strokes above y=1.0)
ok(one.sdf([0, 2.0, 0]) >= 1.0, '"1" probe at y=2.0 is well-bounded');
```

### L2 — extend existing `test-text-3d.mjs` with one new group

Adds `Test group 6: text-3d-pipe end-to-end`:

```js
const { compile } = await import('../src/scene/compile.js');

// SceneData with text-3d-pipe compiles
const scenePipe = {
  v: 1,
  defaults: { camera: {...}, light: {...} },
  subjects: [{
    type: 'text-3d-pipe', id: 'kpi',
    args: { text: '90%', height: 2.0, pipeRadius: 0.15 },
    region: 'object',
  }],
};
const compiledPipe = compile(scenePipe, { sanity: false });
ok(compiledPipe.sdf !== null, 'pipe SceneData compiles');
ok(Number.isFinite(compiledPipe.sdf.f([0, 1.0, 0])), 'pipe compiled SDF finite');

// text-3d-extruded still works after rename (regression)
const sceneExt = { ...scenePipe, subjects: [{ ...scenePipe.subjects[0], type: 'text-3d-extruded' }] };
ok(compile(sceneExt, { sanity: false }).sdf !== null, 'extruded type works post-rename');
```

### L3 — visual showcase via compositor (no new HTML page)

Create `sdf-js/examples/compositor/demo-lifts/wave-1-pipe-showcase.json` containing:
- One row of digits 0-9 along X axis (spaced)
- One row of KPI symbols (% $ + - .)
- One hero "90%" at large scale (showcases monumental usage)
- Standard camera, light, ground

Register in `demo-lifts/index.json` with `category: "primitive-showcase"`. To verify visually:
1. Open compositor → loads bundled gallery
2. Click "Wave 1-pipe showcase" card → renders via BOB GPU by default
3. Click each renderer pill (Silhouette / BOB / Lines / Crayon / Topo / FLY 3D / BOB GPU / Blueprint) → verify all 8 renderers handle the SDF cleanly
4. Use `/browse` skill to script screenshots of each renderer

No new standalone HTML page is created — this honors [[reuse-compositor-pipeline]].

### L4 — lift LLM audit (folded into the PDF bake step planned earlier)

The `bake-pdf-lifts.mjs` from the earlier (deferred) Step 2b plan gains an audit pass after baking:

```js
// After all 20 PDF slides are lifted, check each output for correct atom choice.
const expectedPipeSlides = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19];
const expectedExtrudedSlides = [];  // this deck has no surface-text scenarios

let pipeCorrect = 0, pipeMiss = 0;
for (const i of expectedPipeSlides) {
  const sd = JSON.parse(readFileSync(`./examples/compositor/demo-lifts/pdf-slide-${i}.json`)).sceneData;
  const hasPipe = sd.subjects.some(s => s.type === 'text-3d-pipe');
  if (hasPipe) pipeCorrect++; else pipeMiss++;
}
console.log(`pipe-context: ${pipeCorrect}/${expectedPipeSlides.length} chose pipe correctly`);
// soft assertion — if < 70%, log a warning to consider prompt strengthening
```

This is a soft validation of the v3.16 decision rule. Hard failures (e.g. lift emits an unknown atom type) already break `compile()` in the bake step.

### Out of scope (YAGNI)

- No standalone visual test HTML (compositor showcase serves the role).
- No pixel-perfect cross-renderer comparison (renderers intentionally differ).
- No performance benchmark (pipe SDF marginally more expensive than extruded; raymarcher cost difference < 10%, not worth measuring).

---

## File change list

**Created**:
- `sdf-js/src/scene/components/typography/glyphs-pipe.js` (~250 LoC, 16 glyph builders + pipeArcSpan helper)
- `sdf-js/scripts/test-text-3d-pipe.mjs` (~80 LoC, L1 unit tests)
- `sdf-js/examples/compositor/demo-lifts/wave-1-pipe-showcase.json` (showcase scene)
- `sdf-js/scripts/regression/system-prompt-v3.16.md` (archive copy)

**Modified**:
- `sdf-js/src/scene/components/typography/text-3d.js` (rename `text3dSDF` → `text3dExtrudedSDF`, add `text3dPipeSDF`)
- `sdf-js/src/scene/compile.js` (rename factory key `text-3d` → `text-3d-extruded`, add `text-3d-pipe` factory)
- `sdf-js/src/scene/spec.js` (rename PRIMITIVE_TYPES entry, add `text-3d-pipe`)
- `sdf-js/examples/compositor/system-prompt-lift-3d.md` (v3.15 → v3.16 with text-3d-pipe + text-3d-extruded docs)
- `sdf-js/examples/compositor/demo-lifts/index.json` (register wave-1-pipe-showcase entry)
- `sdf-js/scripts/test-text-3d.mjs` (add Test group 6 for end-to-end pipe scene compile)
- `sdf-js/examples/sdf/text-3d-test.html` + `text-3d-test.js` (update atom-type references; OR retire in favor of compositor showcase — defer to implementation plan)
- `scripts/run-tests.mjs` (add test-text-3d-pipe.mjs to mapper category)

**Deleted**: nothing (we rename, not delete).

---

## Open issues (none blocking)

- `text-3d-test.html` (standalone raymarcher visual test, shipped 2026-06-18) violates the [[reuse-compositor-pipeline]] rule that we wrote AFTER it shipped. The implementation plan should decide whether to (a) update its atom names and keep it as legacy unit-visual, or (b) retire it in favor of the compositor showcase. Defer to plan-writing.
- Wave 2-3 (uppercase + lowercase letters) is a separate spec. Pipe versions of letters will need a different stroke-archetype decomposition than digits (more diagonals, more curves). Out of scope here.
- `text-3d-pipe` glyphs use `cappedTorusSDF` (community port) for partial arcs. If `cappedTorusSDF`'s API surface changes in future, glyph builders will need adjustment. Acceptable risk.

---

## Self-review (done by spec author 2026-06-19)

**Placeholder scan**: clean. No TODO/TBD. Code blocks have concrete examples.

**Internal consistency**:
- `text3dExtrudedSDF` / `text3dPipeSDF` naming consistent across Sections 1, 2, 3, 4, file change list — confirmed.
- Atom type names `text-3d-extruded` / `text-3d-pipe` consistent — confirmed.
- `pipeRadius` (not `tubeRadius` or `strokeRadius`) used consistently — confirmed.
- The decision heuristic in Section 3 lines up with the scene-signal table — confirmed.

**Scope check**: 16 glyphs + 1 atom + lift prompt update + 4-layer testing. Reasonable for a single implementation plan. Not decomposable into sub-projects.

**Ambiguity check**:
- "round-cap philosophy" (Section 2) — could be interpreted as "ALWAYS omit serifs". Clarified by example: 1/9/6 omit details, but 4/7 still need their crossbars/diagonals to be recognizable. Implementation plan should follow per-glyph judgment in worked examples (more examples come during build).
- "stuck to surface" vs "floating" (Section 3) — judgment call by LLM. Decision table provides enough concrete signals.

No issues to fix.
