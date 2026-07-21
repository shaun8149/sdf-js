# Sprint 18 — Icons & Text-Minimization Design

**Date**: 2026-06-23
**Author**: Claude (with user 何小阳)
**Status**: spec — awaiting user review
**Related**: [[atlas-present-v1-architecture]], [[atlas-two-ends-lock]], [[pl-d3180-visual-benchmark]]

---

## 1. Framing — why this work exists

Atlas's destination is **3D theatrical presentation playback**: audiences watch a deck unfold in a theater-mode 3D scene, they do not read a document. **Text on a slide must be minimal** — long prose disappears in 3D space, while symbols and charts carry meaning at a glance.

Sprint 18 attacks this constraint from two directions:

1. **Icons** — every short text concept ("Trust", "Speed", "Mobile", "Slack integration") can be a meaningful icon + 1-3 word label instead of a verbose phrase. We need enough icon coverage that the LLM can always find a suitable symbol.
2. **Charts** — every numeric content ("Revenue grew $1M → $3M", "92% retention", "5-stage funnel") should emit a chart atom (line / bar / pie / kpi-card / funnel / sphere-fill), not a prose description. We already have 11 chart atoms; the gap is the LLM not reliably picking them over `bullet-list`.

**PL D3180 Company Presentation = visual quality reference, NOT pattern catalog**. PL sells 23 icon-template products because they sell templates — each product showcases template variety. **Atlas sells finished decks**, so we do not need keyboard / ring / showcase arrangements. We need symbols available everywhere they help.

### Success metric (this sprint)

Re-bake the ANTFUN PDF after merge:

- Total slide text character count **≥ 30% lower** than 2026-06-23 baseline
- Atom-type diversity per deck **≥ 8 distinct types** (was 4 — cover/bullet-list/kpi-card/icon-badge dominated)
- Visual quality stays comparable to or better than PL D3180 reference

### Out of scope (Sprint 19+)

- Adding new chart atoms (current 11 suffice for v1)
- Polishing individual chart atoms (re-bake will tell us which atoms need work)
- Photography support (structural feature for separate sprint)
- Phosphor multi-weight (fill / bold / duotone)
- Sprint 18 only addresses **icons + lift-prompt text-minimization rules**

---

## 2. Architecture (3 layers)

```
┌──────────────────────────────────────────────────────────────────┐
│ Layer 1: ICON LIBRARY  (sdf-js/src/icons/)                       │
│   - Phosphor (regular weight): ~2500 curated from 9000 (MIT)    │
│   - Simple Icons: top ~200 brand logos (MIT)                    │
│   - flag-icons: 207 country flags (CC0, already in deps)        │
│   - Total: ~2900 icons                                          │
│   - 14 macro categories (see §3)                                │
│   - Unified resolver: getIconPath2D(name)                       │
│   - Fuzzy fallback: levenshtein to closest known                │
└────────────────────┬────────────────────────────────────────────┘
                     │ resolves icon name → Path2D
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ Layer 2: ATOMS  (sdf-js/src/present/atoms-2d/)                  │
│                                                                  │
│   NEW atoms (icon-first layouts):                               │
│   - icon-row     (1×N horizontal, with labels)                  │
│   - icon-grid    (M×N grid, with labels)                        │
│                                                                  │
│   ENHANCED atoms (inline icon support per item):                │
│   - bullet-list / agenda-list / progression                     │
│   - kpi-card (wire existing `icon` arg to new library)          │
│   - nine-field-matrix / matrix-grid                             │
│                                                                  │
│   Color routing (all icon atoms):                               │
│   - auto: brand-icon → brand color; phosphor → palette.accent   │
│   - escape hatch: args.colorMode = 'auto'|'brand'|'theme'       │
└────────────────────┬────────────────────────────────────────────┘
                     │ atom registered + recommended-by-scaffold
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ Layer 3: LIFT PROMPT + SCAFFOLD                                  │
│   - Full icon catalog (~2900 names, by category) injected into  │
│     system prompt with `cache_control: ephemeral` (one-time    │
│     cost, free per slot lift thereafter)                        │
│   - Lift prompt v4 rules:                                       │
│     * "see numbers → emit chart, not prose"                     │
│     * "list with short concepts → icon + 1-3 word, not phrase"  │
│     * "per-slot text char budget" (soft target)                 │
│   - Scaffold registry: vision/values/services/contact/team/     │
│     product slots add icon-row + icon-grid + chart atoms to     │
│     `recommended_atoms[]`                                       │
│   - 4 worked examples in prompt showing icon-replaces-text      │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Icon Library — coverage by category

14 macro categories. Counts target a ~2900 total. Sources noted per category.

| Category | Target count | Source(s) | Examples |
|---|---|---|---|
| business | ~250 | Phosphor | briefcase / chart-bar / handshake / presentation / target / trophy |
| tech | ~250 | Phosphor | code / cpu / cloud / database / network / server / wifi |
| ai-robotics | ~80 | Phosphor | brain / robot / circuitry / hand-coins / lightning / quantum |
| medical | ~150 | Phosphor | first-aid-kit / heart / brain / dna / pill / stethoscope |
| finance | ~200 | Phosphor | wallet / coin / chart-line-up / receipt / piggy-bank / hand-coins |
| hrm | ~200 | Phosphor | user / users / user-circle / user-gear / handshake / chair |
| calendar | ~100 | Phosphor | calendar / clock / hourglass / timer / alarm |
| signs | ~200 | Phosphor | warning / shield / lock / sealed / certificate / x-circle |
| nature-energy | ~150 | Phosphor | tree / leaf / sun / drop / wind / mountains / lightning |
| transport | ~100 | Phosphor | car / airplane / bicycle / boat / train / scooter |
| arrows | ~100 | Phosphor | arrow-right/up/down/left + curved + branching |
| brand-social | ~80 | Simple Icons | facebook / instagram / x / linkedin / youtube / tiktok / whatsapp |
| brand-tools | ~120 | Simple Icons | slack / discord / github / gitlab / figma / notion / spotify / netflix |
| flags | 207 | flag-icons (existing) | us / cn / jp / de / fr / br / in / ... (ISO 3166-1 alpha-2) |
| **TOTAL** | **~2,887** | 3 libraries | |

**Resolver chain** (`getIconPath2D(name)`):

1. Try Phosphor baked-library (~2400 names: phosphor:briefcase or just briefcase)
2. Try Simple Icons baked (~200 names: brand:slack or slack)
3. Try flag-icons (~207 names: flag:cn or country-cn or cn)
4. Fuzzy fallback: levenshtein distance ≤ 2 across all baked names
5. Last resort: `placeholder-square` (grey filled square so render doesn't break)

---

## 4. Atom changes

### 4.1 NEW atoms

#### `icon-row` (1×N horizontal layout)

`sdf-js/src/present/atoms-2d/icons/icon-row.js`

**Args**:
```
{
  items: [{icon: 'briefcase', label: 'Strategy', sublabel?: '5y plan'}],  // 2-8 items
  title?: 'Our Pillars',
  subtitle?: 'Four ways we win',
  colorMode?: 'auto'|'brand'|'theme'  // default 'auto'
  iconStyle?: 'circle'|'square'|'plain'  // default 'circle' (pseudo-3D)
}
```

**Render**:
- Title at top-left (Inter 700, h*0.085)
- Items distributed horizontally with equal spacing (canvas w / N)
- Each item: circular pseudo-3D badge (or square/plain per iconStyle) at ~80-120px diameter + label below + optional sublabel
- Auto wrap to 2 rows when ≥7 items
- Color: auto-routes via library's source check (Simple Icons → brand color; Phosphor → palette.accent)

#### `icon-grid` (M×N grid layout)

`sdf-js/src/present/atoms-2d/icons/icon-grid.js`

**Args**:
```
{
  items: [{icon: 'shield', label: 'Trust'}, ...],  // 4-16 items
  cols?: 'auto'|number,  // default 'auto': 2x2 / 2x3 / 3x3 / 4x3 by count
  title?: 'Core Values',
  colorMode?: 'auto'|'brand'|'theme',
  iconStyle?: 'circle'|'square'|'plain'
}
```

**Render**:
- Title top
- Items in grid, auto column count: 4→2x2, 6→2x3, 9→3x3, 12→4x3
- Each cell: icon + bold label + optional caption
- Card-like cell (subtle bg + drop shadow) OR plain (transparent)

### 4.2 ENHANCED existing atoms (inline icon)

Each accepts optional `icon` field per item, replacing the default leading marker (open ring / number chip / step dot / etc):

- **bullet-list**: `items[*].icon` replaces open ring
- **agenda-list**: `items[*].icon` appears beside the number (showcase mode) or replaces number chip (compact mode)
- **progression**: `steps[*].icon` replaces step number bubble
- **kpi-card**: existing `args.icon` wired to library (currently uses inline stub)
- **nine-field-matrix**: `cells[*].icon` at cell top-left
- **matrix-grid**: `cells[*].icon` at cell top-left

Backward compatible: missing `icon` field → existing default render.

### 4.3 NOT building (out of this sprint)

- `icon-keyboard` (PL Social Media Keyboard pattern — sales template, not user need)
- `icon-ring` (use existing `circle-image-hub-spoke`)
- icon-picker UI / search interface
- icon-on-photo overlays

---

## 5. Lift Prompt v4 — text minimization rules

Updates to `scaffold-view.js` and `bake-scaffold-pipeline.mjs` per-slot prompt + cached system prompt:

### System prompt additions (cached, paid once)

- **Icon catalog block**: full 2900 icon names grouped by 14 categories with 1-line category descriptions ("brand-social: Facebook/Instagram/X/LinkedIn/YouTube/TikTok/...")
- **Text-minimization principles** (4 hard rules)

### Per-slot user message — 4 hard rules

1. **Numbers → chart, not prose**.
   - 3+ KPI values → `kpi-card` × N or `dashboard-multi-kpi-composite`
   - Time series ≥ 4 points → `line` or `bar`
   - Proportions / shares → `pie` or `waterfall`
   - Funnel / pipeline → `funnel` atom
   - Single percentage → `sphere-fill` or `kpi-card` or `kpi-water-drop`
   - **Never** describe numbers in `bullet-list` if a chart fits

2. **Short concepts → icon + 1-3 word label**, not phrase.
   - Slide says "Our Values: Trust, Quality, Speed" → `icon-row` with `[{icon:'shield',label:'Trust'},{icon:'sparkle',label:'Quality'},{icon:'lightning',label:'Speed'}]`
   - **Never** `bullet-list` with 1-word items — use icon-row

3. **bullet-list when used MUST have inline icons** unless content is genuinely paragraph-like.
   - Each `items[*]` should have `icon: '<phosphor name>'`
   - Empty bullets (no icon, no label-with-meaning) = a bug

4. **Per-atom soft text budget**: ≤ 8 words per atom label/value/title (excluding `bullet-list.items[].label` which can be longer when paragraph-like)

### Worked examples (4)

```
Example A — values slide:
  Source body: "We believe in Trust, Quality, Speed, Customer Focus"
  GOOD:
    { type: 'icon-row', args: {
        items: [
          {icon: 'shield', label: 'Trust'},
          {icon: 'sparkle', label: 'Quality'},
          {icon: 'lightning', label: 'Speed'},
          {icon: 'heart', label: 'Customer Focus'}
        ]
    }}
  BAD:
    { type: 'bullet-list', args: { items: [
      {label: 'We believe in Trust'},
      {label: 'We believe in Quality'}, ...
    ]}}

Example B — KPI dashboard:
  Source body: "Q3 results: Revenue $3.4M (+27%), MAU 12,450, Churn 2.1%"
  GOOD:
    [ {type: 'kpi-card', args: {value:'$3.4M', label:'Revenue', trend:'up', trendValue:'+27%'}},
      {type: 'kpi-card', args: {value:'12.4K', label:'MAU'}},
      {type: 'kpi-card', args: {value:'2.1%', label:'Churn'}} ]
  BAD:
    { type: 'bullet-list', args: { items: [{label:'Revenue is $3.4M'}, ...] }}

Example C — time series:
  Source body: "ARR: Q1 $0, Q2 $120K, Q3 $740K, Q4F $2.4M"
  GOOD: { type: 'line', args: { values: [0, 0.12, 0.74, 2.4], labels: ['Q1','Q2','Q3','Q4F'], format: 'currency', title: 'ARR Growth' }}

Example D — feature list with inline icons:
  Source body: "Mobile-first wallet / AI co-pilot / End-to-end encryption / Cross-chain"
  GOOD: { type: 'bullet-list', args: { items: [
    {icon: 'device-mobile', label: 'Mobile-first wallet'},
    {icon: 'brain', label: 'AI co-pilot'},
    {icon: 'lock-key', label: 'End-to-end encryption'},
    {icon: 'link', label: 'Cross-chain liquidity'}
  ]}}
```

---

## 6. Scaffold registry updates

`sdf-js/src/present/scaffolds/registry.js`:

For each slot whose purpose involves short-list / values / features / contact:

- Add `icon-row` and `icon-grid` to `recommended_atoms[]`
- Reorder so chart atoms come BEFORE `bullet-list` when slot purpose is numeric

Touched scaffolds (examples):
- `pitch-deck-vc.problem`: keep bullet-list but recommend with-icons
- `pitch-deck-vc.market-size`: prefer pyramid / kpi-card / bar over bullet-list
- `pitch-deck-vc.team`: add icon-row (founder badges with role labels)
- `company-overview.values`: NEW slot or `mission`: add icon-row / icon-grid first
- `product-launch.feature-N`: add icon-row + icon-grid for feature lists
- `vision-mission.values`: icon-row primary
- `company-overview.contact`: icon-row primary (mail / globe / phone / location)

---

## 7. Testing

### Unit / smoke

- `sdf-js/scripts/test-icon-library-expanded.mjs`:
  - ~2900 icons resolve via `getIconPath2D`
  - All 14 categories non-empty + names match catalog
  - Brand icons return Simple Icons brand color
  - Flag icons resolve via `flag:cn` / `cn` / `country-cn`
  - Fuzzy fallback works ("brifcase" → "briefcase")
  - Unknown returns placeholder (no throw)

- `sdf-js/scripts/test-atoms-icons.mjs`:
  - `icon-row` renders 2-8 items without throw
  - `icon-grid` auto column count for 4/6/9/12 items
  - Each enhanced atom renders with AND without `icon` arg (backward compat)
  - colorMode 'auto' / 'brand' / 'theme' all valid

### Visual smoke

- `sdf-js/examples/atoms-2d-demo/icons-showcase.html`:
  - Visual sheet: all 14 categories × 8 sample icons rendered
  - icon-row examples (2 / 4 / 6 / 8 items)
  - icon-grid examples (2x2 / 2x3 / 3x3 / 4x3)
  - All enhanced atoms with inline icon shown side-by-side with no-icon version

### End-to-end validation (post-merge)

- User re-bakes ANTFUN PDF
- Compare: total text char count vs Sprint 17 baseline (target: -30%)
- Compare: atom-type diversity per deck (target: ≥ 8 distinct types)
- Visual diff vs PL D3180 — should look "Atlas-style PL-level", not 1:1 PL copy

---

## 8. File structure

```
sdf-js/
├── scripts/
│   ├── bake-icon-library-v2.mjs       # rewritten: 3-source bake (Phosphor + SI + flags)
│   ├── test-icon-library-expanded.mjs # new
│   └── test-atoms-icons.mjs           # new
├── src/
│   ├── icons/
│   │   ├── index.js                    # UPDATED: 3-source resolver + fuzzy fallback
│   │   ├── categories.js               # UPDATED: 14 categories
│   │   ├── baked-library.js            # REGENERATED: ~2500 Phosphor
│   │   ├── brand-icons.js              # NEW: ~200 Simple Icons baked
│   │   ├── flag-icons.js               # NEW: ~207 flag-icons baked (was deps-only)
│   │   └── fuzzy.js                    # NEW: levenshtein for fallback
│   └── present/
│       ├── atoms-2d/
│       │   ├── icons/
│       │   │   ├── icon-badge.js       # unchanged (Sprint 15c)
│       │   │   ├── icon-row.js         # NEW
│       │   │   └── icon-grid.js        # NEW
│       │   ├── charts/
│       │   │   ├── lists/bullet-list.js          # ENHANCED: items[*].icon
│       │   │   ├── lists/progression.js          # ENHANCED
│       │   │   ├── agenda/agenda-list.js         # ENHANCED
│       │   │   ├── data/kpi-card.js              # WIRED to library
│       │   │   ├── diagrams/matrix-grid.js       # ENHANCED: cells[*].icon
│       │   │   └── diagrams/nine-field-matrix.js # ENHANCED
│       │   └── registry.js             # UPDATED: + 2 new atoms
│       ├── scaffolds/registry.js       # UPDATED: recommended_atoms[]
│       ├── scaffold-view.js            # UPDATED: lift prompt v4
│       └── ...
└── examples/
    └── atoms-2d-demo/
        └── icons-showcase.html         # NEW
docs/
└── superpowers/specs/
    └── 2026-06-23-atlas-icons-and-text-minimization-sprint-18-design.md  # this file
```

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| LLM ignores text-min rules → still emits bullet-list with prose | Worked examples in prompt + soft text budget + re-bake validates |
| Brand color clashes with theme palette | colorMode escape hatch (override per-atom) |
| Fuzzy fallback wrong icon ("brain" → "brian"?) | Conservative threshold (lev ≤ 2) + log fallback events for review |
| Catalog inflates system prompt → cost regression | Cache_control: ephemeral, validate cost stays <$0.10/deck |
| Simple Icons npm pkg large (~3500 brands, only need ~200) | Bake script filters to curated list, don't bundle full library |
| Brand logos look bad as theme-colored monochrome | Auto color-mode keeps brand colors by default |

---

## 10. Acceptance criteria

- [ ] Icon library: ~2900 baked + 14 categories + resolver works
- [ ] 2 new atoms ship: `icon-row` + `icon-grid`
- [ ] 6 atoms gain inline `icon` arg: bullet-list / agenda-list / progression / kpi-card / nine-field-matrix / matrix-grid
- [ ] Lift prompt v4 deployed (scaffold-view + bake script)
- [ ] Scaffold registry updated (icon-row/grid + chart-priority)
- [ ] Browser smoke: icons-showcase.html visual sheet
- [ ] npm test: all green + new tests
- [ ] User re-bakes ANTFUN: text char count -30%, atom-type ≥ 8
