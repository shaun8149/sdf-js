# sdf-js polymorphism smoke test (7-cell matrix)

**Purpose**: lock in the 2026-05-14 polymorphic refactor (silhouette/stipple/hatch all accept SDF2 + SDF3). Run this checklist after any change to renderers, dispatcher, or SKILL.md. Eyeball-compare each cell to its baseline PNG.

**How to run**:
1. `cd sdf-js && python3 dev-server.py 8001`
2. Open `http://localhost:8001/examples/mvp/`
3. For each cell below: paste the prompt → select the renderer pill → click Generate → save the canvas PNG into `tests/smoke/baselines/<cell>.png` (right-click canvas → save image)
4. Compare new run against the saved baseline. Significant drift = regression.

**Matrix**: 3 renderers × {SDF2, SDF3} = 6 cells + Lambert × SDF3 = 7. Lambert × SDF2 is degenerate (Lambert is 3D-only) — skipped.

---

## SDF2 baseline (use a known-good 2D emoji)

**Prompt** (paste verbatim):
```
a yellow smiling face with smiling eyes, closed arcs as eyes, small smile
```

### Cell 1 · Silhouette × SDF2
- **Pill**: Silhouette
- **Expect**: flat-color yellow circle face with crisp 1-px AA edges, eye arcs + smile in dark color. NO stipple, NO lines. Background = default cream.
- **Failure modes**: black canvas (raymarch path accidentally triggered) / jagged edges (AA broken) / colors swapped.
- **Baseline file**: `baselines/01-sdf2-silhouette.png`

### Cell 2 · Stipple × SDF2
- **Pill**: Stipple
- **Expect**: yellow face filled with BOB-style brush stipple (multi-layer painterly), background also stippled with HSL spread (default `colorSpread=0` = mono; if user has been playing, may be multicolor).
- **Failure modes**: empty canvas / uniform density (Lambert path wrongly triggered on SDF2) / no background stipple.
- **Baseline file**: `baselines/02-sdf2-stipple.png`

### Cell 3 · Lines × SDF2
- **Pill**: Lines
- **Expect**: 2D contour-following streamlines filling the face shape. Lines follow gradient-perpendicular direction (curves around face edge). White/cream background.
- **Failure modes**: lines crossing each other randomly (wrong field) / blank canvas / lines wrapping like 3D (SDF3 path mis-triggered).
- **Baseline file**: `baselines/03-sdf2-lines.png`

---

## SDF3 baseline (use the wine-bottle scene already proven)

**Prompt** (paste verbatim):
```
a tall wine bottle with a long neck and a wide base, on a flat surface
```

### Cell 4 · Silhouette × SDF3
- **Pill**: Silhouette
- **Expect**: flat-color bottle + table silhouette, raymarched-projected (no shading inside the bottle, just solid color). Bottle shape recognizable from 3-quarter view (yaw=0.5, pitch=0.35 default).
- **Failure modes**: empty canvas (SDF3 raymarch returns no hits) / 2D-projected slice instead of 3D silhouette / aspect-ratio collapse.
- **Baseline file**: `baselines/04-sdf3-silhouette.png`

### Cell 5 · Stipple × SDF3
- **Pill**: Stipple
- **Expect**: bottle rendered with **density-modulated** stipple — dark side denser, light side sparser (rim light visible on one side). Table has different density gradient than bottle. Background fully stippled.
- **Failure modes**: uniform density across bottle (Lambert intensity ignored) / black silhouette (raymarch hits but intensity broken) / both layers showing same surface direction.
- **Baseline file**: `baselines/05-sdf3-stipple.png`
- **2026-05-14 baseline visual**: green/teal stipple, yellow rim on bottle, orange/red background HSL spread.

### Cell 6 · Lines × SDF3
- **Pill**: Lines
- **Expect**: **Pasma 3D rayhatching** — bottle has wrap-around horizontal streamlines following the revolve surface tangent; table has diagonal hatching at different angle (independent tangent field per SDF3 layer). White/cream background.
- **Failure modes**: lines staying horizontal across both layers (single global field) / lines following 2D outline only (SDF3 path not taken) / no lines (raymarch broken).
- **Baseline file**: `baselines/06-sdf3-lines.png`
- **2026-05-14 baseline visual**: textbook Pasma — bottle wrap lines + table diagonal hatch, line distance auto-densifying at bottle neck.

### Cell 7 · Lambert × SDF3
- **Pill**: Lambert
- **Expect**: orthographic raymarched 3D scene with diffuse Lambert shading. Bottle smooth-shaded (light side bright, dark side dim). Solid color fill — no stipple, no lines.
- **Failure modes**: flat color (no shading, ambient=1 bug) / nothing rendered (SDF3 path broken) / harsh black shadow (ambient=0 bug).
- **Baseline file**: `baselines/07-sdf3-lambert.png`

---

## Regression policy

- A cell is **passing** if a fresh run matches the baseline's *visual register* — exact pixel match is not required (LLM is stochastic, layer composition varies).
- A cell **fails** if it triggers any listed failure mode, or if the visual register fundamentally changes (e.g., Lines suddenly becomes Stipple, or 3D becomes 2D).
- If a cell genuinely should change (e.g., we upgrade the Pasma tangent algorithm), regenerate the baseline PNG and commit alongside the code change.

## Why these 7 cells

- **3 renderers × 2 SDF dims** = the actual polymorphism matrix to protect. Each cell tests a distinct (renderer, dim) code path.
- **Same prompt across renderers** isolates *renderer behavior* from *LLM output variance*. If only one renderer's cell breaks, we know which path regressed.
- **2 prompts** (smiley + bottle) is the minimum to cover both SDF2 and SDF3. Larger benchmark (30 editorial subjects) deferred until external contributors arrive.

## When to expand

Trigger to grow this matrix:
1. Adding a 5th renderer → add 2 cells (SDF2 + SDF3 if applicable)
2. Adding new SDF construction technique (e.g., CSG, fractal) → add 1 SDF prompt row
3. External contributor opens PR → require all 7 cells regenerated + visually inspected
