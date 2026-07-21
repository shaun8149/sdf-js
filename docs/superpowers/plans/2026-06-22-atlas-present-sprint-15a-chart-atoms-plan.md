# Atlas Present Sprint 15a Implementation Plan — Chart Atoms (7 new + 4 extensions)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 7 new chart atoms (`bubble`, `histogram`, `break-even`, `stacked-area`, `7s-model`, `multiple-arrows`, `nine-field-matrix`) + 4 extensions to existing atoms (`matrix-grid` adds quadrant axes + bubble overlay for BCG; `scatter` adds regression line; `bar` adds target reference line; `pie` confirm segmented mode) to close PresentationLoad chart/diagram coverage gap identified in [[atlas-pl-observation-pool-v3]].

**Architecture:** Each new atom is one ES module under `sdf-js/src/present/atoms-2d/charts/{data,diagrams,matrix}/<name>.js` following the existing atom pattern (exported `spec` object + `drawPseudo3D` Canvas2D function). Registered in `registry.js` ATOM_LOADERS. Extensions to existing atoms add new args without changing existing signatures (backward compat). Lift system prompt v3.32 → v3.33 catalogues new atoms in MODE_2D_ADDENDUM Step 4.5 / Priority 0 atom list.

**Tech Stack:** ESM Node 25, vanilla browser JS, Canvas2D pseudo-3D rendering, NO new npm deps. Existing atoms (`bar.js`, `scatter.js`, `pie.js`, `waterfall.js`) as architectural reference.

**Branch:** `sprint-15a-chart-atoms` (off main `0e48e09` post-15c merge).

**Spec:** [`docs/superpowers/specs/2026-06-22-atlas-present-sprint-15-design.md`](../specs/2026-06-22-atlas-present-sprint-15-design.md) §6 15a chart atoms.

## Global Constraints

- `npm test` must stay 84/84 PASS throughout. Each new atom adds 0 test files (existing `test-atoms-2d-framework.mjs` covers all atoms generically by enumerating registry — verify each new atom passes that test). If `test-atoms-2d-framework.mjs` requires explicit args per-atom, extend its known-args table.
- All new atoms registered in `sdf-js/src/present/atoms-2d/registry.js` ATOM_LOADERS map
- Pseudo-3D style ONLY (no `drawFlat` / `draw3D` — existing atoms use `drawPseudo3D` only per Sprint 14 convention)
- Each atom file exports `spec` (with `type`, `category`, `description`, `args`) + `drawPseudo3D(ctx, args, opts)` function. Match the shape of `sdf-js/src/present/atoms-2d/charts/data/bar.js` (~150 LoC reference)
- Use `palette.colors[i]` from `opts.palette` for per-series coloring; honor `palette.bg`, `palette.silhouetteColor`
- Imports from `../renderer.js` for `rgbCss`, `rgbaCss` helpers
- Branch `sprint-15a-chart-atoms` — no new branches
- 5 PRs total per Sprint 15 plan — this is PR 2/5
- DO NOT push or open PR until all tasks complete + final review done
- DO NOT skip git hooks (`--no-verify`)
- Lint-staged JSON warning on JS-only commits is benign if commit succeeds
- Screenshots saved to `screens/sprint-15a/<atom>.png` (gitignored) for user async review

## File Structure

### NEW (Sprint 15a — 7 atom files)

| Path | LoC est. | Responsibility |
|---|---|---|
| `sdf-js/src/present/atoms-2d/charts/data/bubble.js` | ~180 | Bubble chart — points with (x, y, size, label) plotted on 2D axes. Optional quadrant overlay. |
| `sdf-js/src/present/atoms-2d/charts/data/histogram.js` | ~160 | Frequency distribution chart — N bins, optional bell-curve overlay, optional milestone markers |
| `sdf-js/src/present/atoms-2d/charts/data/break-even.js` | ~170 | Break-even chart — fixed cost line + variable cost line + revenue line + crossover marker |
| `sdf-js/src/present/atoms-2d/charts/data/stacked-area.js` | ~190 | Stacked area chart — N series over X axis (e.g., revenue by segment over time) |
| `sdf-js/src/present/atoms-2d/charts/diagrams/seven-s-model.js` | ~220 | McKinsey 7S — central node + 6 satellite nodes in hexagonal layout, labeled connections |
| `sdf-js/src/present/atoms-2d/charts/diagrams/multiple-arrows.js` | ~180 | Multi-arrow flow — `mode: 'converge'\|'diverge'\|'parallel'` with N arrows |
| `sdf-js/src/present/atoms-2d/charts/matrix/nine-field-matrix.js` | ~190 | 3x3 GE/McKinsey priority matrix — colored bands (red/yellow/green diagonal) + cell labels |

### MODIFY (4 extensions to existing atoms)

| Path | Change |
|---|---|
| `sdf-js/src/present/atoms-2d/charts/matrix/matrix-grid.js` | Add optional `quadrantAxes: { x: string, y: string }` arg + optional `bubbles: [{ row, col, label, size }]` overlay for BCG-style rendering |
| `sdf-js/src/present/atoms-2d/charts/data/scatter.js` | Add optional `regressionLine: boolean` arg — when true, fit linear regression to points + draw line |
| `sdf-js/src/present/atoms-2d/charts/data/bar.js` | Add optional `targetLine: { value: number, label?: string }` arg — horizontal reference line |
| `sdf-js/src/present/atoms-2d/charts/data/pie.js` | Verify donut + `segmentLabels: string[]` works for donut-segmented use case; add if missing |
| `sdf-js/src/present/atoms-2d/registry.js` | Register 7 new atom types in ATOM_LOADERS map |
| `sdf-js/src/compositor-api.js` | Extend MODE_2D_ADDENDUM Priority 0 atom list with 7 new types + arg signatures; bump v3.32 → v3.33 |
| `sdf-js/examples/compositor/system-prompt-lift-3d.md` | YAML `version: 3.32` → `3.33` + frontmatter description append v3.33 changelog |
| `sdf-js/examples/atoms-2d-demo/index.html` | Add 1-2 SAMPLES entries per new atom (for visual verification + screenshot source) |

### Test inventory

Start: 84/84 PASS. After Sprint 15a: **84/84 PASS** (no new test files — existing `test-atoms-2d-framework.mjs` enumerates all registry atoms). If framework test needs known-args table extension, do that in Task 8.

---

## Phase 0 — Pre-flight

### Task 0.1: Confirm baseline

- [ ] Branch is `sprint-15a-chart-atoms`, status clean, top commit on `main` is `0e48e09`
- [ ] `npm test` → 84/84 PASS
- [ ] Read `sdf-js/src/present/atoms-2d/charts/data/bar.js` end-to-end to internalize the reference atom shape

---

## Phase 1 — 4 extensions to existing atoms (1 task)

### Task 1.1: Add quadrantAxes + bubbles to matrix-grid; regressionLine to scatter; targetLine to bar; verify pie donut-segmented

**Files:**
- Modify: `sdf-js/src/present/atoms-2d/charts/matrix/matrix-grid.js`
- Modify: `sdf-js/src/present/atoms-2d/charts/data/scatter.js`
- Modify: `sdf-js/src/present/atoms-2d/charts/data/bar.js`
- Modify (verify only): `sdf-js/src/present/atoms-2d/charts/data/pie.js`

**Interfaces:**
- Consumes: existing renderer + palette helpers
- Produces: backward-compat extensions — new args are optional; old args still work; existing demo SAMPLES unaffected

- [ ] **Step 1: matrix-grid extension**

Add to `args` schema:
```
quadrantAxes: { type: '{x: string, y: string}?', example: { x: 'Market Growth', y: 'Market Share' } },
bubbles: { type: 'array of { row, col, label?, size? }?', example: [{ row: 0, col: 1, label: 'Stars', size: 0.5 }] },
```

In `drawPseudo3D`, if `args.quadrantAxes` present:
- Draw X-axis label below grid + arrow indicator
- Draw Y-axis label left of grid + arrow indicator (rotated 90°)
- Optionally adjust grid padding to accommodate axis labels

If `args.bubbles` present:
- For each bubble, compute cell center based on (row, col) + `size` (0..1 relative to cell size)
- Render filled circle with palette color + label inside
- This is the BCG-matrix use case (each bubble = product/business unit positioned in 1 of 4 quadrants)

- [ ] **Step 2: scatter regressionLine extension**

Add to `args`:
```
regressionLine: { type: 'boolean?', default: false, example: true },
```

In `drawPseudo3D`, if `regressionLine: true`:
- Compute linear regression of `args.points` (least squares: slope = Σ((xi - x̄)(yi - ȳ)) / Σ((xi - x̄)²); intercept = ȳ - slope*x̄)
- Draw line from x_min to x_max using computed slope+intercept, clipped to plot area
- Use palette accent color, dashed stroke (3-3 dash pattern)

- [ ] **Step 3: bar targetLine extension**

Add to `args`:
```
targetLine: { type: '{value: number, label?: string}?', example: { value: 2.5, label: 'Target' } },
```

In `drawPseudo3D`, if `args.targetLine` present:
- Compute y-pixel for `targetLine.value` using the same y-axis scale as bars
- Draw horizontal dashed line across plot area in palette accent color
- If `targetLine.label`, render label above the line at right edge

- [ ] **Step 4: Verify pie donut-segmented use case works**

Currently pie supports `donutRatio` (donut mode) and renders `labels[]` per segment. Verify a call like `{ values: [25, 35, 40], labels: ['A','B','C'], donutRatio: 0.55 }` renders correctly. If yes, no change needed; document in commit message.

- [ ] **Step 5: Run tests + commit**

```bash
npm test
```

Expected: 84/84 PASS (existing framework test should pass — extensions are additive).

```bash
git add sdf-js/src/present/atoms-2d/charts/matrix/matrix-grid.js sdf-js/src/present/atoms-2d/charts/data/scatter.js sdf-js/src/present/atoms-2d/charts/data/bar.js
git commit -m "sprint-15a: extend matrix-grid/scatter/bar with quadrantAxes/regressionLine/targetLine

Phase 1 of Sprint 15a — backward-compat extensions to 3 existing atoms:
- matrix-grid: new optional quadrantAxes + bubbles args enable BCG-style
  rendering (2x2 with axis labels + product bubbles per quadrant) on top
  of existing N×M cell grid
- scatter: new optional regressionLine boolean computes least-squares fit
  + draws dashed line from x_min to x_max
- bar: new optional targetLine: {value, label?} draws horizontal reference

Pie donut-segmented already works via existing donutRatio + labels.

84/84 tests PASS — all args optional, existing demo SAMPLES unaffected.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase 2-8 — 7 new atoms (one task each)

Each task follows the same template. The implementer reads the existing similar atom for reference, copies its skeleton, swaps in atom-specific rendering logic.

### Task 2.1: bubble atom

**Reference atom:** `sdf-js/src/present/atoms-2d/charts/data/scatter.js` (bubble = scatter + size dim)

**Files:**
- Create: `sdf-js/src/present/atoms-2d/charts/data/bubble.js`
- Modify: `sdf-js/src/present/atoms-2d/registry.js` (add `'bubble': () => import('./charts/data/bubble.js')`)
- Modify: `sdf-js/examples/atoms-2d-demo/index.html` (add 1-2 SAMPLES with bubble)

**Spec:**
```js
export const spec = {
  type: 'bubble',
  category: 'charts/data',
  description: 'Bubble chart — N data points plotted on (x, y) axes with size dimension.',
  args: {
    points: {
      type: 'array of { x, y, size, label?, color? }',
      required: true,
      example: [
        { x: 0.2, y: 0.3, size: 0.4, label: 'Product A' },
        { x: 0.5, y: 0.7, size: 0.8, label: 'Product B' },
        { x: 0.8, y: 0.4, size: 0.2, label: 'Product C' },
      ],
    },
    xAxis: { type: 'string?', example: 'Cost' },
    yAxis: { type: 'string?', example: 'Revenue' },
    title: { type: 'string?', example: 'Product Portfolio' },
    sizeScale: { type: 'number?', default: 30, example: 30 },
  },
};
```

**Render:** L-axes (like scatter), but each point is a circle with radius proportional to `point.size * sizeScale`. Use pseudo-3D gradient on bubbles (radial gradient lighter top-left, drop shadow). Labels inside bubble if size ≥ threshold, else outside with leader line.

- [ ] Create the file based on scatter.js skeleton
- [ ] Register in registry.js (insert in `// Charts / data` block alphabetically)
- [ ] Add demo SAMPLE entry (look at scatter samples for pattern)
- [ ] `npm test` 84/84
- [ ] Commit

### Task 3.1: histogram atom

**Reference atom:** `sdf-js/src/present/atoms-2d/charts/data/bar.js` (histogram = bar + adjacent bins + optional curve)

**Spec:**
```js
export const spec = {
  type: 'histogram',
  category: 'charts/data',
  description: 'Frequency distribution — N bins, no gap between bars, optional bell-curve overlay.',
  args: {
    bins: {
      type: 'array of { range: [low, high], count: number }',
      required: true,
      example: [
        { range: [0, 10], count: 5 },
        { range: [10, 20], count: 12 },
        { range: [20, 30], count: 18 },
        { range: [30, 40], count: 14 },
        { range: [40, 50], count: 7 },
      ],
    },
    title: { type: 'string?', example: 'Survey Response Distribution' },
    bellCurve: { type: 'boolean?', default: false },
    milestones: { type: 'array of { value, label }?', example: [{ value: 25, label: 'Median' }] },
  },
};
```

**Render:** Bars touching (no gap, like real histogram). X-axis shows bin ranges. Y-axis shows count. If `bellCurve: true`, overlay smooth Gaussian curve fitted to bins. If `milestones`, vertical dashed lines + labels.

- [ ] Create file, register, demo sample, test, commit

### Task 4.1: break-even atom

**Reference atom:** `sdf-js/src/present/atoms-2d/charts/data/line.js`

**Spec:**
```js
export const spec = {
  type: 'break-even',
  category: 'charts/data',
  description: 'Break-even chart — fixed cost (horizontal), total cost + revenue (lines crossing).',
  args: {
    fixedCost: { type: 'number', required: true, example: 50000 },
    variableCostPerUnit: { type: 'number', required: true, example: 25 },
    pricePerUnit: { type: 'number', required: true, example: 50 },
    maxUnits: { type: 'number?', default: 5000 },
    title: { type: 'string?', example: 'Break-Even Analysis' },
    currency: { type: 'string?', default: '$' },
  },
};
```

**Render:** X-axis = units sold (0 to maxUnits). Three lines:
- Fixed cost: horizontal y=fixedCost
- Total cost: y = fixedCost + variableCostPerUnit * x (sloped)
- Revenue: y = pricePerUnit * x (sloped, steeper than total cost)
Crossover point: x = fixedCost / (pricePerUnit - variableCostPerUnit). Mark with circle + "Break-even at X units, $Y revenue" callout.

- [ ] Create file, register, demo sample, test, commit

### Task 5.1: stacked-area atom

**Reference atom:** `sdf-js/src/present/atoms-2d/charts/data/line.js` (with fill underneath)

**Spec:**
```js
export const spec = {
  type: 'stacked-area',
  category: 'charts/data',
  description: 'Stacked area chart — N series accumulated over X axis (showing composition over time).',
  args: {
    series: {
      type: 'array of { name: string, values: number[] }',
      required: true,
      example: [
        { name: 'Product A', values: [10, 12, 15, 20, 25] },
        { name: 'Product B', values: [5, 8, 10, 14, 18] },
        { name: 'Product C', values: [3, 4, 6, 8, 11] },
      ],
    },
    xLabels: { type: 'string[]', example: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'] },
    title: { type: 'string?', example: 'Revenue by Product Over Time' },
    format: { type: "'number'|'currency'|'percent'", default: 'number' },
  },
};
```

**Render:** For each x-tick, sum all series.values[i]. Render bottom series as filled polygon from y=0 to y=values[i]; next series stacked on top from y=cumulative; etc. Each series gets palette.colors[i]. Legend at top or bottom.

- [ ] Create file, register, demo sample, test, commit

### Task 6.1: seven-s-model atom

**Reference atom:** `sdf-js/src/present/atoms-2d/charts/diagrams/relationship-graph.js` (hub + satellites with connections)

**Spec:**
```js
export const spec = {
  type: 'seven-s-model',
  category: 'charts/diagrams',
  description: 'McKinsey 7S Framework — Shared Values center + 6 satellites (Strategy, Structure, Systems, Style, Staff, Skills).',
  args: {
    center: { type: 'string', default: 'Shared Values' },
    satellites: {
      type: 'array of 6 { label: string, description?: string }',
      required: true,
      example: [
        { label: 'Strategy' },
        { label: 'Structure' },
        { label: 'Systems' },
        { label: 'Style' },
        { label: 'Staff' },
        { label: 'Skills' },
      ],
    },
    title: { type: 'string?', example: '7S Framework' },
  },
};
```

**Render:** Center hexagon labeled with `center`. 6 satellite hexagons positioned at 60° intervals around center (radius ~0.35 of canvas). Lines from center to each satellite + lines BETWEEN adjacent satellites (forms 7-node interconnected network). Pseudo-3D: gradient on each hex, drop shadow, label centered.

- [ ] Create file, register, demo sample, test, commit

### Task 7.1: multiple-arrows atom

**Reference atom:** `sdf-js/src/present/atoms-2d/shapes/arrow.js` (single arrow shape)

**Spec:**
```js
export const spec = {
  type: 'multiple-arrows',
  category: 'charts/diagrams',
  description: 'Multi-arrow flow — N arrows in converge / diverge / parallel pattern with labels.',
  args: {
    mode: { type: "'converge'|'diverge'|'parallel'", required: true, example: 'converge' },
    arrows: {
      type: 'array of { label?: string, color?: [r,g,b] }',
      required: true,
      example: [{ label: 'Input A' }, { label: 'Input B' }, { label: 'Input C' }],
    },
    centerLabel: { type: 'string?', example: 'Output' },
    title: { type: 'string?', example: '3 → 1 Aggregation' },
  },
};
```

**Render:**
- `converge`: N arrows from left positions to single center-right point. Optional centerLabel rendered as box at convergence point.
- `diverge`: Mirror of converge — 1 arrow from left to N arrows fanning right.
- `parallel`: N arrows side-by-side pointing right, each with own label.

Pseudo-3D: gradient fill on arrow body, slight drop shadow, rounded arrowheads.

- [ ] Create file, register, demo sample, test, commit

### Task 8.1: nine-field-matrix atom

**Reference atom:** `sdf-js/src/present/atoms-2d/charts/matrix/matrix-grid.js` (but with priority bands)

**Spec:**
```js
export const spec = {
  type: 'nine-field-matrix',
  category: 'charts/matrix',
  description: 'GE/McKinsey 9-cell priority matrix — 3x3 grid with diagonal red/yellow/green priority bands.',
  args: {
    cells: {
      type: 'array of 9 { label: string, sublabel?: string } in row-major order',
      required: true,
      example: [
        { label: 'Invest' }, { label: 'Invest' }, { label: 'Selective' },
        { label: 'Invest' }, { label: 'Selective' }, { label: 'Harvest' },
        { label: 'Selective' }, { label: 'Harvest' }, { label: 'Divest' },
      ],
    },
    xAxis: { type: 'string?', example: 'Business Strength' },
    yAxis: { type: 'string?', example: 'Industry Attractiveness' },
    title: { type: 'string?', example: 'GE/McKinsey Matrix' },
    bubbles: { type: 'array of { row, col, label, size }?', example: [{ row: 0, col: 0, label: 'A', size: 0.6 }] },
  },
};
```

**Render:** 3x3 grid. Color cells by priority band:
- Top-left 3 cells (row 0+col≤1, row 1+col=0): GREEN (high priority — invest)
- Diagonal 3 cells (row 0+col=2, row 1+col=1, row 2+col=0): YELLOW (selective)
- Bottom-right 3 cells: RED (low priority — harvest/divest)
X/Y axis labels with arrows indicating "high → low". Optional bubbles overlay (same as matrix-grid extension).

- [ ] Create file, register, demo sample, test, commit

---

## Phase 9 — Lift prompt v3.32 → v3.33

### Task 9.1: Catalog 7 new atoms in MODE_2D_ADDENDUM

**Files:**
- Modify: `sdf-js/src/compositor-api.js` (extend MODE_2D_ADDENDUM Priority 0 atom list)
- Modify: `sdf-js/examples/compositor/system-prompt-lift-3d.md` (frontmatter version + changelog)

- [ ] **Step 1:** Find `Priority 0` section in MODE_2D_ADDENDUM (lists existing atoms with arg signatures, last updated v3.30/v3.31)

- [ ] **Step 2:** Append 7 new atom entries with terse arg signatures:
  - `bubble`: points[{x,y,size,label}], xAxis?, yAxis?, sizeScale?
  - `histogram`: bins[{range:[lo,hi],count}], bellCurve?, milestones?
  - `break-even`: fixedCost, variableCostPerUnit, pricePerUnit, maxUnits?
  - `stacked-area`: series[{name,values}], xLabels[], format?
  - `seven-s-model`: center?, satellites[6×{label}]
  - `multiple-arrows`: mode:converge|diverge|parallel, arrows[{label}], centerLabel?
  - `nine-field-matrix`: cells[9×{label,sublabel?}], xAxis?, yAxis?, bubbles?

- [ ] **Step 3:** Add v3.33 note at bottom of MODE_2D_ADDENDUM mirroring v3.32 style:
  ```
  v3.33 (Sprint 15a — chart atom catalog expansion) — adds 7 new chart
  atoms covering PL chart category gap: bubble / histogram / break-even
  / stacked-area / seven-s-model / multiple-arrows / nine-field-matrix.
  Plus 3 extensions: matrix-grid gains quadrantAxes + bubbles for BCG;
  scatter gains regressionLine; bar gains targetLine.
  ```

- [ ] **Step 4:** Bump `system-prompt-lift-3d.md` YAML `version: 3.32` → `3.33` + append v3.33 changelog to description

- [ ] **Step 5:** `npm test` → 84/84 PASS

- [ ] **Step 6:** Commit:
  ```
  sprint-15a: lift prompt v3.32 → v3.33 — catalog 7 new chart atoms + 3 extensions
  ```

---

## Phase 10 — Screenshots + PR

### Task 10.1: Generate per-atom screenshots to screens/sprint-15a/

**Files:** none modified (verification only)

This is a controller-driven step using the `browse` skill against the `atoms-2d-demo` page. The implementer is NOT a subagent — the controller runs the screenshot batch directly.

- [ ] **Step 1:** Start (or verify running) dev server: `npm run serve` (port 8001)
- [ ] **Step 2:** For each of 7 new atoms + 4 modified atoms (matrix-grid with BCG args, scatter with regression, bar with target line, pie donut-segmented), use browse skill to navigate `http://localhost:8001/examples/atoms-2d-demo/`, find the demo SAMPLE for that atom, screenshot just its canvas. Save to `screens/sprint-15a/<atom>.png`.
- [ ] **Step 3:** Aggregate screenshots into single contact-sheet `screens/sprint-15a/_index.png` for quick user review (4×3 grid or similar)

### Task 10.2: Push + open PR

- [ ] **Step 1:** Final `npm test` → 84/84 PASS
- [ ] **Step 2:** `git push -u origin sprint-15a-chart-atoms`
- [ ] **Step 3:** `gh pr create` with title "Sprint 15a: 7 new chart atoms + 4 atom extensions + lift prompt v3.33" — body lists atoms, links screenshots, notes test count, NOT for merge until user reviews

---

## Self-Review (run before declaring complete)

1. **Spec coverage:** Each of 7 new atoms + 4 extensions has a task — verified via task table
2. **Placeholder scan:** No TBD/TODO/"implement later" in any task — code is reference-shape only
3. **Type consistency:** Args spec strings use same convention as existing atoms (`'string?'`, `'array of {...}'`, `'number?'`)
4. **No new deps:** Confirmed — all new atoms use existing renderer.js helpers + Canvas2D only
5. **84/84 throughout:** Every commit ends with `npm test` step

## Execution Handoff

Subagent-driven. Each atom task = one subagent (sonnet). Phase 1 extensions = one subagent. Phase 9 prompt = one subagent. Phase 10 screenshots + PR = controller direct (browse skill).

Estimated: 9 subagent dispatches + 1 controller batch (screenshots). ~2-3 hours autonomous run.
