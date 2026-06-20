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
