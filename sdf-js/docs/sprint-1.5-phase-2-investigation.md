# Phase 2 Investigation — `rng.random_dec is not a function`

## Pre-flight confirmed
- `rng` IS a real class: `sdf-js/src/util/random.js:23` — `class Random` with `random_dec()` at L58
- `rng = new Random(hash)` injected at `sdf-js/src/scene/compile.js:774` (correct path)

## Injection points found
- `sdf-js/src/scene/compile.js:771-775` — canonical. `let rng = options.rng; if (!rng) rng = new Random(hash);` Always a `Random` instance — CORRECT.
- `sdf-js/src/compositor-api.js:69` — `const rng = mulberry32(sceneHash);` then `expandVariants(sceneData, rng)` on L70. **mulberry32 returns a plain `function()` — NOT a Random instance.** ROOT CAUSE.
- `sdf-js/src/render/streamlineRenderer.js:1156` — `new Random(seedHash)` — correct.
- `sdf-js/src/render/crayonRenderer.js:1381` — `runRng = new Random(seedHash)` — correct.
- `sdf-js/src/render/bobStipple.js:682` — `makeRng(seed)` — internal renderer use, doesn't reach `expandVariants`. Not relevant.
- `sdf-js/src/render/truchet.js:98` — same; renderer-internal.
- `sdf-js/src/scene/components/shapes/cube-3d.js:166` — internal `mulberry32(seed)`, never threaded out.

## All `rng.random_dec()` call sites
- `sdf-js/src/scene/generator-s.js` — L135, L146, L225, L227, L233, L234, L235, L294, L301, L304, L374, L482, L484. Reached via `expandVariants(scene, rng)` (L61) → `opScatter/opArray/opMirror`.
- `sdf-js/src/render/bobShader-style.js:140,267` — renderer-internal rng (own `new Random`).
- `sdf-js/src/render/streamlineRenderer.js` — renderer-internal rng.
- `sdf-js/src/render/crayonRenderer.js` — renderer-internal `runRng`.

The `generator-s.js` site is the only one reached via the buggy `compositor-api.compileScene` path.

## Partial-rng / Math.random hunt
- `sdf-js/src/palette/autoscope.js:257` — `const rng = opts.rng || { random: () => Math.random() };` — palette-internal fallback with `.random()`, not `.random_dec()`. Different code path; not relevant to this bug.
- `sdf-js/scripts/world/test-determinism.mjs:100` — `rng: { seed, n: 0 }` — test fixture for a different module.
- Other `Math.random` references are in `sdf-js/src/palette/*` and `sdf-js/src/streamline/*` (renderer / palette internal). None thread into compile.

## Fallback-rng patterns
- `sdf-js/src/scene/compile.js:772` — `if (!rng)` → constructs proper `new Random(hash)`. CORRECT.
- No other `rng = rng || {...}` patterns in scene code.

## Root cause analysis

`sdf-js/src/compositor-api.js:67-81` `compileScene()` was added in Phase 1 of the Atlas Present sprint as the Layer 1 public API for Layer 2 apps (Atlas Present uses it via `src/present/info-graphic-render.js:163`).

It calls `expandVariants(sceneData, rng)` on L70 — passing a `mulberry32()`-style PRNG (a plain `function()` returning `[0,1)`). But `expandVariants` and its descendants in `generator-s.js` expect a `Random` class instance with `.random_dec()`, `.random_num()`, `.random_int()`, etc.

The bug is hidden by `expandVariants`'s quick-path optimization (L65-66): when no subject has `variants`, the rng is never touched. Most lift LLM outputs have no `variants`, so `compileScene` appears to work — until a scene includes a scatter/array/mirror op (which the lift system prompt does encourage for certain primitives). Then `rng.random_dec is not a function` fires.

The Aether AI page 4 deck happened to emit a `variants: [{op: 'scatter', ...}]` subject.

`compile.js`'s internal `rng` injection (L771-775) is correct and uses `new Random(hash)`. The direct-`compile()` paths in `compositor.js` (L725, L1612, L2312) work fine; only the newer `compileScene` Layer 1 API has the wrong PRNG shape.

Also, existing test `test-compositor-api.mjs:74-98` covers `sceneNoVariants` only — never exercises the variants path, so CI didn't catch this.

## Decision

Strategy chosen: **A (root cause fix in `compositor-api.js`)**

- Replace the inline `mulberry32` PRNG with a `new Random(...)` instance, matching what `expandVariants` and the rest of the scene pipeline expect.
- Map the integer `sceneHash` (default `1`) to the 64-hex format `Random` accepts.
- Add a regression test in `scripts/test-compositor-api.mjs` that compiles a scene WITH a `variants: [{op: 'scatter'}]` subject — this would have failed pre-fix.
- Drop the now-dead `mulberry32` helper from `compositor-api.js` (it has no other caller).

Justification: this is the genuine root cause (one wrong line). A sanity rule (Strategy B) would still leave Atlas Present broken on legitimate scatter scenes; a prompt update (C) would just discourage scatter rather than fix it. Strategy A also brings `compileScene` into agreement with `compile.js`'s canonical injection.
