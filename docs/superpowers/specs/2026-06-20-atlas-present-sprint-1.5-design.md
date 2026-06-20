# Atlas Present Sprint 1.5 Design — Variant Generation + Quality Fixes

**Date:** 2026-06-20
**Status:** Spec locked (all design decisions confirmed via inline Q&A 2026-06-20)
**Branch:** `sprint-1.5-variant-quality`
**Predecessor:** Sprint 1 v4 (PDF → 2D Info Graphic MVP, shipped 2026-06-19 commits 99e6a9a..1600e3a)
**Successor:** Sprint 2 (3D Play mode — deferred, this sprint is 2D-only refinements)

---

## 1. Goal

Lift Sprint 1 v4 output quality from "barely usable" to "consistently usable" by adding 3 bug fixes + 1 structural UX feature.

**Concrete user-visible promise:** when user re-imports the Aether AI 13-page PDF after this sprint, **page 4 no longer errors**, **most pages no longer black blobs**, and **per page user can pick 1 of 3 variants** instead of being stuck with whatever lift LLM emitted on first try.

## 2. Non-goals (explicit)

- NOT 3D Play mode (that's Sprint 2)
- NOT additional archetypes beyond Linear (Sprint 3+ — Comparison/Opposition flagged by AntV intel)
- NOT parallel lift (variant generation runs serial; parallel is Sprint 2+ optimization)
- NOT per-section re-lift UI (Sprint 3+)
- NOT changing atomic unit from slide → paragraph (Napkin-style — not Atlas's path)
- NOT competing with Napkin on 2D polish (their territory, 2-year head start; Atlas differentiates via 3D Play + spatial narrative + variant)
- **NOT TOC-driven deck-level archetype** (the auto-extract-TOC + nesting mechanism that gives whole-document spatial structure — locked by user 2026-06-20 in [[atlas-present-spatial-narrative-thesis]] memory § "嵌套的具体 implementation 路径". Atlas's true differentiator vs Napkin/antvis (neither does this). **Deferred to Sprint 3** when archetype taxonomy extends to deck level via the same 7 classes. Sprint 1.5 ships slide-level archetype only — the fractal lower half.)

## 3. The 4 deliverables (locked)

### 3.1 Silhouette auto-fit view

**Problem:** [`info-graphic-render.js:156-171`](sdf-js/src/present/info-graphic-render.js#L156) calls `silhouette` renderer with fixed `view: 2.5`. Lift LLM frequently emits sceneData with objects far larger than this view → silhouette fills whole canvas → thumbnail shows as solid black block. Aether AI test: 6/13 pages = solid black.

**Fix:** Compute view from sceneData bbox.

```js
import { computeBoundingBox } from './linear-layout.js';
const bbox = computeBoundingBox(sceneData);
const view = Math.min(50, Math.max(0.5, Math.max(bbox.halfWidth, bbox.halfHeight) * 1.5));
```

- `1.5x` margin = 50% padding around content
- Min 0.5 prevents degenerate view (single subject at origin)
- Max 50 caps stray outliers (`large-position` sanity rule already warns >200, this is belt+suspenders)

**Files:** `sdf-js/src/present/info-graphic-render.js` (`drawSliceThumbnail`)

### 3.2 Fix `rng.random_dec is not a function` (Aether AI page 4)

**Problem:** Lift LLM's SceneData for page 4 expanded into an atom/factory chain that called `rng.random_dec()` on something other than a real `Random` instance.

**Investigation (Phase 2 task 2.1):** rng IS a real API (`src/util/random.js:58`) and IS injected at `compile.js:774`. The error means some downstream code path passes a wrong/partial rng object. **Grep first, find root cause, then fix.** Likely candidates:
- `generator-s.js` (12 `rng.random_dec` calls, expansion-time code)
- `rune-erosion-filter.js` (community atom, 2 calls)
- An atom factory that creates a nested compile context without threading rng

**Fix (Phase 2 task 2.2):** Pick the smallest change that prevents the error class:
- **If** partial rng object: fix injection in offending atom/factory
- **If** LLM hallucinated some construct that bypasses rng: add sanity rule + reject at parseLiftResponse
- **If** missing API surface in lift system prompt: document available APIs in [`examples/compositor/system-prompt-lift-3d.md`](sdf-js/examples/compositor/system-prompt-lift-3d.md)

**Files:** TBD by investigation. Likely `sdf-js/src/scene/sanity.js` + maybe one atom factory. **Do not change rng API**.

### 3.3 Anthropic prompt caching

**Problem:** [`compositor-api.js:256-289`](sdf-js/src/compositor-api.js#L256) sends full system prompt (~5k token) on every lift call. With 13 pages × 3 variants = 39 lifts, that's 195k duplicate input tokens.

**Fix:** Convert `system` from string to array-of-blocks + add `cache_control`:

```js
// Before
system: CACHED_SYSTEM_PROMPT_LIFT,
// After
system: [
  {
    type: 'text',
    text: CACHED_SYSTEM_PROMPT_LIFT,
    cache_control: { type: 'ephemeral' },
  },
],
```

**Savings:** ~75% cost on cached input tokens (~$0.04/lift × 39 = $1.50/deck saved at $3/MTok input rate)

**Risk:** Layer 1 change (`compositor-api.js`), shared with compositor demo. Phase 3 must verify compositor still works.

**Files:** `sdf-js/src/compositor-api.js`

### 3.4 Per-section variant generation (archetype-divergence, not style-divergence)

**Core feature.** 3 variants per section, user picks 1. **v2 design (2026-06-20 update):** variants diverge by **archetype choice** (LLM picks from 7-class taxonomy), not by style hint. Inspired by AntV/LangChat Slides existence proof.

**Data contract change (v3 → v4 schema, silent drop v3 per user lock):**

```js
// v3 (Sprint 1 v4, soon-to-be-dropped):
{
  id, pageIndex, status: 'pending'|'lifting'|'ready'|'error',
  slideData, code2d, prompt,
  sceneData?, region?, liftError?
}

// v4 (new):
{
  id, pageIndex,
  status: 'pending'|'lifting'|'ready'|'error',  // derived from variants
  slideData, code2d, prompt,
  variants: [
    {
      status: 'pending'|'lifting'|'ready'|'error',
      archetype?: string,  // extracted from sceneData.name when ready, e.g. "sequence" / "list" / "compare" / etc.
      sceneData?, region?, liftError?
    },
    /* always exactly 3 entries */
  ],
  selectedVariantIndex: 0,  // 0..2, default 0
}
```

**Section-level `status` derivation** (when reading or computing UI):
- `'pending'` if all 3 variants pending
- `'lifting'` if any variant lifting
- `'ready'` if at least 1 variant ready
- `'error'` if all 3 variants error

**Divergence mechanism (locked):** 3 independent lift calls with **identical prompt** + default LLM temperature (~1.0 per Anthropic default). The lift system prompt (see §3.5) lists 7 archetypes + decision table — LLM picks one per call. Stochastic divergence at default temperature is sufficient to produce 2-3 different archetypes across 3 calls for most slides; if 3 calls happen to produce same archetype, user just sees 3 similar options (degraded but not broken UX).

**Why no explicit "previously chose X" chaining:** YAGNI for Sprint 1.5. LangChat Slides ships with 3 independent stochastic LLM calls and works. Sprint 2 can add chain-aware prompting if real-world testing shows pathological clustering.

**Archetype extraction:** lift LLM is instructed (per §3.5) to set `sceneData.name` to `"<archetype>: <slide title>"`. Pipeline extracts the prefix word into `variant.archetype` for display in picker UI.

**Lift sequence (locked):** serial. Variant 0 of section i → variant 1 of section i → variant 2 of section i → variant 0 of section i+1. Cancel checkpoint between each variant.

**Selected-by-default:** variant 0. User can pick another in deck-view.

**UI changes:**
- **Library card progress:** "Lifting N/13 sections" (section ready when ≥1 variant ready). Don't surface variant granularity in library.
- **Deck-view thumbnail:** main thumbnail = `variants[selectedVariantIndex].sceneData`. Click → expand below main thumb: 3 small thumbnails of all variants, each labeled with its `archetype` (e.g. "sequence" / "list") → click a candidate → update `selectedVariantIndex` + save deck + re-render info graphic.

**Cost:** 3× lift per section. Aether AI 13 pages = 39 lifts ≈ $3-4 (offset partially by prompt caching from §3.3 → ~$1.50 net add).

**Files:** `deck-model.js` (schema), `pipeline.js` (loop, archetype extraction), `info-graphic-render.js` (variant-aware), `deck-view.js` (variant picker UI with archetype labels), `library-page.js` (progress label).

### 3.5 Archetype-first lift system prompt (NEW)

**Core insight from AntV/LangChat Slides:** their LLM prompts force **template choice as first decision** by listing N templates explicitly + decision table. Their 9-month 5.5k star validation + LangChat's shipping product proves this pattern works at production scale. Our lift system prompt v3.17 (~5k tokens, 18 worked examples) currently lacks this discipline — LLM is taught how to assemble specific scenes (carrier / cathedral) but not how to first choose an overall STRUCTURE.

**Hypothesis:** Aether AI test pages 12/13 succeeded because they happen to fit `relation` / `hierarchy` archetypes that LLM intuited. Pages 7 (pure text) and 1/6/9/11 (text-heavy) failed because LLM had no `text-card` fallback archetype documented and reverted to free-form geometry.

**Fix:** Add a 3-step section to [`sdf-js/examples/compositor/system-prompt-lift-3d.md`](sdf-js/examples/compositor/system-prompt-lift-3d.md) (~80 lines) before the existing "Output contract" section. Covers all 5 antvis-validated discipline dimensions, **not just archetype taxonomy**:

| antvis dimension | Atlas v3.18 equivalent |
|---|---|
| 1. First-line constraint (`infographic <template>`) | Step 1 `MANDATORY scene.name` + hard rule |
| 2. Archetype taxonomy (7 classes) | Step 1 table (7 classes — see substitution note below) |
| 3. Data field constraint (1 template = 1 data field, no mixing) | **Step 2 stick-to-archetype consistency rule** |
| 4. Decision algorithm (decision table) | Step 1 "When to pick" column |
| 5. Icon discipline (every item/step/node has icon) | **Step 3 semantic marker rule** |

**Archetype substitution rationale** (we deviate from antvis's 7 classes in 2 slots):
- antvis `chart` (bar/line/pie) → Atlas `kpi-hero`. Reason: SDF doesn't render chart axes well; the meaningful unit in PDF slides is usually a single number/quote, not a bar chart. `chart` deferred to Sprint 3+ when we add genuine SDF chart atoms.
- antvis `quadrant` (2x2/SWOT) → folded into `compare` (a 4-cell compare). Reason: SDF realization is identical (split by axis). `quadrant` as separate archetype redundant.
- Atlas added `text-card` (pure-text fallback). Reason: antvis doesn't need this because they handle text via icon-rich templates; we need it because text-heavy PDF slides without any structure currently produce black-blob geometry (Aether AI pages 1/6/7/9/11).

**The full v3.18 prompt section:**

```
## Step 1: Pick a slide archetype FIRST

Before emitting any subject, identify the slide's structural archetype:

| Archetype | When to pick | Typical SDF realization |
|---|---|---|
| sequence | ordered steps / timeline / process / pipeline | linear arrangement of objects along X axis with arrows/connectors |
| list | bullet points / unordered items / feature grid | row or grid of equal-weight objects (icons or text-3d-pipe per item) |
| compare | A vs B / pros vs cons / before vs after / 2x2 / SWOT / 4-quadrant | bilateral arrangement (mirror around YZ plane) OR 4-cell grid (split X and Z) |
| hierarchy | tree / org chart / taxonomy / nested categories | branching arrangement (parent center, children radiating) |
| relation | network / dependency graph / mind map | nodes (spheres) + edges (capsules) in 2D plane or 3D space |
| kpi-hero | single number / quote / claim / chart highlight | 1 large central object (text-3d-pipe digit or sphere) dominates view |
| text-card | pure-text page / definition / paragraph / quote (fallback when no structure detected) | text-3d-pipe title centered + 1-2 minimal context objects |

MANDATORY: Set scene.name to "<archetype>: <slide title>" — e.g. "sequence: Q3 Roadmap", "text-card: Definition". Atlas Present extracts the archetype prefix for the variant picker UI label.

Hard rule: never emit a free-form scene without first claiming an archetype. Pages with mostly text default to `text-card` rather than improvising geometry. When unclear which of 2-3 archetypes fits, pick one and proceed — divergence across variants is intentional (Atlas pipeline runs 3 independent lifts per slide; users see all variants in a picker UI).

## Step 2: Realize the archetype consistently (no mixing)

Once you pick an archetype, ALL subjects in this scene must participate in its structural pattern. Do NOT mix subjects from different archetypes in the same `subjects` list.

Examples of correct consistency:
- `sequence` → all subjects participate in the linear arrangement (no orphan items off-axis). The arrangement IS the message.
- `compare` → exactly 2 (binary) or 4 (quadrant/SWOT) top-level subject groups. Everything else nested as children/internals of those groups.
- `hierarchy` → 1 root subject, children radiate; no peer-level items beyond the root tree.
- `list` → all items have equal visual weight (same size/material range). No "hero" item promoted above peers.
- `relation` → nodes are visually similar (uniform sphere or capsule). Edges (capsules) connect them; nothing else floats free.
- `kpi-hero` → 1 dominant central object (>50% of view). Other objects are visual support (background, frame, label), not peer content.
- `text-card` → text-3d-pipe (the chosen title or definition) is the focal point. Minimal context objects only.

Anti-pattern: emitting a `sequence` of 3 steps PLUS a free-floating `kpi-hero` number off to the side. Pick ONE archetype per slide; nest sub-content INSIDE the chosen pattern, don't park it alongside.

If a slide genuinely contains 2 archetypes (e.g., "sequence of compare blocks"), pick the OUTER archetype (sequence) and treat inner blocks as opaque sub-units of each step. Nested archetypes are emergent from `sequence` items containing groups, NOT from mixing top-level archetypes.

## Step 3: Add semantic markers to every unit (icon discipline)

To prevent the "abstract unlabeled identical-primitive blob" failure mode, every discrete unit in your chosen archetype MUST carry a semantic marker:

| Archetype | Unit | Marker options (pick one) |
|---|---|---|
| sequence | each step | text-3d-pipe digit ("1"/"2"/"3"), text-3d-pipe glyph (first letter of step label), small primitive (sphere/cube/cylinder) representing step concept |
| list | each item | text-3d-pipe glyph (first letter of item label), small primitive representing concept |
| hierarchy | each node | text-3d-pipe glyph or small primitive |
| relation | each node | small primitive (sphere = uniform node), differentiated by material/color |
| compare | each side's head | text-3d-pipe label or distinct primitive |
| kpi-hero | the central object | inherent — the number/quote IS the marker |
| text-card | the title | inherent — the text-3d-pipe glyphs ARE the markers |

Fallback rule: if you don't know what specific marker fits, use a small text-3d-pipe glyph of the first letter of the item's label. NEVER emit a list/sequence/hierarchy with unlabeled identical primitives — that defeats the archetype's purpose (the structure should make WHAT each item is legible at a glance).

Marker sizing: markers are accents, not the main geometry. Roughly 20-40% the size of the structural object they label.
```

**Token cost:** ~600 tokens added to system prompt → with prompt caching from §3.3 → negligible per-call cost.

**Files:** `sdf-js/examples/compositor/system-prompt-lift-3d.md` (insert before existing "Output contract" section, bump version v3.17 → v3.18).

## 4. File map

| File | Change | Phase |
|---|---|---|
| `sdf-js/src/present/info-graphic-render.js` | Modify `drawSliceThumbnail` (view), modify call sites to read `variants[selectedVariantIndex].sceneData/region` | 1 + 6 |
| `sdf-js/src/scene/sanity.js` OR atom factory | Investigation-driven fix for rng error | 2 |
| `sdf-js/examples/compositor/system-prompt-lift-3d.md` | (Phase 2) Possible API surface doc addition + **(Phase 2.5) archetype-first 7-class taxonomy + decision table, bump v3.17 → v3.18** | 2 + **2.5** |
| `sdf-js/src/compositor-api.js` | `system` → array with `cache_control` | 3 |
| `sdf-js/src/present/deck-model.js` | REWRITE schema to v4 (variants[] with `archetype` field, no `styleHint`) | 4 |
| `sdf-js/scripts/test-deck-model.mjs` | REWRITE for v4 schema | 4 |
| `sdf-js/src/present/pipeline.js` | Inner variant loop (3 independent lift calls, no prompt mutation) + archetype extraction from `sceneData.name` | 5 |
| `sdf-js/scripts/test-pipeline.mjs` | Add variant generation assertions (3 lifts, archetype extraction) | 5 |
| `sdf-js/src/present/deck-view.js` | Variant picker UI (click thumb → 3-thumb panel with archetype labels) | 6 |
| `sdf-js/src/present/library-page.js` | Progress label tweak | 6 |
| `sdf-js/scripts/test-info-graphic-render.mjs` | Update for `variants[selectedVariantIndex]` adaptation | 6 |

## 5. Acceptance criteria

- [ ] `npm test` 34/34 still pass (plus assertions added in Phase 4/5/6 — target ~40+)
- [ ] CI grep mode-agnostic check on deck-model.js still clean (no `camera/yaw/pitch/distance/focal/waypoint/cameraSequence/tween/easing` outside enforcement banner)
- [ ] Browse smoke: inject 3-variant deck → deck-view shows main thumbnail + click expands 3-thumb panel + click candidate updates main thumbnail
- [ ] Phase 2 outcome documented (root cause of rng error)
- [ ] Phase 3 outcome documented (prompt caching verified via Anthropic response.usage `cache_creation_input_tokens` + `cache_read_input_tokens` > 0 on 2nd+ call)
- [ ] PR opened (`gh pr create`), NOT merged (user merges with `--squash --delete-branch`)

## 6. Hard rules (carried from Sprint 1 v4 + new)

- **PR workflow** — branch `sprint-1.5-variant-quality`, do NOT push main, do NOT `gh pr merge` self. (memory `feedback_git_pr_workflow.md`)
- **Mode-agnostic schema** — deck-model.js v4 schema still must not contain 3D vocabulary (camera/yaw/pitch/distance/focal/waypoint) outside enforcement banner. CI grep verified.
- **Atlas IP boundary** — silhouette CPU renderer used for variant thumbnails (each variant gets its own silhouette tempCanvas). Canvas2D for variant picker chrome (border, click indicator). No new 3rd-party deps.
- **No streaming UX** — same as Sprint 1 v4. All variants for all sections lift before user can interact. (Sprint 2 adds streaming for 3D Play.)
- **TDD strict** — Phase 1 / 4 / 5 / 6 unit + integration tests must precede implementation.
- **Browse smoke verify** — Phase 6 final step uses `/browse` skill (silhouette CPU is headless), not user screenshots. (memory `feedback_use_browse_skill_for_visual_verify`)

## 7. Sprint 1.5 ≈ Sprint 1 v4 + delta

Same architectural layers and conventions as Sprint 1 v4. This is a **refinement sprint**:
- Same compositor-api integration (callLiftLLM + compileScene + createRendererForId)
- Same Layer 2 separation (Atlas Present app uses Layer 1 via compositor-api, no Layer 1 internals mutation)
- Same mode-agnostic schema (extended, not replaced — variants[] is mode-agnostic too)

Sprint 2 (3D Play) will validate mode-agnostic schema by adding 2nd render consumer that reads `variants[selectedVariantIndex].region` to derive camera state.

---

**Spec locked. Plan saved separately at [`2026-06-20-atlas-present-sprint-1.5-plan.md`](../plans/2026-06-20-atlas-present-sprint-1.5-plan.md).**
