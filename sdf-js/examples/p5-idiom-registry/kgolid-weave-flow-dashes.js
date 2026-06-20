/**
 * Weave Flow Dashes (multi-layer Perlin-noise flow field as short directional dashes)
 *
 * Source: Kjetil Midtgarden Golid (kgolid),
 *   https://github.com/kgolid/p5ycho/tree/master/weave — MIT-implicit
 * Atlas adaptation: 2026-06-21 — recipe-only port, deterministic 2D value-noise
 *   replacement (no P5 noise() dep), simplified gradient probe with fewer samples.
 *
 * What it does (vs moussa-perlin-flow-field)
 * ------------------------------------------
 * Both are Perlin-noise-driven flow fields, but DIFFERENT VISUAL outcomes:
 *
 *   - moussa-perlin-flow-field: trace LONG flow lines (~100 steps per line,
 *     each a polyline) — looks like wind / fluid streamlines
 *   - kgolid-weave-flow-dashes: each grid cell produces ONE SHORT DASH
 *     pointing along local max-gradient direction — looks like iron filings
 *     under magnetic field, or woven fabric texture
 *
 * Plus: weave LAYERS multiple palette colors (each layer = different noise
 * offset = different flow pattern), producing layered woven aesthetic.
 *
 * Algorithm (per cell): probe N angles around the cell, find max gradient
 * direction (where noise changes most), output a dash pointing that way.
 *
 * Atlas use case
 * --------------
 * Decorative dense background texture with palette layering:
 *   - Subtle behind a foreground KPI hero
 *   - "Fabric" / "weave" cultural metaphor for textile/craft content
 *   - Color-bias indicator (each layer = different metric dimension)
 *
 * Sister idiom to moussa-perlin-flow-field — pick weave for DENSE dash
 * texture, pick moussa for LONG streamlines. Pairs with chromotome palettes.
 *
 * Signature
 * ---------
 *   weaveFlowDashes(opts) → Array<{x, y, dx, dy, layer}>
 *
 *   opts = {
 *     width: 600, height: 360,
 *     cellSize: 12,               — px per dash
 *     noiseScale: 0.005,
 *     probeRadius: 0.06,          — sample radius for gradient probe
 *     probeSamples: 12,           — angle samples per cell
 *     layers: 3,                  — independent flow layers (each gets unique noise offset)
 *     dashScale: 1.6,             — dash length multiplier
 *     seed: 1,
 *   }
 *
 *   Returns array of dashes. Each: {x, y, dx, dy, layer} — pixel coords of
 *   dash midpoint + direction vector (normalized × gradient magnitude × dashScale × cellSize).
 *   Caller draws via: line(d.x, d.y, d.x + d.dx, d.y + d.dy) with stroke = palette[d.layer].
 *
 * Inside-iframe usage:
 *   const dashes = weaveFlowDashes({
 *     width: 600, height: 360, cellSize: 10, layers: 3, seed: 42,
 *   });
 *   const palette = ['#9bacb7', '#51526f', '#9b502b']; // chromotome-style
 *   strokeWeight(0.8);
 *   for (const d of dashes) {
 *     stroke(palette[d.layer]);
 *     line(d.x, d.y, d.x + d.dx, d.y + d.dy);
 *   }
 *
 * Test: scripts/test-p5-idiom-registry.mjs
 */

// Deterministic 2D value noise — same impl as moussa-perlin-flow-field
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
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = smooth(fx);
    const sy = smooth(fy);
    const v00 = rand(ix, iy);
    const v10 = rand(ix + 1, iy);
    const v01 = rand(ix, iy + 1);
    const v11 = rand(ix + 1, iy + 1);
    const a = v00 + (v10 - v00) * sx;
    const b = v01 + (v11 - v01) * sx;
    return a + (b - a) * sy;
  };
}

function _seededRand(seed) {
  let s = seed | 0 || 1;
  return function () {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 0xffffffff;
  };
}

function weaveFlowDashes(opts = {}) {
  const width = opts.width ?? 600;
  const height = opts.height ?? 360;
  const cellSize = opts.cellSize ?? 12;
  const noiseScale = opts.noiseScale ?? 0.005;
  const probeRadius = opts.probeRadius ?? 0.06;
  const probeSamples = opts.probeSamples ?? 12;
  const layers = opts.layers ?? 3;
  const dashScale = opts.dashScale ?? 1.6;
  const seedBase = opts.seed ?? 1;

  const dashes = [];
  const TAU = Math.PI * 2;

  // Per-layer: different noise seed for independent flow patterns
  for (let layer = 0; layer < layers; layer++) {
    const noise = _noise2D(seedBase + layer * 1000);
    const rand = _seededRand(seedBase + layer * 7919);

    for (let py = 0; py < height; py += cellSize) {
      for (let px = 0; px < width; px += cellSize) {
        // Sample probeSamples directions around (px, py), find max-gradient pair
        const nx = px * noiseScale;
        const ny = py * noiseScale;
        let maxDiff = 0;
        let lowX = 0,
          lowY = 0,
          highX = 0,
          highY = 0;

        for (let i = 0; i < probeSamples; i++) {
          const angle = rand() * TAU;
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);
          const pos1x = nx + cosA * probeRadius;
          const pos1y = ny + sinA * probeRadius;
          const pos2x = nx - cosA * probeRadius;
          const pos2y = ny - sinA * probeRadius;
          const v1 = noise(pos1x, pos1y);
          const v2 = noise(pos2x, pos2y);
          const diff = Math.abs(v2 - v1);

          if (diff > maxDiff) {
            maxDiff = diff;
            if (v1 < v2) {
              lowX = pos1x;
              lowY = pos1y;
              highX = pos2x;
              highY = pos2y;
            } else {
              lowX = pos2x;
              lowY = pos2y;
              highX = pos1x;
              highY = pos1y;
            }
          }
        }

        // Dash direction: low → high (gradient ascending). Normalize × magnitude.
        const vx = highX - lowX;
        const vy = highY - lowY;
        const len = Math.sqrt(vx * vx + vy * vy) || 1;
        const mag = (1.4 * maxDiff) / probeRadius;
        const dx = (vx / len) * mag * cellSize * dashScale;
        const dy = (vy / len) * mag * cellSize * dashScale;

        dashes.push({ x: px, y: py, dx, dy, layer });
      }
    }
  }
  return dashes;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { weaveFlowDashes };
}
if (typeof window !== 'undefined') {
  window.weaveFlowDashes = weaveFlowDashes;
}
