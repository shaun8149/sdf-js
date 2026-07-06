# IR matrix structure — proposal for the 3D end (Sprint 28)

## What shipped this PR

`sdf-js/src/scene/ir.js` gained a 5th structure: `'matrix'`. Two new fields,
flat like the rest of the contract:

- `axes` — REQUIRED for matrix. `[xCategories, yCategories]` — exactly 2
  arrays, each a non-empty array of non-empty strings. e.g. SWOT:
  `[['Internal','External'],['Helpful','Harmful']]`; risk heatmap:
  `[['Very Low',...,'Very High'], ['Very Low',...,'Very High']]`.
- `cells` — REQUIRED for matrix. Same length as `nodes`; each entry is an
  `[xIndex, yIndex]` integer pair into `axes[0]`/`axes[1]`.
- `magnitude` stays optional (already existed) — for matrix it means bubble
  size or severity weight (e.g. risk = likelihood × impact).

`validateIR` gates all of this: axes shape, cells length/type/range. Every
other structure ignores axes/cells entirely — permissive, per the existing
contract style (unknown fields are ignored, not rejected).

### Examples

```js
// SWOT
{ structure: 'matrix', nodes: ['Strong brand', 'High burn', 'Asia entry', 'Competitor'],
  axes: [['Internal','External'], ['Helpful','Harmful']],
  cells: [[0,0], [0,1], [1,0], [1,1]], title: 'SWOT Analysis' }

// Risk heatmap (likelihood × impact, severity as magnitude)
{ structure: 'matrix', nodes: ['Data breach', 'Vendor delay'],
  axes: [['Very Low','Low','Medium','High','Very High'], ['Very Low','Low','Medium','High','Very High']],
  cells: [[3,4], [4,1]], magnitude: [20, 5], emphasis: [0], title: 'Risk Assessment' }
```

## Why

The atoms-to-ir coverage doc (`docs/superpowers/atoms-to-ir-coverage.md`)
tracked 13 genuinely-structural atoms with no IR mapping. Six of them —
`swot`, `risk-heatmap`, `cost-benefit-matrix`, `org-vs-org-matrix`,
`matrix-grid`, `nine-field-matrix` — share one shape: two categorical axes,
each node dropped into one cell. That's a real, common structure (2x2
strategy grids, GE/McKinsey 9-box, risk matrices) that `sequence` /
`hierarchy` / `network` / `magnitude` cannot express without lossy
downgrades. Text-to-ir's LLM path can already produce 2-axis classification
content today (a prompt like "SWOT: strong brand is a strength, high burn is
a weakness…" is exactly this shape) — the IR just had nowhere to put it.

## What already works today (as of this PR)

- **Bridge 1** (`scaffold-to-ir.js`): all 6 matrix-family atoms → matrix IR.
- **Bridge 2** (`ir-to-2d.js`): matrix IR → one of `swot` /
  `cost-benefit-matrix` / `risk-heatmap` / `matrix-grid` (picked by
  `chooseMatrixAtom`, shape-driven — swot-shaped axes → `swot`, generic 2x2 →
  `cost-benefit-matrix`, ≥3×≥3 with magnitude → `risk-heatmap`, else
  `matrix-grid`).
- **text-to-ir**: the LLM system prompt documents `matrix` alongside the
  other 4 structures; `parseIRResponse`/`validateIR` accept it.
- **deckToIR guard**: `render-ir.js`'s `RENDERERS` dispatch throws on an
  unknown structure, so `deckToIR` filters matrix slides out of the
  assembleDeck-bound `slides` array by default (logging a one-line notice
  per filtered slot) rather than let a matrix IR reach the cinematic
  renderer and crash it. `deckToIR(dir, { structures: [...RENDERER_STRUCTURES, 'matrix'] })`
  opts back in once a renderer exists.

Net: the IR *contract* and *both 2D-facing bridges* are done. What's missing
is the 3D structure renderer — the thing `render-sequence.js` /
`render-hierarchy.js` / `render-network.js` / `render-magnitude.js` are for
the other 4 structures.

## What the 3D end needs to build

A `render-matrix.js` alongside the existing 4, registered in
`render-ir.js`'s `RENDERERS` map (and added to `RENDERER_STRUCTURES`, which
un-gates `deckToIR` automatically — no other call site changes needed).

Suggested visual, in keeping with the "fighting-game cinematic" grammar the
other renderers use (monolith rows, camera shots per beat):

- **Floor grid of cells** — a literal `axes[0].length × axes[1].length`
  floor plane, gridlines dividing it into cells, axis category labels
  along the two edges (billboard text, like `render-magnitude`'s bar
  labels).
- **Node monoliths standing in their cell** — each node is a monolith
  (reuse the primitive `render-magnitude` already uses for bars) placed at
  its `cells[i]` cell's floor position. Multiple nodes in the same cell
  cluster/offset within the cell footprint (same problem `render-network`
  solves for co-located hub satellites).
- **Severity/size as height** — when `magnitude` is present (risk heatmap's
  likelihood×impact severity, org-vs-org's bubble size), map it to monolith
  height, exactly like `render-magnitude` maps magnitude to bar height. This
  keeps "taller = more" a single learned visual grammar across the whole
  IR system rather than a per-structure special case.
- **Emphasis hook** — `ir.emphasis` (already a shared field) highlights one
  node's monolith (color pop / camera hero shot), same contract as the other
  3 renderers.
- **Camera sequence** — an establishing top-down shot (reads the grid like a
  quadrant chart), then a low dolly along the tallest/emphasized monolith,
  matching the beat structure `assemble-deck.js` already expects from every
  structure renderer.

None of this requires new SceneData primitives — monolith + floor plane +
billboard text are all things the other 4 renderers already use, which is
the point: matrix reuses the existing visual vocabulary instead of
inventing a 5th one.
