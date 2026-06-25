# Sprint 21 Polish Wave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Systematic visual polish of all 86 Atlas Present 2D atom files across 3 dimensions — truncation→auto-shrink, typography hierarchy uniformity, and theme palette respect — with zero regression on 100/100 npm tests.

**Architecture:** Incremental per-atom commits, one atom per commit, grouped by dimension. Each atom fix is self-contained. The `fitFontSize` helper already exists in `numbered-grid.js` as the canonical implementation — copy it verbatim into each atom that needs it. The `fitText` function stays as a final safety fallback (rarely triggered after `fitFontSize` handles overflow).

**Tech Stack:** Canvas 2D API, Inter/Inter Display web fonts, JavaScript ES modules, node test runner (100 test files)

## Global Constraints

- Branch: `sprint-21-polish-wave` (already checked out)
- NEVER `git push --force`, NEVER `git commit --amend`, NEVER `git reset --hard`
- npm test must stay 100/100 at every commit
- Atom files stay ≤ 250 LOC
- No internet URLs, no new atoms, no spec changes
- Pure text-input atoms only — no photo-dependent changes
- Commits: one commit per atom, format `polish(atom): <atom-name> — <brief desc>`
- Audit report → `.superpowers/sdd/sprint21-polish-audit.md`
- Wave report → `.superpowers/sdd/sprint21-polish-wave-report.md`

---

## Audit findings summary (pre-read)

Based on grep analysis of the 89 files (86 atom files + catalog.js + registry.js + renderer.js):

### Dimension A: fitText → fitFontSize (8 atoms)

| Atom | fitText call sites | Status |
|---|---|---|
| `charts/agenda/agenda-list.js` | line 283 (label), 295 (sublabel) | CONVERT |
| `charts/data/kpi-card.js` | line 159 (label variant 1), 166 (sublabel v1), 250 (label v2), 257 (sub v2), 345 (label v3), 352 (sub v3) | CONVERT sublabel only — label already has manual while-loop |
| `charts/data/stat-grid-large.js` | line 125 (label) | CONVERT |
| `charts/lists/number-list.js` | line 155 (label), 165 (sublabel) | CONVERT |
| `charts/lists/numbered-grid.js` | already uses fitFontSize (lines 134,150,179,196,228,245) but still has fitText defined — VERIFY clean |
| `icons/icon-grid.js` | line 145 (label), 151 (sublabel) | CONVERT |
| `charts/typography/call-to-action.js` | line 110 (heading), 122 (subheading), 205 (contact) | CONVERT |
| `icons/icon-row.js` | line 153 (label v1), 160 (sub v1), 193 (label v2), 199 (sub v2) | CONVERT |

### Dimension B: Typography violations (10 atoms)

| Atom | Violation | Fix |
|---|---|---|
| `charts/agenda/agenda-list.js:292` | `400` sublabel → `500` | `500` |
| `charts/data/dashboard-multi-kpi.js:186` | `400` sublabel → `500` | `500` |
| `charts/data/kpi-water-drop.js:260` | `400` sublabel → `500` | `500` |
| `charts/data/waterfall.js:187` | `400` x-axis label → `500` | `500` |
| `charts/diagrams/seven-s-model.js:114` | `400` sublabel → `500` | `500` |
| `charts/diagrams/radial-wheel-segmented.js:154` | `400` sublabel → `500` | `500` |
| `charts/diagrams/flow-chart.js:205` | `400` sublabel in node → `500` | `500` |
| `charts/diagrams/timeline.js:216` | `400` sublabel → `500` | `500` |
| `charts/hierarchy/pyramid.js:201` | `400` pyramid layer label → `500` | `500` |
| `charts/typography/section-number-divider.js:95` | `400` subtitle → `500` | `500` |
| `charts/lists/number-list.js:109,126` | `700` circle numbers use `"Inter Display"` — should be 700/Inter only (Display = 900 only) | drop `"Inter Display"`, keep `Inter, system-ui, sans-serif` |
| `charts/lists/numbered-grid.js:82,140,142,170,185,187,234,237` | `700` with `"Inter Display"` — same violation | drop `"Inter Display"`, keep `Inter, system-ui, sans-serif` |
| `charts/lists/feature-card-grid.js:111,174` | `700` title with `"Inter Display"` | drop `"Inter Display"` |
| `charts/typography/callout-banner.js:172` | `700` heading with `"Inter Display"` | drop `"Inter Display"` |
| `charts/data/stat-with-icon.js:143` | `700` label with `"Inter Display"` | drop `"Inter Display"` |
| `charts/diagrams/radial-wheel-segmented.js` | `700` section label — check if using Display | check |
| `charts/data/kpi-card.js:141,144,232,235,327,330` | `900` hero value WITHOUT `"Inter Display"` → add Display | add `"Inter Display", ` prefix |
| `charts/data/dashboard-multi-kpi.js:170` | `900` hero value WITHOUT Display | add Display |
| `charts/data/gauge.js:137` | `900` big number WITHOUT Display | add Display |
| `charts/data/kpi-water-drop.js:242` | `900` value WITHOUT Display | add Display |
| `charts/data/sphere-fill.js:232,331` | `900` value WITHOUT Display | add Display |
| `charts/data/isotype-people-grid.js:96` | `900` stat WITHOUT Display | add Display |
| `charts/data/isotype-stat-comparison.js:135` | `900` hero WITHOUT Display | add Display |
| `media/image-split.js:57` | `700` title with `"Inter Display"` | drop Display |
| `charts/typography/section-number-divider.js:84` | `700` title with Display | drop Display |

### Dimension C: Palette violations (conservative)

| Atom | Violation | Fix |
|---|---|---|
| `charts/hierarchy/pyramid.js:95` | `'#fafaf8'` hardcoded text color NOT wrapped in palette | accept — no clear fg palette field used here |
| `charts/lists/feature-card-grid.js:147` | `'#ffffff'` white on dark bg | accept — intentional |
| `charts/lists/numbered-grid.js:171,219` | `'#ffffff'` white number on colored circle | accept — intentional |
| `charts/data/stat-with-icon.js:174` | `'#ffffff'` white on accent bg | accept — intentional |
| `charts/typography/pull-quote-banner.js:52` | `'rgb(18,20,28)'` hardcoded dark bg — check if palette.bg exists | INSPECT |

Conservative verdict: most hardcodes are either fallbacks (`palette.bg ? rgbCss(palette.bg) : '#fafaf8'`) or white-on-dark intentional. Only `pull-quote-banner.js` needs inspection.

---

### Task 1: Write audit doc

**Files:**
- Create: `.superpowers/sdd/sprint21-polish-audit.md`

- [ ] **Step 1: Create audit doc** with per-atom findings table (copy directly from findings above, grouped by A/B/C). This is the gate for Step 2.

```bash
# Verify the superpowers/sdd dir exists
ls /Users/hexiaoyang/Documents/sdf-main/.superpowers/sdd/
```

- [ ] **Step 2: Write the audit markdown** (use Write tool at `.superpowers/sdd/sprint21-polish-audit.md`). Format: per-atom sections with A/B/C findings. At the end: list atoms with NO findings (clean).

- [ ] **Step 3: Commit**

```bash
git add .superpowers/sdd/sprint21-polish-audit.md
git commit -m "chore(sprint21): polish wave audit doc"
```

---

### Task 2: Dimension A — agenda-list fitText→fitFontSize + sublabel 400→500

**Files:**
- Modify: `sdf-js/src/present/atoms-2d/charts/agenda/agenda-list.js`

This atom needs:
- A: Replace `fitText` calls (lines 283, 295) with `fitFontSize` — add the helper function alongside `fitText`
- B: Change sublabel weight `400` → `500` (line 292)

- [ ] **Step 1: Read the file to understand current structure**

Read `sdf-js/src/present/atoms-2d/charts/agenda/agenda-list.js`, focus on lines 270-315.

- [ ] **Step 2: Add `fitFontSize` helper alongside `fitText`**

Find the `fitText` function definition (around line 303) and add `fitFontSize` BEFORE it:

```js
// Auto-shrink font size until text fits in maxW (no truncation). Returns the
// font-size that fits. Caller still must `ctx.font = ...` before measuring/drawing.
function fitFontSize(ctx, text, maxW, targetFs, minFs, fontSpec) {
  let fs = targetFs;
  while (fs > minFs) {
    ctx.font = fontSpec(fs);
    if (ctx.measureText(text).width <= maxW) return fs;
    fs--;
  }
  return minFs;
}
```

- [ ] **Step 3: Convert label fitText call (line ~280-286)**

Find the label draw block (around line 279-284):
```js
ctx.fillStyle = isHi ? rgbCss(accent) : rgbCss(fg);
ctx.font = `700 ${Math.round(labelSize)}px Inter, system-ui, sans-serif`;
// ... textAlign etc ...
ctx.fillText(
  fitText(ctx, String(it.label), labelMaxW),
```

Replace with fitFontSize approach:
```js
ctx.fillStyle = isHi ? rgbCss(accent) : rgbCss(fg);
const labelFs = fitFontSize(
  ctx,
  String(it.label),
  labelMaxW,
  Math.round(labelSize),
  Math.round(labelSize * 0.6),
  (fs) => `700 ${fs}px Inter, system-ui, sans-serif`,
);
ctx.font = `700 ${labelFs}px Inter, system-ui, sans-serif`;
// ... textAlign etc ...
ctx.fillText(String(it.label), ...);
```

Note: keep the existing `ctx.fillStyle` / `ctx.textAlign` / `ctx.textBaseline` positioning unchanged — only the font measurement and text draw change.

- [ ] **Step 4: Fix sublabel weight 400→500 AND convert sublabel fitText (lines 291-296)**

Find:
```js
ctx.fillStyle = rgbaCss(fg, 0.55);
ctx.font = `400 ${Math.round(subSize)}px Inter, system-ui, sans-serif`;
ctx.textBaseline = 'top';
ctx.fillText(
  fitText(ctx, String(it.sublabel), labelMaxW),
```

Replace with:
```js
ctx.fillStyle = rgbaCss(fg, 0.55);
const subLabelFs = fitFontSize(
  ctx,
  String(it.sublabel),
  labelMaxW,
  Math.round(subSize),
  Math.round(subSize * 0.65),
  (fs) => `500 ${fs}px Inter, system-ui, sans-serif`,
);
ctx.font = `500 ${subLabelFs}px Inter, system-ui, sans-serif`;
ctx.textBaseline = 'top';
ctx.fillText(String(it.sublabel), ...);
```

- [ ] **Step 5: Run npm test**

```bash
cd /Users/hexiaoyang/Documents/sdf-main && npm test 2>&1 | tail -5
```
Expected: `100/100 test files passed`

- [ ] **Step 6: Commit**

```bash
git add sdf-js/src/present/atoms-2d/charts/agenda/agenda-list.js
git commit -m "polish(atom): agenda-list — fitText→fitFontSize + sublabel 400→500"
```

---

### Task 3: Dimension A+B — kpi-card fitText→fitFontSize (sublabel) + 900 hero→Inter Display

**Files:**
- Modify: `sdf-js/src/present/atoms-2d/charts/data/kpi-card.js`

Context: kpi-card has 3 variant functions (dark/light/minimal). Each has:
- Hero value: already uses manual while-loop for auto-shrink (good!) — needs `"Inter Display"` added
- Label: also has a while-loop (good!) — but `fitText` is still called as a final safety net
- Sublabel: just `fitText`, no shrink — needs `fitFontSize`

- [ ] **Step 1: Read the file**

Read `sdf-js/src/present/atoms-2d/charts/data/kpi-card.js` lines 130-375.

- [ ] **Step 2: Add `fitFontSize` helper before `fitText` definition (around line 360)**

Insert before `function fitText`:
```js
function fitFontSize(ctx, text, maxW, targetFs, minFs, fontSpec) {
  let fs = targetFs;
  while (fs > minFs) {
    ctx.font = fontSpec(fs);
    if (ctx.measureText(text).width <= maxW) return fs;
    fs--;
  }
  return minFs;
}
```

- [ ] **Step 3: Add "Inter Display" to all 900-weight hero value lines**

All 6 occurrences of `900 ${valueSize}px Inter, system-ui, sans-serif` → `900 ${valueSize}px "Inter Display", Inter, system-ui, sans-serif`

Lines: 141, 144, 232, 235, 327, 330

Use Edit tool, replace_all: `900 ${valueSize}px Inter, system-ui, sans-serif` → `900 ${valueSize}px "Inter Display", Inter, system-ui, sans-serif`

- [ ] **Step 4: Convert sublabel fitText → fitFontSize in all 3 variants**

Variant 1 (dark, line ~163-168): Find:
```js
ctx.fillStyle = rgbaCss(bg, 0.55);
ctx.font = `500 ${Math.round(h * 0.085)}px Inter, system-ui, sans-serif`;
ctx.fillText(
  fitText(ctx, String(args.sublabel), availW),
  x + 22,
  valueY + Math.round(h * 0.29),
);
```
Replace with:
```js
ctx.fillStyle = rgbaCss(bg, 0.55);
const subFs1 = fitFontSize(
  ctx,
  String(args.sublabel),
  availW,
  Math.round(h * 0.085),
  Math.round(h * 0.055),
  (fs) => `500 ${fs}px Inter, system-ui, sans-serif`,
);
ctx.font = `500 ${subFs1}px Inter, system-ui, sans-serif`;
ctx.fillText(String(args.sublabel), x + 22, valueY + Math.round(h * 0.29));
```

Apply the same pattern for variant 2 (line ~254-259) and variant 3 (line ~349-355), using `subFs2` and `subFs3` as variable names. Note: variant 2 uses `rgbaCss(fg, 0.45)` and variant 3 also uses `rgbaCss(fg, 0.45)` — these differ from variant 1 which uses `rgbaCss(bg, 0.55)`. Keep existing fillStyle untouched.

- [ ] **Step 5: Run npm test**

```bash
cd /Users/hexiaoyang/Documents/sdf-main && npm test 2>&1 | tail -5
```
Expected: `100/100 test files passed`

- [ ] **Step 6: Commit**

```bash
git add sdf-js/src/present/atoms-2d/charts/data/kpi-card.js
git commit -m "polish(atom): kpi-card — sublabel fitFontSize + 900-weight Inter Display"
```

---

### Task 4: Dimension A+B — stat-grid-large fitText→fitFontSize for label

**Files:**
- Modify: `sdf-js/src/present/atoms-2d/charts/data/stat-grid-large.js`

Findings:
- A: `fitText(ctx, s.label, colW - 16)` at line 125 — label truncates instead of shrinks
- B: label uses `700` weight (correct), sublabel uses `500` (correct) — no type violations

- [ ] **Step 1: Read the file**

Read `sdf-js/src/present/atoms-2d/charts/data/stat-grid-large.js` lines 95-175.

- [ ] **Step 2: Add `fitFontSize` helper before `fitText` definition (line 163)**

Insert before `function fitText`:
```js
function fitFontSize(ctx, text, maxW, targetFs, minFs, fontSpec) {
  let fs = targetFs;
  while (fs > minFs) {
    ctx.font = fontSpec(fs);
    if (ctx.measureText(text).width <= maxW) return fs;
    fs--;
  }
  return minFs;
}
```

- [ ] **Step 3: Convert the label fitText call (around line 122-125)**

Find:
```js
ctx.font = `700 ${labelFontSize}px Inter, system-ui, sans-serif`;
ctx.fillText(fitText(ctx, s.label, colW - 16), cx, labelTop);
```

Replace with:
```js
const lblFs = fitFontSize(
  ctx,
  s.label,
  colW - 16,
  labelFontSize,
  Math.round(labelFontSize * 0.6),
  (fs) => `700 ${fs}px Inter, system-ui, sans-serif`,
);
ctx.font = `700 ${lblFs}px Inter, system-ui, sans-serif`;
ctx.fillText(s.label, cx, labelTop);
```

- [ ] **Step 4: Run npm test**

```bash
cd /Users/hexiaoyang/Documents/sdf-main && npm test 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add sdf-js/src/present/atoms-2d/charts/data/stat-grid-large.js
git commit -m "polish(atom): stat-grid-large — label fitText→fitFontSize"
```

---

### Task 5: Dimension A — number-list fitText→fitFontSize

**Files:**
- Modify: `sdf-js/src/present/atoms-2d/charts/lists/number-list.js`

Findings:
- A: `fitText` at lines 155 (label), 165 (sublabel)
- B: The circle/outline number styles use `700 ${...}px "Inter Display"` — this violates the rule (Display = 900 only). Need to drop `"Inter Display"` from the 700-weight circle numbers.

- [ ] **Step 1: Read the file**

Read `sdf-js/src/present/atoms-2d/charts/lists/number-list.js` lines 85-200.

- [ ] **Step 2: Add `fitFontSize` helper before `fitText` (line 186)**

```js
function fitFontSize(ctx, text, maxW, targetFs, minFs, fontSpec) {
  let fs = targetFs;
  while (fs > minFs) {
    ctx.font = fontSpec(fs);
    if (ctx.measureText(text).width <= maxW) return fs;
    fs--;
  }
  return minFs;
}
```

- [ ] **Step 3: Fix 700-weight "Inter Display" violation**

Lines 109 and 126: `700 ${Math.round(circleR * 1.1)}px "Inter Display", Inter, system-ui, sans-serif`
→ `700 ${Math.round(circleR * 1.1)}px Inter, system-ui, sans-serif`

Use Edit with replace_all: `700 ${Math.round(circleR * 1.1)}px "Inter Display", Inter, system-ui, sans-serif` → `700 ${Math.round(circleR * 1.1)}px Inter, system-ui, sans-serif`

- [ ] **Step 4: Convert label fitText → fitFontSize (around line 150-157)**

Find:
```js
ctx.fillStyle = rgbCss(fg);
ctx.font = `700 ${labelFontSize}px Inter, system-ui, sans-serif`;
ctx.textAlign = 'left';
ctx.textBaseline = 'middle';
ctx.fillText(fitText(ctx, String(it.label), maxTextW), textX, labelY);
```
Replace with:
```js
ctx.fillStyle = rgbCss(fg);
const listLabelFs = fitFontSize(
  ctx,
  String(it.label),
  maxTextW,
  labelFontSize,
  Math.round(labelFontSize * 0.6),
  (fs) => `700 ${fs}px Inter, system-ui, sans-serif`,
);
ctx.font = `700 ${listLabelFs}px Inter, system-ui, sans-serif`;
ctx.textAlign = 'left';
ctx.textBaseline = 'middle';
ctx.fillText(String(it.label), textX, labelY);
```

- [ ] **Step 5: Convert sublabel fitText → fitFontSize (around line 159-167)**

Find:
```js
ctx.fillStyle = rgbaCss(fg, 0.55);
ctx.font = `500 ${subFontSize}px Inter, system-ui, sans-serif`;
ctx.textAlign = 'left';
ctx.textBaseline = 'middle';
ctx.fillText(
  fitText(ctx, String(it.sublabel), maxTextW),
  textX,
  rowCY + labelFontSize * 0.55,
);
```
Replace with:
```js
ctx.fillStyle = rgbaCss(fg, 0.55);
const listSubFs = fitFontSize(
  ctx,
  String(it.sublabel),
  maxTextW,
  subFontSize,
  Math.round(subFontSize * 0.65),
  (fs) => `500 ${fs}px Inter, system-ui, sans-serif`,
);
ctx.font = `500 ${listSubFs}px Inter, system-ui, sans-serif`;
ctx.textAlign = 'left';
ctx.textBaseline = 'middle';
ctx.fillText(String(it.sublabel), textX, rowCY + labelFontSize * 0.55);
```

- [ ] **Step 6: Run npm test**

```bash
cd /Users/hexiaoyang/Documents/sdf-main && npm test 2>&1 | tail -5
```

- [ ] **Step 7: Commit**

```bash
git add sdf-js/src/present/atoms-2d/charts/lists/number-list.js
git commit -m "polish(atom): number-list — fitText→fitFontSize + drop Inter Display from 700-weight"
```

---

### Task 6: Dimension B (verify) — numbered-grid Inter Display 700-weight fix

**Files:**
- Modify: `sdf-js/src/present/atoms-2d/charts/lists/numbered-grid.js`

Numbered-grid already has `fitFontSize` implemented. But it uses `"Inter Display"` at 700 weight — violation. Lines 82, 140, 142, 170, 185, 187, 234, 237.

- [ ] **Step 1: Read the file**

Read `sdf-js/src/present/atoms-2d/charts/lists/numbered-grid.js` lines 75-250.

- [ ] **Step 2: Remove "Inter Display" from all 700-weight font strings**

Pattern to fix: `700 ${...}px "Inter Display", Inter, system-ui` → `700 ${...}px Inter, system-ui, sans-serif`

Note: the existing strings use `Inter, system-ui` without `sans-serif` tail — add it for consistency.

Lines to fix:
- Line 82: `700 ${titleFs}px "Inter Display", Inter, system-ui` → `700 ${titleFs}px Inter, system-ui, sans-serif`
- Lines 140, 142: `700 ${fs}px "Inter Display", Inter, system-ui` (in fontSpec lambda + ctx.font) → `700 ${fs}px Inter, system-ui, sans-serif`
- Lines 170, 185, 187, 234, 237: same pattern

Use Edit tool per occurrence (they differ in the variable name), or use replace_all where pattern is identical.

- [ ] **Step 3: Run npm test**

```bash
cd /Users/hexiaoyang/Documents/sdf-main && npm test 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add sdf-js/src/present/atoms-2d/charts/lists/numbered-grid.js
git commit -m "polish(atom): numbered-grid — drop Inter Display from 700-weight (900-only rule)"
```

---

### Task 7: Dimension A+B — icon-grid fitText→fitFontSize

**Files:**
- Modify: `sdf-js/src/present/atoms-2d/icons/icon-grid.js`

Findings:
- A: `fitText` at lines 145 (label), 151 (sublabel)
- B: Label uses `700` Inter (correct). Sublabel uses `500` (correct). No weight violations.

- [ ] **Step 1: Read the file**

Read `sdf-js/src/present/atoms-2d/icons/icon-grid.js` lines 130-235.

- [ ] **Step 2: Add `fitFontSize` helper before `fitText` (line 228)**

```js
function fitFontSize(ctx, text, maxW, targetFs, minFs, fontSpec) {
  let fs = targetFs;
  while (fs > minFs) {
    ctx.font = fontSpec(fs);
    if (ctx.measureText(text).width <= maxW) return fs;
    fs--;
  }
  return minFs;
}
```

- [ ] **Step 3: Convert label fitText (line ~141-145)**

The label font size is `Math.round(rowH * 0.11)`. Find:
```js
ctx.fillStyle = rgbCss(fg);
ctx.font = `700 ${Math.round(rowH * 0.11)}px Inter, system-ui, sans-serif`;
ctx.textAlign = 'center';
ctx.textBaseline = 'top';
ctx.fillText(fitText(ctx, String(it.label), colW - 16), cellCx, labelY);
```
Replace with:
```js
ctx.fillStyle = rgbCss(fg);
const gridLabelFs = fitFontSize(
  ctx,
  String(it.label),
  colW - 16,
  Math.round(rowH * 0.11),
  Math.round(rowH * 0.07),
  (fs) => `700 ${fs}px Inter, system-ui, sans-serif`,
);
ctx.font = `700 ${gridLabelFs}px Inter, system-ui, sans-serif`;
ctx.textAlign = 'center';
ctx.textBaseline = 'top';
ctx.fillText(String(it.label), cellCx, labelY);
```

- [ ] **Step 4: Convert sublabel fitText (line ~148-153)**

Find:
```js
ctx.fillStyle = rgbaCss(fg, 0.55);
ctx.font = `500 ${Math.round(rowH * 0.075)}px Inter, system-ui, sans-serif`;
ctx.fillText(
  fitText(ctx, String(it.sublabel), colW - 16),
  cellCx,
  ...
);
```
Replace with:
```js
ctx.fillStyle = rgbaCss(fg, 0.55);
const gridSubFs = fitFontSize(
  ctx,
  String(it.sublabel),
  colW - 16,
  Math.round(rowH * 0.075),
  Math.round(rowH * 0.05),
  (fs) => `500 ${fs}px Inter, system-ui, sans-serif`,
);
ctx.font = `500 ${gridSubFs}px Inter, system-ui, sans-serif`;
ctx.fillText(String(it.sublabel), cellCx, ...);
```
(Keep the exact Y coordinate from the original call, just remove the `fitText` wrapper.)

- [ ] **Step 5: Run npm test**

```bash
cd /Users/hexiaoyang/Documents/sdf-main && npm test 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add sdf-js/src/present/atoms-2d/icons/icon-grid.js
git commit -m "polish(atom): icon-grid — fitText→fitFontSize for label/sublabel"
```

---

### Task 8: Dimension A — icon-row fitText→fitFontSize

**Files:**
- Modify: `sdf-js/src/present/atoms-2d/icons/icon-row.js`

Findings:
- A: `fitText` at lines 153 (card-mode label), 160 (card-mode sublabel), 193 (standard-mode label), 199 (standard-mode sublabel)
- B: All weights correct (700/500). No violations.

- [ ] **Step 1: Read the file**

Read `sdf-js/src/present/atoms-2d/icons/icon-row.js` lines 100-215.

- [ ] **Step 2: Add `fitFontSize` helper before `fitText` (line 332)**

```js
function fitFontSize(ctx, text, maxW, targetFs, minFs, fontSpec) {
  let fs = targetFs;
  while (fs > minFs) {
    ctx.font = fontSpec(fs);
    if (ctx.measureText(text).width <= maxW) return fs;
    fs--;
  }
  return minFs;
}
```

- [ ] **Step 3: Convert card-mode label fitText (around line 148-153)**

The label size here is `Math.min(Math.round(cardH * 0.13), Math.round(rowH * 0.13))`. Capture it as a variable before the block. Find:
```js
const labelFontSize = Math.min(Math.round(cardH * 0.13), Math.round(rowH * 0.13));
ctx.fillStyle = rgbCss(fg);
ctx.font = `700 ${labelFontSize}px Inter, system-ui, sans-serif`;
ctx.textAlign = 'center';
ctx.textBaseline = 'top';
const labelY = cardIconCy + cardIconR + 10;
ctx.fillText(fitText(ctx, String(it.label), cardW - 16), cellCx, labelY);
```
Replace with:
```js
const labelFontSizeTarget = Math.min(Math.round(cardH * 0.13), Math.round(rowH * 0.13));
const cardLabelFs = fitFontSize(
  ctx,
  String(it.label),
  cardW - 16,
  labelFontSizeTarget,
  Math.round(labelFontSizeTarget * 0.6),
  (fs) => `700 ${fs}px Inter, system-ui, sans-serif`,
);
ctx.fillStyle = rgbCss(fg);
ctx.font = `700 ${cardLabelFs}px Inter, system-ui, sans-serif`;
ctx.textAlign = 'center';
ctx.textBaseline = 'top';
const labelY = cardIconCy + cardIconR + 10;
ctx.fillText(String(it.label), cellCx, labelY);
```

- [ ] **Step 4: Convert card-mode sublabel fitText (around line 156-163)**

Find:
```js
ctx.fillStyle = rgbaCss(fg, 0.55);
ctx.font = `500 ${Math.min(Math.round(cardH * 0.09), Math.round(rowH * 0.085))}px Inter, system-ui, sans-serif`;
ctx.fillText(
  fitText(ctx, String(it.sublabel), cardW - 16),
  cellCx,
  labelY + labelFontSize + 4,
);
```
Replace with:
```js
ctx.fillStyle = rgbaCss(fg, 0.55);
const cardSubTarget = Math.min(Math.round(cardH * 0.09), Math.round(rowH * 0.085));
const cardSubFs = fitFontSize(
  ctx,
  String(it.sublabel),
  cardW - 16,
  cardSubTarget,
  Math.round(cardSubTarget * 0.65),
  (fs) => `500 ${fs}px Inter, system-ui, sans-serif`,
);
ctx.font = `500 ${cardSubFs}px Inter, system-ui, sans-serif`;
ctx.fillText(String(it.sublabel), cellCx, labelY + cardLabelFs + 4);
```
Note: use `cardLabelFs` (the fitted size) for the Y offset, not the old `labelFontSize`.

- [ ] **Step 5: Convert standard-mode label fitText (around line 188-193)**

Find:
```js
ctx.fillStyle = rgbCss(fg);
ctx.font = `700 ${Math.round(rowH * 0.13)}px Inter, system-ui, sans-serif`;
ctx.textAlign = 'center';
ctx.textBaseline = 'top';
const labelY = iconCy + iconR + 14;
ctx.fillText(fitText(ctx, String(it.label), colW - 20), cellCx, labelY);
```
Replace with:
```js
const stdLabelFs = fitFontSize(
  ctx,
  String(it.label),
  colW - 20,
  Math.round(rowH * 0.13),
  Math.round(rowH * 0.08),
  (fs) => `700 ${fs}px Inter, system-ui, sans-serif`,
);
ctx.fillStyle = rgbCss(fg);
ctx.font = `700 ${stdLabelFs}px Inter, system-ui, sans-serif`;
ctx.textAlign = 'center';
ctx.textBaseline = 'top';
const labelY = iconCy + iconR + 14;
ctx.fillText(String(it.label), cellCx, labelY);
```

- [ ] **Step 6: Convert standard-mode sublabel fitText (around line 195-202)**

Find:
```js
ctx.fillStyle = rgbaCss(fg, 0.55);
ctx.font = `500 ${Math.round(rowH * 0.085)}px Inter, system-ui, sans-serif`;
ctx.fillText(
  fitText(ctx, String(it.sublabel), colW - 20),
  cellCx,
  labelY + Math.round(rowH * 0.13) + 4,
);
```
Replace with:
```js
ctx.fillStyle = rgbaCss(fg, 0.55);
const stdSubFs = fitFontSize(
  ctx,
  String(it.sublabel),
  colW - 20,
  Math.round(rowH * 0.085),
  Math.round(rowH * 0.055),
  (fs) => `500 ${fs}px Inter, system-ui, sans-serif`,
);
ctx.font = `500 ${stdSubFs}px Inter, system-ui, sans-serif`;
ctx.fillText(String(it.sublabel), cellCx, labelY + stdLabelFs + 4);
```
Note: use `stdLabelFs` for the Y offset, not the hardcoded `Math.round(rowH * 0.13)`.

- [ ] **Step 7: Run npm test**

```bash
cd /Users/hexiaoyang/Documents/sdf-main && npm test 2>&1 | tail -5
```

- [ ] **Step 8: Commit**

```bash
git add sdf-js/src/present/atoms-2d/icons/icon-row.js
git commit -m "polish(atom): icon-row — fitText→fitFontSize for card + standard mode labels"
```

---

### Task 9: Dimension A — call-to-action fitText→fitFontSize

**Files:**
- Modify: `sdf-js/src/present/atoms-2d/charts/typography/call-to-action.js`

Findings:
- A: `fitText` at lines 110 (heading), 122 (subheading), 205 (contact)
- B: Heading uses `900 "Inter Display"` (correct). Subheading uses `500` (correct). Contact uses `500` (correct). No violations.

Note: The heading already uses `900 "Inter Display"` — very large font. The `fitFontSize` here needs to shrink it when needed. The while-loop approach already exists in kpi-card for this pattern.

- [ ] **Step 1: Read the file**

Read `sdf-js/src/present/atoms-2d/charts/typography/call-to-action.js` lines 75-215.

- [ ] **Step 2: Add `fitFontSize` helper before `fitText` (line 210)**

```js
function fitFontSize(ctx, text, maxW, targetFs, minFs, fontSpec) {
  let fs = targetFs;
  while (fs > minFs) {
    ctx.font = fontSpec(fs);
    if (ctx.measureText(text).width <= maxW) return fs;
    fs--;
  }
  return minFs;
}
```

- [ ] **Step 3: Convert heading fitText (around line 106-110)**

Find the heading section. The heading font size is derived before (variable `headingFontSize`). Find:
```js
ctx.fillStyle = rgbCss(textColor);
ctx.font = `900 ${headingFontSize}px "Inter Display", Inter, system-ui, sans-serif`;
ctx.textAlign = 'center';
ctx.textBaseline = 'top';
const maxHeadW = w - 48;
ctx.fillText(fitText(ctx, heading, maxHeadW), cx, curY);
```
Replace with:
```js
const ctaHeadFs = fitFontSize(
  ctx,
  heading,
  w - 48,
  headingFontSize,
  Math.round(headingFontSize * 0.55),
  (fs) => `900 ${fs}px "Inter Display", Inter, system-ui, sans-serif`,
);
ctx.fillStyle = rgbCss(textColor);
ctx.font = `900 ${ctaHeadFs}px "Inter Display", Inter, system-ui, sans-serif`;
ctx.textAlign = 'center';
ctx.textBaseline = 'top';
const maxHeadW = w - 48;
ctx.fillText(heading, cx, curY);
curY += ctaHeadFs;
```
IMPORTANT: The original `curY += headingFontSize` after the fillText must now use `ctaHeadFs`. Read the file to find and update that line too.

- [ ] **Step 4: Convert subheading fitText (around line 118-122)**

Find:
```js
ctx.fillStyle = rgbaCss(subTextColor, 0.85);
ctx.font = `500 ${subFontSize}px Inter, system-ui, sans-serif`;
ctx.textAlign = 'center';
ctx.textBaseline = 'top';
ctx.fillText(fitText(ctx, subheading, maxHeadW), cx, curY);
```
Replace with:
```js
const ctaSubFs = fitFontSize(
  ctx,
  subheading,
  maxHeadW,
  subFontSize,
  Math.round(subFontSize * 0.6),
  (fs) => `500 ${fs}px Inter, system-ui, sans-serif`,
);
ctx.fillStyle = rgbaCss(subTextColor, 0.85);
ctx.font = `500 ${ctaSubFs}px Inter, system-ui, sans-serif`;
ctx.textAlign = 'center';
ctx.textBaseline = 'top';
ctx.fillText(subheading, cx, curY);
```
Also update the `curY += subFontSize` that follows to `curY += ctaSubFs`.

- [ ] **Step 5: Convert contact fitText (around line 201-205)**

Find:
```js
ctx.fillStyle = rgbaCss(subTextColor, 0.65);
ctx.font = `500 ${contactFontSize}px "SF Mono", "Fira Code", monospace, Inter, system-ui, sans-serif`;
ctx.textAlign = 'center';
ctx.textBaseline = 'top';
ctx.fillText(fitText(ctx, contact, maxHeadW), cx, curY);
```
Replace with:
```js
const ctaContactFs = fitFontSize(
  ctx,
  contact,
  maxHeadW,
  contactFontSize,
  Math.round(contactFontSize * 0.65),
  (fs) => `500 ${fs}px "SF Mono", "Fira Code", monospace, Inter, system-ui, sans-serif`,
);
ctx.fillStyle = rgbaCss(subTextColor, 0.65);
ctx.font = `500 ${ctaContactFs}px "SF Mono", "Fira Code", monospace, Inter, system-ui, sans-serif`;
ctx.textAlign = 'center';
ctx.textBaseline = 'top';
ctx.fillText(contact, cx, curY);
```

- [ ] **Step 6: Run npm test**

```bash
cd /Users/hexiaoyang/Documents/sdf-main && npm test 2>&1 | tail -5
```

- [ ] **Step 7: Commit**

```bash
git add sdf-js/src/present/atoms-2d/charts/typography/call-to-action.js
git commit -m "polish(atom): call-to-action — fitText→fitFontSize for heading/subheading/contact"
```

---

### Task 10: Dimension B — sublabel 400→500 batch (7 atoms, one commit each)

These atoms all have the same fix: change `400` weight to `500` for sublabel/subtitle text. No fitFontSize needed here (these sublabels don't use fitText either — they just print directly). One commit per atom.

**Atoms in this batch:**
1. `charts/data/dashboard-multi-kpi.js` line 186
2. `charts/data/kpi-water-drop.js` line 260
3. `charts/data/waterfall.js` line 187
4. `charts/diagrams/seven-s-model.js` line 114
5. `charts/diagrams/radial-wheel-segmented.js` line 154
6. `charts/diagrams/flow-chart.js` line 205
7. `charts/diagrams/timeline.js` line 216
8. `charts/hierarchy/pyramid.js` line 201
9. `charts/typography/section-number-divider.js` line 95

**Files:** Each is a single-line edit in the respective atom file.

- [ ] **Step 1: Read each file briefly** to confirm line numbers and context (2 lines around each). Confirm it is a sublabel/subtitle, not an annotation that should stay 400.

  - `dashboard-multi-kpi.js:186`: `400 ${subSize}px` in sublabel block → change to `500`
  - `kpi-water-drop.js:260`: `400 ${Math.round(labelSize * 0.78)}px` sublabel → `500`
  - `waterfall.js:187`: `400 ${Math.round(h * 0.038)}px` x-axis bar label → `500`
  - `seven-s-model.js:114`: `400 ${subSize}px` sub-center text → `500`
  - `radial-wheel-segmented.js:154`: `400 ${subFontSize}px` sector sub-label → `500`
  - `flow-chart.js:205`: `400 ${...}px` node sublabel → `500`
  - `timeline.js:216`: `400 ${...}px` event sublabel → `500`
  - `pyramid.js:201`: `400 ${...}px` pyramid layer text (small, at bottom) → `500`
  - `section-number-divider.js:95`: `400 ${subFontSize}px` subtitle → `500`

- [ ] **Step 2: Apply edits** — use Edit tool, one file at a time. Replace `400 ${` with `500 ${` in the exact context of each sublabel line (include surrounding characters to make unique).

- [ ] **Step 3: After each file edit, run tests**

```bash
cd /Users/hexiaoyang/Documents/sdf-main && npm test 2>&1 | tail -3
```

- [ ] **Step 4: Commit after each atom** (9 commits total):

```bash
git add sdf-js/src/present/atoms-2d/charts/data/dashboard-multi-kpi.js
git commit -m "polish(atom): dashboard-multi-kpi — sublabel 400→500"

git add sdf-js/src/present/atoms-2d/charts/data/kpi-water-drop.js
git commit -m "polish(atom): kpi-water-drop — sublabel 400→500"

git add sdf-js/src/present/atoms-2d/charts/data/waterfall.js
git commit -m "polish(atom): waterfall — x-label 400→500"

git add sdf-js/src/present/atoms-2d/charts/diagrams/seven-s-model.js
git commit -m "polish(atom): seven-s-model — sublabel 400→500"

git add sdf-js/src/present/atoms-2d/charts/diagrams/radial-wheel-segmented.js
git commit -m "polish(atom): radial-wheel-segmented — sublabel 400→500"

git add sdf-js/src/present/atoms-2d/charts/diagrams/flow-chart.js
git commit -m "polish(atom): flow-chart — node sublabel 400→500"

git add sdf-js/src/present/atoms-2d/charts/diagrams/timeline.js
git commit -m "polish(atom): timeline — event sublabel 400→500"

git add sdf-js/src/present/atoms-2d/charts/hierarchy/pyramid.js
git commit -m "polish(atom): pyramid — layer text 400→500"

git add sdf-js/src/present/atoms-2d/charts/typography/section-number-divider.js
git commit -m "polish(atom): section-number-divider — subtitle 400→500"
```

---

### Task 11: Dimension B — 900 hero → add Inter Display (7 atoms)

Atoms with `900 ${...}px Inter, system-ui, sans-serif` that should be `900 ${...}px "Inter Display", Inter, system-ui, sans-serif`.

**Atoms:**
1. `charts/data/gauge.js` line 137
2. `charts/data/kpi-water-drop.js` line 242
3. `charts/data/dashboard-multi-kpi.js` line 170
4. `charts/data/sphere-fill.js` lines 232, 331
5. `charts/data/isotype-people-grid.js` line 96
6. `charts/data/isotype-stat-comparison.js` line 135

**Files:** Each is a targeted edit.

- [ ] **Step 1: Read each file** briefly to confirm the 900-weight line is a hero value (not a section number that's coincidentally 900 but not a KPI hero number — judgment call required).

  - `gauge.js:137`: big center number → IS hero value → add Display
  - `kpi-water-drop.js:242`: fill percentage number → IS hero value → add Display
  - `dashboard-multi-kpi.js:170`: KPI value → IS hero → add Display
  - `sphere-fill.js:232,331`: sphere fill percentage → IS hero → add Display
  - `isotype-people-grid.js:96`: big stat number → IS hero → add Display
  - `isotype-stat-comparison.js:135`: comparison hero number → IS hero → add Display

- [ ] **Step 2: Apply edits** — for each file, use Edit tool replacing the `Inter, system-ui, sans-serif` suffix with `"Inter Display", Inter, system-ui, sans-serif` in the exact 900-weight line.

  CAUTION: be specific about context. Use enough surrounding code to make Edit unique. Don't accidentally change non-900 weight lines.

- [ ] **Step 3: Run tests after each edit**

```bash
cd /Users/hexiaoyang/Documents/sdf-main && npm test 2>&1 | tail -3
```

- [ ] **Step 4: Commit each atom**

```bash
git add sdf-js/src/present/atoms-2d/charts/data/gauge.js
git commit -m "polish(atom): gauge — 900 hero value add Inter Display"

git add sdf-js/src/present/atoms-2d/charts/data/kpi-water-drop.js
git commit -m "polish(atom): kpi-water-drop — 900 value add Inter Display + sublabel 500 (combined)"

# Note: kpi-water-drop had BOTH a 400→500 fix (Task 10) AND Inter Display fix (Task 11)
# If doing together: commit message should say "sublabel 400→500 + 900-weight Inter Display"
# If doing separately: fine to split

git add sdf-js/src/present/atoms-2d/charts/data/dashboard-multi-kpi.js
git commit -m "polish(atom): dashboard-multi-kpi — 900 hero add Inter Display (sublabel 500 in prior commit)"

git add sdf-js/src/present/atoms-2d/charts/data/sphere-fill.js
git commit -m "polish(atom): sphere-fill — 900 fill% value add Inter Display"

git add sdf-js/src/present/atoms-2d/charts/data/isotype-people-grid.js
git commit -m "polish(atom): isotype-people-grid — 900 stat add Inter Display"

git add sdf-js/src/present/atoms-2d/charts/data/isotype-stat-comparison.js
git commit -m "polish(atom): isotype-stat-comparison — 900 hero add Inter Display"
```

---

### Task 12: Dimension B — Inter Display 700-weight cleanup batch

Atoms that use `700` weight with `"Inter Display"` — Display should be 900-only.

**Atoms:**
1. `charts/lists/feature-card-grid.js` lines 111, 174
2. `charts/typography/callout-banner.js` line 172
3. `charts/data/stat-with-icon.js` line 143
4. `media/image-split.js` line 57
5. `charts/typography/section-number-divider.js` line 84 (same file as Task 10 sublabel fix — combine)

- [ ] **Step 1: Read each file** to confirm context. Rule: if weight is 700 and it's a card TITLE or section heading (not a hero number), drop `"Inter Display"` — use plain `Inter, system-ui, sans-serif`.

- [ ] **Step 2: Apply edits** — for each occurrence, replace `700 ${...}px "Inter Display", Inter, system-ui` or `700 ${...}px "Inter Display", Inter, system-ui, sans-serif` with `700 ${...}px Inter, system-ui, sans-serif`.

- [ ] **Step 3: Run tests after each file**

```bash
cd /Users/hexiaoyang/Documents/sdf-main && npm test 2>&1 | tail -3
```

- [ ] **Step 4: Commit each atom**

```bash
git add sdf-js/src/present/atoms-2d/charts/lists/feature-card-grid.js
git commit -m "polish(atom): feature-card-grid — drop Inter Display from 700-weight title"

git add sdf-js/src/present/atoms-2d/charts/typography/callout-banner.js
git commit -m "polish(atom): callout-banner — drop Inter Display from 700-weight heading"

git add sdf-js/src/present/atoms-2d/charts/data/stat-with-icon.js
git commit -m "polish(atom): stat-with-icon — drop Inter Display from 700-weight label"

git add sdf-js/src/present/atoms-2d/media/image-split.js
git commit -m "polish(atom): image-split — drop Inter Display from 700-weight title"

# section-number-divider: was already committed in Task 10 (subtitle fix)
# If 84 (title) was not yet touched: add it to prior commit or new commit
git add sdf-js/src/present/atoms-2d/charts/typography/section-number-divider.js
git commit -m "polish(atom): section-number-divider — drop Inter Display from 700-weight title"
```

---

### Task 13: Dimension C — pull-quote-banner palette inspection

**Files:**
- Inspect + maybe modify: `sdf-js/src/present/atoms-2d/charts/typography/pull-quote-banner.js`

- [ ] **Step 1: Read the file**

Read the full `pull-quote-banner.js` (it's a small atom). Find line 52: `ctx.fillStyle = 'rgb(18,20,28)'`.

- [ ] **Step 2: Check context**

Is `palette.bg` or `palette.silhouetteColor` defined and used elsewhere in this atom? If yes and the hardcoded value is just an override of what palette would provide → fix to `rgbCss(palette.bg)`. If it's a special-case "always dark panel" where the atom doesn't theme at all → accept.

- [ ] **Step 3: Decide and apply (or skip)**

If fixing: change `'rgb(18,20,28)'` to `palette.bg ? rgbCss(palette.bg) : 'rgb(18,20,28)'` — defensive fallback.

If skipping: log in audit doc as "accepted — intentional always-dark panel".

- [ ] **Step 4: Run tests (if changed)**

```bash
cd /Users/hexiaoyang/Documents/sdf-main && npm test 2>&1 | tail -3
```

- [ ] **Step 5: Commit (if changed)**

```bash
git add sdf-js/src/present/atoms-2d/charts/typography/pull-quote-banner.js
git commit -m "polish(atom): pull-quote-banner — use palette.bg instead of hardcoded rgb"
```

---

### Task 14: Write audit + wave report

**Files:**
- Create: `.superpowers/sdd/sprint21-polish-audit.md`
- Create: `.superpowers/sdd/sprint21-polish-wave-report.md`

- [ ] **Step 1: Write audit markdown** at `.superpowers/sdd/sprint21-polish-audit.md`

Format:
```markdown
# Sprint 21 Polish Wave — Audit

## Atoms inspected: 86
## Atoms with findings: ~24
## Dimension A (truncation→fitFontSize): 8 atoms
## Dimension B (typography hierarchy): ~16 atoms
## Dimension C (palette): 1 atom inspected, 0-1 fixed

### [atom-path]
- A: ...
- B: ...
- C: ...

### CLEAN (no findings)
- [list of atoms with no changes needed]
```

- [ ] **Step 2: Final npm test**

```bash
cd /Users/hexiaoyang/Documents/sdf-main && npm test 2>&1 | tail -5
```
Expected: `100/100 test files passed`

- [ ] **Step 3: Write wave report** at `.superpowers/sdd/sprint21-polish-wave-report.md`

Include:
- Status: DONE or DONE_WITH_CONCERNS
- Commit SHA list (copy from `git log --oneline -30`)
- Per-atom fix summary
- npm test result
- Visual regression notes (no bake-render in this task — note that visual validation is deferred to user's `/browse` step)
- Concerns for next wave (spacing, drop-shadow, theme v2)
- Confirm: no force-push / no amend / no reset / no worktree

- [ ] **Step 4: Commit reports**

```bash
git add .superpowers/sdd/sprint21-polish-audit.md .superpowers/sdd/sprint21-polish-wave-report.md
git commit -m "chore(sprint21): polish wave final report"
```

---

### Task 15: Open PR

- [ ] **Step 1: Push branch**

```bash
git push -u origin sprint-21-polish-wave
```

- [ ] **Step 2: Create PR**

```bash
gh pr create \
  --title "Sprint 21 polish wave: fitFontSize + typography hierarchy + Inter Display rule" \
  --body "$(cat <<'EOF'
## Summary

- **Dimension A** (truncation→auto-shrink): 8 atoms converted from `fitText` (truncation) to `fitFontSize` (shrink-first, truncate-only-if-minFs): agenda-list, kpi-card, stat-grid-large, number-list, icon-grid, icon-row, call-to-action, numbered-grid (verify)
- **Dimension B** (typography hierarchy): ~24 atoms fixed across 2 sub-rules:
  - sublabel `400` weight → `500` (9 atoms: dashboard-multi-kpi, kpi-water-drop, waterfall, seven-s-model, radial-wheel-segmented, flow-chart, timeline, pyramid, section-number-divider)
  - 900-weight hero WITHOUT Inter Display → add `"Inter Display"` (7 atoms: kpi-card, gauge, kpi-water-drop, dashboard-multi-kpi, sphere-fill, isotype-people-grid, isotype-stat-comparison)
  - 700-weight WITH Inter Display → drop it (6 atoms: number-list, numbered-grid, feature-card-grid, callout-banner, stat-with-icon, image-split, section-number-divider)
- **Dimension C** (palette): pull-quote-banner inspected (conservative — accepted or 1 fix)

## Test plan

- [ ] `npm test` → 100/100 (verified after each commit)
- [ ] Visual spot-check: open scaffold-deck-viewer with strategy-swot-portfolio deck and confirm no broken renders
- [ ] Check icon-row card-mode and standard-mode label sizing looks correct (auto-shrink working)
- [ ] Check agenda-list with long item labels — should shrink not truncate

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Stop and report PR URL to user**

Print the PR URL and STOP. Do not merge.

---

## Self-review against spec

**Spec coverage check:**

| Spec requirement | Covered by task |
|---|---|
| Branch sprint-21-polish-wave | Global constraint |
| Audit doc at `.superpowers/sdd/sprint21-polish-audit.md` | Task 1, 14 |
| Wave report at `.superpowers/sdd/sprint21-polish-wave-report.md` | Task 14 |
| Dim A: agenda-list | Task 2 |
| Dim A: kpi-card | Task 3 |
| Dim A: stat-grid-large | Task 4 |
| Dim A: number-list | Task 5 |
| Dim A: numbered-grid verify | Task 6 |
| Dim A: icon-grid | Task 7 |
| Dim A: call-to-action | Task 9 |
| Dim A: icon-row | Task 8 |
| Dim B: sublabel 400→500 | Task 10 |
| Dim B: 900 hero + Inter Display | Task 11 + Task 3 |
| Dim B: 700 + Drop Inter Display | Task 12 + Task 5,6 |
| Dim C: palette audit | Task 13 |
| npm test 100/100 | Every task |
| One commit per atom | All tasks |
| No force push / amend / reset | Global constraint |
| PR opened, not merged | Task 15 |

**Placeholder scan:** No TBD, no "implement later", no "similar to" — all steps include code.

**Type consistency:** `fitFontSize(ctx, text, maxW, targetFs, minFs, fontSpec)` signature used uniformly across all tasks. Variable names scoped per task to avoid collisions within the atom.
