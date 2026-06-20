# Sphere atom family — design spec (Sprint 2)

**Date:** 2026-06-20
**Author:** Atlas (stormspire100)
**Status:** implemented

## Goal

Ship the four PresentationLoad "3D Spheres …" templates flagged in the atom
roadmap as the highest-value missing shapes (sphere-fill is the deck P0, marked
"我们 deck 用，最痛"). All four are **composite atoms** in the cube-3d tradition:
built entirely from shipped, GLSL-emit-registered primitives + boolean ops, so
GPU emit comes for free via the leaf primitives — no hand-written GLSL.

| atom | PresentationLoad template | core geometry |
| --- | --- | --- |
| `sphere-fill-3d` ⭐ | 3D Spheres Fill Levels | cage rings (torus×3) + liquid cap (cut-sphere) |
| `sphere-network-3d` | 3D Spheres Network | hub sphere + satellites + capsule links |
| `sphere-tree-3d` | 3D Spheres Tree Structures | level-by-level spheres + parent→child capsules |
| `sphere-segmented-3d` | 3D Spheres Divisions | sphere ∩ two half-planes per wedge, exploded |

## Why geometry-only (no per-part color)

`compile.js` colors **one subject = one region**; the per-part `colors` arg on
cube-3d is not wired into the color pipeline. So every atom here is designed to
**read correctly mono-colored**: the fill cage is a wireframe globe so the empty
volume above the waterline is visible; segments separate via an explode gap;
networks/trees read through node+link structure.

## API surface

### sphere-fill-3d
`levels[]` (fill 0..1, default `[0.25,0.5,0.75,1.0]`), `count`, `radius=0.6`,
`spacing=0.3`, `cage=true`, `cageThickness=0.025`, `fillScale=0.92`.
Waterline `h = r·(2f−1)`; full tank (`f≥1`) routes to a plain `sphere` because
`cutSphere(r, ±r)` is degenerate (`w→0`). Liquid is mirrored (rotate π about X)
so `cutSphere`'s y≥h cap becomes a bottom-up fill.

### sphere-network-3d
`count=6`, `hubRadius=0.5`, `satelliteRadius=0.28`, `radius=1.5` (orbit),
`linkThickness=0.05`, `arrangement` ∈ `ring` (XZ) | `ring-xy` (XY) | `sphere`
(fibonacci). Hub at origin, capsule from hub center to each satellite.

### sphere-tree-3d
`levels=3` (1..5), `branching=2` (1..5), `rootRadius=0.4`, `radiusFalloff=0.78`,
`levelHeight=1.0`, `spread=3.0`, `linkThickness=0.045`. Level l has `branching^l`
nodes spread across the full width; parent of node i is `⌊i/branching⌋`. Levels
and branching are clamped to bound the node count / unrolled GPU union.

### sphere-segmented-3d
`segments=6` (2..24), `radius=0.7`, `explode=0.12`, `gapAngle=0.06`. Wedge i
centered at `θm = i·2π/N`, half-span `α = π/N − gapAngle/2`. With direction
`d(θ)=(sinθ,0,cosθ)`, inward normals are `(cos(θm−α),0,−sin(θm−α))` and
`(−cos(θm+α),0,sin(θm+α))`; wedge = `sphere ∩ plane(nLo) ∩ plane(nHi)`, then
shifted along `d(θm)` by `explode`.

## File layout

New: `src/scene/components/shapes/sphere-{fill,network,tree,segmented}-3d.js`,
`scripts/test-sphere-{fill,network,tree,segmented}-3d.mjs`.
Modified: `src/scene/compile.js` (imports + `PRIMITIVE_FACTORIES`),
`src/scene/spec.js` (`PRIMITIVE_TYPES`), `scripts/run-tests.mjs` (`shapes`).

## Tests

Each atom: CPU SDF probe assertions (inside/outside discrimination of the
defining feature — fill level, link, branch, wedge gap) + edge cases +
SceneData → compile → GLSL-emit end-to-end. 56 assertions across 4 files, all
green; full suite 38/38.
