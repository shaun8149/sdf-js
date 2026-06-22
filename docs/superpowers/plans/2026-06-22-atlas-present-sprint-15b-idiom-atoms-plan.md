# Atlas Present Sprint 15b — Infographic Idiom Atoms (10 new atoms)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Ship 10 new infographic-style atoms covering the visual idioms unique to "infographic decks" (vs basic chart slides). Closes the gap where atoms-2d v1 had zero isotype / device-mockup / circle-hub / loop atoms — the very visuals that distinguish "polished infographic" from "ugly bar chart" per [[atlas-pl-observation-pool-v3]] Batch 3 Finding B.

**Architecture:** Each atom = one ES module under `sdf-js/src/present/atoms-2d/charts/...` following the established atom pattern (exported `spec` + `drawPseudo3D` Canvas2D function). Registered in `registry.js`. Pseudo-3D rendering using the polish framework codified in `polish-wave` (Inter typography 700/600/400 with 900 for hero values; gradient lighten 0.08-0.10; drop shadow 10-12px blur alpha 0.10-0.15; warm off-white #fafaf8 bg; padding 20-24px).

**Tech Stack:** ESM Node 25, vanilla browser JS, Canvas2D pseudo-3D rendering. NO new npm deps. Existing atoms as architectural reference. NO external asset libraries (atoms self-contained via Canvas2D primitives).

**Branch:** `sprint-15b-idiom-atoms` (off main `ad7ea0c` post-polish merge).

**Spec:** [`docs/superpowers/specs/2026-06-22-atlas-present-sprint-15-design.md`](../specs/2026-06-22-atlas-present-sprint-15-design.md) §6 15b.

## Global Constraints

- `npm test` 87/87 PASS throughout
- All atoms pseudo-3D style only, consistent with polish-wave aesthetic
- Each atom registered in `sdf-js/src/present/atoms-2d/registry.js`
- Polish framework: Inter 700/600/400/900; gradient lighten 0.08-0.10; shadow 10-12px blur alpha 0.10-0.15; padding 20-24px; bg #fafaf8 fallback
- Branch `sprint-15b-idiom-atoms` (no new branch)
- Each atom adds 1-2 SAMPLES to `sdf-js/examples/atoms-2d-demo/index.html` for visual demo
- Lift prompt v3.33 → v3.34 catalogs new atoms (single task at end)
- DO NOT push or open PR until all tasks complete + final review
- Screenshots to `screens/sprint-15b/<atom>.png` (gitignored)

## Atoms (10)

Scope deliberately narrowed from spec's 12-15 to 10 — dropping atoms that require external asset libraries (world-map needs continent path data; city-skyline needs urban silhouettes; isometric-vignette needs people/object illustrations). These deferred to Sprint 15d photo backend or Sprint 16.

| # | Atom | Category | Pattern reference | Sample use |
|---|---|---|---|---|
| 1 | `circle-image-hub-spoke` | charts/diagrams | hub-spoke with photo placeholders | "Customer success: 5 case studies orbit Atlas" |
| 2 | `device-mockup-frame` | shapes | single device outline | "How it looks on iPhone" |
| 3 | `device-mockup-row` | shapes | N devices side-by-side | "Atlas works on every device" |
| 4 | `isotype-people-grid` | charts/data | N×M tiny people silhouettes | "100 of our customers, 73 happy" |
| 5 | `isotype-prop-row` | charts/data | N copies of shape varying fill | "5 bottles, 60% recycled" |
| 6 | `isotype-stat-comparison` | charts/data | N rows of icon + label + count | "100 doctors, 25 nurses, 12 admins" |
| 7 | `magazine-column-grid` | charts/layers | N-col mosaic with category bands | "4 industries × 3 KPIs each" |
| 8 | `infinity-loop-flow` | charts/diagrams | figure-8 process loop | "Plan → Build → Measure → Learn → repeat" |
| 9 | `kpi-water-drop` | charts/data | water drop shape with fill % | "72% of water recycled" |
| 10 | `dashboard-multi-kpi-composite` | charts/data | 2×2 tile of KPI cards | "Q3 dashboard at a glance" |

## File structure

### NEW (10 atom files)

```
sdf-js/src/present/atoms-2d/
├── charts/
│   ├── data/
│   │   ├── isotype-people-grid.js          (~150 LoC)
│   │   ├── isotype-prop-row.js             (~140 LoC)
│   │   ├── isotype-stat-comparison.js      (~160 LoC)
│   │   ├── kpi-water-drop.js               (~140 LoC)
│   │   └── dashboard-multi-kpi.js          (~180 LoC composite of kpi-card)
│   ├── diagrams/
│   │   ├── circle-image-hub-spoke.js       (~180 LoC)
│   │   └── infinity-loop-flow.js           (~170 LoC)
│   └── layers/
│       └── magazine-column-grid.js          (~170 LoC)
└── shapes/
    ├── device-mockup-frame.js               (~160 LoC)
    └── device-mockup-row.js                 (~140 LoC)
```

### MODIFY

- `sdf-js/src/present/atoms-2d/registry.js` — register 10 new types
- `sdf-js/examples/atoms-2d-demo/index.html` — add 1-2 SAMPLES per new atom (~15-20 new entries)
- `sdf-js/src/compositor-api.js` — extend MODE_2D_ADDENDUM Priority 0 atom list with 10 new types + arg signatures; bump v3.33 → v3.34
- `sdf-js/examples/compositor/system-prompt-lift-3d.md` — YAML version + changelog

## Phasing — 4 task batches + lift prompt + screenshots + PR

| Batch | Tasks | Atoms | Subagent model |
|---|---|---|---|
| **B1** | composite/grid | circle-image-hub-spoke + magazine-column-grid + dashboard-multi-kpi-composite | sonnet |
| **B2** | device family | device-mockup-frame + device-mockup-row | sonnet |
| **B3** | isotype family | isotype-people-grid + isotype-prop-row + isotype-stat-comparison | sonnet |
| **B4** | special/flow | infinity-loop-flow + kpi-water-drop | sonnet |
| **B5** | lift prompt v3.34 | catalog 10 new atoms | sonnet |
| **B6** | screenshots + PR | render fixture + 10 atom PNG + contact sheet | controller |

## Atom specs (terse — full spec in each atom file at implement time)

### 1. circle-image-hub-spoke
- args: `center: { label, image? }`, `satellites: [{ label, image? }]` (3-8 satellites)
- render: center circle (large, palette.colors[0]) + N satellite circles at radial positions + connection lines from center to each
- `image` arg: optional URL-like placeholder; if absent, render filled gradient circle

### 2. device-mockup-frame
- args: `device: 'phone'|'tablet'|'laptop'|'watch'`, `title?`, `content?: string` (optional caption inside)
- render: rounded rect outline matching device aspect (phone 9:19, tablet 4:3, laptop 16:9, watch 1:1); device chrome (notch / camera dot / home indicator); content area = palette.colors[0] tint

### 3. device-mockup-row
- args: `devices: [{ kind: 'phone'|'tablet'|'laptop'|'watch', label? }]` (2-5 devices)
- render: N device-mockup-frame instances horizontally arranged, labels under each

### 4. isotype-people-grid
- args: `total: number`, `highlighted: number` (subset filled with accent), `personIcon?: 'simple'|'business'|'casual'` (default simple)
- render: tiny stick-figure silhouettes in N×M grid filling available area; first `highlighted` people in palette.colors[0]; rest in palette.fg alpha 0.25
- Auto-compute grid dimensions to fit `total` people in canvas

### 5. isotype-prop-row
- args: `count: number` (2-10), `fillRatios: number[]` (each in 0..1, same length), `propShape?: 'bottle'|'bulb'|'drop'|'circle'` (default circle), `label?`
- render: N props in a row, each filled to its `fillRatios[i]` value with palette accent + the rest in muted gray; values shown below each prop

### 6. isotype-stat-comparison
- args: `stats: [{ icon: string (Phosphor name), count: number, label: string }]` (2-5 rows)
- render: 1 row per stat — large count number (Inter 900) on left + N tiny icon instances scaled with count + label + caption below
- For count > 30: collapse to "30+ icons" with count number; for count ≤ 30: render literal N icons

### 7. magazine-column-grid
- args: `categories: [{ name: string, items: [{ label, value? }] }]` (2-5 categories)
- render: N vertical columns separated by hairline dividers; each column has a header band (palette.colors[i]) with category name + list of items below
- Padding generous, Inter typography hierarchy

### 8. infinity-loop-flow
- args: `steps: [{ label, description? }]` (4-8 steps recommended)
- render: figure-8 path with N steps positioned along the loop; arrows between consecutive steps; central crossover point shows directional flow

### 9. kpi-water-drop
- args: `value: number` (0-1 fill level OR explicit number with `format`), `label: string`, `sublabel?`, `format?: 'percent'|'currency'|'number'`
- render: classic water-drop shape (teardrop) with fill level showing internal "water" rising to value height; large value text in Inter 900 centered

### 10. dashboard-multi-kpi-composite
- args: `kpis: [{ value, label, sublabel?, trend?, trendValue? }]` (typically 4 in 2x2, or 2 / 3 / 6)
- render: subdivide canvas into N tiles + render small kpi-card style content in each (or directly call existing kpi-card if API allows nesting)
- Auto-layout: 4 kpis → 2x2; 2 → 1x2; 6 → 2x3

## Tasks (10 atoms + 1 prompt + 1 PR)

Each atom task follows the same template (~200-300 LoC, register, demo, test, commit). Batched per the phasing table.

## Screenshots (Task B6)

Reuse the pattern from Sprint 15a:
1. Create `sdf-js/examples/atoms-2d-demo/sprint-15b-render.html` with 10 SAMPLES
2. Browse skill loads page; Node script extracts each canvas as PNG to `screens/sprint-15b/<atom>.png`
3. Build before/after contact sheet... actually, no "before" — these are new atoms. Just build single contact sheet `screens/sprint-15b/_index.png`
4. Visual self-check each atom rendering

## Self-Review

Same checklist as Sprint 15a self-review (spec coverage / placeholder scan / type consistency).

## PR strategy

- Open PR after all 6 batches complete
- Final whole-branch review (Opus) before user merge
- Squash-merge per CLAUDE.md
