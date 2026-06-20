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

### 3.4 Per-section variant generation

**Core feature.** 3 variants per section, user picks 1.

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
      styleHint: 'minimal'|'abstract'|'dense',
      status: 'pending'|'lifting'|'ready'|'error',
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

**Style hints (locked):**
```
variant 0 → "minimal, focus on the core concept with few large objects"
variant 1 → "abstract, use geometric shapes that suggest the idea metaphorically"
variant 2 → "dense, include multiple objects showing all key entities"
```

Appended to user prompt: `${section.prompt} — Style: ${styleHint}`.

**Lift sequence (locked):** serial. Variant 0 of section i → variant 1 of section i → variant 2 of section i → variant 0 of section i+1. Cancel checkpoint between each variant.

**Selected-by-default:** variant 0 (minimal). User can pick another in deck-view.

**UI changes:**
- **Library card progress:** "Lifting N/13 sections" (section ready when ≥1 variant ready). Don't surface variant granularity in library — too noisy.
- **Deck-view thumbnail:** main thumbnail = `variants[selectedVariantIndex].sceneData`. Click → expand below main thumb: 3 small thumbnails of all variants → click a candidate → update `selectedVariantIndex` + save deck + re-render info graphic.

**Cost:** 3× lift per section. Aether AI 13 pages = 39 lifts ≈ $3-4 (offset partially by prompt caching from §3.3 → ~$1.50 net add).

**Files:** `deck-model.js` (schema), `pipeline.js` (loop), `info-graphic-render.js` (variant-aware), `deck-view.js` (variant picker UI), `library-page.js` (progress label).

## 4. File map

| File | Change | Phase |
|---|---|---|
| `sdf-js/src/present/info-graphic-render.js` | Modify `drawSliceThumbnail` (view), modify call sites to read `variants[selectedVariantIndex].sceneData/region` | 1 + 6 |
| `sdf-js/src/scene/sanity.js` OR atom factory | Investigation-driven fix for rng error | 2 |
| `sdf-js/examples/compositor/system-prompt-lift-3d.md` | Possible API surface doc addition | 2 |
| `sdf-js/src/compositor-api.js` | `system` → array with `cache_control` | 3 |
| `sdf-js/src/present/deck-model.js` | REWRITE schema to v4 (variants[]) | 4 |
| `sdf-js/scripts/test-deck-model.mjs` | REWRITE for v4 schema | 4 |
| `sdf-js/src/present/pipeline.js` | Inner variant loop + style hint suffix | 5 |
| `sdf-js/scripts/test-pipeline.mjs` | Add variant generation assertions | 5 |
| `sdf-js/src/present/deck-view.js` | Variant picker UI (click thumb → 3-thumb panel) | 6 |
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
