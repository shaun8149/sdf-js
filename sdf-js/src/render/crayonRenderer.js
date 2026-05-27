// =============================================================================
// crayonRenderer — physics-pen stippled Canvas2D renderer (Atlas Sprint 12-3d)
// -----------------------------------------------------------------------------
// Inspired by Nathaniel Sarkissian's "Eucalyptus and Sagebrush" OpenProcessing
// sketch (https://openprocessing.org/sketch/2040291). Permission granted by
// author. Technique: a virtual "pen" follows a target-point path via simple
// physics; at each step it stamps N semi-transparent circles offset radially
// by sqrt(random()) — accumulating into a stippled crayon stroke. Many such
// scribbles overlaid build up the painterly image.
//
// Atlas integration:
//   - 4th renderer alongside FLY 3D / BOB GPU / Blueprint
//   - Canvas2D (separate canvas element from the WebGL c-gpu canvas)
//   - Reads compiled.sdf for raymarch + compiled.bakedHeightmap for terrain
//   - Hash-derived palette per token (Atlas Random/SFC32)
//   - Progressive animation (spawns N scribbles/frame, all run concurrently)
//
// Public API matches other renderers:
//   createCrayonRenderer({ canvas, getControls, onFps })
//     .render(sdf, compiled)  — kick off animation with new scene
//     .unmount()              — hide canvas + stop rAF
//     .canRender(sdf)         — always true (handles any SDF)
//     .setRuneHeightmap(baked)— receive terrain texture data
// =============================================================================

import { Random } from '../util/random.js';

// ---------------------------------------------------------------------------
// Small vec3 helpers (kept local to avoid pulling in three.js-style libs).
// ---------------------------------------------------------------------------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.sqrt(dot(a, a));
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// ---------------------------------------------------------------------------
// SketchyShape — physics pen base class. Subclasses populate `points` (target
// path) and `pen` (current position). update() advances physics one tick and
// stamps `density` semi-transparent circles around the pen with sqrt-radial
// distribution (Gaussian-ish falloff). Returns 'done' when pen reaches end.
// Exported so streamline/other future renderers can build on the same physics.
// ---------------------------------------------------------------------------
export class SketchyShape {
  constructor() {
    this.wt = 1;                          // stroke weight (max stamp radius)
    this.maxV = 3;                        // max pen velocity per tick
    this.acc = 0.005;                     // acceleration toward next target
    this.color = [0, 0, 0, 0.25];         // rgba, alpha low for layering
    this.density = 1;                     // stamps per tick
    this.wobble = 0;                      // random tangential noise
    this.angle = 0;                       // shape rotation (radians)
    this.x = 0; this.y = 0;
    this.points = [];                     // target path
    this.pen = [0, 0];                    // current pen pos (local to x,y,angle)
    this.penV = [0, 0];                   // pen velocity
    this.penTargetIndex = 0;
    this.lineLen = 0;
  }

  // ctx is a Canvas2D context. Returns 'done' when path complete.
  step(ctx, rng) {
    if (this.points == null || this.penTargetIndex >= this.points.length) return 'done';

    const target = this.points[this.penTargetIndex];
    // Accelerate toward target
    const ax = (target[0] - this.pen[0]) * this.acc;
    const ay = (target[1] - this.pen[1]) * this.acc;
    this.penV[0] += ax;
    this.penV[1] += ay;
    // Random-direction wobble (small tangential perturbation)
    if (this.wobble > 0) {
      const wa = rng() * Math.PI * 2;
      this.penV[0] += Math.cos(wa) * this.wobble;
      this.penV[1] += Math.sin(wa) * this.wobble;
    }
    // Drag
    this.penV[0] *= 0.8;
    this.penV[1] *= 0.8;
    // Clamp magnitude
    const vmag = Math.hypot(this.penV[0], this.penV[1]);
    if (vmag > this.maxV) {
      this.penV[0] *= this.maxV / vmag;
      this.penV[1] *= this.maxV / vmag;
    }
    this.lineLen += vmag;
    this.pen[0] += this.penV[0];
    this.pen[1] += this.penV[1];

    // Advance target if close enough
    const dx = target[0] - this.pen[0];
    const dy = target[1] - this.pen[1];
    if (dx * dx + dy * dy < 9) {
      this.penTargetIndex++;
      if (this.penTargetIndex >= this.points.length) return 'done';
    }

    // Stamp dots — sqrt(random) radial distribution × noise modulation × weight/2
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.angle) ctx.rotate(this.angle);
    const c = this.color;
    ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${c[3]})`;
    // Cheap noise: smooth sin chain along lineLen
    const noiseVal = 0.75 + 0.25 * Math.sin(this.lineLen * 0.07);
    for (let i = 0; i < this.density; i++) {
      const r = Math.sqrt(rng()) * noiseVal * this.wt * 0.5;
      const a = rng() * Math.PI * 2;
      const ox = Math.cos(a) * r;
      const oy = Math.sin(a) * r;
      ctx.beginPath();
      ctx.arc(this.pen[0] + ox, this.pen[1] + oy, 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return 'active';
  }
}

// ---------------------------------------------------------------------------
// SketchyEllipse — pen traces zig-zag horizontal lines across an ellipse
// (filling it). outline=true switches to perimeter trace.
// ---------------------------------------------------------------------------
class SketchyEllipse extends SketchyShape {
  constructor(cx, cy, rx, ry, hatchDensity, outline) {
    super();
    this.x = cx;
    this.y = cy;
    const pts = [];
    if (outline) {
      const n = Math.max(8, Math.round(rx / hatchDensity) * 8);
      for (let i = 0; i < n; i++) {
        const a = (i / (n - 1)) * Math.PI * 2;
        pts.push([rx * Math.cos(a), ry * Math.sin(a)]);
      }
    } else {
      const n = Math.max(2, Math.round(rx / hatchDensity));
      for (let i = 0; i < n; i++) {
        const x = -rx + (2 * rx * i) / Math.max(1, n - 1);
        const h = ry * Math.sqrt(Math.max(0, 1 - (x * x) / (rx * rx)));
        pts.push([x, h]);
        pts.push([x, -h]);
      }
    }
    this.points = pts;
    this.pen = [pts[0][0], pts[0][1]];
    this.penV = [0, 0];
    this.penTargetIndex = 1;
  }
}

// ---------------------------------------------------------------------------
// SketchyRectangle — port of Sarkissian's SketchyRect → SketchyQuad. Pen
// traces a zig-zag between the rectangle's TOP and BOTTOM edges (straight
// lines, NOT sqrt curve). Critical for thin shapes (trunks, branches): unlike
// SketchyEllipse where x=±rx forces ht=0, the rect has constant ±h/2 along
// each edge so even n=2 substeps trace the full vertical extent.
// w = full width, h = full height (NOT semi-axes).
// ---------------------------------------------------------------------------
class SketchyRectangle extends SketchyShape {
  constructor(cx, cy, w, h, hatchDensity) {
    super();
    this.x = cx;
    this.y = cy;
    // Corner layout (local, centered): top-left, top-right, bottom-right, bottom-left
    const halfW = w * 0.5, halfH = h * 0.5;
    const x1 = -halfW, y1 = -halfH;
    const x2 = +halfW, y2 = -halfH;
    const x3 = +halfW, y3 = +halfH;
    const x4 = -halfW, y4 = +halfH;
    // Step count along the WIDTH (top/bottom edges = d12 = d34 = w in
    // Sarkissian's SketchyQuad). Using h here was a bug — for a tall thin
    // trunk (h=200, w=0.5), it produced 1000 substeps × 2 = 2000 waypoints,
    // making each trunk take hundreds of thousands of pen ticks. The correct
    // count is just along the rect's short axis.
    const nSubSteps = Math.max(2, Math.round(w / Math.max(hatchDensity, 0.05)));
    const pts = [];
    for (let i = 0; i < nSubSteps; i++) {
      const m = i / Math.max(1, nSubSteps - 1);
      // Top-edge waypoint (lerp 1→2)
      let px = x1 + (x2 - x1) * m;
      let py = y1 + (y2 - y1) * m;
      // Small noise wobble (Sarkissian's noise(.08x, .08y)*TAU * 1px)
      const na1 = (Math.sin(px * 0.4 + py * 0.4) * 0.5 + 0.5) * Math.PI * 2;
      px += Math.cos(na1);
      py += Math.sin(na1);
      pts.push([px, py]);
      // Bottom-edge waypoint (lerp 4→3)
      let qx = x4 + (x3 - x4) * m;
      let qy = y4 + (y3 - y4) * m;
      const na2 = (Math.sin(qx * 0.4 + qy * 0.4) * 0.5 + 0.5) * Math.PI * 2;
      qx += Math.cos(na2);
      qy += Math.sin(na2);
      pts.push([qx, qy]);
    }
    this.points = pts;
    this.pen = [pts[0][0], pts[0][1]];
    this.penV = [0, 0];
    this.penTargetIndex = 1;
  }
}

// ---------------------------------------------------------------------------
// Hash-derived palette (S2=c decision). Produces:
//   paper: warm off-white background
//   stroke: 6 color slots ordered by "lightness rank" (used as gradient
//          indexed by Lambert lighting [0, 1])
//   tree:  3 deep colors for tree/vegetation accent
// All HSV-derived from rng so each tokenHash → distinct palette.
// ---------------------------------------------------------------------------
function hsv2rgb(h, s, v) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r, g, b;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// ---------------------------------------------------------------------------
// Curated palettes ported from Sarkissian's palettes.js (OpenProcessing
// sketch 2040291). The visual signature of "Eucalyptus and Sagebrush"
// depends heavily on these specific color choices — they are NOT random
// HSV — so we ship them verbatim. Hex → RGB.
// ---------------------------------------------------------------------------
const hex2rgb = (hex) => {
  const h = hex.replace('#', '');
  const v = h.length === 3
    ? h.split('').map(c => parseInt(c + c, 16))
    : [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  return v;
};
const lerpRGB = (a, b, t) => [
  Math.round(a[0] * (1 - t) + b[0] * t),
  Math.round(a[1] * (1 - t) + b[1] * t),
  Math.round(a[2] * (1 - t) + b[2] * t),
];

const CURATED_PALETTES = [
  {  // 0: monochrome grayscale
    stroke: ['#000', '#222', '#444', '#777', '#ddd', '#fff'].map(hex2rgb),
    tree:   ['#000', '#222', '#444', '#777', '#ddd', '#fff'].map(hex2rgb),
  },
  {  // 1: synthwave (deep blue → magenta → orange)
    stroke: ['#0f0347','#1c0682','#114ff2','#114ff2','#d91c2f','#d91c2f',
             '#fe3da7','#fe3da7','#f79357','#f79357','#fbc442','#fbc442'].map(hex2rgb),
    tree:   ['#0f0347','#1c0682','#114ff2','#5f317d','#5f317d','#bb39a2',
             '#bb39a2','#f45969','#f45969','#fbc442'].map(hex2rgb),
  },
  {  // 2: dusty rose + teal
    stroke: ['#1a1d28','#377D71','#8879B0','#FBA1A1','#FBC5C5'].map(hex2rgb),
    tree:   ['#1a1d28','#2d3351','#214942','#214942','#704723','#6dad9f',
             '#6dad9f','#f99d9d','#f8b861'].map(hex2rgb),
  },
  {  // 3: lavender + coral (with explicit lerp midpoints)
    stroke: [
      hex2rgb('#29264E'),
      lerpRGB(hex2rgb('#29264E'), hex2rgb('#9881F5'), 0.5),
      hex2rgb('#9881F5'),
      lerpRGB(hex2rgb('#9881F5'), hex2rgb('#82AFF9'), 0.5),
      hex2rgb('#F97D81'),
      lerpRGB(hex2rgb('#F97D81'), hex2rgb('#fcbcbe'), 0.5),
      hex2rgb('#fcbcbe'),
      hex2rgb('#f7c066'),
    ],
    tree: ['#29264E','#354e6f','#8475bd','#6daba5','#fcbcde','#f7c066'].map(hex2rgb),
  },
  {  // 4: olive + flame
    stroke: ['#232601','#4a69fe','#226330','#ef412f','#efac25','#eeefd0'].map(hex2rgb),
    tree:   ['#232601','#232601','#6b8adc','#226330','#c4685b','#c1a953','#eeefd0'].map(hex2rgb),
  },
  {  // 5: midnight + sunset
    stroke: ['#040B21','#0C282D','#2B4039','#9A422E','#d87d1b','#DFB4BF','#F3E7DC'].map(hex2rgb),
    tree:   ['#040B21','#0C282D','#2B4039','#9A422E','#d87d1b','#DFB4BF','#F3E7DC'].map(hex2rgb),
  },
];

const CURATED_PAPER = [216, 213, 206]; // '#dfd8ce' — Sarkissian's paper color

export function buildPalette(rng, opts = {}) {
  // Phase 2: opts.paletteIndex can pick a specific curated set.
  // Otherwise: hash picks one of 6 curated palettes per token.
  const idx = opts.paletteIndex ?? rng.random_int(0, CURATED_PALETTES.length - 1);
  const cur = CURATED_PALETTES[idx];
  return {
    paper: opts.paper || CURATED_PAPER,
    stroke: cur.stroke,
    tree: cur.tree,
    paletteIndex: idx,
  };
}

export function paletteColor(palette, br) {
  const arr = palette.stroke;
  const idx = Math.max(0, Math.min(arr.length - 1, Math.floor(br * arr.length)));
  return arr[idx];
}

export function treePaletteColor(palette, br) {
  const arr = palette.tree;
  const idx = Math.max(0, Math.min(arr.length - 1, Math.floor(br * arr.length)));
  return arr[idx];
}

// Pick a stroke color by lightValue ∈ [0, 1]. Indexes the stroke palette
// directly (curated palettes have hand-tuned color jumps — lerping between
// adjacent stops would dilute the signature).
export function sampleStroke(palette, lightValue) {
  return paletteColor(palette, Math.max(0, Math.min(1, lightValue)));
}

// ---------------------------------------------------------------------------
// Raymarch SDF (CPU JS). Returns hit info or null.
//   ro: ray origin, rd: ray direction (normalized)
//   sdfFn: function(p) → distance
// ---------------------------------------------------------------------------
function rayHitSDF(sdfFn, ro, rd, maxDist = 100, maxSteps = 80, eps = 0.001) {
  let t = 0;
  for (let i = 0; i < maxSteps; i++) {
    const p = [ro[0] + rd[0] * t, ro[1] + rd[1] * t, ro[2] + rd[2] * t];
    const d = sdfFn(p);
    if (Math.abs(d) < eps) return { p, t, steps: i };
    if (t > maxDist) return null;
    t += Math.max(d, eps * 2);   // small floor to escape near-zero stalls
  }
  return null;
}

// Bilinear-sample heightmap value at world XZ. Returns scaled world Y.
// Extracted to module scope so gradient queries can reuse it.
export function sampleHeightmap(baked, boxSize, x, z) {
  const W = baked.width, H = baked.height;
  const data = baked.data;
  const u = Math.max(0, Math.min(1, x / (2 * boxSize[0]) + 0.5));
  const v = Math.max(0, Math.min(1, z / (2 * boxSize[2]) + 0.5));
  const fx = u * (W - 1);
  const fy = v * (H - 1);
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const ix1 = Math.min(W - 1, ix + 1);
  const iy1 = Math.min(H - 1, iy + 1);
  const idx = (j, i) => (j * W + i) * 4;
  const lerp = (a, b, t) => a * (1 - t) + b * t;
  const h00 = data[idx(iy, ix)];
  const h10 = data[idx(iy, ix1)];
  const h01 = data[idx(iy1, ix)];
  const h11 = data[idx(iy1, ix1)];
  return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), ty) * boxSize[1];
}

// Heightmap-specific hit (faster + accurate for terrain-eroded-rune).
// Returns world-position + heightmap-channel sample.
function rayHitHeightmap(baked, ro, rd, boxSize, maxDist = 10, maxSteps = 60) {
  const W = baked.width, H = baked.height;
  const data = baked.data;
  const sampleH = (x, z) => sampleHeightmap(baked, boxSize, x, z);
  // Sphere-trace into the heightmap-as-SDF: p.y - h(p.xz)
  let t = 0;
  for (let i = 0; i < maxSteps; i++) {
    const px = ro[0] + rd[0] * t;
    const py = ro[1] + rd[1] * t;
    const pz = ro[2] + rd[2] * t;
    // Inside box footprint?
    if (Math.abs(px) > boxSize[0] || Math.abs(pz) > boxSize[2]) {
      if (t > maxDist) return null;
      t += 0.05;
      continue;
    }
    const h = sampleH(px, pz);
    const d = (py - h) * 0.5;
    if (Math.abs(d) < 0.002) {
      // Sample full RGBA at hit position for material info
      const u = Math.max(0, Math.min(1, px / (2 * boxSize[0]) + 0.5));
      const v = Math.max(0, Math.min(1, pz / (2 * boxSize[2]) + 0.5));
      const ix = Math.min(W - 1, Math.floor(u * W));
      const iy = Math.min(H - 1, Math.floor(v * H));
      const idx = (iy * W + ix) * 4;
      return {
        p: [px, py, pz],
        t,
        height: data[idx],
        ridge: data[idx + 1] * 2 - 1,
        trees: data[idx + 2],
      };
    }
    if (t > maxDist) return null;
    t += Math.max(d, 0.002);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Camera math — match flyLambert's `rd = normalize(uv.x*right + uv.y*up + focal*fwd)`.
// ---------------------------------------------------------------------------
export function buildCameraRay(camState, focal, width, height, px, py) {
  // Match flyLambert.computeFwd convention exactly: Y is -sin(pitch) so
  // positive pitch puts camera ABOVE target looking DOWN at it.
  const cp = Math.cos(camState.pitch), sp = Math.sin(camState.pitch);
  const cy = Math.cos(camState.yaw),   sy = Math.sin(camState.yaw);
  const fwd = [sy * cp, -sp, cy * cp];
  const right = [cy, 0, -sy];
  // up = cross(fwd, right)  (right-handed; cross(right, fwd) gives DOWN)
  const up = [
    fwd[1] * right[2] - fwd[2] * right[1],
    fwd[2] * right[0] - fwd[0] * right[2],
    fwd[0] * right[1] - fwd[1] * right[0],
  ];
  const aspect = width / height;
  const uvx = (px / width * 2 - 1) * aspect;
  const uvy = (1 - py / height * 2);
  const rd = norm([
    uvx * right[0] + uvy * up[0] + focal * fwd[0],
    uvx * right[1] + uvy * up[1] + focal * fwd[1],
    uvx * right[2] + uvy * up[2] + focal * fwd[2],
  ]);
  return { ro: [...camState.position], rd };
}

// ---------------------------------------------------------------------------
// Project a world point to screen pixel coordinates. Uses the same camera
// basis as buildCameraRay (above). Returns null if the point is behind camera.
// ---------------------------------------------------------------------------
export function projectWorldToScreen(world, camState, focal, width, height) {
  const cp = Math.cos(camState.pitch), sp = Math.sin(camState.pitch);
  const cy = Math.cos(camState.yaw),   sy = Math.sin(camState.yaw);
  const fwd = [sy * cp, -sp, cy * cp];
  const right = [cy, 0, -sy];
  const up = [
    fwd[1] * right[2] - fwd[2] * right[1],
    fwd[2] * right[0] - fwd[0] * right[2],
    fwd[0] * right[1] - fwd[1] * right[0],
  ];
  const dp = sub(world, camState.position);
  const zCam = dot(dp, fwd);
  if (zCam <= 0.001) return null;
  const xCam = dot(dp, right);
  const yCam = dot(dp, up);
  const aspect = width / height;
  const uvx = (focal * xCam / zCam) / aspect;   // [-1, 1] horizontally
  const uvy = focal * yCam / zCam;              // [-1, 1] vertically (+up)
  const px = (uvx * 0.5 + 0.5) * width;
  const py = (1 - (uvy * 0.5 + 0.5)) * height;  // flip y for screen coords
  return [px, py, zCam];
}

// ---------------------------------------------------------------------------
// Compute screen-space slope angle from heightmap gradient at world XZ.
// Returns radians, suitable for SketchyShape.angle. Uses neighbor-sampled
// world points + projected to screen → atan2 of screen displacement.
// ---------------------------------------------------------------------------
function computeSlopeAngle(baked, boxSize, worldP, camState, focal, width, height, eps = 0.04) {
  if (!baked) return 0;
  const [x, , z] = worldP;
  // Gradient: how heightmap changes per unit world X and Z
  const h0 = sampleHeightmap(baked, boxSize, x, z);
  const hx = sampleHeightmap(baked, boxSize, x + eps, z);
  const hz = sampleHeightmap(baked, boxSize, x, z + eps);
  const dhdx = (hx - h0) / eps;
  const dhdz = (hz - h0) / eps;
  // Build 3D neighbor world points: walk along the steepest-descent direction
  // by a small step + lift to surface. Project the descent vector to screen.
  const gradMag = Math.hypot(dhdx, dhdz) || 1e-6;
  const descX = -dhdx / gradMag;        // downhill direction in world XZ
  const descZ = -dhdz / gradMag;
  const stepLen = 0.04;
  const neighbor = [x + descX * stepLen, h0 + (-gradMag) * stepLen, z + descZ * stepLen];
  const sA = projectWorldToScreen(worldP, camState, focal, width, height);
  const sB = projectWorldToScreen(neighbor, camState, focal, width, height);
  if (!sA || !sB) return 0;
  return Math.atan2(sB[1] - sA[1], sB[0] - sA[0]);
}

// =============================================================================
// SARKISSIAN 2D TOP-DOWN PIPELINE (faithful port of sketch 2040291)
// -----------------------------------------------------------------------------
// When a heightmap is available (bonsai-mountain bake), crayon switches to 2D
// top-down painting per Sarkissian's algorithm. No raymarch. The bake's
// heightmap directly becomes hMap; gradient·light becomes lMap.
// =============================================================================

// Convert Atlas bake → Sarkissian hMap (raw height in [0,1]) and lMap
// (normal · light dot product, in [-1, 1]). 100×100 resolution matches the
// original — keeps stroke density looking right.
function prepareSarkissianMaps(baked, boxSize, lightDir, mapW = 100, mapH = 100) {
  const hMap = new Array(mapW);
  const lMap = new Array(mapW);
  for (let i = 0; i < mapW; i++) {
    hMap[i] = new Float32Array(mapH);
    lMap[i] = new Float32Array(mapH);
    for (let j = 0; j < mapH; j++) {
      const u = (i + 0.5) / mapW, v = (j + 0.5) / mapH;
      const x = (u - 0.5) * 2 * boxSize[0];
      const z = (v - 0.5) * 2 * boxSize[2];
      hMap[i][j] = Math.max(0, sampleHeightmap(baked, boxSize, x, z));
    }
  }
  // Second pass: normal · light from finite-difference gradient (Sarkissian
  // line 90-94 in map.js).
  for (let i = 0; i < mapW; i++) {
    for (let j = 0; j < mapH; j++) {
      const i1 = (i === mapW - 1) ? mapW - 2 : i + 1;
      const j1 = (j === mapH - 1) ? mapH - 2 : j + 1;
      const iDir = (i === mapW - 1) ? -1 : 1;
      const jDir = (j === mapH - 1) ? -1 : 1;
      const dhx = (hMap[i1][j] - hMap[i][j]) * iDir;
      const dhz = (hMap[i][j1] - hMap[i][j]) * jDir;
      // Sarkissian uses (dh/dx, dh/dz, 0) as the normal (2D treatment, no y),
      // then normalizes. We do the same.
      const len = Math.hypot(dhx, dhz) || 1e-6;
      const nx = dhx / len, ny = dhz / len;
      // Dot with 2D light direction
      lMap[i][j] = nx * lightDir[0] + ny * lightDir[1];
    }
  }
  return { hMap, lMap, mapW, mapH };
}

// 2nd-derivative magnitude squared at (i, j). Used for stroke length:
// gentle curvature → long strokes (plains); sharp curvature → short strokes
// (cliffs / ridges).
function hMapCurvatureMagSq(hMap, mapW, mapH, i, j) {
  const i0 = i, j0 = j;
  const i1 = (i === mapW - 1) ? mapW - 2 : i + 1;
  const j1 = (j === mapH - 1) ? mapH - 2 : j + 1;
  // First derivatives
  const dhx0 = hMap[i1][j0] - hMap[i0][j0];
  const dhz0 = hMap[i0][j1] - hMap[i0][j0];
  // Second derivatives
  const i2 = (i1 === mapW - 1) ? mapW - 2 : i1 + 1;
  const j2 = (j1 === mapH - 1) ? mapH - 2 : j1 + 1;
  const dhx1 = hMap[i2][j0] - hMap[i1][j0];
  const dhz1 = hMap[i0][j2] - hMap[i0][j1];
  const ddx = dhx1 - dhx0;
  const ddz = dhz1 - dhz0;
  return ddx * ddx + ddz * ddz;
}

// addTreeSpecs — port of Sarkissian's addTree() (line 381-514).
//   • 1 trunk (vertical "weighted line" — thin elongated rect)
//   • 4-5 clumps, each with: 1 branch line + 2-20 foliage ellipses
// Foliage color computed from per-leaf internal normal · lightDir.
function addTreeSpecs(rng, palette, x, y, z, lightValue, treeHt, lightDir, scaleK) {
  const specs = [];
  const wiggle = 2 * scaleK;
  // 1) Trunk — vertical weighted line from (x, y) to (x, y - treeHt)
  const tx1 = x + rng.random_num(-1, 1) * wiggle;
  const ty1 = y + rng.random_num(-1, 1) * wiggle;
  const tx2 = x + rng.random_num(-1, 1) * wiggle;
  const ty2 = y - treeHt + rng.random_num(-1, 1) * wiggle;
  const trLen = Math.hypot(tx2 - tx1, ty2 - ty1);
  const trAng = Math.atan2(ty2 - ty1, tx2 - tx1);
  specs.push({
    shapeKind: 'rect',
    px: (tx1 + tx2) * 0.5, py: (ty1 + ty2) * 0.5,
    w: 0.5 * scaleK,             // Sarkissian constructor weight = 0.5
    h: trLen,                    // full line length
    hatchDensity: 0.2,           // unscaled (rect step count = max(w,h)/hd)
    angle: trAng + Math.PI / 2,
    colorBase: treePaletteColor(palette, rng.random_num(0, 0.5)),
    alpha: 0.25,
    wt: 1.5 * scaleK, maxV: 0.3, density: 1, wobble: 0.2,
    depth: z,
  });

  // 2) 4-5 clumps
  const nClumps = Math.round(rng.random_num(4, 5));
  for (let cl = 0; cl < nClumps; cl++) {
    const branchHt = rng.random_num(0.1, 1);
    const branchStartY = y + (-treeHt) * branchHt;  // lerp(y, y-treeHt, branchHt)
    // clumpOffset: (0, -random(treeHt*0.7) * map(branchHt, 0.1, 1, 0.5, 0.8))
    //              then rotate by random(-π/2, π/2), then y *= random(1,2)
    let cOffX = 0;
    let cOffY = -rng.random_num(0, treeHt * 0.7) *
                (0.5 + (0.8 - 0.5) * (branchHt - 0.1) / 0.9);
    const rotA = rng.random_num(-1, 1) * Math.PI / 2;
    const ca = Math.cos(rotA), sa = Math.sin(rotA);
    const cOffXR = ca * cOffX - sa * cOffY;
    const cOffYR = (sa * cOffX + ca * cOffY) * rng.random_num(1, 2);
    cOffX = cOffXR; cOffY = cOffYR;

    // Branch line from (x, branchStartY) to (x + cOffX, y - treeHt + cOffY)
    const bx1 = x, by1 = branchStartY;
    const bx2 = x + cOffX, by2 = y - treeHt + cOffY;
    const brLen = Math.hypot(bx2 - bx1, by2 - by1);
    const brAng = Math.atan2(by2 - by1, bx2 - bx1);
    specs.push({
      shapeKind: 'rect',
      px: (bx1 + bx2) * 0.5, py: (by1 + by2) * 0.5,
      w: 0.25 * scaleK,         // Sarkissian branch weight = 0.25
      h: brLen,
      hatchDensity: 0.1,
      angle: brAng + Math.PI / 2,
      colorBase: treePaletteColor(palette, 0),  // darkest
      alpha: 0.25,
      wt: 1.5 * scaleK, maxV: 0.3, density: 1, wobble: 0.2,
      depth: z,
    });

    // Foliage: 2-10 leaf ellipses (Sarkissian uses 2-20; halved to keep
    // total spec count tractable for animation)
    const nLeaves = Math.round(rng.random_num(2, 10));
    for (let lf = 0; lf < nLeaves; lf++) {
      const r = rng.random_num(2, 3) * scaleK *
                (1.5 + (1 - 1.5) * lf / Math.max(1, nLeaves));
      let oX = rng.random_num(0, r * 1.8), oY = 0;
      const aRot = rng.random_num(0, Math.PI * 2);
      const cR = Math.cos(aRot), sR = Math.sin(aRot);
      [oX, oY] = [cR * oX - sR * oY, sR * oX + cR * oY];
      const folX = x + oX + cOffX;
      const folY = y - treeHt + oY + cOffY;

      // Internal "leaf normal" — Sarkissian line 480-484
      const nx = -cOffX * 0.3 - oX;
      const ny = cOffY * 0.3 + oY + 6 * scaleK;
      const nlen = Math.hypot(nx, ny) || 1;
      const dt = (nx / nlen) * lightDir[0] + (ny / nlen) * lightDir[1];
      // br = pow(norm(dt, -1, 1), map(lightValue, 0, 1, 8, 1)) + map(lv, 0, 1, 0, 0.2)
      const normDt = Math.max(0, (dt + 1) * 0.5);
      const powExp = 8 + (1 - 8) * lightValue;
      const addOff = 0 + (0.2 - 0) * lightValue;
      let br = Math.pow(normDt, powExp) + addOff + rng.random_num(-1, 1) * 0.1;
      br = Math.max(0, Math.min(1, br));

      specs.push({
        px: folX, py: folY,
        rx: 4 * scaleK, ry: r * 2,
        hatchDensity: rng.random_num(1, 1.1),
        // Slight per-leaf angle jitter via deterministic noise approximation
        angle: (Math.sin(folX * 0.03 + folY * 0.03) * Math.PI / 6),
        colorBase: treePaletteColor(palette, br),
        alpha: 0.25,
        wt: 2.5 * scaleK, maxV: 1, density: 2, wobble: 0.2,
        depth: z,
      });
    }
  }
  return specs;
}

// addBushSpecs — port of Sarkissian's addBush() (line 516-588).
// 4-5 clumps, each with a flatter rock-cluster.
function addBushSpecs(rng, palette, x, y, z, lightValue, rockHt, hMap, mapW, mapH, i, j, lightDir, scaleK) {
  const specs = [];
  const nClumps = Math.round(rng.random_num(4, 5));

  // Terrain normal at (i, j) — used for rock angle (line 581-583)
  const i1 = (i >= mapW - 1) ? mapW - 2 : i + 1;
  const j1 = (j >= mapH - 1) ? mapH - 2 : j + 1;
  const dhx = hMap[i1][j] - hMap[i][j];
  const dhz = hMap[i][j1] - hMap[i][j];
  const nLen = Math.hypot(dhx, dhz) || 1e-6;
  const nrmX = dhx / nLen;

  for (let cl = 0; cl < nClumps; cl++) {
    let cOffX = 0;
    let cOffY = -rng.random_num(0, rockHt * 0.1);
    const rotA = rng.random_num(-1, 1) * Math.PI / 2;
    const ca = Math.cos(rotA), sa = Math.sin(rotA);
    cOffX = ca * cOffX - sa * cOffY;
    cOffY = sa * cOffX + ca * cOffY;
    cOffY = -Math.abs(cOffY);

    const nRocks = Math.round(rng.random_num(10, 20) * 0.4);
    for (let r0 = 0; r0 < nRocks; r0++) {
      const r = rng.random_num(2, 3) * scaleK *
                (1.5 + (1 - 1.5) * r0 / Math.max(1, nRocks));
      let oX = rng.random_num(0, r * 1.5), oY = 0;
      const aRot = rng.random_num(0, Math.PI * 2);
      const cR = Math.cos(aRot), sR = Math.sin(aRot);
      [oX, oY] = [cR * oX - sR * oY, sR * oX + cR * oY];
      oY = -Math.abs(oY);

      const rkX = x + oX + cOffX;
      const rkY = y + oY + cOffY;

      // Internal normal for rock brightness
      const nx = -cOffX * 0.3 - oX;
      const ny = cOffY * 0.3 + oY + 6 * scaleK;
      const nl = Math.hypot(nx, ny) || 1;
      const dt = (nx / nl) * lightDir[0] + (ny / nl) * lightDir[1];
      const normDt = Math.max(0, (dt + 1) * 0.5);
      const powExp = 8 + (1 - 8) * lightValue;
      const addOff = 0 + (0.2 - 0) * lightValue;
      let br = Math.pow(normDt, powExp) + addOff + rng.random_num(-1, 1) * 0.4;
      br = Math.max(0, Math.min(1, br));

      const baseAng = ((1 - Math.max(-1, Math.min(1, nrmX))) * 0.5) * (Math.PI / 2)
                    + Math.PI / 4 + (Math.round(rng.random_dec()) * 2 - 1) * Math.PI
                    + Math.PI / 2;

      specs.push({
        px: rkX, py: rkY,
        rx: r * 2, ry: 4 * scaleK,
        hatchDensity: rng.random_num(1, 1.1),
        angle: baseAng + ((nx / nl) > 0 ? -1 : 1) * rng.random_num(Math.PI / 8, Math.PI / 4),
        colorBase: treePaletteColor(palette, br),
        alpha: 0.25,
        wt: 1.5 * scaleK, maxV: 1, density: 2, wobble: 0.2,
        depth: z,
      });
    }
  }
  return specs;
}

// Build Sarkissian-style 2D scribble specs. Renders the baked heightmap as
// a top-down painted landscape with the algorithm from mySketch.js.js.
// Two passes:
//   (1) Vegetation pre-pass — 1600 candidates, place trees/bushes where the
//       gradient direction favors it. Each placement also darkens lMap
//       (cast shadow) so subsequent terrain strokes see the dark spot.
//   (2) Main terrain pass — 8000 scribbles using the (possibly shadowed) lMap.
function prepareSarkissianSpecs(rng, palette, maps, canvasSize, params) {
  const { hMap, lMap, mapW, mapH } = maps;
  const { terrainHt, warpSz, lightAngle, noiseScale = 0.01 } = params;
  const lightDir = [Math.cos(lightAngle), Math.sin(lightAngle)];
  const targetSz = canvasSize;
  const scaleK = targetSz / 400;  // Sarkissian's original target was 400px
  const nShapes = 8000;
  // Vegetation candidates: Sarkissian uses nShapes * 0.2 = 1600, but each
  // accepted tree expands to ~50 specs (1 trunk + 4-5 branches + ~40 leaves).
  // At 1600 we'd produce ~30k vegetation specs — too slow. 500 still yields
  // dense forest after expansion (~15k specs) while staying responsive.
  const nVeg = 500;
  const specs = [];

  // ── PASS 1: Vegetation candidates + lMap shadow casting ─────────────────
  const treeToScrubThresh = rng.random_num(0.18, 0.28);
  const plantThresh = Math.max(0.3, Math.min(0.45, rng.random_num(0.3, 0.5)));
  const plantSide = rng.random_dec() < 0.5 ? -1 : 1;
  const plantSlopeLeniency = rng.random_num(0.01, 0.1);

  for (let v = 0; v < nVeg; v++) {
    let x = rng.random_num(0, targetSz);
    let y = rng.random_num(0, targetSz);
    const i = Math.max(0, Math.min(mapW - 1, Math.floor(x / targetSz * mapW)));
    const j = Math.max(0, Math.min(mapH - 1, Math.floor(y / targetSz * mapH)));
    const ns = hMap[i][j];
    // Sarkissian's `if (ns != 0)` filters water at the strict-zero boundary
    // because his hMap is amplified to [0, ~12.5] with snap to floor(*1e5)/1e5.
    // Our raw heightmap is [0, 1] with noise everywhere → ns is rarely exactly
    // 0. Use a real water-line threshold so vegetation doesn't grow on flats.
    if (ns < 0.08) continue;
    // Position warp (same as main pass — vegetation sits ON the warped terrain)
    const swirl = ns * Math.PI * 4;
    x += Math.cos(swirl) * warpSz;
    y += Math.sin(swirl) * warpSz;
    y += ns * terrainHt;
    const z = y + 10;   // Sarkissian: vegetation z = y + 10 (drawn AFTER bg)

    // Surface normal at (i, j) — same convention as lMap (2D, dh/dx & dh/dz)
    const i1 = (i >= mapW - 1) ? mapW - 2 : i + 1;
    const j1 = (j >= mapH - 1) ? mapH - 2 : j + 1;
    const dhx = hMap[i1][j] - hMap[i][j];
    const dhz = hMap[i][j1] - hMap[i][j];
    const nLen = Math.hypot(dhx, dhz) || 1e-6;
    const nrmX = dhx / nLen;
    // 2nd derivative x-component (line 154-160 condition)
    const i2 = (i1 >= mapW - 1) ? mapW - 2 : i1 + 1;
    const dhx1 = hMap[i2][j] - hMap[i1][j];
    const nrm2x = (dhx1 - dhx) * 100;  // amplify for threshold

    // Plant placement criteria (Sarkissian line 154-160)
    const plantOk = Math.abs(nrmX) < plantThresh && (
      plantSide < 0
        ? nrm2x < rng.random_num(0, plantSlopeLeniency)
        : nrm2x > rng.random_num(-plantSlopeLeniency, 0)
    );
    if (!plantOk) continue;

    // Tree noise approximation (smooth pseudo-random per cell)
    const treeNs = 0.5 + 0.4 * (Math.sin(i * 0.7 + 1234) + Math.cos(j * 0.9 + 1234)) * 0.5;
    const treeHtNs = 0.5 + 0.4 * (Math.sin(i * 1.3 + 100) + Math.cos(j * 1.1 + 123)) * 0.5;
    const dt = lMap[i][j];
    const lightValue = (dt + 1) * 0.5;

    // Veg-z is shifted into a high band so EVERY vegetation spec is drawn
    // AFTER all terrain (after descending sort + pop-from-tail). Sarkissian's
    // original lets trees tie with same-y terrain z=y and relies on his
    // sparser strokes not covering them; our denser strokes would consistently
    // cover trees in the tie → trees only visible where terrain doesn't
    // overlap (= top edge of canvas only). Large +VEG_Z_OFFSET fixes that.
    // Within vegetation, the y component preserves the natural near/far order.
    const VEG_Z_OFFSET = 100000;
    // Sarkissian's `ns < PI * 2.5` keeps trees off the highest terrain (he uses
    // amplified hMap range [0, ~12.5], so PI*2.5 ≈ 63% of peak). Our raw scale:
    // 0.625 = same 62.5% threshold. Above this → bush only (no tall trees on
    // bare peaks).
    const TREE_MAX_NS = 0.625;
    // Tree height scaled by terrain elevation so low-slope trees are short
    // and peaks-adjacent trees are taller — avoids tall trees on flat ground.
    const nsT = Math.min(1, (ns - 0.08) / (TREE_MAX_NS - 0.08));
    let shadowLength = 0.5;
    if (treeNs > treeToScrubThresh) {
      // Tree (with possible understory bush)
      if (ns < TREE_MAX_NS && j > 4) {
        // Halved range vs. Sarkissian + terrain-elevation scale
        const treeHt = (6 + treeHtNs * 30) * scaleK * (0.4 + nsT * 0.6);
        const treeSpecs = addTreeSpecs(rng, palette, x, y, y + VEG_Z_OFFSET,
          lightValue, treeHt, lightDir, scaleK);
        for (const s of treeSpecs) specs.push(s);
        shadowLength = 1;
      }
      if (rng.random_dec() < 0.5) {
        const rockHt = (8 + treeHtNs * 40) * 0.5 * scaleK;
        const bushSpecs = addBushSpecs(rng, palette, x, y, y + VEG_Z_OFFSET + 0.0001,
          lightValue, rockHt, hMap, mapW, mapH, i, j, lightDir, scaleK);
        for (const s of bushSpecs) specs.push(s);
      }
    } else {
      // Bush only
      const rockHt = (8 + treeHtNs * 40) * scaleK;
      const bushSpecs = addBushSpecs(rng, palette, x, y, y + VEG_Z_OFFSET + 0.0001,
        lightValue, rockHt, hMap, mapW, mapH, i, j, lightDir, scaleK);
      for (const s of bushSpecs) specs.push(s);
    }

    // Cast shadow on lMap (line 175-186)
    const sw = (4 + treeHtNs * 4) * shadowLength;
    const sh = 1 + treeHtNs * 2;
    const swInt = Math.ceil(sw);
    const shInt = Math.ceil(sh);
    const shadowDx = Math.cos(lightAngle) * sw * 0.5;
    const shadowDz = Math.sin(lightAngle) * sh * 0.5;
    for (let __i = -swInt; __i <= swInt; __i++) {
      for (let __j = -shInt; __j <= shInt; __j++) {
        const _i = Math.floor(i + __i + shadowDx);
        const _j = Math.floor(j + __j + shadowDz);
        if (_i >= 0 && _i < mapW && _j >= 0 && _j < mapH) {
          lMap[_i][_j] = lMap[_i][_j] * 0.3 + (-1) * 0.7;  // lerp toward -1 by 0.7
        }
      }
    }
  }

  for (let s = 0; s < nShapes; s++) {
    let x = rng.random_num(0, targetSz);
    let y = rng.random_num(0, targetSz);

    const i = Math.max(0, Math.min(mapW - 1, Math.floor(x / targetSz * mapW)));
    const j = Math.max(0, Math.min(mapH - 1, Math.floor(y / targetSz * mapH)));
    const ns = hMap[i][j];

    // Position warp (Sarkissian line 200-204):
    //   x += cos(h * scale) * warpSz;
    //   y += sin(h * scale) * warpSz;
    //   y += h * terrainHt;     (terrainHt is NEGATIVE → high terrain pushes UP)
    // h is normalized to a "swirl angle" so cos/sin produce locally varied warp.
    const swirl = ns * Math.PI * 4;
    x += Math.cos(swirl) * warpSz;
    y += Math.sin(swirl) * warpSz;
    y += ns * terrainHt;

    const z = y;  // depth = warped screen y (NOT raw y)

    const dt = lMap[i][j];
    const lightValue = (dt + 1) * 0.5;  // [-1, 1] → [0, 1]

    // 2nd derivative → stroke length (gentle curvature = long, sharp = short)
    const nrm2 = hMapCurvatureMagSq(hMap, mapW, mapH, i, j);
    const minStrokeLen = 15 * (targetSz / 400);  // scale-relative
    const maxStrokeLen = 24 * (targetSz / 400);
    const lenT = Math.max(0, Math.min(1, (nrm2 - 0.0001) / (0.0008 - 0.0001)));
    const r = maxStrokeLen + (minStrokeLen - maxStrokeLen) * lenT;

    // Multi-scribble: 1-3 layers, more layers in warped/high-terrain areas
    const warpAmt = Math.abs(y - z);  // = abs(ns * terrainHt + sin(swirl)*warpSz)
    const maxScribblesBase = Math.abs(terrainHt) + Math.abs(warpSz);
    const nScribbles = Math.max(1, Math.floor(
      1 + (warpAmt / Math.max(1, maxScribblesBase)) * rng.random_num(0, 2)
    ));

    // Angle from gradient direction (line 244 in original)
    const i1 = (i === mapW - 1) ? mapW - 2 : i + 1;
    const dhx = hMap[i1][j] - hMap[i][j];
    // Sarkissian uses map(nrm.x, 1, -1, 0, PI/2) + PI/4 + random π flip
    const nxNorm = Math.max(-1, Math.min(1, dhx * 100));  // approximate normal.x
    const baseAngle = ((1 - nxNorm) * 0.5) * (Math.PI / 2) + Math.PI / 4;
    const flip = rng.random_dec() < 0.5 ? 0 : Math.PI;

    // Color via Sarkissian's lerp formula:
    //   t = |lightValue - 0.5| * 2  → 0 at mid-light, 1 at extremes
    //   colorIdx = lerp(landValue, lightValue, t)
    // Land value: noise-driven; we approximate via a smooth hash at (i, j).
    const landValue = 0.4 + 0.3 * (Math.sin(i * 0.31 + 13) + Math.sin(j * 0.27 + 7)) * 0.5;
    const mixT = Math.abs(lightValue - 0.5) * 2;
    const colorT = landValue * (1 - mixT) + lightValue * mixT;
    const color = paletteColor(palette, colorT);

    for (let k = 0; k < nScribbles; k++) {
      const wobbleAngle = rng.random_num(0, Math.PI * 2);
      specs.push({
        px: x, py: y,
        rx: 5 * (targetSz / 400),
        ry: r * rng.random_num(0.9, 1.1),
        hatchDensity: rng.random_num(1, 2),
        angle: baseAngle + flip,
        wobbleAngle,
        colorBase: color,
        alpha: 0.25,  // = 64/255 (Sarkissian uses alpha=64)
        depth: z,     // screen-y depth (larger z = closer to viewer = drawn last)
      });
    }
  }

  // Painter's algo (Sarkissian line 276-279): sort DESCENDING by z so that
  // pop() from tail yields smallest z first → background painted first, then
  // progressively foreground stuff. With ascending sort the order inverts
  // and later-drawn terrain strokes cover trees that were placed earlier.
  specs.sort((a, b) => b.depth - a.depth);
  return specs;
}

// ---------------------------------------------------------------------------
// Internal canvas — sibling of #c-gpu. Created lazily.
// ---------------------------------------------------------------------------
function getOrCreateCrayonCanvas() {
  let cv = document.getElementById('c-crayon');
  if (cv) return cv;
  const ref = document.getElementById('c-gpu');
  if (!ref) throw new Error('[crayon] #c-gpu canvas not found — cannot create sibling');
  cv = document.createElement('canvas');
  cv.id = 'c-crayon';
  // Match c-gpu layout + dimensions
  cv.style.cssText = ref.style.cssText || '';
  cv.style.display = 'none';
  cv.width = ref.width;
  cv.height = ref.height;
  // Insert immediately after c-gpu so CSS positioning (likely absolute) matches
  if (ref.parentNode) ref.parentNode.insertBefore(cv, ref.nextSibling);
  return cv;
}

// ---------------------------------------------------------------------------
// createCrayonRenderer factory.
// ---------------------------------------------------------------------------
export function createCrayonRenderer({ canvas, getControls, onFps }) {
  // We ignore the passed-in canvas (it's c-gpu, which is WebGL) — create our own.
  const crayonCanvas = getOrCreateCrayonCanvas();
  const ctx = crayonCanvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('[crayon] Canvas2D context unavailable');

  let baked = null;            // bakedHeightmap if scene has terrain-eroded-rune
  let sdfFn = null;            // CPU SDF function
  let camState = { position: [0, 0.5, -3], yaw: 0, pitch: 0 };
  let palette = null;
  let paletteOpts = {};        // Phase 2: external buildPalette override
  let specQueue = [];          // pre-baked scribble specs, sorted (back→front)
  let currentScribble = null;  // single active SketchyShape (Sarkissian pattern)
  let drawnCount = 0;
  let rafId = null;
  let runRng = null;           // per-render rng (deterministic stamp pattern)
  let fpsLast = performance.now();
  let frameCount = 0;
  let boxSize = [0.5, 1.0, 0.5];

  const SCRIBBLES_TOTAL = 2800;
  // Tick budget per rAF — each tick advances one active scribble by one pen
  // step + density stamps. Sarkissian uses 2000; we use 6000 for 3× faster
  // playback. Combined with the SketchyRectangle bug fix this gives a ~50×
  // total speedup for vegetation-heavy scenes.
  const TICKS_PER_FRAME = 6000;

  function resizeIfNeeded() {
    const ref = document.getElementById('c-gpu');
    if (ref && (crayonCanvas.width !== ref.width || crayonCanvas.height !== ref.height)) {
      crayonCanvas.width = ref.width;
      crayonCanvas.height = ref.height;
    }
  }

  function paintBackground() {
    const c = palette.paper;
    ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
    ctx.fillRect(0, 0, crayonCanvas.width, crayonCanvas.height);
  }

  // Build a scribble spec by raymarching one screen pixel. Returns null when
  // the ray misses or we want to drop this sample (sky scribbles are emitted
  // as a separate sparse pass elsewhere).
  function buildSpec(px, py, focal, w, h) {
    const { ro, rd } = buildCameraRay(camState, focal, w, h, px, py);
    let hit = baked ? rayHitHeightmap(baked, ro, rd, boxSize, 12, 80) : null;
    if (!hit && sdfFn) hit = rayHitSDF(sdfFn, ro, rd, 30, 60);
    if (!hit) return null;

    // Light/material value from heightmap channels (terrain) or position fallback.
    let lightValue = 0.55;
    if (baked && hit.height != null) {
      const above = Math.max(0, (hit.height - 0.23) / 0.45);
      lightValue = 0.20 + above * 0.70;
      if (hit.trees > 0.4) lightValue = 0.30;
      if (hit.ridge < -0.3) lightValue = 0.10;
    } else if (hit.p[1] < 0.05) {
      lightValue = 0.30;
    } else {
      lightValue = 0.70;
    }
    const isTree = baked && hit.trees > 0.55 && runRng.random_dec() < 0.5;
    const colorBase = isTree
      ? palette.tree[runRng.random_int(0, 2)]
      : sampleStroke(palette, lightValue + runRng.random_num(-0.08, 0.08));

    // Slope-aligned angle — strokes "flow downhill" so brushwork reads as
    // sculpted relief rather than random scribble noise.
    const angle = computeSlopeAngle(baked, boxSize, hit.p, camState, focal, w, h)
      + (runRng.random_dec() < 0.5 ? 0 : Math.PI);   // random ±180° flip à la Sarkissian

    // Anchor noise — small random displacement of the pixel position so the
    // stroke center isn't exactly on a uniform grid (organic placement).
    const offA = runRng.random_num(0, Math.PI * 2);
    const offR = Math.sqrt(runRng.random_dec()) * 6;
    const anchorPx = px + Math.cos(offA) * offR;
    const anchorPy = py + Math.sin(offA) * offR;

    return {
      px: anchorPx, py: anchorPy,
      angle,
      colorBase,
      rx: 4 + runRng.random_num(-1, 2),               // narrow width (was 5-10)
      ry: 20 + runRng.random_num(-6, 14),             // elongated (was 12-24)
      wt: 2.4 + runRng.random_num(-0.4, 0.8),
      alpha: isTree ? 0.30 : 0.24,
      depth: hit.t,                                    // sort key — far→near
    };
  }

  function makeScribbleFromSpec(spec) {
    // Sarkissian default for terrain scribbles (line 238-247):
    // weight=2.5, maxV=1, acc=0.02, density=2, wobble=0.2.
    // Trunk/branch/foliage specs override these via spec.wt/maxV/density/...
    //
    // shapeKind dispatch: 'rect' for trunks/branches (straight-edge zig-zag,
    // needed for thin shapes — ellipse degenerates at the boundary).
    // Default 'ellipse' for foliage and terrain scribbles.
    let sk;
    if (spec.shapeKind === 'rect') {
      sk = new SketchyRectangle(
        spec.px, spec.py,
        spec.w ?? (spec.rx * 2),
        spec.h ?? (spec.ry * 2),
        spec.hatchDensity ?? 0.2,
      );
    } else {
      sk = new SketchyEllipse(
        spec.px, spec.py, spec.rx, spec.ry,
        spec.hatchDensity ?? 1.6, false,
      );
    }
    sk.wt = spec.wt ?? 2.5;
    sk.maxV = spec.maxV ?? 1.0;
    sk.acc = spec.acc ?? 0.02;
    sk.density = spec.density ?? 2;
    sk.wobble = spec.wobble ?? 0.2;
    sk.angle = spec.angle;
    const c = spec.colorBase;
    sk.color = [c[0], c[1], c[2], spec.alpha];
    return sk;
  }

  // Pre-bake all scribble specs. Two paths:
  //   (A) When bake is available → Sarkissian 2D top-down (faithful port of
  //       his Eucalyptus & Sagebrush sketch). NO raymarch.
  //   (B) Fallback for non-heightmap scenes → original 3D raymarch path.
  function prebakeSpecs() {
    const w = crayonCanvas.width, h = crayonCanvas.height;
    if (baked) return prebakeSpecsSarkissian(w, h);
    return prebakeSpecsRaymarch(w, h);
  }

  // ── Path A: Sarkissian 2D top-down ────────────────────────────────────────
  function prebakeSpecsSarkissian(w, h) {
    // Light angle: -π/2 ± π/3, matching original line 69
    const lightAngle = -Math.PI / 2 + (runRng.random_dec() < 0.5 ? -1 : 1) * Math.PI / 3;
    const lightDir = [Math.cos(lightAngle), Math.sin(lightAngle)];
    // Sarkissian's units: targetSz=400, terrainHt=-0.2*targetSz=-80, warpSz=10.
    // We use ~85% of canvas min-dim as the painting area so margins stay.
    const targetSz = Math.min(w, h) * 0.85;
    const terrainHt = -0.2 * targetSz;
    const warpSz = 10 * (targetSz / 400);
    const maps = prepareSarkissianMaps(baked, boxSize, lightDir);
    const specs = prepareSarkissianSpecs(runRng, palette, maps, targetSz, {
      terrainHt, warpSz, lightAngle,
    });
    // Center the painted area on canvas. Sarkissian translates by
    // (W/2 - targetSz/2, H/2 - (maxY-minY)/2 - minY).
    if (specs.length === 0) return specs;
    let minPy = Infinity, maxPy = -Infinity;
    for (const s of specs) {
      if (s.py < minPy) minPy = s.py;
      if (s.py > maxPy) maxPy = s.py;
    }
    const offsetX = (w - targetSz) * 0.5;
    const offsetY = h * 0.5 - (minPy + maxPy) * 0.5;
    for (const s of specs) {
      s.px += offsetX;
      s.py += offsetY;
      s.depth += offsetY;
    }
    // Re-sort after offset (depth changed) — actually offsetY shifts all
    // depths uniformly so relative order is unchanged; skip resort.
    return specs;
  }

  // ── Path B: 3D raymarch (legacy / non-heightmap scenes) ───────────────────
  function prebakeSpecsRaymarch(w, h) {
    const focal = (getControls && getControls().fov) || 1.5;
    const surfaceSpecs = [];
    const skySpecs = [];
    let attempts = 0;
    const maxAttempts = SCRIBBLES_TOTAL * 3;
    while (surfaceSpecs.length < SCRIBBLES_TOTAL && attempts < maxAttempts) {
      attempts++;
      const px = runRng.random_num(0, w);
      const py = runRng.random_num(0, h);
      const spec = buildSpec(px, py, focal, w, h);
      if (spec) {
        surfaceSpecs.push(spec);
      } else if (skySpecs.length < 350) {
        const c = sampleStroke(palette, 0.88);
        skySpecs.push({
          px, py, angle: runRng.random_num(0, Math.PI * 2),
          colorBase: c, rx: 16, ry: 5, wt: 5, alpha: 0.05,
          depth: 999,
        });
      }
    }
    const all = skySpecs.concat(surfaceSpecs);
    all.sort((a, b) => a.depth - b.depth);
    return all;
  }

  function tick() {
    resizeIfNeeded();
    const rngRaw = () => runRng.random_dec();
    let budget = TICKS_PER_FRAME;
    while (budget-- > 0) {
      if (!currentScribble) {
        if (specQueue.length === 0) break;
        currentScribble = makeScribbleFromSpec(specQueue.pop());  // far→near order
      }
      const r = currentScribble.step(ctx, rngRaw);
      if (r === 'done') {
        currentScribble = null;
        drawnCount++;
      }
    }

    frameCount++;
    const now = performance.now();
    if (now - fpsLast > 500) {
      const fps = frameCount / ((now - fpsLast) / 1000);
      if (onFps) onFps(fps);
      frameCount = 0;
      fpsLast = now;
    }
    if (!currentScribble && specQueue.length === 0) {
      rafId = null;
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  return {
    render(sdfArg, compiled) {
      sdfFn = (sdfArg && typeof sdfArg.f === 'function')
        ? (p) => sdfArg.f(p)
        : null;
      // Camera from compiled.cameraStatic if available
      if (compiled && compiled.cameraStatic) {
        const cs = compiled.cameraStatic;
        camState = {
          position: [
            cs.targetX - cs.distance * Math.sin(cs.yaw) * Math.cos(cs.pitch),
            cs.targetY + cs.distance * Math.sin(cs.pitch),
            cs.targetZ - cs.distance * Math.cos(cs.yaw) * Math.cos(cs.pitch),
          ],
          yaw: cs.yaw, pitch: cs.pitch,
        };
      }
      // Resolve rng for palette + stamp determinism — pull token from URL.
      const urlHash = (() => {
        try { return new URLSearchParams(window.location.search).get('tokenHash'); } catch (_) { return null; }
      })();
      const seedHash = urlHash
        || (compiled && compiled.meta && compiled.meta.hash)
        || '0x' + 'a3f1c92b48d6e077152834f9b62d8e1c93a4f7b528e6c1d09f3b475a682c9e1d';
      runRng = new Random(seedHash);
      palette = buildPalette(runRng, paletteOpts);
      // Show + size the canvas
      crayonCanvas.style.display = 'block';
      resizeIfNeeded();
      paintBackground();
      // Pre-bake all specs upfront (raymarch + slope + color), sort back→front
      currentScribble = null;
      drawnCount = 0;
      specQueue = prebakeSpecs();
      fpsLast = performance.now();
      frameCount = 0;
      // Kick off animation
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(tick);
      return { bytes: 0 };
    },
    unmount() {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      crayonCanvas.style.display = 'none';
      currentScribble = null;
      specQueue = [];
    },
    canRender(_sdf) { return true; },
    setRuneHeightmap(b) { baked = b; if (b) boxSize = [0.5, 1.0, 0.5]; },
    /**
     * Phase 2: bias the buildPalette draws so the per-token palette identity
     * lands in a curated family (jewel-tone / sunset / arctic / etc.) rather
     * than uniform-random. Pass { masterHue, saturation, paperHue/Sat/Val }.
     */
    setPaletteOpts(opts) { paletteOpts = opts || {}; },
    setCamState(patch) {
      if (patch.position) camState.position = [...patch.position];
      if (patch.yaw != null) camState.yaw = patch.yaw;
      if (patch.pitch != null) camState.pitch = patch.pitch;
    },
    getCamState() { return { ...camState, position: [...camState.position] }; },
  };
}
