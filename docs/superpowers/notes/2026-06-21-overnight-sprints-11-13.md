---
date: 2026-06-21
context: overnight autonomous work per user direction "直到我们视觉上的成果接近 napkin"
sprints_shipped: 11 / 12 / 13 (three PRs chained, all pending user merge in morning)
total_files: 6 new / modified across 3 PRs
prompt_evolution: v3.25 → v3.26 → v3.27 → v3.28
---

# Overnight autonomous work: Sprint 11 / 12 / 13 toward Napkin visual parity

User direction 2026-06-21: "你做完之后，不用等我提交PR，自己开始下一步的工作。直到我们视觉上的成果接近 napkin"

3 sprints shipped overnight as chained PRs (each builds on prior, all pending user merge in morning):

## Sprint 11 (PR #43) — reliability + JSON discipline + output anchors

Direct response to Sprint 10 L3 measured issues (PR #41):
- ~27% lift error rate (5 "Failed to fetch" + 3 "Bad escaped char" out of 30 lifts)
- Some adopted variants mis-rendered (L_colon v0 + v3 black canvas / tiny dots)

**A) `callLiftLLM` retry-with-exponential-backoff** (`src/compositor-api.js`)
- 3 attempts max, 1s → 2s → 4s backoff
- Retries: fetch network failure + 429 + 5xx
- Honors Retry-After header on 429
- Fails fast on other 4xx

**B) Prompt v3.26 "JSON output discipline" section**
- Explicit escape rules for args.code string: \\\\, \\\", \\n
- Guidance: write large inline code COMPACTLY on one line (P5 parses fine)

**C) Prompt v3.26 "EXPECTED OUTPUT ANCHOR" blocks under 7 worked examples**
- ✅ what good output looks like + ❌ common failure modes
- LLM self-checks before emitting (e.g., "NOT black canvas — means background() called with fg color")

## Sprint 12 (PR #44) — typography polish (Inter + IBM Plex Mono)

Closes the **most visible** Napkin/Beautiful.ai competitive gap.

`p5-sandbox-iframe.html` — loads Google Fonts via `<link>`:
- **Inter** weights 400/500/600/700/900 (modern UI sans-serif)
- **IBM Plex Mono** weights 400/500/700 (digit-aligned mono for $, %, tables)
- preconnect for fast first paint
- ~150KB first paint, cached subsequent mounts

Prompt v3.27 NEW "## Typography" section:
- 2 fonts available, where to use each
- `textFont(name)` syntax + `drawingContext.font` escape hatch
- Typography hierarchy: hero 56-96 / title 24-32 / label 14-18 / body 11-14
- NEVER 'Arial' / 'Helvetica' / 'sans-serif' rule

## Sprint 13 (PR #45) — iconography (24 curated SVG icons + drawAtlasIcon)

Closes the **second-most-visible** Napkin gap. Napkin's icon library is one of their core moats — abstract concept affordance.

NEW `sdf-js/examples/p5-idiom-registry/atlas-icon-library.js`:
- 24 curated icons from Heroicons + Tabler (MIT-licensed sources)
- Re-coded as `drawingContext.Path2D` for fast in-canvas render
- 5 affordance groups: people/charts/action/object/annotation
- `drawAtlasIcon(name, x, y, size, color)` — single helper

Prompt v3.28 NEW "## Iconography" section:
- All 24 names + affordance mapping table (content keyword → icon name)
- KPI card icon + label usage example
- Rule: AT LEAST 1 icon per major content unit

## What's NOT in these PRs (Sprint 14+ candidates after L3 verify)

Not enough overnight time / depends on L3 feedback to know which:

1. **Spacing / whitespace discipline** — short pre-flight checklist at top of MODE_2D_ADDENDUM (palette bg/fg / Inter / icon / 40px margin / 24px gap)
2. **Layout templates** — 3-col / hero+sidebar / before-after worked examples
3. **Storytelling cohesion** — 6 variants should feel cohesive narrative not 6 disjoint sketches

These should wait for L3 data on what 11/12/13 actually move the needle on.

## When user wakes — recommended sequence

1. **Merge PRs in order**: #43 (Sprint 11) → #44 (Sprint 12) → #45 (Sprint 13)
   - Each builds on the prior; merging out-of-order may conflict
   - All squash merges per locked workflow
2. **Restart dev server** (no — same files, no rebuild needed; just refresh browser cache)
3. **Set test key** at `/tmp/atlas-l3/key.txt` (108 bytes, chmod 600)
4. **L3 verify** — run 5 cases that exercise Sprint 11/12/13 idioms:
   - Sprint 11 retry: any case will exercise retry path on transient errors
   - Sprint 11 JSON discipline: large-inline-code variants (apparatus / packCirclesInSDF)
   - Sprint 11 anchors: re-test L_colon which had black-canvas issue
   - Sprint 12 typography: ANY case — visual should show Inter font, not Helvetica
   - Sprint 13 iconography: NEW case "Our 4 teams use 3 cloud providers across 12 regions" should trigger users/cloud/globe icons
5. **Compare side-by-side** with prior Sprint 10 evidence (`docs/superpowers/manual-tests/2026-06-21-sprint-10-v325-l3-verify/evidence/`)
6. **If quality good**: merge passes, move to next gap (spacing / layouts)
7. **If quality still mediocre**: identify specific failure mode + targeted Sprint 14 fix

## Stop reason (autonomous work)

I stopped at Sprint 13 because:
- Without API access I can't measure if prompt changes 11/12/13 actually work
- Continued blind prompt additions risk bloat without improvement (prompt token cost grows with each section)
- 3 substantive changes is a reasonable test batch — let L3 verify before adding more

If user wakes and decides Sprint 14+ should ship more before they L3-verify, the layout templates / pre-flight checklist are queued candidates.

## Branch / PR state

```
main
  └─ sprint-11-quality-fixes (PR #43, prompt v3.26)
      └─ sprint-12-typography-polish-v2 (PR #44, prompt v3.27)
          └─ sprint-13-iconography (PR #45, prompt v3.28)
```

All 3 PRs open, branch chain. Merge order: #43 → #44 → #45.

npm test 63/63 throughout. 140/140 idiom smoke tests at sprint-13 head.
