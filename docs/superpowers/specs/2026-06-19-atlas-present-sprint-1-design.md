# Atlas Present — Sprint 1 (MVP) Design Spec

**Date:** 2026-06-19
**Status:** Awaiting user review
**Effort:** ~2 weeks human / ~8-12 hours subagent-driven
**Position:** First sprint of Layer 2 application layer (演示器). Architecture follows [[compositor-layered-for-presentation]] LOCK — Layer 2 calls Layer 1 (compositor), does not modify it.

---

## 1 — Goal

Ship the minimum-viable presentation tool on top of Atlas compositor: load N saved scenes into an ordered deck, play in fullscreen with ←→ navigation, persist to localStorage. **End-of-sprint demo**: open `/present/` → New Deck → add 3 compositor scenes → ▶ Present → ← → navigate → esc exit.

**Out of scope for Sprint 1** (deferred to Sprint 2+):
- PDF import (Sprint 2)
- Lift integration / batch lift (Sprint 2)
- Speaker notes (Sprint 2)
- Fade / dolly / zoom transitions (Sprint 2-3)
- Speaker mode dual-screen (Sprint 3)
- Video / PDF export (Sprint 3)
- Theme system (Sprint 3)
- URL share / fork (Sprint 4)

**In scope for Sprint 1**:
1. Deck + Slide data model + localStorage persistence
2. Deck Library page (list / new / delete / rename)
3. Deck Editor page (slide list + preview + reorder + add/remove)
4. Present Mode (fullscreen + ←→ navigation + cut transitions)
5. Extract shared API from compositor.js → `src/compositor-api.js`

---

## 2 — Architecture recap

Per [[compositor-layered-for-presentation]] (commit pending):

```
Layer 2: examples/present/   ← NEW (this sprint)
  imports
Layer 1: sdf-js/src/compositor-api.js   ← NEW (extracted from compositor.js)
  +
Layer 1: sdf-js/src/render/*.js + sdf-js/src/scene/compile.js   ← existing
  +
Layer 0: sdf-js/src/sdf/*.js   ← existing
```

**Hard rule** (from memory): Layer 2 must go through Layer 1's public API. NO direct mutation of compositor internal state. NO assumption that compositor is running. Layer 2 is a **standalone application** that USES compositor primitives but maintains its own state machine + UI.

**Why a new `compositor-api.js`**: compositor.js (3283 lines) bundles state machine + UI + APIs together. Sprint 1 extracts the pure-function APIs (scene compile dispatch, renderer factory access, future lift call) into a lib module that Layer 2 (and tests, and future MCP server) can import without dragging in compositor's DOM logic.

---

## 3 — Data model

### 3.1 Deck type

```ts
type Deck = {
  // Identity
  id: string;                  // uuid (crypto.randomUUID())
  title: string;               // user-editable
  createdAt: number;           // ms epoch
  updatedAt: number;           // ms epoch

  // Theme (deck-level — all slides inherit unless they override)
  theme: {
    renderer: RendererId;      // 'studio' | 'fly3d' | 'bob-gpu' | 'blueprint' | 'crayon' | 'topo' | 'silhouette' | 'bob' | 'lines'
    // Sprint 1: that's it. Sprint 3+ adds: background, accent, fontFamily, logo, palette
  };

  // Deck-level defaults (Sprint 1 minimal)
  defaults: {
    transitionType: 'cut';     // Sprint 1: only 'cut'. Sprint 2 adds 'fade'.
    transitionDuration: 0;     // ms. 0 for cut.
  };

  // Slides
  slides: Slide[];             // ordered, length 0..N
};
```

### 3.2 Slide type

```ts
type Slide = {
  id: string;                  // uuid
  title?: string;              // optional display title

  // Content — INLINE SceneData (Slide is self-contained, not a reference)
  sceneData: SceneData;        // matches compositor's SceneData v1 schema

  // Per-slide overrides (Sprint 1: all optional, all empty)
  // Sprint 2+ adds: notes (markdown), duration (autoplay), transitionIn override

  // Provenance (Sprint 1 nice-to-have)
  source?: {
    type: 'compositor-saved' | 'compositor-demo' | 'blank';
    refId?: string;            // e.g., demo-lifts id or saved scene id
    addedAt: number;
  };
};
```

### 3.3 localStorage schema

Key: `atlas-decks` (sibling to existing `atlas-saved-scenes`, `atlas-anthropic-key`).

Value:
```ts
{
  version: 1;
  decks: Deck[];
  // Sprint 4 adds: lastOpenedDeckId, settings, etc.
}
```

**Migration**: if `atlas-decks` key missing on load → initialize to `{version: 1, decks: []}`. Future versions bump `version` + run migrators.

**Size budget**: 1 deck w/ 20 slides (typical PDF) at ~3KB SceneData each = 60KB. localStorage limit ~5MB → ~80 decks comfortable. Beyond that, prompt user to delete.

---

## 4 — compositor-api.js extraction scope (Phase 1 task)

This is a refactor of `sdf-js/examples/compositor/compositor.js`. We pull pure-function APIs out to `sdf-js/src/compositor-api.js` so Layer 2 (and future MCP server, tests) can import them.

### Functions to extract

| Function | Source line (approx) | Reason |
|---|---|---|
| `callLiftLLM(prompt, code2d, apiKey)` | compositor.js:825-857 | Sprint 2 needs (lift integration). Pull now to validate the extraction pattern. |
| `parseLiftResponse(raw)` | compositor.js:863-948 | Same — load-bearing JSON-isms stripper |
| `sphericalToCamState(c)` | compositor.js:1257-1273 | Layer 2 deck editor may need to compose cameras |
| Renderer factory dispatch (a NEW function) | (derived from runActiveGpuRenderer) | Layer 2 present mode calls `renderScene(rendererId, sceneData, canvas, opts)` — wraps the lazy-instantiate + unmount-discipline + dispatch pattern |
| `compileScene(sceneData, sceneHash)` | compositor.js wrapping compile() | Wraps `compile()` + `expandVariants()` + `sdfUnion(sdf, groundSdf)` so callers get a ready-to-render unified SDF |
| `loadSystemPromptLift()` | compositor.js:793-803 | Returns the v3.18 prompt string. Sprint 2 lift batch needs. |

### Functions NOT extracted (stay in compositor.js)

- Tab system, UI rendering, demo manifest, history, saved-scenes UI, generator tab, 2D editor wire-up, present-tab specific stuff — all these are compositor's app-layer concerns; Layer 2 doesn't touch them.

### Extraction rules

- **No behavior change** in compositor.js — every extracted function gets re-imported back into compositor.js so existing behavior is identical.
- **Add unit tests** for each extracted function in `sdf-js/scripts/test-compositor-api.mjs`.
- **JSDoc** every exported function (these are now public API).
- **Verify**: existing compositor demo gallery still works in browser (manual /browse spot-check).

---

## 5 — UI sketches (text-only)

### 5.1 Deck Library page (`/examples/present/`)

```
┌────────────────────────────────────────────────────────┐
│ Atlas Present                          [+ New Deck]    │
├────────────────────────────────────────────────────────┤
│  [Deck card]   [Deck card]   [Deck card]   [Deck card] │
│  Pitch v3      Cube demo     Untitled      ARTL talk   │
│  3 slides      27 slides     0 slides      15 slides   │
│  Updated 2h    Updated 1d    Updated 3d    Updated 5d  │
│  [▶] [✎] [⋯]   [▶] [✎] [⋯]   [▶] [✎] [⋯]   [▶] [✎] [⋯] │
└────────────────────────────────────────────────────────┘
```

- Click ▶ → present mode
- Click ✎ → editor
- Click ⋯ → menu (rename, duplicate, delete, export JSON)
- Click "+ New Deck" → name prompt → opens editor
- Empty state: "No decks yet. + Create your first deck"

### 5.2 Deck Editor page (`/examples/present/?deck=<id>`)

```
┌────────────────────────────────────────────────────────┐
│ [← Library]  Pitch v3                  [▶ Present]    │
├──────┬────────────────────────────┬────────────────────┤
│Slides│  Preview                   │  Slide settings    │
│ ┌──┐ │  ┌─────────────────────┐   │  Title: KPI hero   │
│ │1 │ │  │                     │   │                    │
│ │  │ │  │  <compositor render>│   │  Source:           │
│ └──┘ │  │                     │   │  compositor-saved  │
│ ┌──┐ │  │                     │   │  (id: xyz)         │
│ │2*│ │  │                     │   │                    │
│ └──┘ │  └─────────────────────┘   │  [Re-link source]  │
│ ┌──┐ │                            │  [Remove slide]    │
│ │3 │ │  Renderer: [studio v]      │                    │
│ └──┘ │                            │                    │
│      │                            │  ─── Deck ───      │
│ [+]  │                            │  Renderer: studio  │
│      │                            │  Slides: 3         │
└──────┴────────────────────────────┴────────────────────┘
```

- Left rail: slide thumbnails (192×108 each), drag to reorder, click to select. Selected slide marked with *.
- Center: live preview of selected slide using compositor renderer + chosen theme.renderer
- Right: per-slide settings + deck settings
- Click [+] at bottom of slide list → modal: "Add slide from..." → Compositor library / Compositor demos / Blank
- "▶ Present" enters fullscreen present mode

### 5.3 Present mode (fullscreen)

```
[no chrome, just slide preview filling screen]

[bottom-right corner, auto-hide after 2s]: 1 / 3
```

- Keys: ← (prev), → (next), space (next), esc (exit), home (slide 1), end (last slide)
- Click anywhere → next slide
- Cursor auto-hide after 2s idle
- Renderer LOCKED to `deck.theme.renderer` (no pill switching)
- Camera LOCKED (no drag / WASD) — userTookCam disabled for audience
- Bottom-right corner shows `N / M` counter (auto-hide after 2s)
- All console.error / console.warn suppressed visually (still logged)

---

## 6 — File layout

### NEW files

| Path | LoC est. | Responsibility |
|---|---|---|
| `sdf-js/src/compositor-api.js` | ~300 | Extracted shared APIs (callLiftLLM / parseLiftResponse / sphericalToCamState / renderScene / compileScene / loadSystemPromptLift) |
| `sdf-js/src/present/deck-model.js` | ~250 | Deck/Slide types (JS not TS — JSDoc'd) + localStorage CRUD + migration |
| `sdf-js/src/present/deck-library.js` | ~300 | Library page UI + event wiring |
| `sdf-js/src/present/deck-editor.js` | ~400 | Editor page UI + slide list + preview embed |
| `sdf-js/src/present/present-mode.js` | ~250 | Fullscreen playback + key handlers + cursor hide |
| `examples/present/index.html` | ~80 | Layer 2 entry — minimal HTML shell that loads deck-library or deck-editor or present-mode based on URL query |
| `examples/present/style.css` | ~150 | Layer 2 styling (separate from compositor's styles) |
| `sdf-js/scripts/test-deck-model.mjs` | ~200 | L1 unit tests for deck-model (~30 assertions) |
| `sdf-js/scripts/test-compositor-api.mjs` | ~150 | L1 unit tests for extracted APIs (~15 assertions) |

### MODIFIED files

| Path | Change |
|---|---|
| `sdf-js/examples/compositor/compositor.js` | Replace inline definitions of extracted functions with `import { ... } from '../../src/compositor-api.js'`. No behavior change. |
| `scripts/run-tests.mjs` | Register both new test files under `present` and `api` categories |
| `package.json` (root) | Add `test:present` script (runs `node scripts/run-tests.mjs present`) |

---

## 7 — Test plan

### L1 — Unit tests

**`scripts/test-deck-model.mjs`** (~30 assertions):
- `createDeck(title)` returns Deck with required fields populated
- `addSlide(deck, slide)` appends + updates `updatedAt`
- `removeSlide(deck, id)` removes by id
- `moveSlide(deck, fromIdx, toIdx)` reorders correctly
- `saveDeckToStorage(deck)` + `loadDeckFromStorage(id)` round-trips
- `listDecks()` returns array sorted by `updatedAt` desc
- `migrateDecksStorage(rawData)` handles missing version / empty
- Edge cases: 0-slide deck, 100-slide deck, deck with same-title duplicates

**`scripts/test-compositor-api.mjs`** (~15 assertions):
- `parseLiftResponse` strips markdown fences / trailing commas / comments
- `sphericalToCamState({yaw:0, pitch:0, distance:5, targetX:0, targetY:0, targetZ:0})` returns expected position vector
- `compileScene(sceneData)` returns unified SDF
- Verify `callLiftLLM` exists + has correct arity (don't actually call — that costs $0.21)
- Verify `renderScene(rendererId, sceneData, canvas)` returns sensibly (mock canvas)

### L2 — Browser smoke test

Manual via `/browse`:
1. Navigate to `/examples/present/`
2. Verify library page loads, "No decks yet" empty state visible
3. Click "+ New Deck" → name "smoke" → editor opens, 0 slides
4. (For Sprint 1 we won't have a "library" of demo scenes embedded yet — Sprint 1 testing acceptably uses programmatic injection of slides)

### L3 — Acceptance (end-of-sprint demo)

Hand-run via real browser:
1. Open `/examples/present/`
2. + New Deck → "Cube demo"
3. (Programmatically) add 3 slides from existing `demo-lifts/*.json` files (use a temporary "Import from compositor demo" button)
4. Click ▶ Present
5. Fullscreen, see slide 1
6. → → see slides 2, 3
7. → at end stays on slide 3 (no wrap)
8. ← back to slide 2
9. esc → back to editor
10. Reorder slide 3 to position 1 by drag → ▶ Present → see new slide 1 first

Expected: all 10 steps work without errors. Console clean.

---

## 8 — Acceptance criteria (Sprint 1 ship gate)

1. ✅ Deck library page lists decks from localStorage, supports create / rename / delete / duplicate
2. ✅ Deck editor: add slide / remove slide / reorder slides / switch renderer (studio / fly3d / silhouette tested)
3. ✅ Present mode: fullscreen, ←→/space/esc/home/end keys, cursor auto-hide, no edit chrome visible
4. ✅ Cut transition works (instant swap between slides)
5. ✅ localStorage persistence: close tab, reopen, decks survive
6. ✅ compositor-api.js extraction: compositor demo gallery still works (visual /browse check on cube-3d-showcase)
7. ✅ L1 unit tests pass (45+ assertions); npm test count goes 28 → 30
8. ✅ No regression in cube-3d-showcase rendering (visual /browse verify)

---

## 9 — Hard rules (apply during implementation)

1. **No mutation of compositor internal state from Layer 2.** Layer 2 calls Layer 1 functions; never `window.compositorState.x = y`.
2. **Slide is INLINE SceneData**, not a reference. Deck is self-contained. (Future "deck of references" can be added in Sprint 4 if needed.)
3. **Renderer LOCK in present mode**. Even if compositor has 8 pills, present mode shows ZERO renderer switching to audience.
4. **Per-feedback `atom-naming-for-llm`**: Code identifiers face LLM coding agents. Use technical names (`deck-model`, `compositor-api`, `present-mode`) not visual names (`slidedeck`, `apilib`, `slideshow`).
5. **Per-feedback `glsl-latent-gpu-bugs`**: Sprint 1 doesn't add new GLSL but the extraction touches compositor.js — visual /browse verify after extraction is non-optional.
6. **Per-feedback `reuse-compositor-pipeline`**: Layer 2 must call extracted Layer 1 APIs, NOT reimplement renderer dispatch.

---

## 10 — Out of scope (explicitly NOT Sprint 1)

- PDF import workflow
- Lift integration / "Lift this deck" batch
- Speaker notes (markdown rendering)
- Per-slide duration / autoplay
- Speaker mode (dual-screen presenter view)
- Inter-slide transitions beyond `cut` (fade / dolly / zoom / wipe)
- Theme system beyond `renderer` choice (no custom palette, no logo, no fonts)
- Video / PDF / HTML export
- URL share / Fork
- Mobile responsive layout
- Cloud sync / multi-user
- Templates / preset decks
- Atom palette / scene composition UI (Sprint 1 just embeds existing compositor scenes; building NEW scenes inside Atlas Present is Sprint 4+)

---

## 11 — Related work

- **Memory**: [[atlas-use-case-next-gen-prezi]] — strategic LOCK
- **Memory**: [[compositor-layered-for-presentation]] — Layer 2/1 architecture LOCK
- **Memory**: [[compositor-state-machine]] — Layer 1 behaviors (what to call)
- **Memory**: [[compositor-scene-loading]] — Layer 1 pipeline (what to feed)
- **Memory**: [[compositor-entry-points]] — Layer 1 API catalog
- **Memory**: [[lift-llm-integration]] — Sprint 2 prereq
- **Sibling spec**: `2026-06-19-cube-3d-design.md` (architecture-style template I followed)

---

## 12 — Phase breakdown (preview for writing-plans)

Anticipated 5-phase plan:

| Phase | Scope | Effort |
|---|---|---|
| 1 | Extract `compositor-api.js` from compositor.js + L1 tests + verify cube-3d-showcase still works | 2-3 hr |
| 2 | `deck-model.js` (types + localStorage + L1 tests) | 1.5 hr |
| 3 | `examples/present/index.html` + `deck-library.js` (library page UI) | 2 hr |
| 4 | `deck-editor.js` (editor page UI + slide list + preview embed) | 3-4 hr |
| 5 | `present-mode.js` (fullscreen + keys + cursor hide) + L3 end-to-end acceptance test | 2 hr |

**Total: ~10-12 hr** subagent-driven parallel. Single-PR ship (no inter-phase commits to user; phase commits are dev-internal).
