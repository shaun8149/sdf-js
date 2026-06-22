# Polish Wave P3 — 4 Diagram-Family Atoms

**Date:** 2026-06-22
**Branch:** sprint-15-polish-wave
**Commit:** polish-wave-p3: refine 4 diagram-family atoms (fishbone / matrix-grid / flow-chart / traffic-light)
**Test result:** 87/87 PASS

---

## Files changed

- `sdf-js/src/present/atoms-2d/charts/diagrams/fishbone.js`
- `sdf-js/src/present/atoms-2d/charts/matrix/matrix-grid.js`
- `sdf-js/src/present/atoms-2d/charts/diagrams/flow-chart.js`
- `sdf-js/src/present/atoms-2d/charts/data/traffic-light.js`

---

## fishbone.js

- `PAD` increased from 16 → 22px (more breathing room)
- **Warm off-white background**: `rgba(252, 250, 245, 0.95)` with `roundRect` clip drawn before all content
- **Spine**: fixed to 2.5px lineWidth (was `Math.max(2.5, h * 0.008)`)
- **Effect box shadow**: alpha reduced 0.22 → 0.12; blur increased 8 → 11px (softer)
- **Effect box gradient**: lighten amt 0.2 → 0.1 (more subtle)
- **Rib lines**: now use `ribColors` array — either single accent color or up to 4 desaturated (`desaturate(..., 0.5)`) palette colors instead of full rainbow. Weight 1.8px (was dynamic `Math.max(2, h*0.006)`)
- **Branch labels**: font size 0.045 → 0.046 (slightly larger), offset 6 → 8px from rib tip
- **Sub-cause stems**: hairline 1px, alpha 0.35 (was 1.2px, alpha 0.45); text gap 4 → 6px
- **Sub-cause text**: alpha 0.75 → 0.72
- **Added**: `desaturate(rgb, amt)` helper. `darken` kept but marked `eslint-disable no-unused-vars`

---

## matrix-grid.js

- `PAD` increased 14 → 20px (outer padding)
- `drawCell` called with 6px gap (was 4px) on each side → cells have more inner room
- `drawCell` signature extended with `fg` parameter for hairline border
- **Cell drop shadow**: alpha 0.18 → 0.08, blur stays 8 → 10px (embedded feel, not floating)
- **Cell gradient**: lighten amt 0.18 → 0.08 (top-left to bottom-right direction) — subtle 8% lighten
- **Hairline border**: 1.5px stroke `palette.fg alpha 0.15` added to each cell
- **Top iso accent**: alpha 0.5 → 0.4
- **Sublabel line spacing**: bottom offset `y + h / 2 + 6` → `y + h / 2 + 8`
- Bubbles overlay: unchanged (verified still works)
- quadrantAxes: unchanged (still Inter 700, hairline arrows)

---

## flow-chart.js

- `PAD` increased 14 → 20px
- `NODE_PADDING` increased 12 → 18px (generous inner padding)
- `drawNode` destructure: was `{ fg, bg, accent }`, now only `{ accent }` (fg/bg no longer used since all nodes white text)
- **All step nodes**: now use `palette.colors[0]` fill with subtle 8% lighten gradient (was: non-highlight used near-white `lighten(fg, 0.85-0.92)` which looked grey)
- **Node radius**: 8 → 10px
- **Shadow**: alpha 0.15 → 0.10, blur 8 → 10px
- **Highlight stroke**: changed from 2px plain accent to 2.5px `lighten(accent, 0.5)` (stands out from same-color background)
- **Index circle**: white circle `rgba(255,255,255,0.25)` background (was fully opaque accent fill); white text unchanged; positioned via `NODE_PADDING * 0.5`
- **Label**: now Inter 700 (was 600), white `rgba(255,255,255,0.97)` (was `rgbCss(colorCtx.fg)`)
- **Sublabel**: `rgba(255,255,255,0.7)` (was `rgbaCss(colorCtx.fg, 0.6)`)
- **Arrow**: 2.5px stroke (was 2.4px), `rgbaCss(color, 0.5)` (was solid `rgbCss(color)`)
- **Arrowhead**: `rgbaCss(color, 0.6)` fill (was solid)

---

## traffic-light.js

- **NAMED_COLORS updated** to spec values:
  - `red`: [220,70,70] → [230,80,80]
  - `amber`: [230,165,50] → [245,175,55]
  - `green`: [70,180,100] → [80,175,110]
  - `blue`: [70,130,220] → [80,130,220]
- **Title font**: 0.05h → 0.055h (proportional to canvas h, Inter 700)
- **Housing**: now uses `fg.map(c => Math.round(c * 0.22))` as near-black base (properly follows palette), with `globalAlpha = 0.87`; gradient is top-left to bottom-right; shadow blur 10 → 12px
- **Active light bloom**: added `ctx.shadowColor = rgbaCss(color, 0.3); ctx.shadowBlur = 10` before drawing the active light circle
- **Inactive lights**: dim alpha changed — `darken(color, 0.25/0.5)` at `alpha 0.35` (was fully opaque dark darken)
- **Labels**: Inter 600 (was dynamic 700/500), font size 0.045h → 0.042h; inactive labels at `alpha 0.55`

---

## Process notes

- `npm test` ran 87/87 after each logical batch
- ESLint: 0 errors/warnings on all 4 files (verified with direct `npx eslint` invocation)
- Prettier ran via pre-commit hook (lint-staged) — minor whitespace normalization applied
- No args/spec changes made to any atom
