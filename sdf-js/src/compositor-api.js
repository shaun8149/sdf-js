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
import { createStudioRenderer } from './render/studio.js';
import { createFly3DRenderer } from './render/flyLambert.js';
import { silhouette } from './render/silhouette.js';
import { Random } from './util/random.js';

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

## Step 4: 2D-mode 3-priority routing (Sprint 3) — SDF FIRST, P5 fallback

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
- Use textFont('sans-serif') for any text. Use brandingPalette for fill/stroke
  to maintain visual consistency across renderer cycles.
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

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system: [
        {
          type: 'text',
          text:
            opts.mode === '2d'
              ? CACHED_SYSTEM_PROMPT_LIFT + MODE_2D_ADDENDUM
              : CACHED_SYSTEM_PROMPT_LIFT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  return { text: data.content[0].text, usage: data.usage };
}

/**
 * Create a renderer instance for the given renderer id. Returns an object
 * with `.render(sdf)` and `.unmount()` methods. Caller owns lifecycle.
 *
 * Sprint 1 supports: 'studio', 'fly3d', 'silhouette'. Sprint 2+ will add
 * 'bob-gpu', 'blueprint', 'crayon', 'topo', 'bob', 'lines'.
 *
 * @param {string} rendererId
 * @param {HTMLCanvasElement} canvas
 * @param {object} [opts]
 * @param {Function} [opts.getControls] — for GPU renderers; receives renderer time + returns camera/light state
 * @param {Function} [opts.onFps] — for GPU renderers; called per frame with FPS
 * @returns {{render:Function, unmount:Function}}
 */
export function createRendererForId(rendererId, canvas, opts = {}) {
  if (rendererId === 'silhouette') {
    return {
      render(layers, renderOpts = {}) {
        const ctx = canvas.getContext('2d');
        silhouette(ctx, layers, renderOpts);
      },
      unmount() {
        // No-op for CPU silhouette
      },
    };
  }
  if (rendererId === 'studio') {
    return createStudioRenderer({
      canvas,
      getControls: opts.getControls || (() => ({})),
      onFps: opts.onFps || (() => {}),
    });
  }
  if (rendererId === 'fly3d') {
    return createFly3DRenderer({
      canvas,
      getControls: opts.getControls || (() => ({})),
      onFps: opts.onFps || (() => {}),
    });
  }
  throw new Error(`[compositor-api] unknown renderer id: ${rendererId}`);
}

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
