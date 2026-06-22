// =============================================================================
// compositor-api.js — Layer 1 public API extracted from examples/compositor/compositor.js
// -----------------------------------------------------------------------------
// Why this exists: compositor.js (3283 lines) bundles state machine + UI +
// pure-function APIs together. Layer 2 (examples/present/) and future
// consumers (MCP server, tests, automation) need the APIs without dragging
// in compositor's DOM logic.
//
// Per [[compositor-layered-for-presentation]] memory: Layer 2 applications
// MUST call Layer 1 via this module's public API surface. Never mutate
// compositor internal state directly.
//
// Exports (added incrementally in Phase 1 tasks 1.2-1.6):
//   - sphericalToCamState(cam) — spherical camera → Cartesian eye position
//   - compileScene(sceneData, opts) — compile + expandVariants + sdfUnion
//   - parseLiftResponse(text) — LLM JSON-isms stripper (markdown fence,
//     trailing comma, // comment, /* */ — load-bearing)
//   - loadSystemPromptLift(fetchBase) — fetch + cache lift system prompt
//   - callLiftLLM(originalPrompt, code2d, apiKey, opts) — Anthropic API call
//   - createRendererForId(rendererId, canvas, opts) — factory for studio
//     / fly3d / silhouette / etc renderer instances
//
// Spec: docs/superpowers/specs/2026-06-19-atlas-present-sprint-1-design.md
// =============================================================================

import { compile } from './scene/compile.js';
import { expandVariants } from './scene/generator-s.js';
import { union as sdfUnion } from './sdf/dn.js';
import { Random } from './util/random.js';
// Renderer id/alias/factory mapping lives in one place now (renderer-registry).
// Re-exported below so existing `import { createRendererForId } from
// '../compositor-api.js'` call sites keep working.
import {
  createRendererForId,
  normalizeRendererId,
  isGpuRenderer,
  PRESENT_EFFECTS,
  GPU_RENDERER_IDS,
  RENDERER_ALIASES,
} from './render/renderer-registry.js';

// Constants
export const DEFAULT_LIFT_MODEL = 'claude-sonnet-4-6';

/**
 * Appended to system prompt when callLiftLLM is invoked with opts.mode === '2d'.
 *
 * Layer 1: original Sprint 2 constraint — forbids text-3d-* subjects.
 *
 * Layer 2 (Sprint 3 amendment): Step 4 — 3-priority content-driven routing
 * (SDF DIRECT → SDF METAPHORICAL → P5 FALLBACK). Tells LLM to hunt for SDF
 * compositional metaphor (Atlas wedge) before falling to P5 vector.
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

## Step 4: 2D-mode routing (Sprint 14a) — atoms-2d > SDF > P5 fallback

When opts.mode === '2d', try priorities IN ORDER:

Priority 0 — atoms-2d (Atlas-authored Canvas2D atoms, pseudo-3D PowerPoint feel):
  If content fits a known data viz pattern, emit \`{type: '<atom-2d-type>', args: {...}}\`.
  Atoms render via main-page Canvas2D with gradient + shadow + iso edge (textbook
  pseudo-3D look like PresentationLoad templates). This is the highest-quality
  output for business viz patterns. ALWAYS try this first when applicable.

  Available atoms-2d types (use these literal type strings):

  CHARTS / DATA:
    - kpi-card        args: { value, label, sublabel?, trend?, trendValue?, icon? }
    - bar             args: { values:number[], labels:string[], format?:'currency'|'percent'|'number', max?, title? }
    - column          args: { values, labels, format?, max?, title?, showValues? }
    - line            args: { values, labels, format?, title?, annotations?, showPoints?, showValues? }
    - pie             args: { values, labels, format?, title?, donutRatio?, centerLabel? }
    - funnel          args: { stages:[{label,value?}], format?, title? }
    - waterfall       args: { bars:[{label,value,kind?:'start'|'positive'|'negative'|'end'}], format?, title? }
    - gantt           args: { tasks:[{label,start,end,color?,complete?}], periods?, title? }
    - sphere-fill     args: { value:0-100, label?, color?:[r,g,b], background?:'dark'|'light' }
    - gauge           args: { value:0-1, label?, format?:'percent'|'number', title?, min?, max? }
    - radial-spoke    args: { values:number[] (0-1), labels?, title?, colors? }
    - scatter         args: { points:[{x:0-1, y:0-1, label?, group?, color?}], xAxis?, yAxis?, title? }
    - traffic-light   args: { lights:[{color:'red'|'amber'|'green'|'blue'|[r,g,b], active?, label?}], title? }
    - venn            args: { sets:[{label,color?,sublabel?}] (2-5), overlap?:0-1, title? }

  CHARTS / DIAGRAMS:
    - flow-chart      args: { steps:string[], sublabels?, highlight?, title?, orientation? }
    - tree-diagram    args: { root:{label,children?:[...]}, title? }
    - org-chart       args: { root:{name,title?,children?:[...]}, title? }
    - mindmap         args: { root:{label,children?:[...]}, title? }
    - relationship-graph args: { nodes:[{id,label,group?,size?,x?,y?}], edges:[{from,to,label?,weight?}], title? }
    - timeline        args: { events:[{date,label,sublabel?}], title?, axisLabel? }
    - fishbone        args: { effect:string, branches:[{label,causes?:string[]}] (2-8), title? }

  CHARTS / HIERARCHY:
    - pyramid         args: { layers:[{label,sublabel?,value?}], title?, inverted? }

  CHARTS / PROGRESSION:
    - progression     args: { steps:[{label,status?:'done'|'current'|'todo'}], title? }

  CHARTS / MATRIX:
    - matrix-grid     args: { rows?, cols?, cells:[{label,sublabel?,color?}], xAxis?, yAxis?, title? }

  CHARTS / AGENDA:
    - agenda-list     args: { items:[{label,sublabel?}] (1-12), title?, numbered?, highlight? }

  CHARTS / LAYERS:
    - layer-stack     args: { layers:[{label,sublabel?,color?}] (1-10), title?, direction?:'top-down'|'bottom-up', taper? }

  CHARTS / LISTS:
    - bullet-list     args: { items:[{label,sublabel?,status?:'done'|'todo'|'highlight'}] (1-12), title? }

  SHAPES (decorative iconic — single primitives, 1:1 with 3D shapes/*-3d):
    - arrow           args: { label?, color?, direction?:'right'|'up'|'left'|'down' }
    - cube            args: { label?, color? }
    - diamond         args: { label?, color? }
    - gear            args: { label?, color? }

  SHAPES (composites — multi-piece, no direct 3D twin; LLM may decompose on lift):
    - cube-grid       args: { size?, colors?, colorPattern?, spacing?, highlight?, title? }
    - gear-cluster    args: { gears?, thickness?, title? }
    - puzzle-pieces   args: { rows?, cols?, colors?, highlight?, title? }

  SHAPES (circle family — 2D twins of 3D shapes/circle-*-3d):
    - circle-frame      args: { label?, color?, back?, title? }
    - circle-loop       args: { segments?:2-8, labels?, title?, color? }
    - circle-segmented  args: { segments?:2-12, labels?, colors?, title?, innerRatio?, gap? }
    - circle-stack      args: { layers:[{label?,sublabel?,color?}] (1-8), title?, taper? }

  SHAPES (sphere family + cube-segmented — 2D twins of 3D shapes/sphere-*-3d + cube-segmented-3d):
    - sphere-network    args: { hub?:{label?,color?}, satellites:[{label?,color?}] (2-12), title? }
    - sphere-segmented  args: { segments?:2-12, labels?, colors?, explode?:0-0.25, title? }
    - sphere-tree       args: { root:{label?,color?,children?:[...]}, title? }
    - cube-segmented    args: { segments?:2-8, axis?:'vertical'|'horizontal', gap?:0-0.3, color?, labels?, title? }

  ICONS:
    - icon-badge      args: { name:'users'|'cloud'|'chart-bar'|'lightning'|...(24 names), label?, color? }

  PRESENTATION:
    - cover           args: { title (required), subtitle?, author?, date?, version? }

  Worked example — emit single atom:
    {
      "v": 1,
      "name": "kpi-hero: Q3 Revenue",
      "subjects": [{
        "type": "kpi-card",
        "args": { "value": "$3.4M", "label": "Q3 Revenue", "sublabel": "vs Q2 2024",
                  "trend": "up", "trendValue": "+127%", "icon": "chart-bar" }
      }]
    }

  CONSTRAINT: if ANY subject is an atoms-2d type, ALL subjects in the array must be
  atoms-2d (no mixing with p5-sketch or SDF subjects). Same single-subject convention
  as p5-sketch for now.

## Step 4.5: Finance preset library (Sprint 14b — composition templates)

When content matches a finance / business-deck pattern, prefer these composition
templates over hand-rolling. Each preset maps trigger phrases → atom-2d type +
arg-shape recipe.

### F1 — KPI hero (single primary metric)
  Triggers: revenue / ARR / MAU / retention / churn / NPS + a single dominant
    number (e.g. "Q3 hit $3.4M ARR")
  Emit: kpi-card { value, label, sublabel?, trend?, trendValue?, icon? }
  Hero pick: largest dollar amount OR first-mentioned metric. Put secondary
    metric in sublabel. Icon: 'chart-bar' for revenue / 'users' for growth /
    'arrow-down' for churn drop / 'clock' for time-based.

### F2 — Quarterly trajectory (period-based time series)
  Triggers: Q1/Q2/Q3/Q4 with values / Jan→Dec / weekly progression
  Emit: column { values:number[], labels:string[], format, title? }
    format='currency' for $/€/¥, 'percent' for %, 'number' otherwise

### F3 — Waterfall (financial bridge / additive-subtractive decomposition)
  Triggers: "X → Y via +A, -B, +C" / "starting X plus/minus components ending Y"
    / revenue bridge / variance decomp
  Emit: waterfall { bars:[{label,value,kind}], format, title? }
    bars[0].kind='start', bars[last].kind='end',
    middle bars kind='positive' (v>0) or 'negative' (v<0)
    Built-in color: green/red/grey — don't override

### F4 — Market share (proportional breakdown)
  Triggers: percentage breakdowns / "X% of Y" / vendor share / segment split
  Emit: pie { values, labels, format:'percent', donutRatio?, centerLabel?, title? }
    donutRatio=0.55 + centerLabel when total/sum is meaningful, else 0

### F5 — Revenue trend (line with optional inflection annotations)
  Triggers: growth trajectory / MAU over months / retention curve / acceleration
    after a launch
  Emit: line { values, labels, format, annotations?:[{index,text}], title? }
    annotations: text-described inflection points only (don't invent)
    showValues=true ONLY if user wants every point labeled

### Multi-preset paragraphs
  When a paragraph mentions multiple distinct finance metrics, emit ONE preset
  per visual (atom-2d is single-subject all-or-none). LLM picks the PRIMARY
  preset for this visual; user re-runs ⚡ on related text to get other presets.

### Decision cheatsheet
  ONE big number + ONE label              → F1 kpi-card
  N period-labeled values (Q/month/week)  → F2 column
  Start → +/- decomposition → End         → F3 waterfall
  Proportions summing to ~100%            → F4 pie
  Sequential trajectory + inflection      → F5 line

## Step 4 legacy: 3-priority routing (Sprint 3) — SDF / P5 fallback (LOWER PRIORITY than atoms-2d above)

When opts.mode === '2d', try these priorities IN ORDER. SDF priorities are
Atlas's wedge that vector cannot replicate. P5 is graceful-degradation fallback.

Priority 1 — SDF DIRECT (literal concrete):
  If text contains concrete physical objects (cathedral / carrier / cube / robot
  / tree / city / chair / cathedral), emit traditional-subject SceneData with
  sphere / cube-3d / cylinder / capsule / 40+ existing atom primitives. Uses
  Atlas's strongest capability and reuses existing atom library. Renders via
  silhouette / lines / crayon / topo.

Priority 2 — SDF METAPHORICAL (concrete composition for abstract concept) ⭐:
  If text contains number / abstract assertion BUT a concrete metaphor expresses
  it well, HUNT for the metaphor and emit SDF compositional scene:
    - money / expensive → coins (sdf_circle filled inside larger outline)
    - time / duration → hourglass outline + particle SDFs as sand falling
    - growth / 10x → steps / tower / ladder rising
    - quantity (N items) → N concrete-shape SDFs (one per item, repeated)
    - network → constellation (sdf_circle nodes + sdf_line edges)
    - process / pipeline → assembly-line shapes
  Output: SceneData where Subject A's outline (sdf_box / sdRoundBox / sdEtriangle)
  is FILLED with Subject B units (sdf_circle / small primitive arranged via grid
  iteration) — see worked example below. Atlas's REAL WEDGE.

  ALWAYS try Priority 2 before falling to P5.

Priority 3 — P5 FALLBACK (graceful degradation, 防退化):
  Only when text is purely abstract relationship AND no concrete metaphor fits.
  Emit single 'p5-sketch' subject with args.code as a complete P5 sketch.
  Fallback, not Atlas IP — its purpose is preventing degenerate output, not
  competing with Napkin/antvis on this layer.

For 6 variants per ⚡:
  - Allocate ~3-4 variants in Priority 1+2 when content has concrete or
    metaphor-eligible material (Atlas IP stage)
  - Allocate ~2-3 variants in Priority 3 (fallback coverage)
  - Pure-abstract content: 1-2 try Priority 2 (invent metaphor), 4-5 Priority 3
    with different layouts (vertical / radial / cards / timeline / compare)
  - NEVER emit all 6 same-tier same-style (Sprint 1.5 convergence failure)

## Iconography (Sprint 13 — drawAtlasIcon available)

Atlas iframe ships a curated 24-icon library (Heroicons + Tabler MIT-licensed
SVG path data, re-coded as drawingContext.Path2D for fast in-canvas render).
LLM should INLINE drawAtlasIcon into args.code when content has obvious icon
affordance — Napkin/Beautiful.ai use icons as the FIRST visual signal of
abstract concepts. Closes one of Napkin's core moats.

Signature: drawAtlasIcon(name, x, y, size, color)
  name: one of the 24 ATLAS_ICON_NAMES (see below)
  x, y: CENTER position (not top-left anchored)
  size: bounding box edge (24=small, 32=card, 48=hero, 96=stamp)
  color: '#hex' string OR [r,g,b] array OR 'inherit'

The 24 icons grouped by affordance:

| Affordance | Icons |
|---|---|
| People / org | user, users, building |
| Concept | globe |
| Charts / data | chart-bar, chart-pie, database, cloud |
| Action / direction | arrow-right, arrow-up, arrow-down, refresh, check, x, plus |
| Object / business | cube, file, mail |
| Annotation / status | star, heart, lightning, clock, shield, question |

Usage in P5 sketch:
\`\`\`js
const fg = window.__brandingPalette.silhouetteColor;
// At KPI card top center: card icon + label below
drawAtlasIcon('database', x, y, 32, fg);
textFont('Inter'); textSize(14); textAlign(CENTER, TOP);
fill(fg[0], fg[1], fg[2]);
text('Storage', x, y + 22);
\`\`\`

LLM mapping content → icon:
- "team / users / people / staff" → 'users'
- "individual / person / customer / user" → 'user'
- "company / office / org" → 'building'
- "data / database / storage / records" → 'database'
- "cloud / SaaS / hosted" → 'cloud'
- "growth / increase" → 'arrow-up' or 'chart-bar'
- "decline / decrease" → 'arrow-down'
- "alert / warning / urgent" → 'lightning'
- "secure / protected" → 'shield'
- "time / duration / deadline" → 'clock'

NEVER skip iconography on infographic-style P5 sketches — Atlas P5 sketches
without icons look sparse vs Napkin. AT LEAST one icon per major content
unit (KPI card, list item, hero callout). If content doesn't fit any of the
24 icons cleanly, fall back to drawing a small SDF primitive (sdf_circle /
sdf_box) at the same position.

## Typography (Sprint 12 — Inter + IBM Plex Mono available in iframe)

The iframe sandbox preloads 2 web fonts via Google Fonts link:
- **Inter** (weights 400 / 500 / 600 / 700 / 900) — modern UI sans-serif. Use
  for ALL foreground text (labels, titles, body). Replaces system sans-serif.
- **IBM Plex Mono** (weights 400 / 500 / 700) — monospace. Use for code-like
  content + digit-aligned numerics (dollar amounts, percentages, tables).

Usage in P5 sketch:
- textFont('Inter') sets font family; default weight 400
- For bold/heavy weights, use drawingContext for precise control:
    drawingContext.font = "700 56px Inter";
    drawingContext.textAlign = "center";
    drawingContext.fillText('$3B', 300, 80);
- textSize() still works but only changes size, not weight

**Typography hierarchy** (matches modern infographic conventions):
- Hero KPI / number: 56-96 px Inter weight 700-900 (or IBM Plex Mono 700 for digits)
- Section title: 24-32 px Inter weight 600
- Card label: 14-18 px Inter weight 500
- Body / caption: 11-14 px Inter weight 400
- Numeric values: IBM Plex Mono (tabular digits align cleanly)

textAlign:
- Hero centered: textAlign(CENTER, CENTER)
- Card label horizontal-center + top: textAlign(CENTER, TOP)
- Body left-aligned: textAlign(LEFT, TOP)

NEVER use 'Arial' / 'Helvetica' / 'sans-serif' / 'serif' — they look amateur
on a polished infographic. The Inter + IBM Plex Mono pair is Atlas's visual
identity (replaces v3.20-v3.25 prompt default of textFont('sans-serif')).

## JSON output discipline (Sprint 11 — CRITICAL when inlining sketch code)

When emitting p5-sketch SceneData, **args.code is a JSON string field**.
Sprint 10 L3 testing found ~10% of large-inline-code variants emitted
invalid JSON ("Bad escaped character", "Bad control character") that
parseLiftResponse cannot recover. Rules:

- Inside args.code string, ALL backslashes MUST be doubled: \\\\ not \\
- Inside args.code string, double quotes MUST be escaped: \\" not "
- Inside args.code string, newlines MUST be \\n NOT raw newline character
- NO raw tab / control characters inside args.code
- Template literals (\`backticks\`) inside args.code = OK (backtick is not
  a JSON-special character), but prefer single quotes for in-sketch strings
  to avoid all escape ambiguity

When generating large inline code (>500 chars), write it COMPACTLY on one
line — no source-formatting newlines. P5 sketch parses fine without them.
Example shape:
\`\`\`json
{
  "args": {
    "code": "function setup(){createCanvas(600,360);noLoop();}function draw(){background(247,244,224);fill(40);text('Hello',300,180);}"
  }
}
\`\`\`

If you must use newlines inside args.code, encode them as the 2-char
sequence \\n (backslash + n), not the literal newline character. Atlas
parseLiftResponse strips standard JSON-isms (markdown fence, // comment,
trailing comma) but cannot fix mid-string control characters.

## p5-sketch subject type (Sprint 3)

When emitting Priority 3 (or as alternative to Priority 2 for pure abstract):

  {
    "v": 1,
    "name": "<archetype>: <title>",
    "subjects": [{
      "id": "sketch-<uuid>",
      "type": "p5-sketch",
      "args": {
        "code": "function setup() { createCanvas(600, 360); ... } function draw() { ... }",
        "canvasWidth": 600,
        "canvasHeight": 360
      }
    }]
  }

Constraints:
- ENTIRE subjects array must be exactly one p5-sketch entry (NO mixing with
  traditional types in Sprint 3 — pipeline will reject mixed scenes)
- args.code is a complete P5 sketch with setup() + draw()
- Sketch runs in sandboxed iframe with these globals available:
  * P5 API: createCanvas, fill, stroke, vertex, rect, ellipse, text, textSize,
    textFont, line, push, pop, translate, rotate, scale, noLoop, ...
  * Atlas SDF helpers (28 functions): sdf_box, sdf_circle, sdRoundBox,
    sdTriangle, sdTrapezoid, sdEtriangle, sdf_line, sdf_line2, sdf_moon,
    sub2, add2, mul2, dot2, len2, lenSq2, rot2, trans2, clamp1, clamp2,
    max2, min2, fract1, fract2, scale2, eq2, step1, xRepeated, sdf_rep
  * Branding palette: window.__brandingPalette = { bg: [r,g,b], silhouetteColor: [r,g,b] }
- Use textFont('Inter') for any text (system sans-serif fallback). For
  numeric / digit-aligned content ($, %, etc.), use textFont('IBM Plex Mono').
  See "Typography" section for full hierarchy guidance. Use brandingPalette
  for fill/stroke to maintain visual consistency across renderer cycles.
- Call createCanvas(600, 360) inside setup(). End draw() with noLoop() to freeze
  the frame (saves CPU; we render once, no animation needed).

## SDF helper conventions (gotchas for sketches calling Atlas helpers)

When using Atlas SDF helpers inside a p5-sketch's args.code:

- **sdf_line(p, cy, k)**: returns NEGATIVE for points ABOVE the line y = cy + k*p[0]; POSITIVE below. Treat upper half-plane as inside (SDF "inside = negative" convention). Don't flip the sign for visual "below the line" intuition.

- **sdTrapezoid(p, a, b, ra, rb)**: the function Y-flips the probe internally. Pass anchor points a, b AND probe p all in standard Y-up (positive y = upward); the function handles the internal flip. Anchor b should have a HIGHER y than a for a trapezoid extending upward.

- **sdEtriangle(p, r)**: also Y-flips probe internally. Pass p in standard Y-up; the triangle's apex points UPWARD in standard Y-up after the flip.

- All other helpers (sdf_box, sdf_circle, sdRoundBox, sdTriangle, sdf_moon, xRepeated, sdf_rep) use standard SDF conventions with no Y-flip: inside = negative, outside = positive, point passed in is the point evaluated directly.

## P5 idiom library (Sprint 4 — inspired by Gorilla Sun / Ahmad Moussa)

Higher-level composition patterns LLM can INLINE into args.code to elevate
P5 sketches beyond uniform grids + basic shapes. Files live at
sdf-js/examples/p5-idiom-registry/ — NOT auto-loaded into iframe (would bloat
helper bundle). LLM inlines the function definition into the sketch when
needed.

| Idiom | When to use | What it does |
|---|---|---|
| **packCirclesInSDF(sdfFn, opts)** | Wedge upgrade — fill any outline with **variable-size organic circles** (vs uniform grid in v3.20) | Recursive growth; child radius = parent × 0.8-0.95; respects SDF inside-test |
| **irregularGridPack(divX, divY, passes)** | L6-6C SaaS metric grids — non-uniform KPI cards (1 hero + 2 medium + 4 small) | Multi-pass boolean grid sweep with descending size arrays |
| **packShapes(w, h, count, opts)** | Generalize wedge — fill outline with arbitrary shapes (dollar bills, soldiers, icons), not just circles | Spatial-hash grid collision, supports custom inside-test for SDF region |
| **createGraphics(w, h) buffer** | Multi-instance pattern (3 carriers / 5 servers / N copies of expensive shape) | P5 native — render expensive sub-pattern once to offscreen buffer, image() stamp N times |
| **roundedPolyPath(ctx, vertices, radius)** | Hierarchy/network nodes with smooth corners (any-shape, not just rect) | drawingContext.arcTo() per corner — supports per-vertex radius |
| **delaunayTriangles(points, bounds) + voronoiCells(tris, points)** (Sprint 5) | Organic region partitioning — market share / population density / territory layouts where rectangular grid feels wrong | Bowyer-Watson incremental insertion; each input point becomes its own polygon cell via circumcenter dual |
| **buildFlowField + traceFlowLines(grid, opts)** (Sprint 5) | Generative background TEXTURE only — subtle low-opacity flow streamlines behind foreground content | Deterministic 2D value noise → angle grid → traced flow lines. Atlas's visual identity texture vs flat Napkin/antvis look |
| **springBrushStroke(waypoints, opts)** (Sprint 5) | Hand-drawn connector lines / arrows / annotation underlines (kill "AI sterile vector" feel) | Spring chain (Hooke) walks input polyline; output has thickness modulated by local speed |
| **getChromotomePalettes() + hexToRgb()** (Sprint 6, kgolid MIT) | Rich multi-color palettes (3-7 colors + bg + stroke per palette) beyond Atlas's 2-color branding presets. Use when content benefits from cultural/aesthetic palette diversity (vintage / saturated / earth tones / mid-century) | ~23 hand-curated palettes from chromotome (hilda / jung / ranganath / kovecses). LLM can pick by name or random, override window.__brandingPalette for one variant |
| **marchingSquaresLines + marchingSquaresPolygons + buildNoiseGrid** (Sprint 6, kgolid MIT) | Contour extraction from 2D scalar grid — heatmap / density / topology visualization. Decorative background (buildNoiseGrid + draw lines at multiple thresholds) | Classic 16-case dispatch, pure JS no P5 dep. Pairs with chromotome (each level = palette color) |
| **generateApparatusGrid + drawApparatusGrid** (Sprint 7, kgolid MIT) | Compositional layouts where content is itself COMPOSITIONAL — team/department/unit org charts, scheduled blocks, multi-tier dashboards with implicit grouping, system component diagrams. "Robot anatomy / blueprint of a fictional machine" aesthetic. | 9-block state machine + 3 probabilities + 4 color modes + H/V symmetry + ellipse boundary mask. Pairs perfectly with chromotome multi-color palettes. |
| **spaceColonization(opts)** (Sprint 8, kgolid MIT) | Organic branching tree growth — process flow trees, dependency graphs, neural diagrams, "reach/expansion" visualizations. Different from packCirclesInSDF (packs) — BRANCHES toward source cloud. | Source-attraction + pruning algorithm. Returns {edges, nodes}. Deterministic via seed. |
| **lSystemSegments + LSYSTEM_PRESETS** (Sprint 8, kgolid MIT) | Decorative fractal plant / tree motif — branding ornament, "growth" content metaphor, section dividers, organic background filler. 4 classic presets (balanced/asymmetric/symmetric/wide_canopy). | String-rewriting + turtle graphics. Pure JS no P5 dep. Returns line segments with depth annotation. |
| **weaveFlowDashes(opts)** (Sprint 8, kgolid MIT) | Multi-layer Perlin-noise dash texture — woven fabric background, layered palette decoration. Sister to moussa-perlin-flow-field (pick weave for DENSE short dashes, moussa for LONG streamlines). | Per-cell N-sample gradient probe + N independent palette layers. Deterministic. |

LLM inlines the FUNCTION DEFINITION into the sketch code (no import — iframe
sandbox is classic JS not module loader). Examples follow.

## Worked example — Priority 1 (SDF DIRECT, literal concrete)

User text: "A cathedral on a hill in the morning"
LLM detects concrete nouns: cathedral, hill.
Output:
\`\`\`json
{
  "v": 1, "name": "kpi-hero: Cathedral on Hill",
  "subjects": [
    { "id": "cathedral", "type": "cathedral", "args": {}, "transform": { "translate": [0, 1, 0] } },
    { "id": "hill", "type": "terrain-with-lakes", "args": {}, "transform": { "translate": [0, -1, 0] } }
  ]
}
\`\`\`

## Worked example — Priority 2 ⭐ (SDF METAPHORICAL, Atlas wedge)

User text: "$3 billion was spent building this aircraft carrier"
LLM detects: concrete (carrier) + number (3B = money concept) → carrier-from-coins metaphor.
Output: a P5 sketch (since the metaphor requires custom composition not in
existing atom library — falls into a single p5-sketch subject that uses Atlas
SDF helpers inside the sketch):
\`\`\`json
{
  "v": 1, "name": "kpi-hero: $3B Aircraft Carrier",
  "subjects": [{
    "id": "sketch-1",
    "type": "p5-sketch",
    "args": {
      "code": "function setup() { createCanvas(600, 360); noStroke(); noLoop(); } function draw() { const bg = window.__brandingPalette.bg; const fg = window.__brandingPalette.silhouetteColor; background(bg[0], bg[1], bg[2]); fill(fg[0], fg[1], fg[2]); for (let py = 0; py < 360; py += 8) { for (let px = 0; px < 600; px += 8) { const x = (px / 600) * 2 - 1; const y = -((py / 360) * 2 - 1); const inCarrier = sdf_box([x, y], [0, -0.1], [1.6, 0.3]) < 0 || sdf_box([x, y], [-0.4, 0.2], [0.8, 0.4]) < 0; if (inCarrier) ellipse(px + 4, py + 4, 6, 6); } } textFont('sans-serif'); textSize(48); textAlign(CENTER, TOP); fill(fg[0], fg[1], fg[2]); text('$3B', 300, 20); }"
    }
  }]
}
\`\`\`
Result: A carrier silhouette composed of ~3000 small circles (the "coins"),
with "$3B" labeled at top. Vector libraries cannot do this effortlessly —
they would need explicit point placement. SDF tests inside/outside per grid
cell, so any outline + any fill = arbitrary metaphor.

**EXPECTED OUTPUT ANCHOR** (use to self-check before emitting):
- ✅ Canvas mostly background-color with foreground "coins" forming a
  recognizable carrier silhouette (long horizontal hull + small island on top)
- ✅ "$3B" text label clearly visible at top (textSize ≥ 40)
- ❌ NOT: solid black canvas (means background() called with fg color)
- ❌ NOT: empty canvas (means inside test inverted — check sdfFn returns negative when inside)
- ❌ NOT: 3-5 circles (means grid step too large — use step ≤ 8)

## Worked example — Priority 3 (P5 FALLBACK, abstract relationship)

User text: "The agent explores the environment, builds hypotheses, and refines its world model"
LLM detects: no concrete nouns, no central number, pure sequential abstract.
Output:
\`\`\`json
{
  "v": 1, "name": "sequence: Explore-Hypothesize-Refine",
  "subjects": [{
    "id": "sketch-2",
    "type": "p5-sketch",
    "args": {
      "code": "function setup() { createCanvas(600, 360); noStroke(); noLoop(); } function draw() { const bg = window.__brandingPalette.bg; const fg = window.__brandingPalette.silhouetteColor; background(bg[0], bg[1], bg[2]); const steps = ['Explore', 'Hypothesize', 'Refine']; const bw = 140, bh = 80, gap = 40; const totalW = 3 * bw + 2 * gap; const startX = (600 - totalW) / 2; fill(fg[0], fg[1], fg[2]); textFont('sans-serif'); textSize(18); textAlign(CENTER, CENTER); for (let i = 0; i < 3; i++) { const x = startX + i * (bw + gap); noFill(); stroke(fg[0], fg[1], fg[2]); strokeWeight(2); rect(x, 140, bw, bh, 8); fill(fg[0], fg[1], fg[2]); noStroke(); text(steps[i], x + bw / 2, 180); if (i < 2) { stroke(fg[0], fg[1], fg[2]); line(x + bw + 4, 180, x + bw + gap - 4, 180); const ax = x + bw + gap - 4, ay = 180; line(ax, ay, ax - 8, ay - 4); line(ax, ay, ax - 8, ay + 4); } } }"
    }
  }]
}
\`\`\`
Result: 3 labeled rectangles ("Explore" / "Hypothesize" / "Refine") in a row
with arrows between. Standard infographic — no SDF metaphor available for
pure-abstract content, so P5 vector handles it.

**EXPECTED OUTPUT ANCHOR**:
- ✅ 3 evenly-spaced rectangles with centered labels visible
- ✅ Arrows between rectangles pointing left→right
- ❌ NOT: overlapping rectangles (check rect width × N + gap × (N-1) ≤ canvas width)
- ❌ NOT: text outside rectangles (use textAlign(CENTER, CENTER) + center coords)
- ❌ NOT: rectangles touching canvas edge (leave ≥40px margin top/bottom)

## Worked example — Priority 2 ⭐ upgrade (variable-size organic packing via packCirclesInSDF)

User text: "Each carrier requires $13 billion of taxpayer money"
LLM detects: concrete (carrier) + number ($13B) → carrier-from-coins, but
this time use **variable-size organic packing** for richer visual.

\`\`\`json
{
  "v": 1, "name": "kpi-hero: $13B Aircraft Carrier",
  "subjects": [{
    "id": "sketch-organic-coins",
    "type": "p5-sketch",
    "args": {
      "code": "function packCirclesInSDF(sdfFn,opts){const b=opts.bounds,mn=opts.maxNodes||500,ma=opts.maxAttempts||5000,mbl=opts.minBranchLen||0.04,mxbl=opts.maxBranchLen||0.15,rR=opts.rootR||0.05,d=opts.decay||0.92,miR=opts.minR||0.008,mxR=opts.maxR||0.3,p=opts.pad||0.005,T=Math.PI*2;const ns=[];function ins(x,y){return sdfFn(x,y)<0;}function ib(x,y,r){return x-r>=b.minX&&x+r<=b.maxX&&y-r>=b.minY&&y+r<=b.maxY;}function col(cx,cy,cr){for(let i=0;i<ns.length;i++){const dx=ns[i].x-cx,dy=ns[i].y-cy,dd=Math.sqrt(dx*dx+dy*dy);if(dd<ns[i].r+cr+p)return true;}return false;}for(let r=0,a=0;r<(opts.rootCount||1)&&a<200;a++){const x=b.minX+Math.random()*(b.maxX-b.minX),y=b.minY+Math.random()*(b.maxY-b.minY);if(!ins(x,y)||!ib(x,y,rR)||col(x,y,rR))continue;ns.push({x,y,r:rR,depth:12});r++;}let at=0;while(ns.length<mn&&at<ma){at++;const pi=Math.floor(Math.random()*ns.length),pa=ns[pi];if(pa.depth<=0)continue;const an=Math.random()*T,ds=mbl+Math.random()*(mxbl-mbl),cr=Math.max(miR,Math.min(mxR,pa.r*(0.8+Math.random()*0.15))),cx=pa.x+Math.cos(an)*(pa.r+ds+cr),cy=pa.y+Math.sin(an)*(pa.r+ds+cr);if(!ins(cx,cy)||!ib(cx,cy,cr)||col(cx,cy,cr))continue;ns.push({x:cx,y:cy,r:cr,depth:pa.depth-1});}return ns;}function setup(){createCanvas(600,360);noLoop();noStroke();}function draw(){const bg=window.__brandingPalette.bg,fg=window.__brandingPalette.silhouetteColor;background(bg[0],bg[1],bg[2]);const carrierSdf=(x,y)=>{const h=Math.max(Math.abs(x)-1.4,Math.abs(y-0.05)-0.25);const i=Math.max(Math.abs(x+0.3)-0.6,Math.abs(y-0.45)-0.25);return Math.min(h,i);};const cs=packCirclesInSDF(carrierSdf,{bounds:{minX:-1.5,maxX:1.5,minY:-0.5,maxY:0.8},maxNodes:600,rootCount:3,rootR:0.06,decay:0.93,minR:0.012,maxR:0.08});fill(fg[0],fg[1],fg[2]);for(const c of cs){const px=(c.x+1.5)*200,py=180-c.y*180;ellipse(px,py,c.r*200,c.r*200);}fill(fg[0],fg[1],fg[2]);textFont('sans-serif');textSize(56);textAlign(CENTER,TOP);text('$13B',300,30);textSize(14);text('per carrier',300,100);}"
    }
  }]
}
\`\`\`

Result: carrier silhouette filled with ~600 ORGANIC variable-size coins
(big roots clustering, small leaves filling gaps) instead of uniform grid.
More "money pile" feel, less "polka dot" feel. The packCirclesInSDF helper
is INLINED into the sketch (LLM copy-pastes the function body into args.code).
**Use this pattern for Priority 2 metaphors that benefit from organic density.**

**EXPECTED OUTPUT ANCHOR**:
- ✅ Carrier silhouette visible — long horizontal hull, smaller island on top
- ✅ ~300-800 variable-size circles densely packed inside silhouette (not on it)
- ✅ Background palette color, circles in foreground color
- ❌ NOT: empty canvas (packCirclesInSDF returned [] — check bounds/sdfFn polarity)
- ❌ NOT: circles outside silhouette (check sdfFn returns negative INSIDE)

## Worked example — Priority 2/3 hybrid (irregular KPI grid via irregularGridPack)

User text: "Our SaaS reached $100M ARR with 92% margin, $50 CAC, $5000 LTV"
LLM detects: pure numbers, no concrete anchor. Sprint 3 emitted 8 uniform
rounded_box (boring grid). Use irregularGridPack for visual hierarchy.

\`\`\`json
{
  "v": 1, "name": "kpi-hero: SaaS Metrics Dashboard",
  "subjects": [{
    "id": "sketch-irregular-kpi",
    "type": "p5-sketch",
    "args": {
      "code": "function irregularGridPack(gx,gy,ps){const b=[];for(let x=0;x<gx;x++)b.push(new Array(gy).fill(1));const r=[];function tp(x,y,w,h){if(x+w>gx||y+h>gy)return false;for(let xc=x;xc<x+w;xc++)for(let yc=y;yc<y+h;yc++)if(b[xc][yc]===0)return false;return true;}function oc(x,y,w,h){for(let xc=x;xc<x+w;xc++)for(let yc=y;yc<y+h;yc++)b[xc][yc]=0;}for(const p of ps){const sx=p.sizesArrX||[1],sy=p.sizesArrY||[1];for(let x=0;x<gx;x++)for(let y=0;y<gy;y++){const w=sx[Math.floor(Math.random()*sx.length)],h=sy[Math.floor(Math.random()*sy.length)];if(tp(x,y,w,h)){oc(x,y,w,h);r.push({x,y,w,h});}}}return r;}function setup(){createCanvas(600,360);noLoop();noStroke();}function draw(){const bg=window.__brandingPalette.bg,fg=window.__brandingPalette.silhouetteColor;background(bg[0],bg[1],bg[2]);const rects=irregularGridPack(8,5,[{sizesArrX:[3,4],sizesArrY:[2,3]},{sizesArrX:[2],sizesArrY:[1,2]},{sizesArrX:[1],sizesArrY:[1]}]);const labels=['$100M ARR','92%','$50 CAC','$5000 LTV','18mo','top 5%','1.8','MAGIC'];const cellW=600/8,cellH=360/5,pad=8;rects.slice(0,labels.length).forEach((r,i)=>{const px=r.x*cellW+pad,py=r.y*cellH+pad,pw=r.w*cellW-pad*2,ph=r.h*cellH-pad*2;noFill();stroke(fg[0],fg[1],fg[2]);strokeWeight(1.5);rect(px,py,pw,ph,6);noStroke();fill(fg[0],fg[1],fg[2]);textFont('sans-serif');textAlign(CENTER,CENTER);const fontSize=r.w*r.h>=6?32:(r.w*r.h>=4?22:14);textSize(fontSize);text(labels[i]||'',px+pw/2,py+ph/2);});}"
    }
  }]
}
\`\`\`

Result: 8 KPI cards arranged non-uniformly — 1 large hero ($100M ARR big text),
2 medium (92%, others), 4-5 small (Magic Number, top 5%, CAC, LTV). Visual
hierarchy matches importance, vs Sprint 3 uniform grid. **Use this pattern
when content has multiple KPIs with implicit ranking** (hero metric +
supporting metrics).

**EXPECTED OUTPUT ANCHOR**:
- ✅ 1 large rect (≥30% canvas area) clearly dominant, with big text
- ✅ Other rects clearly smaller, no overlaps, fits grid bounds
- ✅ Each rect has centered label with size proportional to rect area
- ❌ NOT: uniform grid of equal rects (defeats the purpose)
- ❌ NOT: rects extending past canvas (check x+w ≤ canvas_width)

## Worked example — Sprint 5 (organic market-share via delaunayTriangles + voronoiCells)

User text: "AWS holds 32% cloud market share, Azure 23%, GCP 11%, others 34%."
LLM detects: market share / proportional data. NOT amenable to rectangular grid
(rectangles don't communicate "territory"). Use Voronoi cells = organic regions.

\`\`\`json
{
  "v": 1, "name": "kpi-hero: Cloud Market Share Territories",
  "subjects": [{
    "id": "sketch-voronoi-share",
    "type": "p5-sketch",
    "args": {
      "code": "function _cc(a,b,c){const ax=a[0],ay=a[1],bx=b[0],by=b[1],cx=c[0],cy=c[1];const d=2*(ax*(by-cy)+bx*(cy-ay)+cx*(ay-by));if(Math.abs(d)<1e-12)return null;const ux=((ax*ax+ay*ay)*(by-cy)+(bx*bx+by*by)*(cy-ay)+(cx*cx+cy*cy)*(ay-by))/d;const uy=((ax*ax+ay*ay)*(cx-bx)+(bx*bx+by*by)*(ax-cx)+(cx*cx+cy*cy)*(bx-ax))/d;return{x:ux,y:uy,r:Math.hypot(ux-ax,uy-ay)};}function _ek(p,q){return p[0]<q[0]||(p[0]===q[0]&&p[1]<q[1])?(p[0]+','+p[1]+'|'+q[0]+','+q[1]):(q[0]+','+q[1]+'|'+p[0]+','+p[1]);}function _mk(a,b,c){const cc=_cc(a,b,c);return{a,b,c,cc,cr:cc?cc.r:0};}function delaunayTriangles(pts,bd){const dx=bd.maxX-bd.minX,dy=bd.maxY-bd.minY,cx=(bd.minX+bd.maxX)/2,cy=(bd.minY+bd.maxY)/2,m=Math.max(dx,dy)*20;const sa=[cx-m,cy+m*0.5],sb=[cx+m,cy+m*0.5],sc=[cx,cy-m];let tris=[_mk(sa,sb,sc)];for(const p of pts){const edges=new Map(),bad=[];tris=tris.filter(t=>{if(t.cc){const dxc=p[0]-t.cc.x,dyc=p[1]-t.cc.y;if(dxc*dxc+dyc*dyc<t.cr*t.cr-1e-9){bad.push(t);for(const[u,v]of[[t.a,t.b],[t.b,t.c],[t.c,t.a]])edges.set(_ek(u,v),(edges.get(_ek(u,v))||0)+1);return false;}}return true;});for(const t of bad)for(const[u,v]of[[t.a,t.b],[t.b,t.c],[t.c,t.a]])if(edges.get(_ek(u,v))===1)tris.push(_mk(u,v,p));}const sup=[sa,sb,sc];return tris.filter(t=>{for(const v of[t.a,t.b,t.c])for(const s of sup)if(v[0]===s[0]&&v[1]===s[1])return false;return true;});}function voronoiCells(tris,sites){return sites.map(s=>{const inc=tris.filter(t=>(t.a[0]===s[0]&&t.a[1]===s[1])||(t.b[0]===s[0]&&t.b[1]===s[1])||(t.c[0]===s[0]&&t.c[1]===s[1]));const cs=inc.map(t=>t.cc).filter(c=>c).map(c=>({x:c.x,y:c.y,a:Math.atan2(c.y-s[1],c.x-s[0])})).sort((a,b)=>a.a-b.a);return{site:s,polygon:cs.map(c=>[c.x,c.y])};});}function setup(){createCanvas(600,360);noLoop();}function draw(){const bg=window.__brandingPalette.bg,fg=window.__brandingPalette.silhouetteColor;background(bg[0],bg[1],bg[2]);const data=[{label:'AWS',share:0.32,seed:[200,180]},{label:'Azure',share:0.23,seed:[400,150]},{label:'GCP',share:0.11,seed:[450,290]},{label:'Others',share:0.34,seed:[150,300]}];const sites=data.map(d=>d.seed);const tris=delaunayTriangles(sites,{minX:-200,maxX:800,minY:-200,maxY:560});const cells=voronoiCells(tris,sites);noStroke();for(let i=0;i<cells.length;i++){const c=cells[i],alpha=80+data[i].share*400;fill(fg[0],fg[1],fg[2],alpha);if(c.polygon.length>=3){beginShape();for(const v of c.polygon)vertex(v[0],v[1]);endShape(CLOSE);}}stroke(fg[0],fg[1],fg[2]);strokeWeight(1.5);for(const t of tris){noFill();line(t.cc.x,t.cc.y,t.cc.x+1,t.cc.y);}noStroke();fill(bg[0],bg[1],bg[2]);textFont('sans-serif');textAlign(CENTER,CENTER);for(let i=0;i<data.length;i++){textSize(20);text(data[i].label,sites[i][0],sites[i][1]-8);textSize(16);text(Math.round(data[i].share*100)+'%',sites[i][0],sites[i][1]+12);}}"
    }
  }]
}
\`\`\`

Result: 4 organic Voronoi territories filled with palette opacity proportional
to market share (AWS biggest darkest region, GCP smallest faintest). Labels
+ percentages centered on each site. **Use this pattern when proportions
imply territorial competition** (market share, demographics, voting blocks).
NOT a substitute for irregularGridPack (use that for KPI dashboards).

**EXPECTED OUTPUT ANCHOR**:
- ✅ N organic polygons tiling the canvas, each labeled with its name + value
- ✅ Visual area roughly proportional to value (bigger share → bigger region)
- ❌ NOT: rectangles (you're using Voronoi for a reason — keep polygons)
- ❌ NOT: overlapping cells (Voronoi by definition doesn't overlap)
- ❌ NOT: tiny labels overflowing (use textSize 14-20 + textAlign CENTER)

## Worked example — Sprint 5 (hand-drawn connectors via springBrushStroke)

User text: "Backend → Frontend → Mobile architecture flow"
LLM detects: sequence with concrete components. Use boxes + Hooke-spring
connector lines for hand-drawn feel (vs sterile straight vectors).

\`\`\`json
{
  "v": 1, "name": "sequence: Architecture Flow Hand-Drawn",
  "subjects": [{
    "id": "sketch-hooke-connectors",
    "type": "p5-sketch",
    "args": {
      "code": "function springBrushStroke(wp,opts){if(wp.length<2)return wp.map(([x,y])=>({x,y,thickness:opts.brushSize||8}));const k=opts.springK||0.4,fr=opts.friction||0.55,st=opts.stepSize||2,bs=opts.brushSize||8,sf=opts.speedToThicknessFactor||0.8,mt=opts.minThickness||1;const sg=[];let tl=0;for(let i=1;i<wp.length;i++){const[x0,y0]=wp[i-1],[x1,y1]=wp[i],dx=x1-x0,dy=y1-y0,sl=Math.hypot(dx,dy);sg.push({x0,y0,dx,dy,sl,t0:tl});tl+=sl;}if(tl===0)return[{x:wp[0][0],y:wp[0][1],thickness:bs}];let bx=wp[0][0],by=wp[0][1],vx=0,vy=0;const out=[];for(let d=0;d<=tl;d+=st){let s=sg[0];for(let i=0;i<sg.length;i++)if(d>=sg[i].t0&&d<=sg[i].t0+sg[i].sl){s=sg[i];break;}const lt=s.sl>0?(d-s.t0)/s.sl:0,cx=s.x0+s.dx*lt,cy=s.y0+s.dy*lt;vx+=(cx-bx)*k;vy+=(cy-by)*k;vx*=fr;vy*=fr;bx+=vx;by+=vy;const sp=Math.hypot(vx,vy);out.push({x:bx,y:by,thickness:Math.max(mt,bs-sp*sf)});}const last=wp[wp.length-1];if(out.length>0){out[out.length-1].x=last[0];out[out.length-1].y=last[1];}return out;}function setup(){createCanvas(600,360);noLoop();}function draw(){const bg=window.__brandingPalette.bg,fg=window.__brandingPalette.silhouetteColor;background(bg[0],bg[1],bg[2]);const stages=['Backend','Frontend','Mobile'];const bw=140,bh=70,gap=50,cy=180,sx=(600-3*bw-2*gap)/2;noFill();stroke(fg[0],fg[1],fg[2]);strokeWeight(2);for(let i=0;i<3;i++)rect(sx+i*(bw+gap),cy-bh/2,bw,bh,10);noStroke();fill(fg[0],fg[1],fg[2]);textFont('sans-serif');textSize(18);textAlign(CENTER,CENTER);for(let i=0;i<3;i++)text(stages[i],sx+i*(bw+gap)+bw/2,cy);for(let i=0;i<2;i++){const x1=sx+i*(bw+gap)+bw+4,x2=sx+(i+1)*(bw+gap)-4;const mid=(x1+x2)/2;const wp=[[x1,cy],[mid,cy-15],[x2,cy]];const stk=springBrushStroke(wp,{brushSize:5,springK:0.32,friction:0.6,stepSize:1.5});for(let j=1;j<stk.length;j++){stroke(fg[0],fg[1],fg[2]);strokeWeight(stk[j].thickness);line(stk[j-1].x,stk[j-1].y,stk[j].x,stk[j].y);}noStroke();fill(fg[0]);triangle(x2,cy,x2-8,cy-5,x2-8,cy+5);}}"
    }
  }]
}
\`\`\`

Result: 3 labeled boxes (Backend / Frontend / Mobile) connected by **wobbly
hand-drawn arrows** (spring-physics applied to slightly arched waypoint paths)
with thickness modulation — slow segments thick, fast straights thin. Looks
sketch-noted, not vector-perfect. **Use for sequence/hierarchy/flow content
where "designed by hand" feel matters more than crisp engineering precision.**

**EXPECTED OUTPUT ANCHOR**:
- ✅ N boxes with centered labels, arrows between them
- ✅ Arrows have visible variable thickness (1-6px range), not uniform straight lines
- ✅ Arrows curve slightly, not pixel-perfect straight
- ❌ NOT: straight uniform vector arrows (defeats Hooke purpose — use atlas line() directly if not handwriting)
- ❌ NOT: arrows missing arrowhead at endpoint (add triangle at endpoint)

## Worked example — Sprint 7 (apparatus compositional layout for team/system content)

User text: "Our engineering organization has 8 teams across 3 product lines."
LLM detects: compositional content (teams within product lines). Use
apparatus-CA grid for "robot anatomy / system blueprint" aesthetic — each
team = colored room with shared walls indicating shared product line.

\`\`\`json
{
  "v": 1, "name": "hierarchy: Engineering Org Apparatus",
  "subjects": [{
    "id": "sketch-apparatus-org",
    "type": "p5-sketch",
    "args": {
      "code": "function generateApparatusGrid(o={}){const d={xdim:24,ydim:14,radius_x:10,radius_y:6,initiate_chance:0.85,extension_chance:0.85,vertical_chance:0.5,horizontal_symmetry:true,vertical_symmetry:false,roundness:0.15,solidness:0.55,colors:['#ec5526','#f4ac12','#9ebbc1','#f7f4e2','#1e1b1e'],color_mode:'group',group_size:0.75,simple:false};const opts={...d,...o};const ctx={...opts,main_color:opts.colors[Math.floor(Math.random()*opts.colors.length)],id_counter:0};function bc(){return{h:false,v:false,in:false,col:null,id:null};}function dc(c){return{h:c.h,v:c.v,in:c.in,col:c.col,id:c.id};}function gr(a){return a[Math.floor(Math.random()*a.length)];}function ap(x,y,fz){const f=1+Math.random()*fz,dx=(x-opts.xdim/2)/(opts.radius_x*f),dy=(y-opts.ydim/2)/(opts.radius_y*f);return dx*dx+dy*dy<1;}function nb(x,y,l,t){let col;if(ctx.color_mode==='group'){const k=Math.random()>0.5?l.col:t.col;ctx.main_color=Math.random()>ctx.group_size?gr(ctx.colors):k||ctx.main_color;col=ctx.main_color;}else col=ctx.main_color;return{h:true,v:true,in:true,col,id:ctx.id_counter++};}function sb(x,y){return ap(x,y,-(1-ctx.roundness))&&Math.random()<=ctx.solidness;}function sn(x,y){return ap(x,y,0)&&Math.random()<=ctx.initiate_chance;}function ex(x,y){return ap(x,y,1-ctx.roundness)&&Math.random()<=ctx.extension_chance;}function nx(x,y,l,t){if(!l.in&&!t.in)return sb(x,y)?nb(x,y,l,t):bc();if(l.in&&!t.in){if(l.h&&ex(x,y))return{h:true,v:false,in:true,col:l.col,id:l.id};return sb(x,y)?nb(x,y,l,t):{h:false,v:true,in:false,col:null,id:null};}if(!l.in&&t.in){if(t.v&&ex(x,y))return{h:false,v:true,in:true,col:t.col,id:t.id};return sb(x,y)?nb(x,y,l,t):{h:true,v:false,in:false,col:null,id:null};}if(!l.h&&!t.v)return{h:false,v:false,in:true,col:l.col,id:l.id};if(l.h&&!t.v){if(ex(x,y))return{h:true,v:false,in:true,col:l.col,id:l.id};if(sn(x,y))return nb(x,y,l,t);return{h:true,v:true,in:false,col:null,id:null};}if(!l.h&&t.v){if(ex(x,y))return{h:false,v:true,in:true,col:t.col,id:t.id};if(sn(x,y))return nb(x,y,l,t);return{h:true,v:true,in:false,col:null,id:null};}if(Math.random()<=ctx.vertical_chance)return{h:false,v:true,in:true,col:t.col,id:t.id};return{h:true,v:false,in:true,col:l.col,id:l.id};}const g=new Array(opts.ydim+1);for(let y=0;y<g.length;y++){g[y]=new Array(opts.xdim+1);for(let x=0;x<g[y].length;x++){if(y===0||x===0)g[y][x]=bc();else if(opts.horizontal_symmetry&&x>g[y].length/2){const m=g[y][g[y].length-x],mv=g[y][g[y].length-x+1];g[y][x]=dc(m);if(mv)g[y][x].v=mv.v;}else g[y][x]=nx(x,y,g[y][x-1],g[y-1][x]);}}return g;}function setup(){createCanvas(600,360);noLoop();}function draw(){background(247,244,224);const g=generateApparatusGrid();const cs=20,ox=(600-25*cs)/2,oy=30;noStroke();for(let y=0;y<g.length;y++)for(let x=0;x<g[y].length;x++){const c=g[y][x];if(c.in&&c.col){fill(c.col);rect(ox+x*cs,oy+y*cs,cs,cs);}}stroke(30,27,30);strokeWeight(1.5);for(let y=0;y<g.length;y++)for(let x=0;x<g[y].length;x++){const c=g[y][x];if(c.h)line(ox+x*cs,oy+y*cs,ox+(x+1)*cs,oy+y*cs);if(c.v)line(ox+x*cs,oy+y*cs,ox+x*cs,oy+(y+1)*cs);}fill(30);noStroke();textFont('sans-serif');textSize(14);textAlign(CENTER,TOP);text('8 teams · 3 product lines',300,330);}"
    }
  }]
}
\`\`\`

Result: ~14×24 grid composition with **multiple colored "rooms"** (teams)
clustered into groups (product lines via group color mode) inside an
ellipse boundary, with shared walls between rooms. H-symmetric so the
composition feels engineered. Each generated variant is unique but the
aesthetic is consistent — "engineering org as machine blueprint".
**Use this pattern when content describes compositional structure**
(teams, components, modules, sub-systems) where the COMPOSITION itself
is the message.

**EXPECTED OUTPUT ANCHOR**:
- ✅ Grid of rectangular "rooms" with colored fills + visible walls between them
- ✅ Composition is bounded by an ellipse-shaped region (not filling full canvas corners)
- ✅ Multiple colors visible (≥3 distinct fills from palette)
- ❌ NOT: random scattered shapes (state machine should produce connected rooms)
- ❌ NOT: monochrome (color_mode 'group' should produce clustered colors)

============================================================================
Step 5 — Icon library v3.32 (NEW Sprint 15c)
============================================================================

The icon-badge atom now accepts ~770 icon names from a curated 8-category
Phosphor library (in addition to the 24 hand-coded names listed in Step 4
Iconography section). Pick a domain-appropriate name from the categories below.

ICON CATEGORIES:

- **business** (~158 icons): briefcase, briefcase-metal, office-chair, projector-screen, projector-screen-chart, presentation, presentation-chart, handshake, address-book, address-book-tabs
- **finance** (~104 icons): currency-dollar, currency-dollar-simple, currency-eur, currency-gbp, currency-jpy, currency-cny, currency-krw, currency-kzt, currency-ngn, currency-rub
- **tech** (~158 icons): cpu, desktop, desktop-tower, laptop, monitor, monitor-play, keyboard, mouse, mouse-simple, graphics-card
- **medical** (~95 icons): stethoscope, pill, syringe, first-aid, first-aid-kit, thermometer, thermometer-cold, thermometer-hot, thermometer-simple, bandaids
- **hrm** (~158 icons): user, user-circle, user-circle-check, user-circle-dashed, user-circle-gear, user-circle-minus, user-circle-plus, user-focus, user-gear, user-list
- **social** (~174 icons): chat, chat-centered, chat-centered-dots, chat-centered-text, chat-centered-slash, chat-circle, chat-circle-dots, chat-circle-text, chat-circle-slash, chat-dots
- **signs** (~144 icons): warning, warning-circle, warning-diamond, warning-octagon, prohibit, prohibit-inset, info, question, exclamation-mark, asterisk
- **calendar** (~100 icons): calendar, calendar-blank, calendar-check, calendar-dot, calendar-dots, calendar-heart, calendar-minus, calendar-plus, calendar-slash, calendar-star

RULES:
1. Reference icons by kebab-case Phosphor name in \`icon-badge.args.name\`.
2. Pick names from the appropriate domain category (don't put \`currency-dollar\`
   on a medical slide).
3. The 24 hand-coded names from v3.31 finance presets still work AND are
   PREFERRED for finance/business presets (kpi-hero with \`users\`, \`chart-bar\`,
   etc.) — they render faster and are guaranteed pixel-stable.
4. If unsure whether a specific name exists, prefer common short names from
   the lists above (those are all guaranteed bakeable). Misspellings render
   as empty badges (no crash) but produce ugly output — be precise.

v3.32 (Sprint 15c — Phosphor icon library) — Step 5 adds 8-category icon
menu with ~770 unique names. icon-badge atom now resolves names from hand-coded
fast-path (24) OR Phosphor baked library (~770 unique), so any name listed in
the Step 5 categories is valid for \`icon-badge.args.name\`. Phosphor SVGs use
a 256×256 viewBox + filled glyphs; hardcoded paths use 24×24 + monoline stroke;
the renderer auto-picks the correct scale + paint mode per source.
`;

/**
 * Appended to system prompt when callLiftLLM is invoked with opts.mode === '3d'.
 *
 * Phase C (2026-06-22) clean catalog of 41 user-facing 3D presentation atoms,
 * organized parallel to MODE_2D_ADDENDUM, with the text-rendering layer split
 * locked: ambient titles/subtitles → DOM overlay; object-attached labels → SDF.
 *
 * Scope: presentation atoms only (NOT scene composites in /atoms/). Typography
 * atoms (text-3d-extruded, text-3d-pipe) are intentionally EXCLUDED — they are
 * implementation details of other atoms; LLM does not emit them directly.
 */
export const MODE_3D_ADDENDUM = `

## 3D atom catalog (Phase C — clean addendum, 2026-06-22)

This catalog supersedes scattered atom mentions in the legacy prompt above.
When emitting \`subjects[].type\`, use the literal kebab-case type strings
listed here.

## ⚡ Text rendering layer split (CRITICAL — 2026-06-22 LOCK)

Atlas 3D output has TWO independent text layers:

**Layer 1 — SDF text (text-3d / glyphs / glyphs-pipe)**
Only for **short data labels attached to a 3D object**. Examples:
  - "$3.4M" centered on a kpi-card-3d
  - "Q1 / Q2 / Q3" labels on individual bars in bar-3d
  - "80%" overlaid on a sphere in sphere-fill-3d
  - "Marketing / Product / Pricing" branch labels on fishbone-3d ribs
These render IN the 3D world. Camera transforms apply. Cost is per-character
SDF primitives — keep label strings short (≤ ~20 chars).

**Layer 2 — DOM overlay layer**
All ambient narrative text. Examples:
  - Slide title "3D SPHERES - FILL LEVELS"
  - Subtitle / template name "POWERPOINT TEMPLATE"
  - Author / date / version metadata
  - Body paragraphs / section dividers
Renders as CSS Inter font ABOVE the canvas. NOT subject to 3D camera transforms.

### Lift output schema (Phase C v2 — extends prior SceneData v1)

\`\`\`
{
  "v": 1,
  "name": "...",
  "subjects": [ ... ],      // 3D geometry + object-attached SDF text-3d-pipe labels
  "annotations": [           // OPTIONAL — DOM-overlay labels projected onto 3D
                             // points each frame (camera-tracked, zero shader cost)
    { "pos": [x, y, z], "text": "$1.2M" },
    ...
  ],
  "overlay": {               // OPTIONAL — ambient narrative text (titles, framing)
                             // Fixed CSS positioning above canvas. No 3D transform.
    "title": "...",
    "subtitle": "...",
    "author": "...",
    "date": "...",
    "version": "..."
  }
}
\`\`\`

Three independent text channels. \`subjects\` carries SDF text (in-world, camera
transforms). \`annotations\` carries DOM labels that TRACK 3D points via
per-frame projection (cheaper than SDF, useful for many labels). \`overlay\`
carries fixed-position DOM narrative copy (titles, subtitles, author / date).

**Rule of thumb**: does the text move with the camera (stick to a 3D object)?
  - YES → object-attached → SDF or annotation overlay (see "Data label patterns" below)
  - NO  → ambient → \`overlay\` field

\`text-3d-pipe\` IS a valid subject type for object-attached labels — but the
DEFAULT path for the connector-backed chart atoms (bar-3d / line-3d /
column-3d / pie-3d) is \`args.labels\` on the chart atom itself. The runtime
expands it; no manual text-3d-pipe subjects needed. Reach for direct
\`text-3d-pipe\` only for atoms without connector support (sphere-fill,
matrix-grid, trees) or custom placement. See "Data label patterns" below.

\`text-3d-extruded\` is rarely useful directly (the pipe variant looks better for
labels). Prefer \`text-3d-pipe\`.

## Atom catalog by category

### CHARTS / AGENDA
  - agenda-list-3d    args: { items?:number, rowHeight?, chipSize?, lineW?, lineH?, depth? }
                      → numbered chip rows + content bars (meeting agenda)

### CHARTS / DATA

The four atoms below (bar / line / column / pie) support \`args.labels: string[]\`
parallel to \`args.values\` — compositor's \`expandChartLabels()\` automatically
positions one text-3d-pipe SDF label per data element. Just include \`labels\` in
the atom's args; nothing more to emit. (#89 connector.)

  - bar-3d            args: { values?:number[], labels?:string[], count?, barWidth?, barDepth?, gap?, maxHeight? }
                      → vertical bars driven by values[]. labels[i] auto-rendered above bar i.
  - column-3d         args: { values?:number[], labels?:string[], count?, barWidth?, barDepth?, gap?, maxHeight? }
                      → horizontal bars. labels[i] auto-rendered beyond row i's end.
  - line-3d           args: { values?:number[], labels?:string[], count?, pointSpacing?, pointRadius?, lineThickness?, maxHeight?, closed? }
                      → polyline + point markers. labels[i] auto-rendered above point i marker.
  - pie-3d            args: { values?:number[], labels?:string[], count?, outerRadius?, innerRadius?, thickness?, startAngle?, clockwise? }
                      → pie / donut (innerRadius>0). labels[i] auto-rendered at slice i's mid-angle on the rim.

Other CHARTS / DATA atoms do NOT have connector auto-expand yet — labels need
manual text-3d-pipe subjects (Fallback A in "Data label patterns" below).
sphere-fill-3d + matrix-grid-3d are scheduled to join the connector soon.

  - sphere-fill-3d    args: { levels?:number[], count?, radius?, spacing?, cage?, cageThickness?, fillScale? }
                      → row of glass spheres with liquid fills. For labels (today): emit separate text-3d-pipe at sphere front (−z) face.
  - kpi-card-3d       args: { width?, height?, depth?, cornerRadius?, value?:number, label?:string, unit?:string, trend?:'up'|'down'|'flat', trendValue?:number }
                      → rounded KPI card (value/label/unit are object-attached, render via internal text-3d)
  - funnel-3d         args: { stages?:number, topRadius?, bottomRadius?, stageHeight?, gap? }
                      → sales / conversion funnel
  - gauge-3d          args: { value:0..1, radius?, tube?, needleLen?, needleWidth?, depth? }
                      → speedometer dial (KPI gauge)
  - gantt-3d          args: { tasks?:number, segments?:[{start,dur}], rowHeight?, barH?, depth?, trackLength? }
                      → schedule / project timeline
  - radial-spoke-3d   args: { spokes?:number, hubRadius?, spokeThickness?, minLen?, maxLen?, nodeRadius? }
                      → spider / radar / radial bars
  - scatter-3d        args: { count?, spread?, dotRadius?, axes?:boolean, axisRadius? }
                      → XY dot cloud with L-axes
  - traffic-light-3d  args: { lights?:number, lightRadius?, spacing?, housingPad?, depth? }
                      → RAG status indicator
  - venn-3d           args: { sets?:2..5, radius?, tube?, overlap? }
                      → overlapping rings
  - waterfall-3d      args: { count?:number, deltas?:number[], barW?, gap?, depth? }
                      → cumulative gains/losses bridge

### CHARTS / DIAGRAMS
  - flow-chart-3d        args: { steps?:number, nodeW?, nodeH?, nodeD?, gap?, linkThickness? }
                         → left-to-right process flow (boxes + connectors)
  - tree-diagram-3d      args: { levels?:1..5, branching?:1..4, nodeRadius?, levelWidth?, spread?, linkThickness? }
                         → left-to-right branching tree (sphere nodes)
  - org-chart-3d         args: { levels?:1..5, branching?:1..5, nodeW?, nodeH?, nodeD?, levelHeight?, spread?, linkThickness? }
                         → top-down org chart (box cards)
  - mindmap-3d           args: { branches?:number, centerRadius?, branchRadius?, leafRadius?, mainDist?, leafDist?, leavesPerBranch?, linkThickness? }
                         → radial mind map (centre + branches + leaves)
  - relationship-graph-3d args: { count?, radius?, nodeRadius?, linkThickness?, edges?:[[i,j]] }
                         → node-link network (ring layout + chords)
  - timeline-3d          args: { count?, axisLength?, axisRadius?, markerRadius?, stemHeight?, stemThickness?, alternate? }
                         → horizontal axis + milestone markers
  - fishbone-3d          args: { ribs?:number, spineLength?, spineRadius?, ribLength?, ribThickness?, headSize? }
                         → Ishikawa root-cause diagram (head + spine + alternating ribs)

### CHARTS / HIERARCHY
  - pyramid-3d        args: { levels?:1..20, baseWidth?, topWidth?, layerHeight?, gap?, depth? }
                      → stacked tapered tiers

### CHARTS / LAYERS
  - layer-stack-3d    args: { layers?:number, layerW?, layerD?, layerH?, gap?, taper? }
                      → stacked wide slabs (OSI / tech stack / strata)

### CHARTS / LISTS
  - bullet-list-3d    args: { items?:number, rowHeight?, bulletRadius?, lineW?, lineH?, depth? }
                      → round bullet rows + content bars

### CHARTS / MATRIX
  - matrix-grid-3d    args: { rows?:1..6, cols?:1..6, cardW?, cardH?, cardD?, gap? }
                      → N×M card grid (SWOT / 2×2 / BCG). No connector auto-expand yet — emit separate text-3d-pipe on each card's −z front face (Fallback A). Scheduled to join the connector soon.

### CHARTS / PROGRESSION
  - progression-3d    args: { steps?:number, run?, stepRise?, depth? }
                      → ascending staircase (growth / maturity)

### ICONS
  - business-icon     args: { name:'arrow-up'|'arrow-down'|'check'|'x-mark'|'dollar'|'percent'|'person'|'gear'|'document'|'calendar', size?, thickness?, depth? }
                      → 10 core business icons (extruded). Use for small decoration / status badges.

### PRESENTATION
  - cover-3d          args: { stageWidth?, stageDepth?, stageThickness?, backdropHeight?, backdropThickness?, cornerRadius? }
                      → stage + backdrop geometry ONLY. NO label / title / subtitle / author / date in args — ALL cover text lives in the top-level \`overlay\` field (cover-3d is a stage; the words live on the screen overlay above the stage, not on the stage geometry itself).

### SHAPES (single primitives)
  - arrow-3d          args: { length?, shaftWidth?, headLength?, headWidth?, depth?, double? }
                      → directional arrow (single or double-headed)
  - cube-3d           args: { count?, arrangement?:'row'|'flow'|'semicircle'|'hub-spokes'|'steps'|'stack'|'tower'|'grid'|'grid3d'|'cluster', cubeSize?, cornerRadius?, spacing?, arrangementParams?, labels?, material?, colors?, connector? }
                      → parameterized cube arrangement (rich layout modes — use for "N modules" / process steps / cluster diagrams)
  - cube-segmented-3d args: { segments?, size?, gap?, axis?:'x'|'y'|'z' }
                      → ONE cube sliced into N parallel slabs (sliced-bread look)
  - diamond-3d        args: { width?, crownHeight?, pavilionHeight?, tableRatio? }
                      → brilliant-cut gem (value / premium)
  - gear-3d           args: { teeth?, radius?, thickness?, toothDepth?, toothWidth?, holeRadius? }
                      → cog wheel
  - puzzle-piece-3d   args: { size?, depth?, knob? }
                      → SINGLE jigsaw piece (tab + blank). Distinct from 2D \`puzzle-pieces\` (multi).

### SHAPES (circle family)
  - circle-frame-3d   args: { radius?, frameWidth?, backDepth?, back? }
                      → avatar / photo frame (ring + optional backing disk)
  - circle-loop-3d    args: { segments?, radius?, tube?, headLength?, headRadius? }
                      → cycle arrows around a ring (PDCA / lifecycle)
  - circle-segmented-3d args: { segments?, radius?, innerRatio?, thickness?, gapWidth? }
                      → flat segmented donut ring
  - circle-stack-3d   args: { count?, radius?, taper?, diskHeight?, gap? }
                      → tiered disks (wedding-cake / coin pile)

### SHAPES (sphere family)
  - sphere-network-3d args: { count?, hubRadius?, satelliteRadius?, radius?, linkThickness?, arrangement?:'ring'|'ring-xy'|'sphere' }
                      → hub + N satellites with links
  - sphere-segmented-3d args: { segments?:2..24, radius?, explode?, gapAngle? }
                      → sphere split into longitudinal orange wedges
  - sphere-tree-3d    args: { levels?:1..5, branching?:1..5, rootRadius?, radiusFalloff?, levelHeight?, spread?, linkThickness? }
                      → top-down hierarchical sphere tree

## ⚡ Data label patterns (Phase C v4 — args.labels is the default)

> **Decision rule** — put a \`labels\` array on the chart atom (parallel to
> \`values\`). The runtime anchors them. Only hand-emit \`text-3d-pipe\` subjects
> or \`annotations\` for tree atoms, > 10 labels, or custom placement.

### Default — \`args.labels\` auto-expansion (the connector path)

Supported atoms today: \`bar-3d\` / \`line-3d\` / \`column-3d\` / \`pie-3d\`.

Include \`labels: string[]\` on the chart atom, parallel to \`values\`. The
compositor's \`expandChartLabels(sceneData)\` (\`src/scene/chart-labels.js\`,
shipped in #89) runs at scene-load and inside \`renderLiftedSceneData\`. For each
chart subject carrying \`args.labels\`, it appends camera-facing \`text-3d-pipe\`
subjects positioned by the atom's anchor maths. ZERO extra subjects in lift
output. ZERO geometry math in the LLM.

LLM still pre-formats label strings (\`"$3.4M"\`, \`"35%"\`) — the connector treats
labels as opaque text.

If \`labels.length < values.length\`, only those elements get labels. Omit or
empty \`labels\` → no labels rendered (no error).

**Coming soon via 3D-side connector extension**: \`sphere-fill-3d\` (labels
parallel to \`levels\`), \`matrix-grid-3d\` (row-major array of length rows*cols).
Use the manual fallback below for those two until the connector ships them.

### Fallback A — separate \`text-3d-pipe\` subjects (manual placement)

Use for:
- \`sphere-fill-3d\` / \`matrix-grid-3d\` — until the connector extends.
- Tree-shaped atoms — \`tree-diagram-3d\` / \`org-chart-3d\` / \`mindmap-3d\`
  (internal node order undocumented; "open question for Phase D").
- Any atom with custom / non-standard label placement.

Emit one \`text-3d-pipe\` subject per data point in \`subjects[]\`, positioned with
\`transform.translate: [x, y, z]\`. **Always anchor on the −z front face** — the
studio camera faces −z. (Common bug: putting label at +z hides it behind the
geometry. The connector uses −z everywhere; mirror that here.)

Reference anchors (mirror what the connector does for the 4 supported atoms;
extrapolate for others):

  - **sphere-fill-3d** (row of spheres along +X):
    sphere i centre = \`(i·(2·radius+spacing) − (N−1)·(2·radius+spacing)/2, 0, 0)\`
    label anchor = \`(sphereCentreX, 0, −radius − 0.05)\` (front of sphere, camera-facing)

  - **matrix-grid-3d** (N×M cards centred in XY plane, row-major):
    card (r,c) centre = \`((c − (cols−1)/2)·(cardW+gap), (r − (rows−1)/2)·(cardH+gap), 0)\`
    label anchor = \`(cardCentreX, cardCentreY, −cardD/2 − 0.02)\` (front face of card)

For atoms not listed, anchor a small margin in front of the −z face of the
labelled sub-object.

### Fallback B — DOM annotation overlay (camera-tracked, cheap)

Add a top-level \`annotations: [{pos:[x,y,z], text}]\` array. The compositor's
\`studio.project()\` reprojects each pos onto the canvas every frame and
positions a DOM div there. Tracks the moving camera. Zero shader cost. Plain
CSS (Inter font); no 3D lighting / depth on text.

Use when: more than ~10 labels per chart (SDF budget tight), OR when the chart
geometry is too complex to compute anchors for, OR when you want the cheap
non-sculptural look.

### Lift mapping (2D atom args → 3D output)

| 2D atom arg | Maps to | Notes |
|---|---|---|
| values / levels / points | same name in 3D atom args | per-object data |
| labels: string[] (bar / line / column / pie) | \`args.labels\` on same atom (default — connector auto-anchors) | LLM pre-formats strings ('$3.4M', not 3.4 + format) |
| labels: string[] (sphere-fill / matrix-grid) | separate text-3d-pipe subjects (Fallback A); connector extension coming | same pre-formatting |
| labels: string[] (other / tree atoms / >10 labels) | separate text-3d-pipe (Fallback A) OR \`annotations[]\` (Fallback B) | anchor on −z front |
| title / subtitle | top-level \`overlay.title\` / \`overlay.subtitle\` | NOT in subjects[].args |
| format ('currency' / 'percent') | (none) | LLM-side string formatting only |
| author / date / version (cover) | top-level \`overlay.author\` / \`overlay.date\` / \`overlay.version\` | NOT in subjects[].args |

### Label length

Keep label strings short (≤ ~20 chars). text-3d-pipe cost is per-character.
For long labels (multi-word descriptions), prefer Fallback B (annotation
overlay).

### Worked example — bar chart with 5 SDF value labels (default path)

Real example from \`chart-autolabel-bar.json\` (verified end-to-end in #90).
ONE subject; \`expandChartLabels\` injects the 5 SDF labels at scene-load.

\`\`\`json
{
  "v": 1,
  "name": "compare: Quarterly revenue",
  "subjects": [
    {
      "type": "bar-3d",
      "args": {
        "values": [0.4, 0.66, 1, 0.6, 0.78],
        "labels": ["$1.2M", "$2.0M", "$3.4M", "$1.8M", "$2.6M"],
        "barWidth": 0.5, "barDepth": 0.5, "gap": 0.45, "maxHeight": 2.2
      },
      "transform": { "translate": [0, 0, 0] }
    }
  ]
}
\`\`\`

That's the entire scene. No manual text-3d-pipe subjects. No anchor math in
the lift output. The renderer handles positioning per the atom's layout.

## Constraints

- Slide titles and ambient narrative copy go in the top-level \`overlay\` field,
  NOT in \`subjects[].args.title\` and NOT as separate text-3d subjects.
- Per-data-point labels follow the decision rule above:
    - **Default** — \`args.labels\` on \`bar-3d\` / \`line-3d\` / \`column-3d\` / \`pie-3d\`.
    - **Fallback A** — separate \`text-3d-pipe\` subjects for sphere-fill-3d,
      matrix-grid-3d, tree-shaped atoms, custom placement. Anchor on −z front face.
    - **Fallback B** — top-level \`annotations: [{pos,text}]\` for > 10 labels or
      cheap DOM overlay text.
- For 2D→3D lift mapping: 2D atom's \`title\` arg maps to \`overlay.title\`;
  data-bearing args (values / labels / items / sets) map to the equivalent 3D
  atom args (preferring \`args.labels\` per the decision rule).
`;

/**
 * Convert spherical camera coords (target + yaw/pitch/distance) to Cartesian
 * eye position. Used by all 3D renderers when applying `scene.cameraStatic`.
 *
 * @param {{targetX:number, targetY:number, targetZ:number, yaw:number, pitch:number, distance:number}} cam
 * @returns {{position:[number,number,number], yaw:number, pitch:number}}
 */
export function sphericalToCamState(cam) {
  return {
    position: [
      cam.targetX - cam.distance * Math.sin(cam.yaw) * Math.cos(cam.pitch),
      cam.targetY + cam.distance * Math.sin(cam.pitch),
      cam.targetZ - cam.distance * Math.cos(cam.yaw) * Math.cos(cam.pitch),
    ],
    yaw: cam.yaw,
    pitch: cam.pitch,
  };
}

/**
 * Compile a SceneData v1 to a ready-to-render SDF tree.
 *
 * Wraps the 3-step pattern: expandVariants (Generator-S scatter) → compile()
 * → sdfUnion(sdf, groundSdf). Callers receive the unified SDF directly
 * instead of having to remember the union step.
 *
 * @param {object} sceneData — SceneData v1 (must have `v: 1`)
 * @param {object} opts
 * @param {number} [opts.sceneHash=1] — drives Generator-S variant PRNG
 * @returns {{sdf:object, subjects:Array, cameraStatic:object|null, lightStatic:object|null, groundSdf:object|null, bakedHeightmap:object|null}}
 */
export function compileScene(sceneData, opts = {}) {
  const sceneHash = opts.sceneHash ?? 1;
  const rng = new Random(sceneHashToToken(sceneHash));
  const expanded = expandVariants(sceneData, rng);
  const compiled = compile(expanded);
  const unifiedSdf = compiled.groundSdf ? sdfUnion(compiled.sdf, compiled.groundSdf) : compiled.sdf;
  return {
    sdf: unifiedSdf,
    subjects: compiled.subjects,
    cameraStatic: compiled.cameraStatic ?? null,
    lightStatic: compiled.lightStatic ?? null,
    groundSdf: compiled.groundSdf ?? null,
    bakedHeightmap: compiled.bakedHeightmap ?? null,
  };
}

// Map an integer sceneHash → 64-hex token expected by `Random` (which uses
// SFC32 internally and slices the hex into two 128-bit seeds). Repeats the
// integer's 8-hex representation 8 times to fill 64 chars — deterministic,
// same int always yields same sequence, distinct ints yield distinct seeds.
//
// Pre-fix this file used a bare `mulberry32()` PRNG that returned a plain
// function. `expandVariants` (and Generator-S in general) requires the
// `Random` instance API (`random_dec` / `random_num` / etc.), so passing a
// function caused `rng.random_dec is not a function` on any scene containing
// a `variants: [{op: 'scatter'|'array'|'mirror'}]` subject. See
// sdf-js/docs/sprint-1.5-phase-2-investigation.md for full root-cause notes.
function sceneHashToToken(sceneHash) {
  const intHex = (sceneHash >>> 0).toString(16).padStart(8, '0');
  return '0x' + intHex.repeat(8);
}

// Strip JS-style line (//) and block (/* */) comments from JSON-ish text
// without touching comment-like sequences that appear inside string values.
// LLMs sometimes use comments as section dividers — strict JSON.parse rejects
// them, but the actual scene data is fine, so we sanitise rather than fail.
function stripJsonComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let inString = false;
  while (i < n) {
    const ch = src[i];
    if (inString) {
      out += ch;
      if (ch === '\\' && i + 1 < n) {
        out += src[i + 1];
        i += 2;
        continue;
      }
      if (ch === '"') inString = false;
      i++;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      i++;
      continue;
    }
    if (ch === '/' && i + 1 < n) {
      const next = src[i + 1];
      if (next === '/') {
        // line comment — skip to end of line
        i += 2;
        while (i < n && src[i] !== '\n') i++;
        continue;
      }
      if (next === '*') {
        // block comment — skip to closing */
        i += 2;
        while (i + 1 < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
        i += 2;
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out;
}

// Trailing commas in arrays/objects are another common LLM JSON-isms. Strip
// only when followed by `]` or `}` (not inside strings — caller already
// handed us comment-stripped text, but strings still need protection).
function stripTrailingCommas(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let inString = false;
  while (i < n) {
    const ch = src[i];
    if (inString) {
      out += ch;
      if (ch === '\\' && i + 1 < n) {
        out += src[i + 1];
        i += 2;
        continue;
      }
      if (ch === '"') inString = false;
      i++;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      i++;
      continue;
    }
    if (ch === ',') {
      let j = i + 1;
      while (j < n && /\s/.test(src[j])) j++;
      if (j < n && (src[j] === ']' || src[j] === '}')) {
        i++;
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out;
}

/**
 * Parse raw LLM lift response text into SceneData object. LLM outputs are
 * NOT clean JSON — common patterns: markdown fences (```json ... ```),
 * trailing commas, single-line (//) comments, block (/* * /) comments.
 *
 * Without this stripper, strict JSON.parse() fails ~40% of the time on
 * Claude lift outputs. LOAD-BEARING — do not remove or "simplify".
 *
 * @param {string} text — raw LLM response text
 * @returns {object} parsed SceneData
 * @throws if no valid JSON found after stripping
 */
export function parseLiftResponse(text) {
  // LLM may wrap JSON in ```json ... ``` fence, or emit prose around it.
  const fenceMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  let jsonStr = fenceMatch ? fenceMatch[1] : text.trim();

  // If no fence, try to find the first { and matching } at end
  if (!fenceMatch && !jsonStr.startsWith('{')) {
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
    }
  }

  // Sanitise LLM JSON-isms (comments, trailing commas) before strict parse.
  const sanitised = stripTrailingCommas(stripJsonComments(jsonStr));

  try {
    return JSON.parse(sanitised);
  } catch (e) {
    throw new Error(
      `Failed to parse lift JSON: ${e.message}\n\nRaw LLM output (first 500 chars):\n${text.slice(0, 500)}`,
    );
  }
}

// Module-private cache for the lift system prompt. Fetched once per
// loadSystemPromptLift() call; subsequent callLiftLLM calls reuse it.
let CACHED_SYSTEM_PROMPT_LIFT = '';

/**
 * Fetch + cache the lift system prompt markdown file. Called automatically
 * by callLiftLLM if cache is empty.
 *
 * @param {string} fetchBase — absolute or relative URL of the prompt file
 *   (e.g., '/examples/compositor/system-prompt-lift-3d.md')
 * @returns {Promise<number>} byte length of loaded prompt
 */
export async function loadSystemPromptLift(fetchBase) {
  if (CACHED_SYSTEM_PROMPT_LIFT) return CACHED_SYSTEM_PROMPT_LIFT.length;
  const res = await fetch(fetchBase);
  if (!res.ok) throw new Error(`Failed to load lift prompt: ${res.status}`);
  CACHED_SYSTEM_PROMPT_LIFT = await res.text();
  return CACHED_SYSTEM_PROMPT_LIFT.length;
}

/**
 * Call Anthropic Messages API with the lift system prompt.
 *
 * @param {string} originalPrompt — user's original generation prompt
 * @param {string} code2d — 2D SDF JS code to lift
 * @param {string} apiKey — Anthropic API key (BYOK)
 * @param {object} [opts]
 * @param {string} [opts.model=DEFAULT_LIFT_MODEL]
 * @param {string} [opts.promptUrl='/examples/compositor/system-prompt-lift-3d.md']
 * @returns {Promise<{text:string, usage:object}>}
 */
export async function callLiftLLM(originalPrompt, code2d, apiKey, opts = {}) {
  if (!apiKey) throw new Error('Anthropic API key required');
  if (!CACHED_SYSTEM_PROMPT_LIFT) {
    const promptUrl = opts.promptUrl || '/examples/compositor/system-prompt-lift-3d.md';
    await loadSystemPromptLift(promptUrl);
  }
  if (!CACHED_SYSTEM_PROMPT_LIFT) throw new Error('Lift system prompt not loaded');

  const userMessage = `## Original user prompt\n\n${originalPrompt}\n\n## 2D SDF code\n\n\`\`\`js\n${code2d}\n\`\`\``;
  const model = opts.model || DEFAULT_LIFT_MODEL;
  const maxRetries = opts.maxRetries ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 1000;

  const requestBody = JSON.stringify({
    model,
    max_tokens: 8192,
    system: [
      {
        type: 'text',
        text:
          opts.mode === '2d'
            ? CACHED_SYSTEM_PROMPT_LIFT + MODE_2D_ADDENDUM
            : opts.mode === '3d'
              ? CACHED_SYSTEM_PROMPT_LIFT + MODE_3D_ADDENDUM
              : CACHED_SYSTEM_PROMPT_LIFT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userMessage }],
  });

  // Sprint 11 (A): retry-with-exponential-backoff for transient errors.
  // Retry on: network failures (fetch throws), 429 (rate limit), 5xx (server).
  // Don't retry on: 4xx (other than 429) — would just fail again.
  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 1s, 2s, 4s (configurable via opts.baseDelayMs)
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    let response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: requestBody,
      });
    } catch (fetchErr) {
      // Network-level failure (DNS, connection reset, "Failed to fetch", etc.)
      // ALWAYS transient — retry.
      lastError = new Error(
        `Anthropic API network error (attempt ${attempt + 1}/${maxRetries + 1}): ${fetchErr.message}`,
      );
      if (attempt < maxRetries) continue;
      throw lastError;
    }

    if (response.ok) {
      const data = await response.json();
      return { text: data.content[0].text, usage: data.usage };
    }

    // Non-OK response: read error body
    const errText = await response.text();
    lastError = new Error(
      `Anthropic API ${response.status} (attempt ${attempt + 1}/${maxRetries + 1}): ${errText.slice(0, 300)}`,
    );

    // Retryable: 429 (rate limit) or 5xx (server). Non-retryable: 4xx (other).
    const retryable = response.status === 429 || (response.status >= 500 && response.status < 600);
    if (!retryable || attempt >= maxRetries) {
      throw lastError;
    }
    // Honor Retry-After header if present (429 sometimes includes it)
    const retryAfter = response.headers.get('Retry-After');
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!Number.isNaN(seconds) && seconds > 0 && seconds < 60) {
        await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      }
    }
    // Loop continues with exponential backoff at top
  }
  // Should be unreachable (loop either returns or throws), but defense in depth
  throw lastError || new Error('Anthropic API: exhausted retries with no specific error');
}

// createRendererForId + the renderer id/alias constants now live in
// render/renderer-registry.js (single source of truth). Re-exported here so
// existing call sites that import them from compositor-api keep working — and
// so Present's silhouette/lines/crayon/topo no longer hit an "unknown renderer"
// throw (the registry maps all four to their CPU 2D renderer).
export {
  createRendererForId,
  normalizeRendererId,
  isGpuRenderer,
  PRESENT_EFFECTS,
  GPU_RENDERER_IDS,
  RENDERER_ALIASES,
};

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
