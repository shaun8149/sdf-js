# Atlas — Project Status Snapshot

> Frequently-updated current state of decisions, ship status, and pending work. Vision and architecture live in [../README.md](../README.md); this file tracks **what's locked vs what's still moving**.
>
> Last update: 2026-05-17 (pre-M0-Day-2)

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
| **M0** | Scene data spec + `compile.js / serialize.js / spec.js` + autoscope-scenes refactor | 3–5 days | 🟡 Day 1 (SPEC.md ✅) — Day 2-3 (`spec.js + expr.js + compile.js + serialize.js + smoke 38/0` ✅ `6d3c072`) — Day 4-5 pending |
| **M1** | Compositor v0 (4-tab UI + renderer pool, `text` + `generator` tabs) | 5–7 days | ⏳ pending M0 |
| **M2** | Generator framework (`src/generator/`, autoscope as instance, +1–2 templates) | 5–7 days | ⏳ pending M0 |
| **M3** | 2D editor script-only (Mini-DSL parser + Monaco + live preview + SceneData round-trip) | 2 weeks | ⏳ pending M0 |
| **M3.5** | 2D editor graph view + AST↔graph dual-sync | 2–3 weeks | ⏳ pending M3 |
| **M4** | 3D viewport editor (three.js + gizmo + 3D primitive panel + SceneData output) | 3–4 weeks | ⏳ pending M0 |
| **M5** | LLM emits SceneData JSON (SKILL.md rewrite, source.prompt preserved for iterative edit) | 1–2 weeks | ⏳ pending M0, M1 |
| **M6** | LLM emits Generator function (`(hash) => SceneData`, autoscope-style generative from prompt) | 1–2 weeks | ⏳ pending M2, M5 |

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

---

## What unblocks next

**M0 Day 4-5**: refactor `examples/sdf/autoscope-scenes.js` to emit SceneData instead of direct SDF construction. Validation gate: `autoscope-clone.html` calls `compile()` → visual parity with current direct-SDF code. All 6 generators (city / sea / forest / village / city-axis / abstract) must round-trip cleanly. If any scene can't be expressed in spec, extend spec before closing M0.

**After M0**: M1 Compositor v0 starts — 4-input-tab UI (text / generator / 2d-edit / 3d-edit) sharing renderer pool. `text` and `generator` tabs functional first; `2d-edit` and `3d-edit` are stubs until M3 / M4.

---

## How this file is maintained

Update this file when:
- A milestone changes status (pending → 🟡 in-progress → ✅ shipped)
- A new spec extension is locked and shipped
- A new locked decision is recorded in memory
- A commit closes a significant scope (add the entry to "Recent commits")

Do not update for in-flight implementation details; that's git log territory. This is a **decision + milestone tracker**, not a changelog.
