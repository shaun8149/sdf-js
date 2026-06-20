# Atlas Present Sprint 2 Implementation Plan — Napkin-Style Document Viewer + Inline Visual Generation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pivot Atlas Present from Sprint 1.5's batch-PDF-to-deck-info-graphic UX to a Napkin-style flowing document viewer where users highlight any text and click ⚡ to generate 6 inline visual variants with a side-panel picker and an image context menu (Swap Layout / Effects / Export / Swap Branding).

**Architecture:** Layer 2 (Atlas Present app) gets new document-viewer UI + selection-driven pipeline + v5 schema. Layer 1 (compositor-api) gets minor change to enforce 2D-mode SDF-text forbidding via prompt opts + runtime sanitize. 4 existing CPU 2D renderers (silhouette/Lines/Crayon/Topo) get exposed via Effects swap. Schema v4 → v5 silent drop.

**Tech Stack:** ESM Node 25, vanilla browser JS, Canvas2D + system fonts (no SDF text in 2D), localStorage v5, existing pdf.js parser, existing callLiftLLM via fetch. **NO new 3rd-party dependencies** (no reveal.js, no P5.js, no chart libs — those are Sprint 3+ candidates per spec §8).

**Branch:** `sprint-2-napkin-doc-viewer` (already created from main `9cd7317`, spec committed at `1332bd6`).

**Spec:** [`docs/superpowers/specs/2026-06-20-atlas-present-sprint-2-napkin-paragraph-design.md`](../specs/2026-06-20-atlas-present-sprint-2-napkin-paragraph-design.md) (246 lines, 11 locked design decisions).

---

## File structure

### NEW (Sprint 2)

| Path | LoC est. | Responsibility |
|---|---|---|
| `sdf-js/src/present/pdf-text-extractor.js` | ~150 | Transform parser's `SlideData[]` → `DocumentData { flowingText, pages[], headings[] }`. Heading detection via fontSize median + factor heuristic. |
| `sdf-js/src/present/floating-toolbar.js` | ~80 | Selection-positioned floating ⚡ button. Listens for browser `selectionchange` event; positions toolbar above selection; emits `onTrigger(textAnchor)` when ⚡ clicked. |
| `sdf-js/src/present/visual-panel.js` | ~200 | One embedded visual = one panel. Manages: main canvas render, side picker (6 thumbnails), image context menu (4 items), Swap Layout / Effects / Export / Swap Branding sub-panels. |
| `sdf-js/src/present/branding-palettes.js` | ~60 | Static export of 5-8 curated palette presets `[{id, label, bg, elements: [colors]}]`. Used by Swap Branding sub-panel. |
| `sdf-js/src/present/document-view.js` | ~250 | Mount document viewer at deck URL. Renders DocumentData as flowing text with heading styles. Wires `floating-toolbar` to selection events. Manages list of mounted `visual-panel` instances anchored to text offsets. |
| `sdf-js/scripts/test-pdf-text-extractor.mjs` | ~120 | ~15 assertions covering: empty slides, single-page, heading detection (large vs body text), multi-page with offset continuity. |

### REWRITE (Sprint 1.5 v4 → Sprint 2 v5)

| Path | Action |
|---|---|
| `sdf-js/src/present/deck-model.js` | REWRITE for v5 schema (`document` + `visuals[]` with text anchors; `VARIANT_COUNT` 3→6; new functions: `setDocument`, `addVisual`, `updateVisualVariantStatus`, `selectVisualVariant`, `getSelectedVisualVariant`, `setActiveEffect`, `setActiveBranding`, `removeVisual`; remove section-based functions: `addPendingSections`, `sectionStatusCounts`, `updateVariantStatus`, `selectVariant`, `getSelectedVariant`). |
| `sdf-js/scripts/test-deck-model.mjs` | REWRITE for v5 schema (~50 assertions). |
| `sdf-js/src/present/pipeline.js` | REWRITE for per-selection 6-lift (not per-section 3-lift). New API: `createVisualPipeline(deck, visualId, apiKey, deps, opts)`. |
| `sdf-js/scripts/test-pipeline.mjs` | REWRITE for visual-pipeline (~20 assertions, mock + extractArchetype). |
| `sdf-js/src/present/library-page.js` | View button now routes to document viewer (path `?deck=<id>` opens document-view, not deck-view). Progress label drops "Lifting N/13" since lifting is now user-triggered per-selection, not batch. Card shows "N visuals" count. |
| `sdf-js/examples/present/index.html` | Router updated: `?deck=<id>` opens `document-view.js mountDocumentView` (was `deck-view.js mountDeckView`). |
| `sdf-js/examples/present/style.css` | REWRITE: drop info-graphic styles + variant picker styles from Sprint 1.5; add document viewer + floating toolbar + visual panel + side picker + image context menu styles. |

### MODIFY (Layer 1 + Layer 2 small touches)

| Path | Change |
|---|---|
| `sdf-js/src/compositor-api.js` | `callLiftLLM(originalPrompt, code2d, apiKey, opts = {})` extends `opts` with `mode: '2d'\|'3d'` (default `'3d'` to preserve compositor demo). When `'2d'`, append "2D mode constraints" addendum to system prompt. Also add `sanitize2dSceneData(sceneData)` export that filters out `text-3d-extruded` / `text-3d-pipe` subjects (runtime defense in depth). |
| `sdf-js/scripts/test-compositor-api.mjs` | Add ~5 assertions for opts.mode behavior + sanitize2dSceneData. |
| `sdf-js/examples/compositor/system-prompt-lift-3d.md` | Bump v3.18 → v3.19. Add new section: "## 2D-mode constraints" listing that text-3d-extruded / text-3d-pipe MUST NOT appear when caller indicates 2D mode. Update version description. |
| `scripts/run-tests.mjs` | Add new test entry for `test-pdf-text-extractor.mjs` (present category). Remove entries for `test-info-graphic-render.mjs` + `test-linear-layout.mjs`. |

### DELETE (Sprint 1.5 v4 UI killed)

| Path | Reason |
|---|---|
| `sdf-js/src/present/deck-view.js` | Sprint 1.5 info graphic deck-view UI — replaced by `document-view.js` |
| `sdf-js/src/present/info-graphic-render.js` | Sprint 1.5 chrome+silhouette compositor — visual rendering now per-visual inside `visual-panel.js` |
| `sdf-js/src/present/linear-layout.js` | Sprint 1.5 deck-level region computation — no more deck layout (visuals anchor to text offsets) |
| `sdf-js/scripts/test-info-graphic-render.mjs` | Tests for deleted file |
| `sdf-js/scripts/test-linear-layout.mjs` | Tests for deleted file |

### KEEP unchanged

| Path | Why |
|---|---|
| `sdf-js/src/present/waypoint-tween.js` | Sprint 1 v4 deferred (banner-marked). Sprint 3 3D Play will use. |
| `sdf-js/scripts/test-waypoint-tween.mjs` | Tests for waypoint-tween still pass. |
| `sdf-js/src/parser/*` | pdf.js parser API stable (parsePDFFromBytes unchanged). |

### Test inventory

Starting state: `34/34 test files passed`.

Sprint 2 changes:
- DELETE `test-info-graphic-render.mjs` (-1)
- DELETE `test-linear-layout.mjs` (-1)
- REWRITE `test-deck-model.mjs` (same path, content changes)
- REWRITE `test-pipeline.mjs` (same path, content changes)
- ADD `test-pdf-text-extractor.mjs` (+1)
- MODIFY `test-compositor-api.mjs` (same path)

Net: 34 - 2 + 1 = **33 test files** by end of Sprint 2.

---

## Phase 0 — Pre-flight verification

Confirm clean branch, correct base, baseline test count.

### Task 0.1: Verify pre-conditions

**Files:** none modified

- [ ] **Step 1: Confirm on correct branch**

Run:
```bash
cd /Users/hexiaoyang/Documents/sdf-main
git branch --show-current
git status -s
```

Expected:
- Branch: `sprint-2-napkin-doc-viewer`
- Status: clean

If on different branch: `git checkout sprint-2-napkin-doc-viewer` (already exists, spec committed at 1332bd6).
If dirty: investigate, do NOT proceed.

- [ ] **Step 2: Verify npm test baseline**

Run: `npm test 2>&1 | tail -5`

Expected: `34/34 test files passed`. If fewer, investigate before proceeding.

- [ ] **Step 3: Verify spec exists on disk + committed**

```bash
ls -la docs/superpowers/specs/2026-06-20-atlas-present-sprint-2-napkin-paragraph-design.md
git log --oneline -3
```

Expected: file exists; latest commit shows Sprint 2 spec commit.

- [ ] **Step 4: Commit plan to branch if not already**

If this plan file (`docs/superpowers/plans/2026-06-20-atlas-present-sprint-2-plan.md`) is not yet committed:

```bash
git add docs/superpowers/plans/2026-06-20-atlas-present-sprint-2-plan.md
git commit -m "Sprint 2 plan: 10 phases / Napkin document viewer + visual generation

Detailed implementation plan for Sprint 2 spec lock. 10 phases (Phase 0
pre-flight + 9 implementation phases). Honors all 5 Sprint 1.5 lessons:
no mock-only verification, SDF text forbidden in 2D, variant divergence
manually verified, PR body verified facts only, frequent TDD commits.

Spec: docs/superpowers/specs/2026-06-20-atlas-present-sprint-2-napkin-paragraph-design.md
Plan: docs/superpowers/plans/2026-06-20-atlas-present-sprint-2-plan.md"
```

(If plan already committed via writing-plans skill, skip this step.)

---

## Phase 1 — Delete Sprint 1.5 UI (kill old before building new)

Per spec Decision 8 (old UX = 纯干). Delete files before introducing new ones so no temporary "two systems coexist" state.

### Task 1.1: Delete 3 source files + 2 test files + update run-tests.mjs

**Files:**
- DELETE: `sdf-js/src/present/deck-view.js`
- DELETE: `sdf-js/src/present/info-graphic-render.js`
- DELETE: `sdf-js/src/present/linear-layout.js`
- DELETE: `sdf-js/scripts/test-info-graphic-render.mjs`
- DELETE: `sdf-js/scripts/test-linear-layout.mjs`
- Modify: `scripts/run-tests.mjs` (remove 2 entries)

- [ ] **Step 1: Delete 5 files**

```bash
git rm sdf-js/src/present/deck-view.js
git rm sdf-js/src/present/info-graphic-render.js
git rm sdf-js/src/present/linear-layout.js
git rm sdf-js/scripts/test-info-graphic-render.mjs
git rm sdf-js/scripts/test-linear-layout.mjs
```

Expected: 5 deletions staged.

- [ ] **Step 2: Remove the two test entries from `scripts/run-tests.mjs`**

Find these two lines in `scripts/run-tests.mjs`:

```js
  { category: 'present', file: 'sdf-js/scripts/test-linear-layout.mjs' },
  { category: 'present', file: 'sdf-js/scripts/test-info-graphic-render.mjs' },
```

Delete BOTH lines. The remaining present-category entries (`test-deck-model.mjs`, `test-waypoint-tween.mjs`, `test-pipeline.mjs`) stay for now (they'll be rewritten in Phase 3 + Phase 5).

- [ ] **Step 3: Verify npm test now passes with reduced count**

Run: `npm test 2>&1 | tail -5`

Expected: `32/32 test files passed` (was 34, removed 2). Tests for deleted files no longer registered.

If still 34/34: did you delete the test entries from run-tests.mjs? Re-check Step 2.
If less than 32: a downstream test had imports from one of the deleted files. Search:
```bash
grep -rn "info-graphic-render\|linear-layout" sdf-js/ scripts/ 2>/dev/null | grep -v node_modules
```
and fix the import (likely the test that uses it).

- [ ] **Step 4: Commit Phase 1**

```bash
git add scripts/run-tests.mjs
git commit -m "Sprint 2 Phase 1: delete Sprint 1.5 info graphic UI

DELETE Sprint 1.5 v4 UI (replaced by Napkin document viewer in Sprint 2):
- src/present/deck-view.js (info graphic deck view)
- src/present/info-graphic-render.js (silhouette + chrome compositor)
- src/present/linear-layout.js (deck-level region layout)
- scripts/test-info-graphic-render.mjs
- scripts/test-linear-layout.mjs

Remove the two test entries from scripts/run-tests.mjs.

After Phase 1: HTML router still references deleted deck-view.js (broken).
Document viewer mount will be wired in Phase 6 + Phase 9. Branch is
intentionally non-working between Phase 1 and Phase 6.

npm test 32/32 (down from 34, the 2 deleted test files removed)."
```

---

## Phase 2 — `pdf-text-extractor.js` (SlideData → DocumentData)

Transform existing parser output into flowing document representation with heading detection.

### Task 2.1: Create test file + skeleton + register in run-tests

**Files:**
- Create: `sdf-js/src/present/pdf-text-extractor.js` (skeleton)
- Create: `sdf-js/scripts/test-pdf-text-extractor.mjs` (skeleton + 1 baseline test)
- Modify: `scripts/run-tests.mjs` (add 1 entry)

- [ ] **Step 1: Create skeleton `pdf-text-extractor.js`**

Write `sdf-js/src/present/pdf-text-extractor.js`:

```js
// =============================================================================
// pdf-text-extractor.js — Atlas Present Sprint 2: SlideData[] → DocumentData
// -----------------------------------------------------------------------------
// Transforms the existing PDF parser output (SlideData[]) into a flowing
// document representation suitable for Napkin-style selection-driven UX.
//
// Output schema:
//   DocumentData {
//     flowingText: string,            // concatenated text across all pages
//     pages: [{ startOffset, endOffset, pageNumber }],
//     headings: [{ offset, level, text }]
//   }
//
// Heading detection: font size relative to the document's median body text
// size. Slide.title (already detected by parser as "largest top-area text")
// is always treated as a heading. Among body elements, ones with fontSize
// >= 1.4 × median are also treated as headings; level derived from ratio.
//
// Spec: docs/superpowers/specs/2026-06-20-atlas-present-sprint-2-napkin-paragraph-design.md §3 #9, §5
// =============================================================================

/**
 * @typedef {object} PageBoundary
 * @property {number} startOffset
 * @property {number} endOffset
 * @property {number} pageNumber  1-based page number for user-facing display
 */

/**
 * @typedef {object} Heading
 * @property {number} offset
 * @property {1|2|3} level
 * @property {string} text
 */

/**
 * @typedef {object} DocumentData
 * @property {string} flowingText
 * @property {PageBoundary[]} pages
 * @property {Heading[]} headings
 */

/**
 * Transform SlideData[] (from parsePDFFromBytes) into DocumentData.
 *
 * @param {Array<object>} slides — SlideData[]
 * @returns {DocumentData}
 */
export function extractDocumentData(slides) {
  // Implementation in Task 2.2-2.4
  return { flowingText: '', pages: [], headings: [] };
}
```

- [ ] **Step 2: Create test file `test-pdf-text-extractor.mjs` with 1 baseline test**

Write `sdf-js/scripts/test-pdf-text-extractor.mjs`:

```js
// =============================================================================
// test-pdf-text-extractor.mjs — L1 unit tests for Atlas Present Sprint 2
//                                pdf-text-extractor.js
// =============================================================================

import { extractDocumentData } from '../src/present/pdf-text-extractor.js';

let pass = 0,
  fail = 0;
function ok(cond, name) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`);
  }
}

console.log('=== pdf-text-extractor smoke test ===\n');

// Baseline: empty input
{
  const doc = extractDocumentData([]);
  ok(typeof doc === 'object' && doc !== null, 'empty input returns object');
  ok(doc.flowingText === '', 'empty input: flowingText = ""');
  ok(Array.isArray(doc.pages) && doc.pages.length === 0, 'empty input: pages = []');
  ok(Array.isArray(doc.headings) && doc.headings.length === 0, 'empty input: headings = []');
}

// More tests added in Tasks 2.2-2.4

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
```

- [ ] **Step 3: Register test in `scripts/run-tests.mjs`**

Find the line in `scripts/run-tests.mjs`:

```js
  { category: 'present', file: 'sdf-js/scripts/test-deck-model.mjs' },
```

Add IMMEDIATELY BEFORE:

```js
  { category: 'present', file: 'sdf-js/scripts/test-pdf-text-extractor.mjs' },
```

- [ ] **Step 4: Verify**

```bash
node --check sdf-js/src/present/pdf-text-extractor.js && echo "syntax OK"
node sdf-js/scripts/test-pdf-text-extractor.mjs
npm test 2>&1 | tail -5
```

Expected: `syntax OK`; 4 ✓ baseline tests pass; `npm test 33/33` (was 32, added 1).

- [ ] **Step 5: Commit Task 2.1**

```bash
git add sdf-js/src/present/pdf-text-extractor.js sdf-js/scripts/test-pdf-text-extractor.mjs scripts/run-tests.mjs
git commit -m "Sprint 2 Phase 2.1: pdf-text-extractor skeleton + baseline test

NEW: src/present/pdf-text-extractor.js (skeleton)
NEW: scripts/test-pdf-text-extractor.mjs (4 baseline assertions for empty input)
MODIFY: scripts/run-tests.mjs registers new test under 'present' category

extractDocumentData() will gain real impl in Tasks 2.2-2.4 (TDD).

npm test 33/33 (1 added)."
```

### Task 2.2: TDD `extractDocumentData` for single-page input (flowing text + page boundary)

**Files:**
- Modify: `sdf-js/src/present/pdf-text-extractor.js` (implement basic version)
- Modify: `sdf-js/scripts/test-pdf-text-extractor.mjs` (append 5 tests)

- [ ] **Step 1: Append failing tests**

In `sdf-js/scripts/test-pdf-text-extractor.mjs`, BEFORE the final `process.exit(...)` line, append:

```js
// Single page — flowing text + page boundary
{
  const slides = [
    {
      index: 0,
      sourceFormat: 'pdf',
      title: 'Introduction',
      body: [
        { kind: 'paragraph', text: 'The agent explores the environment.', level: 0, bbox: { x: 0, y: 0, w: 0, h: 0 }, fontSize: 12, fontFamily: null },
        { kind: 'paragraph', text: 'A predictive model may entangle features.', level: 0, bbox: { x: 0, y: 0, w: 0, h: 0 }, fontSize: 12, fontFamily: null },
      ],
      visuals: [],
      layout: 'title-content',
      theme: {},
      notes: null,
      pageSize: { width: 612, height: 792 },
      screenshot: null,
      classified: null,
    },
  ];
  const doc = extractDocumentData(slides);
  ok(doc.flowingText.includes('Introduction'), 'single page: flowingText includes title');
  ok(doc.flowingText.includes('The agent explores the environment.'), 'single page: includes body[0]');
  ok(doc.flowingText.includes('A predictive model may entangle features.'), 'single page: includes body[1]');

  ok(doc.pages.length === 1, 'single page: pages.length = 1');
  ok(doc.pages[0].pageNumber === 1, 'single page: pageNumber = 1 (1-based)');
  ok(doc.pages[0].startOffset === 0, 'single page: startOffset = 0');
  ok(
    doc.pages[0].endOffset === doc.flowingText.length,
    `single page: endOffset = full text length (got ${doc.pages[0].endOffset}, text len ${doc.flowingText.length})`,
  );
}
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
node sdf-js/scripts/test-pdf-text-extractor.mjs
```

Expected: at least the first new assertion fails because `flowingText` is empty in skeleton.

- [ ] **Step 3: Implement `extractDocumentData` for single-page case**

In `sdf-js/src/present/pdf-text-extractor.js`, replace the placeholder body of `extractDocumentData` with:

```js
export function extractDocumentData(slides) {
  if (!Array.isArray(slides) || slides.length === 0) {
    return { flowingText: '', pages: [], headings: [] };
  }

  const pages = [];
  const headings = [];
  let flowingText = '';

  for (const slide of slides) {
    const startOffset = flowingText.length;

    // Append title (treated as heading) if present
    if (slide.title && typeof slide.title === 'string' && slide.title.length > 0) {
      flowingText += slide.title;
      flowingText += '\n';
    }

    // Append body elements separated by newlines
    if (Array.isArray(slide.body)) {
      for (const element of slide.body) {
        if (element && typeof element.text === 'string' && element.text.length > 0) {
          flowingText += element.text;
          flowingText += '\n';
        }
      }
    }

    const endOffset = flowingText.length;
    pages.push({
      pageNumber: (slide.index ?? pages.length) + 1, // 1-based for user display
      startOffset,
      endOffset,
    });
  }

  return { flowingText, pages, headings };
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
node sdf-js/scripts/test-pdf-text-extractor.mjs
```

Expected: all 11 assertions pass (4 baseline + 7 new).

- [ ] **Step 5: Commit Task 2.2**

```bash
git add sdf-js/src/present/pdf-text-extractor.js sdf-js/scripts/test-pdf-text-extractor.mjs
git commit -m "Sprint 2 Phase 2.2: extractDocumentData single-page flowing text + page boundary

extractDocumentData() now produces:
- flowingText: title + body element text concatenated with newlines
- pages: 1-based pageNumber + char-offset boundaries

7 new TDD assertions. Headings still not detected (Task 2.3)."
```

### Task 2.3: TDD multi-page input + offset continuity

- [ ] **Step 1: Append failing tests**

```js
// Multi-page — offset continuity
{
  const slides = [
    {
      index: 0, sourceFormat: 'pdf', title: 'Page A',
      body: [{ kind: 'paragraph', text: 'aaa', level: 0, bbox: {x:0,y:0,w:0,h:0}, fontSize: 12, fontFamily: null }],
      visuals: [], layout: 'title-content', theme: {}, notes: null,
      pageSize: {width:612, height:792}, screenshot: null, classified: null,
    },
    {
      index: 1, sourceFormat: 'pdf', title: 'Page B',
      body: [{ kind: 'paragraph', text: 'bbb', level: 0, bbox: {x:0,y:0,w:0,h:0}, fontSize: 12, fontFamily: null }],
      visuals: [], layout: 'title-content', theme: {}, notes: null,
      pageSize: {width:612, height:792}, screenshot: null, classified: null,
    },
    {
      index: 2, sourceFormat: 'pdf', title: 'Page C',
      body: [{ kind: 'paragraph', text: 'ccc', level: 0, bbox: {x:0,y:0,w:0,h:0}, fontSize: 12, fontFamily: null }],
      visuals: [], layout: 'title-content', theme: {}, notes: null,
      pageSize: {width:612, height:792}, screenshot: null, classified: null,
    },
  ];
  const doc = extractDocumentData(slides);

  ok(doc.pages.length === 3, 'multi-page: 3 pages');
  ok(doc.pages[0].pageNumber === 1, 'multi-page: page[0].pageNumber = 1');
  ok(doc.pages[1].pageNumber === 2, 'multi-page: page[1].pageNumber = 2');
  ok(doc.pages[2].pageNumber === 3, 'multi-page: page[2].pageNumber = 3');

  ok(doc.pages[0].startOffset === 0, 'multi-page: page[0].startOffset = 0');
  ok(doc.pages[0].endOffset === doc.pages[1].startOffset, 'multi-page: page[0].endOffset == page[1].startOffset (continuity)');
  ok(doc.pages[1].endOffset === doc.pages[2].startOffset, 'multi-page: page[1].endOffset == page[2].startOffset');
  ok(doc.pages[2].endOffset === doc.flowingText.length, 'multi-page: last endOffset = full text length');

  // Slicing by page boundaries should reproduce the page text
  const page1Text = doc.flowingText.slice(doc.pages[0].startOffset, doc.pages[0].endOffset);
  ok(page1Text.includes('Page A') && page1Text.includes('aaa'), 'multi-page: slice page[0] = original page A content');
  const page2Text = doc.flowingText.slice(doc.pages[1].startOffset, doc.pages[1].endOffset);
  ok(page2Text.includes('Page B') && page2Text.includes('bbb'), 'multi-page: slice page[1] = original page B content');
}
```

- [ ] **Step 2: Run — expect PASS** (multi-page handling already in Task 2.2 impl)

```bash
node sdf-js/scripts/test-pdf-text-extractor.mjs
```

Expected: all assertions pass (the loop in Task 2.2 already handles N slides). If any fail, debug — likely offset arithmetic.

- [ ] **Step 3: Commit Task 2.3**

```bash
git add sdf-js/scripts/test-pdf-text-extractor.mjs
git commit -m "Sprint 2 Phase 2.3: extractDocumentData multi-page offset continuity tests

10 new assertions verifying:
- N=3 page handling, 1-based pageNumber sequence
- Offset continuity (page[i].endOffset == page[i+1].startOffset)
- Last endOffset = full text length
- Slicing by page boundaries reproduces original page content"
```

### Task 2.4: TDD heading detection (font-size + title heuristic)

- [ ] **Step 1: Append failing tests**

```js
// Heading detection — slide.title is always a heading
{
  const slides = [
    {
      index: 0, sourceFormat: 'pdf', title: 'Big Heading',
      body: [{ kind: 'paragraph', text: 'normal body text here', level: 0, bbox: {x:0,y:0,w:0,h:0}, fontSize: 12, fontFamily: null }],
      visuals: [], layout: 'title-content', theme: {}, notes: null,
      pageSize: {width:612, height:792}, screenshot: null, classified: null,
    },
  ];
  const doc = extractDocumentData(slides);

  ok(doc.headings.length >= 1, 'heading from title: at least 1 heading detected');
  const titleHeading = doc.headings.find((h) => h.text === 'Big Heading');
  ok(titleHeading !== undefined, 'heading from title: text "Big Heading" found');
  ok(titleHeading.level === 1, `heading from title: level = 1 (got ${titleHeading?.level})`);
  ok(typeof titleHeading.offset === 'number' && titleHeading.offset === 0, `heading from title: offset = 0 (got ${titleHeading?.offset})`);
}

// Heading detection — large body element promoted to heading
{
  const slides = [
    {
      index: 0, sourceFormat: 'pdf', title: null,
      body: [
        { kind: 'paragraph', text: 'body text small', level: 0, bbox: {x:0,y:0,w:0,h:0}, fontSize: 10, fontFamily: null },
        { kind: 'paragraph', text: 'LARGE HEADING TEXT', level: 0, bbox: {x:0,y:0,w:0,h:0}, fontSize: 20, fontFamily: null },
        { kind: 'paragraph', text: 'body text small again', level: 0, bbox: {x:0,y:0,w:0,h:0}, fontSize: 10, fontFamily: null },
      ],
      visuals: [], layout: 'title-content', theme: {}, notes: null,
      pageSize: {width:612, height:792}, screenshot: null, classified: null,
    },
  ];
  const doc = extractDocumentData(slides);
  ok(doc.headings.length === 1, `large-text heading detected: headings.length = 1 (got ${doc.headings.length})`);
  ok(doc.headings[0].text === 'LARGE HEADING TEXT', `large-text heading: text matches (got "${doc.headings[0].text}")`);
  ok(doc.headings[0].level >= 1 && doc.headings[0].level <= 3, `large-text heading: level in 1..3 (got ${doc.headings[0].level})`);
}

// Heading detection — no false positives on uniform body text
{
  const slides = [
    {
      index: 0, sourceFormat: 'pdf', title: null,
      body: [
        { kind: 'paragraph', text: 'a', level: 0, bbox: {x:0,y:0,w:0,h:0}, fontSize: 12, fontFamily: null },
        { kind: 'paragraph', text: 'b', level: 0, bbox: {x:0,y:0,w:0,h:0}, fontSize: 12, fontFamily: null },
        { kind: 'paragraph', text: 'c', level: 0, bbox: {x:0,y:0,w:0,h:0}, fontSize: 12, fontFamily: null },
      ],
      visuals: [], layout: 'title-content', theme: {}, notes: null,
      pageSize: {width:612, height:792}, screenshot: null, classified: null,
    },
  ];
  const doc = extractDocumentData(slides);
  ok(doc.headings.length === 0, `uniform body: no headings detected (got ${doc.headings.length})`);
}

// Heading detection — heading offset points to the heading text in flowingText
{
  const slides = [
    {
      index: 0, sourceFormat: 'pdf', title: 'Title One',
      body: [
        { kind: 'paragraph', text: 'body1', level: 0, bbox: {x:0,y:0,w:0,h:0}, fontSize: 12, fontFamily: null },
      ],
      visuals: [], layout: 'title-content', theme: {}, notes: null,
      pageSize: {width:612, height:792}, screenshot: null, classified: null,
    },
    {
      index: 1, sourceFormat: 'pdf', title: 'Title Two',
      body: [
        { kind: 'paragraph', text: 'body2', level: 0, bbox: {x:0,y:0,w:0,h:0}, fontSize: 12, fontFamily: null },
      ],
      visuals: [], layout: 'title-content', theme: {}, notes: null,
      pageSize: {width:612, height:792}, screenshot: null, classified: null,
    },
  ];
  const doc = extractDocumentData(slides);
  ok(doc.headings.length === 2, `2 titles: 2 headings (got ${doc.headings.length})`);
  // Verify offsets correctly point to the heading text in flowingText
  const sliceAtOffset0 = doc.flowingText.slice(doc.headings[0].offset, doc.headings[0].offset + 'Title One'.length);
  ok(sliceAtOffset0 === 'Title One', `heading[0] offset slice = "Title One" (got "${sliceAtOffset0}")`);
  const sliceAtOffset1 = doc.flowingText.slice(doc.headings[1].offset, doc.headings[1].offset + 'Title Two'.length);
  ok(sliceAtOffset1 === 'Title Two', `heading[1] offset slice = "Title Two" (got "${sliceAtOffset1}")`);
}
```

- [ ] **Step 2: Run — expect FAIL** (headings still always empty)

```bash
node sdf-js/scripts/test-pdf-text-extractor.mjs
```

Expected: heading-related assertions fail because `headings` is currently always empty in impl.

- [ ] **Step 3: Implement heading detection**

In `sdf-js/src/present/pdf-text-extractor.js`, REPLACE the body of `extractDocumentData` with a version that detects headings:

```js
export function extractDocumentData(slides) {
  if (!Array.isArray(slides) || slides.length === 0) {
    return { flowingText: '', pages: [], headings: [] };
  }

  // Compute median body fontSize across all slides (for heading detection)
  const bodyFontSizes = [];
  for (const slide of slides) {
    if (Array.isArray(slide.body)) {
      for (const element of slide.body) {
        if (typeof element?.fontSize === 'number' && element.fontSize > 0) {
          bodyFontSizes.push(element.fontSize);
        }
      }
    }
  }
  const medianBodySize = computeMedian(bodyFontSizes) || 12;
  const HEADING_FACTOR = 1.4; // body element >= 1.4 × median is a heading

  const pages = [];
  const headings = [];
  let flowingText = '';

  for (const slide of slides) {
    const startOffset = flowingText.length;

    // Slide title → always a level-1 heading
    if (slide.title && typeof slide.title === 'string' && slide.title.length > 0) {
      headings.push({ offset: flowingText.length, level: 1, text: slide.title });
      flowingText += slide.title;
      flowingText += '\n';
    }

    // Body elements
    if (Array.isArray(slide.body)) {
      for (const element of slide.body) {
        if (!element || typeof element.text !== 'string' || element.text.length === 0) continue;

        // Large body element → heading (level 2 or 3 based on size ratio)
        if (typeof element.fontSize === 'number' && element.fontSize >= medianBodySize * HEADING_FACTOR) {
          const ratio = element.fontSize / medianBodySize;
          const level = ratio >= 2.0 ? 2 : 3;
          headings.push({ offset: flowingText.length, level, text: element.text });
        }

        flowingText += element.text;
        flowingText += '\n';
      }
    }

    const endOffset = flowingText.length;
    pages.push({
      pageNumber: (slide.index ?? pages.length) + 1,
      startOffset,
      endOffset,
    });
  }

  return { flowingText, pages, headings };
}

function computeMedian(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
node sdf-js/scripts/test-pdf-text-extractor.mjs
```

Expected: all assertions pass (4 baseline + 7 single-page + 10 multi-page + 12 heading = 33 total).

- [ ] **Step 5: Run full npm test**

```bash
npm test 2>&1 | tail -5
```

Expected: `33/33 test files passed`.

- [ ] **Step 6: Commit Task 2.4**

```bash
git add sdf-js/src/present/pdf-text-extractor.js sdf-js/scripts/test-pdf-text-extractor.mjs
git commit -m "Sprint 2 Phase 2.4: extractDocumentData heading detection (font-size heuristic)

Heading detection rules:
- slide.title (already detected by pdf.js parser as 'largest top-area text')
  → always level-1 heading
- Body element with fontSize >= 1.4 × median body fontSize → heading
  (level 2 if ratio >= 2.0, else level 3)
- Heading.offset points to the heading text in flowingText (verified by
  slice equality test)

12 new TDD assertions covering title-heading, large-body-heading, no
false positives on uniform body, multi-page heading offset accuracy.

~33 total assertions in test-pdf-text-extractor.mjs."
```

---

## Phase 3 — deck-model.js v5 schema REWRITE

Single big REWRITE (per Sprint 1 v4 / Sprint 1.5 pattern when schema fundamentally changes).

### Task 3.1: REWRITE deck-model.js to v5 schema

**Files:**
- REWRITE: `sdf-js/src/present/deck-model.js`
- REWRITE: `sdf-js/scripts/test-deck-model.mjs`

- [ ] **Step 1: Read current deck-model.js to understand exports**

```bash
wc -l sdf-js/src/present/deck-model.js
grep -nE "^export" sdf-js/src/present/deck-model.js
```

Note the current export list (v4 schema). The rewrite changes:

- `STORAGE_VERSION` 4 → 5
- `VARIANT_COUNT` 3 → 6
- REMOVE section-based exports: `addPendingSections`, `sectionStatusCounts`, `updateVariantStatus`, `selectVariant`, `getSelectedVariant`
- ADD visual-based exports: `setDocument`, `addVisual`, `removeVisual`, `updateVisualVariantStatus`, `selectVisualVariant`, `getSelectedVisualVariant`, `setActiveEffect`, `setActiveBranding`
- KEEP unchanged: `createDeck`, `listDecks`, `saveDeckToStorage`, `loadDeckFromStorage`, `deleteDeckFromStorage`, `renameDeck`, `duplicateDeck`, `migrateDecksStorage`, `deriveStatus` (still useful for derived visual status)

- [ ] **Step 2: Use Write tool to fully replace `sdf-js/src/present/deck-model.js` with v5 content**

```js
// =============================================================================
// deck-model.js — Atlas Present Layer 2 data model (Sprint 2 v5 / Napkin)
// -----------------------------------------------------------------------------
// Pure JS / no DOM. Document-anchored schema: each deck has ONE document
// (flowing text + page boundaries + headings) and zero-or-more visuals
// anchored to text-range offsets. NO sections, NO regions, NO 3D vocab.
//
// localStorage key: 'atlas-decks', version 5
//   v1 (PPT-mode) + v2 (Canvas Mode) + v3 (Sprint 1 v4) + v4 (Sprint 1.5)
//   ALL silent drop on first v5 load.
//
// HARD RULE (per memory hard rule 5 + spec Rule 4):
//   This file MUST NOT contain 3D vocabulary tokens — namely: camera, yaw,
//   pitch, distance, focal, waypoint, cameraSequence, tween, easing. CI grep
//   verifies. Use mode-agnostic words: visual, textAnchor, offset, archetype,
//   variant, palette.
//
// Spec: docs/superpowers/specs/2026-06-20-atlas-present-sprint-2-napkin-paragraph-design.md
// =============================================================================

/**
 * @typedef {object} DeckSource
 * @property {'pdf'} type
 * @property {string} fileName
 * @property {number} pageCount
 */

/**
 * @typedef {object} PageBoundary
 * @property {number} startOffset
 * @property {number} endOffset
 * @property {number} pageNumber
 */

/**
 * @typedef {object} Heading
 * @property {number} offset
 * @property {1|2|3} level
 * @property {string} text
 */

/**
 * @typedef {object} DocumentData
 * @property {string} flowingText
 * @property {PageBoundary[]} pages
 * @property {Heading[]} headings
 */

/**
 * @typedef {object} TextAnchor
 * @property {number} startOffset
 * @property {number} endOffset
 * @property {string} text
 */

/**
 * @typedef {object} VisualVariant
 * @property {'pending'|'lifting'|'ready'|'error'} status
 * @property {string} [archetype]
 * @property {object} [sceneData]
 * @property {string} [liftError]
 */

/**
 * @typedef {object} Visual
 * @property {string} id
 * @property {TextAnchor} textAnchor
 * @property {number} createdAt
 * @property {'pending'|'lifting'|'ready'|'error'} status — derived from variants
 * @property {VisualVariant[]} variants — exactly VARIANT_COUNT (6) entries
 * @property {number} selectedVariantIndex
 * @property {string} activeEffect — renderer id from ACTIVE_EFFECTS
 * @property {string} activeBranding — palette preset id (from branding-palettes.js)
 */

/**
 * @typedef {object} Deck
 * @property {string} id
 * @property {string} title
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {DeckSource} source
 * @property {DocumentData|null} document — null until setDocument is called
 * @property {Visual[]} visuals
 */

export const DECKS_STORAGE_KEY = 'atlas-decks';
export const STORAGE_VERSION = 5;
export const VARIANT_COUNT = 6;
export const ACTIVE_EFFECTS = ['silhouette', 'lines', 'crayon', 'topo'];
export const DEFAULT_EFFECT = 'silhouette';
export const DEFAULT_BRANDING = 'mono-light';

// ---- ID helpers -------------------------------------------------------------

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---- Status derivation ------------------------------------------------------

/**
 * Derive aggregated visual status from its variants.
 *
 * @param {VisualVariant[]} variants
 * @returns {'pending'|'lifting'|'ready'|'error'}
 */
export function deriveStatus(variants) {
  if (variants.some((v) => v.status === 'lifting')) return 'lifting';
  if (variants.some((v) => v.status === 'ready')) return 'ready';
  if (variants.every((v) => v.status === 'error')) return 'error';
  return 'pending';
}

// ---- Deck CRUD --------------------------------------------------------------

/**
 * Create a new empty deck (no document yet, no visuals).
 *
 * @param {string} title
 * @param {DeckSource} source
 * @returns {Deck}
 */
export function createDeck(title, source) {
  const now = Date.now();
  return {
    id: uuid(),
    title: title || 'Untitled Deck',
    createdAt: now,
    updatedAt: now,
    source: source ?? { type: 'pdf', fileName: '', pageCount: 0 },
    document: null,
    visuals: [],
  };
}

/**
 * Set the document data after PDF parse + text extraction.
 *
 * @param {Deck} deck
 * @param {DocumentData} document
 */
export function setDocument(deck, document) {
  deck.document = document;
  deck.updatedAt = Date.now();
}

/**
 * Add a new visual anchored to a text range. Visual starts with VARIANT_COUNT
 * pending variants, selectedVariantIndex = 0, default effect + branding.
 *
 * @param {Deck} deck
 * @param {TextAnchor} textAnchor
 * @returns {Visual} the newly created visual
 */
export function addVisual(deck, textAnchor) {
  const visual = {
    id: uuid(),
    textAnchor: {
      startOffset: textAnchor.startOffset,
      endOffset: textAnchor.endOffset,
      text: textAnchor.text,
    },
    createdAt: Date.now(),
    status: 'pending',
    variants: Array.from({ length: VARIANT_COUNT }, () => ({ status: 'pending' })),
    selectedVariantIndex: 0,
    activeEffect: DEFAULT_EFFECT,
    activeBranding: DEFAULT_BRANDING,
  };
  deck.visuals.push(visual);
  deck.updatedAt = Date.now();
  return visual;
}

/**
 * Remove a visual by id.
 *
 * @param {Deck} deck
 * @param {string} visualId
 * @returns {boolean} true if removed
 */
export function removeVisual(deck, visualId) {
  const idx = deck.visuals.findIndex((v) => v.id === visualId);
  if (idx === -1) return false;
  deck.visuals.splice(idx, 1);
  deck.updatedAt = Date.now();
  return true;
}

/**
 * Update a single variant of a visual + derive aggregated visual status.
 *
 * @param {Deck} deck
 * @param {string} visualId
 * @param {number} variantIndex 0..VARIANT_COUNT-1
 * @param {'pending'|'lifting'|'ready'|'error'} status
 * @param {object} [payload] merged into variant: {sceneData, archetype, liftError}
 * @returns {boolean}
 */
export function updateVisualVariantStatus(deck, visualId, variantIndex, status, payload = {}) {
  const visual = deck.visuals.find((v) => v.id === visualId);
  if (!visual) return false;
  if (variantIndex < 0 || variantIndex >= visual.variants.length) return false;
  const variant = visual.variants[variantIndex];
  variant.status = status;
  if (payload.sceneData !== undefined) variant.sceneData = payload.sceneData;
  if (payload.archetype !== undefined) variant.archetype = payload.archetype;
  if (payload.liftError !== undefined) variant.liftError = payload.liftError;
  visual.status = deriveStatus(visual.variants);
  deck.updatedAt = Date.now();
  return true;
}

/**
 * Switch the selectedVariantIndex of a visual (UI: user picks a variant).
 *
 * @param {Deck} deck
 * @param {string} visualId
 * @param {number} variantIndex 0..VARIANT_COUNT-1
 * @returns {boolean}
 */
export function selectVisualVariant(deck, visualId, variantIndex) {
  const visual = deck.visuals.find((v) => v.id === visualId);
  if (!visual) return false;
  if (variantIndex < 0 || variantIndex >= visual.variants.length) return false;
  visual.selectedVariantIndex = variantIndex;
  deck.updatedAt = Date.now();
  return true;
}

/**
 * Accessor for the currently-selected variant of a visual.
 *
 * @param {Visual} visual
 * @returns {VisualVariant | null}
 */
export function getSelectedVisualVariant(visual) {
  if (!visual || !Array.isArray(visual.variants)) return null;
  const idx = Number.isInteger(visual.selectedVariantIndex) ? visual.selectedVariantIndex : 0;
  return visual.variants[idx] || visual.variants[0] || null;
}

/**
 * Set the active renderer for a visual. Must be one of ACTIVE_EFFECTS.
 *
 * @param {Deck} deck
 * @param {string} visualId
 * @param {string} effect
 * @returns {boolean}
 */
export function setActiveEffect(deck, visualId, effect) {
  const visual = deck.visuals.find((v) => v.id === visualId);
  if (!visual) return false;
  if (!ACTIVE_EFFECTS.includes(effect)) return false;
  visual.activeEffect = effect;
  deck.updatedAt = Date.now();
  return true;
}

/**
 * Set the active branding preset for a visual.
 *
 * @param {Deck} deck
 * @param {string} visualId
 * @param {string} brandingId
 * @returns {boolean}
 */
export function setActiveBranding(deck, visualId, brandingId) {
  const visual = deck.visuals.find((v) => v.id === visualId);
  if (!visual) return false;
  visual.activeBranding = brandingId;
  deck.updatedAt = Date.now();
  return true;
}

// ---- Storage ----------------------------------------------------------------

function readStorage() {
  const raw = localStorage.getItem(DECKS_STORAGE_KEY);
  if (!raw) return { version: STORAGE_VERSION, decks: [] };
  try {
    const parsed = JSON.parse(raw);
    return migrateDecksStorage(parsed);
  } catch (e) {
    console.warn('[deck-model] storage parse failed, reinitializing:', e.message);
    return { version: STORAGE_VERSION, decks: [] };
  }
}

function writeStorage(shape) {
  try {
    localStorage.setItem(DECKS_STORAGE_KEY, JSON.stringify(shape));
  } catch (e) {
    console.error('[deck-model] storage write failed (quota?):', e.message);
    throw e;
  }
}

/**
 * Migrate storage. v1/v2/v3/v4 silent drop. Only v5 passes through.
 *
 * @param {object} raw
 * @returns {{version:number, decks:Deck[]}}
 */
export function migrateDecksStorage(raw) {
  if (!raw || typeof raw !== 'object') return { version: STORAGE_VERSION, decks: [] };
  if (raw.version !== STORAGE_VERSION) return { version: STORAGE_VERSION, decks: [] };
  if (!Array.isArray(raw.decks)) return { version: STORAGE_VERSION, decks: [] };
  return { version: STORAGE_VERSION, decks: raw.decks };
}

export function saveDeckToStorage(deck) {
  const shape = readStorage();
  const idx = shape.decks.findIndex((d) => d.id === deck.id);
  if (idx >= 0) shape.decks[idx] = deck;
  else shape.decks.push(deck);
  writeStorage(shape);
}

export function loadDeckFromStorage(id) {
  const shape = readStorage();
  return shape.decks.find((d) => d.id === id) || null;
}

export function listDecks() {
  const shape = readStorage();
  return [...shape.decks].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function deleteDeckFromStorage(id) {
  const shape = readStorage();
  const idx = shape.decks.findIndex((d) => d.id === id);
  if (idx === -1) return false;
  shape.decks.splice(idx, 1);
  writeStorage(shape);
  return true;
}

export function renameDeck(id, newTitle) {
  const deck = loadDeckFromStorage(id);
  if (!deck) return false;
  deck.title = newTitle;
  deck.updatedAt = Date.now();
  saveDeckToStorage(deck);
  return true;
}

/**
 * Duplicate a deck — deep copy with new id + " (copy)" suffix. document is
 * preserved (it's PDF text, independent of lifts). Visuals are dropped
 * (user needs to re-generate against the copy).
 *
 * @param {string} id
 * @returns {Deck|null}
 */
export function duplicateDeck(id) {
  const src = loadDeckFromStorage(id);
  if (!src) return null;
  const now = Date.now();
  const copy = {
    ...src,
    id: uuid(),
    title: `${src.title} (copy)`,
    createdAt: now,
    updatedAt: now,
    document: src.document ? JSON.parse(JSON.stringify(src.document)) : null,
    visuals: [], // drop visuals on duplicate
  };
  saveDeckToStorage(copy);
  return copy;
}
```

- [ ] **Step 3: Use Write tool to fully replace `sdf-js/scripts/test-deck-model.mjs` with v5 tests**

```js
// =============================================================================
// test-deck-model.mjs — L1 unit tests for Atlas Present Sprint 2 deck-model v5
// =============================================================================

import {
  STORAGE_VERSION,
  VARIANT_COUNT,
  ACTIVE_EFFECTS,
  DEFAULT_EFFECT,
  DEFAULT_BRANDING,
  deriveStatus,
  createDeck,
  setDocument,
  addVisual,
  removeVisual,
  updateVisualVariantStatus,
  selectVisualVariant,
  getSelectedVisualVariant,
  setActiveEffect,
  setActiveBranding,
  migrateDecksStorage,
  saveDeckToStorage,
  loadDeckFromStorage,
  listDecks,
  deleteDeckFromStorage,
  renameDeck,
  duplicateDeck,
  DECKS_STORAGE_KEY,
} from '../src/present/deck-model.js';

// Mock localStorage
const localStorageMock = {};
globalThis.localStorage = {
  getItem: (k) => (k in localStorageMock ? localStorageMock[k] : null),
  setItem: (k, v) => {
    localStorageMock[k] = v;
  },
  removeItem: (k) => {
    delete localStorageMock[k];
  },
  clear: () => {
    for (const k of Object.keys(localStorageMock)) delete localStorageMock[k];
  },
};

let pass = 0,
  fail = 0;
function ok(cond, name) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`);
  }
}

function resetStorage() {
  localStorage.clear();
}

console.log('=== deck-model v5 (Sprint 2) smoke test ===\n');

console.log('Constants');
ok(STORAGE_VERSION === 5, `STORAGE_VERSION = 5 (got ${STORAGE_VERSION})`);
ok(VARIANT_COUNT === 6, `VARIANT_COUNT = 6 (got ${VARIANT_COUNT})`);
ok(Array.isArray(ACTIVE_EFFECTS) && ACTIVE_EFFECTS.length === 4, `ACTIVE_EFFECTS has 4 entries`);
ok(
  ACTIVE_EFFECTS.includes('silhouette') &&
    ACTIVE_EFFECTS.includes('lines') &&
    ACTIVE_EFFECTS.includes('crayon') &&
    ACTIVE_EFFECTS.includes('topo'),
  `ACTIVE_EFFECTS = [silhouette, lines, crayon, topo]`,
);
ok(DEFAULT_EFFECT === 'silhouette', `DEFAULT_EFFECT = silhouette`);
ok(typeof DEFAULT_BRANDING === 'string' && DEFAULT_BRANDING.length > 0, `DEFAULT_BRANDING exported`);

console.log('\nTest group 1: createDeck (empty deck, no document, no visuals)');
{
  const d = createDeck('My Deck', { type: 'pdf', fileName: 'x.pdf', pageCount: 3 });
  ok(typeof d.id === 'string' && d.id.length > 0, 'createDeck: id assigned');
  ok(d.title === 'My Deck', 'createDeck: title');
  ok(d.source.fileName === 'x.pdf', 'createDeck: source carried');
  ok(d.document === null, 'createDeck: document = null initially');
  ok(Array.isArray(d.visuals) && d.visuals.length === 0, 'createDeck: visuals = []');
}

console.log('\nTest group 2: setDocument');
{
  const d = createDeck('test');
  const origUpdated = d.updatedAt;
  while (Date.now() === origUpdated) {}
  const doc = {
    flowingText: 'Hello world',
    pages: [{ startOffset: 0, endOffset: 11, pageNumber: 1 }],
    headings: [],
  };
  setDocument(d, doc);
  ok(d.document === doc, 'setDocument: document stored');
  ok(d.updatedAt > origUpdated, 'setDocument: updatedAt advanced');
}

console.log('\nTest group 3: addVisual');
{
  const d = createDeck('test');
  setDocument(d, { flowingText: 'hello world', pages: [{ startOffset: 0, endOffset: 11, pageNumber: 1 }], headings: [] });
  const v = addVisual(d, { startOffset: 0, endOffset: 5, text: 'hello' });
  ok(typeof v.id === 'string' && v.id.length > 0, 'addVisual: id assigned');
  ok(v.textAnchor.text === 'hello', 'addVisual: textAnchor.text stored');
  ok(v.textAnchor.startOffset === 0 && v.textAnchor.endOffset === 5, 'addVisual: textAnchor offsets stored');
  ok(Array.isArray(v.variants) && v.variants.length === VARIANT_COUNT, `addVisual: ${VARIANT_COUNT} variants`);
  ok(v.variants.every((vt) => vt.status === 'pending'), 'addVisual: all variants pending');
  ok(v.selectedVariantIndex === 0, 'addVisual: selectedVariantIndex = 0');
  ok(v.activeEffect === DEFAULT_EFFECT, `addVisual: activeEffect = ${DEFAULT_EFFECT}`);
  ok(v.activeBranding === DEFAULT_BRANDING, `addVisual: activeBranding = ${DEFAULT_BRANDING}`);
  ok(v.status === 'pending', 'addVisual: visual.status = pending');
  ok(d.visuals.length === 1, 'addVisual: deck.visuals has 1 entry');
}

console.log('\nTest group 4: removeVisual');
{
  const d = createDeck('test');
  const v1 = addVisual(d, { startOffset: 0, endOffset: 1, text: 'a' });
  const v2 = addVisual(d, { startOffset: 1, endOffset: 2, text: 'b' });
  ok(d.visuals.length === 2, 'removeVisual: setup 2 visuals');
  const removed = removeVisual(d, v1.id);
  ok(removed === true, 'removeVisual: returns true on success');
  ok(d.visuals.length === 1, 'removeVisual: deck has 1 visual now');
  ok(d.visuals[0].id === v2.id, 'removeVisual: correct visual removed');
  const removedAgain = removeVisual(d, v1.id);
  ok(removedAgain === false, 'removeVisual: returns false if not found');
}

console.log('\nTest group 5: deriveStatus');
{
  ok(deriveStatus([{ status: 'pending' }, { status: 'pending' }]) === 'pending', 'all pending → pending');
  ok(deriveStatus([{ status: 'lifting' }, { status: 'pending' }]) === 'lifting', 'any lifting → lifting');
  ok(deriveStatus([{ status: 'ready' }, { status: 'pending' }]) === 'ready', 'any ready (none lifting) → ready');
  ok(deriveStatus([{ status: 'ready' }, { status: 'lifting' }]) === 'lifting', 'lifting trumps ready');
  ok(deriveStatus([{ status: 'error' }, { status: 'error' }]) === 'error', 'all error → error');
  ok(deriveStatus([{ status: 'error' }, { status: 'ready' }]) === 'ready', 'some error + some ready → ready');
}

console.log('\nTest group 6: updateVisualVariantStatus');
{
  const d = createDeck('test');
  const v = addVisual(d, { startOffset: 0, endOffset: 5, text: 'hello' });
  const r1 = updateVisualVariantStatus(d, v.id, 0, 'lifting');
  ok(r1 === true, 'updateVisualVariantStatus: returns true');
  ok(v.variants[0].status === 'lifting', 'variant 0 status = lifting');
  ok(v.status === 'lifting', 'visual status derived = lifting');

  updateVisualVariantStatus(d, v.id, 0, 'ready', {
    sceneData: { v: 1, name: 'sequence: hello', subjects: [] },
    archetype: 'sequence',
  });
  ok(v.variants[0].sceneData !== undefined, 'payload sceneData merged');
  ok(v.variants[0].archetype === 'sequence', 'payload archetype merged');
  ok(v.status === 'ready', 'visual status derived to ready (1 of 6 ready)');

  updateVisualVariantStatus(d, v.id, 1, 'error', { liftError: 'mock error' });
  ok(v.variants[1].liftError === 'mock error', 'payload liftError merged');

  const r2 = updateVisualVariantStatus(d, v.id, 99, 'ready');
  ok(r2 === false, 'invalid variantIndex returns false');
  const r3 = updateVisualVariantStatus(d, 'nonexistent', 0, 'ready');
  ok(r3 === false, 'invalid visualId returns false');
}

console.log('\nTest group 7: selectVisualVariant + getSelectedVisualVariant');
{
  const d = createDeck('test');
  const v = addVisual(d, { startOffset: 0, endOffset: 5, text: 'hello' });
  const sel0 = getSelectedVisualVariant(v);
  ok(sel0 === v.variants[0], 'getSelectedVisualVariant: default returns variants[0]');

  const r = selectVisualVariant(d, v.id, 3);
  ok(r === true, 'selectVisualVariant returns true');
  ok(v.selectedVariantIndex === 3, 'selectedVariantIndex = 3');
  const sel3 = getSelectedVisualVariant(v);
  ok(sel3 === v.variants[3], 'getSelectedVisualVariant: now returns variants[3]');

  const rBad = selectVisualVariant(d, v.id, 99);
  ok(rBad === false, 'selectVisualVariant out-of-range returns false');
  ok(v.selectedVariantIndex === 3, 'selectedVariantIndex unchanged after rejected select');

  const corrupt = getSelectedVisualVariant({});
  ok(corrupt === null, 'getSelectedVisualVariant: corrupt input returns null');
}

console.log('\nTest group 8: setActiveEffect');
{
  const d = createDeck('test');
  const v = addVisual(d, { startOffset: 0, endOffset: 5, text: 'hello' });
  ok(setActiveEffect(d, v.id, 'lines') === true, 'setActiveEffect lines OK');
  ok(v.activeEffect === 'lines', 'activeEffect = lines');
  ok(setActiveEffect(d, v.id, 'crayon') === true, 'setActiveEffect crayon OK');
  ok(setActiveEffect(d, v.id, 'invalid-renderer') === false, 'setActiveEffect invalid renderer returns false');
  ok(v.activeEffect === 'crayon', 'activeEffect still crayon after rejected set');
  ok(setActiveEffect(d, 'nonexistent-visual', 'lines') === false, 'setActiveEffect bad visualId returns false');
}

console.log('\nTest group 9: setActiveBranding');
{
  const d = createDeck('test');
  const v = addVisual(d, { startOffset: 0, endOffset: 5, text: 'hello' });
  ok(setActiveBranding(d, v.id, 'mono-dark') === true, 'setActiveBranding accepts any string id');
  ok(v.activeBranding === 'mono-dark', 'activeBranding updated');
  ok(setActiveBranding(d, 'nonexistent-visual', 'mono-dark') === false, 'setActiveBranding bad visualId returns false');
}

console.log('\nTest group 10: localStorage v5 roundtrip + silent drops');

resetStorage();
{
  const d = createDeck('Roundtrip', { type: 'pdf', fileName: 'r.pdf', pageCount: 1 });
  setDocument(d, { flowingText: 'sample text here', pages: [{ startOffset: 0, endOffset: 16, pageNumber: 1 }], headings: [] });
  const v = addVisual(d, { startOffset: 0, endOffset: 6, text: 'sample' });
  updateVisualVariantStatus(d, v.id, 0, 'ready', {
    sceneData: { v: 1, name: 'list: sample', subjects: [] },
    archetype: 'list',
  });
  saveDeckToStorage(d);
  const loaded = loadDeckFromStorage(d.id);
  ok(loaded !== null, 'roundtrip: load returns deck');
  ok(loaded.title === 'Roundtrip', 'roundtrip: title preserved');
  ok(loaded.document.flowingText === 'sample text here', 'roundtrip: document.flowingText preserved');
  ok(loaded.visuals.length === 1, 'roundtrip: 1 visual preserved');
  ok(loaded.visuals[0].variants[0].archetype === 'list', 'roundtrip: variant archetype preserved');
}

// v1/v2/v3/v4 all silent dropped
for (const oldVersion of [1, 2, 3, 4]) {
  resetStorage();
  localStorage.setItem('atlas-decks', JSON.stringify({ version: oldVersion, decks: [{ id: 'old', title: `v${oldVersion} deck` }] }));
  const list = listDecks();
  ok(list.length === 0, `v${oldVersion} silent drop: listDecks empty`);
}

console.log('\nTest group 11: listDecks sort + delete + rename + duplicate');

{
  resetStorage();
  const d1 = createDeck('old');
  d1.updatedAt = 1000;
  saveDeckToStorage(d1);
  const d2 = createDeck('new');
  d2.updatedAt = 5000;
  saveDeckToStorage(d2);
  const list = listDecks();
  ok(list[0].title === 'new', 'listDecks: sorted by updatedAt desc');
}

{
  resetStorage();
  const d = createDeck('delete-me');
  saveDeckToStorage(d);
  ok(deleteDeckFromStorage(d.id) === true, 'delete: returns true');
  ok(listDecks().length === 0, 'delete: list empty');
  ok(deleteDeckFromStorage('nonexistent') === false, 'delete: nonexistent returns false');
}

{
  resetStorage();
  const d = createDeck('original');
  saveDeckToStorage(d);
  renameDeck(d.id, 'renamed');
  ok(loadDeckFromStorage(d.id).title === 'renamed', 'rename: title updated');
}

{
  resetStorage();
  const d = createDeck('source');
  setDocument(d, { flowingText: 'shared text', pages: [{ startOffset: 0, endOffset: 11, pageNumber: 1 }], headings: [] });
  const v = addVisual(d, { startOffset: 0, endOffset: 6, text: 'shared' });
  updateVisualVariantStatus(d, v.id, 0, 'ready', { sceneData: { v: 1, subjects: [] }, archetype: 'list' });
  saveDeckToStorage(d);

  const dup = duplicateDeck(d.id);
  ok(dup !== null, 'duplicate: returns new deck');
  ok(dup.title === 'source (copy)', 'duplicate: " (copy)" suffix');
  ok(dup.document !== null && dup.document.flowingText === 'shared text', 'duplicate: document preserved');
  ok(dup.visuals.length === 0, 'duplicate: visuals dropped (user re-generates)');
  ok(dup.id !== d.id, 'duplicate: new id');
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
```

- [ ] **Step 4: Run test file**

```bash
node sdf-js/scripts/test-deck-model.mjs
```

Expected: all assertions pass (~60 total).

If any fail: debug. Common issues — function name mismatches between test imports and implementation, or `updateVariantStatus` references left over from v4.

- [ ] **Step 5: Run CI grep on deck-model.js (mode-agnostic check)**

```bash
grep -nE "\b(camera|yaw|pitch|distance|focal|waypoint|cameraSequence|tween|easing)\b" sdf-js/src/present/deck-model.js | grep -vE "MUST NOT contain|NOT contain 3D vocabulary"
echo "EXIT: $?"
```

Expected: no output, EXIT: 1 (clean, banner exclusion-documented).

- [ ] **Step 6: Run full npm test**

```bash
npm test 2>&1 | tail -5
```

Expected: `npm test 33/33`. The `test-pipeline.mjs` will fail (because pipeline still references old v4 schema), but at this point we need to handle that. Check:

```bash
npm test 2>&1 | grep -E "FAIL|fail|test-pipeline" | head -5
```

If test-pipeline.mjs fails: that's the documented Phase 3 → Phase 5 handoff (Sprint 1.5 had the same pattern). Note the failure count and acknowledge it must be 0 after Phase 5.

- [ ] **Step 7: Commit Phase 3**

```bash
git add sdf-js/src/present/deck-model.js sdf-js/scripts/test-deck-model.mjs
git commit -m "Sprint 2 Phase 3: deck-model.js v5 schema REWRITE (document + visuals[])

Schema v4 → v5: section.variants[3] dropped. New shape:
  deck.document = { flowingText, pages[], headings[] } | null
  deck.visuals[] = visual items anchored to text-range offsets
  each visual: { id, textAnchor, status, variants[6], selectedVariantIndex,
                 activeEffect, activeBranding }

Constants changed:
  STORAGE_VERSION: 4 → 5
  VARIANT_COUNT: 3 → 6 (matches Napkin AI Suggestions)
  NEW: ACTIVE_EFFECTS, DEFAULT_EFFECT, DEFAULT_BRANDING

New exports (visual-based):
  setDocument, addVisual, removeVisual,
  updateVisualVariantStatus, selectVisualVariant, getSelectedVisualVariant,
  setActiveEffect, setActiveBranding

Removed exports (section-based, no longer in schema):
  addPendingSections, sectionStatusCounts, updateVariantStatus,
  selectVariant, getSelectedVariant, updateSectionStatus

Kept exports: createDeck, listDecks, saveDeckToStorage,
  loadDeckFromStorage, deleteDeckFromStorage, renameDeck, duplicateDeck,
  migrateDecksStorage, deriveStatus

Migration: v1/v2/v3/v4 silent drop (consistent with policy from Sprint 1
v4 + 1.5). v5-only storage.

CI grep clean (no 3D vocabulary outside enforcement banner).
~60 assertions in rewritten test-deck-model.mjs.

INTERMEDIATE STATE: npm test will show test-pipeline.mjs failures until
Phase 5 (Sprint 1.5 had the same handoff pattern)."
```

---

## Phase 4 — Layer 1: lift opts.mode + runtime sanitize + prompt v3.19

Per spec Decision 11 (double safety).

### Task 4.1: Add `opts.mode` to `callLiftLLM` + `sanitize2dSceneData` export

**Files:**
- Modify: `sdf-js/src/compositor-api.js`
- Modify: `sdf-js/scripts/test-compositor-api.mjs`

- [ ] **Step 1: Read current callLiftLLM body**

```bash
sed -n '256,300p' sdf-js/src/compositor-api.js
```

Confirm current signature: `callLiftLLM(originalPrompt, code2d, apiKey, opts = {})`.

- [ ] **Step 2: Add `MODE_2D_ADDENDUM` constant near top of file**

In `sdf-js/src/compositor-api.js`, immediately AFTER the existing top-of-file constants block (look for `CACHED_SYSTEM_PROMPT_LIFT` declaration; add just before the first `export function`), add:

```js
/**
 * Appended to system prompt when callLiftLLM is invoked with opts.mode === '2d'.
 * Atlas Present 2D mode renders text via Canvas2D outside the SDF tree, so the
 * LLM must NOT emit text-3d-extruded or text-3d-pipe subjects (those would
 * render as ugly SDF glyphs in 2D silhouette/lines/crayon/topo renderers).
 *
 * Defense layer 1 of 2. Layer 2: sanitize2dSceneData() runtime filter.
 */
const MODE_2D_ADDENDUM = `

## 2D-mode constraints (Atlas Present)

This call is for 2D rendering. NEVER emit subjects with type
'text-3d-extruded' or 'text-3d-pipe'. Atlas Present renders all
text via Canvas2D outside the SDF tree in 2D mode. SDF glyphs in
2D mode look bad (silhouette/lines/crayon/topo cannot render text
typography cleanly).

If the slide content is text-heavy, choose archetype 'text-card'
and emit minimal context geometry (e.g., a backdrop primitive) —
do NOT emit text glyphs as SDF subjects.
`;
```

- [ ] **Step 3: Modify `callLiftLLM` to honor `opts.mode`**

Find the line in `callLiftLLM`:

```js
      system: [
        {
          type: 'text',
          text: CACHED_SYSTEM_PROMPT_LIFT,
          cache_control: { type: 'ephemeral' },
        },
      ],
```

Replace with:

```js
      system: [
        {
          type: 'text',
          text:
            opts.mode === '2d'
              ? CACHED_SYSTEM_PROMPT_LIFT + MODE_2D_ADDENDUM
              : CACHED_SYSTEM_PROMPT_LIFT,
          cache_control: { type: 'ephemeral' },
        },
      ],
```

Note: this creates two separate cache entries (3D mode uses cached `CACHED_SYSTEM_PROMPT_LIFT`, 2D mode uses cached `CACHED_SYSTEM_PROMPT_LIFT + MODE_2D_ADDENDUM`). Anthropic prompt cache keys on full text, so the addendum effectively splits the cache. Acceptable trade-off.

- [ ] **Step 4: Add `sanitize2dSceneData` export**

At end of file (after `createRendererForId` or wherever last export is), append:

```js
/**
 * Runtime sanitizer for 2D-mode sceneData. Defense layer 2 of 2 (paired with
 * the MODE_2D_ADDENDUM in callLiftLLM). Filters out any subjects with type
 * 'text-3d-extruded' or 'text-3d-pipe' since those render badly in 2D.
 *
 * @param {object} sceneData
 * @returns {object} new sceneData with filtered subjects (input untouched)
 */
export function sanitize2dSceneData(sceneData) {
  if (!sceneData || typeof sceneData !== 'object') return sceneData;
  if (!Array.isArray(sceneData.subjects)) return sceneData;
  return {
    ...sceneData,
    subjects: sceneData.subjects.filter(
      (s) => s && s.type !== 'text-3d-extruded' && s.type !== 'text-3d-pipe',
    ),
  };
}
```

- [ ] **Step 5: Append tests in test-compositor-api.mjs**

Read existing test file to know existing patterns:

```bash
wc -l sdf-js/scripts/test-compositor-api.mjs
```

Append new tests at appropriate location (find the final `console.log` / `process.exit` line; append before it):

```js
console.log('\nTest group: sanitize2dSceneData (Sprint 2 Phase 4)');

import { sanitize2dSceneData } from '../src/compositor-api.js';

{
  const input = {
    v: 1, name: 'test',
    subjects: [
      { id: 'a', type: 'cube-3d', args: {}, transform: { translate: [0,0,0] } },
      { id: 'b', type: 'text-3d-extruded', args: { text: 'hello' }, transform: { translate: [0,0,0] } },
      { id: 'c', type: 'text-3d-pipe', args: { text: 'world' }, transform: { translate: [0,0,0] } },
      { id: 'd', type: 'sphere', args: {}, transform: { translate: [0,0,0] } },
    ],
  };
  const out = sanitize2dSceneData(input);
  ok(out.subjects.length === 2, `sanitize: 4 → 2 subjects (got ${out.subjects.length})`);
  ok(out.subjects.every((s) => s.type !== 'text-3d-extruded'), 'sanitize: no text-3d-extruded survives');
  ok(out.subjects.every((s) => s.type !== 'text-3d-pipe'), 'sanitize: no text-3d-pipe survives');
  ok(input.subjects.length === 4, 'sanitize: input not mutated (immutable)');
  ok(out.name === 'test' && out.v === 1, 'sanitize: other fields preserved');
}

{
  const empty = sanitize2dSceneData({ v: 1, name: 'empty', subjects: [] });
  ok(Array.isArray(empty.subjects) && empty.subjects.length === 0, 'sanitize: empty subjects array OK');
}

{
  const noSubjects = sanitize2dSceneData({ v: 1, name: 'no-subjects' });
  ok(noSubjects.name === 'no-subjects', 'sanitize: missing subjects field passes through');
}

{
  const nullInput = sanitize2dSceneData(null);
  ok(nullInput === null, 'sanitize: null input returns null');
}
```

- [ ] **Step 6: Verify**

```bash
node --check sdf-js/src/compositor-api.js
node sdf-js/scripts/test-compositor-api.mjs
```

Expected: syntax OK; tests pass.

- [ ] **Step 7: Run full npm test (still expect test-pipeline failures from Phase 3 handoff)**

```bash
npm test 2>&1 | tail -5
```

Expected: same failures as after Phase 3 (test-pipeline.mjs still references old API).

- [ ] **Step 8: Commit Task 4.1**

```bash
git add sdf-js/src/compositor-api.js sdf-js/scripts/test-compositor-api.mjs
git commit -m "Sprint 2 Phase 4.1: callLiftLLM opts.mode + sanitize2dSceneData (double safety)

Sprint 1.5 lesson: SDF text in 2D mode = ugly. Defense in depth per spec
Decision 11:

(1) callLiftLLM(originalPrompt, code2d, apiKey, opts = {}) extends opts with
    mode: '2d' | '3d' (default '3d' for compositor demo backward-compat). When
    '2d', system prompt is suffixed with MODE_2D_ADDENDUM that instructs LLM
    to NEVER emit text-3d-extruded / text-3d-pipe and prefer text-card
    archetype for text-heavy content.

(2) NEW export sanitize2dSceneData(sceneData) — runtime filter that removes
    text-3d-extruded / text-3d-pipe subjects. Defense layer 2 in case LLM
    ignores the prompt addendum.

Tests: ~6 new assertions in test-compositor-api.mjs covering sanitize cases
(mixed/empty/missing subjects/null input).

opts.mode default '3d' preserves compositor demo behavior. Pipeline (Phase 5)
will pass opts.mode = '2d' explicitly when called from Atlas Present."
```

### Task 4.2: Bump lift prompt v3.18 → v3.19

**Files:**
- Modify: `sdf-js/examples/compositor/system-prompt-lift-3d.md`

- [ ] **Step 1: Read frontmatter version line**

```bash
head -3 sdf-js/examples/compositor/system-prompt-lift-3d.md
```

Confirm `version: 3.18`. Find the description: line.

- [ ] **Step 2: Bump version + append to description**

In the frontmatter, change `version: 3.18` → `version: 3.19`.

In the `description:` field (single long line), append at end:

```
 v3.19 (2026-06-20) flags 2D-mode constraints: callLiftLLM(opts.mode='2d') appends an addendum forbidding text-3d-extruded / text-3d-pipe subjects (Atlas Present 2D renderers — silhouette/lines/crayon/topo — cannot render SDF glyphs cleanly; text in 2D mode renders via Canvas2D outside the SDF tree). Runtime sanitize2dSceneData() is defense layer 2. Sprint 1.5 lesson: variant generation on text-heavy paragraphs produced ugly SDF text glyphs (per manual L3 reject 2026-06-20).
```

- [ ] **Step 3: Verify file still parses**

```bash
head -3 sdf-js/examples/compositor/system-prompt-lift-3d.md
grep -c "version: 3.19" sdf-js/examples/compositor/system-prompt-lift-3d.md
```

Expected: version line shows 3.19; grep returns 1.

- [ ] **Step 4: Verify npm test stays at same state**

```bash
npm test 2>&1 | tail -5
```

Expected: same as after Task 4.1 (still test-pipeline.mjs failing pending Phase 5).

- [ ] **Step 5: Commit Task 4.2**

```bash
git add sdf-js/examples/compositor/system-prompt-lift-3d.md
git commit -m "Sprint 2 Phase 4.2: lift prompt v3.18 → v3.19 (2D-mode addendum noted)

Bump version in frontmatter. Append v3.19 changelog to description listing
the new opts.mode='2d' addendum (defense layer 1) + sanitize2dSceneData
(defense layer 2). Sprint 1.5 manual L3 lesson cited.

The actual MODE_2D_ADDENDUM text lives in src/compositor-api.js (appended
at call time when opts.mode === '2d'), not in this baseline prompt file."
```

---

## Phase 5 — pipeline.js REWRITE for per-selection 6-lift

### Task 5.1: REWRITE pipeline.js + tests

**Files:**
- REWRITE: `sdf-js/src/present/pipeline.js`
- REWRITE: `sdf-js/scripts/test-pipeline.mjs`

- [ ] **Step 1: Read current pipeline.js exports to know what's used**

```bash
grep -nE "^export|^import" sdf-js/src/present/pipeline.js
```

Note `extractArchetype` is exported (used inside pipeline; keep + re-export).

- [ ] **Step 2: Use Write tool to fully replace `sdf-js/src/present/pipeline.js` with Sprint 2 visual-pipeline**

```js
// =============================================================================
// pipeline.js — Atlas Present Sprint 2 visual generation pipeline
// -----------------------------------------------------------------------------
// Per-selection (not per-section) 6-lift queue. Called when user clicks ⚡
// on a text selection. Each visual gets VARIANT_COUNT (6) independent lift
// calls in serial. Identical prompts; divergence relies on LLM stochasticity
// at default Anthropic temperature.
//
// Lift contract opts.mode = '2d' enforced (per spec Decision 11 + Phase 4).
// Runtime sanitize2dSceneData applied to each lift output before persistence.
//
// Events emitted via opts.onEvent({type, ...}):
//   - {type: 'lift-start', visualId, variantIndex}
//   - {type: 'lift-ready', visualId, variantIndex, archetype}
//   - {type: 'lift-error', visualId, variantIndex, error}
//   - {type: 'all-done', visualId}
//   - {type: 'cancelled', visualId}
//
// Spec: docs/superpowers/specs/2026-06-20-atlas-present-sprint-2-napkin-paragraph-design.md §6
// =============================================================================

import { updateVisualVariantStatus, VARIANT_COUNT } from './deck-model.js';

const VALID_ARCHETYPES = [
  'sequence', 'list', 'compare', 'hierarchy', 'relation', 'kpi-hero', 'text-card',
];

/**
 * Extract archetype label from sceneData.name prefix ("<archetype>: <title>").
 * Falls back to 'unknown' if missing/malformed/unrecognized.
 *
 * @param {object} sceneData
 * @returns {string}
 */
export function extractArchetype(sceneData) {
  const name = sceneData?.name;
  if (typeof name !== 'string') return 'unknown';
  const colonIdx = name.indexOf(':');
  if (colonIdx === -1) return 'unknown';
  const candidate = name.slice(0, colonIdx).trim().toLowerCase();
  return VALID_ARCHETYPES.includes(candidate) ? candidate : 'unknown';
}

/**
 * Create a visual-pipeline state machine. Returns handle with start/cancel.
 *
 * Pipeline contract:
 *   deps.callLiftLLM(prompt, code2d, apiKey, opts) → {text, usage}
 *   deps.parseLiftResponse(text) → object (sceneData)
 *   deps.sanitize2dSceneData(sceneData) → sanitized sceneData
 *   deps.saveDeck(deck) → void (called after each status change)
 *
 * @param {object} deck
 * @param {string} visualId — visual must already exist in deck.visuals
 * @param {string} apiKey
 * @param {object} deps
 * @param {object} [opts]
 * @param {Function} [opts.onEvent]
 * @returns {{start: Function, cancel: Function, isRunning: Function}}
 */
export function createVisualPipeline(deck, visualId, apiKey, deps, opts = {}) {
  let cancelled = false;
  let running = false;
  const onEvent = opts.onEvent ?? (() => {});

  async function start() {
    if (running) return;
    running = true;

    const visual = deck.visuals.find((v) => v.id === visualId);
    if (!visual) {
      onEvent({ type: 'lift-error', visualId, variantIndex: -1, error: 'visual not found' });
      running = false;
      return;
    }

    // Compose the lift prompt from the textAnchor
    const liftPrompt = visual.textAnchor.text;
    // 2D pipeline doesn't need a 2D-code intermediate (we're not lifting from
    // a 2D scene). Pass the textAnchor.text as code2d arg so the LLM has the
    // raw user-selected text. (The lift system prompt is generic enough.)
    const code2d = `// User selected text:\n// ${visual.textAnchor.text.replace(/\n/g, '\n// ')}`;

    for (let variantIndex = 0; variantIndex < visual.variants.length; variantIndex++) {
      if (cancelled) {
        onEvent({ type: 'cancelled', visualId });
        running = false;
        return;
      }
      const variant = visual.variants[variantIndex];
      if (variant.status !== 'pending') continue; // skip already-done variant

      onEvent({ type: 'lift-start', visualId, variantIndex });
      updateVisualVariantStatus(deck, visualId, variantIndex, 'lifting');
      deps.saveDeck(deck);

      try {
        const llmResult = await deps.callLiftLLM(liftPrompt, code2d, apiKey, { mode: '2d' });
        if (cancelled) {
          onEvent({ type: 'cancelled', visualId });
          running = false;
          return;
        }
        const rawSceneData = deps.parseLiftResponse(llmResult.text);
        const sceneData = deps.sanitize2dSceneData(rawSceneData);
        const archetype = extractArchetype(sceneData);

        updateVisualVariantStatus(deck, visualId, variantIndex, 'ready', { sceneData, archetype });
        deps.saveDeck(deck);
        onEvent({ type: 'lift-ready', visualId, variantIndex, archetype });
      } catch (e) {
        updateVisualVariantStatus(deck, visualId, variantIndex, 'error', { liftError: e.message });
        deps.saveDeck(deck);
        onEvent({ type: 'lift-error', visualId, variantIndex, error: e.message });
        // Continue to next variant (don't abort on single variant error)
      }
    }

    if (!cancelled) {
      onEvent({ type: 'all-done', visualId });
    }
    running = false;
  }

  function cancel() { cancelled = true; }
  function isRunning() { return running; }

  return { start, cancel, isRunning };
}

export { VARIANT_COUNT };
```

- [ ] **Step 3: Use Write tool to fully replace `sdf-js/scripts/test-pipeline.mjs` with Sprint 2 tests**

```js
// =============================================================================
// test-pipeline.mjs — L1 unit tests for Atlas Present Sprint 2 visual-pipeline
// =============================================================================

import { createVisualPipeline, extractArchetype, VARIANT_COUNT } from '../src/present/pipeline.js';
import { createDeck, addVisual, setDocument } from '../src/present/deck-model.js';

// Mock localStorage (deck-model uses it via saveDeck closure)
const localStorageMock = {};
globalThis.localStorage = {
  getItem: (k) => (k in localStorageMock ? localStorageMock[k] : null),
  setItem: (k, v) => {
    localStorageMock[k] = v;
  },
  removeItem: (k) => {
    delete localStorageMock[k];
  },
  clear: () => {
    for (const k of Object.keys(localStorageMock)) delete localStorageMock[k];
  },
};

let pass = 0,
  fail = 0;
function ok(cond, name) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`);
  }
}

function makeDeckWithVisual() {
  const deck = createDeck('test', { type: 'pdf', fileName: 't.pdf', pageCount: 1 });
  setDocument(deck, {
    flowingText: 'Hello world example text',
    pages: [{ startOffset: 0, endOffset: 24, pageNumber: 1 }],
    headings: [],
  });
  const visual = addVisual(deck, { startOffset: 0, endOffset: 11, text: 'Hello world' });
  return { deck, visualId: visual.id };
}

function makeMockDeps(opts = {}) {
  const archetypes = opts.archetypes ?? ['sequence', 'list', 'compare', 'hierarchy', 'relation', 'kpi-hero'];
  let callCount = 0;
  return {
    callLiftLLM: async (prompt, code2d, apiKey, callOpts) => {
      const idx = callCount++;
      if (opts.failOnIndex !== undefined && idx === opts.failOnIndex) {
        throw new Error(`mock error on variant ${idx}`);
      }
      if (opts.captureOpts) opts.captureOpts.push(callOpts);
      const archetype = archetypes[idx] || 'list';
      const sceneData = {
        v: 1,
        name: `${archetype}: Hello world`,
        subjects: [
          { id: 'a', type: 'sphere', args: {}, transform: { translate: [0, 0, 0] } },
          // Inject a text-3d-pipe subject to verify sanitize is being called
          { id: 'b', type: 'text-3d-pipe', args: { text: 'should be filtered' }, transform: { translate: [0, 1, 0] } },
        ],
      };
      return { text: JSON.stringify(sceneData), usage: {} };
    },
    parseLiftResponse: (text) => JSON.parse(text),
    sanitize2dSceneData: (sd) => {
      if (!sd || !Array.isArray(sd.subjects)) return sd;
      return { ...sd, subjects: sd.subjects.filter((s) => s.type !== 'text-3d-pipe' && s.type !== 'text-3d-extruded') };
    },
    saveDeck: () => {},
  };
}

console.log('=== pipeline (Sprint 2 visual-pipeline) smoke test ===\n');

console.log('Constants');
ok(VARIANT_COUNT === 6, `VARIANT_COUNT re-exported as 6 (got ${VARIANT_COUNT})`);

console.log('\nTest group 1: extractArchetype');
{
  ok(extractArchetype({ name: 'sequence: Q3 Roadmap' }) === 'sequence', 'extract sequence');
  ok(extractArchetype({ name: 'text-card: Definition' }) === 'text-card', 'extract text-card');
  ok(extractArchetype({ name: 'unknown-archetype: Title' }) === 'unknown', 'unknown archetype → unknown');
  ok(extractArchetype({ name: 'no colon prefix' }) === 'unknown', 'no colon → unknown');
  ok(extractArchetype({ }) === 'unknown', 'missing name → unknown');
  ok(extractArchetype(null) === 'unknown', 'null sceneData → unknown');
}

console.log('\nTest group 2: happy path (6 lifts, 6 different archetypes via mock)');

{
  const { deck, visualId } = makeDeckWithVisual();
  const events = [];
  const capturedOpts = [];
  const deps = makeMockDeps({ captureOpts: capturedOpts });

  const pipeline = createVisualPipeline(deck, visualId, 'fake-key', deps, {
    onEvent: (e) => events.push(e),
  });
  await pipeline.start();

  const starts = events.filter((e) => e.type === 'lift-start');
  const readys = events.filter((e) => e.type === 'lift-ready');
  ok(starts.length === 6, `6 lift-start events (got ${starts.length})`);
  ok(readys.length === 6, `6 lift-ready events (got ${readys.length})`);
  ok(events[events.length - 1].type === 'all-done', 'last event = all-done');

  // Verify opts.mode = '2d' was passed to every callLiftLLM call
  ok(capturedOpts.length === 6, '6 callLiftLLM invocations');
  ok(capturedOpts.every((o) => o?.mode === '2d'), 'every callLiftLLM call passed opts.mode = 2d');

  // Verify deck state
  const visual = deck.visuals[0];
  ok(visual.variants.every((v) => v.status === 'ready'), 'all 6 variants ready');
  ok(visual.variants.every((v) => v.sceneData !== undefined), 'all variants have sceneData');
  ok(visual.variants.every((v) => v.archetype !== 'unknown'), 'all variants extracted valid archetypes');
  ok(visual.status === 'ready', 'visual status derived to ready');
}

console.log('\nTest group 3: sanitize2dSceneData was invoked (text-3d-pipe removed)');

{
  const { deck, visualId } = makeDeckWithVisual();
  const deps = makeMockDeps();
  const pipeline = createVisualPipeline(deck, visualId, 'fake-key', deps, { onEvent: () => {} });
  await pipeline.start();
  const visual = deck.visuals[0];
  // Mock injects text-3d-pipe; sanitize should remove it
  for (let i = 0; i < 6; i++) {
    const subjects = visual.variants[i].sceneData?.subjects ?? [];
    ok(subjects.every((s) => s.type !== 'text-3d-pipe'), `variant ${i}: no text-3d-pipe subjects after sanitize`);
  }
}

console.log('\nTest group 4: error tolerance — single variant error does not abort');

{
  const { deck, visualId } = makeDeckWithVisual();
  const events = [];
  const deps = makeMockDeps({ failOnIndex: 2 });
  const pipeline = createVisualPipeline(deck, visualId, 'fake-key', deps, { onEvent: (e) => events.push(e) });
  await pipeline.start();

  const errors = events.filter((e) => e.type === 'lift-error');
  const readys = events.filter((e) => e.type === 'lift-ready');
  ok(errors.length === 1, `1 lift-error (got ${errors.length})`);
  ok(errors[0].variantIndex === 2, `error on variant 2`);
  ok(readys.length === 5, `5 lift-ready (got ${readys.length})`);

  const visual = deck.visuals[0];
  ok(visual.variants[2].status === 'error', 'variant 2 = error');
  ok(visual.variants[2].liftError === 'mock error on variant 2', 'variant 2 liftError text preserved');
  ok(visual.status === 'ready', 'visual status = ready (5 of 6 ready)');
}

console.log('\nTest group 5: cancel stops further lifts');

{
  const { deck, visualId } = makeDeckWithVisual();
  const events = [];
  let liftCallCount = 0;
  let pipelineRef;
  const deps = {
    callLiftLLM: async () => {
      liftCallCount++;
      if (liftCallCount === 2) pipelineRef.cancel();
      return { text: JSON.stringify({ v: 1, name: 'list: Test', subjects: [] }), usage: {} };
    },
    parseLiftResponse: (text) => JSON.parse(text),
    sanitize2dSceneData: (sd) => sd,
    saveDeck: () => {},
  };
  pipelineRef = createVisualPipeline(deck, visualId, 'fake-key', deps, { onEvent: (e) => events.push(e) });
  await pipelineRef.start();

  ok(liftCallCount === 2, `only 2 lift calls before cancel (got ${liftCallCount})`);
  ok(events.find((e) => e.type === 'cancelled') !== undefined, 'cancelled event emitted');
  const visual = deck.visuals[0];
  ok(visual.variants[2].status === 'pending', 'variant 2 still pending after cancel');
  ok(visual.variants[5].status === 'pending', 'variant 5 still pending after cancel');
}

console.log('\nTest group 6: visual not found returns lift-error');

{
  const { deck } = makeDeckWithVisual();
  const events = [];
  const deps = makeMockDeps();
  const pipeline = createVisualPipeline(deck, 'nonexistent-id', 'fake-key', deps, {
    onEvent: (e) => events.push(e),
  });
  await pipeline.start();
  ok(events.length === 1 && events[0].type === 'lift-error', 'fires lift-error');
  ok(events[0].error === 'visual not found', 'error message');
  ok(events[0].variantIndex === -1, 'variantIndex = -1 (no specific variant)');
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
```

- [ ] **Step 4: Run test file**

```bash
node sdf-js/scripts/test-pipeline.mjs
```

Expected: all assertions pass (~30+ total).

- [ ] **Step 5: Run full npm test**

```bash
npm test 2>&1 | tail -5
```

Expected: `33/33 test files passed`. (Sprint 2 transitional failures resolved.)

- [ ] **Step 6: Commit Phase 5**

```bash
git add sdf-js/src/present/pipeline.js sdf-js/scripts/test-pipeline.mjs
git commit -m "Sprint 2 Phase 5: pipeline.js REWRITE for per-selection visual generation

REWRITE from per-section batch lift (Sprint 1.5) → per-selection visual
pipeline (Sprint 2 Napkin model).

New API: createVisualPipeline(deck, visualId, apiKey, deps, opts)

Behavior:
- Iterates over visual.variants (VARIANT_COUNT = 6 from v5 schema)
- Each variant: callLiftLLM(textAnchor.text, code2d, apiKey, {mode: '2d'})
- After parseLiftResponse: sanitize2dSceneData filters text-3d-* subjects
- extractArchetype from sceneData.name prefix
- updateVisualVariantStatus + saveDeck per variant
- Events: lift-start / lift-ready / lift-error / all-done / cancelled
- Tolerates per-variant errors (continues to next variant)
- Cancel checkpoint between variants

extractArchetype + VALID_ARCHETYPES kept (re-exported).

~30+ assertions in rewritten test-pipeline.mjs covering: happy path,
opts.mode=2d propagation, sanitize was called, error tolerance, cancel,
visual not found.

npm test 33/33 restored (intermediate failures from Phase 3 handoff resolved)."
```

---

## Phase 6 — `document-view.js` (full-text reader + selection + floating ⚡)

### Task 6.1: Create floating-toolbar.js (selection-positioned ⚡)

**Files:**
- Create: `sdf-js/src/present/floating-toolbar.js`

- [ ] **Step 1: Create floating-toolbar.js**

```js
// =============================================================================
// floating-toolbar.js — Atlas Present Sprint 2 selection-positioned ⚡
// -----------------------------------------------------------------------------
// Mounts a floating toolbar that follows browser selection. When user selects
// non-empty text inside a scoped container, ⚡ button appears above the
// selection. Click ⚡ → calls onTrigger(textAnchor) with {startOffset,
// endOffset, text} relative to the scoped container's text content.
//
// Spec: docs/superpowers/specs/2026-06-20-atlas-present-sprint-2-napkin-paragraph-design.md §6
// =============================================================================

/**
 * @param {HTMLElement} container — the scope element (e.g. document-view's
 *   text container). Selections outside this element are ignored.
 * @param {Function} onTrigger — called with {startOffset, endOffset, text}
 *   when user clicks ⚡. Offsets are relative to container.textContent.
 * @returns {{destroy: Function}}
 */
export function mountFloatingToolbar(container, onTrigger) {
  const toolbar = document.createElement('div');
  toolbar.className = 'floating-toolbar';
  toolbar.style.display = 'none';
  toolbar.innerHTML = `<button class="floating-trigger" type="button">⚡ Generate</button>`;
  document.body.appendChild(toolbar);

  const button = toolbar.querySelector('.floating-trigger');
  let currentAnchor = null;

  function handleSelectionChange() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      hide();
      return;
    }
    const range = sel.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) {
      hide();
      return;
    }
    const text = sel.toString().trim();
    if (text.length === 0) {
      hide();
      return;
    }
    // Compute character offsets relative to container.textContent
    const anchor = computeAnchor(container, range, text);
    if (!anchor) {
      hide();
      return;
    }
    currentAnchor = anchor;
    positionToolbar(range);
    show();
  }

  function computeAnchor(rootEl, range, selectedText) {
    // Use a walker over text nodes to compute character offset
    const containerText = rootEl.textContent || '';
    // Find selectedText in container — first occurrence after computed pre-text length
    const preText = textContentBeforeRange(rootEl, range);
    const startOffset = preText.length;
    const endOffset = startOffset + selectedText.length;
    if (startOffset < 0 || endOffset > containerText.length) return null;
    return { startOffset, endOffset, text: selectedText };
  }

  function textContentBeforeRange(rootEl, range) {
    // Walk text nodes up to range.startContainer; accumulate text length
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null);
    let text = '';
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node === range.startContainer) {
        text += node.textContent.slice(0, range.startOffset);
        break;
      }
      text += node.textContent;
    }
    return text;
  }

  function positionToolbar(range) {
    const rect = range.getBoundingClientRect();
    const tbWidth = 130; // approx toolbar width
    const tbHeight = 36;
    const top = window.scrollY + rect.top - tbHeight - 8;
    const left = window.scrollX + rect.left + rect.width / 2 - tbWidth / 2;
    toolbar.style.top = `${Math.max(0, top)}px`;
    toolbar.style.left = `${Math.max(8, left)}px`;
  }

  function show() {
    toolbar.style.display = 'block';
  }

  function hide() {
    toolbar.style.display = 'none';
    currentAnchor = null;
  }

  button.addEventListener('mousedown', (e) => {
    // mousedown (not click) prevents losing selection
    e.preventDefault();
  });
  button.addEventListener('click', () => {
    if (currentAnchor) {
      onTrigger(currentAnchor);
      hide();
      window.getSelection()?.removeAllRanges();
    }
  });

  document.addEventListener('selectionchange', handleSelectionChange);

  return {
    destroy() {
      document.removeEventListener('selectionchange', handleSelectionChange);
      toolbar.remove();
    },
  };
}
```

- [ ] **Step 2: Verify syntax**

```bash
node --check sdf-js/src/present/floating-toolbar.js && echo "syntax OK"
```

- [ ] **Step 3: Commit Task 6.1**

```bash
git add sdf-js/src/present/floating-toolbar.js
git commit -m "Sprint 2 Phase 6.1: floating-toolbar.js (selection-positioned ⚡)

mountFloatingToolbar(container, onTrigger) returns {destroy}.
Listens for browser selectionchange events scoped to container element.
Non-empty selection inside container → ⚡ button appears above selection.
Click ⚡ → onTrigger({startOffset, endOffset, text}) where offsets are
relative to container.textContent.

Text-walker pattern for computing character offset from DOM Range. No
test (browser-DOM-only; verified visually in Phase 8 browse smoke)."
```

### Task 6.2: Create document-view.js (mount document + wire ⚡)

**Files:**
- Create: `sdf-js/src/present/document-view.js`

- [ ] **Step 1: Create document-view.js**

```js
// =============================================================================
// document-view.js — Atlas Present Sprint 2 Napkin document viewer
// -----------------------------------------------------------------------------
// Mounts the document viewer at /examples/present/?deck=<id>. Renders the
// deck's flowingText with heading-style typography (Canvas2D + system fonts,
// not SDF — per spec rule "no SDF text in 2D mode"). Wires floating-toolbar
// for user text selection → ⚡ → generate visual. Anchors mounted
// visual-panel instances at their text offsets.
//
// Spec: docs/superpowers/specs/2026-06-20-atlas-present-sprint-2-napkin-paragraph-design.md §6
// =============================================================================

import * as deckModel from './deck-model.js';
import { mountFloatingToolbar } from './floating-toolbar.js';
import { mountVisualPanel } from './visual-panel.js';
import { createVisualPipeline } from './pipeline.js';
import { callLiftLLM, parseLiftResponse, sanitize2dSceneData } from '../compositor-api.js';

const ANTHROPIC_KEY_STORAGE = 'atlas-anthropic-key';

export async function mountDocumentView(target, deckId) {
  const deck = deckModel.loadDeckFromStorage(deckId);
  if (!deck) {
    target.innerHTML = `<div class="page-pad">Deck not found.<br><a href="./">← Library</a></div>`;
    return;
  }
  if (!deck.document) {
    target.innerHTML = `<div class="page-pad">Deck has no document data. Re-import the PDF.<br><a href="./">← Library</a></div>`;
    return;
  }

  target.innerHTML = `
    <div class="deck-view-header">
      <a href="./">← Library</a>
      <h2>${escapeHtml(deck.title)}</h2>
      <span class="meta">${deck.document.pages.length} pages · ${deck.visuals.length} visuals</span>
    </div>
    <div id="document-container" class="document-container"></div>
  `;

  const docContainer = document.getElementById('document-container');
  renderDocumentHTML(docContainer, deck.document);

  // Mount existing visuals (sorted by textAnchor.startOffset)
  const sortedVisuals = [...deck.visuals].sort((a, b) => a.textAnchor.startOffset - b.textAnchor.startOffset);
  for (const visual of sortedVisuals) {
    mountVisualPanelAtAnchor(docContainer, deck, visual);
  }

  // Floating ⚡ toolbar wires to selection
  mountFloatingToolbar(docContainer, (textAnchor) => {
    handleVisualizeTrigger(deck, docContainer, textAnchor);
  });
}

function renderDocumentHTML(container, document) {
  // Build paragraph blocks with heading levels marked.
  // Strategy: split flowingText by newlines; each non-empty line = one paragraph.
  // If a line starts at a heading.offset, render with heading class.
  const lines = [];
  let cursor = 0;
  const headingsByOffset = new Map();
  for (const h of document.headings) {
    headingsByOffset.set(h.offset, h);
  }
  const textParts = document.flowingText.split('\n');
  for (const part of textParts) {
    const heading = headingsByOffset.get(cursor);
    const className = heading ? `heading h${heading.level}` : 'body';
    lines.push({ text: part, className, offset: cursor });
    cursor += part.length + 1; // +1 for the \n
  }

  container.innerHTML = lines
    .filter((l) => l.text.length > 0)
    .map((l) => `<div class="${l.className}" data-offset="${l.offset}">${escapeHtml(l.text)}</div>`)
    .join('');
}

async function handleVisualizeTrigger(deck, docContainer, textAnchor) {
  // BYOK API key
  let apiKey = localStorage.getItem(ANTHROPIC_KEY_STORAGE);
  if (!apiKey) {
    const entered = prompt('Anthropic API key (saved to localStorage):');
    if (!entered) return;
    localStorage.setItem(ANTHROPIC_KEY_STORAGE, entered);
    apiKey = entered;
  }

  // Add visual to deck model
  const visual = deckModel.addVisual(deck, textAnchor);
  deckModel.saveDeckToStorage(deck);

  // Mount the visual-panel placeholder (it shows "lifting..." until variants come in)
  const panel = mountVisualPanelAtAnchor(docContainer, deck, visual);

  // Start the visual-pipeline (6 lifts serial)
  const pipeline = createVisualPipeline(
    deck,
    visual.id,
    apiKey,
    { callLiftLLM, parseLiftResponse, sanitize2dSceneData, saveDeck: (d) => deckModel.saveDeckToStorage(d) },
    {
      onEvent: (event) => {
        // Re-render panel as variants come in
        if (panel && typeof panel.refresh === 'function') panel.refresh();
      },
    },
  );
  await pipeline.start();
}

function mountVisualPanelAtAnchor(docContainer, deck, visual) {
  // Find the document line that contains the textAnchor.endOffset.
  // Insert the visual-panel DIV immediately AFTER that line.
  const lines = docContainer.querySelectorAll('.body, .heading');
  let anchorLine = null;
  for (const line of lines) {
    const offset = parseInt(line.dataset.offset, 10);
    if (offset >= visual.textAnchor.endOffset) break;
    anchorLine = line;
  }
  if (!anchorLine) anchorLine = lines[lines.length - 1];

  const panelWrapper = document.createElement('div');
  panelWrapper.className = 'visual-panel-wrapper';
  panelWrapper.dataset.visualId = visual.id;
  anchorLine.insertAdjacentElement('afterend', panelWrapper);

  return mountVisualPanel(panelWrapper, deck, visual.id);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

- [ ] **Step 2: Verify syntax**

```bash
node --check sdf-js/src/present/document-view.js && echo "syntax OK"
```

(Will error on missing visual-panel.js import — that's Phase 7. Skip strictly-check-only verification at this point; ensure JavaScript syntax is OK.)

Actually `node --check` does not resolve imports — it only checks JS syntax. So this should pass.

- [ ] **Step 3: Commit Task 6.2**

```bash
git add sdf-js/src/present/document-view.js
git commit -m "Sprint 2 Phase 6.2: document-view.js (Napkin document viewer mount)

mountDocumentView(target, deckId) renders deck.document as flowing
paragraphs (Canvas2D + system fonts, no SDF text per spec rule). Each
heading.offset becomes a styled .heading.h<level> block; body text is
.body class.

Wires floating-toolbar to docContainer. Selection → ⚡ → handleVisualizeTrigger:
  1. BYOK Anthropic key prompt if needed
  2. deckModel.addVisual(deck, textAnchor)
  3. saveDeckToStorage
  4. mountVisualPanelAtAnchor (visual-panel placeholder shows 'lifting…')
  5. createVisualPipeline + start (6 lifts serial)
  6. onEvent refreshes the visual-panel as each variant lands

Mounts pre-existing visuals from deck.visuals[] at their textAnchor offsets
on page load (sorted by startOffset).

visual-panel.js import comes in Phase 7."
```

---

## Phase 7 — `visual-panel.js` + `branding-palettes.js` + CSS

### Task 7.1: Create branding-palettes.js (5 curated palette presets)

**Files:**
- Create: `sdf-js/src/present/branding-palettes.js`

- [ ] **Step 1: Create branding-palettes.js**

```js
// =============================================================================
// branding-palettes.js — Atlas Present Sprint 2 curated palette presets
// -----------------------------------------------------------------------------
// 5-8 presets used by Swap Branding sub-panel. Each preset has:
//   - id: stable string id (stored in visual.activeBranding)
//   - label: UI display name
//   - bg: background color (silhouette renderer background option)
//   - silhouetteColor: [r,g,b] for silhouette renderer foreground
//
// Sprint 2 MVP keeps it simple: palettes affect silhouette/lines/crayon/topo
// renderer color choice. More elaborate per-element coloring is Sprint 3+.
// =============================================================================

/**
 * @typedef {object} BrandingPreset
 * @property {string} id
 * @property {string} label
 * @property {[number,number,number]} bg
 * @property {[number,number,number]} silhouetteColor
 */

export const BRANDING_PALETTES = [
  { id: 'mono-light', label: 'Mono Light', bg: [248, 248, 246], silhouetteColor: [40, 40, 40] },
  { id: 'mono-dark',  label: 'Mono Dark',  bg: [28, 28, 32],    silhouetteColor: [220, 220, 220] },
  { id: 'warm-paper', label: 'Warm Paper', bg: [252, 244, 224], silhouetteColor: [80, 50, 30] },
  { id: 'cool-mint',  label: 'Cool Mint',  bg: [220, 240, 232], silhouetteColor: [40, 90, 80] },
  { id: 'high-contrast', label: 'High Contrast', bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
];

/**
 * Get a preset by id; fallback to first preset if id not found.
 *
 * @param {string} id
 * @returns {BrandingPreset}
 */
export function getPalette(id) {
  return BRANDING_PALETTES.find((p) => p.id === id) || BRANDING_PALETTES[0];
}
```

- [ ] **Step 2: Verify**

```bash
node --check sdf-js/src/present/branding-palettes.js && echo "syntax OK"
```

- [ ] **Step 3: Commit Task 7.1**

```bash
git add sdf-js/src/present/branding-palettes.js
git commit -m "Sprint 2 Phase 7.1: branding-palettes.js (5 curated palette presets)

5 presets for Swap Branding sub-panel:
- mono-light (default), mono-dark
- warm-paper, cool-mint, high-contrast

Each preset has {id, label, bg, silhouetteColor}. Used by visual-panel
when rendering the active visual with the chosen background + foreground.

getPalette(id) returns matching preset or first as fallback.

Sprint 2 MVP: palette affects renderer bg + fg only (per-element coloring
is Sprint 3+ scope per spec §8 deferrals)."
```

### Task 7.2: Create visual-panel.js (image + side picker + image menu)

**Files:**
- Create: `sdf-js/src/present/visual-panel.js`

- [ ] **Step 1: Create visual-panel.js**

```js
// =============================================================================
// visual-panel.js — Atlas Present Sprint 2 embedded visual + picker + menu
// -----------------------------------------------------------------------------
// One visual = one mounted panel. Manages:
//   - main canvas rendering the selected variant via activeEffect renderer
//   - left-side picker panel (toggleable) showing 6 variant thumbnails
//   - image context menu (4 items: Swap Layout / Effects / Export / Swap Branding)
//
// Menu sub-panels:
//   - Swap Layout: re-opens picker (cached variants, no extra cost)
//   - Effects: 4 renderer thumbnails (silhouette/lines/crayon/topo)
//   - Export Visual: canvas.toDataURL → download PNG
//   - Swap Branding: 5 palette preset thumbnails (from branding-palettes.js)
//
// Spec: docs/superpowers/specs/2026-06-20-atlas-present-sprint-2-napkin-paragraph-design.md §6 step 8-13
// =============================================================================

import * as deckModel from './deck-model.js';
import { compileScene, createRendererForId } from '../compositor-api.js';
import { BRANDING_PALETTES, getPalette } from './branding-palettes.js';

const RENDERERS = ['silhouette', 'lines', 'crayon', 'topo'];

/**
 * Mount a visual panel for one visual into the wrapper element.
 *
 * @param {HTMLElement} wrapper
 * @param {object} deck
 * @param {string} visualId
 * @returns {{refresh: Function, destroy: Function}}
 */
export function mountVisualPanel(wrapper, deck, visualId) {
  let pickerOpen = false;
  let menuOpen = false;

  function getVisual() {
    return deck.visuals.find((v) => v.id === visualId);
  }

  function render() {
    const visual = getVisual();
    if (!visual) {
      wrapper.innerHTML = '<div class="visual-panel-error">visual not found</div>';
      return;
    }
    wrapper.innerHTML = `
      <div class="visual-panel">
        ${pickerOpen ? renderPicker(visual) : ''}
        <div class="visual-main">
          ${renderMainArea(visual)}
        </div>
      </div>
      ${menuOpen ? renderMenu(visual) : ''}
    `;
    attachEventHandlers(visual);
    renderActiveVariantCanvas(visual);
  }

  function renderMainArea(visual) {
    if (visual.status === 'pending') {
      return `<div class="visual-placeholder">⏳ pending…</div>`;
    }
    const sel = deckModel.getSelectedVisualVariant(visual);
    if (!sel) return `<div class="visual-placeholder">no variant</div>`;
    if (sel.status === 'lifting') {
      return `<div class="visual-placeholder">⏳ lifting variant ${visual.selectedVariantIndex + 1}/6…</div>`;
    }
    if (sel.status === 'error') {
      return `<div class="visual-placeholder error">⚠ ${escapeHtml(sel.liftError || 'error')}</div>`;
    }
    if (sel.status === 'pending') {
      return `<div class="visual-placeholder">⏳ pending…</div>`;
    }
    // ready
    return `<canvas class="visual-canvas" width="600" height="360" data-visual-id="${visual.id}"></canvas>`;
  }

  function renderPicker(visual) {
    return `
      <div class="visual-picker">
        <div class="picker-header">
          <span>Variants (${visual.variants.filter((v) => v.status === 'ready').length}/${visual.variants.length} ready)</span>
          <button class="picker-close" aria-label="Close">✕</button>
        </div>
        <div class="picker-thumbs">
          ${visual.variants
            .map(
              (v, i) => `
                <div class="picker-thumb ${i === visual.selectedVariantIndex ? 'selected' : ''} ${v.status}" data-variant-index="${i}">
                  <canvas class="thumb-canvas" width="120" height="80" data-variant-index="${i}"></canvas>
                  <div class="thumb-label">${escapeHtml(v.archetype || v.status)}</div>
                </div>
              `,
            )
            .join('')}
        </div>
      </div>
    `;
  }

  function renderMenu(visual) {
    return `
      <div class="visual-menu">
        <button data-action="swap-layout">Swap Layout</button>
        <button data-action="effects">Effects (${visual.activeEffect})</button>
        <button data-action="export">Export Visual</button>
        <button data-action="swap-branding">Swap Branding</button>
      </div>
    `;
  }

  function attachEventHandlers(visual) {
    wrapper.querySelector('.visual-canvas')?.addEventListener('click', () => {
      menuOpen = !menuOpen;
      render();
    });
    wrapper.querySelector('.picker-close')?.addEventListener('click', () => {
      pickerOpen = false;
      render();
    });
    wrapper.querySelectorAll('.picker-thumb').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.variantIndex, 10);
        if (visual.variants[idx]?.status === 'ready') {
          deckModel.selectVisualVariant(deck, visualId, idx);
          deckModel.saveDeckToStorage(deck);
          render();
        }
      });
    });
    wrapper.querySelectorAll('.visual-menu button').forEach((el) => {
      el.addEventListener('click', () => {
        handleMenuAction(el.dataset.action, visual);
      });
    });
  }

  function handleMenuAction(action, visual) {
    menuOpen = false;
    switch (action) {
      case 'swap-layout':
        pickerOpen = true;
        render();
        break;
      case 'effects':
        cycleEffect(visual);
        render();
        break;
      case 'export':
        exportPng(visual);
        break;
      case 'swap-branding':
        cycleBranding(visual);
        render();
        break;
    }
  }

  function cycleEffect(visual) {
    const curIdx = RENDERERS.indexOf(visual.activeEffect);
    const next = RENDERERS[(curIdx + 1) % RENDERERS.length];
    deckModel.setActiveEffect(deck, visualId, next);
    deckModel.saveDeckToStorage(deck);
  }

  function cycleBranding(visual) {
    const curIdx = BRANDING_PALETTES.findIndex((p) => p.id === visual.activeBranding);
    const next = BRANDING_PALETTES[(curIdx + 1) % BRANDING_PALETTES.length].id;
    deckModel.setActiveBranding(deck, visualId, next);
    deckModel.saveDeckToStorage(deck);
  }

  function exportPng(visual) {
    const canvas = wrapper.querySelector('.visual-canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${(visual.textAnchor.text || 'visual').slice(0, 30).replace(/[^a-z0-9_-]/gi, '-')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function renderActiveVariantCanvas(visual) {
    const canvas = wrapper.querySelector('.visual-canvas');
    if (!canvas) return;
    const sel = deckModel.getSelectedVisualVariant(visual);
    if (!sel || sel.status !== 'ready' || !sel.sceneData) return;
    renderVariantToCanvas(canvas, sel.sceneData, visual.activeEffect, visual.activeBranding);

    // Also render thumbnails inside picker
    if (pickerOpen) {
      wrapper.querySelectorAll('.thumb-canvas').forEach((thumb) => {
        const idx = parseInt(thumb.dataset.variantIndex, 10);
        const v = visual.variants[idx];
        if (v?.status === 'ready' && v.sceneData) {
          renderVariantToCanvas(thumb, v.sceneData, visual.activeEffect, visual.activeBranding);
        } else {
          const ctx = thumb.getContext('2d');
          ctx.fillStyle = '#eee';
          ctx.fillRect(0, 0, thumb.width, thumb.height);
          ctx.fillStyle = '#999';
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(v?.status || '·', thumb.width / 2, thumb.height / 2);
        }
      });
    }
  }

  function renderVariantToCanvas(canvas, sceneData, effect, brandingId) {
    try {
      const renderer = createRendererForId(effect, canvas);
      const compiled = compileScene(sceneData);
      const palette = getPalette(brandingId);
      // computeView replacement (Sprint 1.5 had computeView; we inline here since
      // linear-layout.js was deleted in Phase 1)
      const view = computeAutoFitView(sceneData);
      renderer.render([{ sdf: compiled.sdf, color: palette.silhouetteColor }], {
        background: palette.bg,
        view,
      });
    } catch (e) {
      console.error('[visual-panel] render error:', e);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fee';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#a55';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('render error', canvas.width / 2, canvas.height / 2);
    }
  }

  function computeAutoFitView(sceneData) {
    // Inline copy of Sprint 1.5's computeView since linear-layout.js was deleted
    const subjects = sceneData?.subjects ?? [];
    if (subjects.length === 0) return 0.75;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of subjects) {
      const t = s.transform?.translate ?? [0, 0, 0];
      if (t[0] < minX) minX = t[0];
      if (t[1] < minY) minY = t[1];
      if (t[0] > maxX) maxX = t[0];
      if (t[1] > maxY) maxY = t[1];
    }
    const halfWidth = Math.max(0.5, (maxX - minX) / 2);
    const halfHeight = Math.max(0.5, (maxY - minY) / 2);
    const raw = Math.max(halfWidth, halfHeight) * 1.5;
    return Math.min(50, Math.max(0.5, raw));
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Initial render
  render();

  return {
    refresh: render,
    destroy: () => {
      wrapper.innerHTML = '';
    },
  };
}
```

- [ ] **Step 2: Verify syntax**

```bash
node --check sdf-js/src/present/visual-panel.js && echo "syntax OK"
```

- [ ] **Step 3: Commit Task 7.2**

```bash
git add sdf-js/src/present/visual-panel.js
git commit -m "Sprint 2 Phase 7.2: visual-panel.js (embedded visual + picker + menu)

mountVisualPanel(wrapper, deck, visualId) returns {refresh, destroy}.

Renders:
- Main canvas with active variant via activeEffect renderer + activeBranding palette
- Click main canvas → toggle 4-item context menu (Swap Layout / Effects / Export / Swap Branding)
- Swap Layout → toggle left-side picker with 6 thumbnails
- Effects → cycle through 4 renderers (silhouette → lines → crayon → topo)
- Export → canvas.toDataURL PNG download
- Swap Branding → cycle through 5 palette presets

Picker thumbnails: 6 small canvases, each rendering its variant. Click
ready thumbnail → selectVisualVariant + saveDeck + re-render main.

computeAutoFitView inlined (Sprint 1.5's computeView from deleted
linear-layout.js)."
```

### Task 7.3: REWRITE style.css for Sprint 2

**Files:**
- REWRITE: `sdf-js/examples/present/style.css`

- [ ] **Step 1: Use Write tool to fully replace `sdf-js/examples/present/style.css`**

```css
/* =============================================================================
   Atlas Present Sprint 2 styles — document viewer + floating toolbar +
   visual panel + side picker + image menu
============================================================================= */

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, sans-serif;
  background: #fafafa;
  color: #222;
}

a { color: #2b6cb0; text-decoration: none; }
a:hover { text-decoration: underline; }

.page-pad { padding: 32px; }

/* === Library page === */
.library-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px;
}

.library-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.library-header h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 600;
}

.library-header button {
  padding: 8px 16px;
  background: #2b6cb0;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.library-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.library-card {
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.library-card h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}

.library-card .meta {
  color: #6b7280;
  font-size: 13px;
}

.library-card .actions {
  display: flex;
  gap: 8px;
  margin-top: auto;
}

.library-card .actions button {
  padding: 6px 12px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.library-card .actions button.primary {
  background: #2b6cb0;
  color: white;
  border-color: #2b6cb0;
}

/* === Document viewer === */
.deck-view-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 32px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  position: sticky;
  top: 0;
  z-index: 10;
}

.deck-view-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  flex: 1;
}

.deck-view-header .meta {
  color: #6b7280;
  font-size: 13px;
}

.document-container {
  max-width: 720px;
  margin: 32px auto;
  padding: 0 32px 80px;
  line-height: 1.7;
  font-size: 16px;
  color: #1f2937;
}

.document-container .heading {
  font-weight: 600;
  margin: 24px 0 12px;
  color: #111827;
}

.document-container .heading.h1 {
  font-size: 26px;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 8px;
}

.document-container .heading.h2 {
  font-size: 22px;
}

.document-container .heading.h3 {
  font-size: 18px;
}

.document-container .body {
  margin: 8px 0;
}

/* === Floating toolbar (selection ⚡) === */
.floating-toolbar {
  position: absolute;
  z-index: 1000;
  background: #111827;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  padding: 4px;
  user-select: none;
}

.floating-trigger {
  background: transparent;
  color: white;
  border: none;
  padding: 8px 14px;
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
}

.floating-trigger:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* === Visual panel === */
.visual-panel-wrapper {
  margin: 24px 0;
}

.visual-panel {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.visual-picker {
  width: 280px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
}

.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 13px;
  color: #6b7280;
}

.picker-close {
  background: none;
  border: none;
  cursor: pointer;
  color: #6b7280;
  font-size: 16px;
}

.picker-thumbs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.picker-thumb {
  cursor: pointer;
  padding: 4px;
  border: 2px solid transparent;
  border-radius: 4px;
}

.picker-thumb.selected {
  border-color: #2b6cb0;
}

.picker-thumb canvas {
  display: block;
  width: 100%;
  background: #f3f4f6;
  border-radius: 2px;
}

.picker-thumb .thumb-label {
  font-size: 11px;
  text-align: center;
  margin-top: 4px;
  color: #6b7280;
}

.visual-main {
  flex: 1;
  min-height: 200px;
}

.visual-canvas {
  display: block;
  width: 100%;
  max-width: 600px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
}

.visual-placeholder {
  padding: 40px;
  background: #f3f4f6;
  border-radius: 8px;
  text-align: center;
  color: #6b7280;
}

.visual-placeholder.error {
  background: #fee2e2;
  color: #991b1b;
}

/* === Image context menu === */
.visual-menu {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding: 8px;
  background: #f9fafb;
  border-radius: 6px;
}

.visual-menu button {
  padding: 6px 12px;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.visual-menu button:hover {
  background: #f3f4f6;
}
```

- [ ] **Step 2: Commit Task 7.3**

```bash
git add sdf-js/examples/present/style.css
git commit -m "Sprint 2 Phase 7.3: style.css REWRITE for Napkin document viewer

Drops Sprint 1.5 info-graphic / deck-view / variant-picker styles.

New styles:
- Library page (header + grid + cards)
- Document viewer (deck-view-header + document-container with heading
  styles h1/h2/h3)
- Floating toolbar (⚡ above selection, dark theme, absolute positioned)
- Visual panel (main canvas + picker side panel on left)
- Visual picker (2-col grid of 6 thumbnails + close X + selected border)
- Visual menu (4 button row appearing after click on main canvas)
- Visual placeholder (pending / lifting / error states)

Layout: max-width 720px text column + visual panel inside flow."
```

### Task 7.4: REWRITE library-page.js for Sprint 2 + update index.html router

**Files:**
- REWRITE: `sdf-js/src/present/library-page.js`
- Modify: `sdf-js/examples/present/index.html`

- [ ] **Step 1: Use Write tool to fully replace library-page.js**

```js
// =============================================================================
// library-page.js — Atlas Present Sprint 2 library landing page
// -----------------------------------------------------------------------------
// Lists existing decks + Import PDF button. View button routes to
// /examples/present/?deck=<id> which is handled by index.html router →
// document-view.js mountDocumentView.
//
// Sprint 2 changes vs Sprint 1.5:
// - View button opens document-view (Napkin), not deck-view (info graphic)
// - Card meta shows "<page count> pages · <visual count> visuals" instead
//   of section count / lifting progress
// - No batch-lift status (lifting is now user-triggered per-selection inside
//   document-view)
//
// Spec: docs/superpowers/specs/2026-06-20-atlas-present-sprint-2-napkin-paragraph-design.md §6
// =============================================================================

import * as deckModel from './deck-model.js';
import { parsePDFFromBytes } from '../parser/index.js';
import { extractDocumentData } from './pdf-text-extractor.js';

export async function mountLibraryPage(target) {
  const decks = deckModel.listDecks();
  target.innerHTML = `
    <div class="library-page">
      <div class="library-header">
        <h1>Atlas Present <span style="font-weight:400; color:#6b7280; font-size:18px;">Library</span></h1>
        <button id="btn-import">+ Import PDF</button>
        <input type="file" id="file-input" accept="application/pdf" style="display:none" />
      </div>
      <div class="library-grid">
        ${decks.length === 0 ? `<div class="page-pad" style="color:#6b7280;">No decks yet. Click "+ Import PDF" to start.</div>` : decks.map(renderCard).join('')}
      </div>
    </div>
  `;

  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('file-input').click();
  });
  document.getElementById('file-input').addEventListener('change', handleFileImport);

  for (const d of decks) {
    document.getElementById(`btn-view-${d.id}`)?.addEventListener('click', () => handleView(d.id));
    document.getElementById(`btn-rename-${d.id}`)?.addEventListener('click', () => handleRename(d.id));
    document.getElementById(`btn-delete-${d.id}`)?.addEventListener('click', () => handleDelete(d.id));
  }
}

function renderCard(deck) {
  const pageCount = deck.document?.pages?.length ?? deck.source?.pageCount ?? 0;
  const visualCount = deck.visuals?.length ?? 0;
  const updated = relativeTime(deck.updatedAt);
  return `
    <div class="library-card">
      <h3>${escapeHtml(deck.title)}</h3>
      <div class="meta">${pageCount} pages · ${visualCount} visuals</div>
      <div class="meta">Updated ${updated}</div>
      <div class="actions">
        <button id="btn-view-${deck.id}" class="primary">View</button>
        <button id="btn-rename-${deck.id}">Rename</button>
        <button id="btn-delete-${deck.id}">Delete</button>
      </div>
    </div>
  `;
}

async function handleFileImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    alert('Only .pdf supported in Sprint 2 (Sprint 3+ adds .pptx / .docx)');
    return;
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  let slides;
  try {
    slides = await parsePDFFromBytes(bytes, file.name);
  } catch (err) {
    alert(`PDF parse failed: ${err.message}`);
    return;
  }

  const document = extractDocumentData(slides);
  const deck = deckModel.createDeck(file.name.replace(/\.pdf$/i, ''), {
    type: 'pdf',
    fileName: file.name,
    pageCount: slides.length,
  });
  deckModel.setDocument(deck, document);
  deckModel.saveDeckToStorage(deck);

  // Refresh library page
  await mountLibraryPage(document.getElementById('route-target') || document.body);
}

function handleView(id) { location.search = `?deck=${id}`; }
function handleRename(id) {
  const deck = deckModel.loadDeckFromStorage(id);
  if (!deck) return;
  const next = prompt('New name:', deck.title);
  if (next && next.trim()) {
    deckModel.renameDeck(id, next.trim());
    mountLibraryPage(document.getElementById('route-target') || document.body);
  }
}
function handleDelete(id) {
  if (confirm('Delete this deck?')) {
    deckModel.deleteDeckFromStorage(id);
    mountLibraryPage(document.getElementById('route-target') || document.body);
  }
}

function relativeTime(ts) {
  const delta = Date.now() - ts;
  const m = Math.floor(delta / 60000);
  const h = Math.floor(delta / 3600000);
  const d = Math.floor(delta / 86400000);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return 'just now';
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```

- [ ] **Step 2: Modify `sdf-js/examples/present/index.html` router to point at document-view**

Open `sdf-js/examples/present/index.html`. Find the existing script block (it imports `deck-view.js` after Sprint 1.5):

```js
      const { mountDeckView } = await import('../../src/present/deck-view.js');
      await mountDeckView(target, deckId);
```

Replace with:

```js
      const { mountDocumentView } = await import('../../src/present/document-view.js');
      await mountDocumentView(target, deckId);
```

(Note: `deck-view.js` was deleted in Phase 1, so the broken import is now fixed.)

- [ ] **Step 3: Verify syntax of all JS files**

```bash
node --check sdf-js/src/present/library-page.js && echo "library-page OK"
node --check sdf-js/src/present/document-view.js && echo "document-view OK"
node --check sdf-js/src/present/visual-panel.js && echo "visual-panel OK"
node --check sdf-js/src/present/floating-toolbar.js && echo "floating-toolbar OK"
node --check sdf-js/src/present/branding-palettes.js && echo "branding-palettes OK"
node --check sdf-js/src/present/pdf-text-extractor.js && echo "pdf-text-extractor OK"
```

Expected: all OK.

- [ ] **Step 4: Run full npm test**

```bash
npm test 2>&1 | tail -5
```

Expected: `33/33 test files passed`.

- [ ] **Step 5: Commit Task 7.4**

```bash
git add sdf-js/src/present/library-page.js sdf-js/examples/present/index.html
git commit -m "Sprint 2 Phase 7.4: library-page.js REWRITE + index.html router update

REWRITE library-page.js for Sprint 2:
- View button routes to document-view (Napkin), not deck-view (Sprint 1.5 info graphic)
- Card meta: '<page count> pages · <visual count> visuals' (no lifting status,
  since lifts are now user-triggered per-selection inside document-view)
- handleFileImport: parsePDFFromBytes → extractDocumentData → setDocument →
  saveDeckToStorage (no batch lift on import — lifts are user-triggered later)

Modify index.html router: ?deck=<id> path now imports document-view.js
mountDocumentView (was deck-view.js mountDeckView, file deleted in Phase 1).

npm test 33/33.

This commit completes the Layer 2 code rewrite. Browse smoke verification
in Phase 8."
```

---

## Phase 8 — Browse smoke verify (REAL Anthropic API)

Per Sprint 1.5 lesson #1: no mock-only verification. This phase MUST use a real PDF + real Anthropic API key.

### Task 8.1: Real PDF browse smoke

**Files:** none modified

- [ ] **Step 1: Ensure dev server is running**

```bash
lsof -i :8001 2>&1 | head -3
```

If empty (no server), start in background:

```bash
cd sdf-js && python3 dev-server.py 8001 &
sleep 2
cd /Users/hexiaoyang/Documents/sdf-main
```

- [ ] **Step 2: Setup browse skill**

```bash
B=~/.claude/skills/gstack/browse/dist/browse
if [ -x "$B" ]; then echo "READY: $B"; else echo "NEEDS_SETUP"; fi
```

If NEEDS_SETUP:

```bash
cd ~/.claude/skills/gstack/browse && ./setup
cd /Users/hexiaoyang/Documents/sdf-main
```

- [ ] **Step 3: Browse to library, clear localStorage, screenshot empty state**

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B goto "http://localhost:8001/examples/present/"
$B wait --networkidle 2>&1 | tail -3
$B js "localStorage.removeItem('atlas-decks')"
$B reload
sleep 1
$B text 2>&1 | head -10
$B console --errors 2>&1 | head -10
$B screenshot /tmp/sprint-2-phase-8-library-empty.png
```

Read the screenshot. Expected:
- "Atlas Present Library" title visible
- "+ Import PDF" button visible
- "No decks yet" message
- Console clean (no errors)

If console errors: investigate (probably an import path issue or a missing function from a phase). Fix before continuing.

- [ ] **Step 4: Inject a small synthetic deck with document data (no real lift yet)**

Verify the document viewer mount works before paying for real API lifts:

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B js '
const dm = await import("/src/present/deck-model.js");
const deck = dm.createDeck("Smoke Doc", { type: "pdf", fileName: "smoke.pdf", pageCount: 1 });
dm.setDocument(deck, {
  flowingText: "Introduction\nThe agent explores the environment actively. It builds hypotheses about causal structure.\nMethods\nWe use a closed-loop recipe with exploration, representation, and decision making.",
  pages: [{ startOffset: 0, endOffset: 192, pageNumber: 1 }],
  headings: [
    { offset: 0, level: 1, text: "Introduction" },
    { offset: 110, level: 1, text: "Methods" }
  ]
});
dm.saveDeckToStorage(deck);
return "injected deck id: " + deck.id;
'
$B reload
sleep 1
$B screenshot /tmp/sprint-2-phase-8-library-with-deck.png
```

Read screenshot. Expected: Library shows "Smoke Doc" card with "1 pages · 0 visuals".

- [ ] **Step 5: Click View → document viewer renders**

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B click "text=View"
sleep 2
$B text 2>&1 | head -20
$B console --errors 2>&1 | head -10
$B screenshot /tmp/sprint-2-phase-8-document-view.png
```

Read screenshot. Expected:
- ← Library link + deck title + page/visual count in header
- Document text rendered in flowing paragraphs
- "Introduction" rendered as h1-styled heading
- "Methods" rendered as h1-styled heading
- Body text below each heading
- Console clean

- [ ] **Step 6: Simulate a text selection + ⚡ trigger (manual verification)**

The floating toolbar fires on browser `selectionchange` event. To verify it appears, simulate a selection:

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B js '
const docContainer = document.getElementById("document-container");
const firstBody = docContainer.querySelector(".body");
const range = document.createRange();
range.selectNodeContents(firstBody);
const sel = window.getSelection();
sel.removeAllRanges();
sel.addRange(range);
// Fire selectionchange manually (browsers may need this in headless mode)
document.dispatchEvent(new Event("selectionchange"));
return "selected: " + sel.toString().slice(0, 40);
'
sleep 1
$B screenshot /tmp/sprint-2-phase-8-selection-with-toolbar.png
$B console --errors 2>&1 | head -10
```

Read screenshot. Expected: floating ⚡ "Generate" button visible above the selected text. If not visible (headless may not render selection highlights), at least verify no console errors.

- [ ] **Step 7: REAL Anthropic API lift trigger (USES REAL TOKENS)**

**Important**: this step costs ~$0.20-0.30 in Anthropic API tokens (6 lifts × ~$0.04 each, after caching). Confirm before running.

To trigger an actual ⚡ programmatically (bypassing the headless-selection limitation):

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B js '
// Verify there is a saved API key (otherwise prompt blocks headless)
const k = localStorage.getItem("atlas-anthropic-key");
if (!k) return "MISSING_API_KEY — set via DevTools console then re-run";
return "API_KEY_PRESENT: yes";
'
```

If output is `MISSING_API_KEY`: user must manually set the key. Run:

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B js 'localStorage.setItem("atlas-anthropic-key", prompt("Anthropic API key (will save to localStorage):"))'
```

(headless can't open prompt; if you have the key as an env var, use `$B js "localStorage.setItem(\"atlas-anthropic-key\", \"sk-ant-...\")"` instead.)

Once key is set, trigger a visual generation:

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B js '
const dm = await import("/src/present/deck-model.js");
const docView = document.getElementById("document-container");
const visualsBefore = (dm.listDecks()[0]?.visuals?.length) || 0;

// Inject by calling document-view.js floating-toolbar trigger directly:
// fastest path = synthesize a textAnchor and call its handler.
const visualHelper = await import("/src/present/document-view.js");
// document-view does not currently export handleVisualizeTrigger publicly;
// alternative: simulate a real selection + dispatch event.
// We will use the latter:
const firstBody = docView.querySelector(".body");
const range = document.createRange();
range.selectNodeContents(firstBody);
window.getSelection().removeAllRanges();
window.getSelection().addRange(range);
document.dispatchEvent(new Event("selectionchange"));
await new Promise(r => setTimeout(r, 200));
// Click the floating toolbar button
const button = document.querySelector(".floating-trigger");
if (button) button.click();
return "lift trigger fired";
'
echo "Waiting ~60 seconds for 6 sequential lifts..."
sleep 60
$B screenshot /tmp/sprint-2-phase-8-after-lift.png
$B console --errors 2>&1 | head -20
```

Read screenshot. Expected:
- Visual panel appears inline below the selected paragraph
- Picker panel on left shows 6 thumbnails (some may still be lifting if 60s wasn't enough)
- Selected variant (variants[0]) renders in main canvas
- Console: occasional "lifting" messages OK; no red errors

- [ ] **Step 8: Verify archetype variance (CRITICAL Sprint 1.5 lesson)**

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B js '
const dm = await import("/src/present/deck-model.js");
const decks = dm.listDecks();
const deck = decks[0];
if (!deck || deck.visuals.length === 0) return "NO_VISUALS";
const visual = deck.visuals[0];
const archetypes = visual.variants.map(v => v.archetype || v.status);
const uniqueArchetypes = [...new Set(archetypes.filter(a => a && a !== "unknown" && a !== "pending" && a !== "lifting"))];
return JSON.stringify({ allArchetypes: archetypes, uniqueArchetypes, count: uniqueArchetypes.length });
'
```

Expected: at least 2 different archetypes across 6 variants (per spec §9 acceptance criterion).

If only 1 archetype: that's the documented Sprint 1.5 limitation on text-heavy content. **Document this honestly in PR body** — do NOT pretend divergence works.

- [ ] **Step 9: Click a different variant in picker → main re-renders**

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B js '
const thumbs = document.querySelectorAll(".picker-thumb.ready, .picker-thumb");
const readyThumbs = [...thumbs].filter(t => t.classList.contains("ready") || t.querySelector("canvas"));
if (readyThumbs.length < 2) return "NEED_MORE_READY";
readyThumbs[1].click();
return "clicked variant 1";
'
sleep 1
$B screenshot /tmp/sprint-2-phase-8-variant-swap.png
```

Verify main canvas changes (different variant now selected).

- [ ] **Step 10: Click main canvas → image menu appears**

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B js 'document.querySelector(".visual-canvas")?.click()'
sleep 1
$B screenshot /tmp/sprint-2-phase-8-image-menu.png
```

Verify: menu with 4 buttons appears (Swap Layout / Effects / Export Visual / Swap Branding).

- [ ] **Step 11: Click Effects → renderer cycles**

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B js 'document.querySelector(".visual-menu button[data-action=\"effects\"]")?.click()'
sleep 2
$B screenshot /tmp/sprint-2-phase-8-effects-swap.png
```

Verify: canvas re-renders with different renderer style (lines / crayon / topo cycling from silhouette).

- [ ] **Step 12: Click Swap Branding → palette cycles**

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B js '
document.querySelector(".visual-canvas")?.click();
await new Promise(r => setTimeout(r, 200));
document.querySelector(".visual-menu button[data-action=\"swap-branding\"]")?.click();
'
sleep 2
$B screenshot /tmp/sprint-2-phase-8-branding-swap.png
```

Verify: canvas background + foreground colors change.

- [ ] **Step 13: Reload page → state persists**

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B reload
sleep 2
$B click "text=View"
sleep 2
$B screenshot /tmp/sprint-2-phase-8-after-reload.png
$B console --errors 2>&1 | head -10
```

Verify: visual + active effect + branding all preserved after reload.

- [ ] **Step 14: No commit needed for Phase 8 (verification only)**

If any step in 3-13 revealed bugs, fix in a separate commit before Phase 9. Otherwise proceed.

Document findings in Phase 9 PR body. Specifically:
- Archetype variance count from Step 8 (be honest)
- Any visual quality observations
- Console error count throughout
- Total tokens spent (rough estimate)

---

## Phase 9 — Push branch + open PR

### Task 9.1: Push + open PR

- [ ] **Step 1: Final pre-push checks**

```bash
git log --oneline main..HEAD
git status -s
npm test 2>&1 | tail -3
grep -nE "\b(camera|yaw|pitch|distance|focal|waypoint|cameraSequence|tween|easing)\b" sdf-js/src/present/deck-model.js | grep -vE "MUST NOT contain|NOT contain 3D vocabulary"
```

Expected:
- ~16-20 commits between main and HEAD (all "Sprint 2 Phase X.Y" prefixed)
- status clean
- npm test 33/33
- CI grep clean (no output)

- [ ] **Step 2: Push branch**

```bash
git push -u origin sprint-2-napkin-doc-viewer 2>&1 | tail -5
```

Expected: branch pushed.

- [ ] **Step 3: Open PR with honest, verified-only body**

Per Sprint 1.5 lesson #4: no "should" / "expected" / over-claims. Only verified facts.

Use the following template, filling in actual values from Phase 8 findings:

```bash
gh pr create --title "Sprint 2: Napkin-style document viewer + inline visual generation" --body "$(cat <<'EOF'
## Summary

Sprint 2 pivots Atlas Present from Sprint 1.5's batch-PDF-to-deck-info-graphic UX
to a Napkin-style flowing document viewer with selection-driven inline visual
generation. User imports PDF, sees full text with heading styles, highlights any
text, clicks ⚡ to generate 6 variants embedded inline with a side picker and an
image context menu.

## Verified facts (from Phase 8 browse smoke against REAL Anthropic API)

- PDF import → document viewer renders flowing text with h1/h2/h3 heading styles
- Text selection in document triggers floating ⚡ button above selection
- Click ⚡ → 6 sequential lifts run with opts.mode='2d'
- Image appears inline pushing text down; picker side panel on left shows
  6 variant thumbnails labeled by archetype
- Click thumbnail → selectVisualVariant + saveDeck + main canvas re-renders
- Click main canvas → context menu with 4 items (Swap Layout / Effects /
  Export Visual / Swap Branding)
- Effects cycles through silhouette / lines / crayon / topo renderers
- Swap Branding cycles through 5 palette presets
- Export Visual downloads PNG
- Page reload preserves: visual existence, selectedVariantIndex,
  activeEffect, activeBranding
- npm test 33/33 throughout
- CI grep mode-agnostic check on deck-model.js clean

## Honest observations (NOT verified claims)

- Archetype variance across 6 variants observed on real lift: <FILL IN FROM PHASE 8 STEP 8>
  - If only 1 archetype across 6: text-heavy content converges to text-card,
    same Sprint 1.5 limit. Sprint 3+ candidates: explicit archetype hints per
    variant, OR replace SDF 2D pipeline with P5.js / reveal.js (per spec §8
    deferrals).
- text-3d-* subjects observed in any lift output: <FILL IN>
  - If 0: prompt + runtime sanitize double safety working as intended
  - If > 0: runtime sanitize catching what LLM ignored
- Visual quality on text-heavy paragraphs: <subjective note>
- Tokens spent during Phase 8: ~$<estimate from API dashboard>

## Schema migration

v4 → v5 silent drop (consistent with policy from Sprint 1 v4 + Sprint 1.5).
Any pre-existing v4 deck in localStorage is automatically wiped on first
v5 load. User must re-import PDF.

## File summary

DELETE (Sprint 1.5 v4 UI):
- src/present/deck-view.js
- src/present/info-graphic-render.js
- src/present/linear-layout.js
- scripts/test-info-graphic-render.mjs
- scripts/test-linear-layout.mjs

REWRITE:
- src/present/deck-model.js (v5 schema)
- src/present/pipeline.js (per-selection visual pipeline)
- src/present/library-page.js (Sprint 2 cards)
- examples/present/style.css (Napkin UI styles)
- scripts/test-deck-model.mjs (~60 assertions)
- scripts/test-pipeline.mjs (~30 assertions)

NEW:
- src/present/pdf-text-extractor.js (SlideData → DocumentData)
- src/present/floating-toolbar.js (selection ⚡)
- src/present/document-view.js (Napkin document viewer)
- src/present/visual-panel.js (visual + picker + menu)
- src/present/branding-palettes.js (5 presets)
- scripts/test-pdf-text-extractor.mjs (~30 assertions)

MODIFY (Layer 1):
- src/compositor-api.js (callLiftLLM opts.mode + sanitize2dSceneData)
- examples/compositor/system-prompt-lift-3d.md v3.18 → v3.19

## Merge strategy

Per locked PR workflow (memory feedback_git_pr_workflow.md):
\`gh pr merge <PR#> --squash --delete-branch\`

Spec: docs/superpowers/specs/2026-06-20-atlas-present-sprint-2-napkin-paragraph-design.md (246 lines)
Plan: docs/superpowers/plans/2026-06-20-atlas-present-sprint-2-plan.md (this plan)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" 2>&1 | tail -5
```

Expected: PR URL printed.

- [ ] **Step 4: Output final summary**

After PR is opened, print this exact summary block (filling in PR # and hash range from previous git push output):

```
═══ Atlas Present Sprint 2 SHIPPED to PR ═══

PR: https://github.com/<owner>/<repo>/pull/<N>
Branch: sprint-2-napkin-doc-viewer
Range: <before-sha>..<HEAD>

Phase commits (16-20 total):
- Phase 0: pre-flight
- Phase 1: delete Sprint 1.5 UI (5 files)
- Phase 2 (4 tasks): pdf-text-extractor + TDD
- Phase 3: deck-model v5 REWRITE
- Phase 4 (2 tasks): Layer 1 lift opts.mode + sanitize + v3.19
- Phase 5: pipeline.js REWRITE
- Phase 6 (2 tasks): floating-toolbar + document-view
- Phase 7 (4 tasks): branding-palettes + visual-panel + style.css + library-page
- Phase 8: browse smoke verify (real Anthropic API)

npm test: 33/33 green throughout
Total cost during Phase 8: ~$<estimate>

Next: user reviews PR + merges with --squash --delete-branch
```

---

## Self-review

After writing this plan, check against spec:

**1. Spec coverage check:**

- Spec §3 lock 1 (Napkin UX) → Phase 6 + 7 ✓
- Spec §3 lock 2 (user text selection) → Phase 6.1 floating-toolbar ✓
- Spec §3 lock 3 (pure selection, no pre-baked ⚡) → Phase 6.1 ✓
- Spec §3 lock 4 (image inline + picker left) → Phase 7.2 + 7.3 ✓
- Spec §3 lock 5 (6 variants) → Phase 3 VARIANT_COUNT=6, Phase 5 loop ✓
- Spec §3 lock 6 (picker reopen via Swap Layout cached) → Phase 7.2 cached re-render ✓
- Spec §3 lock 7 (4-item menu) → Phase 7.2 renderMenu ✓
- Spec §3 lock 8 (kill Sprint 1.5 UI) → Phase 1 ✓
- Spec §3 lock 9 (parser with heading detection) → Phase 2 ✓
- Spec §3 lock 10 (no cost display) → none of the new UI shows cost ✓
- Spec §3 lock 11 (2D mode no SDF text, double safety) → Phase 4.1 ✓

- Spec §5 schema v5 → Phase 3 ✓
- Spec §6 data flow → Phase 6 + 7 ✓
- Spec §7 Sprint 1.5 lessons → Phase 8 step 8 (manual archetype variance check), Phase 9 step 3 (honest PR body) ✓
- Spec §9 acceptance criteria → Phase 8 + 9 verify all 7 bullets ✓
- Spec §10 hard rules → entire plan honors (PR workflow, mode-agnostic, no new deps, TDD, real browse smoke, no overclaim) ✓
- Spec §11 open implementation questions → Phase 5/6/7 resolve naturally (heading heuristic = 1.4× median, floating toolbar 8px above selection, picker 280px fixed, canvas 600x360, selection clear hides toolbar)

**2. Placeholder scan:** Plan contains no TBD/TODO. The "<FILL IN>" in Phase 9 PR body template is explicitly a placeholder to be filled at runtime from Phase 8 verified observations — not a planning placeholder.

**3. Type consistency:**
- `VisualVariant` properties (status / archetype / sceneData / liftError) consistent across Phase 3 deck-model + Phase 5 pipeline + Phase 7 visual-panel ✓
- `TextAnchor` shape (startOffset / endOffset / text) consistent across Phase 2 extractor + Phase 3 schema + Phase 5 pipeline + Phase 6 floating-toolbar ✓
- `ACTIVE_EFFECTS` value list (silhouette/lines/crayon/topo) consistent in Phase 3 deck-model + Phase 7 visual-panel ✓
- function signatures (createDeck / addVisual / updateVisualVariantStatus / etc.) match imports throughout ✓

No gaps found.

---

**Plan complete and saved to `docs/superpowers/plans/2026-06-20-atlas-present-sprint-2-plan.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — Same pattern as Sprint 1 v4 + 1.5. Dispatch fresh subagent per phase, controller verifies between phases. Branch `sprint-2-napkin-doc-viewer` already set up. Phase 9 push opens PR; user merges manually with `--squash --delete-branch`.

**2. Inline Execution** — Execute tasks in this session via executing-plans, checkpoint between phases.

Which approach?
