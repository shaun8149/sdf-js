# SceneData v1 — Specification

> The shared format that all four Compositor input sources (LLM, Generator, 2D editor, 3D editor) emit, and that the renderer pool consumes. Lock 2026-05-17.

This document is the **single source of truth** for SceneData. Any change here is a breaking change across all four input pipelines and the Compositor — bump `v` and add migration logic in `serialize.js`.

---

## Why a shared format

The Compositor unifies four input sources into one renderer pipeline:

```
   ┌─ text-mode      (LLM prompt → SceneData)      ─┐
   ├─ generator-mode (autoscope-style PRNG → Data)  ─┤
   │                                                ├→ SceneData → compile() → SDF tree + camera + light → renderer pool
   ├─ 2d-edit-mode   (node-graph editor → Data)    ─┤
   └─ 3d-edit-mode   (viewport editor → Data)      ─┘
```

Without a shared format the four sources become silos. Without **this exact shared format**, scene state can't round-trip: a generator-produced scene can't be opened in the 2D editor for tweaking, an LLM scene can't be saved and re-rendered, a 3D-editor scene can't be auto-animated by the generator framework.

SceneData is JSON-serializable. Every field has a meaningful default. Every renderer can ingest it. Every editor can edit it.

---

## Top-level shape

```ts
type SceneData = {
  v: 1                                  // version. Bump on breaking change; serialize.js migrates.
  id?: string                           // optional unique id (editor save name / generator hash hex)
  name?: string                         // human-readable, displayed in title bar
  hash?: string                         // generator-mode only: the PRNG hash that produced this scene

  subjects: Subject[]                   // top-level scene content. Default semantics: union of all.

  ground?: {
    y: number                           // ground plane y-coordinate, default -1
    region: string                      // region key, default 'ground'
  }

  defaults: {
    camera: CameraSpec
    light:  LightSpec
    palette?: string | string[]         // preset name or hex array; optional
  }
}
```

### Field rules

- `v` is **required**. Always `1` for v1 SceneData. `compile.js` rejects unknown versions; `serialize.js` migrates known older versions.
- `id` is optional. Editor sets it when user names a save; generator sets it to the hex hash; LLM may leave it unset.
- `name` is a display string only. Not used as an identifier.
- `hash` is **only set by generator-mode**. Other sources leave it unset. This is the PRNG seed that reproduces the scene.
- `subjects` is **required and non-empty**. An empty scene is `subjects: []` and must be explicit; consumers should error on missing field, accept empty array.
- `ground` is optional. Omitted = no ground plane (sky only). Present = infinite horizontal plane at `y`.
- `defaults` is **required**. Every scene must declare its intended camera and lighting. Renderers may override but defaults are the starting state.

---

## Subject — the recursive node

Subject is the recursive type for scene content. It has two variants that share the same five fields (`id`, `transform`, `region`, `color`, `animation`):

```ts
type Subject = PrimitiveLeaf | BooleanGroup
```

The two variants are distinguished by `type`:

- `type` matches a **primitive name** (`'sphere'`, `'box'`, `'heart'`, ...) → it's a `PrimitiveLeaf`
- `type` matches a **boolean operator** (`'union'`, `'difference'`, `'intersection'`, `'smoothUnion'`, `'smoothDifference'`) → it's a `BooleanGroup`

This is how "Named primitive instance" and "recursive nesting" coexist: every node is a named instance, and boolean operators are themselves named instances with children.

### PrimitiveLeaf

```ts
type PrimitiveLeaf = {
  id: string                            // unique within scene. Source-assigned (see Subject IDs below).
  type: PrimitiveTypeName               // one of the sdf-js primitive names

  args: Record<string, any>             // primitive-specific arguments (see Primitive registry)

  transform?: Transform                 // optional, applied after primitive construction
  region?:    string                    // default 'object'
  color?:     string | [number, number, number]   // optional renderer hint
  animation?: AnimationChannel[]        // v0 not implemented; field reserved
}
```

`PrimitiveTypeName` enumerates the sdf-js primitive library. See [Primitive registry](#primitive-registry) below for the v1 set; new primitives extend this set without breaking the spec.

### BooleanGroup

```ts
type BooleanGroup = {
  id: string                            // unique within scene
  type: 'union' | 'difference' | 'intersection' | 'smoothUnion' | 'smoothDifference'

  args?: {
    k?: number                          // smooth* blend factor (default 0.05). Ignored for non-smooth ops.
  }

  children: Subject[]                   // required, non-empty (length ≥ 2 for meaningful boolean; length 1 = passthrough)

  transform?: Transform
  region?:    string                    // region key for the whole boolean result. See Region semantics.
  animation?: AnimationChannel[]
}
```

Operator semantics:

| Operator | Equivalent | Result |
|---|---|---|
| `union` | `min(d_a, d_b)` | A ∪ B |
| `difference` | `max(d_a, -d_b)` | A − B (first child minus rest) |
| `intersection` | `max(d_a, d_b)` | A ∩ B |
| `smoothUnion` | IQ smooth-min with k | A ∪ B with rounded seam |
| `smoothDifference` | IQ smooth-max(-) with k | A − B with rounded edges |

For multi-child boolean (length > 2):

- `union` / `intersection` / `smoothUnion`: applied left-to-right, fully commutative
- `difference` / `smoothDifference`: `children[0] − children[1] − children[2] − ...` (subtract all subsequent from first)

---

## Region semantics

Region is a **string key** that downstream consumers map to color, intensity, or pattern.

### On a PrimitiveLeaf
The primitive carries a region key. If unset, default is `'object'`. Renderers look up:

```js
const colorFor = renderer.regionColor[subject.region ?? 'object']
```

### On a BooleanGroup — the resolved decision
**The BooleanGroup.region overwrites the whole group's region.** Children's region keys are discarded for the boolean result.

This is **Region semantics A** (locked 2026-05-17). The alternative B (nearest-child wins at hit point) is rejected for v1 for these reasons:

- Renderer pipeline simplicity: one hit → one region key, no proximity test needed
- Editor UX simplicity: select a boolean node → see one region color
- Round-trip clarity: `boolean(A_region='red', B_region='blue').region='door'` always renders as `'door'`, no ambiguity

If region semantics B is ever needed (e.g. door frame vs door face shown in different colors), it will be a v2 extension and require both spec migration and renderer changes.

### Reserved region keys (convention)
While region keys are caller-defined strings, three are conventional and consumers should map them sensibly by default:

| Key | Convention |
|---|---|
| `'background'` | probe miss / sky / paper bg |
| `'ground'` | ground plane hits |
| `'object'` | default for primitives without explicit region |

Renderers should still accept arbitrary keys (e.g. `'face'`, `'roof'`, `'eye-white'`) and fall back to a neutral color if unmapped.

---

## Subject IDs

Every Subject has a `string` id. **Source-assigned** (caller responsibility):

| Source | ID strategy |
|---|---|
| 2D / 3D editor | Auto-increment within scene: `'sphere-1'`, `'sphere-2'`, `'box-1'`. Reused after deletion = NO (use next available). |
| Generator | Hash-derived deterministic: `'g-${hashShort}-s${index}'` so same hash → same id sequence. |
| LLM (M5+) | LLM generates semantic ids: `'cake-body'`, `'candle-1'`, `'frosting'`. Strict requirement: must be unique within scene. |
| serialize.js (legacy / corrupt input) | If `id` missing on input: assign `'subj-${runningCounter}'` during parse. Logs warning. |

### Constraints
- **Unique within scene**: serialize.js validates and throws if duplicate ids found.
- **Stable across edits**: editor must preserve ids on transform/region change. Only generation (new subject) or deletion changes the id set.
- **String, not number**: array index is NOT a valid id (forbids accidental reliance on order).
- **No leading/trailing whitespace**, no NUL, no slash. Otherwise free-form.

### Why source-given (not auto-generated by compile)
`compile.js` produces an opaque SDF tree. The id must live in **SceneData**, persisted across save/load and rendered consistently. If `compile.js` re-assigned ids each call, undo/redo would corrupt, LLM iterative editing ("make sphere-1 bigger") would break, and editor selection state would reset on recompile.

---

## Transform

Optional on any Subject. Applied **after** primitive geometry construction, **before** boolean composition.

```ts
type Transform = {
  translate?: [number, number, number]  // default [0, 0, 0]
  rotate?:    [number, number, number]  // Euler XYZ in radians, default [0, 0, 0]
  scale?:     number | [number, number, number]  // default 1
}
```

### Composition order on a single Subject
Translate is applied **last** (after rotate, after scale), so `translate: [5, 0, 0]` always moves to world (5, 0, 0) regardless of rotation. Equivalent to standard "TRS" matrix order: `M = T · R · S`, applied as `p' = T · R · S · p` to local-space points.

### Composition order across nested BooleanGroup
Group transform is applied **after** children are composed:

```
group.children → boolean op → apply group.transform → output
```

i.e. nest a translated box and a translated sphere; the group itself can then translate the whole thing again. Children transforms are local; group transform is "post-composition".

### Scale interpretation
- Scalar `scale: 2` → uniform scale 2× on all axes
- Vector `scale: [2, 1, 0.5]` → anisotropic scale (note: anisotropic scale breaks the SDF distance property; treat as approximate)

---

## CameraSpec

```ts
type CameraSpec = {
  yaw: number                           // [-π, π], rotation around world Y axis
  pitch: number                         // [-π/2 + 0.1, π/2 - 0.1], up/down
  distance: number                      // [0.5, 50], camera distance from target

  focal: number                         // 0 = orthographic; > 0 = perspective (focal length)

  targetX: number                       // target offset from world origin
  targetY: number
  targetZ: number
}
```

Camera position is derived as:
```
target = [targetX, targetY, targetZ]
direction = [sin(yaw)·cos(pitch), -sin(pitch), cos(yaw)·cos(pitch)]
position = target - direction · distance
```

`focal === 0` means orthographic projection (used by autoscope clone). `focal > 0` means perspective with focal length ratio (current MVP / Fly3D / BOB GPU default 1.5).

Matches `[project_3d_scene_engine_conventions.md](../../../.claude/projects/-Users-hexiaoyang-Documents-sdf-main/memory/project_3d_scene_engine_conventions.md)` v2 convention.

---

## LightSpec

Single directional/point light. v1 supports one light per scene. Multi-light is v2.

```ts
type LightSpec = {
  azimuth: number                       // [-π, π], horizontal around Y axis
  altitude: number                      // [-π/2 + 0.1, π/2 - 0.1], elevation
  distance: number                      // [1, 50]
  intensity?: number                    // default 1.0, multiplier on diffuse term
}
```

Light position derived as:
```
position = [
  distance · sin(azimuth) · cos(altitude),
  distance · sin(altitude),
  -distance · cos(azimuth) · cos(altitude),
]
```

---

## Animation channel (v0 hook only)

`AnimationChannel` is a **reserved field** on every Subject. v0 compile.js **ignores** it; rendering is static. The hook exists so v1 SceneData files don't need migration when v1 animation evaluator ships.

```ts
type AnimationChannel = {
  channel: string                       // dot-path to the field being animated
  expr: string                          // GLSL-like time expression
}
```

### Channel dot-path

The path navigates into the Subject's fields:

| Channel | Animates |
|---|---|
| `'transform.translate.x'` | translate x component |
| `'transform.translate.y'` | translate y |
| `'transform.rotate.z'` | rotation around z |
| `'transform.scale'` | uniform scale (only if scalar) |
| `'args.radius'` | primitive arg (only on PrimitiveLeaf) |
| `'args.k'` | boolean smooth blend (only on smoothUnion/smoothDifference) |
| `'color.r'`, `'color.g'`, `'color.b'` | per-channel color |

### Expression language

Subset of GLSL-like syntax, time variable `t` (seconds):
```
sin(t * 0.5) * 0.3 + 0.3
cos(t) * 0.1
fract(t * 0.2)
```

Functions in v1: `sin`, `cos`, `tan`, `abs`, `mod`, `fract`, `floor`, `clamp`, `mix`, `smoothstep`.
Operators: `+ - * / %`, parentheses.

### v0 contract
- compile.js parses Subject including animation field
- evaluator stub: returns the static value as if `t = 0`
- no actual animation in v0; field is preserved for round-trip

When v1 evaluator ships, **no SceneData files need migration** — old v1 scenes without animation simply have empty arrays.

---

## Primitive registry (v1 set)

Following 2D and 3D primitive types are valid `PrimitiveLeaf.type` values. Each entry shows the `args` shape.

### 2D primitives (z = 0, treated as 3D when needed via extrusion default 0)

```
circle:     { radius }
ellipse:    { rx, ry }
rectangle:  { width, height, cornerR? }
triangle:   { a, b, c }                      // 3 vertex array
hexagon:    { radius }
star:       { points, outerR, innerR }
heart:      { scale }
arc:        { radius, halfAperture, thickness }
ring:       { radius, thickness }
segment:    { a, b, radius }                 // capsule between 2 points
polygon:    { points }                       // [[x,y], [x,y], ...]
moon:       { thickness, size }
cross:      { armLength, halfT, cornerR? }
pie:        { halfAperture, radius }
horseshoe:  { openAngle, r, thickness }
egg:        { ra, rb }
trapezoid:  { r1, r2, h }
parallelogram: { w, h, skew }
rhombus:    { w, h }
oriented_box: { a, b, thickness }
quadratic_bezier: { A, B, C, t }
```

### 3D primitives

```
sphere:      { radius }
box:         { dims }                        // [w, h, d]
rounded_box: { dims, cornerR }
torus:       { radius, thickness }
capsule:     { a, b, radius }                // 2 endpoints + radius
cylinder:    { radius, height }
capped_cylinder: { a, b, radius }            // 2 endpoints + radius
cone:        { radius, height }
capped_cone: { r1, r2, height }
ellipsoid:   { dims }                        // [rx, ry, rz]
plane:       { normal, offset }              // normal · p = offset
pyramid:     { dims, rotation }              // [w, h, d]
slab3:       { axis, lo, hi }                // 'x'|'y'|'z'
wireframe_box: { dims, edgeR }
tetrahedron: { radius }
octahedron:  { radius }
dodecahedron: { radius }
icosahedron:  { radius }
prism:       { h }                           // hexagonal prism
```

### 2D → 3D operators (special pseudo-primitives)

These wrap a child PrimitiveLeaf (2D) and produce a 3D result. They are `PrimitiveLeaf` themselves (NOT BooleanGroup) because they take exactly one child:

```
extrude:   { source: PrimitiveLeaf, height, easing? }
revolve:   { source: PrimitiveLeaf, offset }     // revolve around y axis at given offset
```

Special case: `source` is a PrimitiveLeaf, not in `children` because it's exactly one. Validation ensures `source.type` is a 2D primitive.

---

## Validation rules (compile.js / serialize.js)

When parsing or compiling, fail loudly on:

1. Missing `v` or wrong `v` (only 1 accepted in v1)
2. Empty `subjects` is permitted (empty scene), missing `subjects` is not
3. Duplicate `id` anywhere in subject tree
4. `BooleanGroup.children` is empty
5. `BooleanGroup.children` has length 1 and is unwrapped to its single child during compile (warning)
6. `PrimitiveLeaf.type` not in primitive registry
7. `BooleanGroup.type` not in boolean operator set
8. Missing `defaults.camera` or `defaults.light`
9. Camera out-of-range fields (clamp + warn)
10. Light altitude / azimuth out-of-range (clamp + warn)

---

## Examples

### Example 1: Single sphere with ground
```json
{
  "v": 1,
  "name": "Hero sphere",
  "subjects": [
    {
      "id": "sphere-1",
      "type": "sphere",
      "args": { "radius": 0.5 },
      "region": "object"
    }
  ],
  "ground": { "y": -1, "region": "ground" },
  "defaults": {
    "camera": { "yaw": 0, "pitch": 0.2, "distance": 3, "focal": 1.5, "targetX": 0, "targetY": 0, "targetZ": 0 },
    "light":  { "azimuth": 0.6, "altitude": 0.8, "distance": 5, "intensity": 1 }
  }
}
```

### Example 2: Autoscope-style arch (nested boolean)
```json
{
  "v": 1,
  "subjects": [
    {
      "id": "arch-1",
      "type": "difference",
      "children": [
        { "id": "arch-block",    "type": "box",      "args": { "dims": [2, 3, 0.3] } },
        {
          "id": "arch-cutout",
          "type": "union",
          "children": [
            { "id": "arch-cutout-rect", "type": "box",      "args": { "dims": [1, 1.5, 0.5] }, "transform": { "translate": [0, 0.5, 0] } },
            { "id": "arch-cutout-arc",  "type": "cylinder", "args": { "radius": 0.5, "height": 0.5 }, "transform": { "translate": [0, 1.25, 0], "rotate": [1.5708, 0, 0] } }
          ]
        }
      ],
      "region": "wall"
    }
  ],
  "defaults": {
    "camera": { "yaw": 0, "pitch": 0, "distance": 5, "focal": 1.5, "targetX": 0, "targetY": 0.5, "targetZ": 0 },
    "light":  { "azimuth": 0.5, "altitude": 0.7, "distance": 5 }
  }
}
```

### Example 3: Animated bird (v0 stores, doesn't evaluate)
```json
{
  "v": 1,
  "subjects": [
    {
      "id": "bird-1",
      "type": "sphere",
      "args": { "radius": 0.15 },
      "transform": { "translate": [0, 5, 0] },
      "animation": [
        { "channel": "transform.translate.x", "expr": "sin(t * 0.5) * 10 - 5" },
        { "channel": "transform.translate.y", "expr": "5 + cos(t * 0.5) * 0.3" }
      ]
    }
  ],
  "defaults": { "camera": {...}, "light": {...} }
}
```

### Example 4: Generator output with hash
```json
{
  "v": 1,
  "id": "0xa4f3b2...",
  "name": "City #34",
  "hash": "0xa4f3b2...",
  "subjects": [ /* 22 buildings + people + birds */ ],
  "ground": { "y": -1, "region": "ground" },
  "defaults": { /* generator-determined camera + light */ }
}
```

---

## Round-trip guarantee

Any SceneData that passes `serialize.parse()` must be re-emittable by `serialize.stringify()` to a structurally equivalent JSON (modulo whitespace and optional field order). This is enforced by `serialize.test.js` round-trip test on every example in this document.

---

## Migration path

When v2 ships (e.g. with region semantics B, multi-light, sound channel, ...):

1. Bump `v` to 2 in this spec
2. Add migration function in `serialize.js`: `migrateV1ToV2(data)`
3. `parse()` detects `v: 1` input, runs migration, returns v2 SceneData
4. Old v1 files keep loading; new files are v2

Renderers always consume the current version. Migration is the responsibility of `serialize.js`, not consumers.

---

## File / API surface (M0 ship target)

```
sdf-js/src/scene/
├── SPEC.md          ← this file
├── spec.js          ← JSDoc type defs + validator() function
├── compile.js       ← compile(sceneData) → { sdf, camera, light, regionFn, groundY }
├── serialize.js     ← parse() / stringify() + version migration
└── README.md        ← short pointer to SPEC.md + API examples
```

### Public API

```js
import { compile, parse, stringify, validate } from 'sdf-js/scene'

// Validate (returns { ok, errors } — does not throw)
const result = validate(rawJson)

// Parse + validate (throws on error)
const scene = parse(jsonString)

// Compile to SDF + camera + light
const { sdf, camera, light, regionFn, groundY } = compile(scene)

// Serialize back
const jsonString = stringify(scene)
```

---

## Definitive validation use case: autoscope-clone refactor

M0 day 4-5: refactor `examples/sdf/autoscope-scenes.js` to emit SceneData. All 6 autoscope scenes (city / sea / forest / village / city-axis / abstract) must round-trip through `compile()` and produce visually identical output in `autoscope-clone.html`. If any scene cannot be expressed in this spec, the spec is incomplete and must be extended before M0 closes.

---

## Status

- 2026-05-17: spec authored, v1 locked. 3 design parameters confirmed in earlier abstraction-layer discussion (see `memory/project_compositor_roadmap.md`).
- Next: write `spec.js` validator + `compile.js` SDF builder. M0 day 2-3.
