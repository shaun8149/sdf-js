# Cube-3D Atom Design Spec

**Date:** 2026-06-19
**Status:** Awaiting user review
**Effort:** ~8-12 hours (human ~3-5 days, CC+gstack subagent-driven ~6-10 hours)
**Position:** First Shape atom from the 24-atom PresentationLoad backlog (see `project_atlas_atom_taxonomy` memory). Warm-up for the cube family; same pattern will be repeated for `sphere-fill-3d`, `pyramid-variant`, etc.

---

## 1 — Goal

Ship one parameterized Atlas atom `cube-3d` that covers **all five PresentationLoad cube templates** in a single API:

| PresentationLoad template | Doc ID | # slides | Key features required |
|---|---|---|---|
| 3D Cubes – Count | D1501 | 20+ | row / grid / cluster, per-cube color highlight, per-cube push-forward offset |
| Connected 3D Cubes | D2628 | 32 | pipe-through skewer, hub-spokes, tower, pipe-vertical |
| 3D Glass Cubes | D2431 | 40 | glass material with wireframe edge, grid3d (Rubik), wedding-cake stacks |
| Buzzword Cubes | D7031 | 4+ | letter-spell rows, multi-face same-word labels, multi-face different-letter labels |
| 3D Cubes – Count (D1501 variant) | D1501 | 3+ | size variation, rotation jitter |

Combined coverage: **~96 reference slides → 1 atom**.

Visual quality target = IQ "Raymarching – Primitives" (Shadertoy `Xds3zN`) **minus floor plane, minus sky background, minus distance fog** (per user instruction 2026-06-19). The atom itself ships pure geometry + materials; render quality lives in the compositor's shader stack.

Atom naming follows `feedback_atom_naming_for_llm` — LLM coding agent is the user, not a human picking from a UI. `cube-3d` (technical name) over `boxes` / `blocks` / `tiles` (visual names).

---

## 2 — API surface

19 args, 10 arrangements, 3 materials, 4 connector modes, 3 per-cube transform arrays.

```js
import { cube3dSDF } from 'src/scene/components/shapes/cube-3d.js';

cube3dSDF({
  // === Core arrangement ===
  count: 5,
  arrangement: 'row',
  // 'row' | 'flow' | 'semicircle' | 'hub-spokes' | 'steps' | 'stack'
  // | 'tower' | 'grid' | 'grid3d' | 'cluster'
  cubeSize: 0.6,                  // edge length (full, not half-extent)
  cornerRadius: 0.04,             // 0 = sharp cube; positive = rounded box
  spacing: 0.2,                   // gap between cubes (arrangement-dependent)
  arrangementParams: {},          // arrangement-specific, see § 2.1

  // === Labels ===
  labels: [],                     // one string per cube, drawn on front face
  labelsByFace: null,             // 2D array: [[front,back,top,bottom,left,right], ...]
  labelOnAllFaces: false,         // same `labels[i]` drawn on every visible face of cube i
  labelMaterial: 'pipe',          // 'pipe' | 'extruded' — passed to text-3d-{material}
  labelScale: 0.6,                // text glyph size relative to cube face (0..1)

  // === Material ===
  material: 'solid',              // 'solid' | 'wireframe' | 'glass'

  // === Per-cube color override ===
  colors: [],                     // string ('blue') or [r,g,b]; one per cube
                                  // empty = auto-color (IQ per-id formula, see § 5)

  // === Connector ===
  connector: 'none',              // 'none' | 'pipe-through' | 'pipe-vertical' | 'spokes'
  connectorThickness: 0.04,
  connectorIndices: null,         // optional [int,...] — only connect listed indices to anchor
                                  // (e.g. hub-spokes connect only [0,2,4,6])

  // === Per-cube transforms (parallel arrays, optional) ===
  cubeSizes: null,                // [s0, s1, ...] — override cubeSize per cube
  cubeRotations: null,            // [[rx,ry,rz], ...] euler radians — per-cube rotation
  cubeOffsets: null,              // [[dx,dy,dz], ...] — per-cube delta position
});
```

### 2.1 — Arrangement math

For all arrangements, cube `i ∈ [0, count)` is placed at a deterministic position computed from `count + cubeSize + spacing + arrangementParams`. All positions centered around origin so the atom can be placed via standard SceneData `transform.translate`.

| arrangement | placement formula | arrangementParams (defaults) |
|---|---|---|
| `row` | `pos_i = [(i − (count−1)/2) · (cubeSize + spacing), 0, 0]` | — |
| `flow` | same as `row` but spacing × 1.5; auto-sets `connector='pipe-through'` if unset | — |
| `semicircle` | `θ = −arc/2 + i · arc/(count−1); pos = R · [sin θ, 0, cos θ]; R = count·(cubeSize+spacing)/arc` | `{ arc: π }` |
| `hub-spokes` | cube 0 = anchor at origin (size = anchorSize); cubes 1..n−1 sit on `semicircle` of radius `2·anchorSize` | `{ anchorSize: 1.0, arc: π }` |
| `steps` | `pos_i = [(i − (count−1)/2)·(cubeSize+spacing), i · stepHeight · (ascending ? 1 : −1), 0]` | `{ stepHeight: 0.3, ascending: true }` |
| `stack` | `pos_i = [0, (i − (count−1)/2) · (cubeSize + spacing), 0]` | — |
| `tower` | base = `grid(baseRows × baseCols)` on Y=0 plane; top = `stack(towerCount)` centered above base, lifted by base height + spacing | `{ baseRows: 3, baseCols: 3, towerCount: 3 }` |
| `grid` | `i_col = i % cols`, `i_row = ⌊i/cols⌋`; standard 2D layout centered | `{ cols: 3 }` |
| `grid3d` | `i_x = i % cols, i_y = ⌊i/cols⌋ % rows, i_z = ⌊i/(cols·rows)⌋` — 3D Rubik | `{ cols: 3, rows: 3, depth: 3 }` |
| `cluster` | seeded PRNG (`seed`): `pos = radius · uniformUnitVec3() + [0, 0, zJitter · gaussian()]` | `{ radius: 1.5, zJitter: 0.3, seed: 1 }` |

### 2.2 — Material variants

- **`solid`** — `roundedBox(p, halfSize, cornerRadius)` (already in `d3.js`)
- **`wireframe`** — `boxFrame(p, halfSize, edgeThickness)`. **MAY need port from IQ shader** — verify whether `boxFrame` already exists in `d3.js`; if not, port `sdBoxFrame` from the reference shader. Includes triple obligation per `glsl-latent-gpu-bugs`: `inst.ast` + PRIMS entry + GLSL helper + GLSL registry.
- **`glass`** — composite: `union(roundedBox(0.95·size), boxFrame(1.00·size))` rendered with `material.kind = 4` (translucent — already in shader-idiom-registry). Inner solid slightly smaller to avoid Z-fighting against the wireframe shell.

`material` applies uniformly to all cubes in the atom. Per-cube material mix is out of scope (use multiple cube-3d subjects if needed).

### 2.3 — Label system

Three modes — only one active per cube atom:

| Mode | Triggered by | Effect |
|---|---|---|
| **Front-face only** (default) | `labels[i]` set, no other label arg | text-3d-{labelMaterial} placed on +Z face of cube i, sized to `labelScale · cubeSize`. Glyphs auto-pulled from existing typography Wave 1+2 (digits + uppercase letters). |
| **Same label all faces** | `labelOnAllFaces: true` | text-3d-{labelMaterial} placed on all 6 faces of cube i, same string from `labels[i]`. Use for 4W word cubes (visible from any angle). |
| **Different label per face** | `labelsByFace[i] = [front, back, top, bottom, left, right]` | independent text per face. Use for Buzzword scatter where multiple letters visible at scatter angles. |

Label glyphs are reused from existing `text-3d-pipe` / `text-3d-extruded` atoms — **cube-3d does NOT bundle its own font**. If user requests a label glyph not in Wave 1+2 (e.g. lowercase), the label silently truncates to supported chars (consistent with existing text-3d behavior).

### 2.4 — Connector implementations

| connector | implementation | valid arrangements |
|---|---|---|
| `none` | no connector geometry | any |
| `pipe-through` | single cylinder from `pos_0` to `pos_{count−1}`, radius = `connectorThickness`, going through all cubes like a skewer | `row` / `flow` / `stack` |
| `pipe-vertical` | per-pair vertical cylinders between adjacent cubes on Y axis | `stack` / `tower` |
| `spokes` | cylinders from anchor (cube 0) to each satellite; if `connectorIndices` is set, only listed cubes get a spoke | `hub-spokes` only |

Invalid arrangement+connector combinations throw at factory-time with a descriptive error.

### 2.5 — Per-cube transform overrides

Three optional parallel arrays of length `count`:

- `cubeSizes` — overrides global `cubeSize` for that cube (used for screenshot Connected #3 central large anchor)
- `cubeRotations` — euler `[rx, ry, rz]` in radians (used for D1501 "scattered marbles" tilted cubes)
- `cubeOffsets` — delta position `[dx, dy, dz]` added to arrangement-computed position (used for D1501 "pushed out drawer" — one cube offset forward off the grid wall)

Any array shorter than `count` pads with defaults (no override). `null` entries within an array also = no override for that index.

---

## 3 — File layout

### NEW files

| Path | LoC est. | Responsibility |
|---|---|---|
| `sdf-js/src/scene/components/shapes/cube-3d.js` | ~400 | `cube3dSDF()` + arrangement math + label/connector composition + auto-color |
| `sdf-js/scripts/test-cube-3d.mjs` | ~250 | L1 unit tests, ~30 probe-style assertions |
| `sdf-js/examples/compositor/demo-lifts/cube-3d-showcase.json` | ~150 | L3 visual showcase (4 scenes) |

### MODIFIED files

| Path | Change |
|---|---|
| `sdf-js/src/sdf/d3.js` | Add `boxFrame()` primitive if missing (verify first); include `inst.ast = { kind: 'prim', name: 'box-frame', args: [halfSize, edgeThickness] }` |
| `sdf-js/src/sdf/sdf3.compile.js` | Add `'box-frame': (...)` entry to PRIMS3 emit table |
| `sdf-js/src/sdf/sdf3.glsl.js` | Add `sdBoxFrame()` GLSL helper (port from IQ ref shader); add `'sdBoxFrame'` to `SDF3_GLSL_PRIMITIVES` registry; check no reserved-word identifiers (avoid `half`, `output`, etc per Class 1 bug) |
| `sdf-js/src/scene/compile.js` | Import `cube3dSDF`; add `'cube-3d': (a) => cube3dSDF(a)` to `PRIMITIVE_FACTORIES` |
| `sdf-js/src/scene/spec.js` | Add `'cube-3d'` to `PRIMITIVE_TYPES` set |
| `sdf-js/examples/compositor/system-prompt-lift-3d.md` | v3.17 → v3.18: add cube-3d args registry entry + decision rules + 3 worked examples + 4 traps (see § 6) |
| `sdf-js/examples/compositor/demo-lifts/index.json` | Register `cube-3d-showcase` under `shapes` category |
| `sdf-js/examples/compositor/fly3dRenderer.js` | Separate Phase 7 task: upgrade lighting to IQ 4-light model (see § 5) |

---

## 4 — Test plan (4 layers)

### L1 — Unit tests (`scripts/test-cube-3d.mjs`)

Following pattern from `scripts/test-text-3d-pipe.mjs` (probe-style). 30 assertions across 6 groups:

1. **Arrangements** (10 tests): for each arrangement, build a `count=5` cube-3d, sample SDF at 5 expected cube centers + 1 known-empty position, verify signs correct.
2. **Materials** (3 tests): for each material, verify SDF tree structure (solid = single roundedBox, wireframe = boxFrame, glass = union of two).
3. **Connectors** (4 tests): for each connector mode, verify connector primitive present in SDF tree + correct cylinder count.
4. **Labels** (4 tests): front-face, labelsByFace, labelOnAllFaces, labelMaterial='extruded'.
5. **Per-cube overrides** (3 tests): cubeSizes / cubeRotations / cubeOffsets each individually applied.
6. **Edge cases** (6 tests): count=1, count=0, oversized labels, mismatched colors[] length, invalid arrangement+connector combo (should throw), labelOnAllFaces + labelsByFace combo (should throw or pick one with warning).

All assertions probe-based: `sdf.f([x,y,z])` returns expected sign at known points.

### L2 — Integration (extend existing test files)

- Add cube-3d to `scripts/test-composite-atoms.mjs` if exists; verify compile() succeeds inside a full SceneData scene.
- Verify cube-3d + text-3d-pipe in same scene (label inside cube-3d uses text-3d-pipe internally — confirm no transformer collisions).

### L3 — Compositor showcase

`demo-lifts/cube-3d-showcase.json` containing **4 scenes** demonstrating coverage:

1. **Connected-row**: `row` + `connector: 'pipe-through'` + `labels: ['1','2','3','4']` + per-cube color `colors: ['blue','white','white','white']` — recreates Connected 3D Cubes screenshot #1
2. **Buzzword cluster**: `cluster` + `labels: ['WHAT','HOW','WHY','WHEN']` + `labelOnAllFaces: true` + one cube grey — recreates Buzzword 4W screenshot
3. **Glass Rubik**: `grid3d` (3×3×3) + `material: 'glass'` + `colors[]` with center column blue — recreates Glass Cubes #2
4. **Hub-spokes**: `hub-spokes` + `connector: 'spokes'` + `connectorIndices: [0, 2, 4]` (only some connected) + `colors` mixing green and white — recreates Connected radial screenshot #3

Verify in compositor `/browse` across all 8 renderers (silhouette, BOB, Lines, Crayon, Topo, FLY 3D, BOB GPU, Blueprint). Per `feedback_use_browse_skill_for_visual_verify` — visual verify via headless browser screenshots, not user screenshots.

### L4 — Lift regression (deferred to next bake, ~$0.25)

After v3.18 prompt ships:
1. Spot-test lift on 3 hand-picked deck slides where cube-3d obviously fits (any process/step slide)
2. Verify the lift output uses cube-3d (not rounded_box stacks)
3. Full re-bake all 20 PDF slides (~$4.20 budget) — expected: at least 3-5 slides opt for cube-3d in their composition

Deferred = not blocking cube-3d ship; runs as a separate Phase after atom is merged.

---

## 5 — Render quality integration

The atom emits standard SceneData. Visual quality lives in the compositor's GPU renderers. A **separate Phase 7 task** upgrades `fly3dRenderer.js` shader to match IQ Shadertoy quality.

13 patterns extracted from reference shader Xds3zN:

| # | Pattern | Atlas integration |
|---|---|---|
| 1 | Per-material-id auto-color `col = 0.2 + 0.2·sin(m·2 + vec3(0,1,2))` | New: in cube-3d JS factory, if `colors: []` empty, auto-assign each cube an id float (i · 1.7 + 13.0) → passed as `material.kind` or via aux channel; shader uses formula to derive RGB. Result: 10 cubes auto-render as a harmonious rainbow without user picking colors. |
| 2-5 | 4-light model (Sun + Sky + Back + SSS) | Add 3 lighting blocks to `fly3dRenderer.js` shader (currently has Sun only). Constants below. |
| 3 | Sun: `normalize(vec3(-0.5, 0.4, -0.6))`, color `vec3(1.30,1.00,0.70)`, multiplier 2.20 dif / 5.00 spec | Copy verbatim |
| 4 | Sky: derived from `nor.y`, color `vec3(0.40,0.60,1.15)`, multiplier 0.60 dif / 2.00 spec | Copy verbatim |
| 5 | Back: `normalize(vec3(0.5,0.0,0.6))`, color `vec3(0.25,0.25,0.25)`, multiplier 0.55 dif | Copy verbatim |
| 6 | SSS: `pow(1+dot(nor,rd), 2)` · color · 0.25 | Copy verbatim |
| 7 | Schlick spec: `0.04 + 0.96·pow(1 − dot(hal,lig), 5)` | Apply to sun + sky spec lobes |
| 8 | Soft shadow 24-step `s = clamp(8·h/t, 0, 1)` | Atlas already has this in current shader; verify constants align |
| 9 | AO 5-step | Atlas already has this; verify alignment |
| 10 | Ray differentials | Defer — render at AA=1 first version |
| 11 | Gamma `pow(col, 0.4545)` | Verify present in final composite step |
| 12 | Camera orbit `ro = ta + 4.5·(cos(t), height, sin(t))` | Atlas camera presets; cube-3d showcase JSON hints orbit angle via camera args |
| 13 | Focal length 2.5 | Atlas camera default |

### Patterns SKIPPED per user instruction (2026-06-19)
- Floor plane (`sdPlane(p) = p.y`) + `checkersGradBox` checker pattern — DO NOT add
- Sky bg gradient `vec3(0.7,0.7,0.9) − max(rd.y, 0)·0.3` — DO NOT add
- Distance fog `mix(col, sky, 1 − exp(−0.0001·t³))` — DO NOT add (no sky to match to)

Background renders as solid color (current compositor behavior). Ground/sky will arrive in a separate `gallery-stage-3d` scene container atom (item #3 in the Shapes backlog).

---

## 6 — Lift prompt v3.18 update

Insert after the `text-3d-pipe` entry in `examples/compositor/system-prompt-lift-3d.md`:

```markdown
## cube-3d
- args: { count, arrangement, cubeSize, cornerRadius, spacing, arrangementParams,
          labels, labelsByFace, labelOnAllFaces, labelMaterial, labelScale,
          material, colors, connector, connectorThickness, connectorIndices,
          cubeSizes, cubeRotations, cubeOffsets }
- one atom covers 10 spatial layouts × 3 materials × 4 connector modes
- glyphs in labels come from existing text-3d Wave 1+2 (digits 0-9, uppercase A-Z, % . - + $)

### Decision rules
- Numbered process steps (1, 2, 3, 4) on connected cubes → `arrangement:'row'` + `connector:'pipe-through'` + `labels:['1','2','3','4']`
- Word-as-letters ("BUSINESS", "OUR", "BUY") → `arrangement:'row'`, `spacing:0`, `labels: word.split('')`
- 4-W cluster (WHAT/HOW/WHY/WHEN visible from many angles) → `arrangement:'cluster'` + `labelOnAllFaces:true`
- Org/hierarchy with base + top → `arrangement:'tower'` (use pyramid-3d if smoother apex is required)
- Rubik / cubic grid → `arrangement:'grid3d'`
- Drawer pushed forward off grid → `arrangement:'grid'` + one entry in `cubeOffsets` like `[0,0,0.5]`
- Glass / transparent aesthetic → `material:'glass'`
- Selective hub connector (only some satellites linked) → `arrangement:'hub-spokes'` + `connector:'spokes'` + `connectorIndices:[0,2,4]`

### Traps
1. Don't use cube-3d for numeric bar charts where bar HEIGHT encodes value → use `bar-3d`. Cube-3d cubes are equal-sized (unless `cubeSizes` is explicitly set).
2. `labels.length !== count` is silently truncated/padded — explicit count match expected.
3. `material:'glass'` + `connector:'pipe-through'` looks muddy (refraction through cylinder + glass) — prefer one or the other.
4. `arrangement:'hub-spokes'` requires count ≥ 2 (anchor + at least one satellite).

### Worked example 1 — Process step row
```json
{
  "type": "cube-3d",
  "args": { "count": 4, "arrangement": "row", "cubeSize": 0.6, "spacing": 0.4,
            "labels": ["1","2","3","4"], "labelOnAllFaces": false,
            "connector": "pipe-through", "colors": ["#3B82F6", "#FFFFFF", "#FFFFFF", "#FFFFFF"] },
  "transform": { "translate": [0, 0.3, 0] }
}
```

### Worked example 2 — Buzzword cluster
```json
{
  "type": "cube-3d",
  "args": { "count": 4, "arrangement": "cluster", "cubeSize": 0.8,
            "arrangementParams": { "radius": 1.2, "zJitter": 0.3, "seed": 7 },
            "labels": ["WHAT","HOW","WHY","WHEN"], "labelOnAllFaces": true,
            "material": "solid", "colors": ["#1E90FF","#888888","#1E90FF","#1E90FF"] },
  "transform": { "translate": [0, 0.4, 0] }
}
```

### Worked example 3 — Glass Rubik
```json
{
  "type": "cube-3d",
  "args": { "count": 27, "arrangement": "grid3d",
            "arrangementParams": { "cols": 3, "rows": 3, "depth": 3 },
            "cubeSize": 0.4, "spacing": 0.05, "material": "glass" },
  "transform": { "translate": [0, 0.6, 0] }
}
```
```

Archive previous prompt as `scripts/regression/system-prompt-lift-3d-v3.17.md`.

---

## 7 — Acceptance criteria

1. All 10 arrangements produce visually correct SDFs (probe-tested in L1, visually verified in L3 compositor showcase via `/browse`).
2. All 3 materials render correctly in BOB GPU + FLY 3D + Blueprint without GLSL compile errors. **Real-browser GPU test required** (CPU tests cannot catch reserved-word / .ast / array-index Class 1/2/3 bugs per `glsl-latent-gpu-bugs` memory).
3. Lift prompt v3.18 entry + 3 worked examples + 4 traps committed.
4. L1 test suite passes; CI green; npm test count goes 27 → 28.
5. Showcase JSON renders without errors in all 8 compositor renderers (verify via `/browse`).
6. No new GLSL latent bugs introduced (each new primitive / helper has `.ast` + PRIMS entry + GLSL helper + registry in same commit).
7. fly3dRenderer.js lighting upgrade renders cube-3d-showcase at perceived parity with IQ Shadertoy reference (subjective check, screenshot-compare to user-provided reference image).

---

## 8 — Out of scope (explicitly NOT in this spec)

- Floor / ground / sky / fog (per user 2026-06-19 instruction — defer to `gallery-stage-3d` atom)
- AA > 1 (defer; ship at AA=1)
- Cube spin / motion animation (use scene-level AnimationChannel post-ship)
- Beveled-corner cubes (separate primitive; cornerRadius gives simple rounded only)
- Cubes-as-letter-glyphs (i.e. cube whose SHAPE forms a letter — different concept)
- Cube-segmented-3d / sphere-fill-3d / pyramid-variant — separate atoms with own specs

---

## 9 — Related work

- **Memory**: `project_atlas_atom_taxonomy` (Shapes backlog) — cube-3d is item #1, warm-up for items #2-#11
- **Memory**: `project_glsl_latent_gpu_bugs` — must not introduce Class 1/2/3 bugs
- **Memory**: `reference_compositor_entry_points` — renderer integration map
- **Memory**: `project_m15_lift_pipeline_architecture` — lift prompt shared infra (currently v3.17 → bump to v3.18)
- **Memory**: `feedback_atom_naming_for_llm` — naming convention (technical, not visual)
- **Memory**: `feedback_use_browse_skill_for_visual_verify` — L3 verification via `/browse`
- **Reference shader**: IQ "Raymarching – Primitives" Shadertoy `Xds3zN` (provided by user 2026-06-19)
- **PresentationLoad screenshots** (15+ images shared 2026-06-19 across 5 templates): Connected, Glass, Count, Buzzword variants
- **Spec sibling**: `2026-06-19-text-3d-pipe-design.md` (already-shipped pattern, cube-3d follows same architecture)

---

## 10 — Phase breakdown (preview for writing-plans)

Anticipated 7-phase plan; details to be elaborated by writing-plans skill:

| Phase | Scope | Effort |
|---|---|---|
| 1 | `boxFrame` primitive + 3 GLSL touchpoints (d3.js + sdf3.compile + sdf3.glsl) | 1.5 hr |
| 2 | Arrangement math helpers (10 layouts as pure functions returning position arrays) — TDD | 2 hr |
| 3 | `cube3dSDF()` core (compose primitives + apply transforms + auto-color) — TDD | 2 hr |
| 4 | Label integration (3 modes calling text-3d-pipe/extruded) | 1 hr |
| 5 | Connector geometry (4 modes) | 1 hr |
| 6 | Factory + spec + L1 test suite (~250 LoC test) | 1.5 hr |
| 7 | fly3dRenderer.js 4-light upgrade + L3 showcase JSON + visual verify | 2 hr |
| 8 | Lift prompt v3.18 + commit + memory update + push | 0.5 hr |

**Total: ~11.5 hr** (alone). Subagent-driven parallel: ~7-9 hr wall time.
