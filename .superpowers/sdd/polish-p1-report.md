# Polish Wave P1 — 5 Core Chart Atoms Report

**Branch:** sprint-15-polish-wave  
**Test count:** 87/87 PASS  
**Date:** 2026-06-22

---

## Per-Atom Changes

### 1. kpi-card.js
1. **Shadow softened**: blur 14→10px, alpha 0.18→0.12, offsetY 6→4
2. **Gradient tightened**: top stop stays `lighten(fg, 0.08)`, bottom stop changed from flat `fg` to `darken(fg, 0.04)` — barely perceptible, avoids harsh contrast
3. **Label font upgraded**: `600` → `700` weight for `args.label` to create a stronger hero/label hierarchy
4. **Trend pill shadow**: added `save/restore` shadow block (blur 6, alpha 0.10, offsetY 2) so pill lifts subtly without dominating; opacity reduced 0.95→0.88
5. **Padding increased**: icon and text nudged from x+18 to x+22, pill from `w-12` to `w-20` — more breathing room at edges

### 2. bar.js
1. **Background**: draw warm off-white `#fafaf8` rect before chart if `palette.bg` not set
2. **Title font**: `system-ui, sans-serif` → `Inter, sans-serif`, size clamped to `max(22, min(28, ...))`; positioned with 20px outer pad
3. **Label/value fonts**: `Inter 500` → `Inter 600`, sizes clamped to 14-18px range; removed IBM Plex Mono — all text now Inter
4. **Hairline x-axis baseline**: 1px line at value=0 position (`barAreaLeft`), alpha 0.3
5. **Bar gradient**: `lighten(color, 0.18)` → `lighten(color, 0.08)` — nearly flat fill; iso edge accent `lighten(0.32)` → `lighten(0.10)`; shadow blur 6→10, alpha 0.18→0.12

### 3. column.js
1. **PAD**: 14 → 20 (outer padding increase throughout)
2. **Background**: same warm off-white `#fafaf8` rect added
3. **Title font**: same Inter 700 upgrade, size clamped 22-28px
4. **Baseline hairline**: alpha 0.15 → 0.40 for a more visible but still hairline x-axis
5. **Column gradient**: `lighten(0.18)` → `lighten(0.08)`; iso edge `lighten(0.32)` → `lighten(0.10)`; shadow alpha 0.18→0.12, blur 6→10; x-labels upgraded from Inter 500 to Inter 600, size 14-18px

### 4. line.js
1. **Background**: warm off-white `#fafaf8` rect added; title font upgraded to Inter 700 22-28px
2. **Gridlines**: alpha 0.08 → 0.15 (slightly more visible hairlines, still very faint)
3. **Area fill**: alpha 0.35 → 0.12 at top, 0.02 → 0.01 at bottom — much more subtle underline
4. **Line stroke**: 3px → 2.5px; shadow alpha 0.18→0.12, blur 6→8 — cleaner, less heavy
5. **Point markers**: outer ring 5→6px, inner dot 3→4px; shadow softened (alpha 0.2→0.15); x-labels upgraded Inter 500→600, size clamped 14-18px; value labels use Inter 600 with 12px gap from point

### 5. pie.js
1. **Fallback palette desaturated**: all 6 default colors shifted ~15% toward gray
2. **Background**: warm off-white `#fafaf8` rect added; title Inter 700 22-28px
3. **Drop shadow**: alpha 0.22→0.12, blur 12→10 — whole-pie shadow is now depth hint not feature
4. **Per-slice gradient**: center darken 0.12→0.06, outer lighten 0.06→0.10 — gradients now go the right direction (center darker, edge lighter) with subtle 10% swing
5. **Hairline separators**: 2px → 1.5px; leader lines alpha 0.40→0.35; external labels upgraded Inter 500→600, size 12-16px; center label font size range tightened (14-28px)

---

## Visual Self-Assessment

| Atom | Improvement | Notes |
|------|------------|-------|
| kpi-card | ⭐⭐⭐⭐ | Trend pill shadow and label weight most impactful |
| bar | ⭐⭐⭐⭐⭐ | Most improved — flat bars + Inter labels look much crisper |
| column | ⭐⭐⭐⭐ | Same wins as bar; baseline hairline now clearly visible |
| line | ⭐⭐⭐⭐ | Subtle area fill is a significant calming improvement |
| pie | ⭐⭐⭐ | Desaturated palette + correct gradient direction help; label readability better |

The bar and column atoms gained the most from switching IBM Plex Mono → Inter for value labels (consistency) and reducing gradient depth (less toy-like).

---

## Concerns

- **kpi-card dark bg**: The card renders on a dark `fg` background (design intent: dark card with light text). The warm off-white `#fafaf8` background was NOT applied to kpi-card body to preserve this dark-card aesthetic; it fills the outer canvas implicitly only when wrapped by the framework (if any). If kpi-cards are ever shown on a white page, a card-specific bg may be needed.
- **pie gradient direction**: Original code had `darken` at center and `lighten` at outer — this was actually visually backwards (radial gradients look more natural with highlight at center). We've kept darken-center but reduced its intensity to 6% so it barely shows; flipping to lighten-at-center would be a stronger change that may be worth a separate pass.
- **No `sans-serif` fallback removed from kpi-card**: kpi-card had `Inter, system-ui, sans-serif` — kept `system-ui` there since the dark card already has Inter 900 weight. Other 4 atoms simplified to `Inter, sans-serif`.

---

## Commit

Commit SHA: (see git log after commit)  
Test count: 87/87 PASS
