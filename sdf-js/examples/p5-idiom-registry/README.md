# P5 Idiom Registry

Curated P5.js technique idioms that Atlas Present's LLM lift can reference when
generating `p5-sketch` subjects (introduced Sprint 3, system prompt v3.20+).

Idioms here are **recipe-only ports** — we learn the technique, re-implement
in our own style, credit original source in file header. Pattern follows
existing `community/` shader port convention (e.g., `iq-solid-angle.js`).

## Why a registry instead of bundling everything in helper-bundle?

- **Helper bundle (`sdf-js/src/present/sdf-helper-bundle.js`, 28 fns)**:
  Stays TIGHT — only general-purpose math + primitive SDF functions exposed
  as window globals inside every iframe. Bigger bundle = bigger network
  payload per visual = slower mount.

- **Idiom registry (this dir)**: Self-contained higher-level patterns. NOT
  loaded into iframe by default. Instead, the lift LLM is taught about them
  via worked examples in `MODE_2D_ADDENDUM` (compositor-api.js). LLM either
  inlines the idiom into its sketch OR references the file path for future
  pre-bundling.

## Idiom files — Sprint 4 (Tier A) + Sprint 5 (Tier B)

### Sprint 4 Tier A — direct Sprint 3 issue fixes (sourced from Gorilla Sun)

| File | Source | Atlas use case |
|---|---|---|
| `moussa-recursive-circle-pack.js` | [Recursive Circle Packing Algorithm](https://www.gorillasun.de/blog/a-recursive-circle-packing-strategy-for-organic-growth-patterns/) — Ahmad Moussa, Jul 15 2023 (concept credited Kevin Workman, 2021 Genuary) | Wedge upgrade: variable-size coin fill of carrier outline, organic clustering (vs Sprint 3 uniform grid coin dots) |
| `moussa-irregular-grid-pack.js` | [Algorithm for Irregular Grids](https://www.gorillasun.de/blog/an-algorithm-for-irregular-grids/) — Ahmad Moussa | L6-6C wedge boundary fix: non-uniform KPI cards (1 large + 2 medium + 3 small) instead of 8 identical rounded_box |
| `moussa-shape-pack-grid-collision.js` | [Simple Solution for Shape Packing in 2D](https://www.gorillasun.de/blog/a-simple-solution-for-shape-packing-in-2d/) — Ahmad Moussa | Wedge generalization: fill carrier outline with arbitrary shapes (dollar bills / soldiers / icons) via grid-based collision detection |
| `moussa-graphics-buffer.js` | [The P5 Graphics Buffer](https://www.gorillasun.de/blog/the-p5-graphics-buffer/) — Ahmad Moussa | Performance: render expensive sub-pattern (e.g., 1 carrier silhouette) once to buffer, then `image()` it N times for 3-carriers L6-6A pattern |
| `moussa-rounded-polygon.js` | [Algorithm for Polygons with Rounded Corners](https://www.gorillasun.de/blog/an-algorithm-for-polygons-with-rounded-corners/) — Ahmad Moussa | Aesthetic: hierarchy/network chart node smoothing (L5-5B org chart boxes) |

### Sprint 5 Tier B — visual identity + organic layouts (Gorilla Sun)

| File | Source | Atlas use case |
|---|---|---|
| `moussa-delaunay-voronoi.js` | [Bowyer-Watson Delaunay](https://www.gorillasun.de/blog/bowyer-watson-algorithm-for-delaunay-triangulation/) + [Delaunay to Voronoi](https://www.gorillasun.de/blog/delaunay-triangulation-and-voronoi-diagrams/) | Organic region partitioning — market share / population density / territorial visualization. Each input point becomes its own polygon territory. Combined Delaunay + Voronoi in one file (Voronoi is the dual of Delaunay). |
| `moussa-perlin-flow-field.js` | [Perlin Flow Fields Part I](https://www.gorillasun.de/blog/perlin-noise-flow-fields-in-processing-part-i/) + [Part II](https://www.gorillasun.de/blog/perlin-noise-flow-fields-in-processing-part-ii/) | Subtle generative background texture — wind/fluid streamlines via 2D noise → angle grid → traced flow lines. Use as low-opacity background, not foreground IP. Tier B visual identity (Atlas P5 output looks distinctive vs flat Napkin/antvis). Replaced P5's noise() with deterministic 2D value-noise so output is reproducible without seeding P5. |
| `moussa-hooke-brush-stroke.js` | [Brush Strokes with Hooke's Law](https://www.gorillasun.de/blog/simulating-brush-strokes-with-hookes-law-in-p5js-and-processing/) — Moussa credits BUN | Hand-drawn line aesthetic. Original is animated cursor-follow; this STATIC port simulates the spring chain along a fixed input polyline → outputs wobbly version with thickness modulated by local "speed" (slow corners = thick, fast straights = thin). Use for connector arrows / annotation underlines / org chart connections to escape "AI sterile vector" feel. |

### Sprint 6 Tier C — color + topology (Kjetil Midtgarden Golid / kgolid)

| File | Source | Atlas use case |
|---|---|---|
| `kgolid-chromotome-palettes.js` | [chromotome](https://github.com/kgolid/chromotome) — MIT (c) kgolid. ~23 palettes curated from hilda + jung + ranganath + kovecses sub-collections (originals: ~120-150 palettes total) | **Major branding upgrade candidate**: current Atlas branding-palettes.js ships 5 simple 2-color presets ({bg, silhouetteColor}). Chromotome adds multi-color palettes (3-7 colors + bg + stroke per palette) enabling KPI cards each in different palette color, cultural/aesthetic diversity (vintage children's book / saturated animal / Indian textile / mid-century modern). Sprint 7 candidate: upgrade Atlas branding system in-place. |
| `kgolid-marching-squares.js` | [topographic](https://github.com/kgolid/topographic) — MIT (c) kgolid | Contour extraction from 2D scalar grid (heightmap, density field, data metric). Outputs line segments OR filled polygons per threshold via classic 16-case dispatch. Self-contained pure-JS (no P5 dep). Includes `buildNoiseGrid` convenience for testing/decorative use. Pairs with chromotome (each level = palette color) + perlin flow field (use noise as scalar if no data). |

### Sprint 7 Tier D — Apparatus CA (kgolid p5ycho deep dive)

| File | Source | Atlas use case |
|---|---|---|
| `kgolid-apparatus-ca.js` | [apparatus-generator](https://github.com/kgolid/apparatus-generator) canonical npm-style version (MIT) + [p5ycho/apparat / apparat2 / apparat3 / apparat4](https://github.com/kgolid/p5ycho) (4 evolution stages, p5ycho/apparat4 added H-symmetry) | Decorative compositional layout — 9-block state machine produces "robot anatomy / blueprint of a fictional machine" aesthetic. Use when content is COMPOSITIONAL (team/department/unit org charts, scheduled blocks, multi-tier dashboards with implicit grouping, system component diagrams). Pairs perfectly with chromotome palettes. |

**Atlas ALSO has** `sdf-js/src/ca/ca.js` — full engine-layer port + SDF region generalization (any SDF predicate as boundary, not just ellipse). The iframe-side idiom here is the STANDALONE inline-able variant for LLM-generated p5-sketches (iframe can't import engine modules). Both implement the same 9-block state machine.

### Sprint 8 Tier E — kgolid p5ycho trio (closing absorption)

| File | Source | Atlas use case |
|---|---|---|
| `kgolid-space-colonization.js` | [p5ycho/colonization](https://github.com/kgolid/p5ycho/tree/master/colonization) | Organic branching tree growth via source attraction + pruning. Different from packCirclesInSDF (packs) — BRANCHES toward source cloud. Use for: process flow trees, dependency graphs, neural diagrams, "reach/expansion" visualizations. Static port (run all iterations in one call) for iframe noLoop. |
| `kgolid-lindenmayer-lsystem.js` | [p5ycho/lindenmayer](https://github.com/kgolid/p5ycho/tree/master/lindenmayer) | L-system string-rewriting fractal plants via turtle graphics. 4 classic presets from Moussa's defaults (balanced/asymmetric/symmetric/wide_canopy). Use for: branding ornament, "growth" content metaphor, section dividers, low-opacity background filler trees. |
| `kgolid-weave-flow-dashes.js` | [p5ycho/weave](https://github.com/kgolid/p5ycho/tree/master/weave) | Multi-layer Perlin flow field as SHORT directional dashes (not long streamlines like moussa-perlin-flow-field). Each cell probes N angles for max gradient, emits 1 dash. N layers with independent noise offsets → woven fabric texture. Pairs with chromotome palettes for layered color woven look. |

These 3 close out the Sprint 7 "Sprint 8+ candidates" list. **kgolid p5ycho absorption COMPLETE** — apparatus (Sprint 7) + chromotome + marching-squares (Sprint 6) + this trio = 6 idioms total from kgolid sources.

### Sprint 7 p5ycho survey — other sketches assessed (~80 total folders)

Folder scan + algorithm read of high-interest candidates. **Recommended Sprint 8+ ports** (3), assessed-and-deferred (5), skip (rest):

**Tier E candidates (Sprint 8+ if user wants):**

| Sketch | Algorithm | Atlas use case |
|---|---|---|
| **p5ycho/colonization** | Space-colonization / DLA-style: random seed points → nearest-source node finder + iterative growth + kill-range | Organic tree/dendrite/branch structures. Different from packCirclesInSDF (circles). Use: process flow trees, dependency graphs, neural network diagrams. ~3.4KB, single sketch.js. |
| **p5ycho/lindenmayer** | L-system: F-axiom + 4 production rules + turtle drawing with angle/extension chaos | Organic decorative fractal plants. Use: tree atom decoration, sketch-note plant motifs, organic branding ornaments. ~3.5KB. |
| **p5ycho/weave** | Multi-layer Perlin flow-field with palette per layer | Tier B alternative aesthetic to moussa-perlin-flow-field — layered + palette-aware. Use as decorative background where chromotome palette should appear in flow texture. ~3.9KB. |

**Assessed and DEFERRED (low Atlas-value-add or overlap with existing idioms):**

- **growth / growth2-4 / trunk / trunk2-3** — generic organic growth, overlaps with colonization + circle pack
- **hexagon** — hex tessellation, narrow vs Atlas's irregularGridPack
- **tectonic / tectonic2** — plate patterns, interesting but specialized
- **horizon / horizon2-4 / topography** — landscape; Atlas already has marching squares
- **patchwork / patchwork2-4** — tile compositions, overlaps with apparatus

**SKIP (visual demos with limited algorithmic reuse):**

- blanket / block-waves / blocks / fractured_square / gaussian / grid / hypo / interpolate / lab / layout / perlin / random_shapes / reaction_diffusion / smokerings / stripes / trace / voronoi (we have Delaunay/Voronoi from Moussa)

### Sprint 5 NOT-ported reference: `srcdoc` iframe pattern

Moussa's [Building an Embeddable Javascript Widget](https://www.gorillasun.de/blog/building-an-embeddable-javascript-widget/) validates our Sprint 3 iframe sandbox approach (both use `sandbox='allow-scripts'` only — same security posture). His variant uses `srcdoc` attribute for fully self-contained iframes (avoids external file dependency / CSP issues) whereas we load `p5-sandbox-iframe.html` as external src. Not ported as code idiom — would require redesigning iframe lifecycle. Optional Sprint 6+ if we hit CSP issues.

## How LLM uses these

When LLM generates a `p5-sketch` for a 2D visual, the v3.21 prompt teaches it:

1. **Pattern recognition**: text mentions ratio / multi-tier metrics? → use
   `moussa-irregular-grid-pack` pattern for non-uniform card layout
2. **Composition**: text mentions concrete object + numbers? → use
   `moussa-recursive-circle-pack` to fill object outline with variable-size
   units (better than Sprint 3 uniform grid)
3. **Multi-instance**: text mentions N of something? → use
   `moussa-graphics-buffer` to render unit once, paste N times

LLM is NOT expected to import these files (iframe sandbox doesn't allow
arbitrary imports). Instead it INLINES the idiom code into `args.code`.
The registry files exist as:
1. Reference for prompt engineers
2. Source for `MODE_2D_ADDENDUM` worked examples
3. Test corpus to verify the pattern compiles + renders correctly

## License + attribution

All idioms credit original article author (Ahmad Moussa @ gorillasun.de) +
upstream concept attribution where given. Atlas modifications: simplified
for embedding in v3.21 prompt examples + adapted to use Atlas branding palette
+ Atlas SDF helper bundle conventions (`sdf_box`, `sdf_circle`, `dist`, etc.).

We do not redistribute Gorilla Sun's articles or copy code verbatim. Our
versions are recipe-only re-implementations.

## Future sources (Sprint 5+)

- Daniel Shiffman / The Coding Train (recursion, particle systems)
- Manolo Gamboa Naon (organic generative)
- Matt DesLauriers (penplot library, sketch utilities)
- Anders Hoff / inconvergent (network/connection patterns)
