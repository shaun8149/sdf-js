# Atlas Present Sprint 2 — Napkin-Style Document Viewer + Inline Visual Generation

**Date:** 2026-06-20
**Status:** Spec locked (all 11 design decisions confirmed via inline Q&A 2026-06-20)
**Branch:** `sprint-2-napkin-doc-viewer`
**Predecessor:** Sprint 1.5 (PR #7 merged 2026-06-20, commit `9cd7317`)
**Successor candidates (Sprint 3+):** TOC-driven deck archetype, reveal.js Present-mode, P5.js 2D pipeline, 3D Play mode

---

## 1. Goal

Pivot Atlas Present from Sprint 1.5's "batch PDF → 2D info graphic deck" UX (which user manual L3 confirmed was bad) to **Napkin-style document viewer with selection-driven inline visual generation**. User imports PDF, sees full-text reader, highlights any text, clicks ⚡, gets 6 LLM-generated visual variants embedded inline below selection with a side picker.

**Concrete user-visible promise:** when user re-imports the Aether AI 13-page PDF, they see flowing document text. Highlighting any paragraph and clicking ⚡ produces a visual that's embedded inline (pushing text down), with a picker on the left showing 6 archetype variants and a contextual menu (Swap Layout / Effects / Export / Swap Branding) when clicking the embedded image.

## 2. Non-goals (explicit)

- NOT slide-based UX (no slide framework, no slide transitions, no per-page navigation) — that's Sprint 3+ reveal.js Present-mode if user wants it
- NOT P5.js or Canvas2D-illustration pipeline — lift LLM still outputs SceneData; 2D rendering uses Atlas's existing 4 CPU 2D renderers (silhouette/Lines/Crayon/Topo). P5.js pipeline is Sprint 3+ candidate
- NOT TOC-driven deck-level archetype — that's Sprint 3 (locked in [[atlas-present-spatial-narrative-thesis]] memory)
- NOT 3D Play mode (locked Sprint 3+)
- NOT individual color picker / font picker / aspect ratio picker (Napkin has these; we ship simpler Swap Branding preset only)
- NOT Sync with text (Napkin has this; not applicable to immutable PDF text)
- NOT keeping Sprint 1.5 v4 deck-view + info-graphic-render + linear-layout — they get deleted (per Q "old UX = 纯干")

## 3. Locked design decisions (11 user-confirmed via inline Q&A 2026-06-20)

| # | Decision | User choice |
|---|---|---|
| 1 | UX paradigm | **Napkin-style** (flowing document viewer + selection-driven ⚡ + inline image + side picker) |
| 2 | Paragraph granularity | **User text selection** (no pre-cut paragraphs; default = H1-section split for navigation reference, but lift trigger = arbitrary text range) |
| 3 | Default trigger model | **Pure selection-driven** (no pre-baked ⚡ buttons). Floating ⚡ toolbar appears on text selection |
| 4 | Image + picker layout | **Image inline, pushes text down** + **picker as left-side panel** (closable X). Both elements occupy document flow / left rail |
| 5 | Variant count per ⚡ | **Lock 6** (same as Napkin) — 6 sequential lifts, displayed in picker grid |
| 6 | Picker reopen mechanism | **Image menu → Swap Layout** opens cached 6 variants (free); separate "Regenerate batch" button for fresh batch (extra cost) |
| 7 | MVP image menu scope | **4 items**: Swap Layout / Effects (4 CPU 2D renderers) / Export Visual / Swap Branding (5-8 palette presets) |
| 8 | Old UX disposition | **Kill**: delete `deck-view.js`, `info-graphic-render.js`, `linear-layout.js`. Library page stays, but View opens new document viewer |
| 9 | PDF parser output | **MVP+**: flowing text + page boundaries + **heading detection** (via pdf.js font-size + bold heuristic) |
| 10 | Cost economics display | **Don't show** (same as Napkin — BYOK users self-budget) |
| 11 | 2D-mode SDF text enforcement | **Double safety**: lift system prompt v3.18 → v3.19 with hard forbid section + pipeline runtime sanitize (filter text-3d-* subjects from sceneData) |

## 4. Architecture overview

```
┌────────────────────────────────────────────────────────────────┐
│                       Browser (BYOK)                            │
│                                                                  │
│  ┌───────────────┐    ┌───────────────────┐    ┌─────────────┐ │
│  │ library.js    │ →  │ document-view.js  │ →  │  visual-    │ │
│  │ (deck list +  │    │ (flowing text +   │    │  panel.js   │ │
│  │  import PDF)  │    │  text selection +  │    │ (image+menu │ │
│  └───────────────┘    │  ⚡ floating btn) │    │  +picker)   │ │
│                       └───────────────────┘    └─────────────┘ │
│                                  ↓                              │
│                       ┌───────────────────┐                     │
│                       │ pipeline.js       │                     │
│                       │ (selection text → │                     │
│                       │  6 lifts → store) │                     │
│                       └───────────────────┘                     │
│                                  ↓                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Layer 1: callLiftLLM (opts.mode='2d') + compileScene +   │   │
│  │ createRendererForId('silhouette'|'lines'|'crayon'|'topo')│   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

### Layer 2 changes (Atlas Present app)

**DELETE** (Sprint 1.5 v4 UI artifacts — replaced by Napkin viewer):
- `sdf-js/src/present/deck-view.js`
- `sdf-js/src/present/info-graphic-render.js`
- `sdf-js/src/present/linear-layout.js`
- `sdf-js/scripts/test-info-graphic-render.mjs`
- `sdf-js/scripts/test-linear-layout.mjs`

**REWRITE**:
- `sdf-js/src/present/deck-model.js` → v5 schema (document + visuals[] with text anchors)
- `sdf-js/scripts/test-deck-model.mjs` → v5 schema tests
- `sdf-js/src/present/library-page.js` → View button opens document viewer (not info graphic)
- `sdf-js/src/present/pipeline.js` → per-selection 6-lift queue (not per-section 3-lift)
- `sdf-js/scripts/test-pipeline.mjs` → updated for selection-driven 6-lift
- `sdf-js/examples/present/style.css` → document viewer styles + picker panel + image menu

**NEW**:
- `sdf-js/src/present/pdf-text-extractor.js` (~150 LoC) — SlideData[] → DocumentData (flowing text + page boundaries + heading detection)
- `sdf-js/scripts/test-pdf-text-extractor.mjs` (~15 assertions)
- `sdf-js/src/present/document-view.js` (~250 LoC) — full-text reader + text selection event + floating ⚡ toolbar mount + visual anchoring
- `sdf-js/src/present/visual-panel.js` (~200 LoC) — embedded image render + left-side picker (6 thumbnails) + image context menu (4 items)
- `sdf-js/src/present/floating-toolbar.js` (~80 LoC) — selection-positioned floating ⚡ button
- `sdf-js/src/present/branding-palettes.js` (~50 LoC) — 5-8 curated palette presets (colors + background)
- `sdf-js/scripts/test-pipeline.mjs` updated (new file IS pipeline.js — same path; just rewrite content)

### Layer 1 changes (small, both backward-compat)

- Modify: `sdf-js/examples/compositor/system-prompt-lift-3d.md` v3.18 → v3.19 (add 2D-mode hard forbid section: "When opts.mode === '2d', NEVER emit text-3d-extruded or text-3d-pipe subject types; Atlas Present renders all text via Canvas2D outside the SDF tree")
- Modify: `sdf-js/src/compositor-api.js` `callLiftLLM` — add `opts.mode: '2d' | '3d'` parameter (default '3d' to preserve compositor demo behavior). When `'2d'`, append a "2D mode constraints" addendum to system message
- Modify: `sdf-js/src/compositor-api.js` or `sdf-js/src/present/pipeline.js` — runtime sanitize step that filters `text-3d-extruded` / `text-3d-pipe` subjects from parsed sceneData (defense in depth)

## 5. Schema v5

```js
// localStorage key 'atlas-decks', version 5
// Silent drop v1/v2/v3/v4 (consistent with policy from Sprint 1 v4 + Sprint 1.5)
{
  version: 5,
  decks: [{
    id: string,
    title: string,
    createdAt: number,
    updatedAt: number,
    source: { type: 'pdf', fileName: string, pageCount: number },
    document: {
      flowingText: string,                                   // full PDF text concatenated
      pages: [{ startOffset: number, endOffset: number, pageNumber: number }],
      headings: [{ offset: number, level: 1|2|3, text: string }]
    },
    visuals: [{
      id: string,
      textAnchor: { startOffset: number, endOffset: number, text: string },
      createdAt: number,
      variants: [
        {
          status: 'pending'|'lifting'|'ready'|'error',
          archetype?: string,                                 // from sceneData.name prefix (Sprint 1.5 v3.18 convention)
          sceneData?: object,                                 // SceneData v1, sanitized of text-3d-* types
          liftError?: string
        },
        /* exactly VARIANT_COUNT (6) entries */
      ],
      selectedVariantIndex: number,                           // 0..5, default 0
      activeEffect: 'silhouette'|'lines'|'crayon'|'topo',     // current renderer
      activeBranding: string,                                 // palette preset id (from branding-palettes.js)
    }]
  }]
}
```

Mode-agnostic schema discipline: no 3D vocabulary (camera/yaw/pitch/distance/focal/waypoint/cameraSequence/tween/easing) outside enforcement banner. CI grep continues.

## 6. Data flow (happy path)

```
1. user drag-drops PDF onto library page
   → library-page.handleFileSelected
2. pdfjs parses (existing parsePDFFromBytes from Sprint 1.5)
   → SlideData[]
3. pdf-text-extractor transforms
   → DocumentData { flowingText, pages[], headings[] }
4. deck-model.createDeck + save to localStorage v5
   → no visuals yet
5. user clicks [View] on the deck card
   → router opens document-view (not the old deck-view)
6. document-view renders flowing text (preserving heading styles via Canvas2D + system fonts)
7. user highlights any text range
   → browser selection event
   → floating-toolbar mounts ⚡ button above selection
8. user clicks ⚡
   → pipeline.startVisualLift(deck, textAnchor)
   → callLiftLLM × 6 (serial, opts.mode='2d', identical prompt; divergence by LLM stochasticity)
   → for each variant: parseLiftResponse → runtime sanitize (filter text-3d-*) → store
   → fire onEvent('variant-ready', visualId, variantIndex) progressively
9. visual-panel mounts:
   - inline image (pushes text below) showing variants[0].sceneData rendered via 'silhouette'
   - left-side picker panel showing 6 thumbnails with archetype labels
   - close-X on picker
10. user clicks a different variant in picker
    → selectedVariantIndex update + saveDeck + main image swap
11. user closes picker (X)
    → picker panel hides
12. user clicks the embedded image
    → contextual menu appears (4 items)
    - Swap Layout: re-opens picker with cached 6 variants
    - Effects: opens panel with 4 CPU 2D renderer thumbnails
    - Export Visual: canvas.toDataURL → download PNG (Sprint 1 mechanism)
    - Swap Branding: opens panel with 5-8 palette preset thumbnails
13. user clicks Effects → 'lines' renderer thumbnail
    → activeEffect updated + image re-renders with lines renderer
14. on page reload: deck loaded from localStorage v5, all visuals + selections persist
```

## 7. Sprint 1.5 lessons honored

| Lesson | Honored in Sprint 2 by |
|---|---|
| Mock-only verification failed (Phase 6 browse smoke faked 3 archetypes via mock injection, didn't catch convergence on real lifts) | Phase 8 browse smoke MUST use real Anthropic API + real PDF + actual lift output. No mock-injected archetype variety. |
| SDF text glyphs in 2D mode = negative optimization | Decision 11 double-safety enforcement: prompt forbid + runtime sanitize |
| Variant divergence claim ("3 different archetypes per slide") never validated | Sprint 2 Phase 8 acceptance criterion includes manually verifying ≥2 archetypes across 6 variants on real text-heavy paragraph. If they all converge, that's an acknowledged limit, not pretended progress. |
| Spec under-scoped (didn't catch architecturally-wrong direction until ship) | Pre-write spec exhaustively (this doc) before ANY code. User reviews spec before plan is written. |
| PR body over-claimed ("ships ~75% cost savings", "fixes failure modes") without real data | Sprint 2 PR body lists only verified facts. No "should" / "expected to" language. Speculation goes in non-goals or future-work sections. |

## 8. Sprint 3+ deferrals (locked for future reference)

- **reveal.js Present-mode**: separate sprint, evaluate after Sprint 2 manual L3 (if user wants slide deck output, Sprint 3 adds "Play as Slides" mode that converts document + visuals → reveal.js HTML)
- **P5.js 2D pipeline**: alternative to SDF for 2D rendering. Requires new lift LLM contract (LLM outputs P5.js draw calls vs SceneData). Evaluate after Sprint 2 manual L3 (if SDF 2D renderers still look poor)
- **TOC-driven deck-level archetype**: locked in [[atlas-present-spatial-narrative-thesis]]. Auto-extract TOC → deck-level archetype → fractal nesting
- **3D Play mode**: SDF + spatial narrative + camera tween (Atlas core IP). Where SDF text is allowed (per Decision 11)
- **Image-menu extensions**: individual Colors picker, Fonts picker, Size aspect-ratio picker (Napkin has them; Sprint 2 ships 4-item menu only)
- **Streaming render** (Napkin's UX gem): visual appears progressively as lifts complete, not all-or-nothing
- **Effects with GPU renderers**: BOB GPU / FLY 3D / Blueprint require WebGL context limit handling

## 9. Acceptance criteria

- [ ] `npm test` green (existing 34 minus 2 deleted files = 32; new tests for pdf-text-extractor + v5 deck-model + selection-driven pipeline = +3 files; target 35/35)
- [ ] Mode-agnostic CI grep clean on `deck-model.js` v5 (no `camera/yaw/pitch/distance/focal/waypoint/cameraSequence/tween/easing` outside enforcement banner)
- [ ] Browse smoke verified end-to-end with REAL Anthropic API (not mock):
  - Import a real PDF (Aether AI 13-page or similar)
  - Document viewer renders flowing text with heading styles
  - Highlight a paragraph → floating ⚡ appears
  - Click ⚡ → 6 variants generate (~30-60s wait acceptable) → picker shows 6 thumbnails with archetype labels
  - Click different variant → main image swaps
  - Close picker → click image → contextual menu appears with 4 items
  - Click Effects → 4 renderer thumbnails → swap renderer → image re-renders with new style
  - Click Export → PNG downloads
  - Page reload → deck + visuals + selections persist
  - Console clean (no errors)
- [ ] **Manual archetype-variance check on text-heavy real lift**: select a paragraph, generate 6 variants, manually verify ≥2 different archetypes appear (not all `text-card`). If they all converge → document the result honestly in PR body (don't pretend divergence works)
- [ ] PR body lists ONLY verified facts. No "should" / "expected" claims about LLM behavior

## 10. Hard rules (carried from Sprint 1 v4 + Sprint 1.5)

- **PR workflow** — branch `sprint-2-napkin-doc-viewer`, NEVER push main, NEVER self-merge PR
- **Mode-agnostic schema** — v5 schema cannot contain 3D vocabulary tokens outside enforcement banner. CI grep verified.
- **Atlas IP boundary** — Canvas2D + system fonts for ALL chrome AND ALL document text rendering. SDF only for the lifted visual (silhouette/lines/crayon/topo renderer outputs). NO SDF text in 2D mode (Decision 11 double-safety).
- **No new 3rd-party deps in Sprint 2** — no reveal.js, no P5.js, no chart libraries
- **TDD strict** — Phase 2 / 3 / 4 / 5 unit tests precede implementation
- **Browse smoke uses REAL API** — Phase 8 cannot use mock-injected variants. Phase 8 verifies real LLM behavior end-to-end
- **No overclaim in PR body** — Sprint 1.5 lesson lock-in. Only verified facts.

## 11. Open implementation questions (to resolve during Phase 5 pipeline work)

These are flagged for plan-time decision (not blocking spec approval):

- How exactly is heading detection heuristic tuned? (font-size relative to median? font-name 'Bold' substring? PDF marker if present?)
- What's the floating ⚡ toolbar's exact position? (Above selection center? Below? Adapt to viewport edge?)
- Picker panel width: fixed 280px or %?
- Embedded image default width: full-text-column-width or 60%?
- Selection collapse behavior: clicking elsewhere hides toolbar instantly or 300ms grace?
- Picker scroll behavior if 6+ thumbnails overflow viewport?

These are derived design choices, not architectural. Plan can lock them in via TDD-driven decisions or quick browse smoke iteration.

---

**Spec status:** Locked 2026-06-20. Branch `sprint-2-napkin-doc-viewer` created. Awaiting user review of this spec before invoking writing-plans skill to produce the implementation plan.
