# Sprint 27 bridge 2: IR→2D — report

## What shipped

- `sdf-js/src/scene/ir-to-2d.js` — `irToSceneData(ir, opts?)` and `irDeckTo2DDeck(irDeck, opts?)`, the reverse of bridge 1 (`scaffold-to-ir.js`). Every IR is validated with `validateIR` before mapping; invalid IR throws.
- `sdf-js/apps/present/author-2d.html` + `author-2d.js` — a separate page (author.html/3D untouched) with the same one-input UX: textarea + BYOK key (`atlas-anthropic-key`, shared with the 3D end) → `textToIR` → `irDeckTo2DDeck` → per-slot Canvas2D render via `renderSceneDataToCanvas` → ⬇ PPTX / ⬇ PDF buttons wired to the existing exporters. `?demo=1` skips the LLM and renders a fixed 3-slide IR deck for headless/offline verification.
- `sdf-js/scripts/test-ir-to-2d.mjs` — 36 assertions (spec asked for ~25). Registered in `scripts/run-tests.mjs` under `scene`.

## Structure → atom mapping (v1)

| IR structure | 2D atom | notes |
|---|---|---|
| `sequence` | `funnel-with-conversion` | when `magnitude` present, same length as `nodes`, and strictly decreasing |
| `sequence` | `process-arrows` | no magnitude, or magnitude not strictly decreasing (v1 ignores `emphasis` — process-arrows has no highlight arg) |
| `hierarchy` | `org-chart` | relations `[parent,child]` rebuilt into a `{name, children}` tree; root = the one node with no incoming relation (validateIR guarantees exactly one) — v1 always targets org-chart (not tree-diagram), documented as a scope decision for simplicity |
| `network` | `relationship-graph` | nodes → `{id: String(i), label}`, relations → `{from, to}` edges |
| `magnitude` | `bar` | nodes → labels, magnitude → values (v1 skips donut — always bar per spec) |

Each IR becomes ONE full-slide subject at `{x:40, y:20, w:1200, h:680}`; the IR's `title` goes into the atom's own `title` arg (all 5 target atoms have one).

## author-2d.html verification

**Real LLM (not the ?demo=1 fallback).** Used the browse skill against the repo dev server (`sdf-js/dev-server.py 8001`). Extracted the real key from `key.txt` (had to strip the `ANTHROPIC_API_KEY=` prefix) and filled it into the page's own key input (not via localStorage/JS console injection). Prompt: "our Q3: revenue by region with Americas leading at 890, the funnel from 1200 leads to 45 closed, and the new org under the CEO".

Result: 3 slides rendered as expected — **bar** (Revenue by Region: Americas 890 / EMEA 420 / APAC 310), **funnel-with-conversion** (Q3 Sales Funnel: Leads→Qualified→Proposal→Closed with conversion % chips), **org-chart** (New Org Structure: CEO → 4 direct reports). Screenshot: `screens/sprint27-validation/author-2d.png` (read via multimodal, confirmed correct).

Also exercised both export buttons end-to-end on the real-LLM deck: ⬇ PPTX → "downloaded: ir-deck-20260706.pptx", ⬇ PDF → "downloaded: ir-deck-20260706.pdf" — no errors. Separately confirmed `?demo=1` renders its fixed 3-slide deck instantly (no LLM call) as a fallback path, per the plan's contingency — not needed in the end since the real LLM path worked, but verified anyway.

## npm test

124/124 test files passed (was 123/123 before this PR).

## Git compliance

No `--force`/`--force-with-lease`, no `--amend`, no `git reset --hard`, no worktrees. All work is new commits on `sprint-27-ir-to-2d`, pushed with `git push -u origin sprint-27-ir-to-2d`, PR opened via `gh pr create` — not merged.

## PR

See PR URL in the final chat response.
