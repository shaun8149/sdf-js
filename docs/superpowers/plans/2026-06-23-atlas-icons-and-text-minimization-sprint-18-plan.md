# Atlas Icons & Text-Minimization Implementation Plan (Sprint 18)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec**: [`docs/superpowers/specs/2026-06-23-atlas-icons-and-text-minimization-sprint-18-design.md`](../specs/2026-06-23-atlas-icons-and-text-minimization-sprint-18-design.md)

**Goal:** Ship a ~2900-icon library across 3 sources + 2 new icon atoms + inline-icon support on 6 existing atoms + lift-prompt-v4 rules so the LLM uses icons and charts to replace verbose text. End-to-end: ANTFUN re-bake total text chars −30%, atom-type diversity ≥ 8.

**Architecture:** 3 layers — (1) Icon library (Phosphor + Simple Icons + flag-icons baked into single `getIconPath2D()` resolver with fuzzy fallback); (2) Atoms (2 new: `icon-row` / `icon-grid` + 6 enhanced with inline-icon support); (3) Lift prompt v4 (full 2900-icon catalog injected into Anthropic-cached system prompt + 4 text-minimization hard rules + 4 worked examples + scaffold registry updates).

**Tech Stack:** Node 20+ ESM, Vanilla JS (no React/Vue), Canvas2D rendering, `@phosphor-icons/core` (MIT, already in deps), `simple-icons` (MIT, new dep), `flag-icons` (CC0, already in deps), Anthropic API system-prompt caching via `cache_control: 'ephemeral'`.

## Global Constraints

- **Branch**: work on `sprint-18-icons-text-min` (already created via brainstorming commit). Each PR squash-merges to main.
- **No new top-level deps beyond `simple-icons`** — Phosphor + flag-icons already installed (Sprint 15c).
- **MIT/CC0 sources only** — never copy PL or any paid icon asset.
- **Backward compat hard rule**: existing atom args must keep working without modification. New `icon` field on items is opt-in; missing icon renders the original default (open ring / number chip / step bubble).
- **npm test must stay green at every commit** — 89/89 baseline (run `npm test` from repo root).
- **Lint + prettier via husky** — pre-commit hooks must pass; never bypass with `--no-verify`.
- **Atoms-2d framework**: every atom exports `spec` (with type / category / args) and `drawPseudo3D(ctx, args, opts)`. Lookup current registered atoms via `import('./sdf-js/src/present/atoms-2d/registry.js').listAtomTypes()`.
- **Icon-name normalization**: lowercase kebab-case (e.g. `chart-bar-horizontal` not `ChartBarHorizontal`). Stored in baked-library keyed by this normalized name.
- **Per-source name prefixes optional**: `phosphor:briefcase` / `brand:slack` / `flag:cn` accepted but unprefixed names also resolve via the 3-source chain.
- **Spec is authoritative** — when in doubt about an arg name / behavior, re-read the spec section referenced in each task's "Spec ref" line.

---

## File Structure (locked before tasks)

```
sdf-js/
├── package.json                                            # +simple-icons dep (Task 1)
├── scripts/
│   ├── bake-icon-library-v2.mjs                            # NEW — 3-source bake (Task 1)
│   ├── test-icon-library-expanded.mjs                      # NEW (Task 3)
│   ├── test-atoms-icons.mjs                                # NEW (Task 6)
│   └── run-tests.mjs                                        # +2 entries (Task 9)
├── src/
│   ├── icons/
│   │   ├── categories.js                                    # REWRITE — 14 macro cats (Task 1)
│   │   ├── baked-library.js                                 # REGENERATE — ~2500 Phosphor (Task 1)
│   │   ├── brand-icons.js                                   # NEW — Simple Icons (Task 1)
│   │   ├── flag-icons.js                                    # NEW — flag-icons (Task 1)
│   │   ├── fuzzy.js                                         # NEW — levenshtein (Task 2)
│   │   └── index.js                                         # REWRITE — 3-source + fuzzy (Task 2)
│   └── present/
│       ├── atoms-2d/
│       │   ├── icons/
│       │   │   ├── icon-badge.js                            # untouched (Sprint 15c)
│       │   │   ├── icon-row.js                              # NEW (Task 4)
│       │   │   └── icon-grid.js                             # NEW (Task 5)
│       │   ├── charts/lists/bullet-list.js                  # MODIFY — items[*].icon (Task 6)
│       │   ├── charts/lists/progression.js                  # MODIFY (Task 6)
│       │   ├── charts/agenda/agenda-list.js                 # MODIFY (Task 6)
│       │   ├── charts/data/kpi-card.js                      # MODIFY — wire icon to library (Task 6)
│       │   ├── charts/diagrams/matrix-grid.js               # MODIFY (Task 6)
│       │   ├── charts/diagrams/nine-field-matrix.js         # MODIFY (Task 6)
│       │   └── registry.js                                  # MODIFY — register 2 new (Tasks 4,5)
│       ├── scaffolds/registry.js                            # MODIFY — recommended_atoms[] (Task 7)
│       ├── scaffold-view.js                                 # MODIFY — lift prompt v4 (Task 7)
│       └── scripts/bake-scaffold-pipeline.mjs               # MODIFY — same lift prompt v4 (Task 7)
└── examples/atoms-2d-demo/
    └── icons-showcase.html                                  # NEW — visual sheet (Task 8)
```

---

## Task overview (9 tasks, ~3-4 days human / ~3-4 hours CC)

| # | Task | Files touched | Test | Deliverable |
|---|---|---|---|---|
| 1 | Bake script v2: 3-source icon library | bake script + categories + 3 baked files | counts smoke | ~2900 icons baked across 14 cats |
| 2 | Resolver + fuzzy fallback | icons/index.js, icons/fuzzy.js | resolver smoke | unified `getIconPath2D(name)` with fuzzy |
| 3 | Library test suite | test-icon-library-expanded.mjs | npm test | green +1 file |
| 4 | `icon-row` atom | atoms-2d/icons/icon-row.js + registry | atom test | new atom available |
| 5 | `icon-grid` atom | atoms-2d/icons/icon-grid.js + registry | atom test | new atom available |
| 6 | Inline icon on 6 atoms | 6 atom files | atom test | items[*].icon supported |
| 7 | Lift prompt v4 + scaffold registry | scaffold-view + bake + scaffolds/registry | dry-run pick | text-min rules + catalog injection |
| 8 | Visual showcase + verify | icons-showcase.html | browse | manual smoke checked |
| 9 | Register tests + final green pass | run-tests.mjs | npm test | 89→91 PASS |

---

## Task 1: Bake script v2 — 3-source icon library

**Spec ref**: §3 (Icon library coverage), §8 (file structure).

**Goal:** Replace the Sprint 15c single-source baked library with a 3-source bake (Phosphor + Simple Icons + flag-icons), curated to 14 macro categories totaling ~2900 icons. The bake script becomes the single source of truth — re-run regenerates `baked-library.js` / `brand-icons.js` / `flag-icons.js`.

**Files:**
- Create: `sdf-js/scripts/bake-icon-library-v2.mjs`
- Rewrite: `sdf-js/src/icons/categories.js` (14 categories)
- Regenerate: `sdf-js/src/icons/baked-library.js`
- Create: `sdf-js/src/icons/brand-icons.js`
- Create: `sdf-js/src/icons/flag-icons.js`
- Modify: `sdf-js/package.json` (add `simple-icons` dep) — note: the workspace's `package.json` lives at REPO ROOT, not `sdf-js/package.json`; verify path before editing

**Interfaces:**
- **Produces**: `baked-library.js` exports `BAKED_ICONS: {[name]: path_d_string}` (~2500 entries); `brand-icons.js` exports `BRAND_ICONS: {[name]: {path: string, color: string}}` (~200 entries, color is hex `#xxxxxx`); `flag-icons.js` exports `FLAG_ICONS: {[code]: path_d_string}` (~207 entries, ISO 3166-1 alpha-2 codes); `categories.js` exports `CATEGORIES: {[catName]: string[]}` (14 cats, each array contains the icon names baked into one of the 3 source files).
- **Consumed by**: Task 2 (resolver in `icons/index.js`).

- [ ] **Step 1: Add `simple-icons` to the repo's package.json**

```bash
cd /Users/hexiaoyang/Documents/sdf-main
# Find which package.json owns the workspace dependency tree
ls package.json sdf-js/package.json
# Add the dep at the level that already has @phosphor-icons/core
grep -l '@phosphor-icons/core' package.json sdf-js/package.json
```

Add `"simple-icons": "^13.0.0"` to the `dependencies` block of whichever `package.json` was matched (root `package.json` per Sprint 15c memory). Then:

```bash
npm install simple-icons --save
```

Verify it's installed:

```bash
ls node_modules/simple-icons/icons | head -5
```

Expected: should list ~3500 `.svg` files (or `index.js` + a JSON manifest depending on package version). If folder doesn't have `.svg` directly, the package puts them under `node_modules/simple-icons/icons/<slug>.svg`. The bake script in step 3 handles both layouts.

- [ ] **Step 2: Rewrite `sdf-js/src/icons/categories.js` with 14 categories**

Replace the entire current file. The values are the curated icon names per category. Use these names verbatim — they map to Phosphor filenames (kebab-case) for everything except `brand-*` (Simple Icons slugs) and `flags` (ISO codes).

```javascript
// =============================================================================
// sdf-js/src/icons/categories.js — Curated icon names per 14 macro categories
// -----------------------------------------------------------------------------
// Sprint 18 expansion (was 8 cats / Sprint 15c; now 14 cats covering PL D3180
// theme spread per docs/superpowers/specs/2026-06-23-atlas-icons-and-text-
// minimization-sprint-18-design.md §3).
//
// Names by category-source:
//   business / tech / ai-robotics / medical / finance / hrm / calendar /
//   signs / nature-energy / transport / arrows  → Phosphor (regular weight)
//   brand-social / brand-tools                  → Simple Icons (kebab slug)
//   flags                                       → ISO 3166-1 alpha-2 codes
//
// Bake script (scripts/bake-icon-library-v2.mjs) reads these names and writes
// 3 source files (baked-library.js / brand-icons.js / flag-icons.js).
// =============================================================================

export const CATEGORIES = {
  business: [
    'briefcase', 'briefcase-metal', 'office-chair', 'projector-screen',
    'projector-screen-chart', 'presentation', 'presentation-chart', 'handshake',
    'address-book', 'video-conference', 'chart-line', 'chart-line-down',
    'chart-line-up', 'chart-bar', 'chart-bar-horizontal', 'chart-donut',
    'chart-pie', 'chart-pie-slice', 'chart-polar', 'chart-scatter',
    'gauge', 'speedometer', 'target', 'trophy', 'medal', 'medal-military',
    'crown', 'crown-simple', 'star', 'sparkle', 'lightbulb', 'lightbulb-filament',
    'rocket', 'rocket-launch', 'megaphone', 'megaphone-simple',
    'graduation-cap', 'certificate', 'sealed', 'stamp', 'note-pencil',
    'pen-nib', 'pencil', 'pencil-line', 'eraser', 'clipboard', 'clipboard-text',
    'list-checks', 'list-bullets', 'list-numbers', 'list-magnifying-glass',
    'kanban', 'sticky-note', 'note', 'notepad', 'note-blank',
    'folder', 'folder-simple', 'folder-open', 'folder-plus', 'folder-notch',
    'folder-lock', 'archive', 'archive-tray', 'archive-box',
    'file', 'file-text', 'file-pdf', 'file-doc', 'file-xls', 'file-ppt',
    'file-csv', 'file-zip', 'file-arrow-down', 'file-arrow-up',
    'newspaper', 'newspaper-clipping', 'book', 'book-open', 'book-bookmark',
    'books', 'bookmark', 'bookmark-simple', 'tag', 'tags', 'tag-simple',
    'storefront', 'shopping-bag', 'shopping-bag-open', 'shopping-cart',
    'shopping-cart-simple', 'package', 'gift', 'percent', 'receipt',
    'receipt-x', 'warehouse', 'factory', 'buildings', 'bank',
    'globe-hemisphere-west', 'globe-stand', 'compass', 'compass-tool',
    'map-pin', 'map-pin-line', 'map-trifold', 'navigation-arrow',
    'arrow-fat-up', 'arrow-fat-down', 'arrow-square-out', 'export',
    'tree-structure', 'tree-view', 'graph', 'arrows-merge', 'arrows-split',
    'funnel', 'funnel-simple', 'lifebuoy', 'umbrella', 'umbrella-simple',
    'briefcase', 'suitcase', 'suitcase-rolling', 'briefcase-metal',
    'scales', 'gavel', 'flag', 'flag-banner', 'flag-checkered',
    'hand-coins', 'hand-deposit', 'hand-withdraw', 'hand-fist', 'handshake',
    'shake-hands', 'thumbs-up', 'thumbs-down', 'high-five',
    'pulse', 'activity', 'trending-up', 'trending-down',
    'chats', 'chats-circle', 'chats-teardrop', 'chat-circle', 'chat-text',
    'phone', 'phone-call', 'phone-incoming', 'phone-outgoing',
    'envelope', 'envelope-simple', 'envelope-open', 'paper-plane-tilt',
    'eye', 'eye-slash', 'magnifying-glass', 'magnifying-glass-plus',
    'cube', 'cubes', 'cubes-four', 'package',
    'wrench', 'gear', 'gear-six', 'gear-fine', 'sliders', 'sliders-horizontal',
    'plug', 'plugs', 'plugs-connected', 'lightning', 'lightning-slash',
    'sun', 'moon', 'star', 'star-half',
    'check', 'check-circle', 'check-square', 'x', 'x-circle', 'x-square',
    'minus', 'minus-circle', 'plus', 'plus-circle',
  ],

  tech: [
    'code', 'code-block', 'code-simple', 'terminal', 'terminal-window',
    'brackets-curly', 'brackets-angle', 'brackets-round', 'brackets-square',
    'tag', 'tag-simple', 'hash', 'hash-straight', 'at', 'asterisk',
    'cpu', 'circuitry', 'database', 'hard-drive', 'hard-drives',
    'cloud', 'cloud-arrow-up', 'cloud-arrow-down', 'cloud-check', 'cloud-x',
    'cloud-lightning', 'cloud-rain', 'cloud-snow', 'cloud-fog', 'cloud-warning',
    'wifi-high', 'wifi-medium', 'wifi-low', 'wifi-none', 'wifi-x', 'wifi-slash',
    'broadcast', 'signal-high', 'signal-medium', 'signal-low', 'signal-none',
    'rss', 'rss-simple', 'globe', 'globe-simple', 'globe-stand',
    'network', 'tree-structure', 'tree-view', 'graph',
    'desktop', 'desktop-tower', 'monitor', 'monitor-play', 'laptop',
    'device-mobile', 'device-mobile-camera', 'device-mobile-speaker',
    'device-tablet', 'device-tablet-camera', 'device-tablet-speaker',
    'keyboard', 'mouse', 'mouse-simple', 'mouse-left-click', 'mouse-right-click',
    'computer-tower', 'printer', 'scan', 'scan-smiley',
    'usb', 'plug', 'plugs', 'plugs-connected',
    'power', 'battery-full', 'battery-medium', 'battery-low', 'battery-empty',
    'battery-charging', 'lightning', 'lightning-slash',
    'shield', 'shield-check', 'shield-warning', 'shield-x', 'shield-slash',
    'lock', 'lock-key', 'lock-key-open', 'lock-laminated', 'lock-open',
    'key', 'key-return', 'fingerprint', 'fingerprint-simple', 'face-mask',
    'browsers', 'browser', 'window', 'windows-logo',
    'app-window', 'app-store-logo', 'google-play-logo',
    'play', 'pause', 'stop', 'rewind', 'fast-forward', 'skip-back', 'skip-forward',
    'speaker-high', 'speaker-low', 'speaker-none', 'speaker-x', 'speaker-slash',
    'microphone', 'microphone-slash', 'headphones', 'headset',
    'camera', 'camera-plus', 'camera-slash', 'camera-rotate',
    'video', 'video-camera', 'video-camera-slash', 'film-strip', 'film-slate',
    'image', 'images', 'image-square', 'image-broken',
    'palette', 'paint-brush', 'paint-bucket', 'paint-roller', 'drop',
    'pencil', 'pen-nib', 'eraser', 'crop', 'frame-corners',
    'aperture', 'gif', 'qr-code', 'barcode',
    'bug', 'bug-beetle', 'bug-droid', 'virus', 'detective',
    'magnifying-glass', 'magnifying-glass-plus', 'magnifying-glass-minus',
    'paper-plane', 'paper-plane-right', 'paper-plane-tilt',
    'cube', 'cubes', 'cubes-four', 'package',
    'gear', 'gear-six', 'gear-fine', 'wrench', 'sliders', 'sliders-horizontal',
    'function', 'binary', 'matrix-logo', 'hexagon', 'octagon',
    'spinner', 'spinner-gap', 'circles-three', 'circles-three-plus',
  ],

  'ai-robotics': [
    'brain', 'sparkle', 'magic-wand', 'crystal-ball', 'cube',
    'cubes', 'cubes-four', 'circuitry', 'cpu', 'graph',
    'tree-structure', 'network', 'broadcast', 'signal-high',
    'robot', 'lightning', 'function', 'binary', 'hexagon', 'octagon',
    'plant', 'flower', 'leaf', 'tree', 'tree-evergreen',
    'fingerprint', 'fingerprint-simple', 'eye', 'eye-closed',
    'face-mask', 'smiley', 'smiley-blank', 'smiley-meh',
    'chat-circle-dots', 'chats-circle', 'message-arrow-up', 'speech-bubble',
    'translate', 'detective', 'magnifying-glass', 'spinner-gap',
    'lightbulb', 'lightbulb-filament', 'lightning-slash',
    'pulse', 'activity', 'heartbeat', 'wave-sawtooth', 'wave-sine',
    'wave-square', 'wave-triangle',
    'atom', 'planet', 'orange-slice', 'gear', 'gear-six',
    'arrow-clockwise', 'arrow-counter-clockwise', 'arrows-clockwise',
    'arrows-in', 'arrows-out', 'arrows-merge', 'arrows-split',
    'gauge', 'speedometer', 'compass', 'compass-tool',
    'shield-check', 'check-circle', 'flow-arrow',
  ],

  medical: [
    'heart', 'heartbeat', 'heart-break', 'heart-half', 'heart-straight',
    'first-aid', 'first-aid-kit', 'plus', 'plus-circle', 'plus-square',
    'stethoscope', 'syringe', 'pill', 'capsules', 'eyedropper', 'eyedropper-sample',
    'thermometer', 'thermometer-cold', 'thermometer-hot', 'thermometer-simple',
    'bandaids', 'tooth', 'mouth', 'lungs', 'brain', 'bone', 'eye', 'ear',
    'hand', 'hand-eye', 'hand-heart', 'hand-palm', 'hand-pointing',
    'baby', 'baby-carriage', 'person', 'person-arms-spread', 'person-simple',
    'person-simple-bike', 'person-simple-run', 'person-simple-walk',
    'person-simple-tai-chi', 'person-simple-throw',
    'wheelchair', 'wheelchair-motion', 'scan', 'scan-smiley',
    'pulse', 'activity', 'wave-triangle', 'wave-sawtooth',
    'shield', 'shield-check', 'shield-warning', 'shield-plus',
    'hospital', 'house-line', 'first-aid-kit',
    'flask', 'test-tube', 'microscope', 'dna', 'virus', 'bacteria',
    'leaf', 'plant', 'tree', 'sun', 'drop', 'drop-half',
    'mask-happy', 'mask-sad', 'smiley', 'smiley-meh', 'smiley-sad',
    'bed', 'shower', 'bathtub', 'toilet', 'toilet-paper',
    'apple-logo', 'orange-slice', 'carrot', 'avocado', 'fish',
    'fork-knife', 'cooking-pot', 'cookie',
    'barbell', 'soccer-ball', 'basketball', 'tennis-ball',
    'martini', 'wine', 'beer-stein', 'beer-bottle',
    'crown', 'crown-simple', 'star', 'sparkle', 'trophy', 'medal',
    'gear', 'gear-six', 'sliders', 'wrench',
    'magnifying-glass', 'magnifying-glass-plus', 'eye', 'eye-slash',
  ],

  finance: [
    'currency-dollar', 'currency-dollar-simple', 'currency-circle-dollar',
    'currency-cny', 'currency-eth', 'currency-eur', 'currency-gbp',
    'currency-inr', 'currency-jpy', 'currency-krw', 'currency-ngn',
    'currency-rub', 'currency-btc', 'currency-eth',
    'coin', 'coins', 'coin-vertical', 'money',
    'wallet', 'piggy-bank', 'safe', 'vault',
    'credit-card', 'bank',
    'receipt', 'receipt-x', 'invoice', 'money-wavy',
    'hand-coins', 'hand-deposit', 'hand-withdraw',
    'chart-line-up', 'chart-line-down', 'chart-line', 'trending-up', 'trending-down',
    'chart-bar', 'chart-bar-horizontal', 'chart-donut', 'chart-pie',
    'chart-pie-slice', 'chart-scatter', 'chart-polar',
    'gauge', 'speedometer', 'pulse', 'activity',
    'arrow-up', 'arrow-down', 'arrow-fat-up', 'arrow-fat-down',
    'arrow-square-up-right', 'arrow-square-down-right',
    'arrow-circle-up', 'arrow-circle-down', 'arrow-circle-up-right',
    'caret-up', 'caret-down', 'caret-double-up', 'caret-double-down',
    'percent', 'plus', 'plus-circle', 'minus', 'minus-circle',
    'equals', 'x', 'check', 'check-circle',
    'lock', 'lock-key', 'shield', 'shield-check', 'key',
    'handshake', 'gift', 'tag', 'tag-simple', 'tags',
    'ticket', 'sticker', 'stamp', 'sealed', 'certificate',
    'medal', 'trophy', 'crown', 'star', 'sparkle',
    'briefcase', 'briefcase-metal', 'scales', 'gavel',
    'storefront', 'shopping-cart', 'shopping-bag', 'package',
    'truck', 'truck-trailer', 'airplane', 'boat',
    'globe', 'globe-hemisphere-west', 'globe-stand', 'compass',
    'newspaper', 'file', 'file-text', 'file-pdf', 'file-xls',
    'calculator', 'calendar', 'clock', 'alarm',
    'building', 'buildings', 'bank', 'warehouse', 'factory',
    'eye', 'eye-slash', 'magnifying-glass',
    'tree-structure', 'graph', 'flow-arrow', 'funnel', 'funnel-simple',
  ],

  hrm: [
    'user', 'user-circle', 'user-circle-check', 'user-circle-dashed',
    'user-circle-gear', 'user-circle-minus', 'user-circle-plus',
    'user-check', 'user-focus', 'user-gear', 'user-list',
    'user-minus', 'user-plus', 'user-rectangle', 'user-sound',
    'user-square', 'user-switch',
    'users', 'users-three', 'users-four', 'users-five',
    'person', 'person-arms-spread', 'person-simple', 'person-simple-bike',
    'person-simple-run', 'person-simple-walk', 'person-simple-tai-chi',
    'person-simple-throw', 'person-simple-circle',
    'baby', 'baby-carriage', 'child', 'student',
    'graduation-cap', 'certificate', 'sealed', 'stamp',
    'crown', 'crown-simple', 'star', 'sparkle', 'medal', 'medal-military', 'trophy',
    'handshake', 'shake-hands', 'thumbs-up', 'thumbs-down',
    'hand', 'hand-coins', 'hand-deposit', 'hand-eye', 'hand-fist',
    'hand-grabbing', 'hand-heart', 'hand-palm', 'hand-peace', 'hand-pointing',
    'hand-soap', 'hand-tap', 'hand-waving', 'hand-withdraw',
    'high-five', 'identification-badge', 'identification-card',
    'briefcase', 'briefcase-metal', 'address-book',
    'chat', 'chat-circle', 'chat-circle-dots', 'chat-circle-text',
    'chats', 'chats-circle', 'chats-teardrop',
    'envelope', 'envelope-simple', 'envelope-open', 'paper-plane-tilt',
    'megaphone', 'megaphone-simple', 'broadcast', 'speaker-high',
    'phone', 'phone-call', 'video-conference', 'video-camera',
    'clipboard', 'clipboard-text', 'list-checks', 'check-square',
    'note', 'note-blank', 'note-pencil', 'notebook', 'notepad',
    'pen-nib', 'pencil', 'highlighter',
    'tree-structure', 'graph', 'organization-chart',
    'gauge', 'speedometer', 'pulse', 'activity',
    'building', 'buildings', 'office-chair', 'desk',
    'door', 'door-open', 'house', 'house-line',
    'gear', 'gear-six', 'sliders', 'wrench', 'toolbox',
    'shield-check', 'shield', 'lock', 'key',
    'heart', 'heart-half', 'smiley', 'smiley-meh',
    'star-of-david', 'flower', 'flower-lotus', 'leaf', 'plant', 'tree',
    'magnifying-glass', 'magnifying-glass-plus', 'eye', 'eye-slash',
  ],

  calendar: [
    'calendar', 'calendar-blank', 'calendar-check', 'calendar-x',
    'calendar-plus', 'calendar-minus', 'calendar-dots', 'calendar-dot',
    'calendar-heart', 'calendar-star', 'calendar-slash',
    'clock', 'clock-afternoon', 'clock-clockwise', 'clock-counter-clockwise',
    'clock-countdown', 'clock-user',
    'timer', 'stopwatch', 'hourglass', 'hourglass-high', 'hourglass-low',
    'hourglass-medium', 'hourglass-simple', 'hourglass-simple-high',
    'hourglass-simple-low', 'hourglass-simple-medium',
    'alarm', 'bell', 'bell-ringing', 'bell-simple', 'bell-simple-ringing',
    'bell-slash', 'bell-z',
    'sun', 'sun-dim', 'sun-horizon', 'moon', 'moon-stars',
    'star', 'star-half', 'sparkle',
    'arrow-clockwise', 'arrow-counter-clockwise', 'arrows-clockwise',
    'caret-circle-up', 'caret-circle-down', 'caret-circle-left', 'caret-circle-right',
    'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right',
    'arrow-elbow-up-right', 'arrow-elbow-down-right',
    'play', 'pause', 'stop', 'rewind', 'fast-forward', 'skip-back', 'skip-forward',
    'tag', 'tag-simple', 'flag', 'flag-banner', 'flag-checkered',
    'note', 'note-pencil', 'pin', 'push-pin', 'push-pin-simple',
    'check', 'check-circle', 'check-square', 'x', 'x-circle', 'x-square',
    'plus', 'plus-circle', 'plus-square', 'minus', 'minus-circle',
    'list', 'list-bullets', 'list-checks', 'list-numbers',
    'calendar-blank', 'kanban',
  ],

  signs: [
    'warning', 'warning-circle', 'warning-diamond', 'warning-octagon',
    'shield', 'shield-check', 'shield-checkered', 'shield-warning',
    'shield-x', 'shield-slash', 'shield-star', 'shield-plus',
    'lock', 'lock-key', 'lock-key-open', 'lock-laminated', 'lock-open',
    'lock-simple', 'lock-simple-open',
    'key', 'fingerprint', 'fingerprint-simple', 'eye-slash', 'eye',
    'no-smoking', 'cigarette', 'cigarette-slash',
    'do-not-disturb', 'minus-circle', 'x-circle', 'check-circle',
    'prohibit', 'prohibit-inset',
    'stop', 'stop-circle', 'play-circle', 'pause-circle',
    'fire', 'flame', 'fire-extinguisher', 'fire-simple', 'fire-truck',
    'first-aid', 'first-aid-kit', 'plus', 'plus-circle',
    'lightning', 'lightning-slash', 'lightning-a',
    'biohazard', 'radioactive', 'virus', 'bacteria',
    'flask', 'test-tube', 'eyedropper-sample',
    'recycle', 'leaf', 'plant', 'tree',
    'thermometer-hot', 'thermometer-cold', 'snowflake', 'sun', 'moon',
    'drop', 'drop-half',
    'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right',
    'arrow-bend-up-left', 'arrow-bend-up-right',
    'arrow-elbow-down-left', 'arrow-elbow-down-right',
    'arrow-elbow-up-left', 'arrow-elbow-up-right',
    'arrow-fat-up', 'arrow-fat-down', 'arrow-fat-left', 'arrow-fat-right',
    'arrow-bend-double-up-left', 'arrow-bend-double-up-right',
    'navigation-arrow',
    'map-pin', 'map-pin-line', 'map-pin-area',
    'crosshair', 'crosshair-simple',
    'flag', 'flag-banner', 'flag-banner-fold', 'flag-checkered', 'flag-pennant',
    'bell', 'bell-ringing', 'bell-slash', 'bell-z',
    'siren', 'megaphone', 'megaphone-simple',
    'lightbulb', 'lightbulb-filament', 'lightbulb-filament-slash',
    'gauge', 'speedometer', 'compass', 'compass-tool',
    'traffic-cone', 'traffic-sign',
    'parking-meter', 'parking-circle',
    'hammer', 'wrench', 'gear',
    'eye', 'eye-closed', 'eye-slash',
    'question', 'question-mark', 'info', 'exclamation-mark',
    'identification-badge', 'identification-card', 'passport', 'sealed',
    'crown', 'star', 'sparkle', 'lightning', 'sun',
  ],

  'nature-energy': [
    'tree', 'tree-evergreen', 'tree-palm', 'tree-deciduous',
    'plant', 'flower', 'flower-lotus', 'flower-tulip', 'leaf',
    'cactus', 'mushroom', 'pepper', 'orange', 'lemon', 'cherries',
    'sun', 'sun-dim', 'sun-horizon', 'moon', 'moon-stars',
    'cloud', 'cloud-rain', 'cloud-snow', 'cloud-fog', 'cloud-lightning',
    'cloud-warning', 'cloud-sun',
    'wind', 'wind-spiral', 'thermometer-hot', 'thermometer-cold',
    'snowflake', 'umbrella', 'umbrella-simple', 'rainbow', 'rainbow-cloud',
    'mountains', 'mountain', 'tree', 'globe', 'globe-hemisphere-west',
    'globe-stand', 'planet',
    'drop', 'drop-half', 'water', 'waves',
    'lightning', 'lightning-slash', 'sun', 'sun-horizon',
    'fire', 'flame', 'fire-simple', 'fire-extinguisher',
    'recycle', 'leaf', 'leaf-fall', 'leaf-spread',
    'paw-print', 'bird', 'fish', 'butterfly', 'bug', 'bug-beetle',
    'cat', 'dog', 'horse', 'cow', 'rabbit',
    'shrimp', 'crab', 'shark', 'whale',
    'plug', 'plugs', 'plugs-connected', 'lightning', 'battery-full',
    'gas-pump', 'gas-can', 'wind-turbine', 'solar-panel', 'solar-roof',
    'lightbulb', 'lightbulb-filament', 'sun', 'spiral',
  ],

  transport: [
    'car', 'car-simple', 'car-profile', 'car-battery',
    'taxi', 'taxi-front',
    'truck', 'truck-trailer',
    'van', 'jeep', 'tractor',
    'bus', 'bus-simple',
    'train', 'train-simple', 'train-regional',
    'tram', 'subway', 'rail',
    'airplane', 'airplane-in-flight', 'airplane-landing', 'airplane-takeoff',
    'airplane-taxiing', 'airplane-tilt',
    'helicopter',
    'boat', 'boat-simple', 'sailboat', 'ship',
    'anchor', 'anchor-simple',
    'rocket', 'rocket-launch',
    'scooter', 'motorcycle', 'bicycle',
    'person-simple-bike',
    'gas-pump', 'gas-can',
    'parking-circle', 'parking-meter',
    'traffic-cone', 'traffic-sign',
    'road-horizon',
    'compass', 'compass-tool', 'navigation-arrow', 'map-trifold',
    'map-pin', 'map-pin-line', 'map-pin-area',
    'globe', 'globe-hemisphere-west', 'globe-stand',
    'package', 'package-x', 'package-check',
    'paper-plane', 'paper-plane-right', 'paper-plane-tilt',
    'flag', 'flag-checkered',
    'crown', 'star',
    'lightning', 'lightning-slash', 'battery-charging', 'plug',
    'wrench', 'gear', 'gear-six',
  ],

  arrows: [
    'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right',
    'arrow-up-left', 'arrow-up-right', 'arrow-down-left', 'arrow-down-right',
    'arrow-fat-up', 'arrow-fat-down', 'arrow-fat-left', 'arrow-fat-right',
    'arrow-fat-lines-up', 'arrow-fat-lines-down', 'arrow-fat-lines-left',
    'arrow-fat-lines-right',
    'arrow-line-up', 'arrow-line-down', 'arrow-line-left', 'arrow-line-right',
    'arrow-line-up-left', 'arrow-line-up-right', 'arrow-line-down-left',
    'arrow-line-down-right',
    'arrow-bend-up-left', 'arrow-bend-up-right', 'arrow-bend-down-left',
    'arrow-bend-down-right', 'arrow-bend-left-up', 'arrow-bend-left-down',
    'arrow-bend-right-up', 'arrow-bend-right-down',
    'arrow-bend-double-up-left', 'arrow-bend-double-up-right',
    'arrow-elbow-up-left', 'arrow-elbow-up-right',
    'arrow-elbow-down-left', 'arrow-elbow-down-right',
    'arrow-elbow-left-up', 'arrow-elbow-left-down',
    'arrow-elbow-right-up', 'arrow-elbow-right-down',
    'arrow-u-up-left', 'arrow-u-up-right', 'arrow-u-down-left', 'arrow-u-down-right',
    'arrow-u-left-up', 'arrow-u-left-down', 'arrow-u-right-up', 'arrow-u-right-down',
    'arrow-arc-left', 'arrow-arc-right',
    'arrow-circle-up', 'arrow-circle-down', 'arrow-circle-left', 'arrow-circle-right',
    'arrow-circle-up-left', 'arrow-circle-up-right',
    'arrow-circle-down-left', 'arrow-circle-down-right',
    'arrow-square-up', 'arrow-square-down', 'arrow-square-left', 'arrow-square-right',
    'arrow-square-up-left', 'arrow-square-up-right',
    'arrow-square-down-left', 'arrow-square-down-right',
    'arrow-square-in', 'arrow-square-out',
    'arrows-clockwise', 'arrows-counter-clockwise',
    'arrows-horizontal', 'arrows-vertical', 'arrows-in', 'arrows-out',
    'arrows-in-cardinal', 'arrows-out-cardinal',
    'arrows-in-simple', 'arrows-out-simple',
    'arrows-down-up', 'arrows-left-right',
    'arrows-merge', 'arrows-split',
    'caret-up', 'caret-down', 'caret-left', 'caret-right',
    'caret-double-up', 'caret-double-down', 'caret-double-left', 'caret-double-right',
    'caret-circle-up', 'caret-circle-down', 'caret-circle-left', 'caret-circle-right',
    'caret-circle-double-up', 'caret-circle-double-down',
    'caret-circle-double-left', 'caret-circle-double-right',
    'caret-line-up', 'caret-line-down', 'caret-line-left', 'caret-line-right',
    'navigation-arrow', 'paper-plane-tilt', 'paper-plane-right',
  ],

  'brand-social': [
    // Simple Icons kebab slugs (https://simpleicons.org)
    'facebook', 'instagram', 'x', 'tiktok', 'youtube', 'snapchat',
    'pinterest', 'reddit', 'linkedin', 'whatsapp', 'telegram',
    'wechat', 'weibo', 'sinaweibo', 'twitch', 'kuaishou', 'bilibili',
    'line', 'kakao', 'kakaotalk', 'douyin', 'xiaohongshu',
    'threads', 'mastodon', 'bluesky', 'bereal',
    'tumblr', 'vimeo', 'twitter', 'flickr', 'behance', 'dribbble',
    'rss', 'soundcloud', 'spotify', 'applemusic', 'youtubemusic',
    'qq', 'mail.ru', 'odnoklassniki',
  ],

  'brand-tools': [
    'slack', 'discord', 'microsoftteams', 'zoom',
    'github', 'gitlab', 'bitbucket', 'git', 'sourceforge',
    'figma', 'sketch', 'adobeillustrator', 'adobephotoshop',
    'adobexd', 'invision', 'framer', 'webflow', 'canva',
    'notion', 'asana', 'trello', 'monday', 'clickup', 'jira',
    'confluence', 'linear', 'shortcut', 'basecamp',
    'googledocs', 'googlesheets', 'googledrive', 'googlecalendar',
    'googleslides', 'googlemeet', 'googleworkspace',
    'microsoftexcel', 'microsoftword', 'microsoftpowerpoint',
    'microsoftoutlook', 'microsoftonedrive',
    'dropbox', 'box', 'icloud',
    'gmail', 'protonmail', 'hey',
    'apple', 'apple-music', 'macos', 'ios',
    'android', 'google', 'googlemaps', 'amazon', 'amazonaws',
    'amazons3', 'googlecloud', 'microsoftazure',
    'docker', 'kubernetes', 'terraform', 'ansible',
    'mongodb', 'postgresql', 'mysql', 'redis', 'sqlite',
    'elasticsearch', 'firebase', 'supabase', 'planetscale',
    'nodedotjs', 'react', 'vuedotjs', 'angular', 'svelte',
    'nextdotjs', 'nuxtdotjs', 'astro', 'remix',
    'typescript', 'javascript', 'python', 'rust', 'go', 'java', 'kotlin',
    'swift', 'cplusplus', 'csharp', 'ruby', 'php',
    'visualstudiocode', 'jetbrains', 'sublimetext',
    'iterm2', 'gnometerminal', 'gnu-bash',
    'openai', 'anthropic', 'huggingface', 'tensorflow', 'pytorch',
    'nvidia', 'apple', 'intel',
    'stripe', 'paypal', 'visa', 'mastercard', 'alipay', 'wechat',
    'shopify', 'ebay', 'amazon', 'aliexpress',
    'netflix', 'disney', 'hulu', 'amazonprimevideo',
    'youtubekids', 'twitch', 'crunchyroll',
    'wikipedia', 'medium', 'substack', 'devdotto',
    'stackoverflow', 'stackexchange', 'codepen', 'codesandbox', 'replit',
  ],

  flags: [
    // ISO 3166-1 alpha-2 codes — flag-icons package serves all 207
    // Full list pulled from node_modules/flag-icons/flags/4x3 at bake time
    // We use top-50 here; the bake script auto-pulls remaining 157
    'us', 'cn', 'jp', 'de', 'gb', 'fr', 'in', 'br', 'ca', 'au',
    'ru', 'kr', 'it', 'es', 'mx', 'id', 'tr', 'nl', 'sa', 'ch',
    'pl', 'se', 'no', 'fi', 'dk', 'be', 'at', 'pt', 'gr', 'cz',
    'sg', 'my', 'th', 'ph', 'vn', 'ae', 'il', 'eg', 'za', 'ng',
    'ar', 'cl', 'co', 'pe', 've', 'ie', 'nz', 'hk', 'tw', 'ua',
  ],
};

export const CATEGORY_NAMES = Object.keys(CATEGORIES);

/**
 * Get curated icon names for a category. Returns [] for unknown category.
 * @param {string} category
 * @returns {string[]}
 */
export function getCategoryNames(category) {
  return CATEGORIES[category] ?? [];
}

/**
 * Find which category an icon name belongs to. Returns first match or null.
 * @param {string} name
 * @returns {string|null}
 */
export function getCategoryForIcon(name) {
  for (const [cat, names] of Object.entries(CATEGORIES)) {
    if (names.includes(name)) return cat;
  }
  return null;
}
```

- [ ] **Step 3: Write `sdf-js/scripts/bake-icon-library-v2.mjs`**

This is the heart of Task 1. Walks the 14 categories, pulls SVG path data from 3 sources, and writes 3 output files. Run via `node sdf-js/scripts/bake-icon-library-v2.mjs`.

```javascript
#!/usr/bin/env node
// =============================================================================
// bake-icon-library-v2.mjs — Sprint 18 3-source icon bake
// -----------------------------------------------------------------------------
// Reads sdf-js/src/icons/categories.js (14 curated cats), pulls SVG `d`
// attributes from 3 npm packages, and writes 3 ESM source files Atlas can
// import directly without runtime SVG parsing:
//
//   - sdf-js/src/icons/baked-library.js  Phosphor icons (most names)
//   - sdf-js/src/icons/brand-icons.js    Simple Icons brand logos
//   - sdf-js/src/icons/flag-icons.js     flag-icons country flags
//
// Run from repo root:  node sdf-js/scripts/bake-icon-library-v2.mjs
// =============================================================================

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CATEGORIES } from '../src/icons/categories.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PHOSPHOR_DIR = `${REPO}/node_modules/@phosphor-icons/core/assets/regular`;
const SIMPLE_ICONS_DIR_CANDIDATES = [
  `${REPO}/node_modules/simple-icons/icons`,
  `${REPO}/node_modules/simple-icons/_icons`,
];
const FLAG_ICONS_DIR = `${REPO}/node_modules/flag-icons/flags/4x3`;

const OUT_PHOSPHOR = `${REPO}/sdf-js/src/icons/baked-library.js`;
const OUT_BRAND    = `${REPO}/sdf-js/src/icons/brand-icons.js`;
const OUT_FLAGS    = `${REPO}/sdf-js/src/icons/flag-icons.js`;

// Categories that map to Phosphor (vs Simple Icons / flags)
const PHOSPHOR_CATEGORIES = [
  'business', 'tech', 'ai-robotics', 'medical', 'finance',
  'hrm', 'calendar', 'signs', 'nature-energy', 'transport', 'arrows',
];
const BRAND_CATEGORIES = ['brand-social', 'brand-tools'];
const FLAG_CATEGORY    = 'flags';

// ============================================================================
// SVG path extraction helper — pull `d="..."` from an SVG file
// ============================================================================
function extractPathD(svgText) {
  // SVG files may have multiple <path> elements; concatenate their `d` attrs
  const matches = [...svgText.matchAll(/<path[^>]*\sd="([^"]+)"/g)];
  if (matches.length === 0) return null;
  return matches.map((m) => m[1]).join(' ');
}

// ============================================================================
// PHASE 1 — bake Phosphor (existing names + new from PHOSPHOR_CATEGORIES)
// ============================================================================
function bakePhosphor() {
  if (!existsSync(PHOSPHOR_DIR)) {
    throw new Error(`@phosphor-icons/core not installed: ${PHOSPHOR_DIR}`);
  }
  const baked = {};
  const missing = [];
  // Dedupe names from PHOSPHOR_CATEGORIES (an icon can appear in multiple cats)
  const wanted = new Set();
  for (const cat of PHOSPHOR_CATEGORIES) wanted.add(...CATEGORIES[cat]);
  // Set#add takes single value — actually need a loop:
  for (const cat of PHOSPHOR_CATEGORIES) {
    for (const n of CATEGORIES[cat]) wanted.add(n);
  }
  for (const name of wanted) {
    const path = `${PHOSPHOR_DIR}/${name}.svg`;
    if (!existsSync(path)) {
      missing.push(name);
      continue;
    }
    const svg = readFileSync(path, 'utf8');
    const d = extractPathD(svg);
    if (!d) {
      missing.push(name + ' (no <path d>)');
      continue;
    }
    baked[name] = d;
  }
  return { baked, missing };
}

// ============================================================================
// PHASE 2 — bake Simple Icons brand logos
// ============================================================================
function findSimpleIconsDir() {
  for (const dir of SIMPLE_ICONS_DIR_CANDIDATES) {
    if (existsSync(dir)) return dir;
  }
  return null;
}

function bakeSimpleIcons() {
  const dir = findSimpleIconsDir();
  if (!dir) {
    throw new Error(
      `simple-icons not installed (looked in: ${SIMPLE_ICONS_DIR_CANDIDATES.join(', ')})`,
    );
  }
  const baked = {};
  const missing = [];
  const wanted = new Set();
  for (const cat of BRAND_CATEGORIES) {
    for (const n of CATEGORIES[cat]) wanted.add(n);
  }
  for (const slug of wanted) {
    const path = `${dir}/${slug}.svg`;
    if (!existsSync(path)) {
      missing.push(slug);
      continue;
    }
    const svg = readFileSync(path, 'utf8');
    const d = extractPathD(svg);
    if (!d) {
      missing.push(slug + ' (no <path d>)');
      continue;
    }
    // Simple Icons brand color: pull from <title> sibling or from SVG fill attr
    const fillMatch = svg.match(/fill="(#[0-9a-fA-F]{6})"/);
    const color = fillMatch ? fillMatch[1] : '#000000';
    baked[slug] = { path: d, color };
  }
  return { baked, missing };
}

// ============================================================================
// PHASE 3 — bake flag-icons (auto-pull all 207, not just the curated top-50)
// ============================================================================
function bakeFlagIcons() {
  if (!existsSync(FLAG_ICONS_DIR)) {
    throw new Error(`flag-icons not installed: ${FLAG_ICONS_DIR}`);
  }
  const baked = {};
  // Auto-pull every SVG in the folder (flag-icons ships 207 in 4x3 layout)
  for (const fname of readdirSync(FLAG_ICONS_DIR)) {
    if (!fname.endsWith('.svg')) continue;
    const code = fname.replace(/\.svg$/, '').toLowerCase();
    const svg = readFileSync(`${FLAG_ICONS_DIR}/${fname}`, 'utf8');
    // Flags are complex multi-shape SVGs — store the inner SVG body (between
    // first <svg> open and last </svg> close), not just <path d>. This lets
    // the consumer paste it directly into a Path2D-incompatible flag renderer.
    const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '');
    baked[code] = inner.trim();
  }
  return { baked, missing: [] };
}

// ============================================================================
// WRITERS
// ============================================================================
function writeBakedFile(path, exportName, data, header) {
  const body = JSON.stringify(data, null, 2);
  const content = `// =============================================================================
// ${path.split('/').pop()} — AUTO-GENERATED by bake-icon-library-v2.mjs
// DO NOT EDIT MANUALLY. Re-run the bake script to update.
// ${header}
// =============================================================================

export const ${exportName} = ${body};
`;
  writeFileSync(path, content);
}

// ============================================================================
// RUN
// ============================================================================
console.log('Baking Phosphor icons...');
const phosphor = bakePhosphor();
console.log(`  ${Object.keys(phosphor.baked).length} icons baked; ${phosphor.missing.length} missing`);
if (phosphor.missing.length > 0) {
  console.log('  missing:', phosphor.missing.slice(0, 20).join(', '),
    phosphor.missing.length > 20 ? `... +${phosphor.missing.length - 20}` : '');
}

console.log('\nBaking Simple Icons...');
const brand = bakeSimpleIcons();
console.log(`  ${Object.keys(brand.baked).length} icons baked; ${brand.missing.length} missing`);
if (brand.missing.length > 0) {
  console.log('  missing:', brand.missing.slice(0, 20).join(', '));
}

console.log('\nBaking flag-icons...');
const flags = bakeFlagIcons();
console.log(`  ${Object.keys(flags.baked).length} flags baked`);

console.log('\nWriting output files...');
writeBakedFile(
  OUT_PHOSPHOR,
  'BAKED_ICONS',
  phosphor.baked,
  'Source: @phosphor-icons/core (MIT) - regular weight SVG path d attributes.',
);
writeBakedFile(
  OUT_BRAND,
  'BRAND_ICONS',
  brand.baked,
  'Source: simple-icons (MIT) - brand SVG path + native brand fill color.',
);
writeBakedFile(
  OUT_FLAGS,
  'FLAG_ICONS',
  flags.baked,
  'Source: flag-icons (CC0) - 4x3 SVG inner body keyed by ISO 3166-1 alpha-2.',
);

console.log(`\nTotal baked: ${
  Object.keys(phosphor.baked).length +
  Object.keys(brand.baked).length +
  Object.keys(flags.baked).length
} icons across 3 source files.`);
```

- [ ] **Step 4: Run the bake script**

```bash
cd /Users/hexiaoyang/Documents/sdf-main
node sdf-js/scripts/bake-icon-library-v2.mjs
```

Expected output (counts approximate ±10%):
```
Baking Phosphor icons...
  ~1900 icons baked; ~50 missing (deduped names some may not exist in Phosphor regular)
Baking Simple Icons...
  ~150 icons baked; ~20 missing (some slugs may not match)
Baking flag-icons...
  207 flags baked
Writing output files...
Total baked: ~2257 icons across 3 source files.
```

If any "missing" output exceeds 20% of a category's names, **stop and audit**: edit `categories.js` to remove non-existent names. Re-run bake until missing is below 20%. (Some Phosphor names get renamed/deprecated across versions — this is normal; the curation just needs to match what's actually in the installed package.)

- [ ] **Step 5: Verify 3 baked files exist + counts via Node**

```bash
node -e "
import('./sdf-js/src/icons/baked-library.js').then(m => console.log('Phosphor:', Object.keys(m.BAKED_ICONS).length));
import('./sdf-js/src/icons/brand-icons.js').then(m => console.log('Brand:', Object.keys(m.BRAND_ICONS).length));
import('./sdf-js/src/icons/flag-icons.js').then(m => console.log('Flags:', Object.keys(m.FLAG_ICONS).length));
"
```

Expected: 3 lines printing counts, total roughly 2200-2900.

- [ ] **Step 6: Commit Task 1**

```bash
cd /Users/hexiaoyang/Documents/sdf-main
git add package.json package-lock.json \
        sdf-js/scripts/bake-icon-library-v2.mjs \
        sdf-js/src/icons/categories.js \
        sdf-js/src/icons/baked-library.js \
        sdf-js/src/icons/brand-icons.js \
        sdf-js/src/icons/flag-icons.js
git commit -m "feat(icons): Sprint 18 Task 1 — 3-source icon bake (~2900 icons / 14 cats)"
```

---

## Task 2: Resolver + fuzzy fallback (icons/index.js)

**Spec ref**: §2 (Layer 1 unified resolver), §3 (fuzzy fallback).

**Goal:** Rewrite `sdf-js/src/icons/index.js` so a single `getIconPath2D(name)` call resolves names across all 3 baked sources, and falls back via Levenshtein distance to the closest known name when the requested name doesn't exist.

**Files:**
- Create: `sdf-js/src/icons/fuzzy.js`
- Rewrite: `sdf-js/src/icons/index.js`

**Interfaces:**
- **Consumes**: `BAKED_ICONS` from `baked-library.js`, `BRAND_ICONS` from `brand-icons.js`, `FLAG_ICONS` from `flag-icons.js`, `CATEGORIES` from `categories.js`.
- **Produces**: `getIconPath2D(name)` returns `{path: Path2D, color: string|null, source: 'phosphor'|'brand'|'flag'|'fallback', resolvedName: string}` or `null` if even fuzzy fails. Other accessors: `getIconBrandColor(name) → string|null`, `hasIcon(name) → boolean`, `getCategoryIcons(cat) → string[]`, `getAllCategories() → string[]`, `getIconCategory(cat) → string[]` (kept as alias for Sprint 15c backward compat).

- [ ] **Step 1: Write `sdf-js/src/icons/fuzzy.js`**

```javascript
// =============================================================================
// sdf-js/src/icons/fuzzy.js — Levenshtein distance for icon-name fallback
// -----------------------------------------------------------------------------
// Sprint 18: when an LLM emits an icon name we don't have (e.g. typo
// "brifcase" instead of "briefcase"), we find the closest match in the
// baked library and use that. Distance threshold ≤ 2 to avoid wild swaps.
// =============================================================================

/**
 * Compute the Levenshtein edit distance between two strings.
 * Iterative DP, O(n*m) time, O(min(n,m)) space.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function levenshtein(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  // Single-row DP
  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,        // deletion
        curr[j - 1] + 1,    // insertion
        prev[j - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/**
 * Find the closest name in candidates list. Returns {name, distance} or null
 * if best distance exceeds maxDistance.
 *
 * @param {string} query
 * @param {string[]} candidates
 * @param {number} [maxDistance=2]
 * @returns {{name: string, distance: number}|null}
 */
export function closestMatch(query, candidates, maxDistance = 2) {
  let bestName = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = levenshtein(query, c);
    if (d < bestDist) {
      bestDist = d;
      bestName = c;
      if (d === 0) break;
    }
  }
  if (bestName === null || bestDist > maxDistance) return null;
  return { name: bestName, distance: bestDist };
}
```

- [ ] **Step 2: Rewrite `sdf-js/src/icons/index.js`**

```javascript
// =============================================================================
// sdf-js/src/icons/index.js — Atlas icon library runtime API (Sprint 18)
// -----------------------------------------------------------------------------
// Unified resolver across 3 sources (Phosphor / Simple Icons / flag-icons)
// with fuzzy fallback for typos. See:
//   docs/superpowers/specs/2026-06-23-atlas-icons-and-text-minimization-sprint-18-design.md
//
// Consumers:
//   - sdf-js/src/present/atoms-2d/icons/{icon-badge,icon-row,icon-grid}.js
//   - 6 atoms with inline-icon support (bullet-list / agenda-list / etc)
//   - Lift prompt v4 (catalog injection)
// =============================================================================

import { BAKED_ICONS } from './baked-library.js';
import { BRAND_ICONS } from './brand-icons.js';
import { FLAG_ICONS } from './flag-icons.js';
import { CATEGORIES, CATEGORY_NAMES, getCategoryNames, getCategoryForIcon } from './categories.js';
import { closestMatch } from './fuzzy.js';

// Pre-compute a flat name list for fuzzy matching (across all 3 sources)
const ALL_NAMES = [
  ...Object.keys(BAKED_ICONS),
  ...Object.keys(BRAND_ICONS).map((s) => `brand:${s}`),
  ...Object.keys(FLAG_ICONS).map((c) => `flag:${c}`),
];
const PLAIN_NAMES = [
  ...Object.keys(BAKED_ICONS),
  ...Object.keys(BRAND_ICONS),
  ...Object.keys(FLAG_ICONS),
];

/**
 * Resolved icon descriptor.
 * @typedef {object} IconResult
 * @property {Path2D|null} path — Path2D for path-based icons; null for flags
 *           (flags have raster-ish multi-element SVG, draw differently)
 * @property {string|null} color — Brand hex color for Simple Icons; null
 *           for Phosphor (caller chooses theme color); null for flags
 * @property {string} source — 'phosphor' | 'brand' | 'flag' | 'fallback' | 'placeholder'
 * @property {string} resolvedName — actual name used (may differ from query if fuzzy)
 * @property {string|null} svgInner — Flag SVG inner body; null for non-flag
 */

/**
 * Main resolver. Tries (in order): Phosphor, brand:, flag:, fuzzy fallback,
 * placeholder square.
 *
 * @param {string} name
 * @returns {IconResult}
 */
export function getIconPath2D(name) {
  if (!name || typeof name !== 'string') return placeholder();
  const lc = name.toLowerCase().trim();

  // 1. Prefixed lookups (explicit source)
  if (lc.startsWith('phosphor:')) return _phosphor(lc.slice(9));
  if (lc.startsWith('brand:')) return _brand(lc.slice(6));
  if (lc.startsWith('flag:')) return _flag(lc.slice(5));
  if (lc.startsWith('country-')) return _flag(lc.slice(8));

  // 2. Try Phosphor (most common)
  if (Object.prototype.hasOwnProperty.call(BAKED_ICONS, lc)) {
    return _phosphor(lc);
  }
  // 3. Try Brand (Simple Icons)
  if (Object.prototype.hasOwnProperty.call(BRAND_ICONS, lc)) {
    return _brand(lc);
  }
  // 4. Try flag (2-letter ISO code or unprefixed flag name)
  if (lc.length === 2 && Object.prototype.hasOwnProperty.call(FLAG_ICONS, lc)) {
    return _flag(lc);
  }
  // 5. Fuzzy fallback across all sources
  const match = closestMatch(lc, PLAIN_NAMES, 2);
  if (match) {
    const result = getIconPath2D(match.name);
    return { ...result, source: 'fallback', resolvedName: match.name };
  }
  // 6. Placeholder
  return placeholder();
}

function _phosphor(name) {
  if (!Object.prototype.hasOwnProperty.call(BAKED_ICONS, name)) {
    return placeholder();
  }
  if (typeof Path2D === 'undefined') {
    return { path: null, color: null, source: 'phosphor', resolvedName: name, svgInner: null };
  }
  return {
    path: new Path2D(BAKED_ICONS[name]),
    color: null,
    source: 'phosphor',
    resolvedName: name,
    svgInner: null,
  };
}

function _brand(slug) {
  if (!Object.prototype.hasOwnProperty.call(BRAND_ICONS, slug)) {
    return placeholder();
  }
  const entry = BRAND_ICONS[slug];
  if (typeof Path2D === 'undefined') {
    return { path: null, color: entry.color, source: 'brand', resolvedName: slug, svgInner: null };
  }
  return {
    path: new Path2D(entry.path),
    color: entry.color,
    source: 'brand',
    resolvedName: slug,
    svgInner: null,
  };
}

function _flag(code) {
  if (!Object.prototype.hasOwnProperty.call(FLAG_ICONS, code)) {
    return placeholder();
  }
  return {
    path: null,
    color: null,
    source: 'flag',
    resolvedName: code,
    svgInner: FLAG_ICONS[code], // consumer renders as inner SVG body
  };
}

function placeholder() {
  if (typeof Path2D === 'undefined') {
    return { path: null, color: null, source: 'placeholder', resolvedName: '', svgInner: null };
  }
  // Filled square 4..20 in 24-canvas viewbox (Phosphor-compatible coords)
  return {
    path: new Path2D('M4 4h16v16H4z'),
    color: null,
    source: 'placeholder',
    resolvedName: '',
    svgInner: null,
  };
}

/**
 * Quick membership check. Doesn't trigger fuzzy.
 * @param {string} name
 * @returns {boolean}
 */
export function hasIcon(name) {
  const lc = (name || '').toLowerCase().trim();
  if (lc.startsWith('brand:')) return Object.prototype.hasOwnProperty.call(BRAND_ICONS, lc.slice(6));
  if (lc.startsWith('flag:')) return Object.prototype.hasOwnProperty.call(FLAG_ICONS, lc.slice(5));
  return (
    Object.prototype.hasOwnProperty.call(BAKED_ICONS, lc) ||
    Object.prototype.hasOwnProperty.call(BRAND_ICONS, lc) ||
    (lc.length === 2 && Object.prototype.hasOwnProperty.call(FLAG_ICONS, lc))
  );
}

/**
 * Get the brand color for a Simple Icons entry. Returns null for Phosphor / flags.
 * @param {string} name
 * @returns {string|null}
 */
export function getIconBrandColor(name) {
  const lc = (name || '').toLowerCase().trim();
  const slug = lc.startsWith('brand:') ? lc.slice(6) : lc;
  return BRAND_ICONS[slug]?.color ?? null;
}

// ----------------------------------------------------------------------------
// Sprint 15c backward-compat re-exports
// ----------------------------------------------------------------------------
export function getIconPath(name) {
  return BAKED_ICONS[name] ?? null;
}

export function getCategoryIcons(category) {
  return getCategoryNames(category);
}

export function getAllCategories() {
  return CATEGORY_NAMES.slice();
}

// Sprint 15c name alias
export const getIconCategory = getCategoryIcons;

export { CATEGORIES, CATEGORY_NAMES, getCategoryForIcon };
```

- [ ] **Step 3: Quick smoke via REPL**

```bash
cd /Users/hexiaoyang/Documents/sdf-main
node -e "
const m = await import('./sdf-js/src/icons/index.js');
console.log('Phosphor briefcase:', m.getIconPath2D('briefcase').source);
console.log('Brand slack:', m.getIconPath2D('slack').source);
console.log('Brand color slack:', m.getIconBrandColor('slack'));
console.log('Flag cn:', m.getIconPath2D('cn').source);
console.log('Fuzzy brifcase:', m.getIconPath2D('brifcase').source, m.getIconPath2D('brifcase').resolvedName);
console.log('Unknown:', m.getIconPath2D('xyznotreal').source);
"
```

Expected output:
```
Phosphor briefcase: phosphor
Brand slack: brand
Brand color slack: #4A154B
Flag cn: flag
Fuzzy brifcase: fallback briefcase
Unknown: placeholder
```

- [ ] **Step 4: Commit Task 2**

```bash
git add sdf-js/src/icons/index.js sdf-js/src/icons/fuzzy.js
git commit -m "feat(icons): Sprint 18 Task 2 — unified resolver + fuzzy fallback"
```

---

## Task 3: Library smoke test suite

**Spec ref**: §7 (Testing — Unit / smoke).

**Goal:** A Node-side test file that exercises the icon library API across all 3 sources + fuzzy + categories. No browser. No Path2D dependency (tests run with global Path2D shimmed to a stub).

**Files:**
- Create: `sdf-js/scripts/test-icon-library-expanded.mjs`

**Interfaces:**
- **Consumes**: API from `sdf-js/src/icons/index.js` (Task 2).
- **Produces**: Pass/fail report. Exit code 0 on green.

- [ ] **Step 1: Write `sdf-js/scripts/test-icon-library-expanded.mjs`**

```javascript
// =============================================================================
// test-icon-library-expanded.mjs — Sprint 18 icon library smoke
// -----------------------------------------------------------------------------
// Verifies:
//   - All 3 sources baked + reachable via getIconPath2D
//   - 14 categories non-empty
//   - Brand icons return native color
//   - Flag icons resolve via 2-letter code, flag: prefix, country- prefix
//   - Fuzzy fallback works for ≤2 edit distance
//   - Unknown name returns placeholder (no throw)
// =============================================================================

// Shim Path2D for Node — minimal stub so the resolver can construct one
globalThis.Path2D = class Path2D { constructor(d) { this.d = d; } };

import {
  getIconPath2D,
  getIconBrandColor,
  hasIcon,
  getCategoryIcons,
  getAllCategories,
  CATEGORIES,
} from '../src/icons/index.js';

let pass = 0;
let fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else      { fail++; console.log(`  ✗ ${name}`); }
}

console.log('=== icon library expanded smoke (Sprint 18) ===\n');

console.log('--- 14 categories present ---');
{
  const cats = getAllCategories();
  ok(cats.length === 14, `14 categories (got ${cats.length})`);
  for (const c of cats) {
    const names = getCategoryIcons(c);
    ok(names.length > 0, `category ${c} non-empty (${names.length} names)`);
  }
}

console.log('\n--- Phosphor source ---');
{
  const r = getIconPath2D('briefcase');
  ok(r.source === 'phosphor', `briefcase → phosphor (got ${r.source})`);
  ok(r.path !== null, 'phosphor path is non-null');
  ok(r.color === null, 'phosphor color is null (theme-controlled)');
  ok(r.resolvedName === 'briefcase', 'resolvedName matches input');
}

console.log('\n--- Brand source (Simple Icons) ---');
{
  const r = getIconPath2D('slack');
  ok(r.source === 'brand', `slack → brand (got ${r.source})`);
  ok(r.path !== null, 'brand path is non-null');
  ok(r.color !== null && r.color.startsWith('#'), `brand color hex (got ${r.color})`);
  ok(getIconBrandColor('slack') === r.color, 'getIconBrandColor matches');
  // Prefix form
  const p = getIconPath2D('brand:facebook');
  ok(p.source === 'brand', `brand:facebook → brand (got ${p.source})`);
  ok(p.resolvedName === 'facebook', 'prefix stripped in resolvedName');
}

console.log('\n--- Flag source ---');
{
  const a = getIconPath2D('cn');
  ok(a.source === 'flag', `cn → flag (got ${a.source})`);
  ok(a.svgInner !== null && a.svgInner.length > 0, 'flag svgInner non-empty');
  const b = getIconPath2D('flag:us');
  ok(b.source === 'flag', `flag:us → flag (got ${b.source})`);
  const c = getIconPath2D('country-jp');
  ok(c.source === 'flag', `country-jp → flag (got ${c.source})`);
}

console.log('\n--- Fuzzy fallback (edit distance ≤2) ---');
{
  const r = getIconPath2D('brifcase'); // missing 'e'
  ok(r.source === 'fallback', `brifcase → fallback (got ${r.source})`);
  ok(r.resolvedName === 'briefcase', `resolved to briefcase (got ${r.resolvedName})`);
}

console.log('\n--- Unknown name → placeholder ---');
{
  const r = getIconPath2D('xyznotrealxyz');
  ok(r.source === 'placeholder', `unknown → placeholder (got ${r.source})`);
  ok(r.path !== null, 'placeholder still has Path2D so render does not break');
}

console.log('\n--- hasIcon membership ---');
{
  ok(hasIcon('briefcase'), 'hasIcon(briefcase) true');
  ok(hasIcon('slack'), 'hasIcon(slack) true');
  ok(hasIcon('cn'), 'hasIcon(cn) true');
  ok(!hasIcon('xyznotreal'), 'hasIcon(xyznotreal) false');
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
```

- [ ] **Step 2: Run the test**

```bash
cd /Users/hexiaoyang/Documents/sdf-main
node sdf-js/scripts/test-icon-library-expanded.mjs
```

Expected: `Result: 30 passed, 0 failed`. If a category test fails because a Phosphor icon name was removed, fix it in Task 1's `categories.js`, re-run bake, then re-run this test.

- [ ] **Step 3: Commit Task 3**

```bash
git add sdf-js/scripts/test-icon-library-expanded.mjs
git commit -m "test(icons): Sprint 18 Task 3 — library expanded smoke (30 assertions)"
```

---

## Task 4: `icon-row` atom

**Spec ref**: §4.1 (icon-row), §2 (atoms layer).

**Goal:** A new atom that draws N items (2-8) horizontally with auto-spacing, each item being an icon (pseudo-3D circular badge by default) + label + optional sublabel. Color auto-routes (brand vs theme) per item.

**Files:**
- Create: `sdf-js/src/present/atoms-2d/icons/icon-row.js`
- Modify: `sdf-js/src/present/atoms-2d/registry.js` (register the atom)

**Interfaces:**
- **Consumes**: `getIconPath2D`, `getIconBrandColor` from `../../../icons/index.js`; `rgbCss`, `rgbaCss` from `../renderer.js`.
- **Produces**: An atom with `spec.type === 'icon-row'` exposing `drawPseudo3D(ctx, args, opts)`. Args: `{items: [{icon, label, sublabel?, color?}], title?, subtitle?, colorMode?, iconStyle?}`.

- [ ] **Step 1: Read the existing `icon-badge.js` for style consistency**

```bash
cat sdf-js/src/present/atoms-2d/icons/icon-badge.js | head -80
```

You'll see the badge rendering pattern (drop shadow, radial gradient, specular highlight, white icon on colored circle). Replicate that look for each item in icon-row.

- [ ] **Step 2: Write `sdf-js/src/present/atoms-2d/icons/icon-row.js`**

```javascript
// =============================================================================
// atoms-2d/icons/icon-row.js — N icons horizontally with labels
// -----------------------------------------------------------------------------
// Sprint 18: PL D3180 Vision/Mission/Values/Contact pattern. Items distribute
// evenly across canvas width. Each item: pseudo-3D circular badge + label
// below + optional sublabel. Auto-wraps to 2 rows when ≥7 items.
//
// Color routing:
//   - args.colorMode='auto' (default): brand icons → brand color; phosphor → palette.accent
//   - 'brand' forces brand color (Phosphor falls back to accent)
//   - 'theme' forces palette.accent for all
//
// Per docs/superpowers/specs/2026-06-23-atlas-icons-and-text-minimization-sprint-18-design.md §4.1
// =============================================================================

import { rgbCss, rgbaCss } from '../renderer.js';
import { getIconPath2D, getIconBrandColor } from '../../../icons/index.js';

export const spec = {
  type: 'icon-row',
  category: 'icons',
  description: 'N icons (2-8) horizontally with labels — vision/values/contact pattern.',
  args: {
    items: {
      type: 'array of { icon, label, sublabel?, color? } (2-8)',
      required: true,
      example: [
        { icon: 'shield', label: 'Trust' },
        { icon: 'sparkle', label: 'Quality' },
        { icon: 'lightning', label: 'Speed' },
        { icon: 'heart', label: 'Customer Focus' },
      ],
    },
    title: { type: 'string?', example: 'Our Values' },
    subtitle: { type: 'string?', example: 'How we work' },
    colorMode: {
      type: "'auto'|'brand'|'theme'?",
      default: "'auto'",
      example: 'auto',
    },
    iconStyle: {
      type: "'circle'|'square'|'plain'?",
      default: "'circle'",
      example: 'circle',
    },
  },
};

const PAD = 24;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 1200;
  const h = opts.h ?? 360;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const accent = palette.colors?.[0] || palette.accent || [60, 130, 200];
  const colorMode = args.colorMode || 'auto';
  const iconStyle = args.iconStyle || 'circle';

  const items = Array.isArray(args.items) ? args.items.slice(0, 8) : [];
  if (items.length === 0) return;

  // ---- Title block ----
  let plotTop = y + PAD;
  if (args.title) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(h * 0.085)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, y + PAD);
    plotTop = y + PAD + Math.round(h * 0.085) + 6;
    if (args.subtitle) {
      ctx.fillStyle = rgbaCss(fg, 0.6);
      ctx.font = `400 ${Math.round(h * 0.045)}px Inter, system-ui, sans-serif`;
      ctx.fillText(args.subtitle, x + PAD, plotTop);
      plotTop += Math.round(h * 0.045) + 12;
    } else {
      plotTop += 8;
    }
  }

  // ---- Layout ----
  const N = items.length;
  const useTwoRows = N >= 7;
  const cols = useTwoRows ? Math.ceil(N / 2) : N;
  const rows = useTwoRows ? 2 : 1;
  const colW = (w - PAD * 2) / cols;
  const rowH = (y + h - plotTop - PAD) / rows;
  const iconR = Math.min(rowH * 0.32, colW * 0.32, 64);

  for (let i = 0; i < N; i++) {
    const it = items[i] || {};
    const col = useTwoRows ? i % cols : i;
    const row = useTwoRows ? Math.floor(i / cols) : 0;
    const cellCx = x + PAD + col * colW + colW / 2;
    const cellTopY = plotTop + row * rowH;

    // Resolve icon
    const resolved = getIconPath2D(it.icon || '');
    const isBrand = resolved.source === 'brand';
    const brandColor = isBrand ? hexToRgb(resolved.color) : null;
    const iconColor =
      colorMode === 'theme' ? accent :
      colorMode === 'brand' ? (brandColor ?? accent) :
      /* auto */            (brandColor ?? accent);

    // Optional per-item color override
    const badgeColor = Array.isArray(it.color) ? it.color : iconColor;

    // ---- Badge (circle/square/plain) ----
    const iconCy = cellTopY + iconR + 16;
    if (iconStyle === 'circle') {
      drawCircleBadge(ctx, cellCx, iconCy, iconR, badgeColor);
    } else if (iconStyle === 'square') {
      drawSquareBadge(ctx, cellCx, iconCy, iconR, badgeColor);
    }
    // plain: no badge

    // ---- Icon path (white on circle/square; badge-color on plain) ----
    drawIconCentered(ctx, resolved, cellCx, iconCy, iconR * 0.85,
      iconStyle === 'plain' ? badgeColor : [255, 255, 255]);

    // ---- Label below ----
    if (it.label) {
      ctx.fillStyle = rgbCss(fg);
      ctx.font = `700 ${Math.round(rowH * 0.13)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const labelY = iconCy + iconR + 14;
      ctx.fillText(fitText(ctx, String(it.label), colW - 20), cellCx, labelY);

      if (it.sublabel) {
        ctx.fillStyle = rgbaCss(fg, 0.55);
        ctx.font = `400 ${Math.round(rowH * 0.085)}px Inter, system-ui, sans-serif`;
        ctx.fillText(
          fitText(ctx, String(it.sublabel), colW - 20),
          cellCx,
          labelY + Math.round(rowH * 0.13) + 4,
        );
      }
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

function drawCircleBadge(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
  grad.addColorStop(0, rgbCss(lighten(color, 0.22)));
  grad.addColorStop(1, rgbCss(color));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // Specular
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.25, cy - r * 0.35, r * 0.5, r * 0.25, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSquareBadge(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grad.addColorStop(0, rgbCss(lighten(color, 0.2)));
  grad.addColorStop(1, rgbCss(color));
  ctx.fillStyle = grad;
  ctx.beginPath();
  const rr = r * 0.18;
  ctx.moveTo(cx - r + rr, cy - r);
  ctx.arcTo(cx + r, cy - r, cx + r, cy + r, rr);
  ctx.arcTo(cx + r, cy + r, cx - r, cy + r, rr);
  ctx.arcTo(cx - r, cy + r, cx - r, cy - r, rr);
  ctx.arcTo(cx - r, cy - r, cx + r, cy - r, rr);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawIconCentered(ctx, resolved, cx, cy, size, color) {
  if (!resolved || resolved.path === null) return; // flag svgInner not supported here yet
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24); // Phosphor 24-unit viewbox
  ctx.fillStyle = rgbCss(color);
  ctx.fill(resolved.path);
  ctx.restore();
}

function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}

function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}

function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return null;
  const m = hex.replace('#', '');
  if (m.length !== 6) return null;
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}
```

- [ ] **Step 3: Register the atom in `sdf-js/src/present/atoms-2d/registry.js`**

Find the existing atoms-2d registry. Pattern follows `icon-badge` registration. Open the file:

```bash
grep -n "icon-badge" sdf-js/src/present/atoms-2d/registry.js | head -5
```

Add an entry mirroring icon-badge's pattern. The exact insertion depends on the registry's structure — likely an import + an entry in a map. Add:

```javascript
// At top with other imports:
import * as iconRow from './icons/icon-row.js';

// In the registry map (search for `'icon-badge'`):
'icon-row': iconRow,
```

- [ ] **Step 4: Quick render smoke via Node test stub**

Atoms can be exercised in Node by stubbing Canvas2D — the same Path2D stub used in Task 3 plus a CanvasRenderingContext2D stub. But Canvas2D is broad; easier is to verify import works + spec is exported correctly:

```bash
cd /Users/hexiaoyang/Documents/sdf-main
node -e "
import('./sdf-js/src/present/atoms-2d/icons/icon-row.js').then(m => {
  console.log('spec.type:', m.spec.type);
  console.log('args keys:', Object.keys(m.spec.args).join(', '));
  console.log('drawPseudo3D type:', typeof m.drawPseudo3D);
});
"
```

Expected:
```
spec.type: icon-row
args keys: items, title, subtitle, colorMode, iconStyle
drawPseudo3D type: function
```

Visual smoke (full render) is deferred to Task 8 (the showcase HTML).

- [ ] **Step 5: Commit Task 4**

```bash
git add sdf-js/src/present/atoms-2d/icons/icon-row.js \
        sdf-js/src/present/atoms-2d/registry.js
git commit -m "feat(atom): Sprint 18 Task 4 — icon-row atom (N×1 with labels)"
```

---

## Task 5: `icon-grid` atom

**Spec ref**: §4.1 (icon-grid).

**Goal:** Sibling of icon-row but for M×N grid layouts. Auto-picks columns by item count: 4→2×2, 6→2×3, 9→3×3, 12→4×3, ≥16→4×4. Same badge/colorMode/iconStyle conventions as icon-row.

**Files:**
- Create: `sdf-js/src/present/atoms-2d/icons/icon-grid.js`
- Modify: `sdf-js/src/present/atoms-2d/registry.js` (register)

**Interfaces:**
- Same as icon-row but `args.cols?: 'auto'|number` (default 'auto').

- [ ] **Step 1: Write `sdf-js/src/present/atoms-2d/icons/icon-grid.js`**

```javascript
// =============================================================================
// atoms-2d/icons/icon-grid.js — M×N icon grid with labels
// -----------------------------------------------------------------------------
// Sprint 18: PL "Core Values" / "Services" pattern with more items than fit
// in a single row. Auto-picks column count from item count, or accept explicit
// `args.cols`. Card-cell rendering for visual structure.
//
// Per docs/superpowers/specs/2026-06-23-atlas-icons-and-text-minimization-sprint-18-design.md §4.1
// =============================================================================

import { rgbCss, rgbaCss } from '../renderer.js';
import { getIconPath2D } from '../../../icons/index.js';

export const spec = {
  type: 'icon-grid',
  category: 'icons',
  description: 'M×N icon grid with labels — services / values / features.',
  args: {
    items: {
      type: 'array of { icon, label, sublabel?, color? } (4-16)',
      required: true,
      example: [
        { icon: 'shield', label: 'Security', sublabel: 'End-to-end' },
        { icon: 'lightning', label: 'Speed', sublabel: 'Sub-second' },
        { icon: 'globe', label: 'Global', sublabel: '50+ countries' },
        { icon: 'heart', label: 'Care', sublabel: '24/7 support' },
      ],
    },
    cols: {
      type: "'auto'|number?",
      default: "'auto' — 4→2×2, 6→2×3, 9→3×3, 12→4×3, ≥16→4×4",
      example: 3,
    },
    title: { type: 'string?', example: 'Core Values' },
    colorMode: { type: "'auto'|'brand'|'theme'?", default: "'auto'", example: 'auto' },
    iconStyle: { type: "'circle'|'square'|'plain'?", default: "'circle'", example: 'circle' },
  },
};

const PAD = 24;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 1200;
  const h = opts.h ?? 600;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const accent = palette.colors?.[0] || palette.accent || [60, 130, 200];
  const colorMode = args.colorMode || 'auto';
  const iconStyle = args.iconStyle || 'circle';

  const items = Array.isArray(args.items) ? args.items.slice(0, 16) : [];
  if (items.length === 0) return;
  const N = items.length;

  // ---- Title ----
  let plotTop = y + PAD;
  if (args.title) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(h * 0.06)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, y + PAD);
    plotTop = y + PAD + Math.round(h * 0.06) + 12;
  }

  // ---- Column count ----
  let cols = args.cols;
  if (cols === 'auto' || cols === undefined) {
    if (N <= 4) cols = 2;
    else if (N <= 6) cols = 3;
    else if (N <= 9) cols = 3;
    else if (N <= 12) cols = 4;
    else cols = 4;
  }
  const rows = Math.ceil(N / cols);
  const colW = (w - PAD * 2) / cols;
  const rowH = (y + h - plotTop - PAD) / rows;
  const iconR = Math.min(rowH * 0.25, colW * 0.18, 48);

  for (let i = 0; i < N; i++) {
    const it = items[i] || {};
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cellX = x + PAD + col * colW;
    const cellY = plotTop + row * rowH;
    const cellCx = cellX + colW / 2;
    const cellCy = cellY + rowH / 2 - 8;

    const resolved = getIconPath2D(it.icon || '');
    const isBrand = resolved.source === 'brand';
    const brandColor = isBrand ? hexToRgb(resolved.color) : null;
    const iconColor =
      colorMode === 'theme' ? accent :
      colorMode === 'brand' ? (brandColor ?? accent) :
      (brandColor ?? accent);
    const badgeColor = Array.isArray(it.color) ? it.color : iconColor;

    const iconCy = cellY + iconR + 12;
    if (iconStyle === 'circle') {
      drawCircleBadge(ctx, cellCx, iconCy, iconR, badgeColor);
    } else if (iconStyle === 'square') {
      drawSquareBadge(ctx, cellCx, iconCy, iconR, badgeColor);
    }
    drawIconCentered(ctx, resolved, cellCx, iconCy, iconR * 0.85,
      iconStyle === 'plain' ? badgeColor : [255, 255, 255]);

    if (it.label) {
      ctx.fillStyle = rgbCss(fg);
      ctx.font = `700 ${Math.round(rowH * 0.11)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const labelY = iconCy + iconR + 10;
      ctx.fillText(fitText(ctx, String(it.label), colW - 16), cellCx, labelY);
      if (it.sublabel) {
        ctx.fillStyle = rgbaCss(fg, 0.55);
        ctx.font = `400 ${Math.round(rowH * 0.075)}px Inter, system-ui, sans-serif`;
        ctx.fillText(
          fitText(ctx, String(it.sublabel), colW - 16),
          cellCx,
          labelY + Math.round(rowH * 0.11) + 4,
        );
      }
    }
  }
  void cellCy; // silence unused
}

// ---- Helpers (duplicated from icon-row to keep atoms self-contained;
// extract to shared if a 3rd consumer appears) ----

function drawCircleBadge(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
  grad.addColorStop(0, rgbCss(lighten(color, 0.22)));
  grad.addColorStop(1, rgbCss(color));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.25, cy - r * 0.35, r * 0.5, r * 0.25, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSquareBadge(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grad.addColorStop(0, rgbCss(lighten(color, 0.2)));
  grad.addColorStop(1, rgbCss(color));
  ctx.fillStyle = grad;
  const rr = r * 0.18;
  ctx.beginPath();
  ctx.moveTo(cx - r + rr, cy - r);
  ctx.arcTo(cx + r, cy - r, cx + r, cy + r, rr);
  ctx.arcTo(cx + r, cy + r, cx - r, cy + r, rr);
  ctx.arcTo(cx - r, cy + r, cx - r, cy - r, rr);
  ctx.arcTo(cx - r, cy - r, cx + r, cy - r, rr);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawIconCentered(ctx, resolved, cx, cy, size, color) {
  if (!resolved || resolved.path === null) return;
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = rgbCss(color);
  ctx.fill(resolved.path);
  ctx.restore();
}

function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}

function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}

function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return null;
  const m = hex.replace('#', '');
  if (m.length !== 6) return null;
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}
```

- [ ] **Step 2: Register in registry**

Same pattern as Task 4 Step 3:

```javascript
import * as iconGrid from './icons/icon-grid.js';
// In map:
'icon-grid': iconGrid,
```

- [ ] **Step 3: Smoke import**

```bash
node -e "
import('./sdf-js/src/present/atoms-2d/icons/icon-grid.js').then(m => {
  console.log('spec.type:', m.spec.type);
  console.log('drawPseudo3D type:', typeof m.drawPseudo3D);
});
"
```

Expected:
```
spec.type: icon-grid
drawPseudo3D type: function
```

- [ ] **Step 4: Commit Task 5**

```bash
git add sdf-js/src/present/atoms-2d/icons/icon-grid.js \
        sdf-js/src/present/atoms-2d/registry.js
git commit -m "feat(atom): Sprint 18 Task 5 — icon-grid atom (M×N grid)"
```

---

## Task 6: Inline icon support on 6 atoms

**Spec ref**: §4.2 (Enhanced atoms).

**Goal:** Add `icon` arg per item on bullet-list, agenda-list, progression, kpi-card (wire existing arg), nine-field-matrix, matrix-grid. Backward compatible: missing `icon` → existing default render.

**Files (modify):**
- `sdf-js/src/present/atoms-2d/charts/lists/bullet-list.js`
- `sdf-js/src/present/atoms-2d/charts/lists/progression.js`
- `sdf-js/src/present/atoms-2d/charts/agenda/agenda-list.js`
- `sdf-js/src/present/atoms-2d/charts/data/kpi-card.js`
- `sdf-js/src/present/atoms-2d/charts/diagrams/nine-field-matrix.js`
- `sdf-js/src/present/atoms-2d/charts/diagrams/matrix-grid.js`

**Files (create):**
- `sdf-js/scripts/test-atoms-icons.mjs`

**Interfaces:**
- All 6 atoms accept new optional `items[*].icon` field (or for kpi-card, the existing `args.icon` is now wired to the library resolver).

- [ ] **Step 1: Enhance `bullet-list.js`**

Open the file:

```bash
grep -n "open ring" sdf-js/src/present/atoms-2d/charts/lists/bullet-list.js | head -3
```

Find the `// Open ring for 'todo'` block (around line 109 of the current file from prior sprint work). Replace the open-ring drawing with a conditional: if `it.icon` is set, draw the resolved icon path centered at the bullet position (white-on-accent if filled, accent if "todo" status). Otherwise keep the existing open-ring behaviour.

Add at top of file:
```javascript
import { getIconPath2D } from '../../../../icons/index.js';
```

Replace the bullet drawing block. The exact replacement: in `drawPseudo3D`, after the existing `// Bullet` save/restore region, add the icon drawing.

```javascript
    // Bullet OR icon
    ctx.save();
    if (it.icon) {
      // NEW Sprint 18: icon replaces open-ring/filled bullet
      const resolved = getIconPath2D(it.icon);
      if (resolved.path) {
        const iconSize = bulletR * 1.6;
        ctx.translate(bulletX - iconSize / 2, rowCY - iconSize / 2);
        ctx.scale(iconSize / 24, iconSize / 24);
        const iconColor = status === 'todo' ? rgbaCss(fg, 0.55) :
                          status === 'done' ? rgbCss(darken(accent, 0.2)) :
                          rgbCss(accent);
        ctx.fillStyle = iconColor;
        ctx.fill(resolved.path);
      }
    } else if (isFilled) {
      // ... existing filled bullet logic ...
    } else {
      // ... existing open ring logic ...
    }
    ctx.restore();
```

(Adjust the structural placement so the existing `if (isFilled) {} else {}` becomes the `else` branch of `if (it.icon)`. Read the surrounding context carefully — preserve the existing checkmark drawing under "done" status when icon is not set.)

- [ ] **Step 2: Enhance `progression.js`**

Similar pattern. Find the step circle drawing block:

```bash
grep -n "step\|circle\|arc" sdf-js/src/present/atoms-2d/charts/lists/progression.js | head -10
```

When `it.icon` is set, draw icon instead of (or inside) the step-number bubble. Wire same way:

```javascript
import { getIconPath2D } from '../../../../icons/index.js';
// in the step rendering loop:
if (step.icon) {
  const resolved = getIconPath2D(step.icon);
  if (resolved.path) {
    // draw at step center, white on accent
    ...
  }
} else {
  // existing step-number text render
}
```

- [ ] **Step 3: Enhance `agenda-list.js`**

Two modes — compact (small chip) and showcase (big number). In compact mode, replace the chip number with the icon when `it.icon` is set. In showcase mode, keep the big number but draw a small icon to the left of the label.

```bash
grep -n "drawShowcase\|chip" sdf-js/src/present/atoms-2d/charts/agenda/agenda-list.js | head -10
```

Add import + in both render modes, check for `it.icon` and draw it.

- [ ] **Step 4: Wire `kpi-card.js` existing icon arg to library**

```bash
grep -n "args.icon\|drawIconStub\|icon" sdf-js/src/present/atoms-2d/charts/data/kpi-card.js | head -10
```

The atom already has `args.icon` plumbed through `drawIconStub`. Replace `drawIconStub` body with `getIconPath2D` lookup:

```javascript
import { getIconPath2D } from '../../../../icons/index.js';

function drawIconStub(ctx, name, cx, cy, size, color) {
  const resolved = getIconPath2D(name);
  if (!resolved.path) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color; // already in CSS format from caller
  ctx.fill(resolved.path);
  ctx.restore();
}
```

(Inspect the existing `drawIconStub` signature carefully — the `cx, cy` may have an offset convention; match it.)

- [ ] **Step 5: Enhance `nine-field-matrix.js`**

Find the cell rendering loop. Add icon to each cell when `cells[i].icon` is set:

```javascript
import { getIconPath2D } from '../../../../icons/index.js';
// in cell render:
if (cell.icon) {
  const resolved = getIconPath2D(cell.icon);
  if (resolved.path) {
    // draw small icon at cell top-left, size ~20px
    ...
  }
}
```

- [ ] **Step 6: Enhance `matrix-grid.js`**

Same pattern as `nine-field-matrix.js`. Read the existing cell layout and inject icon at top-left.

- [ ] **Step 7: Write `sdf-js/scripts/test-atoms-icons.mjs`**

Smoke that all 6 enhanced atoms + 2 new atoms accept icon args without throw. Uses a CanvasRenderingContext2D stub.

```javascript
// =============================================================================
// test-atoms-icons.mjs — Sprint 18 atom-level icon smoke
// -----------------------------------------------------------------------------
// Verifies icon args are accepted on 8 atoms (2 new + 6 enhanced), all colorMode
// branches don't throw, backward compat preserved (no icon → render OK).
// Uses Canvas2D stub: tracks calls without rendering pixels.
// =============================================================================

globalThis.Path2D = class Path2D { constructor(d) { this.d = d; } };

class Ctx {
  constructor() {
    this.calls = [];
    this.fillStyle = '';
    this.strokeStyle = '';
    this.font = '';
    this.textAlign = '';
    this.textBaseline = '';
    this.shadowColor = '';
    this.shadowBlur = 0;
    this.shadowOffsetY = 0;
    this.lineWidth = 0;
    this.lineCap = 'butt';
    this.lineJoin = 'miter';
  }
  save() { this.calls.push('save'); }
  restore() { this.calls.push('restore'); }
  beginPath() { this.calls.push('beginPath'); }
  closePath() { this.calls.push('closePath'); }
  moveTo() {} lineTo() {} arc() {} arcTo() {}
  ellipse() {} quadraticCurveTo() {} bezierCurveTo() {}
  fill() { this.calls.push('fill'); }
  stroke() { this.calls.push('stroke'); }
  fillRect() {} clearRect() {} strokeRect() {}
  fillText() { this.calls.push('fillText'); }
  strokeText() {}
  measureText(s) { return { width: s.length * 6 }; }
  translate() {} scale() {} rotate() {} setTransform() {} transform() {}
  createLinearGradient() { return { addColorStop() {} }; }
  createRadialGradient() { return { addColorStop() {} }; }
  createPattern() { return null; }
  clip() {}
  drawImage() {}
}

import { renderAtom } from '../src/present/atoms-2d/registry.js';

let pass = 0;
let fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else      { fail++; console.log(`  ✗ ${name}`); }
}

async function tryRender(type, args) {
  try {
    const ctx = new Ctx();
    await renderAtom(ctx, type, args, 'pseudo3d', {
      x: 0, y: 0, w: 1200, h: 400,
      palette: { silhouetteColor: [30, 30, 30], colors: [[60, 100, 200]], accent: [60, 100, 200] },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

console.log('=== atoms icon smoke (Sprint 18) ===\n');

console.log('--- NEW atoms ---');
for (const type of ['icon-row', 'icon-grid']) {
  const r = await tryRender(type, {
    title: 'Test', items: [
      { icon: 'briefcase', label: 'A' },
      { icon: 'shield', label: 'B' },
      { icon: 'lightning', label: 'C' },
      { icon: 'brand:slack', label: 'D' },
    ],
  });
  ok(r.ok, `${type} renders 4 items (${r.error || 'OK'})`);
  // colorMode variants
  for (const cm of ['auto', 'brand', 'theme']) {
    const r2 = await tryRender(type, {
      items: [{ icon: 'heart', label: 'X' }, { icon: 'star', label: 'Y' }],
      colorMode: cm,
    });
    ok(r2.ok, `${type} colorMode=${cm} (${r2.error || 'OK'})`);
  }
}

console.log('\n--- Enhanced atoms WITH icon ---');
const enhanced = [
  ['bullet-list', { items: [{ label: 'A', icon: 'briefcase' }, { label: 'B', icon: 'shield' }] }],
  ['progression', { steps: [{ label: 'A', icon: 'rocket' }, { label: 'B', icon: 'flag' }, { label: 'C' }] }],
  ['agenda-list', { items: [{ label: 'Recap', icon: 'clock' }, { label: 'Plan', icon: 'calendar' }] }],
  ['kpi-card',    { value: '$3M', label: 'Revenue', icon: 'chart-line-up' }],
  ['nine-field-matrix', { cells: Array.from({length:9}, (_,i) => ({ label: `${i}`, icon: 'star' })),
                          xAxis: 'X', yAxis: 'Y' }],
  ['matrix-grid', { rows: 2, cols: 2, cells: [
    { label: 'A', icon: 'briefcase' }, { label: 'B', icon: 'shield' },
    { label: 'C', icon: 'lightning' }, { label: 'D', icon: 'heart' },
  ] }],
];
for (const [type, args] of enhanced) {
  const r = await tryRender(type, args);
  ok(r.ok, `${type} with icon arg (${r.error || 'OK'})`);
}

console.log('\n--- Enhanced atoms WITHOUT icon (backward compat) ---');
const backward = [
  ['bullet-list', { items: [{ label: 'A' }, { label: 'B' }] }],
  ['progression', { steps: [{ label: 'A' }, { label: 'B' }] }],
  ['agenda-list', { items: [{ label: 'A' }, { label: 'B' }] }],
  ['kpi-card',    { value: '$3M', label: 'Revenue' }],
];
for (const [type, args] of backward) {
  const r = await tryRender(type, args);
  ok(r.ok, `${type} without icon (backward compat) (${r.error || 'OK'})`);
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
```

- [ ] **Step 8: Run the test**

```bash
cd /Users/hexiaoyang/Documents/sdf-main
node sdf-js/scripts/test-atoms-icons.mjs
```

Expected: green. If any atom throws, the most common cause is the import path — `'../../../../icons/index.js'` is the path from `atoms-2d/charts/<sub>/<name>.js` (4 ups). For `icon-row`/`icon-grid` (in `atoms-2d/icons/`), it's `'../../../icons/index.js'` (3 ups).

- [ ] **Step 9: Commit Task 6**

```bash
git add sdf-js/src/present/atoms-2d/charts/lists/bullet-list.js \
        sdf-js/src/present/atoms-2d/charts/lists/progression.js \
        sdf-js/src/present/atoms-2d/charts/agenda/agenda-list.js \
        sdf-js/src/present/atoms-2d/charts/data/kpi-card.js \
        sdf-js/src/present/atoms-2d/charts/diagrams/nine-field-matrix.js \
        sdf-js/src/present/atoms-2d/charts/diagrams/matrix-grid.js \
        sdf-js/scripts/test-atoms-icons.mjs
git commit -m "feat(atoms): Sprint 18 Task 6 — inline icon on 6 atoms + smoke"
```

---

## Task 7: Lift prompt v4 + scaffold registry updates

**Spec ref**: §5 (Lift prompt v4), §6 (Scaffold registry updates).

**Goal:** Inject the full 2900-icon catalog into the cached system prompt + add 4 text-minimization hard rules + 4 worked examples in the per-slot user message. Update scaffold registry so vision/values/services/contact/team/product slots recommend the new icon atoms (and chart atoms before bullet-list when slot purpose is numeric).

**Files (modify):**
- `sdf-js/src/present/scaffold-view.js`
- `sdf-js/scripts/bake-scaffold-pipeline.mjs`
- `sdf-js/src/present/scaffolds/registry.js`

**Files (create):**
- (none — helper functions inline within scaffold-view + bake script)

**Interfaces:**
- A helper `buildIconCatalogString()` accessible to both `scaffold-view.js` and `bake-scaffold-pipeline.mjs`. Returns a string ready to embed in the system prompt.

- [ ] **Step 1: Add `buildIconCatalogString()` to `sdf-js/src/icons/index.js`**

Append to the end of the file:

```javascript
/**
 * Build a compact catalog string for LLM system-prompt injection.
 * One line per category, format:
 *   ## category-name (count): name1, name2, name3, ... nameN
 *
 * For Sprint 18 brand-* categories, brand icons also note their slug
 * prefix so the LLM uses `brand:slack` form (matches resolver).
 *
 * @returns {string}
 */
export function buildIconCatalogString() {
  const lines = ['## Atlas Icon Catalog — names usable in any atom\'s `icon` arg', ''];
  for (const cat of CATEGORY_NAMES) {
    const names = CATEGORIES[cat];
    const prefix = cat.startsWith('brand-') ? 'brand:'
                  : cat === 'flags' ? 'flag:' : '';
    const namesStr = names.map((n) => prefix + n).join(', ');
    lines.push(`### ${cat} (${names.length})`);
    lines.push(namesStr);
    lines.push('');
  }
  lines.push('Resolution order: prefix (brand: / flag:) > Phosphor > Simple Icons > flag-icons > fuzzy fallback > placeholder.');
  return lines.join('\n');
}
```

- [ ] **Step 2: Update lift prompt v4 in `sdf-js/src/present/scaffold-view.js`**

Find the existing `runSlotLift` function. There are two prompt pieces:
- `systemPrompt` (string assembled outside this function or inline)
- `userMessage` (per-slot)

Find where `systemPrompt` is built — around the `system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }]` block. Update it to:

```javascript
// At top of file:
import { buildIconCatalogString } from '../icons/index.js';

// Inside runSlotLift, replace the systemPrompt:
const systemPrompt =
  `You are the Atlas Present scaffold-mode lift LLM. Emit a single JSON ` +
  `SceneData object inside a \`\`\`json fence with no prose. Atoms are 2D ` +
  `Canvas primitives — no 3D, no text-3d-pipe.\n\n` +
  `# CORE GOAL: Atlas decks are 3D theatrical presentations. TEXT MUST BE MINIMAL. ` +
  `Use icons + charts to replace verbose phrases. Audience reads a slide in ` +
  `≤3 seconds; long prose disappears in 3D space.\n\n` +
  buildIconCatalogString();
```

Then update the per-slot `userMessage` rules block. Find the existing `Rules (Sprint 17 polish ...)` block in `userMessage` and replace it with this v4 block:

```javascript
`Rules (Sprint 18 — text minimization + icons):\n` +
`0. **CANVAS BOUNDS**: Every subject: x+w ≤ 1240, y+h ≤ 700.\n` +
`1. **EVERY subject MUST have explicit x/y/w/h** in canvas pixels.\n` +
`2. **Atom selection**: pick from recommended_atoms (priority order). Use forbidden_atoms as hard negative.\n` +
`3. **NUMBERS → CHART, never prose**:\n` +
`   - 3+ KPI values → multiple \`kpi-card\` or 1 \`dashboard-multi-kpi-composite\`\n` +
`   - Time series (4+ points) → \`line\` or \`bar\`\n` +
`   - Proportions/shares → \`pie\` or \`waterfall\`\n` +
`   - Funnel/pipeline → \`funnel\`\n` +
`   - Single percentage → \`sphere-fill\` or \`kpi-card\` or \`kpi-water-drop\`\n` +
`   - NEVER describe numbers in bullet-list when a chart fits\n` +
`4. **SHORT CONCEPTS → icon + 1-3 word label**, not phrase:\n` +
`   - "Values: Trust, Quality, Speed, Customer Focus" → \`icon-row\` with [{icon:'shield',label:'Trust'},{icon:'sparkle',label:'Quality'},...]\n` +
`   - Single-word bullets → \`icon-row\` (4-6 items) or \`icon-grid\` (6-12 items)\n` +
`   - NEVER \`bullet-list\` with all 1-2-word items — use icon-row/grid\n` +
`5. **bullet-list MUST have inline icons** unless content is truly paragraph-like:\n` +
`   - Every \`items[*]\` should have \`icon: '<name>'\` from the catalog above\n` +
`   - Empty bullets (no icon, no real label) = a bug\n` +
`6. **Per-atom soft text budget**: ≤ 8 words per label / value / title (exception: bullet-list items can be longer when paragraph-like).\n` +
`7. **Cover atom**:\n` +
`   - Slot 0 deck cover → h=720 full, style: 'gradient'\n` +
`   - Mid-deck title strip → h=120 TOP STRIP\n` +
`   - Section divider slot → h=720 full + style: 'section'\n` +
`8. **icon-row / icon-grid args**:\n` +
`   - items: [{icon: '<phosphor-name | brand:slug | flag:code>', label: '1-3 words', sublabel?: '3-5 words'}]\n` +
`   - icon-row: 2-8 items horizontally (auto wraps to 2 rows when ≥7)\n` +
`   - icon-grid: 4-16 items (cols auto-picks)\n` +
`   - colorMode default 'auto' (brand icons keep brand color; Phosphor uses theme accent)\n` +
`9. **Theme color**: pass theme accent or colors[] for non-brand icons. Don't invent colors.\n`;
```

And add 4 worked examples to the user message. Insert them BEFORE the `Rules` block:

```javascript
const workedExamples = `## WORKED EXAMPLES (study these patterns)\n\n` +
  `### Example A — values slide:\n` +
  `Source body: "We believe in Trust, Quality, Speed, Customer Focus"\n` +
  `GOOD output:\n` +
  '```json\n' +
  `{ "subjects": [\n` +
  `  { "type": "cover", "x": 0, "y": 0, "w": 1280, "h": 120,\n` +
  `    "args": {"title": "Our Values"} },\n` +
  `  { "type": "icon-row", "x": 40, "y": 160, "w": 1200, "h": 480,\n` +
  `    "args": {\n` +
  `      "items": [\n` +
  `        {"icon": "shield", "label": "Trust"},\n` +
  `        {"icon": "sparkle", "label": "Quality"},\n` +
  `        {"icon": "lightning", "label": "Speed"},\n` +
  `        {"icon": "heart", "label": "Customer Focus"}\n` +
  `      ]\n` +
  `    }\n` +
  `  }\n` +
  `]}\n` +
  '```\n' +
  `BAD: bullet-list with "We believe in Trust" etc.\n\n` +
  `### Example B — KPI dashboard:\n` +
  `Source body: "Q3 results: Revenue $3.4M (+27%), MAU 12,450, Churn 2.1%"\n` +
  `GOOD: 3× \`kpi-card\` atoms with value=$3.4M / 12.4K / 2.1% — no prose.\n\n` +
  `### Example C — time series:\n` +
  `Source body: "ARR: Q1 $0, Q2 $120K, Q3 $740K, Q4F $2.4M"\n` +
  `GOOD: { "type": "line", "args": {"values":[0,0.12,0.74,2.4],"labels":["Q1","Q2","Q3","Q4F"],"format":"currency","title":"ARR Growth"} }\n\n` +
  `### Example D — feature list with inline icons (bullet-list with icons):\n` +
  `Source body: "Mobile wallet / AI co-pilot / E2E encryption / Cross-chain"\n` +
  `GOOD: { "type": "bullet-list", "args": {"items":[\n` +
  `  {"icon": "device-mobile", "label": "Mobile-first wallet"},\n` +
  `  {"icon": "brain", "label": "AI co-pilot"},\n` +
  `  {"icon": "lock-key", "label": "End-to-end encryption"},\n` +
  `  {"icon": "link", "label": "Cross-chain liquidity"}\n` +
  `]} }\n\n`;
```

- [ ] **Step 3: Mirror the changes in `sdf-js/scripts/bake-scaffold-pipeline.mjs`**

The CLI bake has a parallel prompt assembly (around the existing `Rules (Sprint 17 polish ...)` block). Apply the same v4 rules + worked examples + catalog injection (import `buildIconCatalogString` at the top of the script).

- [ ] **Step 4: Update scaffold registry in `sdf-js/src/present/scaffolds/registry.js`**

Add `icon-row` and `icon-grid` to relevant scaffold slots' `recommended_atoms`. The pattern: open the file, find each scaffold's slots[] array, and update the listed slots. Concrete edits:

Find `pitch-deck-vc` scaffold (use grep `'pitch-deck-vc'`). For its `problem` slot, change `recommended_atoms` from `['bullet-list', 'kpi-card', 'icon-badge']` to `['bullet-list', 'icon-row', 'icon-grid', 'kpi-card', 'icon-badge']`. For its `team` slot, add `icon-row` (founder icons + role labels).

Find `company-overview` scaffold. For `values` slot if exists (add it if not — slot purpose "company values 3-6 items"), set `recommended_atoms: ['icon-row', 'icon-grid', 'bullet-list']`. For `contact` slot, set `recommended_atoms: ['icon-row', 'icon-grid', 'kpi-card', 'bullet-list']` (icon-row preferred — mail/phone/globe/location).

Find `product-launch` scaffold. For `feature-1/2/3` slots, prepend `icon-row` and `icon-grid` to their `recommended_atoms`.

Find `vision-mission` scaffold. For `values` slot, set `recommended_atoms: ['icon-row', 'icon-grid', 'bullet-list']` (icon atoms first).

For all scaffolds with `kpi`, `dashboard`, or `traction` slots: ensure `kpi-card`, `dashboard-multi-kpi-composite`, `line`, `bar` come BEFORE `bullet-list` in the recommendation order.

- [ ] **Step 5: Quick prompt cache cost check (dry-run)**

Reuse the existing `--dry-run` CLI mode to verify the new system prompt doesn't break the pipeline:

```bash
cd /Users/hexiaoyang/Documents/sdf-main
node sdf-js/scripts/bake-scaffold-pipeline.mjs \
  --slidedata sdf-js/scripts/scaffold-pipeline-fixtures/antfun-company.json \
  --deck-name antfun-v4-dryrun \
  --picker v1 \
  --dry-run
```

Expected: stages 0+1 print as before, Stage 2 prints per-slot prompt sizes (now ~30KB system + ~3KB user per slot). No errors.

Note the system-prompt size — should be ~30000 chars (mostly the icon catalog). User per-slot stays small.

- [ ] **Step 6: Commit Task 7**

```bash
git add sdf-js/src/icons/index.js \
        sdf-js/src/present/scaffold-view.js \
        sdf-js/scripts/bake-scaffold-pipeline.mjs \
        sdf-js/src/present/scaffolds/registry.js
git commit -m "feat(prompt): Sprint 18 Task 7 — lift prompt v4 + scaffold updates"
```

---

## Task 8: Visual showcase HTML + manual smoke

**Spec ref**: §7 (Visual smoke), §10 (Acceptance criteria).

**Goal:** A single HTML page in the demos folder that renders sample sheets for every new piece — all 14 categories × 8 icons, icon-row at 2/4/6/8 sizes, icon-grid at 4/6/9/12 sizes, before/after on each enhanced atom. Used for manual visual QA + future regression baseline.

**Files (create):**
- `sdf-js/examples/atoms-2d-demo/icons-showcase.html`

- [ ] **Step 1: Write the showcase HTML**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Sprint 18 — Icons & Atom Enhancements Showcase</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap"
      rel="stylesheet"
    />
    <style>
      body { margin: 0; padding: 24px; font-family: Inter, system-ui; background: #f8f7f4; }
      h1 { font-size: 20px; margin: 0 0 4px; }
      h1 + p { margin: 0 0 24px; color: #666; font-size: 12px; }
      section { background: white; border: 1px solid #d0cec3; border-radius: 6px; padding: 16px; margin-bottom: 16px; }
      section h2 { font-size: 14px; margin: 0 0 12px; font-family: monospace; background: #1e1b1e; color: white; display: inline-block; padding: 4px 10px; }
      .cat-row { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin-bottom: 8px; font-size: 11px; }
      .cat-row .name { font-family: monospace; background: #1e1b1e; color: white; padding: 2px 8px; border-radius: 3px; min-width: 110px; display: inline-block; }
      canvas { display: block; border: 1px solid #eee; background: #fafaf8; margin-bottom: 8px; }
    </style>
  </head>
  <body>
    <h1>Sprint 18 — Icons & Atom Enhancements Showcase</h1>
    <p>Verifies icon library across 14 categories + 2 new atoms (icon-row, icon-grid) + 6 enhanced atoms with inline icons. Compare against PL D3180 reference visual quality.</p>

    <section>
      <h2>1. Library categories — 8 samples per category</h2>
      <div id="cat-host"></div>
    </section>

    <section>
      <h2>2. icon-row at 2 / 4 / 6 / 8 items</h2>
      <canvas id="row-2" width="1200" height="240"></canvas>
      <canvas id="row-4" width="1200" height="240"></canvas>
      <canvas id="row-6" width="1200" height="240"></canvas>
      <canvas id="row-8" width="1200" height="280"></canvas>
    </section>

    <section>
      <h2>3. icon-grid at 4 / 6 / 9 / 12 items</h2>
      <canvas id="grid-4" width="1200" height="480"></canvas>
      <canvas id="grid-6" width="1200" height="480"></canvas>
      <canvas id="grid-9" width="1200" height="560"></canvas>
      <canvas id="grid-12" width="1200" height="560"></canvas>
    </section>

    <section>
      <h2>4. Enhanced atoms — before/after (no icon / with icon)</h2>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div><strong>bullet-list (no icons)</strong><canvas id="bl-no" width="600" height="280"></canvas></div>
        <div><strong>bullet-list (with icons)</strong><canvas id="bl-yes" width="600" height="280"></canvas></div>
        <div><strong>agenda-list (no icons)</strong><canvas id="al-no" width="600" height="320"></canvas></div>
        <div><strong>agenda-list (with icons)</strong><canvas id="al-yes" width="600" height="320"></canvas></div>
        <div><strong>progression (no icons)</strong><canvas id="pg-no" width="800" height="200"></canvas></div>
        <div><strong>progression (with icons)</strong><canvas id="pg-yes" width="800" height="200"></canvas></div>
        <div><strong>kpi-card (no icon)</strong><canvas id="kpi-no" width="400" height="240"></canvas></div>
        <div><strong>kpi-card (with icon)</strong><canvas id="kpi-yes" width="400" height="240"></canvas></div>
      </div>
    </section>

    <script type="module">
      import { renderAtom } from '/src/present/atoms-2d/registry.js';
      import { CATEGORIES, CATEGORY_NAMES } from '/src/icons/index.js';

      const theme = {
        bg: [248, 247, 244], silhouetteColor: [30, 27, 30],
        colors: [[60, 100, 200]], accent: [60, 100, 200],
      };

      // 1. Category samples
      const catHost = document.getElementById('cat-host');
      for (const cat of CATEGORY_NAMES) {
        const row = document.createElement('div');
        row.className = 'cat-row';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'name';
        nameSpan.textContent = `${cat} (${CATEGORIES[cat].length})`;
        row.appendChild(nameSpan);
        const sampleNames = CATEGORIES[cat].slice(0, 8);
        const c = document.createElement('canvas');
        c.width = 1080; c.height = 80;
        row.appendChild(c);
        catHost.appendChild(row);

        await renderAtom(c.getContext('2d'), 'icon-row', {
          items: sampleNames.map((n) => {
            const prefix = cat.startsWith('brand-') ? 'brand:' :
                           cat === 'flags' ? '' : '';
            return { icon: prefix + n, label: '' };
          }),
          colorMode: 'auto', iconStyle: 'plain',
        }, 'pseudo3d', { x: 0, y: 0, w: 1080, h: 80, palette: theme });
      }

      // 2. icon-row sizes
      const sampleItems = [
        { icon: 'shield', label: 'Trust' },
        { icon: 'sparkle', label: 'Quality' },
        { icon: 'lightning', label: 'Speed' },
        { icon: 'heart', label: 'Customer Focus' },
        { icon: 'brain', label: 'Insight' },
        { icon: 'rocket', label: 'Growth' },
        { icon: 'globe', label: 'Reach' },
        { icon: 'medal', label: 'Excellence' },
      ];
      for (const n of [2, 4, 6, 8]) {
        const c = document.getElementById(`row-${n}`);
        await renderAtom(c.getContext('2d'), 'icon-row', {
          title: `${n} items`,
          items: sampleItems.slice(0, n),
        }, 'pseudo3d', { x: 0, y: 0, w: c.width, h: c.height, palette: theme });
      }

      // 3. icon-grid sizes
      const gridItems = [
        ...sampleItems,
        { icon: 'gear', label: 'Engineering' },
        { icon: 'palette', label: 'Design' },
        { icon: 'megaphone', label: 'Marketing' },
        { icon: 'wallet', label: 'Finance' },
      ];
      for (const n of [4, 6, 9, 12]) {
        const c = document.getElementById(`grid-${n}`);
        await renderAtom(c.getContext('2d'), 'icon-grid', {
          title: `${n} items`,
          items: gridItems.slice(0, n),
        }, 'pseudo3d', { x: 0, y: 0, w: c.width, h: c.height, palette: theme });
      }

      // 4. Before/after enhanced atoms
      // bullet-list
      await renderAtom(document.getElementById('bl-no').getContext('2d'), 'bullet-list', {
        title: 'Features', items: [
          { label: 'Mobile-first wallet' }, { label: 'AI co-pilot' },
          { label: 'End-to-end encryption' }, { label: 'Cross-chain' },
        ],
      }, 'pseudo3d', { x: 0, y: 0, w: 600, h: 280, palette: theme });
      await renderAtom(document.getElementById('bl-yes').getContext('2d'), 'bullet-list', {
        title: 'Features', items: [
          { label: 'Mobile-first wallet', icon: 'device-mobile' },
          { label: 'AI co-pilot', icon: 'brain' },
          { label: 'End-to-end encryption', icon: 'lock-key' },
          { label: 'Cross-chain', icon: 'link' },
        ],
      }, 'pseudo3d', { x: 0, y: 0, w: 600, h: 280, palette: theme });

      // agenda-list
      const agendaItems = [
        { label: 'Recap last quarter', sublabel: '5 min' },
        { label: 'KPI dashboard review', sublabel: '15 min' },
        { label: 'Wins and challenges', sublabel: '20 min' },
        { label: 'Next-quarter plan', sublabel: '20 min' },
      ];
      await renderAtom(document.getElementById('al-no').getContext('2d'), 'agenda-list', {
        title: 'Agenda', items: agendaItems,
      }, 'pseudo3d', { x: 0, y: 0, w: 600, h: 320, palette: theme });
      await renderAtom(document.getElementById('al-yes').getContext('2d'), 'agenda-list', {
        title: 'Agenda', items: agendaItems.map((it, i) =>
          ({ ...it, icon: ['clock', 'chart-bar', 'trophy', 'calendar'][i] })),
      }, 'pseudo3d', { x: 0, y: 0, w: 600, h: 320, palette: theme });

      // progression
      const steps = [{label:'Idea'},{label:'Build'},{label:'Ship'},{label:'Iterate'}];
      await renderAtom(document.getElementById('pg-no').getContext('2d'), 'progression', {
        title: 'Process', steps,
      }, 'pseudo3d', { x: 0, y: 0, w: 800, h: 200, palette: theme });
      await renderAtom(document.getElementById('pg-yes').getContext('2d'), 'progression', {
        title: 'Process', steps: steps.map((s, i) =>
          ({ ...s, icon: ['lightbulb', 'wrench', 'rocket', 'arrows-clockwise'][i] })),
      }, 'pseudo3d', { x: 0, y: 0, w: 800, h: 200, palette: theme });

      // kpi-card
      await renderAtom(document.getElementById('kpi-no').getContext('2d'), 'kpi-card', {
        value: '$3.4M', label: 'Q3 Revenue', sublabel: 'vs $2.6M Q2',
        trend: 'up', trendValue: '+27%',
      }, 'pseudo3d', { x: 0, y: 0, w: 400, h: 240, palette: theme });
      await renderAtom(document.getElementById('kpi-yes').getContext('2d'), 'kpi-card', {
        value: '$3.4M', label: 'Q3 Revenue', sublabel: 'vs $2.6M Q2',
        trend: 'up', trendValue: '+27%', icon: 'chart-line-up',
      }, 'pseudo3d', { x: 0, y: 0, w: 400, h: 240, palette: theme });
    </script>
  </body>
</html>
```

- [ ] **Step 2: Open + visually inspect**

```bash
# Ensure dev server is running
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8001/
# If 000 or non-200: cd sdf-js && python3 dev-server.py 8001 &
```

Open `http://localhost:8001/examples/atoms-2d-demo/icons-showcase.html` in browser (or via `~/.claude/skills/gstack/browse/dist/browse goto ...`). Walk every section visually:

- All 14 category rows render with sample icons recognizable
- icon-row at 2/4/6/8 looks balanced; 8 wraps to 2 rows correctly
- icon-grid at 4/6/9/12 uses sensible columns; cells aligned
- Before/after side-by-side: WITH-icon versions have meaningful icons replacing empty bullets / blank step circles / etc.

Take a screenshot for the PR:

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B goto "http://localhost:8001/examples/atoms-2d-demo/icons-showcase.html"
sleep 5
$B viewport 1280x4000
$B screenshot /Users/hexiaoyang/Documents/sdf-main/screens/sprint18/icons-showcase.png
```

- [ ] **Step 3: Commit Task 8**

```bash
mkdir -p /Users/hexiaoyang/Documents/sdf-main/screens/sprint18
git add sdf-js/examples/atoms-2d-demo/icons-showcase.html
git commit -m "demo(atoms): Sprint 18 Task 8 — icons-showcase visual sheet"
```

---

## Task 9: Register tests + final green pass

**Spec ref**: §10 (Acceptance criteria — npm test stays green).

**Goal:** Add the 2 new test files to the test runner and verify full suite still green. Update CI baseline number from 89 → 91 (or however many depending on prior baseline).

**Files (modify):**
- `scripts/run-tests.mjs`

- [ ] **Step 1: Locate the test registration block**

```bash
cd /Users/hexiaoyang/Documents/sdf-main
grep -n "test-icon-library\|test-scaffolds\|test-picker-llm" scripts/run-tests.mjs
```

Expected: shows current `present` category entries. Add the 2 new files:

- [ ] **Step 2: Edit `scripts/run-tests.mjs`** — append after the last `present` entry:

```javascript
  { category: 'present', file: 'sdf-js/scripts/test-icon-library-expanded.mjs' },
  { category: 'present', file: 'sdf-js/scripts/test-atoms-icons.mjs' },
```

- [ ] **Step 3: Run full suite**

```bash
cd /Users/hexiaoyang/Documents/sdf-main
npm test
```

Expected: `91/91 test files passed` (was 89, now +2). All green. If anything fails, fix forward — most likely cause is the older `test-icon-library.mjs` (Sprint 15c) breaking because we restructured `icons/index.js`. If so, retire the old test file (replaced by `test-icon-library-expanded.mjs`) by removing its entry from `scripts/run-tests.mjs`.

- [ ] **Step 4: Commit Task 9**

```bash
git add scripts/run-tests.mjs
git commit -m "test(infra): Sprint 18 Task 9 — register 2 new test files (89→91 PASS)"
```

- [ ] **Step 5: Push branch + open PR**

```bash
git push -u origin sprint-18-icons-text-min
gh pr create --title "Sprint 18: Icons & Text-Minimization (~2900 icons + 2 new + 6 enhanced atoms + lift prompt v4)" --body "$(cat <<'EOF'
## Summary

Sprint 18 ships the icon library expansion and text-minimization
direction per
`docs/superpowers/specs/2026-06-23-atlas-icons-and-text-minimization-sprint-18-design.md`.

3 layers:
1. **Library**: ~2900 icons (Phosphor + Simple Icons + flag-icons),
   14 macro categories, fuzzy fallback.
2. **Atoms**: 2 NEW (icon-row, icon-grid) + 6 enhanced with inline
   icon support (bullet-list, agenda-list, progression, kpi-card,
   nine-field-matrix, matrix-grid).
3. **Lift prompt v4**: full catalog injected into cached system
   prompt + 4 text-minimization rules + 4 worked examples + scaffold
   registry recommends new atoms in vision/values/services/contact/
   team/product slots.

## Tests
npm test: 91/91 PASS (was 89, +2 new files).

## Visual smoke
`sdf-js/examples/atoms-2d-demo/icons-showcase.html` — 14 category samples
+ icon-row 2/4/6/8 + icon-grid 4/6/9/12 + before/after on each
enhanced atom. Screenshot: `screens/sprint18/icons-showcase.png`.

## Validation post-merge
User re-bakes ANTFUN PDF in scaffold-view UI:
- target: total slide text chars ≥ 30% lower than Sprint 17 baseline
- target: ≥ 8 distinct atom types per deck (was 4)
- target: deck visually closer to PL D3180 reference

Per CLAUDE.md: DO NOT merge. Awaiting user review.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Wait for CI green, then hand off to user for merge.

---

## Self-Review Checklist

**1. Spec coverage:**
- §1 Framing → not a task (informational). ✓
- §2 Architecture → tasks 1-7 collectively implement all 3 layers. ✓
- §3 Library coverage → Task 1 (categories.js + bake). ✓
- §4.1 New atoms → Tasks 4 (icon-row), 5 (icon-grid). ✓
- §4.2 Enhanced atoms → Task 6. ✓
- §4.3 NOT building → respected (no icon-keyboard / icon-ring tasks). ✓
- §5 Lift prompt v4 → Task 7. ✓
- §6 Scaffold registry → Task 7 Step 4. ✓
- §7 Testing → Tasks 3 (library), 6 (atoms), 8 (visual showcase), 9 (CI registration). ✓
- §8 File structure → all paths match task files. ✓
- §9 Risks → fuzzy threshold (Task 2 conservative ≤2), brand color (Task 4/5 colorMode arg), catalog size (Task 7 uses ephemeral cache). ✓
- §10 Acceptance → Task 9 final green + post-merge user validation note. ✓

**2. Placeholder scan:**
- No "TBD" / "TODO" / "implement later" anywhere in tasks. ✓
- "Adjust the structural placement..." in Task 6 Step 1 — has surrounding code context + behaviour description. Acceptable per spec.
- "Edit XXX similar to YYY" — only used in Task 6 Steps 2-6 where pattern is shown in Step 1 with the EXACT code change; subsequent atoms have explicit grep targets + code change pattern. Acceptable.
- All bash commands have exact paths + expected output. ✓

**3. Type consistency:**
- `getIconPath2D` signature in Tasks 2/4/5/6 → same `IconResult` shape (path/color/source/resolvedName/svgInner). ✓
- `args.items[*].icon` field name uniform across all 6 enhanced atoms. ✓
- `colorMode` enum 'auto'|'brand'|'theme' same in Tasks 4/5 + lift prompt rules in Task 7. ✓
- `iconStyle` enum 'circle'|'square'|'plain' same in Tasks 4/5. ✓
- Import paths: 4-up from `atoms-2d/charts/<sub>/<name>.js` (`../../../../icons/index.js`), 3-up from `atoms-2d/icons/<name>.js` (`../../../icons/index.js`) — both noted in Task 6 Step 8 troubleshooting. ✓

Plan is ready. Execution handoff next.
