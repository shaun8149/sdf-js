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

export function buildPalette(rng, opts = {}) {
  // Phase 2: opts allow external bias of palette family. When provided,
  // these override the rng draws — used by bonsai-nft to pick from a
  // curated set of "palette families" (jewel-tone / sunset / cold / etc.)
  // rather than fully-random palettes per token.
  // Paper: warm earth-toned off-white. Slight hash perturbation per token.
  const paperH = opts.paperHue ?? (0.07 + rng.random_num(-0.02, 0.03));
  const paperS = opts.paperSat ?? (0.18 + rng.random_num(-0.05, 0.05));
  const paperV = opts.paperVal ?? (0.84 + rng.random_num(-0.04, 0.04));
  const paper = hsv2rgb(paperH, paperS, paperV);
  // Master hue rotation — defines whole palette identity for this token.
  const masterHue = opts.masterHue ?? rng.random_dec();
  const sat = opts.saturation ?? (0.45 + rng.random_num(-0.20, 0.25));
  // 6 stroke colors, lightness ramp from dark to light:
  // crayon strokes layer over paper; need 6 grades from shadow → highlight.
  const stroke = [];
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const h = (masterHue + t * 0.12) % 1;       // slight hue shift along ramp
    const s = sat * (1 - t * 0.4);              // less saturated at highlight
    const v = 0.25 + t * 0.60;                  // 0.25 → 0.85
    stroke.push(hsv2rgb(h, s, v));
  }
  // Tree colors: 3 deep greens / browns (always darker, distinct hue).
  const treeHue = (masterHue + 0.4) % 1;        // ~complementary
  const tree = [
    hsv2rgb(treeHue, 0.60, 0.28),               // dark trunk
    hsv2rgb(treeHue, 0.55, 0.42),               // mid foliage
    hsv2rgb(treeHue, 0.45, 0.55),               // light foliage
  ];
  return { paper, stroke, tree };
}

// Pick a stroke color by lightValue ∈ [0, 1]. Lerp between adjacent stops.
export function sampleStroke(palette, lightValue) {
  const v = Math.max(0, Math.min(1, lightValue)) * 5;
  const lo = Math.floor(v);
  const hi = Math.min(5, lo + 1);
  const t = v - lo;
  const a = palette.stroke[lo];
  const b = palette.stroke[hi];
  return [
    Math.round(a[0] * (1 - t) + b[0] * t),
    Math.round(a[1] * (1 - t) + b[1] * t),
    Math.round(a[2] * (1 - t) + b[2] * t),
  ];
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
  const TICKS_PER_FRAME = 1500;  // many physics ticks/frame → fast playback

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
    const sk = new SketchyEllipse(spec.px, spec.py, spec.rx, spec.ry, 1.6, false);
    sk.wt = spec.wt;
    sk.maxV = 1.0;
    sk.acc = 0.02;
    sk.density = 2;
    sk.wobble = 0.2;
    sk.angle = spec.angle;
    const c = spec.colorBase;
    sk.color = [c[0], c[1], c[2], spec.alpha];
    return sk;
  }

  // Pre-bake all scribble specs (raymarch + slope + color), sort by depth so
  // animation plays back back-to-front (painter's algorithm). Also generates
  // a sparse "sky" pass of low-opacity light strokes for atmosphere.
  function prebakeSpecs() {
    const w = crayonCanvas.width, h = crayonCanvas.height;
    const focal = (getControls && getControls().fov) || 1.5;
    const surfaceSpecs = [];
    const skySpecs = [];
    // Oversample so we get enough HITS (rays that miss go to sky bucket).
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
        // Sparse sky stroke — light, big, low opacity, random angle. Big
        // depth so they paint FIRST (background).
        const c = sampleStroke(palette, 0.88);
        skySpecs.push({
          px, py, angle: runRng.random_num(0, Math.PI * 2),
          colorBase: c, rx: 16, ry: 5, wt: 5, alpha: 0.05,
          depth: 999,                                       // pushes to back of sort
        });
      }
    }
    // Painter's algorithm — far (high depth) drawn FIRST. Sort ASCending and
    // pop from end so the LAST element popped first = highest depth = back.
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
