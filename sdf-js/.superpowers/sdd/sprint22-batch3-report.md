# Sprint 22 Batch 3 Report

## Status: SHIPPED ✓ — 103/103 tests pass

## Atoms

| Atom | File | LOC est |
|------|------|---------|
| `risk-heatmap` | `sdf-js/src/present/atoms-2d/charts/diagrams/risk-heatmap.js` | ~165 |
| `org-vs-org-matrix` | `sdf-js/src/present/atoms-2d/charts/diagrams/org-vs-org-matrix.js` | ~160 |
| `kanban-board` | `sdf-js/src/present/atoms-2d/charts/diagrams/kanban-board.js` | ~155 |
| `donut-with-center` | `sdf-js/src/present/atoms-2d/charts/data/donut-with-center.js` | ~170 |

## Twin Map Entries (lift-2d-to-3d.js)

| 2D atom | 3D target | Key args |
|---------|-----------|----------|
| `mountain-path` | `mountain-3d` (upgraded from `progression-3d`) | `pathMarkers`, `height`, `baseRadius`, `sidePeaks`, `spread`, `sideScale`, `markerRadius` |
| `risk-heatmap` | `matrix-grid-3d` | `rows:5, cols:5` |
| `org-vs-org-matrix` | `matrix-grid-3d` | `rows:2, cols:2` |
| `kanban-board` | `flow-chart-3d` | `steps: cols.length` |
| `donut-with-center` | `circle-segmented-3d` | `segments`, `radius:0.8`, `innerRatio:0.55` |

## Lift Demo Paths

- `sdf-js/scenes/lifted-risk-heatmap.json`
- `sdf-js/scenes/lifted-org-vs-org.json`
- `sdf-js/scenes/lifted-kanban.json`
- `sdf-js/scenes/lifted-donut-center.json`
- `sdf-js/scenes/lifted-mountain-path.json`

## Test Counts

- `test-sprint22-batch3-atoms.mjs`: 43/43 pass (registration + spec + render + catalog)
- `test-lift-2d-to-3d.mjs`: 81/81 pass (includes B3 + B1 mountain-path upgrade)
- Total suite: 103/103 pass

## Rule 17 Extension

Added 4 new PL guidance lines in:
- `sdf-js/scripts/bake-scaffold-pipeline.mjs` (line ~489)
- `sdf-js/src/present/scaffold-view.js` (line ~437)

## Visual Demo Deck

`sdf-js/examples/scaffold-pipeline/sprint22-b3-atomdemo/` — 4 slots, HR Slate Teal theme

## Concerns / Notes

- `mountain-path` twin upgraded to `mountain-3d` (precise atom) from `progression-3d` (generic fallback). B1 test updated accordingly.
- `org-vs-org-matrix` and `risk-heatmap` both map to `matrix-grid-3d` — distinct by quadrant vs grid args.
- Title overlay deduplication: B3 lift functions do NOT add `titleOverlay` (let outer `liftSceneData2dTo3d` handle via `s.args.title`). Consistent with pure-overlay twin pattern (not with B2's `decision-tree-3-arm` which adds its own).
