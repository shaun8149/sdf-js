// =============================================================================
// Rune Skovbo Johansen — Advanced Terrain Erosion Filter (JS CPU port)
// -----------------------------------------------------------------------------
// Source: https://blog.runevision.com/2026/03/fast-and-gorgeous-erosion-filter.html
// Original GLSL by Rune Skovbo Johansen © 2025, licensed MPL-2.0.
// Derived from earlier work by Clay John (shadertoy MtGcWh) and Fewes (7ljcRW).
//
// This file is licensed MPL-2.0 (not Atlas's PolyForm Noncommercial). It must
// stay self-contained in `src/scene/components/community/` so the MPL boundary
// is file-level — Atlas's core stays PolyForm. Any modifications to this file
// must be released under MPL-2.0 per Section 2.
//
// What this file contains (CPU JS port, NOT GLSL):
//   1. hash2() — pure deterministic 2D-to-2D hash (mirrors Rune's `hash`)
//   2. phacelleNoise() — Rune's novel noise: phase + cell. 4×4 cell iteration,
//      cos+sin waves blended by bell weights. Returns interpolated cos/sin
//      magnitude + sideDir derivative. THE core idiom.
//   3. erosionFilter() — N-octave stack of phacelle, producing per-pixel
//      height delta + slope delta + ridge map.
//   4. bakeHeightmap() — viewer-side entry. Takes SFC32 rng + erosion params
//      + cache resolution. Returns Float32Array(W×H×4) of (height, ridgeMap,
//      treeAmount, erosionOffset) per texel, ready for gl.texImage2D RGBA32F.
//
// Atlas integration (NOT MPL):
//   - src/scene/compile.js registers a PRIMITIVE_BAKES entry for
//     'terrain-eroded-rune' that calls bakeHeightmap(rng, params, res)
//   - src/render/flyLambert.js uploads the result as a sampler2D uniform
//   - src/sdf/terrain-eroded-rune.glsl.js consumes the texture as the SDF
//
// Hash plumbing: per-token diversity is achieved by a 2D `noiseOffset` derived
// from the rng — every hash2() lookup is shifted by this offset, so the noise
// domain (which is infinite) is sampled at a unique location per NFT. The 6
// "visual axis" erosion params (S3 decision: strength, gullyWeight, detail,
// rounding.x/y, onset, cellScale) are also rng-jittered around defaults.
// =============================================================================

// ---------------------------------------------------------------------------
// Deterministic 2D hash (mirrors Rune's GLSL `hash`).
// Returns vec2 ∈ [-1, 1) given vec2 input. Pure function of (x, y).
// ---------------------------------------------------------------------------
function hash2(x, y) {
  // Rune's GLSL: vec2 k = vec2(0.3183099, 0.3678794);
  //              x = x * k + k.yx;
  //              return -1.0 + 2.0 * fract(16.0 * k * fract(x.x * x.y * (x.x + x.y)));
  const kx = 0.3183099, ky = 0.3678794;
  const px = x * kx + ky;
  const py = y * ky + kx;
  const xy = px * py * (px + py);
  const fxy = xy - Math.floor(xy);
  const a = 16 * kx * fxy;
  const b = 16 * ky * fxy;
  return [
    -1 + 2 * (a - Math.floor(a)),
    -1 + 2 * (b - Math.floor(b)),
  ];
}

// ---------------------------------------------------------------------------
// PhacelleNoise (Rune Skovbo Johansen © 2025, MPL-2.0).
// Stripe pattern aligned with normDir, frequency `freq`, phase `offset`.
// `normalization` (0..1) controls magnitude flattening.
// Returns { cos, sin, sx, sy } where (cos, sin) is the normalized wave and
// (sx, sy) is sideDir = perp(normDir) × freq × 2π (used as derivative).
// ---------------------------------------------------------------------------
const TAU = Math.PI * 2;

function phacelleNoise(px, py, ndx, ndy, freq, offset, normalization) {
  // sideDir = perp(normDir) × freq × TAU
  const sdx = -ndy * freq * TAU;
  const sdy =  ndx * freq * TAU;
  const off = offset * TAU;

  const pInt_x = Math.floor(px), pInt_y = Math.floor(py);
  const pFrac_x = px - pInt_x,  pFrac_y = py - pInt_y;

  let phaseX = 0, phaseY = 0, weightSum = 0;
  // 4×4 cell window centered on the integer cell
  for (let j = -1; j <= 2; j++) {
    for (let i = -1; i <= 2; i++) {
      const gridX = pInt_x + i;
      const gridY = pInt_y + j;
      const [roX, roY] = hash2(gridX, gridY);
      const randX = roX * 0.5;  // [-0.5, 0.5]
      const randY = roY * 0.5;
      // vector from cell point to current p
      const vx = pFrac_x - i - randX;
      const vy = pFrac_y - j - randY;
      const sqrDist = vx * vx + vy * vy;
      let weight = Math.exp(-sqrDist * 2.0);
      // Subtract 0.01111 so it goes to 0 at dist 1.5
      weight = Math.max(0, weight - 0.01111);
      weightSum += weight;

      // Wave input = dot(v, sideDir) + offset
      const wi = vx * sdx + vy * sdy + off;
      phaseX += Math.cos(wi) * weight;
      phaseY += Math.sin(wi) * weight;
    }
  }

  const interpX = phaseX / weightSum;
  const interpY = phaseY / weightSum;
  let magnitude = Math.sqrt(interpX * interpX + interpY * interpY);
  magnitude = Math.max(1 - normalization, magnitude);

  return {
    cos: interpX / magnitude,
    sin: interpY / magnitude,
    sx: sdx,
    sy: sdy,
  };
}

// ---------------------------------------------------------------------------
// Utility easing functions (Rune's GLSL helpers).
// ---------------------------------------------------------------------------
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function powInv(t, p) { return 1 - Math.pow(1 - clamp01(t), p); }
function easeOut(t) { const v = 1 - clamp01(t); return 1 - v * v; }
function smoothStart(t, smoothing) {
  if (t >= smoothing) return t - 0.5 * smoothing;
  return 0.5 * t * t / smoothing;
}
function safeNormalize2(x, y) {
  const l = Math.sqrt(x * x + y * y);
  if (Math.abs(l) > 1e-10) return [x / l, y / l];
  return [x, y];
}

// ---------------------------------------------------------------------------
// ErosionFilter (Rune Skovbo Johansen © 2025, MPL-2.0).
//
// Iteratively stacks Phacelle gully patterns onto an input heightfield.
// Each octave's gully direction is informed by the previous octave's slope.
//
// Returns { dh, dhx, dhy, magnitude, ridgeMap, debug }
//   dh, dhx, dhy : height delta + slope delta accumulated across octaves
//   magnitude     : sum of per-octave strengths (for normalizing dh)
//   ridgeMap      : -1 at creases, +1 at ridges, used for drainage rendering
//   debug         : final fadeTarget value (per-pixel)
//
// Inputs match Rune's GLSL signature; see his blog for parameter meanings.
// ---------------------------------------------------------------------------
function erosionFilter(
  px, py,
  h, dhx, dhy,
  fadeTarget,
  // stylistic
  strength, gullyWeight, detail,
  roundingX, roundingY, roundingZ, roundingW,
  onsetX, onsetY, onsetZ, onsetW,
  assumedSlopeX, assumedSlopeY,
  // scale
  scale, octaves, lacunarity,
  // other
  gain, cellScale, normalization,
) {
  strength *= scale;
  fadeTarget = Math.max(-1, Math.min(1, fadeTarget));

  const inH = h, inDhx = dhx, inDhy = dhy;
  let freq = 1.0 / (scale * cellScale);
  const slopeLength = Math.max(Math.sqrt(dhx * dhx + dhy * dhy), 1e-10);
  let magnitude = 0;
  let roundingMult = 1.0;

  const roundingForInput = roundingZ *
    (roundingY * clamp01(fadeTarget + 0.5) + roundingX * (1 - clamp01(fadeTarget + 0.5)));
  let combiMask = easeOut(smoothStart(slopeLength * onsetX, roundingForInput * onsetX));

  let ridgeMapCombiMask = easeOut(slopeLength * onsetZ);
  let ridgeMapFadeTarget = fadeTarget;

  // gullySlope = mix(actual, normalized*assumedSlopeX, assumedSlopeY)
  let gullySlopeX = dhx * (1 - assumedSlopeY) + (dhx / slopeLength) * assumedSlopeX * assumedSlopeY;
  let gullySlopeY = dhy * (1 - assumedSlopeY) + (dhy / slopeLength) * assumedSlopeX * assumedSlopeY;

  for (let i = 0; i < octaves; i++) {
    const [gnx, gny] = safeNormalize2(gullySlopeX, gullySlopeY);
    const phacelle = phacelleNoise(px * freq, py * freq, gnx, gny, cellScale, 0.25, normalization);
    // multiply sideDir by freq (since p was multiplied by freq) and negate
    // (slope direction points DOWN).
    const phZx = -phacelle.sx * freq;
    const phZy = -phacelle.sy * freq;
    const sloping = Math.abs(phacelle.sin);
    const phaSign = Math.sign(phacelle.sin) || 0;

    // Accumulate non-masked normalized slope for next octaves' direction
    gullySlopeX += phaSign * phZx * strength * gullyWeight;
    gullySlopeY += phaSign * phZy * strength * gullyWeight;

    // Height offset + derivative (slope) approximation
    const gulliesH = phacelle.cos;
    const gulliesX = phacelle.sin * phZx;
    const gulliesY = phacelle.sin * phZy;

    // Fade gullies towards fadeTarget based on combiMask
    const fadedH = fadeTarget * (1 - combiMask) + gulliesH * gullyWeight * combiMask;
    const fadedX = 0           * (1 - combiMask) + gulliesX * gullyWeight * combiMask;
    const fadedY = 0           * (1 - combiMask) + gulliesY * gullyWeight * combiMask;

    h   += fadedH * strength;
    dhx += fadedX * strength;
    dhy += fadedY * strength;
    magnitude += strength;
    fadeTarget = fadedH;

    // Update mask using new octave's contribution
    const roundingForOctave = roundingMult *
      (roundingY * clamp01(phacelle.cos + 0.5) + roundingX * (1 - clamp01(phacelle.cos + 0.5)));
    const newMask = easeOut(smoothStart(sloping * onsetY, roundingForOctave * onsetY));
    combiMask = powInv(combiMask, detail) * newMask;

    // Ridge map update (different onset, no rounding)
    ridgeMapFadeTarget = ridgeMapFadeTarget * (1 - ridgeMapCombiMask) + gulliesH * ridgeMapCombiMask;
    const newRidgeMapMask = easeOut(sloping * onsetW);
    ridgeMapCombiMask = ridgeMapCombiMask * newRidgeMapMask;

    strength *= gain;
    freq *= lacunarity;
    roundingMult *= roundingW;
  }

  const ridgeMap = ridgeMapFadeTarget * (1 - ridgeMapCombiMask);

  return {
    dh: h - inH,
    dhx: dhx - inDhx,
    dhy: dhy - inDhy,
    magnitude,
    ridgeMap,
    debug: fadeTarget,
  };
}

// ---------------------------------------------------------------------------
// Default erosion parameter values (Rune's reference settings).
// The 6 "visual axis" params get jittered per-hash; the rest stay fixed for
// geological correctness (S3 decision).
// ---------------------------------------------------------------------------
export const DEFAULT_EROSION_PARAMS = {
  // visual axis (hash-perturbed)
  strength:     0.22,
  gullyWeight:  0.5,
  detail:       1.5,
  roundingX:    0.1,   // ridge rounding
  roundingY:    0.0,   // crease rounding
  onset:        [0.7, 1.25, 2.8, 1.5],
  cellScale:    0.7,
  // geological axis (fixed)
  scale:        0.15,
  octaves:      5,
  lacunarity:   2.0,
  gain:         0.5,
  normalization: 0.5,
  roundingZ:    0.1,   // height function multiplier (fixed for scale match)
  roundingW:    2.0,   // per-octave rounding multiplier (matches lacunarity)
  assumedSlope: [0.7, 1.0],
  // height function (default Rune bump)
  defaultHeight: 0.45,
  bumpAmount:    0.1,
  // shading thresholds (used in shader, but stored here for consistency)
  waterHeight:  0.46,
  grassHeight:  0.465,
};

// ---------------------------------------------------------------------------
// jitterParams(rng, defaults) — apply hash-derived perturbations to the
// 6 visual-axis params. Returns a new params object.
// ---------------------------------------------------------------------------
export function jitterParams(rng, defaults = DEFAULT_EROSION_PARAMS) {
  const r = () => rng.random_num(-1, 1);
  const p = { ...defaults };
  p.strength    = clamp01(defaults.strength    + r() * 0.075);   // ±0.075 → [0.145, 0.295]
  p.gullyWeight = clamp01(defaults.gullyWeight + r() * 0.2);     // ±0.2   → [0.3, 0.7]
  p.detail      =          defaults.detail     + r() * 0.5;      // ±0.5   → [1.0, 2.0]
  p.roundingX   = clamp01(defaults.roundingX   + r() * 0.1);     // ±0.1   → [0.0, 0.2]
  p.roundingY   = clamp01(defaults.roundingY   + r() * 0.1);     // ±0.1   → [0.0, 0.1]
  p.cellScale   =          defaults.cellScale  + r() * 0.2;      // ±0.2   → [0.5, 0.9]
  p.onset       = [
    Math.max(0.1, defaults.onset[0] + r() * 0.14),
    Math.max(0.1, defaults.onset[1] + r() * 0.25),
    Math.max(0.1, defaults.onset[2] + r() * 0.56),
    Math.max(0.1, defaults.onset[3] + r() * 0.30),
  ];
  // Noise domain offset — gives totally different terrains for same params,
  // different hash. Range chosen large enough to land in disjoint noise regions.
  p.noiseOffsetX = rng.random_num(-1000, 1000);
  p.noiseOffsetY = rng.random_num(-1000, 1000);
  return p;
}

// ---------------------------------------------------------------------------
// generateBumpField(rng, defaultHeight)
// Generates a per-hash "initial paint" — 2-4 mountain bumps at random
// positions / sizes / heights. This replaces Rune's user-painted Buffer A.
// For NFT diversity this is the PRIMARY shape vector (gully pattern alone
// without initial-paint variation produces near-identical mountains).
// Returns an array of bumps [{cx, cy, brush, amount}].
// ---------------------------------------------------------------------------
function generateBumpField(rng) {
  const numBumps = rng.random_int(1, 3);  // 1-3 mountains
  const bumps = [];
  // Total bump budget capped so multiple overlapping bumps don't blow past
  // box ceiling (defaultHeight 0.45 + budget ≤ 0.95 leaves headroom).
  const totalBudget = 0.50;
  for (let i = 0; i < numBumps; i++) {
    const remainingBudget = totalBudget * (numBumps - i) / numBumps;
    bumps.push({
      cx: rng.random_num(0.30, 0.70),
      cy: rng.random_num(0.30, 0.70),
      brush: rng.random_num(0.25, 0.45),
      // Bigger amount when fewer bumps; smaller when many overlap.
      amount: rng.random_num(remainingBudget * 0.4, remainingBudget * 0.8),
    });
  }
  return bumps;
}

// Evaluate sum of bumps at uv. Returns [h, dh/dx, dh/dy].
function initialPaintBumps(ux, uy, defaultHeight, bumps) {
  let h = defaultHeight, dhx = 0, dhy = 0;
  for (const b of bumps) {
    const dx = b.cx - ux, dy = b.cy - uy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const freq = 1 / b.brush;
    let x = 1 - freq * dist; if (x < 0) x = 0; if (x > 1) x = 1;
    const bumpH = x * x * (3 - 2 * x);
    const slopeMag = 6 * x * (1 - x) * freq;
    h += bumpH * b.amount;
    if (dist > 1e-6) {
      dhx += (dx / dist) * slopeMag * b.amount;
      dhy += (dy / dist) * slopeMag * b.amount;
    }
  }
  return [h, dhx, dhy];
}

// ---------------------------------------------------------------------------
// bakeHeightmap(rng, params, resolution)
//   → Float32Array(resolution × resolution × 4)
//
// Channels per texel:
//   [0] eroded height    ∈ [0, 1]  (input to SDF as p.y - height * boxY)
//   [1] ridgeMap         ∈ [-1, 1] (used for drainage shading)
//   [2] treeAmount       ∈ [-1, 2] roughly (clamped in shader)
//   [3] erosionOffset    ∈ [-1, 1] (= dh / magnitude, used for occlusion)
//
// Time complexity: O(W × H × octaves × 16 cells) = 512² × 5 × 16 ≈ 21M ops.
// Run time: ~1-2 s in V8 on a modern laptop, main thread (acceptable for
// one-time init). Phase 2 may move to a Web Worker.
// ---------------------------------------------------------------------------
export function bakeHeightmap(rng, paramsIn = {}, resolution = 512) {
  const params = jitterParams(rng, { ...DEFAULT_EROSION_PARAMS, ...paramsIn });
  // Initial paint = 1-3 mountain bumps at hash-derived positions.
  // Generated AFTER jitterParams so its rng draws are deterministic to hash.
  const bumps = generateBumpField(rng);

  const W = resolution, H = resolution;
  const data = new Float32Array(W * H * 4);
  const offX = params.noiseOffsetX || 0;
  const offY = params.noiseOffsetY || 0;

  for (let j = 0; j < H; j++) {
    const uy = j / H;
    for (let i = 0; i < W; i++) {
      const ux = i / W;
      // 1. Initial paint (1-3 hash-derived bumps)
      const [h0, dhx0, dhy0] = initialPaintBumps(ux, uy, params.defaultHeight, bumps);
      // 2. fadeTarget based on altitude (peaks → +1, valleys → -1)
      const fadeTarget = Math.max(-1, Math.min(1, (h0 - params.defaultHeight) / 0.15));
      // 3. Apply erosion. Sample noise at uv + per-hash offset for NFT diversity.
      const ph = ux + offX;
      const pq = uy + offY;
      const er = erosionFilter(
        ph, pq, h0, dhx0, dhy0, fadeTarget,
        params.strength, params.gullyWeight, params.detail,
        params.roundingX, params.roundingY, params.roundingZ, params.roundingW,
        params.onset[0], params.onset[1], params.onset[2], params.onset[3],
        params.assumedSlope[0], params.assumedSlope[1],
        params.scale, params.octaves, params.lacunarity,
        params.gain, params.cellScale, params.normalization,
      );
      const eroded = h0 + er.dh;
      // 4. Tree placement (geometric component only — shader adds fine noise
      //    breakup at render time so we don't need a 2D noise function CPU-side).
      //    Rune's full GetTreesAmount = this product × (1 - noise²). We store
      //    just the product; shader multiplies the noise term when shading.
      const normalLenSq = 1 + (dhx0 + er.dhx) * (dhx0 + er.dhx) + (dhy0 + er.dhy) * (dhy0 + er.dhy);
      const normalY = 1 / Math.sqrt(normalLenSq);
      const occlusion = er.dh / Math.max(1e-6, er.magnitude) + 0.5;
      const treesAmount = (
        smoothstep(params.grassHeight + 0.05, params.grassHeight + 0.01, eroded + 0.01 + (occlusion - 0.8) * 0.05) *
        smoothstep(0.0, 0.4, occlusion) *
        smoothstep(0.95, 1.0, normalY) *
        smoothstep(-1.4, 0.0, er.ridgeMap) *
        smoothstep(params.waterHeight + 0.0, params.waterHeight + 0.007, eroded)
      );
      // 5. Pack into 4 channels (all in [0, 1] for clean texture upload)
      const idx = (j * W + i) * 4;
      data[idx + 0] = clamp01(eroded);
      data[idx + 1] = clamp01(er.ridgeMap * 0.5 + 0.5);  // [-1,1] → [0,1]
      data[idx + 2] = clamp01(treesAmount);
      data[idx + 3] = clamp01(er.dh / Math.max(1e-6, er.magnitude) * 0.5 + 0.5);
    }
  }

  return { data, width: W, height: H, params };
}

function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------------------
// SDF wrapper for Atlas registration. The CPU stub is just the box bound;
// real heightmap sampling happens in GLSL via sdTerrainErodedRune in
// sdf3.glsl.js, reading sampler2D u_heightmap.
//
// The AST carries boxSize for GLSL emit. `_bakedHeightmap` is attached by
// compile.js after calling bakeHeightmap(rng, args, resolution).
// ---------------------------------------------------------------------------
import { SDF3 } from '../../../sdf/core.js';

export function terrainErodedRuneSDF({
  boxSize     = [0.5, 1.0, 0.5],
  waterHeight = 0.46,
} = {}) {
  const [bx, by, bz] = boxSize;
  const inst = SDF3((p) => {
    // CPU stub: just the box bound. Real heightmap-as-SDF lives on GPU.
    const dx = Math.abs(p[0]) - bx;
    const dy = Math.abs(p[1] - by * 0.5) - by * 0.5;
    const dz = Math.abs(p[2]) - bz;
    return Math.min(Math.max(dx, Math.max(dy, dz)), 0) +
      Math.hypot(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0));
  });
  inst.ast = {
    kind: 'prim',
    name: 'terrain-eroded-rune',
    args: [bx, by, bz, waterHeight],
  };
  return inst;
}

// ---------------------------------------------------------------------------
// Spec describing this primitive for Atlas registration (used by compile.js
// to look up the bake function + default args).
// ---------------------------------------------------------------------------
export const terrainErodedRuneSpec = {
  type: 'terrain-eroded-rune',
  category: 'terrain',
  bake: bakeHeightmap,
  args: {
    seed: { type: 'string', default: null, doc: 'tokenHash — overridden by URL ?tokenHash=' },
    boxSize: { type: 'vec3', default: [0.5, 1.0, 0.5] },
    waterHeight: { type: 'number', default: 0.46 },
    cacheResolution: { type: 'number', default: 512 },
  },
  source: {
    portedFrom: 'https://blog.runevision.com/2026/03/fast-and-gorgeous-erosion-filter.html',
    originalAuthor: 'Rune Skovbo Johansen',
    license: 'MPL-2.0',
    portedAt: '2026-05-25',
    porter: 'Atlas / Claude',
  },
};
