# Atlas Present — Canvas Mode (Sprint 1 Re-architecture) Design Spec

**Date:** 2026-06-19
**Status:** Awaiting user review
**Effort:** ~6-9 hours subagent-driven (Sprint 1 PPT-clone 70% carries over)
**Position:** Replaces deprecated Sprint 1 PPT-mode. Authoritative Sprint 1 going forward.

---

## 1 — Goal + the pivot

Ship Atlas Present MVP as **Prezi-style canvas mode** (not PPT-style slide-deck mode). End-of-sprint demo:

1. Open `/examples/present/`
2. Create a deck
3. Add 3-4 subjects (e.g. cube-3d, text-3d-pipe, sphere) to the persistent 3D canvas at different positions
4. Capture 3 waypoints (camera framings — overview / zoom-A / zoom-B)
5. ▶ Present → camera **smoothly tweens** between waypoints on ←→ keys → esc exit

**The pivot in one sentence**: a deck is not a list of independent scenes — it is **one persistent 3D scene** plus an **ordered list of camera waypoints** through it.

**Why pivot**: Sprint 1 (commits `055c601`..`f27798c`) shipped a PPT-clone — `deck.slides[]` each held its own complete SceneData with its own camera. Each slide-switch destroyed and rebuilt the scene; "transitions" required a separate engine. This directly contradicts [[atlas-use-case-next-gen-prezi]] which locked next-gen-Prezi as the target, and ignores that Prezi's defining feature is **persistent-canvas-with-camera-fly-through**. Canvas mode also aligns with compositor's existing DNA (one scene per session, cameraSequence-animated camera) far better than the slide-deck model did. Sprint 1 PPT-mode is deprecated.

---

## 2 — Architecture vs deprecated Sprint 1

```
Sprint 1 (DEPRECATED — PPT-clone):                  Sprint 1 (NEW — Canvas mode):
Deck {                                              Deck {
  theme,                                              theme,
  slides: [                                           canvas: SceneData {       ← ONE persistent scene
    { sceneData (full), title?, ... },                  subjects: [...],
    { sceneData (full), title?, ... },                  defaults: {...},
    ...                                               },
  ]                                                   waypoints: [             ← ordered camera frames
}                                                       { id, title, camera: {yaw,pitch,distance,target} },
Switching slides = full scene swap                      ...
                                                      ]
                                                    }
                                                    Switching waypoints = camera tween
```

**Compositor primitive reuse changes**:
- `compileScene` from Layer 1 (`compositor-api.js`) — called ONCE per deck open (not per slide) because the canvas is persistent
- `createRendererForId` — instantiated ONCE per editor/present-mode session
- Camera state is mutated via `renderer.setCamState(...)` per frame during tween
- This pattern matches compositor's existing `gpuCameraLoop` (which evaluates `scene.evalCamera(t)` continuously) — we just drive it from waypoint deltas instead of cameraSequence time

**Layer 2 hard rule still holds** (per [[compositor-layered-for-presentation]]): Layer 2 calls Layer 1 via `compositor-api.js`; never mutates compositor internals. The pivot is INTERNAL to Layer 2's data model — Layer 1 contracts unchanged.

---

## 3 — Data model (Deck / Canvas / Waypoint)

```ts
type Deck = {
  // Identity
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;

  // Theme
  theme: {
    renderer: 'studio' | 'fly3d' | 'silhouette';
    // Sprint 2+: background, accent, fontFamily, logo
  };

  // The persistent 3D scene (SceneData v1)
  canvas: SceneData;

  // Camera framings — ordered. Empty = no presentation yet, just authoring.
  waypoints: Waypoint[];

  // Tween defaults (per-waypoint can override in Sprint 2+)
  tween: {
    durationMs: number;            // Sprint 1 default: 800
    easing: 'linear' | 'ease-in-out';  // Sprint 1 default: 'ease-in-out'
  };
};

type Waypoint = {
  id: string;
  title?: string;                  // shown in waypoint list + audience counter
  camera: {
    yaw: number;                   // radians
    pitch: number;                 // radians
    distance: number;              // units
    targetX: number;
    targetY: number;
    targetZ: number;
    focal?: number;                // optional, defaults from compositor
  };
  // Sprint 2+: hold? (autoplay), transitionIn? (per-waypoint override),
  // notes? (markdown), subjectIdsHighlighted? (visual emphasis)
};
```

**Canvas SceneData**: standard SceneData v1 (`{v: 1, name, subjects, defaults}`). Same schema compositor consumes. Subjects added/removed/edited mutate the canvas object directly.

**Waypoint camera**: spherical orbit format (matches `defaults.camera` schema everywhere in Atlas). `sphericalToCamState` from compositor-api converts to Cartesian eye position at render time.

**localStorage schema**:
```ts
{
  version: 2,                      // bump from 1 — old PPT-mode decks ignored
  decks: Deck[],
}
```
Migration: if v1 decks exist in storage (from deprecated Sprint 1), drop them silently. We're 2 hours past Sprint 1 ship; no real users to preserve. Migration noise > value.

---

## 4 — Camera tween

When user advances slide N → N+1, the renderer's camera animates from waypoint[N].camera to waypoint[N+1].camera over `deck.tween.durationMs` (default 800ms) with `deck.tween.easing` (default 'ease-in-out').

**Interpolation**: linear interpolation on each spherical component (yaw, pitch, distance, targetX/Y/Z), then convert to Cartesian via `sphericalToCamState`. Easing applied to t ∈ [0,1] before interpolation.

**Yaw wraparound**: shortest-arc — if `|toYaw - fromYaw| > π`, adjust by ±2π so we tween the short way.

**Implementation**: requestAnimationFrame loop driven by Layer 2 (not compositor's `gpuCameraLoop`). On every frame:
1. Compute `t = elapsedMs / durationMs`, clamped to [0,1]
2. Apply easing to t
3. Interpolate all 6 camera fields
4. Call `renderer.setCamState(sphericalToCamState(interpolatedCam))`
5. Renderer re-renders next frame with new camera

Tween runs in BOTH editor (when user clicks a waypoint in the rail — preview the framing) AND present mode (slide navigation). Editor tween is shorter (200ms — preview snap) than present tween (800ms — cinematic).

**Camera while authoring (no waypoint selected)**: free orbit via drag/WASD using compositor's existing camera controls. Renderer-side `userTookCam` flag.

---

## 5 — Editor UI sketches

### 5.1 Library page (`/examples/present/`)

Unchanged from Sprint 1 (PPT-clone). Deck cards show title + waypoint count + last updated.

### 5.2 Editor page (`/examples/present/?deck=<id>`)

```
┌─────────────────────────────────────────────────────────────────┐
│ [← Library]  My Deck v3                  [▶ Present]            │
├──────┬─────────────────────────────────────┬────────────────────┤
│Way-  │                                     │  Selected Waypoint │
│point │   ╔═══════════════════════════════╗ │                    │
│ rail │   ║                               ║ │  Title: Overview   │
│      │   ║                               ║ │                    │
│ ┌──┐ │   ║        3D CANVAS              ║ │  Camera:           │
│ │1*│ │   ║      (full viewport)          ║ │   target: 0,0,0    │
│ └──┘ │   ║                               ║ │   yaw: 0.30        │
│ ┌──┐ │   ║   [subjects + waypoint frames]║ │   pitch: -0.15     │
│ │2 │ │   ║                               ║ │   distance: 8.5    │
│ └──┘ │   ║                               ║ │                    │
│ ┌──┐ │   ║                               ║ │  [Re-capture]      │
│ │3 │ │   ╚═══════════════════════════════╝ │  [Delete waypoint] │
│ └──┘ │                                     │                    │
│      │ ┌─── Inspector toggle ────────────┐ │  ─── Subjects ──── │
│ [+W] │ │ [Subjects] [Waypoints]          │ │  • cube-3d (cubes) │
│      │ └─────────────────────────────────┘ │  • text-3d (title) │
│ [+S] │                                     │  • sphere (orb)    │
│      │  Toolbar (when Subjects active):    │  [+ Add subject]   │
│      │   [+ Cube] [+ Text] [+ Sphere] ... │                    │
│      │                                     │  ─── Deck ──────── │
│      │                                     │  Renderer: studio  │
└──────┴─────────────────────────────────────┴────────────────────┘
```

**LEFT — Waypoint rail**:
- Vertical list of waypoint thumbnails (numbered)
- Click to preview (camera tweens to that waypoint in viewport)
- Drag to reorder
- `[+W]` button = capture current camera as new waypoint at end
- `[+S]` button (Sprint 1 simple variant) = open Add Subject form

**CENTER — 3D Canvas viewport**:
- Full size, takes most of the screen
- Renders the canvas SceneData via the deck's renderer
- Drag to orbit camera (compositor camera controls)
- Waypoint indicators (Sprint 2+ — wireframe view-cones showing what each waypoint sees)
- Subjects rendered as actual SDF (clickable in Sprint 2+; Sprint 1 = settings pane only)

**RIGHT — Inspector pane**:
- Top section: **Selected Waypoint** (camera values + Re-capture + Delete buttons)
- Mid section: **Subjects list** (read-only Sprint 1 — click to edit args via form below; Sprint 2+ adds click-on-3D-to-select)
- Bottom section: **Deck** (renderer dropdown, tween settings)

### 5.3 Present mode (`/examples/present/?deck=<id>&present=1`)

```
[full viewport canvas — same renderer as editor]
[bottom-right counter "1 / 4" auto-hide after 2s]
[bottom-left "Press esc to exit" hint auto-hide]
```

**Behavior**:
- On enter: canvas compile + renderer mount + camera SNAPS to waypoint 0 (no animation)
- ←→: tween 800ms to next/prev waypoint
- Spacebar / click canvas / PageDown: same as →
- PageUp: same as ←
- Home / End: jump to first / last (snap, no tween — Sprint 1)
- Esc: exit fullscreen + back to editor
- No camera drag, no WASD (audience cannot reframe — author's vision is absolute)

---

## 6 — File layout

### NEW files

| Path | LoC est. | Responsibility |
|---|---|---|
| `sdf-js/src/present/waypoint-tween.js` | ~150 | Camera tween logic + easing — pure, testable |
| `sdf-js/scripts/test-waypoint-tween.mjs` | ~120 | L1 unit tests (~20 assertions) |
| `sdf-js/src/present/atom-palette.js` | ~200 | "+ Add Subject" form helper — list of P0 atom types user can place |

### REPLACED files (Sprint 1 deprecated impl wiped)

| Path | Sprint 1 status | Canvas-mode change |
|---|---|---|
| `sdf-js/src/present/deck-model.js` | ✅ shipped | REWRITE — new Deck/Canvas/Waypoint schema; CRUD funcs renamed/refactored |
| `sdf-js/scripts/test-deck-model.mjs` | ✅ 44 assertions | REWRITE — new tests for canvas/waypoint CRUD |
| `sdf-js/src/present/deck-editor.js` | ✅ shipped | REPLACE — center pane = 3D canvas viewport, not slide preview |
| `sdf-js/src/present/present-mode.js` | ✅ shipped | REWRITE — render canvas once + tween camera on key |
| `sdf-js/examples/present/style.css` | ✅ shipped | EXTEND — keep library/topbar/inspector; replace editor pane styles for canvas viewport |

### KEPT unchanged from Sprint 1

| Path | Why kept |
|---|---|
| `sdf-js/src/compositor-api.js` | ✅ Layer 1 contract unchanged — all 6 functions still used |
| `sdf-js/scripts/test-compositor-api.mjs` | ✅ 25 assertions still valid |
| `sdf-js/src/present/deck-library.js` | ✅ Library page UI unaffected — only `deck.slides.length` → `deck.waypoints.length` in card metadata |
| `sdf-js/examples/present/index.html` | ✅ Router unchanged (library / editor / present 3 modes) |

### Deprecated artifacts (will not be loaded but kept in git history)

- The old localStorage key `atlas-decks` v1 schema: discarded on first load of v2 (no migration)

---

## 7 — Test plan

### L1 — Unit tests

**`test-waypoint-tween.mjs`** (~20 assertions):
- `interpolateCamera(from, to, t=0)` returns from
- `interpolateCamera(from, to, t=1)` returns to
- `interpolateCamera(from, to, t=0.5)` returns midpoint on each axis
- `easeInOut(0)` = 0, `easeInOut(0.5)` = 0.5, `easeInOut(1)` = 1
- Yaw wraparound: from yaw=0.1, to yaw=6.0 (~2π−0.28), midpoint is NOT (0.1+6.0)/2 — should take short arc, result close to -0.09 (wrapping through 0)
- `tweenCamera(from, to, durationMs, easing, onFrame, onComplete)` calls onFrame multiple times, onComplete once
- Cancel: returned `cancel()` function stops further onFrame calls

**`test-deck-model.mjs` REWRITE** (~25 assertions):
- `createDeck(title)` returns Deck with empty canvas (subjects:[]) + empty waypoints + default tween
- `addSubjectToCanvas(deck, subjectInput)` appends to canvas.subjects, updates updatedAt
- `removeSubjectFromCanvas(deck, subjectId)` removes by id
- `addWaypoint(deck, waypointInput)` appends to waypoints
- `removeWaypoint(deck, waypointId)` removes by id
- `moveWaypoint(deck, fromIdx, toIdx)` reorders
- `updateWaypointCamera(deck, waypointId, newCamera)` mutates camera
- localStorage round-trips (saveDeckToStorage / loadDeckFromStorage / listDecks / deleteDeckFromStorage)
- `renameDeck` / `duplicateDeck` work as before (signature unchanged)
- Migration: old v1 storage shape returns empty decks list (silent drop)
- Edge cases: empty canvas + empty waypoints valid deck; 100-waypoint deck OK

### L2 — Browse smoke tests

Per phase commit: navigate to `/examples/present/`, smoke through library + editor + present mode without console errors.

### L3 — End-to-end acceptance (10 steps)

1. Reset localStorage
2. Open `/examples/present/` → see empty library
3. + New Deck "Canvas Test"
4. Open editor → see empty 3D canvas (just empty space + camera at default orbit)
5. + Add Subject → cube-3d at translate `[0,0.5,0]`
6. + Add Subject → cube-3d at translate `[3,0.5,0]` (offset right)
7. + Add Subject → text-3d-pipe "ATLAS" at translate `[0,3,0]` (above)
8. Drag camera to frame all 3 → + Waypoint "Overview"
9. Drag camera to zoom on cube 1 → + Waypoint "Zoom Cube A"
10. Drag camera to zoom on text → + Waypoint "Zoom Title"
11. ▶ Present → see Overview, ← right arrow → camera tweens smoothly to Cube A → → tweens to Title → → at end stays → ← back → esc exits

Expected: smooth camera animation (not snap) between waypoints. Subjects persist (same SDF tree, only camera changes).

---

## 8 — Acceptance criteria

1. ✅ Library page works (unchanged from Sprint 1 PPT-mode — verify regression-free)
2. ✅ Editor: center is 3D canvas (renders SceneData with renderer)
3. ✅ Add subject (3-5 atom types supported in palette: cube-3d, text-3d-pipe, sphere, box, bar-3d) at user-specified position
4. ✅ Remove subject
5. ✅ Add waypoint (captures current camera into the deck)
6. ✅ Reorder waypoints (drag in left rail)
7. ✅ Update waypoint (re-capture from current camera)
8. ✅ Delete waypoint
9. ✅ Click waypoint in rail → camera tweens to that framing (preview)
10. ✅ Present mode: ←→/space tweens 800ms between waypoints; esc exit
11. ✅ Camera tween is SMOOTH (not snap), uses ease-in-out
12. ✅ L1 tests pass; npm test 28 → 29 (deck-model rewrite doesn't add files; waypoint-tween adds 1)
13. ✅ No regression in cube-3d-showcase rendering in compositor (verify `/browse` post-pivot — should be unchanged since we don't touch compositor-api or compositor)

---

## 9 — Hard rules

1. **Canvas is ONE SceneData per deck** — adding a subject mutates the same canvas; never copy/clone canvases between waypoints.
2. **Waypoint is camera-only** — no per-waypoint subjects, no per-waypoint material overrides. (Sprint 2+ adds per-waypoint subject visibility/highlight.)
3. **Camera tween is Layer 2 owned** — uses `compositor-api.sphericalToCamState` + `renderer.setCamState`, never touches compositor's `gpuCameraLoop` or `scene.evalCamera`.
4. **Sprint 1 PPT-mode deck schema is DEAD** — no migration path. v1 storage silently discarded on first load of v2.
5. **Subject placement is form-based for Sprint 1** — type + numerical [x,y,z]. Click-in-3D placement, drag-to-move, gizmo-rotate are Sprint 2+.
6. **Renderer LOCK in present mode** still applies (per [[compositor-layered-for-presentation]] rule).

---

## 10 — Out of scope (Sprint 2+)

- Speaker notes per waypoint
- Per-waypoint duration / autoplay
- Per-waypoint transition override (custom durationMs/easing per waypoint)
- Visual waypoint indicators in editor 3D canvas (wireframe view-cones)
- Click-on-3D to select subject; drag-to-move subject in 3D
- Subject gizmos (rotate / scale handles)
- PDF import (Sprint 2 — would create canvas-mode deck by spatial-arranging slide content)
- Lift batch integration (Sprint 2)
- Theme system beyond renderer (Sprint 3)
- Speaker mode dual-screen (Sprint 3)
- Export to video / PDF (Sprint 3)
- URL share / fork (Sprint 4)
- Cloud sync (Sprint 4)

---

## 11 — Related work

- **Memory**: [[atlas-use-case-next-gen-prezi]] — strategic LOCK (this spec finally implements that vision faithfully, undoing Sprint 1's drift to PPT-clone)
- **Memory**: [[compositor-layered-for-presentation]] — Layer 2/1 architecture LOCK (still in force)
- **Memory**: [[compositor-state-machine]] / [[compositor-scene-loading]] / [[lift-llm-integration]] / [[compositor-entry-points]] — Layer 1 surface (unchanged use)
- **Deprecated spec**: `2026-06-19-atlas-present-sprint-1-design.md` (PPT-clone) — superseded by this
- **Deprecated plan**: `2026-06-19-atlas-present-sprint-1-plan.md` — superseded
- **Reference UI**: Prezi editor screenshot shared 2026-06-19

---

## 12 — Phase breakdown (preview for writing-plans)

5-phase plan, ~6-9 hr subagent-driven:

| Phase | Scope | Effort | Carry-over from PPT Sprint 1 |
|---|---|---|---|
| 1 | Memory updates + deprecate Sprint 1 PPT artifacts + write new types in deck-model.js | 30 min | — |
| 2 | `waypoint-tween.js` — camera interpolation + easing + RAF loop, TDD (~20 assertions) | 1.5 hr | — (new file) |
| 3 | Rewrite `deck-model.js` for canvas+waypoint schema + TDD (~25 assertions) | 2 hr | localStorage scaffolding (~20% reusable) |
| 4 | Rewrite `deck-editor.js` — 3-pane with center 3D viewport + waypoint rail + Add Subject palette | 2-3 hr | topbar + library deep link (~30%) |
| 5 | Rewrite `present-mode.js` — single-canvas compile + camera tween on key + L3 acceptance | 1.5 hr | fullscreen + key handlers + cursor hide (~70%) |
| 6 | Final memory + commit + push | 0.5 hr | — |

**Total: ~7-9 hr** (subagent-driven parallel). Same magnitude as PPT Sprint 1 effort. ~30% of PPT Sprint 1 code carries over (`compositor-api` 100% + library 95% + index.html 100% + present-mode key handlers 70% + style 60%).
