# Chart data labels: move back to `args.labels` (3D-side → 2D-side handoff)

**Status:** 3D-side runtime ready (PR #89 `expandChartLabels` + #85/#86/#87/#90).
**Ask:** update `MODE_3D_ADDENDUM` to PREFER the `args.labels` convention for the
supported chart atoms, as the addendum itself anticipated.

The addendum currently says (Phase C v2, "Data label patterns"):

> *"Phase C v1 spec'd `label: string[]` as an atom arg. That was aspirational — no
> runtime expansion exists. … A future PR may add pipeline auto-expansion from
> `label: string[]` to positioned text-3d-pipe subjects, at which point this
> section will move back."*

**PR #89 is that future PR.** `expandChartLabels()` now runs at scene load
(compositor `loadDemoScene` + `renderLiftedSceneData`) and deterministically
turns `args.labels` into positioned `text-3d-pipe` subjects. So the section can
move back.

## Why `args.labels` beats LLM-emitted separate subjects

1. **Move geometry math off the LLM.** The current prompt makes the model
   *compute* each label's `translate:[x,y,z]` from the anchor formulas
   (`xStart = -(N*barW+(N-1)*gap)/2 + barW/2`, `values[i]*maxHeight + margin`,
   `-barDepth/2 - 0.1`, pie mid-angles, …). That is probabilistic arithmetic per
   label — one slip and a label floats off its bar. The connector runs the *same
   formulas in code*, deterministically. Geometry belongs in the runtime, not in
   token-by-token model output.
2. **Single source of truth for anchors.** Those formulas live in BOTH the prompt
   (for the LLM) and `src/scene/chart-labels.js` (for the demos/connector). Two
   copies drift. With `args.labels`, only `chart-labels.js` has them; the prompt
   just says "provide `labels` parallel to `values`."
3. **Fewer tokens, fewer failure modes.** `labels:["$1.2M","$2.0M",…]` is one
   array vs N full `text-3d-pipe` subjects (~5 lines + computed translate each).
   Less output, no per-label math, no mis-anchored labels.
4. **It is the planned state.** The addendum explicitly reserved this path; this
   is "moving the section back," not a new direction.
5. **The hand-formulas already have a bug the connector doesn't.** The addendum's
   anchor table uses inconsistent z-signs: `bar-3d`/`line-3d` are `-z` (correct —
   the studio camera faces −z), but `pie-3d` (`thickness/2 + 0.05`),
   `sphere-fill-3d` (`radius + 0.05`) and `matrix-grid-3d` (`cardCentreZ + 0.02`)
   are `+z` — i.e. the **far side**, where the label hides behind the geometry.
   The LLM would faithfully reproduce that. The connector uses `-z` everywhere
   (verified by rendering, #90). Exactly why anchor math should not live in
   prose the model copies.

## What changes in `MODE_3D_ADDENDUM` (concrete)

- **Re-introduce `labels` as the PREFERRED path** for the connector-backed chart
  atoms: `bar-3d`, `column-3d`, `line-3d`, `pie-3d`, `sphere-fill-3d`,
  `matrix-grid-3d`. Convention: the chart subject carries `args.labels: string[]`
  (or, for `sphere-fill-3d`, parallel to `levels`; for `matrix-grid-3d`, a
  row-major array of length `rows*cols`). The runtime positions the labels — the
  LLM does **not** compute `translate`.
- **LLM still pre-formats label strings** (`"$3.4M"`, `"35%"`) — unchanged.
- **Keep Path A (separate `text-3d-pipe` subjects) and Path B (`annotations[]`)**
  documented as fallbacks for: tree-shaped atoms (no anchor support yet — see
  "open question for Phase D"), **>10 labels** (Path B is cheaper), or
  non-standard placement.
- **The anchor formula tables stay** — but reframed as *documentation of where the
  runtime puts labels*, not as math the LLM must perform.
- **Update the worked example**: the bar example becomes ONE `bar-3d` with
  `args.labels`, not 6 separate subjects.

Suggested decision line in the prompt:
> *Data labels: put a `labels` array on the chart atom (parallel to `values`).
> The runtime anchors them. Only hand-emit `text-3d-pipe` subjects / `annotations`
> for tree atoms, >10 labels, or custom placement.*

## Connector contract (what the 2D side can rely on)

- `expandChartLabels(sceneData)` — deterministic SceneData→SceneData, runs at
  scene load, **no-op when no chart carries `labels`** (so the separate-subjects
  path keeps working; both coexist).
- **Anchors mirror each atom's own layout** (same formulas the prompt documents),
  so labels land exactly on the rendered elements.
- **Coverage NOW (all six the addendum documents):** `bar-3d` / `column-3d` /
  `line-3d` / `pie-3d` (#90), plus `sphere-fill-3d` (labels parallel to `levels`)
  and `matrix-grid-3d` (row-major `rows*cols` array, row 0 on top) — connector
  extension landed + browser-verified (SWOT S/W/O/T in the right corners). The
  2D side can switch all six to `args.labels`.
- **Not covered:** tree-shaped atoms (`tree-diagram-3d` / `org-chart-3d` /
  `mindmap-3d`) — internal node order undocumented (addendum's "open question for
  Phase D"). Keep on hand-emitted subjects until anchors exist.

## Evidence
- `expandChartLabels` + `chart-labels.js` (#89), unit test `test-chart-labels.mjs`.
- Demos: `chart-autolabel-bar` / `-pie` / `-line` / `-column` — one chart atom +
  `args.labels`, labels auto-injected, 0 GPU errors (#90).
- `bar-3d` + SDF labels renders after the ES-1.00 shader fix (#87).
