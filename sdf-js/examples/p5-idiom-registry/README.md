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

## Idiom files (Sprint 4, sourced from Gorilla Sun / Ahmad Moussa)

| File | Source | Atlas use case |
|---|---|---|
| `moussa-recursive-circle-pack.js` | [Recursive Circle Packing Algorithm](https://www.gorillasun.de/blog/a-recursive-circle-packing-strategy-for-organic-growth-patterns/) — Ahmad Moussa, Jul 15 2023 (concept credited Kevin Workman, 2021 Genuary) | Wedge upgrade: variable-size coin fill of carrier outline, organic clustering (vs Sprint 3 uniform grid coin dots) |
| `moussa-irregular-grid-pack.js` | [Algorithm for Irregular Grids](https://www.gorillasun.de/blog/an-algorithm-for-irregular-grids/) — Ahmad Moussa | L6-6C wedge boundary fix: non-uniform KPI cards (1 large + 2 medium + 3 small) instead of 8 identical rounded_box |
| `moussa-shape-pack-grid-collision.js` | [Simple Solution for Shape Packing in 2D](https://www.gorillasun.de/blog/a-simple-solution-for-shape-packing-in-2d/) — Ahmad Moussa | Wedge generalization: fill carrier outline with arbitrary shapes (dollar bills / soldiers / icons) via grid-based collision detection |
| `moussa-graphics-buffer.js` | [The P5 Graphics Buffer](https://www.gorillasun.de/blog/the-p5-graphics-buffer/) — Ahmad Moussa | Performance: render expensive sub-pattern (e.g., 1 carrier silhouette) once to buffer, then `image()` it N times for 3-carriers L6-6A pattern |
| `moussa-rounded-polygon.js` | [Algorithm for Polygons with Rounded Corners](https://www.gorillasun.de/blog/an-algorithm-for-polygons-with-rounded-corners/) — Ahmad Moussa | Aesthetic: hierarchy/network chart node smoothing (L5-5B org chart boxes) |

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
