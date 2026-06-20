/**
 * Perlin Noise Flow Field (angle grid + flow line tracing)
 *
 * Source: Ahmad Moussa,
 *   https://www.gorillasun.de/blog/perlin-noise-flow-fields-in-processing-part-i/
 *   https://www.gorillasun.de/blog/perlin-noise-flow-fields-in-processing-part-ii/
 * Atlas adaptation: 2026-06-20 — recipe-only port, combined I + II, deterministic
 *   2D value-noise replacement so output is reproducible without P5's noise().
 *
 * What it does
 * ------------
 * Builds a 2D angle grid where each grid point's angle is derived from
 * smooth noise. Then traces flow lines: each line starts at a random point
 * and walks step-by-step in the direction sampled from the nearest grid cell.
 * Output is a set of organic curving polylines resembling wind / fluid /
 * iron filings under magnetic field.
 *
 * Atlas use case
 * --------------
 * Background texture for P5 fallback sketches that need visual richness
 * without competing with foreground KPI / labels:
 *   - "Market dynamics" / "trends flowing" — ambient background flow lines
 *   - "Network traffic" / "data flow" — diagonal-bias flow over a network diagram
 *   - Tier B visual identity — gives Atlas P5 output a recognizable signature
 *     vs Napkin/antvis's flat-vector look
 *
 * Use as SUBTLE background (low opacity, sparse lines) — not foreground IP.
 *
 * Signatures
 * ----------
 *   buildFlowField(width, height, opts) → angleGrid (2D array of {x, y, angle})
 *
 *   traceFlowLines(angleGrid, opts) → Array<polyline>
 *     where polyline = [[x, y], [x, y], ...]
 *
 *   opts.spacing (default 20)   — grid cell size
 *   opts.noiseScale (default 0.005) — frequency of noise (smaller = smoother)
 *   opts.lineCount (default 100)
 *   opts.stepsPerLine (default 80)
 *   opts.stepLength (default 3)
 *   opts.seed (default 42) — deterministic
 *
 * Inside-iframe usage:
 *   const grid = buildFlowField(600, 360, {spacing: 25, noiseScale: 0.008, seed: 1});
 *   const lines = traceFlowLines(grid, {lineCount: 200, stepsPerLine: 60, stepLength: 4});
 *   const fg = window.__brandingPalette.silhouetteColor;
 *   stroke(fg[0], fg[1], fg[2], 40);    // semi-transparent for subtle texture
 *   strokeWeight(0.8);
 *   noFill();
 *   for (const line of lines) {
 *     beginShape();
 *     for (const [x, y] of line) vertex(x, y);
 *     endShape();
 *   }
 *
 * Test: scripts/test-p5-idiom-registry.mjs covers grid build + line tracing.
 */

// Deterministic 2D value noise — replaces P5's noise() so output is reproducible
// independent of P5's PRNG state. Bilinear interpolation between integer-lattice
// pseudo-random values; smoothstep easing. Not Perlin (no gradients), but smooth
// enough for flow-field aesthetics.
function _noise2D(seed) {
  function rand(ix, iy) {
    let h = (ix * 374761393 + iy * 668265263 + seed * 1274126177) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 0xffffffff;
  }
  function smooth(t) {
    return t * t * (3 - 2 * t);
  }
  return function (x, y) {
    const ix = Math.floor(x),
      iy = Math.floor(y);
    const fx = x - ix,
      fy = y - iy;
    const v00 = rand(ix, iy);
    const v10 = rand(ix + 1, iy);
    const v01 = rand(ix, iy + 1);
    const v11 = rand(ix + 1, iy + 1);
    const sx = smooth(fx),
      sy = smooth(fy);
    const a = v00 + (v10 - v00) * sx;
    const b = v01 + (v11 - v01) * sx;
    return a + (b - a) * sy;
  };
}

function buildFlowField(width, height, opts = {}) {
  const spacing = opts.spacing ?? 20;
  const noiseScale = opts.noiseScale ?? 0.005;
  const seed = opts.seed ?? 42;
  const noise = _noise2D(seed);
  const TAU = Math.PI * 2;

  const grid = [];
  for (let x = 0; x < width; x += spacing) {
    const col = [];
    for (let y = 0; y < height; y += spacing) {
      // Sample noise, multiply by TAU * extra factor for richer angle variation
      const angle = noise(x * noiseScale, y * noiseScale) * TAU * 2;
      col.push({ x, y, angle });
    }
    grid.push(col);
  }
  // Attach metadata for tracer
  grid._spacing = spacing;
  grid._width = width;
  grid._height = height;
  return grid;
}

function traceFlowLines(grid, opts = {}) {
  const spacing = grid._spacing || 20;
  const width = grid._width || 600;
  const height = grid._height || 360;
  const lineCount = opts.lineCount ?? 100;
  const stepsPerLine = opts.stepsPerLine ?? 80;
  const stepLength = opts.stepLength ?? 3;
  const seed = opts.seed ?? 1;
  const rng = _seededRand(seed);

  const lines = [];
  for (let i = 0; i < lineCount; i++) {
    let x = rng() * width;
    let y = rng() * height;
    const line = [[x, y]];
    for (let s = 0; s < stepsPerLine; s++) {
      const gx = Math.floor(x / spacing);
      const gy = Math.floor(y / spacing);
      if (gx < 0 || gy < 0 || gx >= grid.length || gy >= (grid[0]?.length || 0)) break;
      const angle = grid[gx][gy].angle;
      x += Math.cos(angle) * stepLength;
      y += Math.sin(angle) * stepLength;
      if (x < 0 || x >= width || y < 0 || y >= height) break;
      line.push([x, y]);
    }
    if (line.length > 1) lines.push(line);
  }
  return lines;
}

// LCG-style deterministic RNG for line seed (Math.random() would break determinism)
function _seededRand(seed) {
  let s = seed | 0 || 1;
  return function () {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 0xffffffff;
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildFlowField, traceFlowLines };
}
if (typeof window !== 'undefined') {
  window.buildFlowField = buildFlowField;
  window.traceFlowLines = traceFlowLines;
}
