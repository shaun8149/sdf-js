# Atlas Present Sprint 15 — 3-layer atom expansion (atoms × icon-library × scaffold × 9-theme)

**Date:** 2026-06-22
**Status:** Spec locked (3 design decisions confirmed via inline Q&A 2026-06-22)
**Branch:** new branch `sprint-15-three-layer` off `main` (current HEAD `2819867`)
**Predecessor:** Sprint 14a/b (24 atoms-2d shipped, PR #72/#73 merged)
**Evidence base:** PresentationLoad observation pool (3 batches / 51 templates / 4356 slides) + Gamma 8-template observation — see [[atlas-pl-observation-pool-v3]] + [[gamma-8-template-observation]] + [[atlas-icons-vs-atoms-architecture]].

---

## 1. Goal

Lift Atlas Present from **24 atoms / no icons / no scaffold / single theme** to **PresentationLoad-grade product layer**: ~54-61 production atoms (current 24 + 30-37 new this sprint) + 9000-icon library (Phosphor MIT) + 10-13 scaffold registry + 9-effective-preset theme system (3 macro × 3 color). Empirical target: cover 70%+ of slides observed across PL 51 templates / 4356 slides (full ~65 atom catalog completion deferred to Sprint 16+).

**Concrete user-visible promise:** "上传 PDF → 系统识别为 'Quarterly Business Review' scaffold → 自动挑 18 个 atom 填充 → 用户在 9 个 theme 中切换 → 1 分钟出 PresentationLoad-grade deck"。

## 2. Non-goals (explicit)

- NOT migrating Sprint 14 atoms-2d to a new schema — existing 24 atoms preserved as-is
- NOT building a real-time iframe sandbox — Sprint 3 P5 pipeline stays untouched
- NOT adding new chart-rendering library (no Chart.js / D3) — all chart atoms are SDF or HTML/SVG vector primitives
- NOT adding 3D atoms in this sprint — Sprint 15 is 2D-only; 3D peek deferred
- NOT shipping photo backend (15d) in this sprint — defer to Sprint 16 (placeholder rectangles used for photo slots)
- NOT shipping more than 9 theme presets — 3 macro × 3 color is the hard cap
- NOT shipping animation / transitions — atoms are static; transition layer is separate concern
- NOT changing the lift LLM prompt v3.31 → atoms register declaratively and prompt auto-discovers via atom manifest

## 3. Locked design decisions (3 user-confirmed via AskUserQuestion 2026-06-22)

| # | Decision | User choice |
|---|---|---|
| 1 | Sprint 15 P0 scope (4wk vs 5wk vs 7wk) | **P0 = 15c + 15a + 15b + 15e (7 weeks)** — 完整闭环, atoms + icon-library + scaffold registry 同 ship。Photo backend (15d) defer Sprint 16. |
| 2 | Theme dimension this sprint | **9 effective preset (3 macro × 3 color)** 全 ship — Editorial / Pitch / Organic × 3 color each |
| 3 | Icon library implementation | **Bundle Phosphor (MIT, 9000 icons, multi-weight)** 全量 npm 引入 — 0 自己 curate, 1 dep, multi-weight 已含 line/fill/duotone variant |

Inherited locks (from prior sessions, [[atlas-pl-observation-pool-v3]]):
- Atom count this sprint: 30-37 new (chart 18-22 + idiom 12-15) → atoms total 54-61 of ~65 full catalog (Sprint 16+ completes residual ~5-10 long-tail)
- Scaffold count: 10-13 canonical recipes
- Soft orthogonality: scaffold registry has `recommended_atoms[] + required_atoms[] + forbidden_atoms[]`
- Soft affinity: scaffold × theme = matrix with ⭐⭐⭐/⭐⭐/⭐ rankings
- Atom-theme separation (from [[gamma-8-template-observation]] Finding #1): theme is parameter, not baked

## 4. Architecture overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                         Atlas Present Sprint 15                        │
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │   ATOM LAYER     │  │  ICON LIBRARY    │  │  SCAFFOLD LAYER  │   │
│  │  ~65 atoms       │←─┤  9000 SVG icons  │  │  10-13 recipes   │   │
│  │  (24 + 41 new)   │  │  Phosphor MIT    │  │  + atom slots    │   │
│  └────────▲─────────┘  │  6 weight variants│  └────────▲─────────┘   │
│           │            └────────▲──────────┘           │              │
│           │                     │                      │              │
│           │            ┌────────┴──────────┐           │              │
│           └────────────┤   THEME LAYER     ├───────────┘              │
│                        │  3 macro × 3 color│                          │
│                        │  9 effective preset│                          │
│                        └───────────────────┘                          │
└────────────────────────────────────────────────────────────────────────┘
        ▲                            ▲                            ▲
        │                            │                            │
   atom registry                icon registry              scaffold registry
   src/atoms-2d/                src/icons/                src/scaffolds/
   *.js modules                 phosphor + flags          *.json manifests
```

## 5. Sub-sprint decomposition (5 sub-sprints, 7 weeks P0)

| Sub-sprint | Scope | Time | Deliverable |
|---|---|---|---|
| **15c** | Icon library system — npm @phosphor-icons/web + flag-icons; registry shim wrapping icon-set lookup; theme color coercion; auto-render in existing `icon-row-N` / `icon-grid-N` atoms | 1 wk | `src/icons/index.js` + atom integration |
| **15a** | Chart atoms (18-22) — scatter/bubble/histogram/waterfall/BCG/9-field/fishbone/venn/7S/traffic-light/multi-arrow/gauge/break-even/stacked-area/donut-segmented/conditional-heatmap | 2 wk | 18-22 new files in `src/atoms-2d/` + smoke tests + lift prompt regen |
| **15b** | Infographic idiom atoms (12-15) — circle-image-hub/cloud-network/device-mockup/isotype-people/isotype-prop/world-map-callouts/isometric-vignette/infinity-loop/recycling-cycle/kpi-water-drop/magazine-column-grid | 2 wk | 12-15 new files + smoke tests + lift prompt regen |
| **15e** | Scaffold registry — 10-13 canonical scaffolds with recommended_atoms[]/required_atoms[]/forbidden_atoms[] + theme affinity matrix + auto-selection LLM call | 2 wk | `src/scaffolds/*.json` + scaffold-picker.js + deck-from-scaffold.js |
| 15d | (DEFERRED to Sprint 16) Photo backend — Unsplash MCP or curated bake | 1 wk | — |

**Sequencing:** 15c FIRST (atoms need icons to render properly) → 15a + 15b CAN parallelize if 2 subagent (else 15a → 15b sequential) → 15e LAST (depends on full atom catalog).

## 6. Atom layer detail (Sprint 15a + 15b = ~37 new atoms)

### 15a — Chart atoms (18-22)

Split into 3 functional sub-categories per [[atlas-pl-observation-pool-v3]] Batch 2 Finding B:

**Data-driven charts (8)** — real numbers, QBR/financial scenarios:
1. `scatter-2d-xy` — base scatter
2. `scatter-with-regression` — + trend line
3. `bubble-2d-xy` — bubble plot
4. `histogram-distribution` — bell-curve frequency
5. `waterfall-bridge-chart` — financial gain/loss
6. `break-even-chart` — cost line crossover
7. `stacked-area-time` — area chart over time
8. `bar-with-target-line` — bar + horizontal reference

**Conceptual frameworks (8)** — no numbers, strategy decks:
9. `BCG-matrix-2x2` (parametric: standard / animal-icon / 3D variants)
10. `matrix-3x3-priority` — GE/McKinsey 9-field
11. `fishbone-cause-effect-N` — Ishikawa with parametric branches
12. `venn-N-circle` — parametric 2-6 circles, overlap mode
13. `7S-model-radial` — McKinsey 7S hexagonal layout
14. `multiple-arrows-converge` — N arrows merging to 1
15. `multiple-arrows-diverge` — 1 splitting to N
16. `cause-effect-hub-spoke` — central effect + N causes

**Status indicators (4-6)** — visual KPI summary:
17. `traffic-light-row-N` — RAG status
18. `traffic-light-with-KPI` — light + stat
19. `gauge-cockpit-N` — multi-gauge dashboard
20. `donut-segmented-N` — donut with N labeled segments
21. (optional) `conditional-format-heatmap` — colored cell table
22. (optional) `multi-pie-row` — N small pies in a row

### 15b — Infographic idiom atoms (12-15)

Per [[atlas-pl-observation-pool-v3]] Batch 3 Finding B (isotype is THE missing family):

1. `circle-image-hub-spoke-N` — circular cropped photos + connections
2. `circle-chart-N-segment` — pie/donut split with radial spokes to side labels
3. `cloud-network-with-devices` — cloud + lines to devices
4. `device-mockup-frame` — phone/tablet/laptop/watch UI container
5. `device-mockup-row-N` — multiple devices side-by-side
6. `isotype-people-grid` — 100+ tiny people figures (demographic counts)
7. `isotype-stat-comparison-N` — N-row tiny icon counts
8. `isotype-prop-row` — N copies of bottle/bulb/drop scaled by value
9. `world-map-with-callouts-N` — flat world map + N pinned bubbles
10. `city-skyline-silhouette` — urban skyline backdrop
11. `magazine-column-grid-N` — N-col mosaic by category
12. `isometric-business-vignette` — isometric scene (people on stairs, lightbulb, chart)
13. `infinity-loop-flow` — figure-8 loop process
14. `kpi-water-drop-fill` — drop shape with fill level
15. (optional) `dashboard-multi-kpi-composite` — tile arrangement composite

### Atom file template

Each atom = single ES module under `src/atoms-2d/`:

```js
// src/atoms-2d/scatter-2d-xy.js
export const meta = {
  id: 'scatter-2d-xy',
  category: 'chart-data-driven',
  thumbnail: './thumbs/scatter-2d-xy.svg',
  args: {
    points: { type: 'array', required: true, example: [[0,0],[1,1],[2,4]] },
    xLabel: { type: 'string', default: 'X' },
    yLabel: { type: 'string', default: 'Y' },
    title: { type: 'string', default: '' },
    accentColor: { type: 'color', themeToken: 'accent.primary' },
    iconSet: { type: 'iconSet', default: null },
  },
};

export function render(args, themeContext) {
  // returns { sceneData: {...}, svg: '<svg>...</svg>' }
}
```

## 7. Icon library detail (Sprint 15c)

### Strategy

- **Dependency:** `npm install @phosphor-icons/web flag-icons`
- **Bundle size budget:** ~3MB gzipped (acceptable for Atlas web)
- **Categories** (Phosphor tagged + curated subsets):
  - Business / Office
  - Finance / Trading (subset of Phosphor + flag-icons for currencies)
  - Technology / IT / Network
  - Medical / Science / Healthcare
  - HRM / People / Roles
  - Communication / Social (Phosphor brand subset)
  - Traffic / Warning / Regulatory (Phosphor has these)
  - Calendar / Date / Time
  - Flags (flag-icons CC0)
- **Weights available** (Phosphor): thin / light / regular / bold / fill / duotone
- **Theme integration:** icons inherit `currentColor` → CSS `color` set by theme token

### Registry shim

```js
// src/icons/index.js
import * as phosphor from '@phosphor-icons/web';
import 'flag-icons/css/flag-icons.css';

export function getIcon(iconName, options = {}) {
  const { weight = 'regular', size = 24, color = 'currentColor' } = options;
  return phosphor.icons[`${iconName}-${weight}`]({ size, color });
}

export const ICON_CATEGORIES = {
  business: ['briefcase','chart-line','users','presentation', /* ~200 */],
  finance: ['currency-dollar','bank','coins','trend-up', /* ~200 */],
  tech: ['cpu','database','cloud','code', /* ~200 */],
  medical: ['stethoscope','pill','first-aid', /* ~200 */],
  hrm: ['user','user-circle','users-three','identification-badge', /* ~200 */],
  social: ['chat-circle','share-network','heart','at', /* ~150 */],
  signs: ['warning','prohibit','info','question', /* ~100 */],
  calendar: ['calendar','clock','timer','alarm', /* ~100 */],
  flags: 'flag-icons-injected', // separate render path
};

export function pickRandomFromCategory(category, n) { /* helper for LLM seeding */ }
```

### Atom integration

Existing Sprint 14 atoms `icon-row-N` / `icon-grid-N` / `icon-circle-large-row-N` / `card-grid-icon-N` add new args:
- `iconNames: string[]` — explicit list (e.g., `['briefcase','chart-line','users']`)
- `iconCategory: string` — random pick (e.g., `'business'`)
- `iconWeight: 'thin'|'light'|'regular'|'bold'|'fill'|'duotone'`

LLM lift prompt v3.31 → v3.32: include 8-category icon menu in system prompt so LLM emits e.g., `iconCategory: 'finance', iconNames: ['currency-dollar','bank','trend-up']` for finance content.

## 8. Theme layer detail (9 preset)

### 3 macro themes (from [[gamma-8-template-observation]] Finding #3)

| Macro | DNA | Typography | Color base |
|---|---|---|---|
| **Editorial / Calm** | serif + soft photo + dark green/navy + large negative space | serif body, italic accents | dark navy, sage green, cream paper |
| **Pitch / Punchy** | display sans + high contrast + large KPI numerals + saturated accent | display sans, condensed | black, neon green/yellow, white |
| **Organic / Nature** | blurred gradient photo + nature elements + rounded/blob shapes | rounded sans, friendly | gradient sage→teal, soft pastels |

### 3 color variants per macro (9 total)

- Editorial: navy / forest / burgundy
- Pitch: black-neon / cobalt-orange / charcoal-yellow
- Organic: teal / coral / lavender

### Implementation

Each atom's `args.accentColor` etc. accept `themeToken: 'accent.primary'` strings. Theme system provides resolver:

```js
// src/themes/index.js
export const THEMES = {
  'editorial-navy': { tokens: { 'accent.primary': '#1a2b4a', 'text.body': '#2c3e50', 'font.body': 'Georgia, serif', /* ... */ } },
  'editorial-forest': { /* ... */ },
  /* 9 total */
};

export function resolveToken(theme, token) {
  return THEMES[theme].tokens[token] ?? FALLBACK[token];
}
```

Sprint 15 wires `resolveToken` into atom render functions. Atom output (SVG/canvas) consumes resolved colors/fonts at render time, not bake time.

### Theme picker UI

Add to existing Atlas Present visual-panel: 9-cell theme picker (3 row × 3 col macro grid). Click cycles entire deck through new theme without re-running lift.

## 9. Scaffold registry detail (Sprint 15e)

### 10-13 canonical scaffolds (from [[atlas-pl-observation-pool-v3]] Batch 1 Finding A — PL's product unit = scaffold)

| # | Scaffold ID | Source | Slide count | Theme affinity |
|---|---|---|---|---|
| 1 | `pitch-deck-vc` | PL Investor Deck Best Practices | 10-12 | Pitch ⭐⭐⭐ / Editorial ⭐⭐ / Organic ⭐ |
| 2 | `company-overview` | PL Toolbox subset | 15-20 | Editorial ⭐⭐⭐ / Pitch ⭐⭐ / Organic ⭐⭐ |
| 3 | `thesis-defense` | Gamma Thesis template | 7-9 | Editorial ⭐⭐⭐ / Organic ⭐ / Pitch ⭐ |
| 4 | `quarterly-business-review` | PL Compliance/BP mix | 12-18 | Editorial ⭐⭐ / Pitch ⭐⭐⭐ / Organic ⭐ |
| 5 | `business-plan-full` | PL Business Plan | 25-35 | Editorial ⭐⭐⭐ / Pitch ⭐⭐ / Organic ⭐ |
| 6 | `training-overview` | Gamma Training template | 8-12 | Editorial ⭐⭐ / Pitch ⭐ / Organic ⭐⭐⭐ |
| 7 | `product-launch` | combo | 10-15 | Pitch ⭐⭐⭐ / Editorial ⭐⭐ / Organic ⭐⭐ |
| 8 | `vision-mission-values` | PL Vision-Mission | 5-10 | Editorial ⭐⭐⭐ / Organic ⭐⭐ / Pitch ⭐⭐ |
| 9 | `strategic-plan` | PL Compliance/Startup | 10-15 | Pitch ⭐⭐ / Editorial ⭐⭐⭐ / Organic ⭐ |
| 10 | `goal-setting-framework` | Gamma Goal Setting | 8-12 | Pitch ⭐⭐⭐ / Editorial ⭐⭐ / Organic ⭐ |
| 11 | (optional) `monthly-status-report` | PL Reports cluster | 6-10 | Editorial ⭐⭐⭐ |
| 12 | (optional) `case-study` | combo | 8-12 | Editorial ⭐⭐⭐ / Organic ⭐⭐ |
| 13 | (optional) `keynote-talk` | combo | 15-25 | Pitch ⭐⭐⭐ / Organic ⭐⭐ |

### Scaffold schema

```json
{
  "id": "pitch-deck-vc",
  "title": "VC Pitch Deck",
  "description": "Investor pitch following Airbnb-style narrative arc",
  "slide_count_range": [10, 12],
  "theme_affinity": {
    "pitch-black-neon": "⭐⭐⭐",
    "pitch-cobalt-orange": "⭐⭐⭐",
    "editorial-navy": "⭐⭐"
  },
  "slides": [
    {
      "slot_id": "cover",
      "purpose": "Title + tagline + company logo",
      "recommended_atoms": ["cover-photo-bleed", "cover-overlay-box", "cover-color-block"],
      "required_atoms": [],
      "forbidden_atoms": ["card-grid-icon-6", "isotype-people-grid"]
    },
    {
      "slot_id": "problem",
      "purpose": "Stark statement of pain point",
      "recommended_atoms": ["text-statement-mega", "kpi-hero-single", "kpi-icon-large-with-value"],
      "required_atoms": [],
      "forbidden_atoms": []
    },
    /* 8-10 more slots */
  ]
}
```

### Auto-scaffold-picker

After PDF parse → first LLM call picks scaffold ID based on content fingerprint:
```js
// src/scaffolds/picker.js
export async function pickScaffold(deckText, apiKey) {
  const prompt = SCAFFOLD_PICKER_SYSTEM + '\n\nContent:\n' + deckText.slice(0, 3000);
  const response = await callLLM(prompt, apiKey);
  return parseJSON(response); // { scaffold_id, confidence, fallback_scaffold_id }
}
```

Then per slot, second LLM call picks atom from `recommended_atoms[]` honoring `forbidden_atoms[]`.

## 10. File structure

```
sdf-js/src/
├── atoms-2d/                          (existing 24 + 37 new = 61)
│   ├── existing-atoms.js              (24 from Sprint 14a/b, untouched)
│   ├── chart-scatter-2d-xy.js         (NEW, 15a)
│   ├── chart-bubble-2d-xy.js          (NEW, 15a)
│   ├── ... (16-20 more chart atoms)
│   ├── idiom-circle-image-hub.js      (NEW, 15b)
│   ├── idiom-isotype-people-grid.js   (NEW, 15b)
│   └── ... (10-13 more idiom atoms)
├── icons/                              (NEW, 15c)
│   ├── index.js                       (registry + resolver)
│   ├── categories.js                  (8-category curation)
│   └── README.md                      (Phosphor + flag-icons attribution)
├── themes/                             (NEW, 15c/15e)
│   ├── index.js                       (THEMES registry + resolveToken)
│   ├── editorial-navy.js              (9 theme files)
│   ├── editorial-forest.js
│   └── ... (7 more)
├── scaffolds/                          (NEW, 15e)
│   ├── picker.js                      (auto-scaffold LLM call)
│   ├── deck-from-scaffold.js          (slot-by-slot atom expansion)
│   ├── pitch-deck-vc.json             (10 scaffold JSON manifests)
│   └── ... (9-12 more)
└── lift/
    └── system-prompt-v3.32.md          (UPDATED: 37 new atom signatures + icon menu + scaffold context)
```

## 11. LLM prompt updates

### Lift prompt v3.31 → v3.32

Add 3 sections to existing prompt:
1. **Atom manifest** — auto-generated from `atoms-2d/*.js meta` exports (37 new entries)
2. **Icon category menu** — 8 categories with example icon names per category
3. **Scaffold context** — when scaffold pre-selected, include slot's `recommended_atoms[]` + `forbidden_atoms[]` in prompt for that slot's LLM call

### Scaffold picker prompt (NEW)

Compact system prompt (~500 tokens) listing 10-13 scaffold descriptions, asking LLM to return `{ scaffold_id, confidence, fallback_scaffold_id }`.

## 12. Sprint 15 phasing + commits

| Phase | Sub-sprint | Days | Deliverables | Commits |
|---|---|---|---|---|
| **Phase 0** | Pre-flight | 0.5 | Branch + dependency install + atom-meta extractor script + smoke baseline | 1 |
| **Phase 1** | 15c (icon-lib) | 5 | Phosphor + flag-icons integration; 8-category curation; existing icon-N atom retrofitting; smoke tests | 5-7 |
| **Phase 2** | 15a (chart atoms) | 10 | 18-22 chart atoms with TDD; smoke tests; lift prompt v3.32 chart sections | 18-22 |
| **Phase 3** | 15b (idiom atoms) | 10 | 12-15 idiom atoms with TDD; smoke tests; lift prompt v3.32 idiom sections | 12-15 |
| **Phase 4** | Theme layer | 5 | 9 theme files + resolveToken + UI picker + atom-theme integration smoke | 5-7 |
| **Phase 5** | 15e (scaffold registry) | 10 | 10-13 scaffold JSON manifests + picker.js + deck-from-scaffold.js + 2-call lift pipeline integration | 10-12 |
| **Phase 6** | Integration smoke | 2 | Full pipeline E2E (PDF → scaffold-pick → 18-atom expand → 9-theme cycle); browse smoke; PR open | 2-3 |
| **Phase 7** | Memory + PR | 1 | Memory updates + PR description | 1-2 |
| **TOTAL** | | **~43.5 days / ~9 wk (5 working days/wk)** OR **~7 wk if 6 dev-days/wk** | | ~55-70 commits |

## 13. Testing strategy

- **Per-atom smoke** — each new atom file ships with smoke test verifying render returns non-empty SVG + accepts theme tokens correctly
- **Icon library smoke** — `getIcon('briefcase', { weight: 'regular' })` returns valid SVG string per category
- **Scaffold pipeline smoke** — end-to-end: parse Aether AI PDF → pick scaffold → expand to atoms → render under each of 9 themes → screenshot diff
- **Lift prompt smoke** — REAL Anthropic API call on 3 reference PDFs (PresentationLoad Toolbox subset / Investor Deck Best Practices / Thesis Defense); expect scaffold-picker returns correct ID for each
- **Existing 24 atoms regression** — npm test must stay 47+/47+ green throughout

## 14. Open questions deferred

1. **Photo backend integration timing** — Sprint 16 likely Unsplash MCP, but Atlas-side caching strategy TBD
2. **3D peek mode** — show atom as 3D extrusion preview; locked Sprint 17+ scope per [[atlas-2d-two-track-architecture-lock]]
3. **Mobile responsive layout** — atoms currently desktop-only; mobile TBD
4. **Animation/transition layer** — atoms are static; transitions between scaffold slots TBD
5. **Theme custom branding** — user upload company palette → theme synthesis; TBD post-15
6. **Scaffold marketplace** — user-contributed scaffolds; TBD post-15

## 15. Process discipline (honoring Sprint 14 lesson per [[atoms-2d-sprint-14a-14b-shipped]])

**User's verbatim feedback from Sprint 14**: "你不严谨" — flip-flop 多次代价 4-6 小时 + 信任损失.

Sprint 15 hard rules:
- All design decisions LOCKED in this spec; no flip-flop without explicit user re-lock
- Each phase ends with `git status` clean before next phase
- No "should work" speculation in PR — claims need smoke test evidence
- Subagent-driven execution per [[superpowers:subagent-driven-development]] — each phase 1 subagent + 2-stage review
- npm test must stay green at every phase boundary

## 16. PR strategy

- New branch `sprint-15-three-layer` off `main` (current `2819867`)
- ONE PR per sub-sprint phase (5 PRs total: 15c, 15a, 15b, theme, 15e) for reviewable diff size
- Each PR squash-merged after user review (per [[CLAUDE.md]] hard rule)
- Final integration PR includes E2E smoke screenshots

## 17. Cross-references

- [[atlas-pl-observation-pool-v3]] — 3-batch observation that drives all targets
- [[atlas-icons-vs-atoms-architecture]] — why icon library separate
- [[gamma-8-template-observation]] — theme cluster theory + atom orthogonality
- [[atoms-2d-sprint-14a-14b-shipped]] — current 24 atom baseline
- [[atlas-present-spatial-narrative-thesis]] — product target this serves
- [[atlas-2d-two-track-architecture-lock]] — 2D SDF preset is canonical home for atoms
- [[atlas-atom-taxonomy]] — original 90-130 atom taxonomy (Sprint 15 ships subset)
- [[lift-llm-integration]] — lift prompt regeneration touchpoint
