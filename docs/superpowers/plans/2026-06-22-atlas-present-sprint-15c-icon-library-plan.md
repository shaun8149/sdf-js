# Atlas Present Sprint 15c Implementation Plan — Phosphor Icon Library + Curated 8-Category Bake

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bundle the Phosphor MIT icon library (9000+ icons × 6 weights) into Atlas Present as a curated 8-category bake (~150 icons/category, ~1500 total at regular weight), wire it into the existing `icon-badge` atom so name-based lookup falls back from the 24 hand-coded paths to Phosphor, regen the lift system prompt v3.31 → v3.32 to expose the 8-category icon menu to the LLM.

**Architecture:** Build-time bake — a Node script (`scripts/bake-icon-library.mjs`) reads selected Phosphor SVG files from `node_modules/@phosphor-icons/core/assets/regular/*.svg` for each of 8 curated categories, extracts the `<path d="...">` payload, and writes a single JS file (`sdf-js/src/icons/baked-library.js`) exporting `{ [iconName]: pathString }`. Runtime helper (`sdf-js/src/icons/index.js`) wraps the map with category lookup, theme-color coercion, and `Path2D` construction for Canvas2D consumers. The existing `icon-badge` atom keeps its 24 hand-coded paths as a fast path; unknown names fall through to the baked Phosphor map. Country flags (separate render path) loaded from `flag-icons` package CSS classes — only relevant when atoms need flag rendering (no fallback wiring this sprint).

**Tech Stack:** ESM Node 25, vanilla browser JS, Canvas2D Path2D, `@phosphor-icons/core@2.1.1` (MIT, 9000+ SVG icons × 6 weights, npm), `flag-icons@7.x` (MIT, 300 country SVGs, npm). **2 new npm dependencies.** Bake script runs at install time (`npm run build:icons`) — runtime imports only the baked output JS, not the Phosphor package, keeping browser bundle small (~150 KB for ~1500 paths vs ~6.5 MB raw Phosphor).

**Branch:** `sprint-15-three-layer` (Sprint 15 spec commit `1e0c755` already on this branch). This plan ships as **PR #1 of 5** for Sprint 15. Do NOT push or open PR until user reviews implementation.

**Spec:** [`docs/superpowers/specs/2026-06-22-atlas-present-sprint-15-design.md`](../specs/2026-06-22-atlas-present-sprint-15-design.md) §7 (icon library detail) + §12 Phase 1 (15c phasing).

## Global Constraints

- Bundle-size budget: **≤200 KB gzip** for baked icon JS (well under spec's 3 MB Phosphor full-bundle ceiling).
- **0 hand-curated SVG path strings** — bake script extracts directly from `@phosphor-icons/core` package files. Category membership lists ARE curated (which icon names per category).
- **`npm test` must stay 83/83 PASS** throughout (current baseline). Each phase ends with `npm test` clean before commit.
- **Existing `icon-badge` 24 hand-coded paths kept intact** (backward compat — Sprint 14 finance presets reference them by exact name in lift prompt v3.31).
- **Lift prompt addendum lives in `sdf-js/src/compositor-api.js` `MODE_2D_ADDENDUM` constant** (NOT the static `.md` file under `sdf-js/examples/compositor/`). Static `.md` is base prompt only; addendum is dynamic. Bump version `v3.31 → v3.32` in both places.
- **iframe sandbox isolation preserved** — icon library is for atoms-2d Canvas2D rendering ONLY (main page), not for p5-sketch iframe consumption. p5-sketch iframe continues using `sdf-js/examples/p5-idiom-registry/atlas-icon-library.js` (24 inline icons, separate concern, do NOT modify).
- **No `git push origin main`. No `gh pr merge`. Squash-merge per [`CLAUDE.md`](../../../CLAUDE.md).**
- **Subagent-driven execution per [`superpowers:subagent-driven-development`](../../../.claude/plugins/cache/claude-plugins-official/superpowers/6.0.3/skills/subagent-driven-development/SKILL.md)** — fresh subagent per task, two-stage review (spec compliance + code quality).

---

## File structure

### NEW (Sprint 15c)

| Path | LoC est. | Responsibility |
|---|---|---|
| `sdf-js/src/icons/index.js` | ~140 | Runtime API. `getIconPath(name) → string | null` (look up baked map). `getIconCategory(category) → string[]` (icon names per category). `getIconPath2D(name) → Path2D | null` (Canvas2D consumer convenience). Theme-color application is responsibility of the consumer (icon-badge already handles via `ctx.fillStyle = palette.color`). |
| `sdf-js/src/icons/categories.js` | ~280 | 8 curated category arrays of Phosphor icon kebab-case names (~150 per category, ~1200 total minus duplicates ≈ 1100 unique). Static literal arrays, no code logic. Hand-curated names (see Phase 3 for selection methodology). |
| `sdf-js/src/icons/baked-library.js` | ~3500 (generated, ~150 KB raw / ~50 KB gzip) | Generated output of bake script. Exports `BAKED_ICONS = { [name]: pathString }`. DO NOT edit by hand — regenerate via `npm run build:icons`. Header comment includes generation timestamp + Phosphor version. **Committed to git** so users without bake step can run Atlas. |
| `sdf-js/src/icons/README.md` | ~40 | Attribution + license note for Phosphor + flag-icons. Build instructions: `npm run build:icons` to regenerate `baked-library.js`. Category inventory summary. |
| `scripts/bake-icon-library.mjs` | ~120 | Node script. Reads `categories.js`, opens each `node_modules/@phosphor-icons/core/assets/regular/{name}.svg`, parses XML, extracts `<path d="...">` (first path; for multi-path icons, joins all paths into single d), writes `sdf-js/src/icons/baked-library.js` with a `BAKED_ICONS` map. Stderr-logs any missing icon names so curator can fix. |
| `sdf-js/scripts/test-icon-library.mjs` | ~100 | L1 tests for `index.js` API: getIconPath returns string for known names, returns null for unknown, all 8 categories non-empty, getIconPath2D returns Path2D instance, no path string contains `<svg>` wrapper (only `d` attribute payload). ~12 assertions. |

### MODIFY (small targeted edits)

| Path | Change |
|---|---|
| `package.json` | Add `@phosphor-icons/core: ^2.1.1` + `flag-icons: ^7.2.3` to `dependencies`. Add `build:icons` script: `node scripts/bake-icon-library.mjs`. |
| `package-lock.json` | Auto-generated by `npm install` — commit alongside `package.json`. |
| `sdf-js/src/present/atoms-2d/icons/icon-badge.js` | Extend `_ICON_PATHS` lookup: if name not in hardcoded 24, fall back to `getIconPath(name)` from `src/icons/index.js`. Update `ICON_BADGE_NAMES` to merge hardcoded + Phosphor `getAllIconNames()`. Update `spec.args.name.type` to reflect expanded universe. Bump file-header attribution note. |
| `sdf-js/src/compositor-api.js` | Extend `MODE_2D_ADDENDUM` constant with new section "Icon library v3.32 — 8 categories" listing 8 category names + ~10 example icon names per category + usage rule ("Reference icons by kebab-case name in `args.name` of icon-badge atom"). Bump version reference `v3.31 → v3.32`. |
| `sdf-js/examples/compositor/system-prompt-lift-3d.md` | Update frontmatter description: append v3.32 changelog summary (1-2 sentences re: icon library expansion). Static file's body unchanged — runtime addendum carries the icon menu. |
| `scripts/run-tests.mjs` | Add 1 entry: `{ category: 'present', file: 'sdf-js/scripts/test-icon-library.mjs' }`. |
| `.gitignore` | Verify `node_modules` is listed (likely already there — no change usually). |

### Test inventory

Start: 83/83 PASS (current baseline, verified). After Sprint 15c: **+1 test file** (test-icon-library.mjs). Target end: **84/84 PASS**.

---

## Phase 0 — Pre-flight verification

### Task 0.1: Confirm branch + baseline + recon current icon state

**Files:** none modified

**Interfaces:** Produces baseline facts every later task can assume — branch, test count, existing icon atom inventory, current lift prompt version.

- [ ] **Step 1: Confirm branch + clean tree**

```bash
cd /Users/hexiaoyang/Documents/sdf-main
git branch --show-current
git status -s
git log --oneline -3
```

Expected:
- Branch: `sprint-15-three-layer`
- Status: clean (no output)
- Top commit: `1e0c755 spec: Sprint 15 — 3-layer atom expansion ...`

If on different branch: `git checkout sprint-15-three-layer`. If dirty: investigate; do NOT proceed.

- [ ] **Step 2: Verify npm test baseline**

```bash
npm test 2>&1 | tail -3
```

Expected:
```
=======================================
83/83 test files passed  (~5s)
```

If count differs: stop, ask user — Sprint 14 may have shipped more tests since spec was written. Update plan's `83/84` count accordingly.

- [ ] **Step 3: Confirm current icon inventory (no surprise)**

```bash
ls sdf-js/src/present/atoms-2d/icons/
grep -E "^  '?icon" sdf-js/src/present/atoms-2d/registry.js
```

Expected:
- Only `icon-badge.js` in the directory
- Only `'icon-badge'` registered in `ATOM_LOADERS`

If more icon atoms exist: stop, re-read `registry.js`, adjust plan's "icon-badge is the only icon atom" assumption.

- [ ] **Step 4: Confirm lift prompt version v3.31**

```bash
grep -oE "v3\.31|v3\.32" sdf-js/src/compositor-api.js | sort -u
grep -oE "v3\.31|v3\.32" sdf-js/examples/compositor/system-prompt-lift-3d.md | sort -u
```

Expected: only `v3.31` appears. If `v3.32` already present: stop, version was bumped elsewhere — adjust plan.

- [ ] **Step 5: Stash recon snapshot for later spec-check**

No commit. Move to Task 0.2.

### Task 0.2: Verify required npm registry access

**Files:** none modified

- [ ] **Step 1: Verify Phosphor + flag-icons package metadata reachable**

```bash
npm view @phosphor-icons/core@2.1.1 license dist.unpackedSize 2>&1 | head -3
npm view flag-icons license dist.unpackedSize 2>&1 | head -3
```

Expected for Phosphor: `license = 'MIT'` + `dist.unpackedSize = 6476685` (≈ 6.5 MB).
Expected for flag-icons: `license = 'MIT'` + `dist.unpackedSize` ≈ 4 MB.

If registry unreachable: confirm internet + retry. If license differs: STOP and escalate — license change invalidates plan.

- [ ] **Step 2: Spot-check one Phosphor SVG file structure**

```bash
mkdir -p /tmp/phos-check && cd /tmp/phos-check
npm pack @phosphor-icons/core@2.1.1 >/dev/null 2>&1
tar -xzf phosphor-icons-core-2.1.1.tgz package/assets/regular/briefcase.svg
cat package/assets/regular/briefcase.svg | head -3
cd - >/dev/null
```

Expected: single-line or short SVG starting `<svg xmlns="http://www.w3.org/2000/svg"` containing `<path d="..."/>`. Confirms our extraction approach (regex or DOM parse on `d` attr) is viable.

If file format differs: STOP, adjust bake script approach before continuing.

---

## Phase 1 — npm install + dependency wiring

### Task 1.1: Install Phosphor + flag-icons

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (auto)

**Interfaces:**
- Consumes: nothing.
- Produces: `node_modules/@phosphor-icons/core/` populated with SVG assets; runtime path for SVG files = `node_modules/@phosphor-icons/core/assets/regular/<icon-name>.svg`.

- [ ] **Step 1: Install both packages as dependencies (not dev)**

```bash
npm install @phosphor-icons/core@^2.1.1 flag-icons@^7.2.3
```

Expected: clean install, no audit warnings about Phosphor/flag-icons (their tree is small). 2 lines added to `package.json` dependencies.

If install fails: read error, address (likely network or peer dep), retry.

- [ ] **Step 2: Verify install + asset paths**

```bash
ls node_modules/@phosphor-icons/core/assets/regular/briefcase.svg
ls node_modules/@phosphor-icons/core/assets/regular/ | wc -l
ls node_modules/flag-icons/flags/4x3/ | wc -l
```

Expected:
- `briefcase.svg` exists
- `regular/` directory has ~9000 .svg files
- `flags/4x3/` has ~300 .svg files

- [ ] **Step 3: Verify `package.json` dependencies field**

```bash
cat package.json | grep -A6 '"dependencies"'
```

Expected: `"@phosphor-icons/core": "^2.1.1"` + `"flag-icons": "^7.2.3"` lines present.

- [ ] **Step 4: Re-run npm test (still 83/83)**

```bash
npm test 2>&1 | tail -3
```

Expected: 83/83 PASS. The npm install MUST NOT have broken anything (it only adds dependencies; consumers haven't been wired yet).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "$(cat <<'EOF'
sprint-15c: install Phosphor 9000-icon library + flag-icons 300 country flags

MIT-licensed dependencies for Sprint 15c icon library. Runtime consumers
(src/icons/index.js + icon-badge.js wiring) added in later phases. Test
suite stays at 83/83 PASS — these packages are unused at runtime until
the bake script runs in Phase 2 and atoms wire in Phase 5.

Phosphor: 9000 icons × 6 weights (thin/light/regular/bold/fill/duotone),
~6.5 MB unpacked.
Flag-icons: 300 country SVGs (4x3 + 1x1 aspect ratios), ~4 MB unpacked.

Per docs/superpowers/plans/2026-06-22-atlas-present-sprint-15c-icon-library-plan.md
Phase 1 Task 1.1.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Bake script

### Task 2.1: Write bake script (extracts SVG path d attribute from Phosphor SVG files)

**Files:**
- Create: `scripts/bake-icon-library.mjs`
- Create: `sdf-js/src/icons/` (directory)
- Create: `sdf-js/src/icons/categories.js` (skeleton — full curation in Task 3.1)

**Interfaces:**
- Consumes: `node_modules/@phosphor-icons/core/assets/regular/<name>.svg`, `sdf-js/src/icons/categories.js` (`CATEGORIES` export — array-of-name-arrays object).
- Produces: `sdf-js/src/icons/baked-library.js` exporting `BAKED_ICONS = { [name]: pathDString }`.

- [ ] **Step 1: Create category skeleton (full curation in Phase 3)**

Create `sdf-js/src/icons/categories.js` with this seed content:

```js
// =============================================================================
// sdf-js/src/icons/categories.js — Curated Phosphor icon names per category
// -----------------------------------------------------------------------------
// 8 domain categories of kebab-case Phosphor icon names. Bake script reads
// node_modules/@phosphor-icons/core/assets/regular/<name>.svg for each name.
//
// Full curation lives here; expand by adding names. Names must match
// Phosphor's filename (no extension). To list available: `ls
// node_modules/@phosphor-icons/core/assets/regular/`.
//
// Per docs/superpowers/specs/2026-06-22-atlas-present-sprint-15-design.md §7.
// =============================================================================

export const CATEGORIES = {
  business: [
    'briefcase', 'chart-line', 'users', 'presentation', 'handshake',
    // (Phase 3.1 expands to ~150)
  ],
  finance: [
    'currency-dollar', 'bank', 'coins', 'trend-up', 'trend-down',
  ],
  tech: [
    'cpu', 'database', 'cloud', 'code', 'gear',
  ],
  medical: [
    'stethoscope', 'pill', 'first-aid', 'heart-straight', 'syringe',
  ],
  hrm: [
    'user', 'user-circle', 'users-three', 'identification-badge', 'graduation-cap',
  ],
  social: [
    'chat-circle', 'share-network', 'heart', 'at', 'thumbs-up',
  ],
  signs: [
    'warning', 'prohibit', 'info', 'question', 'check-circle',
  ],
  calendar: [
    'calendar', 'clock', 'timer', 'alarm', 'hourglass',
  ],
};

export function getAllIconNames() {
  return Array.from(new Set(Object.values(CATEGORIES).flat()));
}

export function getIconNamesForCategory(category) {
  return CATEGORIES[category] ?? [];
}

export const CATEGORY_NAMES = Object.keys(CATEGORIES);
```

- [ ] **Step 2: Write bake script**

Create `scripts/bake-icon-library.mjs`:

```js
#!/usr/bin/env node
// =============================================================================
// scripts/bake-icon-library.mjs — Bake selected Phosphor icons into JS map
// -----------------------------------------------------------------------------
// Reads sdf-js/src/icons/categories.js → for each name, opens
// node_modules/@phosphor-icons/core/assets/regular/<name>.svg, extracts the
// concatenated <path d="..."> attribute(s), writes a single map file
// sdf-js/src/icons/baked-library.js as `export const BAKED_ICONS = {...}`.
//
// Multi-path icons: all `d` attributes are joined with a space, producing
// a single string Canvas2D `new Path2D(str)` can consume.
//
// Missing icons (name in categories.js but no SVG file) are logged to stderr
// and skipped (so a typo in categories.js fails loud but bake still completes).
//
// Run via: npm run build:icons
// =============================================================================

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const PHOSPHOR_DIR = resolve(REPO_ROOT, 'node_modules/@phosphor-icons/core/assets/regular');
const CATEGORIES_FILE = resolve(REPO_ROOT, 'sdf-js/src/icons/categories.js');
const OUTPUT_FILE = resolve(REPO_ROOT, 'sdf-js/src/icons/baked-library.js');

// Regex matches d="..." attribute. Phosphor SVGs are well-formed single-line
// so the simple regex is safe (no multi-line attrs). Captures payload.
const PATH_D_RE = /<path[^>]*\sd="([^"]+)"/g;

async function extractPathD(svgFile) {
  const svg = await readFile(svgFile, 'utf8');
  const dList = [];
  let m;
  PATH_D_RE.lastIndex = 0;
  while ((m = PATH_D_RE.exec(svg)) !== null) {
    dList.push(m[1]);
  }
  return dList.join(' ');
}

async function loadCategories() {
  const mod = await import(`file://${CATEGORIES_FILE}`);
  return mod.getAllIconNames();
}

async function main() {
  const names = await loadCategories();
  console.log(`Baking ${names.length} icons from Phosphor regular weight...`);
  const baked = {};
  const missing = [];
  for (const name of names) {
    const svgFile = resolve(PHOSPHOR_DIR, `${name}.svg`);
    if (!existsSync(svgFile)) {
      missing.push(name);
      continue;
    }
    const d = await extractPathD(svgFile);
    if (!d) {
      missing.push(`${name} (no d attr)`);
      continue;
    }
    baked[name] = d;
  }
  if (missing.length) {
    console.error(`\nMISSING: ${missing.length} icons not found or empty:`);
    missing.forEach(n => console.error(`  - ${n}`));
  }
  const lines = [
    '// =============================================================================',
    '// sdf-js/src/icons/baked-library.js — GENERATED, DO NOT EDIT BY HAND',
    `// Generated: ${new Date().toISOString()}`,
    '// Source: @phosphor-icons/core@2.1.1 (MIT), regular weight',
    '// Re-generate: npm run build:icons',
    '// =============================================================================',
    '',
    'export const BAKED_ICONS = Object.freeze({',
    ...Object.entries(baked).map(([n, d]) => `  ${JSON.stringify(n)}: ${JSON.stringify(d)},`),
    '});',
    '',
    'export function getBakedIconNames() {',
    '  return Object.keys(BAKED_ICONS);',
    '}',
    '',
  ];
  await writeFile(OUTPUT_FILE, lines.join('\n'), 'utf8');
  console.log(`\nOK  ${Object.keys(baked).length} icons → ${OUTPUT_FILE}`);
  if (missing.length) {
    process.exit(1);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 3: Add npm script + ensure executable**

Edit `package.json` to add a script after the existing `test` lines. Open the file and locate the `"scripts": {` block. Insert this line right after `"test": "node scripts/run-tests.mjs",`:

```json
    "build:icons": "node scripts/bake-icon-library.mjs",
```

- [ ] **Step 4: Run bake script for first time**

```bash
npm run build:icons
```

Expected:
```
Baking 40 icons from Phosphor regular weight...

OK  40 icons → /Users/.../sdf-js/src/icons/baked-library.js
```

(40 because Step 1 seed has 40 names across 8 categories at ~5 each.)

If missing: investigate the missing list. Likely a typo in `categories.js` — correct name (Phosphor uses kebab-case, e.g. `thumbs-up` not `thumbsup`).

- [ ] **Step 5: Verify baked output structure**

```bash
head -10 sdf-js/src/icons/baked-library.js
wc -l sdf-js/src/icons/baked-library.js
```

Expected:
- Header comment block + `export const BAKED_ICONS = Object.freeze({`
- Body line per icon: `"briefcase": "M.....",`
- ~50 lines total for the seed (header + 40 entries + footer)

- [ ] **Step 6: Commit**

```bash
git add scripts/bake-icon-library.mjs sdf-js/src/icons/categories.js sdf-js/src/icons/baked-library.js package.json
git commit -m "$(cat <<'EOF'
sprint-15c: bake script + 40-icon seed bake from Phosphor regular weight

Phase 2 of Sprint 15c icon library: scripts/bake-icon-library.mjs reads
sdf-js/src/icons/categories.js, opens each name's SVG under
node_modules/@phosphor-icons/core/assets/regular/, extracts <path d>
payload, writes sdf-js/src/icons/baked-library.js as Object.freeze map.

Seed contains 40 icons (5 per × 8 categories). Phase 3 expands curation
to ~150 per category (~1100-1200 unique total).

baked-library.js is committed to git so users without @phosphor-icons/core
installed (or skipping `npm run build:icons`) can still consume the library
at runtime. Re-generate via `npm run build:icons` after editing
categories.js.

Per docs/superpowers/plans/2026-06-22-atlas-present-sprint-15c-icon-library-plan.md
Phase 2 Task 2.1.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Curated 8-category icon name selection

### Task 3.1: Expand each category to ~150 icons (~1100-1200 unique total)

**Files:**
- Modify: `sdf-js/src/icons/categories.js`
- Regenerate: `sdf-js/src/icons/baked-library.js` (via `npm run build:icons`)

**Interfaces:**
- Consumes: list of available Phosphor icon names from `node_modules/@phosphor-icons/core/assets/regular/*.svg`.
- Produces: `getAllIconNames()` returns ~1100-1200 unique strings.

**Curation methodology** (READ BEFORE STEP 1):

For each category, pick names that pass ALL of:
1. **Domain fit** — clearly belongs to the category (e.g. `briefcase` ✓ business; `pizza` ✗ business → food category we don't have, drop).
2. **Universal/iconic** — recognizable without context (e.g. `users` ✓ vs `user-list` borderline; prefer concrete object glyphs over UI affordance icons).
3. **Phosphor-existing** — verify name exists in `node_modules/@phosphor-icons/core/assets/regular/`. Bake script will warn if not.
4. **No duplicates across categories** — same name in 2 categories is OK (the bake map dedupes), but minimize because it bloats `categories.js` and confuses LLM about category-icon affinity.

Aim for ~150/category. Skim Phosphor's [icon catalog](https://phosphoricons.com) by category tag.

- [ ] **Step 1: List available Phosphor icons matching common business keywords**

```bash
ls node_modules/@phosphor-icons/core/assets/regular/ | grep -iE "^(briefcase|chart|office|presentation|user|team|handshake|building|target|trophy|medal)" | head -20
```

Use the output as a starting point for `business` category. Repeat per-category greps for tech (`cpu|cloud|server|database|code|terminal|wifi`), finance (`currency|coin|wallet|bank|trend|cash|piggy|receipt`), medical (`pill|stetho|heart|syringe|first-aid|hospital|virus|dna`), hrm (`user|users|graduation|identification|badge`), social (`chat|share|heart|thumbs|smiley|envelope`), signs (`warning|prohibit|info|question|check|x-circle|stop|caution`), calendar (`calendar|clock|timer|alarm|hourglass`).

- [ ] **Step 2: Hand-curate names per category and edit `categories.js`**

Edit `sdf-js/src/icons/categories.js` to expand each category to ~150 names. Example structure (showing partial; complete the rest):

```js
export const CATEGORIES = {
  business: [
    // Office & meetings
    'briefcase', 'office-chair', 'projector-screen', 'projector-screen-chart',
    'presentation', 'presentation-chart', 'handshake', 'users', 'users-three',
    'users-four', 'address-book',
    // Charts & KPIs
    'chart-line', 'chart-line-down', 'chart-line-up', 'chart-bar', 'chart-bar-horizontal',
    'chart-donut', 'chart-pie', 'chart-pie-slice', 'chart-polar', 'chart-scatter',
    'gauge', 'speedometer',
    // Strategy & goals
    'target', 'trophy', 'medal', 'medal-military', 'flag-banner', 'flag-pennant',
    'rocket', 'rocket-launch', 'lightbulb', 'lightbulb-filament',
    // Documents & process
    'file', 'file-text', 'file-pdf', 'file-doc', 'file-xls', 'file-ppt',
    'folder', 'folder-open', 'folders', 'archive', 'clipboard', 'clipboard-text',
    // Money & deals
    'money', 'money-wavy', 'hand-coins', 'piggy-bank', 'invoice',
    // Locations & travel
    'buildings', 'office-tower', 'globe', 'globe-hemisphere-east', 'globe-stand',
    'airplane', 'airplane-takeoff', 'briefcase-metal',
    // Add ~100 more here following grep output...
  ],
  finance: [
    // Currency symbols
    'currency-dollar', 'currency-euro', 'currency-gbp', 'currency-jpy',
    'currency-cny', 'currency-krw', 'currency-rub', 'currency-inr', 'currency-btc',
    'currency-eth', 'currency-circle-dollar',
    // Charts (finance-flavored)
    'trend-up', 'trend-down', 'chart-line-up', 'chart-line-down',
    'chart-bar', 'chart-pie-slice',
    // Money objects
    'coin', 'coins', 'money', 'money-wavy', 'cash-register', 'wallet',
    'credit-card', 'bank', 'piggy-bank', 'vault',
    // Trading
    'arrow-fat-up', 'arrow-fat-down', 'caret-up', 'caret-down',
    'percent', 'receipt', 'invoice', 'hand-coins', 'hand-deposit',
    'hand-withdraw',
    // Banking ops
    'lock', 'lock-key', 'shield-check', 'shield-warning',
    // Add ~100 more...
  ],
  tech: [
    // Computing
    'cpu', 'desktop', 'desktop-tower', 'laptop', 'monitor', 'monitor-play',
    'keyboard', 'mouse', 'mouse-simple',
    // Storage & data
    'database', 'hard-drive', 'hard-drives', 'floppy-disk', 'memory',
    // Cloud & network
    'cloud', 'cloud-arrow-up', 'cloud-arrow-down', 'cloud-check', 'cloud-x',
    'cloud-warning', 'cloud-fog', 'wifi-high', 'wifi-medium', 'wifi-low', 'wifi-x',
    'broadcast', 'antenna', 'radio',
    // Code & dev
    'code', 'code-block', 'code-simple', 'terminal', 'terminal-window',
    'git-branch', 'git-commit', 'git-diff', 'git-fork', 'git-merge',
    'git-pull-request', 'github-logo', 'gitlab-logo',
    // Security
    'shield', 'shield-check', 'shield-warning', 'shield-slash', 'shield-star',
    'key', 'key-return', 'lock', 'lock-open', 'lock-key',
    'fingerprint', 'fingerprint-simple',
    // Devices
    'device-mobile', 'device-mobile-camera', 'device-mobile-speaker', 'device-tablet',
    'device-tablet-camera', 'device-tablet-speaker', 'phone', 'sim-card',
    // Add ~80 more...
  ],
  medical: [
    'stethoscope', 'pill', 'syringe', 'first-aid', 'first-aid-kit',
    'heart', 'heart-straight', 'heartbeat', 'pulse', 'thermometer',
    'thermometer-cold', 'thermometer-hot', 'thermometer-simple',
    'bandaids', 'eyedropper', 'eyedropper-sample',
    'tooth', 'eye', 'eye-slash', 'ear', 'nose',
    'brain', 'lungs', 'kidney', 'tooth',
    'dna', 'virus', 'microscope', 'test-tube',
    'mask-happy', 'mask-sad',
    'hospital', 'ambulance', 'wheelchair',
    'baby', 'person', 'person-simple',
    // Add ~120 more...
  ],
  hrm: [
    'user', 'user-circle', 'user-circle-check', 'user-circle-dashed',
    'user-circle-gear', 'user-circle-minus', 'user-circle-plus',
    'user-focus', 'user-gear', 'user-list', 'user-minus', 'user-plus',
    'user-rectangle', 'user-sound', 'user-square', 'user-switch',
    'users', 'users-three', 'users-four',
    'graduation-cap', 'student', 'chalkboard', 'chalkboard-simple', 'chalkboard-teacher',
    'identification-badge', 'identification-card',
    'briefcase', 'briefcase-metal', 'handshake',
    'chats-circle', 'chats-teardrop', 'chats',
    'person-simple', 'person-simple-bike', 'person-simple-run', 'person-simple-walk',
    // Add ~120 more...
  ],
  social: [
    'chat', 'chat-circle', 'chat-circle-dots', 'chat-circle-text',
    'chat-dots', 'chat-teardrop', 'chat-teardrop-dots', 'chat-teardrop-text',
    'chats', 'chats-circle', 'chats-teardrop',
    'heart', 'heart-straight', 'heart-break', 'heart-half',
    'star', 'star-half', 'star-and-crescent',
    'thumbs-up', 'thumbs-down',
    'hand-heart', 'hand-waving', 'hands-clapping',
    'share', 'share-fat', 'share-network',
    'at', 'paper-plane', 'paper-plane-right', 'paper-plane-tilt',
    'envelope', 'envelope-open', 'envelope-simple', 'envelope-simple-open',
    'phone', 'phone-call', 'phone-incoming', 'phone-outgoing',
    'video-camera', 'video-camera-slash',
    'instagram-logo', 'facebook-logo', 'twitter-logo', 'x-logo',
    'linkedin-logo', 'youtube-logo', 'whatsapp-logo', 'tiktok-logo',
    'pinterest-logo', 'reddit-logo', 'discord-logo', 'snapchat-logo',
    'telegram-logo', 'github-logo',
    // Add ~100 more...
  ],
  signs: [
    'warning', 'warning-circle', 'warning-diamond', 'warning-octagon',
    'prohibit', 'prohibit-inset',
    'info', 'question',
    'check', 'check-circle', 'check-fat', 'check-square',
    'x', 'x-circle', 'x-square',
    'minus', 'minus-circle', 'minus-square',
    'plus', 'plus-circle', 'plus-square',
    'stop', 'stop-circle',
    'fire', 'fire-extinguisher', 'fire-simple',
    'flag', 'flag-banner', 'flag-checkered', 'flag-pennant',
    'lifebuoy', 'first-aid',
    'recycle',
    'lightning', 'lightning-slash',
    // Add ~80 more...
  ],
  calendar: [
    'calendar', 'calendar-blank', 'calendar-check', 'calendar-dot',
    'calendar-dots', 'calendar-heart', 'calendar-minus', 'calendar-plus',
    'calendar-slash', 'calendar-star', 'calendar-x',
    'clock', 'clock-afternoon', 'clock-clockwise', 'clock-countdown',
    'clock-countdown-bold', 'clock-counter-clockwise', 'clock-user',
    'timer', 'hourglass', 'hourglass-high', 'hourglass-low', 'hourglass-medium',
    'hourglass-simple', 'hourglass-simple-high', 'hourglass-simple-low',
    'hourglass-simple-medium',
    'alarm', 'bell', 'bell-simple', 'bell-slash',
    'watch', 'sun', 'moon',
    // Add ~70 more...
  ],
};
```

(Curator: aim for full ~150 per category. Above shows ~30-80 per category as starting points; complete the remaining names referencing `ls node_modules/@phosphor-icons/core/assets/regular/` for inspiration.)

- [ ] **Step 3: Verify all names exist in Phosphor**

```bash
npm run build:icons 2>&1 | tail -20
```

Expected: bake completes; **MISSING: 0**. If MISSING > 0, edit `categories.js` to fix typos or remove names that don't exist in Phosphor. Common pitfalls:
- `thumbsup` → `thumbs-up` (kebab-case mandatory)
- `swot` → not in Phosphor — remove
- `chartbar` → `chart-bar`

Re-run `npm run build:icons` after each fix until 0 missing.

- [ ] **Step 4: Verify final bake size + count**

```bash
wc -l sdf-js/src/icons/baked-library.js
wc -c sdf-js/src/icons/baked-library.js
node -e "import('./sdf-js/src/icons/baked-library.js').then(m => console.log('icons:', Object.keys(m.BAKED_ICONS).length))"
```

Expected:
- Lines: ~1100-1300 (one per icon + header)
- Size: ~140-200 KB raw (well under 3 MB ceiling)
- Icon count: ~1000-1200 unique

If size > 250 KB raw: trim categories (probably duplicates or extra-long path strings on a few icons; check largest with `awk 'BEGIN{FS=":"} {print length($0), $1}' sdf-js/src/icons/baked-library.js | sort -nr | head -5`).

- [ ] **Step 5: Verify gzip size budget (≤ 200 KB)**

```bash
gzip -9c sdf-js/src/icons/baked-library.js | wc -c
```

Expected: ≤ 204800 bytes (200 KB). Path strings compress well — likely ~40-60 KB gzip.

If over: trim categories. STOP and re-curate before next phase.

- [ ] **Step 6: Verify npm test still 83/83**

```bash
npm test 2>&1 | tail -3
```

Expected: 83/83 PASS (no consumers wired yet, so no test should regress).

- [ ] **Step 7: Commit**

```bash
git add sdf-js/src/icons/categories.js sdf-js/src/icons/baked-library.js
git commit -m "$(cat <<'EOF'
sprint-15c: curate 8 categories × ~150 icons (~1100 unique) from Phosphor

Phase 3 of Sprint 15c. categories.js expanded to full 8-category curation:
business / finance / tech / medical / hrm / social / signs / calendar.
~150 icons per category, ~1100 unique total (some names appear in 2 categories
e.g. 'chart-line' in business + finance, deduped by bake map).

baked-library.js regenerated: ~140-200 KB raw, ~40-60 KB gzip — well under
the 200 KB gzip budget set in plan global constraints.

Curation followed methodology in plan Phase 3 Task 3.1:
- Domain fit (clearly belongs to category)
- Universal/iconic (recognizable without context)
- Phosphor-existing (verified by bake script — 0 MISSING)
- Cross-category dup minimized

Per docs/superpowers/plans/2026-06-22-atlas-present-sprint-15c-icon-library-plan.md
Phase 3 Task 3.1.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — Runtime API + tests

### Task 4.1: Write `src/icons/index.js` runtime helper

**Files:**
- Create: `sdf-js/src/icons/index.js`
- Create: `sdf-js/src/icons/README.md`

**Interfaces:**
- Consumes: `./baked-library.js` (`BAKED_ICONS`, `getBakedIconNames`), `./categories.js` (`CATEGORIES`, `CATEGORY_NAMES`, `getIconNamesForCategory`).
- Produces (exported API used by Task 5.1 and Task 4.2):
  - `getIconPath(name: string): string | null` — raw `d` attribute string for Canvas2D consumers
  - `getIconPath2D(name: string): Path2D | null` — convenience wrapping in `new Path2D(...)`
  - `getIconCategory(category: string): string[]` — name list per category
  - `getAllCategories(): string[]` — category name list
  - `hasIcon(name: string): boolean` — quick membership check

- [ ] **Step 1: Write test FIRST (TDD)**

Create `sdf-js/scripts/test-icon-library.mjs`:

```js
#!/usr/bin/env node
// =============================================================================
// sdf-js/scripts/test-icon-library.mjs — L1 tests for src/icons/index.js
// =============================================================================

import { strict as assert } from 'node:assert';
import {
  getIconPath,
  getIconPath2D,
  getIconCategory,
  getAllCategories,
  hasIcon,
} from '../src/icons/index.js';
import { CATEGORY_NAMES } from '../src/icons/categories.js';

let passed = 0;
function it(name, fn) {
  try {
    fn();
    console.log(`  PASS ${name}`);
    passed++;
  } catch (e) {
    console.error(`  FAIL ${name}:`, e.message);
    process.exitCode = 1;
  }
}

console.log('test-icon-library:');

it('getIconPath returns d string for known icon', () => {
  const d = getIconPath('briefcase');
  assert.equal(typeof d, 'string');
  assert.ok(d.length > 0);
  assert.ok(!d.includes('<svg'), 'should be raw d attr, not full svg');
  assert.ok(!d.includes('<path'), 'should be raw d attr, not path tag');
});

it('getIconPath returns null for unknown icon', () => {
  assert.equal(getIconPath('does-not-exist'), null);
});

it('hasIcon true for known, false for unknown', () => {
  assert.equal(hasIcon('briefcase'), true);
  assert.equal(hasIcon('does-not-exist'), false);
});

it('getIconPath2D returns Path2D for known icon', () => {
  // Path2D is a browser API, but Node 22+ exposes it via canvas package.
  // We don't depend on canvas, so test the fallback (returns null in Node) OR
  // mock global. Simpler: test the path string is constructable when Path2D exists.
  if (typeof Path2D === 'undefined') {
    globalThis.Path2D = class MockPath2D {
      constructor(d) { this.d = d; }
    };
  }
  const p = getIconPath2D('briefcase');
  assert.ok(p !== null);
  assert.ok(p instanceof Path2D);
});

it('getIconPath2D returns null for unknown icon', () => {
  if (typeof Path2D === 'undefined') {
    globalThis.Path2D = class MockPath2D { constructor(d) { this.d = d; } };
  }
  assert.equal(getIconPath2D('does-not-exist'), null);
});

it('getAllCategories returns 8 category names', () => {
  const cats = getAllCategories();
  assert.equal(cats.length, 8);
  assert.deepEqual(cats.slice().sort(), CATEGORY_NAMES.slice().sort());
});

it('getIconCategory returns non-empty list for each of 8 categories', () => {
  for (const cat of CATEGORY_NAMES) {
    const names = getIconCategory(cat);
    assert.ok(Array.isArray(names), `${cat} not array`);
    assert.ok(names.length >= 5, `${cat} should have ≥5 icons (got ${names.length})`);
    for (const n of names) {
      // Most names should be bakeable; if some missing, getIconPath returns null
      // for those — but we expect the curation to be 0-missing per Phase 3 Step 3.
      assert.equal(typeof n, 'string', `${cat} has non-string entry`);
    }
  }
});

it('getIconCategory returns [] for unknown category', () => {
  assert.deepEqual(getIconCategory('not-a-category'), []);
});

it('every name returned by getIconCategory has a bakeable path', () => {
  for (const cat of CATEGORY_NAMES) {
    for (const name of getIconCategory(cat)) {
      const d = getIconPath(name);
      assert.ok(d !== null, `${cat}/${name} missing from bake — fix categories.js or rerun build:icons`);
    }
  }
});

it('total unique icons ≥ 800 (sanity floor)', () => {
  const allCats = getAllCategories();
  const unique = new Set();
  for (const c of allCats) {
    for (const n of getIconCategory(c)) unique.add(n);
  }
  assert.ok(unique.size >= 800, `Expected ≥800 unique icons, got ${unique.size}`);
});

it('Path2D paths render without throwing (smoke)', () => {
  if (typeof Path2D === 'undefined') {
    globalThis.Path2D = class MockPath2D { constructor(d) { this.d = d; } };
  }
  // Pick 5 random known names; constructing Path2D should not throw.
  const sample = ['briefcase', 'chart-line', 'cpu', 'heart', 'calendar'];
  for (const n of sample) {
    assert.doesNotThrow(() => getIconPath2D(n));
  }
});

console.log(`  ${passed} assertions passed`);
if (process.exitCode) process.exit(process.exitCode);
```

- [ ] **Step 2: Run test → verify it FAILS (no impl yet)**

```bash
node sdf-js/scripts/test-icon-library.mjs
```

Expected: FAIL with `Cannot find module '../src/icons/index.js'`.

- [ ] **Step 3: Write `src/icons/index.js`**

Create `sdf-js/src/icons/index.js`:

```js
// =============================================================================
// sdf-js/src/icons/index.js — Atlas icon library runtime API
// -----------------------------------------------------------------------------
// Wraps the baked Phosphor icon path map (./baked-library.js) + curated
// category lists (./categories.js) with consumer-friendly accessors.
//
// Consumers:
//   - sdf-js/src/present/atoms-2d/icons/icon-badge.js (Canvas2D draw — uses
//     getIconPath2D for the `new Path2D(...)` then ctx.fill / ctx.stroke)
//   - lift system prompt v3.32 references this library indirectly by calling
//     getIconCategory + getAllCategories during prompt-string assembly
//     (NOT YET wired — see Task 6.1)
//
// Per docs/superpowers/specs/2026-06-22-atlas-present-sprint-15-design.md §7
// and docs/superpowers/plans/2026-06-22-atlas-present-sprint-15c-icon-library-plan.md
// Phase 4 Task 4.1.
// =============================================================================

import { BAKED_ICONS } from './baked-library.js';
import { CATEGORIES, CATEGORY_NAMES } from './categories.js';

/**
 * Raw SVG d attribute payload for an icon name. Returns null for unknown names.
 * Canvas2D consumers should usually prefer getIconPath2D.
 * @param {string} name kebab-case Phosphor name (e.g. 'briefcase', 'chart-line')
 * @returns {string|null}
 */
export function getIconPath(name) {
  return Object.prototype.hasOwnProperty.call(BAKED_ICONS, name)
    ? BAKED_ICONS[name]
    : null;
}

/**
 * Convenience: return a constructed Path2D wrapping the icon's d attr, or null.
 * Canvas2D consumer: ctx.fill(getIconPath2D('briefcase')).
 *
 * Note: Path2D is a browser API. In Node tests without `canvas` package, callers
 * may shim global Path2D before invoking. Browser code never hits the null path
 * (Path2D is always available).
 * @param {string} name
 * @returns {Path2D|null}
 */
export function getIconPath2D(name) {
  const d = getIconPath(name);
  if (d === null) return null;
  if (typeof Path2D === 'undefined') return null;
  return new Path2D(d);
}

/**
 * Quick membership check.
 * @param {string} name
 * @returns {boolean}
 */
export function hasIcon(name) {
  return Object.prototype.hasOwnProperty.call(BAKED_ICONS, name);
}

/**
 * Curated icon names belonging to a category. Returns [] for unknown category.
 * Names are guaranteed bakeable (see Phase 3 Task 3.1 Step 3 — bake script
 * exits non-zero on any missing name, so committed categories.js + baked-library.js
 * are always in sync).
 * @param {string} category one of 'business' | 'finance' | 'tech' | 'medical'
 *                          | 'hrm' | 'social' | 'signs' | 'calendar'
 * @returns {string[]}
 */
export function getIconCategory(category) {
  return CATEGORIES[category] ? CATEGORIES[category].slice() : [];
}

/**
 * @returns {string[]} all 8 category names
 */
export function getAllCategories() {
  return CATEGORY_NAMES.slice();
}
```

- [ ] **Step 4: Re-run test → PASS**

```bash
node sdf-js/scripts/test-icon-library.mjs
```

Expected:
```
test-icon-library:
  PASS getIconPath returns d string for known icon
  PASS getIconPath returns null for unknown icon
  PASS hasIcon true for known, false for unknown
  PASS getIconPath2D returns Path2D for known icon
  PASS getIconPath2D returns null for unknown icon
  PASS getAllCategories returns 8 category names
  PASS getIconCategory returns non-empty list for each of 8 categories
  PASS getIconCategory returns [] for unknown category
  PASS every name returned by getIconCategory has a bakeable path
  PASS total unique icons ≥ 800 (sanity floor)
  PASS Path2D paths render without throwing (smoke)
  11 assertions passed
```

If any FAIL: read the message + fix the impl. Don't disable the test.

- [ ] **Step 5: Add test to run-tests.mjs**

Open `scripts/run-tests.mjs` and find the `TESTS` array. Locate the last `{ category: 'present', file: '...' }` entry. Insert this entry right after the last `present` entry, preserving the trailing comma format:

```js
  { category: 'present', file: 'sdf-js/scripts/test-icon-library.mjs' },
```

- [ ] **Step 6: Run full npm test → 84/84**

```bash
npm test 2>&1 | tail -3
```

Expected:
```
=======================================
84/84 test files passed  (~5s)
```

If 83/84: investigate the failing test. If still 83/83: the new entry didn't register — check the insertion + comma syntax.

- [ ] **Step 7: Write README**

Create `sdf-js/src/icons/README.md`:

```markdown
# Atlas Icon Library

Curated 8-category bake of [Phosphor Icons](https://phosphoricons.com)
(MIT-licensed, by Phosphor Studio) plus runtime API consumed by atoms-2d.

## Inventory

- 8 categories × ~150 icons = ~1100-1200 unique icons
- Regular weight only (Phosphor's modern default)
- Categories: business / finance / tech / medical / hrm / social / signs / calendar

## API (`sdf-js/src/icons/index.js`)

- `getIconPath(name) → string|null` — raw SVG d attribute for Canvas2D
- `getIconPath2D(name) → Path2D|null` — convenience-wrapped Path2D
- `hasIcon(name) → boolean`
- `getIconCategory(category) → string[]`
- `getAllCategories() → string[]`

## Re-baking

Edit `categories.js` to add/remove icon names, then:

```bash
npm run build:icons
```

This regenerates `baked-library.js`. The script exits non-zero if any name
listed in `categories.js` is not found under
`node_modules/@phosphor-icons/core/assets/regular/`.

## Country flags (separate render path)

Flag icons come from [`flag-icons`](https://github.com/lipis/flag-icons)
package (MIT, by Panayiotis Lipiridis). They render via CSS classes, not
Canvas2D — atoms needing flags include the package's `flag-icons.min.css`
and apply `.fi.fi-us` etc. NOT wired in Sprint 15c — deferred until an atom
needs flag rendering.

## License

Phosphor Icons: MIT © Phosphor Studio (https://phosphoricons.com)
Flag-icons: MIT © Panayiotis Lipiridis (https://github.com/lipis/flag-icons)
Atlas wiring + curation: PolyForm Noncommercial (see repo `LICENSE.md`).
```

- [ ] **Step 8: Commit**

```bash
git add sdf-js/src/icons/index.js sdf-js/src/icons/README.md sdf-js/scripts/test-icon-library.mjs scripts/run-tests.mjs
git commit -m "$(cat <<'EOF'
sprint-15c: src/icons/index.js runtime API + 11-assertion test (84/84 PASS)

Phase 4 of Sprint 15c. src/icons/index.js exposes:
  - getIconPath(name) → raw d attr | null
  - getIconPath2D(name) → Path2D | null (Canvas2D consumer convenience)
  - hasIcon(name) → boolean
  - getIconCategory(category) → string[]
  - getAllCategories() → string[] (8 names)

test-icon-library.mjs: 11 assertions cover the full API + the
cross-consistency invariant (every name in categories.js has a baked path).
Bake script Phase 3 already enforces 0-missing; this test guards against
drift if categories.js is edited without rerunning npm run build:icons.

README documents API, re-baking workflow, and flag-icons deferred path.

Test count: 83 → 84 PASS.

Per docs/superpowers/plans/2026-06-22-atlas-present-sprint-15c-icon-library-plan.md
Phase 4 Task 4.1.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 — Wire into existing `icon-badge` atom

### Task 5.1: Extend `icon-badge.js` to fall back to Phosphor for unknown names

**Files:**
- Modify: `sdf-js/src/present/atoms-2d/icons/icon-badge.js`

**Interfaces:**
- Consumes: `getIconPath2D` from `../../../../icons/index.js`, `hasIcon` from same.
- Produces: `icon-badge` atom now accepts ~1200 icon names (24 hardcoded + ~1100 Phosphor). `ICON_BADGE_NAMES` array reflects expanded universe.

- [ ] **Step 1: Read current `icon-badge.js` to confirm 24-icon `_ICON_PATHS` structure**

```bash
grep -n "_ICON_PATHS\|ICON_BADGE_NAMES\|drawPseudo3D" sdf-js/src/present/atoms-2d/icons/icon-badge.js | head -20
```

Note line numbers — `_ICON_PATHS` is the const map of name → SVG d string; `ICON_BADGE_NAMES = Object.keys(_ICON_PATHS)`; `drawPseudo3D` is the Canvas2D draw function that consumes `_ICON_PATHS[name]` via `new Path2D(...)`.

- [ ] **Step 2: Read full file content to plan minimal-touch edit**

```bash
cat sdf-js/src/present/atoms-2d/icons/icon-badge.js | head -250
```

Expected structure (from Task 0 recon):
- File header (lines 1-25)
- `_ICON_PATHS` const (24 entries)
- `export const ICON_BADGE_NAMES = Object.keys(_ICON_PATHS);`
- `export const spec = {...}`
- `drawPseudo3D`, `drawFlat`, `draw3D` (Canvas2D functions consuming `_ICON_PATHS[name]`)

Strategy: add `import { hasIcon, getIconPath2D } from '../../../../icons/index.js';` near top + a single helper `resolveIconPath2D(name)` that prefers hardcoded then falls back to Phosphor. Replace all `_ICON_PATHS[name]` → `resolveIconPath2D(name)` call sites (typically only inside `drawPseudo3D` + `drawFlat`).

- [ ] **Step 3: Edit the file**

Use the Edit tool with the following targeted changes. Replace the import block at the top of the file (after the header comment) to add the new import. Find the existing import line:

```js
import { rgbCss, rgbaCss } from '../renderer.js';
```

Replace with:

```js
import { rgbCss, rgbaCss } from '../renderer.js';
import { getIconPath2D, hasIcon, getAllCategories, getIconCategory } from '../../../../icons/index.js';
```

After the `_ICON_PATHS` const definition (after the closing `};` of `_ICON_PATHS`), add a helper:

```js
// Resolve an icon name to a Path2D. Prefers the 24 hand-coded paths above
// (preserves Sprint 14 prompt v3.31 references + avoids fetching from baked
// map for fast-path icons). Falls through to Phosphor baked library (Sprint 15c).
// Returns null if name is in neither, so callers can render a placeholder.
function resolveIconPath2D(name) {
  if (Object.prototype.hasOwnProperty.call(_ICON_PATHS, name)) {
    return new Path2D(_ICON_PATHS[name]);
  }
  return getIconPath2D(name); // null if name not in Phosphor either
}
```

Replace the existing line:

```js
export const ICON_BADGE_NAMES = Object.keys(_ICON_PATHS);
```

With:

```js
// 24 hardcoded names (fast path / legacy compat) — used by lift prompt v3.31
// finance presets which name these explicitly.
export const ICON_BADGE_HARDCODED_NAMES = Object.keys(_ICON_PATHS);

// Full universe = 24 hardcoded ∪ ~1100 Phosphor. Computed lazily from
// src/icons/categories.js so categories.js changes propagate without edits here.
export function getIconBadgeNames() {
  const set = new Set(ICON_BADGE_HARDCODED_NAMES);
  for (const cat of getAllCategories()) {
    for (const n of getIconCategory(cat)) set.add(n);
  }
  return Array.from(set).sort();
}

// Legacy export: kept so importers expecting an array still work. Snapshot
// at module load (Phosphor library is frozen — Sprint 15c doesn't add
// runtime registration; safe to snapshot once).
export const ICON_BADGE_NAMES = getIconBadgeNames();
```

In the `spec` object, find the `args.name` declaration which currently looks like:

```js
    name: {
      type: ICON_BADGE_NAMES.slice(0, 6).join('|') + '|... (24 total)',
      required: true,
      example: 'users',
    },
```

Replace with:

```js
    name: {
      type:
        ICON_BADGE_HARDCODED_NAMES.slice(0, 6).join('|') +
        `|... (${ICON_BADGE_NAMES.length} total: 24 hardcoded + Phosphor library)`,
      required: true,
      example: 'users',
    },
```

In each draw function (`drawPseudo3D`, `drawFlat`, `draw3D`), find the line that does:

```js
  const iconPath = new Path2D(_ICON_PATHS[name]);
```

(or similar — exact form may vary; look for any `_ICON_PATHS[name]` consumer).

Replace with:

```js
  const iconPath = resolveIconPath2D(name);
  if (!iconPath) {
    // Unknown name — draw the badge but skip the icon (instead of crashing).
    // Caller (lift prompt) should only emit known names; this is a safety net.
    return;
  }
```

Repeat for any other `_ICON_PATHS[name]` references. Use grep to verify all are updated:

```bash
grep -n "_ICON_PATHS\[" sdf-js/src/present/atoms-2d/icons/icon-badge.js
```

Expected after edit: 0 matches (all replaced). If any remain, repeat the Edit.

- [ ] **Step 4: Run npm test → still 84/84**

```bash
npm test 2>&1 | tail -3
```

Expected: 84/84 PASS. Existing tests that touch `icon-badge` (smoke or framework) should be unaffected — hardcoded names still work the same way; only behavior change is unknown-name handling (now returns instead of crashing).

If a test fails: read the message. Likely the test mocks `_ICON_PATHS` or imports `ICON_BADGE_NAMES` and expects exactly 24. Update the test expectation to reflect the new universe size, BUT ONLY IF the test's intent was a sanity floor not an exact contract.

- [ ] **Step 5: Add a small icon-badge integration test**

Append to `sdf-js/scripts/test-icon-library.mjs` (NOT a new file — extends existing):

```js

// -------- Integration: icon-badge atom expanded universe --------

import {
  ICON_BADGE_NAMES,
  ICON_BADGE_HARDCODED_NAMES,
  getIconBadgeNames,
} from '../src/present/atoms-2d/icons/icon-badge.js';

it('icon-badge ICON_BADGE_HARDCODED_NAMES is 24', () => {
  assert.equal(ICON_BADGE_HARDCODED_NAMES.length, 24);
});

it('icon-badge ICON_BADGE_NAMES includes all 24 hardcoded + Phosphor', () => {
  for (const n of ICON_BADGE_HARDCODED_NAMES) {
    assert.ok(ICON_BADGE_NAMES.includes(n), `hardcoded ${n} missing from full list`);
  }
  // Should be much larger than 24 (24 + ~1100 = ~1124)
  assert.ok(ICON_BADGE_NAMES.length >= 800, `Expected ≥800 total, got ${ICON_BADGE_NAMES.length}`);
});

it('getIconBadgeNames() returns sorted union (deterministic)', () => {
  const a = getIconBadgeNames();
  const b = getIconBadgeNames();
  assert.deepEqual(a, b);
  // sorted ascending
  for (let i = 1; i < a.length; i++) {
    assert.ok(a[i] >= a[i - 1], `not sorted at index ${i}: ${a[i - 1]} > ${a[i]}`);
  }
});
```

- [ ] **Step 6: Run test → PASS (14 assertions total now)**

```bash
node sdf-js/scripts/test-icon-library.mjs
```

Expected: 14 assertions PASS.

- [ ] **Step 7: Run full npm test → 84/84**

```bash
npm test 2>&1 | tail -3
```

Expected: 84/84 PASS.

- [ ] **Step 8: Commit**

```bash
git add sdf-js/src/present/atoms-2d/icons/icon-badge.js sdf-js/scripts/test-icon-library.mjs
git commit -m "$(cat <<'EOF'
sprint-15c: extend icon-badge atom to fall back to Phosphor library

Phase 5 of Sprint 15c. icon-badge atom now accepts ~1100+ icon names via
two-tier resolution:
  1. Fast path: 24 hand-coded SVG paths (legacy, lift prompt v3.31 finance
     presets reference these by exact name — preserved verbatim)
  2. Fallback: getIconPath2D from src/icons/index.js (Phosphor baked library)

New exports:
  - ICON_BADGE_HARDCODED_NAMES (= 24 legacy names, snapshot)
  - getIconBadgeNames() (sorted union 24 hardcoded ∪ Phosphor categories)
  - ICON_BADGE_NAMES (snapshot of union, for backward compat)

Unknown-name behavior changed from CRASH (throw on Path2D(undefined)) to
SAFE-NOOP (return without drawing icon, badge still renders). Lift prompt
should only emit known names; this is defense in depth.

Test count: 84/84 PASS (test-icon-library.mjs grew 11 → 14 assertions).

Per docs/superpowers/plans/2026-06-22-atlas-present-sprint-15c-icon-library-plan.md
Phase 5 Task 5.1.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6 — Lift prompt v3.31 → v3.32

### Task 6.1: Add "Icon library v3.32" section to MODE_2D_ADDENDUM

**Files:**
- Modify: `sdf-js/src/compositor-api.js`
- Modify: `sdf-js/examples/compositor/system-prompt-lift-3d.md` (frontmatter description only)

**Interfaces:**
- Consumes: `getAllCategories`, `getIconCategory` from `sdf-js/src/icons/index.js`.
- Produces: enriched `MODE_2D_ADDENDUM` string. Bumps prompt version v3.31 → v3.32. LLM gains awareness of 8 icon categories + ~10 example names per category to choose from when emitting `icon-badge.args.name`.

- [ ] **Step 1: Read current `MODE_2D_ADDENDUM` structure**

```bash
grep -n "MODE_2D_ADDENDUM\|v3\.31\|v3\.32\|Step 4\|Step 4\.5\|Iconography" sdf-js/src/compositor-api.js | head -30
```

Note the location of `MODE_2D_ADDENDUM` and the last section (Step 4 P5 fallback or Step 4.5 finance preset). The new icon section appends after the existing v3.31 finance preset section.

- [ ] **Step 2: Read `compositor-api.js` around MODE_2D_ADDENDUM for context**

```bash
sed -n '1,5p;/MODE_2D_ADDENDUM/,/^const \|^export /p' sdf-js/src/compositor-api.js | head -200
```

Read enough surrounding code to understand the template-literal layout (likely a tagged template or plain string with `\n` linebreaks).

- [ ] **Step 3: Build the icon-menu prompt text from runtime data**

Open a Node REPL to draft the menu text exactly as the LLM will see it:

```bash
node -e "
import('./sdf-js/src/icons/index.js').then(({ getAllCategories, getIconCategory }) => {
  for (const cat of getAllCategories()) {
    const names = getIconCategory(cat).slice(0, 10);
    console.log('- **' + cat + '** (~' + getIconCategory(cat).length + ' icons): ' + names.join(', '));
  }
});
"
```

Expected output: 8 lines, each like `- **business** (~150 icons): briefcase, chart-line, users, presentation, ...`. Copy this output for use in Step 4.

- [ ] **Step 4: Edit `MODE_2D_ADDENDUM` to add the v3.32 icon section**

Locate the closing of `MODE_2D_ADDENDUM` (the `;` after the closing backtick of the template literal). Just before that closing backtick, insert a new section:

```
============================================================================
Step 5 — Icon library v3.32 (NEW Sprint 15c)
============================================================================

The icon-badge atom now accepts ~1100 icon names from a curated 8-category
Phosphor library (in addition to the 24 hand-coded names listed in v3.31
Step 4.5). Pick a domain-appropriate name from the categories below.

ICON CATEGORIES (paste output of Step 3 here):

- **business** (~150 icons): briefcase, chart-line, users, presentation, ...
- **finance** (~150 icons): currency-dollar, bank, coins, trend-up, ...
- **tech** (~150 icons): cpu, database, cloud, code, ...
- **medical** (~150 icons): stethoscope, pill, first-aid, heart, ...
- **hrm** (~150 icons): user, users-three, graduation-cap, identification-badge, ...
- **social** (~150 icons): chat-circle, share-network, heart, at, ...
- **signs** (~150 icons): warning, prohibit, info, check-circle, ...
- **calendar** (~150 icons): calendar, clock, timer, alarm, ...

RULES:
1. Reference icons by kebab-case Phosphor name in `icon-badge.args.name`.
2. Pick names from the appropriate domain category (don't put `currency-dollar`
   on a medical slide).
3. The 24 hand-coded names from v3.31 finance presets still work AND are
   PREFERRED for finance/business presets (kpi-hero with `users`, `chart-bar`,
   etc.) — they render faster and are guaranteed pixel-stable.
4. If unsure whether a specific name exists, prefer common short names from
   the lists above (those are all guaranteed bakeable). Misspellings render
   as empty badges (no crash) but produce ugly output — be precise.
```

(Replace the `paste output of Step 3 here` line with the actual 8 lines from Step 3 — fill in the `...` placeholders with the real first-10 names per category.)

Also update the existing version reference at the top of the addendum. Find the line:

```
v3.31 (Sprint 14b — finance preset library)
```

Below it, add:

```
v3.32 (Sprint 15c — Phosphor icon library) — Step 5 adds 8-category icon
menu with ~1100 names. icon-badge atom now resolves names from hand-coded
fast-path (24) OR Phosphor baked library (~1100), so any name listed in the
Step 5 categories is valid for `icon-badge.args.name`.
```

- [ ] **Step 5: Update `system-prompt-lift-3d.md` frontmatter changelog**

Open `sdf-js/examples/compositor/system-prompt-lift-3d.md`. In the YAML frontmatter `description` field, find the closing of the v3.31 entry (something like `...one preset per visual; multi-preset paragraphs split into separate visuals).`). Append:

```
 v3.32 (2026-06-22 — Sprint 15c) extends MODE_2D_ADDENDUM with Step 5 listing 8 icon categories from the Phosphor bake (business / finance / tech / medical / hrm / social / signs / calendar — ~150 icons each, ~1100 unique). icon-badge atom now resolves names from hand-coded fast-path (24, v3.31 preserved) OR fallback baked library. LLM gains domain-appropriate icon vocabulary without needing to enumerate names manually; output icon names by kebab-case Phosphor convention.
```

- [ ] **Step 6: Run npm test → 84/84**

```bash
npm test 2>&1 | tail -3
```

Expected: 84/84 PASS. Prompt edits don't add tests; just verifying nothing broke (e.g. a string syntax error in the addendum template literal would crash any test that imports compositor-api).

- [ ] **Step 7: Verify the prompt is well-formed by manual import**

```bash
node -e "
import('./sdf-js/src/compositor-api.js').then(m => {
  console.log('MODE_2D_ADDENDUM length:', m.MODE_2D_ADDENDUM.length);
  console.log('contains \"Step 5\":', m.MODE_2D_ADDENDUM.includes('Step 5'));
  console.log('contains \"v3.32\":', m.MODE_2D_ADDENDUM.includes('v3.32'));
  console.log('contains \"business\":', m.MODE_2D_ADDENDUM.includes('business'));
});
"
```

Expected:
```
MODE_2D_ADDENDUM length: <larger than before by ~1500 chars>
contains "Step 5": true
contains "v3.32": true
contains "business": true
```

If any false: the edit didn't land. Re-do Step 4.

- [ ] **Step 8: Commit**

```bash
git add sdf-js/src/compositor-api.js sdf-js/examples/compositor/system-prompt-lift-3d.md
git commit -m "$(cat <<'EOF'
sprint-15c: lift prompt v3.31 → v3.32 — add 8-category icon menu to MODE_2D_ADDENDUM

Phase 6 of Sprint 15c. MODE_2D_ADDENDUM constant in compositor-api.js gains
a Step 5 section listing the 8 Phosphor categories baked in Phase 3:
business / finance / tech / medical / hrm / social / signs / calendar.
Each category lists ~10 representative icon names so LLM can self-discover
without needing to enumerate all ~1100. v3.31 hand-coded 24-name fast path
is preserved + flagged PREFERRED for finance presets.

system-prompt-lift-3d.md frontmatter description appends v3.32 changelog.
Static .md body unchanged (addendum is dynamic per Sprint 3 architecture).

Test count: 84/84 PASS.

Per docs/superpowers/plans/2026-06-22-atlas-present-sprint-15c-icon-library-plan.md
Phase 6 Task 6.1.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 7 — Integration smoke + PR prep

### Task 7.1: End-to-end smoke check (no API call — render-only)

**Files:** none modified (verification only)

- [ ] **Step 1: Open dev server in background**

```bash
npm run serve >/tmp/atlas-dev.log 2>&1 &
sleep 2
tail /tmp/atlas-dev.log
```

Expected: `Serving HTTP on 0.0.0.0 port 8001 ...`

- [ ] **Step 2: Spot-check icon-badge atom renders a Phosphor icon in browser**

In a browser tab, navigate to: `http://localhost:8001/examples/atoms-2d-demo/`

If the demo page has a way to switch icon names (sidebar, dropdown, or just by editing JSON), pick a Phosphor name not in the 24 hardcoded set — e.g. `cpu`, `pill`, `currency-euro`, `chat-circle`.

Expected: the badge renders with the Phosphor SVG path inside. If the demo doesn't expose an arg switcher, manually edit the demo HTML/JS to set `name: 'cpu'` and refresh.

If the badge renders empty: `getIconPath2D` returned null OR Phase 5 wiring is wrong. Open DevTools console — check for any error.

- [ ] **Step 3: Stop dev server**

```bash
kill %1 2>/dev/null || true
```

- [ ] **Step 4: Verify branch state is clean**

```bash
git status -s
git log --oneline | head -10
```

Expected:
- Status: clean
- Top 7 commits should be the Phase 1-6 commits in order (one Phase per commit, except Phase 1 + 3 which produce one each, total ~6 commits).

### Task 7.2: Push branch + open PR (DO NOT MERGE — wait for user review)

**Files:** none modified

- [ ] **Step 1: Verify still on `sprint-15-three-layer` branch**

```bash
git branch --show-current
```

Expected: `sprint-15-three-layer`

- [ ] **Step 2: Final test pass**

```bash
npm test 2>&1 | tail -3
```

Expected: `84/84 test files passed`. If anything broke since Phase 6: investigate, fix, commit, re-run.

- [ ] **Step 3: Push branch to remote**

```bash
git push -u origin sprint-15-three-layer
```

Expected: `Branch 'sprint-15-three-layer' set up to track 'origin/sprint-15-three-layer'.`

- [ ] **Step 4: Open PR via gh CLI**

```bash
gh pr create --title "Sprint 15c: Phosphor 9000-icon library + 8-category curated bake + lift prompt v3.32" --body "$(cat <<'EOF'
## Summary

Sprint 15c (PR 1/5 of Sprint 15, per [spec](docs/superpowers/specs/2026-06-22-atlas-present-sprint-15-design.md) §12). Bundles Phosphor's MIT icon library, curates 8 domain categories (~1100 icons), wires into the existing `icon-badge` atom, and exposes the category menu to the lift LLM via prompt v3.32.

## Layered architecture

- `sdf-js/src/icons/` (NEW) — runtime helper API: `getIconPath`, `getIconPath2D`, `getIconCategory`, `getAllCategories`, `hasIcon`
- `sdf-js/src/icons/categories.js` (NEW) — 8 curated category arrays of kebab-case Phosphor names
- `sdf-js/src/icons/baked-library.js` (NEW, generated, committed) — `{ name: pathDString }` map, regenerable via `npm run build:icons`
- `scripts/bake-icon-library.mjs` (NEW) — node script reading `node_modules/@phosphor-icons/core/assets/regular/<name>.svg` for each curated name, extracting `<path d>` payload, writing the baked map
- `sdf-js/src/present/atoms-2d/icons/icon-badge.js` (MODIFIED) — 24 hand-coded names kept as fast path; unknown names fall back to Phosphor; new `ICON_BADGE_HARDCODED_NAMES` + `getIconBadgeNames()` exports
- `sdf-js/src/compositor-api.js` (MODIFIED) — `MODE_2D_ADDENDUM` gains Step 5 with 8-category icon menu; version v3.31 → v3.32

## Bundle size

- Baked library: ~150 KB raw, ~50 KB gzip (target: ≤200 KB gzip — well under)
- Runtime cost: 1 dynamic import on first atom render, then cached

## Test results

- npm test: **84/84 PASS** (was 83/83; +1 = `test-icon-library.mjs` with 14 assertions)
- New tests:
  - getIconPath/2D returns string/Path2D for known, null for unknown
  - All 8 categories non-empty + ≥5 icons each
  - Cross-consistency: every name in categories.js has a baked path
  - Total unique icons ≥ 800 (sanity floor)
  - icon-badge ICON_BADGE_HARDCODED_NAMES === 24
  - icon-badge ICON_BADGE_NAMES includes all 24 + Phosphor
  - getIconBadgeNames() returns deterministic sorted union

## Test plan

- [x] `npm test` — 84/84 PASS
- [ ] Open `http://localhost:8001/examples/atoms-2d-demo/` in browser; render icon-badge with name='cpu' (a Phosphor-only name) — verify icon appears
- [ ] Render icon-badge with name='users' (hardcoded name) — verify same render as before (no regression)
- [ ] Render icon-badge with name='does-not-exist' — verify safe-noop (badge renders, icon path skipped, no crash)

## Notes

- v3.31 24 hand-coded names preserved verbatim — finance presets unaffected
- flag-icons package installed but not yet wired (no atom consumes flags this sprint — deferred)
- Phosphor `regular` weight only baked (the other 5 weights — thin/light/bold/fill/duotone — are deferred until an atom needs weight-switching)
- p5-sketch iframe `atlas-icon-library.js` (24 inline icons under examples/p5-idiom-registry/) unchanged — separate render path
- Per `CLAUDE.md`: DO NOT merge. Awaiting user review.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed. Capture it for user.

- [ ] **Step 5: Report back to user**

Print to user:

```
✅ Sprint 15c (PR 1/5 of Sprint 15) ready for review:

  Branch: sprint-15-three-layer
  PR URL: <captured from gh pr create>
  Commits: 6
  Test: 84/84 PASS

Awaiting user review before merge (per CLAUDE.md).
Next sprint after merge: 15a chart atoms (2 wk, ~20 atoms).
```

DO NOT run `gh pr merge`. DO NOT proceed to Sprint 15a until user explicitly merges 15c.

---

## Self-review checklist (run before declaring plan complete)

After completing all phases, run the writing-plans skill's self-review:

**1. Spec coverage**

Map each spec requirement (Section 7 + Section 12 Phase 1) to a plan task:

| Spec requirement | Plan task |
|---|---|
| `npm install @phosphor-icons/web flag-icons` (Spec §7) | Phase 1 Task 1.1 (corrected: `@phosphor-icons/core` — the raw-SVG package, not `/web` which is CSS-icon-only and doesn't expose Canvas2D paths) |
| `src/icons/index.js` — getIcon resolver | Phase 4 Task 4.1 |
| `src/icons/categories.js` — 8 category lists | Phase 2 Task 2.1 (seed) + Phase 3 Task 3.1 (full curation) |
| Theme integration (icons inherit currentColor) | NOT ADDRESSED — see note below |
| icon-badge wiring | Phase 5 Task 5.1 |
| Smoke test getIcon('briefcase') | Phase 4 Task 4.1 Step 1 |
| Lift prompt v3.31 → v3.32 | Phase 6 Task 6.1 |

**Gap**: theme integration via `currentColor`. The spec §7 said "Theme integration: icons inherit currentColor → CSS color set by theme token". This is a CSS-render path concern. The icon-badge atom uses Canvas2D `ctx.fillStyle = rgbCss(palette.color)` — it sets color before drawing the Path2D. NO CSS involved. So `currentColor` is N/A for Canvas2D consumers.

The CSS `currentColor` path is relevant only if a future atom renders icons as HTML/SVG via DOM. That atom doesn't exist in Sprint 15c. **Mark this requirement deferred to Sprint 15d/15e** (when atoms might emit SVG) and document in the README. No plan changes required.

**2. Placeholder scan**

Grep the plan for placeholder patterns. Expected: 0 hits.

```bash
grep -nE "TBD|TODO|implement later|fill in details|Similar to Task" docs/superpowers/plans/2026-06-22-atlas-present-sprint-15c-icon-library-plan.md
```

If any matches: replace each with actual content.

**3. Type consistency**

Cross-check API names between phases:

- Phase 2 Task 2.1 declares `getAllIconNames()` in `categories.js`
- Phase 4 Task 4.1 declares `getAllCategories()` in `index.js`
- Phase 5 Task 5.1 imports `getAllCategories`, `getIconCategory` from `index.js` ✓

- `BAKED_ICONS` map exported by `baked-library.js` (Phase 2) → imported by `index.js` (Phase 4) ✓

- `getIconPath2D` declared in `index.js` (Phase 4) → consumed by `icon-badge.js` via `resolveIconPath2D` (Phase 5) ✓

- `ICON_BADGE_NAMES` (legacy) preserved in icon-badge.js exports (Phase 5) — no consumer breaks.

No type inconsistencies detected.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-22-atlas-present-sprint-15c-icon-library-plan.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Per [`superpowers:subagent-driven-development`](../../../.claude/plugins/cache/claude-plugins-official/superpowers/6.0.3/skills/subagent-driven-development/SKILL.md).

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review.

**Which approach?**
