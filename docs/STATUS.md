# Atlas — Project Status Snapshot

> Frequently-updated current state of decisions, ship status, and pending work. Vision and architecture live in [../README.md](../README.md); this file tracks **what's locked vs what's still moving**.
>
> Last update: 2026-06-22

---

## Spec ship status

Single source of truth: [../sdf-js/src/scene/SPEC.md](../sdf-js/src/scene/SPEC.md)

| Item | Status |
|---|---|
| SCENE-SPEC.md base (subjects / camera / light / ground / Subject 3 types / region) | ✅ shipped `0109ab0` |
| Extension 1: DomainGroup (rep / mirror / twist / bend as third Subject variant) | ✅ shipped `b1d4d87` |
| Extension 2: AnimationChannel dual-form (`expr` string / `value` structured TimeExpr) | ✅ shipped `b1d4d87` |
| Extension 3: Camera + light animation hooks | ✅ shipped `b1d4d87` |
| Extension 4: `waves` time-aware primitive in registry | ✅ shipped `b1d4d87` |
| Extension 5: `defaults.shadow` (autoscope 4-mode surreal color-shifted shadows) | ✅ shipped `6ce874b` |
| Extension 6: `SceneData.source` (script text / LLM prompt / generator hash preservation) | ✅ shipped `6ce874b` |

---

## Roadmap status

Full document: [memory/project_compositor_roadmap.md](../.claude/projects/-Users-hexiaoyang-Documents-sdf-main/memory/project_compositor_roadmap.md) (internal)

| Item | Status |
|---|---|
| 7 milestones (M0 / M1 / M2 / M3 / M3.5 / M4 / M5 / M6) | ✅ locked |
| Total timeline 11–13 weeks | ✅ locked |
| M3 split: script-only (2 weeks) + M3.5 graph + dual-sync (2–3 weeks) | ✅ locked |
| Critical path: M0 → M1 → M2 → M3 → M4 → M5 → M6 | ✅ locked |

### Milestone progress

| M | Goal | Time | Status |
|---|---|---|---|
| **M0** | SceneData spec + `compile.js / serialize.js / spec.js` + autoscope refactor | 3–5 days | ✅ shipped `0109ab0` → `4478025` (see commits below) |
| **M1** | Compositor v0 (4-tab UI: text + generator + 2d-edit stub + 3d-edit stub) | 5–7 days | ✅ Day 1-3 shipped (`020cd88` → `01ecc79`); text-tab + generator-tab functional, edit-tabs deferred per Saturday's revised plan |
| **M2** | LLM 2D→3D lift (`✨ Lift to 3D` button + SceneData output + BOB GPU + Fly camera) | 1–2 weeks | ✅ **shipped 2026-05-18** — China carrier prompt validates pipeline end-to-end. 9/10 thesis points evidence-backed. See `project_v1_thesis_validation_2d_to_3d_lift.md` |
| **M3** | Generator framework + LLM-lifted scenes promoted to Generator instances (PRNG variants on lifted 3D scenes) | 1–2 weeks | ⏳ pending — validates thesis point #10 (zero-marginal-cost variants) |
| **M4** | V1 polish — demo gallery, hero replacement, atlas.studio domain, brand surface | 1 week | ⏳ pending |
| _deferred_ | Full 2D editor (Mini-DSL parser + Monaco + node graph dual-view) | 4–5 weeks | deferred per Saturday's revised plan — text-tab serves as 2D editor for v1; visual editor revisited if non-coder feedback demands |
| _deferred_ | Full 3D viewport editor (three.js + transform gizmo + 3D primitive panel) | 3–4 weeks | deferred — Fly explorer + BOB GPU covers v1 "exploration" need; manual 3D composition revisited if user demands |

---

## Since M2 — Present layer + spatial narrative + data labels (2026-05 → 2026-06)

Major capability ships after the M2 lift validation. Tracked here by capability
(commit-level detail is in git log + memory).

| Area | Status |
|---|---|
| **M3 Generator-S** (scatter / array / mirror variant expansion on lifted scenes) | 🟡 Phase 1–2 shipped — thesis #10 evidence in hand |
| **Atlas Present layer** (`deck-model` / `visual-panel` / `atoms-2d` Canvas2D charts) | ✅ shipped — document-anchored decks, 6-variant picker, branding palettes |
| **Compositor** | ✅ 10+ renderers (silhouette / hatch / bobStipple + FLY 3D / BOB GPU / studio / blueprint / crayon / topo) · **188 baked demo-lifts** |
| **Spatial-narrative deck player** (Step 2: light chapters in one world + heavy slides own-scene; camera tour; captions; arc/grid layouts; auto-authoring) | ✅ shipped (PRs #68–#82) |
| **Data labels** (loop-chart GLSL fix #87 · `expandChartLabels` connector #89/#93 · overlay path #86 · 6 chart atoms) — `args.labels` → SDF labels, e2e-verified with real LLM | ✅ shipped; convergence demo `deck-business` |
| **Studio render-on-demand** (idle-stop: static scenes park the rAF loop; 0 GPU draws when idle) | ✅ shipped (#96) |

---

## Engineering hygiene sprint (2026-06-22)

| Item | Status |
|---|---|
| **RendererRegistry** — single id/alias/factory source; fixes Present effect-cycle throw (lines/crayon/topo) | ✅ shipped (#97) |
| **Primitive registry sync test** — spec `PRIMITIVE_TYPES` ↔ compile `PRIMITIVE_FACTORIES` drift guard in CI | ✅ shipped |
| **STATUS.md / docs refresh** | ✅ this update |
| compile.js split (`primitives/factories.js` + `registry.js`) | ⏳ planned |
| compositor.js extract to `src/compositor/` | ⏳ planned |

---

## 2D editor paradigm

Full document: [memory/project_2d_editor_decisions.md](../.claude/projects/-Users-hexiaoyang-Documents-sdf-main/memory/project_2d_editor_decisions.md) (internal)

| Item | Status |
|---|---|
| Route C: Mini-DSL parser (Python sdf-compatible syntax with `\|=` / `&=` / `-=`) | ✅ locked |
| Script + Graph dual-view bidirectional sync (both primary edit surfaces) | ✅ locked |
| `src/editor/` architecture (dsl / graph / sync three sub-layers) | ✅ doc complete |

---

## Brand

Full document: [memory/project_name_atlas.md](../.claude/projects/-Users-hexiaoyang-Documents-sdf-main/memory/project_name_atlas.md) (internal)

| Item | Status |
|---|---|
| **Atlas** (product) + **sdf-js** (library) dual-name | ✅ locked |
| README hero image + Atlas tagline + 4-page roadmap section | ✅ shipped `08b3970` / `f3e998f` |
| Compositor M1: page `<title>Atlas</title>` / favicon / nav | ⏳ pending M1 |
| Domain availability check (atlas.studio / atlas.art / GitHub org) | ⏳ user action |

---

## Recent commits (this milestone)

| Commit | Scope |
|---|---|
| `0109ab0` | Compositor roadmap + autoscope-clone + MVP BOB GPU + SceneData v1 spec (base) |
| `e092db2` | README: renderer/pattern tables updated (4→6 renderers, 5→4 active patterns) |
| `f3e998f` | README: architecture section refresh (10 src layers, 5 core philosophy axes) |
| `08b3970` | Brand: Atlas + sdf-js dual-name; README hero rewritten |
| `dfe619f` | sdf-js/README full rewrite (10-layer structure, current capabilities, demo index) |
| `b1d4d87` | SCENE-SPEC v1: 4 animation extensions (DomainGroup / dual-form / camera+light / waves) |
| `6ce874b` | SCENE-SPEC v1: defaults.shadow + SceneData.source fields |
| `adee7d8` | docs/STATUS.md project tracker + README link |
| `6d3c072` | scene: M0 Day 2-3 — spec/expr/compile/serialize/index + smoke test (38/0) |
| `c8183f8` → `d394557` | M0 Day 4: scenedata-demo + 3 sample JSONs (tiny / birds-house / coastal-village) iterated through bird fixes, camera animation, 3D flock traffic |
| `9b5dab1` | README: 10 architectural advantages vs diffusion |
| `fdd861c` → `16fb10a` | M0 Day 5: autoscope-primitives + autoscope-scenes rewritten as SceneData emitters with A/B toggle in autoscope-clone |
| `60c8eca` → `4478025` | Post-Day-5 visual debug round: camera animation hookup, ground union, plane normal direction fix, shadow raymarch reach (`dcbb02f`), shadow mode bias (`928f37b`), sky cross-palette pairing (`4478025`) |
| `1aa0bf2` | License switch from MIT to PolyForm Noncommercial 1.0.0 + NOTICE.md + COMMERCIAL.md |
| `020cd88` → `01ecc79` | M1 Day 1-3: Compositor shell + text-tab functional (prompt → LLM → 2D code → silhouette) + generator-tab absorbs autoscope (canvas swap, hash, BOB GPU) + M2 lift system prompt drafted (`system-prompt-lift-3d.md`) |
| `e13e83b` → `bbf95a9` | M2: ✨ Lift to 3D button + LLM call + SceneData parse + BOB GPU + Fly camera. Lenient spec patches for LLM partial outputs (SOURCE_FORMATS `llm-lift` + unknown format → warning; AnimationChannel missing expr/value → warning + skip). **End-to-end validated on China carrier prompt 2026-05-18.** |

---

## What unblocks next

**M0 + M1 + M2 ✅ closed** as of `bbf95a9`. V1 thesis path validated end-to-end on 2026-05-18 with the China aircraft carrier prompt.

**M2 critical milestone (2026-05-18)**: LLM read 2D SDF code + original prompt, output SceneData v1 JSON describing a 3D scene (subjects + camera + light + shadow), compile()-rendered via BOB GPU 2-pass shader with Fly camera exploration. **The thesis path locked Saturday is now technically real, not hypothetical** — 9/10 thesis points are evidence-backed (only #10 zero-marginal-cost-variant pending M3 Generator framework validation). See `project_v1_thesis_validation_2d_to_3d_lift.md` for full record.

**M0 + M1 details**: SceneData spec validation gate met (smoke test 38/0 + scenedata-demo + autoscope A/B toggle). Compositor v0 ships 4-tab UI; text-tab (LLM prompt → 2D SDF) and generator-tab (autoscope hash → 3D scene) functional. Post-implementation visual debug round closed sharp edges: ground SDF union, plane normal convention, shadow raymarch reach, shadow mode bias, cross-palette sky, animation channel lenient validation.

### M0 lessons (15 lessons / 5 themes)

Full doc: [memory/project_m0_lessons.md](../.claude/projects/-Users-hexiaoyang-Documents-sdf-main/memory/project_m0_lessons.md). Summary:

- **A. Library conventions are not intuitive** — sdf-js plane normal points OUTSIDE, softShadow reach = iterations × max step, multiple ground implementations create hidden incompatibility
- **B. Animation semantics** — rep + linear translate needs OUTER transform shift (not source translate), AnimationChannel uses REPLACE semantics, "u_time refs in GLSL" ≠ "user sees animation"
- **C. UX defaults** — checkbox default state determines first-impression demo; sub-palette monochromaticity defeats picking diversity
- **D. Visual debugging workflow** — user screenshots are fastest diagnostic, parameters can't be specified upfront, require iterative tuning
- **E. Architecture** — A/B mode toggles surface parity bugs immediately, spec and impl must co-evolve within 1-2 day window

**M1 starting now**: Compositor v0 — 4-input-tab UI (text / generator / 2d-edit / 3d-edit) sharing renderer pool. text-tab absorbs current MVP LLM-prompt flow; generator-tab absorbs autoscope-clone hash flow. 2d-edit and 3d-edit start as stubs until M3 / M4. SceneData is the single lingua franca between tabs.

---

## How this file is maintained

Update this file when:
- A milestone changes status (pending → 🟡 in-progress → ✅ shipped)
- A new spec extension is locked and shipped
- A new locked decision is recorded in memory
- A commit closes a significant scope (add the entry to "Recent commits")

Do not update for in-flight implementation details; that's git log territory. This is a **decision + milestone tracker**, not a changelog.
